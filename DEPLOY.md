# Yayına alma (FileZilla → cPanel `public_html`)

Bu adımlar mevcut v1 sitesinin yerine yeni siteyi koyar. Yaklaşık sıra: yedek → SSL kontrolü → yükleme → temizlik → izinler → smoke testi.

Başlamadan önce yerelde: `npm run build && npm run verify` → "Bütün kontroller geçti." görmelisiniz.

## 1. Yedek

1. FileZilla ile sunucuya bağlanın, sağ panelde `public_html` klasörünü açın.
2. Bilgisayarınızda tarihli bir klasör oluşturun, ör. `C:\Yedek\spadunyasi-2026-10-03`.
3. `public_html` içindeki **her şeyi** seçip bu klasöre sürükleyin (İndir). İndirme bitene kadar bekleyin.

## 2. SSL kontrolü

1. cPanel'e girin → **Güvenlik** bölümü → **SSL/TLS Durumu** (SSL/TLS Status).
2. `spadunyasi.com.tr` ve `www.spadunyasi.com.tr` satırlarının ikisinde de geçerli (yeşil kilit) sertifika olduğunu kontrol edin.
3. Değilse **AutoSSL Çalıştır** (Run AutoSSL) düğmesine basın ve tamamlanmasını bekleyin. Site her adresi `https://spadunyasi.com.tr` adresine yönlendirdiği için iki sertifika da gereklidir.

## 3. FileZilla ayarları

1. **Dosya → Site Yöneticisi**: Şifreleme = **Explicit FTP over TLS gerektir** (Require explicit FTP over TLS).
2. **Aktarım → Aktarım türü → İkili** (Binary). (Görsel ve font dosyaları bozulmasın.)
3. **Sunucu → Gizli dosyaları göstermeyi zorla** (Force showing hidden files). Bu olmadan `.htaccess` dosyaları görünmez ve **yüklenmez**.

## 4. Yükleme (iki adım)

Kesinti olmaması için sıra önemlidir:

1. **Önce** sol panelde (bilgisayarınız) projedeki `dist\_astro` klasörünü sağ panelde `public_html` içine yükleyin. Bitmesini bekleyin. Bu klasördeki dosya adları hash'lidir; canlı siteyi etkilemez.
2. **Sonra** `dist\` klasörünün **içindeki** her şeyi (klasörün kendisini değil) `public_html` içine yükleyin. "Hedef dosya zaten var" sorusuna **Üzerine yaz** (Overwrite) ve "Her zaman bu işlemi uygula" seçin.
   - Kontrol: `public_html` içinde `index.html`, `.htaccess`, `en/`, `_astro/`, `og/`, `thumbs/`, `sitemap.xml`, `robots.txt` görünmelidir. `public_html/dist/` diye bir klasör OLMAMALI.

**Alternatif (zip):** `npm run zip` → `spadunyasi-dist.zip`. cPanel → **Dosya Yöneticisi** → `public_html` → **Yükle** → zip'i seçin → zip'e sağ tık → **Ayıkla** (Extract) → hedef `/public_html`. Zip'in kökünde doğrudan dosyalar vardır.

## 5. Temizlik

1. `reports/v1-temizlik-listesi.txt` dosyasını açın. Listedeki eski v1 dosyalarını `public_html` içinden silin (en başta **`/assets/`** klasörünün tamamı).
2. Hostingin varsayılan `index.php` veya `default.html` dosyası varsa silin (`index.html` önce gelse de karışıklığı önler).
3. **DOKUNMAYIN:** `.well-known/` (SSL yenilemesi), `cgi-bin/`, `google….html` doğrulama dosyaları.

## 6. İzinler

FileZilla'da `public_html` içindeki her şeyi seçin → sağ tık → **Dosya izinleri**:
- Önce **Yalnızca dosyalara uygula**, sayısal değer **644**, "Alt dizinlere de uygula" işaretli.
- Sonra **Yalnızca dizinlere uygula**, sayısal değer **755**, "Alt dizinlere de uygula" işaretli.

## 7. Smoke testi

Bilgisayarınızda proje klasöründe:

```bash
npm run smoke -- https://spadunyasi.com.tr
```

ya da Claude Code'a "smoke testini çalıştır" deyin. Bütün satırlar **PASS** olmalıdır (yönlendirmeler tek adımda, SSL, v1 adresleri, sitemap, 404'ler, başlıklar, MIME türleri, PageSpeed skorları). PageSpeed bazen istek sınırına takılır; o satırlar için birkaç dakika sonra tekrar deneyin ya da `--no-psi` ekleyin.

## 8. Sorun giderme

| Belirti | Çözüm |
|---|---|
| Bütün sitede **500 Internal Server Error** | `public_html/.htaccess` dosyasını açın, `Options -Indexes -MultiViews` satırının başına `#` koyun, kaydedin, tekrar deneyin. Düzelmezse yedekteki eski `.htaccess`'i geri yükleyip bize bildirin. |
| Sayfa stilsiz/bozuk görünüyor | `_astro/` yüklemesi eksik kalmıştır; 4.1 adımını tekrarlayın. |
| Eski sayfa görünüyor | Tarayıcı önbelleğini temizleyin (Ctrl+F5) veya gizli pencerede açın. |
| `/en/` adresi 403 veriyor | `en/index.html` yüklenmemiş; `dist\en` klasörünü tekrar yükleyin. |
| `.htaccess` sunucuda yok | 3.3 adımı (gizli dosyalar) yapılmamış; `dist\.htaccess`, `dist\en\.htaccess`, `dist\_astro\.htaccess` dosyalarını tekrar yükleyin. |

## 9. Geri dönüş

Ciddi bir sorun olursa: `public_html` içini boşaltın ve 1. adımdaki yedek klasörün içeriğini geri yükleyin.

## 10. Yayın sonrası

- **Google Search Console:**
  1. https://search.google.com/search-console → Mülk ekle → **Alan adı** (Domain) → `spadunyasi.com.tr`.
  2. Verilen TXT kaydını cPanel → **Alan Adları → Zone Editor** → `spadunyasi.com.tr` → **+ TXT Kaydı** ile ekleyin; Search Console'da **Doğrula**.
  3. Alternatif: URL öneki mülkü + `site.config.ts` içindeki `googleSiteVerification` değerine meta kodu yazıp yeniden build/yükleme.
  4. **Site haritaları** → `https://spadunyasi.com.tr/sitemap.xml` gönderin.
  5. **URL denetimi** ile `/`, `/en/`, `/urunler.html` ve önemli ürün sayfaları için **Dizine eklenmesini iste**.
- **Bing Webmaster Tools:** https://www.bing.com/webmasters → "Search Console'dan içe aktar".
- **GA4 (isteğe bağlı):**
  1. https://analytics.google.com → Yönetici → **Mülk oluştur** → Web veri akışı → `https://spadunyasi.com.tr` → **Ölçüm kimliği** (G-XXXXXXXXXX).
  2. README "GA4 kimliğini ekleme" adımlarıyla kimliği girip build alın ve yükleyin.
  3. GA4 → Yönetici → **Etkinlikler**: `whatsapp_click`, `phone_click` ve `quote_send` olayları göründükten sonra **Temel etkinlik olarak işaretle** (Mark as key event).
  4. GA4 → Yönetici → **Özel tanımlar → Özel boyut oluştur** (kapsam: Etkinlik): `cta_location`, `product_code`, `page_type`.
- **2-4 hafta sonra:** Search Console'da **Sayfalar** (kapsam) ve **Uluslararası hedefleme / hreflang** raporlarını kontrol edin.
- **Google İşletme Profili uyarısı:** Spa World'ün adresine farklı bir isimle ikinci bir işletme kaydı açmayın; mevcut kayıtla çakışır ve askıya alınabilir.
- **Öneri:** Spa World sitesinden spadunyasi.com.tr'ye "yetkili satış noktası" bağlantısı verilmesi sitenin güvenilirliğine ve bulunabilirliğine katkı sağlar.
