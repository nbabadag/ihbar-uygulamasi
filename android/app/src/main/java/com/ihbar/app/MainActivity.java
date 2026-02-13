package com.ihbar.app;

import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        
        // 1. Önce WebView nesnesine ulaşıyoruz
        WebView webView = this.bridge.getWebView();
        
        // 2. Seslerin otomatik çalması için kilitleri açıyoruz
        // Personel ekrana dokunmasa bile bildirim sesi çalabilecek
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        
        // 3. Konum (GPS) motorunu aktif ediyoruz
        webView.getSettings().setGeolocationEnabled(true);
        
        // 4. İzin taleplerini yakalayıp sisteme iletiyoruz
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Konum izni penceresini zorla ekrana getirir
                callback.invoke(origin, true, false);
            }
        });
    }
}