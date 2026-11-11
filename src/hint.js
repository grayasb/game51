// Подсказка игроку в его ход: что взять, что выложить, сколько не хватает до 51.
// Смотрит только то, что видит сам игрок: свою руку, стол и верх сброса.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('./engine.js') : root.E51;
  const B = node ? require('./bots.js') : root.B51;

  // результат: { k: ключ строки, a: [аргументы], select: [id карт], meld: id комбинации на столе или null }
  function hint(st, me) {
    const t = st.turn, pl = st.players[me];
    if (st.phase !== 'play' || t.p !== me) return { k: 'h_notTurn', a: [], select: [], meld: null };
    const hand = pl.hand;
    if (t.phase === 'draw') {
      const top = st.discard[st.discard.length - 1];
      if (top) {
        const p = B.evalPlan(st, hand.concat([top]), pl.opened, top.id);
        if (!p.passive && p.usesMust) return { k: 'h_drawDisc', a: [B.label(top)], select: [], meld: null };
      }
      return { k: 'h_drawStock', a: [], select: [], meld: null };
    }
    // что можно положить из руки (как будто уже открыт — чтобы посчитать весь потенциал)
    const plan = B.evalPlan(st, hand, true, t.took);
    const meldsText = plan.melds.map(m => m.cards.map(B.label).join(' ')).join(' · ');
    const layCard = () => {
      for (const c of hand) for (const m of st.melds) {
        const o = E.layoffOptions(m, c);
        if (o.some(x => x.k === 'swap') || (o.some(x => x.k === 'add') && hand.length > 1)) return { c, m };
      }
      return null;
    };
    if (!t.wasOpened && t.laidPts >= E.OPEN_MIN && t.ownMelds > 0) {
      // открытие уже набрано в этот ход: можно добавить ещё или сбросить
      if (plan.melds.length) return { k: 'h_meld', a: [meldsText], select: plan.melds[0].cards.map(c => c.id), meld: null };
      const lc0 = layCard();
      if (lc0) return { k: 'h_lay', a: [B.label(lc0.c)], select: [lc0.c.id], meld: lc0.m.id };
      return { k: 'h_openDone', a: [t.laidPts], select: [], meld: null };
    }
    if (!t.wasOpened) {
      const laid = t.laidPts, sum = laid + plan.total;
      const canOwn = t.ownMelds > 0 || plan.melds.length > 0;
      if (sum >= E.OPEN_MIN && canOwn) {
        if (plan.melds.length) return { k: laid ? 'h_openMore' : 'h_open', a: [sum, meldsText, laid], select: plan.melds[0].cards.map(c => c.id), meld: null };
        const lc = layCard();
        if (lc) return { k: 'h_lay', a: [B.label(lc.c)], select: [lc.c.id], meld: lc.m.id };
      }
      if (!laid && !plan.melds.length) return { k: 'h_nothing51', a: [E.OPEN_MIN], select: [], meld: null };
      return { k: laid ? 'h_shortLaid' : 'h_short', a: [sum, E.OPEN_MIN - sum, laid, meldsText], select: [], meld: null };
    }
    if (plan.melds.length) return { k: 'h_meld', a: [meldsText], select: plan.melds[0].cards.map(c => c.id), meld: null };
    const lc = layCard();
    if (lc) return { k: 'h_lay', a: [B.label(lc.c)], select: [lc.c.id], meld: lc.m.id };
    return { k: 'h_none', a: [], select: [], meld: null };
  }
  // комбинации на столе, к которым подходит хоть одна из выбранных карт
  function fitting(st, me, selIds) {
    const hand = st.players[me].hand, out = new Set();
    for (const id of selIds) {
      const c = hand.find(x => x.id === id); if (!c) continue;
      for (const m of st.melds) if (E.layoffOptions(m, c).length) out.add(m.id);
    }
    return out;
  }
  const api = { hint, fitting };
  if (node) module.exports = api; else root.H51 = api;
})(typeof window !== 'undefined' ? window : globalThis);
