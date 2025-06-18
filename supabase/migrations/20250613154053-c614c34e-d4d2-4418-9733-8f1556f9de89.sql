
-- Create energy_reset_sessions table
CREATE TABLE public.energy_reset_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'executing', 'completed')),
  required_votes INTEGER NOT NULL DEFAULT 1,
  votes_received INTEGER NOT NULL DEFAULT 0,
  reset_executed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create energy_reset_votes table
CREATE TABLE public.energy_reset_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.energy_reset_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_reset_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for energy_reset_sessions
CREATE POLICY "Users can view reset sessions for their devices" 
  ON public.energy_reset_sessions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_reset_sessions.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

-- Create RLS policies for energy_reset_votes
CREATE POLICY "Users can view votes for their devices" 
  ON public.energy_reset_votes 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_reset_votes.device_id 
      AND device_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can vote for their devices" 
  ON public.energy_reset_votes 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.device_assignments 
      WHERE device_assignments.device_id = energy_reset_votes.device_id 
      AND device_assignments.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can delete their own votes" 
  ON public.energy_reset_votes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_energy_reset_sessions_device_id ON public.energy_reset_sessions(device_id);
CREATE INDEX idx_energy_reset_sessions_status ON public.energy_reset_sessions(status);
CREATE INDEX idx_energy_reset_sessions_expires_at ON public.energy_reset_sessions(expires_at);
CREATE INDEX idx_energy_reset_votes_device_id ON public.energy_reset_votes(device_id);
CREATE INDEX idx_energy_reset_votes_user_id ON public.energy_reset_votes(user_id);
