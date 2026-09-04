/* ============================================================
 * left-tabs.js — 左侧功能按钮（装备 / 宠物 / 铭文）面板切换
 * 与 skill-panel.js（技能）并列，统一以 #fbtns 为 tab 组：
 *   点击 → 取消其他按钮 .on → 本按钮 .on → 在 #panelView 渲染对应面板。
 * 2026-09-04：按 demo开发文档「左上 UI 按钮区」改版，
 *   清空旧 9 按钮，首批接入 装备 / 技能 / 宠物 / 铭文 4 个功能按钮。
 *   本模块只接管 装备 / 宠物 / 铭文；「技能」由 skill-panel.js 独占。
 * ============================================================ */
(function () {
  'use strict';

  /* 各功能面板的渲染器（原型占位，内容随主文档设定逐步接入） */
  const TABS = {
    '装备': function (view) {
      view.innerHTML =
        '<b style="color:var(--accent)">装备面板</b>'
        + '<div style="color:var(--dim);font-size:14px;line-height:1.75;margin-top:10px">'
        + '英雄 10 件装备（武器 / 头盔 / 手套 / 护甲 / 腰带 / 项链 / 左戒指 / 右戒指 / 鞋子 / 副手）'
        + '的穿戴、卸下与数值总览在此查看。<br>右侧栏已展示纸娃娃装备槽，本面板将逐步接入装备详情与套装效果。</div>';
    },
    '宠物': function (view) {
      view.innerHTML =
        '<b style="color:var(--accent)">宠物面板</b>'
        + '<div style="color:var(--dim);font-size:14px;line-height:1.75;margin-top:10px">'
        + '宠物出战、技能与养成系统（开发中占位）。后续接入主文档宠物章节设定。</div>';
    },
    '铭文': function (view) {
      view.innerHTML =
        '<b style="color:var(--accent)">铭文面板</b>'
        + '<div style="color:var(--dim);font-size:14px;line-height:1.75;margin-top:10px">'
        + '铭文镶嵌、词条与共鸣系统（开发中占位）。后续接入主文档符文 / 铭文章节设定。</div>';
    },
  };

  function init() {
    const all = document.querySelectorAll('#fbtns .fbtn');
    if (!all.length) return;
    all.forEach(function (btn) {
      const k = btn.getAttribute('data-k');
      if (!TABS[k]) return; // 「技能」由 skill-panel.js 处理，跳过
      btn.addEventListener('click', function () {
        document.querySelectorAll('#fbtns .fbtn').forEach(function (x) { x.classList.remove('on'); });
        btn.classList.add('on');
        const view = document.getElementById('panelView');
        if (view) TABS[k](view);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
