import re, sys, pathlib

ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')

if 'Demo v0.27' in src:
    print('v0.27 already applied; nothing to do')
    sys.exit(0)

def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

rep('max:35,coef:1.2,perk:', 'max:35,coef:1.2,attrs:{crit:.05,critDmg:.25,elem:.20,skill:.10},perk:', 'A1')
rep('max:45,coef:.8,perk:', 'max:45,coef:.8,attrs:{crit:.05,critDmg:.15,elem:.20,skill:.10},perk:', 'A2')
rep('max:55,coef:.9,perk:', 'max:55,coef:.9,attrs:{crit:.10,critDmg:.20,elem:.15,skill:.15},perk:', 'A3')
rep('max:40,coef:.6,perk:', 'max:40,coef:.6,attrs:{crit:.05,critDmg:.10,elem:.20,skill:.10},perk:', 'A4')

rep('const heroBaseStats={attack:100,attackSpeed:1,critChance:.05,critDamage:1.5,runeDamage:1,chargeEfficiency:1,shieldPower:1};',
    'const heroBaseStats={attack:100,attackSpeed:1,critChance:.05,critDamage:1.5,runeDamage:1,chargeEfficiency:1,shieldPower:1,attackDamage:0,skillDamage:0,elemPhysical:0,elemFire:0,elemIce:0,elemPoison:0,elemLightning:0,elemChaos:0};', 'B1')
rep('weapon2:{attackSpeed:.20,critDamage:.35,runeDamage:.18,critChance:.08}',
    'weapon2:{attackSpeed:.20,critDamage:.35,runeDamage:.18,critChance:.08,elemFire:.15,skillDamage:.10}', 'B2')

rep('hero.runeMultiplier=v.runeDamage;hero.chargeEfficiency=v.chargeEfficiency;hero.shieldPower=v.shieldPower;renderHeroStats();}',
    'hero.runeMultiplier=v.runeDamage;hero.chargeEfficiency=v.chargeEfficiency;hero.shieldPower=v.shieldPower;hero.attackDamage=v.attackDamage;hero.skillDamage=v.skillDamage;hero.elem={physical:v.elemPhysical,fire:v.elemFire,ice:v.elemIce,poison:v.elemPoison,lightning:v.elemLightning,chaos:v.elemChaos};renderHeroStats();}', 'C1')

rep('function runeDamage(coef,type){const m=type?masteryMult(type):1;return hero.attackPower*coef*hero.runeMultiplier*m;}',
    'function runeDamage(coef,type){const m=type?masteryMult(type):1;const ra=(type&&runeDefs[type].attrs)||{};const skill=(hero.skillDamage||0)+(ra.skill||0);const elem=(type&&hero.elem?(hero.elem[type]||0):0)+(ra.elem||0);const crit=Math.random()<Math.min(1,hero.critChance+(ra.crit||0));const cd=hero.critDamage+(ra.critDmg||0);return hero.attackPower*coef*(1+skill+elem)*hero.runeMultiplier*m*(crit?cd:1);}', 'C2')

rep("const crit=Math.random()<hero.critChance;damageMonster(m,hero.attackPower*(crit?hero.critDamage:1),'arrow',crit);",
    "const crit=Math.random()<hero.critChance;damageMonster(m,hero.attackPower*(1+(hero.attackDamage||0)+((hero.elem&&hero.elem.physical)||0))*(crit?hero.critDamage:1),'arrow',crit);", 'C3')

old = '''  function renderHeroStats(){if(!heroStatsGrid)return;const b=heroBaseStats,v=currentHeroStats,rows=[['攻击力',Math.round(v.attack),Math.round(b.attack)],['攻击速度',v.attackSpeed.toFixed(2)+'/秒',b.attackSpeed.toFixed(2)+'/秒'],['暴击率',(v.critChance*100).toFixed(0)+'%',(b.critChance*100).toFixed(0)+'%'],['暴击伤害',(v.critDamage*100).toFixed(0)+'%',(b.critDamage*100).toFixed(0)+'%'],['符文伤害',(v.runeDamage*100).toFixed(0)+'%',(b.runeDamage*100).toFixed(0)+'%'],['充能效率',(v.chargeEfficiency*100).toFixed(0)+'%',(b.chargeEfficiency*100).toFixed(0)+'%'],['护盾效果',(v.shieldPower*100).toFixed(0)+'%',(b.shieldPower*100).toFixed(0)+'%']];heroStatsGrid.innerHTML=rows.map(([n,x,base])=>`<div class="heroStat ${x!==base?'changed':''}"><span>${n}</span><strong>${x}</strong></div>`).join('');}'''
new = '''  function renderHeroStats(){if(!heroStatsGrid)return;const b=heroBaseStats,v=currentHeroStats,pct=x=>(x*100).toFixed(0)+'%',rows=[['攻击力',Math.round(v.attack),Math.round(b.attack)],['攻击速度',v.attackSpeed.toFixed(2)+'/秒',b.attackSpeed.toFixed(2)+'/秒'],['攻击伤害',pct(v.attackDamage),pct(b.attackDamage)],['暴击率',pct(v.critChance),pct(b.critChance)],['暴击伤害',pct(v.critDamage),pct(b.critDamage)],['技能伤害',pct(v.skillDamage),pct(b.skillDamage)],['符文伤害',v.runeDamage.toFixed(2)+'×',b.runeDamage.toFixed(2)+'×'],['充能效率',pct(v.chargeEfficiency),pct(b.chargeEfficiency)],['护盾效果',pct(v.shieldPower),pct(b.shieldPower)],['物理伤害',pct(v.elemPhysical),pct(b.elemPhysical)],['冰霜伤害',pct(v.elemIce),pct(b.elemIce)],['火焰伤害',pct(v.elemFire),pct(b.elemFire)],['毒素伤害',pct(v.elemPoison),pct(b.elemPoison)],['闪电伤害',pct(v.elemLightning),pct(b.elemLightning)],['混沌伤害',pct(v.elemChaos),pct(b.elemChaos)]];heroStatsGrid.innerHTML=rows.map(([n,x,base])=>`<div class="heroStat ${x!==base?'changed':''}"><span>${n}</span><strong>${x}</strong></div>`).join('');}'''
rep(old, new, 'D1')

rep('  function runeTooltipHtml(d,type){',
    '''  function runeAttrsLine(d){const a=d.attrs||{};if(!d.coef)return '独立属性：防御型（无伤害面板）';const p=[`系数 <b class="hl">${d.coef}×</b>`];if(a.crit)p.push(`暴击 <b class="hl">+${Math.round(a.crit*100)}%</b>`);if(a.critDmg)p.push(`暴伤 <b class="hl">+${Math.round(a.critDmg*100)}%</b>`);if(a.elem)p.push(`元素 <b class="hl">+${Math.round(a.elem*100)}%</b>`);if(a.skill)p.push(`技伤 <b class="hl">+${Math.round(a.skill*100)}%</b>`);return '独立属性：'+p.join(' · ');}
  function runeTooltipHtml(d,type){''', 'D2a')
rep('<div class="runeTipFoot">充能上限', '<div class="runeTipAttrs">${runeAttrsLine(d)}</div><div class="runeTipFoot">充能上限', 'D2b')

rep('.runeTipFoot{margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1);font-size:10px;color:var(--muted)}',
    '.runeTipFoot{margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1);font-size:10px;color:var(--muted)}.runeTipAttrs{margin-top:9px;font-size:11px;color:#b9e7ff;line-height:1.65}', 'D3')

rep('<div><h1>爆战丨无限弹幕 Demo v0.26</h1><div class="subtitle">界面布局重构 · 功能集中首页 · 底栏血条居中</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.27</h1><div class="subtitle">属性体系实装 · 符文独立属性 · 全元素伤害面板</div></div>', 'E1')

old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.26</h3>
        <ol>
          <li><b>功能大标签集中到首页：</b>版本记录、符文专精、速度切换、存档管理与音频控制统一移入战前装配页功能区。</li>
          <li><b>战斗界面精简：</b>进入战斗后顶栏不再显示关卡/金币/波次等预览栏目，仅保留标题与全屏按钮。</li>
          <li><b>底部栏目更新：</b>城墙血条从画布移至底部栏目中心并保留护盾显示，右侧预留符咒卡牌槽位。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.25 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.25</h4><ul><li>修复手机横屏弹窗裁切：触屏横屏设备按实际可用宽高自动缩放整张战前装配卡；全屏与旋转自动重算；图标拆分为仓库资源文件。</li></ul></div>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.27</h3>
        <ol>
          <li><b>属性体系实装：</b>最终属性 = 英雄基础 + 装备汇入 + 符文独立属性；普攻接入攻击伤害%与物理伤害%；符文技能按「攻击力 × 系数 ×（1 + 技能伤害% + 对应元素伤害%）」结算并支持暴击。</li>
          <li><b>符文独立属性：</b>五个符文获得独立暴击率、暴击伤害、元素伤害与技能伤害面板，与英雄、装备属性加算。</li>
          <li><b>属性面板扩容：</b>装备界面按基础/攻击/技能/元素分组显示 15 项属性；符文悬停面板新增独立属性行。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.26 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.26</h4><ul><li>界面布局重构：功能大标签集中到首页，战斗中顶栏精简，城墙血条移至底部栏目中心并预留符咒卡牌槽位。</li></ul></div>
        <div class="oldGroup"><h4>v0.25</h4><ul><li>修复手机横屏弹窗裁切：触屏横屏设备按实际可用宽高自动缩放整张战前装配卡；全屏与旋转自动重算；图标拆分为仓库资源文件。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.27: %d bytes' % len(src.encode('utf-8')))
