#!/usr/bin/env python3
"""经验台账截图一键识别。

用法：python3 readshot.py <截图路径> [--raw]

之前每录一条都要人工裁 4~5 次放大再肉眼看，慢且容易读错
（曾把 89 级读成 90、把 4 条词缀脑补成 8 条）。这里把
「按比例定位面板 → 分块提亮 → OCR」全自动化，一次输出结构化结果。

面板位置按 1920x1113 基准坐标写死，再按实际截图尺寸等比换算。
"""
import os
import re
import subprocess
import sys

from PIL import Image, ImageEnhance

# 基准分辨率（已验证的截图尺寸）
BASE_W, BASE_H = 1920, 1113

# 各区块在基准图上的坐标 (x0, y0, x1, y1)
REGIONS = {
    # 标题行：地图名 + 地图类型 + 阶
    'title': (1555, 448, 1920, 485),
    # 属性区：怪物等级 / 怪物数量 / 灵魂晶石掉落系数
    'stats': (1555, 495, 1920, 560),
    # 词缀区（通常 6~10 行，单独一块以免被截断）
    'affix': (1555, 560, 1920, 900),
    # 经验条：当前经验 / 总经验
    'xp':    (740, 1075, 1300, 1110),
    # 左上角角色等级
    'level': (0, 45, 120, 260),
}

# 每个区块用几档亮度跑 OCR，取「出现数字/标点最多」的那档结果
BRIGHTNESS = {'title': [1.6, 2.4, 3.2, 4.0], 'stats': [1.4, 1.8, 2.4],
              'affix': [1.5, 1.9, 2.3, 2.8, 3.4], 'xp': [1.4, 1.8, 2.4],
              'level': [1.6, 2.4]}
SCALE = {'title': 6, 'stats': 5, 'affix': 5, 'xp': 8, 'level': 6}


def ocr(img, lang='chi_sim+eng'):
    """跑一次 tesseract，返回文本"""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        tmp = f.name
    try:
        img.save(tmp)
        r = subprocess.run(['tesseract', tmp, 'stdout', '-l', lang,
                            '--psm', '6', '-c',
                            'preserve_interword_spaces=1'],
                           capture_output=True, text=True)
        return r.stdout
    finally:
        os.unlink(tmp)


def score(text):
    """给OCR 结果打分：中文/数字/百分号越多越好，空行越多越差"""
    s = len(re.findall(r'[\u4e00-\u9fff]', text))
    d = len(re.findall(r'\d', text))
    return s + d * 1.2


def read_region(im, name):
    x0, y0, x1, y1 = REGIONS[name]
    w, h = im.size
    sx, sy = w / BASE_W, h / BASE_H
    box = (int(x0 * sx), int(y0 * sy), int(x1 * sx), int(y1 * sy))
    crop = im.crop(box).convert('RGB')
    k = SCALE[name]
    crop = crop.resize((crop.width * k, crop.height * k), Image.LANCZOS)

    # 每档亮度各跑一次，取打分最高的一档。
    # （试过按行取多档并集补漏，结果不同档位会重复认出同一批行，
    #   反而把词缀列表搞乱—— 宁可漏一条由人工补，也不能凭空多出重复条目。）
    best, best_score = '', -1
    for b in BRIGHTNESS[name]:
        img = ImageEnhance.Brightness(crop).enhance(b)
        t = ocr(img)
        if score(t) > best_score:
            best, best_score = t, score(t)
    return best


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    im = Image.open(path)
    print('截图 %s  尺寸 %s' % (os.path.basename(path), im.size))
    print('=' * 60)
    for name in ['title', 'stats', 'affix', 'xp', 'level']:
        txt = read_region(im, name)
        lines = [l.strip() for l in txt.splitlines() if l.strip()]
        print('\n【%s】' % name)
        for l in lines:
            print('   ', l)
        if name == 'title':
            m = re.search(r'(T\d+)\s*(\S+)', txt)
            if m:
                print('    -> 地图: %s %s' % (m.group(1), m.group(2)))
        if name == 'xp':
            nums = re.findall(r'\d{6,}', txt.replace(',', ''))
            if len(nums) >= 2:
                print('    -> cur=%s总=%s' % (nums[0], nums[1]))


if __name__ == '__main__':
    main()
