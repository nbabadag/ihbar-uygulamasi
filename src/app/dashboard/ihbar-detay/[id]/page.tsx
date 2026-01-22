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
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [loading, setLoading] = useState(false)

  // --- 🛠️ YETKİ KONTROLÜ DÜZELTİLDİ ---
  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const canReleaseToPool = normalizedRole !== 'SAHA PERSONELI' && normalizedRole !== '';
  
  // Çağrı Merkezi yetkisi için Türkçe karakter ve I/İ uyumu garantilendi
  const canEditAssignment = [
    'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ADMIN', 
    'ÇAĞRI MERKEZİ', 'CAGRI MERKEZI', 'CAGRI MERKEZİ', 'ÇAĞRI MERKEZI'
  ].includes(normalizedRole);

  const getGPSLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve("GPS Yok"); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve("Konum Alınamadı"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      setUserRole(profile?.role || '')
    }

    const [ihbarRes, pRes, mRes, kmRes] = await Promise.all([
      supabase.from('ihbarlar').select(`*, profiles (full_name)`).eq('id', id).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('malzemeler').select('*').order('malzeme_adi'),
      supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id)
    ])

    if (ihbarRes.data) {
      setIhbar(ihbarRes.data)
      setIfsNo(ihbarRes.data.ifs_is_emri_no || '')
      setSeciliAtanan(ihbarRes.data.atanan_personel || '')
      setPersonelNotu(ihbarRes.data.personel_notu || '')
    }
    setPersoneller(pRes.data || [])
    setMalzemeKatalog(mRes.data || [])
    setKullanilanlar(kmRes.data || [])
  }, [id])

  useEffect(() => { 
    fetchData() 
    return () => { if(intervalRef.current) clearInterval(intervalRef.current) } 
  }, [fetchData])

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData();
  }

  const isiBaslat = async () => {
    setLoading(true)
    const konum = await getGPSLocation();
    const simdi = new Date().toISOString();
    
    await supabase.from('ihbarlar').update({ 
      durum: 'Calisiliyor', kabul_tarihi: simdi, atanan_personel: userId, guncel_konum: konum,
      konum_gecmisi: [{ konum: konum, saat: simdi }] 
    }).eq('id', id)

    await supabase.from('is_zamanlari').insert([{ ihbar_id: id, personel_id: userId, baslangic_tarihi: simdi, durum: 'Devam Ediyor' }])

    intervalRef.current = setInterval(async () => {
        const yeniKonum = await getGPSLocation();
        const { data: curr } = await supabase.from('ihbarlar').select('konum_gecmisi').eq('id', id).single();
        const guncelGecmis = [...(curr?.konum_gecmisi || []), { konum: yeniKonum, saat: new Date().toISOString() }];
        await supabase.from('ihbarlar').update({ guncel_konum: yeniKonum, konum_gecmisi: guncelGecmis }).eq('id', id);
    }, 120000);

    fetchData(); setLoading(false)
  }

  const bildirimOlustur = async (durum: 'Tamamlandi' | 'Durduruldu') => {
    let hedefRoller: string[] = [];
    let mesajMetni = "";
    const islemYapanAd = ihbar?.profiles?.full_name || "Bilinmeyen Personel";

    if (durum === 'Durduruldu') {
      hedefRoller = ['Çağrı Merkezi', 'Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'];
      mesajMetni = `⚠️ İŞ DURDURULDU: #${id} nolu iş (${ihbar?.konu}) ${islemYapanAd} tarafından durduruldu.`;
    } else {
      hedefRoller = ['Çağrı Merkezi', 'Formen', 'Mühendis-Yönetici'];
      mesajMetni = `✅ İŞ TAMAMLANDI: #${id} nolu iş (${ihbar?.konu}) ${islemYapanAd} tarafından bitirildi.`;
    }

    await supabase.from('bildirimler').insert([{
      ihbar_id: id, mesaj: mesajMetni, islem_yapan_ad: islemYapanAd, hedef_roller: hedefRoller
    }]);
  }

  const isiKapatVeyaDurdur = async (yeniDurum: 'Tamamlandi' | 'Durduruldu') => {
    if (!personelNotu) return alert("İşlem notu gerekli.");
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLoading(true);
    const simdi = new Date().toISOString();
    const konum = await getGPSLocation();

    const updates: any = { durum: yeniDurum, personel_notu: personelNotu };
    if (yeniDurum === 'Tamamlandi') { updates.kapatma_tarihi = simdi; updates.bitis_konum = konum; }

    await supabase.from('ihbarlar').update(updates).eq('id', id);
    await supabase.from('is_zamanlari').update({ bitis_tarihi: simdi, durum: yeniDurum, personel_notu: personelNotu }).eq('ihbar_id', id).is('bitis_tarihi', null);

    await bildirimOlustur(yeniDurum);

    if (yeniDurum === 'Tamamlandi') router.push('/dashboard');
    else { fetchData(); setLoading(false); }
  }

  const handleHavuzaAl = async () => {
    if(!confirm("İş havuza geri gönderilsin mi?")) return;
    setLoading(true);
    const islemYapanAd = ihbar?.profiles?.full_name || "Bilinmeyen Personel";
    await supabase.from('ihbarlar').update({ durum: 'Beklemede', atanan_personel: null, kabul_tarihi: null }).eq('id', id);
    await supabase.from('bildirimler').insert([{
      ihbar_id: id,
      mesaj: `🔄 İŞ HAVUZA DÖNDÜ: #${id} nolu iş (${ihbar?.konu}), ${islemYapanAd} tarafından havuza geri bırakıldı.`,
      islem_yapan_ad: islemYapanAd,
      hedef_roller: ['Çağrı Merkezi']
    }]);
    router.push('/dashboard');
  }

  if (!ihbar) return <div className="p-10 text-center font-black text-white bg-[#0a0b0e] min-h-screen">YÜKLENİYOR...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* 🖼️ TAM SAYFA KURUMSAL ARKA PLAN */}
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

      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-6 relative z-10 w-full">
        
        {/* 🏛️ ÜST BAR VE KURUMSAL GERİ BUTONU */}
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-800">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95 shadow-orange-900/20"
          >
            <span className="text-sm">←</span> GERİ DÖN
          </button>
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
            <div className="text-[10px] font-black text-orange-500 uppercase italic border-l border-gray-700 pl-4 tracking-widest"> 
              {ihbar.ifs_is_emri_no || 'IFS KAYDI YOK'} 
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* SOL ANA PANEL */}
            <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 md:p-10 rounded-[3rem] shadow-2xl border border-gray-800/50">
              <div className="mb-8 border-b border-gray-800 pb-6">
                <p className="text-[9px] font-black text-orange-500 uppercase italic tracking-[0.2em] mb-2">OPERASYON DETAYI</p>
                <h1 className="text-3xl md:text-5xl font-black text-white uppercase italic leading-none mb-3 drop-shadow-md">{ihbar.musteri_adi}</h1>
                <p className="text-lg text-blue-400 font-bold uppercase italic tracking-tight">{ihbar.konu}</p>
              </div>

              {ihbar.ihbar_veren_tel && (
                <div className="mb-8 p-6 bg-orange-600/10 border border-orange-500/20 rounded-[2.5rem] flex justify-between items-center shadow-inner">
                  <div className="flex items-center gap-4 text-white">
                    <span className="text-3xl">📞</span>
                    <div><p className="text-[10px] font-black text-orange-500 uppercase italic mb-1">İrtibat Hattı</p><p className="text-xl font-black">{ihbar.ihbar_veren_tel}</p></div>
                  </div>
                  <a href={`tel:${ihbar.ihbar_veren_tel}`} className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 shadow-orange-900/30">ARAMA YAP</a>
                </div>
              )}

              <div className="bg-black/30 p-8 rounded-3xl border border-gray-800 mb-8 italic text-gray-300 leading-relaxed text-sm shadow-inner font-medium">
                "{ihbar.aciklama || 'Açıklama belirtilmemiş.'}"
              </div>

              <div className="mt-10">
                <h3 className="font-black text-[10px] text-gray-500 uppercase mb-4 italic tracking-widest text-white">📦 MALZEME SARFİYATI</h3>
                <div className="overflow-hidden rounded-3xl border border-gray-800 shadow-2xl">
                  <table className="w-full text-left">
                    <thead className="bg-[#111318] text-orange-500 text-[9px] font-black uppercase italic tracking-widest">
                      <tr><th className="p-4">KOD</th><th className="p-4">MALZEME</th><th className="p-4 text-right">ADET</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-xs font-bold uppercase italic text-gray-200 bg-black/20">
                      {kullanilanlar.length === 0 ? (
                        <tr><td colSpan={3} className="p-10 text-center text-gray-600 tracking-tighter">Henüz sarfiyat girilmedi</td></tr>
                      ) : (
                        kullanilanlar.map(k => (
                          <tr key={k.id} className="hover:bg-white/5 transition-colors"><td className="p-4 text-orange-400">{k.malzeme_kodu}</td><td className="p-4">{k.malzeme_adi}</td><td className="p-4 text-right text-blue-400 font-black">{k.kullanim_adedi}</td></tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* SAĞ İŞLEM PANELİ */}
            {ihbar.durum === 'Calisiliyor' ? (
              <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] shadow-2xl border border-orange-500/30">
                <h3 className="font-black text-lg mb-6 text-white italic uppercase flex items-center gap-3">
                  <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,1)] text-white"></span> İŞLEM PANELİ
                </h3>
                <div className="space-y-4 mb-6">
                  <input type="text" placeholder="🔍 MALZEME ARA..." className="w-full p-4 border border-gray-700 rounded-2xl font-black text-[10px] bg-black/40 text-white placeholder-gray-500 focus:border-orange-500 transition-all outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  {searchTerm && (
                    <div className="bg-[#111318] border border-gray-700 rounded-xl max-h-40 overflow-auto shadow-2xl z-20 relative custom-scrollbar">
                      {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).map(m => (
                        <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-4 hover:bg-orange-600/10 cursor-pointer text-[9px] font-black border-b border-gray-800 uppercase flex justify-between text-gray-300">
                          <span>{m.malzeme_adi}</span><span className="text-orange-500">[{m.malzeme_kodu}]</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {secilenMalzeme && (
                    <div className="flex items-center gap-2 p-4 bg-orange-600/10 rounded-2xl border border-orange-500/30 shadow-inner">
                      <span className="text-[9px] font-black uppercase flex-1 truncate text-white">✅ {secilenMalzeme.malzeme_adi}</span>
                      <input type="number" className="w-16 p-2 bg-black/50 border border-gray-700 rounded-lg font-black text-center text-white" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                      <button onClick={malzemeEkle} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-black text-[9px]">EKLE</button>
                    </div>
                  )}
                </div>
                <textarea className="w-full p-4 border border-gray-700 rounded-2xl bg-black/40 text-[11px] font-bold mb-6 text-white placeholder-gray-500 focus:border-blue-500 transition-all outline-none" placeholder="İşlem notu girin..." rows={5} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                <div className="flex flex-col gap-3">
                    <button onClick={() => isiKapatVeyaDurdur('Tamamlandi')} className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-3xl font-black shadow-xl shadow-green-900/20 uppercase italic text-xl active:scale-95 transition-all">🏁 İŞİ BİTİR</button>
                    <button onClick={() => isiKapatVeyaDurdur('Durduruldu')} className="w-full bg-orange-600/20 text-orange-500 border border-orange-600/30 py-4 rounded-3xl font-black shadow-lg uppercase italic text-[10px] active:scale-95 transition-all">⚠️ İŞİ DURDUR</button>
                </div>
              </div>
            ) : ihbar.durum !== 'Tamamlandi' && (
              <button onClick={isiBaslat} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-12 rounded-[3rem] font-black shadow-2xl uppercase italic text-3xl animate-pulse active:scale-95 transition-all shadow-orange-900/30">🚀 İŞE BAŞLA</button>
            )}

            {/* --- 🛠️ YÖNETİCİ KONTROLLERİ (ÇALIŞMA GARANTİLİ) --- */}
            {canEditAssignment && (
              <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] shadow-xl border-t-8 border-orange-600">
                <h3 className="font-black text-[10px] uppercase text-gray-500 mb-6 italic tracking-[0.2em] text-white">YÖNETİCİ KONTROLLERİ</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-600 ml-4">IFS İŞ EMRİ NO</p>
                    <input placeholder="GİRİŞ YAPIN..." className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-[10px] text-orange-500 outline-none focus:border-orange-500" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-600 ml-4">PERSONEL ATAMASI</p>
                    <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-[10px] uppercase text-white outline-none focus:border-orange-500">
                      <option value="">PERSONEL SEÇİN...</option>
                      {personeller.map(p => <option key={p.id} value={p.id} className="bg-[#1a1c23]">{p.full_name}</option>)}
                    </select>
                  </div>
                  <button onClick={async () => { await supabase.from('ihbarlar').update({ atanan_personel: seciliAtanan, ifs_is_emri_no: ifsNo }).eq('id', id); fetchData(); alert("İş Emri ve Personel Güncellendi."); }} className="w-full bg-white text-black py-4 rounded-2xl font-black text-[9px] uppercase hover:bg-orange-500 hover:text-white transition-all transition-colors duration-300">BİLGİLERİ GÜNCELLE</button>
                </div>
              </div>
            )}
            
            {canReleaseToPool && (
              <button onClick={handleHavuzaAl} className="w-full text-gray-600 hover:text-red-500 font-black uppercase italic text-[8px] pt-4 transition-all tracking-widest text-white">❌ BU İŞİ HAVUZA GERİ GÖNDER</button>
            )}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 10px; }
      `}</style>
    </div>
  )
}