/* ============================================================
 * build_single.cjs — 多文件源码 → 零依赖单文件构建
 * 用法：node build_single.cjs
 * 产出：index.html（Pages 发布入口 / 双击即玩下载版，唯一产物）
 *
 * 2026-09-04：原先同时产出 index-h-single.html，内容与 index.html 字节完全相同，
 * 属 510KB 冗余且容易两份不同步，已取消。双击即玩直接用 index.html。
 *
 * 关键坑（来自 demo开发文档）：PixiJS 内联代码里含 `$&` / `$'` / `` $` ``，
 * 若用 String.replace(re, content) 直接当替换串，会触发特殊替换模式，
 * 向代码注入游离的脚本结束标记导致页面崩坏。这里用「函数返回值」替换，
 * 让引擎把 content 当作纯文本，彻底规避该问题。
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ENTRY = path.join(ROOT, 'index-h.html');
const OUT_PUB = path.join(ROOT, 'index.html');

let html = fs.readFileSync(ENTRY, 'utf8');

// 匹配 <script src="js/xxx.js"></script> 并内联为 <script>...内容...</script>
const SRC_RE = /<script\s+src="([^"]+)"><\/script>/g;

html = html.replace(SRC_RE, function (_m, src) {
  const file = path.join(ROOT, src);
  if (!fs.existsSync(file)) {
    console.warn('[warn] 找不到模块，跳过内联：' + src);
    return _m;
  }
  const code = fs.readFileSync(file, 'utf8');
  // 模块文件精确存为「<script> 与 </script> 之间的内容」，其首/尾本就含原文件
  // 标签旁的空行；此处补回 <script>/</script> 自身的换行，使构建产物与手工单文件
  // 字节级一致。用函数返回值替换，规避 PixiJS 内联触发 $&/$'/$` 注入游离结束标记。
  return '<script>\n' + code + '\n</script>';
});

fs.writeFileSync(OUT_PUB, html);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('[build] 已生成 index.html  ' + kb(fs.statSync(OUT_PUB).size));
console.log('  → push 后 Pages 固定链接自动更新：https://dycxlcvxv00.github.io/baozhan-game/');
