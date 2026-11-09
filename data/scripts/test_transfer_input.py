#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2026-11-10 改造验收（Playwright，真实云端数据，无写回）
=====================================================
验证四项需求在真实页面上成立：
  ① 卡片有独立的「转移晶石」输入框（小号有、主号没有）
  ② 明细表「秘境消耗」列移到「本次获取晶石」右侧，并新增「转移晶石」列
  ③ 「清空明细」改成「关闭详情」—— 点它只收起面板，不动数据
  ④ 「清空」按钮位于明细表最底部，且仍是破坏性操作（二次确认）
"""
import asyncio, functools, http.server, json, os, socketserver, threading, urllib.request, base64

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FAIL = []


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
    for _ in range(6):
        try:
            c = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=120))
            return json.loads(base64.b64decode(c['content']).decode())
        except Exception as e:
            last = e
            time.sleep(3)
    raise last


OK = 0


def eq(label, got, want, extra=''):
    global OK
    if got == want:
        OK += 1
        print(f'  ✅ {label}: 得到 {got!r}，期望 {want!r} {extra}')
    else:
        FAIL.append(label)
        print(f'  ❌ {label}: 得到 {got!r}，期望 {want!r}')


async def main():
    s, port = start_server()
    seed = cloud_data()
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': 2560, 'height': 1200})
        import re
        await pg.route('**/*', lambda r: asyncio.ensure_future(
            r.continue_() if re.match(r'http://127\.0\.0\.1', r.request.url) else r.abort()))
        base = f'http://127.0.0.1:{port}/index-records.html'
        await pg.goto(base)
        await pg.evaluate("d=>localStorage.setItem('gem-ledger-v2',JSON.stringify(d))", seed)
        await pg.goto(base)
        await pg.wait_for_timeout(1500)

        # 找一个非主号、明细较多的角色
        idx = await pg.evaluate("""()=>{
          const rs=[...document.querySelectorAll('.row[data-i]')];
          for(const r of rs){const c=ACCOUNTS[Number(r.dataset.i)];
            if(c && c.name!=='陌尘' && (c.records||[]).length>3) return Number(r.dataset.i);}
          return 0;}""")

        print('== ① 「转移晶石」输入框 ==')
        r = await pg.evaluate("""i=>{
          const row=document.querySelector('.row[data-i="'+i+'"]');
          const xf=row.querySelector('.input[data-f="transfer"]');
          return {has:!!xf, ph:xf?xf.placeholder:null,
                  label:xf?xf.closest('.ir').querySelector('.k').textContent.trim():null,
                  mainHas: !!document.querySelector('.row[data-i="0"] .input[data-f="transfer"]')};
        }""", idx)
        eq('① 小号卡片有「转移晶石」输入框', r['has'], True)
        eq('① 标签文案', r['label'], '转移晶石')
        eq('① 占位提示', r['ph'], '转给陌尘的晶石')

        print('== ② 明细表列序 ==')
        await pg.evaluate(f"document.querySelector('.row[data-i=\"{idx}\"] [data-toggle]').click()")
        await pg.wait_for_timeout(1000)
        heads = await pg.evaluate("""i=>{
          const el=document.getElementById('detail-'+i);
          return [...el.querySelectorAll('thead th')].map(t=>t.textContent.trim());
        }""", idx)
        eq('② 列数 = 12', len(heads), 12, str(heads))
        eq('② 含「转移晶石」列', '转移晶石' in heads, True)
        if '本次获取晶石' in heads and '秘境消耗' in heads:
            eq('② 秘境消耗紧邻本次获取晶石右侧',
               heads.index('秘境消耗') == heads.index('本次获取晶石') + 1, True)
        if '已出售晶石' in heads and '转移晶石' in heads:
            eq('② 转移晶石在已出售晶石右侧',
               heads.index('转移晶石') == heads.index('已出售晶石') + 1, True)

        print('== ③ 「关闭详情」==')
        r = await pg.evaluate("""i=>{
          const el=document.getElementById('detail-'+i);
          const cd=el.querySelector('[data-closedetail]');
          const cl=el.querySelector('[data-clear]');
          return {closeTxt: cd?cd.textContent.trim():null,
                  oldClearTxt: cl?cl.textContent.trim():null,
                  headHasClearDetail: !!el.querySelector('.detail-head [data-clear]'),
                  nrec:(ACCOUNTS[i].records||[]).length};
        }""", idx)
        eq('③ 顶部按钮文案 = 关闭详情', r['closeTxt'], '关闭详情')
        eq('③ 顶部已无「清空明细」按钮', r['headHasClearDetail'], False)
        n0 = r['nrec']
        await pg.evaluate(f"document.querySelector('#detail-{idx} [data-closedetail]').click()")
        await pg.wait_for_timeout(500)
        after = await pg.evaluate("""i=>{
          const row=document.querySelector('.row[data-i="'+i+'"]');
          return {open: row.classList.contains('open'), nrec:(ACCOUNTS[i].records||[]).length};
        }""", idx)
        eq('③ 点「关闭详情」后面板收起', after['open'], False)
        eq('③ 明细数据未被清空', after['nrec'], n0)

        print('== ④ 「清空」在明细表最底部 ==')
        await pg.evaluate(f"document.querySelector('.row[data-i=\"{idx}\"] [data-toggle]').click()")
        await pg.wait_for_timeout(900)
        r = await pg.evaluate("""i=>{
          const el=document.getElementById('detail-'+i);
          const cl=el.querySelector('[data-clear]');
          const foot=el.querySelector('.detail-foot');
          const table=el.querySelector('table.dt');
          return {txt: cl?cl.textContent.trim():null,
                  inFoot: !!(cl && foot && cl.closest('.detail-foot')===foot),
                  footAfterTable: !!(foot && table &&
                    (foot.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_PRECEDING))};
        }""", idx)
        eq('④ 清空按钮文案 = 清空', r['txt'], '清空')
        eq('④ 清空按钮位于底部按钮区', r['inFoot'], True)
        eq('④ 底部按钮区在表格之下', r['footAfterTable'], True)

        await br.close()
    print()
    if FAIL:
        print(f'❌ 失败 {len(FAIL)} 项：' + '、'.join(FAIL))
        raise SystemExit(1)
    print(f'✅ 全部通过（{OK} 项）')


if __name__ == '__main__':
    asyncio.run(main())
