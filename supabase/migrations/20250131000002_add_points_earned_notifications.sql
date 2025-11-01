-- Migration: Add notifications for when users earn points
-- This migration creates a trigger that automatically creates notifications
-- when users receive points (positive delta in points_ledger)

-- Function to notify user when they earn points
CREATE OR REPLACE FUNCTION notify_points_earned()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  task_type_val TEXT;
  reason_message TEXT;
  project_name TEXT;
BEGIN
  -- Only notify if points are earned (positive delta) and user_id is set
  IF NEW.delta > 0 AND NEW.user_id IS NOT NULL THEN
    
    -- Get task information if task_id exists
    IF NEW.task_id IS NOT NULL THEN
      SELECT title, task_type INTO task_title, task_type_val
      FROM tasks WHERE id = NEW.task_id;
    END IF;
    
    -- Get project name if project_id exists
    IF NEW.project_id IS NOT NULL THEN
      SELECT name INTO project_name FROM projects WHERE id = NEW.project_id;
    END IF;
    
    -- Create reason message based on reason_code
    reason_message := CASE NEW.reason_code
      WHEN 'task_completion' THEN 
        CASE 
          WHEN task_title IS NOT NULL THEN 'Completed task "' || task_title || '"'
          ELSE 'Completed a task'
        END
      WHEN 'assignment_completion' THEN 
        CASE 
          WHEN task_title IS NOT NULL THEN 'Completed assignment "' || task_title || '"'
          ELSE 'Completed an assignment'
        END
      WHEN 'reward_redemption' THEN 'Redeemed a reward'
      ELSE 'Earned points'
    END;
    
    -- Create notification for the user
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.user_id,
      'points_earned',
      jsonb_build_object(
        'points', NEW.delta,
        'task_id', NEW.task_id,
        'task_title', task_title,
        'task_type', task_type_val,
        'project_id', NEW.project_id,
        'project_name', project_name,
        'reason_code', NEW.reason_code,
        'message', '🎉 You earned ' || NEW.delta || ' points for ' || reason_message || '!'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS points_earned_trigger ON points_ledger;

-- Create trigger for points earned
CREATE TRIGGER points_earned_trigger
  AFTER INSERT ON points_ledger
  FOR EACH ROW
  EXECUTE FUNCTION notify_points_earned();

-- Add points_earned to notification_type enum if not exists
DO $$ 
BEGIN
  -- Check if 'points_earned' type doesn't exist and add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'points_earned' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'points_earned';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON FUNCTION notify_points_earned() IS 
  'Creates notification when a user earns points (positive delta in points_ledger)';

