import re, sys, pathlib

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
p = ROOT / 'index.html'
src = p.read_text(encoding='utf-8')

if 'Demo v0.25' in src:
    print('v0.25 already applied; nothing to do')
    sys.exit(0)

edits = []

old1 = '    @media(max-width:760px) and (orientation:landscape){.rotateHint{display:none}}'
new1 = old1 + '\n    .setupCard.touchLandscapeFit{position:fixed!important;left:50%!important;top:50%!important;width:1060px!important;max-width:none!important;max-height:none!important;overflow:visible!important;margin:0!important;transform:translate(-50%,-50%) scale(var(--modal-scale,.68))!important;transform-origin:center center!important;z-index:82}'
edits.append((old1, new1))

old2 = "    const isRune=kind==='rune';runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show'); runeTab.classList.toggle('active',isRune);equipmentTab.classList.toggle('active',!isRune);runePanel.classList.toggle('active',isRune);equipmentPanel.classList.toggle('active',!isRune);setupHint.textContent=isRune?'上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。':'左侧显示英雄实时属性；中间为正方形装备位；右侧为正方形仓库。穿戴后属性立即作用于战斗。';AudioEngine.setMode('loadout');"
new2 = old2 + 'requestAnimationFrame(fitSetupCard);'
edits.append((old2, new2))

old3 = """  const isTouchUI=!!window.matchMedia&&matchMedia('(hover: none), (pointer: coarse)').matches;
  function itemById(id){return equipmentItems.find(i=>i.id===id)||null;}"""
new3 = """  const isTouchUI=!!window.matchMedia&&matchMedia('(hover: none), (pointer: coarse)').matches;
  function fitSetupCard(){
    const landscape=isTouchUI&&innerWidth>innerHeight;
    setupCard.classList.toggle('touchLandscapeFit',landscape);
    setupCard.style.removeProperty('--modal-scale');
    if(!landscape||!overlay.classList.contains('show')||setupCard.style.display==='none')return;
    requestAnimationFrame(()=>{
      const vv=window.visualViewport,vw=vv?.width||innerWidth,vh=vv?.height||innerHeight;
      const w=Math.max(setupCard.scrollWidth,setupCard.offsetWidth),h=Math.max(setupCard.scrollHeight,setupCard.offsetHeight);
      const scale=Math.min((vw-16)/w,(vh-16)/h,1);
      setupCard.style.setProperty('--modal-scale',Math.max(.42,scale).toFixed(4));
    });
  }
  function itemById(id){return equipmentItems.find(i=>i.id===id)||null;}"""
edits.append((old3, new3))

old4 = "  function showLoadout(){AudioEngine.setMode('loadout');state.running=false;runeTooltip.classList.remove('show');equipmentTooltip.classList.remove('show');overlay.classList.add('show');setupCard.style.display='block';resultCard.style.display='none';setSetupTab('rune');renderEquipment();renderLoadout();renderInventory();updateProgressUI();}"
new4 = old4[:-1] + 'requestAnimationFrame(fitSetupCard);}'
edits.append((old4, new4))

old5 = "  scaleStage();addEventListener('resize',scaleStage);addEventListener('orientationchange',()=>setTimeout(scaleStage,150));document.addEventListener('fullscreenchange',()=>setTimeout(scaleStage,150));"
new5 = "  scaleStage();addEventListener('resize',()=>{scaleStage();fitSetupCard();});addEventListener('orientationchange',()=>setTimeout(()=>{scaleStage();fitSetupCard();},150));document.addEventListener('fullscreenchange',()=>setTimeout(()=>{scaleStage();fitSetupCard();},150));"
edits.append((old5, new5))

old6 = '<div><h1>爆战丨无限弹幕 Demo v0.24</h1><div class="subtitle">HTTPS 标准网页模式 · 手机横屏全屏 · 宽屏铺满</div></div>'
new6 = '<div><h1>爆战丨无限弹幕 Demo v0.25</h1><div class="subtitle">横屏弹窗完整适配 · HTTPS 在线试玩</div></div>'
edits.append((old6, new6))

old7 = '<button class="pill versionBtn" id="changelogBtn" title="查看版本记录">📜 v0.24</button>'
new7 = '<button class="pill versionBtn" id="changelogBtn" title="查看版本记录">📜 v0.25</button>'
edits.append((old7, new7))

for i, (old, new) in enumerate(edits, 1):
    if src.count(old) != 1:
        sys.exit('edit %d anchor not unique (count=%d)' % (i, src.count(old)))
    src = src.replace(old, new, 1)

cl_pat = r'      <div class="changelogCurrent">.*?</div>\n      <details class="changelogOld"><summary>.*?</summary>'
cl_new = '''      <div class="changelogCurrent"><h3>当前版本 · v0.25</h3>
        <ol>
          <li><b>修复手机横屏弹窗裁切：</b>触屏横屏设备会依据实际可用宽高自动缩放整张战前装配卡。</li>
          <li><b>全屏与旋转自动重算：</b>进入或退出全屏、旋转屏幕以及切换符文/装备页签时，都会重新计算比例并居中。</li>
          <li><b>保持战斗舞台稳定：</b>仅调整装配弹窗，不改动 v0.24 的战斗画布、宽屏舞台与本地存档逻辑。</li>
        </ol>
      </div>
      <details class="changelogOld"><summary>历史版本（v0.24 及更早，点击展开）</summary>
        <div class="oldGroup"><h4>v0.24</h4><ul><li>切换为 HTTPS 标准网页运行，撤回实验性视口补丁，恢复已验证稳定的舞台缩放与宽屏铺满。</li></ul></div>'''
src, n = re.subn(cl_pat, lambda m: cl_new, src, count=1, flags=re.S)
if n != 1:
    sys.exit('changelog anchor not found')

m = re.search(r'const equipmentIconMap=\{((?:"[^"]+":"[^"]+",?)+)\};', src, re.S)
if not m:
    sys.exit('equipmentIconMap not found')
pairs = re.findall(r'"([^"]+)":"(data:image/[^"]+)"', m.group(1))
if len(pairs) != 200:
    sys.exit('unexpected icon count: %d' % len(pairs))

out = ROOT / 'assets'
out.mkdir(exist_ok=True)
PER = 25
names = []
for i in range(0, len(pairs), PER):
    chunk = pairs[i:i + PER]
    body = ','.join('"%s":"%s"' % (k, v) for k, v in chunk)
    name = 'icons_p%d.js' % (len(names) + 1)
    (out / name).write_text('window.__EIM=Object.assign(window.__EIM||{},{' + body + '});', encoding='utf-8')
    names.append(name)

src = src[:m.start()] + 'const equipmentIconMap=window.__EIM||{};' + src[m.end():]
if src.count('<script>') != 1:
    sys.exit('unexpected script tag count: %d' % src.count('<script>'))
tags = ''.join('<script src="assets/%s"></script>' % nm for nm in names)
src = src.replace('<script>', tags + '<script>', 1)

p.write_text(src, encoding='utf-8')
print('published: %d icon parts, index %d bytes' % (len(names), len(src.encode('utf-8'))))
