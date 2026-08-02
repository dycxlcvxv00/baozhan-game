/* 爆战丨无限弹幕 v2.0.4 · DOM UI App（只通过 GameState/GameBridge 通信） */
'use strict';
var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 860 && 'ontouchstart' in window);
var homeEl = document.getElementById('home');
var slotBox = document.getElementById('slotBox');
var listEl = document.getElementById('runeList');
var resultPanel = document.getElementById('result');
var game = null;

function refreshScale() { if (game && game.scale && game.scale.refresh) game.scale.refresh(); }
function enterFullscreen() {
  var el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return false;
  try {
    var p = req.call(el);
    if (p && p.then) p.then(function () {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { refreshScale(); });
      setTimeout(refreshScale, 200); setTimeout(refreshScale, 700);
    }).catch(function () { refreshScale(); });
    return true;
  } catch (e) { refreshScale(); return false; }
}
function enterHome() { document.getElementById('guide').style.display = 'none'; homeEl.style.display = 'flex'; }

function loadoutUiBox() { return { centerX: 110, centerY: 215, scale: 0.56 }; }
function renderLoadout() {
  var i, box = loadoutUiBox(), slots = GameState.getLoadoutSlotView(box), selected = GameState.getSelectedRunes();
  slotBox.innerHTML = '';
  for (i = 0; i < slots.length; i++) {
    var s = slots[i], hex = document.createElement('div');
    hex.className = 'hex slot-hex' + (s.def ? ' filled' : ' empty');
    hex.style.left = (Math.round(s.point.x) - 23.5) + 'px';
    hex.style.top = (Math.round(s.point.y) - 27) + 'px';
    var inEl = document.createElement('div'); inEl.className = 'hex-in';
    if (s.def) {
      hex.style.background = cssColor(s.def.color);
      inEl.textContent = s.def.name.replace('符文', '');
      inEl.style.color = '#f8fafc';
    } else {
      hex.style.background = 'rgba(203,213,225,.45)';
      inEl.textContent = '';
    }
    hex.appendChild(inEl); slotBox.appendChild(hex);
  }
  var hp = GameState.getHeroUiPoint(box), hero = document.createElement('div');
  hero.className = 'hex hero-hex'; hero.style.left = (Math.round(hp.x) - 39) + 'px'; hero.style.top = (Math.round(hp.y) - 45) + 'px';
  var heroIn = document.createElement('div'); heroIn.className = 'hex-in'; heroIn.textContent = '英雄'; heroIn.style.color = '#dbeafe'; hero.appendChild(heroIn); slotBox.appendChild(hero);

  listEl.innerHTML = '';
  BZ.RUNE_ORDER.forEach(function (id) {
    var def = BZ.RUNE_DEFS[id], on = selected.indexOf(id) >= 0, row = document.createElement('button');
    row.className = 'rune-row' + (on ? ' on' : '');
    row.innerHTML = '<span class="ri">' + def.icon + '</span><span class="rt"><span class="rn">' + def.name + '</span><span class="rd">' + def.desc + '</span></span><span class="re">⚡' + def.energyMax + '</span>';
    row.onclick = function () { GameState.toggleRune(id); renderLoadout(); };
    listEl.appendChild(row);
  });
  document.getElementById('selCount').textContent = '已装配 ' + selected.length + ' / 5（0 个也可开战）';
}

function showResult(r) {
  var title = document.getElementById('resultTitle');
  title.textContent = r.win ? '胜利' : '失败'; title.style.color = r.win ? '#4ade80' : '#f87171';
  document.getElementById('resultStats').textContent = '用时 ' + r.time.toFixed(1) + ' 秒 · 击杀 ' + r.kills;
  resultPanel.style.display = 'flex';
}
function startBattleFromState() {
  var cfg = GameState.createBattleConfig();
  homeEl.style.display = 'none'; resultPanel.style.display = 'none';
  GameBridge.emit('battle:start', cfg);
}

GameBridge.on('battle:start', function (cfg) {
  if (!game) {
    game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#0b1020', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [BattleScene] });
  }
  var s = game.scene.getScene('battle');
  if (s) s.scene.restart(cfg); else game.scene.start('battle', cfg);
  setTimeout(refreshScale, 100); setTimeout(refreshScale, 500);
});
GameBridge.on('battle:ended', showResult);
GameBridge.on('battle:failed', showResult);
GameBridge.on('battle:restart', startBattleFromState);

function setupFullscreen() {
  var gStart = document.getElementById('btnGuideStart'), gSkip = document.getElementById('btnGuideSkip'), gHint = document.getElementById('guideHint'), mini = document.getElementById('btnFsMini');
  if (gStart) gStart.onclick = function () {
    if (enterFullscreen()) enterHome();
    else { gHint.innerHTML = '当前浏览器不支持网页全屏。<b>推荐：点浏览器菜单「添加到主屏幕」，从主屏幕图标打开游戏——将以全屏横屏运行（与视频 App 一致）。</b>或手动横屏后点「继续」。'; gSkip.style.display = 'block'; }
  };
  if (gSkip) gSkip.onclick = function () { enterHome(); if (isMobile) alert('请手动旋转手机至横屏进行游戏'); };
  if (mini) mini.onclick = function () { if (document.fullscreenElement || document.webkitFullscreenElement) { var exit = document.exitFullscreen || document.webkitExitFullscreen; if (exit) exit.call(document); } else enterFullscreen(); };
  document.addEventListener('fullscreenchange', function () { refreshScale(); if (mini) mini.textContent = document.fullscreenElement ? '✕' : '⛶'; });
  window.addEventListener('resize', function () { setTimeout(refreshScale, 120); });
  window.addEventListener('orientationchange', function () { setTimeout(refreshScale, 120); });
}
function setupTabs() {
  var btns = document.querySelectorAll('.tab-btn'), pages = { runes: 'pageRunes', mastery: 'pageMastery', equip: 'pageEquip', settings: 'pageSettings' };
  for (var i = 0; i < btns.length; i++) btns[i].onclick = function () {
    var tab = this.getAttribute('data-tab');
    for (var j = 0; j < btns.length; j++) btns[j].className = 'tab-btn' + (btns[j] === this ? ' on' : '');
    for (var key in pages) document.getElementById(pages[key]).className = 'page' + (key === tab ? ' on' : '');
  };
  var reset = document.getElementById('btnResetSave');
  if (reset) reset.onclick = function () { if (confirm('确定重置本地存档？已装配符文等数据将清空。')) { GameState.resetSave(); location.reload(); } };
}

document.getElementById('btnStart').onclick = startBattleFromState;
document.getElementById('btnAgain').onclick = startBattleFromState;
document.getElementById('btnLoadout').onclick = function () { resultPanel.style.display = 'none'; homeEl.style.display = 'flex'; renderLoadout(); };
setupFullscreen(); setupTabs(); renderLoadout(); setTimeout(refreshScale, 300);
