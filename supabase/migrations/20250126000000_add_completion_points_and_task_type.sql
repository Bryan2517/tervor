-- Add completion_points and task_type columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completion_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task' CHECK (task_type IN ('task', 'assignment'));

-- Create index for task_type for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);

-- Add comment to columns
COMMENT ON COLUMN tasks.completion_points IS 'Points awarded when task/assignment is completed';
COMMENT ON COLUMN tasks.task_type IS 'Type of task: task (for employees) or assignment (for supervisors)';


