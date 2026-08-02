/* 爆战丨无限弹幕 v1.0 · Phaser 表现层（3.90 现行 API）
 * Scene 只负责输入、渲染、动画与事件桥接；战斗规则全部在 js/sim.js（BZ）
 */
(function () {
  'use strict';
  var W = 1280, H = 720;
  var SAVE_KEY = 'baozhan_save_v1';

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeSave(o) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) {}
  }

  // ================= 装配界面（DOM 覆盖画布，手机点按交互） =================
  var save = loadSave();
  var selected = Array.isArray(save.runes) ? save.runes.slice(0, 5) : ['fireball', 'icespike'];
  var overlay = document.getElementById('loadout');
  var grid = document.getElementById('runeGrid');

  function renderLoadout() {
    grid.innerHTML = '';
    BZ.RUNE_ORDER.forEach(function (id) {
      var def = BZ.RUNE_DEFS[id];
      var on = selected.indexOf(id) >= 0;
      var card = document.createElement('button');
      card.className = 'rune-card' + (on ? ' on' : '');
      card.innerHTML =
        '<span class="ri">' + def.icon + '</span>' +
        '<span class="rn">' + def.name + '</span>' +
        '<span class="re">⚡' + def.energyMax + '</span>' +
        '<span class="rd">' + def.desc + '</span>';
      card.onclick = function () {
        var i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1);
        else if (selected.length < 5) selected.push(id);
        writeSave({ runes: selected });
        renderLoadout();
      };
      grid.appendChild(card);
    });
    document.getElementById('selCount').textContent = '已装配 ' + selected.length + ' / 5（0 个也可开战）';
  }

  document.getElementById('btnStart').onclick = function () {
    overlay.style.display = 'none';
    startBattle();
  };

  // ================= 战斗场景（只负责渲染 / 输入 / 桥接） =================
  var BattleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BattleScene() { Phaser.Scene.call(this, { key: 'battle' }); },

    init: function (data) { this.runes = (data && data.runes) || selected.slice(); },

    create: function () {
      this.S = BZ.createBattle(this.runes);
      this.g = this.add.graphics();
      this.paused = false;
      this.result = null;
      this.liveTexts = [];
      this.freeTexts = [];
      this.slotFlash = {};

      var st = { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#e5e7eb' };
      this.hudWave = this.add.text(16, 12, '', st);
      this.hudWall = this.add.text(16, 40, '', st);
      this.add.text(W - 16, 12, '空格 暂停 · R 重开', { fontFamily: 'Arial', fontSize: '16px', color: '#64748b' }).setOrigin(1, 0);
      this.pauseText = this.add.text(W / 2, H / 2, '已暂停', { fontFamily: 'Arial', fontSize: '48px', color: '#fbbf24' }).setOrigin(0.5).setVisible(false);

      var scene = this;
      this.input.keyboard.on('keydown-SPACE', function () {
        scene.paused = !scene.paused;
        scene.pauseText.setVisible(scene.paused);
      });
      this.input.keyboard.on('keydown-R', function () { scene.scene.restart({ runes: scene.runes }); });
    },

    update: function (time, delta) {
      if (this.paused) return;
      var S = this.S;
      BZ.updateBattle(S, delta / 1000);
      var i;
      for (i = 0; i < S.flashSlots.length; i++) this.slotFlash[S.flashSlots[i]] = 0.5;
      for (i = 0; i < S.runes.length; i++) {
        if (S.flashSlots.indexOf(S.runes[i].slot) >= 0) S.runes[i].flash = 0.5;
      }
      this.sync();
      if ((S.state === 'victory' || S.state === 'defeat') && !this.result) {
        this.result = S.result;
        this.paused = true;
        showResult(S.result);
      }
    },

    getText: function (str, color) {
      var v = this.freeTexts.pop();
      if (!v) v = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold' });
      v.setText(str).setColor(color || '#fff').setAlpha(1).setVisible(true).setOrigin(0.5);
      this.liveTexts.push(v);
      return v;
    },
    recycleTexts: function (seen) {
      for (var j = this.liveTexts.length - 1; j >= 0; j--) {
        var v = this.liveTexts[j];
        if (seen.indexOf(v._src) < 0) {
          v.setVisible(false); v._src = null;
          this.liveTexts.splice(j, 1);
          this.freeTexts.push(v);
        }
      }
    }
  });

  // ================= 渲染同步（从 sim 状态绘制全部画面） =================
  BattleScene.prototype.hex = function (g, x, y, r, color, alpha, lw) {
    var pts = [];
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 3 * k - Math.PI / 2;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    if (lw) { g.lineStyle(lw, color, alpha); g.strokePoints(pts, true); }
    else { g.fillStyle(color, alpha); g.fillPoints(pts, true); }
  };

  BattleScene.prototype.sync = function () {
    var S = this.S, g = this.g, cfg = BZ.CONFIG, i;
    g.clear();

    g.fillStyle(0x101a30, 1).fillRect(0, 0, cfg.wallX, H);
    g.fillStyle(0x0d1426, 1).fillRect(cfg.wallX, 0, W - cfg.wallX, H);
    g.lineStyle(1, 0x1e293b, 0.35);
    for (i = 1; i < 27; i++) g.lineBetween(i * 48, 0, i * 48, H);
    for (i = 1; i < 15; i++) g.lineBetween(0, i * 48, W, i * 48);

    var wallColor = S.wallFlash > 0 ? 0xfef2f2 : 0x94a3b8;
    g.fillStyle(wallColor, 1).fillRect(cfg.wallX - 6, 0, 12, H);
    if (S.shield > 0) g.lineStyle(4, 0x7dd3fc, 0.75).strokeRect(cfg.wallX - 12, 4, 24, H - 8);

    var bw = 320, bx = W / 2 - bw / 2, by = H - 30;
    g.fillStyle(0x1f2937, 1).fillRect(bx, by, bw, 14);
    g.fillStyle(0xef4444, 1).fillRect(bx, by, bw * Math.max(0, S.wallHp / S.wallMaxHp), 14);
    if (S.shield > 0) g.fillStyle(0x7dd3fc, 1).fillRect(bx, by - 6, bw * Math.min(1, S.shield / S.shieldMax), 4);

    this.hex(g, S.hero.x, S.hero.y, 30, 0x3b82f6, 0.25);
    this.hex(g, S.hero.x, S.hero.y, 30, 0x60a5fa, 1, 2);
    g.fillStyle(0x60a5fa, 1).fillCircle(S.hero.x, S.hero.y, 12);

    for (i = 0; i < BZ.SLOT_POS.length; i++) {
      var p = BZ.SLOT_POS[i];
      this.hex(g, p.x, p.y, 18, 0x334155, 0.35);
      this.hex(g, p.x, p.y, 18, 0x475569, 1, 1);
    }
    for (i = 0; i < S.runes.length; i++) {
      var r = S.runes[i], def = BZ.RUNE_DEFS[r.id];
      var pct = Math.min(1, r.energy / def.energyMax);
      this.hex(g, r.x, r.y, 18, def.color, pct >= 1 ? 0.9 : 0.45);
      if (r.flash > 0) this.hex(g, r.x, r.y, 22 + r.flash * 10, def.color, Math.max(0, r.flash), 3);
      g.fillStyle(0x0f172a, 1).fillRect(r.x - 16, r.y + 22, 32, 4);
      g.fillStyle(def.color, 1).fillRect(r.x - 16, r.y + 22, 32 * pct, 4);
    }

    for (i = 0; i < S.monsters.length; i++) {
      var m = S.monsters[i];
      var alpha = m.inv > 0 ? 0.45 : 1;
      g.fillStyle(m.flash > 0 ? 0xffffff : m.color, alpha).fillCircle(m.x, m.y, m.radius);
      if (m.inv > 0) g.lineStyle(2, 0x7dd3fc, 0.8).strokeCircle(m.x, m.y, m.radius + 4);
      if (m.slowPct > 0) g.lineStyle(2, 0x38bdf8, 0.9).strokeCircle(m.x, m.y, m.radius + 2);
      if (m.poisonT > 0) g.lineStyle(2, 0x4ade80, 0.9).strokeCircle(m.x, m.y, m.radius + 5);
      var hpct = Math.max(0, m.hp / m.maxHp);
      g.fillStyle(0x1f2937, 1).fillRect(m.x - 16, m.y - m.radius - 10, 32, 4);
      g.fillStyle(0xef4444, 1).fillRect(m.x - 16, m.y - m.radius - 10, 32 * hpct, 4);
    }

    for (i = 0; i < S.projectiles.length; i++) {
      var pr = S.projectiles[i];
      g.fillStyle(pr.color, 1).fillCircle(pr.x, pr.y, pr.radius);
    }

    for (i = 0; i < S.effects.length; i++) {
      var e = S.effects[i];
      var prog = 1 - e.life / e.maxLife, ea = Math.max(0, e.life / e.maxLife);
      if (e.kind === 'ring' || e.kind === 'burst') {
        g.lineStyle(4, e.color, ea).strokeCircle(e.x, e.y, (14 + prog * 60) * e.scale);
      } else if (e.kind === 'shield') {
        g.lineStyle(5, e.color, ea).strokeRect(cfg.wallX - 14 - prog * 6, 8, 28 + prog * 12, H - 16);
      } else if (e.kind === 'bolt' && e.hops) {
        g.lineStyle(3, e.color, ea);
        g.beginPath(); g.moveTo(e.x, e.y);
        for (var h = 0; h < e.hops.length; h++) g.lineTo(e.hops[h].x, e.hops[h].y);
        g.strokePath();
      }
    }

    var seen = [];
    for (i = 0; i < S.texts.length; i++) {
      var t = S.texts[i]; seen.push(t);
      var v = t._view;
      if (!v) { v = this.getText(t.str, t.color); t._view = v; v._src = t; }
      v.setPosition(t.x, t.y).setAlpha(Math.max(0, t.life / t.maxLife));
    }
    this.recycleTexts(seen);

    this.hudWave.setText(BZ.waveLabel(S));
    this.hudWall.setText('围墙 ' + Math.ceil(S.wallHp) + ' / ' + S.wallMaxHp + (S.shield > 0 ? ' · 护盾 ' + Math.ceil(S.shield) : ''));
  };

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
  }

  renderLoadout();
})();
