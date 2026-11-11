(function () {
  'use strict';
  const E = window.E51, B = window.B51, I = window.I51, tr = I.tr, ME = 0, KEY = 'game51-v1';
  const BOTS = { ru: ['Айна', 'Батыр', 'Вера', 'Гена', 'Дарья'], en: ['Aina', 'Batyr', 'Vera', 'Gena', 'Darya'] };
  let st = null, sel = new Set(), order = [], sortMode = null, msg = '', msgErr = false, timer = null, modal = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lbl = B.label;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* не запомнится */ } } };

  I.setLang(store.get(KEY + '-lang') || ((navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en'));

  function save() { store.set(KEY, JSON.stringify({ st, order, sortMode })); }
  function load() {
    try { const d = JSON.parse(store.get(KEY)); if (d && d.st && d.st.players && d.st.turn) { st = d.st; order = d.order || []; sortMode = d.sortMode === 'suit' || d.sortMode === 'rank' ? d.sortMode : null; return true; } } catch (e) { /* нет сохранения */ }
    return false;
  }
  function say(t, isErr) { msg = t || ''; msgErr = !!isErr; }
  function log(p, k, a) { st.log.push({ p, k, a }); if (st.log.length > 40) st.log.splice(0, st.log.length - 40); }
  // имя игрока на текущем языке (боты и имя по умолчанию переводятся)
  function pname(p) {
    if (!p.bot) return (p.name === 'Вы' || p.name === 'You') ? tr('you') : p.name;
    let i = BOTS.ru.indexOf(p.name); if (i < 0) i = BOTS.en.indexOf(p.name);
    return i < 0 ? p.name : BOTS[I.getLang()][i];
  }
  function logText(x) {
    if (typeof x === 'string') return x;
    const body = tr(x.k, x.a);
    return x.p == null ? body : pname(st.players[x.p]) + ': ' + body;
  }

  const LEVELS = ['easy', 'normal', 'hard'];
  function savedLevel() { const l = store.get(KEY + '-level'); return LEVELS.includes(l) ? l : 'normal'; }
  // свои имена ботов (пустая строка — имя по умолчанию, переводится)
  function botNames() { try { const a = JSON.parse(store.get(KEY + '-bots') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function newGame(name, n, level) {
    const ps = [{ name: name || tr('you'), bot: false }], custom = botNames();
    for (let i = 0; i < n - 1; i++) ps.push({ name: custom[i] || BOTS.ru[i], bot: true });
    st = E.newGame(ps); st.level = LEVELS.includes(level) ? level : 'normal'; store.set(KEY + '-level', st.level); E.startDeal(st);
    afterDeal();
  }
  function afterDeal() { sel.clear(); modal = null; say(''); sortHand(sortMode || 'suit'); save(); render(); tick(); }
  // выбранная раскладка держится сама: новая карта встаёт на своё место; перетаскивание её отключает
  function sortHand(mode) {
    sortMode = mode;
    const h = st.players[ME].hand.slice();
    const key = c => E.isJ(c) ? 9999 : (mode === 'suit' ? c.s * 20 + c.r : c.r * 10 + c.s);
    h.sort((a, b) => key(a) - key(b));
    order = h.map(c => c.id);
  }
  function myHand() {
    if (sortMode && !(drag && drag.on)) sortHand(sortMode);
    const h = st.players[ME].hand.slice();
    const pos = id => { const i = order.indexOf(id); return i < 0 ? 1e6 + id : i; };
    h.sort((a, b) => pos(a.id) - pos(b.id));
    order = h.map(c => c.id);
    return h;
  }

  // ---------- отрисовка ----------
  function cardHTML(c, tag, cls, sub) {
    const a = tag === 'button' ? ` data-act="card" data-id="${c.id}"` : '';
    if (E.isJ(c)) return `<${tag} class="card joker ${cls || ''}"${a} aria-label="${tr('joker')}"><span class="rk">★</span><span class="jk">${sub || tr('joker')}</span></${tag}>`;
    const red = c.s === 1 || c.s === 2;
    return `<${tag} class="card ${red ? 'red' : ''} ${cls || ''}"${a} aria-label="${lbl(c)}"><span class="rk${c.r === 10 ? ' ten' : ''}">${E.RANKS[c.r]}</span><span class="su">${E.SUITS[c.s]}</span></${tag}>`;
  }
  function jokerSub(m) {
    const j = E.jokerMeaning(m); if (!j) return '';
    return '=' + E.RANKS[j.r] + (j.s >= 0 ? E.SUITS[j.s] : '');
  }
  function meldText(m) { return m.cards.map(c => E.isJ(c) ? '★(' + jokerSub(m) + ')' : lbl(c)).join(' '); }
  function pills(p) { return `<span class="pill ${p.opened ? 'open' : ''}">${p.opened ? tr('opened') : tr('notOpened')}</span>`; }
  function dealerTag(i) { return st.dealer === i ? ` <span class="dl">${tr('dealer')}</span>` : ''; }

  const narrow = window.matchMedia('(max-width:600px)');
  narrow.addEventListener('change', () => render());
  function renderStatic() {
    document.documentElement.lang = I.getLang();
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    $('bLang').title = tr('langTitle');
  }
  function render() {
    if (!st) return;
    renderStatic();
    const t = st.turn, n = st.players.length, playing = st.phase === 'play';
    const myTurn = playing && t.p === ME, me = st.players[ME];
    if (!playing && !modal) modal = { type: 'result' };
    $('deal').textContent = tr('deal', st.deal, E.DEALS) + ' · ' + tr('lv_short_' + (st.level || 'normal'));

    let h = '';
    const m = n - 1, slots = { top: '', left: '', right: '' };
    for (let k = 1; k < n; k++) {             // по часовой стрелке от вас: слева, напротив, справа
      const i = (ME + k) % n, p = st.players[i];
      const slot = (m === 1 || narrow.matches) ? 'top' : k === 1 ? 'left' : k === m ? 'right' : 'top';
      slots[slot] += `<div class="seat ${playing && t.p === i ? 'active' : ''}"><div class="nm"><button class="nmb" data-act="names" title="${tr('nm_edit')}">${esc(pname(p))}</button>${dealerTag(i)}<b class="tot">${p.total}</b></div>
        <div class="backs" aria-label="${tr('cardsInHand', p.hand.length)}">${'<i></i>'.repeat(p.hand.length)}<b>${p.hand.length}</b></div>
        <div class="meta">${pills(p)}<span>${tr('score')}: <b>${p.total}</b></span></div></div>`;
    }
    $('topSeats').innerHTML = slots.top; $('leftSeat').innerHTML = slots.left; $('rightSeat').innerHTML = slots.right;
    $('log').innerHTML = st.log.slice(-2).map(x => `<div>${esc(logText(x))}</div>`).join('');

    h = '';
    // подсветка: куда подходят выбранные карты (или что предложила подсказка)
    const fit = myTurn && t.phase === 'play' ? H51.fitting(st, ME, [...sel]) : new Set();
    if (hintMeld != null && myTurn) fit.add(hintMeld);
    for (const md of st.melds) {
      const js = jokerSub(md);
      h += `<button class="meld ${fit.has(md.id) ? 'fit' : ''}" data-act="meld" data-mid="${md.id}" title="${tr('layHere')}">${md.cards.map(c => cardHTML(c, 'span', 'sm', js)).join('')}</button>`;
    }
    $('table').innerHTML = h || `<p class="empty">${tr('emptyTable')}</p>`;

    const top = st.discard[st.discard.length - 1];
    const canDraw = myTurn && t.phase === 'draw';
    $('piles').innerHTML =
      `<button class="pile ${canDraw ? 'hot' : ''}" data-act="stock" ${canDraw ? '' : 'disabled'}><span class="card back"><span class="cntb">${st.stock.length}</span></span><span class="cap">${tr('stock')}</span></button>
       <button class="pile ${canDraw && top ? 'hot' : ''}" data-act="disc" ${canDraw && top ? '' : 'disabled'}>${top ? cardHTML(top, 'span') : '<span class="card none"></span>'}<span class="cap">${tr('discardPile')}</span></button>`;

    let status = msg;
    if (!status) {
      if (!playing) status = tr('s_over');
      else if (!myTurn) status = tr('s_turnOf', pname(st.players[t.p]));
      else status = tr(t.phase === 'draw' ? 's_draw' : 's_play');
    }
    $('status').textContent = status; $('status').className = msgErr ? 'err' : '';

    const laying = myTurn && t.phase === 'play' && !t.wasOpened && E.needsOpen(t);
    $('me').innerHTML = `<span class="nm"><button class="nmb" data-act="names" title="${tr('nm_edit')}">${esc(pname(me))}</button>${dealerTag(ME)}</span>${pills(me)}
      ${laying ? `<span class="pill ${t.laidPts >= E.OPEN_MIN ? 'open' : 'warn'}">${tr('laid', t.laidPts)}</span>` : ''}
      <span>${tr('score')}: <b>${me.total}</b></span>`;
    $('me').className = myTurn ? 'active' : '';

    renderHand();
    const play = myTurn && t.phase === 'play';
    $('bMeld').disabled = !(play && sel.size >= 3);
    $('bDisc').disabled = !(play && sel.size === 1);
    $('bUndo').disabled = !play;
    $('bHint').disabled = !myTurn;
    renderScore();
    renderModal();
  }
  // панель счёта: на широком экране стоит рядом со столом, на узком выезжает справа
  let scoreOpen = (() => { const v = store.get(KEY + '-score'); return v != null ? v === '1' : window.innerWidth >= 1280; })();
  function renderScore() {
    const el = $('score'), ps = st.players, min = Math.min(...ps.map(p => p.total));
    el.classList.toggle('closed', !scoreOpen);
    $('bScore').setAttribute('aria-expanded', scoreOpen);
    let h = `<div class="sh"><h2>${tr('p_title')}</h2><button class="btn ghost sm" data-act="toggleScore" aria-label="${tr('p_hide')}">✕</button></div><table><thead><tr><th class="dn">№</th>` +
      ps.map(p => `<th class="num" title="${esc(pname(p))}">${esc(pname(p))}</th>`).join('') + '</tr></thead><tbody>';
    for (let d = 1; d <= E.DEALS; d++) {
      const r = st.history[d - 1];
      h += `<tr class="${!r && d === st.deal ? 'cur' : ''}"><td class="dn">${d}</td>` + ps.map((p, i) => `<td class="num ${r && r.rows[i].winner ? 'winc' : ''}">${r ? fmt(r.rows[i].score) : (d === st.deal ? '…' : '')}</td>`).join('') + '</tr>';
    }
    h += '<tr class="sum"><td class="dn">Σ</td>' + ps.map(p => `<td class="num ${st.history.length && p.total === min ? 'lead' : ''}"><b>${p.total}</b></td>`).join('') + '</tr></tbody></table>' +
      `<p class="note">${tr('p_note')}</p>`;
    el.innerHTML = h;
  }
  function renderHand() {
    const t = st.turn, myTurn = st.phase === 'play' && t.p === ME;
    $('hand').innerHTML = myHand().map(c => cardHTML(c, 'button', (sel.has(c.id) ? 'sel ' : '') + (myTurn && t.drew === c.id ? 'new ' : '') + (drag && drag.on && drag.id === c.id ? 'drag' : ''))).join('');
    fitHand();
    for (const [id, mode] of [['bSortS', 'suit'], ['bSortR', 'rank']]) { $(id).classList.toggle('on', sortMode === mode); $(id).setAttribute('aria-pressed', sortMode === mode); }
  }
  // на телефоне рука идёт одним рядом: чем меньше карт, тем шире шаг между ними
  function fitHand() {
    const el = $('hand'), n = el.children.length;
    if (!narrow.matches || n < 2) { el.style.removeProperty('--step'); el.classList.remove('wrap'); return; }
    const cs = getComputedStyle(el), cw = parseFloat(cs.getPropertyValue('--cw')) || 58;
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let step = Math.min(cw * 0.8, (room - cw) / (n - 1));
    const wrap = step < 19;                        // карт слишком много для одного ряда — переносим на второй
    if (wrap) step = Math.min(cw * 0.8, (room - cw) / (Math.ceil(n / 2) - 1));
    el.classList.toggle('wrap', wrap);
    el.style.setProperty('--step', Math.floor(step) + 'px');
  }
  window.addEventListener('resize', () => { if (st) fitHand(); });
  // перетаскивание карт в руке: порядок меняется сразу, пока тянете
  let drag = null, dragEnd = 0;
  $('hand').addEventListener('pointerdown', ev => {
    const el = ev.target.closest('.card'); if (!el || ev.button > 0) return;
    drag = { id: +el.dataset.id, x: ev.clientX, y: ev.clientY, on: false };
  });
  document.addEventListener('pointermove', ev => {
    if (!drag) return;
    if (!drag.on) { if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 10) return; drag.on = true; sortMode = null; renderHand(); }
    const el = document.elementFromPoint(ev.clientX, ev.clientY), tgt = el && el.closest('#hand .card');
    if (!tgt) return;
    const tid = +tgt.dataset.id; if (tid === drag.id) return;
    const r = tgt.getBoundingClientRect(), after = ev.clientX > r.left + r.width * 0.35;
    order = order.filter(x => x !== drag.id);
    order.splice(order.indexOf(tid) + (after ? 1 : 0), 0, drag.id);
    renderHand();
  });
  const dragStop = () => { if (!drag) return; const was = drag.on; drag = null; if (was) { dragEnd = Date.now(); save(); renderHand(); } };
  document.addEventListener('pointerup', dragStop);
  document.addEventListener('pointercancel', dragStop);

  function renderModal() {
    const box = $('modal');
    if (!modal) { box.hidden = true; box.innerHTML = ''; return; }
    let h = '';
    if (modal.type === 'choose') {
      h = `<h2>${esc(modal.title)}</h2><div class="opts">` + modal.options.map((o, i) => `<button class="btn" data-act="opt" data-i="${i}">${esc(o.label)}</button>`).join('') +
        `</div><div class="row"><button class="btn ghost" data-act="close">${tr('cancel')}</button></div>`;
    } else if (modal.type === 'result') {
      const r = st.result, end = st.phase === 'gameEnd';
      const head = r.winner < 0 ? tr('r_noWinner') : tr('r_won', esc(pname(st.players[r.winner])));
      let note = '';
      if (r.oneMove) note = tr('r_oneMove', r.jokers) + ' ' + (r.coef > 1 ? tr('r_coef', I.getLang() === 'ru' ? String(r.coef).replace('.', ',') : r.coef) : tr('r_nocoef'));
      h = `<h2>${tr('r_title', r.deal, head)}</h2>${note ? `<p class="note">${note}</p>` : ''}<div class="tw"><table><thead><tr><th>${tr('th_player')}</th><th>${tr('th_left')}</th><th class="num">${tr('th_deal')}</th><th class="num">${tr('th_total')}</th></tr></thead><tbody>` +
        st.players.map((p, i) => `<tr class="${r.rows[i].winner ? 'win' : ''}"><td>${esc(pname(p))}</td><td class="rest">${r.rows[i].winner ? tr('r_out') : (r.rows[i].opened ? '' : tr('r_notOpened') + ' · ') + p.hand.map(lbl).join(' ')}</td><td class="num">${fmt(r.rows[i].score)}</td><td class="num"><b>${p.total}</b></td></tr>`).join('') + '</tbody></table></div>';
      if (end) {
        const min = Math.min(...st.players.map(p => p.total));
        const w = st.players.filter(p => p.total === min).map(pname).join(', ');
        h += `<p class="final">${tr('g_over', '<b>' + esc(w) + '</b>', min)}</p><div class="row"><button class="btn ghost" data-act="scores">${tr('b_table')}</button><button class="btn" data-act="new">${tr('b_newGame')}</button></div>`;
      } else h += `<div class="row"><button class="btn ghost" data-act="scores">${tr('b_table')}</button><button class="btn" data-act="next">${tr('b_next')}</button></div>`;
    } else if (modal.type === 'scores') {
      h = `<h2>${tr('sc_title')}</h2><div class="tw"><table><thead><tr><th>№</th>` + st.players.map(p => `<th class="num">${esc(pname(p))}</th>`).join('') + '</tr></thead><tbody>' +
        st.history.map(r => `<tr><td>${r.deal}</td>` + r.rows.map(x => `<td class="num ${x.winner ? 'winc' : ''}">${fmt(x.score)}</td>`).join('') + '</tr>').join('') +
        `<tr class="sum"><td>Σ</td>` + st.players.map(p => `<td class="num"><b>${p.total}</b></td>`).join('') + '</tr></tbody></table></div>' +
        (st.history.length ? '' : `<p class="note">${tr('sc_none')}</p>`) + `<div class="row"><button class="btn" data-act="close">${tr('close')}</button></div>`;
    } else if (modal.type === 'names') {
      let b = 0;
      h = `<h2>${tr('nm_title')}</h2><form id="fNames" class="names">` + st.players.map((p, i) => {
        const lab = i === ME ? tr('nm_you') : tr('nm_bot', ++b);
        return `<label for="nm${i}">${lab}</label><input id="nm${i}" maxlength="14" value="${esc(pname(p))}" autocomplete="off">`;
      }).join('') + `<p class="note">${tr('nm_note')}</p><div class="row"><button type="button" class="btn ghost" data-act="close">${tr('cancel')}</button><button class="btn" type="submit">${tr('nm_save')}</button></div></form>`;
    } else if (modal.type === 'new') {
      h = `<h2>${tr('b_newGame')}</h2><form id="fNew"><label for="inName">${tr('n_name')}</label><input id="inName" maxlength="14" value="${esc(st ? pname(st.players[ME]) : tr('you'))}">
        <label for="inN">${tr('n_players')}</label><select id="inN">${[2, 3, 4, 5, 6].map(x => `<option value="${x}" ${x === 4 ? 'selected' : ''}>${tr('n_opt', x, x - 1)}</option>`).join('')}</select>
        <label for="inL">${tr('n_level')}</label><select id="inL">${LEVELS.map(l => `<option value="${l}" ${l === ((st && st.level) || savedLevel()) ? 'selected' : ''}>${tr('lv_' + l)}</option>`).join('')}</select>
        <p class="note">${tr('n_reset')}</p><div class="row"><button type="button" class="btn ghost" data-act="close">${tr('cancel')}</button><button class="btn" type="submit">${tr('n_dealBtn')}</button></div></form>`;
    } else if (modal.type === 'rules') {
      h = $('rules-' + I.getLang()).innerHTML + `<div class="row"><button class="btn" data-act="close">${tr('close')}</button></div>`;
    }
    box.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + h + '</div>';
    box.hidden = false;
  }
  const fmt = x => (x > 0 ? '+' : '') + x;

  // ---------- действия игрока ----------
  function act(r, okText) {
    if (!r.ok) { say(r.err, true); return false; }
    say(okText || ''); return true;
  }
  function doMeld() {
    const ids = [...sel], cards = ids.map(id => st.players[ME].hand.find(c => c.id === id));
    const opts = E.meldOptions(cards);
    const go = i => { const r = E.playMeld(st, ids, i); if (act(r)) { st.log.splice(r.gone ? st.log.length - 1 : st.log.length, 0, { p: ME, k: 'l_meld', a: meldText(r.meld) }); sel.clear(); } done(); };
    if (opts.length > 1) { modal = { type: 'choose', title: tr('c_joker'), options: opts.map((o, i) => ({ label: meldText(o), fn: () => go(i) })) }; render(); }
    else go(0);
  }
  function doLayoff(mid) {
    const m = st.melds.find(x => x.id === mid), hand = st.players[ME].hand;
    if (!sel.size) { say(tr('m_pickFirst'), true); return render(); }
    const one = (id, i) => {
      const c = hand.find(x => x.id === id), r = E.layoff(st, mid, id, i);
      if (r.ok) { sel.delete(id); st.log.splice(r.gone ? st.log.length - 1 : st.log.length, 0, { p: ME, k: r.swap ? 'l_swap' : 'l_add', a: lbl(c) }); if (r.swap) say(tr('m_gotJoker')); }
      return r;
    };
    if (sel.size === 1) {
      const id = [...sel][0], c = hand.find(x => x.id === id), opts = E.layoffOptions(m, c);
      if (opts.length > 1) {
        modal = { type: 'choose', title: tr('c_where'), options: opts.map((o, i) => ({ label: o.k === 'swap' ? tr('c_swap') : tr(o.end === 'lo' ? 'c_lo' : 'c_hi', o.pts), fn: () => { const r = one(id, i); if (!r.ok) say(r.err, true); done(); } })) };
        return render();
      }
      const r = one(id, 0); if (!r.ok) say(r.err, true); else if (!r.swap) say('');
      return done();
    }
    let progress = true, any = false, gone = false; say('');
    while (progress && !gone) {
      progress = false;
      for (const id of [...sel]) { const c = hand.find(x => x.id === id); if (c && E.layoffOptions(m, c).length) { const r = one(id, 0); if (r.ok) { progress = true; any = true; if (r.gone) { gone = true; break; } } } }
    }
    if (sel.size) say(tr(any ? 'm_notAll' : 'm_none'), true);
    done();
  }
  function doDiscard() {
    const id = [...sel][0], c = st.players[ME].hand.find(x => x.id === id);
    const r = E.discard(st, id);
    if (act(r)) { log(ME, r.end ? 'l_dropEnd' : 'l_drop', lbl(c)); sel.clear(); }
    done();
  }
  let hintMeld = null;
  function done() { hintMeld = null; if (modal && modal.type === 'choose') modal = null; save(); render(); tick(); }

  function tick() {
    clearTimeout(timer);
    if (!st || st.phase !== 'play' || !st.players[st.turn.p].bot) return;
    const p = st.turn.p;
    timer = setTimeout(() => {
      let ev;
      try { ev = B.step(st); }
      catch (e) {           // страховка: бот просто берёт и сбрасывает
        if (st.turn.phase === 'play') E.resetTurn(st);
        if (st.turn.phase === 'draw') E.draw(st, 'stock');
        if (st.phase === 'play') { const h = st.players[p].hand; E.discard(st, h[h.length - 1].id); }
        ev = { k: 'l_pass' };
      }
      log(p, ev.k, ev.a);
      save(); render(); tick();
    }, st.turn.phase === 'draw' ? 550 : 800);
  }

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
    const a = el.dataset.act, t = st.turn, myTurn = st.phase === 'play' && t.p === ME;
    if (a === 'card') { if (Date.now() - dragEnd < 350) return; const id = +el.dataset.id; if (sel.has(id)) sel.delete(id); else sel.add(id); hintMeld = null; if (msgErr) say(''); render(); }
    else if (a === 'bHint') { const r = H51.hint(st, ME); sel = new Set(r.select); hintMeld = r.meld; say(tr.apply(null, [r.k].concat(r.a))); render(); }
    else if (a === 'stock' && myTurn) { if (act(E.draw(st, 'stock'))) log(ME, 'l_stock'); done(); }
    else if (a === 'disc' && myTurn) {
      const top = st.discard[st.discard.length - 1];
      if (act(E.draw(st, 'discard'), tr('m_took'))) { log(ME, 'l_disc', lbl(top)); B.noteTake(st, ME, top); }
      done();
    }
    else if (a === 'meld' && myTurn && t.phase === 'play') doLayoff(+el.dataset.mid);
    else if (a === 'bMeld') doMeld();
    else if (a === 'bDisc') doDiscard();
    else if (a === 'bUndo') { if (act(E.resetTurn(st), tr('m_undone'))) sel.clear(); done(); }
    else if (a === 'sortS') { sortHand('suit'); save(); render(); }
    else if (a === 'sortR') { sortHand('rank'); save(); render(); }
    else if (a === 'opt') modal.options[+el.dataset.i].fn();
    else if (a === 'toggleScore') { scoreOpen = !scoreOpen; store.set(KEY + '-score', scoreOpen ? '1' : '0'); render(); }
    else if (a === 'lang') { I.setLang(I.getLang() === 'ru' ? 'en' : 'ru'); store.set(KEY + '-lang', I.getLang()); say(''); render(); }
    else if (a === 'close') { modal = null; render(); }
    else if (a === 'scores') { modal = { type: 'scores' }; render(); }
    else if (a === 'rules') { modal = { type: 'rules' }; render(); }
    else if (a === 'new') { modal = { type: 'new' }; render(); }
    else if (a === 'names') { modal = { type: 'names' }; render(); const f = $('nm' + ME); if (f && window.innerWidth > 700) f.focus(); }
    else if (a === 'next') { E.startDeal(st); afterDeal(); }
  });
  document.addEventListener('submit', ev => {
    ev.preventDefault();
    if (ev.target.id === 'fNew') newGame($('inName').value.trim() || tr('you'), +$('inN').value, $('inL').value);
    if (ev.target.id === 'fNames') {
      const custom = botNames(); let b = 0;
      st.players.forEach((p, i) => {
        const v = ($('nm' + i).value || '').trim().replace(/\s+/g, ' ').slice(0, 14);
        if (i === ME) { p.name = v || tr('you'); return; }
        const k = b++, def = BOTS.ru[k] || p.name;
        if (!v || v === BOTS.ru[k] || v === BOTS.en[k]) { p.name = def; custom[k] = ''; } else { p.name = v; custom[k] = v; }
      });
      store.set(KEY + '-bots', JSON.stringify(custom));
      modal = null; save(); render();
    }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && modal && modal.type !== 'result') { modal = null; render(); } });

  // сохранённая партия могла остаться от старой версии — если не рисуется, начинаем новую
  let resumed = false;
  try { if (load()) { render(); resumed = true; tick(); } } catch (e) { st = null; modal = null; resumed = false; store.set(KEY, ''); }
  if (!resumed) newGame(tr('you'), 4, savedLevel());

  // внутри Telegram: имя игрока и язык берём из профиля, если человек сам их ещё не выбирал
  if (window.TG51 && window.TG51.active) window.TG51.onUser(user => {
    if (!user || !st) return;
    if (!store.get(KEY + '-lang') && user.language_code) I.setLang(String(user.language_code).toLowerCase().startsWith('ru') ? 'ru' : 'en');
    const me = st.players[ME], first = String(user.first_name || '').trim().replace(/\s+/g, ' ').slice(0, 14);
    if (first && (me.name === 'Вы' || me.name === 'You')) { me.name = first; save(); }
    render();
  });
})();
