-- Migration: Add task assignment and due date reminder notifications
-- This migration adds triggers for task assignments and creates a function for due date reminders

-- Function to notify user when assigned to a task
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  assigner_name TEXT;
  task_due_date TEXT;
  task_priority TEXT;
  task_type_val TEXT;
BEGIN
  -- Only notify if assignee_id changed (new assignment or reassignment)
  IF (TG_OP = 'INSERT' AND NEW.assignee_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id AND NEW.assignee_id IS NOT NULL) THEN
    
    -- Get task details
    SELECT title, due_date, priority, task_type 
    INTO task_title, task_due_date, task_priority, task_type_val
    FROM tasks WHERE id = NEW.id;
    
    -- Get assigner name (created_by for new tasks, or last updated user for updates)
    IF NEW.created_by IS NOT NULL THEN
      SELECT full_name INTO assigner_name FROM users WHERE id = NEW.created_by;
    END IF;
    
    -- If no assigner name found, use generic
    IF assigner_name IS NULL THEN
      assigner_name := 'System';
    END IF;
    
    -- Create notification for the assignee
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.assignee_id,
      'task_assigned',
      jsonb_build_object(
        'task_id', NEW.id,
        'task_title', task_title,
        'task_type', COALESCE(task_type_val, 'task'),
        'priority', task_priority,
        'due_date', task_due_date,
        'assigned_by', NEW.created_by,
        'assigner_name', assigner_name,
        'message', 
          CASE 
            WHEN TG_OP = 'INSERT' THEN 
              'You have been assigned to "' || task_title || '"'
            ELSE 
              'You have been reassigned to "' || task_title || '"'
          END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and send due date reminders
-- This function should be called by a scheduled job (cron/pg_cron)
CREATE OR REPLACE FUNCTION send_due_date_reminders()
RETURNS void AS $$
DECLARE
  task_record RECORD;
  user_name TEXT;
BEGIN
  -- Find tasks that are due within 24 hours and haven't been completed
  -- and don't have a recent reminder (within last 12 hours)
  FOR task_record IN
    SELECT 
      t.id,
      t.title,
      t.assignee_id,
      t.due_date,
      t.priority,
      t.task_type,
      t.status
    FROM tasks t
    WHERE t.assignee_id IS NOT NULL
      AND t.status NOT IN ('done', 'submitted')
      AND t.due_date IS NOT NULL
      AND t.due_date > NOW()
      AND t.due_date <= NOW() + INTERVAL '24 hours'
      -- Check if notification doesn't exist in last 12 hours
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = t.assignee_id
          AND n.type = 'task_due_reminder'
          AND (n.payload->>'task_id')::uuid = t.id
          AND n.created_at > NOW() - INTERVAL '12 hours'
      )
  LOOP
    -- Get user name
    SELECT full_name INTO user_name FROM users WHERE id = task_record.assignee_id;
    
    -- Create reminder notification
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      task_record.assignee_id,
      'task_due_reminder',
      jsonb_build_object(
        'task_id', task_record.id,
        'task_title', task_record.title,
        'task_type', COALESCE(task_record.task_type, 'task'),
        'priority', task_record.priority,
        'due_date', task_record.due_date,
        'hours_until_due', EXTRACT(EPOCH FROM (task_record.due_date - NOW())) / 3600,
        'message', 
          CASE
            WHEN task_record.due_date <= NOW() + INTERVAL '6 hours' THEN
              '⚠️ Urgent: "' || task_record.title || '" is due in less than 6 hours!'
            WHEN task_record.due_date <= NOW() + INTERVAL '12 hours' THEN
              'Reminder: "' || task_record.title || '" is due in less than 12 hours'
            ELSE
              'Reminder: "' || task_record.title || '" is due within 24 hours'
          END
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS task_assigned_trigger ON tasks;

-- Create trigger for task assignment
CREATE TRIGGER task_assigned_trigger
  AFTER INSERT OR UPDATE OF assignee_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

-- Add task_due_reminder to notification_type enum if not exists
DO $$ 
BEGIN
  -- Check if 'task_due_reminder' type doesn't exist and add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'task_due_reminder' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'task_due_reminder';
  END IF;
END $$;

-- Create a simple way to manually trigger reminders (for testing)
-- In production, you would set up pg_cron or call this from your application
COMMENT ON FUNCTION send_due_date_reminders() IS 
  'Sends reminder notifications for tasks due within 24 hours. Should be called periodically (e.g., every hour) by a cron job.';

-- Add comment for documentation
COMMENT ON FUNCTION notify_task_assigned() IS 
  'Creates notification when a user is assigned or reassigned to a task';

-- Create an index for faster due date queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_assignee 
ON tasks(due_date, assignee_id) 
WHERE status NOT IN ('done', 'submitted') AND due_date IS NOT NULL;

-- Example of how to set up pg_cron (if available):
-- SELECT cron.schedule('send-due-date-reminders', '0 * * * *', 'SELECT send_due_date_reminders();');

