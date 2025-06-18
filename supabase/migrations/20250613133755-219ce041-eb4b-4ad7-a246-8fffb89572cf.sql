
-- Create surge capacity settings table
CREATE TABLE public.surge_capacity_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  channel_number INTEGER NOT NULL,
  max_amperage NUMERIC NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id, channel_number)
);

-- Enable RLS for security
ALTER TABLE public.surge_capacity_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for reading surge capacity settings
CREATE POLICY "Allow reading surge capacity settings" ON public.surge_capacity_settings
  FOR SELECT USING (true);

-- Create policy for inserting surge capacity settings  
CREATE POLICY "Allow inserting surge capacity settings" ON public.surge_capacity_settings
  FOR INSERT WITH CHECK (true);

-- Create policy for updating surge capacity settings
CREATE POLICY "Allow updating surge capacity settings" ON public.surge_capacity_settings
  FOR UPDATE USING (true);

-- Modify energy_data table to be real-time only (remove accumulation trigger)
DROP TRIGGER IF EXISTS energy_data_cleanup_trigger ON public.energy_data;
DROP FUNCTION IF EXISTS public.trigger_cleanup_energy_data();

-- Create a more aggressive cleanup function that keeps only the latest record per device/channel
CREATE OR REPLACE FUNCTION public.cleanup_energy_data_realtime()
RETURNS void AS $$
BEGIN
  -- Keep only the most recent record for each device/channel combination
  DELETE FROM public.energy_data 
  WHERE id NOT IN (
    SELECT DISTINCT ON (device_id, channel_number) id
    FROM public.energy_data
    ORDER BY device_id, channel_number, timestamp DESC
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain only latest records
CREATE OR REPLACE FUNCTION public.trigger_maintain_latest_energy_data()
RETURNS trigger AS $$
BEGIN
  -- Clean up old records for this specific device/channel after insert
  DELETE FROM public.energy_data 
  WHERE device_id = NEW.device_id 
    AND channel_number = NEW.channel_number 
    AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER energy_data_maintain_latest_trigger
  AFTER INSERT ON public.energy_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_maintain_latest_energy_data();
