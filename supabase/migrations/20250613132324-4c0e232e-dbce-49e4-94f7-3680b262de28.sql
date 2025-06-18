
-- Create energy_data table for real-time data (no accumulation)
CREATE TABLE public.energy_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  channel_number INTEGER NOT NULL,
  current NUMERIC,
  power NUMERIC,
  energy_wh NUMERIC,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE public.energy_data ENABLE ROW LEVEL SECURITY;

-- Create policy for reading energy data
CREATE POLICY "Allow reading energy data" ON public.energy_data
  FOR SELECT USING (true);

-- Create policy for inserting energy data  
CREATE POLICY "Allow inserting energy data" ON public.energy_data
  FOR INSERT WITH CHECK (true);

-- Enable realtime for the table
ALTER TABLE public.energy_data REPLICA IDENTITY FULL;

-- Add the table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.energy_data;

-- Create function to automatically delete old records (keep only last 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_energy_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.energy_data 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically cleanup old data every hour
-- This prevents data accumulation while keeping recent real-time data
CREATE OR REPLACE FUNCTION public.trigger_cleanup_energy_data()
RETURNS trigger AS $$
BEGIN
  -- Only run cleanup occasionally (when minute is 0, i.e., top of the hour)
  IF EXTRACT(minute FROM NOW()) = 0 THEN
    PERFORM public.cleanup_old_energy_data();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER energy_data_cleanup_trigger
  AFTER INSERT ON public.energy_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cleanup_energy_data();
