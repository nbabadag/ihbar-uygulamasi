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

  // --- YETKİ KONTROLLERİ ---
  const normalizedRole = userRole?.trim();
  const isFormen = normalizedRole === 'Formen';
  const isManager = normalizedRole === 'Müdür';
  const isEngineer = normalizedRole === 'Mühendis-Yönetici';

  // Grup oluşturma yetkisi: Sadece Müdür ve Mühendis
  const canCreateGroup = isManager || isEngineer;
  // Üye ekleme/çıkarma yetkisi: Formen, Mühendis ve Müdür
  const canManageMembers = isFormen || isEngineer || isManager;
  // Sayfayı görme yetkisi: Formen, Mühendis, Müdür
  const canAccessPage = isFormen || isEngineer || isManager;

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // 1. Kullanıcı Rolünü Kontrol Et
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'Saha Personeli'
      setUserRole(role)
      
      // Sayfaya erişim yetkisi yoksa geri gönder
      if (!['Formen', 'Mühendis-Yönetici', 'Müdür'].includes(role)) {
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
    if (!canCreateGroup) return alert("Yeni grup oluşturma yetkisi sadece Müdür ve Mühendis rollerine aittir.")
    if (!yeniGrupAdi) return
    await supabase.from('calisma_gruplari').insert([{ grup_adi: yeniGrupAdi }])
    setYeniGrupAdi(''); fetchData()
  }

  const uyeEkle = async (profilId: string) => {
    if (!canManageMembers) return alert("Grup üyesi yönetme yetkiniz yok.")
    if (!seciliGrup) return
    const { error } = await supabase.from('grup_uyeleri').insert([{ grup_id: seciliGrup.id, profil_id: profilId }])
    if (error) alert("Bu personel zaten grupta.")
    else fetchGrupUyeleri(seciliGrup.id)
  }

  const uyeSil = async (profilId: string) => {
    if (!canManageMembers) return alert("Grup üyesi yönetme yetkiniz yok.")
    if (!window.confirm("Personel gruptan çıkarılacak. Onaylıyor musunuz?")) return
    await supabase.from('grup_uyeleri').delete().eq('grup_id', seciliGrup.id).eq('profil_id', profilId)
    fetchGrupUyeleri(seciliGrup.id)
  }

  if (loading) return <div className="p-10 text-center font-black uppercase italic">Sistem Yetkileri Kontrol Ediliyor...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase italic text-blue-900 tracking-tighter leading-none">Çalışma Grupları & Ekip Yönetimi</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Grup ve Personel Atama Paneli</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-blue-900 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase shadow-lg active:scale-95 transition-all">← Panele Dön</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. KOLON: GRUP LİSTESİ VE EKLEME */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <h2 className="font-black mb-4 text-sm uppercase text-gray-400 italic">Yeni Grup Kur</h2>
              {canCreateGroup ? (
                <form onSubmit={grupEkle} className="flex gap-2">
                  <input type="text" value={yeniGrupAdi} onChange={e => setYeniGrupAdi(e.target.value)} placeholder="Grup Adı..." className="flex-1 p-3 bg-gray-50 border rounded-xl font-bold text-sm outline-none focus:border-blue-500 text-black" />
                  <button className="bg-blue-600 text-white px-4 rounded-xl font-black uppercase text-[10px]">EKLE</button>
                </form>
              ) : (
                <p className="text-[10px] font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 uppercase italic">⚠️ Grup oluşturma yetkiniz bulunmamaktadır.</p>
              )}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b font-black text-[10px] uppercase text-gray-400">Mevcut Gruplar</div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {gruplar.map(g => (
                  <div key={g.id} onClick={() => grupSec(g)} className={`p-4 cursor-pointer transition-all flex justify-between items-center ${seciliGrup?.id === g.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
                    <span className="font-bold text-sm text-gray-800 uppercase italic">{g.grup_adi}</span>
                    <span className="text-[10px] font-black text-blue-600">→</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. KOLON: GRUP DETAYI (ÜYELER) */}
          <div className="lg:col-span-2">
            {seciliGrup ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* GRUPTAKİLER */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-blue-100 overflow-hidden">
                  <div className="p-6 bg-blue-900 text-white">
                    <h2 className="text-xl font-black uppercase italic">{seciliGrup.grup_adi}</h2>
                    <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Kayıtlı Ekip Üyeleri</p>
                  </div>
                  <div className="p-4 space-y-3 min-h-[300px]">
                    {grupUyeleri.length === 0 && <p className="text-center text-gray-400 font-bold py-10">Bu grupta henüz kimse yok.</p>}
                    {grupUyeleri.map(u => (
                      <div key={u.profil_id} className="flex justify-between items-center bg-blue-50 p-3 rounded-2xl border border-blue-100">
                        <div>
                          <p className="font-black text-xs text-blue-900 uppercase">{u.profiles.full_name}</p>
                          <p className="text-[9px] font-bold text-blue-400 uppercase italic">{u.profiles.role}</p>
                        </div>
                        {canManageMembers && (
                          <button onClick={() => uyeSil(u.profil_id)} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase bg-white px-3 py-1 rounded-lg border border-red-100 active:scale-95 transition-all">Çıkar</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* PERSONEL HAVUZU */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b bg-gray-50">
                    <h2 className="font-black uppercase text-sm text-gray-800 italic">Personel Ekle</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Gruba dahil etmek için seçin</p>
                  </div>
                  <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                    {personeller.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 transition-all">
                        <div>
                          <p className="font-bold text-xs text-gray-700 uppercase">{p.full_name}</p>
                          <p className="text-[9px] font-medium text-gray-400 uppercase italic">{p.role}</p>
                        </div>
                        {canManageMembers && (
                          <button onClick={() => uyeEkle(p.id)} className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-600 hover:text-white transition-all active:scale-95">EKLE +</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-100 border-4 border-dashed rounded-[2rem] text-gray-400 font-black uppercase italic p-10 text-center">
                Lütfen yönetmek istediğiniz çalışma grubunu sol taraftan seçin
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}