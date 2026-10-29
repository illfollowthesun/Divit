# AI devir notu — 29 Ekim 2026

Durum: AI/research toparlaması ve otomatik kontroller tamamlandı. Özelliğin gereken dosyaları commit edildi. Uygulama bu oturumda açılmadı; canlı ve gerçek masaüstü kontrollerini kullanıcı yapacak. Push yapılmadı.

## Önceki oturumun devir kaydı

`1ad0dc8` — `test(ai): verify Windows credentials across processes and source persistence`

Yalnız şu dosyaları içerir:

- `playwright.config.ts`
- `src-tauri/tests/credential-manager.rs`
- `tests/ui/ai-research.spec.ts`

O devir sırasında devralınmış uygulama kodu çalışma ağacında korunmuş, bu commit'e dahil edilmemişti. Aşağıdaki nihai toparlama bu kodu inceler ve özelliğe ait commitlere alır. İlgisiz dosyaları veya kaydedilmemiş değişiklikleri geri alma.

## Doğrulananlar ve sınırları

- Gerçek Windows Credential Manager testi geçti. İzole bir servis altında, gerçek API anahtarı olmayan test değeri ayrı süreçlerde kaydedildi, okundu, silindi ve silindiği doğrulandı. Mevcut sağlayıcı anahtarlarına yazılmadı. Bu, uygulamanın kapatılıp yeniden açılarak test edildiği anlamına gelmez.
- `tests/ui/ai-research.spec.ts`: 5 UI testi geçti. Keep, gerçek yerel HTTP sayfasını gerçek araştırma köprüsüyle çekip diske kaydetti; kaynak metni ve ayrı AI özeti, çevrimdışı okuma ve kısmi kayıt hatasından sonra tekrar deneme doğrulandı. **Bu testlerde AI yanıtları ve Tauri IPC sahteydi. Bunlar canlı Gemini/Claude veya gerçek masaüstü Keep doğrulaması değildir.**
- Araştırma UI test dosyasının tür kontrolü geçti. Önceki oturumda üretim derlemesi, uygulama tür kontrolü ve ilgili testler de geçti.
- Eşzamanlı Playwright çalışmaları ayrı sonuç klasörleriyle geçti; her çalıştırma `test-results/run-<pid>-<uuid>` kullanır.

## Açık kalan doğrulamalar

1. Geçerli Gemini API anahtarıyla gerçek sağlayıcı yanıtı ve web araması. Kontrol sırasında uygulamanın `com.firextream.yazi` / `ai-gemini` kaydı boştu; Process/User/Machine ortamlarında `GEMINI_API_KEY` ve `GOOGLE_API_KEY` de yoktu. Geçerli anahtar, model erişimi ve web araması için uygun ücretli erişim gerekiyor.
2. Geçerli Anthropic API anahtarıyla Claude isteği ve isteğe bağlı fallback. `com.firextream.yazi` / `ai-anthropic` kaydı ve Process/User/Machine ortamlarında `ANTHROPIC_API_KEY` yoktu. Fallback seçeneğini açıp normal yanıt almak, gerçekten bir fallback gerçekleştiğini kanıtlamaz; gerçekleşen denemeyi ve hizmet veren modeli ayrıca doğrula.
3. Gerçek Yazı arayüzünden anahtar kaydetme, uygulamayı kapatıp yeniden açınca kayıtlı anahtarla çağrı yapma, sonra test için kullanılan anahtarı silme ve yeniden açılışta yokluğunu doğrulama. Ayrı süreç Credential Manager testi bu adımı kapatmaz. Mevcut kullanıcı anahtarını test değeriyle değiştirme veya silme.
4. Gerçek masaüstü uygulamasında canlı AI sonuçlarından Keep: asıl sayfanın çekilip kaynak dosyasına kaydedilmesi, AI özetinin ayrı ve etiketli tutulması ve yeniden açılışta çevrimdışı okunması. Browser testi bu kabul adımını kapatmaz.

Masaüstü erişim engeli: Otomatik onay denetimi `computer-use` aracının Yazı uygulamasına erişimini reddetti: `Computer Use was not approved to use yazi`. Alternatif bir UI yöntemiyle bu ret aşılmadı. Gerçek uygulamayı yeniden açma ve masaüstü Keep doğrulamaları tamamlanmadı.

Anahtarlar veya masaüstü erişimi sağlanmadan bu açık adımları tamamlanmış sayma. Anahtarları sohbet çıktısına, test raporuna veya Git'e yazma.

## Nihai toparlama — 29 Ekim 2026

### Commitler ve kapsam

| Commit | Gerçek içerik |
| --- | --- |
| `210c59d` | API key test locator'ı Settings → AI → `.ai-key` alanında tam etiketle eşleşir; assertion'lar korunur. |
| `1ad0dc8` | Önceki Playwright, ayrı süreç Credential Manager ve AI/research testleri. |
| `ae28c27` | İkinci `addUse` dinleyicisi tıklamadan önce kurulur; başarılı yanıt tamamlanmadan araştırma dosyası okunmaz. İki kayıt assertion'ı değişmedi. Kontrollü geciktirme önceki oturumda 3/3, tam UI 47/47 geçti. |
| `2dc0f98` | Gemini öncelikli sağlayıcı ayarları, yerel model seçeneği, isteğe bağlı Claude fallback, ücret/kullanım etiketleri, gerçek URL ayrıştırmasıyla yerel adres doğrulaması, ayar UI testleri ve `desktop-bridge.ts`. |
| `fab03ea` | `ai_search.rs` ve Tauri komutu, `AiCandidates.tsx`, AI arama formu, Keep ile gerçek sayfayı kaydetme ve AI özetini ayrı tutma, okuyucu/CSS bağlantıları, proje ve güncel AI ayarları regresyon testleri. |
| `0e097c6` | Gecikmiş araştırma okumalarının yeni okuma veya kayıt sonuçlarını ezmesini önleyen proje bazlı sıra/sürüm kontrolü ve kontrollü regresyon testi. |

`ai_search.rs`, `AiCandidates.tsx` ve `desktop-bridge.ts` artık takip edilen dosyalardır. Kaynak/özet kayıtları mevcut araştırma köprüsünü kullanır; ayrı bir kayıt altyapısı eklenmedi.

### Düzeltilen gerçek hatalar

- Proje değiştiğinde eski projenin AI sonuçları yeni projenin çekmecesinde kalabiliyordu. Arama bileşeni artık proje kimliğiyle yeniden oluşturulur.
- Araştırma çekmecesi açıkken değiştirilen AI ayarları eski kalabiliyordu. Form açılırken ve AI araması gönderilmeden önce güncel ayarlar okunur. Form açıkken AI kapatılırsa istek gönderilmez; sağlayıcı etiketi ve yumuşak limit güncel yapılandırmadan alınır.
- Yerel adres kontrolü metni ikiye bölerek gerçek sunucuyu yanlış belirleyebiliyordu. `http://localhost:11434@evil.example/v1` artık reddedilir; gerçek IPv6 loopback adresi kabul edilir. Bu doğrulama bir ağ çağrısı yapmaz.
- Tamamlanmamış Gemini yanıtı, kısmi metin/atıf içeriyor olsa bile tamamlanmış kaynak listesi sayılmaz. Ay alanında `00` ve `13` reddedilir.
- Eski `load` yanıtı yeni kaydedilen vurguyu arayüzden kaldırabiliyordu. Kontrollü testte hata önce üretildi; kayıt sürümü ve istek sırası korumasından sonra aynı test geçti. Aynı koruma AI özetlerini de kapsar.

### Nihai kontroller

| Kontrol | Sonuç ve sınır |
| --- | --- |
| `npx.cmd tsc --noEmit` | Geçti; uygulama tür kontrolü. |
| İlgili AI/araştırma UI testleri ve `desktop-bridge.ts` için ayrı strict TypeScript kontrolü | Geçti. |
| `npm.cmd run build` | Geçti. Vite mevcut büyük bundle uyarısını veriyor; derleme hatası yok. |
| `npm.cmd test` | 59 geçti, 3 atlandı, 0 başarısız. Atlananlar `YAZI_SITE_REPO` ve kurulu site bağımlılıklarını isteyen testlerdir. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Geçti. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 18 geçti; 1 unit ve 3 integration Credential Manager testi ignored. Bu oturumda gerçek anahtar deposuna test değeri yazılmadı. |
| Odaklı araştırma testleri ve gecikmiş okuma regresyonu | 5/5 geçti. |
| Son `npm.cmd run test:ui` | 51/51 geçti; normal 10 worker, retry veya assertion gevşetmesi yok. |

İlk tam UI koşusu Rust'ın ilk bağımlılık kontrolüyle eşzamanlıydı: 50 testin 3'ü araştırma zamanlamalarında başarısız oldu. Quote hatası bu kez `addUse` assertion'ında değil, kaynağın görünmesini bekleyen ilk tıklamadaydı. Ardından gecikmiş `load` yarışı kontrollü testle ayrıca doğrulandı ve düzeltildi. Ağır derleme bittikten ve düzeltme eklendikten sonraki son tam koşu 51/51 geçti; ilk başarısız koşu gizlenmedi.

Bu otomatik UI testlerinde AI/Tauri yanıtları sahtedir. Keep testleri gerçek yerel HTTP sayfasını gerçek Node araştırma köprüsüyle diske yazar; bu, gerçek masaüstü Tauri Keep veya canlı Gemini/Claude isteği değildir. Bağımsız özetleme/soru/açı üretimi eklenmedi; bu paketin arama akışı Gemini/Claude içindir. Diğer sağlayıcılar ayarlanabilir ve bağlantı testi yapılabilir; web araması için manuel istek akışı korunur.

API sözleşmesi incelemesinde başvurulan resmi kaynaklar: [Gemini grounding yanıtları](https://ai.google.dev/gemini-api/docs/google-search), [Interactions API alanları](https://ai.google.dev/api/interactions-api), [Claude isteğe bağlı fallback](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback). Bu belgelerin incelenmesi canlı sağlayıcı doğrulaması sayılmaz. Gösterilen maliyetler tahmindir; Gemini arama ücretleri hesaplanmış toplamın dışındadır, bilinmeyen model fiyatları fiyatlandırılamayan kullanım olarak kalır.

### Çalışma alanı ve temizlik

- Bu çalışma zincirinde oluşturulan 18 geçici tanılama/düzenleme dosyası ve 6 tanılama çıktı klasörü `.tmp` altından kaldırıldı; hedefler önce doğrulandı ve açık dosya yollarıyla silindi.
- Kalıcı regresyon testleri, Credential Manager testi, devir notu ve son test çıktıları korundu.
- Sahibi/amacı kesin olmayan `.tmp/add-ai-settings.cjs`, `.tmp/App.head.tsx`, `.tmp/pr.bak` ve `.tmp/typecheck.json` korundu. Mevcut test fixture klasörleri, `.tmp/yazi-preview`, bağımlılıklar ve derleme çıktıları topluca silinmedi.
- Özellik dışında bırakılan mevcut değişiklikler: `docs/examples/the-last-ferry.md` çalışma ağacı durumu ve `docs/screenshots/polish-after-{1440,960,export,snapshots,typewriter}.png` görselleri. Örnek metnin normalize edilmiş içerik diff'i boş görünüyor; satır sonları geri yazılmadı. Görseller testler tarafından da yeniden üretilebilir. Hiçbiri özellik commitlerine alınmadı.
- Her kod commit'inin dosya listesi ve diff kontrolü incelendi. Yeni özellik eklenmedi, ilgisiz içerik silinmedi, push yapılmadı.

### Kullanıcının uygulamada yapacağı kısa kontrol

Proje klasöründe `npm.cmd run desktop` çalıştır. 1420 portunda açık bir Vite önizleme terminali varsa önce o terminalde `Ctrl+C` ile kapat. Uygulama bu oturumda açılmadı; computer-use reddi başka bir UI yöntemiyle aşılmadı.

1. Settings → AI: Gemini'nin ilk sırada, AI ve Claude fallback'in başlangıçta kapalı olduğunu kontrol et. Kendi geçerli anahtarını sakla; mevcut başka bir anahtarı test değeriyle değiştirme.
2. Uygulamayı kapatıp yeniden aç; kayıtlı anahtarla bağlantıyı ve gerçek Gemini aramasını dene. Web araması için sağlayıcı tarafında uygun erişim gerekir. Sonuçların gerçekten canlı çağrıdan geldiğini doğrula.
3. Gerçek bir sonucu Keep ile sakla. Asıl sayfa metninin, ayrı AI etiketli özetin ve değiştirilmemiş taslağın korunduğunu kontrol et. Yeniden açıp kaynağı çevrimdışı oku; proje değiştirince eski AI adaylarının taşınmadığını doğrula.
4. Claude kullanacaksan gerçek istek ve isteğe bağlı fallback'i ayrıca doğrula. Fallback kutusunun açık olması veya normal bir yanıt alınması, fallback'in gerçekleştiğini kanıtlamaz; yanıtın hizmet veren modeli ve fallback denemesi kaydı gerekir.
5. Yalnız bu kontrol için eklediğin anahtarı kaldırıp yeniden açılışta yokluğunu kontrol et. Önceden var olan kullanıcı anahtarlarını silme. Yukarıdaki dört canlı/masaüstü doğrulama hâlâ açık kabul adımlarıdır.
