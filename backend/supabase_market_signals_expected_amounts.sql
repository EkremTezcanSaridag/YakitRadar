-- Opsiyonel: beklenen zam/indirim tutarlarini (TL/L) yakıt bazinda sorgulamak icin.
-- Canliya otomatik uygulanmaz; manuel migration.
-- Tutarlar zaten market_signals.signals JSON icinde expected_amount_tl olarak da tutulur.

alter table public.market_signals
  add column if not exists benzin_expected_amount_tl numeric(8, 4),
  add column if not exists motorin_expected_amount_tl numeric(8, 4),
  add column if not exists lpg_expected_amount_tl numeric(8, 4);

comment on column public.market_signals.benzin_expected_amount_tl is
  'Groq/haberden cikarilan beklenen Benzin degisimi TL/L; yoksa null';
comment on column public.market_signals.motorin_expected_amount_tl is
  'Groq/haberden cikarilan beklenen Motorin degisimi TL/L; yoksa null';
comment on column public.market_signals.lpg_expected_amount_tl is
  'Groq/haberden cikarilan beklenen LPG degisimi TL/L; yoksa null';
