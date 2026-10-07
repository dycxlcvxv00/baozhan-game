import subprocess, time, sys

LOCAL_MD5 = "2d684378dd3d58aeeb029940e1a0fd66"
URL = "https://codebuddy-cdn-ocean.workbuddy.site/pet/baozhan/index-xp.html"

for i in range(1, 31):
    # 先探网络
    net = subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}","--max-time","15",URL],
                         capture_output=True, text=True).stdout.strip()
    if net == "200":
        r = subprocess.run(["curl","-s","-H","Cache-Control: no-cache",URL+"?t="+str(int(time.time()))],
                           capture_output=True)
        import hashlib
        remote = hashlib.md5(r.stdout).hexdigest()
        print(f"[{i}] HTTP 200, md5={remote}", flush=True)
        if remote == LOCAL_MD5:
            print("RESULT: #232 线上已生效，内容一致", flush=True)
            sys.exit(0)
        else:
            print(f"[{i}] 网络已恢复但 CDN 仍是旧缓存，继续等待", flush=True)
    else:
        print(f"[{i}] 网络未恢复 (HTTP {net})，60s 后重试", flush=True)
    time.sleep(60)
print("RESULT: 30 次重试仍未生效，需人工介入", flush=True)
sys.exit(1)
