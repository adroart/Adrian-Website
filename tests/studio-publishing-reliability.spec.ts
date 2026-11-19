import { expect, test } from './fixtures';

const poem = {
    id: 'fixture-song', slug: 'fixture-song', title: 'Fixture song',
    audioUrl: 'https://audio.adrianrasmussen.com/fixture.mp3', duration: '1:00',
    releaseDate: '', poem: [{ lines: ['A line'] }],
};
const file = { key: 'fixture.mp3', url: poem.audioUrl, size: 1000, uploaded: '2026-01-01T00:00:00Z' };

test('a nonempty live poetry list keeps First Light available', async ({ page }, testInfo) => {
    await page.route('/api/poems', route => route.fulfill({ json: { ok: true, poems: [poem] } }));
    await page.goto('/poetry');
    await expect(page.getByRole('link', { name: 'Open Fixture song' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open First Light' })).toBeVisible();
    if (process.env.STUDIO_SCREENSHOTS) await page.screenshot({ path: `${process.env.STUDIO_SCREENSHOTS}/poetry-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
});

test('a live revision of First Light replaces its built-in track', async ({ page }) => {
    await page.route('/api/poems', route => route.fulfill({ json: { ok: true, poems: [{ ...poem, slug: 'first-light', title: 'First Light revised' }] } }));
    await page.goto('/poetry');
    await expect(page.getByRole('link', { name: 'Open First Light revised', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open First Light', exact: true })).toHaveCount(0);
});

for (const target of [
    { route: '/admin/poetry', endpoint: '**/api/poems?slug=*', button: 'Delete', retained: 'Fixture song' },
    { route: '/admin/book', endpoint: '**/api/book?id=*', button: 'Clear', retained: 'Doorways Of The Unknown' },
    { route: '/admin/files', endpoint: '**/api/delete-file?key=*', button: 'Delete', retained: 'fixture.mp3', confirmButton: true },
]) {
    for (const failure of ['http', 'application', 'network']) {
        test(`${target.route} ${failure} failure keeps the published entry when deleting fails and lets the Studio retry`, async ({ page }, testInfo) => {
            let attempts = 0;
            await page.route('/api/admin/verify', route => route.fulfill({ json: { ok: true, admin: { id: 'admin', email: 'studio@example.test' } } }));
            await page.route('/api/poems', route => route.fulfill({ json: { ok: true, poems: attempts >= 2 ? [] : [poem] } }));
            await page.route('/api/book', route => route.fulfill({ json: { ok: true, entries: attempts >= 2 ? [] : [{ id: 'UL-102', body: ['A published book page'] }] } }));
            await page.route('/api/upload-music', route => route.fulfill({ json: { ok: true, files: [file] } }));
            await page.route(target.endpoint, async route => {
                attempts += 1;
                if (attempts === 1 && failure === 'network') return route.abort('failed');
                await route.fulfill({ status: attempts === 1 && failure === 'http' ? 503 : 200, json: attempts === 1 ? { ok: false } : { ok: true } });
            });
            page.on('dialog', dialog => dialog.accept());
            await page.goto(target.route);
            const remove = page.getByRole('button', { name: target.button, exact: true }).first();
            const clickRemove = async () => {
                await remove.click();
                if (target.confirmButton) await page.getByRole('button', { name: 'Confirm', exact: true }).click();
            };
            await clickRemove();
            await expect(page.getByRole('alert').filter({ hasText: /Delete failed/ })).toBeVisible();
            await expect(page.locator('p').filter({ hasText: new RegExp(target.retained) }).first()).toBeVisible();
            await expect(remove).toBeEnabled();
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            if (failure === 'http' && process.env.STUDIO_SCREENSHOTS) {
                await page.screenshot({ path: `${process.env.STUDIO_SCREENSHOTS}/${target.route.split('/').pop()}-retry-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
            }
            await clickRemove();
            await expect.poll(() => attempts).toBe(2);
            await expect(remove).toHaveCount(0);
        });
    }
}
