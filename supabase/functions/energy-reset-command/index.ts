
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoteRequest {
  device_id: string;
}

interface ResetCommandRequest {
  device_id: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    let requestData;
    
    try {
      requestData = JSON.parse(body);
    } catch (e) {
      requestData = {};
    }

    console.log('Request method:', req.method);
    console.log('Request body:', requestData);

    // Handle voting requests
    if (req.method === 'POST' && requestData.action === 'vote') {
      return await handleVote(req, requestData);
    } 
    // Handle status requests
    else if (req.method === 'POST' && requestData.action === 'status') {
      return await getResetStatus(requestData);
    }
    // Handle check-reset requests
    else if (req.method === 'GET') {
      const url = new URL(req.url);
      const device_id = url.searchParams.get('device_id');
      if (device_id) {
        return await checkResetCommand(device_id);
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error('Error in energy-reset-command:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

async function handleVote(req: Request, requestData: any): Promise<Response> {
  const { device_id } = requestData;
  
  if (!device_id) {
    return new Response(
      JSON.stringify({ error: 'Missing device_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Get user from JWT
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  
  if (authError || !user) {
    console.error('Auth error:', authError);
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  console.log('User authenticated:', user.id);

  // Get device info to determine required votes - get any assignment for this device
  const { data: deviceData, error: deviceError } = await supabase
    .from('device_assignments')
    .select('channel_count')
    .eq('device_id', device_id)
    .limit(1)
    .single();

  if (deviceError || !deviceData) {
    console.error('Device lookup error:', deviceError);
    return new Response(
      JSON.stringify({ error: 'Device not found or user not authorized' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  console.log('Device data:', deviceData);

  // Check if there's an active reset session
  let { data: session, error: sessionError } = await supabase
    .from('energy_reset_sessions')
    .select('*')
    .eq('device_id', device_id)
    .eq('status', 'voting')
    .gt('expires_at', new Date().toISOString())
    .single();

  // Create new session if none exists
  if (!session) {
    console.log('Creating new session');
    const { data: newSession, error: createError } = await supabase
      .from('energy_reset_sessions')
      .insert({
        device_id,
        required_votes: deviceData.channel_count,
        votes_received: 0
      })
      .select()
      .single();

    if (createError) {
      console.error('Session creation error:', createError);
      throw createError;
    }
    session = newSession;
  }

  console.log('Session:', session);

  // Try to cast vote
  const { error: voteError } = await supabase
    .from('energy_reset_votes')
    .insert({
      device_id,
      user_id: user.id
    });

  if (voteError) {
    console.error('Vote error:', voteError);
    if (voteError.message.includes('duplicate key') || voteError.message.includes('unique_user_device_vote')) {
      return new Response(
        JSON.stringify({ error: 'You have already voted for this reset' }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    throw voteError;
  }

  console.log('Vote cast successfully');

  // Count total votes
  const { count: voteCount, error: countError } = await supabase
    .from('energy_reset_votes')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', device_id);

  if (countError) {
    console.error('Count error:', countError);
    throw countError;
  }

  console.log('Vote count:', voteCount);

  // Update session with new vote count
  const { error: updateError } = await supabase
    .from('energy_reset_sessions')
    .update({ votes_received: voteCount || 0 })
    .eq('id', session.id);

  if (updateError) {
    console.error('Update error:', updateError);
    throw updateError;
  }

  // Check if we have enough votes to execute reset
  let resetTriggered = false;
  if (voteCount && voteCount >= deviceData.channel_count) {
    // Mark session as executing
    await supabase
      .from('energy_reset_sessions')
      .update({ 
        status: 'executing',
        reset_executed_at: new Date().toISOString()
      })
      .eq('id', session.id);

    resetTriggered = true;
    console.log(`Energy reset triggered for device ${device_id} with ${voteCount} votes`);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      votes_received: voteCount,
      required_votes: deviceData.channel_count,
      reset_triggered: resetTriggered
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function getResetStatus(requestData: any): Promise<Response> {
  const { device_id } = requestData;

  console.log('Getting reset status for device:', device_id);

  if (!device_id) {
    return new Response(
      JSON.stringify({ error: 'Missing device_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Get active session
  const { data: session } = await supabase
    .from('energy_reset_sessions')
    .select('*')
    .eq('device_id', device_id)
    .eq('status', 'voting')
    .gt('expires_at', new Date().toISOString())
    .single();

  // Get votes with user profiles using a manual join approach
  const { data: votes, error: votesError } = await supabase
    .from('energy_reset_votes')
    .select('*')
    .eq('device_id', device_id);

  if (votesError) {
    console.error('Error fetching votes:', votesError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch votes' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Fetch user profiles separately for the voters
  let votesWithProfiles = votes || [];
  if (votes && votes.length > 0) {
    const userIds = votes.map(vote => vote.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    if (!profilesError && profiles) {
      // Combine votes with profiles
      votesWithProfiles = votes.map(vote => {
        const profile = profiles.find(p => p.user_id === vote.user_id);
        return {
          ...vote,
          profiles: profile ? { full_name: profile.full_name } : null
        };
      });
    }
  }

  // Get required votes from device assignment
  const { data: deviceData, error: deviceError } = await supabase
    .from('device_assignments')
    .select('channel_count')
    .eq('device_id', device_id)
    .limit(1)
    .single();

  console.log('Device data query result:', deviceData, 'Error:', deviceError);

  const votesReceived = votesWithProfiles?.length || 0;
  const requiredVotes = deviceData?.channel_count || 0;

  console.log('Reset status response:', {
    session,
    votes_count: votesReceived,
    required_votes: requiredVotes,
    has_session: !!session,
    votes_with_profiles: votesWithProfiles?.map(v => ({ 
      user_id: v.user_id, 
      full_name: v.profiles?.full_name 
    }))
  });

  return new Response(
    JSON.stringify({
      session,
      votes: votesWithProfiles || [],
      required_votes: requiredVotes,
      votes_received: votesReceived
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function checkResetCommand(device_id: string): Promise<Response> {
  if (!device_id) {
    return new Response(
      JSON.stringify({ error: 'Missing device_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Check for pending reset commands
  const { data: session, error } = await supabase
    .from('energy_reset_sessions')
    .select('*')
    .eq('device_id', device_id)
    .eq('status', 'executing')
    .single();

  if (error || !session) {
    return new Response(
      JSON.stringify({ reset_command: false }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Mark as completed
  await supabase
    .from('energy_reset_sessions')
    .update({ status: 'completed' })
    .eq('id', session.id);

  // Clear votes for this device
  await supabase
    .from('energy_reset_votes')
    .delete()
    .eq('device_id', device_id);

  console.log(`Reset command acknowledged by device ${device_id}`);

  return new Response(
    JSON.stringify({ 
      reset_command: true,
      message: 'Energy counters have been reset successfully!'
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

serve(handler);
