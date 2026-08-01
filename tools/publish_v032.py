import re, sys, pathlib
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')
if 'Demo v0.32' in src:
    print('v0.32 already applied; nothing to do')
    sys.exit(0)
def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- B1: boss entrance effect missing maxLife -> negative arc radius ----
rep("effects.push({x:W-140,y:H/2,r:40,max:320,color:'rgba(255,189,63,.4)',life:.8});",
    "effects.push({x:W-140,y:H/2,r:40,max:320,color:'rgba(255,189,63,.4)',life:.8,maxLife:.8});", 'B1')

# ---- B2: defensive clamp so any effect without maxLife can never produce negative radius ----
rep('else{const pr=Math.max(0,t);ctx.globalAlpha=Math.min(1,pr*1.4);ctx.beginPath();ctx.arc(e.x,e.y,e.max*(1-pr)+e.r,0,Math.PI*2);e.fill?ctx.fill():ctx.stroke();ctx.globalAlpha=1;}',
    'else{const pr=Math.max(0,Math.min(1,t));ctx.globalAlpha=Math.min(1,pr*1.4);ctx.beginPath();ctx.arc(e.x,e.y,Math.max(0,e.max*(1-pr)+e.r),0,Math.PI*2);e.fill?ctx.fill():ctx.stroke();ctx.globalAlpha=1;}', 'B2')

# ---- E1: version h1 ----
rep('<div><h1>爆战丨无限弹幕 Demo v0.31</h1><div class="subtitle">重写底层渲染管线 · 修复移动端卡死</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.32</h1><div class="subtitle">修复领主特效负半径 · 彻底根治卡死</div></div>', 'E1')

# ---- E2: changelog ----
old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.31</h3>
        <ol>
          <li><b>重写底层渲染管线：</b>静态背景一次性预渲染；移除全部逐帧阴影模糊（移动端 Canvas2D 最大开销）；渲染降为 30 帧、逻辑保持 60 帧。</li>
          <li><b>节流与兜底：</b>城墙血条等 DOM 写入仅在数值变化时更新；粒子/特效/伤害数字设硬上限；战斗循环加错误捕获，异常时在页面直接显示错误而非静默卡死。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.30 及更早，点击展开）</summary>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.32</h3>
        <ol>
          <li><b>根治战斗卡死（真凶）：</b>领主登场特效设了 life 却漏设 maxLife，导致光环半径衰减公式算出负值，ctx.arc() 每帧抛异常、渲染循环被杀——每 5 关领主波必现卡死。已为该特效补上 maxLife。</li>
          <li><b>防御加固：</b>特效绘制统一对半径做非负钳制，任何后续特效即使漏设 maxLife 也不会再因负半径崩溃。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.31 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.31</h4><ul><li>重写底层渲染管线（背景预渲染、去逐帧阴影模糊、渲染降 30 帧、DOM 节流、对象上限、错误兜底）——错误兜底直接暴露了卡死真凶。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.32: %d bytes' % len(src.encode('utf-8')))
