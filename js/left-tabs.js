/* ============================================================
 * left-tabs.js — 左侧 4 个功能按钮 ↔ 底部信息面板视图切换
 * 映射：装备→viewEquip / 技能→viewSkill / 宠物→viewPet / 铭文→viewRune
 * 默认（无按钮激活）显示 viewChar（角色属性）。
 * 再次点击已激活按钮 → 回到默认视图。
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
  const DEFAULT_VIEW = 'viewChar';

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
    show(DEFAULT_VIEW); // 初始显示角色属性视图

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
