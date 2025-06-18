
-- First, let's check and fix the RLS policies for device_assignments table
-- Users should only see devices they explicitly own or were granted access to

-- Drop existing policies if they exist (in case they're incorrectly configured)
DROP POLICY IF EXISTS "Users can view their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can create their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can update their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can delete their own device assignments" ON public.device_assignments;

-- Recreate proper RLS policies for device_assignments
CREATE POLICY "Users can view their own device assignments" 
  ON public.device_assignments 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own device assignments" 
  ON public.device_assignments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device assignments" 
  ON public.device_assignments 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device assignments" 
  ON public.device_assignments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Fix RLS policies for device_channels table
DROP POLICY IF EXISTS "Users can view their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can create their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can update their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can delete their own device channels" ON public.device_channels;

CREATE POLICY "Users can view their own device channels" 
  ON public.device_channels 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own device channels" 
  ON public.device_channels 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device channels" 
  ON public.device_channels 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device channels" 
  ON public.device_channels 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Fix RLS policies for energy_data table
DROP POLICY IF EXISTS "Users can view energy readings for their devices" ON public.energy_data;
DROP POLICY IF EXISTS "Service role can insert energy readings" ON public.energy_data;

CREATE POLICY "Users can view energy readings for their devices" 
  ON public.energy_data 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_data.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert energy readings" 
  ON public.energy_data 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- Fix RLS policies for total_bill_settings table
DROP POLICY IF EXISTS "Users can view bill settings for their devices" ON public.total_bill_settings;
DROP POLICY IF EXISTS "Users can create bill settings for their devices" ON public.total_bill_settings;
DROP POLICY IF EXISTS "Users can update bill settings for their devices" ON public.total_bill_settings;

CREATE POLICY "Users can view bill settings for their devices" 
  ON public.total_bill_settings 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = total_bill_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bill settings for their devices" 
  ON public.total_bill_settings 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = total_bill_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bill settings for their devices" 
  ON public.total_bill_settings 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = total_bill_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

-- Fix RLS policies for surge_capacity_settings table
DROP POLICY IF EXISTS "Users can view surge capacity settings for their devices" ON public.surge_capacity_settings;
DROP POLICY IF EXISTS "Users can create surge capacity settings for their devices" ON public.surge_capacity_settings;
DROP POLICY IF EXISTS "Users can update surge capacity settings for their devices" ON public.surge_capacity_settings;

CREATE POLICY "Users can view surge capacity settings for their devices" 
  ON public.surge_capacity_settings 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = surge_capacity_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create surge capacity settings for their devices" 
  ON public.surge_capacity_settings 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = surge_capacity_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update surge capacity settings for their devices" 
  ON public.surge_capacity_settings 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = surge_capacity_settings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

-- Ensure RLS is enabled on all tables
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.total_bill_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_capacity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
