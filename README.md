# Spa Dünyası (spadunyasi.com.tr)

Spa World yetkili satış noktası Spa Dünyası'nın Türkçe (`/`) ve İngilizce (`/en/`) statik web sitesi. Ürünler spaworld.com.tr'den alınır; fiyat gösterilmez, ziyaretçi WhatsApp'a ya da telefona yönlendirilir. Sunucuda PHP, veritabanı veya yönetim paneli yoktur: `dist/` klasörü cPanel'deki `public_html/` içine yüklenir.

- **Yayına alma:** [DEPLOY.md](DEPLOY.md)
- **Onaylanmış şartname:** `PROMPT.md` (değiştirilmez), kopyası `docs/SPEC.md`
- **Kararlar ve sapmalar:** `docs/DECISIONS.md` · **Eksik bilgiler:** `docs/eksik-bilgiler.md`
- **Final raporu:** `reports/FINAL-RAPOR.md`

## Kurulum

Gerekenler: Node.js 22 veya üstü (geliştirmede 24 kullanıldı), npm, Git. Bir kez:

```bash
npm ci
npx playwright install chromium
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run scrape` | spaworld.com.tr'yi tarar (önbellekten), PDF'i okur, görselleri işler ve kataloğu yeniden üretir. `npm run scrape -- --refresh` önbelleği yeniler (canlı siteye istek atar, tek tek ve beklemeli). |
| `npm run build` | `astro build` + postbuild: `.htaccess`, OG görselleri, küçük görseller, `sitemap.xml`, `robots.txt`, anahtar kelime haritası. Çıktı: `dist/`. |
| `npm run verify` | Bütün kalite kontrolleri: `verify:data`, `verify:content`, `verify:seo`, `verify:output`, `verify:browser` (Playwright: erişilebilirlik, teklif listesi, çerez onayı…), `verify:lighthouse`. Sonuçlar `reports/verify/*.json`. |
| `npm run serve` | `dist/` klasörünü Apache gibi davranan yerel sunucuda açar: http://localhost:4321 |
| `npm run smoke -- https://spadunyasi.com.tr` | Yayın sonrası kontroller: yönlendirmeler, SSL, sayfalar, başlıklar, 404, PageSpeed. `--no-psi` PageSpeed'i atlar. |
| `npm run zip` | `spadunyasi-dist.zip` üretir (dist'in içeriği zip'in kökünde; `.htaccess` dahil). |
| `npm run check` | TypeScript/Astro tip kontrolü. |
| `npm test` | Yalnızca Playwright testleri (önce `npm run test:ga-build`). |

Git Bash kullanıyorsanız `/` ile başlayan argümanlar Windows yoluna çevrilir; bu durumda komutun başına `MSYS_NO_PATHCONV=1` ekleyin.

## Proje yapısı

```
site.config.ts         Firma bilgileri ve ayarlar (tek gerçek kaynağı). GA4 kimliği burada.
data/
  raw/                 Ham sayfa ve görsel önbelleği (git dışı)
  source/              Kaynaktan değiştirilmeden çıkarılan veri
  overrides/           Elle kararlar: products.json (ad, kategori, alıntılanan değerler),
                       translations.json (etiket/opsiyon çevirileri), images.json, corrections.json
  catalog/products.json  Doğrulanmış katalog (Zod şeması). Teknik veriler YALNIZCA burada.
  codes.lock.json      Ürün kodları (SD-001…). Bir kod asla yeniden kullanılmaz.
  derived-facts.json   Rehberlerde kullanılan, katalogdan hesaplanmış değerler
  content-dates.json   Sitemap lastmod tarihleri (içerik değişince güncellenir)
src/
  content/             Metinler: products, categories, services, guides, pages × {tr,en}
  lib/routes.ts        Rota kaydı: bütün sayfalar, yollar, menüler, hreflang buradan
  i18n/ui.ts           Arayüz metinleri (TR + EN)
  templates/ components/ layouts/ scripts/ styles/
server/                .htaccess şablonları (kök, en/, _astro/)
scripts/               scrape, images, catalog, postbuild, verify, smoke, qa, fonts
tests/                 Playwright testleri
reports/               Kapsam, görsel, PDF farkları, doğrulama, Lighthouse, ekran görüntüleri
dist/                  YÜKLENECEK KLASÖR (yalnızca içi)
```

## Ürün ekleme ve güncelleme

1. Spa World sitesine yeni ürün eklendiyse `npm run scrape -- --refresh` çalıştırın. Keşif sonucu `data/source/discovery.json`'a yazılır.
2. Yeni ürünü `data/overrides/products.json` içine ekleyin: `key`, `sources`, `category`, `model`, `name {tr,en}`; kaynak maddelerinden alınan değerler için `textSpecs` (`quote` kaynaktaki cümleyle birebir aynı olmalı), donanım için `features`. Yeni bir tablo etiketi ya da opsiyon varsa `data/overrides/translations.json`'a çevirisini ekleyin.
3. `node scripts/catalog/build.mjs` → katalog, görseller, kapsam raporu ve CSV yenilenir. Yeni ürün bir sonraki boş kodu alır; kaldırılan ürünün kodu emekliye ayrılır.
4. Metinleri yazın: `src/content/products/tr/SD-0NN.md` ve `en/SD-0NN.md` (biçim için mevcut dosyalara ve `docs/content-brief.md`'ye bakın). Her yazımdan sonra `node scripts/content-checks/run.mjs <dosyalar>`.
5. `npm run build && npm run verify` → hepsi PASS olmalı.

Görsel düzeltmeleri (hariç tutma, kırpma, alt metin) `data/overrides/images.json` içinde yapılır.

## GA4 kimliğini ekleme

1. `site.config.ts` içinde `ga4MeasurementId: process.env.SD_GA4_ID ?? ''` satırındaki boş değeri kimlikle değiştirin, ör. `?? 'G-ABC123XYZ9'`.
2. `npm run build` → çerez bandı, "Çerez tercihleri" linki, CSP izinleri ve çerez politikasındaki tablo otomatik oluşur. Analitik yalnızca `spadunyasi.com.tr` alan adında ve ziyaretçi "Kabul et" dedikten sonra çalışır.
3. `npm run verify` → ardından `dist/` klasörünü yeniden yükleyin (DEPLOY.md).
4. GA4 panelindeki ayarlar için DEPLOY.md "Yayın sonrası" bölümüne bakın.

## İçerik düzenleme

- Metinler Markdown dosyalarındadır: `src/content/<tür>/<tr|en>/<id>.md`. Üst kısımdaki alanlar (title, description, intro, SSS…) `src/content.config.ts` şemasına uyar.
- İç linkler yol yerine kimlikle yazılır: `[metin](urun:SD-014)`, `[metin](kategori:masaj-yataklari)`, `[metin](rehber:masaj-yatagi-secimi)`, `[metin](hizmet:sauna)`, `[metin](sayfa:iletisim)`. Yanlış kimlik build'i durdurur.
- Rehberde satır içi ürün kartı: tek başına bir satıra `@kart SD-013`.
- Teknik ölçüleri metne yazmayın; tablo katalogdan basılır. Sağlık iddiası, "en iyi" gibi ifadeler, fiyat ve teslim süresi yasaktır (kontroller yakalar).
- TR ve EN dosyaları birlikte bulunmalıdır.

## Sık karşılaşılan sorunlar

| Belirti | Çözüm |
|---|---|
| Build "missing … (ICR-14)" hatası | Bir sayfanın TR ya da EN içerik dosyası eksik. |
| Build "unresolved link" hatası | Markdown'da yanlış kimlik (`urun:SD-0xx`) var. |
| `verify:content` kal-05 hatası | Metinde kaynak siteyle ortak 8 kelimelik ifade var; cümleyi yeniden yazın. |
| `verify:content` kal-07 "katalogda yok" | Metindeki sayı + birim katalogda yok; değeri düzeltin ya da kaldırın. |
| Markdown değişikliği sayfaya yansımıyor | `node_modules/.astro/data-store.json` dosyasını silip yeniden build alın. |
| YAML hatası ("bad indentation") | `[` ile başlayan değerleri çift tırnağa alın. |
| İlk build uzun sürüyor | AVIF kodlaması; sonraki build'ler önbellekten hızlıdır (`node_modules/.astro`). |
