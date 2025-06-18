
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
    console.log('Received OTA status request:', JSON.stringify(requestData, null, 2))

    const { device_id, status, progress, message, timestamp, firmware_version } = requestData

    // Validate required fields
    if (!device_id) {
      console.error('Missing device_id')
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!status) {
      console.error('Missing status')
      return new Response(
        JSON.stringify({ error: 'status is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate status values
    const validStatuses = ['starting', 'downloading', 'installing', 'complete', 'failed', 'no_update', 'heartbeat']
    if (!validStatuses.includes(status)) {
      console.error('Invalid status value:', status)
      return new Response(
        JSON.stringify({ error: 'Invalid status value' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate progress
    const progressValue = progress !== undefined ? Math.max(0, Math.min(100, Number(progress) || 0)) : 0

    console.log(`Processing OTA status - Device: ${device_id}, Status: ${status}, Progress: ${progressValue}%`)

    // Create timestamp - use current time if not provided or invalid
    let timestampISO = new Date().toISOString()
    if (timestamp) {
      try {
        // Handle different timestamp formats
        let timestampMs = timestamp
        if (typeof timestamp === 'number') {
          // If timestamp is in seconds, convert to milliseconds
          if (timestamp < 10000000000) {
            timestampMs = timestamp * 1000
          }
        }
        const date = new Date(timestampMs)
        if (!isNaN(date.getTime())) {
          timestampISO = date.toISOString()
        }
      } catch (error) {
        console.log('Invalid timestamp, using current time:', error)
      }
    }

    // First, try to find existing record for this device
    const { data: existingRecord } = await supabaseClient
      .from('ota_status_updates')
      .select('id')
      .eq('device_id', String(device_id))
      .maybeSingle()

    // Prepare the data for upsert or insert
    const updateData = {
      device_id: String(device_id),
      status: String(status),
      progress: progressValue,
      message: message ? String(message) : null,
      timestamp: timestampISO,
      firmware_version: firmware_version ? String(firmware_version) : null
    }

    console.log('Processing OTA status data:', JSON.stringify(updateData, null, 2))

    let data, error

    if (existingRecord) {
      // Update existing record
      const result = await supabaseClient
        .from('ota_status_updates')
        .update(updateData)
        .eq('device_id', String(device_id))
        .select()
        .single()
      
      data = result.data
      error = result.error
      console.log('Updated existing OTA status record')
    } else {
      // Insert new record
      const result = await supabaseClient
        .from('ota_status_updates')
        .insert(updateData)
        .select()
        .single()
      
      data = result.data
      error = result.error
      console.log('Inserted new OTA status record')
    }

    if (error) {
      console.error('Database operation error:', {
        error: error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to store OTA status',
          details: error.message,
          code: error.code
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('OTA status stored successfully:', data)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTA status recorded successfully',
        data: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error in OTA status function:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
