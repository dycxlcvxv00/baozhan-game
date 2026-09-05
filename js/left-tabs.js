/* ============================================================
 * left-tabs.js — 左侧 4 个功能按钮 ↔ 底部信息面板视图切换
 * 映射：装备→viewEquip / 技能→viewSkill / 宠物→viewPet / 铭文→viewRune
 * 默认显示装备页 viewEquip（左 属性栏 / 右 背包栏），并激活「装备」按钮。
 * 再次点击已激活按钮 → 回到默认视图（装备页）。
 * 2026-09-04：配合「底部面板改为可切换视图」重构。
 * ============================================================ */
(function () {
  'use strict';

  const MAP = {
    '装备': 'viewEquip',
    '技能': 'viewSkill',
    '宠物': 'viewPet',
    '铭文': 'viewRune',
  };
  const DEFAULT_VIEW = 'viewEquip';

  function show(id) {
    const views = document.querySelectorAll('#bottom .bview');
    Array.prototype.forEach.call(views, function (v) {
      v.hidden = (v.id !== id);
    });
  }

  function init() {
    window.__leftTabsReady = true;
    const btns = document.querySelectorAll('#fbtns .fbtn');
    if (!btns.length) return;
    show(DEFAULT_VIEW); // 初始显示装备页（左属性栏 / 右背包栏）
    // 初始激活「装备」按钮（与默认视图一致）
    Array.prototype.forEach.call(btns, function (b) {
      if (b.getAttribute('data-k') === '装备') b.classList.add('on');
    });

    Array.prototype.forEach.call(btns, function (btn) {
      const k = btn.getAttribute('data-k');
      const target = MAP[k];
      if (!target) return;
      btn.addEventListener('click', function () {
        const wasOn = btn.classList.contains('on');
        // 先统一清除所有按钮高亮
        Array.prototype.forEach.call(document.querySelectorAll('#fbtns .fbtn'), function (x) {
          x.classList.remove('on');
        });
        if (wasOn) {
          // 再次点击当前按钮 → 回到默认视图
          show(DEFAULT_VIEW);
          return;
        }
        btn.classList.add('on');
        show(target);
        // 技能视图需渲染 2×2 网格（由 skill-panel.js 暴露）
        if (k === '技能' && typeof window.__skillRender === 'function') {
          window.__skillRender();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
