-- Push token hygiene columns (apply manually in Supabase SQL editor when ready).
alter table public.push_tokens
  add column if not exists disabled_reason text;

alter table public.push_tokens
  add column if not exists last_receipt_status text;

alter table public.push_tokens
  add column if not exists last_receipt_at timestamptz;

create index if not exists push_tokens_enabled_last_seen_idx
  on public.push_tokens (enabled, last_seen_at desc);
