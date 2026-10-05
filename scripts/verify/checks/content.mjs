// verify:content — KAL-05 originality, KAL-06 similarity, KAL-07 banned phrases + numbers, KAL-08 lengths/meta,
// ICR-14 TR/EN pairs. Logic lives in scripts/content-checks (also usable per file while writing).
import { runContentChecks } from '../../content-checks/run.mjs';

let cache = null;
const result = () => (cache ??= runContentChecks());
const TITLES = {
  'kal-05': 'Özgünlük: kaynakla ortak 8-gram yok',
  'kal-06': 'Site içi benzerlik: 5-gram Jaccard ≤ 0,20',
  'kal-07': 'Yasaklı ifadeler ve sayı bütünlüğü',
  'kal-08': 'Uzunluklar, title/description, ana kelime tekilliği',
  'ici-14': 'TR/EN içerik çiftleri',
};
export default Object.entries(TITLES).map(([id, title]) => ({
  id: `${id}-content`,
  title,
  async run(res) {
    const r = result();
    res.errors.push(...r.issues[id]);
    res.info = { entries: r.entries, maxJaccard: id === 'kal-06' ? r.maxJaccard : undefined, words: id === 'kal-08' ? r.stats : undefined };
  },
}));
