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

# ---- C1: new UI styles (append after victoryFlash rule) ----
rep('animation:vfIn 1.2s ease-out forwards;pointer-events:none;z-index:60}',
    '''animation:vfIn 1.2s ease-out forwards;pointer-events:none;z-index:60}
    .setupNav{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}
    .setupNavTitle{font-size:21px;font-weight:900;color:#ffd36b;margin-right:auto;letter-spacing:1px}
    .setupNavGold{font-size:11px;color:var(--muted);padding:5px 9px;border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.045)}
    .setupNavGold strong{color:#ffd36b}
    .stageList{display:flex;flex-direction:column;gap:6px;max-height:330px;overflow-y:auto;padding:2px 4px 2px 2px;min-width:150px}
    .stageList::-webkit-scrollbar{width:6px}.stageList::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:3px}
    .stageNode{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;border-radius:11px;border:1px solid var(--border);background:rgba(255,255,255,.05);color:var(--text);cursor:pointer;margin:0;box-shadow:none;font-size:13px;font-weight:700;text-align:left}
    .stageNode:hover:not(:disabled){border-color:#ffd36b;background:rgba(255,194,90,.12)}
    .stageNode.active{border-color:#ffd36b;background:linear-gradient(135deg,rgba(255,211,107,.2),rgba(255,136,70,.14));box-shadow:inset 0 0 0 1px #ffd36b}
    .stageNode:disabled{opacity:.4;cursor:not-allowed}
    .stageNode .sCheck{width:18px;text-align:center;color:#7dff9d;font-weight:900}
    .stageNode .sLock{color:var(--muted)}
    .infoDot{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:rgba(95,194,255,.18);border:1px solid rgba(95,194,255,.5);color:#9ecbff;font-size:10px;font-weight:900;cursor:help;vertical-align:middle;margin-left:2px}
    .runeInfoTip{position:fixed;display:none;z-index:120;max-width:280px;padding:10px 12px;border-radius:10px;background:rgba(18,16,23,.97);border:1px solid #5fc2ff;box-shadow:0 12px 30px rgba(0,0,0,.55);font-size:11px;line-height:1.65;color:var(--text);pointer-events:none;text-align:left}
    .runeInfoTip.show{display:block}
    .heroShowcase{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;border:1px solid var(--border);border-radius:16px;background:radial-gradient(circle at 50% 40%,rgba(255,190,90,.14),transparent 55%),linear-gradient(160deg,rgba(30,26,42,.6),rgba(14,16,26,.6));padding:14px 12px;margin-bottom:10px}
    .equipCol{display:flex;flex-direction:column;gap:8px;align-items:center}
    .heroCenter{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:150px}
    .heroName{font-size:15px;font-weight:900;color:#fff;background:none;border:1px solid transparent;border-radius:8px;padding:3px 8px;text-align:center;width:130px;color:var(--text)}
    .heroName:focus{outline:none;border-color:#ffd36b;background:rgba(255,255,255,.06)}
    .heroLevel{font-size:11px;color:#ffd36b;font-weight:800}
    .heroBg{width:120px;height:120px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(255,211,107,.22),rgba(255,211,107,.05) 60%,transparent 72%);border:2px solid rgba(255,211,107,.35);box-shadow:0 0 26px rgba(255,190,90,.28)}
    .heroPortraitBig{width:72px;height:72px;display:grid;place-items:center;clip-path:polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);background:linear-gradient(135deg,#ffd36b,#ff8846);color:#271608;font-weight:900;font-size:30px}
    .equipBottom{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .equipCol .equipSlot{width:52px;height:52px}
    .settingsPanel{display:block}
    .settingsGroup{border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.035);padding:12px 14px;margin-bottom:10px}
    .settingsGroup h4{margin:0 0 8px;font-size:14px;color:#ffd36b}
    .settingsRow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:7px 0}
    .settingsRow>span{font-size:12px;color:var(--muted);min-width:64px}''', 'C1')

p.write_text(src, encoding='utf-8')
print('v033 css done')
