-- Create enum for user presence status
CREATE TYPE user_presence_status AS ENUM ('online', 'idle', 'offline', 'do_not_disturb');

-- Update user_presence table to use the new enum
ALTER TABLE public.user_presence 
  ALTER COLUMN status TYPE user_presence_status USING status::user_presence_status;

-- Set default value
ALTER TABLE public.user_presence 
  ALTER COLUMN status SET DEFAULT 'offline';

-- Add constraint to ensure valid status values
ALTER TABLE public.user_presence 
  ADD CONSTRAINT check_valid_status 
  CHECK (status IN ('online', 'idle', 'offline', 'do_not_disturb'));
