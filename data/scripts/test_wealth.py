#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""卡面财富值数值标签（原「混沌」开关位）的本地校验（Playwright，无云端副作用）。
覆盖：只显数值、紫/灰配色、独立浮层（单输入框）、保存/清空/Enter、其余开关不受影响。"""
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
    seed['accounts'][0]['wealth'] = 123456
    seed['accounts'][1]['wealth'] = 0
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': 2560, 'height': 1200})
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base); await pg.wait_for_timeout(900)

        print('== 卡面标签渲染 ==')
        r = await pg.evaluate("""()=>({
          wt:[...document.querySelectorAll('.switches .sw.wtag')].length,
          chaos:[...document.querySelectorAll('.switches .sw[data-key="chaos"]')].length,
          first:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.textContent.trim(),
          firstCls:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.classList.contains('filled'),
          zero:document.querySelector('.vrow[data-i="1"] .switches .sw.wtag')?.textContent.trim(),
          zeroCls:document.querySelector('.vrow[data-i="1"] .switches .sw.wtag')?.classList.contains('filled'),
          title:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.getAttribute('title'),
        })""")
        eq('每个卡面都有财富标签', r['wt'], len(seed['accounts']), f"({r['wt']} 个)")
        eq('「混沌」开关已消失', r['chaos'], 0)
        eq('只显数值（无「财富」字样）', r['first'], '123456', f"({r['first']!r})")
        eq('数值>0 为紫色 filled', r['firstCls'], True)
        eq('未填显示占位 —', r['zero'], '—')
        eq('未填为灰色（无 filled）', r['zeroCls'], False)
        eq('悬浮提示正确', (r['title'] or '').startswith('财富值：123456'), True)

        print('== 点击财富值 → 独立浮层 ==')
        await pg.click('.vrow[data-i="0"] .switches .sw.wtag')
        await pg.wait_for_timeout(300)
        r2 = await pg.evaluate("""()=>({
          maskOpen:document.getElementById('wMask').classList.contains('show'),
          mainClosed:!document.getElementById('mask').classList.contains('show'),
          prefilled:document.getElementById('wInput').value,
          fields:[...document.querySelectorAll('#wMask input')].length,
        })""")
        eq('独立浮层打开', r2['maskOpen'], True)
        eq('不是完整修改弹窗', r2['mainClosed'], True)
        eq('浮层只有一个输入框', r2['fields'], 1)
        eq('预填当前财富值', r2['prefilled'], '123456')
        await pg.fill('#wInput', '888000')
        await pg.click('#wOk')
        await pg.wait_for_timeout(400)
        saved = await pg.evaluate("""()=>({
          closed:!document.getElementById('wMask').classList.contains('show'),
          card:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.textContent.trim(),
          cls:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.classList.contains('filled'),
          ls:JSON.parse(localStorage.getItem('gem-ledger-v2')).accounts[0].wealth,
        })""")
        eq('浮层已关闭', saved['closed'], True)
        eq('卡面更新为新数值', saved['card'], '888000', f"({saved['card']!r})")
        eq('紫色保持', saved['cls'], True)
        eq('localStorage 已持久化', saved['ls'], 888000)

        print('== 清空保存 → 回到未填灰色 ==')
        await pg.click('.vrow[data-i="0"] .switches .sw.wtag')
        await pg.wait_for_timeout(200)
        await pg.fill('#wInput', '')
        await pg.click('#wOk')
        await pg.wait_for_timeout(300)
        cleared = await pg.evaluate("""()=>({txt:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.textContent.trim(),
          cls:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.classList.contains('filled'),
          ls:JSON.parse(localStorage.getItem('gem-ledger-v2')).accounts[0].wealth})""")
        eq('清空后回到占位 —', cleared['txt'], '—', f"({cleared['txt']!r})")
        eq('清空后灰色', cleared['cls'], False)
        eq('清空后 wealth=0', cleared['ls'], 0)

        print('== Enter 提交 ==')
        await pg.click('.vrow[data-i="0"] .switches .sw.wtag')
        await pg.wait_for_timeout(200)
        await pg.fill('#wInput', '777')
        await pg.press('#wInput', 'Enter')
        await pg.wait_for_timeout(300)
        ent = await pg.evaluate("""()=>({card:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.textContent.trim(),
          closed:!document.getElementById('wMask').classList.contains('show')})""")
        eq('Enter 保存生效', ent['card'], '777')
        eq('Enter 后浮层关闭', ent['closed'], True)

        print('== 其余 4 个开关不受影响 ==')
        sw = await pg.evaluate("""()=>{const s=document.querySelector('.vrow[data-i="0"] .switches');
          return {keys:[...s.querySelectorAll('.sw[data-feat]')].map(x=>x.dataset.key),
                  order:[...s.children].map(x=>x.textContent.trim())};}""")
        eq('剩余开关为 4 个', len(sw['keys']), 4, f"({sw['keys']})")
        eq('开关行顺序：背包·市集·宠物·财富值·切换（原混沌位）', sw['order'],
           ['背包', '市集', '宠物', '777', '切换'], f"({sw['order']})")
        before = await pg.evaluate("()=>document.querySelector('.vrow[data-i=\"0\"] .switches .sw[data-key=\"bag\"]').classList.contains('on')")
        await pg.click('.vrow[data-i="0"] .switches .sw[data-key="bag"]')
        await pg.wait_for_timeout(200)
        after = await pg.evaluate("()=>document.querySelector('.vrow[data-i=\"0\"] .switches .sw[data-key=\"bag\"]').classList.contains('on')")
        eq('「背包」开关仍可切换（状态翻转）', after, not before, f"(改前 {before} → 改后 {after})")

        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    raise SystemExit(1 if fail else 0)

asyncio.run(main())
