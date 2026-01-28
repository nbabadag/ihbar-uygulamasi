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
  
  const [nesneListesi, setNesneListesi] = useState<any[]>([])
  const [nesneSearch, setNesneSearch] = useState('')
  const [secilenNesne, setSecilenNesne] = useState<any>(null)

  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [loading, setLoading] = useState(false)

  // --- 🔔 BİLDİRİM GÖNDERME MOTORU ---
  const sendAutoNotification = async (eventType: string, mesaj: string) => {
    try {
      const { data: settings } = await supabase.from('notification_settings').select('*').eq('event_type', eventType).single();
      if (settings && settings.target_roles?.length > 0) {
        await supabase.from('bildirimler').insert([{
          ihbar_id: id,
          mesaj: mesaj,
          islem_yapan_ad: userName || 'Sistem',
          heget_roller: settings.target_roles,
          is_read: false
        }]);
      }
    } catch (err) {
      console.error("Bildirim hatası:", err);
    }
  };

  // --- 🔐 YETKİ KONTROLLERİ (GÜNCELLENDİ) ---
  const normalizedRole = userRole?.trim().toUpperCase() || '';
  
  // Personel veya Grup ataması yapabilenler (Çağrı Merkezi dahil)
  const canEditAssignment = [
    'ADMIN', 'ADMİN', 
    'MÜDÜR', 'MUDUR', 
    'MÜHENDİS-YÖNETİCİ', 'MUHENDIS-YONETICI', 
    'FORMEN', 
    'ÇAĞRI MERKEZİ', 'CAGRI MERKEZI', 'ÇAĞRI', 'CAGRI'
  ].includes(normalizedRole);

  // İşi havuza geri gönderebilenler
  const canReleaseToPool = [
    'ADMIN', 'ADMİN', 
    'MÜDÜR', 'MUDUR', 
    'MÜHENDİS-YÖNETİCİ', 
    'ÇAĞRI MERKEZİ', 'CAGRI MERKEZI', 'ÇAĞRI', 'CAGRI'
  ].includes(normalizedRole);

  const aiMetniAnalizEtVeOgren = async (not: string) => {
    if (!not || not.length < 5) return;
    const gereksizler = ['ve', 'ile', 'için', 'yaptım', 'edildi', 'yapıldı', 'tamamlandı', 'kontrol', 'geldi', 'gitti'];
    const kelimeler = not.toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter(k => k.length > 3 && !gereksizler.includes(k));

    let onerilenEkip = "GENEL SAHA";
    const role = normalizedRole;
    if (role.includes('ELEKTRİK') || role.includes('ELEKTRIK')) onerilenEkip = "ELEKTRİK EKİBİ";
    if (role.includes('MEKANİK') || role.includes('MEKANIK')) onerilenEkip = "MEKANİK EKİBİ";

    for (const kelime of kelimeler) {
      await supabase.from('ai_kutuphane').upsert({
        kelime: kelime,
        onerilen_ekip: onerilenEkip,
        onay_durumu: false
      }, { onConflict: 'kelime' });
    }
  };

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
      setUserName(profile?.full_name || '')
    }

    const [ihbarRes, pRes, mRes, kmRes, nRes] = await Promise.all([
      supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name)`).eq('id', id).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('malzemeler').select('*').order('malzeme_adi'),
      supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id),
      supabase.from('teknik_nesneler').select('*').order('nesne_adi')
    ])

    if (ihbarRes.data) {
      setIhbar(ihbarRes.data)
      setIfsNo(ihbarRes.data.ifs_is_emri_no || '')
      setSeciliAtanan(ihbarRes.data.atanan_personel || '')
      setPersonelNotu(ihbarRes.data.personel_notu || '')
      
      if (ihbarRes.data.secilen_nesne_adi && nRes.data) {
        const bul = nRes.data.find(n => n.nesne_adi === ihbarRes.data.secilen_nesne_adi);
        setSecilenNesne(bul || { nesne_adi: ihbarRes.data.secilen_nesne_adi, ifs_kodu: 'BİLİNMİYOR' });
      }
    }
    setPersoneller(pRes.data || [])
    setMalzemeKatalog(mRes.data || [])
    setKullanilanlar(kmRes.data || [])
    setNesneListesi(nRes.data || [])
  }, [id])

  useEffect(() => { 
    fetchData() 
    return () => { if(intervalRef.current) clearInterval(intervalRef.current) } 
  }, [fetchData])

  const nesneAta = async (nesne: any) => {
    const { error } = await supabase.from('ihbarlar').update({ secilen_nesne_adi: nesne.nesne_adi }).eq('id', id);
    if (!error) {
      setSecilenNesne(nesne);
      setNesneSearch('');
      fetchData();
    }
  };

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

  const isiKapatVeyaDurdur = async (yeniDurum: 'Tamamlandi' | 'Durduruldu') => {
    if (!personelNotu) return alert("İşlem notu gerekli.");
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLoading(true);
    const simdi = new Date().toISOString();
    const konum = await getGPSLocation();
    if (yeniDurum === 'Tamamlandi') { await aiMetniAnalizEtVeOgren(personelNotu); }
    const updates: any = { durum: yeniDurum, personel_notu: personelNotu };
    if (yeniDurum === 'Tamamlandi') { updates.kapatma_tarihi = simdi; updates.bitis_konum = konum; }
    await supabase.from('ihbarlar').update(updates).eq('id', id);
    await supabase.from('is_zamanlari').update({ bitis_tarihi: simdi, durum: yeniDurum, personel_notu: personelNotu }).eq('ihbar_id', id).is('bitis_tarihi', null);
    
    const eventKey = yeniDurum === 'Durduruldu' ? 'is_durduruldu' : 'is_tamamlandi';
    const msg = yeniDurum === 'Durduruldu' ? `⚠️ İŞ DURDURULDU: #${id} (${ihbar?.konu})` : `✅ İŞ BİTTİ: #${id} (${ihbar?.konu})`;
    await sendAutoNotification(eventKey, msg);

    if (yeniDurum === 'Tamamlandi') router.push('/dashboard');
    else { fetchData(); setLoading(false); }
  }

  const handleHavuzaAl = async () => {
    if(!confirm("İş havuza geri gönderilsin mi?")) return;
    setLoading(true);
    await supabase.from('ihbarlar').update({ durum: 'Beklemede', atanan_personel: null, kabul_tarihi: null }).eq('id', id);
    await sendAutoNotification('havuz_ihbar', `🔄 İŞ HAVUZA DÖNDÜ: #${id} (${ihbar?.konu})`);
    router.push('/dashboard');
  }

  if (!ihbar) return <div className="p-10 text-center font-black text-white bg-[#0a0b0e] min-h-screen">YÜKLENİYOR...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: "url('/logo.png')", backgroundSize: '80%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: 'brightness(0.5) contrast(1.2) grayscale(0.5)' }}></div>
      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-6 relative z-10 w-full">
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-800 font-black">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95 shadow-orange-900/20 font-black"> GERİ DÖN </button>
          <div className="flex items-center gap-4 font-black">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <div className="text-[10px] font-black text-orange-500 uppercase italic border-l border-gray-700 pl-4 tracking-widest font-black"> {ihbar.ifs_is_emri_no || 'IFS KAYDI YOK'} </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-black">
          <div className="lg:col-span-2 space-y-6 font-black">
            <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 md:p-10 rounded-[3rem] shadow-2xl border border-gray-800/50 overflow-visible relative font-black">
              <div className="mb-8 border-b border-gray-800 pb-6 font-black">
                <p className="text-[9px] font-black text-orange-500 uppercase italic tracking-[0.2em] mb-2 font-black">OPERASYON DETAYI</p>
                <h1 className="text-3xl md:text-5xl font-black text-white uppercase italic leading-none mb-3 font-black">{ihbar.musteri_adi}</h1>
                <p className="text-lg text-blue-400 font-bold uppercase italic tracking-tight font-black">{ihbar.konu}</p>
              </div>
              
              <div className="bg-black/30 p-8 rounded-3xl border border-gray-800 mb-4 italic text-gray-300 leading-relaxed text-sm shadow-inner font-black"> 
                "{ihbar.aciklama || 'İhbar açıklaması bulunamadı.'}" 
              </div>

              {ihbar.personel_notu && (
                <div className="bg-orange-600/10 p-8 rounded-3xl border border-orange-500/30 mb-8 italic text-orange-400 leading-relaxed text-sm shadow-inner font-black">
                  <span className="block text-[8px] font-black uppercase mb-1 not-italic text-orange-500 tracking-widest font-black">🔧 PERSONEL İŞ SONU NOTU:</span>
                  "{ihbar.personel_notu}"
                </div>
              )}

              <div className="bg-[#111318] p-6 rounded-[2.5rem] border border-blue-500/30 mb-8 shadow-2xl relative overflow-visible z-[50] font-black">
                <h3 className="text-blue-400 text-[10px] font-black uppercase italic mb-4 tracking-widest flex items-center gap-2 font-black">
                  <span className="animate-pulse font-black">●</span> TEKNİK NESNE / VARLIK SEÇİMİ
                </h3>
                {secilenNesne ? (
                  <div className="flex items-center justify-between bg-blue-600/10 border border-blue-500/40 p-4 rounded-2xl mb-4 font-black">
                    <div className="font-black">
                      <div className="text-white text-xs font-black uppercase font-black">{secilenNesne.nesne_adi}</div>
                      <div className="text-blue-400 text-[9px] font-black mt-1 uppercase font-black">IFS KODU: {secilenNesne.ifs_kodu}</div>
                    </div>
                    <button onClick={async () => { await supabase.from('ihbarlar').update({ secilen_nesne_adi: null }).eq('id', id); setSecilenNesne(null); }} className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all text-[8px] font-black font-black">DEĞİŞTİR</button>
                  </div>
                ) : (
                  <div className="relative overflow-visible font-black">
                    <input type="text" placeholder="TEKNİK NESNE ARA..." className="w-full p-4 bg-black/50 border border-gray-800 rounded-2xl text-[10px] text-white outline-none focus:border-blue-500 transition-all font-black" value={nesneSearch} onChange={(e) => setNesneSearch(e.target.value.toUpperCase())} />
                    {nesneSearch && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-2xl max-h-60 overflow-y-auto z-[999] shadow-[0_20px_50px_rgba(0,0,0,0.9)] custom-scrollbar font-black">
                        {nesneListesi.filter(n => (n.nesne_adi && n.nesne_adi.includes(nesneSearch)) || (n.ifs_kodu && n.ifs_kodu.includes(nesneSearch))).map(n => (
                          <div key={n.id} onClick={() => nesneAta(n)} className="p-4 hover:bg-blue-600/20 border-b border-gray-800/50 cursor-pointer flex justify-between items-center transition-colors font-black">
                            <div className="font-black">
                              <div className="text-[10px] font-black text-white font-black">{n.nesne_adi}</div>
                              <div className="text-[8px] text-gray-500 font-black font-black">{n.ifs_kodu || 'KOD YOK'}</div>
                            </div>
                            <div className="text-blue-500 text-[10px] font-black italic uppercase font-black">SEÇ →</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-10 font-black">
                <h3 className="font-black text-[10px] text-gray-500 uppercase mb-4 italic tracking-widest text-white font-black">📦 MALZEME SARFİYATI</h3>
                <div className="overflow-hidden rounded-3xl border border-gray-800 shadow-2xl font-black">
                  <table className="w-full text-left font-black">
                    <thead className="bg-[#111318] text-orange-500 text-[9px] font-black uppercase italic tracking-widest font-black">
                      <tr><th className="p-4 font-black">KOD</th><th className="p-4 font-black">MALZEME</th><th className="p-4 text-right font-black">ADET</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-xs font-bold uppercase italic text-gray-200 bg-black/20 font-black">
                      {kullanilanlar && kullanilanlar.length > 0 ? ( 
                        kullanilanlar.map((k, index) => ( 
                          <tr key={k.id || index} className="hover:bg-white/5 transition-colors font-black">
                            <td className="p-4 text-orange-400 font-black">{k.malzeme_kodu}</td>
                            <td className="p-4 font-black">{k.malzeme_adi}</td>
                            <td className="p-4 text-right text-blue-400 font-black font-black">{k.kullanim_adedi}</td>
                          </tr> 
                        )) 
                      ) : ( 
                        <tr><td colSpan={3} className="p-10 text-center text-gray-600 tracking-tighter font-black">Henüz sarfiyat girilmedi</td></tr> 
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6 font-black">
            {ihbar.durum === 'Calisiliyor' ? (
              <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] shadow-2xl border border-orange-500/30 font-black">
                <h3 className="font-black text-lg mb-6 text-white italic uppercase flex items-center gap-3 font-black"> <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,1)] font-black"></span> İŞLEM PANELİ </h3>
                <div className="space-y-4 mb-6 font-black">
                  <input type="text" placeholder="🔍 MALZEME ARA..." className="w-full p-4 border border-gray-700 rounded-2xl font-black text-[10px] bg-black/40 text-white placeholder-gray-500 outline-none font-black" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  {searchTerm && (
                    <div className="bg-[#111318] border border-gray-700 rounded-xl max-h-40 overflow-auto shadow-2xl z-20 relative custom-scrollbar font-black">
                      {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).map(m => ( <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-4 hover:bg-orange-600/10 cursor-pointer text-[9px] font-black border-b border-gray-800 uppercase flex justify-between text-gray-300 font-black"> <span>{m.malzeme_adi}</span><span className="text-orange-500 font-black">[{m.malzeme_kodu}]</span> </div> ))}
                    </div>
                  )}
                  {secilenMalzeme && (
                    <div className="flex items-center gap-2 p-4 bg-orange-600/10 rounded-2xl border border-orange-500/30 shadow-inner font-black">
                      <span className="text-[9px] font-black uppercase flex-1 truncate text-white font-black">✅ {secilenMalzeme.malzeme_adi}</span>
                      <input type="number" className="w-16 p-2 bg-black/50 border border-gray-700 rounded-lg font-black text-center text-white font-black" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                      <button onClick={malzemeEkle} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-black text-[9px] font-black">EKLE</button>
                    </div>
                  )}
                </div>
                <textarea className="w-full p-4 border border-gray-700 rounded-2xl bg-black/40 text-[11px] font-black mb-6 text-white placeholder-gray-500 outline-none font-black" placeholder="İşlem notu girin..." rows={5} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                <div className="flex flex-col gap-3 font-black">
                    <button onClick={() => isiKapatVeyaDurdur('Tamamlandi')} className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-3xl font-black shadow-xl uppercase italic text-xl active:scale-95 transition-all font-black">🏁 İŞİ BİTİR</button>
                    <button onClick={() => isiKapatVeyaDurdur('Durduruldu')} className="w-full bg-orange-600/20 text-orange-500 border border-orange-600/30 py-4 rounded-3xl font-black shadow-lg uppercase italic text-[10px] active:scale-95 transition-all font-black">⚠️ İŞİ DURDUR</button>
                </div>
              </div>
            ) : ihbar.durum !== 'Tamamlandi' && (
              <button onClick={isiBaslat} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-12 rounded-[3rem] font-black shadow-2xl uppercase italic text-3xl animate-pulse active:scale-95 transition-all font-black font-black">🚀 İŞE BAŞLA</button>
            )}
            
            {canEditAssignment && (
              <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] shadow-xl border-t-8 border-orange-600 font-black">
                <h3 className="font-black text-[10px] uppercase text-white mb-6 italic tracking-[0.2em] font-black">YÖNETİCİ KONTROLLERİ</h3>
                <div className="space-y-4 font-black">
                  <div className="space-y-1 font-black">
                    <p className="text-[8px] font-black text-gray-600 ml-4 font-black">IFS İŞ EMRİ NO</p>
                    <input placeholder="GİRİŞ YAPIN..." className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-[10px] text-orange-500 outline-none font-black" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                  </div>
                  <div className="space-y-1 font-black">
                    <p className="text-[8px] font-black text-gray-600 ml-4 font-black">PERSONEL ATAMASI</p>
                    <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl font-black text-[10px] uppercase text-white outline-none font-black">
                      <option value="" className="font-black">PERSONEL SEÇİN...</option>
                      {personeller.map(p => <option key={p.id} value={p.id} className="bg-[#1a1c23] font-black">{p.full_name}</option>)}
                    </select>
                  </div>
                  <button onClick={async () => { 
                    await supabase.from('ihbarlar').update({ atanan_personel: seciliAtanan, ifs_is_emri_no: ifsNo }).eq('id', id); 
                    await sendAutoNotification('ihbar_atandi', `👤 SİZE YENİ İŞ ATANDI: #${id} (${ihbar?.konu})`);
                    fetchData(); 
                    alert("İş Emri ve Personel Güncellendi."); 
                  }} className="w-full bg-white text-black py-4 rounded-2xl font-black text-[9px] uppercase hover:bg-orange-500 hover:text-white transition-all duration-300 font-black">BİLGİLERİ GÜNCELLE</button>
                </div>
              </div>
            )}
            {canReleaseToPool && ( <button onClick={handleHavuzaAl} className="w-full text-gray-600 hover:text-red-500 font-black uppercase italic text-[8px] pt-4 transition-all tracking-widest text-white font-black">❌ BU İŞİ HAVUZA GERİ GÖNDER</button> )}
          </div>
        </div>
      </div>
      <style jsx>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 10px; } `}</style>
    </div>
  )
}