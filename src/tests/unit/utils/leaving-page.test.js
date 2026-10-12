/**
 * Tests for src/assets/admin/src/utils/leaving-page.js
 */
import { isLeavingPage } from '@/admin/src/utils/leaving-page';

describe('utils/leaving-page', () => {
	afterEach(() => {
		window.dispatchEvent(new Event('pageshow'));
	});

	it('is false while the page is open', () => {
		expect(isLeavingPage()).toBe(false);
	});

	it.each(['beforeunload', 'pagehide'])('is true after %s', (type) => {
		window.dispatchEvent(new Event(type));
		expect(isLeavingPage()).toBe(true);
	});

	it('is false again once the page is shown', () => {
		window.dispatchEvent(new Event('pagehide'));
		window.dispatchEvent(new Event('pageshow'));
		expect(isLeavingPage()).toBe(false);
	});
});
