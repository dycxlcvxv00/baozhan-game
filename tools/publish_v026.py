import re, sys, pathlib

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')

if 'Demo v0.26' in src:
    print('v0.26 already applied; nothing to do')
    sys.exit(0)

def rep(old, new, tag):
    global src
    n = src.count(old)
    if n != 1:
        sys.exit('%s anchor count=%d' % (tag, n))
    src = src.replace(old, new, 1)

old = '''        <button class="pill versionBtn" id="changelogBtn" title="查看版本记录">📜 v0.25</button><button class="pill fsBtn" id="fsBtn" title="全屏游玩：横屏铺满手机屏幕">📱 全屏</button>
      </div>
    </section>'''
new = '''      </div>
      <button class="pill fsBtn" id="fsBtn" title="全屏游玩：横屏铺满手机屏幕">📱 全屏</button>
    </section>'''
rep(old, new, 'E1')

old = '''    <section class="bottombar">
      <div class="runes" id="battleRunes"></div>
      <div class="footerTools"><div class="systemStatus"><span id="saveStatus">存档已就绪</span>　｜　R 重开 · 空格暂停</div><div class="saveControls"><button id="masteryBtn" title="查看符文专精">✦ 专精</button><button id="speedBtn">1×</button><button id="exportSaveBtn">导出</button><button id="importSaveBtn">导入</button><button id="resetSaveBtn">重置</button><input id="importSaveInput" type="file" accept="application/json" hidden></div><div class="audioControls"><button id="muteBtn" title="静音">🔊</button><label>总<input id="masterVolume" type="range" min="0" max="100" value="70"></label><label>音乐<input id="musicVolume" type="range" min="0" max="100" value="42"></label><label>音效<input id="sfxVolume" type="range" min="0" max="100" value="72"></label></div></div>
    </section>'''
new = '''    <section class="bottombar">
      <div class="runes" id="battleRunes"></div>
      <div class="wallHpPanel"><div class="wallHpTop"><span>🛡 城墙</span><span id="wallHpText">1000 / 1000</span></div><div class="wallHpBar"><div class="wallHpFill" id="wallHpFill"></div><div class="wallShieldFill" id="wallShieldFill"></div></div></div>
      <div class="talismanDock"><span class="talismanSlot">符咒槽</span><span class="talismanSlot">符咒槽</span><span class="talismanSlot">符咒槽</span></div>
    </section>'''
rep(old, new, 'E2')

old = '''          <p class="big" id="setupHint">上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。</p>'''
new = '''          <div class="setupTools">
            <div class="toolGroup"><button class="toolBig" id="masteryBtn" title="查看符文专精">✦ 专精</button><button class="toolBig" id="changelogBtn" title="查看版本记录">📜 版本</button><button class="toolBig" id="speedBtn" title="切换游戏速度">⏩ 1×</button></div>
            <div class="toolGroup saveControls"><button id="exportSaveBtn">导出</button><button id="importSaveBtn">导入</button><button id="resetSaveBtn">重置</button><input id="importSaveInput" type="file" accept="application/json" hidden></div>
            <div class="toolGroup audioControls"><button id="muteBtn" title="静音">🔊</button><label>总<input id="masterVolume" type="range" min="0" max="100" value="70"></label><label>音乐<input id="musicVolume" type="range" min="0" max="100" value="42"></label><label>音效<input id="sfxVolume" type="range" min="0" max="100" value="72"></label></div>
            <div class="systemStatus"><span id="saveStatus">存档已就绪</span>　｜　R 重开 · 空格暂停</div>
          </div>
          <p class="big" id="setupHint">上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。</p>'''
rep(old, new, 'E3')

old = '''    .setupCard.touchLandscapeFit{position:fixed!important;left:50%!important;top:50%!important;width:1060px!important;max-width:none!important;max-height:none!important;overflow:visible!important;margin:0!important;transform:translate(-50%,-50%) scale(var(--modal-scale,.68))!important;transform-origin:center center!important;z-index:82}'''
new = old + '''
    body.battle .stats{display:none}
    .setupTools{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:center;margin:6px 0 2px;padding:6px 10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.035)}
    .toolGroup{display:flex;gap:6px;align-items:center}
    .toolBig{padding:8px 16px;font-size:13px;font-weight:800}
    .setupTools .systemStatus{font-size:10px;color:var(--muted)}
    .bottombar{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px}
    .bottombar .runes{min-width:0}
    .wallHpPanel{width:min(340px,32vw);text-align:left}
    .wallHpTop{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px}
    #wallHpText{color:#fff;font-weight:800}
    .wallHpBar{position:relative;height:16px;border-radius:999px;background:rgba(0,0,0,.42);border:1px solid var(--border);overflow:hidden}
    .wallHpFill{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(90deg,#ff5f64,#ff9b45);transition:width .15s}
    .wallShieldFill{position:absolute;left:0;top:0;height:5px;width:0;background:#66d9ff;transition:width .15s}
    .talismanDock{display:flex;gap:8px;justify-content:flex-end;min-width:0}
    .talismanSlot{width:64px;height:40px;border:1.5px dashed rgba(255,255,255,.22);border-radius:10px;display:grid;place-items:center;font-size:10px;color:rgba(255,247,234,.35);flex:0 0 auto}
    @media(max-width:760px){.wallHpPanel{width:200px}.talismanSlot{width:44px;height:32px;font-size:8px}.bottombar{gap:8px}.toolBig{padding:7px 12px;font-size:12px}}'''
rep(old, new, 'CSS')

old = '''  function update(dt){
    if(!state.running || state.paused || state.result) return;
    state.time+=dt;'''
new = '''  function updateWallUI(){const f=document.getElementById('wallHpFill'),s=document.getElementById('wallShieldFill'),t=document.getElementById('wallHpText');if(!f)return;const hp=Math.max(0,Math.round(wall.hp));f.style.width=(Math.max(0,wall.hp/wall.maxHp)*100).toFixed(1)+'%';s.style.width=(Math.min(1,wall.shield/wall.maxShield)*100).toFixed(1)+'%';t.textContent='城墙 '+hp+' / '+wall.maxHp+(wall.shield>0?' · 护盾 '+Math.round(wall.shield):'');}
  function update(dt){
    if(!state.running || state.paused || state.result) return;
    updateWallUI(); state.time+=dt;'''
rep(old, new, 'J1')

old = "startBtn.addEventListener('click',()=>{runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show');reset();});"
new = "startBtn.addEventListener('click',()=>{runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show');reset();document.body.classList.add('battle');updateWallUI();});"
rep(old, new, 'J2')

old = "nextStageBtn.addEventListener('click',()=>{progress.currentStage=Math.min(progress.maxUnlockedStage,progress.currentStage+1);saveProgress();reset();});"
new = "nextStageBtn.addEventListener('click',()=>{progress.currentStage=Math.min(progress.maxUnlockedStage,progress.currentStage+1);saveProgress();reset();document.body.classList.add('battle');updateWallUI();});"
rep(old, new, 'J3')

old = "function showLoadout(){AudioEngine.setMode('loadout');"
new = "function showLoadout(){document.body.classList.remove('battle');AudioEngine.setMode('loadout');"
rep(old, new, 'J4')

src, n = re.subn(r'const hpY=[^\n]*?hpX\+8,hpY\+12\);', '/* hp bar moved to bottom bar */', src, count=1)
if n != 1:
    sys.exit('J5 canvas hp block count=%d' % n)

old = '<div><h1>爆战丨无限弹幕 Demo v0.25</h1><div class="subtitle">横屏弹窗完整适配 · HTTPS 在线试玩</div></div>'
new = '<div><h1>爆战丨无限弹幕 Demo v0.26</h1><div class="subtitle">界面布局重构 · 功能集中首页 · 底栏血条居中</div></div>'
rep(old, new, 'J7a')

old = '''      <div class="changelogCurrent"><h3>当前版本 · v0.25</h3>
        <ol>
          <li><b>修复手机横屏弹窗裁切：</b>触屏横屏设备会依据实际可用宽高自动缩放整张战前装配卡。</li>
          <li><b>全屏与旋转自动重算：</b>进入或退出全屏、旋转屏幕以及切换符文/装备页签时，都会重新计算比例并居中。</li>
          <li><b>保持战斗舞台稳定：</b>仅调整装配弹窗，不改动 v0.24 的战斗画布、宽屏舞台与本地存档逻辑。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.24 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.24</h4><ul><li>切换为 HTTPS 标准网页运行，撤回实验性视口补丁，恢复已验证稳定的舞台缩放与宽屏铺满。</li></ul></div>'''
new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.26</h3>
        <ol>
          <li><b>功能大标签集中到首页：</b>版本记录、符文专精、速度切换、存档管理与音频控制统一移入战前装配页功能区。</li>
          <li><b>战斗界面精简：</b>进入战斗后顶栏不再显示关卡/金币/波次等预览栏目，仅保留标题与全屏按钮。</li>
          <li><b>底部栏目更新：</b>城墙血条从画布移至底部栏目中心并保留护盾显示，右侧预留符咒卡牌槽位。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.25 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.25</h4><ul><li>修复手机横屏弹窗裁切：触屏横屏设备按实际可用宽高自动缩放整张战前装配卡；全屏与旋转自动重算；图标拆分为仓库资源文件。</li></ul></div>
        <div class="oldGroup"><h4>v0.24</h4><ul><li>切换为 HTTPS 标准网页运行，撤回实验性视口补丁，恢复已验证稳定的舞台缩放与宽屏铺满。</li></ul></div>'''
rep(old, new, 'J7b')

p.write_text(src, encoding='utf-8')
print('published v0.26: %d bytes' % len(src.encode('utf-8')))
