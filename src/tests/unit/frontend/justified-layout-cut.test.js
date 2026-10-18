/**
 * Tests for how public/render/layouts/justified/justified.js cuts pages in the
 * browser: page 1 cut before it shows, the slice planner it registers with the
 * pagination core, re-planning after a resize, Last Row Hide and Max Rows.
 */

const LAYOUT = '../../../public/render/layouts/justified/justified';
const CUTTER = '../../../public/render/layouts/justified/page-cutter';

const RATIOS = [1.5, 0.75, 1, 1.78, 0.66, 1.33, 2.4, 1.5, 1, 0.5];

let observers = [];

function installRuntime({ pagination } = {}) {
	const subscribers = [];
	window.FotoGrids = {
		modules: pagination ? { pagination } : {},
		activeBreakpoint: () => 'desktop',
		onGallery(cb) {
			subscribers.push(cb);
		},
		boot() {
			document.querySelectorAll('.fotogrids-gallery').forEach((el) => subscribers.forEach((cb) => cb(el)));
		},
	};
	window.ResizeObserver = class {
		constructor(cb) {
			this.cb = cb;
			observers.push(this);
		}
		observe(el) {
			this.el = el;
		}
		disconnect() {}
	};
}

function aspectsFor(count) {
	return Array.from({ length: count }, (_, i) => RATIOS[i % RATIOS.length]);
}

function itemHtml(index, aspect, overflow) {
	const h = 600;
	const w = Math.round(h * aspect);
	return `<figure class="fg-item" data-fg-sequence-index="${index}"${overflow ? ' data-fg-overflow' : ''}><div class="fg-item-media"><img width="${w}" height="${h}" alt=""></div></figure>`;
}

function makeGallery({
	total = 60,
	rendered = 20,
	serverCut = 12,
	method = 'load_more',
	paginated = true,
	trailing = 'fill',
	lastRow = 'nojustify',
	maxRows = 0,
	width = 640,
} = {}) {
	const aspects = aspectsFor(total);
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.setAttribute('data-fg-layout', 'justified');
	el.dataset.fgGalleryId = '9';
	el.setAttribute('data-fg-justified-last-row', lastRow);
	el.setAttribute('data-fg-justified-max-rows', String(maxRows));
	el.setAttribute('data-fg-justified-page-trailing-row', trailing);
	el.setAttribute('data-fg-justified-tolerance', '25');
	el.style.setProperty('--fg-justified-row-height', '220px');
	if (paginated) {
		el.dataset.fgPaginated = 'true';
		el.dataset.fgPaginationMethod = method;
		el.dataset.fgPageCurrent = '1';
		el.dataset.fgPageTotal = '5';
		el.dataset.fgPageSize = String(serverCut);
		el.dataset.fgPageSizes = '12 12 12';
		el.dataset.fgAspects = aspects.map((a) => a.toFixed(4)).join(',');
		el.setAttribute('data-fg-justified-snap-window', '20');
		el.setAttribute('data-fg-justified-snap-threshold', '85');
		el.setAttribute('data-fg-justified-snap-direction', 'auto');
	}
	const count = paginated ? rendered : total;
	let items = '';
	for (let i = 0; i < count; i++) {
		items += itemHtml(i, aspects[i], paginated && i >= serverCut);
	}
	el.innerHTML = `<div class="fg-justified-track" data-fg-items-root="true" style="gap: 10px">${items}</div>`;
	document.body.appendChild(el);
	const track = el.querySelector('.fg-justified-track');
	Object.defineProperty(track, 'clientWidth', { configurable: true, get: () => width });
	return { el, track, aspects };
}

function setWidth(track, width) {
	Object.defineProperty(track, 'clientWidth', { configurable: true, get: () => width });
	observers.forEach((o) => {
		if (o.el === track) {
			o.cb([{ contentRect: { width } }]);
		}
	});
}

function geometryOf(track, el, width) {
	const gap = parseFloat(window.getComputedStyle(track).gap) || 0;
	const rowHeight = parseFloat(window.getComputedStyle(el).getPropertyValue('--fg-justified-row-height')) || 220;
	return { width, gap, rowHeight };
}

function rulesOf(trailing, maxRows = 0, lastRow = 'nojustify') {
	return {
		mode: trailing,
		target: 12,
		window: 20,
		threshold: 85,
		direction: 'auto',
		maxRows,
		pageEndHide: 'match' === trailing && 'hide' === lastRow,
	};
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function paginationMock() {
	return {
		setSlicePlanner: jest.fn(),
		replan: jest.fn(),
		state: jest.fn(() => ({ page: 1, totalPages: 5, hasMore: true })),
	};
}

function boot() {
	jest.isolateModules(() => {
		require(LAYOUT);
	});
	window.FotoGrids.boot();
}

function shown(el) {
	return Array.from(el.querySelectorAll('.fg-item')).filter((n) => !n.hasAttribute('data-fg-overflow') && 'none' !== n.style.display);
}

describe('justified layout cut', () => {
	let cutter;

	beforeAll(() => {
		cutter = require(CUTTER);
	});

	beforeEach(() => {
		document.body.innerHTML = '';
		observers = [];
	});

	afterEach(() => {
		delete window.FotoGrids;
		delete window.ResizeObserver;
		jest.useRealTimers();
	});

	test('CLI-13: page 1 is cut at the measured width before it shows; overflow past the cut stays hidden', async () => {
		installRuntime({ pagination: paginationMock() });
		const { el, track, aspects } = makeGallery({ width: 640 });
		boot();
		await flush();

		const expected = cutter.cutPages(aspects, geometryOf(track, el, 640), rulesOf('fill'))[0];
		const items = Array.from(el.querySelectorAll('.fg-item'));
		items.forEach((item, i) => {
			expect(item.hasAttribute('data-fg-overflow')).toBe(i >= expected.size);
		});
	});

	test('CLI-13: the layout registers a slice planner that continues from the items on screen', async () => {
		const pagination = paginationMock();
		installRuntime({ pagination });
		const { el, track, aspects } = makeGallery({ width: 640 });
		boot();
		await flush();

		expect(pagination.setSlicePlanner).toHaveBeenCalledWith(el, expect.any(Object));
		const planner = pagination.setSlicePlanner.mock.calls[0][1];
		const g = geometryOf(track, el, 640);
		const loaded = shown(el).length;
		const next = cutter.cutPages(aspects, g, rulesOf('fill'), loaded)[0];

		expect(planner.next(loaded)).toEqual({ offset: next.offset, length: next.size });
		expect(planner.total()).toBe(cutter.cutPages(aspects, g, rulesOf('fill')).length);
		expect(planner.page(2)).toEqual({
			offset: cutter.cutPages(aspects, g, rulesOf('fill'))[1].offset,
			length: cutter.cutPages(aspects, g, rulesOf('fill'))[1].size,
		});
		expect(planner.next(aspects.length)).toBeNull();
	});

	test('CLI-04: a container measured at 0px is not cut until it has a width', async () => {
		jest.useFakeTimers();
		const pagination = paginationMock();
		installRuntime({ pagination });
		const { el, track } = makeGallery({ width: 0 });
		boot();
		await Promise.resolve();

		expect(el.querySelectorAll('[data-fg-overflow]')).toHaveLength(8);
		expect(pagination.setSlicePlanner).not.toHaveBeenCalled();

		setWidth(track, 640);
		jest.advanceTimersByTime(200);
		await Promise.resolve();

		expect(pagination.setSlicePlanner).toHaveBeenCalled();
	});

	test('D3 / CLI-08: a burst of resizes re-plans once, after the last', async () => {
		jest.useFakeTimers();
		const pagination = paginationMock();
		installRuntime({ pagination });
		const { track } = makeGallery({ method: 'pages', width: 1200 });
		boot();
		await Promise.resolve();
		jest.advanceTimersByTime(200);
		pagination.replan.mockClear();

		[1100, 1000, 900, 820].forEach((w) => {
			setWidth(track, w);
			jest.advanceTimersByTime(30);
		});
		jest.advanceTimersByTime(200);

		expect(pagination.replan).toHaveBeenCalledTimes(1);
	});

	test('CLI-15: a new sequence replaces the aspect ratios the planner cuts', async () => {
		const pagination = paginationMock();
		installRuntime({ pagination });
		const { el } = makeGallery({ width: 640 });
		boot();
		await flush();

		el.dispatchEvent(new CustomEvent('fotogrids:sequence_changed', { detail: { aspects: [1.5, 1.5, 1.5] } }));
		await flush();

		const planner = pagination.setSlicePlanner.mock.calls[pagination.setSlicePlanner.mock.calls.length - 1][1];
		expect(planner.total()).toBe(1);
		expect(planner.next(3)).toBeNull();
	});

	test('D4 / LR-01: Last Row Hide never hides the gallery\'s final row', async () => {
		installRuntime();
		const { el } = makeGallery({ paginated: false, total: 23, lastRow: 'hide' });
		boot();
		await flush();

		expect(el.querySelectorAll('.fg-item[data-fg-justified-last-row="1"]')).toHaveLength(0);
		expect(shown(el)).toHaveLength(23);
	});

	test('D5 / MR-01: Max Rows in Show All shows only N rows', async () => {
		installRuntime();
		const { el, track, aspects } = makeGallery({ paginated: false, total: 40, maxRows: 2, width: 640 });
		boot();
		await flush();

		const rows = cutter.packRows(aspects, 640, geometryOf(track, el, 640).gap, 220);
		expect(shown(el)).toHaveLength(rows[0].length + rows[1].length);
	});

	test('D1 / MR-02: Max Rows on a paginated gallery never hides loaded items', async () => {
		const pagination = paginationMock();
		installRuntime({ pagination });
		const { el, track, aspects } = makeGallery({ maxRows: 2, width: 640 });
		boot();
		await flush();

		const g = geometryOf(track, el, 640);
		const first = cutter.cutPages(aspects, g, rulesOf('fill', 2))[0];
		expect(shown(el)).toHaveLength(first.size);
		Array.from(el.querySelectorAll('.fg-item')).slice(0, first.size).forEach((item) => {
			expect(item.style.display).not.toBe('none');
		});
	});

	test('LR-06: Match with Last Row Hide cuts page 1 before the incomplete row instead of hiding it', async () => {
		const pagination = paginationMock();
		installRuntime({ pagination });
		const { el, track, aspects } = makeGallery({ trailing: 'match', lastRow: 'hide', width: 640 });
		boot();
		await flush();

		const g = geometryOf(track, el, 640);
		const first = cutter.cutPages(aspects, g, rulesOf('match', 0, 'hide'))[0];
		expect(shown(el)).toHaveLength(first.size);
		expect(el.querySelectorAll('.fg-item[data-fg-justified-last-row="1"]:not([data-fg-overflow])')).toHaveLength(0);
	});
});
