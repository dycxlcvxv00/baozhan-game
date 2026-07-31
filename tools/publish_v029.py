import re, sys, pathlib

ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')

if 'Demo v0.29' in src:
    print('v0.29 already applied; nothing to do')
    sys.exit(0)

def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- G0: mastery table gains iceField key ----
rep('const runeMastery={fire:0,ice:0,shield:0,lightning:0,poison:0};',
    'const runeMastery={fire:0,ice:0,shield:0,lightning:0,poison:0,iceField:0};', 'G0')

# ---- G1: zones array declaration ----
rep('const monsters=[], projectiles=[], effects=[], particles=[], dmgTexts=[];',
    'const monsters=[], projectiles=[], effects=[], particles=[], dmgTexts=[], zones=[];', 'G1')

# ---- G2: reset zones on battle start ----
rep('monsters.length=projectiles.length=effects.length=particles.length=dmgTexts.length=0;',
    'monsters.length=projectiles.length=effects.length=particles.length=dmgTexts.length=zones.length=0;', 'G2')

# ---- A: new rune iceField ----
rep('''目标中毒 5 秒，每秒承受英雄攻击力 12% 的持续伤害。'}
  };''',
    '''目标中毒 5 秒，每秒承受英雄攻击力 12% 的持续伤害。'},
    iceField:{name:'极寒冰场',icon:'🌨️',max:50,coef:.5,attrs:{crit:.05,critDmg:.10,elem:.20,skill:.10},perk:'持续 +2 秒 · 冰场伤害 +25%',color:'rgba(120,205,255,.30)',tipColor:'#9be8ff',fill:'ice',tags:['冰霜','地面','持续','减速'],mastery:[{lv:5,text:'持续时间 +2 秒'},{lv:10,text:'冰场伤害 +25%'}],description:'在城墙正前方生成持续 4 秒的极寒冰场。范围内怪物每秒承受英雄攻击力 50% 的冰霜伤害，并被持续减速；冻结的怪物会短暂停在冰场中。'}
  };''', 'A')

# ---- B: releaseRune iceField branch ----
rep("    } else if(kind==='lightning'){",
    '''    } else if(kind==='iceField'){
      AudioEngine.play('ice');const dur=4+(perkOn('iceField',5)?2:0);zones.push({x:wall.x-6,y:H/2,r:120,type:'iceField',dps:runeDamage(runeDefs.iceField.coef*(perkOn('iceField',10)?1.25:1),'iceField'),duration:dur,tick:1}); effects.push({x:wall.x-6,y:H/2,r:16,max:120,color:'rgba(120,210,255,.4)',life:.5});
    } else if(kind==='lightning'){''', 'B')

# ---- C: fireball explosion leaves burn zone ----
rep("damageArea(p.x,p.y,rr,dd,'fire'); remove=true;",
    "damageArea(p.x,p.y,rr,dd,'fire'); zones.push({x:p.x,y:p.y,r:rr*.85,type:'burn',dps:runeDamage(.3,'fire'),duration:2,tick:.5}); remove=true;", 'C')

# ---- D: ice projectile freeze on slowed target ----
rep("m.slow=3;p.pierce--;",
    "if(m.slow>0){m.freeze=m.type==='boss'?.35:.8;} m.slow=3;p.pierce--;", 'D')

# ---- E: shield break knockback ----
rep('if(wall.shield>0){ const take=Math.min(wall.shield,dmg); wall.shield-=take; dmg-=take; } if(dmg>0) wall.hp-=dmg;',
    "if(wall.shield>0){ const take=Math.min(wall.shield,dmg); wall.shield-=take; dmg-=take; if(wall.shield<=0){ for(const z of monsters){ if(z.dead)continue; const d=Math.hypot(z.x-wall.x,z.y-H/2); if(d<260){ z.x=Math.min(W-40,z.x+120); z.freeze=Math.max(z.freeze||0,.4); } } effects.push({x:wall.x,y:H/2,r:30,max:260,color:'rgba(112,225,155,.5)',life:.5}); state.shake=Math.max(state.shake,8);AudioEngine.play('wall'); } } if(dmg>0) wall.hp-=dmg;", 'E')

# ---- F: boss entrance shake + warning ----
rep("    monsters.push({x:spawnX,y:74+Math.random()*(H-148),",
    '''    if(type==='boss'){state.shake=Math.max(state.shake,12);effects.push({x:W-140,y:H/2,r:40,max:320,color:'rgba(255,189,63,.4)',life:.8});dmgTexts.push({x:W-240,y:80,text:'领主来袭！',color:'#ffbd3f',life:1.6,vy:-10});}
    monsters.push({x:spawnX,y:74+Math.random()*(H-148),''', 'F')

# ---- H1: freeze skips monster movement/attack ----
rep('if(m.x-m.r<=wall.x+wall.w){ m.x=wall.x+wall.w+m.r; m.atkTimer-=dt;',
    'if(m.freeze>0){}else if(m.x-m.r<=wall.x+wall.w){ m.x=wall.x+wall.w+m.r; m.atkTimer-=dt;', 'H1')

# ---- H2: freeze timer decrement ----
rep('m.flash=Math.max(0,m.flash-dt); m.invulnerable=Math.max(0,m.invulnerable-dt); m.slow=Math.max(0,m.slow-dt);',
    'm.flash=Math.max(0,m.flash-dt); m.invulnerable=Math.max(0,m.invulnerable-dt); m.slow=Math.max(0,m.slow-dt); m.freeze=Math.max(0,(m.freeze||0)-dt);', 'H2')

# ---- G3: zones update loop ----
rep('for(let i=state.flashes.length-1;i>=0;i--){ state.flashes[i].life-=dt; if(state.flashes[i].life<=0) state.flashes.splice(i,1); }',
    '''for(let i=state.flashes.length-1;i>=0;i--){ state.flashes[i].life-=dt; if(state.flashes[i].life<=0) state.flashes.splice(i,1); }
    for(let i=zones.length-1;i>=0;i--){const z=zones[i];z.duration-=dt;z.tick-=dt;if(z.tick<=0){z.tick=z.type==='burn'?.5:1;for(const m of monsters){if(m.dead||m.invulnerable>0)continue;if(Math.hypot(m.x-z.x,m.y-z.y)<z.r+m.r){damageMonster(m,z.dps,z.type==='burn'?'fire':'ice');m.slow=Math.max(m.slow,.8);}}}
      if(z.duration<=0)zones.splice(i,1);}''', 'G3')

# ---- G4: zones draw + wave status on canvas ----
rep("ctx.fillStyle='rgba(255,180,80,.08)'; ctx.fillRect(0,0,wall.x,H); ctx.fillStyle='rgba(120,170,255,.06)'; ctx.fillRect(wall.x+wall.w,0,W-wall.x-wall.w,H);",
    '''ctx.fillStyle='rgba(255,180,80,.08)'; ctx.fillRect(0,0,wall.x,H); ctx.fillStyle='rgba(120,170,255,.06)'; ctx.fillRect(wall.x+wall.w,0,W-wall.x-wall.w,H);
    for(const z of zones){const g=ctx.createRadialGradient(z.x,z.y,10,z.x,z.y,z.r);const col=z.type==='burn'?'255,140,60':'120,205,255';g.addColorStop(0,`rgba(${col},.30)`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=`rgba(${col},.35)`;ctx.lineWidth=1.5;ctx.setLineDash([6,6]);ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    const wv=waves[state.waveIndex];if(wv&&!state.result){ctx.fillStyle='rgba(255,255,255,.78)';ctx.font='bold 14px "Segoe UI",sans-serif';ctx.textAlign='left';let txt='⚔ '+wv.label+' / 共 '+waves.length+' 波';if(!state.waveStarted&&state.waveTimer>0)txt+=' · 倒计时 '+state.waveTimer.toFixed(1)+'s';ctx.fillText(txt,wall.x+18,28);}''', 'G4')

# ---- G5: freeze tint on monsters ----
rep('if(m.slow>0){ctx.beginPath();ctx.arc(m.x,m.y,m.r+8,0,Math.PI*2);ctx.fill();}',
    'if(m.slow>0||m.freeze>0){ctx.beginPath();ctx.arc(m.x,m.y,m.r+8,0,Math.PI*2);ctx.fill();}', 'G5')

# ---- I1: victory flash CSS ----
rep('.statTooltip h5{margin:0 0 4px;font-size:13px;color:#ffd36b}',
    '.statTooltip h5{margin:0 0 4px;font-size:13px;color:#ffd36b}@keyframes vfIn{0%{opacity:0}15%{opacity:.55}100%{opacity:0}}.victoryFlash{position:fixed;inset:0;background:radial-gradient(circle,rgba(255,214,90,.6),rgba(255,214,90,0) 70%);animation:vfIn 1.2s ease-out forwards;pointer-events:none;z-index:60}', 'I1')

# ---- I2: victory flash on finish ----
rep('function finish(type){if(state.result)return;',
    "function finish(type){if(state.result)return;if(type==='victory'){const vf=document.createElement('div');vf.className='victoryFlash';document.body.appendChild(vf);setTimeout(()=>vf.remove(),1300);}", 'I2')

# ---- E1: version h1 ----
rep('<div><h1>爆战丨无限弹幕 Demo v0.28</h1><div class="subtitle">属性面板可滚动 · 属性作用悬浮提示</div></div>',
    '<div><h1>爆战丨无限弹幕 Demo v0.29</h1><div class="subtitle">极寒冰场新符文 · 地面区域系统 · 战斗流程强化</div></div>', 'E1')

# ---- E2: changelog ----
old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.28</h3>
        <ol>
          <li><b>修复属性面板截断：</b>15 项属性超出 320px 固定高度容器导致显示不完整，属性面板改为可滚动（含细滚动条与滚动链阻断）。</li>
          <li><b>属性作用提示框：</b>15 项属性全部内置作用说明；桌面端悬浮显示，触屏点击显示/再点关闭，自动避让屏幕边界。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.27 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.27</h4><ul><li>属性体系实装：最终属性 = 英雄基础 + 装备汇入 + 符文独立属性；五个符文获得独立暴击/元素/技能伤害面板；属性面板扩至 15 项。</li></ul></div>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.29</h3>
        <ol>
          <li><b>新符文「极寒冰场」：</b>第 6 个可选符文，在城墙前生成持续 4 秒的冰场，每秒造成攻击力 50% 冰霜伤害并减速；专精 Lv.5 持续 +2 秒、Lv.10 伤害 +25%。</li>
          <li><b>符文进阶实装：</b>爆裂火球爆炸后留下燃烧地面 2 秒；寒冰锥刺命中已减速目标时追加短冻结；坚壁符文护盾被击破时震退并短暂冻结城墙前怪物。</li>
          <li><b>战斗流程强化：</b>领主登场震屏与「领主来袭」提示；波次与下一波倒计时直接绘制在战场内；怪物冻结表现；胜利时全屏金色闪光。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.28 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.28</h4><ul><li>属性面板改为可滚动修复截断；15 项属性新增作用说明提示框（桌面悬浮 / 触屏点击）。</li></ul></div>
        <div class="oldGroup"><h4>v0.27</h4><ul><li>属性体系实装：最终属性 = 英雄基础 + 装备汇入 + 符文独立属性；五个符文获得独立暴击/元素/技能伤害面板；属性面板扩至 15 项。</li></ul></div>'''
rep(old, new, 'E2')

p.write_text(src, encoding='utf-8')
print('published v0.29: %d bytes' % len(src.encode('utf-8')))
