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
  // 判断词缀是否为 flat 类型（flat 词缀不显示 % 号）
  function isAffixFlat(key){
    // AFFIX_KIND 由 char-panel.js 构建，通过 window 暴露
    const ak = (window.AFFIX_KIND || {})[key];
    return ak === 'flat';
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
         +   '<div class="etTitle">'
         +     '<div class="etName">' + it.name + '</div>'
         +     '<div class="etRarLine"><span class="etRar" style="color:' + r.color + '">' + r.name + '</span>'
         +       '<span class="etStars">' + stars + '</span></div>'
         +     '<div class="etLv">装备等级 ' + (it.level || 60) + '</div>'
         +   '</div>'
         +   '<div class="etIcon">' + (it.icon || '❔') + '</div>'
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
      const unit = isAffixFlat(k) ? '' : '%';
      h += '<div class="etAff"><span class="etTier">' + (it.tier || 'T3') + '</span>'
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

  // 背包初始为空，由「增加装备 / 铸造」按钮填充
  const BAG = {};
  for (let p = 1; p <= PAGES; p++) BAG[p] = [];

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

  // 背包操作：整理 / 分解（待接入）+ 铸造 / 增加装备（已实现）
  let instSeq = 0;
  function firstEmptySlot(){
    const ids = BAG[cur] || [];
    for (let i = 0; i < ids.length; i++) if (!ids[i]) return i;
    if (ids.length < COLS * ROWS) { ids.push(null); return ids.length - 1; }
    return -1;
  }
  function addItem(base){
    const slot = firstEmptySlot();
    if (slot < 0) return;
    const inst = Object.assign({}, base);
    inst.id = 'inst' + (++instSeq);
    ITEM_MAP[inst.id] = inst;          // 注册实例，属性随 attrs 真实生效
    BAG[cur][slot] = inst.id;
    buildCells();
  }
  // 铸造：按主文档《装备系统》公式随机生成一件属性真实的装备
  const FORGE_RARS = ['magic', 'rare', 'epic'];
  const FORGE_DEFS = [
    {slot:'武器', main:'攻击力', pool:['攻击伤害','攻击速度','暴击率','冰霜','火焰']},
    {slot:'护甲', main:'护甲值', pool:['护甲值','生命值','伤害减免']},
    {slot:'饰品', main:'攻击力', pool:['暴击率','暴击伤害','法术伤害','最终伤害','精英增伤']},
    {slot:'鞋子', main:'护甲值', pool:['攻击速度','护甲值','生命值']},
  ];
  const RAR_COEF  = {magic:2, rare:2.5, epic:3.5};
  const RAR_TIER  = {magic:'T3', rare:'T2', epic:'T1'};
  const RAR_STARS = {magic:3, rare:4, epic:5};
  const RAR_ICON  = {武器:'🗡️', 护甲:'🛡️', 饰品:'💍', 鞋子:'👢'};
  function forgeItem(){
    const rarity = FORGE_RARS[Math.floor(Math.random() * FORGE_RARS.length)];
    const sd = FORGE_DEFS[Math.floor(Math.random() * FORGE_DEFS.length)];
    const mainVal = Math.round(10 + 10 * (60 / 10) * RAR_COEF[rarity] * (0.8 + Math.random() * 0.7));
    const nAff = 2 + Math.floor(Math.random() * 2);
    const pool = sd.pool.slice(); const attrs = {};
    for (let i = 0; i < nAff && pool.length; i++){
      const idx = Math.floor(Math.random() * pool.length);
      const key = pool.splice(idx, 1)[0];
      attrs[key] = Math.round(10 + Math.random() * 40);
    }
    return { name:'铸造·' + sd.slot, icon:RAR_ICON[sd.slot] || '❔', rarity:rarity, slot:sd.slot,
      level:60, stars:RAR_STARS[rarity], dmg:Math.round(60 + Math.random() * 80),
      tier:RAR_TIER[rarity], main:{label:sd.main, val:mainVal}, attrs:attrs };
  }
  document.querySelectorAll('#bagNav .bagTool').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const act = btn.dataset.act;
      if (act === 'add') {
        if (ITEMS.length) addItem(ITEMS[instSeq % ITEMS.length]);
      } else if (act === 'forge') {
        addItem(forgeItem());
      }
      // 整理 / 分解：逻辑后续接入（整理=按品质/类型排序；分解=批量转化为资源）
    });
  });
})();
