# Lighthouse (yerel, mobil, simüle kısıtlama)

Tarih: 2026-10-04 · Her sayfa 3 kez ölçüldü; LCP'ye göre medyan çalıştırma raporlandı. Sunucu: scripts/serve-dist.mjs (gzip açık).

| Sayfa | Yol | Perf | Erişil. | En iyi uyg. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| tr-home | / | 100 | 100 | 100 | 100 | 1.81 s | 0.001 | 0 ms |
| en-home | /en/ | 99 | 100 | 100 | 100 | 1.81 s | 0.001 | 0 ms |
| category | /masaj-yataklari.html | 99 | 100 | 100 | 100 | 1.81 s | 0.001 | 0 ms |
| product-studio | /brand-cilt-bakim-koltugu.html | 99 | 100 | 100 | 100 | 1.81 s | 0.001 | 0 ms |
| product-scene | /mercury-dinlenme-yatagi.html | 99 | 100 | 100 | 100 | 1.81 s | 0.001 | 0 ms |
| guide | /masaj-yatagi-secimi.html | 100 | 100 | 100 | 100 | 1.50 s | 0.001 | 0 ms |
| contact | /iletisim.html | 100 | 100 | 100 | 100 | 1.50 s | 0.001 | 0 ms |
| 404 | /lighthouse-olmayan-sayfa.html | 100 | 100 | 96 | (58) | 1.51 s | 0.001 | 0 ms |

404 sayfasının SEO skoru hedef dışıdır (noindex + 404 durum kodu, PER-01). En iyi uygulamalar skorundaki tek eksik, tarayıcının belgenin kendi 404 durumunu konsola yazmasıdır (D-022).
