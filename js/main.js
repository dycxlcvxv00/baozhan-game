/* 爆战丨无限弹幕 v1.8 · Phaser 表现层 1/3：符文模块（主页页签内）+ 战斗场景 */
'use strict';
  var W = 1280, H = 720;
  var SAVE_KEY = 'baozhan_save_v1';

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeSave(o) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) {}
  }

  // ================= 符文模块（主页「符文」页签，DOM 覆盖画布，手机点按交互） =================
  var save = loadSave();
  var selected = Array.isArray(save.runes) ? save.runes.slice(0, 5) : ['fireball', 'icespike'];
  var homeEl = document.getElementById('home');
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
