# KOMA — Japon Strateji Salonu

Mobil tarayıcı öncelikli, ukiyo-e/tahta baskı estetiğinde hazırlanmış iki oyunlu web uygulaması:

- **Shogi (Japon satrancı)**
- **Hasami Shogi (standart 9 taşlı kıskaç sürümü)**

Her iki oyunda da:

- Yapay zekâya karşı oyun
- Aynı cihazda iki kişilik oyun
- Altı haneli oda koduyla uzaktan arkadaş maçı
- Dokunmatik mobil arayüz
- Animasyonlu “Nasıl Oynanır?” dersleri
- PWA / ana ekrana ekleme
- Türkçe menüler ve açıklamalar

## Oyun adı

Çalışma adı **KOMA**. Japonca `駒`, oyun taşı/piyon anlamında kullanılır. Marka adı koddan bağımsızdır; daha sonra değiştirilebilir.

## Kuralların kapsamı

### Shogi

Motor şu kuralları uygular:

- Standart 9×9 diziliş ve bütün taş hareketleri
- Taş alma ve alınan taşı elde yeniden kullanma
- Terfi bölgesi, isteğe bağlı ve zorunlu terfi
- Şah kontrolü ve şah mat
- Kendi şahını açıkta bırakan hamlelerin engellenmesi
- `Nifu`: aynı sütunda iki terfisiz piyon yasağı
- Hareket edemeyecek kareye Piyon/Mızrak/At bırakma yasağı
- Piyon bırakarak doğrudan mat etme yasağı (`uchifuzume`)
- Dört kez konum tekrarıyla beraberlik

Turnuvalarda kullanılan ayrıntılı **jishogi/impasse ilanı ve puan hesabı** bu ilk sürümde otomatik karara bağlanmaz. Bu çok nadir oyun sonu için sonraki sürümde ayrı “puan sayımı” aracı eklenebilir.

### Hasami Shogi

Hasami Shogi’nin farklı ev ve uygulama varyantları vardır. KOMA şu sürümü kullanır:

- 9×9 tahta
- Oyuncu başına 9 taş
- Taşlar kale gibi yatay/dikey hareket eder
- Yatay ve dikey tekli/gruplu kıskaç
- Özel köşe yakalama kuralı
- Rakibi bir veya sıfır taşa indiren oyuncu kazanır
- Kendi isteğiyle iki rakip taş arasına giren taş kendiliğinden alınmaz

## Yerelde çalıştırma

Node.js 18 veya daha yenisi yeterlidir. Dış paket yoktur.

```bash
npm start
```

Ardından:

```text
http://localhost:8080
```

Sağlık kontrolü:

```text
http://localhost:8080/health
```

## Testler

```bash
npm test
```

Motor testleri; başlangıç dizilişlerini, yasal hamle üretimini, nifu, ölü kare bırakma yasağını, zorunlu terfiyi, şah güvenliğini, şah matı, Hasami tekli/gruplu/köşe yakalamayı ve AI hamle geçerliliğini kontrol eder.

Çevrim içi sistem ayrıca iki gerçek WebSocket istemcisiyle oda kurma, kodla katılma, oyunu başlatma ve iki tarafta aynı durumun görünmesi şeklinde test edilmiştir.

## Render’a kurulum

Ayrıntılar: [`RENDER-KURULUM.md`](RENDER-KURULUM.md)

## Proje yapısı

```text
public/
  index.html
  styles.css
  js/
    app.js
    game-core.js
  assets/
  manifest.json
  sw.js
server.js
render.yaml
package.json
tests/
```

## Teknik mimari

- Oyun motoru, arayüzden bağımsız saf JavaScript durumları kullanır.
- Aynı `game-core.js` hem tarayıcı hem sunucu tarafından çalıştırılır.
- Online maçlarda hamleyi sunucu doğrular; iki tarayıcı ayrı ayrı sonuç uydurmaz.
- Oda durumu sunucu belleğinde tutulur ve 90 dakika hareketsizlikten sonra temizlenir.
- Dış çevrim içi bağımlılık yoktur; sistem Node.js’in HTTP katmanı ve tarayıcının yerleşik WebSocket API’siyle çalışır.

## Kural kaynakları

- Japan Shogi Association İngilizce tanıtım kitapçığı: `https://www.shogi.or.jp/event/english-pamphlet.pdf`
- Shogi kural özeti: `https://www.shogi.ricoh/rules/erules.html`
- Hasami Shogi standart 9×9 sürüm açıklaması: `https://www.igfip.com/hasamishogi/rules.html`

## Lisans notu

Kod, özgün arayüz ve özgün SVG/CSS süslemeleri bu proje için hazırlanmıştır. Uygulamada dışarıdan kopyalanmış logo, fotoğraf veya sanat eseri kullanılmaz.
