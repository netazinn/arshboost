-- Grant support role to a specific user by email.
-- This runs as a migration, so it takes effect on next db push / migration apply.
-- The user must already exist in auth.users and have a corresponding public.profiles row.

update public.profiles
set role = 'support'
where email = 'support@arshboost.com';
