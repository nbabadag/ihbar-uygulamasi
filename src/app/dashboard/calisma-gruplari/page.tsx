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
  const router = useRouter()

  const fetchData = useCallback(async () => {
    const { data: gData } = await supabase.from('calisma_gruplari').select('*').order('grup_adi')
    const { data: pData } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true)
    if (gData) setGruplar(gData)
    if (pData) setPersoneller(pData)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Grup Üyelerini Getir
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
    if (!yeniGrupAdi) return
    await supabase.from('calisma_gruplari').insert([{ grup_adi: yeniGrupAdi }])
    setYeniGrupAdi(''); fetchData()
  }

  const uyeEkle = async (profilId: string) => {
    if (!seciliGrup) return
    const { error } = await supabase.from('grup_uyeleri').insert([{ grup_id: seciliGrup.id, profil_id: profilId }])
    if (error) alert("Bu personel zaten grupta.")
    else fetchGrupUyeleri(seciliGrup.id)
  }

  const uyeSil = async (profilId: string) => {
    await supabase.from('grup_uyeleri').delete().eq('grup_id', seciliGrup.id).eq('profil_id', profilId)
    fetchGrupUyeleri(seciliGrup.id)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black uppercase italic text-blue-900 tracking-tighter">Çalışma Grupları & Ekip Yönetimi</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-blue-900 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase">← Panele Dön</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. KOLON: GRUP LİSTESİ VE EKLEME */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <h2 className="font-black mb-4 text-sm uppercase text-gray-400">Yeni Grup Kur</h2>
              <form onSubmit={grupEkle} className="flex gap-2">
                <input type="text" value={yeniGrupAdi} onChange={e => setYeniGrupAdi(e.target.value)} placeholder="Grup Adı..." className="flex-1 p-3 bg-gray-50 border rounded-xl font-bold text-sm outline-none focus:border-blue-500" />
                <button className="bg-blue-600 text-white px-4 rounded-xl font-black uppercase text-[10px]">EKLE</button>
              </form>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b font-black text-[10px] uppercase text-gray-400">Mevcut Gruplar</div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {gruplar.map(g => (
                  <div key={g.id} onClick={() => grupSec(g)} className={`p-4 cursor-pointer transition-all flex justify-between items-center ${seciliGrup?.id === g.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}>
                    <span className="font-bold text-sm text-gray-800 uppercase">{g.grup_adi}</span>
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
                          <p className="text-[9px] font-bold text-blue-400 uppercase">{u.profiles.role}</p>
                        </div>
                        <button onClick={() => uyeSil(u.profil_id)} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase bg-white px-3 py-1 rounded-lg border border-red-100">Çıkar</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PERSONEL HAVUZU */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b bg-gray-50">
                    <h2 className="font-black uppercase text-sm text-gray-800">Personel Ekle</h2>
                    <p className="text-[10px] text-gray-400 font-bold">Gruba dahil etmek için personeli seçin</p>
                  </div>
                  <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                    {personeller.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 transition-all">
                        <div>
                          <p className="font-bold text-xs text-gray-700 uppercase">{p.full_name}</p>
                          <p className="text-[9px] font-medium text-gray-400 uppercase">{p.role}</p>
                        </div>
                        <button onClick={() => uyeEkle(p.id)} className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-600 hover:text-white transition-all">EKLE +</button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-100 border-2 border-dashed rounded-[2rem] text-gray-400 font-black uppercase italic">
                Lütfen yönetmek için sol taraftan bir grup seçin
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}