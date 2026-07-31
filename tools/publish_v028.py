import re, sys, pathlib

ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')

if 'Demo v0.28' in src:
    print('v0.28 already applied; nothing to do')
    sys.exit(0)

def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- F1: stats panel scrollable + tooltip styles ----
rep('.runeTipAttrs{margin-top:9px;font-size:11px;color:#b9e7ff;line-height:1.65}',
    '.runeTipAttrs{margin-top:9px;font-size:11px;color:#b9e7ff;line-height:1.65}.heroStatsPanel{overflow-y:auto;overscroll-behavior:contain}.heroStatsPanel::-webkit-scrollbar{width:6px}.heroStatsPanel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px}.heroStat{cursor:help}.statTooltip{position:fixed;display:none;z-index:120;max-width:260px;padding:10px 12px;border-radius:10px;background:rgba(18,16,23,.97);border:1px solid #ffd36b;box-shadow:0 12px 30px rgba(0,0,0,.55);font-size:11px;line-height:1.6;color:var(--text);pointer-events:none;text-align:left}.statTooltip.show{display:block}.statTooltip h5{margin:0 0 4px;font-size:13px;color:#ffd36b}', 'F1')

# ---- F2: statTooltip element ----
rep('<div class="runeTooltip" id="runeTooltip" role="tooltip"></div>',
    '<div class="runeTooltip" id="runeTooltip" role="tooltip"></div>\n  <div class="statTooltip" id="statTooltip" role="tooltip"></div>', 'F2')

# ---- F3: ATTR_TIPS + tooltip bindings after renderHeroStats ----
old = '''  function renderHeroStats(){if(!heroStatsGrid)return;const b=heroBaseStats,v=currentHeroStats,pct=x=>(x*100).toFixed(0)+'%',rows=[['攻击力',Math.round(v.attack),Math.round(b.attack)],['攻击速度',v.attackSpeed.toFixed(2)+'/秒',b.attackSpeed.toFixed(2)+'/秒'],['攻击伤害',pct(v.attackDamage),pct(b.attackDamage)],['暴击率',pct(v.critChance),pct(b.critChance)],['暴击伤害',pct(v.critDamage),pct(b.critDamage)],['技能伤害',pct(v.skillDamage),pct(b.skillDamage)],['符文伤害',v.runeDamage.toFixed(2)+'×',b.runeDamage.toFixed(2)+'×'],['充能效率',pct(v.chargeEfficiency),pct(b.chargeEfficiency)],['护盾效果',pct(v.shieldPower),pct(b.shieldPower)],['物理伤害',pct(v.elemPhysical),pct(b.elemPhysical)],['冰霜伤害',pct(v.elemIce),pct(b.elemIce)],['火焰伤害',pct(v.elemFire),pct(b.elemFire)],['毒素伤害',pct(v.elemPoison),pct(b.elemPoison)],['闪电伤害',pct(v.elemLightning),pct(b.elemLightning)],['混沌伤害',pct(v.elemChaos),pct(b.elemChaos)]];heroStatsGrid.innerHTML=rows.map(([n,x,base])=>`<div class="heroStat ${x!==base?'changed':''}"><span>${n}</span><strong>${x}</strong></div>`).join('');}'''
new = old + '''
  const ATTR_TIPS={'攻击力':'所有伤害计算的基础，同时影响英雄普攻与全部符文技能。','攻击速度':'每秒普攻次数；攻速越高，普攻命中带来的符文随机充能也越频繁。','攻击伤害':'仅加成英雄普攻等攻击伤害，不影响符文技能。','暴击率':'普攻与符文技能的暴击概率；最终 = 英雄基础 + 装备 + 符文自身，上限 100%。','暴击伤害':'暴击时的伤害倍率；最终 = 英雄基础 + 装备 + 符文自身。','技能伤害':'加成所有符文技能伤害，与该符文对应元素伤害加算。','符文伤害':'独立倍率，直接放大全部符文技能伤害。','充能效率':'影响符文每秒自动充能速度，不影响普攻命中提供的固定充能。','护盾效果':'影响坚壁符文生成的护盾量。','物理伤害':'加成全部物理类型伤害，不分普攻或符文技能。','冰霜伤害':'加成全部冰霜类型伤害，不分普攻或符文技能。','火焰伤害':'加成全部火焰类型伤害，不分普攻或符文技能。','毒素伤害':'加成全部毒素类型伤害，不分普攻或符文技能。','闪电伤害':'加成全部闪电类型伤害，不分普攻或符文技能。','混沌伤害':'加成全部混沌类型伤害，不分普攻或符文技能。'};
  const statTooltip=document.getElementById('statTooltip');
  function showStatTip(name,el){const tip=ATTR_TIPS[name];if(!tip)return;statTooltip.innerHTML=`<h5>${name}</h5>${tip}`;statTooltip.classList.add('show');requestAnimationFrame(()=>{const r=el.getBoundingClientRect(),tw=statTooltip.offsetWidth,th=statTooltip.offsetHeight,vw=innerWidth,vh=innerHeight;let left=r.right+10;if(left+tw>vw-8)left=r.left-tw-10;let top=r.top+(r.height-th)/2;top=Math.max(8,Math.min(top,vh-th-8));left=Math.max(8,Math.min(left,vw-tw-8));statTooltip.style.left=left+'px';statTooltip.style.top=top+'px';});}
  function hideStatTip(){statTooltip.classList.remove('show');}
  setTimeout(()=>{if(isTouchUI){heroStatsGrid.addEventListener('click',e=>{const s=e.target.closest('.heroStat');if(!s)return;if(statTooltip.classList.contains('show'))hideStatTip();else showStatTip(s.querySelector('span').textContent,s);});}else{heroStatsGrid.addEventListener('mouseover',e=>{const s=e.target.closest('.heroStat');if(s&&!(e.relatedTarget&&s.contains(e.relatedTarget)))showStatTip(s.querySelector('span').textContent,s);});heroStatsGrid.addEventListener('mouseout',e=>{const s=e.target.closest('.heroStat');if(s&&!(e.relatedTarget&&s.contains(e.relatedTarget)))hideStatTip();});}},0);'''
rep(old, new, 'F3')

# ---- E: version bumps ----
rep('<div><h1>爆战丨无限弹幕 Demo v0.27</h1><div class="subtitle">属性体系实装 · 符文独立属性 · 全元素伤害面板</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.28</h1><div class="subtitle">属性面板可滚动 · 属性作用悬浮提示</div></div>', 'E1')

old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.27</h3>
        <ol>
          <li><b>属性体系实装：</b>最终属性 = 英雄基础 + 装备汇入 + 符文独立属性；普攻接入攻击伤害%与物理伤害%；符文技能按「攻击力 × 系数 ×（1 + 技能伤害% + 对应元素伤害%）」结算并支持暴击。</li>
          <li><b>符文独立属性：</b>五个符文获得独立暴击率、暴击伤害、元素伤害与技能伤害面板，与英雄、装备属性加算。</li>
          <li><b>属性面板扩容：</b>装备界面按基础/攻击/技能/元素分组显示 15 项属性；符文悬停面板新增独立属性行。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.26 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.26</h4><ul><li>界面布局重构：功能大标签集中到首页，战斗中顶栏精简，城墙血条移至底部栏目中心并预留符咒卡牌槽位。</li></ul></div>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.28</h3>
        <ol>
          <li><b>修复属性面板截断：</b>15 项属性超出 320px 固定高度容器导致显示不完整，属性面板改为可滚动（含细滚动条与滚动链阻断）。</li>
          <li><b>属性作用提示框：</b>15 项属性全部内置作用说明；桌面端悬浮显示，触屏点击显示/再点关闭，自动避让屏幕边界。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.27 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.27</h4><ul><li>属性体系实装：最终属性 = 英雄基础 + 装备汇入 + 符文独立属性；五个符文获得独立暴击/元素/技能伤害面板；属性面板扩至 15 项。</li></ul></div>
        <div class="oldGroup"><h4>v0.26</h4><ul><li>界面布局重构：功能大标签集中到首页，战斗中顶栏精简，城墙血条移至底部栏目中心并预留符咒卡牌槽位。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.28: %d bytes' % len(src.encode('utf-8')))
