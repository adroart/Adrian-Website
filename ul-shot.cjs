const { chromium } = require('@playwright/test');
async function clearEntrance(p) {
  for (let i = 0; i < 8; i++) {
    const e = p.getByRole('dialog', { name: /card entrance/i });
    if (await e.count() === 0) return;
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(250);
    if (await e.count() > 0) { await p.mouse.click(20, 20).catch(() => {}); await p.waitForTimeout(350); }
  }
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8888/oracle/universal-language/42', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700); await clearEntrance(p);
  for (let attempt = 0; attempt < 16; attempt++) {
    await clearEntrance(p);
    const castBtn = p.getByRole('button', { name: /cast (the coins|again)/i }).first();
    if (await castBtn.count() === 0) { await p.waitForTimeout(400); continue; }
    await castBtn.scrollIntoViewIfNeeded();
    await castBtn.click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(3800);
    const becoming = p.getByRole('button', { name: /Preview Code \d+/ });
    if (await becoming.count() > 0 && await becoming.isVisible()) {
      await becoming.click({ timeout: 5000 });
      const dlg = p.getByRole('dialog', { name: /Preview of Code/i });
      const img = dlg.locator('img').first();
      await img.waitFor({ state: 'visible', timeout: 5000 });
      // wait for the image to actually decode
      await p.waitForTimeout(2500);
      const info = await img.evaluate(el => ({
        src: el.currentSrc || el.src,
        naturalW: el.naturalWidth, naturalH: el.naturalHeight,
        complete: el.complete,
      }));
      console.log(JSON.stringify(info, null, 2));
      await p.screenshot({ path: '/tmp/claude/cast-modal.png' });
      break;
    }
  }
  await b.close();
})();
