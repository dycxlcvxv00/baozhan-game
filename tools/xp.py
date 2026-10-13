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
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

# 仓库位置：沙箱里 /root/baozhan-game 会被拦，改用 /workspace/baozhan-game
REPO_CANDIDATES = ['/root/baozhan-game', '/workspace/baozhan-game']
REPO      = next((p for p in REPO_CANDIDATES if os.path.isdir(p)), REPO_CANDIDATES[-1])
HTML      = os.path.join(REPO, 'index-xp.html')
WORKSPACE = '/workspace'
XLSX      = os.path.join(WORKSPACE, '经验值记录表.xlsx')
URL       = 'https://dycxlcvxv00.github.io/baozhan-game/index-xp.html'

# 各等级升级总经验（升级时新增一行；与 index-xp.html 的 LEVEL_TOTALS 保持一致）
LT_MAP = {86: 1999268000, 87: 2125066400, 88: 2260637300, 89: 2396208200, 90: 2697170100}

# GitHub Pages 的 CDN 节点 IP，--resolve 绕过 DNS 缓存拿到最新内容
IPS = ['185.199.108.153', '185.199.109.153', '185.199.110.153']

# ---------------- 云端（唯一权威数据源） ----------------
# 数据住baozhan-data/xp.json（私有仓库），页面与本脚本都读写这一份。
# HTML 里的 XP_SEED 只是首次访问时的兜底种子，运行期不再被写入。
DATA_OWNER = 'dycxlcvxv00'
DATA_REPO  = 'baozhan-data'
DATA_PATH  = 'xp.json'
DATA_BRANCH= 'main'
DATA_API   = 'https://api.github.com/repos/%s/%s/contents/%s' % (
    DATA_OWNER, DATA_REPO, DATA_PATH)
TOKEN_FILE = os.path.join(REPO, '.gh_token')


def get_token():
    """令牌查找顺序：环境变量 > .gh_token 文件。
    绝不写进 HTML 或任何会被 git 跟踪的文件。"""
    t = os.environ.get('BAOZHAN_TOKEN', '').strip()
    if t:
        return t
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, encoding='utf-8') as f:
            return f.read().strip()
    return ''


def _api(method, body=None, need_sha=False):
    tok = get_token()
    if not tok:
        sys.exit('[ERROR] 未找到令牌。请设置环境变量 BAOZHAN_TOKEN，'
                 '或把令牌写入 %s' % TOKEN_FILE)
    h = {'Authorization': 'Bearer ' + tok,
         'Accept': 'application/vnd.github+json',
         'Content-Type': 'application/json'}
    req = urllib.request.Request(DATA_API, headers=h, method=method,
                                 data=json.dumps(body).encode() if body else None)
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:300]
        sys.exit('[ERROR] GitHub API %s：%s\n%s' % (method, e.code, detail))


def cloud_pull():
    """拉云端数据 -> (data_dict, sha)。文件不存在返回 (None, '')。"""
    tok = get_token()
    h = {'Authorization': 'Bearer ' + tok, 'Accept': 'application/vnd.github+json'}
    try:
        j = json.load(urllib.request.urlopen(
            urllib.request.Request(DATA_API + '?t=%d' % int(time.time() * 1000),
                                   headers=h), timeout=30))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, ''
        sys.exit('[ERROR] 拉取云端失败：%s %s' % (e.code, e.read().decode('utf-8', 'ignore')[:200]))
    data = json.loads(base64.b64decode(j['content']).decode('utf-8'))
    return data, j['sha']


def cloud_push(data, sha, msg):
    """整份覆盖推送。sha 缺省 = 新建文件。"""
    txt = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    body = {'message': msg,
            'content': base64.b64encode(txt.encode('utf-8')).decode(),
            'branch': DATA_BRANCH}
    if sha:
        body['sha'] = sha
    _api('PUT', body)


def cloud_save(records, msg):
    """把记录列表整份写回云端，自动带上摘要字段。"""
    data, sha = cloud_pull()
    if data is None:
        data = {'v': 1, 'records': []}
    data['v'] = 1
    data['records'] = records
    data['savedAt'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + \
        '%03dZ' % (datetime.now(timezone.utc).microsecond // 1000)
    data['updatedBy'] = 'xp.py'
    data['count'] = len(records)
    data['totalStones'] = sum(r.get('stones') or 0 for r in records)
    if records:
        data['role'] = records[-1].get('role', '')
        data['level'] = records[-1].get('level', 0)
    cloud_push(data, sha, msg)
    return data


def cloud_records():
    """取云端记录；云端为空时回退到 HTML 里的种子数据。"""
    data, sha = cloud_pull()
    if data and data.get('records'):
        return data['records'], sha, True
    return parse_records(read_html())[0], '', False


# ---------------- 基础读写 ----------------
def read_html():
    with open(HTML, encoding='utf-8') as f:
        return f.read()


def write_html(s):
    with open(HTML, 'w', encoding='utf-8') as f:
        f.write(s)


def parse_records(html):
    """解析 XP_SEED 数组（兼容旧变量名 XP_RECORDS）"""
    m = re.search(r'const XP_SEED\s*=\s*\[(.*?)\n\s*\];', html, re.S) \
        or re.search(r'const XP_RECORDS\s*=\s*\[(.*?)\n\s*\];', html, re.S)
    if not m:
        sys.exit('[ERROR] 未找到 XP_SEED / XP_RECORDS 数组')
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
    """当前（最新）等级的升级总经验：优先取 LEVEL_TOTALS 映射的最后一个条目"""
    m = re.search(r'const LEVEL_TOTALS\s*=\s*\{([^}]*)\}', html)
    if m:
        pairs = re.findall(r'(\d+)\s*:\s*(\d+)', m.group(1))
        if pairs:
            return int(pairs[-1][1])
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
    """追加一条记录。数据源与写入目标都是云端 xp.json ——
       页面录入和我在这里录入走的是同一份数据、同一套接口，
       所以两边任意一侧修改都不会互相覆盖。"""
    recs, sha, from_cloud = cloud_records()
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
    # 本图获得经验：默认 cur−prev；升级跨级时坐标系切换，用 --gained 显式指定
    gained_val = a.gained if a.gained is not None else (a.cur - prev)

    affixes = list(getattr(a, 'affix', None) or [])
    if getattr(a, 'affixes', None):
        affixes += [x for x in a.affixes.split('|') if x.strip()]

    rec = {'dt': dt, 'role': role, 'level': int(level),
           'map': a.map, 'tier': a.tier,
           'mobLv': int(a.mob_lv) if a.mob_lv is not None else None,
           'mobQty': a.qty,
           'pot50': bool(a.pot50), 'pot20': bool(a.pot20),
           'stones': a.stones,
           'prev': int(prev), 'cur': int(a.cur),
           'note': a.note or ''}
    if affixes:
        rec['affixes'] = affixes
    if a.gained is not None:
        rec['gained'] = int(a.gained)

    recs.append(rec)
    msg = ('xp: 新增 #%d %s %s 怪物%s级 晶石%s' %
           (len(recs), rec['tier'], rec['map'], rec['mobLv'], rec['stones']))
    cloud_save(recs, msg)

    total = level_total(read_html())
    gtxt = ('+' + fmt(gained_val)) if gained_val >= 0 else ('−' + fmt(abs(gained_val)))
    lt_of_add = LT_MAP.get(level, total)
    print('[OK] 已追加 #%d  %s  %s %s  怪物%s级 +%s%%  晶石%s' %
          (len(recs), dt, rec['tier'], rec['map'], rec['mobLv'],
           rec['mobQty'] if rec['mobQty'] is not None else 0,
           rec['stones'] if rec['stones'] is not None else 0))
    print('     上次 %s → 当前 %s  获得 %s (%.4f%%)  进度 %.4f%%'
          % (fmt(prev), fmt(rec['cur']), gtxt,
             gained_val / lt_of_add * 100, rec['cur'] / lt_of_add * 100))
    print('     数据源: %s → 已写入云端 baozhan-data/%s'
          % ('云端' if from_cloud else 'HTML 种子', DATA_PATH))
    if gained_val < 0:
        print('     [注意] 本次为负收益（如通关失败被扣经验），页面会标红显示')
    if a.gained is not None:
        print('     [升级] 显式 gained=%s（补满旧级 + 结转新级）' % fmt(a.gained))
    if affixes:
        print('     词缀 %d 条: %s' % (len(affixes), ' / '.join(affixes)))

    if not a.no_publish:
        cmd_publish(argparse.Namespace(msg=a.msg,
                                       no_wait=getattr(a, 'no_wait', False) or getattr(a, 'fast', False),
                                       sync_seed=True))


# ---------------- edit：对话侧纠错 ----------------
def cmd_edit(a):
    """按序号修改某条记录的任意字段。序号从 1 开始，与页面「全部明细」一致。
    只改指定字段，其余原样保留；改完自动重排 prev 链。"""
    recs, sha, _ = cloud_records()
    if not recs:
        sys.exit('[ERROR] 云端没有记录')
    if a.index < 1 or a.index > len(recs):
        sys.exit('[ERROR] 序号超出范围：1..%d' % len(recs))
    rec = dict(recs[a.index - 1])
    before = dict(rec)

    fields = {'map': 'map', 'tier': 'tier', 'mob-lv': 'mobLv', 'qty': 'mobQty',
              'stones': 'stones', 'cur': 'cur', 'note': 'note', 'level': 'level',
              'time': 'dt', 'role': 'role'}
    for opt, key in fields.items():
        v = getattr(a, opt.replace('-', '_'), None)
        if v is not None:
            if key in ('mobLv', 'cur', 'level'):
                rec[key] = int(v)
            else:
                rec[key] = v
    if a.gained is not None:
        rec['gained'] = int(a.gained)
    if a.pot50:
        rec['pot50'] = True
    if a.pot20:
        rec['pot20'] = True
    if a.no_pot50:
        rec['pot50'] = False
    if a.no_pot20:
        rec['pot20'] = False
    if a.affixes is not None:
        rec['affixes'] = [x for x in a.affixes.split('|') if x.strip()]

    changed = [k for k in rec if before.get(k) != rec.get(k)]
    if not changed:
        print('[INFO] 没有字段被修改（用 -- 传参指定要改的项）')
        return

    recs[a.index - 1] = rec
    # prev 链重排：除第 1 条外，prev 必须严格等于上一条 cur
    for i in range(1, len(recs)):
        recs[i]['prev'] = recs[i - 1]['cur']

    cloud_save(recs, 'xp: 修正 #%d %s' % (a.index, '/'.join(changed)))
    print('[OK] #%d 已修改：%s' % (a.index, '  '.join(
        '%s %s→%s' % (k, before.get(k), rec.get(k)) for k in changed)))
    print('     已重排 prev 链并写入云端')


# ---------------- remove：删错记录 ----------------
def cmd_remove(a):
    recs, sha, _ = cloud_records()
    if not recs:
        sys.exit('[ERROR] 云端没有记录')
    if a.index < 1 or a.index > len(recs):
        sys.exit('[ERROR] 序号超出范围：1..%d' % len(recs))
    if not a.yes:
        r = recs[a.index - 1]
        sys.exit('[ERROR] 删 #%d（%s %s %s）？确认请加 --yes'
                 % (a.index, r.get('dt'), r.get('tier'), r.get('map')))
    gone = recs.pop(a.index - 1)
    for i in range(1, len(recs)):
        recs[i]['prev'] = recs[i - 1]['cur']
    cloud_save(recs, 'xp: 删除 #%d %s' % (a.index, gone.get('map')))
    print('[OK] 已删除 #%d %s %s %s，剩余 %d 条'
          % (a.index, gone.get('dt'), gone.get('tier'), gone.get('map'), len(recs)))


# ---------------- sync：把云端数据回灌 HTML 种子 ----------------
def cmd_sync(a):
    """把云端记录写回 index-xp.html 的 XP_SEED。
    运行期页面以云端为准，这一步只为：
      1) 让 HTML 兜底种子保持最新（云端不可用时不至于退回旧数据）
      2) 改逻辑/ 排查问题时能直接看 HTML 里的数据"""
    recs, sha, from_cloud = cloud_records()
    if not from_cloud:
        print('[INFO] 云端为空，未改动 HTML')
        return
    lines = []
    for r in recs:
        aff = r.get('affixes') or []
        aff_sql = ''
        if aff:
            items = ','.join("'%s'" % str(x).replace("'", "\'") for x in aff)
            aff_sql = ',\n    affixes:[%s]' % items
        gained_sql = '' if r.get('gained') is None else ", gained:%d" % int(r['gained'])
        lines.append(
            "\n  { dt:'%s', role:'%s', level:%d,\n"
            "    map:'%s', tier:'%s', mobLv:%s, mobQty:%s,\n"
            "    pot50:%s, pot20:%s, stones:%s,\n"
            "    prev:%d, cur:%d, note:'%s'%s%s },"
            % (r['dt'], r.get('role', ''), int(r.get('level', 0)),
               str(r.get('map', '')).replace("'", "\\'"), str(r.get('tier', '')).replace("'", "\\'"),
               'null' if r.get('mobLv') is None else int(r['mobLv']),
               'null' if r.get('mobQty') is None else int(r['mobQty']),
               'true' if r.get('pot50') else 'false',
               'true' if r.get('pot20') else 'false',
               'null' if r.get('stones') is None else int(r['stones']),
               int(r['prev']), int(r['cur']), str(r.get('note', '')).replace("'", "\\'"),
               aff_sql, gained_sql))
    arr = '\n'.join(lines).lstrip('\n')

    html = read_html()
    m = re.search(r'(const XP_SEED\s*=\s*\[)(.*?)(\];)', html, re.S)
    if not m:
        sys.exit('[ERROR] 未找到 XP_SEED 数组')
    html = html[:m.start()] + m.group(1) + '\n' + arr + '\n' + m.group(3) + html[m.end():]
    dt_last = recs[-1]['dt'][:16]
    html = re.sub(r"(const UPDATED_AT\s*=\s*')[^']*(')",
                  r"\g<1>" + dt_last + r"\g<2>", html)
    write_html(html)
    node_check()
    print('[OK] 已把云端 %d 条记录回灌到 HTML 的 XP_SEED' % len(recs))
    print('     UPDATED_AT = %s' % dt_last)


# ---------------- status：查看当前状态 ----------------
def cmd_status(a):
    data, sha = cloud_pull()
    if not data or not data.get('records'):
        print('云端 xp.json 为空')
        return
    recs = data['records']
    last = recs[-1]
    lt = LT_MAP.get(int(last.get('level', 86)), 0) or 1
    print('云端 baozhan-data/%s  sha=%s' % (DATA_PATH, sha[:8]))
    print('  savedAt   %s' % data.get('savedAt'))
    print('  updatedBy %s' % data.get('updatedBy'))
    print('  记录数    %d' % len(recs))
    print('  末条      %s  %s %s  cur=%s  进度 %.4f%%'
          % (last.get('dt'), last.get('tier'), last.get('map'),
             fmt(last['cur']), last['cur'] / lt * 100))
    print('  累计晶石  %s' % fmt(sum(r.get('stones') or 0 for r in recs)))


# ---------------- 线上校验 ----------------
def fetch_one(ip):
    """抓单个 CDN 节点内容，失败返回 None"""
    try:
        r = subprocess.run(
            ['curl', '-s', '--max-time', '8', '--resolve',
             'dycxlcvxv00.github.io:443:' + ip, URL],
            capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return ip, r.stdout
    except Exception:
        pass
    return None


def fetch_nodes():
    """并发探全部 CDN 节点，返回 [(ip, 内容), ...]

    各节点生效有先后，不能只看一个；这里必须并发 —— 串行 4 个节点
    每次要 4xRTT，一轮下来能把 40s 的Pages 构建时间整个耗光。"""
    with ThreadPoolExecutor(max_workers=len(IPS)) as ex:
        res = list(ex.map(fetch_one, IPS))
    return [r for r in res if r]


def wait_online(fingerprint, timeout=150, interval=2, delay=4):
    """轮询直到任一节点内容与本地 sha256 完全一致；返回 (是否成功, 耗时秒, sha 是否一致)
       - 判定以 sha256 为准，避免「某节点已更新、另一节点还是旧的」造成误判
       - 首次命中后补一小段宽限期，让尽量多的节点跟上，再返回全绿
       - 超时兜底：只要有节点出现新指纹，就报告为部分生效
       delay: 首次请求前的静默期（push 后立刻请求必然拿到旧版，省一次无效往返）
       interval=2 而非 3：节点并发抓取后，单轮成本已降到 1 个 RTT，
       加密一次探测频率就能更早命中，省下的是实打实的等待时间。"""
    local = sha256_of(HTML)
    time.sleep(delay)
    t0 = time.time()
    best = False
    while time.time() - t0 < timeout:
        nodes = fetch_nodes()
        hit = [ip for ip, txt in nodes if sha256_text(txt) == local]
        if hit:
            # 已命中，但可能只有部分节点跟上；再给 4s 宽限让其余节点收敛
            if len(hit) >= len(nodes) or time.time() - t0 > timeout - 6:
                return True, round(time.time() - t0 + delay, 1), len(hit) == len(IPS)
            best = True
        elif best:
            best = False
        time.sleep(interval)
    for ip, txt in fetch_nodes():
        if fingerprint and fingerprint in txt:
            return True, round(time.time() - t0 + delay, 1), False
    return False, round(time.time() - t0 + delay, 1), False


# ---------------- publish ----------------
def cmd_publish(a):
    """发布：把 HTML 回灌云端数据后提交。

    优先走 git（本地有仓库时）；沙箱里没有 .git 或 push 失败，
    自动降级为 GitHub Contents API 直接提交 —— 保证任何环境下都能发布。"""
    if getattr(a, 'sync_seed', False):
        cmd_sync(argparse.Namespace())

    html = read_html()
    recs, m = parse_records(html)
    last = recs[-1] if recs else {}
    raws = re.findall(r'\{[^{}]*\}', m.group(1), re.S)
    fingerprint = re.sub(r'\s+', '', raws[-1]) if raws else str(last.get('cur'))

    msg = a.msg or ('经验台账：%d条 %s%s 怪物%s级 晶石%s进度%.4f%%' % (
        len(recs), last.get('tier', ''), last.get('map', ''),
        last.get('mobLv', ''), last.get('stones', ''),
        last['cur'] / level_total(html) * 100 if last.get('cur') else 0))

    pushed = False
    if os.path.isdir(os.path.join(REPO, '.git')):
        try:
            subprocess.run(['git', 'add', '-A'], cwd=REPO, check=True,
                           capture_output=True, text=True)
            r = subprocess.run(['git', 'commit', '-m', msg], cwd=REPO,
                               capture_output=True, text=True)
            if 'nothing to commit' in r.stdout:
                print('[INFO] git: 无改动可提交')
            else:
                print('[OK] git commit:', msg)
            p = subprocess.run(['git', 'push'], cwd=REPO,
                               capture_output=True, text=True)
            if p.returncode == 0:
                print('[OK] git push 成功')
                pushed = True
            else:
                print('[WARN] git push 失败，降级为 API 提交：%s' % p.stderr.strip()[:200])
        except Exception as e:
            print('[WARN] git 不可用（%s），降级为 API 提交' % e)

    if not pushed:
        # Contents API 提交（一次请求一个文件）
        tok = get_token()
        api = 'https://api.github.com/repos/%s/baozhan-game/contents/index-xp.html' % DATA_OWNER
        h = {'Authorization': 'Bearer ' + tok, 'Accept': 'application/vnd.github+json',
             'Content-Type': 'application/json'}
        try:
            cur = json.load(urllib.request.urlopen(
                urllib.request.Request(api, headers=h), timeout=30))
            sha = cur['sha']
        except Exception:
            sha = ''
        body = {'message': msg,
                'content': base64.b64encode(html.encode('utf-8')).decode(),
                'branch': 'main'}
        if sha:
            body['sha'] = sha
        try:
            res = json.load(urllib.request.urlopen(
                urllib.request.Request(api, data=json.dumps(body).encode(),
                                       headers=h, method='PUT'), timeout=40))
            print('[OK] API 提交成功 sha=%s' % res['content']['sha'][:8])
        except urllib.error.HTTPError as e:
            sys.exit('[ERROR] API 提交失败 %s：%s' % (e.code, e.read().decode('utf-8', 'ignore')[:300]))

    if not getattr(a, 'no_wait', False):
        print('[..] 等待 Pages 生效（轮询，最长 150s）')
        ok, sec, same = wait_online(fingerprint)
        if ok:
            print('[OK] 线上已生效，用时 %ss' % sec)
        else:
            print('[WARN] %ss 内未确认生效，请稍后 Ctrl+F5 检查' % sec)
    else:
        print('[INFO] 跳过等待，约 30-60s 后生效')

    import shutil
    try:
        shutil.copy(HTML, os.path.join(WORKSPACE, 'index-xp.html'))
        cmd_excel(argparse.Namespace(quiet=False))
        print('[OK] 已同步 /workspace/index-xp.html 与 Excel')
    except Exception as e:
        print('[WARN] 同步 workspace/Excel 失败：%s' % e)


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
        lt = LT_MAP.get(r.get('level', 86), total)   # 该记录所属等级的升级总经验
        gained = r['gained'] if r.get('gained') is not None else r['cur'] - r['prev']
        ws.append([i - 1, r['dt'], r.get('role', ''), r.get('level', ''), r.get('map', ''),
                   r.get('tier', ''), r.get('mobLv', ''),
                   r['mobQty'] if r.get('mobQty') is not None else '—',
                   '✓' if r.get('pot50') else '—',
                   '✓' if r.get('pot20') else '—',
                   r['stones'] if r.get('stones') is not None else '—',
                   r['prev'], r['cur'], gained,
                   gained / lt, lt, r['cur'] / lt, r.get('note', '')])
        for c in range(1, len(headers) + 1):
            ws.cell(row=i, column=c).border = bd
            ws.cell(row=i, column=c).alignment = ct
        ws.cell(row=i, column=2).number_format = 'yyyy-mm-dd hh:mm:ss'
        for c in (13, 14, 16):
            ws.cell(row=i, column=c).number_format = '#,##0'
        for c in (15, 17):
            ws.cell(row=i, column=c).number_format = '0.0000%'
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
        '7. 各等级升级总经验：86级 1,999,268,000、87级 2,125,066,400（xp.py 的 LT_MAP 与页面 LEVEL_TOTALS 同步维护，升级时新增）。',
        '8. 第1条记录为 86 级首张统计图，即 T14 祭祀礼堂，起点经验按 0 计。',
        '9. 经验药水50% / 经验药水20% 两列：使用了填 ✓，未使用显示 —；备注默认留空。',
        '10. 结算日按每天 08:00 分界：08:00 前的记录归前一天。',
        '11. 升级当图（跨级）：经验坐标系切换，"本图获得经验"= 补满旧级所需 + 结转新级的读数（记录带显式 gained 字段）；当前经验值/累计进度按新等级口径。',
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
    p.add_argument('--affix', action='append', default=None,
                   help='地图词缀，可重复传：--affix "怪物数量增加 25%" --affix "掉落地图数量 +100%%"')
    p.add_argument('--affixes', default=None, help='词缀，多个用 | 分隔')
    p.add_argument('--force', action='store_true')
    p.add_argument('--gained', type=int, default=None,
                   help='显式指定本图获得经验（升级跨级时用：补满旧级 + 结转新级之和）')
    p.add_argument('--no-publish', action='store_true', help='只写本地，不提交发布')
    p.add_argument('--fast', action='store_true',
                   help='提交后不等待 Pages 生效（省30-60s，后续可publish --no-wait 补等）')
    p.add_argument('--no-wait', action='store_true', help='推送后不等待线上生效')
    p.add_argument('--msg', default=None, help='自定义 commit 信息')
    p.set_defaults(func=cmd_add)

    p = sub.add_parser('publish', help='提交+推送+验证+同步')
    p.add_argument('--msg', default=None)
    p.add_argument('--no-wait', action='store_true')
    p.set_defaults(func=cmd_publish)

    p = sub.add_parser('edit', help='按序号修改某条记录（对话侧纠错用）')
    p.add_argument('index', type=int, help='记录序号，从 1 开始')
    p.add_argument('--map'); p.add_argument('--tier')
    p.add_argument('--mob-lv', type=int); p.add_argument('--qty', type=int)
    p.add_argument('--stones', type=int); p.add_argument('--cur', type=int)
    p.add_argument('--note'); p.add_argument('--level', type=int)
    p.add_argument('--time'); p.add_argument('--role')
    p.add_argument('--gained', type=int)
    p.add_argument('--pot50', action='store_true')
    p.add_argument('--pot20', action='store_true')
    p.add_argument('--no-pot50', action='store_true', help='取消 50%% 药水标记')
    p.add_argument('--no-pot20', action='store_true', help='取消 20%% 药水标记')
    p.add_argument('--affixes', default=None, help='词缀，多个用 | 分隔；传空串清空')
    p.add_argument('--publish', action='store_true', help='同时发布到 GitHub Pages')
    p.set_defaults(func=cmd_edit)

    p = sub.add_parser('remove', help='删除某条记录')
    p.add_argument('index', type=int)
    p.add_argument('--yes', action='store_true', help='确认删除（必加）')
    p.add_argument('--publish', action='store_true')
    p.set_defaults(func=cmd_remove)

    p = sub.add_parser('sync', help='把云端数据回灌到 HTML 的 XP_SEED')
    p.set_defaults(func=cmd_sync)

    p = sub.add_parser('status', help='查看云端当前数据状态')
    p.set_defaults(func=cmd_status)

    p = sub.add_parser('excel', help='仅重新生成 Excel')
    p.set_defaults(func=cmd_excel)

    a = ap.parse_args()
    a.func(a)
    # edit / remove 支持 --publish：改完顺手发布
    if a.cmd in ('edit', 'remove') and getattr(a, 'publish', False):
        cmd_publish(argparse.Namespace(msg=None, no_wait=False, sync_seed=True))


if __name__ == '__main__':
    main()
