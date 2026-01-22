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
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const normalizedRole = userRole?.trim();
  const isAdmin = normalizedRole === 'Admin';
  const isFormen = normalizedRole === 'Formen';
  const isManager = normalizedRole === 'Müdür';
  const isEngineer = normalizedRole === 'Mühendis-Yönetici';

  const canCreateGroup = isAdmin || isManager || isEngineer;
  const canManageMembers = isAdmin || isFormen || isEngineer || isManager;

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

  const grupSil = async (id: string, ad: string) => {
    if (!isAdmin && !isManager) return alert("Yetki kısıtlı.");
    if (!window.confirm(`${ad} silinecek?`)) return;
    const { error } = await supabase.from('calisma_gruplari').delete().eq('id', id);
    if (!error) { setSeciliGrup(null); fetchData(); }
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
    if (!window.confirm("Çıkarılsın mı?")) return
    await supabase.from('grup_uyeleri').delete().eq('grup_id', seciliGrup.id).eq('profil_id', profilId)
    fetchGrupUyeleri(seciliGrup.id)
  }

  if (loading) return <div className="p-10 text-center font-black uppercase italic text-white bg-[#0a0b0e] min-h-screen">Yetkiler Kontrol Ediliyor...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* 🖼️ KURUMSAL ARKA PLAN (MÜHÜR) */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "url('/logo.png')",
          backgroundSize: '80%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.5) contrast(1.2) grayscale(0.5)'
        }}
      ></div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10 space-y-6">
        
        {/* 🏛️ ÜST BAR */}
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">Ekip Yönetimi</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1 italic">Sefine Shipyard // Çalışma Grupları</p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95 shadow-orange-900/30"
          >
            <span className="text-sm">←</span> GERİ DÖN
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL PANEL: GRUP LİSTESİ VE OLUŞTURMA */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-gray-800 shadow-2xl">
              <h2 className="font-black mb-4 text-orange-500 uppercase text-[9px] italic tracking-widest border-b border-gray-800 pb-2 font-black">Yeni Grup Tanımla</h2>
              {canCreateGroup ? (
                <form onSubmit={grupEkle} className="flex flex-col gap-3 font-black">
                  <input type="text" value={yeniGrupAdi} onChange={e => setYeniGrupAdi(e.target.value)} placeholder="Örn: Elektrik Bakım..." className="p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-xs text-white outline-none focus:border-orange-500 transition-all font-black" />
                  <button className="bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-2xl font-black uppercase text-[10px] shadow-xl italic tracking-widest font-black transition-all">Grup Kur 🚀</button>
                </form>
              ) : (
                <p className="text-[10px] font-black text-red-500 bg-red-900/10 p-3 rounded-xl border border-red-900/30 uppercase italic font-black">⚠️ Yetki Sınırı.</p>
              )}
            </div>

            <div className="bg-[#1a1c23]/90 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 shadow-2xl overflow-hidden font-black">
              <div className="p-4 bg-black/40 border-b border-gray-800 font-black text-[9px] uppercase text-gray-500 italic font-black">Kayıtlı Gruplar</div>
              <div className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto custom-scrollbar font-black">
                {gruplar.map(g => (
                  <div key={g.id} onClick={() => grupSec(g)} className={`p-4 cursor-pointer transition-all flex justify-between items-center group ${seciliGrup?.id === g.id ? 'bg-orange-600/10 border-l-4 border-orange-600' : 'hover:bg-white/5'}`}>
                    <span className="font-black text-xs text-white uppercase italic tracking-tighter">{g.grup_adi}</span>
                    <div className="flex items-center gap-3">
                      {(isAdmin || isManager) && (
                        <button onClick={(e) => { e.stopPropagation(); grupSil(g.id, g.grup_adi); }} className="text-gray-600 hover:text-red-500 transition-colors">🗑️</button>
                      )}
                      <span className="text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SAĞ PANEL: ÜYE YÖNETİMİ */}
          <div className="lg:col-span-2">
            {seciliGrup ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-black">
                
                {/* GRUP ÜYELERİ */}
                <div className="bg-[#1a1c23]/95 backdrop-blur-lg rounded-[2.5rem] shadow-2xl border border-gray-800 overflow-hidden font-black">
                  <div className="p-6 bg-orange-600 shadow-xl shadow-orange-900/20 font-black">
                    <h2 className="text-xl font-black uppercase italic text-white drop-shadow-md">{seciliGrup.grup_adi}</h2>
                    <p className="text-[9px] opacity-80 font-black uppercase tracking-widest text-white italic">Aktif Ekip Kadrosu</p>
                  </div>
                  <div className="p-4 space-y-3 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar font-black">
                    {grupUyeleri.length === 0 && <p className="text-center text-gray-600 font-black uppercase italic py-10 text-[10px]">Grupta henüz üye bulunmuyor.</p>}
                    {grupUyeleri.map(u => (
                      <div key={u.profil_id} className="flex justify-between items-center bg-black/30 p-4 rounded-2xl border border-gray-800 group hover:border-gray-600 transition-all font-black">
                        <div>
                          <p className="font-black text-xs text-white uppercase tracking-tighter italic">{u.profiles.full_name}</p>
                          <p className="text-[9px] font-black text-orange-500 uppercase italic tracking-widest">{u.profiles.role}</p>
                        </div>
                        {canManageMembers && (
                          <button onClick={() => uyeSil(u.profil_id)} className="text-[8px] font-black text-red-500 hover:text-white hover:bg-red-600 uppercase bg-red-900/10 px-3 py-2 rounded-xl border border-red-900/20 transition-all font-black">Çıkar</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* PERSONEL HAVUZU */}
                <div className="bg-[#1a1c23]/80 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 shadow-2xl overflow-hidden font-black">
                  <div className="p-6 border-b border-gray-800 bg-black/40 font-black">
                    <h2 className="font-black uppercase text-xs text-blue-400 italic font-black">Kadro Ekle</h2>
                    <p className="text-[9px] text-gray-500 font-black uppercase italic">Sefine Personel Havuzu</p>
                  </div>
                  <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar font-black">
                    {personeller.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-4 hover:bg-white/5 rounded-2xl border border-transparent hover:border-gray-800 transition-all font-black">
                        <div>
                          <p className="font-black text-xs text-gray-200 uppercase italic tracking-tighter">{p.full_name}</p>
                          <p className="text-[9px] font-black text-blue-500 uppercase italic">{p.role}</p>
                        </div>
                        {canManageMembers && (
                          <button onClick={() => uyeEkle(p.id)} className="text-[9px] font-black text-white bg-blue-600/20 hover:bg-blue-600 border border-blue-600/30 px-4 py-2 rounded-xl transition-all font-black">EKLE +</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-black/30 border-4 border-dashed border-gray-800/50 rounded-[3rem] text-gray-600 p-10 text-center font-black">
                <span className="text-5xl mb-4 opacity-20">👥</span>
                <p className="uppercase italic tracking-widest text-sm opacity-50">Lütfen yönetmek istediğiniz çalışma grubunu sol panelden seçin</p>
              </div>
            )}
          </div>

        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}