#!/usr/bin/env python3
"""Генератор шаблонов наклеек.

Рисует подложки (HTML/CSS) и одновременно считает позиции полей, чтобы текст
ложился ровно на линии. Запуск:
    python3 tools/templates.py            # -> build/templates.html + assets/templates/presets.json
    node tools/render-templates.js        # -> assets/templates/*.png
"""
import json, os, base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_HTML = os.path.join(ROOT, 'build', 'templates.html')
OUT_JSON = os.path.join(ROOT, 'assets', 'templates', 'presets.json')
RACCOON = os.path.join(ROOT, 'assets', 'templates', 'raccoon.png')

ALL = ['roaster', 'country', 'name', 'process', 'q', 'm', 'roast', 'pack']


def raccoon_uri():
    with open(RACCOON, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


class T:
    def __init__(self, pid, name, W, H, bg, font, color, weight, page, italic=0, desc=''):
        self.pid, self.name, self.W, self.H = pid, name, W, H
        self.font, self.color, self.weight, self.italic, self.page, self.desc = font, color, weight, italic, page, desc
        self.html = []
        self.fields = {}
        self.bg = bg

    def add(self, s):
        self.html.append(s)

    def text(self, x, y, s, css='', w=None, anchor='left'):
        """y — базовая линия текста примерно (top блока = y)."""
        style = f'left:{x}px;top:{y}px;' + (f'width:{w}px;' if w else '') + f'text-align:{anchor};' + css
        self.add(f'<div class="t" style="{style}">{s}</div>')

    def line(self, x, y, w, css='border-bottom:2px solid currentColor'):
        self.add(f'<div class="ln" style="left:{x}px;top:{y}px;width:{w}px;{css}"></div>')

    def field(self, k, x, line_y, w, fs, a='left', lift=0.08):
        """Поле: текст стоит на линии line_y (px), ширина w, кегль fs (px)."""
        W, H = self.W, self.H
        self.fields[k] = {
            'x': round(x / W * 100, 2),
            'b': round((H - line_y) / H * 100 + lift * fs / H * 100, 2),
            'w': round(w / W * 100, 2),
            'fs': round(fs / H * 100, 2),
            'a': a, 'on': 1,
        }

    def preset(self):
        f = dict(self.fields)
        for k in ALL:
            if k not in f:
                f[k] = {'x': 8, 'b': 5, 'w': 84, 'fs': 4.2, 'a': 'left', 'on': 0}
        return {
            'pid': self.pid, 'name': self.name, 'desc': self.desc,
            'bg': f'assets/templates/{self.pid}.png', 'bgW': self.W, 'bgH': self.H,
            'font': self.font, 'color': self.color, 'weight': self.weight, 'italic': self.italic,
            'fields': f, 'page': self.page,
        }

    def render(self):
        return (f'<div class="tpl" id="t-{self.pid}" style="width:{self.W}px;height:{self.H}px;{self.bg}">'
                + ''.join(self.html) + '</div>')


R = None  # raccoon data uri
TPL = []

# ------------------------------------------------------------------ 1. Минимал
t = T('minimal', 'Минимал', 874, 1118, 'background:#fff;color:#1d1714',
      "'Manrope',Arial,sans-serif", '#1d1714', 700,
      {'orient': 'landscape', 'cols': 4, 'rows': 2, 'lw': 68, 'gx': 3, 'gy': 4, 'mx': 8, 'my': 8, 'cut': 0},
      desc='Чистая типографика, много воздуха')
t.add(f'<img src="{{R}}" style="position:absolute;left:44px;top:40px;height:190px">')
t.text(200, 58, 'SPECIALTY', 'font:800 26px Manrope;letter-spacing:.32em;color:#b85c2c')
t.text(196, 88, 'кофеёк', 'font:700 92px Unbounded;letter-spacing:-.02em;line-height:1')
t.text(202, 200, '@speccof', 'font:500 26px Manrope;color:#8a7a70')
t.add('<div style="position:absolute;left:44px;right:44px;top:262px;border-top:3px solid #1d1714"></div>')
lab = 'font:800 19px Manrope;letter-spacing:.2em;color:#9b8a7e'
hair = 'border-bottom:2px solid #e3dad2'
t.text(44, 298, 'ОБЖАРЩИК', lab);  t.line(44, 382, 786, hair); t.field('roaster', 44, 380, 786, 46)
t.text(44, 410, 'НАЗВАНИЕ', lab);  t.line(44, 520, 786, hair); t.field('name', 44, 518, 786, 72)
t.text(44, 548, 'СТРАНА', lab);    t.line(44, 632, 380, hair); t.field('country', 44, 630, 380, 40)
t.text(450, 548, 'ОБРАБОТКА', lab); t.line(450, 632, 380, hair); t.field('process', 450, 630, 380, 40)
t.text(44, 660, 'Q-БАЛЛ', lab);    t.line(44, 744, 380, hair); t.field('q', 44, 742, 380, 40)
t.text(450, 660, 'ВЕС', lab);      t.line(450, 744, 380, hair); t.field('m', 450, 742, 380, 40)
for i, (k, l) in enumerate([('roast', 'ДАТА ОБЖАРКИ'), ('pack', 'ДАТА УПАКОВКИ')]):
    x = 44 + i * 406
    t.add(f'<div style="position:absolute;left:{x}px;top:790px;width:380px;height:160px;border-radius:26px;background:#f4eee8"></div>')
    t.text(x + 28, 816, l, lab)
    t.field(k, x + 28, 918, 324, 44)
t.add('<div style="position:absolute;left:44px;right:44px;top:990px;border-top:2px solid #e3dad2"></div>')
t.text(44, 1020, 'свежеобжаренный specialty кофе', 'font:600 24px Manrope;color:#9b8a7e')
t.text(560, 1018, '● ● ●', 'font:700 22px Manrope;color:#b85c2c;letter-spacing:.3em', w=270, anchor='right')
TPL.append(t)

# ------------------------------------------------------------------ 2. Крафт
_svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
        "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/>"
        "<feColorMatrix values='0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .5 0'/></filter>"
        "<rect width='300' height='300' filter='url(#n)'/></svg>")
noise = "url(data:image/svg+xml;base64," + base64.b64encode(_svg.encode()).decode() + ")"
t = T('kraft', 'Крафт', 874, 1118, f'background:{noise},radial-gradient(circle at 30% 20%,#dcbf95,#c49a68 70%,#b48a58);color:#2b1a10',
      "'Caveat',cursive", '#2b1a10', 700,
      {'orient': 'landscape', 'cols': 4, 'rows': 2, 'lw': 68, 'gx': 3, 'gy': 4, 'mx': 8, 'my': 8, 'cut': 0},
      desc='Крафтовая бумага, рукописные значения')
t.add('<div style="position:absolute;inset:22px;border:3px dashed rgba(43,26,16,.55);border-radius:30px"></div>')
t.add('<div style="position:absolute;left:337px;top:52px;width:200px;height:200px;border-radius:50%;background:#f3e7d3;box-shadow:0 0 0 6px #2b1a10,0 0 0 12px #f3e7d3"></div>')
t.add(f'<img src="{{R}}" style="position:absolute;left:372px;top:56px;height:192px;clip-path:circle(95px at 66px 96px);">')
t.text(0, 282, 'SPECIALTY КОФЕЁК', 'font:700 50px \'Courier Prime\';letter-spacing:.06em', w=874, anchor='center')
t.text(0, 340, '— @speccof · свежая обжарка —', 'font:400 27px \'Courier Prime\';opacity:.8', w=874, anchor='center')
lab = "font:700 30px 'Courier Prime'"
dots = 'border-bottom:3px dotted rgba(43,26,16,.7)'
rows = [('roaster', 'обжарщик'), ('country', 'страна'), ('name', 'лот'), ('process', 'обработка')]
y = 470
for k, l in rows:
    t.text(64, y - 36, l + ':', lab)
    lx = 64 + len(l) * 19 + 34
    t.line(lx, y, 810 - lx, dots); t.field(k, lx + 6, y - 2, 804 - lx - 6, 58)
    y += 92
t.text(64, y - 36, 'Q:', lab); t.line(124, y, 250, dots); t.field('q', 130, y - 2, 244, 58)
t.text(410, y - 36, 'вес:', lab); t.line(500, y, 310, dots); t.field('m', 506, y - 2, 304, 58)
y += 92
t.text(64, y - 36, 'обжарка:', lab); t.line(236, y, 574, dots); t.field('roast', 242, y - 2, 568, 58)
y += 92
t.text(64, y - 36, 'упаковка:', lab); t.line(255, y, 555, dots); t.field('pack', 261, y - 2, 549, 58)
TPL.append(t)

# ------------------------------------------------------------------ 3. Эспрессо (тёмная)
t = T('espresso', 'Эспрессо', 874, 1118, 'background:radial-gradient(circle at 50% 0%,#3a2619,#1a110c 70%);color:#d8b47a',
      "'Playfair Display',Georgia,serif", '#f4e6d0', 600,
      {'orient': 'landscape', 'cols': 4, 'rows': 2, 'lw': 68, 'gx': 3, 'gy': 4, 'mx': 8, 'my': 8, 'cut': 0},
      desc='Тёмная, с золотом — для подарков')
t.add('<div style="position:absolute;inset:26px;border:2px solid #c9a46a;border-radius:6px"></div>')
t.add('<div style="position:absolute;inset:38px;border:1px solid rgba(201,164,106,.55);border-radius:3px"></div>')
t.text(0, 84, 'S P E C I A L T Y', "font:italic 500 30px 'Playfair Display';letter-spacing:.2em", w=874, anchor='center')
t.text(0, 118, 'кофеёк', "font:700 118px 'Playfair Display';line-height:1;color:#e6c48c", w=874, anchor='center')
t.add('<svg style="position:absolute;left:237px;top:262px" width="400" height="40" viewBox="0 0 400 40">'
      '<line x1="0" y1="20" x2="165" y2="20" stroke="#c9a46a" stroke-width="2"/><line x1="235" y1="20" x2="400" y2="20" stroke="#c9a46a" stroke-width="2"/>'
      '<ellipse cx="200" cy="20" rx="13" ry="18" fill="#c9a46a" transform="rotate(30 200 20)"/>'
      '<path d="M193 6 Q206 20 207 34" stroke="#1a110c" stroke-width="3" fill="none" transform="rotate(30 200 20)"/></svg>')
t.text(0, 312, '@speccof', "font:italic 400 26px 'Playfair Display';opacity:.75", w=874, anchor='center')
gold = "font:600 19px Manrope;letter-spacing:.3em;color:#c9a46a"
t.text(0, 376, 'ОБЖАРЩИК', gold, w=874, anchor='center'); t.field('roaster', 90, 446, 694, 44, 'center')
t.text(0, 476, 'ЛОТ', gold, w=874, anchor='center');      t.field('name', 70, 584, 734, 78, 'center')
t.add('<div style="position:absolute;left:300px;width:274px;top:612px;border-top:1px solid rgba(201,164,106,.6)"></div>')
t.field('country', 90, 676, 694, 40, 'center')
t.field('process', 90, 740, 694, 36, 'center')
cells = [('q', 'Q-БАЛЛ'), ('m', 'ВЕС'), ('roast', 'ОБЖАРКА')]
for i, (k, l) in enumerate(cells):
    x = 60 + i * 252
    t.add(f'<div style="position:absolute;left:{x}px;top:790px;width:{232}px;height:150px;border:1.5px solid rgba(201,164,106,.6);border-radius:4px"></div>')
    t.text(x, 812, l, gold, w=232, anchor='center')
    t.field(k, x + 12, 912, 208, 42 if k != 'roast' else 36, 'center')
t.text(0, 972, 'УПАКОВАНО', gold, w=874, anchor='center'); t.field('pack', 220, 1048, 434, 36, 'center')
TPL.append(t)

# ------------------------------------------------------------------ 4. Круглая (крышка/стакан)
ring = ('<svg style="position:absolute;left:0;top:0" width="1000" height="1000" viewBox="0 0 1000 1000">'
        '<defs><path id="arc" d="M 500 500 m -405 0 a 405 405 0 1 1 810 0 a 405 405 0 1 1 -810 0"/></defs>'
        '<circle cx="500" cy="500" r="496" fill="#b85c2c"/>'
        '<circle cx="500" cy="500" r="360" fill="#f7efe4"/>'
        '<circle cx="500" cy="500" r="346" fill="none" stroke="#b85c2c" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>'
        '<text font-family="Unbounded" font-weight="700" font-size="54" fill="#f7efe4">'
        '<textPath href="#arc" startOffset="0" textLength="2520" lengthAdjust="spacing">SPECIALTY КОФЕЁК ✦ @SPECCOF ✦ SPECIALTY КОФЕЁК ✦ @SPECCOF ✦</textPath></text>'
        '</svg>')
t = T('round', 'Круглая', 1000, 1000, 'background:transparent;color:#2a1a10',
      "'Manrope',Arial,sans-serif", '#2a1a10', 800,
      {'orient': 'landscape', 'cols': 5, 'rows': 3, 'lw': 50, 'gx': 3, 'gy': 4, 'mx': 8, 'my': 10, 'cut': 0},
      desc='Круглая Ø50 мм — на крышку или стакан')
t.add(ring)
t.add(f'<img src="{{R}}" style="position:absolute;left:452px;top:176px;height:136px">')
t.field('roaster', 250, 384, 500, 40, 'center')
t.field('name', 190, 500, 620, 82, 'center')
t.field('process', 230, 572, 540, 40, 'center')
t.add('<div style="position:absolute;left:380px;width:240px;top:614px;border-top:3px solid #b85c2c"></div>')
t.text(0, 640, 'ОБЖАРКА', 'font:800 24px Manrope;letter-spacing:.25em;color:#b85c2c', w=1000, anchor='center')
t.field('roast', 300, 728, 400, 50, 'center')
t.field('m', 380, 790, 240, 34, 'center')
TPL.append(t)

# ------------------------------------------------------------------ 5. Бирка (горизонтальная)
t = T('tag', 'Бирка', 1300, 650, 'background:#fbf6ef;color:#2a1a10',
      "'Rubik',Arial,sans-serif", '#2a1a10', 500,
      {'orient': 'portrait', 'cols': 2, 'rows': 5, 'lw': 90, 'gx': 3, 'gy': 4, 'mx': 8, 'my': 10, 'cut': 1},
      desc='Горизонтальная 90×45 мм — на пачку или банку')
t.add('<div style="position:absolute;left:0;top:0;bottom:0;width:380px;background:#b85c2c"></div>')
t.add('<div style="position:absolute;left:380px;top:0;bottom:0;width:14px;background:repeating-linear-gradient(#b85c2c 0 14px,transparent 14px 28px)"></div>')
t.add('<div style="position:absolute;left:100px;top:56px;width:180px;height:250px;border-radius:50%;background:#fbf6ef"></div>')
t.add(f'<img src="{{R}}" style="position:absolute;left:106px;top:60px;height:242px">')
t.text(0, 340, 'SPECIALTY', 'font:800 30px Manrope;letter-spacing:.3em;color:#fbe9d8', w=380, anchor='center')
t.text(0, 380, 'кофеёк', 'font:700 62px Unbounded;color:#fff;line-height:1', w=380, anchor='center')
t.text(0, 470, '@speccof', 'font:500 30px Manrope;color:#fbe9d8', w=380, anchor='center')
lab = 'font:700 18px Manrope;letter-spacing:.22em;color:#b85c2c'
hair = 'border-bottom:2px solid #e6d9ca'
x0 = 450
t.text(x0, 44, 'ОБЖАРЩИК', lab); t.field('roaster', x0, 114, 800, 46); t.line(x0, 116, 800, hair)
t.text(x0, 140, 'ЛОТ', lab);      t.field('name', x0, 236, 800, 74);    t.line(x0, 238, 800, hair)
cols = [('country', 'СТРАНА', 'process', 'ОБРАБОТКА'), ('q', 'Q-БАЛЛ', 'm', 'ВЕС'), ('roast', 'ОБЖАРКА', 'pack', 'УПАКОВКА')]
y = 266
for a, la, b, lb in cols:
    t.text(x0, y, la, lab);       t.field(a, x0, y + 92, 385, 40);       t.line(x0, y + 94, 385, hair)
    t.text(x0 + 415, y, lb, lab); t.field(b, x0 + 415, y + 92, 385, 40); t.line(x0 + 415, y + 94, 385, hair)
    y += 122
TPL.append(t)

# ------------------------------------------------------------------ 6. Поп (яркая)
t = T('pop', 'Поп', 874, 1118, 'background:#ffe7c7;color:#22160f',
      "'Rubik',Arial,sans-serif", '#22160f', 700,
      {'orient': 'landscape', 'cols': 4, 'rows': 2, 'lw': 68, 'gx': 3, 'gy': 4, 'mx': 8, 'my': 8, 'cut': 0},
      desc='Яркая, для сезонных и экспериментальных лотов')
t.add('<div style="position:absolute;left:-120px;top:-150px;width:520px;height:520px;border-radius:50%;background:#ff7a45"></div>')
t.add('<div style="position:absolute;right:-90px;top:120px;width:300px;height:300px;border-radius:50%;background:#7fd1b9"></div>')
t.add('<div style="position:absolute;right:120px;top:40px;width:90px;height:90px;border-radius:50%;background:#ffcd3c"></div>')
t.add('<div style="position:absolute;left:60px;bottom:-60px;width:180px;height:180px;border-radius:40px;transform:rotate(20deg);background:#7fd1b9"></div>')
t.add('<div style="position:absolute;inset:0;border:16px solid #22160f;border-radius:0"></div>')
t.add(f'<div style="position:absolute;left:46px;top:40px;width:178px;height:252px;border-radius:50%;background:#fff;border:6px solid #22160f"></div>')
t.add(f'<img src="{{R}}" style="position:absolute;left:52px;top:42px;height:248px">')
t.text(250, 66, 'SPECIALTY', 'font:700 34px Unbounded;letter-spacing:.06em')
t.text(246, 104, 'кофеёк!', 'font:700 84px Unbounded;line-height:1;-webkit-text-stroke:3px #22160f;color:#fff;text-shadow:7px 7px 0 #22160f')
t.text(252, 214, '@speccof', 'font:700 30px Rubik;background:#22160f;color:#ffe7c7;padding:4px 14px;border-radius:999px')
card = 'position:absolute;background:#fff;border:5px solid #22160f;border-radius:26px;box-shadow:8px 8px 0 #22160f'
lab = 'font:700 20px Rubik;letter-spacing:.14em;color:#ff7a45'
t.add(f'<div style="{card};left:46px;top:330px;width:770px;height:210px"></div>')
t.text(80, 354, 'ОБЖАРЩИК', lab); t.field('roaster', 80, 430, 700, 40)
t.field('name', 80, 512, 700, 64)
boxes = [('country', 'СТРАНА', 46, 574), ('process', 'ОБРАБОТКА', 448, 574),
         ('q', 'Q', 46, 730), ('m', 'ВЕС', 448, 730)]
for k, l, x, y in boxes:
    t.add(f'<div style="{card};left:{x}px;top:{y}px;width:368px;height:126px"></div>')
    t.text(x + 30, y + 20, l, lab); t.field(k, x + 30, y + 104, 310, 40)
t.add(f'<div style="{card};left:46px;top:888px;width:770px;height:150px;background:#22160f"></div>')
t.text(80, 908, 'ОБЖАРКА', 'font:700 20px Rubik;letter-spacing:.14em;color:#7fd1b9')
t.text(470, 908, 'УПАКОВКА', 'font:700 20px Rubik;letter-spacing:.14em;color:#7fd1b9')
t.field('roast', 80, 1006, 340, 44); t.field('pack', 470, 1006, 320, 44)
TPL.append(t)

# цвет значений на тёмной плашке «Поп» — общий цвет текста тёмный, поэтому даты в светлой плашке
t.html = [h.replace('top:888px;width:770px;height:150px;background:#22160f', 'top:888px;width:770px;height:150px;background:#7fd1b9') for h in t.html]
t.html = [h.replace('color:#7fd1b9">ОБЖАРКА', 'color:#22160f">ОБЖАРКА').replace('color:#7fd1b9">УПАКОВКА', 'color:#22160f">УПАКОВКА') for h in t.html]


def main():
    r = raccoon_uri()
    os.makedirs(os.path.dirname(OUT_HTML), exist_ok=True)
    css = ('*{box-sizing:border-box}body{margin:0;background:#888}.tpl{position:relative;overflow:hidden;margin:20px;'
           "font-family:Manrope}.t{position:absolute;white-space:nowrap;line-height:1.1}.ln{position:absolute;height:0}")
    fonts = ('<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;700'
             '&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,500&family=Courier+Prime:wght@400;700'
             '&family=Rubik:wght@400;500;700&family=Caveat:wght@500;700&display=block" rel="stylesheet">')
    body = ''.join(x.render().replace('{R}', r) for x in TPL)
    with open(OUT_HTML, 'w') as f:
        f.write(f'<!doctype html><meta charset="utf-8">{fonts}<style>{css}</style>{body}')
    data = [x.preset() for x in TPL]
    with open(OUT_JSON, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(OUT_JSON.replace('.json', '.js'), 'w') as f:
        f.write('/* сгенерировано tools/templates.py — не править руками */\nwindow.PRESETS = ')
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(';\n')
    print('templates:', ', '.join(x.pid for x in TPL))


if __name__ == '__main__':
    main()
