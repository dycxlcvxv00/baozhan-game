/* 爆战丨无限弹幕 v2.0.1 · 架构层：GameState + GameBridge + BattleScene */
'use strict';
var W = 1280, H = 720;

var GameState = (function () {
  var VERSION = 'v2.0.1';
  var SAVE_KEY = 'baozhan_save_v1';
  var SLOT_FILL_ORDER = [12, 11, 13, 10, 14, 9, 15, 8, 3, 4, 2, 5, 1, 6, 0, 7];
  var state = { currentTab: 'runes', selectedRunes: [] };

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeSavePatch(patch) {
    var save = loadSave();
    for (var k in patch) save[k] = patch[k];
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }
  function init() {
    var save = loadSave();
    state.selectedRunes = Array.isArray(save.runes) ? save.runes.slice(0, 5) : ['fireball', 'icespike'];
  }
  function getSelectedRunes() { return state.selectedRunes.slice(); }
  function toggleRune(id) {
    var i = state.selectedRunes.indexOf(id);
    if (i >= 0) state.selectedRunes.splice(i, 1);
    else if (state.selectedRunes.length < 5 && BZ.RUNE_DEFS[id]) state.selectedRunes.push(id);
    writeSavePatch({ runes: getSelectedRunes() });
    return getSelectedRunes();
  }
  function resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  function battleToUiPoint(p, box) {
    return { x: box.centerX + (p.x - BZ.CONFIG.hero.x) * box.scale, y: box.centerY + (p.y - BZ.CONFIG.hero.y) * box.scale };
  }
  function buildHoneycombUiSlots(box) {
    // 战前 UI 专用紧密蜂窝矩阵：英雄六边形在正中间；符文六边形上 8 个、下 8 个。
    // 槽位身份仍按 SLOT_FILL_ORDER 与战斗 slotOrder 对应，避免装配顺序与进战斗站位脱节。
    var cx = box.centerX, cy = box.centerY;
    var rowGap = 41, colGap = 48, nearGap = 84;
    var rows = [
      { y: cy - nearGap - rowGap * 3, shift: -12 },
      { y: cy - nearGap - rowGap * 2, shift:  12 },
      { y: cy - nearGap - rowGap,     shift: -12 },
      { y: cy - nearGap,              shift:  12 },
      { y: cy + nearGap,              shift:  12 },
      { y: cy + nearGap + rowGap,     shift: -12 },
      { y: cy + nearGap + rowGap * 2, shift:  12 },
      { y: cy + nearGap + rowGap * 3, shift: -12 }
    ];
    var slots = [];
    for (var r = 0; r < rows.length; r++) {
      slots.push({ x: cx - colGap / 2 + rows[r].shift, y: rows[r].y });
      slots.push({ x: cx + colGap / 2 + rows[r].shift, y: rows[r].y });
    }
    return slots;
  }
  function getLoadoutSlotView(box) {
    var selected = getSelectedRunes();
    var uiSlots = buildHoneycombUiSlots(box);
    return uiSlots.map(function (point, orderIndex) {
      var slotIndex = SLOT_FILL_ORDER[orderIndex];
      var runeId = orderIndex < selected.length ? selected[orderIndex] : null;
      return { slot: slotIndex, point: point, runeId: runeId, def: runeId ? BZ.RUNE_DEFS[runeId] : null };
    });
  }
  function getHeroUiPoint(box) { return { x: box.centerX, y: box.centerY }; }
  function createBattleConfig() {
    return { version: VERSION, runes: getSelectedRunes(), slotOrder: SLOT_FILL_ORDER.slice(), saveKey: SAVE_KEY };
  }
  init();
  return {
    VERSION: VERSION, SAVE_KEY: SAVE_KEY, SLOT_FILL_ORDER: SLOT_FILL_ORDER,
    getSelectedRunes: getSelectedRunes, toggleRune: toggleRune, resetSave: resetSave,
    getLoadoutSlotView: getLoadoutSlotView, getHeroUiPoint: getHeroUiPoint,
    createBattleConfig: createBattleConfig
  };
})();

var GameBridge = (function () {
  var handlers = {};
  return {
    on: function (name, fn) { (handlers[name] || (handlers[name] = [])).push(fn); },
    emit: function (name, payload) {
      var list = handlers[name] || [];
      for (var i = 0; i < list.length; i++) list[i](payload || {});
    }
  };
})();

function cssColor(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

var BattleScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function BattleScene() { Phaser.Scene.call(this, { key: 'battle' }); },
  init: function (data) { this.battleConfig = data || { runes: [] }; this.runes = this.battleConfig.runes || []; },
  create: function () {
    this.S = BZ.createBattle(this.runes);
    this.g = this.add.graphics();
    this.paused = false; this.result = null; this.liveTexts = []; this.freeTexts = []; this.slotFlash = {};
    var st = { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#e5e7eb' };
    this.hudWave = this.add.text(16, 12, '', st);
    this.hudWall = this.add.text(16, 40, '', st);
    this.add.text(W - 16, 12, '空格 暂停 · R 重开', { fontFamily: 'Arial', fontSize: '16px', color: '#64748b' }).setOrigin(1, 0);
    this.pauseText = this.add.text(W / 2, H / 2, '已暂停', { fontFamily: 'Arial', fontSize: '48px', color: '#fbbf24' }).setOrigin(0.5).setVisible(false);
    var scene = this;
    this.input.keyboard.on('keydown-SPACE', function () { scene.paused = !scene.paused; scene.pauseText.setVisible(scene.paused); });
    this.input.keyboard.on('keydown-R', function () { GameBridge.emit('battle:restart'); });
    GameBridge.emit('battle:ready');
  },
  update: function (time, delta) {
    if (this.paused) return;
    var S = this.S, i;
    BZ.updateBattle(S, delta / 1000);
    for (i = 0; i < S.flashSlots.length; i++) this.slotFlash[S.flashSlots[i]] = 0.5;
    for (i = 0; i < S.runes.length; i++) if (S.flashSlots.indexOf(S.runes[i].slot) >= 0) S.runes[i].flash = 0.5;
    this.sync();
    if ((S.state === 'victory' || S.state === 'defeat') && !this.result) {
      this.result = S.result; this.paused = true;
      GameBridge.emit(S.result.win ? 'battle:ended' : 'battle:failed', S.result);
    }
  },
  getText: function (str, color) {
    var v = this.freeTexts.pop();
    if (!v) v = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold' });
    v.setText(str).setColor(color || '#fff').setAlpha(1).setVisible(true).setOrigin(0.5);
    this.liveTexts.push(v); return v;
  },
  recycleTexts: function (seen) {
    for (var j = this.liveTexts.length - 1; j >= 0; j--) {
      var v = this.liveTexts[j];
      if (seen.indexOf(v._src) < 0) { v.setVisible(false); v._src = null; this.liveTexts.splice(j, 1); this.freeTexts.push(v); }
    }
  }
});
