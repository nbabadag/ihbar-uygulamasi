'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('Giriş başarısız: ' + error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans bg-[#050a14]">
      
      {/* --- ARKA PLAN (GÜÇLENDİRİLMİŞ LOGO EFEKTİ) --- */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/logo.png" 
          alt="Saha 360 Arka Plan" 
          fill
          // Mobilde %40, masaüstünde %25 şeffaflık yaparak mobilde belirginliği artırdık
          className="object-contain opacity-40 md:opacity-25 scale-125 md:scale-100 transition-opacity duration-700" 
          priority
        />
        {/* Gradyan katmanını biraz daha şeffaf yaparak logonun öne çıkmasını sağladık */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050a14]/60 via-[#050a14]/80 to-[#050a14]"></div>
      </div>

      <div className="w-full max-w-sm z-10">
        
        {/* --- RESMİ SEFİNE LOGOSU --- */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-full h-16 mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <img 
              src="https://sefine.com.tr/img/logo.svg" 
              alt="Sefine Shipyard Official Logo" 
              className="w-full h-full object-contain brightness-0 invert" 
            />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-blue-400 text-[11px] font-bold tracking-[0.2em] uppercase italic opacity-90 drop-shadow-md">
              Teknik İşler Müdürlüğü
            </h3>
            <div className="w-12 h-[2px] bg-yellow-500 mx-auto my-2 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em] italic">
              Saha Yönetim Sistemi
            </p>
          </div>
        </div>

        {/* --- GİRİŞ FORMU --- */}
        <div className="bg-[#0a1120]/60 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 relative">
          <h1 className="text-xl font-black text-white uppercase tracking-tighter italic mb-8 border-l-4 border-yellow-500 pl-4">
            SİSTEM GİRİŞİ
          </h1>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest italic">Kurumsal E-Posta</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-yellow-500 focus:bg-white/10 transition-all text-white font-bold placeholder:text-gray-600"
                placeholder="isim@sefine.com.tr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest italic">Şifre</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-yellow-500 focus:bg-white/10 transition-all text-white font-bold placeholder:text-gray-600"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-600 to-yellow-400 text-black p-4 rounded-2xl font-black text-xs uppercase shadow-[0_10px_20px_rgba(234,179,8,0.3)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 italic mt-4"
            >
              {loading ? 'DOĞRULANIYOR...' : 'SİSTEME BAĞLAN →'}
            </button>
          </form>

          <div className="mt-8 flex justify-center border-t border-white/5 pt-6">
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic">
              Sefine Saha Yönetim Yazılımı v2.0
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-tighter opacity-40 italic">
            © 2026 SAHA 360 PROJE SİSTEMLERİ
          </p>
        </div>
      </div>
    </div>
  )
}