# KOMA Test Raporu

## Otomatik motor testleri

- Shogi başlangıç taş sayısı
- Shogi başlangıç yasal hamle üretimi
- Piyonun doğru yönü ve mesafesi
- Nifu yasağı
- Son sıraya piyon bırakma yasağı
- Zorunlu terfi
- Kendi şahını açıkta bırakan hamlenin reddi
- Şah mat algılama
- Hasami başlangıç taş sayısı
- Kale tipi hareket
- Tekli yatay kıskaç
- Çoklu grup kıstırması
- Köşe yakalama
- Her iki oyunda AI’nın yasal hamle seçmesi

Sonuç: **14/14 geçti.**

## Çevrim içi duman testi

İki ayrı WebSocket istemcisi kullanıldı:

1. Oda oluşturuldu.
2. İkinci istemci altı haneli kodla katıldı.
3. Ev sahibi Shogi oyununu başlattı.
4. Sente bir piyon hamlesi yaptı.
5. İki istemcide tahta durumu ve sıra aynı doğrulandı.

Sonuç: **Oda ve senkronizasyon testi geçti.**

## Manuel kontrol önerileri

Render’a kurduktan sonra şu senaryoları birlikte deneyin:

- Shogi’de taş alma ve eldeki taşı bırakma
- Terfi seçimi penceresi
- Piyon bırakmada nifu uyarısı
- Hasami’de iki ve üç taşlık grup yakalama
- Mobilde dikey ve yatay ekran
- Bağlantıyı kısa süre kesip yeniden açma
- Render uyandıktan sonraki ilk oda kurulumu

## v1.1 ek kontroller

- Shogi Sente ve Gote taşlarının farklı CSS renk sınıfları üretildi.
- Mobil 390×844 görünümünde iki tarafın renkleri görsel olarak kontrol edildi.
- Arka plan oynatıcısında `loop=true`, ses düzeyi `0.28` ve ilk kullanıcı etkileşiminden sonra oynatma doğrulandı.
- Müzik düğmesinin açık/kapalı durumu ve ayar ekranındaki müzik seçeneği bağlandı.
- MP3 dosyası 120,58 saniye ve 160 kbps olarak doğrulandı.
- Sunucunun MP3 için `206 Partial Content` ve byte-range yanıtı verdiği doğrulandı.
- Service Worker önbellek sürümü `koma-v1.1.0` olarak güncellendi.
