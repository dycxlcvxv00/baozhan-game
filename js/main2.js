/* 爆战丨无限弹幕 v1.3 · Phaser 表现层 2/3：渲染同步 */
  // ================= 渲染同步（从 sim 状态绘制全部画面） =================
  BattleScene.prototype.hex = function (g, x, y, r, color, alpha, lw) {
    var pts = [];
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 3 * k - Math.PI / 2;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    if (lw) { g.lineStyle(lw, color, alpha); g.strokePoints(pts, true); }
    else { g.fillStyle(color, alpha); g.fillPoints(pts, true); }
  };

  BattleScene.prototype.sync = function () {
    var S = this.S, g = this.g, cfg = BZ.CONFIG, i;
    g.clear();

    g.fillStyle(0x101a30, 1).fillRect(0, 0, cfg.wallX, H);
    g.fillStyle(0x0d1426, 1).fillRect(cfg.wallX, 0, W - cfg.wallX, H);
    g.lineStyle(1, 0x1e293b, 0.35);
    for (i = 1; i < 27; i++) g.lineBetween(i * 48, 0, i * 48, H);
    for (i = 1; i < 15; i++) g.lineBetween(0, i * 48, W, i * 48);

    var wallColor = S.wallFlash > 0 ? 0xfef2f2 : 0x94a3b8;
    g.fillStyle(wallColor, 1).fillRect(cfg.wallX - 6, 0, 12, H);
    if (S.shield > 0) g.lineStyle(4, 0x7dd3fc, 0.75).strokeRect(cfg.wallX - 12, 4, 24, H - 8);

    var bw = 320, bx = W / 2 - bw / 2, by = H - 30;
    g.fillStyle(0x1f2937, 1).fillRect(bx, by, bw, 14);
    g.fillStyle(0xef4444, 1).fillRect(bx, by, bw * Math.max(0, S.wallHp / S.wallMaxHp), 14);
    if (S.shield > 0) g.fillStyle(0x7dd3fc, 1).fillRect(bx, by - 6, bw * Math.min(1, S.shield / S.shieldMax), 4);

    this.hex(g, S.hero.x, S.hero.y, 30, 0x3b82f6, 0.25);
    this.hex(g, S.hero.x, S.hero.y, 30, 0x60a5fa, 1, 2);
    g.fillStyle(0x60a5fa, 1).fillCircle(S.hero.x, S.hero.y, 12);

    for (i = 0; i < BZ.SLOT_POS.length; i++) {
      var p = BZ.SLOT_POS[i];
      this.hex(g, p.x, p.y, 18, 0x334155, 0.35);
      this.hex(g, p.x, p.y, 18, 0x475569, 1, 1);
    }
    for (i = 0; i < S.runes.length; i++) {
      var r = S.runes[i], def = BZ.RUNE_DEFS[r.id];
      var pct = Math.min(1, r.energy / def.energyMax);
      this.hex(g, r.x, r.y, 18, def.color, pct >= 1 ? 0.9 : 0.45);
      if (r.flash > 0) this.hex(g, r.x, r.y, 22 + r.flash * 10, def.color, Math.max(0, r.flash), 3);
      g.fillStyle(0x0f172a, 1).fillRect(r.x - 16, r.y + 22, 32, 4);
      g.fillStyle(def.color, 1).fillRect(r.x - 16, r.y + 22, 32 * pct, 4);
    }

    for (i = 0; i < S.monsters.length; i++) {
      var m = S.monsters[i];
      var alpha = m.inv > 0 ? 0.45 : 1;
      g.fillStyle(m.flash > 0 ? 0xffffff : m.color, alpha).fillCircle(m.x, m.y, m.radius);
      if (m.inv > 0) g.lineStyle(2, 0x7dd3fc, 0.8).strokeCircle(m.x, m.y, m.radius + 4);
      if (m.slowPct > 0) g.lineStyle(2, 0x38bdf8, 0.9).strokeCircle(m.x, m.y, m.radius + 2);
      if (m.poisonT > 0) g.lineStyle(2, 0x4ade80, 0.9).strokeCircle(m.x, m.y, m.radius + 5);
      var hpct = Math.max(0, m.hp / m.maxHp);
      g.fillStyle(0x1f2937, 1).fillRect(m.x - 16, m.y - m.radius - 10, 32, 4);
      g.fillStyle(0xef4444, 1).fillRect(m.x - 16, m.y - m.radius - 10, 32 * hpct, 4);
    }

    for (i = 0; i < S.projectiles.length; i++) {
      var pr = S.projectiles[i];
      g.fillStyle(pr.color, 1).fillCircle(pr.x, pr.y, pr.radius);
    }

    for (i = 0; i < S.effects.length; i++) {
      var e = S.effects[i];
      var prog = 1 - e.life / e.maxLife, ea = Math.max(0, e.life / e.maxLife);
      if (e.kind === 'ring' || e.kind === 'burst') {
        g.lineStyle(4, e.color, ea).strokeCircle(e.x, e.y, (14 + prog * 60) * e.scale);
      } else if (e.kind === 'shield') {
        g.lineStyle(5, e.color, ea).strokeRect(cfg.wallX - 14 - prog * 6, 8, 28 + prog * 12, H - 16);
      } else if (e.kind === 'bolt' && e.hops) {
        g.lineStyle(3, e.color, ea);
        g.beginPath(); g.moveTo(e.x, e.y);
        for (var h = 0; h < e.hops.length; h++) g.lineTo(e.hops[h].x, e.hops[h].y);
        g.strokePath();
      }
    }

    var seen = [];
    for (i = 0; i < S.texts.length; i++) {
      var t = S.texts[i]; seen.push(t);
      var v = t._view;
      if (!v) { v = this.getText(t.str, t.color); t._view = v; v._src = t; }
      v.setPosition(t.x, t.y).setAlpha(Math.max(0, t.life / t.maxLife));
    }
    this.recycleTexts(seen);

    this.hudWave.setText(BZ.waveLabel(S));
    this.hudWall.setText('围墙 ' + Math.ceil(S.wallHp) + ' / ' + S.wallMaxHp + (S.shield > 0 ? ' · 护盾 ' + Math.ceil(S.shield) : ''));
  };
