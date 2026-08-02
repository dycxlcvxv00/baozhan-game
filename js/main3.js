/* 爆战丨无限弹幕 v1.3 · Phaser 表现层 3/3：全屏适配 + 结算启动 */
  // ================= 全屏 / 横屏适配 v1.3 =================
  // 策略：尝试浏览器全屏 + 锁定横屏；不支持的浏览器用 CSS 旋转兜底（竖屏也能横着玩）
  function isPortrait() { return window.innerHeight > window.innerWidth; }
  function applyRotateFix() {
    var g = document.getElementById('game');
    if (!g) return;
    if (isPortrait()) {
      // 竖屏时把舞台整体旋转 90°：任何浏览器都能横着玩（页面加载即生效）
      var vw = window.innerWidth, vh = window.innerHeight;
      g.style.position = 'fixed';
      g.style.transformOrigin = 'bottom left';
      g.style.transform = 'rotate(90deg)';
      g.style.width = vh + 'px';
      g.style.height = vw + 'px';
      g.style.left = '0px';
      g.style.top = (-vw) + 'px';
    } else {
      g.style.position = '';
      g.style.transform = '';
      g.style.width = '';
      g.style.height = '';
      g.style.left = '';
      g.style.top = '';
    }
    if (game && game.scale && game.scale.refresh) game.scale.refresh();
  }
  function enterFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { applyRotateFix(); return false; }
    try {
      var p = req.call(el);
      if (p && p.then) {
        p.then(function () {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () { applyRotateFix(); });
          }
          setTimeout(applyRotateFix, 200);
          setTimeout(applyRotateFix, 700);
        }).catch(function () { applyRotateFix(); });
      }
      return true;
    } catch (e) { applyRotateFix(); return false; }
  }
  function setupFullscreen() {
    var btn = document.getElementById('btnFullscreen');
    var mini = document.getElementById('btnFsMini');
    if (btn) btn.onclick = function () { if (!enterFullscreen()) applyRotateFix(); };
    if (mini) mini.onclick = function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      } else { if (!enterFullscreen()) applyRotateFix(); }
    };
    var refresh = function () { setTimeout(applyRotateFix, 120); };
    document.addEventListener('fullscreenchange', function () {
      applyRotateFix();
      if (mini) mini.textContent = document.fullscreenElement ? '✕' : '⛶';
    });
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', refresh);
    }
  }

  // ================= 结算与启动 =================
  var resultPanel = document.getElementById('result');
  function showResult(r) {
    var title = document.getElementById('resultTitle');
    title.textContent = r.win ? '胜利' : '失败';
    title.style.color = r.win ? '#4ade80' : '#f87171';
    document.getElementById('resultStats').textContent =
      '用时 ' + r.time.toFixed(1) + ' 秒 · 击杀 ' + r.kills;
    resultPanel.style.display = 'flex';
  }
  document.getElementById('btnAgain').onclick = function () {
    resultPanel.style.display = 'none';
    startBattle();
  };
  document.getElementById('btnLoadout').onclick = function () {
    resultPanel.style.display = 'none';
    overlay.style.display = 'flex';
  };

  var game = null;
  function startBattle() {
    var runes = selected.slice();
    if (!game) {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        width: W, height: H,
        backgroundColor: '#0b1020',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [BattleScene]
      });
    }
    var s = game.scene.getScene('battle');
    if (s) s.scene.restart({ runes: runes });
    else game.scene.start('battle', { runes: runes });
    setTimeout(applyRotateFix, 100);
    setTimeout(applyRotateFix, 500);
  }

  setupFullscreen();
  renderLoadout();
  applyRotateFix();
  setTimeout(applyRotateFix, 300);
  setTimeout(applyRotateFix, 1000);
