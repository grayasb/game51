// Боты для «51». Один вызов step() = одно действие бота (взять, выложить, доложить, сбросить).
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.E51;
  const isJ = E.isJ, rankVal = E.rankVal;
  const NODE_CAP = 60000, BONUS = 1000;
  const label = c => isJ(c) ? '★' : E.RANKS[c.r] + E.SUITS[c.s];
  const validRun = (lo, hi) => lo >= 1 && hi <= 14 && !(lo === 1 && hi === 14);

  // Лучшее разбиение руки на комбинации (максимум очков). mustId — карта, которую обязательно хочется пристроить.
  function bestMelds(hand, mustId) {
    const cnt = new Array(56).fill(0), pools = {}, jok = [];
    let mustKey = -9;
    for (const c of hand) {
      if (isJ(c)) { if (c.id === mustId) { jok.unshift(c); mustKey = -1; } else jok.push(c); continue; }
      const k = c.s * 14 + c.r; cnt[k]++;
      if (!pools[k]) pools[k] = [];
      if (c.id === mustId) { pools[k].unshift(c); mustKey = k; } else pools[k].push(c);
    }
    let J = jok.length, best = { v: -1, n: 0, melds: [] }, cur = [], curV = 0, curN = 0, nodes = 0;
    const kval = k => rankVal(k % 14);
    function apply(d, sign) {
      for (const k of d.keys) { if (k < 0) J -= sign; else cnt[k] -= sign; }
      curV += sign * d.v; curN += sign * d.keys.length;
      if (sign > 0) cur.push(d); else cur.pop();
    }
    function dfs(start) {
      if (++nodes > NODE_CAP) return;
      let k = start; while (k < 56 && !cnt[k]) k++;
      if (k >= 56) {
        if (curV > best.v || (curV === best.v && curN > best.n)) best = { v: curV, n: curN, melds: cur.slice() };
        return;
      }
      let rem = J * 10 + BONUS; for (let i = k; i < 56; i++) rem += cnt[i] * kval(i);
      if (curV + rem < best.v) return;
      const s = Math.floor(k / 14), r = k % 14, cands = [];
      // группы
      const others = []; for (let s2 = s + 1; s2 < 4; s2++) if (cnt[s2 * 14 + r]) others.push(s2 * 14 + r);
      const v = rankVal(r);
      for (let mask = 1; mask < (1 << others.length); mask++) {
        const sub = others.filter((_, i) => mask & (1 << i));
        if (sub.length >= 2) cands.push({ type: 'set', rank: r, keys: [k, ...sub], v: v * (sub.length + 1) });
        if (J > 0 && sub.length <= 2) cands.push({ type: 'set', rank: r, keys: [k, ...sub, -1], v: v * (sub.length + 2) });
      }
      // ряды
      for (const p of (r === 1 ? [1, 14] : [r])) {
        for (let a = Math.max(1, p - 12); a <= p; a++) for (let b = Math.max(p, a + 2); b <= Math.min(14, a + 12); b++) {
          if (!validRun(a, b)) continue;
          let miss = 0, missAt = -1, sum = 0;
          for (let x = a; x <= b && miss < 2; x++) {
            sum += rankVal(x);
            if (x === p) continue;
            if (!cnt[s * 14 + (x === 14 ? 1 : x)]) { miss++; missAt = x; }
          }
          if (miss > 1 || (miss === 1 && J < 1)) { if (miss > 1 && missAt > p) break; continue; }
          const mk = q => { const keys = []; for (let x = a; x <= b; x++) keys.push(x === q ? -1 : s * 14 + (x === 14 ? 1 : x)); return keys; };
          if (miss === 0) {
            cands.push({ type: 'run', suit: s, lo: a, keys: mk(-99), v: sum });
            if (J > 0 && b - a + 1 >= 3) {             // джокер с краю вместо настоящей карты (не вместо p)
              if (a !== p && b - a >= 2) cands.push({ type: 'run', suit: s, lo: a, keys: mk(a), v: sum });
              if (b !== p && b - a >= 2) cands.push({ type: 'run', suit: s, lo: a, keys: mk(b), v: sum });
            }
          } else cands.push({ type: 'run', suit: s, lo: a, keys: mk(missAt), v: sum });
        }
      }
      for (const d of cands) {
        if (d.keys.filter(x => x >= 0).length < 2) continue;
        // в ряду один и тот же ключ не может встречаться дважды (гарантирует validRun), проверим наличие
        let ok = true; for (const x of d.keys) if (x >= 0 && cnt[x] < 1) ok = false;
        if (!ok) continue;
        const bonus = d.keys.includes(mustKey) ? BONUS : 0;
        d.v += bonus; apply(d, 1); dfs(k); apply(d, -1); d.v -= bonus;
      }
      cnt[k]--; dfs(k); cnt[k]++;      // оставить карту в руке
    }
    dfs(0);
    // материализация: ключи -> конкретные карты
    const melds = best.melds.map(d => {
      const cards = d.keys.map(k => k < 0 ? jok.shift() : pools[k].shift());
      const m = { type: d.type, cards };
      if (d.type === 'set') m.rank = d.rank; else { m.suit = d.suit; m.lo = d.lo; }
      return m;
    });
    return melds;
  }
  function optIndexFor(m) {
    const opts = E.meldOptions(m.cards);
    const ji = m.cards.findIndex(isJ);
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      if (o.type !== m.type) continue;
      if (o.type === 'set') return i;
      if (o.lo === m.lo && o.cards.findIndex(isJ) === (ji < 0 ? -1 : o.cards.findIndex(c => c.id === m.cards[ji].id))) return i;
    }
    return -1;
  }
  const lvl = st => st.level || 'normal';
  // Что игрок брал из сброса в этой раздаче (это видят все за столом).
  function noteTake(st, p, card) {
    if (!card || isJ(card)) return;
    if (!st.takes || st.takes.deal !== st.deal) st.takes = { deal: st.deal, by: {} };
    (st.takes.by[p] = st.takes.by[p] || []).push({ r: card.r, s: card.s });
  }
  const takesOf = (st, p) => (st.takes && st.takes.deal === st.deal && st.takes.by[p]) || [];
  function canLayoff(st, card, kinds) {
    for (const m of st.melds) { const o = E.layoffOptions(m, card); if (o.some(x => !kinds || kinds.includes(x.k))) return true; }
    return false;
  }
  // План хода: какие комбинации выкладывать. passive = в этот ход на стол ничего не кладём.
  function evalPlan(st, hand, opened, mustId) {
    let melds = bestMelds(hand, mustId);
    let used = melds.reduce((s, m) => s + m.cards.length, 0);
    if (used >= hand.length && melds.length) {            // одну карту надо оставить на сброс
      let done = false;
      for (const m of melds) {
        if (m.cards.length < 4) continue;
        if (m.type === 'run') {
          const last = m.cards[m.cards.length - 1], first = m.cards[0];
          if (last.id !== mustId) { m.cards.pop(); done = true; }
          else if (first.id !== mustId) { m.cards.shift(); m.lo++; done = true; }
        } else {
          const i = m.cards.findIndex(c => c.id !== mustId && !isJ(c));
          if (i >= 0) { m.cards.splice(i, 1); done = true; }
        }
        if (done) break;
      }
      if (!done) {
        let wi = -1, wv = 1e9;
        melds.forEach((m, i) => { const v = E.meldValue(m); if (!m.cards.some(c => c.id === mustId) && v < wv) { wv = v; wi = i; } });
        if (wi >= 0) melds.splice(wi, 1); else melds = [];
      }
    }
    const usedIds = new Set(); melds.forEach(m => m.cards.forEach(c => usedIds.add(c.id)));
    const left = hand.filter(c => !usedIds.has(c.id));
    let total = melds.reduce((s, m) => s + E.meldValue(m), 0);
    const lay = [];
    for (const c of left) {
      let bestPts = 0;
      for (const m of st.melds) for (const o of E.layoffOptions(m, c)) if (o.k === 'add') bestPts = Math.max(bestPts, o.pts);
      if (bestPts) lay.push(bestPts);
    }
    lay.sort((a, b) => b - a);
    const maxLay = Math.max(0, left.length - 1);
    const layPts = lay.slice(0, maxLay).reduce((s, x) => s + x, 0);
    const must = mustId == null ? null : hand.find(c => c.id === mustId);
    const mustInMeld = must && usedIds.has(must.id);
    let passive = false;
    if (!opened && (melds.length < 1 || total + layPts < E.OPEN_MIN)) passive = true;
    const usesMust = !must || (!passive && (mustInMeld || (canLayoff(st, must) && left.length > 1)));
    const leftAfter = left.length - Math.min(lay.length, maxLay);
    return { melds, passive, usesMust, total: total + layPts, leftAfter };
  }
  function wantDiscard(st, p) {
    const pl = st.players[p], top = st.discard[st.discard.length - 1];
    if (!top) return false;
    const plan = evalPlan(st, pl.hand.concat([top]), pl.opened, top.id);
    return !plan.passive && plan.usesMust;
  }
  function chooseDiscard(st, p) {
    const pl = st.players[p], lv = lvl(st), n = st.players.length;
    let cands = pl.hand.filter(c => !isJ(c));
    if (!cands.length) cands = pl.hand;
    if (lv === 'easy' && Math.random() < 0.25) return cands[Math.floor(Math.random() * cands.length)];
    const nx = (p + 1) % n, next = st.players[nx], nextTakes = takesOf(st, nx);
    const danger = st.players.some((q, i) => i !== p && q.opened && q.hand.length <= 5);
    let best = null, bs = 1e9;
    for (const c of cands) {
      let s = 0;
      if (!isJ(c)) {
        for (const d of pl.hand) {
          if (d === c || isJ(d)) continue;
          if (d.r === c.r && d.s !== c.s) s += 2;
          else if (d.s === c.s) {
            const dist = Math.min(Math.abs(d.r - c.r), c.r === 1 ? Math.abs(d.r - 14) : 99, d.r === 1 ? Math.abs(14 - c.r) : 99);
            if (dist === 1) s += 2; else if (dist === 2) s += 1;
          }
        }
        if (canLayoff(st, c, ['add'])) s += 2;
      }
      s = s * 100 - rankVal(c.r) + Math.random() * (lv === 'easy' ? 150 : 3);     // при равной пользе сбрасываем подороже
      if (lv === 'hard' && !isJ(c)) {
        // не подкармливать следующего игрока
        if (next.opened && canLayoff(st, c, ['add', 'swap'])) s += 400;
        for (const x of nextTakes) { if (x.r === c.r && x.s !== c.s) s += 120; else if (x.s === c.s && Math.abs(x.r - c.r) <= 2) s += 90; }
        // кто-то вот-вот закончит — сбрасываем дорогие карты
        if (danger) s -= rankVal(c.r) * 30;
      }
      if (s < bs) { bs = s; best = c; }
    }
    return best;
  }

  function step(st) {
    const t = st.turn, p = t.p, pl = st.players[p];
    if (t.phase === 'draw') {
      if (!t.giveUp && !(lvl(st) === 'easy' && Math.random() < 0.5) && wantDiscard(st, p)) {
        const top = st.discard[st.discard.length - 1];
        E.draw(st, 'discard'); noteTake(st, p, top); return { k: 'l_disc', a: label(top) };
      }
      E.draw(st, 'stock'); return { k: 'l_stock' };
    }
    const fail = () => { E.resetTurn(st); st.turn.giveUp = true; st.turn.plan = null; return step(st); };
    if (!t.giveUp) {
      if (!t.plan) {
        const pre = evalPlan(st, pl.hand, pl.opened || t.ownMelds > 0, t.took);
        const lv = lvl(st), fresh = !pl.opened && !t.ownMelds && t.took == null;
        if (!t.replans) t.lazy = lv === 'easy' && Math.random() < 0.3;      // лёгкий бот иногда «не замечает» докладку
        if (fresh && !pre.passive) {
          if (lv === 'easy' && Math.random() < 0.2) pre.passive = true;    // прозевал открытие
          if (lv === 'hard' && pre.leftAfter === 2) {
            // придержать карты, чтобы выйти за один ход: только пока это безопасно
            const safe = st.players.every((q, i) => i === p || q.hand.length >= 11) && st.stock.length >= 15;
            st.holds = st.holds && st.holds.deal === st.deal ? st.holds : { deal: st.deal, by: {} };
            if (safe && (st.holds.by[p] || 0) < 2) { st.holds.by[p] = (st.holds.by[p] || 0) + 1; pre.passive = true; }
          }
        }
        t.plan = { melds: pre.melds.map(m => ({ ids: m.cards.map(c => c.id), opt: optIndexFor(m) })), passive: pre.passive };
        if (pre.passive) t.plan.melds = [];
        t.replans = (t.replans || 0) + 1;
      }
      if (t.plan.melds.length) {
        const m = t.plan.melds.shift();
        const r = m.opt < 0 ? { ok: false } : E.playMeld(st, m.ids, m.opt);
        if (!r.ok) return fail();
        return { k: 'l_meld', a: r.meld.cards.map(label).join(' ') };
      }
      if (!t.plan.passive && !t.lazy) {
        // забрать джокер со стола
        for (const m of st.melds) for (const c of pl.hand) {
          const opts = E.layoffOptions(m, c), i = opts.findIndex(o => o.k === 'swap');
          if (i >= 0) {
            E.layoff(st, m.id, c.id, i);
            if (t.replans < 4) t.plan = null;
            return { k: 'l_swap', a: label(c) };
          }
        }
        // доложить (взятую из сброса — первой)
        const order = pl.hand.slice().sort((a, b) => (b.id === t.took) - (a.id === t.took) || rankVal(b.r) - rankVal(a.r));
        if (pl.hand.length > 1) for (const c of order) for (const m of st.melds) {
          const opts = E.layoffOptions(m, c);
          let bi = -1; opts.forEach((o, i) => { if (o.k === 'add' && (bi < 0 || o.pts > opts[bi].pts)) bi = i; });
          if (bi >= 0) { const r = E.layoff(st, m.id, c.id, bi); if (r.ok) return { k: 'l_add', a: label(c) }; }
        }
      }
    }
    const d = chooseDiscard(st, p);
    const r = E.discard(st, d.id);
    if (!r.ok) { if (t.giveUp) throw new Error('bot stuck: ' + r.err); return fail(); }
    return { k: r.end ? 'l_dropEnd' : 'l_drop', a: label(d) };
  }

  const api = { step, bestMelds, evalPlan, label, noteTake };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.B51 = api;
})(typeof window !== 'undefined' ? window : globalThis);
