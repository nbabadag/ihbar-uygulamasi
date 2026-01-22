'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  
  const [atamaTuru, setAtamaTuru] = useState<'personel' | 'grup'>('personel')
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')

  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const normalizedRole = userRole?.trim();
  const canEditAssignment = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin', 'Çağrı Merkezi'].includes(normalizedRole);
  const canPerformSahaActions = ['Saha Personeli', 'Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);

  const getGPSLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve("GPS Desteklenmiyor"); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve("Konum Alınamadı"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const fetchData = useCallback(async () => {
    const { data: ihbarData } = await supabase.from('ihbarlar').select(`*, profiles (full_name), calisma_gruplari (grup_adi)`).eq('id', id).single()
    const { data: pData } = await supabase.from('profiles').select('*').eq('is_active', true)
    const { data: gData } = await supabase.from('calisma_gruplari').select('*')
    const { data: mKatalog } = await supabase.from('malzemeler').select('*')
    const { data: hData } = await supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'Saha Personeli')
    }

    if (ihbarData) {
      setIhbar(ihbarData)
      setIfsNo(ihbarData.ifs_is_emri_no || '')
      setSeciliAtanan(ihbarData.atanan_personel || ihbarData.atanan_grup_id || '')
      setAtamaTuru(ihbarData.atanan_grup_id ? 'grup' : 'personel')
      if (ihbarData.personel_notu) setPersonelNotu(ihbarData.personel_notu)
    }
    setPersoneller(pData || [])
    setGruplar(gData || [])
    setMalzemeKatalog(mKatalog || [])
    setKullanilanlar(hData || [])
  }, [id])

  useEffect(() => { 
    fetchData() 
    return () => { if(intervalRef.current) clearInterval(intervalRef.current) } 
  }, [fetchData])

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    const { error } = await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    if (!error) { setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData(); }
  }

  const isiBaslat = async () => {
    setLoading(true)
    const konum = await getGPSLocation();
    const simdi = new Date().toISOString();
    
    await supabase.from('ihbarlar').update({ 
      durum: 'Calisiliyor', 
      kabul_tarihi: simdi, 
      atanan_personel: userId, 
      baslangic_konum: konum,
      guncel_konum: konum,
      konum_gecmisi: [{ konum: konum, saat: simdi }] 
    }).eq('id', id)

    await supabase.from('is_zamanlari').insert([{
        ihbar_id: id, personel_id: userId, baslangic_tarihi: simdi, durum: 'Devam Ediyor'
    }])

    intervalRef.current = setInterval(async () => {
        const yeniKonum = await getGPSLocation();
        const zaman = new Date().toISOString();
        const { data: curr } = await supabase.from('ihbarlar').select('konum_gecmisi').eq('id', id).single();
        const guncelGecmis = [...(curr?.konum_gecmisi || []), { konum: yeniKonum, saat: zaman }];

        await supabase.from('ihbarlar').update({ 
            guncel_konum: yeniKonum,
            konum_gecmisi: guncelGecmis 
        }).eq('id', id);
    }, 120000);

    fetchData();
    setLoading(false)
  }

  const isiKapatVeyaDurdur = async (yeniDurum: 'Tamamlandi' | 'Durduruldu') => {
    if (!personelNotu) return alert("Lütfen işlem notunu yazın.");
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    setLoading(true);
    const simdi = new Date().toISOString();
    const konum = await getGPSLocation();

    const updates: any = { durum: yeniDurum, personel_notu: personelNotu };
    if (yeniDurum === 'Tamamlandi') {
        updates.kapatma_tarihi = simdi;
        updates.bitis_saati = new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
        updates.bitis_konum = konum;
        const { data: curr } = await supabase.from('ihbarlar').select('konum_gecmisi').eq('id', id).single();
        updates.konum_gecmisi = [...(curr?.konum_gecmisi || []), { konum: konum, saat: simdi }];
    }

    await supabase.from('ihbarlar').update(updates).eq('id', id);
    await supabase.from('is_zamanlari').update({ bitis_tarihi: simdi, durum: yeniDurum, personel_notu: personelNotu }).eq('ihbar_id', id).is('bitis_tarihi', null);

    if (yeniDurum === 'Tamamlandi') {
        router.push('/dashboard');
    } else {
        fetchData();
        setLoading(false);
    }
  }

  if (!ihbar) return <div className="p-10 text-center font-black">Yükleniyor...</div>

  return (
    <div className="p-3 md:p-10 bg-gray-50 min-h-screen text-black font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-100">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-xs uppercase italic">← DASHBOARD</button>
          <div className="text-[10px] font-black text-blue-600 uppercase italic">IFS: {ihbar.ifs_is_emri_no || 'BEKLİYOR'}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border-b-8 border-blue-900">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase italic">MÜŞTERİ / BİRİM</p>
                  <h1 className="text-2xl md:text-4xl font-black text-gray-800 uppercase italic tracking-tighter leading-none">{ihbar.musteri_adi}</h1>
                  <p className="text-lg text-blue-600 font-bold uppercase mt-1 italic">{ihbar.konu}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm ${ihbar.durum === 'Tamamlandi' ? 'bg-green-500 text-white' : ihbar.durum === 'Calisiliyor' ? 'bg-blue-600 text-white animate-pulse' : 'bg-orange-500 text-white'}`}>{ihbar.durum}</span>
              </div>

              {ihbar.ihbar_veren_tel && (
                <div className="mb-8 p-5 bg-green-50 border-2 border-green-100 rounded-[2rem] flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-500 p-3 rounded-2xl text-white text-xl shadow-lg">📞</div>
                    <div><p className="text-[9px] font-black text-green-600 uppercase">İhbarcıya Ulaş</p><p className="text-lg font-black text-gray-800 tracking-tighter">{ihbar.ihbar_veren_tel}</p></div>
                  </div>
                  <a href={`tel:${ihbar.ihbar_veren_tel}`} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] shadow-lg active:scale-95 uppercase italic">Ara</a>
                </div>
              )}

              <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase italic mb-2 tracking-widest">📋 DETAYLAR</p>
                <p className="text-gray-700 italic text-lg leading-relaxed">{ihbar.aciklama || 'Detay yok.'}</p>
              </div>

              <div className="mt-8">
                <h3 className="font-black text-xs text-slate-400 uppercase mb-4 tracking-widest italic border-b pb-2">📦 MALZEMELER</h3>
                <div className="overflow-hidden rounded-2xl border-2 border-gray-50">
                  <table className="w-full text-left">
                    <thead className="bg-gray-800 text-[10px] font-black text-white uppercase italic">
                      <tr><th className="p-4">KOD</th><th className="p-4">MALZEME</th><th className="p-4 text-right">ADET</th></tr>
                    </thead>
                    <tbody className="divide-y bg-white font-bold uppercase italic text-sm">
                      {kullanilanlar.length > 0 ? kullanilanlar.map(k => (
                        <tr key={k.id}><td className="p-4 text-blue-600">[{k.malzeme_kodu}]</td><td className="p-4">{k.malzeme_adi}</td><td className="p-4 text-right text-orange-600">{k.kullanim_adedi}</td></tr>
                      )) : <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">Malzeme yok.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {canPerformSahaActions && (ihbar.durum === 'Calisiliyor' || ihbar.durum === 'Durduruldu') ? (
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border-t-8 border-blue-600">
                <h3 className="font-black text-lg mb-4 text-blue-900 italic uppercase">⚒️ SAHA İŞLEMLERİ</h3>
                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <input type="text" placeholder="🔍 MALZEME ARA..." className="w-full p-4 border-2 rounded-2xl font-black text-xs bg-gray-50 focus:border-blue-500 outline-none uppercase" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    {searchTerm && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border-2 rounded-xl shadow-2xl max-h-48 overflow-auto z-50">
                        {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10).map(m => (
                          <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-4 hover:bg-blue-50 cursor-pointer text-[10px] font-black border-b uppercase flex justify-between italic text-black">
                            <span>{m.malzeme_adi}</span><span className="text-blue-600">[{m.malzeme_kodu}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {secilenMalzeme && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                      <span className="text-[9px] font-black uppercase flex-1 truncate text-emerald-700">✅ {secilenMalzeme.malzeme_adi}</span>
                      <input type="number" className="w-16 p-2 bg-white border-2 border-emerald-200 rounded-xl font-black text-center" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                      <button onClick={malzemeEkle} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase">EKLE</button>
                    </div>
                  )}
                </div>
                <textarea className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 text-xs font-bold mb-4 focus:border-blue-500 outline-none" placeholder="YAPILAN İŞLEMİ YAZIN..." rows={4} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                <div className="flex flex-col gap-3">
                    <button onClick={() => isiKapatVeyaDurdur('Tamamlandi')} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-xl uppercase italic border-b-4 border-green-800 active:scale-95 transition-all text-xs">🏁 İŞİ BİTİR</button>
                    <button onClick={() => isiKapatVeyaDurdur('Durduruldu')} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black shadow-lg uppercase italic border-b-4 border-orange-700 active:scale-95 transition-all text-xs">⚠️ DURDUR</button>
                </div>
              </div>
            ) : ihbar.durum === 'Beklemede' && (
              <button 
                disabled={loading}
                onClick={isiBaslat} 
                className="w-full bg-blue-600 text-white py-10 rounded-[2.5rem] font-black shadow-2xl uppercase italic animate-pulse text-lg tracking-tighter border-b-8 border-blue-900 active:scale-95 transition-all"
              >
                {loading ? '🛠️ İŞ BAŞLATILIYOR...' : '🛠️ ŞİMDİ İŞE BAŞLA'}
              </button>
            )}

            {canEditAssignment && (
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border-t-8 border-slate-800">
                <h3 className="font-black text-[10px] uppercase text-slate-500 mb-4 italic tracking-widest">YÖNETİCİ PANELİ</h3>
                <input placeholder="IFS NO" className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black text-xs mb-3 outline-none" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-xs mb-3 uppercase outline-none">
                  <option value="">PERSONEL ATA...</option>
                  {personeller.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <button onClick={async () => { await supabase.from('ihbarlar').update({ atanan_personel: seciliAtanan, ifs_is_emri_no: ifsNo }).eq('id', id); fetchData(); alert("Güncellendi"); }} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">GÜNCELLE</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}