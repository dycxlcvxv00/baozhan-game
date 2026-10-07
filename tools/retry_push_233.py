import subprocess, time, sys, hashlib, shutil

LOCAL_MD5 = "3ae2ddb4fbdb52bf3a3eeb8723a6c463"
URL = "https://codebuddy-cdn-ocean.workbuddy.site/pet/baozhan/index-xp.html"

# 阶段1：循环 push
ok = False
for i in range(1, 31):
    r = subprocess.run(["git","push","origin","main"], cwd="/root/baozhan-game",
                       capture_output=True, text=True)
    out = r.stdout + r.stderr
    if "main -> main" in out and "remote rejected" not in out:
        print(f"[{i}] push 成功", flush=True)
        ok = True
        break
    print(f"[{i}] push 失败: {[l for l in out.splitlines() if 'rejected' or 'Everything' in l][:1]}", flush=True)
    time.sleep(60)
if not ok:
    print("RESULT: 30 次 push 全败，需人工介入", flush=True)
    sys.exit(1)

# 阶段2：轮询线上生效
for i in range(1, 16):
    time.sleep(20)
    r = subprocess.run(["curl","-s","--max-time","20","-H","Cache-Control: no-cache",URL+"?t="+str(int(time.time()))],
                       capture_output=True)
    remote = hashlib.md5(r.stdout).hexdigest()
    print(f"[verify {i}] md5={remote}", flush=True)
    if remote == LOCAL_MD5:
        print("RESULT: #233(含#232) 线上已生效，内容一致", flush=True)
        sys.exit(0)
print("RESULT: push 成功但线上未确认，稍后复查", flush=True)
sys.exit(2)
