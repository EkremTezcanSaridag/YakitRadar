import { createClient } from '@supabase/supabase-js'

const env = typeof process !== 'undefined' ? process.env ?? {} : {}
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_KEY)

if (__DEV__ && !hasSupabaseConfig) {
  console.error(
    '🔴 Supabase yapılandırması eksik!\n\n' +
    'EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ortam değişkenlerini ayarlamanız gerekiyor.\n\n' +
    'Geliştirme için:\n' +
    '1. .env.example dosyasını .env olarak kopyalayın\n' +
    '2. .env dosyasına gerçek Supabase değerlerinizi girin\n' +
    '3. Uygulamayı yeniden başlatın\n\n' +
    'EAS Build için:\n' +
    'eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"\n' +
    'eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"'
  )
}

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
      },
    })
  : null
