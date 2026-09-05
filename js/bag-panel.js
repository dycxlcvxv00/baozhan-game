/* ============================================================
 * bag-panel.js — 背包面板（装备页右侧）
 * 顶部导航栏：整理 / 分解 + 页面标签 1-10
 * 下方：10×5 背包格子，铺满剩余空间、不滚动、hover 框内略微高亮
 *
 * 数据层（物品 / 分页数据）后续接入主文档背包章节；
 * 当前为结构原型：格子为占位空槽，分页仅切换激活态。
 * ============================================================ */
(function () {
  'use strict';

  const COLS = 10, ROWS = 5, PAGES = 10;

  const grid = document.getElementById('bagGrid');
  const pages = document.getElementById('bagPages');
  if (!grid || !pages) return;

  // 页面标签 1-10（首屏默认激活第 1 页）
  for (let i = 1; i <= PAGES; i++) {
    const p = document.createElement('div');
    p.className = 'bagPage' + (i === 1 ? ' on' : '');
    p.textContent = i;
    p.dataset.page = i;
    pages.appendChild(p);
  }

  // 重建当前页格子（每页独立占位，数据接入后按页渲染）
  function buildCells() {
    grid.innerHTML = '';
    const n = COLS * ROWS;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'bagCell';
      grid.appendChild(c);
    }
  }
  buildCells();

  // 点击页面标签：切换激活态 + 重建该页格子
  pages.addEventListener('click', function (e) {
    const t = e.target.closest('.bagPage');
    if (!t) return;
    Array.prototype.forEach.call(pages.children, function (c) {
      c.classList.remove('on');
    });
    t.classList.add('on');
    buildCells();
  });

  // 整理 / 分解：当前占位，仅做点击反馈（逻辑后续接入）
  document.querySelectorAll('#bagNav .bagTool').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // TODO: 接入背包操作（整理=按品质/类型排序；分解=批量转化为资源）
    });
  });
})();
