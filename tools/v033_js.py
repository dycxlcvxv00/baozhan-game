import re, sys, pathlib
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')
if 'Demo v0.33' in src:
    print('v0.33 already applied; nothing to do')
    sys.exit(0)
def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

# ---- J1: setSetupTab -> rune/equipment/settings ----
rep("""  function setSetupTab(kind){
    const isRune=kind==='rune';runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show'); runeTab.classList.toggle('active',isRune);equipmentTab.classList.toggle('active',!isRune);runePanel.classList.toggle('active',isRune);equipmentPanel.classList.toggle('active',!isRune);setupHint.textContent=isRune?'上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。':'左侧显示英雄实时属性；中间为正方形装备位；右侧为正方形仓库。穿戴后属性立即作用于战斗。';AudioEngine.setMode('loadout');requestAnimationFrame(fitSetupCard);
  }""",
    '''  const settingsTab=document.getElementById('settingsTab'),settingsPanel=document.getElementById('settingsPanel');
  function setSetupTab(kind){
    runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show');
    runeTab.classList.toggle('active',kind==='rune');equipmentTab.classList.toggle('active',kind==='equipment');settingsTab.classList.toggle('active',kind==='settings');
    runePanel.classList.toggle('active',kind==='rune');equipmentPanel.classList.toggle('active',kind==='equipment');settingsPanel.classList.toggle('active',kind==='settings');
    AudioEngine.setMode('loadout');requestAnimationFrame(fitSetupCard);
  }''', 'J1')

# ---- J2: updateProgressUI -> stage list + gold + hero level ----
rep('  function updateProgressUI(){document.getElementById(\'stageProgressText\').textContent=`第 ${progress.currentStage} 关 / 已解锁 ${progress.maxUnlockedStage}`;document.getElementById(\'stageSelectText\').textContent=`第 ${progress.currentStage} 关`;document.getElementById(\'setupGoldText\').textContent=`金币 ${progress.gold}`;document.getElementById(\'stagePrev\').disabled=progress.currentStage<=1;document.getElementById(\'stageNext\').disabled=progress.currentStage>=progress.maxUnlockedStage;ui.stage.textContent=progress.currentStage;ui.gold.textContent=progress.gold;}',
    '''  function renderStageList(){const box=document.getElementById('stageList');if(!box)return;box.innerHTML='';for(let s=1;s<=progress.maxUnlockedStage;s++){const done=s<progress.maxUnlockedStage,b=document.createElement('button');b.className='stageNode'+(s===progress.currentStage?' active':'');b.innerHTML=`<span>第 ${s} 关${s%5===0?' 👑':''}</span><span class="sCheck">${done?'✔':(s===progress.currentStage?'▸':'')}</span>`;b.onclick=()=>{progress.currentStage=s;updateProgressUI();saveProgress(false);};box.appendChild(b);}const lock=document.createElement('button');lock.className='stageNode';lock.disabled=true;lock.innerHTML=`<span>第 ${progress.maxUnlockedStage+1} 关</span><span class="sLock">🔒</span>`;box.appendChild(lock);}
  function updateProgressUI(){document.getElementById('setupGoldText').textContent=progress.gold;ui.stage.textContent=progress.currentStage;ui.gold.textContent=progress.gold;renderStageList();const hl=document.getElementById('heroLevelText');if(hl)hl.textContent='英雄 Lv.'+(1+progress.totalWins);}''', 'J2')

# ---- J3: renderEquipment two columns ----
rep("equipmentPanel=document.getElementById('equipmentPanel'),setupHint=document.getElementById('setupHint'),equipmentGrid=document.getElementById('equipmentGrid'),warehouseGrid=document.getElementById('warehouseGrid')",
    "equipmentPanel=document.getElementById('equipmentPanel'),setupHint=document.getElementById('setupHint'),equipColLeft=document.getElementById('equipColLeft'),equipColRight=document.getElementById('equipColRight'),warehouseGrid=document.getElementById('warehouseGrid')", 'J3a')
rep("calculateHeroStats();equipmentGrid.innerHTML='';warehouseGrid.innerHTML='';",
    "calculateHeroStats();equipColLeft.innerHTML='';equipColRight.innerHTML='';warehouseGrid.innerHTML='';", 'J3b')
rep('slotOrder.forEach(slot=>{const item=itemById(equippedItems[slot]),b=document.createElement(\'button\');',
    'slotOrder.forEach((slot,si)=>{const item=itemById(equippedItems[slot]),b=document.createElement(\'button\');', 'J3c')
rep(';equipmentGrid.appendChild(b);});equipmentItems.forEach(item=>{',
    ';(si<5?equipColLeft:equipColRight).appendChild(b);});equipmentItems.forEach(item=>{', 'J3d')

# ---- J4: remove obsolete stage prev/next bindings ----
rep("document.getElementById('stagePrev').onclick=()=>changeStage(-1);document.getElementById('stageNext').onclick=()=>changeStage(1);",
    '', 'J4')

# ---- J5: persist hero name in save ----
rep("settings:{speed:state.speed,master:document.getElementById('masterVolume')?.value||70,music:document.getElementById('musicVolume')?.value||42,sfx:document.getElementById('sfxVolume')?.value||72}};}",
    "settings:{heroName:document.getElementById('heroNameInput')?.value||'守城英雄',speed:state.speed,master:document.getElementById('masterVolume')?.value||70,music:document.getElementById('musicVolume')?.value||42,sfx:document.getElementById('sfxVolume')?.value||72}};}", 'J5')
rep("const st=data.settings||{};state.speed=st.speed===2?2:1;[['masterVolume',st.master],['musicVolume',st.music],['sfxVolume',st.sfx]].forEach(([id,v])=>{const e=document.getElementById(id);if(e&&v!=null)e.value=v});return true;}",
    "const st=data.settings||{};state.speed=st.speed===2?2:1;[['masterVolume',st.master],['musicVolume',st.music],['sfxVolume',st.sfx]].forEach(([id,v])=>{const e=document.getElementById(id);if(e&&v!=null)e.value=v});const hn=document.getElementById('heroNameInput');if(hn&&st.heroName)hn.value=st.heroName;return true;}", 'J6')

# ---- J7: new tab bindings + hero name save + rune info tooltip ----
rep("runeTab.onclick=()=>setSetupTab('rune');equipmentTab.onclick=()=>setSetupTab('equipment');",
    '''runeTab.onclick=()=>setSetupTab('rune');equipmentTab.onclick=()=>setSetupTab('equipment');settingsTab.onclick=()=>setSetupTab('settings');
  document.getElementById('masteryNavTab').onclick=()=>{runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show');renderMasteryPanel();masteryModal.classList.add('show');};
  document.getElementById('heroNameInput').onchange=()=>saveProgress(false);
  (function(){const dot=document.getElementById('runeInfoDot');if(!dot)return;const tip=document.createElement('div');tip.className='runeInfoTip';document.body.appendChild(tip);const show=()=>{tip.textContent='上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。点击符文库选择，再点击六边形槽位装配；点击已装配槽位可卸下。';tip.classList.add('show');const r=dot.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-292,r.left-6))+'px';tip.style.top=(r.bottom+8)+'px';};dot.addEventListener('mouseenter',show);dot.addEventListener('mouseleave',()=>tip.classList.remove('show'));})();''', 'J7')

p.write_text(src, encoding='utf-8')
print('v033 js done')
