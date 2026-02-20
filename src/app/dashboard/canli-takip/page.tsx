'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

// Harita Bileşenleri
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

function MapUpdater({ center }: { center: [number, number] }) {
  const { useMap } = require('react-leaflet');
  const map = useMap();
  useEffect(() => { if (map && center) map.setView(center, map.getZoom(), { animate: true }); }, [center, map]);
  return null;
}

export default function HibritSahaPaneli() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [mod, setMod] = useState<'aktif' | 'tamamlandi' | 'canli'>('aktif')
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.73, 29.50])
  const [L, setL] = useState<any>(null)
  const channelRef = useRef<any>(null)

  // Leaflet yüklendiğinde ikonu hazırla
  useEffect(() => { import('leaflet').then(m => setL(m)); }, []);

  // 📡 CANLI KONUM TAKİBİ (Presence)
  useEffect(() => {
    if (mod !== 'canli') {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      return;
    }
    const channel = supabase.channel('online-sync', { config: { presence: { key: 'user' } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).flat().map((p: any) => ({ ...p, lastSeen: new Date().toLocaleTimeString('tr-TR') }));
      setOnlineUsers(users.filter((u: any) => u.lat && u.lng));
    }).subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [mod]);

  // 🛰️ İŞLERİ GETİR (Aktif veya Tamamlanan)
  const veriGetir = useCallback(async () => {
    const durumlar = mod === 'tamamlandi' ? ['Tamamlandi'] : ['Islemde', 'Calisiliyor', 'Durduruldu', 'Beklemede'];
    const { data } = await supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name)`).in('durum', durumlar);
    setIsler(data || []);
  }, [mod]);

  useEffect(() => { veriGetir(); const int = setInterval(veriGetir, 10000); return () => clearInterval(int); }, [veriGetir]);

  // 🎨 ÖZEL İKONLAR
  const createIcon = (type: 'ihbar' | 'personel', color: string = '#f97316') => {
    if (!L) return null;
    return L.divIcon({
      html: `<div class="marker-container ${type === 'personel' ? 'radar' : ''}">
               <div class="main-dot" style="background:${color}"></div>
               ${type === 'personel' ? `<div class="pulse" style="border-color:${color}"></div>` : ''}
             </div>`,
      className: 'custom-marker',
      iconSize: [30, 30]
    });
  };

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-black italic uppercase">
      {/* ÜST KOMUTA PANELİ */}
      <div className="p-4 bg-slate-900 border-b border-white/10 flex flex-wrap justify-between items-center gap-4 z-[1000]">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-4 py-2 rounded-xl text-[10px]">← GERİ</button>
          <h1 className="text-sm">SAHA 360 // HİBRİT MERKEZ</h1>
        </div>
        
        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setMod('aktif')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'aktif' ? 'bg-blue-600' : 'text-gray-500'}`}>🛰️ AKTİF</button>
          <button onClick={() => setMod('tamamlandi')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'tamamlandi' ? 'bg-green-600' : 'text-gray-500'}`}>🏁 BİTEN</button>
          <button onClick={() => setMod('canli')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'canli' ? 'bg-orange-600' : 'text-gray-500'}`}>📡 CANLI KONUM</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LİSTE PANELİ */}
        <div className="w-full md:w-80 bg-slate-900/50 backdrop-blur-xl border-r border-white/5 overflow-y-auto p-4 custom-scrollbar z-20">
          <p className="text-[9px] text-gray-500 mb-4 tracking-widest">{mod === 'canli' ? 'SAHADAKİ EKİPLER' : 'OPERASYON LİSTESİ'}</p>
          <div className="space-y-3">
            {mod === 'canli' ? onlineUsers.map(u => (
              <div key={u.id} onClick={() => setMapCenter([u.lat, u.lng])} className="bg-orange-950/20 border border-orange-500/30 p-4 rounded-3xl cursor-pointer">
                <p className="text-xs text-orange-500">{u.name}</p>
                <p className="text-[8px] text-gray-400">{u.role} - SON: {u.lastSeen}</p>
              </div>
            )) : isler.map(is => (
              <div key={is.id} onClick={() => setMapCenter([is.enlem, is.boylam])} className="bg-slate-800/40 border border-white/5 p-4 rounded-3xl cursor-pointer hover:border-blue-500 transition-all">
                <p className="text-xs text-blue-400">{is.ihbar_veren_ad_soyad}</p>
                <p className="text-[9px] text-gray-500 truncate">{is.konu}</p>
              </div>
            ))}
          </div>
        </div>

        {/* HARİTA */}
        <div className="flex-1 bg-slate-950 relative z-10">
          {L && (
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              
              {/* İŞ PİNLERİ */}
              {isler.map(is => (
                <Marker key={is.id} position={[is.enlem, is.boylam]} icon={createIcon('ihbar', is.durum === 'Tamamlandi' ? '#22c55e' : '#3b82f6')}>
                  <Popup><div className="text-black text-[10px] font-bold">{is.ihbar_veren_ad_soyad}<br/>{is.durum}</div></Popup>
                </Marker>
              ))}

              {/* CANLI PERSONEL PİNLERİ */}
              {mod === 'canli' && onlineUsers.map(u => (
                <Marker key={u.id} position={[u.lat, u.lng]} icon={createIcon('personel', '#f97316')}>
                  <Popup><div className="text-black text-[10px] font-bold">{u.name} (SAHADA)</div></Popup>
                </Marker>
              ))}
              
              <MapUpdater center={mapCenter} />
            </MapContainer>
          )}
        </div>
      </div>

      <style jsx global>{`
        .marker-container { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; }
        .main-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .radar .pulse { position: absolute; width: 30px; height: 30px; border: 2px solid; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
      `}</style>
    </div>
  )
}
