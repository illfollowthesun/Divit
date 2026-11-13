# Odak / beyaz ekran — SIS-268 (13 Kasım 2026)

14 Kasım SIS-273 devamı: yeni native matris geçti; beyaz ekran tekrarlanmadı,
varsayımsal uygulama yaması yapılmadı. Sunucusuz yerel release ve güncel kanıtlar
için [LOCAL_BUILD.md](LOCAL_BUILD.md) dosyasına bakın.

## Kanıt ve sınır

- Başlangıç: `ui/focus-companion`, `392965d`, temiz çalışma ağacı, `0.1.0-beta.2`.
- Boş Vite önbelleği + izole tarayıcı: yeni yazı → kaydet → Ctrl+. → Ctrl+2 (Review).
  Worker ilk kez `nspell` istedi; Vite `new dependencies optimized: nspell` ve
  `optimized dependencies changed. reloading` yazdı. Ana sayfa iki kez yüklendi.
  React hatası yakalanmadı, kök ve editör yeniden geldi. **Eski tamamen beyaz
  native ekranın kök nedeni bu denemeyle kanıtlanmış değildir.**
- `optimizeDeps.include: ['nspell']` ile aynı soğuk başlangıçta iki sözlük
  tamamlandı, ana sayfa yalnız bir kez yüklendi ve yazı korundu. Vite 7'nin
  [bağımlılık optimizasyonu](https://v7.vite.dev/config/dep-optimization-options)
  bu başlangıç hazırlığını destekler. Bu yama kanıtlanan geliştirme sunucusu
  yeniden yüklemesini giderir; WebView renderer çökmesini giderdiği iddia edilmez.
- 1180 px Research çekmecesinde scrim yoktu, arka plan aktifti, kapatma düğmesi
  gizliydi. Kalıcı UI testi önce scrim kontrolünde başarısız oldu. Tek çekmece
  koşulu artık scrim, inert, ilk odak, Tab kapanı ve kapatmayı yönetir.
  Kapatırken odak, React arka plandaki `inert` durumunu kaldırdıktan sonra döner.
- Write modundaki erken klavye dönüşü Ctrl+. kısayolunu engelliyordu.
  Kısayol artık önce işlenir. Esc önce Write'tan Normal'e, sonra açık
  çekmeceden, sonra Odak'tan çıkar. Ekrandaki 44 px çıkış düğmesi fare/dokunma
  için de erişilebilirdir; Write modunda da görünür.
- Native yeniden açılıştan sonra zaten kayıtlı modu tekrar seçmek, içerik
  değişmediği hâlde `Unsaved changes` göstergesini bırakabiliyordu. No-op düzenleme
  artık gerçek `dirty` durumunu gösterir. Birim testi yama öncesi başarısız,
  yama sonrası başarılıdır; gerçek kaydedilmemiş düzenleme hâlâ korunur.

## Yeniden çalıştırma

```powershell
npm.cmd test
npm.cmd run test:ui -- tests/ui/focus-recovery.spec.ts tests/ui/companion.spec.ts tests/ui/drawers.spec.ts tests/ui/modes.spec.ts tests/ui/themes.spec.ts tests/ui/layout.spec.ts
node scripts/check-cold-start.mjs
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
```

`check-cold-start.mjs` her çalışmada `.tmp/cold-start-<UUID>` içinde yeni Vite
önbelleği ve boş tarayıcı kitaplığı kullanır. İngilizce/Türkçe gerçek worker
yanıtlarını bekler, beklenmedik gezinme/React hatasında başarısız olur ve
`events.json` bırakır. Native IPC veya WebView testi değildir.

Native debug denemesinde `DIVIT_TEST_LIBRARY` mutlak bir geçici klasöre,
`WEBVIEW2_USER_DATA_FOLDER` ayrı test profiline ayarlanabilir. Kitaplık geçersiz
veya göreliyse başlangıç durur; release uygulama bu kitaplık değişkenini yok
sayar. Kayıtlı kitaplık işaretçisi okunup değiştirilmez, Documents göçü yapılmaz.

## Sonraki olayın tanısı

Native doğrulama: son kaynakların debug exe'si, ayrı kitaplık ve WebView profili
ile açıldı. Gerçek Tauri IPC üzerinden Odak/Write/Review/Normal, Daktilo,
Research, tema değişimi ve kayıt denendi; React hatası yakalanmadı. Kaydedildi
durumu kontrol edildikten sonra native pencere kapatılıp süreç yeniden açıldı;
test metni düzenleme yapılmadan önce aynı bulundu. Bu deneme IPC mock'u
kullanmaz. Test metni `.tmp/sis-268/native-library` içinde kaldı.

Windows arayüz aracı izin zaman aşımı, sonra `coordinate input geometry is
unavailable` hatası ve yanlış pencere görüntüsü verdi. Bu nedenle native
doğrulama WebView CDP bağlantısıyla yapıldı; Windows araç görüntüsü başarı
kanıtı sayılmadı. Gerçek pencere 1000/1180/1440 px'e getirildi; WebView
`innerWidth` ölçümleri aynı değerleri verdi ve Odak/Research geçişlerinde metin
korundu. Küçültme komutu `windowState: minimized` döndürdü, fakat WebView
görünürlüğü `visible` kaldı. Pencere eski boyutuna döndürüldü ve metin/kayıt
durumu doğrulandı; gerçek arka plan yaşam döngüsü tümüyle doğrulandı denemez.
Son denemeler 14 Kasım'da tamamlandı: 73 birim, 26 UI, 31 Rust testi geçti
(4 Rust credential testi bilerek atlandı); soğuk başlangıç ve build başarılı.
Test penceresi güvenle kapatıldı, son kaynaklardan Divit kullanıcının kendi
kitaplığıyla açılıp uygulama kökünün görünür olduğu içerik alınmadan doğrulandı.

`divit-runtime-diagnostics-v1` localStorage anahtarı en fazla 40 yerel kayıt
tutar: başlangıç, görünürlük, sayfa yaşam döngüsü, Vite reload, React fatal,
script/rejection ve worker hata türleri. Yazı, başlık, ayar, URL, hata mesajı,
API anahtarı veya istek içeriği kaydedilmez. Kaynak konumları yalnız dosya/satır
bilgisidir. Depolama engelliyse kayıt sessizce atlanır.

Otomatik yenileme veya kökü yeniden bağlayan hata sınırı eklenmedi. Tanı kodu
yazıyı değiştirmez ve reload döngüsü oluşturmaz. Tam renderer kaybında son JS
kaydı oluşmayabilir; böyle bir olayda WebView/native kayıtları da gerekir.
