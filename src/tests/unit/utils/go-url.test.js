/**
 * Tests for src/assets/admin/src/utils/go-url.js
 */
import { fgGoUrl } from '@/admin/src/utils/go-url';

describe('utils/fgGoUrl', () => {
	it('builds a go.fotogrids.com URL with the standard UTM params', () => {
		const url = fgGoUrl('free-vs-pro/', 'upgrade-modal', 'comparison');
		expect(url).toContain('https://go.fotogrids.com/free-vs-pro/?');
		expect(url).toContain('utm_source=plugin');
		expect(url).toContain('utm_medium=upgrade-modal');
		expect(url).toContain('utm_campaign=comparison');
	});

	it('always sets utm_source to "plugin"', () => {
		const url = fgGoUrl('x', 'medium', 'campaign');
		const params = new URL(url).searchParams;
		expect(params.get('utm_source')).toBe('plugin');
		expect(params.get('utm_medium')).toBe('medium');
		expect(params.get('utm_campaign')).toBe('campaign');
	});

	it('omits utm_content when not provided', () => {
		const url = fgGoUrl('x', 'm', 'c');
		expect(url).not.toContain('utm_content');
	});

	it('adds utm_content when provided', () => {
		const url = fgGoUrl('x', 'm', 'c', 'nuance');
		expect(new URL(url).searchParams.get('utm_content')).toBe('nuance');
	});

	it('does not add utm_content for an empty-string content', () => {
		const url = fgGoUrl('x', 'm', 'c', '');
		expect(url).not.toContain('utm_content');
	});

	it('strips a single leading slash from the path', () => {
		const url = fgGoUrl('/pricing', 'm', 'c');
		expect(url).toContain('https://go.fotogrids.com/pricing?');
		expect(url).not.toContain('go.fotogrids.com//');
	});

	it('strips multiple leading slashes from the path', () => {
		const url = fgGoUrl('///deep/path', 'm', 'c');
		expect(url).toContain('https://go.fotogrids.com/deep/path?');
	});

	it('leaves a path without a leading slash unchanged', () => {
		const url = fgGoUrl('deep/path', 'm', 'c');
		expect(url).toContain('https://go.fotogrids.com/deep/path?');
	});

	it('url-encodes special characters in UTM values', () => {
		const url = fgGoUrl('p', 'a b', 'c&d');
		const params = new URL(url).searchParams;
		expect(params.get('utm_medium')).toBe('a b');
		expect(params.get('utm_campaign')).toBe('c&d');
	});
});
