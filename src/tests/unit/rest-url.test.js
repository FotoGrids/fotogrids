import { buildRestUrl } from '../../assets/admin/src/utils/rest-url';

describe('buildRestUrl', () => {
	afterEach(() => {
		delete window.fotogridsAdmin;
		window.wpApiSettings = {
			root: 'https://example.com/wp-json/',
			nonce: 'test-nonce',
		};
	});

	it('appends parameters to a pretty-permalink root', () => {
		window.fotogridsAdmin = { apiUrl: 'https://example.com/wp-json/' };

		expect(
			buildRestUrl('fotogrids/v1/metadata/tags', { _wpnonce: 'abc' })
		).toBe(
			'https://example.com/wp-json/fotogrids/v1/metadata/tags?_wpnonce=abc'
		);
	});

	it('keeps a single query string on a plain-permalink root', () => {
		window.fotogridsAdmin = {
			apiUrl: 'https://example.com/index.php?rest_route=/',
		};

		const url = new URL(
			buildRestUrl('fotogrids/v1/metadata/item/4', { _wpnonce: 'abc' })
		);

		expect(url.pathname).toBe('/index.php');
		expect(url.searchParams.get('rest_route')).toBe(
			'/fotogrids/v1/metadata/item/4'
		);
		expect(url.searchParams.get('_wpnonce')).toBe('abc');
	});

	it('falls back to wpApiSettings.root', () => {
		expect(buildRestUrl('/fotogrids/v1/items/embed')).toBe(
			'https://example.com/wp-json/fotogrids/v1/items/embed'
		);
	});

	it('skips empty parameters', () => {
		window.fotogridsAdmin = { apiUrl: 'https://example.com/wp-json/' };

		expect(
			buildRestUrl('fotogrids/v1/x', {
				a: '',
				b: null,
				c: undefined,
				d: 0,
			})
		).toBe('https://example.com/wp-json/fotogrids/v1/x?d=0');
	});
});
