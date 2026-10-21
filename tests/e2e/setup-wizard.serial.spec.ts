import type { Page, Request } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor } from './support/roles';
import { getOption, setOption } from './support/site';

/**
 * The setup wizard: its steps, what each one stores, and how it follows the
 * URL.
 *
 * Usage data is only ever switched off here. Switching it on opts the site in
 * with Freemius, which this WordPress has no stand-in for.
 *
 * Serial: the wizard writes site options, which are put back afterwards.
 */

test.describe.configure({ mode: 'serial' });
test.use({ storageState: storageStateFor('administrator') });

const OPTIONS = [
	'fotogrids_user_persona',
	'fotogrids_settings_mode',
	'fotogrids_share_statistics',
	'fotogrids_marketing_allowed',
] as const;

const DASHBOARD = '/wp-admin/admin.php?page=fotogrids-dashboard';

const HEADINGS = [
	'Welcome to FotoGrids',
	'What best describes you?',
	'Pick a setup mode',
	'Create your first gallery',
];

let saved: Record<string, string | null> = {};

/** Set or delete an option, skipping a delete of one already absent. */
function putOption(name: string, value: string | null): void {
	if (null !== value || null !== getOption(name)) {
		setOption(name, value);
	}
}

function clearOptions(): void {
	for (const name of OPTIONS) {
		putOption(name, null);
	}
}

test.beforeAll(() => {
	saved = Object.fromEntries(OPTIONS.map((name) => [name, getOption(name)]));
});

test.beforeEach(() => {
	clearOptions();
});

test.afterAll(() => {
	for (const name of OPTIONS) {
		putOption(name, saved[name]);
	}
});

function wizard(page: Page) {
	return page.getByRole('dialog', { name: 'FotoGrids Setup Wizard' });
}

function heading(page: Page) {
	return wizard(page).locator('[data-fg-setup-step-heading]');
}

async function openStep(page: Page, step: number | string): Promise<void> {
	await page.goto(`${DASHBOARD}&fotogrids_setup_step=${step}`);
}

function stepInUrl(page: Page): string | null {
	return new URL(page.url()).searchParams.get('fotogrids_setup_step');
}

/** Wait for the wizard's save of one setting through admin-ajax. */
function settingWrite(page: Page, setting: string) {
	return page.waitForResponse(
		(response) =>
			response.url().includes('admin-ajax.php') &&
			(response.request().postData() ?? '').includes(setting)
	);
}

/** Every admin-ajax write the page sends, for asserting none happened. */
function recordAjaxWrites(page: Page): string[] {
	const seen: string[] = [];
	page.on('request', (request: Request) => {
		if (
			'POST' === request.method() &&
			request.url().includes('admin-ajax.php')
		) {
			seen.push(request.postData() ?? '');
		}
	});
	return seen;
}

function button(page: Page, name: string) {
	return wizard(page).getByRole('button', { name, exact: true });
}

/** Persona and setup mode are stored as they are picked, and the four steps run in order. */
test(
	'WIZ-01: the four steps store the persona and the setup mode',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		await openStep(page, 1);
		await expect(heading(page)).toHaveText(HEADINGS[0]);

		await button(page, 'Start Setup').click();
		await expect(heading(page)).toHaveText(HEADINGS[1]);

		const persona = settingWrite(page, 'fotogrids_user_persona');
		await wizard(page).locator('[data-persona="photographer"]').click();
		expect((await (await persona).json()).success).toBe(true);
		await expect(
			wizard(page).locator('[data-persona="photographer"]')
		).toHaveAttribute('aria-checked', 'true');

		await button(page, 'Continue').click();
		await expect(heading(page)).toHaveText(HEADINGS[2]);

		const mode = settingWrite(page, 'fotogrids_settings_mode');
		await wizard(page)
			.getByRole('radio', { name: /^Advanced/ })
			.click();
		expect((await (await mode).json()).success).toBe(true);

		await button(page, 'Continue').click();
		await expect(heading(page)).toHaveText(HEADINGS[3]);

		await button(page, 'Finish').click();
		await expect(wizard(page)).toHaveCount(0);
		expect(stepInUrl(page)).toBeNull();

		expect(getOption('fotogrids_user_persona')).toBe('photographer');
		expect(getOption('fotogrids_settings_mode')).toBe('advanced');

		// A reopened wizard shows the stored picks.
		await openStep(page, 2);
		await expect(
			wizard(page).locator('[data-persona="photographer"]')
		).toHaveAttribute('aria-checked', 'true');
		await button(page, 'Continue').click();
		await expect(
			wizard(page).getByRole('radio', { name: /^Advanced/ })
		).toHaveAttribute('aria-checked', 'true');
	}
);

/** Skipping closes the wizard from any step and writes nothing. */
test(
	'WIZ-03: Skip for now leaves every setting at its default',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		const writes = recordAjaxWrites(page);

		for (const step of [1, 2, 3, 4]) {
			await openStep(page, step);
			await expect(heading(page)).toHaveText(HEADINGS[step - 1]);

			await button(
				page,
				1 === step ? 'Skip for Now' : 'Skip for now'
			).click();

			await expect(wizard(page), `step ${step} stayed open`).toHaveCount(
				0
			);
			expect(stepInUrl(page)).toBeNull();
		}

		expect(writes).toEqual([]);
		for (const name of OPTIONS) {
			expect(getOption(name), `${name} was written`).toBeNull();
		}
	}
);

/** The step is read from the URL on load and on history navigation; an out-of-range one opens nothing. */
test(
	'WIZ-04: the step follows the URL through reload and history',
	{ tag: ['@admin'] },
	async ({ page }) => {
		await openStep(page, 2);
		await button(page, 'Continue').click();
		await expect(heading(page)).toHaveText(HEADINGS[2]);
		expect(stepInUrl(page)).toBe('3');

		await page.reload();
		await expect(heading(page)).toHaveText(HEADINGS[2]);

		// A history entry the wizard did not make, reached by Back and Forward.
		await page.evaluate(() => {
			const url = new URL(window.location.href);
			url.searchParams.set('fotogrids_setup_step', '4');
			window.history.pushState({}, '', url.toString());
		});
		await page.goBack();
		await expect(heading(page)).toHaveText(HEADINGS[2]);
		await page.goForward();
		await expect(heading(page)).toHaveText(HEADINGS[3]);

		// Leaving the param behind closes it, and gaining it opens it, without a load.
		await page.evaluate(() => {
			const url = new URL(window.location.href);
			url.searchParams.delete('fotogrids_setup_step');
			window.history.pushState({}, '', url.toString());
		});
		await page.goBack();
		await expect(heading(page)).toHaveText(HEADINGS[3]);
		await page.goForward();
		await expect(wizard(page)).toHaveCount(0);

		for (const invalid of ['0', '5', 'abc']) {
			await openStep(page, invalid);
			await expect(page.locator('#fotogrids-setup-root')).toBeAttached();
			await expect(
				wizard(page),
				`step ${invalid} opened the wizard`
			).toHaveCount(0);
		}
	}
);

/** Each step focuses its own heading, and the progress bar reports the step. */
test(
	'WIZ-05: focus lands on each step heading and the progress bar follows',
	{ tag: ['@admin'] },
	async ({ page }) => {
		const progress = () =>
			wizard(page).getByRole('progressbar', { name: 'Setup progress' });

		await openStep(page, 1);
		await expect(heading(page)).toBeFocused();
		await expect(progress()).toHaveAttribute('aria-valuenow', '1');
		await expect(progress()).toHaveAttribute('aria-valuemax', '4');

		await button(page, 'Start Setup').click();

		for (const step of [2, 3, 4]) {
			await expect(heading(page)).toHaveText(HEADINGS[step - 1]);
			await expect(heading(page)).toBeFocused();
			await expect(progress()).toHaveAttribute(
				'aria-valuenow',
				String(step)
			);

			if (step < 4) {
				await button(page, 'Continue').click();
			}
		}

		await button(page, 'Back').click();
		await expect(heading(page)).toHaveText(HEADINGS[2]);
		await expect(heading(page)).toBeFocused();
		await expect(progress()).toHaveAttribute('aria-valuenow', '3');
	}
);

/** The usage-tracking explainer opens on top of the wizard and closes on its own. */
test(
	'WIZ-06: Learn more opens a second modal over the wizard',
	{ tag: ['@admin'] },
	async ({ page }) => {
		await openStep(page, 1);
		await expect(heading(page)).toBeVisible();

		await wizard(page)
			.getByRole('button', { name: 'Learn more about usage tracking' })
			.click();

		const info = page.getByRole('dialog', { name: 'About usage tracking' });
		await expect(info).toBeVisible();
		await expect(info).toContainText('Basic profile info');
		await expect(wizard(page)).toBeVisible();

		const [infoZ, wizardZ] = await Promise.all(
			[info, wizard(page)].map((dialog) =>
				dialog.evaluate((element) => {
					const root =
						element.closest('[role="presentation"]') ?? element;
					return Number(getComputedStyle(root).zIndex) || 0;
				})
			)
		);
		expect(
			infoZ,
			'the explainer is not stacked above the wizard'
		).toBeGreaterThan(wizardZ);

		await page.keyboard.press('Escape');
		await expect(info).toHaveCount(0);
		await expect(
			wizard(page),
			'Escape closed the wizard too'
		).toBeVisible();
		expect(stepInUrl(page)).toBe('1');
	}
);

/** Turning usage data off clears and hides the product-emails consent. */
test(
	'WIZ-07: switching usage data off clears product emails',
	{ tag: ['@admin', '@settings'] },
	async ({ page }) => {
		setOption('fotogrids_share_statistics', '1');
		setOption('fotogrids_marketing_allowed', '1');

		await openStep(page, 1);
		const telemetry = page.locator('#fotogrids-setup-telemetry');
		const marketing = page.locator('#fotogrids-setup-marketing');
		await expect(telemetry).toHaveAttribute('aria-checked', 'true');
		await expect(marketing).toHaveAttribute('aria-checked', 'true');

		const write = settingWrite(page, 'fotogrids_share_statistics');
		await telemetry.click();
		expect((await (await write).json()).success).toBe(true);

		await expect(marketing).toHaveCount(0);
		expect(['', '0']).toContain(getOption('fotogrids_marketing_allowed'));
		expect(['', '0']).toContain(getOption('fotogrids_share_statistics'));

		// Still off when the wizard is opened again.
		await openStep(page, 1);
		await expect(telemetry).toHaveAttribute('aria-checked', 'false');
		await expect(marketing).toHaveCount(0);
	}
);

/** The wizard's save handler writes only the options it names. */
test(
	'WIZ-08: the wizard save handler refuses an option outside its list',
	{ tag: ['@api', '@settings'] },
	async ({ page }) => {
		await page.goto(DASHBOARD);
		const nonce = await page.evaluate(
			() =>
				(window as unknown as { fotogridsAdmin: { nonce: string } })
					.fotogridsAdmin.nonce
		);
		const before = getOption('blogname');

		const post = (setting: string, value: string) =>
			page.request.post('/wp-admin/admin-ajax.php', {
				form: {
					action: 'fotogrids_update_plugin_setting',
					nonce,
					setting,
					value,
				},
			});

		const refused = await post('blogname', 'Rewritten by the wizard');
		expect(await refused.json()).toEqual({
			success: false,
			data: { message: 'Invalid setting' },
		});
		expect(getOption('blogname')).toBe(before);

		const badValue = await post('fotogrids_user_persona', 'astronaut');
		expect(await badValue.json()).toEqual({
			success: false,
			data: { message: 'Invalid value' },
		});
		expect(getOption('fotogrids_user_persona')).toBeNull();

		const allowed = await post('fotogrids_user_persona', 'agency');
		expect((await allowed.json()).success).toBe(true);
		expect(getOption('fotogrids_user_persona')).toBe('agency');
	}
);

/** The template card opens the Templates screen in its choose mode. */
test(
	'WIZ-09: Choose a template opens Templates in choose mode',
	{ tag: ['@admin'] },
	async ({ page }) => {
		await openStep(page, 4);
		await wizard(page)
			.getByRole('button', { name: /Choose a template/ })
			.click();

		await page.waitForURL(/page=fotogrids-templates/);
		const url = new URL(page.url());
		expect(url.searchParams.get('page')).toBe('fotogrids-templates');
		expect(url.searchParams.get('fg_choose')).toBe('1');
		expect(url.searchParams.get('fotogrids_setup_step')).toBeNull();

		await expect(
			page.locator('.fotogrids-templates-page__choose-bar')
		).toContainText(
			'Pick a template and we’ll open a new gallery with it applied.'
		);
		const use = page.getByRole('button', { name: 'Use this template' });
		await expect(use.first()).toBeVisible({ timeout: 20000 });
		await expect(
			page.getByRole('button', { name: 'Apply', exact: true })
		).toHaveCount(0);
	}
);
