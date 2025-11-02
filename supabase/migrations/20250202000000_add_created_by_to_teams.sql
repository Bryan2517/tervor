-- Add created_by column to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update comment
COMMENT ON COLUMN public.teams.created_by IS 'User who created the team';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);

