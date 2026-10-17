/**
 * Tests for the browser formatter module (public/render/formatted-text/
 * formatted-text.js): FotoGrids.modules.formattedText.
 */

const EVENT = 'fotogrids:formatted_text:rendered';

function gallery(configs = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	for (const [key, value] of Object.entries(configs)) {
		el.setAttribute(key, typeof value === 'string' ? value : JSON.stringify(value));
	}
	const target = document.createElement('p');
	el.appendChild(target);
	document.body.appendChild(el);
	return { el, target };
}

const basic = {
	mode: 'basic',
	policy: { newTab: true, rel: ['nofollow'] },
	labels: { newTab: '(opens in a new tab)' },
};

describe('formatted text module', () => {
	let module;

	beforeAll(() => {
		window.FotoGrids = { modules: {} };
		jest.isolateModules(() => {
			require('../../../public/render/formatted-text/formatted-text');
		});
		module = window.FotoGrids.modules.formattedText;
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('registers a frozen module', () => {
		expect(Object.isFrozen(module)).toBe(true);
		expect(typeof module.render).toBe('function');
		expect(typeof module.toPlainText).toBe('function');
	});

	it('formats with the gallery link policy and labels new-tab links', () => {
		const { target } = gallery({ 'data-fg-text-lightbox': basic });
		module.render(target, 'See <a href="https://example.com">the pier</a><br>now', {
			surface: 'lightbox',
		});
		expect(target.innerHTML).toBe(
			'See <a href="https://example.com" target="_blank" rel="nofollow noopener">the pier<span class="fg-formatted-text-sr"> (opens in a new tab)</span></a><br>now'
		);
	});

	it('reads each surface from its own attribute', () => {
		const { target } = gallery({
			'data-fg-text-lightbox': basic,
			'data-fg-text-lightbox-mini': { ...basic, mode: 'plain' },
		});
		module.render(target, '<em>x</em> &amp; y', { surface: 'lightbox_mini' });
		expect(target.innerHTML).toBe('x &amp; y');
		expect(target.querySelector('em')).toBeNull();
	});

	it('shows links as text when links are off', () => {
		const { target } = gallery({ 'data-fg-text-lightbox-grid': basic });
		module.render(target, '<a href="https://example.com">pier</a>', {
			surface: 'lightbox_grid',
			links: false,
		});
		expect(target.innerHTML).toBe('pier');
	});

	it('never inserts a forged value as markup', () => {
		const { target } = gallery({ 'data-fg-text-lightbox': basic });
		module.render(
			target,
			'<img src=x onerror="window.__pwned=1"><a href="javascript:alert(1)" onclick="x">a</a><svg><script>1</script></svg>&lt;b&gt;',
			{ surface: 'lightbox' }
		);
		expect(window.__pwned).toBeUndefined();
		expect(target.querySelector('img, svg, script, [onclick], [href^="javascript"]')).toBeNull();
		expect(target.textContent).toBe('a<b>');
	});

	it('applies a profile changed on the server, still under the floor', () => {
		const profile = {
			elements: { u: {}, br: {}, script: {}, a: { attributes: { href: { type: 'url' }, onclick: { type: 'text' } } } },
			protocols: ['https', 'javascript'],
			breakBefore: [],
			dropWithContent: [],
		};
		const { target } = gallery({ 'data-fg-text-lightbox': { ...basic, policy: { newTab: false, rel: [] }, profile } });
		module.render(
			target,
			'<u>u</u> <strong>s</strong> <script>x</script><a href="javascript:1" onclick="x">j</a>',
			{ surface: 'lightbox' }
		);
		expect(target.innerHTML).toBe('<u>u</u> s j');
	});

	it('falls back to the defaults on a broken attribute', () => {
		const { target } = gallery({ 'data-fg-text-lightbox': '{not json' });
		module.render(target, '<strong>x</strong>', { surface: 'lightbox' });
		expect(target.innerHTML).toBe('<strong>x</strong>');
	});

	it('dispatches the rendered event with its context', () => {
		const { el, target } = gallery({ 'data-fg-text-lightbox': basic });
		const listener = jest.fn();
		document.addEventListener(EVENT, listener);
		module.render(target, 'x', { surface: 'lightbox', field: 'caption', itemId: 42 });
		document.removeEventListener(EVENT, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener.mock.calls[0][0].detail).toEqual({
			element: target,
			profile: 'item_text',
			surface: 'lightbox',
			field: 'caption',
			itemId: '42',
			galleryEl: el,
		});
	});

	it('converts to plain text with line breaks', () => {
		expect(module.toPlainText('<p>One &amp; <b>two</b></p><p>three</p>')).toBe('One & two\n\nthree');
	});
});
