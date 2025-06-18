
-- First, let's ensure RLS is properly enabled on all tables
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.total_bill_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_capacity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_reset_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_reset_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ota_status_updates ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies and recreate with more explicit conditions
DROP POLICY IF EXISTS "Users can view their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can create their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can update their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can delete their own device assignments" ON public.device_assignments;

-- Recreate device_assignments policies with explicit conditions
CREATE POLICY "Users can view their own device assignments" 
  ON public.device_assignments 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can create their own device assignments" 
  ON public.device_assignments 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update their own device assignments" 
  ON public.device_assignments 
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own device assignments" 
  ON public.device_assignments 
  FOR DELETE 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Drop and recreate device_channels policies
DROP POLICY IF EXISTS "Users can view their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can create their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can update their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can delete their own device channels" ON public.device_channels;

CREATE POLICY "Users can view their own device channels" 
  ON public.device_channels 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can create their own device channels" 
  ON public.device_channels 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update their own device channels" 
  ON public.device_channels 
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own device channels" 
  ON public.device_channels 
  FOR DELETE 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Also ensure that deletion cascades properly but only for owned devices
DROP POLICY IF EXISTS "Users can delete bill settings for their devices" ON public.total_bill_settings;
DROP POLICY IF EXISTS "Users can delete surge capacity settings for their devices" ON public.surge_capacity_settings;

CREATE POLICY "Users can delete bill settings for their devices" 
  ON public.total_bill_settings 
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = total_bill_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete surge capacity settings for their devices" 
  ON public.surge_capacity_settings 
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = surge_capacity_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );
