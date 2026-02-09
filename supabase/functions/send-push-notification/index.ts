import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as djwt from "https://deno.land/x/djwt@v3.0.1/mod.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record } = payload
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Durum Analizi: İptal mi yoksa Yeni Atama mı?
    const mesajAlt = record.mesaj?.toLowerCase() || "";
    const isCancelOrWithdraw = mesajAlt.includes("iptal") || mesajAlt.includes("geri") || mesajAlt.includes("alındı");

    // 2. Hedefleri Ayrıştır
    const rawList = record.hedef_roller || []
    const targetIds = rawList.filter((item: string) => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)
    )
    const targetRoles = rawList.filter((item: string) => 
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)
    )

    // Geri çekmede rollere değil, sadece kişiye gider
    const finalRoles = isCancelOrWithdraw ? [] : targetRoles;

    // 3. Tokenları Çek
    let query = supabase.from('profiles').select('fcm_token').not('fcm_token', 'is', null)
    const conditions = []
    if (targetIds.length > 0) conditions.push(`id.in.(${targetIds.join(',')})`)
    if (finalRoles.length > 0) conditions.push(`role.in.(${finalRoles.join(',')})`)

    if (conditions.length > 0) {
      query = query.or(conditions.join(','))
    } else {
      return new Response("Hedef yok", { status: 200 })
    }

    const { data: profiles } = await query
    if (!profiles || profiles.length === 0) return new Response("Cihaz yok", { status: 200 })

    // 4. Google Auth & Firebase Gönderim
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
    const privateKeyRaw = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n')
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!

    const pemContents = privateKeyRaw.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "")
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    const key = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"])

    const jwt = await djwt.create({ alg: "RS256", typ: "JWT" }, {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: djwt.getNumericDate(3600),
      iat: djwt.getNumericDate(0),
    }, key)

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    })
    const { access_token } = await tokenRes.json()

    // 5. Bildirim İçeriği ve Başlık Ayarı
    const bildirimBasligi = isCancelOrWithdraw ? "Saha360 🚨 İş Geri Çekildi" : "Saha360 🚨 Yeni İş Emri";
    const bildirimIcerigi = isCancelOrWithdraw 
      ? record.mesaj 
      : `Konu: ${record.gorev_konusu || 'Yeni Görev'}\n${record.gorev_aciklamasi || ''}`;

    const results = await Promise.all(profiles.map(async (p) => {
      await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({
          message: {
            token: p.fcm_token,
            notification: { 
              title: bildirimBasligi, 
              body: bildirimIcerigi 
            },
            data: {
              ihbar_id: record.ihbar_id?.toString() || "",
              bildirim_tipi: isCancelOrWithdraw ? "iptal" : "yeni",
            },
            android: { 
              priority: "high", 
              notification: { 
                sound: "ihbar_sesi", // BURASI ÖNEMLİ: res/raw içindeki dosya adı
                channel_id: "saha360_channel" // layout.tsx içindeki kanal adı ile aynı olmalı
              } 
            },
            apns: { payload: { aps: { sound: "ihbar_sesi.caf" } } }
          },
        }),
      })
    }))

    return new Response(JSON.stringify({ success: true }))

  } catch (err) {
    return new Response(err.message, { status: 500 })
  }
})