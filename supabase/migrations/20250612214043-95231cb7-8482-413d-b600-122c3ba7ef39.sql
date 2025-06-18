
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  apartment_number INTEGER,
  theme_preference TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create device_assignments table
CREATE TABLE public.device_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_name TEXT NOT NULL,
  channel_count INTEGER NOT NULL DEFAULT 1,
  custom_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id, user_id)
);

-- Create device_channels table
CREATE TABLE public.device_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  channel_number INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  custom_name TEXT DEFAULT 'Channel',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id, channel_number, user_id)
);

-- Create energy_readings table (for historical data)
CREATE TABLE public.energy_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  channel_number INTEGER NOT NULL,
  current DECIMAL(10,3),
  power DECIMAL(10,3),
  energy_wh DECIMAL(15,3),
  cost DECIMAL(10,2),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create total_bill_settings table
CREATE TABLE public.total_bill_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  total_bill_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.total_bill_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for device_assignments
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

-- Create RLS policies for device_channels
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

-- Create RLS policies for energy_readings
CREATE POLICY "Users can view energy readings for their devices" 
  ON public.energy_readings 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_readings.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert energy readings" 
  ON public.energy_readings 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- Create RLS policies for total_bill_settings
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

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_device_assignments_user_id ON public.device_assignments(user_id);
CREATE INDEX idx_device_assignments_device_id ON public.device_assignments(device_id);
CREATE INDEX idx_device_channels_user_id ON public.device_channels(user_id);
CREATE INDEX idx_device_channels_device_id ON public.device_channels(device_id);
CREATE INDEX idx_energy_readings_device_id ON public.energy_readings(device_id);
CREATE INDEX idx_energy_readings_timestamp ON public.energy_readings(timestamp DESC);
CREATE INDEX idx_total_bill_settings_device_id ON public.total_bill_settings(device_id);
