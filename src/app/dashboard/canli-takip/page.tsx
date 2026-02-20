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
  const [map, setMap] = useState<any>(null);
  const { useMap } = require('react-leaflet');
  const leafletMap = useMap();
  
  useEffect(() => {
    if (leafletMap && center && center[0] && center[1]) {
      leafletMap.setView(center, 15, { animate: true });
    }
  }, [center, leafletMap]);
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

  useEffect(() => { import('leaflet').then(m => setL(m)); }, []);

  // 📡 CANLI KONUM TAKİBİ
  useEffect(() => {
    if (mod !== 'canli') {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      setOnlineUsers([]);
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

  // 🛰️ İŞLERİ GETİR (Mühürler Dahil)
  const veriGetir = useCallback(async () => {
    const durumlar = mod === 'tamamlandi' ? ['Tamamlandi'] : ['Islemde', 'Calisiliyor', 'Durduruldu', 'Beklemede'];
    const { data, error } = await supabase
      .from('ihbarlar')
      .select(`*, profiles:atanan_personel(full_name)`)
      .in('durum', durumlar);
    
    if (!error) setIsler(data || []);
  }, [mod]);

  useEffect(() => { veriGetir(); }, [veriGetir]);

  // 🎨 İKON OLUŞTURUCU (Güvenlikli)
  const createIcon = (type: 'ihbar' | 'personel' | 'muhur', color: string = '#f97316') => {
    if (!L) return undefined;
    return L.divIcon({
      html: `<div class="marker-container ${type === 'personel' ? 'radar' : ''}">
               <div class="main-dot" style="background:${color}"></div>
               ${type === 'personel' ? `<div class="pulse" style="border-color:${color}"></div>` : ''}
             </div>`,
      className: 'custom-marker',
      iconSize: [30, 30]
    });
  };

  // 🗺️ HARİTADA KONUMA GİT
  const go = (lat: any, lng: any) => {
    if (lat && lng) setMapCenter([parseFloat(lat), parseFloat(lng)]);
    else alert("KONUM VERİSİ EKSİK!");
  }

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-black italic uppercase overflow-hidden">
      {/* ÜST KOMUTA PANELİ */}
      <div className="p-4 bg-slate-900 border-b border-white/10 flex justify-between items-center z-[1000]">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-4 py-2 rounded-xl text-[10px]">← GERİ</button>
          <h1 className="text-sm">SAHA 360 // HİBRİT</h1>
        </div>
        
        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setMod('aktif')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'aktif' ? 'bg-blue-600' : 'text-gray-500'}`}>🛰️ AKTİF</button>
          <button onClick={() => setMod('tamamlandi')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'tamamlandi' ? 'bg-green-600' : 'text-gray-500'}`}>🏁 BİTEN</button>
          <button onClick={() => setMod('canli')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'canli' ? 'bg-orange-600' : 'text-gray-500'}`}>📡 CANLI</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LİSTE PANELİ */}
        <div className="w-full md:w-80 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 overflow-y-auto p-4 custom-scrollbar z-[500]">
          <div className="space-y-4">
            {(mod === 'canli' ? onlineUsers : isler).map((item) => (
              <div key={item.id} className="bg-slate-800/40 border border-white/5 p-4 rounded-[2rem] hover:border-orange-500 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-orange-500">{item.name || item.ihbar_veren_ad_soyad}</span>
                  <span className="text-[8px] text-gray-500">ID: {item.id}</span>
                </div>

                {/* MÜHÜR BUTONLARI (Sadece İş Modlarında) */}
                {mod !== 'canli' && (
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    <button onClick={() => go(item.enlem, item.boylam)} className="bg-blue-600/20 text-blue-400 p-2 rounded-lg text-[7px] hover:bg-blue-600 hover:text-white">1. BAŞLA</button>
                    <button onClick={() => go(item.varis_enlem, item.varis_boylam)} className="bg-yellow-600/20 text-yellow-400 p-2 rounded-lg text-[7px] hover:bg-yellow-600 hover:text-white">2. VARDI</button>
                    <button onClick={() => go(item.bitis_enlem, item.bitis_boylam)} className="bg-green-600/20 text-green-400 p-2 rounded-lg text-[7px] hover:bg-green-600 hover:text-white">3. BİTTİ</button>
                  </div>
                )}
                {mod === 'canli' && (
                  <button onClick={() => go(item.lat, item.lng)} className="w-full bg-orange-600 mt-2 p-2 rounded-lg text-[8px]">KONUMA GİT</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HARİTA */}
        <div className="flex-1 bg-slate-950 relative z-10">
          {L && (
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              
              {/* İhbarlar ve Mühür Noktaları */}
              {isler.map(is => (
                <div key={is.id}>
                  {is.enlem && <Marker position={[is.enlem, is.boylam]} icon={createIcon('ihbar', '#3b82f6')}><Popup><p className="text-black font-bold">BAŞLANGIÇ: {is.ihbar_veren_ad_soyad}</p></Popup></Marker>}
                  {is.varis_enlem && <Marker position={[is.varis_enlem, is.varis_boylam]} icon={createIcon('muhur', '#eab308')}><Popup><p className="text-black font-bold">VARIŞ MÜHÜRÜ</p></Popup></Marker>}
                  {is.bitis_enlem && <Marker position={[is.bitis_enlem, is.bitis_boylam]} icon={createIcon('muhur', '#22c55e')}><Popup><p className="text-black font-bold">BİTİŞ MÜHÜRÜ</p></Popup></Marker>}
                </div>
              ))}

              {/* Canlı Personel */}
              {mod === 'canli' && onlineUsers.map(u => (
                <Marker key={u.id} position={[u.lat, u.lng]} icon={createIcon('personel', '#f97316')}>
                  <Popup><p className="text-black font-bold">{u.name} (AKTİF)</p></Popup>
                </Marker>
              ))}
              
              <MapUpdater center={mapCenter} />
            </MapContainer>
          )}
        </div>
      </div>

      <style jsx global>{`
        .marker-container { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; }
        .main-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; }
        .radar .pulse { position: absolute; width: 30px; height: 30px; border: 2px solid; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  )
}
