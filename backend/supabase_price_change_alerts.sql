-- "Zam / indirim gerçekleşti" bildirim tercihi.
-- Uygulama sırası: docs/OPERATIONS.md#6-supabase-sql-uygulama-sırası
-- Bu dosya tek başına çalıştırılabilir; mevcut push_tokens kayıtları varsayılan olarak açık kalır.

alter table public.push_tokens
  add column if not exists price_change_alerts boolean not null default true;

create or replace function public.register_push_token(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  installation_id_value text := trim(coalesce(payload ->> 'installation_id', ''));
  expo_push_token_value text := trim(coalesce(payload ->> 'expo_push_token', ''));
begin
  if length(installation_id_value) < 8 or length(expo_push_token_value) < 10 then
    raise exception 'Invalid push token registration payload';
  end if;

  -- Ayni Expo push token baska bir kurulumda kayitliysa bu cihazin kaydini calmasin.
  delete from public.push_tokens
  where expo_push_token = expo_push_token_value
    and installation_id <> installation_id_value;

  insert into public.push_tokens (
    app_version,
    city_alerts,
    daily_alerts,
    enabled,
    expo_push_token,
    installation_id,
    last_seen_at,
    platform,
    price_change_alerts,
    quiet_hours,
    tracked_cities,
    tracked_fuels,
    updated_at,
    weekly_summary
  )
  values (
    nullif(payload ->> 'app_version', ''),
    coalesce((payload ->> 'city_alerts')::boolean, true),
    coalesce((payload ->> 'daily_alerts')::boolean, true),
    coalesce((payload ->> 'enabled')::boolean, true),
    expo_push_token_value,
    installation_id_value,
    coalesce((payload ->> 'last_seen_at')::timestamptz, now()),
    nullif(payload ->> 'platform', ''),
    coalesce((payload ->> 'price_change_alerts')::boolean, true),
    coalesce((payload ->> 'quiet_hours')::boolean, true),
    coalesce(payload -> 'tracked_cities', '[]'::jsonb),
    coalesce(payload -> 'tracked_fuels', '["Benzin", "Motorin", "LPG"]'::jsonb),
    coalesce((payload ->> 'updated_at')::timestamptz, now()),
    coalesce((payload ->> 'weekly_summary')::boolean, false)
  )
  on conflict (installation_id) do update set
    app_version = excluded.app_version,
    city_alerts = excluded.city_alerts,
    daily_alerts = excluded.daily_alerts,
    enabled = excluded.enabled,
    expo_push_token = excluded.expo_push_token,
    last_seen_at = excluded.last_seen_at,
    platform = excluded.platform,
    price_change_alerts = excluded.price_change_alerts,
    quiet_hours = excluded.quiet_hours,
    tracked_cities = excluded.tracked_cities,
    tracked_fuels = excluded.tracked_fuels,
    updated_at = excluded.updated_at,
    weekly_summary = excluded.weekly_summary
  where push_tokens.installation_id = installation_id_value;
end;
$$;

revoke all on function public.register_push_token(jsonb) from public;
revoke execute on function public.register_push_token(jsonb) from public;
grant execute on function public.register_push_token(jsonb) to anon;
grant execute on function public.register_push_token(jsonb) to authenticated;
