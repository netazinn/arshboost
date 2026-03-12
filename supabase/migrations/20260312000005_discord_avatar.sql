-- Add discord_avatar_url column to booster_verifications
ALTER TABLE booster_verifications
  ADD COLUMN IF NOT EXISTS discord_avatar_url text;
