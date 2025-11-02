-- Add current_phase column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS current_phase text;

-- Add comment for documentation
COMMENT ON COLUMN projects.current_phase IS 'Current phase of the project (e.g., Planning Phase, Development Phase, Deployment Phase, or custom phase)';

