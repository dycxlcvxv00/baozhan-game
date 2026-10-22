"""内部转移规则（卖出>0 且收入=0 = 转给陌尘）端到端校验。无副作用，不碰云端。"""
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
    c = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20))
    return json.loads(base64.b64decode(c['content']).decode())

async def main():
    from playwright.async_api import async_playwright
    s, port = start_server()
    base = f'http://127.0.0.1:{port}/index-records.html'
    ok = fail = 0
    def eq(label, got, want):
        nonlocal ok, fail
        if got == want: ok += 1; print(f'  OK   {label}')
        else: fail += 1; print(f'  FAIL {label}\n        got={got!r} want={want!r}')

    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page()
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        await pg.goto(base)
        seed = cloud_data()
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base)
        await pg.wait_for_timeout(900)

        print('== 基础识别 ==')
        # 手工构造：非主号，卖出>0 收入=0 → 内部转移
        eq('主号排除', await pg.evaluate("""() => {
            const c={name:'陌尘'}, r={daySold:100,dayValue:0}; return isTransferOut(c,r); }"""), False)
        eq('非主号+0收入 = 转移', await pg.evaluate("""() => {
            const c={name:'二驴'}, r={daySold:100,dayValue:0}; return isTransferOut(c,r); }"""), True)
        eq('非主号+有收入 = 真卖', await pg.evaluate("""() => {
            const c={name:'二驴'}, r={daySold:100,dayValue:200}; return isTransferOut(c,r); }"""), False)
        eq('卖出=0 = 非转移', await pg.evaluate("""() => {
            const c={name:'二驴'}, r={daySold:0,dayValue:0}; return isTransferOut(c,r); }"""), False)

        tmap = await pg.evaluate('transferInByDate()')
        total = sum(tmap.values())
        # 与python 独立算出的真值比对
        def sd(r):
            if r.get('time','00:00:00') < '08:00:00':
                from datetime import date, timedelta
                y,m,d = map(int, r['date'].split('-')); return (date(y,m,d)-timedelta(days=1)).isoformat()
            return r['date']
        truth = {}
        for a in seed['accounts']:
            if a['name'] == '陌尘': continue
            for r in a.get('records', []):
                if (r.get('daySold') or 0) > 0 and (r.get('dayValue') or 0) == 0:
                    truth[sd(r)] = truth.get(sd(r), 0) + r['daySold']
        print(f'  转移总额: 页面={total:,}  独立计算={sum(truth.values()):,}')
        eq('转移总额与独立计算一致', total, sum(truth.values()))
        for d in sorted(truth):
            eq(f'  {d} 转入额', tmap.get(d, 0), truth[d])

        print('== 主号扣减（含跨日结转）==')
        res = await pg.evaluate("""() => {
          const mc = ACCOUNTS.find(c=>c.name==='陌尘');
          invalidateTransferPlan();
          const plan = transferPlan(mc);
          const tmap = transferInByDate();
          const out={};
          Object.keys(plan).concat(Object.keys(tmap)).filter((v,i,a)=>a.indexOf(v)===i).sort().forEach(d=>{
            const p = plan[d] || {tin:tmap[d]||0, raw:0, use:0, poolOut:0};
            const recs = groupRecordsByDate(mc)[d]||[];
            const t = recs.length ? dayTotals(mc, recs) : null;
            out[d]={ tin:p.tin, use:p.use, raw:p.raw, poolOut:p.poolOut,
                     net: t?t.gained:null, rawNoDeduct: t?t.rawGained:null };
          });
          return out;
        }""")
        print('  结算日          转入额    可扣额    结转池     陌尘当天净额')
        checked = carry = 0
        for d in sorted(res):
            v = res[d]
            if not v['tin'] and not v['use'] and v['poolOut'] == 0: continue
            net = str(v['net']) if v['net'] is not None else '无记录'
            print(f"  {d:<14}{v['tin']:>9,}{v['use']:>10,}{v['poolOut']:>10,}  {net:>14}")
            if v['net'] is not None and v['use']:
                eq(f'  {d} 扣减后 = 原始 - 可扣', v['net'], v['rawNoDeduct'] - v['use'])
                checked += 1
            if v['tin'] and not v['use']:
                carry += 1
                print(f'       ↳ 当天主号无原始获取，{v["tin"]:,} 结转到后续日期')
        print(f'  （校验 {checked} 个实际扣减日，{carry} 个结转日）')
        eq('存在结转情形（10-14 转入 31,000 当天主号无记录）',
           res.get('2026-10-14', {}).get('poolOut', 0) > 0, True)
        # 池子残留 =「已转入但主号后续还没录入」的待扣额，属正常挂账，
        # 只要它 ≤ 转移总额、且每个有原始获取的日子都把池子用尽即可。
        residue = max((v['poolOut'] for v in res.values()), default=0)
        tmap_all = await pg.evaluate('transferInByDate()')
        print(f'  待结转挂账（主号尚未录入，转入先挂着）: {residue:,} / 转移总额 {sum(tmap_all.values()):,}')
        eq('挂账 ≤ 转移总额', residue <= sum(tmap_all.values()), True)
        # 除最后一天外，凡有原始获取的日期都必须把池子用尽（不留沉淀）
        leak = [d for d, v in res.items()
                if v['raw'] > 0 and v['use'] < min(v['raw'], v['poolOut'] + v['use'])]
        eq('有获取的日子都优先用尽池子', leak, [])

        print('== 非主号绝不扣减（回归：曾漏判主号，导致全员被扣）==')
        nonmain = await pg.evaluate("""() => {
          return ACCOUNTS.filter(c=>c.name!=='陌尘').map(c=>({
            name:c.name, deduct: mainCharDeduct(c, Object.keys(transferInByDate())[0]||''),
            planKeys: Object.keys(transferPlan(c)).length
          }));
        }""")
        bad = [x['name'] for x in nonmain if x['deduct'] != 0 or x['planKeys'] != 0]
        eq('非主号扣减额恒为 0', bad, [])
        eq('非主号不生成扣减计划', sum(x['planKeys'] for x in nonmain), 0)
        # 幽竹/雷霆之怒 日获取必须 > 0（曾因误扣变成 0）
        probe = await pg.evaluate("""() => {
          const names=['幽竹','雷霆之怒','Mj','杀手皇后','凯西内尔','诺迪','诛神翼'];
          const out={};
          ACCOUNTS.filter(c=>names.indexOf(c.name)>=0).forEach(c=>{
            // 最近 10 个结算日的获取量之和（曾因误扣全部变成 0）
            const ds=[...new Set((c.records||[]).map(settleDateOf))].sort().slice(-10);
            let s=0;
            ds.forEach(d=>{ const recs=groupRecordsByDate(c)[d]||[];
              if(recs.length) s+=dayTotals(c,recs).gained; });
            out[c.name]=Math.round(s);
          });
          return out;
        }""")
        print('  近10天获取量:', probe)
        for nm in ('幽竹','雷霆之怒','Mj','杀手皇后','凯西内尔','诺迪','诛神翼'):
            eq(f'  {nm} 近10天获取 > 0', probe[nm] > 0, True)

        print('== 累计口径扣减 ==')
        cum = await pg.evaluate("""() => {
          const mc = ACCOUNTS.find(c=>c.name==='陌尘');
          const withDeduct = gained(mc);
          const tmap = transferInByDate();
          // 关掉扣减再算一次原始值
          const orig = isMainChar; // 记录当前函数
          return { gained: withDeduct, deltas: gainedDeltas(mc), tinTotal: Object.values(tmap).reduce((a,b)=>a+b,0) };
        }""")
        print(f"  主号累计获取(已扣减) = {cum['gained']:,}")
        print(f"  转移总额           = {cum['tinTotal']:,}")
        eq('单条增量恒 ≥ 0', all(x >= 0 for x in cum['deltas']), True)

        print('== 页面渲染 ==')
        has_xfer = await pg.evaluate("document.querySelectorAll('.xfer').length")
        print(f'  明细表内部转移标记数: {has_xfer}')
        eq('存在转移标记', has_xfer > 0, True)
        has_sum = await pg.evaluate("!!document.querySelector('[data-sum=\"transferIn\"]')")
        eq('汇总区有内部转移行', has_sum, True)
        await br.close()
    s.shutdown()
    print(f'\n通过 {ok} / 失败 {fail}')
    sys.exit(1 if fail else 0)

asyncio.run(main())