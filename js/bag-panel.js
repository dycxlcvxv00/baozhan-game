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
  const RAR = window.RARITY || {
    magic:{name:'卓越', color:'#00B0F0'}, rare:{name:'史诗', color:'#B842FF'},
    epic:{name:'传说', color:'#FFC000'}, white:{name:'普通', color:'#FFFFFF'}
  };
  const ATTR_DEFS = window.ATTR_DEFS || {};

  /* ---- 装备详情提示 UI（hover 背包物品格触发，结构对齐设计稿） ---- */
  const equipTip = document.createElement('div');
  equipTip.id = 'equipTip';
  equipTip.style.display = 'none';
  document.body.appendChild(equipTip);

  // 词缀名：接入主文档《伤害系统》对应属性的词缀池（取最高档词缀名）
  function affName(key){
    const p = (window.ATTR_POOL || {})[key];
    if (p && p.affixes && p.affixes.length) return p.affixes[p.affixes.length - 1];
    return key;
  }
  function isFlat(key){
    const d = ATTR_DEFS[key];
    return !!(d && d.kind === 'flat');
  }
  // 基于装备 id 的稳定随机（同件装备每次一致）
  function stableRand(seed, lo, hi){
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return lo + (s % (hi - lo + 1));
  }

  function renderEquipTip(it){
    const r = RAR[it.rarity] || {name:it.rarity, color:'#ffffff'};
    equipTip.style.setProperty('--qc', r.color);        // 整框配色跟随品质
    const stars = '✦'.repeat(it.stars || 0);            // 神铸（待开发）星星，紧跟品质右侧
    let h = '';
    // ① 顶部信息栏：品质名 + 神铸星星（同排右）；装备等级在品质下方
    h += '<div class="etHead">'
       +   '<div class="etIcon">' + (it.icon || '❔') + '</div>'
       +   '<div class="etTitle">'
       +     '<div class="etName">' + it.name + '</div>'
       +     '<div class="etRarLine"><span class="etRar" style="color:' + r.color + '">' + r.name + '</span>'
       +       '<span class="etStars">' + stars + '</span></div>'
       +     '<div class="etLv">装备等级 ' + (it.level || 60) + '</div>'
       +   '</div>'
       + '</div>';
    // ② 主属性名 + 强度%（标签用主属性名，非固定「伤害强度」）
    const mainLabel = it.main ? it.main.label : '伤害强度';
    h += '<div class="etRow"><span class="etK">' + mainLabel + '</span><span class="etV">' + (it.dmg || 0) + '%</span></div>';
    h += '<div class="etDiv"></div>';
    // ③ 主属性大字（取消千分号）
    if (it.main){
      h += '<div class="etMain"><span class="etMainNum">' + it.main.val + '</span>'
         +   '<span class="etMainLbl">' + it.main.label + '</span></div>';
    }
    // ④ 属性增幅（词缀接入主文档，去除锁图标）
    const affs = it.attrs || {};
    h += '<div class="etSec"><span class="etSecT">属性增幅</span></div><div class="etDiv"></div>';
    Object.keys(affs).forEach(function(k){
      const val = affs[k];
      const unit = isFlat(k) ? '' : '%';
      h += '<div class="etAff"><span class="etTier">[' + (it.tier || 'T3') + ']</span>'
         +   '<span class="etAffTxt">+' + val + unit + ' ' + affName(k) + '</span></div>';
    });
    // ⑤ 附魔效果：最多 2 个凹槽（已镶嵌显示宝石，空显示凹槽）
    const enc = it.enchant || [];
    h += '<div class="etSec"><span class="etSecT">附魔效果</span></div><div class="etDiv"></div>';
    for (let i = 0; i < 2; i++){
      const e = enc[i];
      if (e){
        h += '<div class="etSocket filled"><span class="etGem">◆</span>'
           +   '<span class="etAffTxt">+' + e.lvl + ' [' + e.skill + '] 技能等级</span></div>';
      } else {
        h += '<div class="etSocket empty"><span class="etHole"></span>'
           +   '<span class="etAffTxt" style="opacity:.5">空槽</span></div>';
      }
    }
    // ⑥ 装备特性（统一为增加 1-100 随机攻击力；名称·置于标题右侧）
    const tn = stableRand(it.id, 1, 100);
    h += '<div class="etSec"><span class="etSecT">装备特性·攻击精通</span></div><div class="etDiv"></div>';
    h += '<div class="etTrait">增加 ' + tn + ' 攻击力</div>';
    equipTip.innerHTML = h;
    equipTip.style.borderColor = r.color;
  }

  function showEquipTip(cell){
    const it = ITEM_MAP[cell.dataset.item];
    if (!it) return;
    renderEquipTip(it);
    equipTip.style.display = 'block';
    const tw = equipTip.offsetWidth, th = equipTip.offsetHeight;
    const r = cell.getBoundingClientRect();
    let x = r.right + 10;
    if (x + tw > window.innerWidth - 8) x = r.left - tw - 10;
    if (x < 8) x = 8;
    let y = r.top + r.height / 2 - th / 2;
    if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
    if (y < 8) y = 8;
    equipTip.style.left = x + 'px';
    equipTip.style.top  = y + 'px';
  }

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
        // hover → 装备详情提示 UI
        const origTitle = cell.title;
        cell.addEventListener('mouseenter', function () {
          cell.title = '';
          showEquipTip(cell);
        });
        cell.addEventListener('mouseleave', function () {
          cell.title = origTitle;
          equipTip.style.display = 'none';
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
