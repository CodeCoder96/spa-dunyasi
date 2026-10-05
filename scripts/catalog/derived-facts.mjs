// Derived facts for guides and category texts (ICR-07): every value is computed from the catalog and
// stored with its method so prose numbers can be traced (ICR-12). Output: data/derived-facts.json
import { readFile, writeFile } from 'node:fs/promises';
import { slugify } from '../../src/lib/slug.ts';

const ROOT = new URL('../../', import.meta.url);
const cat = JSON.parse(await readFile(new URL('data/catalog/products.json', ROOT), 'utf8'));
const NAMES = {
  'masaj-yataklari': 'Masaj Yatakları', 'dinlenme-yataklari': 'Dinlenme Yatakları', 'bakim-ve-pedikur-koltuklari': 'Bakım ve Pedikür Koltukları',
  manikur: 'Manikür', 'havlu-ve-sterilizatorler': 'Havlu ve Sterilizatörler', 'sicak-tas-ve-isiticilar': 'Sıcak Taş ve Isıtıcılar',
  'islak-alan': 'Islak Alan', aksesuar: 'Aksesuar',
};
const facts = [];
const add = (id, value, method, codes) => facts.push({ id, value, method, codes });

for (const [c, name] of Object.entries(NAMES)) {
  const items = cat.filter((p) => p.category === c);
  add(`${c}.count`, `${items.length} adet`, `"${name}" kategorisindeki katalog ürünlerinin sayısı`, items.map((p) => p.code));
  const keys = [...new Set(items.flatMap((p) => p.specs.map((s) => s.key)))];
  for (const key of keys) {
    const withKey = items.filter((p) => p.specs.some((s) => s.key === key));
    const raws = withKey.map((p) => p.specs.find((s) => s.key === key).valueRaw);
    const distinct = [...new Set(raws)];
    add(`${c}.${key}.values`, distinct.join(' / '), `${name}: "${key}" alanının katalogdaki farklı değerleri (${withKey.length} ürün)`, withKey.map((p) => p.code));
    // Numeric min/max for simple "<n> <unit>" values.
    const simple = raws.map((r) => r.match(/^(\d+(?:[.,]\d+)?)\s*(cm|kg|mm|lt|V|W)$/i)).filter(Boolean);
    // Only when every value is a plain number + unit; ranges like "68-85 cm" would make min/max misleading.
    if (simple.length >= 2 && simple.length === raws.length) {
      const unit = simple[0][2];
      if (simple.every((m) => m[2] === unit)) {
        const nums = simple.map((m) => Number(m[1].replace(',', '.')));
        add(`${c}.${key}.min`, `${Math.min(...nums)} ${unit}`, `${name}: "${key}" en küçük değer (${simple.length} ürün)`, withKey.map((p) => p.code));
        add(`${c}.${key}.max`, `${Math.max(...nums)} ${unit}`, `${name}: "${key}" en büyük değer (${simple.length} ürün)`, withKey.map((p) => p.code));
        const mode = [...nums.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0];
        add(`${c}.${key}.most`, `${mode[0]} ${unit}`, `${name}: "${key}" en sık değer (${mode[1]}/${simple.length} ürün)`, withKey.map((p) => p.code));
      }
    }
  }
  // Motor configurations from text specs.
  const motors = items.filter((p) => p.specs.some((s) => s.key === 'motor_options'));
  if (motors.length) {
    for (const v of [...new Set(motors.map((p) => p.specs.find((s) => s.key === 'motor_options').valueRaw))]) {
      const codes = motors.filter((p) => p.specs.find((s) => s.key === 'motor_options').valueRaw === v).map((p) => p.code);
      add(`${c}.motor.${slugify(v)}`, `${codes.length} adet`, `${name}: motor bilgisi "${v}" olan ürün sayısı`, codes);
    }
  }
}
add('catalog.count', `${cat.length} adet`, 'Katalogdaki toplam ürün sayısı', cat.map((p) => p.code));
await writeFile(new URL('data/derived-facts.json', ROOT), JSON.stringify({ _doc: 'Catalog-derived facts (ICR-07). Regenerate with node scripts/catalog/derived-facts.mjs.', generatedFrom: 'data/catalog/products.json', facts }, null, 2) + '\n');
console.log(`facts=${facts.length}`);
