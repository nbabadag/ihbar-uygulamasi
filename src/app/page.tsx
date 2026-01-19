'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen flex items-center justify-center bg-blue-900 p-6">
      <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-sm border-4 border-blue-400">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-600">
            <span className="text-4xl">🛠️</span>
          </div>
          <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tighter italic">İhbar Takip</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Saha Personel Girişi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">E-Posta Adresi</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-black font-bold"
              placeholder="mail@sirket.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Şifre</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-black font-bold"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-sm uppercase shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-400"
          >
            {loading ? 'KONTROL EDİLİYOR...' : 'SİSTEME GİRİŞ YAP'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">© 2026 SAHA TAKİP SİSTEMİ v1.0</p>
        </div>
      </div>
    </div>
  )
}