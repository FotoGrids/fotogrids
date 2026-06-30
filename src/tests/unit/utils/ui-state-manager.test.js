/**
 * Tests for src/assets/admin/src/utils/ui-state-manager.js
 *
 * The module is an IIFE that attaches FotoGridsUiState to window.
 */
import '@/admin/src/utils/ui-state-manager';

describe('utils/ui-state-manager', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		// reset URL to a clean slate (relative path keeps jsdom's origin)
		window.history.replaceState({}, '', '/wp-admin/');
	});

	it('exposes createNamespace on window', () => {
		expect(typeof window.FotoGridsUiState.createNamespace).toBe('function');
	});

	describe('session storage round-trip', () => {
		it('returns the fallback when nothing is stored', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'gallery-items',
				postId: 42,
			});
			expect(ns.getValue({ key: 'main-tab', fallback: 'manage' })).toBe(
				'manage'
			);
		});

		it('persists and reads back a string value', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'gallery-items',
				postId: 42,
			});
			ns.setValue({ key: 'main-tab', value: 'preview' });
			expect(ns.getValue({ key: 'main-tab', fallback: 'manage' })).toBe(
				'preview'
			);
		});

		it('persists and reads back an object value', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'gallery-items',
				postId: 42,
			});
			ns.setValue({ key: 'subtabs', value: { styling: 'thumbnails' } });
			expect(ns.getValue({ key: 'subtabs', fallback: {} })).toEqual({
				styling: 'thumbnails',
			});
		});

		it('clearValue removes the persisted value', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			ns.setValue({ key: 'k', value: 'v' });
			ns.clearValue({ key: 'k' });
			expect(ns.getValue({ key: 'k', fallback: 'fb' })).toBe('fb');
		});
	});

	describe('global vs post-scoped namespaces', () => {
		it('keeps global and post namespaces independent', () => {
			const globalNs = window.FotoGridsUiState.createNamespace({
				area: 'settings',
			});
			const postNs = window.FotoGridsUiState.createNamespace({
				area: 'settings',
				postId: 7,
			});
			globalNs.setValue({ key: 'tab', value: 'global-tab' });
			postNs.setValue({ key: 'tab', value: 'post-tab' });
			expect(globalNs.getValue({ key: 'tab', fallback: '' })).toBe(
				'global-tab'
			);
			expect(postNs.getValue({ key: 'tab', fallback: '' })).toBe(
				'post-tab'
			);
		});

		it('defaults the area to "unknown" when omitted', () => {
			const ns = window.FotoGridsUiState.createNamespace({});
			ns.setValue({ key: 'x', value: 'y' });
			const key = Object.keys(window.sessionStorage).find((k) =>
				k.includes('unknown')
			);
			expect(key).toBeDefined();
		});
	});

	describe('allowed-value validation', () => {
		it('returns the fallback when the stored value is not allowed', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			ns.setValue({ key: 'tab', value: 'bogus' });
			expect(
				ns.getValue({
					key: 'tab',
					fallback: 'manage',
					allowed: ['manage', 'preview'],
				})
			).toBe('manage');
		});

		it('returns the stored value when it is allowed', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			ns.setValue({ key: 'tab', value: 'preview' });
			expect(
				ns.getValue({
					key: 'tab',
					fallback: 'manage',
					allowed: ['manage', 'preview'],
				})
			).toBe('preview');
		});
	});

	describe('URL adapter', () => {
		it('reads from the URL param when present, beating session', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			ns.setValue({ key: 'main-tab', value: 'session-value' });
			window.history.replaceState(
				{},
				'',
				'/wp-admin/?tab=url-value'
			);
			expect(
				ns.getValue({
					key: 'main-tab',
					fallback: 'fb',
					urlParam: 'tab',
				})
			).toBe('url-value');
		});

		it('writes a string value to the URL when urlParam is given', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			ns.setValue({ key: 'main-tab', value: 'preview', urlParam: 'tab' });
			expect(window.location.search).toContain('tab=preview');
		});

		it('does not write objects to the URL', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			ns.setValue({
				key: 'subtabs',
				value: { a: 'b' },
				urlParam: 'sub',
			});
			expect(window.location.search).not.toContain('sub=');
		});

		it('clearValue removes the URL param', () => {
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			window.history.replaceState(
				{},
				'',
				'/wp-admin/?tab=preview'
			);
			ns.clearValue({ key: 'main-tab', urlParam: 'tab' });
			expect(window.location.search).not.toContain('tab=');
		});
	});

	describe('storage error resilience', () => {
		it('survives sessionStorage.getItem throwing', () => {
			const spy = jest
				.spyOn(Storage.prototype, 'getItem')
				.mockImplementation(() => {
					throw new Error('private mode');
				});
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			expect(ns.getValue({ key: 'k', fallback: 'fb' })).toBe('fb');
			spy.mockRestore();
		});

		it('survives sessionStorage.setItem throwing', () => {
			const spy = jest
				.spyOn(Storage.prototype, 'setItem')
				.mockImplementation(() => {
					throw new Error('full');
				});
			const ns = window.FotoGridsUiState.createNamespace({
				area: 'a',
				postId: 1,
			});
			expect(() => ns.setValue({ key: 'k', value: 'v' })).not.toThrow();
			spy.mockRestore();
		});
	});
});
