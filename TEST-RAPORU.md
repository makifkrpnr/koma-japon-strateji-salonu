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
