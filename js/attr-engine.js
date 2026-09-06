/* ============================================================
 * attr-engine.js — 统一属性引擎（唯一权威数据真相源）
 *
 * 严格对齐主文档第 13 章《伤害系统》：
 *   「同属性下同名词缀为加法，不同名词缀之间为乘区，不设加法区」
 *
 * 词缀角色（role）：
 *   flat   —— 直接叠加进属性基础值（例：武器 +25 攻击力 → 基础攻击力 100+25）
 *   zone   —— 独立乘区 (1 + Σ同名词缀/100)，不同名词缀之间相乘
 *             （例：攻击力加成 25% → ×1.25；与攻击力强化各算各的乘区）
 *   chance —— 触发几率（Σ 合并，用于概率判定；文档机制默认值计入 base）
 *   bonus  —— 触发效果量/额外倍率（base + Σ，例：暴击伤害 150% + 增幅 25% = 175%）
 *   reduce —— 减伤乘区 (1 - Σ/100)（伤害减免 / 最终减伤）
 *   cap    —— 上限类词缀（攻速上限等，仅记录展示，demo 未消费）
 *
 * 本文件提供：词缀全表 / 裸身基准 / 装备数据（EQUIP_ITEMS）/ HERO 穿戴状态 /
 *             聚合计算（sumAffix·zoneMult·attrFinal·affixVal）/ combat() 战斗快照。
 *             char-panel / bag-panel / game-h 一律从这里取数。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 词缀全表（第 13 章，逐条登记；ALIAS 为 bag 随机打造兼容别名） ---------- */
  const AFFIX_DEFS = {
    /* —— 数值型属性：基础值 + flat 词缀 → ×各 zone 词缀 —— */
    '攻击力':      { attr: '攻击力', role: 'flat' },
    '攻击力加成':  { attr: '攻击力', role: 'zone' },
    '攻击力强化':  { attr: '攻击力', role: 'zone' },
    '攻击力增幅':  { attr: '攻击力', role: 'zone' },
    '生命值':      { attr: '生命值', role: 'flat' },
    '生命值加成':  { attr: '生命值', role: 'zone' },
    '生命值强化':  { attr: '生命值', role: 'zone' },
    '生命值增幅':  { attr: '生命值', role: 'zone' },
    '护甲值':      { attr: '护甲值', role: 'flat' },
    '护甲值加成':  { attr: '护甲值', role: 'zone' },
    '护甲值强化':  { attr: '护甲值', role: 'zone' },
    '护甲值增幅':  { attr: '护甲值', role: 'zone' },
    '护盾值':      { attr: '护盾值', role: 'flat' },
    '护盾值加成':  { attr: '护盾值', role: 'zone' },
    '护盾值增幅':  { attr: '护盾值', role: 'zone' },
    '多重射击':    { attr: '多重射击', role: 'flat' },
    '充能基数':    { attr: '充能速度', role: 'flat' },
    '充能速度':    { attr: '充能速度', role: 'zone' },

    /* —— 六元素：伤害/精通/增幅/穿透（混沌无穿透）—— */
    '物理伤害': { attr: '物理', role: 'zone' }, '物理精通': { attr: '物理', role: 'zone' },
    '物理增幅': { attr: '物理', role: 'zone' }, '物理穿透': { attr: '物理', role: 'zone' },
    '混沌伤害': { attr: '混沌', role: 'zone' }, '混沌精通': { attr: '混沌', role: 'zone' },
    '混沌增幅': { attr: '混沌', role: 'zone' },
    '冰霜伤害': { attr: '冰霜', role: 'zone' }, '冰霜精通': { attr: '冰霜', role: 'zone' },
    '冰霜增幅': { attr: '冰霜', role: 'zone' }, '冰霜穿透': { attr: '冰霜', role: 'zone' },
    '火焰伤害': { attr: '火焰', role: 'zone' }, '火焰精通': { attr: '火焰', role: 'zone' },
    '火焰增幅': { attr: '火焰', role: 'zone' }, '火焰穿透': { attr: '火焰', role: 'zone' },
    '毒素伤害': { attr: '毒素', role: 'zone' }, '毒素精通': { attr: '毒素', role: 'zone' },
    '毒素增幅': { attr: '毒素', role: 'zone' }, '毒素穿透': { attr: '毒素', role: 'zone' },
    '闪电伤害': { attr: '闪电', role: 'zone' }, '闪电精通': { attr: '闪电', role: 'zone' },
    '闪电增幅': { attr: '闪电', role: 'zone' }, '闪电穿透': { attr: '闪电', role: 'zone' },

    /* —— 攻击伤害 / 法术伤害：各 4 词缀乘区 —— */
    '攻击伤害': { attr: '攻击伤害', role: 'zone' }, '攻击精通': { attr: '攻击伤害', role: 'zone' },
    '攻击增幅': { attr: '攻击伤害', role: 'zone' }, '攻击强化': { attr: '攻击伤害', role: 'zone' },
    '法术伤害': { attr: '法术伤害', role: 'zone' }, '法术精通': { attr: '法术伤害', role: 'zone' },
    '法术增幅': { attr: '法术伤害', role: 'zone' }, '法术强化': { attr: '法术伤害', role: 'zone' },

    /* —— 节奏 —— */
    '攻击速度': { attr: '攻击速度', role: 'zone' },
    '攻速加成': { attr: '攻击速度', role: 'zone' },
    '攻速上限': { attr: '攻击速度', role: 'cap' },

    /* —— 触发对：几率(chance) + 效果量(bonus)，基准取自文档机制描述 —— */
    '粉碎打击几率': { attr: '粉碎打击', role: 'chance', base: 5 },   // 命中时 5% 几率
    '粉碎打击伤害': { attr: '粉碎打击', role: 'bonus', base: 150 },  // 造成 2.5 倍伤害
    '法术迸发几率': { attr: '法术迸发', role: 'chance', base: 5 },
    '法术迸发伤害': { attr: '法术迸发', role: 'bonus', base: 150 },
    '暴击率':       { attr: '暴击率', role: 'chance', base: 0 },
    '暴击伤害':     { attr: '暴击伤害', role: 'bonus', base: 150 },
    '暴击伤害增幅': { attr: '暴击伤害', role: 'bonus', base: 0 },
    '弱点暴击几率': { attr: '弱点暴击', role: 'chance', base: 5 },
    '弱点暴击伤害': { attr: '弱点暴击', role: 'bonus', base: 150 },
    '能量回溯几率': { attr: '能量回溯', role: 'chance', base: 5 },
    '能量回溯比例': { attr: '能量回溯', role: 'bonus', base: 20 },
    '生命回溯几率': { attr: '生命回溯', role: 'chance', base: 5 },
    '生命回溯比例': { attr: '生命回溯', role: 'bonus', base: 1 },
    '护盾回溯几率': { attr: '护盾回溯', role: 'chance', base: 10 },
    '护盾回溯比例': { attr: '护盾回溯', role: 'bonus', base: 1 },
    '格挡几率':     { attr: '格挡', role: 'chance', base: 5 },
    '格挡比例':     { attr: '格挡', role: 'bonus', base: 30 },

    /* —— 防御减伤乘区 —— */
    '伤害减免': { attr: '伤害减免', role: 'reduce' },
    '最终减伤': { attr: '最终减伤', role: 'reduce' },

    /* —— 怪物类型独立乘区 —— */
    '小怪增伤': { attr: '小怪增伤', role: 'zone' },
    '精英增伤': { attr: '精英增伤', role: 'zone' },
    '领主增伤': { attr: '领主增伤', role: 'zone' },

    /* —— 通用独立乘区（每个词缀各一层乘区）—— */
    '伤害加成': { attr: '伤害加成', role: 'zone' },
    '伤害增幅': { attr: '伤害增幅', role: 'zone' },
    '伤害强化': { attr: '伤害强化', role: 'zone' },
    '伤害提升': { attr: '伤害提升', role: 'zone' },
    '伤害扩大': { attr: '伤害扩大', role: 'zone' },
    '全域增伤': { attr: '全域增伤', role: 'zone' },
    '钞能增伤': { attr: '钞能增伤', role: 'zone' },
    '最终伤害': { attr: '最终伤害', role: 'zone' },

    /* —— 形态独立乘区 —— */
    '单体伤害':   { attr: '单体伤害', role: 'zone' },
    '范围伤害':   { attr: '范围伤害', role: 'zone' },
    '投射物伤害': { attr: '投射物伤害', role: 'zone' },
    '持续性伤害': { attr: '持续性伤害', role: 'zone' },
    '弹射伤害':   { attr: '弹射伤害', role: 'zone' },
    '异常伤害':   { attr: '异常伤害', role: 'zone' },
    '陷阱伤害':   { attr: '陷阱伤害', role: 'zone' },
    '灌注伤害':   { attr: '灌注伤害', role: 'zone' },
  };
  /* 别名：bag-panel 随机打造用属性名作词缀名 → 映射到标准词缀 */
  const AFFIX_ALIAS = {
    '物理': '物理伤害', '混沌': '混沌伤害', '冰霜': '冰霜伤害',
    '火焰': '火焰伤害', '毒素': '毒素伤害', '闪电': '闪电伤害',
  };
  function resolveAffix(af) {
    if (AFFIX_DEFS[af]) return AFFIX_DEFS[af];
    const aliased = AFFIX_ALIAS[af];
    return aliased ? AFFIX_DEFS[aliased] : null;
  }

  /* ---------- 属性释义（tooltip 用，文本取自主文档第 13 章） ---------- */
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
    '粉碎打击':{desc:'攻击命中时触发，造成 2.5 倍伤害（基准：5% 几率 / 150% 伤害）',affixes:['粉碎打击几率','粉碎打击伤害']},
    '法术伤害':{desc:'法术技能造成伤害时的增幅系数【×】',affixes:['法术伤害','法术精通','法术增幅','法术强化']},
    '充能速度':{desc:'符文每秒充能基数（基础 1.0）',affixes:['充能基数','充能速度']},
    '能量回溯':{desc:'符文释放时触发，回复能量值（基准：5% 几率 / 20% 比例）',affixes:['能量回溯几率','能量回溯比例']},
    '法术迸发':{desc:'法术命中时触发，造成 2.5 倍伤害（基准：5% 几率 / 150% 伤害）',affixes:['法术迸发几率','法术迸发伤害']},
    '暴击率': {desc:'造成直接伤害时，触发暴击的几率',affixes:['暴击率']},
    '暴击伤害':{desc:'触发暴击时，本次伤害增幅系数【×】（固定基础 150%）',affixes:['暴击伤害','暴击伤害增幅']},
    '弱点暴击':{desc:'暴击时触发，造成 2.5 倍伤害（基准：5% 几率 / 150% 伤害）',affixes:['弱点暴击几率','弱点暴击伤害']},
    '生命回溯':{desc:'受到伤害时触发，回复 1% 损失生命值（基准：5% 几率）',affixes:['生命回溯几率','生命回溯比例']},
    '护盾值': {desc:'所有伤害优先扣除护盾再扣生命（混沌无视护盾）',affixes:['护盾值加成','护盾值增幅']},
    '护盾回溯':{desc:'每隔 2 秒自动触发，10% 几率回复 1% 最大护盾值',affixes:['护盾回溯几率','护盾回溯比例']},
    '格挡':   {desc:'受伤时 5% 几率触发格挡，降低 30% 所受伤害',affixes:['格挡几率','格挡比例']},
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

  /* ---------- 裸身英雄属性基准（无任何装备） ---------- */
  const ATTR_BASE = {
    '攻击力': 100, '生命值': 1000, '护甲值': 20, '护盾值': 0,
    '多重射击': 1, '充能速度': 1.0,
  };

  /* ---------- 装备数据（词缀名严格取自第 13 章词缀表） ----------
   *  main  = 主属性（flat，直接叠加进对应属性基础值，例：武器 攻击力 +25）
   *  attrs = 词条词缀（% 词缀按引擎 role 生效；同名跨装备合并加法，不同名各成乘区） */
  const EQUIP_ITEMS = [
    {id:'w1', name:'寒霜短刃', icon:'🗡️', rarity:'rare', slot:'武器',
      level:60, stars:4, dmg:96.4, tier:'T2', main:{label:'攻击力', val:25},
      attrs:{'攻击力加成':25,'冰霜增幅':30,'暴击率':5},
      enchant:[{tier:'T2', skill:'寒霜新星', lvl:1}],
      trait:{name:'凛冬之握', desc:'冰霜伤害提升时，额外获得 8% 攻击速度。'}},
    {id:'a1', name:'守誓胸甲', icon:'🛡️', rarity:'magic', slot:'护甲',
      level:60, stars:3, dmg:72.0, tier:'T3', main:{label:'生命值', val:220},
      attrs:{'护甲值加成':10,'伤害减免':8}},
    {id:'r1', name:'狂怒指环', icon:'💍', rarity:'rare', slot:'左戒指',
      level:60, stars:4, dmg:88.5, tier:'T2', main:{label:'攻击力', val:15},
      attrs:{'暴击率':8,'暴击伤害':25},
      trait:{name:'嗜血', desc:'暴击命中时，回复 2% 最大生命值。'}},
    {id:'b1', name:'疾风战靴', icon:'👢', rarity:'magic', slot:'鞋子',
      level:60, stars:3, dmg:64.2, tier:'T3', main:{label:'护甲值', val:6},
      attrs:{'攻击速度':15}},
    {id:'c1', name:'元素护符', icon:'📿', rarity:'epic', slot:'项链',
      level:60, stars:5, dmg:112.8, tier:'T1', main:{label:'攻击力', val:10},
      attrs:{'物理增幅':12,'混沌增幅':12,'火焰增幅':12,'闪电增幅':12,'毒素增幅':12},
      enchant:[{tier:'T1', skill:'元素亲和', lvl:2}]},
    {id:'s1', name:'裂隙核心', icon:'🔮', rarity:'epic', slot:'副手',
      level:60, stars:5, dmg:134.6, tier:'T1', main:{label:'攻击力', val:20},
      attrs:{'法术伤害':30,'最终伤害':20,'精英增伤':15},
      trait:{name:'裂隙回响', desc:'释放核心技能后，下一次攻击伤害提升 15%。'}},
  ];
  /* 品质 → 名称 / 颜色（取自主文档《装备系统》六档映射） */
  const RARITY = {
    white:{name:'普通', color:'#FFFFFF'},
    magic:{name:'卓越', color:'#00B0F0'},
    rare :{name:'史诗', color:'#B842FF'},
    epic :{name:'传说', color:'#FFC000'},
  };
  const ITEM_MAP = {};
  EQUIP_ITEMS.forEach(it => { ITEM_MAP[it.id] = it; });

  /* ---------- 英雄穿戴状态（唯一装备真相源） ----------
   *  equipped: { 物品id → 佩戴槽位 }（10 栏精确名：武器/头盔/手套/护甲/腰带/项链/左戒指/右戒指/鞋子/副手）
   *  普通装备：佩戴槽 = 物品自身 slot，同槽互斥自动替换
   *  戒指（左/右戒指）：自动落空槽 —— 自身槽被占 → 戴到另一枚戒指格；
   *                     两枚戒指格都满 → 才替换自身槽（左右两枚可同时佩戴） */
  const HERO = {
    equipped:{},
    RING_SLOTS:['左戒指','右戒指'],
    _subs:[],
    isEquipped(id){ return !!this.equipped[id]; },
    // 目标槽位当前占用者（可排除自身）
    _slotOccupant(slot, exceptId){
      for (const id in this.equipped) {
        if (id !== exceptId && this.equipped[id] === slot) return id;
      }
      return null;
    },
    equip(it){
      if (!it || !it.id) return;
      let target = it.slot;
      if (this.RING_SLOTS.indexOf(target) >= 0 && this._slotOccupant(target, it.id)) {
        const other = target === '左戒指' ? '右戒指' : '左戒指';
        if (!this._slotOccupant(other, it.id)) target = other;   // 另一枚戒指格空 → 戴过去
      }
      const occ = this._slotOccupant(target, it.id);
      if (occ) delete this.equipped[occ];                        // 同佩戴槽替换
      this.equipped[it.id] = target; this._notify();
    },
    unequip(it){ delete this.equipped[it.id]; this._notify(); },
    toggle(it){ this.isEquipped(it.id) ? this.unequip(it) : this.equip(it); },
    onChange(fn){ this._subs.push(fn); },
    _notify(){ this._subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); },
  };

  /* ---------- 聚合计算 ---------- */
  // 同名词缀加法：Σ 所有已穿戴装备提供的该词缀值（含别名归一）
  function sumAffix(af) {
    let s = 0;
    for (const id in HERO.equipped) {
      const it = ITEM_MAP[id];
      if (!it || !it.attrs) continue;
      for (const ak in it.attrs) {
        const rk = AFFIX_ALIAS[ak] || ak;   // 别名归一到标准词缀
        if (rk === af) s += it.attrs[ak];
      }
    }
    return s;
  }
  // 词缀当前生效值（机制基准 + 装备加成）
  function affixVal(af) {
    const def = resolveAffix(af);
    if (!def) return 0;
    return (def.base || 0) + sumAffix(af);
  }
  // 装备 main 主属性 flat 汇总（例：武器 攻击力+25 → 基础攻击力直接 +25）
  function mainFlat(attrKey) {
    let s = 0;
    for (const id in HERO.equipped) {
      const it = ITEM_MAP[id];
      if (!it || !it.main) continue;
      if (it.main.label === attrKey) s += it.main.val;
    }
    return s;
  }
  // 某属性上所有 flat 词缀之和（含 main 主属性）
  function flatSum(attrKey) {
    let s = mainFlat(attrKey);
    for (const id in HERO.equipped) {
      const it = ITEM_MAP[id];
      if (!it || !it.attrs) continue;
      for (const ak in it.attrs) {
        const def = resolveAffix(ak);
        if (def && def.attr === attrKey && def.role === 'flat') s += it.attrs[ak];
      }
    }
    return s;
  }
  // 某属性的乘区总系数 ∏(1 + Σ同名zone词缀/100)；同一 zone 内同名加法、不同 zone 之间相乘
  function zoneMult(attrKey) {
    let m = 1;
    const zones = {};
    for (const id in HERO.equipped) {
      const it = ITEM_MAP[id];
      if (!it || !it.attrs) continue;
      for (const ak in it.attrs) {
        const def = resolveAffix(ak);
        if (def && def.attr === attrKey && def.role === 'zone') {
          zones[ak] = (zones[ak] || 0) + it.attrs[ak];   // 同名词缀加法
        }
      }
    }
    for (const z in zones) m *= 1 + zones[z] / 100;      // 不同名词缀之间乘区
    return m;
  }
  // 数值型属性最终值 = (基础 + Σflat) × ∏zone
  function attrFinal(attrKey) {
    const base = ATTR_BASE[attrKey] != null ? ATTR_BASE[attrKey] : 0;
    return (base + flatSum(attrKey)) * zoneMult(attrKey);
  }
  // 数值型属性「基础值」= 裸身基准 + Σflat（乘区之前。例：100 + 武器25 = 125）
  function attrBaseFinal(attrKey) {
    const base = ATTR_BASE[attrKey] != null ? ATTR_BASE[attrKey] : 0;
    return base + flatSum(attrKey);
  }
  // zone 类属性的总增幅%（用于面板显示：∏(1+Σ/100) - 1）
  function zonePct(attrKey) {
    return (zoneMult(attrKey) - 1) * 100;
  }

  /* ---------- 战斗快照（game-h 每次装备变化时刷新） ---------- */
  const ELEM_ATTR = { phys:'物理', ice:'冰霜', fire:'火焰', poison:'毒素', lightning:'闪电', chaos:'混沌' };
  const GLOBAL_AFFIXES = ['伤害加成','伤害增幅','伤害强化','伤害提升','伤害扩大','全域增伤','钞能增伤','最终伤害'];
  const FORM_AFFIXES = ['单体伤害','范围伤害','投射物伤害','持续性伤害','弹射伤害','异常伤害','陷阱伤害','灌注伤害'];
  function combat() {
    const elem = {};
    for (const k in ELEM_ATTR) elem[k] = zoneMult(ELEM_ATTR[k]);
    // DoT 专用（文档公式：1 + 元素增伤% + 通用增伤%，加法同括号）：
    //   元素增伤% = 该元素（伤害+精通+增幅）之和（穿透不进 DoT 括号）
    const dotElemPct = {};
    for (const k in ELEM_ATTR) {
      let s = 0;
      ['伤害','精通','增幅'].forEach(suf => { s += sumAffix(ELEM_ATTR[k] + suf); });
      dotElemPct[k] = s;
    }
    let dotGlobalPct = 0;
    GLOBAL_AFFIXES.forEach(af => { dotGlobalPct += sumAffix(af); });
    // 通用独立乘区（8 层相乘）
    let globalMult = 1;
    GLOBAL_AFFIXES.forEach(af => { globalMult *= 1 + sumAffix(af) / 100; });
    // 形态乘区（按形态标记取一层；key = 战斗层 form 标记）
    const FORM_KEY = {
      '单体伤害': 'single', '范围伤害': 'aoe', '投射物伤害': 'projectile', '持续性伤害': 'dot',
      '弹射伤害': 'bounce', '异常伤害': 'abnormal', '陷阱伤害': 'trap', '灌注伤害': 'infuse',
    };
    const formPct = {};
    FORM_AFFIXES.forEach(af => { formPct[FORM_KEY[af]] = sumAffix(af); });
    return {
      atk: attrFinal('攻击力'),
      hp: attrFinal('生命值'),
      armor: attrFinal('护甲值'),
      shield: attrFinal('护盾值'),
      elem,                                   // {ice: 1.3, ...} 六元素乘区系数（含穿透）
      atkMult: zoneMult('攻击伤害'),          // 攻击伤害 4 词缀乘区
      spellMult: zoneMult('法术伤害'),        // 法术伤害 4 词缀乘区
      typeMult: {
        mob: 1 + sumAffix('小怪增伤') / 100,
        elite: 1 + sumAffix('精英增伤') / 100,
        boss: 1 + sumAffix('领主增伤') / 100,
      },
      globalMult,
      formPct,                                // {投射物伤害: 20, ...}（消费时 1+v/100）
      dotElemPct, dotGlobalPct,               // DoT 文档公式专用
      critChance: affixVal('暴击率'),
      critMult: affixVal('暴击伤害') / 100,
      shatter: { chance: affixVal('粉碎打击几率'), mult: affixVal('粉碎打击伤害') / 100 },
      burst:   { chance: affixVal('法术迸发几率'), mult: affixVal('法术迸发伤害') / 100 },
      weak:    { chance: affixVal('弱点暴击几率'), mult: affixVal('弱点暴击伤害') / 100 },
      atkSpeedPct: sumAffix('攻击速度') + sumAffix('攻速加成'),
      multiShot: attrFinal('多重射击'),       // 可同时攻击的敌人数量（基础 1）
      chargeSpd: attrFinal('充能速度'),
      blockChance: affixVal('格挡几率'),
      blockPct: affixVal('格挡比例'),
      dmgReduce: affixVal('伤害减免'),
      finalReduce: affixVal('最终减伤'),
    };
  }

  /* ---------- 面板显示 ---------- */
  function fmtNum(n) {
    const r = Math.round(n * 100) / 100;
    const s = '' + r;
    const dot = s.indexOf('.');
    const intPart = dot < 0 ? s : s.slice(0, dot);
    const decPart = dot < 0 ? '' : s.slice(dot);
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + decPart;
  }
  const ATTR_KIND = {
    '攻击力':'flat','生命值':'flat','护甲值':'flat','护盾值':'flat',
    '多重射击':'count','充能速度':'charge',
    '暴击率':'chance','暴击伤害':'bonus',
    '粉碎打击':'pair','法术迸发':'pair','弱点暴击':'pair',
    '能量回溯':'pair','生命回溯':'pair','护盾回溯':'pair','格挡':'pair',
  };
  function displayVal(attrKey) {
    if (attrKey in ATTR_BASE || ATTR_KIND[attrKey] === 'count' || ATTR_KIND[attrKey] === 'charge') {
      const v = attrFinal(attrKey);
      if (attrKey === '充能速度') return fmtNum(v) + ' / s';
      return fmtNum(v);
    }
    if (attrKey in ATTR_POOL) {
      // 词缀型属性
      if (attrKey === '暴击率') return '+' + fmtNum(affixVal('暴击率')) + '%';
      if (attrKey === '暴击伤害') return fmtNum(affixVal('暴击伤害')) + '%';
      if (attrKey === '粉碎打击') return fmtNum(affixVal('粉碎打击几率')) + '% / ' + fmtNum(affixVal('粉碎打击伤害')) + '%';
      if (attrKey === '法术迸发') return fmtNum(affixVal('法术迸发几率')) + '% / ' + fmtNum(affixVal('法术迸发伤害')) + '%';
      if (attrKey === '弱点暴击') return fmtNum(affixVal('弱点暴击几率')) + '% / ' + fmtNum(affixVal('弱点暴击伤害')) + '%';
      if (attrKey === '能量回溯') return fmtNum(affixVal('能量回溯几率')) + '% / ' + fmtNum(affixVal('能量回溯比例')) + '%';
      if (attrKey === '生命回溯') return fmtNum(affixVal('生命回溯几率')) + '% / ' + fmtNum(affixVal('生命回溯比例')) + '%';
      if (attrKey === '护盾回溯') return fmtNum(affixVal('护盾回溯几率')) + '% / ' + fmtNum(affixVal('护盾回溯比例')) + '%';
      if (attrKey === '格挡') return fmtNum(affixVal('格挡几率')) + '% / ' + fmtNum(affixVal('格挡比例')) + '%';
      // zone 类（元素 / 攻击伤害 / 法术伤害 / 通用 / 形态 / 怪物类型 / 减伤）
      if (attrKey === '伤害减免') return '-' + fmtNum(affixVal('伤害减免')) + '%';
      if (attrKey === '最终减伤') return '-' + fmtNum(affixVal('最终减伤')) + '%';
      return '+' + fmtNum(zonePct(attrKey)) + '%';
    }
    return '—';
  }

  /* ---------- 暴露全局 ---------- */
  window.AttrEngine = {
    AFFIX_DEFS, AFFIX_ALIAS, ATTR_POOL, ATTR_BASE, ELEM_ATTR,
    resolveAffix, sumAffix, affixVal, mainFlat, flatSum, zoneMult, zonePct,
    attrFinal, attrBaseFinal, combat, displayVal, fmtNum,
  };
  window.HERO = HERO;
  window.ITEM_MAP = ITEM_MAP;
  window.EQUIP_ITEMS = EQUIP_ITEMS;
  window.RARITY = RARITY;
  window.ATTR_POOL = ATTR_POOL;
  window.ATTR_BASE = ATTR_BASE;
  window.displayVal = displayVal;
  // 兼容旧调用（战斗层历史钩子）
  window.multOf = function (attrKey) { return zoneMult(attrKey); };
  window.flatBonusOf = function (attrKey) { return flatSum(attrKey); };
  window.pctBonusOf = function (attrKey) { return 0; };

  /* 存档：注册英雄装备状态（供 save.js 持久化 / 恢复）。
   * equipped 值为佩戴槽位名；兼容旧存档 {id:true} → 按物品自身 slot 规范化 */
  if (window.GameSave) {
    window.GameSave.register('hero',
      function () { return Object.assign({}, HERO.equipped); },
      function (eq) {
        HERO.equipped = {};
        for (var id in (eq || {})) {
          var v = eq[id];
          if (v === true) { var it = ITEM_MAP[id]; v = it ? it.slot : ''; }
          if (v) HERO.equipped[id] = v;
        }
        HERO._notify();
      }
    );
  }
})();
