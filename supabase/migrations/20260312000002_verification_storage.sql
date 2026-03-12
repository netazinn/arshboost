-- Creates the private verification_documents storage bucket + RLS policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification_documents',
  'verification_documents',
  false,
  10485760,   -- 10 MB per file
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Owner can upload files inside their own sub-folder: {user_id}/filename
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
      and policyname = 'verification_documents: owner upload'
  ) then
    create policy "verification_documents: owner upload"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'verification_documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- Owner can read their own files
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
      and policyname = 'verification_documents: owner read'
  ) then
    create policy "verification_documents: owner read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'verification_documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- Admins can read all files
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
      and policyname = 'verification_documents: admin read'
  ) then
    create policy "verification_documents: admin read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'verification_documents'
        and exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'admin'
        )
      );
  end if;
end $$;
