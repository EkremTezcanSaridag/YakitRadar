import { createClient } from '@supabase/supabase-js'

const SUPABASE_CONFIG_ERROR =
  'Supabase yapılandırması eksik: EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ortam değişkenlerini ayarlayın.\n\n' +
  'Yerel geliştirme: mobile/.env.example dosyasını .env olarak kopyalayıp değerleri girin, sonra Metro/Expo’yu yeniden başlatın.\n\n' +
  'EAS Build (preview / production): Expo dashboard veya `eas env:create` ile bu değişkenleri ilgili ortamda tanımlayın (eas.json içindeki profile environment alanına bakın).'

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(SUPABASE_CONFIG_ERROR)
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
    },
  },
)
