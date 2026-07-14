(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KomaCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 9;
  const SHOGI_BACK = ['L','N','S','G','K','G','S','N','L'];
  const HAND_TYPES = ['R','B','G','S','N','L','P'];
  const PROMOTABLE = new Set(['R','B','S','N','L','P']);
  const VALUES = { K: 100000, R: 1050, B: 900, G: 600, S: 520, N: 390, L: 330, P: 110 };
  const PROMO_BONUS = { R: 350, B: 320, S: 180, N: 210, L: 180, P: 420 };

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const inside = (r,c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const idx = (r,c) => r * SIZE + c;
  const rc = (i) => [Math.floor(i / SIZE), i % SIZE];
  const opponent = (p) => 1 - p;
  const forward = (p) => p === 0 ? -1 : 1;

  function emptyBoard() { return Array(SIZE * SIZE).fill(null); }
  function piece(type, owner, promoted=false) { return { type, owner, promoted }; }

  function createShogiState(options={}) {
    const board = emptyBoard();
    for (let c=0;c<SIZE;c++) {
      board[idx(0,c)] = piece(SHOGI_BACK[c],1);
      board[idx(2,c)] = piece('P',1);
      board[idx(6,c)] = piece('P',0);
      board[idx(8,c)] = piece(SHOGI_BACK[c],0);
    }
    board[idx(1,1)] = piece('R',1);
    board[idx(1,7)] = piece('B',1);
    board[idx(7,1)] = piece('B',0);
    board[idx(7,7)] = piece('R',0);
    return {
      game:'shogi', board,
      hands:[blankHand(), blankHand()],
      turn: options.firstPlayer ?? 0,
      moveNumber:1, winner:null, draw:false, reason:'',
      check:false, lastAction:null, history:[], events:[],
      settings:{ allowUndo: options.allowUndo ?? true }
    };
  }
  function blankHand(){ return {R:0,B:0,G:0,S:0,N:0,L:0,P:0}; }

  function createHasamiState(options={}) {
    const board = emptyBoard();
    for (let c=0;c<SIZE;c++) {
      board[idx(0,c)] = {owner:1};
      board[idx(8,c)] = {owner:0};
    }
    return {
      game:'hasami', board, turn:options.firstPlayer ?? 0,
      moveNumber:1, winner:null, draw:false, reason:'',
      captures:[0,0], lastAction:null, events:[], history:[],
      settings:{ victory: options.victory || 'one-left' }
    };
  }

  function isPromotionZone(owner,row){ return owner === 0 ? row <= 2 : row >= 6; }
  function mustPromote(type,owner,toRow){
    if ((type==='P'||type==='L') && (owner===0 ? toRow===0 : toRow===8)) return true;
    if (type==='N' && (owner===0 ? toRow<=1 : toRow>=7)) return true;
    return false;
  }

  function stepDirsFor(pieceObj){
    const {type,owner,promoted} = pieceObj; const f = forward(owner);
    if (type==='K') return [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    if (type==='G' || (promoted && ['S','N','L','P'].includes(type))) return [[f,-1],[f,0],[f,1],[0,-1],[0,1],[-f,0]];
    if (type==='S') return [[f,-1],[f,0],[f,1],[-f,-1],[-f,1]];
    if (type==='N') return [[2*f,-1],[2*f,1]];
    if (type==='P') return [[f,0]];
    if (type==='R' && promoted) return [[-1,-1],[-1,1],[1,-1],[1,1]];
    if (type==='B' && promoted) return [[-1,0],[1,0],[0,-1],[0,1]];
    return [];
  }
  function slideDirsFor(pieceObj){
    const {type,owner} = pieceObj; const f=forward(owner);
    if (type==='R') return [[-1,0],[1,0],[0,-1],[0,1]];
    if (type==='B') return [[-1,-1],[-1,1],[1,-1],[1,1]];
    if (type==='L') return [[f,0]];
    return [];
  }

  function pseudoMovesFrom(state, from, includeKingTarget=false){
    const p = state.board[from]; if (!p) return [];
    const [r,c]=rc(from); const out=[];
    for (const [dr,dc] of stepDirsFor(p)) {
      const nr=r+dr,nc=c+dc; if(!inside(nr,nc)) continue;
      const t=state.board[idx(nr,nc)];
      if (!t || (t.owner!==p.owner && (includeKingTarget || t.type!=='K'))) out.push(idx(nr,nc));
    }
    for (const [dr,dc] of slideDirsFor(p)) {
      let nr=r+dr,nc=c+dc;
      while(inside(nr,nc)){
        const t=state.board[idx(nr,nc)];
        if(!t) out.push(idx(nr,nc));
        else { if(t.owner!==p.owner && (includeKingTarget || t.type!=='K')) out.push(idx(nr,nc)); break; }
        nr+=dr;nc+=dc;
      }
    }
    return out;
  }

  function findKing(state,owner){
    for(let i=0;i<state.board.length;i++){ const p=state.board[i]; if(p&&p.owner===owner&&p.type==='K') return i; }
    return -1;
  }
  function isSquareAttacked(state,square,byOwner){
    for(let i=0;i<state.board.length;i++){
      const p=state.board[i]; if(!p||p.owner!==byOwner) continue;
      if(pseudoMovesFrom(state,i,true).includes(square)) return true;
    }
    return false;
  }
  function isInCheck(state,owner){
    const k=findKing(state,owner); return k>=0 && isSquareAttacked(state,k,opponent(owner));
  }

  function rawApplyShogi(state,action){
    const next=clone(state); const mover=state.turn;
    let captured=null;
    if(action.kind==='move'){
      const moving=next.board[action.from];
      captured=next.board[action.to];
      next.board[action.from]=null;
      next.board[action.to]=moving;
      if(action.promote) moving.promoted=true;
      if(captured){
        if(captured.type==='K'){ next.winner=mover; next.reason='şah alındı'; }
        else next.hands[mover][captured.type]=(next.hands[mover][captured.type]||0)+1;
      }
    } else if(action.kind==='drop'){
      next.hands[mover][action.piece]-=1;
      next.board[action.to]=piece(action.piece,mover,false);
    }
    next.lastAction={...action, player:mover, captured:captured?{...captured,promoted:false}:null};
    next.turn=opponent(mover); next.moveNumber++;
    return next;
  }

  function boardHash(state){
    const b=state.board.map(p=>p?`${p.owner}${p.type}${p.promoted?1:0}`:'_').join('');
    if(state.game==='shogi') return `${b}|${JSON.stringify(state.hands)}|${state.turn}`;
    return `${b}|${state.turn}`;
  }

  function shogiCandidateActions(state,player,opts={}){
    const actions=[];
    for(let from=0;from<state.board.length;from++){
      const p=state.board[from]; if(!p||p.owner!==player) continue;
      const [fr]=rc(from);
      for(const to of pseudoMovesFrom(state,from,false)){
        const [tr]=rc(to); const promotable=PROMOTABLE.has(p.type)&&!p.promoted&&(isPromotionZone(player,fr)||isPromotionZone(player,tr));
        if(promotable){
          if(mustPromote(p.type,player,tr)) actions.push({kind:'move',from,to,promote:true});
          else { actions.push({kind:'move',from,to,promote:false}); actions.push({kind:'move',from,to,promote:true}); }
        } else actions.push({kind:'move',from,to,promote:false});
      }
    }
    const hand=state.hands[player];
    for(const type of HAND_TYPES){
      if(!hand[type]) continue;
      for(let to=0;to<state.board.length;to++){
        if(state.board[to]) continue; const [r,c]=rc(to);
        if((type==='P'||type==='L') && (player===0?r===0:r===8)) continue;
        if(type==='N' && (player===0?r<=1:r>=7)) continue;
        if(type==='P'){
          let nifu=false;
          for(let rr=0;rr<SIZE;rr++){ const x=state.board[idx(rr,c)]; if(x&&x.owner===player&&x.type==='P'&&!x.promoted){nifu=true;break;} }
          if(nifu) continue;
        }
        actions.push({kind:'drop',piece:type,to});
      }
    }
    return actions;
  }

  function getShogiLegalActions(state,player=state.turn,opts={}){
    if(state.winner!==null||state.draw) return [];
    const legal=[];
    for(const action of shogiCandidateActions(state,player,opts)){
      const temp={...state,turn:player};
      const next=rawApplyShogi(temp,action);
      if(isInCheck(next,player)) continue;
      if(action.kind==='drop'&&action.piece==='P'&&!opts.skipUchifuzume){
        const enemy=opponent(player);
        if(isInCheck(next,enemy)){
          const replies=getShogiLegalActions(next,enemy,{skipUchifuzume:true});
          if(replies.length===0) continue;
        }
      }
      legal.push(action);
    }
    return legal;
  }

  function sameAction(a,b){
    return a&&b&&a.kind===b.kind&&a.from===b.from&&a.to===b.to&&a.piece===b.piece&&!!a.promote===!!b.promote;
  }

  function applyShogiAction(state,action){
    if(state.game!=='shogi') return {ok:false,error:'Yanlış oyun motoru.'};
    const legal=getShogiLegalActions(state,state.turn);
    if(!legal.some(x=>sameAction(x,action))) return {ok:false,error:'Bu hamle kurallara uygun değil.'};
    const mover=state.turn;
    const beforePiece=action.kind==='move'?state.board[action.from]:{type:action.piece,owner:mover,promoted:false};
    const target=action.kind==='move'?state.board[action.to]:null;
    const next=rawApplyShogi(state,action);
    const enemy=next.turn;
    next.check=isInCheck(next,enemy);
    const replies=getShogiLegalActions(next,enemy);
    let event={type:action.kind==='drop'?'drop':target?'capture':'move',player:mover,piece:beforePiece.type,from:action.from,to:action.to,promote:!!action.promote,captured:target?target.type:null,check:next.check};
    if(replies.length===0){
      if(next.check){ next.winner=mover; next.reason='şah mat'; event.mate=true; }
      else { next.draw=true; next.reason='hamlesiz beraberlik'; }
    }
    const hash=boardHash(next); next.history=[...(state.history||[]),hash].slice(-200);
    if(!next.winner){
      const count=next.history.filter(h=>h===hash).length;
      if(count>=4){next.draw=true;next.reason='dört kez tekrar';}
    }
    next.events=[...(state.events||[]),event];
    return {ok:true,state:next,event};
  }

  function hasamiMovesFrom(state,from){
    const p=state.board[from]; if(!p) return [];
    const [r,c]=rc(from),out=[];
    for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
      let nr=r+dr,nc=c+dc;
      while(inside(nr,nc)&&!state.board[idx(nr,nc)]){out.push(idx(nr,nc));nr+=dr;nc+=dc;}
    }
    return out;
  }
  function getHasamiLegalActions(state,player=state.turn){
    if(state.winner!==null||state.draw) return [];
    const out=[];
    for(let from=0;from<state.board.length;from++){
      const p=state.board[from]; if(!p||p.owner!==player) continue;
      for(const to of hasamiMovesFrom(state,from)) out.push({kind:'move',from,to});
    }
    return out;
  }
  function cornerCaptures(board,player){
    const corners=[
      [idx(0,0),idx(0,1),idx(1,0)],
      [idx(0,8),idx(0,7),idx(1,8)],
      [idx(8,0),idx(8,1),idx(7,0)],
      [idx(8,8),idx(8,7),idx(7,8)]
    ];
    const got=[];
    for(const [corner,a,b] of corners){
      const cp=board[corner],ap=board[a],bp=board[b];
      if(cp&&cp.owner!==player&&ap&&bp&&ap.owner===player&&bp.owner===player) got.push(corner);
    }
    return got;
  }
  function applyHasamiAction(state,action){
    if(state.game!=='hasami') return {ok:false,error:'Yanlış oyun motoru.'};
    const legal=getHasamiLegalActions(state,state.turn);
    if(!legal.some(x=>sameAction(x,action))) return {ok:false,error:'Bu hamle kurallara uygun değil.'};
    const next=clone(state),player=state.turn;
    next.board[action.to]=next.board[action.from]; next.board[action.from]=null;
    const [r,c]=rc(action.to),captured=[];
    for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
      let nr=r+dr,nc=c+dc; const line=[];
      while(inside(nr,nc)){
        const q=next.board[idx(nr,nc)];
        if(!q){line.length=0;break;}
        if(q.owner===player){break;}
        line.push(idx(nr,nc)); nr+=dr;nc+=dc;
      }
      if(line.length&&inside(nr,nc)&&next.board[idx(nr,nc)]&&next.board[idx(nr,nc)].owner===player) captured.push(...line);
    }
    captured.push(...cornerCaptures(next.board,player));
    const unique=[...new Set(captured)];
    unique.forEach(i=>{if(next.board[i]){next.board[i]=null;next.captures[player]++;}});
    const remaining=[0,0]; next.board.forEach(p=>{if(p)remaining[p.owner]++;});
    if(remaining[opponent(player)]<=1){next.winner=player;next.reason='rakip bir taşa indirildi';}
    next.lastAction={...action,player,captured:unique};
    next.turn=opponent(player);next.moveNumber++;
    const event={type:unique.length?'capture':'move',player,from:action.from,to:action.to,captured:unique.length};
    next.events=[...(state.events||[]),event];
    next.history=[...(state.history||[]),boardHash(next)].slice(-200);
    return {ok:true,state:next,event};
  }

  function getLegalActions(state,player=state.turn){
    return state.game==='shogi'?getShogiLegalActions(state,player):getHasamiLegalActions(state,player);
  }
  function applyAction(state,action){ return state.game==='shogi'?applyShogiAction(state,action):applyHasamiAction(state,action); }

  function materialScore(state,player){
    if(state.game==='hasami'){
      let mine=0,theirs=0; state.board.forEach(p=>{if(p){if(p.owner===player)mine++;else theirs++;}});
      return (mine-theirs)*100+(state.captures[player]-state.captures[opponent(player)])*15;
    }
    let score=0;
    state.board.forEach(p=>{if(!p)return;const v=VALUES[p.type]+(p.promoted?(PROMO_BONUS[p.type]||0):0);score+=p.owner===player?v:-v;});
    for(const t of HAND_TYPES){score+=(state.hands[player][t]-state.hands[opponent(player)][t])*VALUES[t]*0.88;}
    if(isInCheck(state,opponent(player)))score+=90;
    if(isInCheck(state,player))score-=120;
    if(state.winner===player)score+=999999;if(state.winner===opponent(player))score-=999999;
    return score;
  }
  function actionTacticalScore(state,action){
    if(state.game==='hasami'){
      const res=applyHasamiAction(state,action); return res.ok?(res.event.captured*500+Math.random()*8):0;
    }
    let s=Math.random()*8;
    if(action.kind==='move'){
      const target=state.board[action.to]; if(target)s+=VALUES[target.type]*1.3;
      if(action.promote)s+=PROMO_BONUS[state.board[action.from].type]||120;
    } else s+=(VALUES[action.piece]||0)*0.04;
    const res=applyShogiAction(state,action); if(res.ok){if(res.event.check)s+=220;if(res.event.mate)s+=999999;}
    return s;
  }
  function chooseAIAction(state,level='normal'){
    const legal=getLegalActions(state,state.turn); if(!legal.length)return null;
    if(level==='easy')return legal[Math.floor(Math.random()*legal.length)];
    const player=state.turn;
    const ranked=legal.map(a=>({a,t:actionTacticalScore(state,a)})).sort((x,y)=>y.t-x.t);
    if(level==='normal'){
      const pool=ranked.slice(0,Math.min(8,ranked.length));
      return pool[Math.floor(Math.random()*Math.min(3,pool.length))].a;
    }
    const candidates=ranked.slice(0,Math.min(state.game==='shogi'?28:40,ranked.length));
    let best=candidates[0].a,bestScore=-Infinity;
    for(const item of candidates){
      const first=applyAction(state,item.a); if(!first.ok)continue;
      if(first.state.winner===player)return item.a;
      const replies=getLegalActions(first.state,first.state.turn);
      let worst=Infinity;
      const replyRank=replies.map(a=>({a,t:actionTacticalScore(first.state,a)})).sort((a,b)=>b.t-a.t).slice(0,18);
      if(!replyRank.length)worst=materialScore(first.state,player);
      for(const rr of replyRank){const second=applyAction(first.state,rr.a);if(second.ok)worst=Math.min(worst,materialScore(second.state,player));}
      const score=worst+item.t*0.15;
      if(score>bestScore){bestScore=score;best=item.a;}
    }
    return best;
  }

  function actionNotation(state,action){
    const files='123456789'; const ranks='abcdefghi';
    const sq=i=>{const [r,c]=rc(i);return `${files[c]}${ranks[r]}`;};
    if(state.game==='hasami')return `${sq(action.from)}–${sq(action.to)}`;
    const type=action.kind==='drop'?action.piece:state.board[action.from]?.type||'?';
    return action.kind==='drop'?`${type}*${sq(action.to)}`:`${type}${sq(action.from)}-${sq(action.to)}${action.promote?'＋':''}`;
  }

  return {
    SIZE, HAND_TYPES, VALUES, clone, idx, rc, inside, opponent,
    createShogiState, createHasamiState, getLegalActions, applyAction,
    getShogiLegalActions, getHasamiLegalActions, isInCheck, chooseAIAction,
    actionNotation, boardHash, isPromotionZone, mustPromote
  };
});
