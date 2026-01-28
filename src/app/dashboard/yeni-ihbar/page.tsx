'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function YeniIhbar() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Veri State'leri
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])

  // Form State'leri
  const [ihbarVeren, setIhbarVeren] = useState('')
  const [telefon, setTelefon] = useState('')
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [atamaTuru, setAtamaTuru] = useState<'personel' | 'grup'>('personel')
  const [seciliAtanan, setSeciliAtanan] = useState('')

  useEffect(() => {
    fetchAtamaListesi()
  }, [])

  const fetchAtamaListesi = async () => {
    const { data: pData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['Formen', 'Mühendis', 'Saha Personeli'])
      .eq('is_active', true)
      .order('full_name')

    const { data: gData } = await supabase
      .from('calisma_gruplari')
      .select('id, grup_adi')
      .order('grup_adi')

    setPersoneller(pData || [])
    setGruplar(gData || [])
  }

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Telefon numarası kontrolü
    if (!telefon.startsWith('0') || telefon.length !== 11) {
      alert('Lütfen telefon numarasını 0 ile başlayacak şekilde 11 hane olarak giriniz.');
      return;
    }

    setLoading(true)
    
    // 1. İhbarı Kaydet
    const { data: yeniIhbar, error: ihbarError } = await supabase.from('ihbarlar').insert([
      { 
        musteri_adi: ihbarVeren, 
        ihbar_veren_tel: telefon, 
        konu: konu, 
        aciklama: aciklama,
        ifs_is_emri_no: ifsNo,
        durum: 'Beklemede',
        atanan_personel: atamaTuru === 'personel' ? (seciliAtanan || null) : null,
        atanan_grup_id: atamaTuru === 'grup' ? (seciliAtanan || null) : null
      }
    ]).select().single()
    
    if (ihbarError) {
      alert('Hata: ' + ihbarError.message)
      setLoading(false)
      return;
    }

    // --- 🔔 BİLDİRİM TETİKLEYİCİ MANTIK (YENİ EKLENDİ) ---
    try {
      const simdi = new Date();
      const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const toplamDakika = turkiyeZamani.getHours() * 60 + turkiyeZamani.getMinutes();
      const isMesaiSaatleri = toplamDakika >= 480 && toplamDakika <= 1020; // 08:00 - 17:00

      // Bildirim ayarlarını Admin panelinden çek
      const { data: settings } = await supabase.from('notification_settings').select('*');
      
      const insertBildirim = async (eventType: string, mesaj: string) => {
        const setting = settings?.find(s => s.event_type === eventType);
        if (setting && setting.target_roles?.length > 0) {
          await supabase.from('bildirimler').insert([{
            ihbar_id: yeniIhbar.id,
            mesaj: mesaj,
            heget_roller: setting.target_roles,
            is_read: false
          }]);
        }
      };

      // Senaryo 1: Genel Havuz Bildirimi
      await insertBildirim('havuz_ihbar', `YENİ İHBAR: ${ihbarVeren} - ${konu}`);

      // Senaryo 2: Kişiye Özel Atama Bildirimi
      if (seciliAtanan) {
        await insertBildirim('ihbar_atandi', `SİZE BİR İŞ ATANDI: ${konu}`);
      }

      // Senaryo 3: Mesai Saati Dışı Bildirimi
      if (!isMesaiSaatleri) {
        await insertBildirim('mesai_disi_ihbar', `🔴 MESAİ DIŞI KAYIT: ${ihbarVeren}`);
      }

    } catch (err) {
      console.error("Bildirim gönderilemedi:", err);
    }
    // --- 🔔 BİLDİRİM TETİKLEYİCİ SONU ---

    alert('İhbar başarıyla kaydedildi! Personel işi başlattığında konum alınacaktır.')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* 🖼️ TAM SAYFA KURUMSAL ARKA PLAN (MÜHÜR) */}
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

      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full relative z-10 space-y-6">
        
        {/* 🏛️ ÜST BAR VE GERİ BUTONU */}
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95"
          >
            <span className="text-sm">←</span> GERİ DÖN
          </button>
          <div className="text-[10px] bg-orange-600/10 text-orange-500 border border-orange-500/20 px-4 py-2 rounded-full font-black uppercase italic tracking-widest drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]">
            Saha 360 // Yeni Kayıt
          </div>
        </div>
        
        {/* ANA FORM KARTI */}
        <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 md:p-10 rounded-[3rem] shadow-2xl border border-gray-800/50">
          <div className="mb-8 border-b border-gray-800 pb-6">
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
              <span className="text-orange-500">📢</span> İhbar Girişi
            </h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-2 italic tracking-widest">Lütfen arıza veya operasyon detaylarını eksiksiz doldurun.</p>
          </div>
          
          <form onSubmit={kaydet} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-4 italic tracking-[0.2em]">İhbar Veren Kişi</label>
                <input required placeholder="Ad Soyad" className="w-full bg-black/40 border border-gray-700 p-4 rounded-2xl font-bold text-sm text-white outline-none focus:border-orange-500 transition-all shadow-inner" value={ihbarVeren} onChange={e => setIhbarVeren(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-4 italic tracking-[0.2em]">İrtibat No</label>
                <input required type="tel" maxLength={11} placeholder="05xx xxx xx xx" className="w-full bg-orange-600/5 border border-orange-500/20 p-4 rounded-2xl font-bold text-sm text-orange-500 outline-none focus:border-orange-500 transition-all shadow-inner" value={telefon} onChange={e => setTelefon(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-4 italic tracking-[0.2em]">IFS İş Emri No</label>
                <input placeholder="Örn: 2024-001" className="w-full bg-blue-600/5 border border-blue-500/20 p-4 rounded-2xl font-bold text-sm text-blue-400 outline-none focus:border-blue-500 transition-all shadow-inner" value={ifsNo} onChange={e => setIfsNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-4 italic tracking-[0.2em]">İhbar Konusu</label>
                <input required placeholder="Arıza Konusu" className="w-full bg-black/40 border border-gray-700 p-4 rounded-2xl font-bold text-sm text-white outline-none focus:border-orange-500 transition-all shadow-inner" value={konu} onChange={e => setKonu(e.target.value)} />
              </div>
            </div>

            <div className="bg-black/30 p-6 rounded-[2.5rem] border border-gray-800 shadow-inner space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest italic">🎯 Görev Ataması</label>
                <div className="flex bg-black/40 rounded-xl p-1 border border-gray-800">
                  <button type="button" onClick={() => setAtamaTuru('personel')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${atamaTuru === 'personel' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}>Kişi</button>
                  <button type="button" onClick={() => setAtamaTuru('grup')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${atamaTuru === 'grup' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Grup</button>
                </div>
              </div>
              <select className="w-full p-4 bg-gray-900 border border-gray-700 rounded-2xl font-black text-[11px] uppercase outline-none text-white focus:border-white transition-all appearance-none cursor-pointer" value={seciliAtanan} onChange={e => setSeciliAtanan(e.target.value)}>
                <option value="">{atamaTuru === 'personel' ? '👤 Personel Seçin...' : '👥 Grup Seçin...'}</option>
                {atamaTuru === 'personel' 
                  ? personeller.map(p => <option key={p.id} value={p.id} className="bg-[#1a1c23]">{p.full_name} // {p.role}</option>)
                  : gruplar.map(g => <option key={g.id} value={g.id} className="bg-[#1a1c23]">{g.grup_adi}</option>)
                }
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-4 italic tracking-[0.2em]">Açıklama & Notlar</label>
              <textarea required placeholder="Detayları buraya teknik olarak not edin..." className="w-full bg-black/40 border border-gray-700 p-5 rounded-[2rem] font-medium text-sm text-gray-200 h-36 outline-none focus:border-orange-500 transition-all shadow-inner leading-relaxed" value={aciklama} onChange={e => setAciklama(e.target.value)} />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-6 rounded-3xl shadow-2xl active:scale-[0.98] disabled:bg-gray-800 disabled:text-gray-600 uppercase italic tracking-tighter text-xl transition-all shadow-orange-900/30 border-b-4 border-orange-800"
            >
              {loading ? 'KAYIT İŞLENİYOR...' : 'Kaydı Sisteme İşle ve Gönder 🚀'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}