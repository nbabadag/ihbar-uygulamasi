import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// createClient yerine createBrowserClient kullanıyoruz
// Bu sayede çerezler (cookies) otomatik olarak yönetilir ve Middleware ile paylaşılır
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)