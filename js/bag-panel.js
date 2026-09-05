/* ============================================================
 * bag-panel.js — 背包面板（装备页右侧）
 * 顶部导航栏：整理 / 分解 + 页面标签 1-10
 * 下方：10×5 背包格子，铺满剩余空间、不滚动、hover 框内略微高亮
 *
 * 简易装备：物品落在第 1 页前若干格；
 *   右键单元格 → 穿戴 / 卸下（toggle），属性面板随 window.HERO 变化重渲染。
 *   数据层真实物品来自 window.EQUIP_ITEMS（定义于 char-panel.js）。
 * ============================================================ */
(function () {
  'use strict';

  const COLS = 10, ROWS = 5, PAGES = 10;
  const grid  = document.getElementById('bagGrid');
  const pages = document.getElementById('bagPages');
  if (!grid || !pages) return;

  const ITEMS = window.EQUIP_ITEMS || [];
  const ITEM_MAP = window.ITEM_MAP || {};
  const HERO = window.HERO;

  // 背包分页数据：第 1 页放入全部简易装备，其余页为空
  const BAG = {};
  for (let p = 1; p <= PAGES; p++) BAG[p] = [];
  ITEMS.forEach((it, i) => { if (i < COLS * ROWS) BAG[1][i] = it.id; });

  let cur = 1;

  // 页面标签 1-10（首屏默认激活第 1 页）
  for (let i = 1; i <= PAGES; i++) {
    const p = document.createElement('div');
    p.className = 'bagPage' + (i === 1 ? ' on' : '');
    p.textContent = i;
    p.dataset.page = i;
    pages.appendChild(p);
  }

  function buildCells(){
    grid.innerHTML = '';
    const ids = BAG[cur] || [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const cell = document.createElement('div');
      cell.className = 'bagCell';
      const id = ids[i];
      const it = id ? ITEM_MAP[id] : null;
      if (it) {
        const equipped = HERO && HERO.isEquipped(id);
        cell.classList.add('filled', 'r', it.rarity);
        if (equipped) cell.classList.add('equipped');
        cell.dataset.item = id;
        cell.title = it.name + '（' + it.slot + '）· 右键' + (equipped ? '卸下' : '穿戴');
        cell.innerHTML =
          '<div class="ic">' + it.icon + '</div>' +
          '<div class="nm">' + it.name + '</div>' +
          (equipped ? '<div class="eq">已装备</div>' : '');
        // 右键穿戴 / 卸下
        cell.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          if (HERO) HERO.toggle(it);
        });
      }
      grid.appendChild(cell);
    }
  }
  buildCells();

  // 装备状态变化 → 重建当前页（刷新已装备高亮）
  if (HERO) HERO.onChange(buildCells);

  // 点击页面标签：切换激活态 + 重建该页格子
  pages.addEventListener('click', function (e) {
    const t = e.target.closest('.bagPage');
    if (!t) return;
    Array.prototype.forEach.call(pages.children, function (c) {
      c.classList.remove('on');
    });
    t.classList.add('on');
    cur = parseInt(t.dataset.page, 10) || 1;
    buildCells();
  });

  // 整理 / 分解：当前占位，仅做点击反馈（逻辑后续接入）
  document.querySelectorAll('#bagNav .bagTool').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // TODO: 接入背包操作（整理=按品质/类型排序；分解=批量转化为资源）
    });
  });
})();
