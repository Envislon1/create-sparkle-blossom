
-- Create the ota_status_updates table with the correct structure
CREATE TABLE IF NOT EXISTS public.ota_status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  message TEXT,
  timestamp TIMESTAMPTZ,
  firmware_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.ota_status_updates ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows service role to insert without restrictions
CREATE POLICY "Allow service role full access to OTA status" ON public.ota_status_updates
  FOR ALL USING (auth.role() = 'service_role');

-- Create policy for authenticated users to view OTA status for their devices
CREATE POLICY "Users can view OTA status for their devices" ON public.ota_status_updates
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    device_id IN (
      SELECT device_id FROM device_assignments 
      WHERE user_id = auth.uid()
    )
  );

-- Also allow public access for devices to insert (in case service role doesn't work)
CREATE POLICY "Allow public insert for devices" ON public.ota_status_updates
  FOR INSERT WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ota_status_device_timestamp ON public.ota_status_updates(device_id, created_at DESC);

-- Enable real-time for this table
ALTER TABLE public.ota_status_updates REPLICA IDENTITY FULL;
