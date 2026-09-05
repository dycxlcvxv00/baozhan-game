/* === 角色属性面板（多文件版） · 数据真相源 = 裸身英雄基准 + 装备加成 ===
 *
 * 设计（按用户 2026-09-05 校准）：
 *   核心三围（数值型，直接展示「基础 + 加成」）：
 *       生命值 1000 ｜ 攻击力 100 ｜ 护甲值 20
 *   其余百分比/乘区属性（显示「装备提供的加成」，初始 0；计算基准 ×1，即 100%→×1）：
 *       全部初始 0% —— 没有装备就没有加成
 *   特例：暴击率初始 0；暴击伤害固定基础 150%
 *
 * 全局共享：window.HERO（装备状态 + 订阅）/ window.ATTR_DEFS / window.ITEM_MAP，
 *          供背包面板（bag-panel.js）在穿戴/卸下时调用并触发本面板重渲染。
 * ============================================================ */
(function initCharPanel(){
  /* ---- 属性释义（tooltip 用，取自主文档「13. 伤害系统」） ---- */
  const ATTR_POOL = {
    '生命值':{desc:'城墙所能承受的伤害值',affixes:['生命值加成','生命值强化','生命值增幅']},
    '攻击力':{desc:'所有伤害的计算基数',affixes:['攻击力加成','攻击力强化','攻击力增幅']},
    '护甲值':{desc:'通过特定公式降低受到的伤害',affixes:['护甲值加成','护甲值强化','护甲值增幅']},
    '物理':  {desc:'造成物理伤害时的增幅系数【×】',affixes:['物理伤害','物理精通','物理增幅','物理穿透']},
    '混沌':  {desc:'造成混沌伤害时的增幅系数【×】',affixes:['混沌伤害','混沌精通','混沌增幅']},
    '冰霜':  {desc:'造成冰霜伤害时的增幅系数【×】',affixes:['冰霜伤害','冰霜精通','冰霜增幅','冰霜穿透']},
    '火焰':  {desc:'造成火焰伤害时的增幅系数【×】',affixes:['火焰伤害','火焰精通','火焰增幅','火焰穿透']},
    '毒素':  {desc:'造成毒素伤害时的增幅系数【×】',affixes:['毒素伤害','毒素精通','毒素增幅','毒素穿透']},
    '闪电':  {desc:'造成闪电伤害时的增幅系数【×】',affixes:['闪电伤害','闪电精通','闪电增幅','闪电穿透']},
    '攻击伤害':{desc:'普攻或攻击技能造成伤害时的增幅系数【×】',affixes:['攻击伤害','攻击精通','攻击增幅','攻击强化']},
    '攻击速度':{desc:'提升普攻和攻击技能打击频率',affixes:['攻击速度','攻速加成','攻速上限']},
    '多重射击':{desc:'可同时攻击的敌人数量（基础 1）',affixes:['多重射击']},
    '粉碎打击':{desc:'攻击命中时触发，造成额外倍数伤害（需装备提供触发率）',affixes:['粉碎打击几率','粉碎打击伤害']},
    '法术伤害':{desc:'法术技能造成伤害时的增幅系数【×】',affixes:['法术伤害','法术精通','法术增幅','法术强化']},
    '充能速度':{desc:'符文每秒充能基数（基础 1.0）',affixes:['充能基数','充能速度']},
    '能量回溯':{desc:'符文释放时触发，回复能量值（需装备提供）',affixes:['能量回溯几率','能量回溯比例']},
    '法术迸发':{desc:'法术命中时触发，造成额外倍数伤害（需装备提供）',affixes:['法术迸发几率','法术迸发伤害']},
    '暴击率': {desc:'造成直接伤害时，触发暴击的几率',affixes:['暴击率']},
    '暴击伤害':{desc:'触发暴击时，本次伤害增幅系数【×】（固定基础 150%）',affixes:['暴击伤害','暴击伤害增幅']},
    '弱点暴击':{desc:'暴击时触发，造成额外倍数伤害（需装备提供）',affixes:['弱点暴击几率','弱点暴击伤害']},
    '生命回溯':{desc:'受到伤害时触发，回复损失生命值（需装备提供）',affixes:['生命回溯几率','生命回溯比例']},
    '护盾值': {desc:'所有伤害优先扣除护盾再扣生命（裸身 0）',affixes:['护盾值','护盾值加成','护盾值增幅']},
    '护盾回溯':{desc:'每隔 2 秒触发，回复最大护盾值（需装备提供）',affixes:['护盾回溯几率','护盾回溯比例']},
    '格挡':   {desc:'受伤时触发格挡，降低所受伤害（需装备提供）',affixes:['格挡几率','格挡比例']},
    '伤害减免':{desc:'减少所受伤害的系数【×】',affixes:['伤害减免']},
    '最终减伤':{desc:'减少所受伤害的系数【×】',affixes:['最终减伤']},
    '小怪增伤':{desc:'对小怪造成伤害时的增幅系数【独立乘区】',affixes:['小怪增伤']},
    '精英增伤':{desc:'对精英造成伤害时的增幅系数【独立乘区】',affixes:['精英增伤']},
    '领主增伤':{desc:'对领主造成伤害时的增幅系数【独立乘区】',affixes:['领主增伤']},
    '伤害加成':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害加成']},
    '伤害增幅':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害增幅']},
    '伤害强化':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害强化']},
    '伤害提升':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害提升']},
    '伤害扩大':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['伤害扩大']},
    '全域增伤':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['全域增伤']},
    '钞能增伤':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['钞能增伤']},
    '最终伤害':{desc:'造成任意伤害时的增幅系数【独立乘区】',affixes:['最终伤害']},
    '单体伤害':{desc:'造成单体伤害时的增幅系数【独立乘区】',affixes:['单体伤害']},
    '范围伤害':{desc:'造成范围伤害时的增幅系数【独立乘区】',affixes:['范围伤害']},
    '投射物伤害':{desc:'造成投射物伤害时的增幅系数【独立乘区】',affixes:['投射物伤害']},
    '持续性伤害':{desc:'造成持续性伤害时的增幅系数【独立乘区】',affixes:['持续性伤害']},
    '弹射伤害':{desc:'造成弹射伤害时的增幅系数【独立乘区】',affixes:['弹射伤害']},
    '异常伤害':{desc:'造成异常伤害时的增幅系数【独立乘区】',affixes:['异常伤害']},
    '陷阱伤害':{desc:'造成陷阱伤害时的增幅系数【独立乘区】',affixes:['陷阱伤害']},
    '灌注伤害':{desc:'造成灌注伤害时的增幅系数【独立乘区】',affixes:['灌注伤害']},
  };

  /* ---- 裸身英雄属性基准（无任何装备）。改动平衡只动这里 ---- */
  const ATTR_DEFS = {
    // 核心三围：数值型，直接展示 基础 + 装备加成
    '生命值':{base:1000, kind:'flat'},
    '攻击力':{base:100,  kind:'flat'},
    '护甲值':{base:20,   kind:'flat'},
    '护盾值':{base:0,    kind:'flat'},
    // 特殊计数 / 速率
    '多重射击':{base:1,   kind:'count'},
    '充能速度':{base:1.0, kind:'charge'},
    // 暴击伤害：固定基础 150%（其余均从 0 起算）
    '暴击伤害':{base:150, kind:'critdmg'},
    // 其余全部为百分比乘区，基础 0%；计算基准 ×1
    '物理':{base:0,kind:'pct'},'混沌':{base:0,kind:'pct'},'冰霜':{base:0,kind:'pct'},
    '火焰':{base:0,kind:'pct'},'毒素':{base:0,kind:'pct'},'闪电':{base:0,kind:'pct'},
    '攻击伤害':{base:0,kind:'pct'},'攻击速度':{base:0,kind:'pct'},'粉碎打击':{base:0,kind:'pct'},
    '法术伤害':{base:0,kind:'pct'},'能量回溯':{base:0,kind:'pct'},'法术迸发':{base:0,kind:'pct'},
    '暴击率':{base:0,kind:'pct'},'弱点暴击':{base:0,kind:'pct'},
    '护盾回溯':{base:0,kind:'pct'},'格挡':{base:0,kind:'pct'},'生命回溯':{base:0,kind:'pct'},
    '伤害减免':{base:0,kind:'pct'},'最终减伤':{base:0,kind:'pct'},
    '小怪增伤':{base:0,kind:'pct'},'精英增伤':{base:0,kind:'pct'},'领主增伤':{base:0,kind:'pct'},
    '伤害加成':{base:0,kind:'pct'},'伤害增幅':{base:0,kind:'pct'},'伤害强化':{base:0,kind:'pct'},
    '伤害提升':{base:0,kind:'pct'},'伤害扩大':{base:0,kind:'pct'},'全域增伤':{base:0,kind:'pct'},
    '钞能增伤':{base:0,kind:'pct'},'最终伤害':{base:0,kind:'pct'},
    '单体伤害':{base:0,kind:'pct'},'范围伤害':{base:0,kind:'pct'},'投射物伤害':{base:0,kind:'pct'},
    '持续性伤害':{base:0,kind:'pct'},'弹射伤害':{base:0,kind:'pct'},'异常伤害':{base:0,kind:'pct'},
    '陷阱伤害':{base:0,kind:'pct'},'灌注伤害':{base:0,kind:'pct'},
  };

  /* ---- 词缀 → 属性归属映射（供面板按维度累加 / 弹窗分维度显示）---- */
  const AFFIX_TO_ATTR = {};
  Object.keys(ATTR_POOL).forEach(function (a) {
    (ATTR_POOL[a].affixes || []).forEach(function (af) { AFFIX_TO_ATTR[af] = a; });
  });

  /* ---- 简易装备（供验证右键穿戴）。
   *   attrs 为「词缀维度」加成（例如 攻击力加成 / 冰霜增幅 / 暴击率），
   *   每个词缀归属到对应主属性（AFFIX_TO_ATTR），驱动面板按维度累加；
   *   其余字段（level/stars/dmg/main/tier/enchant/trait）用于装备详情提示 UI。 ---- */
  const EQUIP_ITEMS = [
    {id:'w1', name:'寒霜短刃', icon:'🗡️', rarity:'rare', slot:'武器',
      level:60, stars:4, dmg:96.4, tier:'T2', main:{label:'攻击力', val:25},
      attrs:{'攻击力加成':25,'冰霜增幅':30,'暴击率':5},
      enchant:[{tier:'T2', skill:'寒霜新星', lvl:1}],
      trait:{name:'凛冬之握', desc:'冰霜伤害提升时，额外获得 8% 攻击速度。'}},
    {id:'a1', name:'守誓胸甲', icon:'🛡️', rarity:'magic', slot:'护甲',
      level:60, stars:3, dmg:72.0, tier:'T3', main:{label:'护甲值', val:12},
      attrs:{'生命值加成':220,'护甲值加成':12,'伤害减免':8}},
    {id:'r1', name:'狂怒指环', icon:'💍', rarity:'rare', slot:'饰品',
      level:60, stars:4, dmg:88.5, tier:'T2', main:{label:'攻击力', val:0},
      attrs:{'暴击率':8,'暴击伤害':25},
      trait:{name:'嗜血', desc:'暴击命中时，回复 2% 最大生命值。'}},
    {id:'b1', name:'疾风战靴', icon:'👢', rarity:'magic', slot:'鞋子',
      level:60, stars:3, dmg:64.2, tier:'T3', main:{label:'护甲值', val:0},
      attrs:{'攻击速度':15}},
    {id:'c1', name:'元素护符', icon:'📿', rarity:'epic', slot:'饰品',
      level:60, stars:5, dmg:112.8, tier:'T1', main:{label:'攻击力', val:0},
      attrs:{'物理增幅':12,'混沌增幅':12,'火焰增幅':12,'闪电增幅':12,'毒素增幅':12},
      enchant:[{tier:'T1', skill:'元素亲和', lvl:2}]},
    {id:'s1', name:'裂隙核心', icon:'🔮', rarity:'epic', slot:'核心',
      level:60, stars:5, dmg:134.6, tier:'T1', main:{label:'攻击力', val:0},
      attrs:{'法术伤害':30,'最终伤害':20,'精英增伤':15},
      trait:{name:'裂隙回响', desc:'释放核心技能后，下一次攻击伤害提升 15%。'}},
  ];
  // 品质 → 名称 / 颜色（取自主文档《装备系统》六档映射）
  const RARITY = {
    white:{name:'普通', color:'#FFFFFF'},
    magic:{name:'卓越', color:'#00B0F0'},
    rare :{name:'史诗', color:'#B842FF'},
    epic :{name:'传说', color:'#FFC000'},
  };
  const ITEM_MAP = {};
  EQUIP_ITEMS.forEach(it => { ITEM_MAP[it.id] = it; });

  /* ---- 共享状态：装备穿戴 / 订阅 ---- */
  const HERO = {
    equipped:{},
    _subs:[],
    isEquipped(id){ return !!this.equipped[id]; },
    equip(it){ this.equipped[it.id] = true; this._notify(); },
    unequip(it){ delete this.equipped[it.id]; this._notify(); },
    toggle(it){ this.isEquipped(it.id) ? this.unequip(it) : this.equip(it); },
    onChange(fn){ this._subs.push(fn); },
    _notify(){ this._subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); },
  };
  window.HERO = HERO;
  window.ITEM_MAP = ITEM_MAP;
  window.EQUIP_ITEMS = EQUIP_ITEMS;
  window.ATTR_DEFS = ATTR_DEFS;
  window.RARITY = RARITY;
  window.ATTR_POOL = ATTR_POOL;

  /* ---- 数值计算 ---- */
  function bonusOf(key){
    let s = 0;
    for (const id in HERO.equipped) {
      const it = ITEM_MAP[id];
      if (!it || !it.attrs) continue;
      for (const ak in it.attrs) {
        if (AFFIX_TO_ATTR[ak] === key) s += it.attrs[ak];
      }
    }
    return s;
  }
  function getVal(key){
    const d = ATTR_DEFS[key];
    if (!d) return 0;
    return d.base + bonusOf(key);
  }
  function fmtNum(n){
    return ('' + n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function displayVal(key){
    const d = ATTR_DEFS[key];
    if (!d) return '—';
    const v = getVal(key);
    switch (d.kind) {
      case 'flat':   return fmtNum(v);
      case 'count':  return '' + v;
      case 'charge': return v.toFixed(1) + ' / s';
      case 'critdmg':return v + '%';
      case 'pct':
      default:       return (v > 0 ? '+' : '') + v + '%';
    }
  }
  // 计算用乘区：百分比 / 暴击伤害 → 系数（基础 ×1）；数值类 → 原数
  function multOf(key){
    const d = ATTR_DEFS[key];
    if (!d) return 1;
    const v = getVal(key);
    if (d.kind === 'pct' || d.kind === 'critdmg') return v / 100;
    return v;
  }
  window.multOf = multOf; // 供战斗层后续引用

  /* ---- 面板分类（四分类结构保持不变） ---- */
  const ATTR_CATS = {
    damage:{
      groups:[
        {cls:'atk',title:'攻击',affs:[
          {name:'攻击伤害'}, {name:'攻击速度'}, {name:'多重射击'}, {name:'粉碎打击'},
        ]},
        {cls:'mgc',title:'法术',affs:[
          {name:'法术伤害'}, {name:'充能速度'}, {name:'能量回溯'}, {name:'法术迸发'},
        ]},
        {cls:'crt',title:'暴击',affs:[
          {name:'暴击率'}, {name:'暴击伤害'}, {name:'弱点暴击'},
        ]},
      ]
    },
    defense:{
      groups:[
        {cls:'def',title:'防御',affs:[
          {name:'护盾值'}, {name:'护盾回溯'}, {name:'格挡'}, {name:'生命回溯'},
        ]},
        {cls:'def',title:'减伤',affs:[
          {name:'伤害减免'}, {name:'最终减伤'},
        ]},
      ]
    },
    boost:{
      groups:[
        {cls:'bst',title:'独立乘区',affs:[
          {name:'伤害加成'}, {name:'伤害增幅'}, {name:'伤害强化'}, {name:'伤害提升'},
          {name:'伤害扩大'}, {name:'全域增伤'}, {name:'钞能增伤'}, {name:'最终伤害'},
        ]},
      ]
    },
    other:{
      groups:[
        {cls:'oth',title:'怪物类型',affs:[
          {name:'小怪增伤'}, {name:'精英增伤'}, {name:'领主增伤'},
        ]},
        {cls:'oth',title:'伤害方式',affs:[
          {name:'单体伤害'}, {name:'范围伤害'}, {name:'投射物伤害'}, {name:'持续性伤害'},
          {name:'弹射伤害'}, {name:'异常伤害'}, {name:'陷阱伤害'}, {name:'灌注伤害'},
        ]},
      ]
    },
  };

  function ready(){ return document.getElementById('attrTabs') && document.getElementById('attrBody'); }

  let curCat = 'damage';

  function tryInit(){
    const tabsEl = document.getElementById('attrTabs');
    const bodyEl = document.getElementById('attrBody');
    if (!tabsEl || !bodyEl) return false;

    // 顶部核心条（生命/攻击/护甲）+ 六元素：由当前状态驱动
    function updateCore(){
      const cp = document.getElementById('charPanel');
      if (!cp) return;
      cp.querySelectorAll('[data-tip]').forEach(el => {
        const k = (el.getAttribute('data-tip') || '').replace(/^attr:/, '');
        if (!(k in ATTR_DEFS)) return;
        const out = el.querySelector('.val, .vl');
        if (out) out.textContent = displayVal(k);
      });
    }

    function render(cat){
      curCat = cat;
      const def = ATTR_CATS[cat];
      if (!def) return;
      bodyEl.innerHTML = '';
      def.groups.forEach(g => {
        const sg = document.createElement('div');
        sg.className = 'sg ' + g.cls;
        const sgh = document.createElement('div');
        sgh.className = 'sgh ' + g.cls;
        sgh.textContent = g.title;
        sg.appendChild(sgh);
        const affs = document.createElement('div');
        affs.className = 'affs';
        g.affs.forEach(a => {
          const e = document.createElement('div');
          e.className = 'aff';
          e.dataset.tip = 'attr:' + a.name;
          const nm = document.createElement('span');
          nm.className = 'nm'; nm.textContent = a.name;
          const vl = document.createElement('span');
          vl.className = 'vl';
          vl.textContent = displayVal(a.name);
          e.appendChild(nm); e.appendChild(vl);
          affs.appendChild(e);
        });
        sg.appendChild(affs);
        bodyEl.appendChild(sg);
      });
    }

    function refresh(){ updateCore(); render(curCat); }
    refresh();

    tabsEl.addEventListener('click', (e) => {
      const t = e.target.closest('.at');
      if (!t) return;
      tabsEl.querySelectorAll('.at').forEach(x => x.classList.toggle('on', x === t));
      render(t.dataset.cat);
    });

    // 装备变化时重渲染
    HERO.onChange(refresh);

    const tip = document.createElement('div');
    tip.className = 'attrTip';
    document.body.appendChild(tip);

    // 属性弹窗：按词缀维度（加成/增幅/强化…）列出实际数值
    function buildSrcList(k){
      const affs = (ATTR_POOL[k] && ATTR_POOL[k].affixes) || [];
      if (!affs.length) return '<div class="meta">该属性暂无词缀维度</div>';
      const d = ATTR_DEFS[k];
      const unit = (d && d.kind === 'flat') ? '' : '%';
      const rows = affs.map(function (af) {
        let v = 0;
        for (const id2 in HERO.equipped) {
          const it = ITEM_MAP[id2];
          if (it && it.attrs && it.attrs[af] != null) v += it.attrs[af];
        }
        return '<li><span>' + af + '</span><b>' + (v > 0 ? '+' : '') + v + unit + '</b></li>';
      });
      return '<ul class="src">' + rows.join('') + '</ul>';
    }

    function showTip(target){
      const k = (target.dataset.tip || '').replace(/^attr:/, '');
      const data = ATTR_POOL[k] || {desc:'', affixes:[]};
      tip.innerHTML =
        '<h5>' + k + '</h5>' +
        '<div class="desc">' + (data.desc || '该属性的实际装备加成数值如下。') + '</div>' +
        '<div class="srcTitle">词缀明细</div>' + buildSrcList(k) +
        '<div class="meta">当前值：' + displayVal(k) + ' ｜ 同名词缀加法、异名词缀乘区</div>';
      const r = target.getBoundingClientRect();
      tip.style.display = 'block';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = r.right + 8, y = r.top - 4;
      if (x + tw > window.innerWidth) x = r.left - tw - 8;
      if (x < 8) x = 8;
      if (y + th > window.innerHeight) y = window.innerHeight - th - 8;
      if (y < 8) y = 8;
      tip.style.left = x + 'px';
      tip.style.top  = y + 'px';
    }

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-tip]');
      if (t) showTip(t);
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('[data-tip]');
      if (t) tip.style.display = 'none';
    });

    return true;
  }

  if (!tryInit()) {
    document.addEventListener('DOMContentLoaded', tryInit);
  }
})();
