/* 爆战丨无限弹幕 v2.2 · DOM UI App（只通过 GameState/GameBridge 通信） */
'use strict';
var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 860 && 'ontouchstart' in window);
var homeEl = document.getElementById('home'), slotBox = document.getElementById('slotBox'), listEl = document.getElementById('runeList'), resultPanel = document.getElementById('result');
var game = null, pendingRune = null;
function refreshScale(){ if(game&&game.scale&&game.scale.refresh) game.scale.refresh(); }
function enterFullscreen(){ var el=document.documentElement,req=el.requestFullscreen||el.webkitRequestFullscreen; if(!req)return false; try{var p=req.call(el); if(p&&p.then)p.then(function(){ if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(function(){refreshScale();}); setTimeout(refreshScale,200); setTimeout(refreshScale,700);}).catch(function(){refreshScale();}); return true;}catch(e){refreshScale();return false;} }
function enterHome(){ document.getElementById('guide').style.display='none'; homeEl.style.display='flex'; }
function loadoutUiBox(){ return {centerX:110,centerY:190,scale:.56}; }
function shortRuneName(def){ return def.name.replace('符文','').replace('爆裂','爆').replace('寒冰','冰').replace('连锁','雷').replace('腐蚀','毒').replace('坚壁','盾'); }
function renderLoadout(){
  var box=loadoutUiBox(), slots=GameState.getLoadoutSlotView(box);
  slotBox.innerHTML='';
  for(var i=0;i<slots.length;i++)(function(s){
    var hex=document.createElement('button'); hex.type='button'; hex.className='hex slot-hex'+(s.def?' filled':' empty')+(pendingRune?' target':'');
    hex.style.left=(Math.round(s.point.x)-23.5)+'px'; hex.style.top=(Math.round(s.point.y)-27)+'px';
    var inEl=document.createElement('div'); inEl.className='hex-in';
    if(s.def){ hex.style.background=cssColor(s.def.color); inEl.textContent=shortRuneName(s.def); inEl.style.color='#f8fafc'; }
    else { hex.style.background='rgba(203,213,225,.45)'; inEl.textContent=''; }
    hex.onclick=function(){ if(pendingRune){ GameState.placeRuneAt(s.orderIndex,pendingRune); pendingRune=null; renderLoadout(); } else if(s.runeId){ GameState.clearRuneAt(s.orderIndex); renderLoadout(); } };
    hex.appendChild(inEl); slotBox.appendChild(hex);
  })(slots[i]);
  var hp=GameState.getHeroUiPoint(box), hero=document.createElement('div'); hero.className='hex hero-hex'; hero.style.left=(Math.round(hp.x)-28)+'px'; hero.style.top=(Math.round(hp.y)-32)+'px';
  var heroIn=document.createElement('div'); heroIn.className='hex-in'; heroIn.textContent='英雄'; heroIn.style.color='#dbeafe'; hero.appendChild(heroIn); slotBox.appendChild(hero);
  listEl.innerHTML='';
  BZ.RUNE_ORDER.forEach(function(id){ var def=BZ.RUNE_DEFS[id], slot=GameState.getRuneSlot(id), on=slot>=0, row=document.createElement('button'); row.className='rune-row'+(on?' on':'')+(pendingRune===id?' pick':''); row.innerHTML='<span class="ri">'+def.icon+'</span><span class="rt"><span class="rn">'+def.name+(on?' · 已装配':'')+'</span><span class="rd">'+def.desc+'</span></span><span class="re">⚡'+def.energyMax+'</span>'; row.onclick=function(){ pendingRune=(pendingRune===id?null:id); renderLoadout(); }; listEl.appendChild(row); });
  var hint=pendingRune?'已选择「'+BZ.RUNE_DEFS[pendingRune].name+'」：点击左侧符文槽装配':'先点右侧符文，再点左侧槽位装配；点已装配槽可卸下';
  document.getElementById('selCount').textContent='已装配 '+GameState.getEquippedCount()+' / 5 · '+hint;
}
function showResult(r){ var title=document.getElementById('resultTitle'); title.textContent=r.win?'胜利':'失败'; title.style.color=r.win?'#4ade80':'#f87171'; document.getElementById('resultStats').textContent='用时 '+r.time.toFixed(1)+' 秒 · 击杀 '+r.kills; resultPanel.style.display='flex'; }
function startBattleFromState(){ var cfg=GameState.createBattleConfig(); homeEl.style.display='none'; resultPanel.style.display='none'; GameBridge.emit('battle:start',cfg); }
GameBridge.on('battle:start',function(cfg){ if(!game){ game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#0b1020',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[BattleScene]}); } var s=game.scene.getScene('battle'); if(s)s.scene.restart(cfg); else game.scene.start('battle',cfg); setTimeout(refreshScale,100); setTimeout(refreshScale,500); });
GameBridge.on('battle:ended',showResult); GameBridge.on('battle:failed',showResult); GameBridge.on('battle:restart',startBattleFromState);
function setupFullscreen(){ var gStart=document.getElementById('btnGuideStart'),gSkip=document.getElementById('btnGuideSkip'),gHint=document.getElementById('guideHint'),mini=document.getElementById('btnFsMini'); if(gStart)gStart.onclick=function(){ if(enterFullscreen())enterHome(); else{gHint.innerHTML='当前浏览器不支持网页全屏。<b>推荐：添加到主屏幕后打开。</b>或手动横屏后点「继续」。'; gSkip.style.display='block';} }; if(gSkip)gSkip.onclick=function(){enterHome(); if(isMobile)alert('请手动旋转手机至横屏进行游戏');}; if(mini)mini.onclick=function(){ if(document.fullscreenElement||document.webkitFullscreenElement){var exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)exit.call(document);}else enterFullscreen();}; document.addEventListener('fullscreenchange',function(){refreshScale(); if(mini)mini.textContent=document.fullscreenElement?'✕':'⛶';}); window.addEventListener('resize',function(){setTimeout(refreshScale,120);}); window.addEventListener('orientationchange',function(){setTimeout(refreshScale,120);}); }
function setupTabs(){ var btns=document.querySelectorAll('.tab-btn'),pages={runes:'pageRunes',mastery:'pageMastery',equip:'pageEquip',settings:'pageSettings'}; for(var i=0;i<btns.length;i++)btns[i].onclick=function(){var tab=this.getAttribute('data-tab'); for(var j=0;j<btns.length;j++)btns[j].className='tab-btn'+(btns[j]===this?' on':''); for(var key in pages)document.getElementById(pages[key]).className='page'+(key===tab?' on':'');}; var reset=document.getElementById('btnResetSave'); if(reset)reset.onclick=function(){ if(confirm('确定重置本地存档？已装配符文等数据将清空。')){GameState.resetSave();location.reload();} }; }
document.getElementById('btnStart').onclick=startBattleFromState; document.getElementById('btnAgain').onclick=startBattleFromState; document.getElementById('btnLoadout').onclick=function(){resultPanel.style.display='none'; homeEl.style.display='flex'; renderLoadout();}; setupFullscreen(); setupTabs(); renderLoadout(); setTimeout(refreshScale,300);
