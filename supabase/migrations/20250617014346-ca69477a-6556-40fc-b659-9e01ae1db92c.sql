
-- Drop existing policies if they exist and recreate them properly
DROP POLICY IF EXISTS "Users can view their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can create their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can update their own device assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Users can delete their own device assignments" ON public.device_assignments;

DROP POLICY IF EXISTS "Users can view their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can create their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can update their own device channels" ON public.device_channels;
DROP POLICY IF EXISTS "Users can delete their own device channels" ON public.device_channels;

DROP POLICY IF EXISTS "Users can view energy readings for their devices" ON public.energy_data;
DROP POLICY IF EXISTS "Service role can insert energy readings" ON public.energy_data;

DROP POLICY IF EXISTS "Users can view bill settings for their devices" ON public.total_bill_settings;
DROP POLICY IF EXISTS "Users can create bill settings for their devices" ON public.total_bill_settings;
DROP POLICY IF EXISTS "Users can update bill settings for their devices" ON public.total_bill_settings;

DROP POLICY IF EXISTS "Users can view surge capacity settings for their devices" ON public.surge_capacity_settings;
DROP POLICY IF EXISTS "Users can create surge capacity settings for their devices" ON public.surge_capacity_settings;
DROP POLICY IF EXISTS "Users can update surge capacity settings for their devices" ON public.surge_capacity_settings;

DROP POLICY IF EXISTS "Users can view energy reset sessions for their devices" ON public.energy_reset_sessions;
DROP POLICY IF EXISTS "Users can create energy reset sessions for their devices" ON public.energy_reset_sessions;

DROP POLICY IF EXISTS "Users can view their own energy reset votes" ON public.energy_reset_votes;
DROP POLICY IF EXISTS "Users can create their own energy reset votes" ON public.energy_reset_votes;

DROP POLICY IF EXISTS "Users can view OTA status for their devices" ON public.ota_status_updates;
DROP POLICY IF EXISTS "Service role can insert OTA status updates" ON public.ota_status_updates;

-- Now recreate all policies properly
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

CREATE POLICY "Users can view energy reset sessions for their devices" 
  ON public.energy_reset_sessions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_reset_sessions.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create energy reset sessions for their devices" 
  ON public.energy_reset_sessions 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_reset_sessions.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own energy reset votes" 
  ON public.energy_reset_votes 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own energy reset votes" 
  ON public.energy_reset_votes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view OTA status for their devices" 
  ON public.ota_status_updates 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = ota_status_updates.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert OTA status updates" 
  ON public.ota_status_updates 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');
