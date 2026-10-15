import { TIERS, generateLevel, mulberry32, randomCandidate, pruneRedundant, ensureElements, solve, validateCandidate } from '../generator/generate-screens.js';
const tier = TIERS.find(t => t.level === Number(process.argv[2] ?? 7));
const dist = {}; const distPre = {};
let reached = 0, lengthenHelped = 0;
for (let i = 0; i < 8000; i++) {
  const rnd = mulberry32((i * 2654435761) >>> 0);
  const raw = randomCandidate(tier, rnd);
  if (!raw) continue;
  const pr = pruneRedundant(raw);
  if (!pr) continue;
  const f = ensureElements(pr, tier, rnd);
  if (!f) continue;
  reached++;
  const T = solve(f).length;
  dist[T] = (dist[T] || 0) + 1;
  // ¿por qué rechaza la validación?
  const v = validateCandidate(f, tier);
  if (!v.ok) { const k = v.reason.split('(')[0]; distPre[k] = (distPre[k]||0)+1; }
}
console.log('reached validation:', reached);
console.log('trueMin post-ensureElements:', Object.entries(dist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '));
console.log('rejects:', JSON.stringify(distPre));
