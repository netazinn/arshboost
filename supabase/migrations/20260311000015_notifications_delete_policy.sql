-- Allow users to delete (clear) their own notifications.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'notifications: delete own'
  ) then
    create policy "notifications: delete own"
      on public.notifications for delete
      using (user_id = auth.uid());
  end if;
end $$;
