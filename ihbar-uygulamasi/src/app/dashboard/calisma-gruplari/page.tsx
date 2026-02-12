'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function CalismaGruplariPage() {
  const [gruplar, setGruplar] = useState<any[]>([])
  const [personeller, setPersoneller] = useState<any[]>([])
  const [seciliGrup, setSeciliGrup] = useState<any>(null)
  const [grupUyeleri, setGrupUyeleri] = useState<any[]>([])
  const [yeniGrupAdi, setYeniGrupAdi] = useState('')
  const [editGrupId, setEditGrupId] = useState<string | null>(null) // Edit durumu için
  const [editGrupAdi, setEditGrupAdi] = useState('') // Edit inputu için
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const normalizedRole = userRole?.trim();
  const isAdmin = normalizedRole === 'Admin';
  const isManager = normalizedRole === 'Müdür';
  const isEngineer = normalizedRole === 'Mühendis-Yönetici';
  const isFormen = normalizedRole === 'Formen';

  const canCreateGroup = isAdmin || isManager || isEngineer;
  const canManageMembers = isAdmin || isManager || isEngineer || isFormen;
  const canDeleteGroup = isAdmin || isManager; // Silme yetkisi kısıtlı tutuldu

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'Saha Personeli'
      setUserRole(role)
      
      if (!['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(role)) {
        router.push('/dashboard')
        return
      }
    }

    const { data: gData } = await supabase.from('calisma_gruplari').select('*').order('grup_adi')
    const { data: pData } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true)
    
    if (gData) setGruplar(gData)
    if (pData) setPersoneller(pData)
    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchGrupUyeleri = async (grupId: string) => {
    const { data, error } = await supabase
      .from('grup_uyeleri')
      .select('profil_id, profiles(full_name, role)')
      .eq('grup_id', grupId)
    if (!error) setGrupUyeleri(data || [])
  }

  const grupSec = (grup: any) => {
    setSeciliGrup(grup)
    fetchGrupUyeleri(grup.id)
  }

  const grupEkle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreateGroup) return alert("Yetki kısıtlı.")
    if (!yeniGrupAdi) return
    await supabase.from('calisma_gruplari').insert([{ grup_adi: yeniGrupAdi }])
    setYeniGrupAdi(''); fetchData()
  }

  // --- YENİ: GRUP ADI DÜZENLEME FONKSİYONU ---
  const grupGuncelle = async (id: string) => {
    if (!canCreateGroup) return alert("Yetki kısıtlı.");
    if (!editGrupAdi) return;
    
    const { error } = await supabase
      .from('calisma_gruplari')
      .update({ grup_adi: editGrupAdi })
      .eq('id', id);

    if (!error) {
      setEditGrupId(null);
      fetchData();
      if (seciliGrup?.id === id) setSeciliGrup({ ...seciliGrup, grup_adi: editGrupAdi });
    } else {
      alert("Güncelleme başarısız.");
    }
  }

  const grupSil = async (id: string, ad: string) => {
    if (!canDeleteGroup) return alert("Yetki kısıtlı.");
    if (!window.confirm(`${ad} silinecek? Bu işlem geri alınamaz.`)) return;
    const { error } = await supabase.from('calisma_gruplari').delete().eq('id', id);
    if (!error) { setSeciliGrup(null); fetchData(); }
    else alert("Hata: Bu gruba bağlı ihbarlar olabilir, önce onları temizleyin.");
  }

  const uyeEkle = async (profilId: string) => {
    if (!canManageMembers) return alert("Yetki kısıtlı.")
    if (!seciliGrup) return
    const { error } = await supabase.from('grup_uyeleri').insert([{ grup_id: seciliGrup.id, profil_id: profilId }])
    if (error) alert("Bu personel zaten grupta.")
    else fetchGrupUyeleri(seciliGrup.id)
  }

  const uyeSil = async (profilId: string) => {
    if (!canManageMembers) return alert("Yetki kısıtlı.")
    if (!window.confirm("Personel gruptan çıkarılsın mı?")) return
    await supabase.from('grup_uyeleri').delete().eq('grup_id', seciliGrup.id).eq('profil_id', profilId)
    fetchGrupUyeleri(seciliGrup.id)
  }

  if (loading) return <div className="p-10 text-center font-black uppercase italic text-white bg-[#0a0b0e] min-h-screen flex items-center justify-center">⚙️ SİSTEM YÜKLENİYOR...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* 🖼️ KURUMSAL ARKA PLAN */}
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
        <img src="/logo.png" className="w-2/3 grayscale invert" alt="" />
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10 space-y-6">
        
        {/* 🏛️ ÜST BAR */}
        <div className="flex justify-between items-center bg-[#111318]/90 backdrop-blur-md p-6 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Saha 360 // Ekip Yönetimi</h1>
            <p className="text-[9px] font-bold text-orange-500 uppercase tracking-[0.3em] mt-1 italic">Çalışma Grupları Kontrol Merkezi</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95">← GERİ DÖN</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL PANEL: LİSTE VE OLUŞTURMA */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-gray-800 shadow-2xl">
              <h2 className="font-black mb-4 text-orange-500 uppercase text-[9px] italic tracking-widest border-b border-gray-800 pb-2">Yeni Grup Tanımla</h2>
              {canCreateGroup ? (
                <form onSubmit={grupEkle} className="flex flex-col gap-3">
                  <input type="text" value={yeniGrupAdi} onChange={e => setYeniGrupAdi(e.target.value)} placeholder="Örn: Elektrik Atölye..." className="p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 transition-all" />
                  <button className="bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-2xl font-black uppercase text-[10px] shadow-xl italic transition-all">Grup Kur 🚀</button>
                </form>
              ) : (
                <p className="text-[10px] font-black text-red-500 bg-red-900/10 p-3 rounded-xl border border-red-900/30 uppercase italic text-center">⚠️ Yetki Sınırı.</p>
              )}
            </div>

            <div className="bg-[#1a1c23]/90 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 shadow-2xl overflow-hidden">
              <div className="p-4 bg-black/40 border-b border-gray-800 text-[9px] uppercase text-gray-500 italic font-black">Kayıtlı Gruplar</div>
              <div className="divide-y divide-gray-800 max-h-[450px] overflow-y-auto custom-scrollbar">
                {gruplar.map(g => (
                  <div key={g.id} onClick={() => grupSec(g)} className={`p-4 cursor-pointer transition-all flex flex-col gap-2 ${seciliGrup?.id === g.id ? 'bg-orange-600/10 border-l-4 border-orange-600' : 'hover:bg-white/5'}`}>
                    <div className="flex justify-between items-center">
                      {editGrupId === g.id ? (
                        <div className="flex gap-2 w-full" onClick={e => e.stopPropagation()}>
                          <input 
                            autoFocus
                            className="bg-black border border-orange-500 text-[11px] p-1 rounded flex-1 outline-none font-black"
                            value={editGrupAdi}
                            onChange={e => setEditGrupAdi(e.target.value)}
                          />
                          <button onClick={() => grupGuncelle(g.id)} className="bg-green-600 px-2 py-1 rounded text-[10px]">OK</button>
                          <button onClick={() => setEditGrupId(null)} className="bg-gray-700 px-2 py-1 rounded text-[10px]">X</button>
                        </div>
                      ) : (
                        <>
                          <span className="font-black text-xs text-white uppercase italic tracking-tighter">{g.grup_adi}</span>
                          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 md:opacity-100">
                            {canCreateGroup && (
                              <button onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditGrupId(g.id); 
                                setEditGrupAdi(g.grup_adi); 
                              }} className="text-gray-500 hover:text-blue-400 text-sm">✏️</button>
                            )}
                            {canDeleteGroup && (
                              <button onClick={(e) => { e.stopPropagation(); grupSil(g.id, g.grup_adi); }} className="text-gray-500 hover:text-red-500 text-sm">🗑️</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SAĞ PANEL: ÜYELER */}
          <div className="lg:col-span-2">
            {seciliGrup ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#1a1c23]/95 backdrop-blur-lg rounded-[2.5rem] shadow-2xl border border-gray-800 overflow-hidden">
                  <div className="p-6 bg-orange-600 shadow-xl">
                    <h2 className="text-xl font-black uppercase italic text-white">{seciliGrup.grup_adi}</h2>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/70 italic">Kadro Listesi</p>
                  </div>
                  <div className="p-4 space-y-3 min-h-[300px] max-h-[550px] overflow-y-auto custom-scrollbar">
                    {grupUyeleri.length === 0 && <p className="text-center text-gray-600 font-black uppercase italic py-10 text-[10px]">Grupta henüz üye bulunmuyor.</p>}
                    {grupUyeleri.map(u => (
                      <div key={u.profil_id} className="flex justify-between items-center bg-black/30 p-4 rounded-2xl border border-gray-800 hover:border-gray-600 transition-all">
                        <div>
                          <p className="font-black text-xs text-white uppercase italic tracking-tighter">{u.profiles.full_name}</p>
                          <p className="text-[9px] font-black text-orange-500 uppercase italic">{u.profiles.role}</p>
                        </div>
                        {canManageMembers && (
                          <button onClick={() => uyeSil(u.profil_id)} className="text-[8px] font-black text-red-500 hover:text-white hover:bg-red-600 uppercase bg-red-900/10 px-3 py-2 rounded-xl border border-red-900/20 transition-all">Çıkar</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1a1c23]/80 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 shadow-2xl overflow-hidden">
                  <div className="p-6 border-b border-gray-800 bg-black/40">
                    <h2 className="font-black uppercase text-xs text-blue-400 italic tracking-widest">Kadro Ekle</h2>
                    <p className="text-[9px] text-gray-500 font-black uppercase italic">Sefine Personel Havuzu</p>
                  </div>
                  <div className="p-4 space-y-2 max-h-[550px] overflow-y-auto custom-scrollbar">
                    {personeller.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-4 hover:bg-white/5 rounded-2xl border border-transparent hover:border-gray-800 transition-all">
                        <div>
                          <p className="font-black text-xs text-gray-200 uppercase italic tracking-tighter">{p.full_name}</p>
                          <p className="text-[9px] font-black text-blue-500 uppercase italic">{p.role}</p>
                        </div>
                        {canManageMembers && (
                          <button onClick={() => uyeEkle(p.id)} className="text-[9px] font-black text-white bg-blue-600/20 hover:bg-blue-600 border border-blue-600/30 px-4 py-2 rounded-xl transition-all">EKLE +</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-black/30 border-4 border-dashed border-gray-800/50 rounded-[3rem] text-gray-600 p-10 text-center">
                <span className="text-6xl mb-4 opacity-10">👥</span>
                <p className="uppercase italic tracking-widest text-sm opacity-50 font-black">Lütfen sol panelden bir ekip seçin</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  )
}