"""每日信息「转移数量」校验：标题行 收入·支出 之后追加当日内部转移晶石量。
无副作用 —— 本地静态服务 + 拦截外部请求，只读云端数据。"""
import asyncio, json, os, re, sys, time, functools, http.server, threading, socketserver, urllib.request, base64
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAIN = '陌尘'

def start_server():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    s = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]

def cloud_data():
    tok = open(os.path.join(ROOT, '.gh_token')).read().strip()
    H = {"Authorization": "Bearer " + tok, "User-Agent": "curl"}
    u = "https://api.github.com/repos/dycxlcvxv00/baozhan-data/contents/data.json"
    last = None
    for _ in range(6):
        try:
            c = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=90))
            return json.loads(base64.b64decode(c['content']).decode())
        except Exception as e:
            last = e; time.sleep(2)
    raise last

def settle(r):
    if r.get('time', '00:00:00') < '08:00:00':
        y, m, d = map(int, r['date'].split('-')); return (date(y, m, d) - timedelta(days=1)).isoformat()
    return r['date']

def truth_xfer(seed):
    """独立算一遍：非主号「卖出>0 且收入=0」的晶石量，按结算日汇总"""
    out = {}
    for a in seed['accounts']:
        if (a.get('name') or '') == MAIN: continue
        for r in a.get('records') or []:
            if (r.get('daySold') or 0) > 0 and (r.get('dayValue') or 0) == 0:
                k = settle(r); out[k] = out.get(k, 0) + int(r.get('daySold') or 0)
    return out

def tonum(t):
    return int(str(t).replace(',', '')) if t is not None else None

async def main():
    from playwright.async_api import async_playwright
    s, port = start_server()
    base = f'http://127.0.0.1:{port}/index-records.html'
    ok = fail = 0
    def eq(label, got, want, extra=''):
        nonlocal ok, fail
        if got == want: ok += 1; print(f'  OK   {label}  {extra}')
        else:           fail += 1; print(f'  FAIL {label}\n        got={got!r} want={want!r}')

    seed = cloud_data()
    truth = truth_xfer(seed)
    main_days = {settle(r) for a in seed['accounts']
                 if (a.get('name') or '') == MAIN for r in a.get('records') or []}

    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': 2560, 'height': 1200})
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base)
        await pg.wait_for_timeout(900)

        ui = await pg.evaluate("""() => [...document.querySelectorAll('.daysect')].map(sec => {
            const b = sec.querySelector('.dayHead .d-sum b.xf');
            return { day: sec.getAttribute('data-day'),
                     txt: b ? b.textContent.trim() : null,
                     zero: b ? b.classList.contains('zero') : null };
        })""")

        print('== 字段存在性 ==')
        eq('每个结算日标题都有「转移」', all(x['txt'] is not None for x in ui), True, f"(共 {len(ui)} 天)")

        print('== 数值对账（页面 vs Python 独立计算）==')
        bad = []
        for x in ui:
            want = truth.get(x['day'], 0)
            if tonum(x['txt']) != want: bad.append((x['day'], x['txt'], want))
            if (want == 0) != bool(x['zero']): bad.append((x['day'], 'zero-class', x['zero']))
        eq('逐日转移量一致', len(bad), 0, f"(不一致 {len(bad)} 项 {bad[:3]})")
        eq('非零天数与真值一致', sum(1 for x in ui if not x['zero']), len([v for v in truth.values() if v > 0]),
           f"(页面 {sum(1 for x in ui if not x['zero'])} 天 / 真值 {len([v for v in truth.values() if v>0])} 天)")

        print('== 陌尘未录入的日子也要显示（回归：不能挂在角色循环里）==')
        orphan = [d for d, v in truth.items() if v > 0 and d not in main_days]
        shown = [x for x in ui if x['day'] in orphan]
        eq('主号无记录日仍显示转移', len(shown) == len(orphan) and all(tonum(x['txt']) > 0 for x in shown), True,
           f"(涉及 {len(orphan)} 天 {orphan[:4]})")

        print('== 近 6 天标题摘要 ==')
        for x in ui[:6]:
            full = await pg.evaluate("""d => { const s=[...document.querySelectorAll('.daysect')]
                .find(e => e.getAttribute('data-day')===d);
                return s.querySelector('.dayHead .d-sum').textContent.trim(); }""", x['day'])
            print(f"     {x['day']}  {full}")

        print('== 布局不破版 ==')
        for w in (2560, 1280, 900, 560):
            await pg.set_viewport_size({'width': w, 'height': 1000})
            await pg.wait_for_timeout(400)
            m = await pg.evaluate("""() => { const h=document.querySelector('.dayHead');
                const a=h.querySelector('.d-arrow').getBoundingClientRect();
                const box=h.getBoundingClientRect();
                return { arrowIn: a.right <= box.right+1 && a.width>0,
                         overflow: document.body.scrollWidth > window.innerWidth+1 }; }""")
            eq(f'{w}px 箭头未被挤出', m['arrowIn'], True)
            eq(f'{w}px 无横向溢出', m['overflow'], False)

        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    return 1 if fail else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
