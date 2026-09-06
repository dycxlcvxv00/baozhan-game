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

  // 词缀名：attrs 的 key 已是第 13 章正式词缀名，直接展示
  function affName(key){
    const p = (window.ATTR_POOL || {})[key];
    if (p && p.affixes && p.affixes.length) return p.affixes[p.affixes.length - 1];
    return key;
  }
  // 判断词缀是否为 flat 类型（flat 词缀不显示 % 号）
  function isAffixFlat(key){
    const def = window.AttrEngine && window.AttrEngine.resolveAffix(key);
    return !!def && def.role === 'flat';
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
    if (window.GameSave) window.GameSave.requestSave();
  }
  /* ============================================================
   * 铸造系统（随机属性装备生成，「铸造」按钮触发）
   *  - 10 装备槽位全覆盖，词缀严格取自主文档第 13 章词缀表
   *    （AttrEngine.AFFIX_DEFS 全部可解析，穿戴后真实生效）
   *  - 品质：卓越 50% / 史诗 35% / 传说 15%；词缀条数 2 / 3 / 4
   *  - 主属性（flat）+ 词条词缀（% 乘区），属性计算走 AttrEngine
   * ============================================================ */
  const AFFIX_GROUPS = {
    atkPower: ['攻击力加成','攻击力强化','攻击力增幅'],
    atkDmg:   ['攻击伤害','攻击精通','攻击增幅','攻击强化'],
    elem:     ['物理伤害','物理精通','物理增幅','物理穿透',
               '混沌伤害','混沌精通','混沌增幅',
               '冰霜伤害','冰霜精通','冰霜增幅','冰霜穿透',
               '火焰伤害','火焰精通','火焰增幅','火焰穿透',
               '毒素伤害','毒素精通','毒素增幅','毒素穿透',
               '闪电伤害','闪电精通','闪电增幅','闪电穿透'],
    crit:     ['暴击率','暴击伤害','暴击伤害增幅','弱点暴击几率','弱点暴击伤害'],
    shatter:  ['粉碎打击几率','粉碎打击伤害'],
    burst:    ['法术迸发几率','法术迸发伤害'],
    spellDmg: ['法术伤害','法术精通','法术增幅','法术强化'],
    global:   ['伤害加成','伤害增幅','伤害强化','伤害提升','伤害扩大','全域增伤','钞能增伤','最终伤害'],
    typeDmg:  ['小怪增伤','精英增伤','领主增伤'],
    form:     ['单体伤害','范围伤害','投射物伤害','持续性伤害','弹射伤害','异常伤害','陷阱伤害','灌注伤害'],
    defense:  ['生命值加成','生命值强化','生命值增幅','护甲值加成','护甲值强化','护甲值增幅'],
    shield:   ['护盾值加成','护盾值增幅'],
    reduce:   ['伤害减免','最终减伤'],
    block:    ['格挡几率','格挡比例'],
    regen:    ['生命回溯几率','生命回溯比例','护盾回溯几率','护盾回溯比例'],
    speed:    ['攻击速度','攻速加成','攻速上限'],
    multi:    ['多重射击'],
    charge:   ['充能基数','充能速度'],
    energy:   ['能量回溯几率','能量回溯比例'],
  };
  // 10 槽位定义：主属性候选 + 允许出现的词缀组 + 图标 / 部件名
  const FORGE_SLOTS = [
    { slot:'武器',   main:['攻击力'],          groups:['atkPower','atkDmg','elem','crit','shatter'], icon:'🗡️', part:'长刃' },
    { slot:'头盔',   main:['生命值','护甲值'], groups:['defense','reduce','regen','energy'],         icon:'🪖', part:'战盔' },
    { slot:'手套',   main:['攻击力'],          groups:['speed','multi','atkDmg','charge'],           icon:'🧤', part:'手套' },
    { slot:'护甲',   main:['生命值','护甲值'], groups:['defense','reduce','block','shield'],         icon:'🛡️', part:'胸甲' },
    { slot:'腰带',   main:['生命值','护甲值'], groups:['defense','shield','regen','reduce'],         icon:'🧵', part:'腰带' },
    { slot:'项链',   main:['攻击力'],          groups:['elem','global','typeDmg','crit'],            icon:'📿', part:'护符' },
    { slot:'左戒指', main:['攻击力'],          groups:['crit','atkPower','typeDmg','global'],        icon:'💍', part:'戒指' },
    { slot:'右戒指', main:['攻击力'],          groups:['crit','atkPower','typeDmg','global'],        icon:'💍', part:'戒指' },
    { slot:'鞋子',   main:['护甲值'],          groups:['speed','multi','regen','charge'],            icon:'👢', part:'战靴' },
    { slot:'副手',   main:['护盾值','生命值'], groups:['shield','spellDmg','burst','global','form'], icon:'🔮', part:'核心' },
  ];
  const NAME_PRE = ['寒霜','烈焰','雷霆','剧毒','巨岩','疾风','圣光','暗影','裂隙','星陨'];
  const FORGE_RARS = ['magic', 'rare', 'epic'];
  const RAR_COEF  = {magic:1,   rare:1.4, epic:1.9};   // 主属性品质系数
  const AFF_COEF  = {magic:1,   rare:1.5, epic:2};     // 词缀品质系数
  const AFF_COUNT = {magic:2,   rare:3,   epic:4};     // 词缀条数
  const RAR_TIER  = {magic:'T3', rare:'T2', epic:'T1'};
  const RAR_STARS = {magic:3,   rare:4,   epic:5};
  const MAIN_RANGE = { '攻击力':[12,26], '生命值':[120,260], '护甲值':[5,12], '护盾值':[80,200] };

  function rollRarity(){
    const r = Math.random() * 100;
    return r < 50 ? 'magic' : (r < 85 ? 'rare' : 'epic');
  }
  // 单条词缀值：flat 固定 1（多重射击）/ chance 3-8 / bonus 15-45 / reduce 4-10 / 其余 zone 8-28，×品质系数
  function rollAffixVal(af, rarity){
    const def = window.AttrEngine ? window.AttrEngine.resolveAffix(af) : null;
    let lo = 8, hi = 28;
    if (def && def.role === 'flat') return 1;
    if (def && def.role === 'chance') { lo = 3; hi = 8; }
    else if (def && def.role === 'bonus') { lo = 15; hi = 45; }
    else if (def && def.role === 'reduce') { lo = 4; hi = 10; }
    return Math.max(1, Math.round((lo + Math.random() * (hi - lo)) * AFF_COEF[rarity]));
  }
  function forgeItem(){
    const rarity = rollRarity();
    const sd = FORGE_SLOTS[Math.floor(Math.random() * FORGE_SLOTS.length)];
    // 主属性：候选中随机一个 → 值域 × 品质系数（flat，直接叠加进基础值）
    const mainLabel = sd.main[Math.floor(Math.random() * sd.main.length)];
    const mr = MAIN_RANGE[mainLabel] || [10, 20];
    const mainVal = Math.max(1, Math.round((mr[0] + Math.random() * (mr[1] - mr[0])) * RAR_COEF[rarity]));
    // 词条词缀：槽位允许的词缀组汇总后不重复抽取
    let pool = [];
    sd.groups.forEach(function (g) { pool = pool.concat(AFFIX_GROUPS[g] || []); });
    const attrs = {};
    for (let i = 0; i < AFF_COUNT[rarity] && pool.length; i++){
      const idx = Math.floor(Math.random() * pool.length);
      const af = pool.splice(idx, 1)[0];
      attrs[af] = rollAffixVal(af, rarity);
    }
    return {
      name: '铸造·' + NAME_PRE[Math.floor(Math.random() * NAME_PRE.length)] + sd.part,
      icon: sd.icon, rarity: rarity, slot: sd.slot,
      level: 60, stars: RAR_STARS[rarity], dmg: Math.round(60 + Math.random() * 80),
      tier: RAR_TIER[rarity], main: { label: mainLabel, val: mainVal }, attrs: attrs,
    };
  }
  // 暴露铸造器（供测试 / 外部调用）
  window.BagForge = {
    forge: forgeItem, slots: FORGE_SLOTS, groups: AFFIX_GROUPS,
    rollRarity: rollRarity, rollAffixVal: rollAffixVal,
  };
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

  // 暴露装备提示 UI，供右上角装备栏（纸娃娃）复用
  window.showEquipTip = showEquipTip;   // 入参为带 dataset.item 的单元格
  window.equipTipEl = equipTip;

  /* 存档：注册背包库存（实例物品 + 各页格位 + 实例序号）。
   * 必须在 char-panel 之后恢复：实例物品先回注 ITEM_MAP，paperdoll 才能正确显示。 */
  if (window.GameSave) {
    window.GameSave.register('bag',
      function () {
        var inst = [];
        for (var k in ITEM_MAP) { if (k.indexOf('inst') === 0) inst.push(ITEM_MAP[k]); }
        var bag = {};
        for (var p in BAG) bag[p] = BAG[p];
        return { inst: inst, bag: bag, seq: instSeq };
      },
      function (payload) {
        if (!payload) return;
        // 清掉旧实例（保留基础 EQUIP_ITEMS），再回注存档中的实例
        for (var k in ITEM_MAP) { if (k.indexOf('inst') === 0) delete ITEM_MAP[k]; }
        (payload.inst || []).forEach(function (it) { ITEM_MAP[it.id] = it; });
        if (payload.bag) { for (var p in payload.bag) BAG[p] = payload.bag[p]; }
        if (typeof payload.seq === 'number') instSeq = payload.seq;
        buildCells();
        if (window.HERO) window.HERO._notify();
      }
    );
  }
})();
