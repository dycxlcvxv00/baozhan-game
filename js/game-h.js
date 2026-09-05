
/* ============================================================
 * game-h.js — 横版战斗区原型（650×300，数值验证沙盒）
 * 布局对齐 V4：英雄 + 4 技能塔同一条垂直线（x=DEF_X），
 * 围墙左移（WALL_X=130），怪物自右侧生成向左撞墙。
 * 数据层复用 runes.js（EquipmentSystem / 暴击门控），
 * 伤害模型对齐主文档第 13 章 29 项属性。
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

  /* ---------- 第 13 章 29 项属性（全量接入） ---------- */
  const ATTR_DEFS = [
    { key: 'atk',        name: '攻击力',   cat: '基础', desc: '所有伤害的计算基数' },
    { key: 'hp',         name: '生命值',   cat: '基础', desc: '英雄生命上限' },
    { key: 'armor',      name: '护甲值',   cat: '防御', desc: '按 100/(100+护甲) 减伤' },
    { key: 'phys',       name: '物理伤害', cat: '元素', desc: '物理系增伤' },
    { key: 'chaos',      name: '混沌伤害', cat: '元素', desc: '混沌系增伤（无视护盾）' },
    { key: 'ice',        name: '冰霜伤害', cat: '元素', desc: '冰霜系增伤' },
    { key: 'fire',       name: '火焰伤害', cat: '元素', desc: '火焰系增伤' },
    { key: 'poison',     name: '毒素伤害', cat: '元素', desc: '毒素系增伤' },
    { key: 'lightning',  name: '闪电伤害', cat: '元素', desc: '闪电系增伤' },
    { key: 'atkDmg',     name: '攻击伤害', cat: '增伤', desc: '普攻/物理技能乘区' },
    { key: 'atkSpeed',   name: '攻击速度', cat: '节奏', desc: '缩短技能释放间隔' },
    { key: 'multiShot',  name: '多重射击', cat: '节奏', desc: '额外弹道数' },
    { key: 'shatter',    name: '粉碎打击', cat: '暴击', desc: '命中附加额外倍率' },
    { key: 'spellDmg',   name: '法术伤害', cat: '增伤', desc: '法术技能乘区' },
    { key: 'chargeSpd',  name: '充能速度', cat: '节奏', desc: '能量积攒速率' },
    { key: 'energyRegen',name: '能量回溯', cat: '节奏', desc: '能量回复' },
    { key: 'spellBurst', name: '法术迸发', cat: '暴击', desc: '法术额外倍率' },
    { key: 'crit',       name: '暴击率',   cat: '暴击', desc: '基础暴击概率' },
    { key: 'critDmg',    name: '暴击伤害', cat: '暴击', desc: '暴击倍率' },
    { key: 'weakCrit',   name: '弱点暴击', cat: '暴击', desc: '暴击时再触发弱点' },
    { key: 'hpRegen',    name: '生命回溯', cat: '防御', desc: '生命回复' },
    { key: 'shield',     name: '护盾值',   cat: '防御', desc: '优先承伤的护盾' },
    { key: 'shieldRegen',name: '护盾回溯', cat: '防御', desc: '护盾回复' },
    { key: 'block',      name: '格挡',     cat: '防御', desc: '概率减伤 30%' },
    { key: 'dmgReduce',  name: '伤害减免', cat: '防御', desc: '常驻减伤' },
    { key: 'finalReduce',name: '最终减伤', cat: '防御', desc: '最后一层减伤' },
    { key: 'mobDmg',     name: '小怪增伤', cat: '类型', desc: '对小怪增伤' },
    { key: 'eliteDmg',   name: '精英增伤', cat: '类型', desc: '对精英增伤' },
    { key: 'bossDmg',    name: '领主增伤', cat: '类型', desc: '对领主增伤' },
  ];
  const BASE_ATTR = {
    atk: 100, hp: 1000, armor: 0,
    phys: 0, chaos: 0, ice: 0, fire: 0, poison: 0, lightning: 0,
    atkDmg: 0, atkSpeed: 0, multiShot: 0, shatter: 0,
    spellDmg: 0, chargeSpd: 0, energyRegen: 0, spellBurst: 0,
    crit: 5, critDmg: 50, weakCrit: 5,
    hpRegen: 0, shield: 0, shieldRegen: 0, block: 0, dmgReduce: 0, finalReduce: 0,
    mobDmg: 0, eliteDmg: 0, bossDmg: 0,
  };
  const attr = {};
  function refreshAttr() {
    for (const k in BASE_ATTR) attr[k] = BASE_ATTR[k] + equip.attrBonus(k);
    critBuildCfg = equip.hasOnHitCritBuild();
    if (!critBuildCfg) critBuild = 0;           // 无装备特效 → 暴击率不积累
    // 围墙血量即英雄生命；护甲由 wallTakeDamage 参与减伤
    wallHpMax = attr.hp;
    if (wallHp <= 0) wallHp = wallHpMax;         // 初始化 / 破墙复位 → 按英雄生命补满
    else if (wallHp > wallHpMax) wallHp = wallHpMax;
  }

  /* ---------- 装备系统（复用 runes.js） ---------- */
  const equip = new EquipmentSystem();
  equip.equip('武器', EQUIP_PRESETS['武器']);    // 默认穿戴「烈阳长刃」→ 开启暴击积累
  let critBuild = 0, critBuildCfg = null;

  /* ---------- 技能（英雄普攻 + 4 塔），数值对齐竖版 demo ---------- */
  const HERO_SKILL = { id: 'hero', name: '普攻', elem: 'phys', coef: 0.30, isSpell: false, crit: 0, cd: 0.8 };
  const TOWER_SKILLS = [
    { id: 'ice',      name: '冰锥刺',   elem: 'ice',      coef: 0.24, isSpell: false, crit: 0, cd: 1.0 },
    { id: 'fire',     name: '爆裂火球', elem: 'fire',     coef: 0.36, isSpell: true,  crit: 0, cd: 1.45 },
    { id: 'poison',   name: '剧毒爆弹', elem: 'poison',   coef: 0.16, isSpell: true,  crit: 0, cd: 2.10 },
    { id: 'lightning',name: '连锁闪电', elem: 'lightning',coef: 0.24, isSpell: true,  crit: 0, cd: 1.35 },
  ];

  /* 防御方阵：英雄 + 4 塔，全部落在 DEF_X 这条垂直线；在 [DEF_MARGIN, BH-DEF_MARGIN]
     内均匀竖直分布，最上下端留白（英雄居中） */
  const DEF_MARGIN = 30;
  const defenders = [
    { id: 'ice',      name: '冰锥刺', x: DEF_X, y: 0, skill: TOWER_SKILLS[0], color: 0x6ad0ff, cd: 0 },
    { id: 'fire',     name: '爆裂火球', x: DEF_X, y: 0, skill: TOWER_SKILLS[1], color: 0xff8a5a, cd: 0 },
    { id: 'hero',     name: '英雄',   x: DEF_X, y: 0, skill: HERO_SKILL,    color: 0xffd54a, cd: 0 },
    { id: 'poison',   name: '剧毒爆弹', x: DEF_X, y: 0, skill: TOWER_SKILLS[2], color: 0x9be36a, cd: 0 },
    { id: 'lightning',name: '连锁闪电', x: DEF_X, y: 0, skill: TOWER_SKILLS[3], color: 0xc89bff, cd: 0 },
  ];
  (function layoutDefenders() {
    const n = defenders.length;
    const span = (BH - 2 * DEF_MARGIN) / (n - 1);
    defenders.forEach((d, i) => { d.y = Math.round(DEF_MARGIN + i * span); });
  })();

  /* ---------- 伤害计算（对齐第 13 章） ---------- */
  const ELEM_KEY = { phys: 'phys', ice: 'ice', fire: 'fire', poison: 'poison', lightning: 'lightning', chaos: 'chaos' };
  function computeDamage(src, skill, monster) {
    const a = attr;
    let dmg = a.atk * skill.coef * (1 + a.atkDmg / 100);
    const ek = ELEM_KEY[skill.elem] || 'phys';
    dmg *= 1 + (a[ek] || 0) / 100;                       // 元素增伤
    dmg *= 1 + (skill.isSpell ? a.spellDmg : a.atkDmg) / 100; // 攻击/法术乘区（不重复）
    const tKey = (monster.type === 'boss' ? 'bossDmg' : monster.type === 'elite' ? 'eliteDmg' : 'mobDmg');
    dmg *= 1 + (a[tKey] || 0) / 100;                     // 怪物类型独立乘区
    let rate = a.crit + (skill.crit || 0) + critBuild;   // 暴击：基础+技能+积累
    rate = Math.min(95, rate);
    let isCrit = false;
    if (Math.random() * 100 < rate) {
      isCrit = true;
      dmg *= 1 + a.critDmg / 100;
      if (Math.random() * 100 < a.weakCrit) dmg *= 1.5;  // 弱点暴击
    }
    if (!skill.isSpell && Math.random() * 100 < a.shatter) dmg *= 1.5;  // 粉碎打击
    if (skill.isSpell && Math.random() * 100 < a.spellBurst) dmg *= 1.3; // 法术迸发
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

  /* ---------- 怪物 / 子弹 ---------- */
  const monsters = [];
  const bullets = [];
  const pops = [];          // 浮动伤害数字
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
    };
    if (type === 'boss') bossActive = true;
    monsters.push(m);
  }

  function spawnBullet(src, target) {
    bullets.push({ x: src.x + 14, y: src.y, target, skill: src.skill, srcId: src.id, g: null });
  }

  function addPop(x, y, dmg, crit) {
    if (pops.length > 40) return;
    const t = new PIXI.Text(String(dmg), {
      fontFamily: 'Arial', fontSize: crit ? 18 : 13,
      fill: crit ? 0xffd54a : 0xcfe6ff, fontWeight: '700',
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

    // 生成
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnMonster(); spawned++; }

    // 怪物移动 + 撞墙
    let wallBroken = false;
    for (const m of monsters) {
      if (m.dead) continue;
      m.x -= m.speed * dt;
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

    // 防御方阵开火
    for (const d of defenders) {
      d.cd -= dt;
      if (d.cd <= 0) {
        // 选目标：始终优先攻击最靠前（x 最小、未越过围墙）的敌人
        let best = null;
        for (const m of monsters) {
          if (m.dead || m.x <= WALL_X) continue;
          if (!best || m.x < best.x) best = m;
        }
        if (best) {
          d.cd = d.skill.cd;
          spawnBullet(d, best);
          // 多重射击：额外弹道
          for (let i = 0; i < (attr.multiShot | 0); i++) {
            let alt = null;
            for (const m of monsters) { if (m.dead || m.x <= WALL_X || m === best) continue; if (!alt || Math.abs(m.y - d.y) < Math.abs(alt.y - d.y)) alt = m; }
            if (alt) spawnBullet(d, alt);
          }
        } else {
          d.cd = 0.1;
        }
      }
    }

    // 子弹飞行 + 命中
    for (const b of bullets) {
      if (!b.g) {
        b.g = new PIXI.Graphics();
        const col = b.srcId === 'hero' ? 0xffd54a : 0x9fd0ff;
        b.g.beginFill(col, 0.25); b.g.drawCircle(0, 0, 7); b.g.endFill();
        b.g.beginFill(col, 0.95); b.g.drawCircle(0, 0, 4); b.g.endFill();
        dynLayer.addChild(b.g);
      }
      const t = b.target;
      if (!t || t.dead) { killGfx(b); b.done = true; continue; }
      const dx = t.x - b.x, dy = t.y - b.y, dist = Math.hypot(dx, dy);
      const step = 360 * dt;
      if (dist <= step + 6) {
        // 命中
        const res = computeDamage({ id: b.srcId }, b.skill, t);
        t.hp -= res.dmg;
        addPop(t.x, t.y - 8, res.dmg, res.crit);
        if (critBuildCfg) { critBuild = Math.min(critBuildCfg.cap, critBuild + critBuildCfg.perHit); }
        if (t.hp <= 0) { t.dead = true; killGfx(t); killGfx(b); killMonster(t); }
        else killGfx(b);
        b.done = true;
      } else {
        b.x += dx / dist * step; b.y += dy / dist * step;
        b.g.x = b.x; b.g.y = b.y;
      }
    }
    // 清理
    for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].done) bullets.splice(i, 1);
    for (let i = monsters.length - 1; i >= 0; i--) if (monsters[i].dead) monsters.splice(i, 1);

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
  window.__gameH = {
    get hasGame() { return true; },
    get attrRows() { return ATTR_DEFS.length; },
    get defX() { return DEF_X; },
    get wallX() { return WALL_X; },
    get defenderXs() { return defenders.map(d => d.x); },
    get critBuild() { return critBuild; },
    get critBuildCfg() { return critBuildCfg; },
    get weaponOn() { return equip.isFitted('武器'); },
    setWeapon(on) { if (on) equip.equip('武器', EQUIP_PRESETS['武器']); else equip.unequip('武器'); refreshAttr(); },
    equipSlot(slot) { if (EQUIP_PRESETS[slot]) { equip.equip(slot, EQUIP_PRESETS[slot]); refreshAttr(); } },
    unequipSlot(slot) { equip.unequip(slot); refreshAttr(); },
    toggleSlot(slot) { equip.toggle(slot); refreshAttr(); },
    isFitted(slot) { return equip.isFitted(slot); },

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
  };
})();

