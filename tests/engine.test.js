const assert = require('assert');
const C = require('../public/js/game-core.js');

function test(name, fn){ try{fn(); console.log('✓',name);}catch(e){console.error('✗',name);throw e;} }

test('Shogi başlangıcında 40 taş vardır',()=>{
  const s=C.createShogiState(); assert.equal(s.board.filter(Boolean).length,40);
});

test('Shogi başlangıcında sente için yasal hamle vardır',()=>{
  const s=C.createShogiState(); assert(C.getLegalActions(s).length>20);
});

test('Shogi piyon bir kare ileri gider',()=>{
  const s=C.createShogiState();
  const from=C.idx(6,4),to=C.idx(5,4);
  assert(C.getLegalActions(s).some(a=>a.kind==='move'&&a.from===from&&a.to===to));
});

test('Shogi nifu aynı sütuna piyon bırakmayı engeller',()=>{
  const s=C.createShogiState(); s.hands[0].P=1;
  const actions=C.getLegalActions(s);
  assert(!actions.some(a=>a.kind==='drop'&&a.piece==='P'&&C.rc(a.to)[1]===4));
});

test('Shogi son sıraya piyon bırakılmaz',()=>{
  const s=C.createShogiState(); s.hands[0].P=1;
  // mevcut piyonları kaldır ki nifu sonucu karıştırmasın
  for(let i=0;i<s.board.length;i++){const p=s.board[i];if(p&&p.owner===0&&p.type==='P')s.board[i]=null;}
  const actions=C.getLegalActions(s);
  assert(!actions.some(a=>a.kind==='drop'&&a.piece==='P'&&C.rc(a.to)[0]===0));
});

test('Shogi zorunlu terfi üretir',()=>{
  const s=C.createShogiState(); s.board=Array(81).fill(null);
  s.board[C.idx(8,4)]={type:'K',owner:0,promoted:false};
  s.board[C.idx(0,4)]={type:'K',owner:1,promoted:false};
  s.board[C.idx(1,0)]={type:'P',owner:0,promoted:false};
  const actions=C.getLegalActions(s);
  const m=actions.filter(a=>a.from===C.idx(1,0)&&a.to===C.idx(0,0));
  assert.equal(m.length,1);assert.equal(m[0].promote,true);
});


test('Shogi kendi şahını açıkta bırakan hamleyi reddeder',()=>{
  const s=C.createShogiState();s.board=Array(81).fill(null);s.turn=0;
  s.board[C.idx(8,4)]={type:'K',owner:0,promoted:false};
  s.board[C.idx(0,4)]={type:'K',owner:1,promoted:false};
  s.board[C.idx(4,4)]={type:'G',owner:0,promoted:false};
  s.board[C.idx(1,4)]={type:'R',owner:1,promoted:false};
  const legal=C.getLegalActions(s);
  assert(!legal.some(a=>a.from===C.idx(4,4)&&a.to===C.idx(4,3)));
});

test('Shogi şah matı algılar',()=>{
  const s=C.createShogiState();s.board=Array(81).fill(null);s.turn=0;
  s.board[C.idx(8,4)]={type:'K',owner:0,promoted:false};
  s.board[C.idx(0,4)]={type:'K',owner:1,promoted:false};
  s.board[C.idx(0,3)]={type:'L',owner:1,promoted:false};
  s.board[C.idx(0,5)]={type:'L',owner:1,promoted:false};
  s.board[C.idx(1,3)]={type:'P',owner:1,promoted:false};
  s.board[C.idx(1,5)]={type:'P',owner:1,promoted:false};
  s.board[C.idx(2,4)]={type:'R',owner:0,promoted:false};
  s.board[C.idx(2,3)]={type:'G',owner:0,promoted:false};
  const r=C.applyAction(s,{kind:'move',from:C.idx(2,4),to:C.idx(1,4),promote:false});
  assert(r.ok);assert.equal(r.state.winner,0);assert.equal(r.state.reason,'şah mat');
});

test('Hasami başlangıcında 18 taş vardır',()=>{
  const s=C.createHasamiState();assert.equal(s.board.filter(Boolean).length,18);
});

test('Hasami taşı kale gibi hareket eder',()=>{
  const s=C.createHasamiState();const from=C.idx(8,4);
  const tos=C.getLegalActions(s).filter(a=>a.from===from).map(a=>a.to);
  assert(tos.includes(C.idx(7,4)));assert(tos.includes(C.idx(1,4)));
});

test('Hasami yatay kıstırma taş alır',()=>{
  const s=C.createHasamiState();s.board=Array(81).fill(null);s.turn=0;
  s.board[C.idx(4,1)]={owner:0};s.board[C.idx(4,2)]={owner:1};s.board[C.idx(2,3)]={owner:0};
  const r=C.applyAction(s,{kind:'move',from:C.idx(2,3),to:C.idx(4,3)});
  assert(r.ok);assert.equal(r.state.board[C.idx(4,2)],null);assert.equal(r.state.captures[0],1);
});

test('Hasami grup kıstırma birden fazla taş alır',()=>{
  const s=C.createHasamiState();s.board=Array(81).fill(null);s.turn=0;
  s.board[C.idx(4,1)]={owner:0};s.board[C.idx(4,2)]={owner:1};s.board[C.idx(4,3)]={owner:1};s.board[C.idx(1,4)]={owner:0};
  const r=C.applyAction(s,{kind:'move',from:C.idx(1,4),to:C.idx(4,4)});
  assert.equal(r.state.captures[0],2);
});

test('Hasami köşe yakalama çalışır',()=>{
  const s=C.createHasamiState();s.board=Array(81).fill(null);s.turn=0;
  s.board[C.idx(0,0)]={owner:1};s.board[C.idx(0,1)]={owner:0};s.board[C.idx(2,0)]={owner:0};
  const r=C.applyAction(s,{kind:'move',from:C.idx(2,0),to:C.idx(1,0)});
  assert.equal(r.state.board[C.idx(0,0)],null);
});

test('AI her iki oyunda yasal hamle seçer',()=>{
  for(const s of [C.createShogiState(),C.createHasamiState()]){
    const a=C.chooseAIAction(s,'normal');assert(a);assert(C.getLegalActions(s).some(x=>JSON.stringify(x)===JSON.stringify(a)));
  }
});

console.log('\nTüm motor testleri geçti.');
