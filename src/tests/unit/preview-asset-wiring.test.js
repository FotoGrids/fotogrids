/**
 * Tests for src/assets/admin/src/utils/preview-asset-wiring.js
 *
 * The module keeps its dedup registries (loadedCssHandles, loadedJsHandles,
 * appliedInlinePayloads) at module scope so they survive React re-mounts, so
 * every test re-requires the module in a fresh registry to start clean.
 *
 * jsdom never fetches an external script, so its load event would never fire
 * and ensureScriptsSequenced would hang. autoSettleScripts() watches head and
 * dispatches load (or error, for a src marked broken) on each script as it is
 * appended, standing in for the browser.
 */

const MODULE_PATH = '@/admin/src/utils/preview-asset-wiring';

const loadFreshModule = () => {
	let mod;
	jest.isolateModules(() => {
		// eslint-disable-next-line global-require
		mod = require(MODULE_PATH);
	});
	return mod;
};

const autoSettleScripts = (ownerDocument = document) => {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			mutation.addedNodes.forEach((node) => {
				if (node.nodeName !== 'SCRIPT' || !node.src) {
					return;
				}
				const type = node.src.includes('broken') ? 'error' : 'load';
				node.dispatchEvent(new Event(type));
			});
		});
	});
	observer.observe(ownerDocument.head, { childList: true });
	return observer;
};

describe('preview-asset-wiring', () => {
	let wiring;
	let observer;

	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
		delete window.fotogrids;
		wiring = loadFreshModule();
		observer = autoSettleScripts();
	});

	afterEach(() => {
		observer.disconnect();
	});

	const cssLinks = () =>
		Array.from(
			document.querySelectorAll('link[data-fotogrids-preview-css]')
		);

	describe('ensurePreviewCssAssets', () => {
		it('appends one stylesheet link per handle', () => {
			wiring.ensurePreviewCssAssets({
				'fotogrids-render-base': 'https://example.test/base.css',
				'fotogrids-layout-grid': 'https://example.test/grid.css',
			});

			expect(cssLinks().map((l) => l.getAttribute('href'))).toEqual([
				'https://example.test/base.css',
				'https://example.test/grid.css',
			]);
			expect(cssLinks()[0].rel).toBe('stylesheet');
		});

		it('is a no-op for a null or non-object map', () => {
			wiring.ensurePreviewCssAssets(null);
			wiring.ensurePreviewCssAssets('not-an-object');
			expect(cssLinks()).toHaveLength(0);
		});

		it('skips entries whose href is missing or not a string', () => {
			wiring.ensurePreviewCssAssets({
				'fotogrids-empty': '',
				'fotogrids-number': 42,
				'fotogrids-null': null,
			});
			expect(cssLinks()).toHaveLength(0);
		});

		it('does not re-append a handle it has already seen', () => {
			const map = {
				'fotogrids-render-base': 'https://example.test/base.css',
			};
			wiring.ensurePreviewCssAssets(map);
			wiring.ensurePreviewCssAssets(map);
			expect(cssLinks()).toHaveLength(1);
		});

		it('adopts a link already tagged with the handle after a re-mount', () => {
			wiring.ensurePreviewCssAssets({
				'fotogrids-render-base': 'https://example.test/base.css',
			});

			// Fresh module registry = empty dedup set, but the DOM still has the link.
			const remounted = loadFreshModule();
			remounted.ensurePreviewCssAssets({
				'fotogrids-render-base': 'https://example.test/base.css',
			});

			expect(cssLinks()).toHaveLength(1);
		});

		it('tags a pre-existing stylesheet with the same href rather than duplicating it', () => {
			const existing = document.createElement('link');
			existing.rel = 'stylesheet';
			existing.href = 'https://example.test/base.css';
			document.head.appendChild(existing);

			wiring.ensurePreviewCssAssets({
				'fotogrids-render-base': 'https://example.test/base.css',
			});

			expect(
				document.querySelectorAll('link[rel="stylesheet"]')
			).toHaveLength(1);
			expect(existing.getAttribute('data-fotogrids-preview-css')).toBe(
				'fotogrids-render-base'
			);
		});
	});

	describe('applyPreviewInlineCss', () => {
		const styleFor = (key) =>
			document.querySelector(
				`style[data-fotogrids-preview-inline-css="${key}"]`
			);

		it('creates one style element carrying the payload', () => {
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:4;}');

			expect(styleFor('fg-181-1').textContent).toBe(
				'#fg-181-1{--fg-cols:4;}'
			);
		});

		it('rewrites in place on every response instead of deduping', () => {
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:4;}');
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:2;}');

			const styles = document.querySelectorAll(
				'style[data-fotogrids-preview-inline-css]'
			);
			expect(styles).toHaveLength(1);
			expect(styles[0].textContent).toBe('#fg-181-1{--fg-cols:2;}');
		});

		it('moves the style to the end of head so later links cannot outrank it', () => {
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:4;}');
			wiring.ensurePreviewCssAssets({
				'fotogrids-layout-grid': 'https://example.test/grid.css',
			});
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:3;}');

			expect(document.head.lastElementChild).toBe(styleFor('fg-181-1'));
		});

		it('keeps a separate style per instance id', () => {
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:4;}');
			wiring.applyPreviewInlineCss('fg-182-1', '#fg-182-1{--fg-cols:2;}');

			expect(
				document.querySelectorAll(
					'style[data-fotogrids-preview-inline-css]'
				)
			).toHaveLength(2);
		});

		it('falls back to a default key when no instance id is given', () => {
			wiring.applyPreviewInlineCss('', '#fg{--fg-gap:8px;}');
			expect(styleFor('default')).not.toBeNull();
		});

		it('removes the style when the payload is empty', () => {
			wiring.applyPreviewInlineCss('fg-181-1', '#fg-181-1{--fg-cols:4;}');
			wiring.applyPreviewInlineCss('fg-181-1', '');

			expect(styleFor('fg-181-1')).toBeNull();
		});

		it('does nothing when the payload is empty and no style exists', () => {
			expect(() =>
				wiring.applyPreviewInlineCss('fg-181-1', '')
			).not.toThrow();
			expect(
				document.querySelectorAll(
					'style[data-fotogrids-preview-inline-css]'
				)
			).toHaveLength(0);
		});
	});

	describe('ensureScriptsSequenced', () => {
		const scripts = () =>
			Array.from(
				document.querySelectorAll('script[data-fotogrids-preview-js]')
			);

		it('appends each descriptor in declaration order', async () => {
			await wiring.ensureScriptsSequenced([
				{
					handle: 'fotogrids-runtime',
					src: 'https://example.test/runtime.js',
				},
				{
					handle: 'fotogrids-sharing',
					src: 'https://example.test/sharing.js',
				},
			]);

			expect(
				scripts().map((s) =>
					s.getAttribute('data-fotogrids-preview-js')
				)
			).toEqual(['fotogrids-runtime', 'fotogrids-sharing']);
			expect(scripts()[0].async).toBe(false);
		});

		it('ignores a non-array argument', async () => {
			await wiring.ensureScriptsSequenced(undefined);
			await wiring.ensureScriptsSequenced('nope');
			expect(scripts()).toHaveLength(0);
		});

		it('skips null and non-object entries', async () => {
			await wiring.ensureScriptsSequenced([null, 'string-entry', 7]);
			expect(scripts()).toHaveLength(0);
		});

		it('skips descriptors missing a handle or a src', async () => {
			await wiring.ensureScriptsSequenced([
				{ src: 'https://example.test/orphan.js' },
				{ handle: 'fotogrids-no-src' },
			]);
			expect(scripts()).toHaveLength(0);
		});

		it('resolves rather than hanging when a script fails to load', async () => {
			await expect(
				wiring.ensureScriptsSequenced([
					{
						handle: 'fotogrids-broken',
						src: 'https://example.test/broken.js',
					},
				])
			).resolves.toBeUndefined();
			expect(scripts()).toHaveLength(1);
		});

		it('fetches a handle only once across calls', async () => {
			const descriptor = {
				handle: 'fotogrids-runtime',
				src: 'https://example.test/runtime.js',
			};
			await wiring.ensureScriptsSequenced([descriptor]);
			await wiring.ensureScriptsSequenced([descriptor]);

			expect(scripts()).toHaveLength(1);
		});

		it('reuses a script already in the DOM after a re-mount', async () => {
			await wiring.ensureScriptsSequenced([
				{
					handle: 'fotogrids-runtime',
					src: 'https://example.test/runtime.js',
				},
			]);

			const remounted = loadFreshModule();
			await remounted.ensureScriptsSequenced([
				{
					handle: 'fotogrids-runtime',
					src: 'https://example.test/runtime.js',
				},
			]);

			expect(scripts()).toHaveLength(1);
		});

		it('injects the before payload ahead of the external script and the after payload behind it', async () => {
			await wiring.ensureScriptsSequenced([
				{
					handle: 'fotogrids-loading-icon',
					src: 'https://example.test/loading-icon.js',
					inline_before: 'window.__fgBefore = 1;',
					inline_after: 'window.__fgAfter = 1;',
				},
			]);

			const order = Array.from(document.head.children).map(
				(node) =>
					node.getAttribute('data-fotogrids-preview-inline') ||
					node.getAttribute('data-fotogrids-preview-js')
			);

			expect(order).toEqual([
				'fotogrids-loading-icon::before',
				'fotogrids-loading-icon',
				'fotogrids-loading-icon::after',
			]);
		});

		it('applies each inline payload only once', async () => {
			const descriptor = {
				handle: 'fotogrids-loading-icon',
				src: 'https://example.test/loading-icon.js',
				inline_before: 'window.__fgBefore = 1;',
			};
			await wiring.ensureScriptsSequenced([descriptor]);
			await wiring.ensureScriptsSequenced([descriptor]);

			expect(
				document.querySelectorAll(
					'script[data-fotogrids-preview-inline]'
				)
			).toHaveLength(1);
		});

		it('adds no inline node when the descriptor carries no payloads', async () => {
			await wiring.ensureScriptsSequenced([
				{
					handle: 'fotogrids-runtime',
					src: 'https://example.test/runtime.js',
				},
			]);

			expect(
				document.querySelectorAll(
					'script[data-fotogrids-preview-inline]'
				)
			).toHaveLength(0);
		});
	});

	describe('injectPreviewHtml', () => {
		let container;

		beforeEach(() => {
			container = document.createElement('div');
			document.body.appendChild(container);
		});

		it('replaces the container contents with the rendered markup', () => {
			container.innerHTML = '<p>stale</p>';
			wiring.injectPreviewHtml(
				container,
				'<div class="fotogrids-collection" id="fg-181-1"></div>'
			);

			expect(container.querySelector('#fg-181-1')).not.toBeNull();
			expect(container.textContent).not.toContain('stale');
		});

		it('clears the container and stops when there is no html', () => {
			container.innerHTML = '<p>stale</p>';
			wiring.injectPreviewHtml(container, '');

			expect(container.innerHTML).toBe('');
		});

		it('re-executes inline scripts that innerHTML would have left inert', () => {
			delete window.__fgKickoff;
			wiring.injectPreviewHtml(
				container,
				'<div id="fg-181-1"></div><script>window.__fgKickoff = "ran";</script>'
			);

			expect(window.__fgKickoff).toBe('ran');
			delete window.__fgKickoff;
		});

		it('carries the attributes of the replaced script across', () => {
			wiring.injectPreviewHtml(
				container,
				'<script type="text/javascript" data-fg-instance="fg-181-1"></script>'
			);

			const script = container.querySelector('script');
			expect(script.getAttribute('data-fg-instance')).toBe('fg-181-1');
			expect(script.getAttribute('type')).toBe('text/javascript');
		});
	});

	describe('applyPreviewResponse', () => {
		let container;

		beforeEach(() => {
			container = document.createElement('div');
			document.body.appendChild(container);
		});

		const response = {
			html: '<div class="fotogrids-collection" id="fg-181-1"></div>',
			instance_id: 'fg-181-1',
			inlineCss: '#fg-181-1{--fg-cols:4;}',
			assets: {
				css: {
					'fotogrids-render-base': 'https://example.test/base.css',
				},
				js: [
					{
						handle: 'fotogrids-runtime',
						src: 'https://example.test/runtime.js',
					},
				],
				localize: {
					fotogrids: { restUrl: 'https://example.test/wp-json/' },
				},
			},
		};

		it('wires css, inline css, js and html from one response', async () => {
			await wiring.applyPreviewResponse(container, response);

			expect(cssLinks()).toHaveLength(1);
			expect(
				document.querySelector(
					'style[data-fotogrids-preview-inline-css="fg-181-1"]'
				).textContent
			).toBe('#fg-181-1{--fg-cols:4;}');
			expect(
				document.querySelectorAll('script[data-fotogrids-preview-js]')
			).toHaveLength(1);
			expect(container.querySelector('#fg-181-1')).not.toBeNull();
		});

		it('merges localize data onto window.fotogrids without dropping existing keys', async () => {
			window.fotogrids = { existing: true };
			await wiring.applyPreviewResponse(container, response);

			expect(window.fotogrids).toEqual({
				existing: true,
				restUrl: 'https://example.test/wp-json/',
			});
		});

		it('merges localize into an explicit owner window', async () => {
			const ownerWindow = {};
			await wiring.applyPreviewResponse(container, response, {
				ownerWindow,
			});

			expect(ownerWindow.fotogrids.restUrl).toBe(
				'https://example.test/wp-json/'
			);
			expect(window.fotogrids).toBeUndefined();
		});

		it('leaves window.fotogrids alone when localize is absent or not an object', async () => {
			await wiring.applyPreviewResponse(container, { html: '<p>a</p>' });
			await wiring.applyPreviewResponse(container, {
				html: '<p>b</p>',
				assets: { localize: { fotogrids: 'not-an-object' } },
			});

			expect(window.fotogrids).toBeUndefined();
		});

		it('returns early without a container or a response', async () => {
			await wiring.applyPreviewResponse(null, response);
			await wiring.applyPreviewResponse(container, null);

			expect(cssLinks()).toHaveLength(0);
			expect(container.innerHTML).toBe('');
		});

		it('falls back to the ambient document when the container has no ownerDocument', async () => {
			const detached = { innerHTML: 'stale' };
			await wiring.applyPreviewResponse(detached, {
				instance_id: 'fg-181-1',
				inlineCss: '#fg-181-1{--fg-gap:20px;}',
			});

			expect(
				document.querySelector(
					'style[data-fotogrids-preview-inline-css="fg-181-1"]'
				)
			).not.toBeNull();
			expect(detached.innerHTML).toBe('');
		});

		it('handles a response carrying no assets and no inline css', async () => {
			await wiring.applyPreviewResponse(container, {
				html: '<div id="fg-181-1"></div>',
			});

			expect(cssLinks()).toHaveLength(0);
			expect(
				document.querySelectorAll(
					'style[data-fotogrids-preview-inline-css]'
				)
			).toHaveLength(0);
			expect(container.querySelector('#fg-181-1')).not.toBeNull();
		});
	});
});
