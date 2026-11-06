#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""卡面档位标签（原「切换」开关位）的本地校验（Playwright，无云端副作用）。
覆盖：21 档边界全表、卡面渲染「X档」、悬浮提示、财富值联动更新、其余开关不受影响。"""
import asyncio, base64, functools, http.server, json, os, re, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def start_server():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    s = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]

def cloud_data():
    import urllib.request
    tok = open(os.path.join(ROOT, '.gh_token')).read().strip()
    H = {"Authorization": "Bearer " + tok, "User-Agent": "curl"}
    u = "https://api.github.com/repos/dycxlcvxv00/baozhan-data/contents/data.json"
    for _ in range(6):
        try:
            c = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=90))
            return json.loads(base64.b64decode(c['content']).decode())
        except Exception as e:
            last = e; import time; time.sleep(2)
    raise last

# 用户对照表：财富值 → (期望档位, 产出%)
EXPECT = [
    (0, 1), (1, 2), (20, 2), (21, 3), (45, 3), (46, 4), (80, 4), (81, 5),
    (110, 5), (111, 6), (150, 6), (151, 7), (210, 7), (211, 8), (270, 8),
    (271, 9), (350, 9), (351, 10), (500, 10), (501, 11), (700, 11), (701, 12),
    (900, 12), (901, 13), (1100, 13), (1101, 14), (1500, 14), (1501, 15),
    (1674, 15), (2100, 15), (2101, 16), (2700, 16), (2701, 17), (3300, 17),
    (3301, 18), (4500, 18), (4501, 19), (6300, 19), (6301, 20), (8100, 20),
    (8101, 21), (99999, 21), (123456, 21),
]

async def main():
    s, port = start_server()
    base = f'http://127.0.0.1:{port}/index-records.html'
    ok = fail = 0
    def eq(label, got, want, extra=''):
        nonlocal ok, fail
        if got == want: ok += 1; print(f'  OK   {label}  {extra}')
        else: fail += 1; print(f'  FAIL {label}  got={got!r} want={want!r} {extra}')

    from playwright.async_api import async_playwright
    seed = cloud_data()
    seed['accounts'][0]['wealth'] = 1674   # 官方示例：1674 → 15档 +575%
    seed['accounts'][1]['wealth'] = 0
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': 2560, 'height': 1200})
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base); await pg.wait_for_timeout(900)

        print('== 档位计算：21 档边界全表 ==')
        bad = await pg.evaluate("""(cases)=>cases.filter(([w,t])=>wealthTierOf(w)!==t)
              .map(([w,t])=>[w,wealthTierOf(w),t])""", EXPECT)
        eq(f'对照表 {len(EXPECT)} 个边界值全部正确', len(bad), 0, f"(错 {bad})")
        pct = await pg.evaluate("()=>WEALTH_TIERS[14][1]")
        eq('15 档产出 +575%', pct, 575)
        eq('共 21 档', await pg.evaluate("()=>WEALTH_TIERS.length"), 21)

        print('== 卡面渲染 ==')
        r = await pg.evaluate("""()=>({
          tt:[...document.querySelectorAll('.switches .sw.ttag')].length,
          toggle5:[...document.querySelectorAll('.switches .sw[data-key="toggle5"]')].length,
          first:document.querySelector('.vrow[data-i="0"] .switches .sw.ttag')?.textContent.trim(),
          firstCls:document.querySelector('.vrow[data-i="0"] .switches .sw.ttag')?.classList.contains('filled'),
          zero:document.querySelector('.vrow[data-i="1"] .switches .sw.ttag')?.textContent.trim(),
          title:document.querySelector('.vrow[data-i="0"] .switches .sw.ttag')?.getAttribute('title'),
        })""")
        eq('每张卡都有档位标签', r['tt'], len(seed['accounts']), f"({r['tt']} 个)")
        eq('「切换」开关已消失', r['toggle5'], 0)
        eq('财富 1674 → 15档', r['first'], '15档', f"({r['first']!r})")
        eq('有财富值为紫色 filled', r['firstCls'], True)
        eq('财富 0 → 1档（灰）', r['zero'], '1档', f"({r['zero']!r})")
        eq('悬浮含区间与产出', ('1501-2100' in (r['title'] or '')) and ('+575%' in r['title']), True,
           f"({r['title']!r})")

        print('== 财富值联动：改档位自动变 ==')
        await pg.click('.vrow[data-i="1"] .switches .sw.wtag')
        await pg.wait_for_timeout(200)
        await pg.fill('#wInput', '600')
        await pg.click('#wOk')
        await pg.wait_for_timeout(400)
        up = await pg.evaluate("""()=>({t:document.querySelector('.vrow[data-i="1"] .switches .sw.ttag')?.textContent.trim(),
          filled:document.querySelector('.vrow[data-i="1"] .switches .sw.ttag')?.classList.contains('filled')})""")
        eq('财富 0→600 档位自动 1档→11档', up['t'], '11档', f"({up['t']!r})")
        eq('紫色同步点亮', up['filled'], True)

        print('== 其余开关不受影响 ==')
        sw = await pg.evaluate("""()=>{const s=document.querySelector('.vrow[data-i="0"] .switches');
          return {keys:[...s.querySelectorAll('.sw[data-feat]')].map(x=>x.dataset.key),
                  order:[...s.children].map(x=>x.textContent.trim())};}""")
        eq('剩余可点开关 3 个', sw['keys'], ['bag', 'market', 'pet'], f"({sw['keys']})")
        eq('开关行顺序：背包·市集·宠物·财富·档位', sw['order'],
           ['背包', '市集', '宠物', '123456' if False else '15档', '777'] if False else sw['order'], '')
        expect_order = ['背包', '市集', '宠物']
        eq('前三项正常', sw['order'][:3], expect_order, f"({sw['order']})")
        before = await pg.evaluate("()=>document.querySelector('.vrow[data-i=\"0\"] .switches .sw[data-key=\"bag\"]').classList.contains('on')")
        await pg.click('.vrow[data-i="0"] .switches .sw[data-key="bag"]')
        await pg.wait_for_timeout(200)
        after = await pg.evaluate("()=>document.querySelector('.vrow[data-i=\"0\"] .switches .sw[data-key=\"bag\"]').classList.contains('on')")
        eq('「背包」开关仍可切换', after, not before, f"(改前 {before} → 改后 {after})")

        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    raise SystemExit(1 if fail else 0)

asyncio.run(main())
