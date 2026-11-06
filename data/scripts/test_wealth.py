#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""卡面「混沌」开关 → 财富值数值标签 的本地校验（Playwright，无云端副作用）。
覆盖：标签渲染、 wealth=0 兜底、点击打开修改弹窗、填写后刷新、其余开关不受影响、持久化。"""
import asyncio, base64, copy, functools, http.server, json, os, re, socketserver, threading

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
    # 构造财富值样本：第 1 个有值，第 2 个为 0
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
          zero:document.querySelector('.vrow[data-i="1"] .switches .sw.wtag')?.textContent.trim(),
          titles:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.getAttribute('title'),
        })""")
        eq('每个卡面都有财富标签', r['wt'], len(seed['accounts']), f"({r['wt']} 个)")
        eq('「混沌」开关已消失', r['chaos'], 0)
        eq('有财富值显示数值', r['first'], '财富 123456', f"({r['first']!r})")
        eq('wealth=0 显示占位', r['zero'], '财富 —', f"({r['zero']!r})")
        eq('悬浮提示含财富值', '财富值' in (r['titles'] or ''), True)

        print('== 点击财富标签 → 打开修改弹窗 ==')
        await pg.click('.vrow[data-i="0"] .switches .sw.wtag')
        await pg.wait_for_timeout(300)
        vis = await pg.evaluate("()=>document.getElementById('mask').classList.contains('show')")
        eq('修改弹窗被打开', vis, True)
        wval = await pg.evaluate("()=>document.getElementById('fWealth')?.value")
        eq('弹窗预填财富值', wval, '123456', f"({wval!r})")
        # 改成 888000 保存
        await pg.fill('#fWealth', '888000')
        await pg.click('#mdOk, #mdSave, #mdConfirm') if False else None
        # 弹窗确认按钮 id 待运行时探测：优先常见 id，否则找 mask 内最后一个按钮
        btn = await pg.evaluate("()=>{const b=[...document.querySelectorAll('#mask button')].filter(x=>x.id!=='mdCancel');return b.length?b[b.length-1].id||b[b.length-1].className:null}")
        print('       确认按钮:', btn)
        if btn: await pg.click(f'#mask #{btn}' if not btn.startswith(('btn','md')) and ' ' not in btn else f'.{btn.split()[0]}') if False else await pg.evaluate("id=>{const b=[...document.querySelectorAll('#mask button')].filter(x=>x.id!=='mdCancel');b[b.length-1].click()}", btn)
        await pg.wait_for_timeout(500)
        saved = await pg.evaluate("""()=>({
          closed:!document.getElementById('mask').classList.contains('show'),
          card:document.querySelector('.vrow[data-i="0"] .switches .sw.wtag')?.textContent.trim(),
          ls:JSON.parse(localStorage.getItem('gem-ledger-v2')).accounts[0].wealth,
        })""")
        eq('弹窗已关闭', saved['closed'], True)
        eq('卡面刷新为新值', saved['card'], '财富 888000', f"({saved['card']!r})")
        eq('localStorage 已持久化', saved['ls'], 888000)

        print('== 其余 4 个开关不受影响 ==')
        sw = await pg.evaluate("""()=>{const c=document.querySelector('.vcard');const s=c.querySelector('.switches');
          return {keys:[...s.querySelectorAll('.sw[data-feat]')].map(x=>x.dataset.key),
                  labels:[...s.querySelectorAll('.sw[data-feat]')].map(x=>x.textContent.trim()),
                  order:[...s.children].map(x=>x.textContent.trim().split(' ')[0])};}""")
        eq('剩余开关为 4 个', len(sw['keys']), 4, f"({sw['labels']})")
        eq('混沌不在开关中', 'chaos' in sw['keys'], False)
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
