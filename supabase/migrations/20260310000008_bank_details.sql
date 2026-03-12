-- Add bank payout detail columns to profiles

alter table profiles
  add column if not exists bank_holder_name       text,
  add column if not exists bank_name              text,
  add column if not exists bank_swift             text,
  add column if not exists bank_iban              text,
  add column if not exists bank_details_status    text not null default 'none'
    check (bank_details_status in ('none', 'approved', 'under_review')),
  add column if not exists bank_details_updated_at timestamptz;
