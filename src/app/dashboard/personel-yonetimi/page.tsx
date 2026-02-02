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
  const [newPassword, setNewPassword] = useState('') 
  
  const [konumModu, setKonumModu] = useState<'muhurleme' | 'canli_takip'>('muhurleme')
  const [ayarYukleniyor, setAyarYukleniyor] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('Saha Personeli')

  // --- YETKİ DÜZENLEMESİ BAŞLANGICI ---
  const normalizedRole = currentUserRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole === 'ADMIN';

  // Senin verdiğin listeye göre güncellenen yetkiler:
  const canManage = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canDelete = isAdmin || ['MÜDÜR'].includes(normalizedRole);
  const canChangePassword = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);

  // Diğer sayfalar ve işlemler için genel yetki tanımları
  const canCreateJob = isAdmin || ['CAGRI MERKEZI', 'ÇAĞRI MERKEZİ', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeReports = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeTV = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZI', 'ÇAĞRI MERKEZİ'].includes(normalizedRole);
  const canManageGroups = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canManageMaterials = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'FORMEN'].includes(normalizedRole);
  // --- YETKİ DÜZENLEMESİ SONU ---

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setCurrentUserRole(profile?.role || '')
    }
    const { data: ayarData } = await supabase.from('sistem_ayarlari').select('deger').eq('ayar_adi', 'konum_modu').single()
    if (ayarData) setKonumModu(ayarData.deger as any)
    const { data, error } = await supabase.from('personel_listesi').select('*').order('full_name', { ascending: true })
    if (!error) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage) return alert("Yetkiniz yok.")
    setLoading(true)

    try {
      const { error: profileError } = await supabase.from('profiles').update({ 
        full_name: editingUser.full_name, phone_number: editingUser.phone_number, role: editingUser.role 
      }).eq('id', editingUser.id)

      if (profileError) throw profileError

      if (newPassword && canChangePassword) {
        const response = await fetch('/api/admin/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editingUser.id, newPassword })
        })
        
        const result = await response.json()
        if (result.error) throw new Error(result.error)
      }

      alert("Personel bilgileri ve şifresi başarıyla güncellendi."); 
      setEditingUser(null); 
      setNewPassword('');
      fetchData(); 
    } catch (err: any) {
      alert("Hata oluştu: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); }
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); if (!canManage) return alert("Yetkiniz yok.");
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName, role: role } }
    });
    if (authError) { setLoading(false); return alert(authError.message); }
    if (authData.user) {
      await supabase.from('profiles').insert([{ id: authData.user.id, full_name: fullName, role, phone_number: phone, is_active: true }]);
      alert("Personel eklendi."); setEmail(''); setPassword(''); setFullName(''); setPhone(''); fetchData();
    }
    setLoading(false);
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    if (!canManage) return alert("Yetkiniz yok.");
    await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', id);
    fetchData();
  }

  const handleDelete = async (id: string, name: string) => {
    if (!canDelete) return alert("Yetkiniz yok.");
    if (confirm(`${name} silinecek?`)) { await supabase.from('profiles').delete().eq('id', id); fetchData(); }
  }

  const handleKonumModuGuncelle = async (yeniMod: 'muhurleme' | 'canli_takip') => {
    if (!canManage) return alert("Ayar değiştirme yetkiniz yok.")
    setAyarYukleniyor(true)
    const { error } = await supabase.from('sistem_ayarlari').update({ deger: yeniMod }).eq('ayar_adi', 'konum_modu')
    if (!error) { setKonumModu(yeniMod); alert(`Sistem "${yeniMod === 'muhurleme' ? 'Mühürleme' : 'Canlı Takip'}" moduna geçti.`); }
    setAyarYukleniyor(false)
  }

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{backgroundImage: "url('/logo.png')", backgroundSize: '80%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: 'brightness(0.5) contrast(1.2) grayscale(0.5)'}}></div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10 space-y-6">
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">Denetim Merkezi</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1 italic">Saha 360 // Personel Kontrol</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95 shadow-orange-900/30 font-black"><span className="text-sm">←</span> GERİ DÖN</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-gray-800/50 shadow-2xl font-black">
              <h2 className="font-black mb-4 text-orange-500 uppercase text-[9px] italic tracking-widest border-b border-gray-800 pb-2 font-black">Personel Tanımla</h2>
              <form onSubmit={handleCreateUser} className="space-y-3 font-black">
                <input type="text" placeholder="AD SOYAD" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-3.5 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 transition-all font-black" required />
                <input type="email" placeholder="E-POSTA" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3.5 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 transition-all font-black" required />
                <input type="password" placeholder="ŞİFRE" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3.5 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 transition-all font-black" required />
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3.5 bg-black/40 border border-gray-700 rounded-2xl font-black italic text-[10px] uppercase text-orange-400 outline-none font-black">
                  <option value="Saha Personeli">Saha Personeli</option>
                  <option value="Formen">Formen</option>
                  <option value="Çağrı Merkezi">Çağrı Merkezi</option>
                  <option value="Mühendis-Yönetici">Mühendis-Yönetici</option>
                  <option value="Müdür">Müdür</option>
                  <option value="Admin">Admin</option>
                </select>
                <button disabled={loading || !canManage} className="w-full bg-orange-600 text-white p-4 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-orange-700 transition-all italic tracking-widest disabled:opacity-30 font-black">{loading ? 'İŞLEM YAPILIYOR...' : 'SİSTEME KAYDET'}</button>
              </form>
            </div>

            <div className="bg-[#111318]/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-blue-500/20 shadow-2xl font-black">
              <h2 className="font-black mb-4 text-blue-400 uppercase text-[9px] italic tracking-widest border-b border-gray-800 pb-2 font-black">Ekip Yönetimi</h2>
              <button onClick={() => router.push('/dashboard/calisma-gruplari')} className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase italic transition-all flex items-center justify-between shadow-lg font-black"><span>👥 GRUP DÜZENLE</span><span>→</span></button>
            </div>

            <div className="bg-black/40 p-6 rounded-[2.5rem] border border-gray-800 shadow-2xl font-black">
              <h2 className="font-black mb-4 text-gray-500 uppercase text-[9px] italic tracking-widest border-b border-gray-800 pb-2 font-black">🛰️ Takip Modu</h2>
              <div className="space-y-3 font-black">
                <button onClick={() => handleKonumModuGuncelle('muhurleme')} className={`w-full p-3.5 rounded-xl text-[9px] font-black uppercase transition-all font-black ${konumModu === 'muhurleme' ? 'bg-white text-black' : 'bg-gray-800 text-gray-500 opacity-40 font-black'}`}>📍 MÜHÜRLEME</button>
                <button onClick={() => handleKonumModuGuncelle('canli_takip')} className={`w-full p-3.5 rounded-xl text-[9px] font-black uppercase transition-all font-black ${konumModu === 'canli_takip' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-500 opacity-40 font-black'}`}>📡 CANLI TAKİP</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 bg-[#1a1c23]/80 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 overflow-hidden shadow-2xl font-black">
            <div className="overflow-x-auto custom-scrollbar font-black">
              <table className="w-full text-left font-black">
                <thead>
                  <tr className="bg-black/40 text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] italic border-b border-gray-800">
                    <th className="p-6">PERSONEL / YETKİ</th>
                    <th className="p-6">İLETİŞİM</th>
                    <th className="p-6">SİSTEM DURUMU</th>
                    <th className="p-6 text-right">EYLEMLER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 font-black">
                  {users.map((u) => (
                    <tr key={u.id} className={`${!u.is_active ? 'opacity-30 grayscale' : 'hover:bg-white/5'} transition-all`}>
                      <td className="p-6"><div className="font-black text-sm text-white uppercase italic tracking-tighter">{u.full_name}</div><div className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{u.role}</div></td>
                      <td className="p-6"><div className="text-xs font-bold text-gray-300 font-black">{u.email}</div><div className="text-[9px] font-black text-blue-400 mt-1 uppercase">{u.phone_number || 'TEL GİRİLMEMİŞ'}</div></td>
                      <td className="p-6"><span className={`text-[8px] font-black px-3 py-1 rounded-lg border ${u.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 font-black'}`}>{u.is_active ? 'SİSTEMDE' : 'KAPALI'}</span></td>
                      <td className="p-6 text-right space-x-2 font-black">
                        <button onClick={() => setEditingUser(u)} className="text-[9px] font-black uppercase text-white bg-gray-800 px-3 py-2 rounded-xl hover:bg-orange-600 transition-all border border-gray-700">⚙️</button>
                        <button onClick={() => toggleStatus(u.id, u.is_active)} className="text-[9px] font-black uppercase text-white bg-gray-800 px-3 py-2 rounded-xl hover:bg-blue-600 transition-all border border-gray-700 font-black">Güç</button>
                        {canDelete && <button onClick={() => handleDelete(u.id, u.full_name)} className="text-[9px] font-black uppercase text-white bg-red-900/20 px-3 py-2 rounded-xl hover:bg-red-600 transition-all border border-red-900/30 font-black">Sil</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] font-black">
          <div className="bg-[#1a1c23] rounded-[3rem] p-10 max-w-md w-full border border-gray-800 shadow-2xl relative overflow-hidden font-black">
            <div className="absolute top-0 left-0 w-full h-2 bg-orange-600 font-black"></div>
            <h2 className="text-2xl font-black mb-8 uppercase italic text-white flex items-center gap-3"> <span className="text-orange-500 font-black">⚙️</span> Profil Düzenle </h2>
            <form onSubmit={handleUpdateUser} className="space-y-5 font-black">
              <div className="space-y-1 font-black">
                <label className="text-[9px] font-black uppercase text-gray-500 ml-4 italic">Personel İsmi</label>
                <input type="text" value={editingUser.full_name} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 font-black" />
              </div>
              <div className="space-y-1 font-black">
                <label className="text-[9px] font-black uppercase text-gray-500 ml-4 italic">Yetki Seviyesi</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs uppercase text-orange-500 outline-none font-black">
                  <option value="Saha Personeli">Saha Personeli</option>
                  <option value="Formen">Formen</option>
                  <option value="Çağrı Merkezi">Çağrı Merkezi</option>
                  <option value="Mühendis-Yönetici">Mühendis-Yönetici</option>
                  <option value="Müdür">Müdür</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              
              {canChangePassword && (
                <div className="space-y-1 pt-4 border-t border-gray-800 font-black">
                  <label className="text-[9px] font-black uppercase text-orange-500 ml-4 italic">🔒 Yeni Şifre Tanımla</label>
                  <input 
                    type="password" 
                    placeholder="ŞİFREYİ BURADAN DEĞİŞTİRİN" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="w-full p-4 bg-orange-600/5 border border-orange-500/20 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 font-black" 
                  />
                  <p className="text-[7px] text-gray-500 ml-4 mt-1 italic font-black">* Boş bırakırsanız mevcut şifre korunur.</p>
                </div>
              )}

              <div className="flex gap-3 pt-8 font-black">
                <button type="button" onClick={() => { setEditingUser(null); setNewPassword(''); }} className="flex-1 bg-gray-800 p-4 rounded-2xl font-black uppercase text-[10px] italic text-gray-400 font-black">İptal</button>
                <button type="submit" disabled={loading} className="flex-1 bg-orange-600 text-white p-4 rounded-2xl font-black uppercase text-[10px] italic shadow-xl shadow-orange-900/30 font-black">GÜNCELLE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{` .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; } `}</style>
    </div>
  )
}
