
/* ============================================================
 * game-h.js — 横版战斗区原型（650×300，数值验证沙盒）
 * 布局对齐 V4：英雄 + 4 技能塔同一条垂直线（x=DEF_X），
 * 围墙左移（WALL_X=130），怪物自右侧生成向左撞墙。
 * 数据层 = js/attr-engine.js（AttrEngine.combat() 统一属性快照，
 *          背包穿戴 HERO 装备 → 属性 → 战斗 实时打通），
 * 伤害模型严格对齐主文档第 13 章词缀乘区规则
 * （同属性同名词缀加法、不同名词缀独立乘区）。
 * 视觉风格参照 Project idle（暗色玻璃拟态 + 青/紫霓虹）。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 画布与关键坐标（战斗区局部坐标） ---------- */
  const BW = 650, BH = 300;
  const DEF_X = 58;          // 英雄 + 4 塔 所在垂直线
  const WALL_X = 120;        // 围墙左边缘
  const WALL_W = 26;         // 围墙宽度（立体砖墙）
  const WALL_RX = WALL_X + WALL_W; // 围墙右边缘（怪物撞墙线）
  const ATK_STANDOFF = 20;   // 怪物攻墙时与墙保持的距离（不贴墙）
  const SPAWN_X = 648;       // 怪物生成 x（最右）
  const LANES = [25, 61, 96, 132, 168, 204, 239, 275]; // 8 条横向车道（y）

  /* ---------- 统一属性层（js/attr-engine.js · 第 13 章词缀乘区规则） ---------- */
  const AE = window.AttrEngine;
  let attr = null;          // combat() 属性快照（装备变化时刷新）
  let debugAtk = null;      // 调试覆盖：锁定攻击力数值（供自动化验证）
  function refreshAttr() {
    attr = AE.combat();
    if (debugAtk != null) attr.atk = debugAtk;
    // 围墙血量即英雄生命；护甲由 wallTakeDamage 参与减伤
    wallHpMax = attr.hp;
    if (wallHp <= 0) wallHp = wallHpMax;         // 初始化 / 破墙复位 → 按英雄生命补满
    else if (wallHp > wallHpMax) wallHp = wallHpMax;
  }
  /* 背包穿戴/卸下 HERO 装备 → 战斗属性实时刷新（面板与战斗同一数据真相源） */
  if (window.HERO) window.HERO.onChange(function () { refreshAttr(); });

  /* ---------- 技能（英雄普攻 + 4 塔），数值对齐主文档 7.4 ---------- */
  const HERO_SKILL = { id: 'hero', name: '普攻', elem: 'phys', coef: 0.30, isSpell: false, crit: 0, cd: 0.8, kind: 'basic', form: 'projectile' };

  /* 4 技能基础效果（主文档 7.4《基础技能列表》）：伤害 = 攻击力 × coef
   * kind 决定弹道与命中行为；form 为第 13 章形态乘区标记（投射物/范围/弹射）；
   * slow/burn/shock/poison 为命中附带的异常/控制 */
  const SKILL_PROFILES = {
    iceLance: { id: 'iceLance', name: '寒冰锥刺', elem: 'ice',      isSpell: true,  coef: 3.0, cd: 1.00, kind: 'shards', count: 4, pierce: 2, slow: { pct: 30, dur: 2 }, form: 'projectile' },
    fireball: { id: 'fireball', name: '爆裂火球', elem: 'fire',     isSpell: true,  coef: 2.6, cd: 1.45, kind: 'ball',   aoeR: 58, burn: { stack: 1 }, form: 'projectile' },
    chain:    { id: 'chain',    name: '连锁闪电', elem: 'lightning',isSpell: true,  coef: 1.8, cd: 1.35, kind: 'chain',  bounce: 5, shock: { stack: 1 }, form: 'bounce' },
    spore:    { id: 'spore',    name: '剧毒孢子', elem: 'poison',   isSpell: true,  coef: 2.0, cd: 2.10, kind: 'spore',  aoeR: 52, poison: { stack: 1 }, form: 'aoe' },
  };

  /* 防御方阵：英雄(居中) + 4 塔；4 塔对应技能面板的 4 个上阵槽 */
  const DEF_MARGIN = 30;
  const defenders = [
    { id: 't0', name: '冰霜塔', x: DEF_X, y: 0, skill: null, color: 0x6ad0ff, cd: 0, active: false },
    { id: 't1', name: '火焰塔', x: DEF_X, y: 0, skill: null, color: 0xff8a5a, cd: 0, active: false },
    { id: 'hero', name: '英雄', x: DEF_X, y: 0, skill: HERO_SKILL, color: 0xffd54a, cd: 0, active: true },
    { id: 't2', name: '毒素塔', x: DEF_X, y: 0, skill: null, color: 0x9be36a, cd: 0, active: false },
    { id: 't3', name: '闪电塔', x: DEF_X, y: 0, skill: null, color: 0xc89bff, cd: 0, active: false },
  ];
  /* 技能槽 i（0..3）→ 防御方阵索引（英雄居中，4 塔环绕） */
  const TOWER_IDX = [0, 1, 3, 4];
  (function layoutDefenders() {
    const n = defenders.length;
    const span = (BH - 2 * DEF_MARGIN) / (n - 1);
    defenders.forEach((d, i) => { d.y = Math.round(DEF_MARGIN + i * span); });
  })();

  /* ---------- 伤害计算（严格对齐第 13 章乘区链，不设加法区） ----------
   * 直接伤害 = 攻击力 × 技能系数
   *   × ∏元素词缀乘区（伤害/精通/增幅/穿透：同名加法、异名相乘）
   *   ×（攻击技能 ∏攻击伤害词缀 ｜ 法术技能 ∏法术伤害词缀）
   *   × 怪物类型独立乘区（小怪/精英/领主取一）
   *   × ∏通用独立乘区（伤害加成/增幅/强化/提升/扩大/全域增伤/钞能增伤/最终伤害）
   *   × 形态独立乘区（投射物/范围/弹射…按本次伤害形态取一）
   *   × 暴击 → 弱点暴击；攻击技能 → 粉碎打击；法术技能 → 法术迸发
   *     （几率/倍率均含文档机制基准：5% 几率 / 2.5 倍） */
  function computeDamage(src, skill, monster, form) {
    const a = attr;
    let dmg = a.atk * skill.coef;
    dmg *= a.elem[skill.elem] != null ? a.elem[skill.elem] : 1;   // 元素乘区
    dmg *= skill.isSpell ? a.spellMult : a.atkMult;               // 攻击/法术乘区
    dmg *= a.typeMult[monster.type] || a.typeMult.mob;            // 怪物类型独立乘区
    dmg *= a.globalMult;                                          // 通用独立乘区（8 层相乘）
    const fm = form || skill.form;                                // 形态：调用覆盖 > 技能默认
    if (fm) dmg *= 1 + (a.formPct[fm] || 0) / 100;                // 形态独立乘区
    let rate = a.critChance + (skill.crit || 0);                  // 暴击率（基准 0 + 装备）
    rate = Math.min(95, rate);
    let isCrit = false;
    if (Math.random() * 100 < rate) {
      isCrit = true;
      dmg *= a.critMult;                                          // 暴击伤害（基准 150% + 增幅）
      if (Math.random() * 100 < a.weak.chance) dmg *= a.weak.mult;   // 弱点暴击 5% → 2.5 倍
    }
    if (!skill.isSpell && Math.random() * 100 < a.shatter.chance) dmg *= a.shatter.mult; // 粉碎打击
    if (skill.isSpell && Math.random() * 100 < a.burst.chance)   dmg *= a.burst.mult;    // 法术迸发
    return { dmg: Math.max(1, Math.round(dmg)), crit: isCrit };
  }

  /* 围墙承伤：护甲 → 减免 → 最终减伤 → 格挡 → 护盾优先（血量即英雄生命） */
  let wallHp = 0, wallHpMax = 0;
  function wallTakeDamage(raw) {
    const a = attr;
    let dmg = raw * (100 / (100 + a.armor));
    dmg *= 1 - a.dmgReduce / 100;
    dmg *= 1 - a.finalReduce / 100;
    if (Math.random() * 100 < a.block) dmg *= 0.7;
    if (a.shield > 0) {
      const ab = Math.min(a.shield, dmg);
      dmg -= ab; // 混沌无视护盾（此处简化：护盾承伤）
    }
    wallHp = Math.max(0, wallHp - dmg);
    return dmg;
  }

  /* ---------- 时间 / 全局状态 ---------- */
  let gameTime = 0;        // 累计游戏秒（减速持续判定）
  let dotTimer = 0;        // DoT 每秒结算累加器
  /* DoT 配置（文档：buff 系数为每元素写死的常量表；层数不设上限；每秒几何衰减） */
  const DOT_COEF = { burn: 0.08, shock: 0.08, poison: 0.08 };  // buff 系数（demo 三系同值）
  const DOT_ELEM = { burn: 'fire', shock: 'lightning', poison: 'poison' };  // DoT 归属元素
  const DOT_COLOR = { burn: 0xffa06a, shock: 0xc9a6ff, poison: 0x9be36a };
  const effectTotals = { burn: 0, shock: 0, poison: 0, slow: 0 }; // 调试：异常/控制命中累计

  /* ---------- 怪物 / 子弹 / 特效 ---------- */
  const monsters = [];
  const bullets = [];
  const pops = [];          // 浮动伤害数字
  const fx = [];            // 瞬时特效（爆炸环 / 闪电链），fade 后销毁
  let level = 1, killCount = 0;
  let spawnTimer = 0, spawnInterval = 0.85;
  let purify = 0;           // 净化值（击杀小怪/精英积攒）
  const PURIFY_MAX = 100;   // 净化满 → 生成 BOSS
  let bossActive = false;   // 当前场上是否有 BOSS

  function spawnMonster() {
    let type;
    if (purify >= PURIFY_MAX && !bossActive) type = 'boss'; // 净化满才出 BOSS
    else {
      const r = Math.random();
      type = r < 0.8 ? 'mob' : 'elite';
    }
    const base = type === 'boss' ? 520 : type === 'elite' ? 220 : 60;
    const maxhp = Math.round(base * (1 + level * 0.16));
    const lane = LANES[(Math.random() * LANES.length) | 0];
    const m = {
      x: SPAWN_X, y: lane, type,
      hp: maxhp, maxhp, speed: (34 + Math.random() * 16) * 0.7,
      atkCd: 0, g: null, bar: null, dead: false,
      slowPct: 0, slowUntil: 0, dot: { burn: 0, shock: 0, poison: 0 },
    };
    if (type === 'boss') bossActive = true;
    monsters.push(m);
  }

  /* 选最靠前（x 最小、未越过围墙）的敌人；exclude 为已排除集合 */
  function pickTarget(exclude) {
    let best = null;
    for (const m of monsters) {
      if (m.dead || m.x <= WALL_X) continue;
      if (exclude && exclude.has(m)) continue;
      if (!best || m.x < best.x) best = m;
    }
    return best;
  }
  /* 取除 best 外最靠前的 n 个敌人（多重射击用） */
  function altTargets(best, n) {
    const set = new Set(best ? [best] : []);
    const out = [];
    while (out.length < n) {
      const t = pickTarget(set);
      if (!t) break;
      out.push(t); set.add(t);
    }
    return out;
  }

  /* 命中结算：伤害 + 异常/控制附带（form 覆盖：直击=投射物、爆炸=范围） */
  function hitMonster(m, srcId, skill, form) {
    if (m.dead) return;
    const res = computeDamage({ id: srcId }, skill, m, form || skill.form);
    m.hp -= res.dmg;
    addPop(m.x, m.y - 8, res.dmg, res.crit);
    applyOnHit(m, skill);
    if (m.hp <= 0) { m.dead = true; killMonster(m); }
  }
  function applyOnHit(m, skill) {
    if (skill.slow) { m.slowPct = Math.max(m.slowPct, skill.slow.pct); m.slowUntil = gameTime + skill.slow.dur; effectTotals.slow++; }
    /* 文档：层数不设上限，同目标重施加 = 无限累加 */
    if (skill.burn)   { m.dot.burn   += skill.burn.stack;   effectTotals.burn++; }
    if (skill.shock)  { m.dot.shock  += skill.shock.stack;  effectTotals.shock++; }
    if (skill.poison) { m.dot.poison += skill.poison.stack; effectTotals.poison++; }
  }
  /* 范围爆炸：对半径内敌人结算（direct 命中者排除，避免双倍）；爆炸形态 = 范围伤害 */
  function explode(cx, cy, r, skill, direct) {
    for (const m of monsters) {
      if (m.dead || m === direct) continue;
      if (Math.hypot(m.x - cx, m.y - cy) <= r) hitMonster(m, 'fx', skill, 'aoe');
    }
    const g = new PIXI.Graphics();
    g.lineStyle(3, skill.elem === 'fire' ? 0xff8a5a : 0x9be36a, 0.9);
    g.drawCircle(0, 0, r); g.endFill();
    g.x = cx; g.y = cy;
    addFx(g, 0.35);
  }
  /* 寒冰锥刺：直线发射 count 枚冰锥（固定 y 偏移、水平飞行、穿透 pierce 个敌人） */
  function fireShards(d) {
    const k = d.skill;
    const offs = k.count > 1 ? [-1.5, -0.5, 0.5, 1.5].slice(0, k.count) : [0];
    for (let j = 0; j < k.count; j++) {
      const y = d.y + (offs[j] || 0) * 22;
      bullets.push({ x: d.x + 14, y: y, px: d.x + 14, vx: 380, kind: 'shards', skill: k, srcId: d.id,
        pierce: k.pierce, hitSet: new Set(), g: null });
    }
  }
  /* 单体弹道（普攻/火球/孢子）：追踪目标 */
  function fireProjectile(d, target) {
    bullets.push({ x: d.x + 14, y: d.y, target: target, kind: d.skill.kind, skill: d.skill, srcId: d.id, g: null });
  }
  /* 连锁闪电：从本塔出发在敌人间弹射最多 bounce 次，每次叠加感电 */
  function fireChain(d) {
    const k = d.skill;
    const seq = [];
    const used = new Set();
    let cur = { x: d.x, y: d.y };
    let t = pickTarget(used);
    const RANGE = 175;
    for (let hop = 0; hop <= k.bounce && t; hop++) {
      seq.push(t); used.add(t);
      hitMonster(t, d.id, k);
      cur = t;
      let nx = null, nd = RANGE;
      for (const m of monsters) {
        if (m.dead || used.has(m)) continue;
        const dd = Math.hypot(m.x - cur.x, m.y - cur.y);
        if (dd <= nd) { nd = dd; nx = m; }
      }
      t = nx;
    }
    if (seq.length) {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xc89bff, 0.95);
      g.moveTo(d.x, d.y);
      for (const m of seq) g.lineTo(m.x, m.y);
      addFx(g, 0.3);
    }
  }
  function addFx(g, life) { fx.push({ g, life, max: life }); dynLayer.addChild(g); }

  function addPop(x, y, dmg, crit, col) {
    if (pops.length > 40) return;
    const t = new PIXI.Text(String(dmg), {
      fontFamily: 'Arial', fontSize: crit ? 18 : 13,
      fill: (col != null) ? col : (crit ? 0xffd54a : 0xcfe6ff), fontWeight: '700',
    });
    t.anchor.set(0.5);
    t.x = x; t.y = y;
    popLayer.addChild(t);
    pops.push({ g: t, life: 0.7, vy: -34 });
  }

  /* ---------- Pixi 应用 ---------- */
  const app = new PIXI.Application({
    width: BW, height: BH, backgroundAlpha: 0, antialias: true, resolution: 1, autoDensity: true,
  });
  const wrap = document.getElementById('battleWrap');
  if (!wrap) { console.error('battleWrap 容器缺失'); return; }
  wrap.appendChild(app.view);

  /* 静态层：砖墙 + 防御底座 */
  const bgLayer = new PIXI.Container();   // 静态：砖墙、防御底座
  const dynLayer = new PIXI.Container();  // 怪物、子弹
  const popLayer = new PIXI.Container();  // 浮动伤害数字
  const uiLayer = new PIXI.Container();   // HUD：关卡、净化条、墙血条、简报
  app.stage.addChild(bgLayer, dynLayer, popLayer, uiLayer);

  // 立体灰白砖墙（墙顶血条由 uiLayer 单独绘制）
  function drawWall() {
    const w = new PIXI.Graphics();
    const x0 = WALL_X, x1 = WALL_X + WALL_W, top = 6, bot = BH - 6;
    // 砖缝底（深灰）
    w.beginFill(0x5b5f68); w.drawRect(x0, top, WALL_W, bot - top); w.endFill();
    // 砖块（错缝铺排 + 高光/阴影做出立体感，限位在墙内）
    const bh = 16;
    let row = 0;
    for (let y = top; y < bot; y += bh) {
      const bx0 = x0 + 2, bx1 = x1 - 2, bw = bx1 - bx0;
      w.beginFill(0xcfd4dc); w.drawRect(bx0, y + 2, bw, bh - 3); w.endFill();
      w.beginFill(0xf2f5fa, 0.8); w.drawRect(bx0, y + 2, bw, 3); w.endFill();        // 顶部高光
      w.beginFill(0x868b94, 0.8); w.drawRect(bx0, y + bh - 3, bw, 2); w.endFill();   // 底部阴影
      // 错缝竖向砖缝（仅画墙内部分）
      w.lineStyle(2, 0x4f535c, 0.9);
      const off = (row % 2) ? WALL_W * 0.5 : WALL_W * 0.25;
      let vx = x0 + off;
      while (vx < x1 - 1) { w.moveTo(vx, y + 2); w.lineTo(vx, Math.min(y + bh - 1, bot)); vx += WALL_W * 0.5; }
      w.lineStyle(0);
      row++;
    }
    // 顶面盖板（立体顶边）
    w.beginFill(0xeef1f6); w.drawRect(x0 - 2, top - 4, WALL_W + 4, 5); w.endFill();
    // 右侧暗面（立体右侧）
    w.beginFill(0x4c505a, 0.55); w.drawRect(x1, top, 4, bot - top); w.endFill();
    bgLayer.addChild(w);
  }

  (function drawStatic() {
    drawWall();
    // 防御方阵底座（紫色霓虹，发光）
    const d = new PIXI.Graphics();
    d.lineStyle(8, 0x9b7bff, 0.10); d.moveTo(DEF_X, DEF_MARGIN); d.lineTo(DEF_X, BH - DEF_MARGIN);
    d.lineStyle(1, 0x9b7bff, 0.55); d.moveTo(DEF_X, DEF_MARGIN); d.lineTo(DEF_X, BH - DEF_MARGIN);
    bgLayer.addChild(d);
  })();

  /* 防御方阵图形（常驻） */
  const defG = defenders.map((d) => {
    const c = new PIXI.Container();
    c.x = d.x; c.y = d.y;
    const g = new PIXI.Graphics();
    // 外发光
    g.beginFill(d.color, 0.16); g.drawRoundedRect(-18, -18, 36, 36, 11); g.endFill();
    // 玻璃主体
    g.beginFill(d.color, 0.82); g.lineStyle(2, 0xffffff, 0.7); g.drawRoundedRect(-13, -13, 26, 26, 7); g.endFill();
    // 顶部高光条
    g.lineStyle(0); g.beginFill(0xffffff, 0.25); g.drawRoundedRect(-10, -11, 20, 8, 4); g.endFill();
    c.addChild(g);
    const label = new PIXI.Text(d.name[0], { fontFamily: 'Arial', fontSize: 14, fill: 0x0a0e1a, fontWeight: '700' });
    label.anchor.set(0.5);
    c.addChild(label);
    dynLayer.addChild(c);
    return c;
  });

  /* ---------- HUD（顶层 uiLayer） ---------- */
  // 围墙血条（竖向，贴墙左侧；血量即英雄生命，护甲参与减伤）
  const wallHpBar = new PIXI.Graphics();
  uiLayer.addChild(wallHpBar);

  // 顶部栏 DOM 引用：关卡数 / 净化进度已移出战斗区，接到大页面顶部栏（不遮挡战斗视野）
  const domLevel = document.getElementById('hLevel');
  const domPurifyFill = document.getElementById('purifyFill');
  const domPurifyBar = domPurifyFill ? domPurifyFill.parentElement : null;

  /* ---------- 主循环 ---------- */
  let frames = 0, spawned = 0;
  function loop() {
    frames++;
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
    gameTime += dt;

    // 生成
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnMonster(); spawned++; }

    // 怪物移动 + 撞墙
    let wallBroken = false;
    for (const m of monsters) {
      if (m.dead) continue;
      const slowF = (gameTime < m.slowUntil) ? (1 - m.slowPct / 100) : 1;
      m.x -= m.speed * slowF * dt;
      if (m.x < WALL_RX + ATK_STANDOFF) m.x = WALL_RX + ATK_STANDOFF;   // 被墙体阻挡，但与墙保持距离
      if (!m.g) {
        m.g = new PIXI.Graphics();
        const col = m.type === 'boss' ? 0xff6b81 : m.type === 'elite' ? 0xffa657 : 0xff8a6b;
        m.g.beginFill(col, 0.9); m.g.lineStyle(2, 0xffe2e8, 0.55);
        const r = m.type === 'boss' ? 15 : m.type === 'elite' ? 12 : 9;
        m.g.drawCircle(0, 0, r); m.g.endFill();
        m.g.x = m.x; m.g.y = m.y;
        dynLayer.addChild(m.g);
        m.bar = new PIXI.Graphics(); dynLayer.addChild(m.bar);
      }
      m.g.x = m.x; m.g.y = m.y;
      // 血条
      m.bar.clear();
      m.bar.beginFill(0x000000, 0.5); m.bar.drawRect(m.x - 14, m.y - 20, 28, 4); m.bar.endFill();
      m.bar.beginFill(0x6ee7a8, 0.95); m.bar.drawRect(m.x - 14, m.y - 20, 28 * (m.hp / m.maxhp), 4); m.bar.endFill();
      // 攻墙：贴近（保持距离）后按 1 次/秒攻击；城破 → 标记并退出
      if (m.x <= WALL_RX + ATK_STANDOFF) {
        m.atkCd -= dt;
        if (m.atkCd <= 0) {
          m.atkCd = 1.0;
          const raw = (m.type === 'boss' ? 60 : m.type === 'elite' ? 26 : 12) * (1 + level * 0.1);
          wallTakeDamage(raw);
          if (wallHp <= 0) { wallBroken = true; break; } // 城破 → 后续统一清空
        }
      }
    }

    // 城破：清空全场怪物、清空进度，从当前关卡重新开始（关卡数不变，墙补满）
    if (wallBroken) {
      for (const m of monsters) { killGfx(m); m.dead = true; }
      monsters.length = 0;
      purify = 0; bossActive = false; wallHp = wallHpMax;
    }

    // 防御方阵开火（仅已装配技能的塔；按技能 kind 分派弹道）
    // 攻击速度：缩短普攻和攻击技能释放间隔（cd / (1 + 攻速%))
    const aspd = 1 + attr.atkSpeedPct / 100;
    for (const d of defenders) {
      if (!d.active || !d.skill) continue;
      d.cd -= dt;
      if (d.cd > 0) continue;
      const k = d.skill.kind;
      if (k === 'chain') { fireChain(d); d.cd = d.skill.cd / aspd; continue; }
      const best = pickTarget(null);
      if (!best) { d.cd = 0.1; continue; }
      if (k === 'shards') fireShards(d);
      else fireProjectile(d, best);
      // 多重射击：可同时攻击的敌人数量（基础 1）→ 额外弹道攻击其余最靠前敌人
      const extra = Math.max(0, Math.round(attr.multiShot) - 1);
      if (extra > 0) {
        for (const alt of altTargets(best, extra)) fireProjectile(d, alt);
      }
      d.cd = d.skill.cd / aspd;
    }

    // 子弹飞行 + 命中
    for (const b of bullets) {
      if (!b.g) {
        b.g = new PIXI.Graphics();
        const col = b.kind === 'shards' ? 0x9fe9ff : (b.srcId === 'hero' ? 0xffd54a : 0x9fd0ff);
        b.g.beginFill(col, 0.25); b.g.drawCircle(0, 0, b.kind === 'shards' ? 5 : 7); b.g.endFill();
        b.g.beginFill(col, 0.95); b.g.drawCircle(0, 0, b.kind === 'shards' ? 3 : 4); b.g.endFill();
        dynLayer.addChild(b.g);
      }
      // 寒冰锥刺：直线水平飞行，碰撞同车道敌人，穿透 pierce 个
      if (b.kind === 'shards') {
        const px = (b.px != null) ? b.px : b.x;   // 上一帧 x，用于捕捉穿越
        b.x += b.vx * dt;
        b.g.x = b.x; b.g.y = b.y;
        for (const m of monsters) {
          if (m.dead || b.hitSet.has(m) || m.x <= WALL_X) continue;
          // 本帧子弹 x 区间 [px, b.x] 跨越怪物 x（与帧率无关），且同车道 → 命中
          if (Math.abs(m.y - b.y) <= 13 && m.x >= px - 6 && m.x <= b.x + 6) {
            b.hitSet.add(m);
            hitMonster(m, b.srcId, b.skill);
            if (b.hitSet.size > b.pierce) { killGfx(b); b.done = true; break; }
          }
        }
        b.px = b.x;
        if (b.x > BW + 10) { killGfx(b); b.done = true; }
        continue;
      }
      // 其余：追踪目标
      const t = b.target;
      if (!t || t.dead) {
        if (b.kind === 'ball' || b.kind === 'spore') explode(b.x, b.y, b.skill.aoeR, b.skill, null);
        killGfx(b); b.done = true; continue;
      }
      const dx = t.x - b.x, dy = t.y - b.y, dist = Math.hypot(dx, dy);
      const step = 380 * dt;
      if (dist <= step + 6) {
        if (b.kind === 'ball' || b.kind === 'spore') {
          hitMonster(t, b.srcId, b.skill);                 // 直接命中
          explode(b.x, b.y, b.skill.aoeR, b.skill, t);     // 范围爆炸
        } else {
          hitMonster(t, b.srcId, b.skill);                 // 单体命中
        }
        killGfx(b); b.done = true;
      } else {
        b.x += dx / dist * step; b.y += dy / dist * step;
        b.g.x = b.x; b.g.y = b.y;
      }
    }
    // 清理
    for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].done) bullets.splice(i, 1);
    for (let i = monsters.length - 1; i >= 0; i--) if (monsters[i].dead) monsters.splice(i, 1);

    /* DoT 每秒结算（第 13 章统一规则）：
     * 每秒伤害 = 英雄攻击力 × buff系数 × 当前层数 × (1 + 元素增伤% + 通用增伤%)
     *   —— 元素增伤% = 该元素(伤害+精通+增幅)之和；通用增伤% = 8 通用乘区词缀之和（加法同括号）
     *   —— 不吃暴击 / 不吃形态乘区；本秒先加层（命中即加）→ 结算 → 再衰减
     * 衰减：每秒损失 max(1, round(层数×10%))，层数=0 移除 */
    dotTimer += dt;
    if (dotTimer >= 1) {
      dotTimer -= 1;
      for (const m of monsters) {
        if (m.dead) continue;
        for (const t of ['burn', 'shock', 'poison']) {
          const st = m.dot[t];
          if (!st) continue;
          const ek = DOT_ELEM[t];
          const pct = 1 + ((attr.dotElemPct[ek] || 0) + attr.dotGlobalPct) / 100;
          const dmg = Math.max(1, Math.round(attr.atk * DOT_COEF[t] * st * pct));
          m.hp -= dmg;
          addPop(m.x, m.y - 20, dmg, false, DOT_COLOR[t]);
          const dec = Math.max(1, Math.round(st * 0.1));   // 几何衰减：至少掉 1 层
          m.dot[t] = Math.max(0, st - dec);
          if (m.hp <= 0) { m.dead = true; killMonster(m); break; }
        }
      }
    }
    // 瞬时特效淡出
    for (const f of fx) {
      f.life -= dt;
      if (f.max) f.g.alpha = Math.max(0, f.life / f.max);
      if (f.life <= 0) { dynLayer.removeChild(f.g); f.g.destroy(); f.done = true; }
    }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].done) fx.splice(i, 1);

    // 浮动数字
    for (const p of pops) {
      p.life -= dt; p.g.y += p.vy * dt; p.g.alpha = Math.max(0, p.life / 0.7);
      if (p.life <= 0) { popLayer.removeChild(p.g); p.g.destroy(); p.done = true; }
    }
    for (let i = pops.length - 1; i >= 0; i--) if (pops[i].done) pops.splice(i, 1);

    // 顶部栏 DOM 同步（关卡数 / 净化进度已移至大页面顶部栏，不遮挡战斗视野）
    const pr = Math.max(0, Math.min(1, purify / PURIFY_MAX));
    if (domLevel) domLevel.textContent = level;
    if (domPurifyFill) domPurifyFill.style.width = (pr * 100).toFixed(1) + '%';
    if (domPurifyBar) domPurifyBar.classList.toggle('boss', pr >= 1);

    // 围墙血条（竖向，贴墙左侧；血量即英雄生命，护甲参与减伤；填充锚定底部，从上向下降低）
    const wr = wallHpMax > 0 ? Math.max(0, wallHp / wallHpMax) : 0;
    const VBAR = { x: WALL_X - 9, w: 6, top: 6, bot: BH - 6 };
    const vh = VBAR.bot - VBAR.top;
    const wcol = wr > 0.5 ? 0x6ee7a8 : wr > 0.25 ? 0xffd166 : 0xff6b81;
    const fillH = Math.max(1, vh * wr);
    wallHpBar.clear();
    wallHpBar.beginFill(0x10141f, 0.92); wallHpBar.drawRoundedRect(VBAR.x, VBAR.top, VBAR.w, vh, 3); wallHpBar.endFill();
    wallHpBar.beginFill(wcol, 0.96); wallHpBar.drawRoundedRect(VBAR.x, VBAR.bot - fillH, VBAR.w, fillH, 3); wallHpBar.endFill();
  }

  function killMonster(m) {
    killGfx(m);
    killCount++;
    if (m.type === 'boss') {
      level++; purify = 0; bossActive = false;   // 击杀 BOSS → 通关（进下一关）
    } else if (m.type === 'mob') {
      purify = Math.min(PURIFY_MAX, purify + 8);  // 小怪积攒净化值
    } else if (m.type === 'elite') {
      purify = Math.min(PURIFY_MAX, purify + 20); // 精英积攒更多
    }
  }
  function killGfx(o) { if (o && o.g) { try { o.g.destroy(); } catch (e) {} o.g = null; } if (o && o.bar) { try { o.bar.destroy(); } catch (e) {} o.bar = null; } }

  refreshAttr();
  app.ticker.add(loop);

  /* ---------- 暴露接口（供自动化验证 / 调试） ---------- */
  const ELEM_COLOR_MAP = { ice: 0x6ad0ff, fire: 0xff8a5a, lightning: 0xc89bff, poison: 0x9be36a, phys: 0xffd54a };
  function redrawDefender(gr, col, ch, empty) {
    gr.clear();
    if (empty) {
      gr.lineStyle(2, 0x4a4f5e, 0.9); gr.drawRoundedRect(-13, -13, 26, 26, 7); gr.endFill();
      gr.lineStyle(0);
    } else {
      gr.beginFill(col, 0.16); gr.drawRoundedRect(-18, -18, 36, 36, 11); gr.endFill();
      gr.beginFill(col, 0.82); gr.lineStyle(2, 0xffffff, 0.7); gr.drawRoundedRect(-13, -13, 26, 26, 7); gr.endFill();
      gr.lineStyle(0); gr.beginFill(0xffffff, 0.25); gr.drawRoundedRect(-10, -11, 20, 8, 4); gr.endFill();
    }
  }
  window.__gameH = {
    get hasGame() { return true; },
    get attrRows() { return Object.keys(AE.AFFIX_DEFS).length; },
    get defX() { return DEF_X; },
    get wallX() { return WALL_X; },
    get defenderXs() { return defenders.map(d => d.x); },

    /* 伤害公式直调（供自动化验证乘区链）：form 缺省取技能形态 */
    calc(skillId, mtype, form) {
      const prof = SKILL_PROFILES[skillId] || HERO_SKILL;
      return computeDamage({ id: 'debug' }, prof, { type: mtype || 'mob' }, form);
    },
    /* DoT 公式直调（文档：攻击力 × buff系数 × 层数 × (1+元素增伤%+通用增伤%)） */
    dotPreview(type, stacks) {
      const ek = DOT_ELEM[type];
      const pct = 1 + ((attr.dotElemPct[ek] || 0) + attr.dotGlobalPct) / 100;
      return Math.max(1, Math.round(attr.atk * DOT_COEF[type] * stacks * pct));
    },
    /* HERO 装备联动（背包穿戴 → 属性 → 战斗）：供测试/调试快速穿戴 */
    heroEquip(id) { const it = window.ITEM_MAP[id]; if (it) { window.HERO.equip(it); refreshAttr(); } },
    heroUnequip(id) { const it = window.ITEM_MAP[id]; if (it) { window.HERO.unequip(it); refreshAttr(); } },
    heroClear() { window.HERO.equipped = {}; refreshAttr(); },

    get attr() { return attr; },
    get level() { return level; },
    get wallHp() { return wallHp; },
    get purify() { return purify; },
    get purifyMax() { return PURIFY_MAX; },
    get bossActive() { return bossActive; },
    get monsterCount() { return monsters.length; },
    get frames() { return frames; },
    get spawned() { return spawned; },
    get tickerStarted() { return app.ticker.started; },

    /* 调试：防御塔装配状态 / 怪物异常层数 / 弹幕种类计数 */
    get defendersActive() { return defenders.map(d => !!d.active); },
    get defenderSkills() { return defenders.map(d => d.skill ? d.skill.id : null); },
    get dotMonsterCount() { return monsters.filter(m => m.dot.burn + m.dot.shock + m.dot.poison > 0).length; },
    get slowMonsterCount() { return monsters.filter(m => gameTime < m.slowUntil).length; },
    get shockMonsterCount() { return monsters.filter(m => m.dot.shock > 0).length; },
    get effectTotals() { return Object.assign({}, effectTotals); },
    debugSetAtk(v) { debugAtk = (typeof v === 'number') ? v : null; refreshAttr(); },
    get bulletKinds() { const c = {}; bullets.forEach(b => { c[b.kind] = (c[b.kind] || 0) + 1; }); return c; },
  };

  /* 技能上阵 → 战斗区即时同步（4 塔对应 4 插槽；空槽 → 该塔置空不发射）
   * defs[i] 可为技能 id 字符串，或带 .id 的技能对象（来自技能面板 syncBattleArea） */
  window.__gameH.applySkillSlots = function (defs) {
    if (!Array.isArray(defs)) return;
    for (let i = 0; i < 4; i++) {
      const di = TOWER_IDX[i];
      const d = defenders[di]; const g = defG[di];
      if (!d) continue;
      const raw = defs[i];
      const id = raw ? (raw.id || raw) : null;
      const prof = (id && SKILL_PROFILES[id]) ? SKILL_PROFILES[id] : null;
      if (!prof) {                                  // 空槽 → 战斗区该塔设为空（不发射）
        d.active = false; d.skill = null;
        if (g) { g.alpha = 0.4; redrawDefender(g.children[0], d.color, '', true); g.children[1].text = '空'; }
        continue;
      }
      d.active = true; d.skill = prof;
      const col = ELEM_COLOR_MAP[prof.elem] || d.color;
      d.color = col;
      if (g) { g.alpha = 1; redrawDefender(g.children[0], col, prof.name[0], false); g.children[1].text = prof.name[0]; }
    }
  };

  /* 默认装配：4 技能全部上阵，战斗区立即展示 4 种基础效果（用户清空槽位即对应置空） */
  window.__gameH.applySkillSlots(['iceLance', 'fireball', 'chain', 'spore']);
})();

