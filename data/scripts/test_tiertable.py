#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""财富值档位对照表弹窗的本地校验（Playwright，无云端副作用）。"""
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
    seed['accounts'][0]['wealth'] = 1674   # 15 档
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': 2560, 'height': 1200})
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base); await pg.wait_for_timeout(900)

        btn = await pg.evaluate("()=>({has:!!document.getElementById('btnTier'),txt:document.getElementById('btnTier')?.textContent.trim()})")
        eq('顶部有「档位表」按钮', btn['has'], True, f"({btn['txt']!r})")
        await pg.click('#btnTier')
        await pg.wait_for_timeout(300)
        r = await pg.evaluate("""()=>({open:document.getElementById('tierMask').classList.contains('show'),
          rows:document.querySelectorAll('#tierBody tr').length,
          r1:document.querySelector('#tierBody tr td:nth-child(2)')?.textContent,
          p1:document.querySelector('#tierBody tr td:nth-child(3)')?.textContent,
          r21:document.querySelector('#tierBody tr:last-child td:nth-child(2)')?.textContent,
          p21:document.querySelector('#tierBody tr:last-child td:nth-child(3)')?.textContent,
          cur:document.querySelector('#tierBody tr.cur td.t-no')?.textContent.trim(),
          colored:[...document.querySelectorAll('#tierBody td.t-no span')].slice(0,3).map(x=>x.getAttribute('style').includes('hsl')),
        })""")
        eq('弹窗打开', r['open'], True)
        eq('21 行完整', r['rows'], 21)
        eq('第 1 档区间 0-0', r['r1'], '0-0', f"({r['r1']!r})")
        eq('第 1 档 +100%', r['p1'], '+100%')
        eq('第 21 档 8101+', r['r21'], '8101+')
        eq('第 21 档 +1000%', r['p21'], '+1000%')
        eq('站内最高财富(1674)所在 15 档高亮', r['cur'], '15', f"({r['cur']!r})")
        eq('档位序号带梯度色', all(r['colored']), True)
        await pg.click('#tierClose')
        await pg.wait_for_timeout(200)
        eq('关闭按钮生效', await pg.evaluate("()=>document.getElementById('tierMask').classList.contains('show')"), False)
        await pg.click('#btnTier'); await pg.wait_for_timeout(200)
        await pg.mouse.click(20, 400)   # 点 mask 空白
        await pg.wait_for_timeout(200)
        eq('点空白处关闭', await pg.evaluate("()=>document.getElementById('tierMask').classList.contains('show')"), False)

        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    raise SystemExit(1 if fail else 0)

asyncio.run(main())
