# Kararlar ve sapmalar (PRO-03)

Her kayıtta: tarih, karar, alternatifler, gerekçe.

## D-001 · 2026-10-03 · "Bölüm 0" ayarları
- **Durum:** SPEC'in başlık yorumu "Bölüm 0" ayarlarından söz ediyor ama bu bölüm belgede yok (SPEC boşluğu, PRO-12).
- **Karar:** Kullanıcıya soruldu. Cevaplar:
  - `ONAY_MODU = onaysiz` → onay noktalarında durulmaz; özetler `reports/onay-1.md` ve `reports/onay-2.md` olarak yazılır (PRO-11).
  - `GA4_OLCUM_KIMLIGI = ""` → gtag, çerez bandı ve "Çerez tercihleri" linki üretilmez (ANL-01). Onay mantığı yine yazılır ve test build'inde `G-TEST000000` ile test edilir (KAL-16).
  - `TICARI_UNVAN = ""`, `MERSIS_VEYA_VKN = ""` → veri sorumlusu "Spa World" (ICR-10).
  - `GOOGLE_SITE_DOGRULAMA = ""` → meta etiketi yok (SEO-13).
- **Alternatifler:** Varsayılanlarla devam etmek (iki onay noktası).
- **Gerekçe:** Talimat önceliği 1: kullanıcının açık talimatı.

## D-002 · 2026-10-03 · TypeScript 6.0.3
- **Karar:** `typescript@6.0.3` (en güncel 7.0.2 değil).
- **Alternatifler:** TS 7.x.
- **Gerekçe:** `@astrojs/check@0.9.10` peer bağımlılığı `^5 || ^6`. `astro check` (KAL-01) çalışmak zorunda.

## D-003 · 2026-10-03 · Zod ayrı bağımlılık olarak eklenmedi
- **Karar:** Şemalarda `astro/zod` kullanılır (Astro 7.3.5 zod ^4.5 ile gelir).
- **Gerekçe:** TEK-09 bağımlılıkları minimal tutmayı istiyor; aynı kütüphanenin ikinci kopyasına gerek yok.

## D-004 · 2026-10-03 · Ek dev bağımlılıkları
- `@astrojs/check` (+ `typescript`): `astro check` için zorunlu (KAL-01, Astro'nun resmi aracı).
- `@playwright/test`: Playwright test koşucusu (TEK-09'daki "playwright" kapsamında).
- `stylelint-config-standard`: Stylelint temel kural seti; tekrar eden seçici/özellik kuralları buradan gelir (TAS-15).

## D-005 · 2026-10-03 · Docker yok (SUN-03)
- **Durum:** `docker` komutu bulunamadı.
- **Karar:** `.htaccess` dosyası httpd:2.4 konteynerinde test edilemiyor. Kurallar yerel Apache-benzeri sunucuda (`scripts/serve-dist.mjs`) aynı mantıkla taklit edilir ve doğrulama yayın sonrası smoke testine (`npm run smoke`) bırakılır.
- **Alternatifler:** Docker Desktop kurmak (kullanıcının sistemine kurulum gerektirir).

## D-006 · 2026-10-03 · Garanti çelişkisi (PRO-12, kullanıcıya soruldu)
- **Durum:** Kaynakta Kafa Masaj Yatağı "3 yıl garanti", Mayo Kurutucu "Garanti Süresi: 2 Yıl" diyor; §4 "5 yıl, bütün ürünlerde".
- **Karar (kullanıcı):** §4 geçerli. Bu iki kaynak ifadesi katalogdan çıkarılır (`data/overrides/specs.json` → exclude), `notes[]` içinde ve kapsam raporunda belirtilir; eksik-bilgiler.md'ye teyit maddesi eklenir.
- **Alternatifler:** Ürün bazında kaynak süresini göstermek; bu iki üründe garanti yazmamak.

## D-007 · 2026-10-03 · Grup sayfaları ve kategori yapısı (KAY-11, MIM-08)
- **yardimci-urunler:** bölündü. Farklı ürün tipindeki alt ürünler (portatif masaj sedyesi, portatif masaj yatağı, dinlenme sehpası, ayaklı büyüteç lamba, masaj yağı, kum ve yağ ısıtıcı) kendi adı ve görseliyle ayrı ürün oldu. Mayo kurutucu kendi URL'siyle birleştirildi (TZK-03).
- **bolster ve etejer:** tek "grup ürünü" sayfası olarak kaldı. Alt başlıklar aynı ürünün varyantları (5 bolster tipi, 11 etajer modeli) ve hiçbirinin ayrı teknik verisi ya da açıklaması yok. Ayrı sayfalar ince ve birbirine çok benzer içerik üretir (ICR-04/KAL-06 ile çelişir; çelişki sırası: doğruluk ve veri sadakati > SEO). Varyant adları galeride ve "Modeller" listesinde gösterilir. **Sapma:** KAY-11'in "kendi adı ve görseli varsa ayrı ürün" maddesinin varyantlara uygulanmaması.
- **Kategoriler (8):** Masaj Yatakları; Dinlenme Yatakları; Bakım ve Pedikür Koltukları; Manikür Masaları ve Koltukları; Havlu Isıtıcı ve Sterilizatörler; Sıcak Taş ve Isıtıcılar; Islak Alan Ürünleri; Aksesuar ve Yardımcı Ürünler.
  - Cilt bakım koltukları 2 ürünle 3'ün altında kaldı → en yakın kategori olan pedikür ile birleşti (podoloji koltuğu her iki alana da yakın).
  - Kaynaktaki "Tabureler" (1 ürün) → Aksesuar. Afüzyon duşları ve Ozon Kapsül kaynakta "cilt bakım/analiz" kategorisinde; işlevlerine göre Islak Alan'a alındı.
  - Ağda ısıtıcı ve kum-yağ ısıtıcı → Sıcak Taş ve Isıtıcılar (ısıtıcı ürünler).
- **Alternatifler:** SPEC'teki 9 kategorilik öneri (Cilt Bakım Koltukları ayrı) — 3 ürün kuralına takılıyor.

## D-008 · 2026-10-03 · Katalog şemasına `features` ve `variants` alanları
- **Karar:** KAY-20 alanlarına `features[{tr,en}]` (kaynağın listelediği standart donanım: "yüz boşluğu", "UV filtreli kabin" gibi) ve `variants[{tr,en}]` (grup ürün modelleri) eklendi. Görsellere `background`, `alt` ve `variant` alanları eklendi.
- **Gerekçe:** Kaynakta opsiyon olmayan ama ürünü tanımlayan donanım bilgisi var; bunları düzyazıya gömmek yerine katalogda tutmak KAY-21'in ruhuna uygun. Her özelliğin kaynakta kanıtı (`evidence`) build sırasında doğrulanır.
- **Madde içi teknik değerler:** "Minder kalınlığı 10 cm", "30 DNS", "üç motorlu", "35°" gibi değerler kaynak maddelerinden birebir alıntıyla (`quote`) alındı ve `from: "text"` olarak işaretlendi.

## D-009 · 2026-10-03 · Uranus görseli (TZK-01)
- **Durum:** `Uranus.webp` bütün ürün sayfalarında temanın CSS arka planı; Uranus Dinlenme Yatağı sayfasında ise ürünün kendi içerik görseli.
- **Karar:** Görseller yalnızca içerik alanından toplandığı için Uranus fotoğrafı yalnızca SD-030 Uranus Dinlenme Yatağı'nda kullanıldı; başka hiçbir üründe yok. `verify:data` bunu denetler.

## D-010 · 2026-10-03 · Fon sınıflandırması ve alt metinler
- **Fon:** KAY-16 eşikleri değiştirilmeden uygulandı (studio 23, scene 256). Kırpma sorunları Faz 2 ekran görüntüleriyle kontrol edilip `data/overrides/images.json` ile düzeltilecek.
- **Alt metinler:** 279 görselin içeriği tek tek betimlenmedi. Alt metin; ürün adı, varyant, çekim türü (açık zeminde ürün / uygulama ortamında) ve sıra numarasından üretilir; sayfa içinde benzersizdir ve "görsel/resim" ile başlamaz (ICR-13). Elle iyileştirme `images.json → overrides.<kod>.<NN>.alt` ile yapılabilir.
- **Alternatif:** Her görseli elle betimlemek (bağlamı ve süreyi orantısız tüketir).

## D-011 · 2026-10-03 · TZK-05 kararları
- `towel-warmer`, `havlu-isitici` ve `towel-warmer-wood` aynı teknik tabloyu paylaşıyor ama ortak görsel hash'i yok (SHA-256 eşleşmesi yok, dHash mesafesi > 6). Görseller farklı gövdeler gösteriyor: koyu ahşap kapaklı kabin / beyaz metal sıcak kabin / ahşap renk seçenekli kabin. Üçü ayrı ürün. Kanıt: `reports/gorsel-raporu.md` ve `data/source/images.json`.
- `podology-care-chair` ile `brand-bakim-koltugu` aynı tablo ve maddelere sahip ama görselleri farklı → ayrı ürün.

## D-012 · 2026-10-03 · Font alt kümeleri
- **Karar:** Google Fonts'un latin + latin-ext ikili dosyaları yerine fontTools ile Türkçeye özel tek dosya üretildi (Basic Latin, Latin-1, Ğğİıġ Şş ve tipografik işaretler). Inter wght 400–600 (opsz 14), Fraunces wght 400–600 (opsz 72, SOFT 0, WONK 0). Toplam 56 KB.
- **Alternatifler:** Google latin + latin-ext (Inter latin-ext tek başına 85 KB, TR sayfada toplam ~200 KB → 120 KB bütçesini aşar).
- **Araç:** `scripts/fonts/subset.py` (geliştirme anında, `.scratch/venv` içinde fonttools + brotli). Proje bağımlılığı değildir; çıktı woff2 dosyaları commit'lenir. Lisanslar `public/fonts-license.txt`.

## D-013 · 2026-10-03 · Taslak modu (yalnızca Faz 2)
- `SD_DRAFT=1` ile içerik dosyası olmayan sayfalar katalog verisiyle render edilir. Normal `npm run build`'de eksik TR/EN içerik build hatasıdır (ICR-14, `src/lib/content.ts`).

## D-014 · 2026-10-03 · Astro 7 Markdown işlemcisi (Sätteri)
- Astro 7'nin varsayılan işlemcisi Sätteri; remark eklentileri `@astrojs/markdown-remark` gerektiriyor. Ek bağımlılık yerine Sätteri hast eklentileri yazıldı (`src/lib/md-id-links.ts`: id linkleri ve `@kart SD-NNN` satır içi kartları). `@astrojs/markdown-satteri@0.4.2` Astro'nun kendi paketi; config'den doğrudan import edildiği için tam sürümle `dependencies`'e eklendi. Akıllı noktalama kapalı.

## D-015 · 2026-10-03 · 404 sayfasında canonical yok
- 404 sayfası her adreste gösterildiği için kendini gösteren canonical yanıltıcı olur; `noindex` ile birlikte canonical eklenmedi. Diğer bütün sayfalarda canonical var (SEO-04).

## D-016 · 2026-10-03 · Yerel sunucuda gzip
- `scripts/serve-dist.mjs`, `.htaccess`'teki DEFLATE listesiyle aynı türleri gzip'ler. Lighthouse ölçümleri yayın ortamına yakın olsun diye (PER-01/02 gzip'li boyutlara göre tanımlı).

## D-017 · 2026-10-03 · quote-index Astro endpoint'i olarak üretiliyor
- DON-05 "build sırasında hash'li quote-index" istiyor. Dosya postbuild yerine `src/pages/[file].json.ts` endpoint'iyle üretilir; hash `src/lib/quote-index.ts` içinde hesaplanır ve aynı değer `<body data-quote-index>` ile sayfalara verilir. Böylece HTML'i build sonrası değiştirmeye gerek kalmaz. Küçük görseller (`/thumbs/<kod>.webp`) postbuild'de üretilir.

## D-018 · 2026-10-03 · html-validate yapılandırması
- `html-validate:recommended` kullanılır. `tel-non-breaking` kapalı: numaralar zaten bölünmez boşlukla basılıyor (`nbsp()`), kural ayrıca ikon çevresindeki boşlukları ve "Hemen Ara" gibi etiketleri işaretliyor. `no-inline-style` açık (CSP ile satır içi stil kullanılmaz).

## D-019 · 2026-10-03 · İçerik üretimi ve kontrol
- İçerik 9 paralel alt ajanla yazıldı (PRO-06); ortak yönerge `docs/content-brief.md`. Her ajan `scripts/content-checks/run.mjs` ile KAL-05..08'i kendi dosyalarında 0'a indirdi; birleşik kontrol de 0 hata.
- Ürün kelime sayısı = giriş + öne çıkanlar + fiyat paragrafı + gövde (SSS ve description hariç). Ana sayfada SSS dahil toplam sayılır (ICR-03 "toplam").
- Ajanların varsayıma dayalı ifadeleri kaldırıldı: SD-002 (abhyanga/shirodhara örnekleri), SD-048 (çift tencerenin yan yana düzeni), SD-051 (tahta kaşığın kullanım amacı), SD-025 (mermer damar dokusu).
- Kardeş ürünlerde (aynı katalog verisi) metinler bunu açıkça söyler ve seçimi form, renk ve kullanım üzerinden anlatır.
- `data/derived-facts.json` rehberlerdeki sayıların kaynağıdır (ICR-07); aralık içeren alanlarda min/max üretilmez (yanıltıcı olmaması için).

## D-020 · 2026-10-03 · Yasaklı ifade listesi genişletildi (Ek D)
- TR: "kan dolaşımı", "dolaşımı hızlandır", "kas ağrı", "stresi azalt", "mucize". EN: "circulation", "relieves", "miracle". Liste daraltılmadı. TR eşleşmesi ek almayı yakalamak için önek eşleşmesidir ("lider" → "lideri").
- Kontrol hem içerik dosyalarında (KAL-07) hem de derlenmiş HTML'in görünen metninde (KAL-04) çalışır.

## D-021 · 2026-10-03 · Analytics parametreleri ve test yapısı
- ANL-07 değerleri snake_case: ürün kodları "SD-024" → "sd_024", `product_codes` virgülle ayrılır (≤ 100 karakter).
- Teklif listesi gönderiminde `sd:quote-send` DOM olayı yayınlanır (`{channel, url}`); testler e-posta ve WhatsApp URL'lerini buradan doğrular.
- KAL-16 için ayrı test build'i: `node scripts/qa/build-ga-test.mjs` → `dist-ga-test/` (G-TEST000000, analytics hostname "localhost"). `dist/` her zaman GA'sız teslim build'idir. Playwright iki sunucu açar (4322 dist, 4323 dist-ga-test).
- Odak örtülme testinde (ERS-03) `prefers-reduced-motion: reduce` öykünülür; yumuşak kaydırma bitmeden ölçüm yapılmasın diye.
- Teklif listesinde 2000 karakterlik wa.me sınırı: adlar çıkarılınca 30 ürün × 99 adet bile sığdığı için "gönderimi engelle" dalı gerçek verilerle tetiklenemiyor; kod yolu mevcut, "adları çıkar" dalı test ediliyor.

## D-022 · 2026-10-03 · 404 sayfasında Lighthouse "En İyi Uygulamalar" 96
- **Durum:** Gerçek 404 yanıtında Chrome, belgenin "404 (Not Found)" durumunu konsola yazar; Lighthouse bunu `errors-in-console` olarak sayar ve skoru 96 yapar. Sayfada başka hiçbir konsol hatası yoktur (KAL-15).
- **Karar:** 404 sayfası SAB-10/SUN-06 gereği 404 durum koduyla kalır. Bu tek ve kaçınılmaz bulgu, PER-01'deki 404 SEO istisnasıyla aynı gerekçeyle uyarı olarak raporlanır; 404'te başka bir BP sorunu çıkarsa kontrol hata verir.
- **Alternatif:** 404 sayfasını 200 ile sunmak (soft 404 — SEO açısından yanlış, reddedildi).

## D-023 · 2026-10-03 · TAS-11 düzyazıda ve sessiz render hatalarına karşı koruma
- Markdown düzyazısındaki marka adları (Spa Dünyası, Spa World), ürünlerin tam adları ve ayırt edici model adları (Avant, Ayurveda, Base W/X…, Evony, Mercury, Odessa, Uranus, Venus, Lux Soft, Spa Life) `<span translate="no">` ile sarılır (Sätteri metin eklentisi `noTranslate`). Tek başına sıradan İngilizce kelime olan model adları (Light, Soft, Classic, Moon, Wood…) yalnızca tam ürün adı içinde korunur; düz metinde yanlış eşleşmeyi önlemek için.
- Astro içerik katmanı Markdown render hatalarını loglayıp build'i başarılı bitirebiliyor. `npm run build` artık `scripts/build.mjs` ile çalışır ve `[ERROR]` satırında başarısız olur; ayrıca `verify:output` her içerik gövdesinin HTML'e basıldığını doğrular (`kal-04-rendered-content`, mutasyon testiyle kanıtlandı).
