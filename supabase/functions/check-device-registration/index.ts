
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const deviceId = url.searchParams.get('device_id')

    console.log('Device registration check for:', deviceId)

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'device_id parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if device exists in device_assignments table
    const { data: deviceAssignments, error } = await supabaseClient
      .from('device_assignments')
      .select('device_id, device_name, channel_count, user_id')
      .eq('device_id', deviceId)
      .limit(1)

    console.log('Database query result:', { deviceAssignments, error })

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!deviceAssignments || deviceAssignments.length === 0) {
      console.log('Device not found:', deviceId)
      return new Response(
        JSON.stringify({ 
          registered: false, 
          message: `Device ${deviceId} not found in dashboard. Please add this device first.`,
          device_id: deviceId
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const deviceAssignment = deviceAssignments[0]
    console.log('Device found and registered:', deviceAssignment)

    return new Response(
      JSON.stringify({
        registered: true,
        device_id: deviceAssignment.device_id,
        device_name: deviceAssignment.device_name,
        channel_count: deviceAssignment.channel_count,
        message: `Device ${deviceId} is registered and ready for communication`,
        handshake_success: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        registered: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
