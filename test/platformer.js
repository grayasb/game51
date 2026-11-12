// Проверка платформера: автоигрок с перебором на несколько шагов вперёд должен дойти до флага на каждом уровне.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'platformer', 'index.html'), 'utf8');
const src = html.split('//<core>')[1].split('//</core>')[0];
const Core = new Function(src + ';return Core;')();

const ACTS = [{ right: 1 }, { right: 1, jump: 1 }, {}, { jump: 1 }, { left: 1 }, { left: 1, jump: 1 }];
const HOLD = 8;
function rollout(s, seq) {
  const c = structuredClone(s), h0 = c.hearts;
  let sum = 0, n = 0;   // средний x по дороге: из двух одинаковых итогов лучше тот, где вперёд ушли раньше
  for (const a of seq) for (let i = 0; i < HOLD; i++) { Core.step(c, a); sum += c.p.x; n++; }
  // дальше без новых решений: в воздухе держим то же направление, на земле останавливаемся
  const lastA = seq[seq.length - 1], air = { left: lastA.left, right: lastA.right };
  for (let i = 0; i < 60 && c.status === 'play'; i++) { Core.step(c, c.p.ground ? {} : air); sum += c.p.x; n++; }
  if (c.status === 'win') return 1e6;
  return c.p.x + 0.05 * sum / n - (h0 - c.hearts) * 5000 - (c.status === 'dead' ? 1e5 : 0) + (c.p.ground ? 20 : 0);
}
function run(i) {
  const s = Core.start(i); let frames = 0, stuck = 0, bestX = 0;
  while (s.status === 'play' && frames < 60 * 240) {
    let best = -Infinity, act = ACTS[0];
    for (const a of ACTS) for (const b of ACTS) for (const c of ACTS) {
      const v = rollout(s, [a, b, c]); if (v > best) { best = v; act = a; }
    }
    for (let k = 0; k < HOLD && s.status === 'play'; k++) { Core.step(s, act); frames++; }
    if (s.p.x > bestX + 1) { bestX = s.p.x; stuck = 0; } else if (++stuck > 150) break;
  }
  return { status: s.status, frames, x: Math.round(s.p.x / 16), hearts: s.hearts, got: s.got, total: s.total, flag: s.flag };
}
let ok = true;
for (let i = 0; i < Core.LEVELS.length; i++) {
  const r = run(i);
  console.log('уровень ' + (i + 1) + ':', JSON.stringify(r));
  if (r.status !== 'win') ok = false;
}
if (!ok) { console.error('ПЛАТФОРМЕР: уровень не пройден'); process.exit(1); }
console.log('платформер: все уровни проходимы');
