"""代练单价分档校验：2026-10-27 结算日起 15 → 10 元/天，历史日期仍按 15。
无副作用 —— 本地静态服务 + 拦截外部请求，只读云端数据。"""
import asyncio, json, os, re, sys, time, functools, http.server, threading, socketserver, urllib.request, base64

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FROM = '2026-10-27'

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
    for _ in range(5):
        try:
            c = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60))
            return json.loads(base64.b64decode(c['content']).decode())
        except Exception as e:
            last = e; time.sleep(1.5)
    raise last

def settle(r):
    if r.get('time', '00:00:00') < '08:00:00':
        from datetime import date, timedelta
        y, m, d = map(int, r['date'].split('-')); return (date(y, m, d) - timedelta(days=1)).isoformat()
    return r['date']

async def main():
    from playwright.async_api import async_playwright
    s, port = start_server()
    base = f'http://127.0.0.1:{port}/index-records.html'
    ok = fail = 0
    def eq(label, got, want, extra=''):
        nonlocal ok, fail
        if got == want: ok += 1; print(f'  OK   {label}  {extra}')
        else:           fail += 1; print(f'  FAIL {label}\n        got={got!r} want={want!r}')

    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': 2560, 'height': 1200})
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        seed = cloud_data()
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base)
        await pg.wait_for_timeout(900)

        print('== 单价分档 ==')
        for d, want in [('2026-09-30', 15), ('2026-10-01', 15), ('2026-10-25', 15),
                        ('2026-10-26', 15), ('2026-10-27', 10), ('2026-10-28', 10),
                        ('2026-11-01', 10), ('2027-01-01', 10)]:
            got = await pg.evaluate("d=>laborRate(d)", d)
            eq(f'laborRate({d})', got, want)

        print('== 单角色按天计费 ==')
        r = await pg.evaluate("""() => {
          const c1 = {name:'甲', laborDays:['2026-10-26','2026-10-27']};
          const c2 = {name:'乙', laborAll:true, laborOff:[]};
          const c3 = {name:'丙', laborAll:true, laborOff:['2026-10-27']};
          const c4 = {name:'丁', laborDays:[]};
          return {
            normal26: laborOfDay(c1,'2026-10-26'), normal27: laborOfDay(c1,'2026-10-27'),
            all26: laborOfDay(c2,'2026-10-26'),   all27: laborOfDay(c2,'2026-10-27'),
            off27: laborOfDay(c3,'2026-10-27'),   off26: laborOfDay(c3,'2026-10-26'),
            none27: laborOfDay(c4,'2026-10-27')
          };
        }""")
        eq('普通卡 10-26 勾选', r['normal26'], 15)
        eq('普通卡 10-27 勾选', r['normal27'], 10)
        eq('默认代练卡 10-26',  r['all26'], 15)
        eq('默认代练卡 10-27',  r['all27'], 10)
        eq('默认代练卡 10-27 取消', r['off27'], 0)
        eq('默认代练卡 10-26 未取消', r['off26'], 15)
        eq('未勾选 10-27', r['none27'], 0)

        print('== 与 Python 独立计算比对（真实云端数据）==')
        # 页面侧：每个角色在指定结算日的人工费
        page = await pg.evaluate("""days => {
          const out = {};
          days.forEach(d => out[d] = ACCOUNTS.reduce((s,c)=> s + laborOfDay(c,d), 0));
          return out;
        }""", ['2026-10-25', '2026-10-26', '2026-10-27'])
        truth = {}
        for d in ['2026-10-25', '2026-10-26', '2026-10-27']:
            tot = 0
            for a in seed['accounts']:
                if d >= FROM:
                    on = (not a.get('laborOff') or d not in a['laborOff']) if a.get('laborAll') else (d in (a.get('laborDays') or []))
                    rate = 10
                else:
                    on = True if a.get('laborAll') else (d in (a.get('laborDays') or []))
                    if a.get('laborAll') and d in (a.get('laborOff') or []): on = False
                    rate = 15
                if on: tot += rate
            truth[d] = tot
        for d in ['2026-10-25', '2026-10-26', '2026-10-27']:
            eq(f'{d} 结算日全部角色人工费', page[d], truth[d], f'(页面 {page[d]} / 独立算 {truth[d]})')

        print('== 历史不被回溯改写 ==')
        hist = await pg.evaluate("""() => {
          /* 找一个 10-25 有代练的角色，其累计人工费应含 15 元档 */
          const c = ACCOUNTS.find(x => (x.laborDays||[]).indexOf('2026-10-25') >= 0);
          if(!c) return null;
          return { name:c.name, d25: laborOfDay(c,'2026-10-25'), d27: laborOfDay(c,'2026-10-27'), total: totals(c).laborCost };
        }""")
        if hist:
            eq('该角色 10-25 仍按 15', hist['d25'], 15, f"({hist['name']})")
            print(f"       {hist['name']} 累计人工费 {hist['total']} 元（含 15 元档历史）")
        else:
            print('  --   无 10-25 代练角色，跳过')

        print('== 界面文案跟随新单价 ==')
        ui = await pg.evaluate("""() => {
          /* 按结算日取每个面板的代练标签，验证「该显示 10 的显示 10、该显示 15 的显示 15」 */
          const byDay = [];
          document.querySelectorAll('.daysect').forEach(sec => {
            const el = sec.querySelector('.dayHead .d-date');
            const lb = sec.querySelector('.labor-row .lr-label');
            if(el && lb) byDay.push({ day: el.textContent.trim().slice(-5), label: lb.textContent.trim() });
          });
          const titles = [...new Set([...document.querySelectorAll('td[title*="代练费按天计"]')]
                          .map(e => e.getAttribute('title')))];
          return { byDay: byDay, titles: titles };
        }""")
        print('       各结算日面板标签:')
        for x in ui['byDay']:
            print(f"         {x['day']}  {x['label']}")
        want = {d: ('10/天' if d >= '10-27' else '15/天') for d in set(x['day'] for x in ui['byDay'])}
        for x in ui['byDay']:
            eq(f"面板 {x['day']} 单价", x['label'].count(want[x['day']]), 1, f"({x['label']})")
        eq('10-27 面板已切到 10/天', any('10/天' in x['label'] and x['day'] >= '10-27' for x in ui['byDay']), True)
        eq('10-26 面板保持 15/天',  any('15/天' in x['label'] and x['day'] == '10-26' for x in ui['byDay']), True)
        print(f"       明细 title: {ui['titles']}")
        eq('明细 title 出现 10/天', any('（10/天）' in t for t in ui['titles']), True)
        eq('明细 title 仍保留历史 15/天', any('（15/天）' in t for t in ui['titles']), True)

        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    return 1 if fail else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
