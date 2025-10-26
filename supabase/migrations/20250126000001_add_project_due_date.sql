-- Add due_date column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Create index on due_date for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date);


