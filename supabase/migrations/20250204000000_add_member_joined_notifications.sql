-- Migration: Add notifications when users join an organization
-- This migration creates a trigger that automatically creates notifications
-- for owners and admins when a new member joins the organization

-- Function to notify owners and admins when a new member joins
CREATE OR REPLACE FUNCTION notify_member_joined()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
  new_member_name TEXT;
  member_role TEXT;
  organization_name TEXT;
BEGIN
  -- Only notify on INSERT (new member joining)
  IF TG_OP = 'INSERT' THEN
    -- Get new member name
    SELECT full_name INTO new_member_name 
    FROM users 
    WHERE id = NEW.user_id;
    
    -- Use role from the new member record
    member_role := NEW.role;
    
    -- Get organization name
    SELECT name INTO organization_name 
    FROM organizations 
    WHERE id = NEW.organization_id;
    
    -- If no name found, use email or generic
    IF new_member_name IS NULL OR new_member_name = '' THEN
      SELECT email INTO new_member_name 
      FROM users 
      WHERE id = NEW.user_id;
      
      IF new_member_name IS NULL THEN
        new_member_name := 'Unknown User';
      END IF;
    END IF;
    
    -- If no organization name, use generic
    IF organization_name IS NULL THEN
      organization_name := 'the organization';
    END IF;
    
    -- Create notifications for all owners and admins
    FOR admin_user_id IN 
      SELECT user_id 
      FROM organization_members 
      WHERE organization_id = NEW.organization_id
        AND role IN ('owner', 'admin')
        AND user_id != NEW.user_id  -- Don't notify the new member
    LOOP
      INSERT INTO notifications (user_id, type, payload)
      VALUES (
        admin_user_id,
        'member_joined'::notification_type,
        jsonb_build_object(
          'new_member_id', NEW.user_id,
          'new_member_name', new_member_name,
          'member_role', member_role,
          'organization_id', NEW.organization_id,
          'organization_name', organization_name,
          'message', 'New ' || member_role || ' - ' || new_member_name || ' has joined ' || organization_name
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS member_joined_trigger ON organization_members;

-- Create trigger for when a new member joins
CREATE TRIGGER member_joined_trigger
  AFTER INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_member_joined();

-- Add member_joined to notification_type enum if not exists
DO $$ 
BEGIN
  -- Check if 'member_joined' type doesn't exist and add it
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'member_joined' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'member_joined';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON FUNCTION notify_member_joined() IS 
  'Creates notifications for all organization owners and admins when a new member joins the organization';

