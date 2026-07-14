(() => {
  'use strict';
  const C = window.KomaCore;
  const $ = (s,root=document)=>root.querySelector(s);
  const app = $('#app');
  const toastEl = $('#toast');
  const modalRoot = $('#modal-root');

  const PIECE = {
    K:{jp:'王',tr:'Şah'},R:{jp:'飛',tr:'Kale'},B:{jp:'角',tr:'Fil'},G:{jp:'金',tr:'Altın'},
    S:{jp:'銀',tr:'Gümüş'},N:{jp:'桂',tr:'At'},L:{jp:'香',tr:'Mızrak'},P:{jp:'歩',tr:'Piyon'}
  };
  const PROMO_JP={R:'龍',B:'馬',S:'全',N:'圭',L:'杏',P:'と'};
  const PROMO_TR={R:'Ejderha',B:'At-Ejderha',S:'Terfi Gümüş',N:'Terfi At',L:'Terfi Mızrak',P:'Tokin'};
  const GAME_META={
    shogi:{name:'Shogi',jp:'将棋',subtitle:'Japon satrancı',desc:'Ele geçirilen taşların yeniden savaşa döndüğü, terfi ve mat ağı üzerine kurulu derin strateji.'},
    hasami:{name:'Hasami Shogi',jp:'挟み将棋',subtitle:'Kıskaç oyunu',desc:'Taşlarını kale gibi yürüt, rakip grupları iki yandan sıkıştır ve tahtayı kontrol et.'}
  };

  const state = {
    screen:'home', game:null, mode:null, difficulty:'normal',
    names:['Oyuncu 1','Oyuncu 2'], rotateCoop:true, sound:true,
    gameState:null, selected:null, handSelected:null, legal:[],
    humanSeat:0, socket:null, room:null, roomToken:null, connected:false,
    tutorialGame:'shogi', tutorialStep:0, waiting:false, previousState:null
  };

  function esc(v=''){return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastEl._t);toastEl._t=setTimeout(()=>toastEl.classList.remove('show'),2600);}
  function modal(html){modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal">${html}</div></div>`;}
  function closeModal(){modalRoot.innerHTML='';}
  function go(screen){state.screen=screen;state.selected=null;state.handSelected=null;state.legal=[];render();window.scrollTo({top:0,behavior:'smooth'});}
  function playTone(kind='click'){
    if(!state.sound)return;
    try{
      const ac=playTone.ac||(playTone.ac=new (window.AudioContext||window.webkitAudioContext)());
      const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);
      const map={click:[420,.04],move:[260,.08],capture:[150,.15],check:[650,.22],win:[520,.55],error:[95,.18]};
      const [f,d]=map[kind]||map.click;o.frequency.setValueAtTime(f,ac.currentTime);o.type=kind==='capture'?'sawtooth':'sine';
      g.gain.setValueAtTime(.0001,ac.currentTime);g.gain.exponentialRampToValueAtTime(.08,ac.currentTime+.01);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+d);
      o.start();o.stop(ac.currentTime+d+.02);
    }catch(_){ }
  }

  function home(){
    return `<section class="screen">
      <div class="logo-wrap">
        <div class="logo-mark">駒</div><div class="eyebrow">Japon strateji salonu</div>
        <h1 class="logo">KOMA</h1><div class="logo-jp">駒 · 戦 · 美</div>
        <p class="lead">İki klasik Japon oyunu, tahta baskı sanatından ilham alan tek bir salonda. Yapay zekâya karşı çalış, yanındakiyle aynı cihazı paylaş veya oda koduyla uzaktaki arkadaşına meydan oku.</p>
        <div class="home-actions"><button class="btn secondary" data-action="tutorial-home">Nasıl Oynanır?</button><button class="btn secondary" data-action="install">Ana Ekrana Ekle</button></div>
      </div>
      <div class="game-grid">
        ${gameCard('shogi','Kılıçların sessizliği','Geçmiş hamle değil, ele geçirilen taş bile geleceğin silahıdır.')}
        ${gameCard('hasami','Dalgaların kıskacı','Basit hareketler, acımasız çevirmeler ve tek hamlede dağılan saflar.')}
      </div>
    </section>`;
  }
  function gameCard(key,chip,desc){const g=GAME_META[key];return `<button class="game-card ${key}-card" data-game="${key}"><span class="card-chip">${chip}</span><h2>${g.name}</h2><p>${desc}</p><span class="kanji">${g.jp}</span></button>`;}

  function modeScreen(){const g=GAME_META[state.game];return `<section class="screen">
    <div class="topline"><button class="back-btn" data-action="home">←</button><div><div class="eyebrow">${g.jp} · ${g.subtitle}</div><h1>${g.name}</h1></div><button class="btn secondary" data-action="tutorial-current">Kuralları Öğren</button></div>
    <div class="panel"><p class="lead" style="margin:0 0 20px">${g.desc}</p><div class="mode-grid">
      ${modeCard('ai','🤖','Yapay Zekâ','Kolay, normal veya usta seviyesinde bilgisayara karşı oyna.')}
      ${modeCard('coop','👥','Aynı Cihaz','Telefonu sırayla el değiştirerek yanındaki arkadaşınla oyna.')}
      ${modeCard('online','⛩️','Arkadaşınla Oyna','Bir oda kur, kodu paylaş ve farklı şehirlerden aynı tahtaya bağlan.')}
    </div></div>
  </section>`;}
  function modeCard(key,icon,title,text){return `<button class="mode-card" data-mode="${key}"><div class="mode-icon">${icon}</div><h3>${title}</h3><p>${text}</p></button>`;}

  function setupScreen(){
    const isAI=state.mode==='ai',isCoop=state.mode==='coop';
    return `<section class="screen"><div class="topline"><button class="back-btn" data-action="mode-back">←</button><div><div class="eyebrow">Maç hazırlığı</div><h1>${GAME_META[state.game].name}</h1></div><span></span></div>
    <div class="panel"><div class="form-grid">
      <div class="field"><label>Birinci oyuncu</label><input id="name0" maxlength="20" value="${esc(state.names[0])}" /></div>
      <div class="field"><label>${isAI?'Rakip adı':'İkinci oyuncu'}</label><input id="name1" maxlength="20" value="${esc(isAI?'Kitsune AI':state.names[1])}" ${isAI?'disabled':''}/></div>
      ${isAI?`<div class="field wide"><label>Yapay zekâ seviyesi</label><div class="segment">${['easy','normal','hard'].map(x=>`<button data-difficulty="${x}" class="${state.difficulty===x?'active':''}">${{easy:'Çırak',normal:'Samuray',hard:'Şogun'}[x]}</button>`).join('')}</div></div>`:''}
      ${isCoop?`<div class="field wide"><label>Her turda tahtayı sıradaki oyuncuya çevir</label><div class="segment"><button data-rotate="true" class="${state.rotateCoop?'active':''}">Açık</button><button data-rotate="false" class="${!state.rotateCoop?'active':''}">Kapalı</button></div></div>`:''}
      <div class="field wide"><label>Ses efektleri</label><div class="segment"><button data-sound="true" class="${state.sound?'active':''}">Açık</button><button data-sound="false" class="${!state.sound?'active':''}">Kapalı</button></div></div>
    </div><div style="display:flex;justify-content:flex-end;margin-top:20px"><button class="btn verm" data-action="start-local">Oyunu Başlat</button></div></div></section>`;
  }

  function onlineScreen(){
    return `<section class="screen"><div class="topline"><button class="back-btn" data-action="mode-back">←</button><div><div class="eyebrow">Uzak masa</div><h1>Arkadaşınla Oyna</h1></div><div class="connection">${state.connected?'● Sunucuya bağlı':'○ Bağlantı bekleniyor'}</div></div>
      <div class="panel"><div class="form-grid">
        <div class="field wide"><label>Oyuncu adın</label><input id="onlineName" maxlength="20" value="${esc(state.names[0])}" /></div>
        <div class="field"><button class="btn verm" data-action="create-room">Oda Oluştur</button></div>
        <div class="field"><button class="btn secondary" data-action="show-join">Kodla Katıl</button></div>
      </div><p class="lead" style="margin-bottom:0">Odayı kuran kişi <strong>${GAME_META[state.game].name}</strong> masasını açar. İkinci oyuncu aynı internet adresinden altı haneli kodla katılır.</p></div></section>`;
  }

  function lobbyScreen(){const r=state.room||{};return `<section class="screen"><div class="topline"><button class="back-btn" data-action="leave-room">←</button><div><div class="eyebrow">${GAME_META[r.game||state.game].name} odası</div><h1>Rakibini Bekle</h1></div><div class="connection">${state.connected?'● Bağlı':'○ Yeniden bağlanıyor'}</div></div>
    <div class="panel"><div class="eyebrow" style="text-align:center">Oda kodu</div><div class="lobby-code">${esc(r.code||'------')}</div><div style="text-align:center"><button class="btn secondary" data-action="copy-code">Kodu Kopyala</button></div>
      <div style="margin-top:22px"><div class="player-row"><span><i class="dot ${r.players?.[0]?.connected?'online':''}"></i> ${esc(r.players?.[0]?.name||'Ev sahibi')}</span><strong>先手</strong></div><div class="player-row"><span><i class="dot ${r.players?.[1]?.connected?'online':''}"></i> ${esc(r.players?.[1]?.name||'Rakip bekleniyor…')}</span><strong>後手</strong></div></div>
      ${state.humanSeat===0?`<div style="display:flex;justify-content:flex-end;margin-top:20px"><button class="btn verm" data-action="start-online" ${r.players?.[1]?'':'disabled'}>Masayı Aç</button></div>`:`<p class="lead" style="text-align:center">Ev sahibi oyunu başlattığında tahta otomatik açılacak.</p>`}
    </div></section>`;}

  function gameScreen(){
    const s=state.gameState;if(!s)return home();
    const flipped=shouldFlip(); const turn=s.turn; const game=s.game;
    const p0=state.names[0]||'Oyuncu 1',p1=state.names[1]||'Oyuncu 2';
    return `<section class="screen game-screen ${game}-theme">
      <header class="game-hud">
        <div class="player-pill ${turn===0?'active':''}"><div class="player-name">${esc(p0)}</div><div class="player-meta">${game==='hasami'?`Yakalanan: ${s.captures[0]}`:handCount(s,0)+' elde taş'}</div></div>
        <div class="turn-center"><strong>${turn===0?'先手':'後手'} · ${turn===0?'SENTE':'GOTE'}</strong><span>${s.moveNumber}. hamle${s.check?' · ŞAH!':''}</span></div>
        <div class="player-pill right ${turn===1?'active':''}"><div class="player-name">${esc(p1)}</div><div class="player-meta">${game==='hasami'?`Yakalanan: ${s.captures[1]}`:handCount(s,1)+' elde taş'}</div></div>
      </header>
      <div class="game-layout">
        <aside class="side-panel">${game==='shogi'?handPanel(s,flipped?0:1):capturePanel(s,flipped?0:1)}${moveList(s)}</aside>
        <main class="board-wrap"><div class="status-strip">${statusText()}</div><div class="board-frame ${game}">${boardHTML(s,flipped)}</div></main>
        <aside class="side-panel">${game==='shogi'?handPanel(s,flipped?1:0):capturePanel(s,flipped?1:0)}<h3>Oyun Notu</h3><p class="empty-note">${game==='shogi'?'Taşı seç, aydınlanan kareye dokun. Elindeki taşı tahtaya bırakmak için taş kutusuna dokun.':'Bir taşı seç, aynı sıra veya sütundaki boş hedefe dokun. Rakibi iki taşın arasına al.'}</p></aside>
      </div>
      <nav class="game-bottom"><button class="btn secondary" data-action="rules-in-game">Kurallar</button><button class="btn secondary" data-action="moves-modal">Hamleler</button>${state.mode!=='online'?'<button class="btn secondary" data-action="undo">Geri Al</button>':''}<button class="btn verm" data-action="resign">Teslim Ol</button></nav>
    </section>`;
  }

  function handCount(s,p){return Object.values(s.hands[p]).reduce((a,b)=>a+b,0);}
  function handPanel(s,p){
    const pieces=C.HAND_TYPES.filter(t=>s.hands[p][t]>0).map(t=>`<button class="hand-piece ${state.handSelected===t&&s.turn===p?'active':''}" data-hand="${t}" data-owner="${p}">${PIECE[t].jp}<small>${s.hands[p][t]}</small></button>`).join('');
    return `<h3>${p===0?esc(state.names[0]):esc(state.names[1])} · eldeki taşlar</h3><div class="hand">${pieces||'<span class="empty-note">Henüz taş yok</span>'}</div>`;
  }
  function capturePanel(s,p){return `<h3>${p===0?esc(state.names[0]):esc(state.names[1])}</h3><div class="stat"><strong>${s.captures[p]}</strong><br><small>yakalanan taş</small></div>`;}
  function moveList(s){const arr=(s.events||[]).slice(-8).reverse();return `<h3 style="margin-top:16px">Son hamleler</h3><div class="move-list">${arr.length?arr.map((e,i)=>`<div class="move-item"><span class="move-no">${s.events.length-i}.</span><span>${eventText(e,s.game)}</span></div>`).join(''):'<span class="empty-note">Tahta henüz sessiz.</span>'}</div>`;}
  function eventText(e,game){
    if(game==='hasami')return e.captured?`Kıskaç: ${e.captured} taş alındı`:'Taş yer değiştirdi';
    const n=PIECE[e.piece]?.tr||e.piece;let t=e.type==='drop'?`${n} tahtaya bırakıldı`:e.captured?`${n}, ${PIECE[e.captured]?.tr||e.captured} taşını aldı`:`${n} ilerledi`;
    if(e.promote)t+=' ve terfi etti';if(e.mate)t+=' · ŞAH MAT';else if(e.check)t+=' · ŞAH';return t;
  }
  function statusText(){
    const s=state.gameState;if(state.mode==='ai'&&s.turn===1)return 'Kitsune AI hamlesini düşünüyor…';
    if(state.mode==='online'&&s.turn!==state.humanSeat)return `${state.names[s.turn]} düşünüyor…`;
    if(state.handSelected)return `${PIECE[state.handSelected].tr} bırakmak için bir kare seç`;
    if(state.selected!==null)return 'Aydınlanan hedeflerden birini seç';
    return `${state.names[s.turn]} · bir taş seç`;
  }

  function shouldFlip(){
    if(state.mode==='online')return state.humanSeat===1;
    if(state.mode==='coop'&&state.rotateCoop)return state.gameState.turn===1;
    return false;
  }
  function boardHTML(s,flipped){
    const cells=[];
    for(let visual=0;visual<81;visual++){
      const bi=flipped?80-visual:visual; const p=s.board[bi];
      const targets=state.legal.filter(a=>a.to===bi);const target=targets.length>0;const cap=target&&!!p;
      const cls=['cell',target?'selectable':'',cap?'capture-target':'',state.selected===bi?'selected':'',s.lastAction&&(s.lastAction.from===bi||s.lastAction.to===bi)?'last':''].filter(Boolean).join(' ');
      cells.push(`<button class="${cls}" data-cell="${bi}" aria-label="${p?pieceLabel(p):'Boş kare'}">${p?pieceHTML(p,state.selected===bi):''}</button>`);
    }
    return `<div class="board">${cells.join('')}</div>`;
  }
  function pieceLabel(p){return p.type?`${p.promoted?'Terfi etmiş ':''}${PIECE[p.type].tr}`:`${p.owner===0?'Kırmızı':'Açık'} taş`;}
  function pieceHTML(p,chosen){
    if(state.gameState.game==='hasami')return `<span class="hasami-stone p${p.owner} ${chosen?'chosen':''}"></span>`;
    const jp=p.promoted?(PROMO_JP[p.type]||PIECE[p.type].jp):PIECE[p.type].jp;
    const tr=p.promoted?(PROMO_TR[p.type]||PIECE[p.type].tr):PIECE[p.type].tr;
    return `<span class="shogi-piece ${p.owner===1?'enemy':''} ${p.promoted?'promoted':''} ${chosen?'chosen':''}"><span class="jp">${jp}</span><span class="latin">${tr}</span></span>`;
  }

  const SHOGI_LESSONS=[
    ['Tahta ve yön','9×9 tahtada her taşın sivri ucu rakibe bakar. Sente aşağıdan yukarı, Gote yukarıdan aşağı ilerler.','board'],
    ['Taşların hareketi','Şah her yöne bir kare; Kale düz, Fil çapraz sınırsız gider. Altın, Gümüş, At, Mızrak ve Piyonun yönleri farklıdır.','moves'],
    ['Taş almak ve yeniden bırakmak','Rakibin taşını aldığında yok olmaz; eline geçer. Sonraki bir turda hamle yapmak yerine boş bir kareye kendi taşın olarak bırakabilirsin.','drop'],
    ['Terfi bölgesi','Rakibin son üç sırası terfi bölgesidir. Bölgeye giren, bölgeden çıkan veya içinde hareket eden uygun taşlar güçlenebilir.','promo'],
    ['Bırakma yasakları','Aynı sütunda iki terfisiz piyon olmaz. Piyon ve Mızrak son sıraya; At son iki sıraya bırakılamaz. Piyon bırakarak anında mat yasaktır.','rules'],
    ['Şah, mat ve zafer','Şah tehdit altındaysa tehdidi gidermek zorundasın. Kaçış, alma, araya girme veya elden taş bırakma kalmadığında şah mat olur.','mate']
  ];
  const HASAMI_LESSONS=[
    ['Kuruluş','Her oyuncunun dokuz taşı kendi tarafındaki son sırayı doldurur. Sırayla bir taş hareket ettirilir.','board'],
    ['Kale gibi hareket','Bütün taşlar yatay veya dikey yönde, yolları açık olduğu sürece istedikleri kadar ilerler. Çapraz hareket ve taşın üzerinden atlama yoktur.','moves'],
    ['Kıskaçla yakalama','Rakip taşı aynı sıra veya sütunda iki taşının arasına alırsan tahtadan kaldırırsın. Rakibin karesine giderek taş alınmaz.','capture'],
    ['Grup yakalama','Yan yana duran birden fazla rakip taşın iki ucunu kapatırsan grubun tamamı tek hamlede alınır.','group'],
    ['Köşe kuralı','Köşedeki rakip taş, köşeye komşu iki kareyi sen doldurduğunda yakalanır. Kenar tek başına hayalî taş sayılmaz.','corner'],
    ['Zafer','Standart sürümde rakibini bir veya sıfır taşa indiren oyuncu kazanır. Kendi taşını iki rakip arasına sokman onu kendiliğinden öldürmez.','win']
  ];
  function tutorialScreen(){
    const lessons=state.tutorialGame==='shogi'?SHOGI_LESSONS:HASAMI_LESSONS;const [title,text,type]=lessons[state.tutorialStep];
    return `<section class="screen"><div class="topline"><button class="back-btn" data-action="tutorial-back">←</button><div><div class="eyebrow">Animasyonlu eğitim</div><h1>Nasıl Oynanır?</h1></div><div class="segment"><button data-tutorial-game="shogi" class="${state.tutorialGame==='shogi'?'active':''}">Shogi</button><button data-tutorial-game="hasami" class="${state.tutorialGame==='hasami'?'active':''}">Hasami</button></div></div>
      <div class="tutorial-shell"><nav class="lesson-nav">${lessons.map((x,i)=>`<button data-lesson="${i}" class="${i===state.tutorialStep?'active':''}">${i+1}. ${x[0]}</button>`).join('')}</nav><article class="panel lesson-content"><div class="eyebrow">Ders ${state.tutorialStep+1}/${lessons.length}</div><h2>${title}</h2><p>${text}</p>${demoStage(state.tutorialGame,type)}${lessonExtra(state.tutorialGame,type)}<div class="modal-actions"><button class="btn secondary" data-action="replay-demo">Animasyonu Tekrarla</button>${state.tutorialStep<lessons.length-1?'<button class="btn verm" data-action="next-lesson">Sonraki Ders</button>':'<button class="btn gold" data-action="finish-tutorial">Masaya Dön</button>'}</div></article></div>
    </section>`;
  }
  function lessonExtra(game,type){
    if(game==='shogi'&&type==='moves')return `<div class="rule-grid">
      <div class="rule-tile"><strong>王 · Şah</strong>Çevresindeki sekiz kareden birine gider.</div><div class="rule-tile"><strong>飛 · Kale</strong>Yatay ve dikey yönde sınırsız ilerler.</div>
      <div class="rule-tile"><strong>角 · Fil</strong>Dört çapraz yönde sınırsız ilerler.</div><div class="rule-tile"><strong>金 · Altın</strong>İleri üç yön, yanlar ve düz geri; geri çapraz yok.</div>
      <div class="rule-tile"><strong>銀 · Gümüş</strong>İleri üç yön ve iki geri çapraz; yan ve düz geri yok.</div><div class="rule-tile"><strong>桂 · At</strong>Yalnız ileriye 2+1 sıçrar ve taşların üzerinden atlar.</div>
      <div class="rule-tile"><strong>香 · Mızrak</strong>Yalnız düz ileri yönde sınırsız ilerler.</div><div class="rule-tile"><strong>歩 · Piyon</strong>Bir kare düz ileri gider ve aynı şekilde taş alır.</div></div>`;
    if(game==='shogi'&&type==='drop')return `<div class="rule-note"><strong>Bir turda tek seçim:</strong> Ya tahtadaki bir taşı yürütürsün ya da elindeki bir taşı boş kareye bırakırsın. Bırakılan taş terfisiz gelir; sonraki hamlelerde terfi edebilir.</div>`;
    if(game==='shogi'&&type==='promo')return `<div class="rule-grid"><div class="rule-tile"><strong>Altın gibi hareket eder</strong>Piyon, Mızrak, At ve Gümüş terfi edince Altın hareketini kazanır.</div><div class="rule-tile"><strong>Ejderha Kale</strong>Kale hareketine bir kare çapraz eklenir.</div><div class="rule-tile"><strong>Ejderha At</strong>Fil hareketine bir kare düz yön eklenir.</div><div class="rule-tile"><strong>Zorunlu terfi</strong>Piyon/Mızrak son sırada, At son iki sırada terfi etmek zorundadır.</div></div>`;
    if(game==='shogi'&&type==='rules')return `<div class="rule-grid"><div class="rule-tile"><strong>Nifu</strong>Aynı sütunda iki terfisiz kendi piyonun bulunamaz.</div><div class="rule-tile"><strong>Uchifuzume</strong>Elden piyon bırakıp o hamlede doğrudan mat etmek yasaktır.</div><div class="rule-tile"><strong>Ölü kare</strong>Gelecekte hareket edemeyecek Piyon, Mızrak veya At bırakılamaz.</div><div class="rule-tile"><strong>Şah güvenliği</strong>Kendi şahını tehdit altında bırakan hiçbir hamle yapılamaz.</div></div>`;
    if(game==='hasami'&&type==='capture')return `<div class="rule-note">Yakalama yalnız yaptığın hamleyle yeni bir kıskaç oluşturulduğunda olur. Kendi taşını iki rakip taşın arasındaki boşluğa sokman, taşını kendiliğinden kaybettirmez.</div>`;
    if(game==='hasami'&&type==='group')return `<div class="rule-grid"><div class="rule-tile"><strong>Yatay kıskaç</strong>Aynı sıradaki bitişik rakip grubun iki ucunu kapat.</div><div class="rule-tile"><strong>Dikey kıskaç</strong>Aynı sütundaki bitişik rakip grubun üstünü ve altını kapat.</div><div class="rule-tile"><strong>Çapraz yok</strong>Çapraz iki taş arasında kalan rakip yakalanmaz.</div><div class="rule-tile"><strong>Çoklu yakalama</strong>Tek hamle birkaç yönde kıskaç kurarsa tüm gruplar alınır.</div></div>`;
    if(game==='hasami'&&type==='corner')return `<div class="rule-note">Köşede yalnız iki komşu kare vardır. Bu iki kareyi de senin taşların doldurursa köşedeki rakip taş alınır. Düz kenar, normal durumlarda hayalî üçüncü taş sayılmaz.</div>`;
    return '';
  }

  function demoStage(game,type){
    const cells=Array(25).fill('').map((_,i)=>`<div class="demo-cell" data-demo-cell="${i}"></div>`);
    let pieces='';
    if(game==='shogi'){
      const map={board:[[22,'王'],[2,'玉'],[18,'歩']],moves:[[22,'飛'],[7,'角'],[18,'金']],drop:[[21,'歩'],[3,'銀']],promo:[[10,'歩'],[2,'と']],rules:[[22,'王'],[7,'歩'],[12,'歩']],mate:[[2,'玉'],[7,'金'],[12,'飛']]};
      pieces=(map[type]||map.board).map(([i,t],k)=>`<div class="demo-koma" style="position:absolute;left:calc(${i%5}*20% + 4%);top:calc(${Math.floor(i/5)}*20% + 3%);width:12%;height:15%;animation-delay:${k*.2}s">${t}</div>`).join('');
    }else{
      const map={board:[[20,0],[21,0],[22,0],[2,1],[3,1]],moves:[[20,0],[2,1]],capture:[[10,0],[12,1],[14,0]],group:[[10,0],[11,1],[12,1],[13,1],[14,0]],corner:[[0,1],[1,0],[5,0]],win:[[10,0],[11,0],[12,0],[13,1]]};
      pieces=(map[type]||map.board).map(([i,o],k)=>`<div class="demo-token ${o?'light':''}" style="position:absolute;left:calc(${i%5}*20% + 6%);top:calc(${Math.floor(i/5)}*20% + 6%);width:9%;animation-delay:${k*.16}s"></div>`).join('');
    }
    return `<div class="demo-stage"><div class="demo-board">${cells.join('')}</div>${pieces}<div class="demo-arrow">➜</div></div>`;
  }

  function resultScreen(){const s=state.gameState;const draw=s.draw;const winner=s.winner;return `<section class="screen"><div class="panel result-card"><div class="eyebrow">Masanın hükmü</div><h1 class="result-title">${draw?'BERABERE':winner===state.humanSeat&&state.mode==='ai'?'ZAFER':winner!==null?`${esc(state.names[winner])} KAZANDI`:'OYUN BİTTİ'}</h1><p class="lead">${esc(s.reason||'Mücadele tamamlandı.')}</p><div class="result-board"><div class="stat"><strong>${s.moveNumber-1}</strong><br>toplam hamle</div><div class="stat"><strong>${s.game==='hasami'?s.captures.reduce((a,b)=>a+b,0):(s.events||[]).filter(e=>e.captured).length}</strong><br>alınan taş</div></div><div class="home-actions"><button class="btn secondary" data-action="home">Ana Salon</button><button class="btn verm" data-action="rematch">Rövanş</button></div></div></section>`;}

  function render(){
    const map={home,mode:modeScreen,setup:setupScreen,online:onlineScreen,lobby:lobbyScreen,game:gameScreen,tutorial:tutorialScreen,result:resultScreen};
    app.innerHTML=(map[state.screen]||home)();
    bind();
  }

  function bind(){
    app.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{state.game=b.dataset.game;go('mode');});
    app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='online'){connectSocket();go('online');}else go('setup');});
    app.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
    app.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{state.difficulty=b.dataset.difficulty;render();});
    app.querySelectorAll('[data-rotate]').forEach(b=>b.onclick=()=>{state.rotateCoop=b.dataset.rotate==='true';render();});
    app.querySelectorAll('[data-sound]').forEach(b=>b.onclick=()=>{state.sound=b.dataset.sound==='true';render();});
    app.querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>cellClick(Number(b.dataset.cell)));
    app.querySelectorAll('[data-hand]').forEach(b=>b.onclick=()=>handClick(b.dataset.hand,Number(b.dataset.owner)));
    app.querySelectorAll('[data-tutorial-game]').forEach(b=>b.onclick=()=>{state.tutorialGame=b.dataset.tutorialGame;state.tutorialStep=0;render();});
    app.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{state.tutorialStep=Number(b.dataset.lesson);render();});
  }

  function action(name){
    playTone();
    if(name==='home'){leaveOnlineSilent();state.gameState=null;go('home');}
    else if(name==='mode-back'){if(state.mode==='online')leaveOnlineSilent();go('mode');}
    else if(name==='tutorial-home'){state.tutorialGame='shogi';state.tutorialStep=0;state._tutorialReturn='home';go('tutorial');}
    else if(name==='tutorial-current'||name==='rules-in-game'){state.tutorialGame=state.game||state.gameState?.game||'shogi';state.tutorialStep=0;state._tutorialReturn=state.screen;go('tutorial');}
    else if(name==='tutorial-back'||name==='finish-tutorial')go(state._tutorialReturn||'home');
    else if(name==='next-lesson'){state.tutorialStep++;render();}
    else if(name==='replay-demo'){const d=$('.demo-stage');d?.replaceWith(d.cloneNode(true));}
    else if(name==='start-local')startLocal();
    else if(name==='create-room')createRoom();
    else if(name==='show-join')showJoin();
    else if(name==='copy-code')copyRoom();
    else if(name==='start-online')socketEmit('room:start',{},res=>{if(!res?.ok)toast(res?.error||'Oyun başlatılamadı.');});
    else if(name==='leave-room'){leaveOnlineSilent();go('mode');}
    else if(name==='resign')confirmResign();
    else if(name==='undo')undo();
    else if(name==='moves-modal')showMoves();
    else if(name==='rematch')rematch();
    else if(name==='install')installApp();
  }

  function readNames(){
    const n0=$('#name0')||$('#onlineName');if(n0)state.names[0]=n0.value.trim()||'Oyuncu 1';
    const n1=$('#name1');if(n1&&!n1.disabled)state.names[1]=n1.value.trim()||'Oyuncu 2';
  }
  function startLocal(){
    readNames();if(state.mode==='ai')state.names[1]='Kitsune AI';
    state.gameState=state.game==='shogi'?C.createShogiState():C.createHasamiState();state.previousState=null;go('game');flash(`${state.names[0]} başlıyor`);
  }
  function currentPlayerCanMove(){
    if(!state.gameState||state.gameState.winner!==null||state.gameState.draw)return false;
    if(state.mode==='ai'&&state.gameState.turn===1)return false;
    if(state.mode==='online'&&state.gameState.turn!==state.humanSeat)return false;
    return true;
  }
  function cellClick(i){
    if(!currentPlayerCanMove()){toast('Sıra rakibinde.');return;}
    const s=state.gameState;
    if(state.handSelected&&s.game==='shogi'){
      const a=state.legal.find(x=>x.kind==='drop'&&x.to===i);if(a){submitAction(a);return;}
      if(!s.board[i])toast('Bu kareye taş bırakılamaz.');state.handSelected=null;state.legal=[];render();return;
    }
    if(state.selected!==null){
      const candidates=state.legal.filter(a=>a.to===i);
      if(candidates.length){
        if(candidates.length>1){promotionChoice(candidates);return;}
        submitAction(candidates[0]);return;
      }
    }
    const p=s.board[i];
    if(p&&p.owner===s.turn){state.selected=i;state.handSelected=null;state.legal=C.getLegalActions(s).filter(a=>a.kind==='move'&&a.from===i);playTone('click');render();}
    else{state.selected=null;state.legal=[];render();}
  }
  function handClick(type,owner){
    const s=state.gameState;if(!currentPlayerCanMove()||s.game!=='shogi'||owner!==s.turn)return;
    state.selected=null;state.handSelected=state.handSelected===type?null:type;
    state.legal=state.handSelected?C.getLegalActions(s).filter(a=>a.kind==='drop'&&a.piece===type):[];render();
  }
  function promotionChoice(candidates){
    modal(`<h2>Terfi edilsin mi?</h2><p>Bu taş terfi bölgesinde güçlenebilir. Terfi kalıcıdır; taş alınırsa normal yüzüyle rakibin eline geçer.</p><div class="modal-actions"><button class="btn secondary" id="noPromo">Terfi Etme</button><button class="btn verm" id="yesPromo">Terfi Et</button></div>`);
    $('#noPromo').onclick=()=>{closeModal();submitAction(candidates.find(x=>!x.promote));};
    $('#yesPromo').onclick=()=>{closeModal();submitAction(candidates.find(x=>x.promote));};
  }
  function submitAction(a){
    if(state.mode==='online'){state.waiting=true;socketEmit('game:action',{action:a},res=>{state.waiting=false;if(!res?.ok)toast(res?.error||'Hamle reddedildi.');});return;}
    const before=C.clone(state.gameState);const r=C.applyAction(state.gameState,a);if(!r.ok){playTone('error');toast(r.error);return;}
    state.previousState=before;state.gameState=r.state;afterMove(r.event);
  }
  function afterMove(event){
    state.selected=null;state.handSelected=null;state.legal=[];
    playTone(event.mate?'win':event.check?'check':event.captured?'capture':'move');
    if(event.mate)flash('ŞAH MAT');else if(event.check)flash('ŞAH!');else if(event.captured)flash(state.gameState.game==='hasami'?`${event.captured} TAŞ KISKACA ALINDI`:'TAŞ ALINDI');
    render();
    if(state.gameState.winner!==null||state.gameState.draw){setTimeout(()=>go('result'),1050);return;}
    if(state.mode==='ai'&&state.gameState.turn===1)setTimeout(aiMove,650);
    else if(state.mode==='coop'&&state.rotateCoop)flash(`${state.names[state.gameState.turn]} sırası`);
  }
  function aiMove(){
    if(state.screen!=='game'||state.gameState.turn!==1||state.gameState.winner!==null)return;
    const a=C.chooseAIAction(state.gameState,state.difficulty);if(!a)return;
    const r=C.applyAction(state.gameState,a);if(r.ok){state.previousState=null;state.gameState=r.state;afterMove(r.event);}
  }
  function flash(text){const d=document.createElement('div');d.className='turn-flash';d.innerHTML=`<div>${esc(text)}</div>`;document.body.appendChild(d);setTimeout(()=>d.remove(),1550);}
  function confirmResign(){modal(`<h2>Teslim olmak istiyor musun?</h2><p>Bu masa rakibin zaferiyle kapanacak.</p><div class="modal-actions"><button class="btn secondary" id="cancelResign">Devam Et</button><button class="btn verm" id="doResign">Teslim Ol</button></div>`);$('#cancelResign').onclick=closeModal;$('#doResign').onclick=()=>{closeModal();if(state.mode==='online')socketEmit('game:resign',{},()=>{});else{state.gameState.winner=C.opponent(state.gameState.turn);state.gameState.reason='rakip teslim oldu';go('result');}};}
  function undo(){if(!state.previousState){toast('Geri alınacak hamle yok.');return;}state.gameState=state.previousState;state.previousState=null;render();toast('Son hamle geri alındı.');}
  function showMoves(){const s=state.gameState;modal(`<h2>Hamle Günlüğü</h2><div class="move-list" style="max-height:60dvh">${(s.events||[]).map((e,i)=>`<div class="move-item"><span class="move-no">${i+1}.</span><span>${eventText(e,s.game)}</span></div>`).join('')||'<p>Henüz hamle yok.</p>'}</div><div class="modal-actions"><button class="btn" id="closeMoves">Kapat</button></div>`);$('#closeMoves').onclick=closeModal;}
  function rematch(){if(state.mode==='online'){socketEmit('room:rematch',{},res=>{if(!res?.ok)toast(res?.error||'Rövanş başlatılamadı.');});}else startLocal();}

  function connectSocket(){
    if(state.socket && state.socket.ws && state.socket.ws.readyState<=1)return;
    const protocol=location.protocol==='https:'?'wss':'ws';
    const ws=new WebSocket(`${protocol}://${location.host}/ws`);
    const net={ws,seq:0,acks:new Map(),send(event,data,cb){
      if(ws.readyState!==WebSocket.OPEN){cb?.({ok:false,error:'Bağlantı henüz hazır değil.'});return;}
      const id=++net.seq;if(cb)net.acks.set(id,cb);ws.send(JSON.stringify({event,data,id}));
    },close(){try{ws.close();}catch(_){}}};
    state.socket=net;
    ws.onopen=()=>{state.connected=true;if(state.room&&state.roomToken)net.send('room:resume',{code:state.room.code,token:state.roomToken},()=>{});render();};
    ws.onclose=()=>{state.connected=false;render();};
    ws.onerror=()=>{state.connected=false;toast('Çevrim içi sunucuya bağlanılamadı.');};
    ws.onmessage=e=>{
      let msg;try{msg=JSON.parse(e.data);}catch(_){return;}
      if(msg.type==='ack'){const cb=net.acks.get(msg.id);if(cb){net.acks.delete(msg.id);cb(msg.payload);}return;}
      if(msg.type!=='event')return;
      if(msg.event==='room:update'){
        const room=msg.payload;state.room=room;syncRoomNames();
        if(state.screen!=='game'&&room.status==='playing'&&room.state){state.game=room.game;state.gameState=room.state;go('game');}else render();
      }else if(msg.event==='game:update'){
        const payload=msg.payload;state.room=payload.room||state.room;state.gameState=payload.state;syncRoomNames();
        if(state.screen!=='game')go('game');else{
          render();
          if(payload.event){playTone(payload.event.mate?'win':payload.event.check?'check':payload.event.captured?'capture':'move');if(payload.event.mate)flash('ŞAH MAT');else if(payload.event.check)flash('ŞAH!');else if(payload.event.captured)flash(payload.state.game==='hasami'?`${payload.event.captured} TAŞ KISKACA ALINDI`:'TAŞ ALINDI');}
          if(state.gameState.winner!==null||state.gameState.draw)setTimeout(()=>go('result'),1100);
        }
      }else if(msg.event==='room:error')toast(msg.payload);
    };
  }
  function socketEmit(event,data,cb){
    if(!state.socket||!state.connected){toast('Sunucu bağlantısı kurulamadı.');cb?.({ok:false,error:'Bağlantı yok.'});return;}
    state.socket.send(event,{...data,code:data?.code||state.room?.code,token:state.roomToken},cb||(()=>{}));
  }
  function whenConnected(fn,attempt=0){if(state.connected){fn();return;}if(attempt>30){toast('Sunucu bağlantısı zaman aşımına uğradı.');return;}setTimeout(()=>whenConnected(fn,attempt+1),150);}
  function createRoom(){readNames();connectSocket();whenConnected(()=>socketEmit('room:create',{name:state.names[0],game:state.game},res=>{if(!res?.ok){toast(res?.error||'Oda kurulamadı.');return;}state.humanSeat=0;state.roomToken=res.token;state.room=res.room;go('lobby');}));}
  function showJoin(){
    readNames();modal(`<h2>Kodla Katıl</h2><div class="field"><label>Altı haneli oda kodu</label><input id="joinCode" inputmode="numeric" maxlength="6" placeholder="123456" style="font-size:2rem;letter-spacing:.2em;text-align:center"/></div><div class="modal-actions"><button class="btn secondary" id="cancelJoin">Vazgeç</button><button class="btn verm" id="doJoin">Odaya Gir</button></div>`);
    $('#cancelJoin').onclick=closeModal;$('#doJoin').onclick=()=>{const code=$('#joinCode').value.replace(/\D/g,'');if(code.length!==6){toast('Kod altı haneli olmalı.');return;}closeModal();const run=()=>socketEmit('room:join',{name:state.names[0],code},res=>{if(!res?.ok){toast(res?.error||'Odaya girilemedi.');return;}state.humanSeat=1;state.roomToken=res.token;state.room=res.room;state.game=res.room.game;syncRoomNames();go('lobby');});if(!state.connected)connectSocket();whenConnected(run)};
  }
  function syncRoomNames(){if(!state.room?.players)return;state.names=[state.room.players[0]?.name||'Oyuncu 1',state.room.players[1]?.name||'Oyuncu 2'];}
  function copyRoom(){const txt=state.room?.code||'';navigator.clipboard?.writeText(txt);toast('Oda kodu kopyalandı.');}
  function leaveOnlineSilent(){if(state.socket&&state.room&&state.connected)state.socket.send('room:leave',{code:state.room.code,token:state.roomToken},()=>{});state.room=null;state.roomToken=null;state.socket?.close();state.socket=null;state.connected=false;}

  let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
  async function installApp(){if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;}else toast('Tarayıcı menüsünden “Ana ekrana ekle” seçeneğini kullanabilirsin.');}
  if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('/sw.js').catch(()=>{});

  render();
})();
