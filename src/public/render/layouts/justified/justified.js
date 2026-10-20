/**
 * FotoGrids - Justified Layout
 *
 * Row-packer for the justified layout. Reads the per-row target height
 * from CSS variable `--fg-justified-row-height` (resolved at runtime
 * against the active breakpoint via the Style_Var_Builder cascade) and
 * the tolerance / last-row / max-rows / page-trailing-row behaviour from
 * the `data-fg-justified-*` attributes the PHP Layout_Justified writes
 * onto the wrapper.
 *
 * Layout primitives (attach scaffolding, dimension waiting, gap reads)
 * come from layouts/_helpers/layout-helpers.js so the justified and
 * masonry modules share boilerplate.
 */

import {
	aspectRatioFor,
	readTrackGap,
	readCssNumber,
	hasNextPage,
	visibleItems,
	createLayoutAttach,
	bootLayout,
} from '../_helpers/layout-helpers.js';
import { cutPages, packRows, pageContaining } from './page-cutter.js';

const PAGE_SIZE_ORDER = ['desktop', 'tablet', 'mobile'];

/** Quiet time after the last cut change before the pagination core re-plans. */
const REPLAN_DELAY_MS = 250;

function readTolerance(collectionEl) {
	const raw = collectionEl.getAttribute('data-fg-justified-tolerance');
	const parsed = parseInt(raw, 10);
	if (isNaN(parsed)) {
		return 0.25;
	}
	return Math.max(0, Math.min(100, parsed)) / 100;
}

function readLastRow(collectionEl) {
	return (
		collectionEl.getAttribute('data-fg-justified-last-row') || 'nojustify'
	);
}

function readMaxRows(collectionEl) {
	const raw = collectionEl.getAttribute('data-fg-justified-max-rows');
	const parsed = parseInt(raw, 10);
	return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function readNumberAttr(collectionEl, name, fallback) {
	const parsed = parseFloat(collectionEl.getAttribute(name));
	return Number.isFinite(parsed) ? parsed : fallback;
}

function readPageTrailingRow(collectionEl) {
	const raw =
		collectionEl.getAttribute('data-fg-justified-page-trailing-row') ||
		'fill';
	return raw === 'match' ? 'match' : 'fill';
}

/**
 * Pack the items into rows via shrink-vs-grow lookahead.
 *
 * @param {HTMLElement[]} items
 * @param {number} containerWidth
 * @param {number} gap
 * @param {number} targetHeight
 * @param {(item: HTMLElement) => number} [aspectOf] Defaults to the image's own shape.
 * @return {Array<Array<{ item: HTMLElement, aspect: number }>>}
 */
function buildRows(
	items,
	containerWidth,
	gap,
	targetHeight,
	aspectOf = aspectRatioFor
) {
	const rows = [];
	let current = [];
	let currentAspectSum = 0;

	const availableWidth = (count) =>
		containerWidth - Math.max(0, count - 1) * gap;
	const rowHeightFor = (aspectSum, count) => {
		if (aspectSum <= 0 || count <= 0) {
			return targetHeight;
		}
		return availableWidth(count) / aspectSum;
	};

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const aspect = aspectOf(item);

		const withCount = current.length + 1;
		const withAspect = currentAspectSum + aspect;
		const naturalWidthWith =
			withAspect * targetHeight + Math.max(0, withCount - 1) * gap;

		if (naturalWidthWith < containerWidth || current.length === 0) {
			current.push({ item, aspect });
			currentAspectSum = withAspect;
			continue;
		}

		const heightWith = rowHeightFor(withAspect, withCount);
		const heightWithout = rowHeightFor(currentAspectSum, current.length);

		const deltaWith = Math.abs(heightWith - targetHeight);
		const deltaWithout = Math.abs(heightWithout - targetHeight);

		if (deltaWith <= deltaWithout) {
			current.push({ item, aspect });
			rows.push(current);
			current = [];
			currentAspectSum = 0;
		} else {
			rows.push(current);
			current = [{ item, aspect }];
			currentAspectSum = aspect;
		}
	}

	if (current.length > 0) {
		rows.push(current);
	}

	return rows;
}

/**
 * Apply width + height to every item in a packed row. Distributes
 * floor-rounding error across the row so the rightmost item lands at
 * exactly containerWidth - totalGap.
 *
 * A full-width row whose height would leave [minHeight, maxHeight] keeps the
 * full width at the bound; its images crop to fit.
 *
 * @param {Array<{item:HTMLElement,aspect:number}>} row
 * @param {number}  containerWidth
 * @param {number}  gap
 * @param {number}  targetHeight
 * @param {boolean} stretch   Fill the container width.
 * @param {number}  minHeight
 * @param {number}  maxHeight
 * @return {void}
 */
function applyRow(
	row,
	containerWidth,
	gap,
	targetHeight,
	stretch,
	minHeight,
	maxHeight
) {
	const totalGap = Math.max(0, row.length - 1) * gap;
	const availableWidth = containerWidth - totalGap;
	let totalAspect = row.reduce((sum, entry) => sum + entry.aspect, 0);
	if (totalAspect <= 0) {
		totalAspect = 1;
	}

	const natural = availableWidth / totalAspect;
	const rowHeight = stretch
		? Math.min(maxHeight, Math.max(minHeight, natural))
		: targetHeight;
	const widthScale = stretch ? natural : targetHeight;
	const intHeight = Math.round(rowHeight);

	let cumulativeFloat = 0;
	let cumulativeInt = 0;
	for (let i = 0; i < row.length; i++) {
		const entry = row[i];
		cumulativeFloat += entry.aspect * widthScale;
		const cumulativeRounded = Math.round(cumulativeFloat);
		const intWidth = cumulativeRounded - cumulativeInt;
		cumulativeInt = cumulativeRounded;

		entry.item.style.width = intWidth + 'px';
		entry.item.style.height = intHeight + 'px';
		entry.item.style.flexGrow = '0';
		entry.item.style.flexShrink = '0';
		entry.item.style.marginLeft = '';
		entry.item.style.marginRight = '';
	}
}

/**
 * Height a row would take if stretched to the container width.
 *
 * @return {number}
 */
function stretchedHeight(row, containerWidth, gap) {
	const totalAspect = row.reduce((sum, entry) => sum + entry.aspect, 0);
	if (totalAspect <= 0) {
		return 0;
	}
	return (containerWidth - Math.max(0, row.length - 1) * gap) / totalAspect;
}

function applyMaxRowsCutoff(rows, cutoffRow) {
	for (let i = 0; i < rows.length; i++) {
		const hidden = cutoffRow > 0 && i >= cutoffRow;
		for (let j = 0; j < rows[i].length; j++) {
			rows[i][j].item.style.display = hidden ? 'none' : '';
		}
	}
}

function clearRowMarkers(trackEl) {
	trackEl.querySelectorAll(':scope > .fg-item').forEach((item) => {
		item.removeAttribute('data-fg-justified-last-row');
		item.removeAttribute('data-fg-justified-last-row-first');
		item.removeAttribute('data-fg-justified-last-row-last');
	});
}

function getCollectionEl(trackEl) {
	return trackEl.closest('[data-fg-layout="justified"]');
}

function paginationModule() {
	return window.FotoGrids &&
		window.FotoGrids.modules &&
		window.FotoGrids.modules.pagination
		? window.FotoGrids.modules.pagination
		: null;
}

function sequenceIndexOf(item) {
	const parsed = parseInt(
		item.getAttribute('data-fg-sequence-index') || '',
		10
	);
	return Number.isFinite(parsed) ? parsed : -1;
}

function readAspects(collectionEl) {
	const raw = collectionEl.dataset.fgAspects || '';
	if (!raw) {
		return [];
	}
	return raw.split(',').map((value) => parseFloat(value));
}

/**
 * Items per page at the visitor's breakpoint.
 *
 * @param {HTMLElement} collectionEl
 * @return {number}
 */
function readTargetPageSize(collectionEl) {
	const parts = (collectionEl.dataset.fgPageSizes || '')
		.trim()
		.split(/\s+/)
		.map((n) => parseInt(n, 10));
	const breakpoint =
		window.FotoGrids &&
		typeof window.FotoGrids.activeBreakpoint === 'function'
			? window.FotoGrids.activeBreakpoint()
			: 'desktop';
	const index = PAGE_SIZE_ORDER.indexOf(breakpoint);
	if (parts.length === 3 && index >= 0 && parts[index] > 0) {
		return parts[index];
	}
	const fallback = parseInt(collectionEl.dataset.fgPageSize || '0', 10);
	return fallback > 0 ? fallback : 12;
}

/** @type {WeakMap<HTMLElement, object>} */
const plans = new WeakMap();

/**
 * Per-gallery cut state for a gallery whose pages the browser cuts.
 *
 * @param {HTMLElement} collectionEl
 * @return {object}
 */
function planFor(collectionEl) {
	let plan = plans.get(collectionEl);
	if (plan) {
		return plan;
	}

	const firstItem = collectionEl.querySelector('.fg-item');
	plan = {
		aspects: readAspects(collectionEl),
		geometry: null,
		rules: null,
		rowEnds: null,
		replanTimer: null,
		justRegistered: false,
		trimmed: [],
		signature: '',
		cache: new Map(),
		registered: false,
		poolActive:
			parseInt(collectionEl.dataset.fgPageCurrent || '1', 10) <= 1 &&
			(!firstItem || sequenceIndexOf(firstItem) <= 0),
	};
	plans.set(collectionEl, plan);

	plan.cut = (start) => {
		const key = plan.signature + '@' + start;
		if (!plan.cache.has(key)) {
			plan.cache.set(
				key,
				cutPages(plan.aspects, plan.geometry, plan.rules, start)
			);
		}
		return plan.cache.get(key);
	};

	const asSlice = (page) =>
		page ? { offset: page.offset, length: page.size } : null;
	plan.planner = {
		next: (loaded) => asSlice(plan.cut(Math.max(0, loaded))[0]),
		page: (n) => asSlice(plan.cut(0)[n - 1]),
		pageContaining: (index) => pageContaining(plan.cut(0), index),
		total: () => Math.max(1, plan.cut(0).length),
	};

	collectionEl.addEventListener('fotogrids:sequence_changed', (event) => {
		const aspects = event.detail && event.detail.aspects;
		if (!Array.isArray(aspects)) {
			return;
		}
		plan.aspects = aspects.map((value) => parseFloat(value));
		plan.signature = '';
		plan.cache.clear();
		plan.rowEnds = null;
		plan.poolActive = true;
	});

	collectionEl.addEventListener('fotogrids:pagination_attached', () => {
		if (plan.geometry) {
			registerPlanner(collectionEl, plan);
		}
	});

	collectionEl.addEventListener('fotogrids:page_changed', (event) => {
		const mode = event.detail && event.detail.mode;
		if (mode === 'append' || mode === 'replace') {
			plan.poolActive = false;
		}
	});

	return plan;
}

/**
 * Registers the gallery's planner with the pagination core once the core is
 * available, re-planning on registration so totals follow the browser's cut.
 *
 * @param {HTMLElement} collectionEl
 * @param {object}      plan
 * @return {object|null} The pagination core, when available.
 */
function registerPlanner(collectionEl, plan) {
	plan.justRegistered = false;
	const pagination = paginationModule();
	if (!pagination || typeof pagination.setSlicePlanner !== 'function') {
		return null;
	}
	if (!plan.registered) {
		plan.registered = true;
		plan.justRegistered = true;
		pagination.setSlicePlanner(collectionEl, plan.planner);
		if (typeof pagination.replan === 'function') {
			pagination.replan(collectionEl);
		}
	}
	return pagination;
}

/**
 * Cuts page 1 out of the pool the server sent and keeps the pagination core's
 * planner on the live geometry.
 *
 * @return {object} The gallery's plan.
 */
function planPages(collectionEl, items, geometry, maxRows, trailing, lastRow) {
	const plan = planFor(collectionEl);
	const rules = {
		mode: trailing,
		target: readTargetPageSize(collectionEl),
		window: readNumberAttr(
			collectionEl,
			'data-fg-justified-snap-window',
			20
		),
		threshold: readNumberAttr(
			collectionEl,
			'data-fg-justified-snap-threshold',
			85
		),
		direction:
			collectionEl.getAttribute('data-fg-justified-snap-direction') ||
			'auto',
		maxRows,
		pageEndHide: trailing === 'match' && lastRow === 'hide',
	};
	const signature = JSON.stringify([geometry, rules, plan.aspects.length]);
	const moved = signature !== plan.signature;
	if (moved) {
		plan.geometry = geometry;
		plan.rules = rules;
		plan.signature = signature;
		plan.cache.clear();
		plan.rowEnds = null;
	}

	if (plan.poolActive) {
		const first = plan.cut(0)[0];
		const size = first ? first.size : items.length;
		items.forEach((item, i) => {
			if (i >= size) {
				item.setAttribute('data-fg-overflow', '1');
			} else {
				item.removeAttribute('data-fg-overflow');
			}
		});
	}

	const pagination = registerPlanner(collectionEl, plan);
	if (
		pagination &&
		moved &&
		!plan.justRegistered &&
		typeof pagination.replan === 'function'
	) {
		if (plan.replanTimer) {
			window.clearTimeout(plan.replanTimer);
		}
		plan.replanTimer = window.setTimeout(() => {
			plan.replanTimer = null;
			pagination.replan(collectionEl);
		}, REPLAN_DELAY_MS);
	}

	return plan;
}

/**
 * Row ends of the whole sequence's packing at the live geometry.
 *
 * @return {Set<number>}
 */
function sequenceRowEnds(plan) {
	if (!plan.rowEnds) {
		const g = plan.geometry;
		const ends = new Set();
		let at = 0;
		packRows(plan.aspects, g.width, g.gap, g.rowHeight).forEach((row) => {
			at += row.length;
			ends.add(at);
		});
		plan.rowEnds = ends;
	}
	return plan.rowEnds;
}

/**
 * Whether the item at sequence index `lastIndex` ends a row of the whole
 * sequence's packing at the live geometry.
 *
 * @return {boolean}
 */
function endsSequenceRow(plan, lastIndex) {
	return sequenceRowEnds(plan).has(lastIndex + 1);
}

/**
 * Sequence index the row holding `index` starts at, in the whole sequence's
 * packing at the live geometry.
 *
 * @return {number}
 */
function sequenceRowStart(plan, index) {
	let start = 0;
	sequenceRowEnds(plan).forEach((end) => {
		if (end <= index && end > start) {
			start = end;
		}
	});
	return start;
}

/**
 * Hides an append run's incomplete trailing row, left by a geometry change
 * after its pages were cut, so the next load starts with those items.
 *
 * @param {object}        plan
 * @param {HTMLElement[]} items Loaded items, in order.
 * @return {HTMLElement[]} The items that stay shown.
 */
function trimTrailingRow(plan, items) {
	const lastSeq = sequenceIndexOf(items[items.length - 1]);
	const firstSeq = sequenceIndexOf(items[0]);
	if (
		lastSeq < 0 ||
		lastSeq >= plan.aspects.length - 1 ||
		endsSequenceRow(plan, lastSeq)
	) {
		return items;
	}
	const start = sequenceRowStart(plan, lastSeq);
	if (start <= firstSeq) {
		return items;
	}
	return items.filter((item) => {
		if (sequenceIndexOf(item) < start) {
			return true;
		}
		item.setAttribute('data-fg-overflow', '1');
		plan.trimmed.push(item);
		return false;
	});
}

function layout(trackEl) {
	const collectionEl = getCollectionEl(trackEl);
	if (!collectionEl) {
		return;
	}

	const containerWidth = trackEl.clientWidth;
	if (containerWidth <= 0) {
		return;
	}

	let items = visibleItems(trackEl);
	if (items.length === 0) {
		return;
	}

	const gap = readTrackGap(trackEl);
	const targetHeight = readCssNumber(
		collectionEl,
		'--fg-justified-row-height',
		220
	);
	const tolerance = readTolerance(collectionEl);
	const lastRow = readLastRow(collectionEl);
	const maxRows = readMaxRows(collectionEl);
	const pageTrailingRow = readPageTrailingRow(collectionEl);
	const paginated = collectionEl.dataset.fgPaginated === 'true';
	const planned = paginated && !!collectionEl.dataset.fgAspects;

	clearRowMarkers(trackEl);

	let plan = null;
	if (planned) {
		const known = plans.get(collectionEl);
		if (known && known.trimmed.length) {
			known.trimmed.forEach((item) =>
				item.removeAttribute('data-fg-overflow')
			);
			known.trimmed = [];
		}
		plan = planPages(
			collectionEl,
			items,
			{ width: containerWidth, gap, rowHeight: targetHeight },
			maxRows,
			pageTrailingRow,
			lastRow
		);
		items = items.filter((item) => !item.hasAttribute('data-fg-overflow'));
		const trims =
			!plan.poolActive &&
			collectionEl.dataset.fgPaginationMethod !== 'pages' &&
			(pageTrailingRow === 'fill' || lastRow === 'hide');
		if (trims && items.length > 0) {
			items = trimTrailingRow(plan, items);
		}
		if (items.length === 0) {
			return;
		}
	}

	const sequenceAspect = (item) => {
		const index = sequenceIndexOf(item);
		const aspect = index >= 0 ? plan.aspects[index] : NaN;
		return Number.isFinite(aspect) && aspect > 0
			? aspect
			: aspectRatioFor(item);
	};
	const rows = buildRows(
		items,
		containerWidth,
		gap,
		targetHeight,
		plan ? sequenceAspect : aspectRatioFor
	);
	if (rows.length === 0) {
		return;
	}

	const lastIndex = rows.length - 1;
	const minHeight = targetHeight * (1 - tolerance);
	const maxHeight = targetHeight * (1 + tolerance);

	let finalRow;
	let completeTrailingRow;
	if (plan) {
		const lastSeq = sequenceIndexOf(items[items.length - 1]);
		finalRow = lastSeq < 0 || lastSeq >= plan.aspects.length - 1;
		completeTrailingRow = !finalRow && endsSequenceRow(plan, lastSeq);
	} else {
		finalRow = !hasNextPage(collectionEl);
		completeTrailingRow = !finalRow && pageTrailingRow === 'fill';
	}

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (i < lastIndex || completeTrailingRow) {
			applyRow(
				row,
				containerWidth,
				gap,
				targetHeight,
				true,
				minHeight,
				maxHeight
			);
			continue;
		}

		if (lastRow === 'justify') {
			applyRow(
				row,
				containerWidth,
				gap,
				targetHeight,
				true,
				minHeight,
				maxHeight
			);
			continue;
		}

		if (lastRow === 'hide' && !finalRow && !planned) {
			applyRow(
				row,
				containerWidth,
				gap,
				targetHeight,
				false,
				minHeight,
				maxHeight
			);
			row.forEach((entry) =>
				entry.item.setAttribute('data-fg-justified-last-row', '1')
			);
			continue;
		}

		const stretched = stretchedHeight(row, containerWidth, gap);
		const fits = stretched >= minHeight && stretched <= maxHeight;
		applyRow(
			row,
			containerWidth,
			gap,
			targetHeight,
			fits,
			minHeight,
			maxHeight
		);

		if (!fits && (lastRow === 'center' || lastRow === 'right')) {
			row[0].item.setAttribute('data-fg-justified-last-row-first', '1');
			if (lastRow === 'center') {
				row[row.length - 1].item.setAttribute(
					'data-fg-justified-last-row-last',
					'1'
				);
			}
		}
	}

	applyMaxRowsCutoff(rows, paginated ? 0 : maxRows);

	collectionEl.dataset.fgContainerWidth = String(Math.round(containerWidth));
	collectionEl.setAttribute('data-fg-justified-packed', '1');
}

const attach = createLayoutAttach({
	collectionSelector: '[data-fg-layout="justified"]',
	trackSelector: '.fg-justified-track',
	readyKey: 'fgJustifiedReady',
	layoutFn: layout,
	signatureFn: (trackEl) => {
		const collectionEl = getCollectionEl(trackEl);
		return collectionEl
			? readTrackGap(trackEl) +
					'|' +
					readCssNumber(
						collectionEl,
						'--fg-justified-row-height',
						220
					)
			: '';
	},
});

bootLayout(attach, 10);
