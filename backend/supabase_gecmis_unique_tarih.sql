-- Apply ONLY AFTER duplicate-date cleanup on public.gecmis (P5).
-- Do not run this file until duplicate tarih rows are resolved.

drop index if exists public.gecmis_tarih_desc_idx;

create unique index if not exists gecmis_tarih_uidx on public.gecmis (tarih);
