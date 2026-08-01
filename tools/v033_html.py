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

# ---- H1: setup grid -> 3 columns (stage list | matrix | inventory) ----
rep('.setupGrid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-top:8px;text-align:left}',
    '.setupGrid{display:grid;grid-template-columns:auto 1.05fr 1fr;gap:14px;margin-top:8px;text-align:left}', 'H1')

# ---- H2: nav row (title left, then rune/equip/mastery/settings, gold right) ----
rep('  <h2>战前装配</h2>\n          <div class="setupTabs" role="tablist"><button class="setupTab active" id="runeTab">符文装配</button><button class="setupTab" id="equipmentTab">装备穿配</button></div>',
    '''  <div class="setupNav"><div class="setupNavTitle">战前装配</div><button class="setupTab active" id="runeTab">符文</button><button class="setupTab" id="equipmentTab">装备</button><button class="setupTab" id="masteryNavTab">专精</button><button class="setupTab" id="settingsTab">设置</button><div class="setupNavGold">金币 <strong id="setupGoldText">0</strong></div></div>''', 'H2')

# ---- H3: remove progressStrip (stage list moves into rune panel) ----
rep('  <div class="progressStrip"><div><strong>关卡推进</strong><span id="stageProgressText">第 1 关 / 已解锁 1</span></div><div class="stageControls"><button id="stagePrev">−</button><span id="stageSelectText">第 1 关</span><button id="stageNext">＋</button></div><div><strong>资源</strong><span id="setupGoldText">金币 0</span></div></div>\n',
    '', 'H3')

# ---- H4: hide setupHint (moved into rune info tooltip) ----
rep('  <p class="big" id="setupHint">上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。</p>',
    '  <p class="big" id="setupHint" style="display:none">上下各 8 个六边形槽位，共 16 槽。可装配 0～5 个不同符文，空槽允许直接进入战斗。</p>', 'H4')

# ---- H5: stage list column at start of rune panel ----
rep('  <div class="setupGrid setupPanel active" id="runePanel">',
    '  <div class="setupGrid setupPanel active" id="runePanel">\n            <div class="stageList" id="stageList"></div>', 'H5')

# ---- H6: info dot next to rune inventory title ----
rep('<h3>符文库（每种符文仅可装配 1 次）</h3>',
    '<h3>符文库 <span class="infoDot" id="runeInfoDot">?</span>（每种符文仅可装配 1 次）</h3>', 'H6')

# ---- H7: equipment loadout -> hero showcase (name/level/bg, slots both sides) ----
rep('<div class="equipmentLoadout"><h3>英雄装备位置 <span id="equipmentCount">0 / 10</span></h3><div class="equipmentGrid" id="equipmentGrid"></div><div class="columnLabels"><span>左列</span><span>右列</span></div></div>',
    '''<div class="equipmentLoadout"><h3>英雄装备位置 <span id="equipmentCount">0 / 10</span></h3><div class="heroShowcase"><div class="equipCol" id="equipColLeft"></div><div class="heroCenter"><input class="heroName" id="heroNameInput" value="守城英雄" maxlength="12"><div class="heroLevel" id="heroLevelText">英雄 Lv.1</div><div class="heroBg"><div class="heroPortraitBig">英</div></div></div><div class="equipCol" id="equipColRight"></div></div></div>''', 'H7')

# ---- H8: setupTools -> settingsPanel (regrouped) ----
rep('''          <div class="setupTools">
            <div class="toolGroup"><button class="toolBig" id="masteryBtn" title="查看符文专精">✦ 专精</button><button class="toolBig" id="changelogBtn" title="查看版本记录">📜 版本</button><button class="toolBig" id="speedBtn" title="切换游戏速度">⏩ 1×</button></div>
            <div class="toolGroup saveControls"><button id="exportSaveBtn">导出</button><button id="importSaveBtn">导入</button><button id="resetSaveBtn">重置</button><input id="importSaveInput" type="file" accept="application/json" hidden></div>
            <div class="toolGroup audioControls"><button id="muteBtn" title="静音">🔊</button><label>总<input id="masterVolume" type="range" min="0" max="100" value="70"></label><label>音乐<input id="musicVolume" type="range" min="0" max="100" value="42"></label><label>音效<input id="sfxVolume" type="range" min="0" max="100" value="72"></label></div>
            <div class="systemStatus"><span id="saveStatus">存档已就绪</span>　｜　R 重开 · 空格暂停</div>
          </div>''',
    '''          <div class="settingsPanel setupPanel" id="settingsPanel">
            <div class="settingsGroup"><h4>游戏与版本</h4><div class="settingsRow"><button class="toolBig" id="masteryBtn" title="查看符文专精">✦ 专精</button><button class="toolBig" id="changelogBtn" title="查看版本记录">📜 版本</button><button class="toolBig" id="speedBtn" title="切换游戏速度">⏩ 1×</button></div></div>
            <div class="settingsGroup"><h4>音频</h4><div class="settingsRow"><button id="muteBtn" title="静音">🔊</button><label>总音量<input id="masterVolume" type="range" min="0" max="100" value="70"></label><label>音乐<input id="musicVolume" type="range" min="0" max="100" value="42"></label><label>音效<input id="sfxVolume" type="range" min="0" max="100" value="72"></label></div></div>
            <div class="settingsGroup"><h4>存档</h4><div class="settingsRow"><button id="exportSaveBtn">导出</button><button id="importSaveBtn">导入</button><button id="resetSaveBtn">重置</button><input id="importSaveInput" type="file" accept="application/json" hidden></div><div class="systemStatus"><span id="saveStatus">存档已就绪</span>　｜　R 重开 · 空格暂停</div></div>
          </div>''', 'H8')

p.write_text(src, encoding='utf-8')
print('v033 html done')
