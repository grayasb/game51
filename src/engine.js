// Движок правил «51». Чистая логика без интерфейса: работает и в браузере, и в Node.
(function (root) {
  'use strict';
  const I = (typeof module !== 'undefined' && module.exports) ? require('./i18n.js') : root.I51, tr = I.tr;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const DEALS = 9, OPEN_MIN = 51, HAND = 14;

  const isJ = c => c.r === 0;
  const rankVal = r => (r >= 2 && r <= 10) ? r : 10;          // туз (1 или 14) и картинки — 10
  const clone = o => JSON.parse(JSON.stringify(o));
  const validRun = (lo, hi) => lo >= 1 && hi <= 14 && !(lo === 1 && hi === 14);

  function mkDeck() {
    const d = []; let id = 0;
    for (let k = 0; k < 2; k++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ id: id++, r, s });
    for (let j = 0; j < 4; j++) d.push({ id: id++, r: 0, s: -1 });
    return d;
  }
  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- комбинации ----------
  // set: {type:'set', rank, cards}   run: {type:'run', suit, lo, cards} — карта i стоит на месте ранга lo+i
  function meldOptions(cards) {
    const out = [];
    const js = cards.filter(isJ), re = cards.filter(c => !isJ(c));
    if (cards.length < 3 || js.length > 1 || re.length < 2) return out;
    if (cards.length <= 4 && re.every(c => c.r === re[0].r) && new Set(re.map(c => c.s)).size === re.length)
      out.push({ type: 'set', rank: re[0].r, cards: [...re, ...js] });
    if (re.every(c => c.s === re[0].s)) {
      const suit = re[0].s, hasAce = re.some(c => c.r === 1);
      for (const high of (hasAce ? [false, true] : [false])) {
        const rk = re.map(c => ({ c, k: (c.r === 1 && high) ? 14 : c.r })).sort((a, b) => a.k - b.k);
        let dup = false;
        for (let i = 1; i < rk.length; i++) if (rk[i].k === rk[i - 1].k) dup = true;
        if (dup) continue;
        const mn = rk[0].k, mx = rk[rk.length - 1].k, gaps = mx - mn + 1 - rk.length;
        const real = rk.map(x => x.c);
        if (!js.length) {
          if (gaps === 0 && validRun(mn, mx)) out.push({ type: 'run', suit, lo: mn, cards: real });
        } else if (gaps === 1) {
          if (validRun(mn, mx)) {
            const arr = [];
            for (let k = mn, i = 0; k <= mx; k++) { if (rk[i].k === k) arr.push(rk[i++].c); else arr.push(js[0]); }
            out.push({ type: 'run', suit, lo: mn, cards: arr });
          }
        } else if (gaps === 0) {
          if (validRun(mn - 1, mx)) out.push({ type: 'run', suit, lo: mn - 1, cards: [js[0], ...real] });
          if (validRun(mn, mx + 1)) out.push({ type: 'run', suit, lo: mn, cards: [...real, js[0]] });
        }
      }
    }
    return out;
  }
  function cardValueIn(m, i) { return m.type === 'set' ? rankVal(m.rank) : rankVal(m.lo + i); }
  function meldValue(m) { let v = 0; for (let i = 0; i < m.cards.length; i++) v += cardValueIn(m, i); return v; }
  function jokerMeaning(m) {             // что заменяет джокер: {r,s} (s=-1 для группы)
    const i = m.cards.findIndex(isJ);
    if (i < 0) return null;
    return m.type === 'set' ? { r: m.rank, s: -1 } : { r: m.lo + i, s: m.suit };
  }

  // варианты докладывания карты к комбинации: {k:'add'|'swap', end:'lo'|'hi'|null, pts}
  function layoffOptions(m, card) {
    const out = [];
    const hasJ = m.cards.some(isJ);
    if (m.type === 'set') {
      const reals = m.cards.filter(c => !isJ(c));
      if (isJ(card)) { if (!hasJ && m.cards.length === 3) out.push({ k: 'add', end: null, pts: rankVal(m.rank) }); return out; }
      if (card.r !== m.rank || reals.some(c => c.s === card.s) || reals.length >= 4) return out;
      if (hasJ && reals.length === 3) out.push({ k: 'swap', end: null, pts: rankVal(m.rank) });
      else out.push({ k: 'add', end: null, pts: rankVal(m.rank) });
      return out;
    }
    const lo = m.lo, hi = m.lo + m.cards.length - 1;
    if (isJ(card)) {
      if (hasJ) return out;
      if (validRun(lo - 1, hi)) out.push({ k: 'add', end: 'lo', pts: rankVal(lo - 1) });
      if (validRun(lo, hi + 1)) out.push({ k: 'add', end: 'hi', pts: rankVal(hi + 1) });
      return out;
    }
    if (card.s !== m.suit) return out;
    const ks = card.r === 1 ? [1, 14] : [card.r];
    const ji = m.cards.findIndex(isJ);
    for (const k of ks) {
      if (k === lo - 1 && validRun(lo - 1, hi)) out.push({ k: 'add', end: 'lo', pts: rankVal(k) });
      if (k === hi + 1 && validRun(lo, hi + 1)) out.push({ k: 'add', end: 'hi', pts: rankVal(k) });
      if (ji >= 0 && lo + ji === k) out.push({ k: 'swap', end: null, pts: rankVal(k) });
    }
    return out;
  }

  // ---------- партия ----------
  function newGame(players, rnd) {
    // players: [{name, bot}]
    const n = players.length;
    return {
      players: players.map(p => ({ name: p.name, bot: !!p.bot, hand: [], opened: false, total: 0 })),
      dealer: Math.floor((rnd || Math.random)() * n),
      deal: 0, history: [], phase: 'idle', stock: [], discard: [], melds: [], nextMeld: 1, turn: null, log: []
    };
  }
  // сколько пар полностью одинаковых карт (масть и достоинство) на руке; джокеры не считаются
  function identicalPairs(hand) {
    const seen = {}; let pairs = 0;
    for (const c of hand) { if (isJ(c)) continue; const k = c.s * 14 + c.r; if (seen[k]) { pairs++; delete seen[k]; } else seen[k] = 1; }
    return pairs;
  }
  function startDeal(st, rnd) {
    rnd = rnd || Math.random;
    const n = st.players.length;
    if (st.deal > 0) st.dealer = (st.dealer + 1) % n;
    st.deal++;
    const notes = [];
    for (let tries = 0; ; tries++) {
      const deck = shuffle(mkDeck(), rnd);
      st.players.forEach(p => { p.hand = []; p.opened = false; });
      for (let i = 0; i < HAND; i++) for (let k = 1; k <= n; k++) st.players[(st.dealer + k) % n].hand.push(deck.pop());
      st.discard = [deck.pop()];
      st.stock = deck;
      // домашнее правило: три пары одинаковых карт у кого-то на руке — сразу пересдача, сдаёт следующий
      const who = st.players.findIndex(p => identicalPairs(p.hand) >= 3);
      if (who < 0 || tries >= 20) break;
      notes.push({ p: who, k: 'l_redeal' });
      st.dealer = (st.dealer + 1) % n;
    }
    st.melds = []; st.nextMeld = 1; st.result = null; st.phase = 'play';
    st.log = notes;
    beginTurn(st, (st.dealer + 1) % n);
  }
  function snap(st) {
    return clone({ hands: st.players.map(p => p.hand), stock: st.stock, discard: st.discard, melds: st.melds, nextMeld: st.nextMeld });
  }
  function restore(st, s) {
    s = clone(s);
    st.players.forEach((p, i) => { p.hand = s.hands[i]; });
    st.stock = s.stock; st.discard = s.discard; st.melds = s.melds; st.nextMeld = s.nextMeld;
  }
  function freshTurnCounters(t) { t.laidPts = 0; t.jokersLaid = 0; t.ownMelds = 0; t.adds = []; t.swapped = {}; }
  function beginTurn(st, p) {
    st.turn = { p, phase: 'draw', took: null, drew: null, wasOpened: st.players[p].opened, pre: null, post: null };
    freshTurnCounters(st.turn);
  }
  const err = msg => ({ ok: false, err: msg });
  const OK = { ok: true };

  function draw(st, src) {
    const t = st.turn, pl = st.players[t.p];
    if (st.phase !== 'play' || t.phase !== 'draw') return err(tr('e_nodraw'));
    t.pre = snap(st);
    if (src === 'discard') {
      if (!st.discard.length) return err(tr('e_discEmpty'));
      const c = st.discard.pop(); pl.hand.push(c); t.took = c.id; t.drew = c.id;
    } else {
      if (!st.stock.length) {
        if (!st.discard.length) { endDeal(st, -1); return OK; }
        st.stock = st.discard.reverse(); st.discard = [];           // сброс переворачивается, не мешается
        st.log.push({ k: 'l_flip' });
      }
      const c = st.stock.pop(); pl.hand.push(c); t.took = null; t.drew = c.id;
    }
    t.phase = 'play'; t.post = snap(st);
    return OK;
  }
  // отмена хода: взятое из сброса возвращается (снова выбор, откуда брать), взятое из колоды остаётся
  function resetTurn(st) {
    const t = st.turn;
    if (st.phase !== 'play' || t.phase !== 'play') return err(tr('e_noundo'));
    freshTurnCounters(t);
    if (t.took != null) { restore(st, t.pre); t.took = null; t.drew = null; t.phase = 'draw'; }
    else restore(st, t.post);
    return OK;
  }
  function takeCards(pl, ids) {
    const cards = [];
    for (const id of ids) { const c = pl.hand.find(x => x.id === id); if (!c || cards.includes(c)) return null; cards.push(c); }
    return cards;
  }
  // полная комбинация (4 масти без джокера или 13 карт ряда без джокера) уходит со стола наверх сброса; сброс игрока в конце хода ложится поверх
  function sweep(st, m) {
    if (m.cards.some(isJ)) return false;
    if (!(m.type === 'set' ? m.cards.length === 4 : m.cards.length === 13)) return false;
    st.melds = st.melds.filter(x => x !== m);
    st.discard.push(...m.cards);
    st.log.push(m.type === 'set' ? { k: 'l_sweepSet', a: RANKS[m.rank] } : { k: 'l_sweepRun', a: RANKS[m.lo] + '–' + RANKS[m.lo + 12] + SUITS[m.suit] });
    return true;
  }
  function playMeld(st, ids, optIndex) {
    const t = st.turn, pl = st.players[t.p];
    if (st.phase !== 'play' || t.phase !== 'play') return err(tr('e_drawFirst'));
    const cards = takeCards(pl, ids);
    if (!cards) return err(tr('e_noCards'));
    const opts = meldOptions(cards);
    if (!opts.length) return err(tr('e_notMeld'));
    if (pl.hand.length - cards.length < 1) return err(tr('e_keepOne'));
    const m = opts[optIndex || 0];
    m.id = st.nextMeld++; m.owner = t.p;
    pl.hand = pl.hand.filter(c => !ids.includes(c.id));
    st.melds.push(m);
    t.laidPts += meldValue(m); t.jokersLaid += m.cards.filter(isJ).length; t.ownMelds++;
    return { ok: true, meld: m, gone: sweep(st, m) };
  }
  function layoff(st, meldId, cardId, optIndex) {
    const t = st.turn, pl = st.players[t.p];
    if (st.phase !== 'play' || t.phase !== 'play') return err(tr('e_drawFirst'));
    const m = st.melds.find(x => x.id === meldId), card = pl.hand.find(c => c.id === cardId);
    if (!m || !card) return err(tr('e_noSuch'));
    const opts = layoffOptions(m, card);
    if (!opts.length) return err(tr('e_noFit'));
    const o = opts[optIndex || 0];
    if (o.k === 'add' && pl.hand.length - 1 < 1) return err(tr('e_keepOne'));
    pl.hand = pl.hand.filter(c => c.id !== cardId);
    t.laidPts += o.pts; if (isJ(card)) t.jokersLaid++;
    if (o.k === 'swap') {
      const ji = m.cards.findIndex(isJ), joker = m.cards[ji];
      if (m.type === 'set') { m.cards.splice(ji, 1); m.cards.push(card); } else m.cards[ji] = card;
      pl.hand.push(joker); t.swapped[m.id] = true;
      return { ok: true, swap: true, joker, gone: sweep(st, m) };
    }
    if (m.type === 'set') m.cards.push(card);
    else if (o.end === 'lo') { m.cards.unshift(card); m.lo--; }
    else m.cards.push(card);
    t.adds.push({ meld: m.id, type: m.type });
    return { ok: true, gone: sweep(st, m) };
  }
  // нужно ли игроку «открытие» за этот ход (замена джокера открытия не требует)
  function needsOpen(t) {
    return t.ownMelds > 0 || t.adds.some(a => !(a.type === 'set' && t.swapped[a.meld]));
  }
  function discard(st, cardId) {
    const t = st.turn, pl = st.players[t.p];
    if (st.phase !== 'play' || t.phase !== 'play') return err(tr('e_drawFirst'));
    const card = pl.hand.find(c => c.id === cardId);
    if (!card) return err(tr('e_noCards'));
    if (t.took != null && pl.hand.some(c => c.id === t.took))
      return err(tr('e_mustLay'));
    const laying = needsOpen(t);
    if (!t.wasOpened && laying) {
      if (t.ownMelds < 1) return err(tr('e_needOwn'));
      if (t.laidPts < OPEN_MIN) return err(tr('e_need51', t.laidPts));
    }
    pl.hand = pl.hand.filter(c => c.id !== cardId);
    st.discard.push(card);
    if (laying) pl.opened = true;
    if (!pl.hand.length) { endDeal(st, t.p); return { ok: true, end: true }; }
    beginTurn(st, (t.p + 1) % st.players.length);
    return OK;
  }
  function handPenalty(hand) { return hand.reduce((s, c) => s + (isJ(c) ? 15 : rankVal(c.r)), 0); }
  function endDeal(st, winner) {
    const t = st.turn;
    const oneMove = winner >= 0 && !t.wasOpened;
    const jokers = winner >= 0 ? t.jokersLaid : 0;
    const coef = oneMove ? (jokers === 0 ? 2 : jokers === 1 ? 1.5 : 1) : 1;
    const rows = st.players.map((p, i) => {
      if (i === winner) return { score: oneMove ? -40 : -20, base: 0, opened: true, winner: true };
      const base = p.opened ? handPenalty(p.hand) : 100;
      return { score: Math.floor(base * coef), base, opened: p.opened, winner: false };
    });
    rows.forEach((r, i) => { st.players[i].total += r.score; });
    st.result = { winner, oneMove, jokers, coef, rows, deal: st.deal };
    st.history.push(st.result);
    st.phase = st.deal >= DEALS ? 'gameEnd' : 'dealEnd';
  }

  const api = {
    SUITS, RANKS, DEALS, OPEN_MIN, isJ, rankVal, mkDeck, meldOptions, meldValue, cardValueIn, jokerMeaning,
    layoffOptions, newGame, startDeal, identicalPairs, draw, resetTurn, playMeld, layoff, discard, needsOpen, handPenalty, clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.E51 = api;
})(typeof window !== 'undefined' ? window : globalThis);
