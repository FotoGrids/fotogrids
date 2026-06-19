/**
 * Tests for frontend/src/loading-icons-waapi.js
 *
 * The module exposes window.fotogridsWaapi: a map of icon name -> animate(svg).
 * jsdom has no Web Animations API, so Element.prototype.animate is stubbed.
 * Each animator is invoked against a richly-populated SVG to drive coverage.
 */

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag) {
	return document.createElementNS(NS, tag);
}

/**
 * Build an SVG with many of every shape the animators query for, so that
 * `svg.querySelector*` calls inside each animator resolve to real nodes.
 */
function buildRichSvg() {
	const svg = svgEl('svg');
	const add = (tag, count) => {
		for (let i = 0; i < count; i++) {
			const node = svgEl(tag);
			// give groups children too
			if (tag === 'g') {
				node.appendChild(svgEl('circle'));
				node.appendChild(svgEl('rect'));
			}
			svg.appendChild(node);
		}
	};
	add('circle', 12);
	add('rect', 12);
	add('path', 6);
	add('g', 8);
	add('ellipse', 4);
	add('line', 4);
	add('polygon', 2);
	add('animate', 4);
	add('animateTransform', 4);
	document.body.appendChild(svg);
	return svg;
}

describe('loading-icons-waapi', () => {
	let originalAnimate;
	let rafQueue;

	beforeAll(() => {
		require('@/frontend/src/loading-icons-waapi');
	});

	beforeEach(() => {
		document.body.innerHTML = '';
		// Stub WAAPI animate -> returns a minimal Animation-like object.
		originalAnimate = window.Element.prototype.animate;
		window.Element.prototype.animate = jest.fn(() => ({
			cancel: jest.fn(),
			finish: jest.fn(),
			play: jest.fn(),
			pause: jest.fn(),
			onfinish: null,
		}));
		// Drive rAF synchronously a bounded number of times.
		rafQueue = [];
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});
		jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
	});

	afterEach(() => {
		window.Element.prototype.animate = originalAnimate;
		jest.restoreAllMocks();
	});

	it('exposes a map of animators on window.fotogridsWaapi', () => {
		expect(window.fotogridsWaapi).toBeDefined();
		expect(Object.keys(window.fotogridsWaapi).length).toBeGreaterThan(20);
	});

	it('runs every animator against a populated SVG without throwing', () => {
		const names = Object.keys(window.fotogridsWaapi);
		for (const name of names) {
			const svg = buildRichSvg();
			let result;
			expect(() => {
				result = window.fotogridsWaapi[name](svg);
			}).not.toThrow();
			// animators return an array of animation handles (possibly empty)
			expect(Array.isArray(result)).toBe(true);
			// pump any rAF-based attribute animators a few frames
			let ticks = 0;
			while (rafQueue.length && ticks < 5) {
				const cb = rafQueue.shift();
				cb(performance.now ? performance.now() : Date.now());
				ticks++;
			}
		}
	});

	it('handles empty SVGs gracefully (no matching child nodes)', () => {
		const names = Object.keys(window.fotogridsWaapi);
		for (const name of names) {
			const svg = svgEl('svg');
			document.body.appendChild(svg);
			expect(() => window.fotogridsWaapi[name](svg)).not.toThrow();
		}
	});
});
