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
