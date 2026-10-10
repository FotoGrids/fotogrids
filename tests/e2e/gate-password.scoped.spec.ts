import { test, expect } from './support/test';
import { galleryPage, passwordGalleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';

/**
 * The password gate: what a locked gallery puts in the page, what unlocks it,
 * and what the unlock is remembered by.
 *
 * scoped: each test makes its own gallery and its own browser context.
 *
 * A locked render ships no runtime, so the wrapper is `fotogrids-gate` rather
 * than `fotogrids-collection` - which is what keeps the gallery JS from
 * initialising on a gate.
 */

const PASSWORD = 'open-sesame';
const FIVE = fixture<number[]>('F-small', 'items');

/** The lock screen's own elements. */
const GATE = '.fotogrids-gate';
const FORM = '.fg-lock-form';

test.describe('a locked gallery', () => {
	test(
		'GATE-01: renders the lock card over a ghost grid',
		{ tag: ['@gate', '@critical'] },
		async ({ page }) => {
			const { id, url } = passwordGalleryPage(PASSWORD);

			const response = await page.goto(url);

			// GATE-08: the page is a page; the gate is inside it.
			expect(
				response?.status(),
				'a locked gallery is not an HTTP error'
			).toBe(200);

			const gate = page.locator(GATE);
			await expect(gate).toBeVisible();
			expect(await gate.getAttribute('data-fg-gallery-id')).toBe(
				String(id)
			);

			await expect(gate.locator('.fg-ghost-cell')).toHaveCount(9);
			await expect(gate.locator('.fg-gate-card')).toBeVisible();
			await expect(gate.locator(FORM)).toBeVisible();

			// Nothing of the gallery itself: no items, and not the class the
			// runtime looks for.
			await expect(page.locator('.fg-item')).toHaveCount(0);
			await expect(page.locator('.fotogrids-collection')).toHaveCount(0);
		}
	);

	// The refusal this row exists to drive is a 401, which the browser logs as
	// a failed request. Scoped to this block so every other row keeps the gate.
	test.describe('given a wrong password', () => {
		test.use({
			allowConsoleErrors:
				'the row drives a 401, which the browser logs as a failed request',
		});

		test(
			'GATE-03: it is refused and the gate stays',
			{ tag: '@gate' },
			async ({ page }) => {
				const { url } = passwordGalleryPage(PASSWORD);

				await page.goto(url);
				await expect(page.locator(GATE)).toBeVisible();

				const refused = page.waitForResponse(
					(response) =>
						response.url().includes('/unlock') &&
						401 === response.status()
				);

				await page
					.locator(`${FORM} input[name="password"]`)
					.fill('not-the-password');
				await page.locator(`${FORM} [type="submit"]`).click();

				await refused;

				await expect(
					page.locator(GATE),
					'the gate was replaced anyway'
				).toBeVisible();
				await expect(page.locator('.fg-item')).toHaveCount(0);
			}
		);
	});

	test(
		'GATE-02: the right password swaps the gallery in',
		{ tag: ['@gate', '@critical'] },
		async ({ page }) => {
			const { id, url } = passwordGalleryPage(PASSWORD);
			const gallery = new GalleryRender(page, id);

			await page.goto(url);
			await expect(page.locator(GATE)).toBeVisible();

			await page.locator(`${FORM} input[name="password"]`).fill(PASSWORD);
			await page.locator(`${FORM} [type="submit"]`).click();

			await gallery.waitFor();
			await expect(gallery.items()).toHaveCount(FIVE.length);
			await expect(page.locator(GATE)).toHaveCount(0);
		}
	);
});

/**
 * GATE-05 and GATE-06. The unlock is remembered only when the gallery says so,
 * and the cookie it is remembered by is `httponly` - a script on the page
 * cannot read it, which is why these rows read it from the context.
 */
test.describe('remembering an unlock', () => {
	/** Unlock in a context of its own and hand back the cookies it collected. */
	async function unlock(
		browser: import('@playwright/test').Browser,
		url: string
	) {
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto(url);
		await page.locator(`${FORM} input[name="password"]`).fill(PASSWORD);
		await page.locator(`${FORM} [type="submit"]`).click();
		await expect(page.locator(GATE)).toHaveCount(0);

		const cookies = await context.cookies();

		return { context, page, cookies };
	}

	test(
		'GATE-05: with remembering on, the cookie is set and scoped',
		{ tag: '@gate' },
		async ({ browser }) => {
			const days = 9;
			const { id, url } = passwordGalleryPage(PASSWORD, {
				password_remember: true,
				password_remember_days: days,
			});

			const { context, cookies } = await unlock(browser, url);

			try {
				const cookie = cookies.find(
					(c) => c.name === `fotogrids_unlocked_${id}`
				);
				expect(cookie, 'no unlock cookie was set').toBeTruthy();

				expect(
					cookie?.httpOnly,
					'a script could read the unlock cookie'
				).toBe(true);
				expect(cookie?.sameSite).toBe('Lax');
				// The site is served over http here, so secure follows is_ssl().
				expect(cookie?.secure).toBe(false);

				// Expiry within a day of the configured window: the assertion is
				// which setting it came from, not the clock.
				const inDays =
					((cookie?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
				expect(inDays).toBeGreaterThan(days - 1);
				expect(inDays).toBeLessThan(days + 1);
			} finally {
				await context.close();
			}
		}
	);

	test(
		'GATE-05: the remembered unlock survives a reload',
		{ tag: '@gate' },
		async ({ browser }) => {
			const { id, url } = passwordGalleryPage(PASSWORD, {
				password_remember: true,
			});
			const { context, page } = await unlock(browser, url);

			try {
				await page.reload();

				const gallery = new GalleryRender(page, id);
				await gallery.waitFor();
				await expect(gallery.items()).toHaveCount(FIVE.length);
				await expect(page.locator(GATE)).toHaveCount(0);
			} finally {
				await context.close();
			}
		}
	);

	test(
		'GATE-06: with remembering off, no cookie and the reload re-locks',
		{
			tag: '@gate',
		},
		async ({ browser }) => {
			const { id, url } = passwordGalleryPage(PASSWORD, {
				password_remember: false,
			});
			const { context, page, cookies } = await unlock(browser, url);

			try {
				expect(
					cookies.find((c) => c.name === `fotogrids_unlocked_${id}`),
					'an unlock was remembered that the gallery did not ask to remember'
				).toBeUndefined();

				await page.reload();

				await expect(page.locator(GATE)).toBeVisible();
				await expect(page.locator('.fg-item')).toHaveCount(0);
			} finally {
				await context.close();
			}
		}
	);

	/**
	 * GATE-07. The cookie value is an HMAC over the gallery id and its stored
	 * password, so it unlocks the one gallery it was issued for.
	 *
	 * The two galleries are given the *same* stored ciphertext. Encryption is
	 * salted, so two galleries that merely share a plaintext already have
	 * different stored values and different digests - the row would pass
	 * without the gallery id in the HMAC at all, which is what it is here to
	 * check. With the ciphertext equal, the id is the only thing left.
	 */
	test(
		'GATE-07: an unlock cookie opens only the gallery it came from',
		{
			tag: ['@gate', '@critical'],
		},
		async ({ browser }) => {
			const first = passwordGalleryPage(PASSWORD, {
				password_remember: true,
			});
			const second = passwordGalleryPage(PASSWORD, {
				password_remember: true,
			});

			wpEval(
				`update_post_meta( ${second.id}, 'fotogrids_password', ` +
					`get_post_meta( ${first.id}, 'fotogrids_password', true ) );`
			);

			const { context, cookies } = await unlock(browser, first.url);

			try {
				const cookie = cookies.find(
					(c) => c.name === `fotogrids_unlocked_${first.id}`
				);
				expect(cookie).toBeTruthy();

				// The same value under the other gallery's cookie name: the name
				// alone must not be what unlocks it.
				await context.addCookies([
					{
						name: `fotogrids_unlocked_${second.id}`,
						value: String(cookie?.value),
						domain: cookie?.domain ?? '127.0.0.1',
						path: cookie?.path ?? '/',
					},
				]);

				const page = await context.newPage();
				await page.goto(second.url);

				await expect(
					page.locator(GATE),
					"the first gallery's cookie unlocked the second"
				).toBeVisible();
				await expect(page.locator('.fg-item')).toHaveCount(0);
			} finally {
				await context.close();
			}
		}
	);
});

/**
 * GATE-11. A blocked render ships no runtime, so there is no device class for
 * the ghost grid's CSS to select on and it scopes by width instead. The widths
 * are the site's configured breakpoints rather than fixed ones.
 */
test.describe('the gate grid', () => {
	test(
		'GATE-11: the ghost grid follows the gallery column counts',
		{
			tag: ['@gate', '@layout'],
		},
		async ({ page }) => {
			const columns = { desktop: 4, tablet: 3, mobile: 2 };
			const { url } = passwordGalleryPage(PASSWORD, { columns });

			for (const [name, width] of [
				['desktop', 1280],
				['tablet', 820],
				['mobile', 390],
			] as const) {
				await page.setViewportSize({ width, height: 900 });
				await page.goto(url);

				const gate = page.locator(GATE);
				await expect(gate).toBeVisible();

				const cols = await gate.evaluate((element) =>
					getComputedStyle(element)
						.getPropertyValue('--fg-cols')
						.trim()
				);

				expect(cols, `--fg-cols at ${name}`).toBe(
					String(columns[name as keyof typeof columns])
				);
			}
		}
	);
});

/**
 * GATE-09. `who_can_view = registered_users` is a different gate: no form to
 * fill, just a marker and a way back in.
 */
test.describe('a registered-users gallery', () => {
	test(
		'GATE-09: an anonymous visitor is shown the gate, not the items',
		{
			tag: ['@gate', '@critical'],
		},
		async ({ page }) => {
			const { url } = galleryPage({ who_can_view: 'registered_users' });

			const response = await page.goto(url);
			expect(response?.status()).toBe(200);

			const gate = page.locator(GATE);
			await expect(gate).toBeVisible();
			expect(await gate.getAttribute('data-fg-restricted')).toBe(
				'registered-users'
			);

			await expect(page.locator('.fg-item')).toHaveCount(0);
			await expect(
				page.locator(FORM),
				'a password form on a login gate'
			).toHaveCount(0);
		}
	);

	test(
		'GATE-09: the way back in returns to the page that was asked for',
		{
			tag: '@gate',
		},
		async ({ page }) => {
			const { url } = galleryPage({ who_can_view: 'registered_users' });

			await page.goto(url);

			const login = page
				.locator(`${GATE} a[href*="wp-login.php"]`)
				.first();
			await expect(login).toBeVisible();

			const href = String(await login.getAttribute('href'));
			const redirect = new URL(href, url).searchParams.get('redirect_to');

			expect(
				redirect,
				'the login link loses the page the visitor wanted'
			).toBe(url);
		}
	);
});
