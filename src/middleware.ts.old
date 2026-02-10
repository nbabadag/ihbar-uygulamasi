import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Başlangıç yanıtını oluştur
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Supabase istemcisini yapılandır
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // KRİTİK: Çerezleri hem isteğe hem yanıta ekle
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // KRİTİK: Çerezleri hem istekten hem yanıttan temizle
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 3. Oturumu güvenli bir şekilde al (getUser, getSession'dan daha güvenlidir)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 4. Koruma Mantığı
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard')

  if (!user && isDashboardPage) {
    // Oturum yoksa ve dashboard'a gidiliyorsa ana sayfaya at
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (user && request.nextUrl.pathname === '/') {
    // Oturum varsa ve ana sayfadaysa direkt dashboard'a at
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  // Statik dosyaları dışarıda tutarak middleware performansını artır
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}