'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import * as LucideIcons from 'lucide-react' // Kilit ikonu için eklendi

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [nesneListesi, setNesneListesi] = useState<any[]>([])
  const [nesneSearch, setNesneSearch] = useState('')
  const [secilenNesne, setSecilenNesne] = useState<any>(null)
  
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  const [malzemeSearch, setMalzemeSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [miktar, setMiktar] = useState(1)
  
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [userMemberGroups, setUserMemberGroups] = useState<string[]>([])
  
  const [editKonu, setEditKonu] = useState('')
  const [editAciklama, setEditAciklama] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [seciliGrup, setSeciliGrup] = useState('')
  const [personelNotu, setPersonelNotu] = useState('')
  const [yardimcilar, setYardimcilar] = useState<string[]>([])

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isCagriMerkezi = normalizedRole.includes('ÇAĞRI') || normalizedRole.includes('CAGRI');
  const isAdmin = normalizedRole.includes('ADMIN');
  const isMudur = normalizedRole.includes('MÜDÜR');

  // --- 🛡️ KRİTİK KİLİT KONTROLÜ ---
  const isJobFinished = (ihbar?.durum || '').toLowerCase().includes('tamamlandi');
  
  const canEditIhbar = (isCagriMerkezi || isAdmin || isMudur) && !isJobFinished; 
  const canEditAssignment = (canEditIhbar || normalizedRole.includes('MÜH') || normalizedRole.includes('FORMEN')) && (!isJobFinished || isAdmin);
  
  const isVardiyaHavuz = ihbar?.oncelik_durumu === 'VARDİYA_MODU' && !ihbar.atanan_personel;
  const canStartJob = !isCagriMerkezi && !isJobFinished && (
    ihbar?.atanan_personel === userId || 
    userMemberGroups.includes(ihbar?.atanan_grup_id) || 
    isAdmin || isMudur || 
    isVardiyaHavuz
  );

  const getGpsPosition = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve(null),
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
      const { data: memberGroups } = await supabase.from('grup_uyeleri').select('grup_id').eq('profil_id', user.id);
      setUserMemberGroups(memberGroups?.map(g => g.grup_id) || []);
    }

    const [ihbarRes, pRes, gRes, kmRes, nRes] = await Promise.all([
      supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name, personel_sicil_no), calisma_gruplari:atanan_grup_id(grup_adi)`).eq('id', id).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('calisma_gruplari').select('*').order('grup_adi'),
      supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id),
      supabase.from('teknik_nesneler').select('*').order('nesne_adi')
    ])

    if (ihbarRes.data) {
      const d = ihbarRes.data;
      setIhbar(d); 
      setEditKonu(d.konu || ''); 
      setEditAciklama(d.aciklama || ''); 
      setIfsNo(d.ifs_is_emri_no || ''); 
      setSeciliAtanan(d.atanan_personel || ''); 
      setSeciliGrup(d.atanan_grup_id || ''); 
      setPersonelNotu(d.personel_notu || '');
      setYardimcilar(d.yardimcilar || []);
      if (d.secilen_nesne_adi) {
        setSecilenNesne({ nesne_adi: d.secilen_nesne_adi, ifs_kod: d.secilen_nesne_kod || '' });
      } else {
        setSecilenNesne(null);
      }
    }
    setPersoneller(pRes.data?.filter(p => !p.role.toUpperCase().includes('ÇAĞRI')) || []); 
    setGruplar(gRes.data || []); 
    setKullanilanlar(kmRes.data || []); 
    setNesneListesi(nRes.data || []);
  }, [id])

  useEffect(() => {
    const searchDelay = setTimeout(async () => {
      if (malzemeSearch.length < 3) { setMalzemeKatalog([]); return; }
      setIsSearching(true);
      const { data } = await supabase.from('malzemeler').select('*').ilike('malzeme_adi', `%${malzemeSearch}%`).limit(15);
      if (data) setMalzemeKatalog(data);
      setIsSearching(false);
    }, 500);
    return () => clearTimeout(searchDelay);
  }, [malzemeSearch]);

  useEffect(() => { fetchData() }, [fetchData])

  const yardimciEkleCikar = async (personelAd: string) => {
    if(isJobFinished && !isAdmin) return; // Kilit
    let yeniListe = yardimcilar.includes(personelAd) ? yardimcilar.filter(item => item !== personelAd) : [...yardimcilar, personelAd];
    setYardimcilar(yeniListe);
    await supabase.from('ihbarlar').update({ yardimcilar: yeniListe }).eq('id', id);
  }

  const malzemeEkle = async () => {
    if (isJobFinished && !isAdmin) return; // Kilit
    if (!secilenMalzeme || miktar <= 0) return alert("Malzeme seçin.");
    setLoading(true);
    const { error } = await supabase.from('ihbar_malzemeleri').insert({ 
        ihbar_id: id, 
        malzeme_id: String(secilenMalzeme.id), 
        malzeme_adi: secilenMalzeme.malzeme_adi, 
        miktar, 
        kullanim_adedi: miktar, 
        birim: secilenMalzeme.birim || 'Adet' 
    });
    if (!error) { setSecilenMalzeme(null); setMiktar(1); setMalzemeSearch(''); fetchData(); }
    setLoading(false);
  };

  const malzemeSil = async (mId: string) => { 
    if (isJobFinished && !isAdmin) return; // Kilit
    await supabase.from('ihbar_malzemeleri').delete().eq('id', mId); 
    fetchData(); 
  };

  const isiBaslat = async () => {
    if (isJobFinished && !isAdmin) return; // Kilit
    setLoading(true);
    const { data: aktifIsler } = await supabase.from('ihbarlar').select('id, konu').eq('atanan_personel', userId).eq('durum', 'Calisiliyor').neq('id', id);

    if (aktifIsler && aktifIsler.length > 0) {
      setLoading(false);
      const git = confirm(`⚠️ DİKKAT: Üzerinizde açık iş var: "${aktifIsler[0].konu}"\n\nÖnce mevcut işi kapatın.`);
      if (git) router.push(`/dashboard/ihbar-detay/${aktifIsler[0].id}`);
      return;
    }

    const pos = await getGpsPosition();
    const guncelleme: any = { durum: 'Calisiliyor', kabul_tarihi: new Date().toISOString(), enlem: pos?.lat || null, boylam: pos?.lng || null };
    if (isVardiyaHavuz) { guncelleme.atanan_personel = userId; guncelleme.atama_tarihi = new Date().toISOString(); }

    const { error } = await supabase.from('ihbarlar').update(guncelleme).eq('id', id);
    if (!error) fetchData();
    setLoading(false);
  }

  const arizaNoktasindayim = async () => {
    if (isJobFinished && !isAdmin) return; // Kilit
    if (!secilenNesne) return alert("⚠️ ÖNCE TEKNİK NESNE SEÇMELİSİNİZ!");
    setLoading(true);
    const pos = await getGpsPosition();
    const { error } = await supabase.from('ihbarlar').update({ 
      varis_tarihi: new Date().toISOString(), 
      varis_enlem: pos?.lat || null, 
      varis_boylam: pos?.lng || null,
      secilen_nesne_adi: secilenNesne.nesne_adi,
      secilen_nesne_kod: secilenNesne.ifs_kod || null,
      yardimcilar: yardimcilar
    }).eq('id', id);
    if (!error) { alert("✅ VARIŞ MÜHÜRLENDİ!"); fetchData(); }
    setLoading(false);
  }

  const isiKapatVeyaDurdur = async (stat: 'Tamamlandi' | 'Durduruldu') => {
    if (isJobFinished && !isAdmin) return; // Kilit
    if (!personelNotu) return alert("İşlem notu zorunludur.");
    if (!secilenNesne) return alert("⚠️ TEKNİK NESNE SEÇİLMEDEN İŞ BİTİRİLEMEZ!");

    setLoading(true);
    const pos = await getGpsPosition();
    const bitisZamani = new Date();
    const baslangicZamani = ihbar?.kabul_tarihi ? new Date(ihbar.kabul_tarihi) : bitisZamani;
    const farkDakika = Math.round((bitisZamani.getTime() - baslangicZamani.getTime()) / 60000);
    const gunMetni = farkDakika > 1440 ? "1 Gün ve Üzeri" : "1 Günden Kısa";

    let isIstasyonuKodu = "202"; 
    const grupIsmi = ihbar.calisma_gruplari?.grup_adi?.toUpperCase() || "";
    if (grupIsmi.includes("BİNA")) isIstasyonuKodu = "204";
    else if (grupIsmi.includes("ELEKTRİK")) isIstasyonuKodu = "201";

    const { error } = await supabase.from('ihbarlar').update({ 
      durum: stat, 
      personel_notu: personelNotu, 
      kapatma_tarihi: bitisZamani.toISOString(), 
      bitis_enlem: pos?.lat || null, 
      bitis_boylam: pos?.lng || null, 
      calisma_suresi_dakika: farkDakika,
      fiili_sure_gun_metni: gunMetni,
      is_istasyonu: isIstasyonuKodu,
      statu: 'Bitirildi'
    }).eq('id', id);

    if (!error) router.push('/dashboard'); 
    else alert("Hata: " + error.message);
    setLoading(false);
  }

  const bilgileriMuhurle = async () => {
    setLoading(true);
    const { error } = await supabase.from('ihbarlar').update({ 
      konu: editKonu.toUpperCase(), 
      aciklama: editAciklama, 
      atanan_personel: seciliAtanan || null, 
      atanan_grup_id: seciliAtanan ? null : (seciliGrup || null), 
      ifs_is_emri_no: ifsNo, 
      secilen_nesne_adi: secilenNesne?.nesne_adi || null, 
      secilen_nesne_kod: secilenNesne?.ifs_kod || null,
      // Eğer durum admin tarafından geri çekiliyorsa (opsiyonel mantık)
      durum: isAdmin && !seciliAtanan && !seciliGrup ? 'Beklemede' : ihbar.durum 
    }).eq('id', id);
    if (!error) { alert("KAYDEDİLDİ ✅"); fetchData(); }
    setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-white bg-[#0a0b0e] min-h-screen text-center italic font-black uppercase">YÜKLENİYOR...</div>

  return (
    <div className="min-h-screen flex flex-col text-white font-sans bg-[#0a0b0e] font-black uppercase italic">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 w-full relative z-10">
        
        <div className="flex justify-between items-center bg-[#111318] p-5 rounded-2xl border border-gray-800 shadow-2xl">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-6 py-2.5 rounded-xl text-[10px]">← GERİ</button>
          <div className="text-[10px] uppercase font-black tracking-widest text-gray-500">
            DURUM: <span className="text-orange-500">{ihbar.durum}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-black italic uppercase">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1a1c23] p-6 md:p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl">
              <h1 className="text-3xl md:text-4xl mb-4 tracking-tighter text-orange-500">{ihbar.ihbar_veren_ad_soyad}</h1>

              {ihbar.ihbar_veren_tel && (
                <a href={`tel:${ihbar.ihbar_veren_tel}`} className="flex items-center justify-between bg-green-600 p-5 rounded-3xl mb-6 active:scale-95 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">📞</span>
                    <div className="flex flex-col"><span className="text-[8px] text-white/60">İHBARI YAPAN</span><span className="text-lg">{ihbar.ihbar_veren_tel}</span></div>
                  </div>
                  <span className="text-[10px] bg-white/20 px-4 py-2 rounded-xl">ARA</span>
                </a>
              )}

              {/* 👥 YARDIMCI PERSONEL */}
              <div className="bg-[#111318] p-6 rounded-3xl border border-orange-500/20 mb-8">
                <p className="text-orange-500 text-[10px] mb-4 tracking-widest uppercase italic">👥 YARDIMCI PERSONEL (EKİP)</p>
                <div className="flex flex-wrap gap-2 mb-4 font-black">
                    {yardimcilar.map(ad => (
                        <span key={ad} onClick={() => yardimciEkleCikar(ad)} className="bg-orange-600 px-4 py-2 rounded-xl text-[10px] cursor-pointer hover:bg-red-600 transition-colors">{ad} {(!isJobFinished || isAdmin) && '×'}</span>
                    ))}
                    {yardimcilar.length === 0 && <span className="text-[10px] text-gray-600">HENÜZ YARDIMCI EKLENMEDİ</span>}
                </div>
                {ihbar.durum === 'Calisiliyor' && !isJobFinished && (
                  <select onChange={(e) => { if(e.target.value) yardimciEkleCikar(e.target.value); e.target.value = ""; }} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-white outline-none font-black uppercase italic">
                      <option value="">+ YARDIMCI PERSONEL EKLE</option>
                      {personeller.filter(p => p.id !== ihbar.atanan_personel).map(p => (
                          <option key={p.id} value={p.full_name} className="bg-[#1a1c23]">{p.full_name}</option>
                      ))}
                  </select>
                )}
              </div>

              {/* KONU & AÇIKLAMA */}
              <div className="mb-6">
                <p className="text-[10px] text-gray-500 mb-2 font-black uppercase">KONU</p>
                {canEditIhbar ? ( <input className="w-full bg-black/50 border border-orange-500/30 p-4 rounded-2xl text-blue-400 outline-none font-black italic" value={editKonu} onChange={e => setEditKonu(e.target.value)} /> ) : ( <p className="text-lg text-blue-400 font-black italic">{ihbar.konu}</p> )}
              </div>

              <div className="mb-8">
                <p className="text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">AÇIKLAMA</p>
                <p className="text-gray-300 text-sm italic font-black">"{ihbar.aciklama}"</p>
              </div>
              
              {/* ⚙️ TEKNİK NESNE SEÇİMİ */}
              {(ihbar.durum === 'Calisiliyor' || isAdmin) && (
                <div className="bg-[#111318] p-6 rounded-3xl border border-blue-500/20 mb-8">
                  <p className="text-blue-400 text-[10px] mb-4 tracking-widest uppercase italic">⚙️ TEKNİK NESNE & VARLIK (ZORUNLU)</p>
                  {secilenNesne ? (
                    <div className="flex justify-between items-center bg-blue-600/10 p-5 rounded-2xl border border-blue-500/40">
                      <span className="text-xs font-black italic">{secilenNesne.nesne_adi} <span className="text-blue-400 ml-2">[{secilenNesne.ifs_kod}]</span></span>
                      {(!isJobFinished || isAdmin) && !ihbar.varis_tarihi && <button onClick={() => setSecilenNesne(null)} className="text-[8px] text-red-500 underline font-black uppercase italic">DEĞİŞTİR</button>}
                    </div>
                  ) : (
                    <div className="relative font-black italic">
                      <input disabled={isJobFinished && !isAdmin} type="text" placeholder="GÖREV İÇİN NESNE SEÇİN..." className="w-full p-4 bg-black/40 border border-orange-500/50 rounded-2xl text-[10px] font-black italic" value={nesneSearch} onChange={e => setNesneSearch(e.target.value)} />
                      {nesneSearch && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-2xl max-h-40 overflow-y-auto z-50 font-black">
                          {nesneListesi.filter(n => n.nesne_adi?.toLowerCase().includes(nesneSearch.toLowerCase())).map(n => ( 
                            <div key={n.id} onMouseDown={() => { setSecilenNesne({ nesne_adi: n.nesne_adi, ifs_kod: n.ifs_kod }); setNesneSearch(''); }} className="p-4 hover:bg-blue-600/20 cursor-pointer text-[10px] border-b border-gray-800 font-black italic">
                              {n.nesne_adi} [{n.ifs_kod}]
                            </div> 
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MALZEME KISMI */}
              {(ihbar.durum === 'Calisiliyor' || isJobFinished) && (
                <div className="pt-8 border-t border-gray-800 space-y-6">
                  <p className="text-orange-500 text-[10px] tracking-widest font-black uppercase italic">📦 MALZEME KULLANIMI</p>
                  {!isJobFinished && ihbar.varis_tarihi && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <input type="text" placeholder="MALZEME ARA..." className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] font-black italic uppercase" value={malzemeSearch} onChange={e=>setMalzemeSearch(e.target.value)} />
                        {malzemeKatalog.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-2xl max-h-60 overflow-y-auto z-[100] shadow-2xl font-black italic uppercase">
                            {malzemeKatalog.map(m => ( <div key={m.id} onMouseDown={()=>{setSecilenMalzeme(m); setMalzemeSearch(m.malzeme_adi); setMalzemeKatalog([]);}} className="p-4 hover:bg-orange-600/20 border-b border-gray-800 cursor-pointer text-[10px]">{m.malzeme_adi}</div> ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 font-black italic uppercase">
                        <input type="number" className="w-16 p-4 bg-black/40 border border-gray-700 rounded-2xl text-center font-black italic" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                        <button onClick={malzemeEkle} className="flex-1 bg-blue-600 rounded-2xl text-[10px] font-black uppercase italic shadow-lg active:scale-95 transition-all">EKLE</button>
                      </div>
                    </div>
                  )}
                  <div className="bg-black/20 p-4 rounded-2xl border border-gray-800 font-black italic uppercase">
                    {kullanilanlar.map((k, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] py-2 border-b border-gray-800/40 italic uppercase font-black">
                        <span>{k.malzeme_adi}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-orange-500 font-bold">{k.miktar || k.kullanim_adedi} {k.birim}</span>
                          {!isJobFinished && <button onClick={() => malzemeSil(k.id)} className="text-red-500 text-[8px] uppercase underline font-black italic">SİL</button>}
                        </div>
                      </div>
                    ))}
                    {kullanilanlar.length === 0 && <p className="text-[10px] text-gray-700 text-center py-4">MALZEME KULLANILMADI</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#111318] p-6 md:p-8 rounded-[2.5rem] border border-orange-500/20 shadow-2xl">
              
              {/* --- 🛡️ KİLİT EKRANI (ADIM 0) --- */}
              {isJobFinished && !isAdmin ? (
                <div className="p-6 rounded-[2rem] bg-green-500/10 border border-green-500/30 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in duration-500">
                  <div className="p-4 bg-green-500/20 rounded-full">
                    <LucideIcons.Lock size={40} className="text-green-500" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[14px] font-black uppercase italic text-green-400 tracking-tighter">BU KAYIT KAPATILMIŞTIR</span>
                    <p className="text-[9px] font-bold text-gray-500 uppercase leading-tight">İşlem başarıyla tamamlandığı için <br/> yetkisiz erişime kapatılmıştır.</p>
                  </div>
                  <div className="w-full h-px bg-green-500/20"></div>
                  <span className="text-[8px] text-gray-600 italic">SADECE ADMIN TARAFINDAN GERİ AÇILABİLİR</span>
                </div>
              ) : (
                <>
                  {ihbar.durum === 'Calisiliyor' ? (
                    <div className="space-y-6">
                      {!ihbar.varis_tarihi && (
                        <div className="space-y-2">
                           {!secilenNesne && (
                             <p className="text-[9px] text-red-500 text-center animate-pulse font-black italic uppercase bg-red-500/10 py-2 rounded-xl border border-red-500/20">⚠️ ÖNCE TEKNİK NESNE SEÇMELİSİNİZ!</p>
                           )}
                           <button 
                             onClick={arizaNoktasindayim} 
                             disabled={!secilenNesne || loading}
                             className={`w-full py-8 rounded-3xl text-sm font-black active:scale-95 transition-all border-b-4 uppercase italic shadow-xl
                               ${!secilenNesne ? 'bg-gray-800 border-gray-900 opacity-50 cursor-not-allowed text-gray-600' : 'bg-yellow-600 border-yellow-800 animate-bounce text-white'}`}
                           >
                             📍 ARIZA NOKTASINDAYIM
                           </button>
                        </div>
                      )}

                      {ihbar.varis_tarihi ? (
                        <div className="space-y-6">
                          <div className="bg-green-900/20 p-4 rounded-2xl border border-green-800/50 text-center font-black">
                            <p className="text-[10px] text-green-500 italic uppercase">VARIŞ MÜHÜRLENDİ ✅</p>
                          </div>
                          <p className="text-[10px] text-gray-500 text-center uppercase italic font-black">İŞLEM RAPORU</p>
                          <textarea className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[11px] outline-none font-black italic uppercase" rows={4} value={personelNotu} placeholder="NELER YAPILDI?..." onChange={e=>setPersonelNotu(e.target.value.toUpperCase())} />
                          <button onClick={() => isiKapatVeyaDurdur('Tamamlandi')} className="w-full bg-green-600 py-6 rounded-3xl text-xl active:scale-95 transition-all font-black italic uppercase shadow-xl border-b-4 border-green-800">🏁 İŞİ BİTİR</button>
                        </div>
                      ) : (
                        <p className="text-[8px] text-gray-600 text-center uppercase italic font-black">VARIŞ ONAYI YAPILMADAN İŞ BİTİRİLEMEZ</p>
                      )}
                      
                      <button onClick={() => isiKapatVeyaDurdur('Durduruldu')} className="w-full bg-red-900/40 text-red-500 py-3 rounded-2xl text-[10px] border border-red-900/50 font-black italic uppercase active:scale-95 transition-all">⚠️ İŞİ DURDUR</button>
                    </div>
                  ) : (
                    /* ADIM 1: İŞE BAŞLA (Geri açma dahil) */
                    <button onClick={isiBaslat} disabled={!canStartJob || loading} className={`w-full py-12 rounded-[3rem] text-3xl transition-all shadow-2xl font-black italic uppercase ${canStartJob || (isAdmin && isJobFinished) ? 'bg-orange-600 animate-pulse' : 'bg-gray-800 opacity-50'}`}>
                      {loading ? 'GPS...' : (isJobFinished && isAdmin ? '🔓 GERİ AÇ' : (canStartJob ? (isVardiyaHavuz ? '🚀 İŞİ ÜSTLEN' : '🚀 İŞE BAŞLA') : 'YETKİ YOK'))}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* KOORDİNASYON PANELİ */}
            {canEditAssignment && (
              <div className="bg-[#111318] p-6 md:p-8 rounded-[2.5rem] border-t-8 border-orange-600 space-y-4 shadow-2xl font-black uppercase italic">
                <p className="text-[10px] tracking-widest uppercase italic">KOORDİNASYON / ATAMA</p>
                <input disabled={isJobFinished && !isAdmin} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-orange-500 font-black italic" value={ifsNo} placeholder="IFS NO" onChange={e=>setIfsNo(e.target.value.toUpperCase())} />
                <select disabled={isJobFinished && !isAdmin} value={seciliGrup} onChange={e => { setSeciliGrup(e.target.value); setSeciliAtanan(''); }} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-white font-black italic">
                  <option value="">-- ATÖLYE SEÇ --</option>
                  {gruplar.map(g => <option key={g.id} value={g.id} className="bg-black">{g.grup_adi}</option>)}
                </select>
                <select disabled={isJobFinished && !isAdmin} value={seciliAtanan} onChange={e => { setSeciliAtanan(e.target.value); setSeciliGrup(''); }} className="w-full p-4 bg-black/40 border border-gray-700 rounded-2xl text-[10px] text-white font-black italic">
                  <option value="">-- ŞAHIS SEÇ --</option>
                  {personeller.map(p => <option key={p.id} value={p.id} className="bg-black">{p.full_name}</option>)}
                </select>
                <button onClick={bilgileriMuhurle} className="w-full bg-white text-black py-4 rounded-3xl text-[10px] font-black uppercase active:scale-95 italic">KAYDET</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}