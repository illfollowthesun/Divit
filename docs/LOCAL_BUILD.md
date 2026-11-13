# Yerel Windows teslimi — SIS-273, 14 Kasım 2026

Çalıştırılabilir uygulama: **`.tools/Divit-local/Divit.exe`**.
Bu dosyayı yanındaki beş `.mjs` dosyasıyla birlikte tutun. Arayüz release
exe'sine gömülüdür; Vite, npm veya geliştirme sunucusu başlatılmaz. Research,
yedekleme ve site yardımcı işlemleri mevcut Node.js kurulumunu kullanır.
Kurulum paketi değildir; mevcut kurulu Divit'in üzerine kurulmaz.

Uygulama kaynakları: `ca075d3a19623fe33c4454c0d095ae76d8a74a18`, sürüm
`0.1.0-beta.2`. Bu turda uygulama kaynakları değiştirilmedi; yeni native
doğrulama/yerel paketleme komutları ve teslim açıklaması eklendi.

## Yeniden hazırlama

```powershell
npm.cmd run tauri -- build --no-bundle
node scripts/package-local.mjs
```

Önce güncel kaynakları derleyin; paketleme komutu var olan release exe'sini
kopyalar. Runtime kaynaklarında commit edilmemiş fark varsa paketlemeyi
reddeder. Tauri yapılandırmasındaki kaynak betiklerini güncel yerel kaynaklardan
alır, kopyaları SHA-256 ile karşılaştırır ve `LOCAL_BUILD.json` bırakır.
Manifest derleme kaynak commit'ini, boyut ve dosya özetlerini içerir; release
exe'si tek başına eski yardımcı betiklerle karıştırılmamalıdır.

Bu teslimin exe SHA-256 değeri:
`090d7fe299122fd5ff0a8a574d653a5d2a7de90c14514c2ff032ecd125353d59`.
Altı dosyanın tamamı manifestte doğrulandı. Binary ve yerel test verileri git'e
eklenmedi; kaynaklar ve tekrar çalıştırma komutları commit edilir.

## Bu turdaki doğrulama

- **73/73 birim**, **26/26 ilgili UI** testi geçti. UI kapsamı: focus-recovery,
  companion, drawers, modes, themes, layout. Test beklentileri gevşetilmedi.
- `npm.cmd run tauri -- build --no-bundle`: optimize release başarılı. Mevcut
  turndown/chunk-size uyarıları sürüyor. Rust kaynağı değişmediği için ayrıca
  aynı Rust testleri tekrarlanmadı; bu turki Rust kontrolü gerçek release
  derlemesidir. Önceki 31 Rust testi SIS-268 kanıtıdır.
- `node scripts/check-native-focus.mjs`: gerçek Tauri debug exe + Vite, ayrı
  kitaplık/WebView profili; **1000/1180/1440 px × Write/Review/Normal**, Odak
  giriş/çıkış, Daktilo, Research, gerçek EN/TR worker, kayıt ve süreç yeniden
  açılışında metin/kayıt durumunun korunması geçti. Renderer hata/crash olayı,
  beklenmedik gezinme veya Vite reload kaydı yok. Kitaplık yolu native IPC ile
  doğrulanmadan test hiçbir yazı veya kapatma işlemi yapmaz.
- Native test komutu önce `cargo build --manifest-path src-tauri/Cargo.toml`
  ile hazırlanmış debug exe'sini gerektirir. Release exe test kitaplığı
  değişkenini yok saydığından bu komut release exe üzerinde yazı testi yapmaz.
- Ayrı release açılış kontrolü: gerçek `.tools/Divit-local/Divit.exe`, normal
  profil/kullanıcı kitaplığı, **1420 portu kapalı**, `http://tauri.localhost`
  arayüzü görünür, gerçek native IPC mevcut, Vite istemcisi/kaynağı yok.
  Kişisel metin/ayar içeriği alınmadı; açık kişisel oturum bulunmadığı için
  hiçbir kişisel oturum kapatılmadı. Release uygulama açık bırakıldı.

Yerel kanıtlar:

- `.tmp/sis-273/{unit,ui,native,release-build}.log`
- `.tmp/sis-273/release-smoke.json`
- `.tmp/native-focus-1d7c3141-d87f-401c-946b-e4fbbe2c3e8a/result.json`

## Beyaz ekranın durumu

Mevcut SIS-268/271 tanı kayıtlarında eski tamamen beyaz native ekranı açıklayan
bir React fatal, worker hatası veya renderer crash kaydı bulunmadı. Başlangıç
anındaki `rootChildren: 0`, React bağlanmadan önceki boot/page-show kaydıdır;
tek başına beyaz ekran kanıtı değildir. Eski soğuk Vite/nspell reload'u
ayrıca kanıtlanmış ve SIS-268'de giderilmiştir; native renderer çökmesinin
kesin açıklaması olarak sunulmaz.

Bu turdaki native akışta beyaz ekran tekrar etmedi. **Kesin kök neden hâlâ
kanıtlanmadı.** Yeni uygulama yaması, otomatik reload veya veri kaybettirebilecek
kurtarma eklenmedi. Kalan tek hata işi: tekrar oluşursa bounded yerel tanıyı
native renderer/WebView olaylarıyla aynı anda yakalamak. Gerçek native
arka plan yaşam döngüsüne ilişkin SIS-268 sınırı da sürer; bu tur minimize
görünürlüğünü yeniden test ederek başarı iddiası üretilmedi.
