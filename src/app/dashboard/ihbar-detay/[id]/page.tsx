'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // --- ⚙️ TEKNİK NESNE ---
  const [nesneListesi, setNesneListesi] = useState<any[]>([])
  const [nesneSearch, setNesneSearch] = useState('')
  const [secilenNesne, setSecilenNesne] = useState<any>(null)

  // --- 📦 MALZEME YÖNETİMİ ---
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  const [malzemeSearch, setMalzemeSearch] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [miktar, setMiktar] = useState(1)

  // --- 👤 KULLANICI VE YETKİ ---
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [userMemberGroups, setUserMemberGroups] = useState<string[]>([])

  // --- ✏️ FORM VERİLERİ ---
  const [editKonu, setEditKonu] = useState('')
  const [editAciklama, setEditAciklama] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [seciliGrup, setSeciliGrup] = useState('')
  const [personelNotu, setPersonelNotu] = useState('')

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isCagriMerkezi = normalizedRole.includes('ÇAĞRI') || normalizedRole.includes('CAGRI') || normalizedRole.includes('MERKEZ');
  const isAdmin = normalizedRole.includes('ADMIN');
  const isMudur = normalizedRole.includes('MÜDÜR') || normalizedRole.includes('MUDUR');
  
  const canEditIhbar = isCagriMerkezi || isAdmin || isMudur; 
  const canEditAssignment = canEditIhbar || normalizedRole.includes('MÜH') || normalizedRole.includes('FORMEN');
  const canStartJob = !isCagriMerkezi && (ihbar?.atanan_personel === userId || userMemberGroups.includes(ihbar?.atanan_grup_id) || isAdmin || isMudur);

  // --- 🔍 ARAMA FİLTRELEME (PERFORMANS VE HATA DÜZELTMESİ) ---
  const filtrelenmişMalzemeler = useMemo(() => {
    if (!malzemeSearch) return [];
    return malzemeKatalog.filter(m => 
      m.malzeme_adi?.toLowerCase().includes(malzemeSearch.toLowerCase())
    ).slice(0, 10);
  }, [malzemeSearch, malzemeKatalog]);

  const filtrelenmişNesneler = useMemo(() => {
    if (!nesneSearch) return [];
    return nesneListesi.filter(n => 
      n.nesne_adi?.toLowerCase().includes(nesneSearch.toLowerCase()) || 
      n.ifs_kod?.toLowerCase().includes(nesneSearch.toLowerCase())
    ).slice(0, 10);
  }, [nesneSearch, nesneListesi]);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || '')
      const { data: memberGroups } = await supabase.from('grup_uyeleri').select('grup_id').eq('profil_id', user.id);
      setUserMemberGroups(memberGroups?.map(g => g.grup_id) || []);
    }

    const [ihbarRes, pRes, gRes, mRes, kmRes, nRes] = await Promise.all([
      supabase.from('ihbarlar').select(`*`).eq('id', id).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('calisma_gruplari').select('*').order('grup_adi'),
      supabase.from('malzemeler').select('*').order('malzeme_adi'),
      supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id),
      supabase.from('teknik_nesneler').select('*').order('nesne_adi')
    ])

    if (ihbarRes.data) {
      setIhbar(ihbarRes.data);
      setEditKonu(ihbarRes.data.konu || '');
      setEditAciklama(ihbarRes.data.aciklama || '');
      setIfsNo(ihbarRes.data.ifs_is_emri_no || '');
      setSeciliAtanan(ihbarRes.data.atanan_personel || '');
      setSeciliGrup(ihbarRes.data.atanan_grup_id || '');
      setPersonelNotu(ihbarRes.data.personel_notu || '');
      if (ihbarRes.data.secilen_nesne_adi && nRes.data) {
        const bul = nRes.data.find(n => n.nesne_adi === ihbarRes.data.secilen_nesne_adi);
        setSecilenNesne(bul || { nesne_adi: ihbarRes.data.secilen_nesne_adi, ifs_kod: 'KODSUZ' });
      }
    }
    setPersoneller(pRes.data?.filter(p => !p.role.toUpperCase().includes('ÇAĞRI')) || [])
    setGruplar(gRes.data || [])
    setMalzemeKatalog(mRes.data || [])
    setKullanilanlar(kmRes.data || [])
    setNesneListesi(nRes.data || [])
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert("Malzeme ve miktar seçin.");
    setLoading(true);
    const { error } = await supabase.from('ihbar_malzemeleri').insert({
      ihbar_id: id,
      malzeme_id: String(secilenMalzeme.id),
      malzeme_adi: secilenMalzeme.malzeme_adi,
      miktar: miktar,
      kullanim_adedi: miktar,
      birim: secilenMalzeme.birim || 'Adet'
    });
    if (error) alert(error.message);
    else { setSecilenMalzeme(null); setMiktar(1); setMalzemeSearch(''); fetchData(); }
    setLoading(false);
  };

  const malzemeSil = async (mId: string) => {
    await supabase.from('ihbar_malzemeleri').delete().eq('id', mId);
    fetchData();
  };

  const isiBaslat = async () => {
    setLoading(true);
    await supabase.from('ihbarlar').update({ durum: 'Calisiliyor', kabul_tarihi: new Date().toISOString(), atanan_personel: userId }).eq('id', id);
    fetchData(); setLoading(false);
  }

  const isiKapatVeyaDurdur = async (stat: 'Tamamlandi' | 'Durduruldu') => {
    if (!personelNotu) return alert("İşlem notu zorunludur.");
    setLoading(true);
    await supabase.from('ihbarlar').update({ 
      durum: stat, 
      personel_notu: personelNotu, 
      kapatma_tarihi: stat === 'Tamamlandi' ? new Date().toISOString() : null 
    }).eq('id', id);
    if (stat === 'Tamamlandi') router.push('/dashboard'); else fetchData();
    setLoading(false);
  }

  const bilgileriMuhurle = async () => {
    setLoading(true);
    await supabase.from('ihbarlar').update({ 
      konu: editKonu.toUpperCase(), 
      aciklama: editAciklama, 
      atanan_personel: seciliAtanan || null, 
      atanan_grup_id: seciliAtanan ? null : (seciliGrup || null), 
      ifs_is_emri_no: ifsNo, 
      secilen_nesne_adi: secilenNesne?.nesne_adi || null 
    }).eq('id', id);
    alert("KAYDEDİLDİ"); fetchData(); setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-white bg-[#0a0b0e] min-h-screen font-black uppercase italic text-center animate-pulse">VERİLER MÜHÜRLENİYOR...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans bg-[#0a0b0e] font-black uppercase italic">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 w-full relative z-10">
        
        <div className="flex justify-between items-center bg-[#111318] p-5 rounded-2xl border border-gray-800 shadow-2xl">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-6 py-2.5 rounded-xl text-[10px]">← GERİ</button>
          <div className="text-[10px] text-orange-500 tracking-widest">{ihbar.ifs_is_emri_no || 'IFS NO YOK'}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1a1c23] p-8 rounded-[3rem] border border-gray-800 shadow-2xl">
              <h1 className="text-4xl mb-4 tracking-tighter">{ihbar.musteri_adi}</h1>
              
              <div className="mb-6 font-black">
                {canEditIhbar ? (
                  <input className="w-full bg-black/50 border border-orange-500/30 p-4 rounded-2xl text-lg text-blue-400 outline-none" value={editKonu} onChange={e => setEditKonu(e.target.value)} />
                ) : ( <p className="text-lg text-blue-400">{ihbar.konu}</p> )}
              </div>

              <div className="bg-black/30 p-6 rounded-3xl mb-8 border border-gray-800/50 italic">
                {canEditIhbar ? (
                  <textarea className="w-full bg-transparent border-none text-gray-300 text-sm outline-none resize-none" rows={3} value={editAciklama} onChange={e => setEditAciklama(e.target.value)} />
                ) : ( <p className="text-gray-300 text-sm">"{ihbar.aciklama}"</p> )}
              </div>

              {/* ⚙️ TEKNİK NESNE / VARLIK */}
              <div className="bg-[#111318] p-6 rounded-3xl border border-blue-500/20 mb-8 font-black uppercase italic">
                <p className="text-blue-400 text-[10px] mb-4 tracking-widest uppercase">⚙️ TEKNİK NESNE & VARLIK</p>
                {secilenNesne ? (
                  <div className="flex justify-between items-center bg-blue-600/10 p-4 rounded-2xl border border-blue-500/40 font-black italic">
                    <span className="text-xs">{secilenNesne.nesne_adi} <span className="text-blue-400 ml-2">[{secilenNesne.ifs_kod}]</span></span>
                    {canEditAssignment && <button onClick={() => setSecilenNesne(null)} className="text-[8px] text-red-500 bg-red-900/10 px-3 py-1 rounded-lg">DEĞİŞTİR</button>}
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" placeholder="NESNE VEYA KOD ARA..." className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] font-black" value={nesneSearch} onChange={e => setNesneSearch(e.target.value)} />
                    {filtrelenmişNesneler.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-2xl max-h-40 overflow-y-auto z-50">
                        {filtrelenmişNesneler.map(n => (
                          <div key={n.id} onMouseDown={() => { setSecilenNesne(n); setNesneSearch(''); }} className="p-4 hover:bg-blue-600/20 cursor-pointer text-[10px] border-b border-gray-800 font-black">{n.nesne_adi} [{n.ifs_kod}]</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 📦 MALZEME YÖNETİMİ (ARAMA DÜZELTİLDİ) */}
              {ihbar.durum === 'Calisiliyor' && (
                <div className="pt-8 border-t border-gray-800 space-y-6">
                  <p className="text-orange-500 text-[10px] tracking-widest font-black uppercase italic">📦 MALZEME KULLANIMI</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input type="text" placeholder="MALZEME ARA (Örn: Kablo)..." className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] font-black" value={malzemeSearch} onChange={e=>setMalzemeSearch(e.target.value)} />
                      {filtrelenmişMalzemeler.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-2xl max-h-40 overflow-y-auto z-[100] shadow-2xl">
                          {filtrelenmişMalzemeler.map(m => (
                            <div key={m.id} onMouseDown={()=>{setSecilenMalzeme(m); setMalzemeSearch('');}} className="p-4 hover:bg-orange-600/20 border-b border-gray-800 cursor-pointer text-[10px] font-black uppercase italic">{m.malzeme_adi}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input type="number" className="w-16 p-4 bg-black/40 border border-gray-700 rounded-2xl text-center font-black" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                      <button onClick={malzemeEkle} className="flex-1 bg-blue-600 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">EKLE</button>
                    </div>
                  </div>
                  {secilenMalzeme && <p className="text-[9px] text-blue-400 ml-4 animate-pulse font-black italic uppercase">SEÇİLDİ: {secilenMalzeme.malzeme_adi}</p>}
                  
                  <div className="bg-black/20 p-4 rounded-2xl border border-gray-800 font-black">
                    {kullanilanlar.map((k, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] py-2 border-b border-gray-800/40 italic uppercase font-black">
                        <span>{k.malzeme_adi}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-orange-500 font-bold">{k.miktar || k.kullanim_adedi} {k.birim}</span>
                          <button onClick={() => malzemeSil(k.id)} className="text-red-500 text-[8px] uppercase underline font-black">SİL</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#111318] p-8 rounded-[2.5rem] border border-orange-500/20 shadow-2xl">
              {ihbar.durum === 'Calisiliyor' ? (
                <div className="space-y-6">
                  <p className="text-[10px] text-gray-500 font-black italic uppercase tracking-widest text-center">İŞLEM RAPORU</p>
                  <textarea className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[11px] outline-none font-black italic uppercase" rows={4} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value.toUpperCase())} />
                  <button onClick={() => isiKapatVeyaDurdur('Tamamlandi')} className="w-full bg-green-600 py-6 rounded-3xl text-xl shadow-xl font-black italic uppercase active:scale-95 transition-all">🏁 İŞİ BİTİR</button>
                  <button onClick={() => isiKapatVeyaDurdur('Durduruldu')} className="w-full bg-red-900/40 text-red-500 py-3 rounded-2xl text-[10px] font-black italic uppercase border border-red-900/50">⚠️ İŞİ DURDUR</button>
                </div>
              ) : (
                <button onClick={isiBaslat} disabled={!canStartJob || loading} className={`w-full py-12 rounded-[3rem] text-3xl transition-all shadow-2xl font-black italic uppercase ${canStartJob ? 'bg-orange-600 animate-pulse active:scale-95' : 'bg-gray-800 opacity-50'}`}>
                  {canStartJob ? '🚀 İŞE BAŞLA' : 'YETKİ YOK'}
                </button>
              )}
            </div>

            {canEditAssignment && (
              <div className="bg-[#111318] p-8 rounded-[2.5rem] border-t-8 border-orange-600 space-y-4 shadow-2xl font-black italic uppercase">
                <p className="text-[10px] tracking-widest uppercase font-black">KOORDİNASYON / ATAMA</p>
                <input className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-orange-500 font-black" value={ifsNo} placeholder="IFS NO" onChange={e=>setIfsNo(e.target.value.toUpperCase())} />
                <select value={seciliGrup} onChange={e => { setSeciliGrup(e.target.value); setSeciliAtanan(''); }} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-orange-500 outline-none font-black uppercase italic">
                  <option value="">-- ATÖLYE SEÇ --</option>
                  {gruplar.map(g => <option key={g.id} value={g.id} className="bg-black">{g.grup_adi}</option>)}
                </select>
                <select value={seciliAtanan} onChange={e => { setSeciliAtanan(e.target.value); setSeciliGrup(''); }} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-white outline-none font-black uppercase italic">
                  <option value="">-- ŞAHIS SEÇ --</option>
                  {personeller.map(p => <option key={p.id} value={p.id} className="bg-black">{p.full_name}</option>)}
                </select>
                <button onClick={bilgileriMuhurle} className="w-full bg-white text-black py-4 rounded-3xl text-[10px] hover:bg-orange-600 hover:text-white transition-all font-black uppercase shadow-lg active:scale-95 italic">KAYDET</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}