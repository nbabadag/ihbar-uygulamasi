'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])
  const [nesneListesi, setNesneListesi] = useState<any[]>([])
  const [nesneSearch, setNesneSearch] = useState('')
  const [secilenNesne, setSecilenNesne] = useState<any>(null)

  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  
  // Düzenlenebilir Alanlar (Çağrı Merkezi Yetkisi Dahil)
  const [editKonu, setEditKonu] = useState('')
  const [editAciklama, setEditAciklama] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [seciliGrup, setSeciliGrup] = useState('')
  const [personelNotu, setPersonelNotu] = useState('')
  
  const [loading, setLoading] = useState(false)

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isCagriMerkezi = normalizedRole.includes('ÇAĞRI') || normalizedRole.includes('CAGRI') || normalizedRole.includes('MERKEZ');
  const isAdmin = normalizedRole.includes('ADMIN');
  const isMudur = normalizedRole.includes('MÜDÜR') || normalizedRole.includes('MUDUR');
  
  const canEditIhbar = isCagriMerkezi || isAdmin || isMudur; 
  const canEditAssignment = canEditIhbar || normalizedRole.includes('MÜH') || normalizedRole.includes('FORMEN');

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      setUserRole(profile?.role || '')
      setUserName(profile?.full_name || '')
    }

    const [ihbarRes, pRes, gRes, nRes] = await Promise.all([
      supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name)`).eq('id', id).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('calisma_gruplari').select('*').order('grup_adi'),
      supabase.from('teknik_nesneler').select('*').order('nesne_adi')
    ])

    if (ihbarRes.data) {
      setIhbar(ihbarRes.data)
      setEditKonu(ihbarRes.data.konu || '')
      setEditAciklama(ihbarRes.data.aciklama || '')
      setIfsNo(ihbarRes.data.ifs_is_emri_no || '')
      setSeciliAtanan(ihbarRes.data.atanan_personel || '')
      setSeciliGrup(ihbarRes.data.atanan_grup_id || '')
      setPersonelNotu(ihbarRes.data.personel_notu || '')
      
      if (ihbarRes.data.secilen_nesne_adi && nRes.data) {
        const bul = nRes.data.find(n => n.nesne_adi === ihbarRes.data.secilen_nesne_adi);
        setSecilenNesne(bul || { nesne_adi: ihbarRes.data.secilen_nesne_adi, ifs_kod: 'KODSUZ' });
      }
    }
    setPersoneller(pRes.data?.filter(p => !p.role.toUpperCase().includes('ÇAĞRI')) || [])
    setGruplar(gRes.data || [])
    setNesneListesi(nRes.data || [])
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // --- 💾 MÜHÜRLEME VE KAYDETME ---
  const bilgileriMuhurle = async () => {
    setLoading(true);
    
    // İş ya Gruba ya Personele atanır. İkisi birden seçilirse Personel önceliklidir veya mantıksal ayrım yapılır.
    const finalPersonel = seciliAtanan || null;
    const finalGrup = seciliAtanan ? null : (seciliGrup || null); // Personel seçildiyse grubu sıfırla

    const { error } = await supabase.from('ihbarlar')
      .update({ 
        konu: editKonu.toUpperCase(),
        aciklama: editAciklama,
        atanan_personel: finalPersonel, 
        atanan_grup_id: finalGrup,
        ifs_is_emri_no: ifsNo,
        secilen_nesne_adi: secilenNesne?.nesne_adi || null
      }).eq('id', id);
    
    if(!error) {
      alert("İŞLEM BAŞARILI: İHBAR GÜNCELLENDİ VE ATAMA YAPILDI.");
      fetchData();
    } else {
      alert("Hata: " + error.message);
    }
    setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-center font-black text-white bg-[#0a0b0e] min-h-screen uppercase animate-pulse">VERİLER MÜHÜRLENİYOR...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
        <img src="/logo.png" className="w-1/2 grayscale invert" alt="Background" />
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 relative z-10 w-full font-black uppercase italic">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center bg-[#111318]/90 p-5 rounded-2xl border border-gray-800 shadow-2xl">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">← DASHBOARD</button>
          <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{ihbar.ifs_is_emri_no || 'IFS BEKLENİYOR'}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SOL PANEL: İHBAR DÜZENLEME */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-8 rounded-[3rem] shadow-2xl border border-gray-800/50">
              <div className="mb-8 border-b border-gray-800 pb-6">
                <p className="text-[9px] font-black text-orange-500 uppercase mb-2 tracking-widest">GEMİ / MÜŞTERİ</p>
                <h1 className="text-4xl font-black text-white tracking-tighter mb-4">{ihbar.musteri_adi}</h1>
                
                {canEditIhbar ? (
                  <div className="space-y-2">
                    <p className="text-[8px] text-gray-500 ml-2">İHBAR KONUSU (DÜZENLE)</p>
                    <input 
                      className="w-full bg-black/50 border border-orange-500/30 p-4 rounded-2xl text-lg text-blue-400 font-black outline-none focus:border-orange-500 transition-all"
                      value={editKonu}
                      onChange={(e) => setEditKonu(e.target.value)}
                    />
                  </div>
                ) : (
                  <p className="text-lg text-blue-400 font-black">{ihbar.konu}</p>
                )}
              </div>

              <div className="bg-black/30 p-8 rounded-3xl border border-gray-800 mb-8 shadow-inner">
                <p className="text-[8px] font-black text-gray-500 mb-2 tracking-widest">📝 İHBAR AÇIKLAMASI (DÜZENLE)</p>
                {canEditIhbar ? (
                  <textarea 
                    className="w-full bg-transparent border-none text-gray-300 text-sm outline-none resize-none font-black italic"
                    rows={4}
                    value={editAciklama}
                    onChange={(e) => setEditAciklama(e.target.value)}
                  />
                ) : (
                  <p className="text-gray-300 text-sm">"{ihbar.aciklama}"</p>
                )}
              </div>

              {/* TEKNİK NESNE / IFS KODU */}
              <div className="bg-[#111318] p-6 rounded-3xl border border-blue-500/20">
                <h3 className="text-blue-400 text-[10px] font-black mb-4 tracking-widest italic">⚙️ TEKNİK NESNE & IFS BİLGİSİ</h3>
                {secilenNesne ? (
                  <div className="flex items-center justify-between bg-blue-600/10 border border-blue-500/40 p-4 rounded-2xl">
                    <div className="text-white text-xs font-black">{secilenNesne.nesne_adi} <span className="text-blue-400 ml-2">[{secilenNesne.ifs_kod}]</span></div>
                    {canEditAssignment && (
                      <button onClick={() => setSecilenNesne(null)} className="text-[8px] font-black text-red-500 bg-red-900/10 px-3 py-2 rounded-xl border border-red-900/20">DEĞİŞTİR</button>
                    )}
                  </div>
                ) : (
                  <div className="relative font-black">
                    <input type="text" placeholder="VARLIK VEYA IFS KODU ARA..." className="w-full p-4 bg-black/50 border border-gray-800 rounded-2xl text-[10px] text-white outline-none focus:border-blue-500" value={nesneSearch} onChange={(e) => setNesneSearch(e.target.value.toUpperCase())} />
                    {nesneSearch && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-2xl max-h-48 overflow-y-auto z-[999] shadow-2xl custom-scrollbar">
                        {nesneListesi.filter(n => n.nesne_adi.includes(nesneSearch) || n.ifs_kod?.includes(nesneSearch)).map(n => (
                          <div key={n.id} onClick={() => { setSecilenNesne(n); setNesneSearch(''); }} className="p-4 hover:bg-blue-600/20 border-b border-gray-800/50 cursor-pointer flex justify-between">
                            <span className="text-[10px] font-black">{n.nesne_adi}</span>
                            <span className="text-blue-500 text-[9px] font-black">{n.ifs_kod}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SAĞ PANEL: ATAMA VE KOORDİNASYON */}
          <div className="space-y-6">
            {canEditAssignment && (
              <div className="bg-[#111318]/95 p-8 rounded-[2.5rem] border-t-8 border-orange-600 shadow-2xl font-black">
                <h3 className="text-[11px] font-black text-white mb-8 tracking-tighter uppercase italic">KOORDİNASYON VE ATAMA</h3>
                
                <div className="space-y-6">
                  <div>
                    <p className="text-[8px] font-black text-gray-600 ml-4 mb-1">IFS İŞ EMRİ NO</p>
                    <input className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-orange-500 outline-none focus:border-orange-500" value={ifsNo} onChange={e=>setIfsNo(e.target.value.toUpperCase())} />
                  </div>

                  {/* GRUP VEYA PERSONEL SEÇİM MANTIĞI */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-[8px] font-black text-gray-500 ml-4 mb-1">A) ATÖLYE / GRUP ATA</p>
                      <select 
                        value={seciliGrup} 
                        onChange={e => { setSeciliGrup(e.target.value); setSeciliAtanan(''); }} 
                        className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-[10px] text-orange-500 outline-none cursor-pointer"
                      >
                        <option value="">-- GRUP SEÇİLMEMİŞ --</option>
                        {gruplar.map(g => <option key={g.id} value={g.id} className="bg-[#1a1c23]">{g.grup_adi}</option>)}
                      </select>
                    </div>

                    <div className="text-center text-[8px] text-gray-700">-- VEYA --</div>

                    <div>
                      <p className="text-[8px] font-black text-gray-500 ml-4 mb-1">B) MÜNFERİT PERSONEL ATA</p>
                      <select 
                        value={seciliAtanan} 
                        onChange={e => { setSeciliAtanan(e.target.value); setSeciliGrup(''); }} 
                        className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-[10px] text-white outline-none cursor-pointer"
                      >
                        <option value="">-- ŞAHIS SEÇİLMEMİŞ --</option>
                        {personeller.map(p => <option key={p.id} value={p.id} className="bg-[#1a1c23]">{p.full_name}</option>)}
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={bilgileriMuhurle}
                    disabled={loading}
                    className="w-full bg-white text-black py-5 rounded-3xl font-black text-[10px] hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95"
                  >
                    {loading ? 'SİSTEME İŞLENİYOR...' : 'DEĞİŞİKLİKLERİ VE ATAMAYI KAYDET'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-black/20 p-6 rounded-[2rem] border border-gray-900 text-center font-black uppercase italic">
               <p className="text-[9px] text-gray-600 mb-1">Mevcut Durum</p>
               <p className="text-xl text-orange-500">{ihbar.durum}</p>
            </div>
          </div>

        </div>
      </div>
      <style jsx>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; } `}</style>
    </div>
  )
}