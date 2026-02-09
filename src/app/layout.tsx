"use client"; // Capacitor işlemleri için bu dosyanın istemci tarafında çalışması gerekir

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { useEffect } from "react"; // 1. Yeni eklendi
import { PushNotifications } from "@capacitor/push-notifications"; // 2. Yeni eklendi
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// NOT: 'use client' kullandığımız için Metadata'yı buradan çıkarıp ayrı bir dosyaya 
// veya alt bileşene koymak gerekebilir ama basitlik için şimdilik tutuyoruz.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // 3. ADIM: Uygulama ilk açıldığında bildirim kanalını kaydeden efekt
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Android için özel ses kanalını oluşturuyoruz
        await PushNotifications.createChannel({
          id: 'saha360_channel', // Edge Function'daki isimle aynı
          name: 'Saha360 Bildirimleri',
          description: 'Yeni iş emri bildirimleri için özel ses',
          sound: 'ihbar_sesi', // res/raw klasöründeki dosya adı (uzantısız)
          importance: 5, // En yüksek ses seviyesi
          visibility: 1,
          vibration: true,
        });
        console.log("Bildirim kanalı başarıyla oluşturuldu.");
      } catch (error) {
        console.error("Bildirim kanalı oluşturulurken hata:", error);
      }
    };

    setupNotifications();
  }, []);

  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}