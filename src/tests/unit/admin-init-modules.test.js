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
		jest.useFakeTimers();
		document.body.innerHTML =
			'<div id="fotogrids-dw-news-list"></div>';
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
		jest.useRealTimers();
		delete window.fotogridsDashboard;
		document.body.innerHTML = '';
	});

	const load = () =>
		jest.isolateModules(() => require('@/admin/src/dashboard-widget'));

	it('bails when restUrl is missing', () => {
		delete window.fotogridsDashboard;
		expect(() => load()).not.toThrow();
	});

	it('renders fetched news items into the list', async () => {
		global.wp.apiFetch.mockResolvedValue([
			{ title: 'Hello', description: 'World', url: 'https://x.test' },
		]);
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		expect(document.getElementById('fotogrids-dw-news-list').innerHTML).toContain(
			'Hello'
		);
	});

	it('shows an empty state when there is no news', async () => {
		global.wp.apiFetch.mockResolvedValue([]);
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		expect(
			document.querySelector('.fotogrids-dw-empty')
		).not.toBeNull();
	});

	it('shows an error state when the request fails', async () => {
		const err = jest.spyOn(console, 'error').mockImplementation(() => {});
		global.wp.apiFetch.mockRejectedValue(new Error('boom'));
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		expect(
			document.querySelector('.fotogrids-dw-empty')
		).not.toBeNull();
		err.mockRestore();
	});

	it('normalizes a { data: [...] } response shape', async () => {
		global.wp.apiFetch.mockResolvedValue({
			data: [{ title: 'Wrapped', description: 'd', url: 'https://x.test' }],
		});
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		expect(
			document.getElementById('fotogrids-dw-news-list').innerHTML
		).toContain('Wrapped');
	});

	it('normalizes an object whose first value is the news array', async () => {
		global.wp.apiFetch.mockResolvedValue({
			items: [{ title: 'FirstVal', description: 'd', url: 'https://x.test' }],
		});
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		expect(
			document.getElementById('fotogrids-dw-news-list').innerHTML
		).toContain('FirstVal');
	});

	it('falls back to the empty state for an unusable response shape', async () => {
		global.wp.apiFetch.mockResolvedValue({ unexpected: 'string' });
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		expect(document.querySelector('.fotogrids-dw-empty')).not.toBeNull();
	});

	it('escapes HTML in news titles/descriptions', async () => {
		global.wp.apiFetch.mockResolvedValue([
			{ title: '<b>x</b>', description: '<i>y</i>', url: 'https://x.test' },
		]);
		load();
		jest.advanceTimersByTime(150);
		await flushAsync();
		const html = document.getElementById('fotogrids-dw-news-list').innerHTML;
		expect(html).toContain('&lt;b&gt;');
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
