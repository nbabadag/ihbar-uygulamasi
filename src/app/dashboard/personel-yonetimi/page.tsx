'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function KullaniciDenetimMerkezi() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  
  // --- YENİ: SİSTEM AYARLARI STATE ---
  const [konumModu, setKonumModu] = useState<'muhurleme' | 'canli_takip'>('muhurleme')
  const [ayarYukleniyor, setAyarYukleniyor] = useState(false)

  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('Saha Personeli')

  // --- YETKİ KONTROLLERİ ---
  const isAdmin = currentUserRole === 'Admin'
  const isManager = currentUserRole === 'Müdür'
  const isEngineer = currentUserRole === 'Mühendis-Yönetici'
  
  const canDelete = isAdmin || isManager 
  const canManage = isAdmin || isManager || isEngineer 

  // VERİLERİ ÇEK
  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // 1. Mevcut Kullanıcı Rolünü Al
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setCurrentUserRole(profile?.role || '')
    }

    // 2. Sistem Ayarlarını Çek (Konum Modu)
    const { data: ayarData } = await supabase.from('sistem_ayarlari').select('deger').eq('ayar_adi', 'konum_modu').single()
    if (ayarData) setKonumModu(ayarData.deger as any)

    // 3. Tüm Personeli Çek
    const { data, error } = await supabase
      .from('personel_listesi') 
      .select('*')
      .order('full_name', { ascending: true })
    
    if (!error) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // --- YENİ: KONUM MODU GÜNCELLEME FONKSİYONU ---
  const handleKonumModuGuncelle = async (yeniMod: 'muhurleme' | 'canli_takip') => {
    if (!canManage) return alert("Ayar değiştirme yetkiniz yok.")
    setAyarYukleniyor(true)
    
    const { error } = await supabase
      .from('sistem_ayarlari')
      .update({ deger: yeniMod })
      .eq('ayar_adi', 'konum_modu')

    if (!error) {
      setKonumModu(yeniMod)
      alert(`Sistem başarıyla "${yeniMod === 'muhurleme' ? 'Noktasal Mühürleme' : 'Canlı Takip'}" moduna geçirildi.`)
    } else {
      alert("Hata: " + error.message)
    }
    setAyarYukleniyor(false)
  }

  // YENİ KAYIT
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage) return alert("Yeni personel ekleme yetkiniz yok.")
    
    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: role } }
    })
    
    if (authError) {
      setLoading(false)
      return alert("Hata: " + authError.message)
    }
    
    if (authData.user) {
      await supabase.from('profiles').insert([{ 
        id: authData.user.id, 
        full_name: fullName, 
        role, 
        phone_number: phone, 
        is_active: true 
      }])
      alert("Personel başarıyla eklendi.")
      setEmail(''); setPassword(''); setFullName(''); setPhone(''); 
      fetchData()
    }
    setLoading(false)
  }

  // GÜNCELLEME
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage) return alert("Güncelleme yetkiniz yok.")
    
    setLoading(true)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        full_name: editingUser.full_name, 
        phone_number: editingUser.phone_number, 
        role: editingUser.role 
      })
      .eq('id', editingUser.id)

    if (profileError) {
      setLoading(false)
      return alert(profileError.message)
    }

    alert("Personel bilgileri güncellendi.")
    setEditingUser(null)
    fetchData()
    setLoading(false)
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    if (!canManage) return alert("Durum değiştirme yetkiniz yok.")
    await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', id)
    fetchData()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete) return alert("Bu işlem için Admin veya Müdür yetkisi gereklidir.")
    if (confirm(`${name} personeli sistemden tamamen silinecek? Bu işlem geri alınamaz.`)) {
      await supabase.from('profiles').delete().eq('id', id)
      fetchData()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black text-blue-900 uppercase italic tracking-tighter leading-none">Kullanıcı Denetim Merkezi</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Sistem Yetkilendirme ve Personel Yönetimi</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="group flex items-center gap-2 bg-white border-2 border-blue-900 text-blue-900 px-5 py-2 rounded-2xl font-black text-xs hover:bg-blue-900 hover:text-white transition-all shadow-sm">
            <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> GERİ DÖN
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          <div className="lg:col-span-1 space-y-6">
            {/* KAYIT FORMU */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100">
              <h2 className="font-black mb-4 text-blue-800 uppercase text-[10px] italic tracking-widest">Yeni Personel Tanımla</h2>
              {canManage ? (
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <input type="text" placeholder="Ad Soyad" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-3 bg-gray-50 border-2 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 text-black" required />
                  <input type="email" placeholder="E-Posta" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-gray-50 border-2 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 text-black" required />
                  <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border-2 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 text-black" required />
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black italic text-[11px] uppercase text-black">
                    <option value="Saha Personeli">Saha Personeli</option>
                    <option value="Formen">Formen</option>
                    <option value="Çağrı Merkezi">Çağrı Merkezi</option>
                    <option value="Mühendis-Yönetici">Mühendis-Yönetici</option>
                    <option value="Müdür">Müdür</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <button disabled={loading} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-blue-700 active:scale-95 transition-all italic">
                    {loading ? 'İŞLEM YAPILIYOR...' : 'SİSTEME KAYDET'}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase italic border border-red-100">
                  ⚠️ Yetki kısıtlı.
                </div>
              )}
            </div>

            {/* --- YENİ: SİSTEM AYARLARI PANELİ --- */}
            <div className="bg-blue-900 p-6 rounded-[2.5rem] shadow-2xl text-white">
              <h2 className="font-black mb-4 text-blue-300 uppercase text-[10px] italic tracking-widest border-b border-blue-800 pb-2">🛰️ Saha Operasyon Modu</h2>
              <div className="space-y-3">
                <button 
                  onClick={() => handleKonumModuGuncelle('muhurleme')}
                  disabled={ayarYukleniyor}
                  className={`w-full p-4 rounded-2xl text-[10px] font-black uppercase transition-all ${konumModu === 'muhurleme' ? 'bg-white text-blue-900 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' : 'bg-blue-800 text-blue-300 border border-blue-700 opacity-60'}`}
                >
                  📍 NOKTASAL MÜHÜRLEME
                </button>
                <button 
                  onClick={() => handleKonumModuGuncelle('canli_takip')}
                  disabled={ayarYukleniyor}
                  className={`w-full p-4 rounded-2xl text-[10px] font-black uppercase transition-all ${konumModu === 'canli_takip' ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)] scale-105' : 'bg-blue-800 text-blue-300 border border-blue-700 opacity-60'}`}
                >
                  📡 CANLI TAKİP MODU
                </button>
                <p className="text-[8px] font-bold text-blue-400 italic text-center mt-2 px-2 leading-tight">
                  {konumModu === 'muhurleme' 
                    ? '* Sadece İş Başlangıç ve Bitiş koordinatları kayıt altına alınır.' 
                    : '* İş süresince her 5 dakikada bir personel konumu güncellenir.'}
                </p>
              </div>
            </div>
          </div>

          {/* LİSTE TABLOSU */}
          <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  <th className="p-6">Personel Bilgisi</th>
                  <th className="p-6">İletişim Detay</th>
                  <th className="p-6">Durum</th>
                  <th className="p-6 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className={`${!u.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-blue-50/30'} transition-all group`}>
                    <td className="p-6">
                      <div className="font-black text-sm text-gray-800 uppercase tracking-tighter">{u.full_name}</div>
                      <div className="text-[10px] text-blue-600 font-black uppercase italic">{u.role}</div>
                    </td>
                    <td className="p-6">
                      <div className="text-xs font-black text-blue-900">{u.email}</div>
                      <div className="text-[10px] font-bold text-gray-400 mt-0.5">{u.phone_number || '-'}</div>
                    </td>
                    <td className="p-6">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${u.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {u.is_active ? 'AKTİF' : 'PASİF'}
                      </span>
                    </td>
                    <td className="p-6 text-right space-x-2">
                      <button onClick={() => setEditingUser(u)} className="text-[9px] font-black uppercase text-blue-600 bg-white border-2 border-blue-100 px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Düzenle</button>
                      <button onClick={() => toggleStatus(u.id, u.is_active)} className="text-[9px] font-black uppercase text-orange-600 bg-white border-2 border-orange-100 px-3 py-1.5 rounded-xl hover:bg-orange-500 hover:text-white transition-all">Durum</button>
                      {canDelete && (
                        <button onClick={() => handleDelete(u.id, u.full_name)} className="text-[9px] font-black uppercase text-red-600 bg-white border-2 border-red-100 px-3 py-1.5 rounded-xl hover:bg-red-600 hover:text-white transition-all">Sil</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DÜZENLEME MODALI (AYNI KALDI) */}
      {editingUser && (
        <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-black">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border-4 border-white">
            <h2 className="text-xl font-black mb-6 uppercase italic text-blue-900 border-b-2 border-blue-50 pb-2">Personel Güncelle</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">E-Posta (Sabit)</label>
                <input type="text" value={editingUser.email} disabled className="w-full p-3 bg-gray-100 border-2 rounded-2xl font-bold opacity-50 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Ad Soyad</label>
                <input type="text" value={editingUser.full_name} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} className="w-full p-3 bg-gray-50 border-2 rounded-2xl font-bold outline-none focus:border-blue-500 text-black" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Yetki Seviyesi</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-3 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black uppercase italic text-xs text-black">
                  <option value="Saha Personeli">Saha Personeli</option>
                  <option value="Formen">Formen</option>
                  <option value="Çağrı Merkezi">Çağrı Merkezi</option>
                  <option value="Mühendis-Yönetici">Mühendis-Yönetici</option>
                  <option value="Müdür">Müdür</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 p-4 rounded-2xl font-black uppercase text-[10px]">İptal</button>
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-200">
                  {loading ? 'KAYDEDİLİYOR...' : 'GÜNCELLE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}