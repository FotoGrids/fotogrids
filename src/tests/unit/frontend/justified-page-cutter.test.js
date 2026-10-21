/**
 * Tests for public/render/layouts/justified/page-cutter.js: how a justified
 * gallery's sequence is cut into pages in the browser. Mirrors
 * tests/phpunit/JustifiedPageCutterTest.php; tests/ci/check-justified-cut-parity.js
 * checks the two produce identical output.
 */

const RATIOS = [0.5, 0.66, 0.75, 1, 1.33, 1.5, 1.78, 2.4];

function loadCutter() {
	// eslint-disable-next-line global-require
	return require('../../../public/render/layouts/justified/page-cutter');
}

function seeded(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function randInt(rand, min, max) {
	return min + Math.floor(rand() * (max - min + 1));
}

function sequence(rand, count, pool = RATIOS) {
	return Array.from({ length: count }, () => pool[randInt(rand, 0, pool.length - 1)]);
}

function geometry(width = 1200, gap = 10, rowHeight = 220) {
	return { width, gap, rowHeight };
}

function rules(overrides = {}) {
	return {
		mode: 'fill',
		target: 12,
		window: 20,
		threshold: 85,
		direction: 'auto',
		maxRows: 0,
		pageEndHide: false,
		...overrides,
	};
}

function rowEnds(cutter, aspects, g) {
	const ends = new Set();
	let at = 0;
	for (const row of cutter.packRows(aspects, g.width, g.gap, g.rowHeight)) {
		at += row.length;
		ends.add(at);
	}
	return ends;
}

function rowOf(cutter, aspects, g) {
	const map = [];
	cutter.packRows(aspects, g.width, g.gap, g.rowHeight).forEach((row, r) => {
		row.forEach((index) => {
			map[index] = r;
		});
	});
	return map;
}

function expectCovers(pages, start, total) {
	let next = start;
	for (const page of pages) {
		expect(page.offset).toBe(next);
		expect(page.size).toBeGreaterThan(0);
		next += page.size;
	}
	expect(next).toBe(total);
}

describe('justified page cutter', () => {
	let cutter;

	beforeAll(() => {
		cutter = loadCutter();
	});

	test('packRows groups indices into rows that cover the sequence in order', () => {
		const rand = seeded(1);
		for (let t = 0; t < 50; t++) {
			const aspects = sequence(rand, randInt(rand, 1, 80));
			const rows = cutter.packRows(aspects, randInt(rand, 280, 1600), randInt(rand, 0, 40), randInt(rand, 60, 400));
			expect(rows.flat()).toEqual(aspects.map((_, i) => i));
		}
	});

	test('FIL-01: fill pages are contiguous, cover everything and end on row ends within the window', () => {
		const rand = seeded(11);
		for (const target of [6, 12, 24]) {
			for (const window of [0, 20, 50]) {
				for (const threshold of [0, 85, 100]) {
					for (const direction of ['auto', 'prefer_remove', 'prefer_add']) {
						for (let t = 0; t < 3; t++) {
							const total = randInt(rand, 5, 200);
							const aspects = sequence(rand, total);
							const g = geometry(randInt(rand, 280, 1600), randInt(rand, 0, 40), randInt(rand, 60, 400));
							const pages = cutter.cutPages(aspects, g, rules({ target, window, threshold, direction }));
							const ends = rowEnds(cutter, aspects, g);
							const min = Math.max(1, target - Math.round((target * window) / 100));
							const max = target + Math.round((target * window) / 100);

							expectCovers(pages, 0, total);
							pages.slice(0, -1).forEach((page) => {
								const end = page.offset + page.size;
								expect(ends.has(end)).toBe(true);
								expect(page.size).toBeGreaterThanOrEqual(min);
								if (page.size > max) {
									for (let e = page.offset + min; e < end; e++) {
										expect(ends.has(e)).toBe(false);
									}
								}
							});
						}
					}
				}
			}
		}
	});

	test('FIL-02/03: fill continues from any start, including mid-row', () => {
		const rand = seeded(12);
		for (let t = 0; t < 200; t++) {
			const total = randInt(rand, 10, 150);
			const aspects = sequence(rand, total);
			const g = geometry(randInt(rand, 280, 1600), randInt(rand, 0, 30), randInt(rand, 80, 320));
			const start = randInt(rand, 1, total - 1);
			const pages = cutter.cutPages(aspects, g, rules(), start);
			const ends = rowEnds(cutter, aspects, g);

			expectCovers(pages, start, total);
			pages.slice(0, -1).forEach((page) => {
				expect(ends.has(page.offset + page.size)).toBe(true);
			});
		}
	});

	test('FIL-04: a walk with the geometry changing before every page covers everything once', () => {
		const rand = seeded(13);
		for (let t = 0; t < 60; t++) {
			const total = randInt(rand, 20, 200);
			const aspects = sequence(rand, total);
			let seen = 0;
			let guard = 0;
			while (seen < total && guard++ < 500) {
				const g = geometry(randInt(rand, 280, 1600), randInt(rand, 0, 30), randInt(rand, 80, 320));
				const pages = cutter.cutPages(aspects, g, rules(), seen);
				expect(pages[0].offset).toBe(seen);
				seen += pages[0].size;
			}
			expect(seen).toBe(total);
		}
	});

	test('FIL-05: pageContaining finds the page of any index, clamped at both ends', () => {
		const rand = seeded(14);
		const pages = cutter.cutPages(sequence(rand, 97), geometry(900), rules());
		pages.forEach((page, i) => {
			for (let index = page.offset; index < page.offset + page.size; index++) {
				expect(cutter.pageContaining(pages, index)).toBe(i + 1);
			}
		});
		expect(cutter.pageContaining(pages, 9999)).toBe(pages.length);
		expect(cutter.pageContaining(pages, -3)).toBe(1);
	});

	test('FIL-07: a sequence within the window is one page', () => {
		const rand = seeded(16);
		for (const total of [1, 5, 11, 12, 13, 14]) {
			expect(cutter.cutPages(sequence(rand, total), geometry(), rules())).toEqual([
				{ offset: 0, size: total },
			]);
		}
	});

	test('FIL-09: degenerate geometry still covers everything', () => {
		const aspects = sequence(seeded(17), 50);
		for (const g of [geometry(0), geometry(300, 400), geometry(1200, 10, 0), geometry(-5, -5, -5)]) {
			expectCovers(cutter.cutPages(aspects, g, rules()), 0, 50);
		}
	});

	test('start at or past the end yields no pages', () => {
		const aspects = sequence(seeded(18), 20);
		expect(cutter.cutPages(aspects, geometry(), rules(), 20)).toEqual([]);
		expect(cutter.cutPages(aspects, geometry(), rules(), 25)).toEqual([]);
		expect(cutter.cutPages([], geometry(), rules())).toEqual([]);
	});

	test('MAT-01: match pages hold exactly the target at any geometry', () => {
		const rand = seeded(19);
		for (let t = 0; t < 100; t++) {
			const total = randInt(rand, 1, 150);
			const target = randInt(rand, 1, 30);
			const pages = cutter.cutPages(sequence(rand, total), geometry(randInt(rand, 280, 1600)), rules({ mode: 'match', target }));
			expectCovers(pages, 0, total);
			pages.slice(0, -1).forEach((page) => expect(page.size).toBe(target));
		}
	});

	test('LR-06: match with page-end hide ends pages before the incomplete row', () => {
		const rand = seeded(20);
		for (let t = 0; t < 150; t++) {
			const total = randInt(rand, 20, 150);
			const aspects = sequence(rand, total);
			const g = geometry(randInt(rand, 400, 1600), 10, randInt(rand, 120, 300));
			const pages = cutter.cutPages(aspects, g, rules({ mode: 'match', pageEndHide: true }));
			const ends = rowEnds(cutter, aspects, g);

			expectCovers(pages, 0, total);
			pages.slice(0, -1).forEach((page) => {
				const end = page.offset + page.size;
				expect(page.size).toBeLessThanOrEqual(12);
				let lastEndInside = 0;
				for (let e = page.offset + 1; e <= page.offset + 12; e++) {
					if (ends.has(e)) {
						lastEndInside = e;
					}
				}
				expect(end).toBe(lastEndInside || page.offset + 12);
			});
		}
	});

	test('MR-02/03: max rows caps every page in both modes', () => {
		const rand = seeded(21);
		for (const mode of ['fill', 'match']) {
			for (const maxRows of [1, 2, 3]) {
				for (let t = 0; t < 40; t++) {
					const total = randInt(rand, 10, 150);
					const aspects = sequence(rand, total);
					const g = geometry(randInt(rand, 300, 1600), 10, randInt(rand, 100, 300));
					const start = t % 3 === 0 ? randInt(rand, 0, total - 1) : 0;
					const pages = cutter.cutPages(aspects, g, rules({ mode, maxRows }), start);
					const rows = rowOf(cutter, aspects, g);

					expectCovers(pages, start, total);
					pages.forEach((page) => {
						const spans = rows[page.offset + page.size - 1] - rows[page.offset] + 1;
						expect(spans).toBeLessThanOrEqual(maxRows);
					});
				}
			}
		}
	});
});
