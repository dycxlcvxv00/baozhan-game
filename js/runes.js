
/* ============================================================
 * runes.js — 符文矩阵 + 装备系统（强化技能 / 英雄承载）
 * 设定对齐：主文档第 6 章（符文系统）、第 5 章（英雄·10 装备槽）
 * 第 13 章（伤害系统·属性词缀）
 * ============================================================ */

/* ---------- 1. 符文库（8 种，每颗唯一；仅改造 4 塔，不影响英雄） ----------
 * key  : 增益键（对应 js/game.js 中技能/塔能力字段）
 * value: 符文基础强度（dev 文档快照数值）
 */
const RUNE_DEFS = [
  { id: 'burn',    name: '烈焰', element: 'fire',      key: 'burn',    label: '燃烧',   value: 55,  desc: '附加燃烧 DoT' },
  { id: 'slow',    name: '寒霜', element: 'ice',       key: 'slow',    label: '减速',   value: 40,  desc: '命中减速目标' },
  { id: 'chain',   name: '雷击', element: 'lightning', key: 'chain',   label: '弹射',   value: 150, desc: '弹射层数×100' },
  { id: 'armor',   name: '破甲', element: 'physical',  key: 'dmg',     label: '直伤',   value: 60,  desc: '追加直接伤害' },
  { id: 'poison',  name: '剧毒', element: 'poison',    key: 'poison',  label: '毒伤',   value: 70,  desc: '附加中毒 DoT' },
  { id: 'reson',   name: '共鸣', element: 'chaos',     key: 'aoe',     label: '范围',   value: 45,  desc: '扩大作用范围' },
  { id: 'rage',    name: '狂暴', element: null,        key: 'rate',    label: '攻速',   value: 35,  desc: '提升攻击速度' },
  { id: 'pierce',  name: '贯穿', element: null,        key: 'pierceN', label: '穿透',   value: 210, desc: '穿透层数×100' },
];

/* ---------- 2. 符文矩阵几何（11×5 六边形锯齿栅格） ----------
 * 固定位：英雄 (行5,列2)；4 塔 (行1,列2)(行3,列2)(行7,列2)(行9,列2)
 * 覆盖判定：插槽圆心到塔圆心欧氏距离 ≤ n×W → 该塔被覆盖
 * 范围衰减：f(n) = (2/(n+1))^1.15
 */
const MATRIX_ROWS = 11, MATRIX_COLS = 5, HEX_W = 64;
const HERO_CELL = { row: 5, col: 2 };
const TOWER_CELLS = [
  { row: 1, col: 2 }, { row: 3, col: 2 }, { row: 7, col: 2 }, { row: 9, col: 2 },
];

function hexToPixel(row, col) {
  const x = col * HEX_W + (row % 2 ? HEX_W / 2 : 0) + HEX_W / 2;
  const y = row * HEX_W * 0.9 + HEX_W / 2;
  return { x, y };
}
function hexDist(a, b) {
  const pa = hexToPixel(a.row, a.col), pb = hexToPixel(b.row, b.col);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}
// 范围衰减系数（广度 vs 强度）
function atten(n) { return Math.pow(2 / (n + 1), 1.15); }
// 能量预算（强制混搭）：已镶嵌符文范围档位之和 ≤ 20
const RUNE_ENERGY_BUDGET = 20;

/* RuneMatrix：管理镶嵌 / 覆盖 / 衰减 / 能量预算，并算出每塔有效强度 */
class RuneMatrix {
  constructor() {
    this.placements = []; // {runeId, row, col, n}
  }
  get usedRuneIds() { return this.placements.map(p => p.runeId); }
  energyUsed() { return this.placements.reduce((s, p) => s + p.n, 0); }
  energyLeft() { return RUNE_ENERGY_BUDGET - this.energyUsed(); }

  place(runeId, row, col, n = 3) {
    if (this.usedRuneIds.includes(runeId)) return false;          // 唯一性
    if (this.placements.some(p => p.row === row && p.col === col)) return false; // 每格1颗
    if (this.energyLeft() < n) return false;                       // 能量预算
    if (row === HERO_CELL.row && col === HERO_CELL.col) return false; // 英雄位不可编辑
    this.placements.push({ runeId, row, col, n });
    return true;
  }
  removeAt(row, col) {
    this.placements = this.placements.filter(p => !(p.row === row && p.col === col));
  }
  // 一颗符文覆盖到某塔的有效强度
  effectiveOnTower(placement, towerCell) {
    const dist = hexDist(placement, towerCell);
    if (dist > placement.n * HEX_W) return 0;     // 未覆盖
    const def = RUNE_DEFS.find(r => r.id === placement.runeId);
    return def ? def.value * atten(placement.n) : 0;
  }
  // 汇总某塔（按 matrix 坐标）收到的所有符文增益
  towerBuffs(towerCell) {
    const buffs = {};
    for (const p of this.placements) {
      const eff = this.effectiveOnTower(p, towerCell);
      if (eff > 0) {
        const def = RUNE_DEFS.find(r => r.id === p.runeId);
        buffs[def.key] = (buffs[def.key] || 0) + eff;
      }
    }
    return buffs; // 例：{burn:55*F, slow:40*F, ...}
  }
  reset() { this.placements = []; }
}

/* ---------- 3. 装备系统（英雄·10 部位） ----------
 * 10 槽：武器/副手/头盔/护甲/项链/左戒指/右戒指/手套/腰带/鞋子
 * 每件装备带有 effects；effect 分两类：
 *   a) 属性词缀增益：{type:'attr', key, value}  → 直接挂到英雄属性
 *   b) 装备特效：    {type:'onHitCritBuild', perHit, cap, decay, idle}
 *        →「命中时暴击率增加」的总开关：只有镶嵌了带该特效的装备，
 *          暴击率才会在命中时逐发积累；否则暴击率恒等于（英雄+塔独立）基础值。
 */
const EQUIP_SLOTS = ['武器', '副手', '头盔', '护甲', '项链', '左戒指', '右戒指', '手套', '腰带', '鞋子'];

/* 预设 10 件装备（原型占位，后续由养成系统产出） */
const EQUIP_PRESETS = {
  '武器':   { name: '烈阳长刃', effects: [
    { type: 'attr', key: 'atk', value: 25 },
    { type: 'onHitCritBuild', perHit: 4, cap: 40, decay: 20, idle: 1.2 }, // 关键：开启暴击积累
  ]},
  '副手':   { name: '守誓之盾', effects: [
    { type: 'attr', key: 'shield', value: 500 },
    { type: 'attr', key: 'block', value: 5 },
  ]},
  '头盔':   { name: '洞察盔', effects: [
    { type: 'attr', key: 'crit', value: 4 },
  ]},
  '护甲':   { name: '壁垒甲', effects: [
    { type: 'attr', key: 'armor', value: 120 },
    { type: 'attr', key: 'dmgReduce', value: 8 },
  ]},
  '项链':   { name: '元素坠', effects: [
    { type: 'attr', key: 'fire', value: 12 },
    { type: 'attr', key: 'ice', value: 12 },
  ]},
  '左戒指': { name: '暴怒戒', effects: [
    { type: 'attr', key: 'critDmg', value: 20 },
  ]},
  '右戒指': { name: '疾风戒', effects: [
    { type: 'attr', key: 'atkSpeed', value: 15 },
  ]},
  '手套':   { name: '连击手套', effects: [
    { type: 'attr', key: 'multiShot', value: 1 },
  ]},
  '腰带':   { name: '韧性腰带', effects: [
    { type: 'attr', key: 'hp', value: 300 },
    { type: 'attr', key: 'finalReduce', value: 5 },
  ]},
  '鞋子':   { name: '迅捷靴', effects: [
    { type: 'attr', key: 'atkSpeed', value: 10 },
  ]},
};

class EquipmentSystem {
  constructor() {
    this.fitted = {}; // slot -> {name, effects}
  }
  equip(slot, item) { this.fitted[slot] = item; }
  unequip(slot) { delete this.fitted[slot]; }
  toggle(slot) {
    if (this.fitted[slot]) this.unequip(slot);
    else if (EQUIP_PRESETS[slot]) this.equip(slot, EQUIP_PRESETS[slot]);
  }
  isFitted(slot) { return !!this.fitted[slot]; }
  // 汇总所有已镶嵌装备对某属性的词缀增益
  attrBonus(key) {
    let sum = 0;
    for (const slot in this.fitted) {
      for (const e of this.fitted[slot].effects) {
        if (e.type === 'attr' && e.key === key) sum += e.value;
      }
    }
    return sum;
  }
  // 是否存在「命中暴击率积累」装备特效
  hasOnHitCritBuild() {
    for (const slot in this.fitted) {
      for (const e of this.fitted[slot].effects) {
        if (e.type === 'onHitCritBuild') return e;
      }
    }
    return null;
  }
  reset() { this.fitted = {}; }
}

/* 暴露到全局（index.html 按序加载 pixi → runes → game） */
window.RUNE_DEFS = RUNE_DEFS;
window.RuneMatrix = RuneMatrix;
window.MATRIX_ROWS = MATRIX_ROWS;
window.MATRIX_COLS = MATRIX_COLS;
window.HERO_CELL = HERO_CELL;
window.TOWER_CELLS = TOWER_CELLS;
window.HEX_W = HEX_W;
window.RUNE_ENERGY_BUDGET = RUNE_ENERGY_BUDGET;
window.atten = atten;
window.EquipmentSystem = EquipmentSystem;
window.EQUIP_SLOTS = EQUIP_SLOTS;
window.EQUIP_PRESETS = EQUIP_PRESETS;

