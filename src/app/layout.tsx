"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react"; // useState eklendi
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core"; // Capacitor kontrolü eklendi
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const initNotifications = async () => {
      // 1. Web'de değil, sadece mobil cihazda (Android/iOS) çalışmasını sağla
      if (!Capacitor.isNativePlatform()) {
        console.log("💻 Tarayıcıda çalışıyor, kanal oluşturma atlandı.");
        return;
      }

      try {
        // 2. İzin iste (Bu pencere telefonda açılmalı!)
        const perm = await PushNotifications.requestPermissions();
        
        if (perm.receive === 'granted') {
          // 3. Kanalı silip (v2 ismiyle) tertemiz yeniden oluşturalım
          await PushNotifications.createChannel({
            id: 'saha360_channel_v2', // Çakışma olmaması için v2 yaptık
            name: 'Saha360 Acil Bildirimler',
            description: 'İhbar sesli bildirim kanalı',
            sound: 'ihbar_sesi', // raw klasöründeki dosya adı
            importance: 5, 
            visibility: 1,
            vibration: true,
          });
          console.log("✅ KANAL BAŞARIYLA OLUŞTURULDU: Ayarlara bakın.");
        }
      } catch (e) {
        console.error("❌ Bildirim Ayar Hatası:", e);
      }
    };

    initNotifications();
  }, []);

  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Next.js Hydration hatalarını önlemek için isClient kontrolü */}
        {isClient ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
      </body>
    </html>
  );
}