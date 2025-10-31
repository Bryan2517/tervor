-- Add phone number column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.users.phone IS 'User phone number collected during sign up';

-- Create an index for phone lookups (optional, but useful if you'll search by phone)
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE phone IS NOT NULL;

-- Function to sync phone from auth metadata to users table
CREATE OR REPLACE FUNCTION public.sync_user_phone()
RETURNS TRIGGER AS $$
BEGIN
  -- Update phone in public.users from auth.users raw_user_meta_data
  IF NEW.raw_user_meta_data->>'phone' IS NOT NULL THEN
    UPDATE public.users
    SET phone = NEW.raw_user_meta_data->>'phone'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync phone when user is created or updated in auth.users
DROP TRIGGER IF EXISTS sync_user_phone_trigger ON auth.users;
CREATE TRIGGER sync_user_phone_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'phone' IS NOT NULL)
  EXECUTE FUNCTION public.sync_user_phone();

-- Also update existing users if they have phone in metadata
UPDATE public.users u
SET phone = au.raw_user_meta_data->>'phone'
FROM auth.users au
WHERE u.id = au.id
  AND au.raw_user_meta_data->>'phone' IS NOT NULL
  AND (u.phone IS NULL OR u.phone = '');

