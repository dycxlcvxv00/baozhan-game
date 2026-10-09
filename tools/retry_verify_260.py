import subprocess, time, sys, hashlib

LOCAL_MD5 = "4e7d7caa9e94465a4addd1dfabbeeb18"
URL = "https://codebuddy-cdn-ocean.workbuddy.site/pet/baozhan/index-xp.html"

for i in range(1, 21):
    time.sleep(60)
    r = subprocess.run(["curl","-s","--max-time","20","-H","Cache-Control: no-cache",URL+"?t="+str(int(time.time()))],
                       capture_output=True)
    remote = hashlib.md5(r.stdout).hexdigest()
    print(f"[{i}] md5={remote}", flush=True)
    if remote == LOCAL_MD5:
        print("RESULT: #256-#260 补录线上已生效，内容一致", flush=True)
        sys.exit(0)
print("RESULT: 20 次未生效，需人工介入", flush=True)
sys.exit(1)
