/* 爆战丨无限弹幕 v1.9 · Phaser 表现层 1/3：符文页锯阵装配 + 战斗场景 */
'use strict';
  var W = 1280, H = 720;
  var SAVE_KEY = 'baozhan_save_v1';

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeSave(o) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) {}
  }

  function cssColor(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  // ================= 符文页（左：16 槽六边形锯阵，右：符文列表，手机点按交互） =================
  var save = loadSave();
  var selected = Array.isArray(save.runes) ? save.runes.slice(0, 5) : ['fireball', 'icespike'];
  var homeEl = document.getElementById('home');
  var slotBox = document.getElementById('slotBox');
  var listEl = document.getElementById('runeList');

  // 锯阵布局与战场 BZ.SLOT_POS 一致（200,360 原点，dx 48 dy 34，缩放 0.56，整体居中于 220×500 槽位盒）
  var UI_SCALE = 0.56, UI_OX = -2, UI_OY = 49;
  var UI_SLOTS = BZ.SLOT_POS.map(function (p) {
    return { x: Math.round(p.x * UI_SCALE + UI_OX), y: Math.round(p.y * UI_SCALE + UI_OY) };
  });
  // 填充顺序与 sim 的 slotOrder 一致：第 1 个符文填最内圈，依次外扩
  var SLOT_FILL_ORDER = [12, 11, 13, 10, 14, 9, 15, 8, 3, 4, 2, 5, 1, 6, 0, 7];

  function renderLoadout() {
    var i;
    slotBox.innerHTML = '';
    for (i = 0; i < UI_SLOTS.length; i++) {
      var hex = document.createElement('div');
      hex.className = 'hex slot-hex';
      hex.style.left = (UI_SLOTS[i].x - 23.5) + 'px';
      hex.style.top = (UI_SLOTS[i].y - 27) + 'px';
      var inEl = document.createElement('div');
      inEl.className = 'hex-in';
      var fi = SLOT_FILL_ORDER.indexOf(i);
      if (fi >= 0 && fi < selected.length) {
        var def = BZ.RUNE_DEFS[selected[fi]];
        hex.style.background = cssColor(def.color);
        inEl.textContent = def.icon;
      }
      hex.appendChild(inEl);
      slotBox.appendChild(hex);
    }
    var hero = document.createElement('div');
    hero.className = 'hex hero-hex';
    hero.style.left = (Math.round(BZ.CONFIG.hero.x * UI_SCALE + UI_OX) - 39) + 'px';
    hero.style.top = (Math.round(BZ.CONFIG.hero.y * UI_SCALE + UI_OY) - 45) + 'px';
    var heroIn = document.createElement('div');
    heroIn.className = 'hex-in';
    hero.appendChild(heroIn);
    slotBox.appendChild(hero);

    listEl.innerHTML = '';
    BZ.RUNE_ORDER.forEach(function (id) {
      var def = BZ.RUNE_DEFS[id];
      var on = selected.indexOf(id) >= 0;
      var row = document.createElement('button');
      row.className = 'rune-row' + (on ? ' on' : '');
      row.innerHTML =
        '<span class="ri">' + def.icon + '</span>' +
        '<span class="rt">' +
          '<span class="rn">' + def.name + '</span>' +
          '<span class="rd">' + def.desc + '</span>' +
        '</span>' +
        '<span class="re">⚡' + def.energyMax + '</span>';
      row.onclick = function () {
        var i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1);
        else if (selected.length < 5) selected.push(id);
        writeSave({ runes: selected });
        renderLoadout();
      };
      listEl.appendChild(row);
    });
    document.getElementById('selCount').textContent = '已装配 ' + selected.length + ' / 5（0 个也可开战）';
  }

  document.getElementById('btnStart').onclick = function () {
    homeEl.style.display = 'none';
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
