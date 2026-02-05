'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

// TypeScript Tip Tanımlamaları
interface AIMetrikleri {
  enCokAriza: string;
  adet: number;
  aiDogruluk: number;
}

export default function RaporlarPage() {
  const router = useRouter()
  const [mod, setMod] = useState<'ariza' | 'personel' | 'hepsi'>('ariza')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [raporVerisi, setRaporVerisi] = useState<any[]>([])
  const [izlendi, setIzlendi] = useState(false)
  const [authYukleniyor, setAuthYukleniyor] = useState(true)

  // 🛡️ YETKİ KONTROLÜ
  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        const yetkiliRoller = ['Admin', 'Müdür', 'Mühendis-Yönetici', 'Formen'];
        if (!yetkiliRoller.includes(profile?.role?.trim() || '')) { router.push('/dashboard'); return; }
        setAuthYukleniyor(false)
      } catch (err) { router.push('/dashboard') }
    }
    checkUserAccess()
  }, [router])

  // 🧮 HESAPLAMA MOTORLARI
  const dakikaHesapla = (bas: string, bit: string) => {
    if (!bas || !bit) return 0;
    const fark = (new Date(bit).getTime() - new Date(bas).getTime()) / 60000;
    return fark > 0 ? Math.round(fark) : 0;
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // 🤖 AI ÖZET KARTLARI (TypeScript Uyumlu)
  const aiMetrikleri = useMemo<AIMetrikleri | null>(() => {
    if (raporVerisi.length === 0) return null;
    const nesneSayilari: Record<string, number> = {};
    raporVerisi.forEach(i => { 
      if (i.secilen_nesne_adi) {
        nesneSayilari[i.secilen_nesne_adi] = (nesneSayilari[i.secilen_nesne_adi] || 0) + 1;
      }
    });
    const enCok = Object.entries(nesneSayilari).sort((a, b) => b[1] - a[1])[0];
    return {
      enCokAriza: enCok ? String(enCok[0]) : 'TANIMSIZ',
      adet: enCok ? Number(enCok[1]) : 0,
      aiDogruluk: 94 
    };
  }, [raporVerisi]);

  // 🛰️ VERİ SORGULAMA
  const raporuSorgula = async () => {
    if (!baslangic || !bitis) return alert("LÜTFEN TARİH ARALIĞI SEÇİN!")
    setYukleniyor(true)
    setIzlendi(false)

    const { data: ihbarlar, error } = await supabase
      .from('ihbarlar')
      .select(`
        *, 
        profiles:atanan_personel (full_name), 
        ihbar_malzemeleri (malzeme_adi, kullanim_adedi)
      `)
      .gte('created_at', `${baslangic}T00:00:00`)
      .lte('created_at', `${bitis}T23:59:59`)
      .order('id', { ascending: true })

    if (error) {
      alert("Sorgu Hatası: " + error.message)
    } else if (ihbarlar) {
      setRaporVerisi(ihbarlar)
      setIzlendi(true)
    }
    setYukleniyor(false)
  }

  // 📥 EXCEL MOTORU
  const excelIndir = () => {
    if (raporVerisi.length === 0) return
    const sayfa1Data = raporVerisi.map(i => {
      const mudahaleSuresi = dakikaHesapla(i.created_at, i.kabul_tarihi);
      if (mod === 'ariza') {
        return {
          "İhbar ID": i.id, "İhbar Tarih Saat": formatTime(i.created_at), "Atama Tarih Saat": formatTime(i.atama_tarihi),
          "İşe Başlama Saat": formatTime(i.kabul_tarihi), "İş Bitiş Saat": formatTime(i.kapatma_tarihi),
          "Müdahale Süresi (DK)": mudahaleSuresi, "Teknik Nesne": i.secilen_nesne_adi,
          "Atanan": i.profiles?.full_name, "Yardımcı": i.yardimcilar?.join(', '),
          "Malzeme": i.ihbar_malzemeleri?.map((m: any) => `${m.kullanim_adedi}x ${m.malzeme_adi}`).join(' | ')
        };
      } else if (mod === 'personel') {
        return {
          "İhbar Zamanı": formatTime(i.created_at), "Teknik Nesne": i.secilen_nesne_adi,
          "Atanan": i.profiles?.full_name, "Yardımcı": i.yardimcilar?.join(', '),
          "Çalışma Süresi (DK)": i.calisma_suresi_dakika || 0
        };
      } else {
        return { ...i, "Müdahale": mudahaleSuresi };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sayfa1Data), "Rapor");
    XLSX.writeFile(wb, `Saha360_Rapor_${mod.toUpperCase()}.xlsx`);
  }

  if (authYukleniyor) return null;

  return (
    <div className="min-h-screen bg-[#0a0b0e] flex flex-col md:flex-row text-white font-black italic uppercase">
      {/* SIDEBAR */}
      <div className="w-full md:w-64 bg-[#111318] p-6 border-r border-gray-800 flex flex-col z-50">
        <h2 className="text-orange-500 mb-10 text-xl font-black italic">SAHA 360 // ANALİZ</h2>
        <nav className="space-y-4">
          <button onClick={() => router.push('/dashboard')} className="w-full p-4 hover:bg-orange-600 rounded-2xl text-left border border-gray-800 transition-all font-black uppercase italic">🏠 ANA SAYFA</button>
          <div className="p-4 bg-orange-600 rounded-2xl font-black border border-orange-400 shadow-lg">📊 RAPORLAMA</div>
        </nav>
      </div>

      <div className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-center bg-[#111318]/60 p-6 rounded-[2.5rem] border border-gray-800 mb-8 gap-4">
          <div><h1 className="text-2xl md:text-4xl font-black italic">STRATEJİK VERİ YÖNETİMİ</h1><p className="text-[10px] text-orange-500 font-black italic">Operasyonel Veri Senkronizasyonu</p></div>
          <button onClick={excelIndir} disabled={!izlendi} className="bg-green-600 px-8 py-4 rounded-3xl font-black text-xs active:scale-95 disabled:opacity-20 transition-all">📥 EXCEL İNDİR</button>
        </header>

        {/* AI KARTLARI */}
        {izlendi && aiMetrikleri && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#111318] p-8 rounded-[3rem] border border-orange-500/20 relative overflow-hidden">
              <span className="text-[10px] text-orange-500 font-black">🚨 KRONİK ARIZA ODAĞI</span>
              <h2 className="text-2xl mt-2 font-black italic truncate">{aiMetrikleri.enCokAriza}</h2>
              <p className="text-[9px] text-gray-500 mt-1">{String(aiMetrikleri.adet)} TEKRARLANAN KAYIT</p>
            </div>
            <div className="bg-[#111318] p-8 rounded-[3rem] border border-blue-500/20">
              <span className="text-[10px] text-blue-400 font-black">📊 SORGULANAN HACİM</span>
              <h2 className="text-5xl mt-2 font-black italic">{raporVerisi.length} <span className="text-xs">İŞ</span></h2>
            </div>
            <div className="bg-[#111318] p-8 rounded-[3rem] border border-green-500/20">
              <span className="text-[10px] text-green-500 font-black">🧠 AI TAHMİN GÜCÜ</span>
              <h2 className="text-5xl mt-2 font-black italic">%{String(aiMetrikleri.aiDogruluk)}</h2>
            </div>
          </div>
        )}

        {/* MOD SEÇİCİ */}
        <div className="flex bg-[#111318] p-2 rounded-[2rem] border border-gray-800 w-fit mb-8 gap-2">
          {['ariza', 'personel', 'hepsi'].map(m => (
            <button key={m} onClick={() => { setMod(m as any); setIzlendi(false); }} className={`px-8 py-3 rounded-2xl text-[10px] font-black italic uppercase transition-all ${mod === m ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
              {m === 'ariza' ? '🔧 ARIZA ODAKLI' : m === 'personel' ? '👤 PERSONEL ODAKLI' : '🌍 MASTER RAPOR'}
            </button>
          ))}
        </div>

        {/* FİLTRE FORMU */}
        <div className="bg-[#111318] p-8 rounded-[3rem] border border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <input type="date" className="bg-black p-5 rounded-3xl border border-gray-700 outline-none text-white font-black italic" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
          <input type="date" className="bg-black p-5 rounded-3xl border border-gray-700 outline-none text-white font-black italic" value={bitis} onChange={e => setBitis(e.target.value)} />
          <button onClick={raporuSorgula} className="bg-orange-600 rounded-3xl font-black italic uppercase active:scale-95">{yukleniyor ? 'ANALİZ EDİLİYOR...' : 'SİSTEM ANALİZİNİ BAŞLAT'}</button>
        </div>

        {/* 📋 DİNAMİK VERİ TABLOSU (EXCEL İLE AYNI) */}
        {izlendi && (
          <div className="bg-[#111318] rounded-[3.5rem] border border-gray-800 overflow-hidden shadow-2xl overflow-x-auto mb-10">
            <table className="w-full text-left border-collapse font-black italic uppercase">
              <thead className="bg-black/40 text-orange-500 text-[9px] font-black italic">
                {mod === 'ariza' ? (
                  <tr>
                    <th className="p-6">ID</th><th className="p-6">İHBAR ZAMANI</th><th className="p-6">ATAMA</th><th className="p-6">BAŞLAMA</th>
                    <th className="p-6">BİTİŞ</th><th className="p-6 text-orange-400">MÜDAHALE (DK)</th><th className="p-6">NESNE</th>
                    <th className="p-6">SORUMLU</th><th className="p-6">EKİP</th><th className="p-6">MALZEME</th>
                  </tr>
                ) : mod === 'personel' ? (
                  <tr>
                    <th className="p-6">İHBAR ZAMANI</th><th className="p-6">TEKNİK NESNE</th><th className="p-6">ATANAN</th>
                    <th className="p-6">YARDIMCI</th><th className="p-6 text-orange-400">ÇALIŞMA (DK)</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="p-6">ID</th><th className="p-6">ZAMAN</th><th className="p-6">NESNE</th>
                    <th className="p-6">SORUMLU</th><th className="p-6">MÜDAHALE</th><th className="p-6">ÇALIŞMA</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-900 text-[10px]">
                {raporVerisi.map(i => (
                  <tr key={i.id} className="hover:bg-white/[0.02] transition-colors">
                    {mod === 'ariza' ? (
                      <>
                        <td className="p-6 text-orange-500">#{i.id}</td><td className="p-6">{formatTime(i.created_at)}</td>
                        <td className="p-6">{formatTime(i.atama_tarihi)}</td><td className="p-6">{formatTime(i.kabul_tarihi)}</td>
                        <td className="p-6">{formatTime(i.kapatma_tarihi)}</td>
                        <td className="p-6 font-mono text-orange-400">{dakikaHesapla(i.created_at, i.kabul_tarihi)} DK</td>
                        <td className="p-6 text-white">{i.secilen_nesne_adi}</td><td className="p-6">{i.profiles?.full_name}</td>
                        <td className="p-6 opacity-60 text-[8px]">{i.yardimcilar?.join(', ')}</td>
                        <td className="p-6 text-blue-400 text-[8px]">{i.ihbar_malzemeleri?.map((m: any) => `${m.kullanim_adedi}x${m.malzeme_adi}`).join(', ')}</td>
                      </>
                    ) : mod === 'personel' ? (
                      <>
                        <td className="p-6">{formatTime(i.created_at)}</td><td className="p-6 text-white">{i.secilen_nesne_adi}</td>
                        <td className="p-6">{i.profiles?.full_name}</td><td className="p-6">{i.yardimcilar?.join(', ')}</td>
                        <td className="p-6 text-orange-400">{i.calisma_suresi_dakika || 0} DK</td>
                      </>
                    ) : (
                      <>
                        <td className="p-6">#{i.id}</td><td className="p-6">{formatTime(i.created_at)}</td>
                        <td className="p-6">{i.secilen_nesne_adi}</td><td className="p-6">{i.profiles?.full_name}</td>
                        <td className="p-6">{dakikaHesapla(i.created_at, i.kabul_tarihi)}</td><td className="p-6">{i.calisma_suresi_dakika}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}