// Рендер подложек из build/templates.html в assets/templates/<id>.png
// Запуск: python3 tools/templates.py && node tools/render-templates.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1200 } });
  await p.goto('file://' + path.join(root, 'build/templates.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  for (const el of await p.$$('.tpl')) {
    const id = (await el.getAttribute('id')).slice(2);
    await el.screenshot({ path: path.join(root, 'assets/templates', id + '.png'), omitBackground: true });
    console.log('rendered', id);
  }
  await b.close();
})();
