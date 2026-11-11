// Прогон партий бот-против-бота с проверкой инвариантов.
const E = require('../src/engine.js'), B = require('../src/bots.js');
const H = require('../src/hint.js');
const assert = require('assert');

// --- точечные тесты правил ---
const C = (r, s, id) => ({ id: id || (r * 10 + s + 1000 * Math.random() | 0), r, s });
const Jk = id => ({ id: id || 900, r: 0, s: -1 });
let o = E.meldOptions([C(8, 0, 1), C(8, 1, 2), Jk(3)]); assert(o.length === 1 && o[0].type === 'set' && E.meldValue(o[0]) === 24);
o = E.meldOptions([C(8, 0, 1), C(8, 0, 2), C(8, 1, 3)]); assert(o.length === 0, 'две одной масти в группе');
o = E.meldOptions([C(12, 2, 1), C(13, 2, 2), C(1, 2, 3)]); assert(o.length === 1 && o[0].lo === 12 && E.meldValue(o[0]) === 30);
o = E.meldOptions([C(1, 2, 1), C(2, 2, 2), C(3, 2, 3)]); assert(o.length === 1 && o[0].lo === 1 && E.meldValue(o[0]) === 15, 'туз=10');
o = E.meldOptions([C(13, 2, 1), C(1, 2, 2), C(2, 2, 3)]); assert(o.length === 0, 'через угол нельзя');
o = E.meldOptions([C(7, 1, 1), C(8, 1, 2), Jk(3)]); assert(o.length === 2, 'джокер с края: 6 или 9');
o = E.meldOptions([C(6, 1, 1), C(8, 1, 2), Jk(3)]); assert(o.length === 1 && E.meldValue(o[0]) === 21);
o = E.meldOptions([C(6, 1, 1), Jk(4), C(8, 1, 2), Jk(3)]); assert(o.length === 0, 'два джокера');
// замена джокера в ряду и в группе
let run = E.meldOptions([C(6, 1, 1), C(8, 1, 2), Jk(3)])[0];
assert(E.layoffOptions(run, C(7, 1, 9)).some(x => x.k === 'swap'));
assert(!E.layoffOptions(run, C(7, 2, 9)).length);
let set = E.meldOptions([C(8, 0, 1), C(8, 1, 2), Jk(3)])[0];
let lo = E.layoffOptions(set, C(8, 2, 9)); assert(lo.length === 1 && lo[0].k === 'add', 'первая восьмёрка — доложить');
set.cards.push(C(8, 2, 9));
lo = E.layoffOptions(set, C(8, 3, 10)); assert(lo.length === 1 && lo[0].k === 'swap', 'вторая — забрать джокер');
assert(!E.layoffOptions(set, C(8, 0, 11)).length);

// --- сценарий: открытие, подсчёт ---
function rig(hands, table) {
  const st = E.newGame(hands.map((h, i) => ({ name: 'P' + i, bot: true })), () => 0.5);
  E.startDeal(st, Math.random);
  st.players.forEach((p, i) => p.hand = hands[i]);
  st.melds = table || [];
  st.turn.p = 0; st.turn.wasOpened = false;
  return st;
}
{ // выход за один ход без джокеров: всем x2, победителю -40
  let id = 1; const c = (r, s) => ({ id: id++, r, s });
  const h0 = [c(1, 0), c(2, 0), c(3, 0), c(4, 0), c(5, 0), c(10, 1), c(11, 1), c(12, 1), c(13, 1), c(9, 2), c(9, 3), c(9, 0), c(7, 3), c(7, 2)];
  const h1 = [c(5, 1), c(6, 1), { id: id++, r: 0, s: -1 }];
  const st = rig([h0, h1]);
  st.stock.push(c(7, 0));
  assert(E.draw(st, 'stock').ok);
  assert(!E.playMeld(st, h0.slice(0, 2).map(x => x.id)).ok);
  assert(E.playMeld(st, h0.slice(0, 5).map(x => x.id)).ok);
  assert(!E.discard(st, h0[13].id).ok, 'меньше 51 — нельзя');
  assert(E.playMeld(st, h0.slice(5, 9).map(x => x.id)).ok);
  assert(E.playMeld(st, h0.slice(9, 12).map(x => x.id)).ok);
  const seven = st.players[0].hand.filter(x => x.r === 7);
  assert(seven.length === 3);
  assert(!E.playMeld(st, seven.map(x => x.id)).ok, 'надо оставить карту на сброс');
  st.players[0].hand.push(c(2, 2));
  assert(E.playMeld(st, seven.map(x => x.id)).ok);
  const last = st.players[0].hand[0];
  const r = E.discard(st, last.id); assert(r.ok && r.end);
  assert.deepStrictEqual(st.result.rows.map(x => x.score), [-40, 200]);
}
{ // обычный конец: открытый считает руку (джокер 15), неоткрытый 100
  let id = 1; const c = (r, s) => ({ id: id++, r, s });
  const st = rig([[c(5, 0), c(6, 0)], [c(13, 1), { id: 99, r: 0, s: -1 }, c(1, 2)], [c(2, 2)]],
    [{ id: 1, owner: 0, type: 'run', suit: 0, lo: 2, cards: [c(2, 0), c(3, 0), c(4, 0)] }]);
  st.players[0].opened = true; st.players[1].opened = true; st.turn.wasOpened = true;
  st.stock.push(c(9, 3));
  E.draw(st, 'stock');
  assert(E.layoff(st, 1, st.players[0].hand[0].id).ok);
  assert(E.layoff(st, 1, st.players[0].hand[0].id).ok);
  const r = E.discard(st, st.players[0].hand[0].id); assert(r.ok && r.end);
  assert.deepStrictEqual(st.result.rows.map(x => x.score), [-20, 35, 100]);
}
{ // из сброса: нужно выложить, иначе сброс запрещён; отмена возвращает карту
  let id = 1; const c = (r, s) => ({ id: id++, r, s });
  const st = rig([[c(5, 0), c(6, 0), c(9, 1)], [c(2, 2)]]);
  st.discard.push(c(7, 0));
  E.draw(st, 'discard');
  assert(!E.discard(st, st.players[0].hand[2].id).ok);
  assert(E.resetTurn(st).ok && st.turn.phase === 'draw' && st.discard[st.discard.length - 1].r === 7 && st.players[0].hand.length === 3);
}
console.log('точечные тесты правил: ок');

// --- массовая симуляция ---
const N = +process.argv[2] || 200;
let deals = 0, turnsTotal = 0, maxTurns = 0, noWinner = 0, oneMove = 0, stuck = 0, flips = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 5);
  const st = E.newGame(Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: true })), Math.random);
  st.level = ['easy', 'normal', 'hard'][g % 3];            // все три уровня ботов
  while (st.phase !== 'gameEnd') {
    E.startDeal(st, Math.random);
    // правило пересдачи: после раздачи ни у кого нет трёх пар одинаковых карт
    for (const p of st.players) {
      const seen = {}; let pairs = 0;
      for (const c of p.hand) { if (E.isJ(c)) continue; const k = c.s * 14 + c.r; if (seen[k]) { pairs++; delete seen[k]; } else seen[k] = 1; }
      assert(pairs < 3, 'три пары одинаковых карт после раздачи');
    }
    let steps = 0;
    while (st.phase === 'play') {
      const before = st.log.length;
      if (steps % 7 === 0) { const h = H.hint(st, st.turn.p); assert(h && typeof h.k === 'string' && Array.isArray(h.select), 'подсказка'); }
      B.step(st); steps++;
      // инвариант: 108 разных карт
      const ids = new Set();
      st.players.forEach(p => p.hand.forEach(c => ids.add(c.id)));
      st.stock.forEach(c => ids.add(c.id)); st.discard.forEach(c => ids.add(c.id));
      st.melds.forEach(m => m.cards.forEach(c => ids.add(c.id)));
      const cnt = st.players.reduce((s, p) => s + p.hand.length, 0) + st.stock.length + st.discard.length + st.melds.reduce((s, m) => s + m.cards.length, 0);
      assert(ids.size === 108 && cnt === 108, 'карты потерялись: ' + ids.size + '/' + cnt);
      for (const m of st.melds) {
        assert(m.cards.filter(E.isJ).length <= 1 && m.cards.length >= 3);
        const again = E.meldOptions(m.cards);
        assert(again.some(x => x.type === m.type && (m.type === 'set' || x.lo === m.lo)), 'невалидная комбинация на столе ' + JSON.stringify(m));
      }
      flips += st.log.length - before;
      if (steps > 20000) { stuck++; break; }
    }
    if (st.phase === 'play') { st.phase = 'dealEnd'; st.deal >= 9 && (st.phase = 'gameEnd'); continue; }
    deals++; turnsTotal += steps; maxTurns = Math.max(maxTurns, steps);
    if (st.result.winner < 0) noWinner++;
    if (st.result.oneMove) oneMove++;
  }
  assert(st.history.length === 9 || stuck);
}
console.log({ games: N, deals, avgSteps: Math.round(turnsTotal / deals), maxSteps: maxTurns, noWinner, oneMove, stuck, flips, sec: (Date.now() - t0) / 1000 });
{ // полная группа и полный ряд уходят в сброс
  let id = 1; const c = (r, s) => ({ id: id++, r, s });
  const st = E.newGame([{ name: 'a' }, { name: 'b' }], () => 0.5); E.startDeal(st, Math.random);
  const run = []; for (let r = 2; r <= 13; r++) run.push(c(r, 0));
  st.melds = [{ id: 1, owner: 0, type: 'set', rank: 8, cards: [c(8, 0), c(8, 1), c(8, 2)] }, { id: 2, owner: 0, type: 'run', suit: 0, lo: 2, cards: run },
    { id: 3, owner: 0, type: 'set', rank: 9, cards: [c(9, 0), c(9, 1), c(9, 2), { id: 500, r: 0, s: -1 }] }];
  const h = [c(8, 3), c(1, 0), c(9, 3), c(4, 1), c(5, 1)];
  st.players[st.turn.p].hand = h.slice(); st.players[st.turn.p].opened = true; st.turn.wasOpened = true; st.turn.phase = 'play';
  const d0 = st.discard.length;
  assert(E.layoff(st, 1, h[0].id).gone && st.melds.length === 2 && st.discard.length === d0 + 4);
  assert(E.layoff(st, 2, h[1].id).gone && st.melds.length === 1 && st.discard.length === d0 + 17);
  const r = E.layoff(st, 3, h[2].id); assert(r.swap && r.gone && st.melds.length === 0, 'после замены джокера группа полная');
  assert(st.discard.slice(-4).some(x => x.id === h[2].id), 'уходит наверх сброса');
  assert(E.discard(st, h[3].id).ok && st.discard[st.discard.length - 1].id === h[3].id, 'свой сброс ложится поверх');
  console.log('полные комбинации: ок');
}
