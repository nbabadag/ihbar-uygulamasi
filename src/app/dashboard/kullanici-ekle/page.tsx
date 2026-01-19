'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function KullaniciEklePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('Saha Personeli') 
  const [loading, setLoading] = useState(false)

  // YETKİ KONTROLÜ: Sadece Mühendis, Yönetici ve Müdür kullanıcı ekleyebilir
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      
      const authorizedRoles = ['Mühendis', 'Yönetici', 'Müdür', 'Admin']
      if (!authorizedRoles.includes(profile?.role || '')) {
         router.push('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Supabase Auth Kaydı
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        }
      }
    })

    if (authError) {
      alert("Hata: " + authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      // 2. Profiles Tablosuna Kayıt
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: authData.user.id, full_name: fullName, role: role }])

      if (profileError) console.error("Profil hatası:", profileError.message)

      alert(`${fullName} (${role}) başarıyla sisteme tanımlandı.`)
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-black">
      {/* MASAÜSTÜ KENAR MENÜ */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 fixed h-full flex-col shadow-2xl">
        <h2 className="text-xl font-bold mb-8 italic uppercase tracking-widest border-b border-blue-800 pb-2 text-blue-300">Saha Yönetimi</h2>
        <button onClick={() => router.push('/dashboard')} className="p-4 bg-blue-800 rounded-2xl font-black text-xs shadow-lg hover:bg-blue-700 transition-all uppercase tracking-tighter">← Ana Panele Dön</button>
      </div>

      <div className="flex-1 p-4 md:p-10 ml-0 md:ml-64 font-bold">
        {/* MOBİL BAŞLIK */}
        <div className="md:hidden flex items-center justify-between mb-6 bg-blue-900 p-4 rounded-2xl text-white shadow-lg">
          <span className="font-black italic uppercase">Kullanıcı Tanımla</span>
          <button onClick={() => router.push('/dashboard')} className="text-[10px] bg-blue-700 px-4 py-2 rounded-xl font-black uppercase">Geri</button>
        </div>

        <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className="p-10 bg-gradient-to-br from-blue-700 to-blue-900 text-white text-center">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">Personel Kayıt</h1>
            <p className="text-blue-200 text-[10px] font-bold uppercase mt-2 tracking-widest">Sistem Yetki ve Hiyerarşi Ataması</p>
          </div>

          <form onSubmit={handleCreateUser} className="p-10 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Personel Ad Soyad</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 text-black font-bold" placeholder="Örn: Nusret Babadağ" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Giriş E-Postası</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 text-black font-bold" placeholder="mail@sirket.com" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Şifre</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 text-black font-bold" placeholder="Min. 6 Karakter" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-600 uppercase ml-2 tracking-widest">Sistem Rolü</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)}
                className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-600 text-blue-900 font-black italic shadow-inner appearance-none"
              >
                <option value="Saha Personeli">👷 Saha Personeli</option>
                <option value="Çağrı Merkezi">📞 Çağrı Merkezi</option>
                <option value="Formen">🛠️ Formen</option>
                <option value="Mühendis">📐 Mühendis</option>
                <option value="Yönetici">🛡️ Yönetici</option>
                <option value="Müdür">💼 Müdür</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black text-sm uppercase shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all mt-4">
              {loading ? 'YETKİLER OLUŞTURULUYOR...' : 'PERSONELİ SİSTEME DAHİL ET'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}