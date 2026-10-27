"""宽屏布局校验：21:9 带鱼屏下每个代练一行能排下 8 张卡。
无副作用 —— 只读云端数据、本地起静态服务、拦截所有外部请求。"""
import asyncio, json, os, re, sys, functools, http.server, threading, socketserver, urllib.request, base64

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def start_server():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    s = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]

def cloud_data():
    tok = open(os.path.join(ROOT, '.gh_token')).read().strip()
    H = {"Authorization": "Bearer " + tok, "User-Agent": "curl"}
    u = "https://api.github.com/repos/dycxlcvxv00/baozhan-data/contents/data.json"
    import time
    last = None
    for _ in range(5):          # 大文件偶尔 IncompleteRead，重试几次
        try:
            c = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60))
            return json.loads(base64.b64decode(c['content']).decode())
        except Exception as e:
            last = e; time.sleep(1.5)
    raise last

async def measure(pg):
    return await pg.evaluate("""() => {
      const q = s => document.querySelector(s);
      const tracks = el => getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length;
      const wrap = q('.wrap');
      const card = q('#cards .vcard');
      const day = q('.dayBody');
      return {
        wrap: Math.round(wrap.getBoundingClientRect().width),
        wrapPad: Math.round(wrap.getBoundingClientRect().width - parseFloat(getComputedStyle(wrap).paddingLeft) - parseFloat(getComputedStyle(wrap).paddingRight)),
        cols: tracks(q('#cards')),
        cardW: card ? Math.round(card.getBoundingClientRect().width) : 0,
        dayCols: day ? tracks(day) : 0,
        cards: document.querySelectorAll('#cards .vcard').length,
        gapPx: Math.round(window.innerWidth - wrap.getBoundingClientRect().width)
      };
    }""")

async def main():
    from playwright.async_api import async_playwright
    s, port = start_server()
    base = f'http://127.0.0.1:{port}/index-records.html'
    ok = fail = 0
    def check(label, cond, detail=''):
        nonlocal ok, fail
        if cond: ok += 1; print(f'  OK   {label}  {detail}')
        else:    fail += 1; print(f'  FAIL {label}  {detail}')

    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width':1600,'height':900})
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        seed = cloud_data()
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)

        # 预期：视口宽 -> 每行列数 / 卡片宽度下限
        cases = [
            (1600,  6, 220),   # 默认档（1090p / 16:9 1080p 全屏）
            (1920,  7, 220),   # 1080p 常见宽屏
            (2560,  8, 240),   # 21:9 带鱼屏 2560x1080 ← 用户场景
            (3440, 12, 240),   # 21:9 带鱼屏 3440x1440
        ]
        print('== 宽屏列数 / 卡片宽度 ==')
        for w, wantCols, minCard in cases:
            await pg.set_viewport_size({'width': w, 'height': 1000})
            await pg.goto(base)
            await pg.wait_for_timeout(700)
            m = await measure(pg)
            info = f"[视口{w}] 内容区{m['wrapPad']}px 卡片{m['cardW']}px 卡牌数{m['cards']} 日面板{m['dayCols']}列 两侧留白{m['gapPx']}px"
            check(f'{w}px → {wantCols} 列', m['cols'] == wantCols, f'(实测{m["cols"]}列) {info}')
            check(f'{w}px 卡片不被挤扁(>={minCard}px)', m['cardW'] >= minCard, f'(实测{m["cardW"]}px)')
            check(f'{w}px 不再留大片空白(<260px/侧)', m['gapPx'] < 260, f'(实测{m["gapPx"]}px)')

        print('== 窄屏回归（不能改坏）==')
        for w, wantCols in [(1440, 4), (960, 2), (480, 1)]:
            await pg.set_viewport_size({'width': w, 'height': 900})
            await pg.goto(base)
            await pg.wait_for_timeout(600)
            m = await measure(pg)
            check(f'{w}px → {wantCols} 列', m['cols'] == wantCols, f'(实测{m["cols"]}列, 卡片{m["cardW"]}px)')

        print('== 全屏模式仍铺满 ==')
        await pg.set_viewport_size({'width':2560,'height':1080})
        await pg.goto(base); await pg.wait_for_timeout(600)
        await pg.evaluate("document.body.classList.add('fs')")
        await pg.wait_for_timeout(300)
        m = await measure(pg)
        check('全屏内容区撑满', m['wrap'] >= 2560 - 4, f'(实测{m["wrap"]}px, {m["cols"]}列, 卡片{m["cardW"]}px)')


        print('== 核心诉求：同一代练一行排满 8 张 ==')
        await pg.set_viewport_size({'width':2560,'height':1080})
        await pg.goto(base); await pg.wait_for_timeout(800)
        geo = await pg.evaluate("""() => {
          const cards=[...document.querySelectorAll('#cards .vcard')];
          const g=[];
          let cur=null;
          [...document.querySelectorAll('#cards > *')].forEach(el=>{
            if(el.classList.contains('gbar')){ cur={name:(el.querySelector('.gn')||{}).textContent||'(未分组)',cards:[]}; g.push(cur); }
            else if(el.classList.contains('row')){ const v=el.querySelector('.vcard'); if(cur&&v) cur.cards.push(v); }
          });
          g.forEach(x=>{
            const tops=[...new Set(x.cards.map(c=>Math.round(c.getBoundingClientRect().top)))].sort((a,b)=>a-b);
            x.rows=tops.map(t=>x.cards.filter(c=>Math.round(c.getBoundingClientRect().top)===t).length);
          });
          const big=g.slice().sort((a,b)=>b.cards.length-a.cards.length)[0];
          const last=g[g.length-1];
          return { groups:g.map(x=>({name:x.name,n:x.cards.length,rows:x.rows})), biggest:big&&big.name, bigRows:big&&big.rows, lastRow:last&&last.rows };
        }""")
        print('   代练分组情况（2560px / 8列）:')
        for x in geo['groups']:
            print(f"     {x['name']:<12} {x['n']:>2} 个角色 → 每行的卡片数 {x['rows']}")
        check('分组首行 = min(角色数, 8)', all(x['rows'][0] == min(x['n'], 8) for x in geo['groups']), f"({[(x['name'],x['n'],x['rows'][0]) for x in geo['groups']]})")
        check('每个分组都从新行第 1 列起排', all(x['rows'][0] == min(x['n'], 8) for x in geo['groups']),
              f"(各组首行: {[x['rows'][0] for x in geo['groups']]})")


        print('== 构造 8 角色同组：必须一行排满 8 张 ==')
        import copy
        seed8 = copy.deepcopy(seed)
        for a in seed8['accounts'][:8]:
            a['broker'] = '压力测试-1'
            a['order'] = ''
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed8)
        await pg.goto(base); await pg.wait_for_timeout(800)
        r8 = await pg.evaluate("""() => {
          const g=[]; let cur=null;
          [...document.querySelectorAll('#cards > *')].forEach(el=>{
            if(el.classList.contains('gbar')){ cur=[]; g.push({name:(el.querySelector('.gn')||{}).textContent, cards:cur}); }
            else if(el.classList.contains('row')){ const v=el.querySelector('.vcard'); if(cur&&v) cur.push(v); }
          });
          const t=g.find(x=>x.cards.length>=8);
          if(!t) return {found:false, sizes:g.map(x=>x.cards.length)};
          const tops=[...new Set(t.cards.map(c=>Math.round(c.getBoundingClientRect().top)))];
          return {found:true, rows:tops.map(tp=>t.cards.filter(c=>Math.round(c.getBoundingClientRect().top)===tp).length)};
        }""")
        check('存在 ≥8 角色的分组', r8.get('found'), f"(各组角色数 {r8.get('sizes')})")
        if r8.get('found'):
            check('8 角色组排成一整行（无折行）', r8['rows'] == [8], f"(每行张数 {r8['rows']})")
            await pg.screenshot(path='width-2560-8cols.png', full_page=False)
            print('   截图已存 data/scripts/width-2560-8cols.png')

        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    return 1 if fail else 0

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
