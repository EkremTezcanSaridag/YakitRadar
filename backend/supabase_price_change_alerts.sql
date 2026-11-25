-- "Zam / indirim gerçekleşti" bildirim tercihi.
-- Uygulama sırası: docs/OPERATIONS.md#6-supabase-sql-uygulama-sırası
-- Bu dosya tek başına çalıştırılabilir; mevcut push_tokens kayıtları varsayılan olarak açık kalır.

alter table public.push_tokens
  add column if not exists price_change_alerts boolean not null default true;

create or replace function public.register_push_token(payload jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  installation_id_value text := trim(coalesce(payload ->> 'installation_id', ''));
  expo_push_token_value text := trim(coalesce(payload ->> 'expo_push_token', ''));
  tracked_cities_value jsonb := coalesce(payload -> 'tracked_cities', '[]'::jsonb);
  tracked_fuels_value jsonb := coalesce(payload -> 'tracked_fuels', '["Benzin", "Motorin", "LPG"]'::jsonb);
begin
  if payload is null or pg_column_size(payload) > 4096 then
    raise exception 'Invalid push token registration payload';
  end if;

  if length(installation_id_value) < 8 or length(installation_id_value) > 128 then
    raise exception 'Invalid push token registration payload';
  end if;

  if expo_push_token_value !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,128}\]$' then
    raise exception 'Invalid push token registration payload';
  end if;

  if jsonb_typeof(tracked_cities_value) <> 'array' or jsonb_array_length(tracked_cities_value) > 81 then
    raise exception 'Invalid push token registration payload';
  end if;

  if jsonb_typeof(tracked_fuels_value) <> 'array' or jsonb_array_length(tracked_fuels_value) > 5 then
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
    left(nullif(payload ->> 'app_version', ''), 32),
    coalesce((payload ->> 'city_alerts')::boolean, true),
    coalesce((payload ->> 'daily_alerts')::boolean, true),
    coalesce((payload ->> 'enabled')::boolean, true),
    expo_push_token_value,
    installation_id_value,
    now(),
    left(nullif(payload ->> 'platform', ''), 16),
    coalesce((payload ->> 'price_change_alerts')::boolean, true),
    coalesce((payload ->> 'quiet_hours')::boolean, true),
    tracked_cities_value,
    tracked_fuels_value,
    now(),
    coalesce((payload ->> 'weekly_summary')::boolean, false)
  )
  on conflict (installation_id) do update set
    app_version = excluded.app_version,
    city_alerts = excluded.city_alerts,
    daily_alerts = excluded.daily_alerts,
    enabled = excluded.enabled,
    expo_push_token = excluded.expo_push_token,
    last_seen_at = now(),
    platform = excluded.platform,
    price_change_alerts = excluded.price_change_alerts,
    quiet_hours = excluded.quiet_hours,
    tracked_cities = excluded.tracked_cities,
    tracked_fuels = excluded.tracked_fuels,
    updated_at = now(),
    weekly_summary = excluded.weekly_summary
  where push_tokens.installation_id = installation_id_value;
end;
$$;

revoke all on function public.register_push_token(jsonb) from public;
revoke execute on function public.register_push_token(jsonb) from public;
grant execute on function public.register_push_token(jsonb) to anon;
grant execute on function public.register_push_token(jsonb) to authenticated;
