
/* ============================================================
 * save.js — 存档系统（localStorage 持久化 + 导出/导入 JSON）
 *
 * 设计：各功能模块在初始化后通过 GameSave.register(id, get, set) 注册
 * 「序列化 / 反序列化」钩子；本模块负责：收集状态、落盘、恢复、自动保存、
 * 以及顶部「存档栏」UI。
 *
 * 存档范围（当前可经 UI 修改的进度）：
 *   - hero ：英雄已穿戴装备（window.HERO.equipped）
 *   - bag  ：背包实例物品 + 各页格位 + 实例序号（bag-panel 动态库存）
 *   - skill：技能上阵插槽（skill-panel 4 槽）
 *
 * 持久化介质：localStorage（刷新/关闭后仍在）。另支持导出/导入 JSON 文件，
 * 便于跨设备备份或把存档随仓库提交。
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'baozhan_save_v1';
  var reg = {};                       // id -> { get, set }
  var restoring = false;              // 恢复期间抑制自动保存，避免回环
  var autoOn = true;
  var autoTimer = null;

  /* 恢复优先级：bag（含实例物品）必须先于 hero，
   * 否则 paperdoll / 背包读 ITEM_MAP 时实例尚未注册。 */
  var RESTORE_ORDER = ['bag', 'hero', 'skill'];

  /* ---------- 注册钩子 ---------- */
  function register(id, get, set) {
    reg[id] = { get: get, set: set };
  }

  /* ---------- 序列化 / 反序列化 ---------- */
  function serialize() {
    var data = {};
    for (var id in reg) if (reg[id].get) data[id] = reg[id].get();
    return { v: 1, ts: Date.now(), data: data };
  }

  function deserialize(s) {
    if (!s || !s.data) return false;
    restoring = true;
    var ordered = RESTORE_ORDER.filter(function (id) { return s.data[id] !== undefined && reg[id] && reg[id].set; });
    var rest = Object.keys(s.data).filter(function (id) {
      return RESTORE_ORDER.indexOf(id) < 0 && reg[id] && reg[id].set;
    });
    ordered.concat(rest).forEach(function (id) {
      try { reg[id].set(s.data[id]); }
      catch (e) { console.error('[save] 恢复模块失败：', id, e); }
    });
    restoring = false;
    return true;
  }

  /* ---------- 落盘 / 读取 ---------- */
  function readRaw() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeRaw(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); return true; }
    catch (e) { console.error('[save] 写入失败', e); return false; }
  }

  function save() {
    if (restoring) return false;
    var ok = writeRaw(serialize());
    updateStamp();
    flash(ok ? '已保存' : '保存失败');
    return ok;
  }
  function load() {
    var s = readRaw();
    if (!s) { flash('无存档'); return false; }
    var ok = deserialize(s);
    updateStamp();
    if (ok && window.__gameH && window.__gameH.applySkillSlots) {
      // 技能恢复后确保战斗区 4 塔同步
      try { window.__skillRender && window.__skillRender(); } catch (e) {}
    }
    flash(ok ? '已读取' : '读取失败');
    return ok;
  }
  function hasSave() { return !!readRaw(); }
  function clearSave() {
    localStorage.removeItem(KEY); updateStamp(); flash('存档已清空');
  }

  /* ---------- 导出 / 导入 JSON 文件 ---------- */
  function exportFile() {
    var blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'baozhan-save-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    flash('已导出 JSON');
  }
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var s = JSON.parse(reader.result);
        if (deserialize(s)) { save(); flash('已导入并保存'); }
        else flash('导入失败');
      } catch (e) { flash('文件无效'); }
    };
    reader.readAsText(file);
  }

  /* ---------- 自动保存（防抖） ---------- */
  function requestSave() {
    if (restoring || !autoOn) return;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(save, 500);
  }

  /* ---------- UI ---------- */
  function flash(msg) {
    var el = document.getElementById('saveMsg');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._tm);
    el._tm = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }
  function updateStamp() {
    var el = document.getElementById('saveStamp');
    if (!el) return;
    var s = readRaw();
    el.textContent = (s && s.ts)
      ? '上次存档：' + new Date(s.ts).toLocaleString('zh-CN', { hour12: false })
      : '尚无存档';
  }

  function bindUI() {
    var bar = document.getElementById('saveBar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'save') save();
      else if (act === 'load') load();
      else if (act === 'export') exportFile();
      else if (act === 'import') { var f = document.getElementById('saveFile'); if (f) f.click(); }
      else if (act === 'clear') { if (confirm('确定清空本地存档？此操作不可恢复。')) clearSave(); }
      else if (act === 'auto') {
        autoOn = !autoOn;
        b.classList.toggle('on', autoOn);
        b.textContent = '自动' + (autoOn ? '开' : '关');
        flash('自动存档' + (autoOn ? '已开启' : '已关闭'));
      }
    });
    var fi = document.getElementById('saveFile');
    if (fi) fi.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });
    updateStamp();
  }

  /* ---------- 启动：在全部面板注册完成后恢复 + 订阅变化 ---------- */
  function boot() {
    bindUI();
    // 订阅英雄装备变化（属性/装备/背包面板都会随动 → 触发自动保存）
    if (window.HERO && window.HERO.onChange) window.HERO.onChange(requestSave);
    // 启动优先恢复已有存档
    if (hasSave()) load();
    else updateStamp();
  }

  /* 暴露 API（供各面板在变化时调用 requestSave） */
  window.GameSave = {
    register: register,
    save: save,
    load: load,
    hasSave: hasSave,
    requestSave: requestSave,
    exportFile: exportFile,
    importFile: importFile,
  };

  /* save.js 先于各面板加载（脚本顺序），故 window.GameSave 已可用；
   * 用 setTimeout(0) 把 boot 排到当前 DOMContentLoaded 派发之后，
   * 确保各面板的 register 调用已全部完成，再执行恢复。 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
})();
