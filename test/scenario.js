// Ситуация со скриншота пользователя
const E=require('../src/engine.js'),assert=require('assert');
let id=1;const c=(r,s)=>({id:id++,r,s});const J=()=>({id:id++,r:0,s:-1});
const S=0,H=1,D=2,C=3;
const st=E.newGame([{name:'Вы'},{name:'a',bot:true},{name:'b',bot:true},{name:'c',bot:true}],()=>0.5);E.startDeal(st,Math.random);
const M=(o)=>Object.assign(o,{id:st.nextMeld++,owner:1});
st.melds=[M({type:'run',suit:S,lo:9,cards:[c(9,S),c(10,S),c(11,S)]}),M({type:'run',suit:D,lo:11,cards:[c(11,D),c(12,D),J(),c(1,D)]}),
 M({type:'run',suit:D,lo:6,cards:[c(6,D),J(),c(8,D)]}),M({type:'set',rank:7,cards:[c(7,H),c(7,D),c(7,C)]}),
 M({type:'set',rank:12,cards:[c(12,S),c(12,H),c(12,C)]}),M({type:'run',suit:H,lo:1,cards:[c(1,H),c(2,H),c(3,H),c(4,H)]}),
 M({type:'set',rank:10,cards:[c(10,D),c(10,C),c(10,S),J()]})];
const h={s3:c(3,S),h2:c(2,H),h5:c(5,H),h6:c(6,H),h10:c(10,H),hQ:c(12,H),d2:c(2,D),d3:c(3,D),d7:c(7,D),dQ:c(12,D),dK:c(13,D),c8:c(8,C),c5:c(5,C),d5:c(5,D),d2b:c(2,D)};
st.turn.p=0;st.turn.phase='play';st.turn.wasOpened=false;st.players[0].opened=false;st.players[0].hand=Object.values(h);
const ok=(r,what)=>{console.log(what,'->',r.ok?'ок':'ОТКАЗ: '+r.err,'| выложено',st.turn.laidPts);assert(r.ok)};
ok(E.playMeld(st,[h.h5.id,h.c5.id,h.d5.id]),'три пятёрки');
ok(E.layoff(st,st.melds[1].id,h.dK.id),'K♦ вместо джокера');
ok(E.layoff(st,st.melds[2].id,h.d7.id),'7♦ вместо джокера');
const tens=st.melds.find(m=>m.type==='set'&&m.rank===10);
let r=E.layoff(st,tens.id,h.h10.id);ok(r,'10♥ к десяткам (джокер забран, группа ушла: '+r.gone+')');
const jk=st.players[0].hand.filter(E.isJ);console.log('джокеров в руке',jk.length);
ok(E.playMeld(st,[h.d2.id,h.d3.id,jk[0].id],1),'2♦ 3♦ джокер');
ok(E.layoff(st,st.melds.find(m=>m.type==='set'&&m.rank===12).id,h.dQ.id),'Q♦ к дамам');
r=E.discard(st,h.s3.id);ok(r,'сброс 3♠');
console.log('открыт:',st.players[0].opened,'осталось карт:',st.players[0].hand.length);

// --- отмена по шагам ---
{
  let id = 1; const c = (r, s) => ({ id: id++, r, s });
  const st = E.newGame([{ name: 'Вы' }, { name: 'b', bot: true }], () => 0.5); E.startDeal(st, Math.random);
  const run = [c(9, 0), c(10, 0), c(11, 0)], set = [c(5, 1), c(5, 2), c(5, 3)], extra = [c(12, 0), c(2, 3)];
  st.melds = []; st.players[0].hand = [...run, ...set, ...extra];
  st.turn.p = 0; st.turn.wasOpened = false; st.players[0].opened = false;
  st.discard.push(c(13, 0)); st.stock.push(c(4, 2));
  assert(E.draw(st, 'stock').ok && !E.canUndo(st), 'после взятия из колоды отменять нечего');
  assert(!E.undoStep(st).ok);
  assert(E.playMeld(st, run.map(x => x.id)).ok);                        // шаг 1: ряд 9-10-J = 29
  assert(E.playMeld(st, set.map(x => x.id)).ok);                        // шаг 2: три пятёрки = 15
  assert(E.layoff(st, st.melds[0].id, extra[0].id).ok);                 // шаг 3: дама к ряду = 10
  assert(st.turn.laidPts === 54 && st.melds.length === 2 && st.players[0].hand.length === 2);
  let r = E.undoStep(st); assert(r.ok && r.left === 2 && st.turn.laidPts === 44 && st.melds[0].cards.length === 3 && st.players[0].hand.length === 3, 'шаг 3 отменён');
  r = E.undoStep(st); assert(r.ok && r.left === 1 && st.turn.laidPts === 29 && st.melds.length === 1 && st.turn.ownMelds === 1, 'шаг 2 отменён');
  assert(E.playMeld(st, set.map(x => x.id)).ok && st.turn.laidPts === 44, 'после отмены можно сыграть иначе');
  r = E.undoStep(st); r = E.undoStep(st);
  assert(r.ok && r.left === 0 && st.melds.length === 0 && st.turn.laidPts === 0 && st.players[0].hand.length === 9, 'всё вернулось в руку');
  assert(!E.undoStep(st).ok && st.turn.phase === 'play', 'карта из колоды остаётся');
  // взятие из сброса отменяется последним шагом
  const st2 = E.newGame([{ name: 'Вы' }, { name: 'b', bot: true }], () => 0.5); E.startDeal(st2, Math.random);
  const k = c(13, 0), h2 = [c(11, 0), c(12, 0), c(3, 1)];
  st2.players[0].hand = h2.slice(); st2.turn.p = 0; st2.discard.push(k);
  assert(E.draw(st2, 'discard').ok && E.canUndo(st2));
  assert(E.playMeld(st2, [h2[0].id, h2[1].id, k.id]).ok);
  r = E.undoStep(st2); assert(r.ok && !r.untook && st2.turn.phase === 'play' && st2.players[0].hand.length === 4);
  r = E.undoStep(st2); assert(r.ok && r.untook && st2.turn.phase === 'draw' && st2.discard[st2.discard.length - 1].id === k.id && st2.players[0].hand.length === 3, 'карта вернулась в сброс');
  console.log('отмена по шагам: ок');
}
