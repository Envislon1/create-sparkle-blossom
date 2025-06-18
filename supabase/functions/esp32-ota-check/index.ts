
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
    const { device_id, current_firmware_version } = requestData

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Checking for firmware updates for device: ${device_id}, current version: ${current_firmware_version || 'unknown'}`)

    // Check if firmware-updates bucket exists
    const { data: buckets } = await supabaseClient.storage.listBuckets()
    const firmwareBucket = buckets?.find(bucket => bucket.name === 'firmware-updates')
    
    if (!firmwareBucket) {
      console.log('Firmware-updates bucket not found')
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'Firmware storage not configured. Please create the firmware-updates bucket first.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // List firmware files for this device
    const { data: files, error: listError } = await supabaseClient.storage
      .from('firmware-updates')
      .list(`firmware/${device_id}`, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (listError) {
      console.error('Error listing firmware files:', listError)
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'No firmware updates available'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!files || files.length === 0) {
      console.log(`No firmware files found for device ${device_id}`)
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'No firmware updates available'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get the latest firmware file
    const latestFirmware = files[0]
    const firmwarePath = `firmware/${device_id}/${latestFirmware.name}`

    // Extract version from filename (timestamp_filename format or just filename)
    let latestVersion = latestFirmware.name
    if (latestFirmware.name.includes('_')) {
      latestVersion = latestFirmware.name.split('_')[0]
    } else {
      // If no timestamp prefix, use the filename as version
      latestVersion = latestFirmware.name.replace('.bin', '')
    }

    // Check if device already has this version
    if (current_firmware_version && current_firmware_version === latestVersion) {
      console.log(`Device ${device_id} already has the latest firmware version: ${latestVersion}`)
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'Device already has the latest firmware version',
          current_version: current_firmware_version,
          latest_version: latestVersion
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get signed URL for secure access that works with ESP32
    const { data: signedUrlData, error: urlError } = await supabaseClient.storage
      .from('firmware-updates')
      .createSignedUrl(firmwarePath, 3600) // 1 hour expiry

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL:', urlError)
      // Fall back to public URL if signed URL fails
      const { data: publicUrlData } = supabaseClient.storage
        .from('firmware-updates')
        .getPublicUrl(firmwarePath)
      
      console.log(`Firmware update available for ${device_id}: ${latestFirmware.name} (version ${latestVersion})`)
      console.log(`Using public URL: ${publicUrlData.publicUrl}`)

      return new Response(
        JSON.stringify({
          has_update: true,
          firmware_url: publicUrlData.publicUrl,
          filename: latestFirmware.name,
          firmware_version: latestVersion,
          file_size: latestFirmware.metadata?.size || 0,
          uploaded_at: latestFirmware.created_at
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Firmware update available for ${device_id}: ${latestFirmware.name} (version ${latestVersion})`)
    console.log(`Using signed URL: ${signedUrlData.signedUrl}`)

    return new Response(
      JSON.stringify({
        has_update: true,
        firmware_url: signedUrlData.signedUrl,
        filename: latestFirmware.name,
        firmware_version: latestVersion,
        file_size: latestFirmware.metadata?.size || 0,
        uploaded_at: latestFirmware.created_at
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('OTA check error:', error)
    return new Response(
      JSON.stringify({ 
        has_update: false,
        error: 'Internal server error', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
