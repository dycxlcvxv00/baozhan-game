"""把云端（baozhan-data 私有仓库）最新 data.json 推一份到 Pages 公开仓库根目录，
供台账页面「仓库恢复」按钮使用（github.io 同源下载，不需要令牌，国内可达）。
用法：python3 push_snapshot.py
注意：快照文件是公开的，含角色/账号/收益数据 —— 已获用户确认（2026-11-01）。"""
import json, urllib.request, base64, time, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOKEN = open(os.path.join(ROOT, '.gh_token')).read().strip()
H = {'Authorization': 'token ' + TOKEN, 'User-Agent': 'push-snapshot',
     'Accept': 'application/vnd.github+json'}
SRC = 'https://api.github.com/repos/dycxlcvxv00/baozhan-data/contents/data.json'
DST = 'https://api.github.com/repos/dycxlcvxv00/baozhan-game/contents/data.json'

def gh_json(url, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=H, method=method)
    last = None
    for _ in range(6):
        try: return json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as e:
            if e.code == 404: return None      # 目标文件不存在是正常情况
            last = e; time.sleep(2)
        except Exception as e:
            last = e; time.sleep(2)
    raise last

def main():
    src = gh_json(SRC + '?ref=main')
    data = json.loads(base64.b64decode(src['content']).decode())
    print(f"云端 savedAt {data.get('savedAt')} · {len(data.get('accounts') or [])} 个账号")
    dst = gh_json(DST + '?ref=main')
    sha = dst['sha'] if dst else None
    body = {'message': '仓库快照：同步云端最新数据（供页面「仓库恢复」使用）',
            'content': base64.b64encode((json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode()).decode(),
            'branch': 'main'}
    if sha: body['sha'] = sha
    r = gh_json(DST, 'PUT', body)
    print('Pages 快照提交 →', r['commit']['sha'][:7])
    # 同步本地镜像
    json.dump(data, open(os.path.join(ROOT, 'data', 'data.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print('本地镜像已更新')

if __name__ == '__main__':
    main()
