import { createClient } from '@supabase/supabase-js'

const missingSupabaseEnv =
  !process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const hasSupabaseConfig = !missingSupabaseEnv

if (missingSupabaseEnv) {
  console.warn(
    '[YakitRadar] Supabase yapılandırması eksik (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). ' +
      'Canlı veri yerine yerel örnek veriler kullanılacak. Geliştirme için mobile/.env.example → .env; ' +
      'EAS için preview/production ortam değişkenlerini tanımlayın.',
  )
}

export const supabase = hasSupabaseConfig
  ? createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    })
  : null
