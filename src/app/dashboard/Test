"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Bell, LogOut, Map, LayoutDashboard, 
  Settings, User, AlertCircle, Menu, ChevronRight
} from "lucide-react"; //
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export default function Dashboard({ userProfile }: { userProfile: any }) {
  const router = useRouter();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('panel');

  // 1. SES VE IŞIK İÇİN KANAL OLUŞTURMA (v10)
  useEffect(() => {
    const initNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        // v10 Kanalı: Hem ses çalar hem ekranı uyandırır
        await PushNotifications.createChannel({
          id: 'saha360_v10',
          name: 'Saha360 ACIL SES',
          description: 'Acil durum ihbar sesi ve ekran uyanması',
          sound: 'ihbar_sesi', // res/raw/ihbar_sesi.mp3
          importance: 5,       // Işığı yakan en yüksek seviye
          visibility: 1,      // Kilit ekranında göster
          vibration: true,
        });
      }
    };
    initNotifications();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      
      {/* --- SOL MENÜ (MINI SIDEBAR) --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-white/10 
        transform transition-all duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-20'}
      `}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10 overflow-hidden">
            <div className="min-w-[32px] w-8 h-8 bg-red-600 rounded flex items-center justify-center font-bold italic shadow-lg shadow-red-600/20">S</div>
            <span className={`font-black tracking-tighter text-xl italic transition-opacity ${!isSidebarOpen && 'md:opacity-0'}`}>SAHA 360</span>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem icon={<LayoutDashboard size={22} />} label="Panel" active={activeTab === 'panel'} onClick={() => setActiveTab('panel')} collapsed={!isSidebarOpen} />
            <NavItem icon={<Map size={22} />} label="Canlı Takip" active={activeTab === 'takip'} onClick={() => setActiveTab('takip')} collapsed={!isSidebarOpen} />
            <NavItem icon={<Bell size={22} />} label="İhbarlar" active={activeTab === 'ihbarlar'} onClick={() => setActiveTab('ihbarlar')} badge={5} collapsed={!isSidebarOpen} />
            <NavItem icon={<Settings size={22} />} label="Ayarlar" active={activeTab === 'ayarlar'} onClick={() => setActiveTab('ayarlar')} collapsed={!isSidebarOpen} />
          </nav>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
              <LogOut size={22} />
              <span className={`font-bold text-sm whitespace-now0-wrap ${!isSidebarOpen && 'md:hidden'}`}>Çıkış Yap</span>
            </button>
          </div>
        </div>
      </aside>

      {/* --- ANA İÇERİK --- */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* ÜST HEADER */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg">
              <Menu size={20} />
            </button>
            <h2 className="hidden sm:block text-sm font-medium text-gray-400 tracking-wide uppercase">
              {activeTab} <span className="text-white mx-2">/</span> <span className="text-white/40">Genel Bakış</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs font-bold">{userProfile?.full_name || 'Kullanıcı'}</span>
              <span className="text-[10px] text-red-500 font-black uppercase tracking-widest">{userProfile?.role}</span>
            </div>
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border border-white/10 select-none">
              <User size={20} className="text-gray-400" />
            </div>
          </div>
        </header>

        {/* İÇERİK SCROLL ALANI */}
        <section className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          
          {/* İSTATİSTİK KARTLARI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="SEÇİLİ İŞLER" value="293" color="border-orange-600" textColor="text-orange-600" />
            <StatCard label="MTTR (ORT. SÜRE)" value="492 DK" color="border-blue-600" textColor="text-blue-600" />
            <StatCard label="VERİMLİLİK" value="%88" color="border-green-600" textColor="text-green-600" />
            <StatCard label="DARBOĞAZ" value="KOLLEKTÖR" color="border-red-600" textColor="text-red-600" isText />
          </div>

          {/* İhbar Havuzu Başlığı */}
          <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6">
             <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <h3 className="text-yellow-500 font-bold tracking-widest text-xs uppercase">Havuzda Bekleyen İhbarlar (0)</h3>
             </div>
             
             {/* Boş Durum veya Liste */}
             <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                <AlertCircle size={48} strokeWidth={1} />
                <p className="mt-4 text-sm italic">Şu an bekleyen yeni ihbar bulunmuyor.</p>
             </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// --- YARDIMCI BİLEŞENLER ---

function NavItem({ icon, label, active, onClick, badge, collapsed }: any) {
  return (
    <div 
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group
        ${active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-white'}
      `}
    >
      <div className="min-w-[22px]">{icon}</div>
      <span className={`flex-1 font-bold text-sm transition-opacity duration-300 ${collapsed ? 'md:hidden' : 'block'}`}>{label}</span>
      {badge > 0 && !collapsed && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${active ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, color, textColor, isText = false }: any) {
  return (
    <div className={`bg-zinc-900/50 border-l-4 ${color} p-5 rounded-2xl transition-transform hover:scale-[1.02]`}>
      <p className="text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">{label}</p>
      <h4 className={`text-2xl md:text-3xl font-black italic tracking-tighter ${textColor} ${isText ? 'text-xl' : ''}`}>
        {value}
      </h4>
    </div>
  );
}
