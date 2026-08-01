import re, sys, pathlib
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')
if 'Demo v0.31' in src:
    print('v0.31 already applied; nothing to do')
    sys.exit(0)
def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- R1a: prerender static background once ----
rep('  const wall = {x:360,y:0,w:34,h:H,hp:1000,maxHp:1000,shield:0,maxShield:420,flash:0};',
    '''  const wall = {x:360,y:0,w:34,h:H,hp:1000,maxHp:1000,shield:0,maxShield:420,flash:0};
  const bgCanvas=document.createElement('canvas');bgCanvas.width=W;bgCanvas.height=H;
  (function(){const b=bgCanvas.getContext('2d');const grd=b.createLinearGradient(0,0,W,0);grd.addColorStop(0,'#20172a');grd.addColorStop(.32,'#191521');grd.addColorStop(.35,'#352315');grd.addColorStop(1,'#161821');b.fillStyle=grd;b.fillRect(0,0,W,H);b.fillStyle='rgba(255,255,255,.035)';for(let x=0;x<W;x+=48){b.fillRect(x,0,1,H)}for(let y=0;y<H;y+=48){b.fillRect(0,y,W,1)}b.fillStyle='rgba(255,180,80,.08)';b.fillRect(0,0,wall.x,H);b.fillStyle='rgba(120,170,255,.06)';b.fillRect(wall.x+wall.w,0,W-wall.x-wall.w,H);})();''', 'R1a')

# ---- R1b: draw prerendered background instead of recomputing ----
rep('''    const grd=ctx.createLinearGradient(0,0,W,0); grd.addColorStop(0,'#20172a'); grd.addColorStop(.32,'#191521'); grd.addColorStop(.35,'#352315'); grd.addColorStop(1,'#161821'); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,.035)'; for(let x=0;x<W;x+=48){ctx.fillRect(x,0,1,H)} for(let y=0;y<H;y+=48){ctx.fillRect(0,y,W,1)}
    ctx.fillStyle='rgba(255,180,80,.08)'; ctx.fillRect(0,0,wall.x,H); ctx.fillStyle='rgba(120,170,255,.06)'; ctx.fillRect(wall.x+wall.w,0,W-wall.x-wall.w,H);''',
    '    ctx.drawImage(bgCanvas,0,0);', 'R1b')

# ---- R2: remove all per-frame shadowBlur (mobile Canvas2D killer) ----
rep("if(flashing){ctx.save();ctx.shadowColor='#fff6a8';ctx.shadowBlur=28;drawHex(pos.x,pos.y,26,'rgba(255,251,205,.72)',true);ctx.restore();}",
    "if(flashing){drawHex(pos.x,pos.y,27,'rgba(255,240,140,.55)',true);drawHex(pos.x,pos.y,26,'rgba(255,251,205,.72)',true);}", 'R2a')
rep("ctx.fillStyle='#ff9b45';ctx.shadowColor='#ff6b2c';ctx.shadowBlur=18;ctx.beginPath();",
    "ctx.fillStyle='#ff9b45';ctx.beginPath();", 'R2b')
rep("ctx.fillStyle='#9beaff';ctx.shadowColor='#52bfff';ctx.shadowBlur=14;ctx.beginPath();",
    "ctx.fillStyle='#9beaff';ctx.beginPath();", 'R2c')
rep("ctx.fillStyle='#84e779';ctx.shadowColor='#36c563';ctx.shadowBlur=12;ctx.fillRect(-12,-3,24,6);",
    "ctx.fillStyle='#84e779';ctx.fillRect(-12,-3,24,6);", 'R2d')
rep("else if(e.chain){ctx.save();ctx.shadowColor='#fff36b';ctx.shadowBlur=12;ctx.beginPath();",
    "else if(e.chain){ctx.save();ctx.beginPath();", 'R2e')

# ---- R3: throttle wall HP DOM writes ----
rep('function updateWallUI(){const f=document.getElementById(\'wallHpFill\'),s=document.getElementById(\'wallShieldFill\'),t=document.getElementById(\'wallHpText\');if(!f)return;const hp=Math.max(0,Math.round(wall.hp));',
    'let _lastWallHp=-1,_lastWallShield=-1;\n  function updateWallUI(){const f=document.getElementById(\'wallHpFill\'),s=document.getElementById(\'wallShieldFill\'),t=document.getElementById(\'wallHpText\');if(!f)return;const hp=Math.max(0,Math.round(wall.hp)),sh=Math.round(wall.shield);if(hp===_lastWallHp&&sh===_lastWallShield)return;_lastWallHp=hp;_lastWallShield=sh;', 'R3')

# ---- R4: decouple render to 30fps on mobile + error resilience ----
rep('  function loop(now){ const dt=Math.min(.033,(now-state.last)/1000); state.last=now; update(dt*state.speed); draw(); requestAnimationFrame(loop); }',
    '''  const RENDER_EVERY=isTouchUI?2:1; let _frameN=0;
  function showBattleError(msg){let e=document.getElementById('battleError');if(!e){e=document.createElement('div');e.id='battleError';e.style.cssText='position:fixed;left:8px;bottom:8px;z-index:300;max-width:70vw;padding:6px 9px;border-radius:8px;background:rgba(120,10,10,.92);color:#fff;font-size:11px;z-index:300';document.body.appendChild(e);}e.textContent='战斗错误：'+msg;}
  function loop(now){ requestAnimationFrame(loop); const dt=Math.min(.033,(now-state.last)/1000); state.last=now; try{ update(dt*state.speed); _frameN++; if(_frameN%RENDER_EVERY===0)draw(); }catch(err){ state.running=false; showBattleError(err&&err.message||err); console.error(err); } }''', 'R4')

# ---- R5: hard caps on transient arrays ----
rep('    for(let i=particles.length-1;i>=0;i--){const q=particles[i];',
    '    if(particles.length>260)particles.splice(0,particles.length-260);\n    for(let i=particles.length-1;i>=0;i--){const q=particles[i];', 'R5a')
rep('    for(let i=effects.length-1;i>=0;i--){ effects[i].life-=dt;',
    '    if(effects.length>90)effects.splice(0,effects.length-90);\n    for(let i=effects.length-1;i>=0;i--){ effects[i].life-=dt;', 'R5b')
rep('    for(let i=dmgTexts.length-1;i>=0;i--){ const t=dmgTexts[i];',
    '    if(dmgTexts.length>80)dmgTexts.splice(0,dmgTexts.length-80);\n    for(let i=dmgTexts.length-1;i>=0;i--){ const t=dmgTexts[i];', 'R5c')

# ---- E1: version h1 ----
rep('<div><h1>爆战丨无限弹幕 Demo v0.30</h1><div class="subtitle">修复战斗卡死 · 地面区域渲染优化</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.31</h1><div class="subtitle">重写底层渲染管线 · 修复移动端卡死</div></div>', 'E1')

# ---- E2: changelog ----
old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.30</h3>
        <ol>
          <li><b>修复战斗中卡死：</b>地面区域（燃烧地面 / 极寒冰场）每帧实时计算径向渐变与虚线描边，在移动端浏览器开销过大导致页面卡死。</li>
          <li><b>区域渲染优化：</b>区域改为预渲染精灵缓存，每帧仅绘制图片；移除逐帧虚线描边；同屏区域数量上限 12 个，超出的旧区域自动移除。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.29 及更早，点击展开）</summary>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.31</h3>
        <ol>
          <li><b>重写底层渲染管线：</b>静态背景一次性预渲染；移除全部逐帧阴影模糊（移动端 Canvas2D 最大开销）；渲染降为 30 帧、逻辑保持 60 帧。</li>
          <li><b>节流与兜底：</b>城墙血条等 DOM 写入仅在数值变化时更新；粒子/特效/伤害数字设硬上限；战斗循环加错误捕获，异常时在页面直接显示错误而非静默卡死。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.30 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.30</h4><ul><li>地面区域渲染改预渲染精灵缓存、移除逐帧虚线描边、同屏区域上限 12，首次尝试修复战斗卡死。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.31: %d bytes' % len(src.encode('utf-8')))
