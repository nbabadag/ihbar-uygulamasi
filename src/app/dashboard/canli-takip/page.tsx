'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

function MapUpdater({ center }: { center: [number, number] }) {
  const { useMap } = require('react-leaflet');
  const map = useMap();
  useEffect(() => {
    if (map && center && center[0] !== 39.9334) {
      map.setView(center, 17, { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function HibritKomutaMerkezi() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [filteredIsler, setFilteredIsler] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [mod, setMod] = useState<'aktif' | 'tamamlandi' | 'canli'>('aktif')
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.9334, 32.8597])
  const [L, setL] = useState<any>(null)

  // 🔍 Filtre State'leri
  const [filterDate, setFilterDate] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [filterObject, setFilterObject] = useState('')

  useEffect(() => { import('leaflet').then(m => setL(m)); }, []);

  // 📡 Canlı Konum
  useEffect(() => {
    const channel = supabase.channel('online-sync', { config: { presence: { key: 'user' } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).flat().map((p: any) => ({ ...p, lastSeen: new Date().toLocaleTimeString('tr-TR') }));
      setOnlineUsers(users.filter((u: any) => u.lat && u.lng));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // 🛰️ Veri Çekme
  const veriGetir = useCallback(async () => {
    const durumlar = mod === 'tamamlandi' ? ['Tamamlandi'] : ['Islemde', 'Calisiliyor', 'Durduruldu', 'Beklemede'];
    const { data } = await supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name)`).in('durum', durumlar).order('created_at', { ascending: false });
    setIsler(data || []);
    setFilteredIsler(data || []);
  }, [mod]);

  useEffect(() => { veriGetir(); }, [veriGetir]);

  // ⚙️ Filtreleme Mantığı
  useEffect(() => {
    let result = isler;

    if (filterDate) {
      result = result.filter(is => is.created_at.includes(filterDate));
    }
    if (filterStaff) {
      result = result.filter(is => is.profiles?.full_name?.toLowerCase().includes(filterStaff.toLowerCase()));
    }
    if (filterObject) {
      result = result.filter(is => is.konu?.toLowerCase().includes(filterObject.toLowerCase()));
    }

    setFilteredIsler(result);
  }, [filterDate, filterStaff, filterObject, isler]);

  const createIcon = (color: string, isRadar: boolean = false) => {
    if (!L) return undefined;
    return L.divIcon({
      html: `<div class="marker-box ${isRadar ? 'radar' : ''}">
               <div class="dot" style="background:${color}; box-shadow: 0 0 10px ${color}"></div>
               ${isRadar ? `<div class="pulse" style="border-color:${color}"></div>` : ''}
             </div>`,
      className: 'custom-marker',
      iconSize: [25, 25]
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0b0e] text-white font-black italic uppercase overflow-hidden">
      {/* ÜST PANEL */}
      <div className="p-4 bg-[#111318] border-b border-gray-800 flex justify-between items-center z-[1000]">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 border border-white/5 rounded-xl hover:bg-orange-600 text-[10px]">← GERİ</button>
          <h1 className="text-sm">SEFİNE 360 // <span className="text-orange-500">KOMUTA MERKEZİ</span></h1>
        </div>
        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
          {['aktif', 'tamamlandi', 'canli'].map((m: any) => (
            <button key={m} onClick={() => {setMod(m); setSelectedJob(null);}} className={`px-6 py-1.5 rounded-xl text-[9px] ${mod === m ? 'bg-orange-600 shadow-lg' : 'text-gray-500'}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* SOL LİSTE VE FİLTRELER */}
        <div className="w-full md:w-96 bg-[#111318]/98 border-r border-gray-800 flex flex-col z-[500] shadow-2xl">
          
          {/* 🔍 FİLTRE PANELİ (Sadece İş Modlarında Görünür) */}
          {mod !== 'canli' && (
            <div className="p-4 bg-black/20 border-b border-gray-800 space-y-2">
              <p className="text-[8px] text-gray-500 tracking-widest mb-2">ARAMA FİLTRELERİ</p>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full bg-gray-900 border border-white/5 p-2 rounded-lg text-[10px] text-orange-500 focus:outline-none focus:border-orange-500" />
              <input type="text" placeholder="PERSONEL ADI..." value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="w-full bg-gray-900 border border-white/5 p-2 rounded-lg text-[10px] focus:outline-none" />
              <input type="text" placeholder="NESNE / KONU..." value={filterObject} onChange={(e) => setFilterObject(e.target.value)} className="w-full bg-gray-900 border border-white/5 p-2 rounded-lg text-[10px] focus:outline-none" />
              {(filterDate || filterStaff || filterObject) && (
                <button onClick={() => {setFilterDate(''); setFilterStaff(''); setFilterObject('');}} className="w-full text-[8px] text-red-500 pt-1 hover:underline">FİLTRELERİ TEMİZLE</button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {mod === 'canli' ? (
              onlineUsers.map(u => (
                <div key={u.id} onClick={() => setMapCenter([u.lat, u.lng])} className="bg-[#1a1c23] p-4 rounded-3xl border border-orange-500/20 cursor-pointer">
                  <p className="text-xs font-bold text-orange-500">{u.name}</p>
                  <p className="text-[8px] text-gray-500">{u.role} - SON: {u.lastSeen}</p>
                </div>
              ))
            ) : (
              filteredIsler.map(is => (
                <div key={is.id} onClick={() => { setSelectedJob(is); if(is.enlem) setMapCenter([is.enlem, is.boylam]); }} className={`p-5 rounded-[2rem] border transition-all cursor-pointer ${selectedJob?.id === is.id ? 'bg-orange-600/20 border-orange-500 shadow-inner' : 'bg-[#1a1c23] border-white/5 hover:border-white/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] text-blue-400 leading-tight w-2/3">{is.ihbar_veren_ad_soyad}</p>
                    <p className="text-[8px] text-gray-600 italic">{new Date(is.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <p className="text-[9px] text-gray-500 mb-3 truncate">"{is.konu}"</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded-xl text-center text-[7px] border ${is.enlem ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-red-900/40 border-red-500/30 text-red-500'}`}>{is.enlem ? '🚀 BAŞLA' : '❌ YOK'}</div>
                    <div className={`p-2 rounded-xl text-center text-[7px] border ${is.varis_enlem ? 'bg-yellow-600/10 border-yellow-500/30 text-yellow-400' : 'bg-red-900/40 border-red-500/30 text-red-500'}`}>{is.varis_enlem ? '📍 VARDI' : '❌ YOK'}</div>
                    <div className={`p-2 rounded-xl text-center text-[7px] border ${is.bitis_enlem ? 'bg-green-600/10 border-green-500/30 text-green-400' : 'bg-red-900/40 border-red-500/30 text-red-500'}`}>{is.bitis_enlem ? '🏁 BİTTİ' : '❌ YOK'}</div>
                  </div>
                  <p className="text-[8px] text-gray-400 mt-3 text-right">👤 {is.profiles?.full_name || 'BELİRSİZ'}</p>
                </div>
              ))
            )}
            {filteredIsler.length === 0 && <p className="text-center text-[10px] text-gray-600 pt-10">ARANAN KRİTERDE KAYIT BULUNAMADI.</p>}
          </div>
        </div>

        {/* HARİTA */}
        <div className="flex-1 relative z-10 bg-[#0d0f14]">
          {L && (
            <MapContainer center={mapCenter} zoom={13} zoomControl={false} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              
              {selectedJob && (
                <>
                  {selectedJob.enlem ? (
                    <Marker position={[selectedJob.enlem, selectedJob.boylam]} icon={createIcon('#3b82f6')}>
                      <Popup><div className="text-black text-[10px] font-bold">🚀 BAŞLANGIÇ<br/>{selectedJob.konu}</div></Popup>
                    </Marker>
                  ) : null}
                  {selectedJob.varis_enlem ? (
                    <Marker position={[selectedJob.varis_enlem, selectedJob.varis_boylam]} icon={createIcon('#eab308')}>
                      <Popup><div className="text-black text-[10px] font-bold">📍 VARIŞ MÜHÜRÜ<br/>{selectedJob.profiles?.full_name}</div></Popup>
                    </Marker>
                  ) : null}
                  {selectedJob.bitis_enlem ? (
                    <Marker position={[selectedJob.bitis_enlem, selectedJob.bitis_boylam]} icon={createIcon('#22c55e')}>
                      <Popup><div className="text-black text-[10px] font-bold">🏁 BİTİŞ MÜHÜRÜ<br/>{new Date(selectedJob.updated_at).toLocaleTimeString('tr-TR')}</div></Popup>
                    </Marker>
                  ) : null}
                </>
              )}

              {mod === 'canli' && onlineUsers.map(u => (
                <Marker key={u.id} position={[u.lat, u.lng]} icon={createIcon('#f97316', true)}>
                  <Popup><div className="text-black text-[10px] font-bold">{u.name} (SAHADA)</div></Popup>
                </Marker>
              ))}
              
              <MapUpdater center={mapCenter} />
            </MapContainer>
          )}
        </div>
      </div>

      <style jsx global>{`
        .marker-box { position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; z-index: 2; }
        .radar .pulse { position: absolute; width: 100%; height: 100%; border: 2px solid; border-radius: 50%; animation: radar-pulse 2s infinite; opacity: 0; }
        @keyframes radar-pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3.5); opacity: 0; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
