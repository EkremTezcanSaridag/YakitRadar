import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrlDetails } from './utils/normalizeSupabaseUrl'

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

let supabaseClient = null

if (hasSupabaseConfig) {
  const { url: supabaseUrl, wasNormalized } = normalizeSupabaseUrlDetails(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  )

  if (__DEV__ && wasNormalized) {
    console.warn(
      '[YakitRadar] EXPO_PUBLIC_SUPABASE_URL proje kök adresi olmalı; /rest/v1 gibi yol son ekleri kaldırıldı.',
    )
  }

  if (supabaseUrl) {
    try {
      supabaseClient = createClient(supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
        },
      })
    } catch (error) {
      console.warn('[YakitRadar] Supabase istemcisi oluşturulamadı:', error?.message ?? error)
    }
  } else {
    console.warn('[YakitRadar] EXPO_PUBLIC_SUPABASE_URL geçerli bir adres değil; örnek veriler kullanılacak.')
  }
}

export const supabase = supabaseClient
