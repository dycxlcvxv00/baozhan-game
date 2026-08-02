/* 爆战丨无限弹幕 v2.1 · 战斗逻辑核心（纯 JS，无引擎依赖） */
(function () {
  'use strict';
  var BZ = {};

  BZ.CONFIG = {
    version: 'v2.1', stage: { width: 1280, height: 720 }, grid: 48, wallX: 455, wallHp: 1000,
    hero: { x: 200, y: 360, attack: 100, interval: 1.0 }, spawnInvincible: 1.0,
    chargePerSecond: 1.0, chargeOnHeroHit: 1, chargeOnWallHit: 2,
    monsters: {
      normal: { hp: 100, attack: 20, attackInterval: 1.5, speed: 55, radius: 20, color: 0xde5d5d, name: '普通怪' },
      tank: { hp: 300, attack: 35, attackInterval: 1.8, speed: 38, radius: 26, color: 0x9b59d0, name: '高血怪' }
    },
    waves: [
      { label: '第 1 波', spawns: [ { type: 'normal', count: 6, interval: 1.2, startAt: 0 } ] },
      { label: '第 2 波', spawns: [ { type: 'normal', count: 8, interval: 1.0, startAt: 0 }, { type: 'tank', count: 1, interval: 0, startAt: 4 } ] },
      { label: '第 3 波', spawns: [ { type: 'normal', count: 10, interval: 0.8, startAt: 0 }, { type: 'tank', count: 2, interval: 5, startAt: 3 } ] }
    ], waveRestTime: 3
  };

  BZ.RUNE_DEFS = {
    fireball: { name: '爆裂火球', icon: '🔥', energyMax: 35, color: 0xf97316, desc: '范围伤害 120（攻击力×1.2）' },
    icespike: { name: '寒冰锥刺', icon: '❄️', energyMax: 45, color: 0x38bdf8, desc: '穿透 3 个敌人，伤害 80，减速 30% 持续 3 秒' },
    bulwark: { name: '坚壁符文', icon: '🛡️', energyMax: 60, color: 0xfacc15, desc: '围墙 +150 护盾；围墙受击额外 +2 能量' },
    lightning: { name: '连锁闪电', icon: '⚡', energyMax: 55, color: 0xfde047, desc: '初始伤害 90，连锁 5 次，衰减 15%' },
    poison: { name: '腐蚀毒箭', icon: '🧪', energyMax: 40, color: 0x4ade80, desc: '2 支毒箭：直击 60 / 溅射 24 / 中毒每秒 12 持续 5 秒' }
  };
  BZ.RUNE_ORDER = ['fireball', 'icespike', 'lightning', 'poison', 'bulwark'];
  BZ.SLOT_ORDER = [12, 11, 13, 10, 14, 9, 15, 8, 3, 4, 2, 5, 1, 6, 0, 7];

  BZ.SLOT_POS = (function () {
    var cx = BZ.CONFIG.hero.x, cy = BZ.CONFIG.hero.y, colGap = 48, rowGap = 42, innerGap = 58, shift = 24;
    var rows = [
      { y: cy - innerGap - rowGap * 3, shift: shift }, { y: cy - innerGap - rowGap * 2, shift: 0 },
      { y: cy - innerGap - rowGap, shift: shift }, { y: cy - innerGap, shift: 0 },
      { y: cy + innerGap, shift: 0 }, { y: cy + innerGap + rowGap, shift: shift },
      { y: cy + innerGap + rowGap * 2, shift: 0 }, { y: cy + innerGap + rowGap * 3, shift: shift }
    ];
    var pos = [];
    for (var r = 0; r < rows.length; r++) {
      pos.push({ x: cx - colGap / 2 + rows[r].shift, y: rows[r].y, row: r < 4 ? r - 4 : r - 3 });
      pos.push({ x: cx + colGap / 2 + rows[r].shift, y: rows[r].y, row: r < 4 ? r - 4 : r - 3 });
    }
    return pos;
  })();

  function Pool(factory) { this.factory = factory; this.free = []; this.created = 0; }
  Pool.prototype.get = function () { var o = this.free.pop(); if (!o) { o = this.factory(); this.created++; } return o; };
  Pool.prototype.put = function (o) { this.free.push(o); };
  BZ.Pool = Pool;

  BZ.createBattle = function (runeIds) {
    var cfg = BZ.CONFIG, monsters = [], projectiles = [], texts = [], effects = [];
    var monsterPool = new Pool(function () { return {}; }), projPool = new Pool(function () { return {}; });
    var S = { time: 0, state: 'ready', stateT: 0, result: null, wallHp: cfg.wallHp, wallMaxHp: cfg.wallHp, shield: 0, shieldMax: 150, wallFlash: 0, kills: 0, waveIndex: -1, spawnQueue: [], hero: { x: cfg.hero.x, y: cfg.hero.y, attack: cfg.hero.attack, timer: 0.6, interval: cfg.hero.interval }, monsters: monsters, projectiles: projectiles, texts: texts, effects: effects, runes: [], events: [], flashSlots: [], pools: { monster: monsterPool, proj: projPool } };
    for (var i = 0; i < runeIds.length && i < 16; i++) {
      if (!runeIds[i]) continue;
      var slot = BZ.SLOT_ORDER[i], p = BZ.SLOT_POS[slot];
      S.runes.push({ id: runeIds[i], slot: slot, x: p.x, y: p.y, energy: 0, flash: 0 });
    }
    function pushText(x, y, str, color) { texts.push({ x: x, y: y, str: str, color: color || '#fff', life: 0.9, maxLife: 0.9, vy: -46 }); }
    function pushEffect(x, y, kind, color, scale) { var e = { x: x, y: y, kind: kind, color: color, scale: scale || 1, life: 0.45, maxLife: 0.45 }; effects.push(e); return e; }
    S.pushText = pushText; S.pushEffect = pushEffect;
    function resetMonster(m, type) { var c = cfg.monsters[type]; m.type = type; m.name = c.name; m.hp = c.hp; m.maxHp = c.hp; m.attack = c.attack; m.attackInterval = c.attackInterval; m.baseSpeed = c.speed; m.radius = c.radius; m.color = c.color; m.y = 80 + Math.random() * (cfg.stage.height - 160); m.x = cfg.stage.width - cfg.grid * (Math.random() * 3) - m.radius; m.attackTimer = 0; m.touching = false; m.inv = cfg.spawnInvincible; m.slowT = 0; m.slowPct = 0; m.poisonT = 0; m.poisonDps = 0; m.flash = 0; m.dead = false; }
    function buildWaveQueue(wi) { var q = [], wave = cfg.waves[wi]; for (var i = 0; i < wave.spawns.length; i++) { var g = wave.spawns[i]; for (var k = 0; k < g.count; k++) q.push({ at: g.startAt + g.interval * k, type: g.type }); } q.sort(function (a, b) { return a.at - b.at; }); S.spawnQueue = q; }
    function spawnMonster(type) { var m = monsterPool.get(); resetMonster(m, type); monsters.push(m); S.events.push({ t: 'spawn', type: type }); }
    function acquireHeroTarget() { var best = null; for (var i = 0; i < monsters.length; i++) { var m = monsters[i]; if (m.dead || m.inv > 0) continue; if (!best || m.x < best.x) best = m; } return best; }
    function fireHeroProjectile() { var p = projPool.get(), t = acquireHeroTarget(), ang = t ? Math.atan2(t.y - S.hero.y, t.x - (S.hero.x + 14)) : 0; p.kind = 'hero'; p.x = S.hero.x + 14; p.y = S.hero.y; p.speed = 640; p.target = t; p.vx = Math.cos(ang) * p.speed; p.vy = Math.sin(ang) * p.speed; p.damage = S.hero.attack; p.pierce = 0; p.hitIds = null; p.color = 0x93c5fd; p.radius = 5; p.life = 2.2; p.dead = false; p.slowOnHit = 0; projectiles.push(p); }
    function damageWall(amount) { if (S.state !== 'fighting') return; S.wallFlash = 0.18; if (S.shield > 0) { var absorbed = Math.min(S.shield, amount); S.shield -= absorbed; amount -= absorbed; pushText(cfg.wallX, 120, '-' + Math.round(absorbed), '#7dd3fc'); } if (amount > 0) { S.wallHp -= amount; pushText(cfg.wallX, 150, '-' + Math.round(amount), '#f87171'); } for (var i = 0; i < S.runes.length; i++) if (S.runes[i].id === 'bulwark') S.runes[i].energy += cfg.chargeOnWallHit; if (S.wallHp <= 0) { S.wallHp = 0; S.state = 'defeat'; S.stateT = 0; S.result = { win: false, time: S.time, kills: S.kills }; } }
    S.damageWall = damageWall; S.spawnMonster = spawnMonster; S.buildWaveQueue = buildWaveQueue; S.acquireHeroTarget = acquireHeroTarget; S.fireHeroProjectile = fireHeroProjectile; return S;
  };

  BZ.damageMonster = function (S, m, amount) { if (m.dead || m.inv > 0) return 0; m.hp -= amount; m.flash = 0.12; S.pushText(m.x, m.y - m.radius - 6, '-' + Math.max(1, Math.round(amount)), '#fef3c7'); if (m.hp <= 0) { m.dead = true; S.kills++; S.pushEffect(m.x, m.y, 'burst', m.color, m.radius / 20); S.events.push({ t: 'kill', type: m.type }); } return amount; };
  function inRadius(S, x, y, r) { var out = []; for (var i = 0; i < S.monsters.length; i++) { var m = S.monsters[i]; if (m.dead || m.inv > 0) continue; var dx = m.x - x, dy = m.y - y; if (dx * dx + dy * dy <= r * r) out.push(m); } return out; }
  function nearestOther(S, x, maxDist, exclude) { var best = null, bd = maxDist * maxDist; for (var i = 0; i < S.monsters.length; i++) { var m = S.monsters[i]; if (m.dead || m.inv > 0 || exclude.indexOf(m) >= 0) continue; var dx = m.x - x, d2 = dx * dx; if (d2 < bd) { bd = d2; best = m; } } return best; }
  function densestCluster(S) { var buckets = {}, bestKey = null, bestN = 0; for (var i = 0; i < S.monsters.length; i++) { var m = S.monsters[i]; if (m.dead || m.inv > 0) continue; var k = Math.floor(m.x / 60) + ':' + Math.floor(m.y / 60); buckets[k] = (buckets[k] || 0) + 1; if (buckets[k] > bestN) { bestN = buckets[k]; bestKey = k; } } if (!bestKey) return null; var parts = bestKey.split(':'); return { x: (+parts[0]) * 60 + 30, y: (+parts[1]) * 60 + 30, count: bestN }; }
  BZ.fireRune = function (S, rune) { var cfg = BZ.CONFIG, i, p, target; switch (rune.id) { case 'fireball': { var c = densestCluster(S); if (!c) return; var list = inRadius(S, c.x, c.y, 80); for (i = 0; i < list.length; i++) BZ.damageMonster(S, list[i], 120); S.pushEffect(c.x, c.y, 'ring', 0xf97316, 1.6); break; } case 'icespike': { target = S.acquireHeroTarget(); if (!target) return; p = S.pools.proj.get(); var ang = Math.atan2(target.y - rune.y, target.x - rune.x); p.kind = 'icespike'; p.x = rune.x; p.y = rune.y; p.vx = Math.cos(ang) * 520; p.vy = Math.sin(ang) * 520; p.damage = 80; p.pierce = 3; p.hitIds = []; p.slowOnHit = 0.3; p.color = 0x38bdf8; p.radius = 8; p.life = 2.5; p.dead = false; S.projectiles.push(p); break; } case 'bulwark': S.shield = Math.min(S.shieldMax, S.shield + 150); S.pushEffect(cfg.wallX, 360, 'shield', 0xfacc15, 1); S.pushText(cfg.wallX, 90, '+150 护盾', '#fde68a'); break; case 'lightning': { var cur = S.acquireHeroTarget(), dmg = 90, hops = [], used = []; if (!cur) return; for (i = 0; i < 5 && cur; i++) { hops.push({ x: cur.x, y: cur.y }); BZ.damageMonster(S, cur, dmg); used.push(cur); dmg *= 0.85; cur = nearestOther(S, cur.x, 240, used); } var fx = S.pushEffect(rune.x, rune.y, 'bolt', 0xfde047, 1); fx.hops = hops; break; } case 'poison': { var t1 = S.acquireHeroTarget(); if (!t1) return; var t2 = nearestOther(S, t1.x, 200, [t1]) || t1, targets = [t1, t2]; for (i = 0; i < targets.length; i++) { target = targets[i]; p = S.pools.proj.get(); var a2 = Math.atan2(target.y - rune.y, target.x - rune.x); p.kind = 'poison'; p.x = rune.x; p.y = rune.y; p.vx = Math.cos(a2) * 460; p.vy = Math.sin(a2) * 460; p.damage = 60; p.splash = 24; p.splashR = 55; p.poisonDps = 12; p.poisonT = 5; p.pierce = 0; p.hitIds = null; p.slowOnHit = 0; p.color = 0x4ade80; p.radius = 7; p.life = 2.5; p.dead = false; S.projectiles.push(p); } break; } } S.events.push({ t: 'rune', id: rune.id, slot: rune.slot }); S.flashSlots.push(rune.slot); };
  BZ.updateBattle = function (S, dt) { var cfg = BZ.CONFIG, i, m, p; if (dt > 0.05) dt = 0.05; S.events.length = 0; S.flashSlots.length = 0; S.time += dt; if (S.wallFlash > 0) S.wallFlash -= dt; if (S.state === 'ready') { S.stateT += dt; if (S.stateT >= 1) { S.state = 'fighting'; S.stateT = 0; S.waveIndex = 0; S.buildWaveQueue(0); } } else if (S.state === 'fighting') { var elapsed = S.stateT; while (S.spawnQueue.length && S.spawnQueue[0].at <= elapsed) S.spawnMonster(S.spawnQueue.shift().type); S.stateT += dt; if (!S.spawnQueue.length && S.monsters.length === 0) { if (S.waveIndex >= cfg.waves.length - 1) { S.state = 'victory'; S.stateT = 0; S.result = { win: true, time: S.time, kills: S.kills }; } else { S.state = 'waveClear'; S.stateT = 0; } } } else if (S.state === 'waveClear') { S.stateT += dt; if (S.stateT >= cfg.waveRestTime) { S.waveIndex++; S.state = 'fighting'; S.stateT = 0; S.buildWaveQueue(S.waveIndex); } } else { S.stateT += dt; return true; } S.hero.timer -= dt; if (S.hero.timer <= 0) { if (S.acquireHeroTarget()) { S.hero.timer += S.hero.interval; S.fireHeroProjectile(); S.events.push({ t: 'heroFire' }); } else if (S.hero.timer < -0.25) S.hero.timer = -0.25; } for (i = 0; i < S.monsters.length; i++) { m = S.monsters[i]; if (m.flash > 0) m.flash -= dt; if (m.inv > 0) m.inv -= dt; if (m.poisonT > 0) { m.poisonT -= dt; m.hp -= m.poisonDps * dt; if (m.hp <= 0 && !m.dead) { m.dead = true; S.kills++; S.pushEffect(m.x, m.y, 'burst', 0x4ade80, m.radius / 20); S.events.push({ t: 'kill', type: m.type }); continue; } } if (m.slowT > 0) { m.slowT -= dt; if (m.slowT <= 0) m.slowPct = 0; } if (m.x - m.radius > cfg.wallX) { m.x -= m.baseSpeed * (1 - m.slowPct) * dt; m.touching = false; } else { m.x = cfg.wallX + m.radius; m.touching = true; m.attackTimer += dt; if (m.attackTimer >= m.attackInterval) { m.attackTimer -= m.attackInterval; S.damageWall(m.attack); S.events.push({ t: 'wallHit', x: m.x, y: m.y }); } } } for (i = S.monsters.length - 1; i >= 0; i--) if (S.monsters[i].dead) S.pools.monster.put(S.monsters.splice(i, 1)[0]); for (i = 0; i < S.projectiles.length; i++) { p = S.projectiles[i]; if (p.kind === 'hero' && p.target && !p.target.dead && p.target.inv <= 0) { var ha = Math.atan2(p.target.y - p.y, p.target.x - p.x); p.vx = Math.cos(ha) * p.speed; p.vy = Math.sin(ha) * p.speed; } p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0 || p.x > cfg.stage.width + 40 || p.y < -40 || p.y > cfg.stage.height + 40) { p.dead = true; continue; } for (var j = 0; j < S.monsters.length; j++) { var mm = S.monsters[j]; if (mm.dead || mm.inv > 0) continue; var dx = mm.x - p.x, dy = mm.y - p.y, rr = mm.radius + p.radius; if (dx * dx + dy * dy > rr * rr) continue; if (p.hitIds && p.hitIds.indexOf(mm) >= 0) continue; if (p.kind === 'hero') { BZ.damageMonster(S, mm, p.damage); if (S.runes.length) S.runes[(Math.random() * S.runes.length) | 0].energy += cfg.chargeOnHeroHit; p.dead = true; break; } else if (p.kind === 'icespike') { BZ.damageMonster(S, mm, p.damage); mm.slowPct = Math.max(mm.slowPct, p.slowOnHit); mm.slowT = 3; p.hitIds.push(mm); p.pierce--; if (p.pierce < 0) { p.dead = true; break; } } else if (p.kind === 'poison') { BZ.damageMonster(S, mm, p.damage); mm.poisonT = p.poisonT; mm.poisonDps = p.poisonDps; for (var s2 = 0; s2 < S.monsters.length; s2++) { var sm = S.monsters[s2]; if (sm === mm || sm.dead || sm.inv > 0) continue; var ddx = sm.x - mm.x, ddy = sm.y - mm.y; if (ddx * ddx + ddy * ddy <= p.splashR * p.splashR) BZ.damageMonster(S, sm, p.splash); } p.dead = true; break; } } } for (i = S.projectiles.length - 1; i >= 0; i--) if (S.projectiles[i].dead) S.pools.proj.put(S.projectiles.splice(i, 1)[0]); for (i = 0; i < S.runes.length; i++) { var r = S.runes[i]; r.energy += cfg.chargePerSecond * dt; var max = BZ.RUNE_DEFS[r.id].energyMax; if (r.energy >= max) { if (r.id === 'bulwark' || S.acquireHeroTarget()) { r.energy = 0; BZ.fireRune(S, r); } else r.energy = max; } if (r.flash > 0) r.flash -= dt; } for (i = S.effects.length - 1; i >= 0; i--) { S.effects[i].life -= dt; if (S.effects[i].life <= 0) S.effects.splice(i, 1); } for (i = S.texts.length - 1; i >= 0; i--) { var tx = S.texts[i]; tx.life -= dt; tx.y += tx.vy * dt; if (tx.life <= 0) S.texts.splice(i, 1); } return true; };
  BZ.waveLabel = function (S) { if (S.waveIndex < 0) return '准备中'; return '第 ' + (S.waveIndex + 1) + ' / ' + BZ.CONFIG.waves.length + ' 波 · 剩余 ' + (S.spawnQueue.length + S.monsters.length); };
  if (typeof module !== 'undefined' && module.exports) module.exports = BZ;
  if (typeof globalThis !== 'undefined') globalThis.BZ = BZ;
})();
