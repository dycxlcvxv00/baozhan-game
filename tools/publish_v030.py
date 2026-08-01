import re, sys, pathlib
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')
if 'Demo v0.30' in src:
    print('v0.30 already applied; nothing to do')
    sys.exit(0)
def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- Z1: zone sprite cache + renderer ----
rep('  const monsters=[], projectiles=[], effects=[], particles=[], dmgTexts=[], zones=[];',
    '''  const monsters=[], projectiles=[], effects=[], particles=[], dmgTexts=[], zones=[];
  const zoneSpriteCache={};
  function makeZoneSprite(type,r){const key=type+':'+Math.round(r);if(zoneSpriteCache[key])return zoneSpriteCache[key];const c=document.createElement('canvas');c.width=c.height=Math.ceil(r*2);const x=c.getContext('2d');const col=type==='burn'?'255,140,60':'120,205,255';const g=x.createRadialGradient(r,r,r*.08,r,r,r);g.addColorStop(0,`rgba(${col},.30)`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.beginPath();x.arc(r,r,r-1,0,Math.PI*2);x.fill();x.strokeStyle=`rgba(${col},.4)`;x.lineWidth=2;x.beginPath();x.arc(r,r,r-2,0,Math.PI*2);x.stroke();zoneSpriteCache[key]=c;return c;}''', 'Z1')

# ---- Z2: sprite-based zone draw (replaces per-frame gradient + dashed stroke) ----
rep('''    for(const z of zones){const g=ctx.createRadialGradient(z.x,z.y,10,z.x,z.y,z.r);const col=z.type==='burn'?'255,140,60':'120,205,255';g.addColorStop(0,`rgba(${col},.30)`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=`rgba(${col},.35)`;ctx.lineWidth=1.5;ctx.setLineDash([6,6]);ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}''',
    '''    for(const z of zones){const sp=makeZoneSprite(z.type,z.r);ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,z.duration*1.5));ctx.drawImage(sp,z.x-z.r,z.y-z.r,z.r*2,z.r*2);ctx.restore();}''', 'Z2')

# ---- Z3: cap concurrent zones ----
rep('    for(let i=zones.length-1;i>=0;i--){const z=zones[i];z.duration-=dt;',
    '    if(zones.length>12)zones.splice(0,zones.length-12);\n    for(let i=zones.length-1;i>=0;i--){const z=zones[i];z.duration-=dt;', 'Z3')

# ---- E1: version h1 ----
rep('<div><h1>爆战丨无限弹幕 Demo v0.29</h1><div class="subtitle">极寒冰场新符文 · 地面区域系统 · 战斗流程强化</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.30</h1><div class="subtitle">修复战斗卡死 · 地面区域渲染优化</div></div>', 'E1')

# ---- E2: changelog ----
old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.29</h3>
        <ol>
          <li><b>新符文「极寒冰场」：</b>第 6 个可选符文，在城墙前生成持续 4 秒的冰场，每秒造成攻击力 50% 冰霜伤害并减速；专精 Lv.5 持续 +2 秒、Lv.10 伤害 +25%。</li>
          <li><b>符文进阶实装：</b>爆裂火球爆炸后留下燃烧地面 2 秒；寒冰锥刺命中已减速目标时追加短冻结；坚壁符文护盾被击破时震退并短暂冻结城墙前怪物。</li>
          <li><b>战斗流程强化：</b>领主登场震屏与「领主来袭」提示；波次与下一波倒计时直接绘制在战场内；怪物冻结表现；胜利时全屏金色闪光。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.28 及更早，点击展开）</summary>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.30</h3>
        <ol>
          <li><b>修复战斗中卡死：</b>地面区域（燃烧地面 / 极寒冰场）每帧实时计算径向渐变与虚线描边，在移动端浏览器开销过大导致页面卡死。</li>
          <li><b>区域渲染优化：</b>区域改为预渲染精灵缓存，每帧仅绘制图片；移除逐帧虚线描边；同屏区域数量上限 12 个，超出的旧区域自动移除。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.29 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.29</h4><ul><li>新增极寒冰场符文与地面区域系统；火球燃烧地面、冰锥冻结、护盾震退三项进阶实装；领主登场提示、波次倒计时、胜利金色闪光。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.30: %d bytes' % len(src.encode('utf-8')))
