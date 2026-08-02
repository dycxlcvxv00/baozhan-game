/* 爆战丨无限弹幕 v1.8 · Phaser 表现层 3/3：引导页 + 主页模块导航 + 结算启动 */
  // ================= 全屏 / 横屏适配 =================
  var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.innerWidth <= 860 && 'ontouchstart' in window);

  function refreshScale() {
    if (game && game.scale && game.scale.refresh) game.scale.refresh();
  }
  function enterFullscreen() {
    // 三层兼容：标准全屏（安卓 Chrome）→ webkit 全屏（旧 iOS/国产浏览器）→ 引导添加到主屏幕（PWA 横屏全屏）
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

  // ================= 引导页（落地页：游戏名 + 当前版本号 + 全屏游戏按钮） =================
  function enterHome() {
    document.getElementById('guide').style.display = 'none';
    homeEl.style.display = 'flex';
  }
  function setupFullscreen() {
    var gStart = document.getElementById('btnGuideStart');
    var gSkip = document.getElementById('btnGuideSkip');
    var gHint = document.getElementById('guideHint');
    var mini = document.getElementById('btnFsMini');

    if (gStart) gStart.onclick = function () {
      if (enterFullscreen()) {
        enterHome();
      } else {
        gHint.innerHTML = '当前浏览器不支持网页全屏。<b>推荐：点浏览器菜单「添加到主屏幕」，从主屏幕图标打开游戏——将以全屏横屏运行（与视频 App 一致）。</b>或手动横屏后点「继续」。';
        gSkip.style.display = 'block';
      }
    };
    if (gSkip) gSkip.onclick = function () {
      enterHome();
      if (isMobile) alert('请手动旋转手机至横屏进行游戏');
    };
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

  // ================= 主页模块导航（符文 / 专精 / 装备 / 设置） =================
  function setupTabs() {
    var btns = document.querySelectorAll('.tab-btn');
    var pages = { runes: 'pageRunes', mastery: 'pageMastery', equip: 'pageEquip', settings: 'pageSettings' };
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var tab = this.getAttribute('data-tab');
        for (var j = 0; j < btns.length; j++) btns[j].className = 'tab-btn' + (btns[j] === this ? ' on' : '');
        for (var key in pages) {
          document.getElementById(pages[key]).className = 'page' + (key === tab ? ' on' : '');
        }
      };
    }
    var reset = document.getElementById('btnResetSave');
    if (reset) reset.onclick = function () {
      if (confirm('确定重置本地存档？已装配符文等数据将清空。')) {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        location.reload();
      }
    };
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
    homeEl.style.display = 'flex';
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
  setupTabs();
  renderLoadout();
  setTimeout(refreshScale, 300);
