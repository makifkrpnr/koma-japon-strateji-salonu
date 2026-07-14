# KOMA v1.1 — Shogi Renkleri ve Kesintisiz Müzik

## Değişenler

### Shogi taşları

- Sente taşları açık altın/ahşap, koyu lacivert yazılıdır.
- Gote taşları koyu indigo, açık krem yazılıdır.
- Gote taşları yön farkını korumak için 180 derece çevrilmeye devam eder.
- Terfi hâlleri ayrı renklerle vurgulanır.
- Elde bulunan taşlar da iki oyuncuya göre renklendirilir.

### Arka plan müziği

- `Traditional Japanese Theme` tüm ana menü, eğitim, Shogi ve Hasami Shogi ekranlarında aynı oynatıcıdan çalar.
- Ekran değiştirildiğinde baştan başlamaz.
- Parça bittiğinde otomatik olarak yeniden başlar.
- İlk dokunuştan sonra çalmaya başlar. Bu, Chrome/Safari mobil otomatik oynatma kuralıdır.
- Sağdaki nota düğmesiyle her an kapatılıp açılabilir.

## Mevcut Render kurulumunu güncelleme

1. Bu klasörün içindeki tüm dosyaları mevcut GitHub reposunun üzerine yükle.
2. `public/assets/audio/traditional-japanese-theme.mp3` dosyasının GitHub'a yüklendiğini kontrol et.
3. Commit yap.
4. Render otomatik deploy başlatmazsa:
   - **Manual Deploy**
   - **Deploy latest commit**
5. Eski görünüm önbellekte kalırsa bir kez:
   - **Manual Deploy → Clear build cache & deploy**
   - Telefonda siteyi kapatıp yeniden aç veya tarayıcı verisini yenile.

## Yerel test

```bash
npm test
npm start
```

Tarayıcı:

```text
http://localhost:8080
```

Shogi → Yapay Zekâ → Oyunu Başlat adımlarından sonra iki tarafın renkleri belirgin biçimde farklı görünmelidir. İlk dokunuştan sonra müzik çalmalı ve nota düğmesinde “Müzik Açık” yazmalıdır.
