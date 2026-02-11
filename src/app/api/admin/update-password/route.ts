import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json()

    // 🛡️ Service Role Key'i env dosyasından çekiyoruz
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 🔑 Admin yetkisiyle şifreyi güncelle
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) throw error
    
    return NextResponse.json({ message: 'Şifre başarıyla güncellendi' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}