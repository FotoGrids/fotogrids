/**
 * Tests for small admin init modules:
 *   - dashboard-widget.js
 *   - shortcode-column-init.js
 *   - admin-header.js
 *
 * Each is an IIFE/auto-init module; we prepare the DOM + globals, then
 * isolate-require so init() runs against our fixture.
 */

const flushAsync = async () => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe('dashboard-widget', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div class="fotogrids-dw-header-right">
				<div class="fotogrids-dw-create">
					<button
						class="fotogrids-dw-create-toggle"
						aria-expanded="false"
						aria-controls="fotogrids-dw-create-menu"
					></button>
					<div class="fotogrids-dw-create-menu" id="fotogrids-dw-create-menu" hidden>
						<a href="#gallery">Gallery</a>
						<a href="#album">Album</a>
					</div>
				</div>
			</div>
			<div class="fotogrids-dw-news">
				<div id="fotogrids-dw-news-list"></div>
			</div>
		`;
		window.fotogridsDashboard = {
			restUrl: 'https://x/wp-json/fotogrids/v1/',
			restNonce: 'n',
			pluginUrl: '/p/',
		};
		global.wp.apiFetch = jest.fn();
		global.wp.apiFetch.use = jest.fn();
		global.wp.apiFetch.createNonceMiddleware = jest.fn(() => 'mw');
	});

	afterEach(() => {
		delete window.fotogridsDashboard;
		document.body.innerHTML = '';
	});

	const load = () =>
		jest.isolateModules(() => require('@/admin/src/dashboard-widget'));

	const newsHtml = () =>
		document.getElementById('fotogrids-dw-news-list').innerHTML;

	it('bails when restUrl is missing', () => {
		delete window.fotogridsDashboard;
		expect(() => load()).not.toThrow();
	});

	it('renders fetched news items into the list', async () => {
		global.wp.apiFetch.mockResolvedValue({
			enabled: true,
			items: [
				{
					title: 'Hello',
					summary: 'World',
					url: 'https://x.test',
					date_label: 'May 1, 2026',
				},
			],
		});
		load();
		await flushAsync();
		const html = newsHtml();
		expect(html).toContain('Hello');
		expect(html).toContain('World');
		expect(html).toContain('May 1, 2026');
		expect(html).toContain('href="https://x.test"');
	});

	it('tags every item as New', async () => {
		global.wp.apiFetch.mockResolvedValue({
			enabled: true,
			items: [
				{ title: 'One', url: 'https://x.test' },
				{ title: 'Two', url: 'https://y.test' },
			],
		});
		load();
		await flushAsync();
		expect(
			document.querySelectorAll('.fotogrids-dw-news-tag')
		).toHaveLength(2);
	});

	it('renders a title without a link when the item has no url', async () => {
		global.wp.apiFetch.mockResolvedValue({
			enabled: true,
			items: [{ title: 'Unlinked' }],
		});
		load();
		await flushAsync();
		expect(newsHtml()).toContain('Unlinked');
		expect(newsHtml()).not.toContain('<a');
	});

	it('caps the list at four items', async () => {
		global.wp.apiFetch.mockResolvedValue({
			enabled: true,
			items: Array.from({ length: 7 }, (_, i) => ({
				title: `Item ${i}`,
				url: 'https://x.test',
			})),
		});
		load();
		await flushAsync();
		expect(
			document.querySelectorAll('.fotogrids-dw-news-item')
		).toHaveLength(4);
	});

	it('shows an empty state when there is no news', async () => {
		global.wp.apiFetch.mockResolvedValue({ enabled: true, items: [] });
		load();
		await flushAsync();
		expect(document.querySelector('.fotogrids-dw-empty')).not.toBeNull();
	});

	it('shows an error state when the request fails', async () => {
		global.wp.apiFetch.mockRejectedValue(new Error('boom'));
		load();
		await flushAsync();
		expect(document.querySelector('.fotogrids-dw-empty')).not.toBeNull();
	});

	it('hides the whole section when the feed is turned off', async () => {
		global.wp.apiFetch.mockResolvedValue({ enabled: false, items: [] });
		load();
		await flushAsync();
		expect(document.querySelector('.fotogrids-dw-news').hidden).toBe(true);
	});

	it('falls back to the empty state for an unusable response shape', async () => {
		global.wp.apiFetch.mockResolvedValue({ unexpected: 'string' });
		load();
		await flushAsync();
		expect(document.querySelector('.fotogrids-dw-empty')).not.toBeNull();
	});

	it('escapes HTML in news titles and summaries', async () => {
		global.wp.apiFetch.mockResolvedValue({
			enabled: true,
			items: [
				{
					title: '<b>x</b>',
					summary: '<i>y</i>',
					url: 'https://x.test',
				},
			],
		});
		load();
		await flushAsync();
		const html = newsHtml();
		expect(html).toContain('&lt;b&gt;');
		expect(html).toContain('&lt;i&gt;');
	});

	describe('create menu', () => {
		const toggle = () =>
			document.querySelector('.fotogrids-dw-create-toggle');
		const menu = () => document.getElementById('fotogrids-dw-create-menu');

		beforeEach(() => {
			global.wp.apiFetch.mockResolvedValue({ enabled: true, items: [] });
		});

		it('opens on click and reflects the state on the toggle', () => {
			load();
			toggle().click();
			expect(menu().hidden).toBe(false);
			expect(toggle().getAttribute('aria-expanded')).toBe('true');
		});

		it('closes on a second click', () => {
			load();
			toggle().click();
			toggle().click();
			expect(menu().hidden).toBe(true);
			expect(toggle().getAttribute('aria-expanded')).toBe('false');
		});

		it('closes on Escape', () => {
			load();
			toggle().click();
			document.dispatchEvent(
				new window.KeyboardEvent('keydown', { key: 'Escape' })
			);
			expect(menu().hidden).toBe(true);
		});

		it('closes when clicking outside', () => {
			load();
			toggle().click();
			document.body.click();
			expect(menu().hidden).toBe(true);
		});

		it('wires up even without a news list', () => {
			document.getElementById('fotogrids-dw-news-list').remove();
			load();
			toggle().click();
			expect(menu().hidden).toBe(false);
		});
	});
});

describe('shortcode-column-init', () => {
	beforeEach(() => {
		window.FotoGridsIcons = { copy: '<svg id="copy-svg"></svg>' };
		document.body.innerHTML = `
			<table>
				<td class="column-fotogrids_shortcode">
					<span class="fotogrids-icon" data-icon="copy"></span>
					<button class="fotogrids-shortcode-copy-btn" data-shortcode="[fg id=1]"></button>
				</td>
			</table>
		`;
	});

	afterEach(() => {
		delete window.FotoGridsIcons;
		document.body.innerHTML = '';
	});

	it('injects the shortcode column icon SVG', () => {
		jest.isolateModules(() =>
			require('@/admin/src/shortcode-column-init')
		);
		expect(document.getElementById('copy-svg')).not.toBeNull();
	});

	it('bails cleanly when the column is absent', () => {
		document.body.innerHTML = '<div></div>';
		expect(() =>
			jest.isolateModules(() =>
				require('@/admin/src/shortcode-column-init')
			)
		).not.toThrow();
	});
});

describe('admin-header', () => {
	beforeEach(() => {
		window.fotogridsAdminHeader = {
			nonce: 'n',
			ajaxUrl: 'https://x/admin-ajax.php',
		};
		document.body.innerHTML = `
			<div class="fotogrids-dismiss-container">
				<button class="fotogrids-dismiss-button" data-section="welcome"></button>
			</div>
		`;
		global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
	});

	afterEach(() => {
		delete window.fotogridsAdminHeader;
		document.body.innerHTML = '';
	});

	it('posts a dismiss request when a dismiss button is clicked', () => {
		jest.isolateModules(() => require('@/admin/src/admin-header'));
		document.dispatchEvent(new window.Event('DOMContentLoaded'));
		const btn = document.querySelector('.fotogrids-dismiss-button');
		btn.click();
		expect(global.fetch).toHaveBeenCalledWith(
			'https://x/admin-ajax.php',
			expect.objectContaining({ method: 'POST' })
		);
		expect(btn.disabled).toBe(true);
	});
});
