# İlerleme (PRO-02)

**Ayarlar:** ONAY_MODU = onaysiz · GA4 boş · ticari unvan boş · site doğrulama boş (D-001) · garanti: §4, 5 yıl (D-006)

## Mevcut faz
TAMAMLANDI (Faz 8). Sıradaki iş kullanıcıda: DEPLOY.md ile yükleme, ardından `npm run smoke -- https://spadunyasi.com.tr`.

## Tamamlanan
- [x] Faz 0: Kurulum (Astro 7.3.5, TS 6.0.3, Playwright Chromium). Commit `faz-0`.
- [x] Faz 1: Veri ve katalog. 59 URL → 62 ürün, 8 kategori, 279 görsel. `npm run verify:data` 5/5 PASS. `reports/onay-1.md`. Commit `faz-1`.
  - Hat: `npm run scrape` = discover → fetch-pages → parse → images collect/download → pdf → catalog build (önbellekten tekrar üretilebilir).
  - Elle kararlar: `data/overrides/{products,translations,images,corrections}.json`.

- [x] Faz 2: Tasarım sistemi ve bütün şablonlar. Örnek içerik: ana sayfa, Masaj Yatakları, SD-013/024/032 (TR+EN). Hızlı Lighthouse 100/100/100/100, LCP ≤1,8 s. `astro check` 0 hata. `reports/onay-2.md`. Commit `faz-2`.

## Sıradaki adım (eski notlar aşağıda)
- Faz 2: fontlar (Fraunces + Inter, Astro Fonts API), tokens.css, logo SVG + favicon seti, rota kaydı (`src/lib/routes`), i18n sözlüğü, layout ve bileşenler, bütün şablonlar; 3 örnek ürün (studio / scene / en çok veri), ana sayfa ve bir kategori. `scripts/serve-dist.mjs`. Ekran görüntüleri (375/1440) ve hızlı Lighthouse → `reports/onay-2.md`.
- Örnek ürün adayları: studio → SD-044 Havlu Soğutucu ya da beyaz zeminli bir ürün; scene → SD-024 Mercury; en çok veri → SD-013 Lux Soft (8 teknik satır, 6 opsiyon).

- [x] Faz 3: İçerik. 92+92 içerik dosyası (62 ürün, 8 kategori, 4 hizmet, 8 rehber, 10 sayfa). `verify:content` 5/5 PASS (max Jaccard 0,079). Commit `faz-3`.
- [x] Faz 4: SEO katmanı. Meta, canonical, hreflang, JSON-LD @graph, sitemap (178 URL, lastmod içerik hash'ine bağlı), robots, OG JPEG (93), keyword-map.csv. `verify:seo` 5/5 PASS. Commit `faz-4`.
- Ara durum: `npm run verify` 19/19 PASS, `astro check` 0 hata.

- [x] Faz 5: Etkileşimler. nav, gallery, filter, quote, track, consent modülleri. Playwright 217/217 (186 sayfa axe+konsol+görsel QA, 31 etkileşim/teklif/GA/JS-kapalı testi). `npm run verify:browser` PASS. Commit `faz-5`.

- [x] Faz 6: `.htaccess` (kök/en/_astro), smoke testi (yerelde 20/20), README, DEPLOY, `npm run zip` (3610 dosya, 55,4 MB), v1 temizlik listesi (45 dosya, /assets/). `verify:output` 4/4 PASS. Commit `faz-6`.

- [x] Faz 7: Tam `npm run verify` 24/24 PASS (data, content, seo, output, code, browser 217 test, lighthouse 8 sayfa). Commit `faz-7`.

- [x] Faz 8: `reports/FINAL-RAPOR.md`. Son `npm run verify` 25/25 PASS. ZIP yeniden üretildi. Commit `faz-8`.

## Sıradaki adım (güncel)
- Faz 5: JS modülleri yazıldı (nav, gallery, filter, quote, track, consent). Playwright testleri: menü, galeri, filtre, teklif listesi (KAL-17), çerez/GA (KAL-16, test build G-TEST000000), JS kapalı (KAL-14), konsol/CSP (KAL-15), axe (KAL-11), görsel QA (KAL-13).

## Sıradaki adım (eski)
- Faz 3: kalan 59 ürün, 7 kategori, 4 hizmet, 8 rehber, sayfalar (ürünler, hizmetler, rehber, hakkımızda, iletişim, SSS, 3 yasal) TR+EN. Sonra `verify:content` (KAL-05..08) yazılıp geçirilecek. Taslak modu kapatılacak.
- Not: Git Bash'te `/` ile başlayan argümanlar için `MSYS_NO_PATHCONV=1` kullan. Yerel sunucu: `node scripts/serve-dist.mjs` (gzip açık).

## Açık sorunlar
- Fon sınıflandırması: açık gri degrade zeminli görseller "scene" sayıldı; Faz 2'de kırpmalar ekran görüntüsüyle kontrol edilecek.
