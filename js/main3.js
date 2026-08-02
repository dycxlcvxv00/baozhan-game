/* 爆战丨无限弹幕 v1.4 · Phaser 表现层 3/3：全屏引导 + 结算启动 */
  // ================= 全屏 / 横屏适配 v1.4 =================
  // 与旧引擎一致的机制：requestFullscreen + orientation.lock；不再使用 CSS 旋转
  var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.innerWidth <= 860 && 'ontouchstart' in window);

  function refreshScale() {
    if (game && game.scale && game.scale.refresh) game.scale.refresh();
  }
  function enterFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return false;
    try {
      var p = req.call(el);
      if (p && p.then) {
        p.then(function () {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () { refreshScale(); });
          }
          setTimeout(refreshScale, 200);
          setTimeout(refreshScale, 700);
        }).catch(function () { refreshScale(); });
      }
      return true;
    } catch (e) { refreshScale(); return false; }
  }

  function setupFullscreen() {
    var guide = document.getElementById('guide');
    var gStart = document.getElementById('btnGuideStart');
    var gSkip = document.getElementById('btnGuideSkip');
    var gHint = document.getElementById('guideHint');
    var mini = document.getElementById('btnFsMini');
    var btn = document.getElementById('btnFullscreen');

    if (isMobile && guide) guide.style.display = 'flex';

    if (gStart) gStart.onclick = function () {
      var ok = enterFullscreen();
      if (ok) {
        guide.style.display = 'none';
        overlay.style.display = 'flex';
      } else {
        gHint.textContent = '当前浏览器不支持全屏横屏，请旋转手机后点「继续」（或将游戏添加到主屏幕获得全屏体验）';
        gSkip.style.display = 'block';
      }
    };
    if (gSkip) gSkip.onclick = function () {
      guide.style.display = 'none';
      overlay.style.display = 'flex';
    };
    if (btn) btn.onclick = function () { enterFullscreen(); };
    if (mini) mini.onclick = function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      } else { enterFullscreen(); }
    };
    document.addEventListener('fullscreenchange', function () {
      refreshScale();
      if (mini) mini.textContent = document.fullscreenElement ? '✕' : '⛶';
    });
    window.addEventListener('resize', function () { setTimeout(refreshScale, 120); });
    window.addEventListener('orientationchange', function () { setTimeout(refreshScale, 120); });
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
    setTimeout(refreshScale, 100);
    setTimeout(refreshScale, 500);
  }

  setupFullscreen();
  renderLoadout();
  setTimeout(refreshScale, 300);
