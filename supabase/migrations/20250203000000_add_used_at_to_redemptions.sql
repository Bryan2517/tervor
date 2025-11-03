-- Add used_at column to redemptions table
ALTER TABLE public.redemptions
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN public.redemptions.used_at IS 'Timestamp when the redemption was marked as used';

