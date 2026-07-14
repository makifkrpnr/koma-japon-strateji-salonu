# KOMA’yı Render’a Kurma

Bu proje dış npm paketi kullanmadığı için önceki Socket.IO kurulum sorunları yaşanmaz.

## 1. GitHub deposu oluştur

1. GitHub’da **New repository** seç.
2. Örneğin `koma-game` adını ver.
3. ZIP’i bilgisayarında aç.
4. ZIP’in kendisini değil, açılan klasörün içindeki bütün dosyaları repoya yükle.
5. **Commit changes** seç.

Repo kökünde şunlar görünmelidir:

```text
package.json
render.yaml
server.js
public/
tests/
```

## 2. Render Blueprint oluştur

1. Render panelinde **New +** seç.
2. **Blueprint** seç.
3. GitHub hesabını ve `koma-game` reposunu bağla.
4. Render, kökteki `render.yaml` dosyasını bulur.
5. **Apply** seç.

Hazır ayarlar:

```yaml
buildCommand: echo "KOMA bağımlılıksız olarak hazırlandı"
startCommand: npm start
healthCheckPath: /health
region: frankfurt
plan: free
```

## 3. Deploy sonucunu kontrol et

Durum **Live** olduğunda Render’ın verdiği adresi aç:

```text
https://koma-japon-strateji-salonu-xxxx.onrender.com
```

Sağlık kontrolü:

```text
https://koma-japon-strateji-salonu-xxxx.onrender.com/health
```

Beklenen cevap:

```json
{"ok":true,"rooms":0,"clients":0,"game":"KOMA"}
```

## 4. Uzak arkadaşla test

1. İki kişi de aynı `onrender.com` bağlantısını açar.
2. İkiniz de aynı oyunun kartına girebilirsiniz; odaya katılan kişide odanın gerçek oyunu otomatik seçilir.
3. Birinci kişi **Arkadaşınla Oyna → Oda Oluştur** seçer.
4. Altı haneli kodu ikinci kişiye gönderir.
5. İkinci kişi **Arkadaşınla Oyna → Kodla Katıl** seçer.
6. Ev sahibi **Masayı Aç** düğmesine basar.

## Ücretsiz Render notu

Ücretsiz servis hareketsiz kaldığında uykuya geçebilir. İlk açılış bu nedenle daha uzun sürebilir. Sunucu yeniden başlarsa bellekteki açık odalar silinir; yeni kod oluşturmak yeterlidir.

## Güncelleme yayınlama

Dosyaları GitHub’a yükleyip Commit yaptığında Render otomatik deploy başlatır. Büyük değişiklikten sonra gerekirse:

```text
Manual Deploy → Clear build cache & deploy
```

Bu projede paket kurulumu olmadığı için normal **Deploy latest commit** de çoğu güncelleme için yeterlidir.
