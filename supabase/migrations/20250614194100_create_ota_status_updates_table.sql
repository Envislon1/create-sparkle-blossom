
-- Create OTA status updates table for tracking firmware update progress
CREATE TABLE IF NOT EXISTS ota_status_updates (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  firmware_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries by device_id and timestamp
CREATE INDEX IF NOT EXISTS idx_ota_status_device_timestamp ON ota_status_updates(device_id, timestamp DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE ota_status_updates ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read their own device's OTA status
CREATE POLICY "Users can view OTA status for their devices" ON ota_status_updates
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM device_assignments 
      WHERE user_id = auth.uid()
    )
  );

-- Create policy to allow the service role to insert OTA status updates
CREATE POLICY "Service role can insert OTA status" ON ota_status_updates
  FOR INSERT WITH CHECK (true);
