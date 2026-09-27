#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打图经验台账 一键维护工具
--------------------------------------------------
子命令：
  add      追加一条打图记录（自动算 prev/gained/进度，自动改 UPDATED_AT）
  publish  提交 + 推送 + 轮询验证线上生效 + 同步 /workspace + 重生成 Excel
  excel    仅从 index-xp.html 重新生成 Excel

示例（一条命令完成录入 + 发布）：
  python3 tools/xp.py add --map "王城虫穴2层" --tier T14 --mob-lv 86 \
      --qty 0 --stones 595 --cur 567539061

  # 连续录入多条，最后一次再发布（推荐，省掉多次等待）
  python3 tools/xp.py add --map "贫民窟" --tier T14 --mob-lv 86 --qty 55 --stones 615 --cur 359939306 --no-publish
  python3 tools/xp.py add --map "破灭堡垒" --tier T12 --mob-lv 82 --qty 15 --stones 576 --cur 384179245 --no-publish
  python3 tools/xp.py publish
"""
import argparse
import hashlib
import os
import re
import subprocess
import sys
import time
from datetime import datetime

REPO      = '/root/baozhan-game'
HTML      = os.path.join(REPO, 'index-xp.html')
WORKSPACE = '/workspace'
XLSX      = os.path.join(WORKSPACE, '经验值记录表.xlsx')
URL       = 'https://dycxlcvxv00.github.io/baozhan-game/index-xp.html'
IPS       = ['185.199.108.153', '185.199.109.153', '185.199.110.153']

# GitHub Pages 的三个 CDN 节点 IP，--resolve 绕过 DNS 缓存拿到最新内容
IPS = ['185.199.108.153', '185.199.109.153', '185.199.110.153']


# ---------------- 基础读写 ----------------
def read_html():
    with open(HTML, encoding='utf-8') as f:
        return f.read()


def write_html(s):
    with open(HTML, 'w', encoding='utf-8') as f:
        f.write(s)


def parse_records(html):
    """解析 XP_RECORDS 数组"""
    m = re.search(r'const XP_RECORDS\s*=\s*\[(.*?)\n\s*\];', html, re.S)
    if not m:
        sys.exit('[ERROR] 未找到 XP_RECORDS 数组')
    recs = []
    for blk in re.findall(r'\{(.*?)\}', m.group(1), re.S):
        d = {}
        for k, v in re.findall(r"(\w+)\s*:\s*('[^']*'|[\d.]+|true|false|null)", blk):
            if v.startswith("'"):
                d[k] = v[1:-1]
            elif v == 'true':
                d[k] = True
            elif v == 'false':
                d[k] = False
            elif v == 'null':
                d[k] = None
            else:
                d[k] = int(v)
        recs.append(d)
    return recs, m


def level_total(html):
    return int(re.search(r'const LEVEL_TOTAL\s*=\s*([\d_]+)', html).group(1).replace('_', ''))


def fmt(n):
    return '{:,}'.format(n)


def sha256_of(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def sha256_text(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()


# ---------------- 语法检查 ----------------
def node_check():
    html = read_html()
    blocks = re.findall(r'<script[^>]*>(.*?)</script>', html, re.S)
    main = max(blocks, key=len)
    tmp = '/tmp/_xp_check.js'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(main)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('[ERROR] JS 语法检查失败：\n' + r.stderr)
    return True


# ---------------- add ----------------
def cmd_add(a):
    html = read_html()
    recs, m = parse_records(html)
    if not recs:
        sys.exit('[ERROR] 没有既有记录，无法推断 prev')
    last = recs[-1]
    prev = last['cur']

    if a.cur <= prev and not a.force:
        sys.exit('[ERROR] 当前经验值 %s 不大于上一条 %s，若确需强制写入请加 --force'
                 % (fmt(a.cur), fmt(prev)))

    dt    = a.time or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    role  = a.role or last.get('role', '陌尘')
    level = a.level or last.get('level', 86)
    qty   = 'null' if a.qty is None else str(a.qty)
    stone = 'null' if a.stones is None else str(a.stones)
    p50   = 'true' if a.pot50 else 'false'
    p20   = 'true' if a.pot20 else 'false'

    block = ("\n  { dt:'%s', role:'%s', level:%d,\n"
             "    map:'%s', tier:'%s', mobLv:%d, mobQty:%s,\n"
             "    pot50:%s, pot20:%s, stones:%s,\n"
             "    prev:%d, cur:%d, note:'%s' },\n"
             % (dt, role, level, a.map, a.tier, a.mob_lv, qty, p50, p20, stone,
                prev, a.cur, a.note or ''))

    arr = m.group(0)
    idx = arr.rfind('];')
    new_arr = arr[:idx] + block + '];'
    html = html[:m.start()] + new_arr + html[m.end():]

    # UPDATED_AT 同步为本次时刻
    html2 = re.sub(r"(const UPDATED_AT\s*=\s*')[^']*(')",
                   r"\g<1>" + dt[:16] + r"\g<2>", html)
    if html2 == html:
        print('[WARN] 未找到/未改动 UPDATED_AT')
    html = html2

    write_html(html)
    node_check()

    total = level_total(html)
    gained = a.cur - prev
    print('[OK] 已追加 #%d  %s  %s %s  怪物%d级 +%s%%  晶石%s' %
          (len(recs) + 1, dt, a.tier, a.map, a.mob_lv,
           a.qty if a.qty is not None else 0,
           a.stones if a.stones is not None else 0))
    print('     上次 %s → 当前 %s  获得 +%s (%.4f%%)  进度 %.4f%%'
          % (fmt(prev), fmt(a.cur), fmt(gained),
             gained / total * 100, a.cur / total * 100))

    if not a.no_publish:
        cmd_publish(argparse.Namespace(msg=a.msg, wait=not a.no_wait))


# ---------------- 线上校验 ----------------
def fetch_online():
    for ip in IPS:
        try:
            r = subprocess.run(
                ['curl', '-s', '--max-time', '20', '--resolve',
                 'dycxlcvxv00.github.io:443:' + ip, URL],
                capture_output=True, text=True)
            if r.returncode == 0 and r.stdout.strip():
                return r.stdout
        except Exception:
            pass
    return None


def wait_online(fingerprint, timeout=150, interval=12):
    """轮询直到线上出现新内容指纹；返回 (是否成功, 耗时秒)"""
    local = sha256_of(HTML)
    t0 = time.time()
    tried = 0
    while time.time() - t0 < timeout:
        tried += 1
        txt = fetch_online()
        if txt:
            if fingerprint and fingerprint in txt:
                return True, round(time.time() - t0, 1), sha256_text(txt) == local
            if sha256_text(txt) == local:
                return True, round(time.time() - t0, 1), True
        time.sleep(interval)
    return False, round(time.time() - t0, 1), False


# ---------------- publish ----------------
def cmd_publish(a):
    html = read_html()
    recs, _ = parse_records(html)
    last = recs[-1]
    fingerprint = str(last['cur'])

    subprocess.run(['git', 'add', '-A'], cwd=REPO, check=True)
    msg = a.msg or ('经验台账：新增第%d条 %s%s 怪物%d级 晶石%s 进度%.4f%%' % (
        len(recs), last.get('tier', ''), last.get('map', ''),
        last.get('mobLv', 0), last.get('stones'), last['cur'] / level_total(html) * 100))
    r = subprocess.run(['git', 'commit', '-m', msg], cwd=REPO,
                       capture_output=True, text=True)
    if 'nothing to commit' in r.stdout:
        print('[INFO] 无改动可提交')
    else:
        print('[OK] commit:', msg)

    p = subprocess.run(['git', 'push'], cwd=REPO, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit('[ERROR] push 失败：\n' + p.stderr)
    print('[OK] 已 push')

    if getattr(a, 'wait', True):
        print('[..] 等待 Pages 生效（轮询，最长 150s）')
        ok, sec, same = wait_online(fingerprint)
        if ok:
            print('[OK] 线上已生效，用时 %ss，内容%s本地' % (sec, '一致于' if same else '部分差异于'))
        else:
            print('[WARN] %ss 内未确认生效，请稍后手动 Ctrl+F5 检查（Pages/CDN 偶发延迟）' % sec)
    else:
        print('[INFO] 跳过等待，约 30-60s 后生效')

    # 同步到工作区 + 重生成 Excel
    import shutil
    shutil.copy(HTML, os.path.join(WORKSPACE, 'index-xp.html'))
    cmd_excel(argparse.Namespace(quiet=False))
    print('[OK] 已同步 /workspace/index-xp.html 与 Excel')


# ---------------- excel ----------------
def cmd_excel(a):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    html = read_html()
    recs, _ = parse_records(html)
    total = level_total(html)

    wb = Workbook()
    ws = wb.active
    ws.title = '经验记录'
    headers = ['序号', '日期时间', '角色', '角色等级', '地图名称', '地图阶级', '地图怪物等级',
               '怪物数量%', '经验药水50%', '经验药水20%', '晶石掉落',
               '上次经验值', '当前经验值', '本图获得经验值',
               '本图获得经验占当前等级%', '当前等级总经验', '当前等级累计进度%', '备注']
    hf = PatternFill('solid', fgColor='4F6228')
    hfont = Font(bold=True, color='FFFFFF', size=11)
    thin = Side(style='thin', color='B0B0B0')
    bd = Border(left=thin, right=thin, top=thin, bottom=thin)
    ct = Alignment(horizontal='center', vertical='center', wrap_text=True)

    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill, cell.font, cell.alignment, cell.border = hf, hfont, ct, bd

    for i, r in enumerate(recs, start=2):
        gained = r['cur'] - r['prev']
        ws.append([i - 1, r['dt'], r.get('role', ''), r.get('level', ''), r.get('map', ''),
                   r.get('tier', ''), r.get('mobLv', ''),
                   r['mobQty'] if r.get('mobQty') is not None else '—',
                   '✓' if r.get('pot50') else '—',
                   '✓' if r.get('pot20') else '—',
                   r['stones'] if r.get('stones') is not None else '—',
                   r['prev'], r['cur'], gained,
                   gained / total, total, r['cur'] / total, r.get('note', '')])
        for c in range(1, len(headers) + 1):
            ws.cell(row=i, column=c).border = bd
            ws.cell(row=i, column=c).alignment = ct
        ws.cell(row=i, column=2).number_format = 'yyyy-mm-dd hh:mm:ss'
        for c in (13, 14, 15, 17):
            ws.cell(row=i, column=c).number_format = '#,##0'
        ws.cell(row=i, column=16).number_format = '0.0000%'
        ws.cell(row=i, column=18).number_format = '0.0000%'
        for c in (9, 10):
            ws.cell(row=i, column=c).font = Font(bold=True, size=12)
        if i % 2 == 0:
            for c in range(1, len(headers) + 1):
                ws.cell(row=i, column=c).fill = PatternFill('solid', fgColor='EBF1DE')

    for idx, w in enumerate([6, 20, 8, 9, 15, 9, 13, 11, 12, 12, 10, 16, 16, 16, 15, 16, 15, 12], start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w
    ws.freeze_panes = 'A2'
    ws.row_dimensions[1].height = 30

    ws2 = wb.create_sheet('说明')
    notes = [
        '经验值记录表 · 使用说明（由 tools/xp.py 从 index-xp.html 自动生成，勿手工编辑）',
        '',
        '1. 每次打完一张地图，发送游戏截图，AI 读取地图阶级名字、怪物等级、当前经验值后追加记录。',
        '2. 日期时间为打完图统计时刻，精确到分秒。',
        '3. 本图获得经验值 = 当前经验值 − 上次经验值。',
        '4. 获得经验占当前等级% = 本图获得经验值 ÷ 当前等级总经验。',
        '5. 当前等级累计进度% = 当前经验值 ÷ 当前等级总经验，与游戏经验条 Exp% 一致。',
        '6. 怪物数量% = 该图怪物数量加成总和；晶石掉落 = 本次地图掉落的晶石数量。',
        '7. 86级升级所需总经验为 1,999,268,000；升级后请以新等级的总经验重新计算。',
        '8. 第1条记录为 86 级首张统计图，即 T14 祭祀礼堂，起点经验按 0 计。',
        '9. 经验药水50% / 经验药水20% 两列：使用了填 ✓，未使用显示 —；备注默认留空。',
        '10. 结算日按每天 08:00 分界：08:00 前的记录归前一天。',
    ]
    for r, line in enumerate(notes, start=1):
        cell = ws2.cell(row=r, column=1, value=line)
        if r == 1:
            cell.font = Font(bold=True, size=13)
    ws2.column_dimensions['A'].width = 100

    wb.save(XLSX)
    if not getattr(a, 'quiet', False):
        print('[OK] Excel 已生成：%s（%d 条）' % (XLSX, len(recs)))


# ---------------- main ----------------
def main():
    ap = argparse.ArgumentParser(description='打图经验台账一键维护')
    sub = ap.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('add', help='追加一条记录')
    p.add_argument('--map', required=True)
    p.add_argument('--tier', required=True, help='如 T14')
    p.add_argument('--mob-lv', required=True, type=int)
    p.add_argument('--qty', type=int, default=None, help='怪物数量%%（如 15），无则留空')
    p.add_argument('--stones', type=int, default=None)
    p.add_argument('--cur', required=True, type=int, help='当前经验值')
    p.add_argument('--time', default=None, help='统计时刻，默认取当前时间')
    p.add_argument('--role', default=None)
    p.add_argument('--level', type=int, default=None)
    p.add_argument('--pot50', action='store_true')
    p.add_argument('--pot20', action='store_true')
    p.add_argument('--note', default='')
    p.add_argument('--force', action='store_true')
    p.add_argument('--no-publish', action='store_true', help='只写本地，不提交发布')
    p.add_argument('--no-wait', action='store_true', help='推送后不等待线上生效')
    p.add_argument('--msg', default=None, help='自定义 commit 信息')
    p.set_defaults(func=cmd_add)

    p = sub.add_parser('publish', help='提交+推送+验证+同步')
    p.add_argument('--msg', default=None)
    p.add_argument('--no-wait', action='store_true')
    p.set_defaults(func=cmd_publish)

    p = sub.add_parser('excel', help='仅重新生成 Excel')
    p.set_defaults(func=cmd_excel)

    a = ap.parse_args()
    a.func(a)


if __name__ == '__main__':
    main()
