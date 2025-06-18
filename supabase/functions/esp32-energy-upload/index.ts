
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestData = await req.json()
    console.log('Received energy data:', requestData)
    
    const { device_id, channel_number, current, power, energy_wh } = requestData

    if (!device_id || channel_number === undefined) {
      console.log('Missing required fields:', { device_id, channel_number })
      return new Response(
        JSON.stringify({ error: 'device_id and channel_number are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if device exists in device_assignments table
    const { data: deviceAssignments, error: deviceError } = await supabaseClient
      .from('device_assignments')
      .select('device_id, channel_count, user_id')
      .eq('device_id', device_id)
      .limit(1)

    console.log('Device verification:', { deviceAssignments, deviceError })

    if (deviceError || !deviceAssignments || deviceAssignments.length === 0) {
      console.log('Device not registered:', device_id)
      return new Response(
        JSON.stringify({ 
          error: 'Device not registered',
          message: `Device ${device_id} must be added to dashboard first`,
          registered: false
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const deviceAssignment = deviceAssignments[0]

    // Verify channel number is within device's channel count
    if (channel_number > deviceAssignment.channel_count || channel_number < 1) {
      console.log('Invalid channel number:', { channel_number, max: deviceAssignment.channel_count })
      return new Response(
        JSON.stringify({ error: 'Invalid channel number' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Store energy reading in the new energy_data table
    const energyReading = {
      device_id,
      channel_number: parseInt(channel_number),
      current: parseFloat(current) || 0,
      power: parseFloat(power) || 0,
      energy_wh: parseFloat(energy_wh) || 0,
      timestamp: new Date().toISOString()
    }

    const { data: insertData, error: insertError } = await supabaseClient
      .from('energy_data')
      .insert(energyReading)

    if (insertError) {
      console.error('Database insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store energy data', details: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get total bill for cost calculation
    const { data: totalBillData } = await supabaseClient
      .from('total_bill_settings')
      .select('total_bill_amount')
      .eq('device_id', device_id)
      .single()

    const totalBill = totalBillData?.total_bill_amount || 0

    // Calculate proportional cost based on energy consumption
    const channelEnergy = parseFloat(energy_wh) || 0
    const proportionalCost = totalBill > 0 ? (channelEnergy / 1000) * (totalBill / 30) : 0 // Rough daily cost estimate

    // Send real-time update via Supabase channels
    const realtimeData = {
      device_id,
      channel_number: parseInt(channel_number),
      current: parseFloat(current) || 0,
      power: parseFloat(power) || 0,
      energy_wh: channelEnergy,
      cost: proportionalCost,
      timestamp: new Date().toISOString()
    }

    await supabaseClient.channel(`device_${device_id}`)
      .send({
        type: 'broadcast',
        event: 'energy_update',
        payload: realtimeData
      })

    console.log('Energy data processed successfully:', realtimeData)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Energy data received and stored successfully',
        data_stored: true,
        calculated_cost: proportionalCost,
        handshake_confirmed: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
