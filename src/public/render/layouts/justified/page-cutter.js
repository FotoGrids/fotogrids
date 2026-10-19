/**
 * FotoGrids - Justified page cutter.
 *
 * Cuts a justified gallery's item sequence into pages that end on packed rows.
 * Mirrors Page_Cutter and Justified_Packer in PHP line for line, so the server
 * and the browser cut identically at the same geometry. No imports.
 */

/**
 * @param {number|string} aspect
 * @return {number}
 */
function sanitizeAspect(aspect) {
	const value = Number(aspect);
	return Number.isFinite(value) && value > 0 ? value : 1.5;
}

/**
 * Packs the sequence into rows of item indices.
 *
 * @param {number[]} aspects   Aspect ratios (width / height) in sequence order.
 * @param {number}   width     Container width in pixels.
 * @param {number}   gap       Gap between items in pixels.
 * @param {number}   rowHeight Target row height in pixels.
 * @return {number[][]}
 */
export function packRows(aspects, width, gap, rowHeight) {
	const rows = [];
	let current = [];
	let currentAspectSum = 0;
	const itemCount = aspects.length;
	const g = Math.max(0, gap);

	if (itemCount === 0 || width <= 0 || rowHeight <= 0) {
		return [];
	}

	const rowHeightFor = (aspectSum, count) => {
		if (aspectSum <= 0 || count <= 0) {
			return rowHeight;
		}
		const available = width - Math.max(0, count - 1) * g;
		return available / aspectSum;
	};

	for (let i = 0; i < itemCount; i++) {
		const aspect = sanitizeAspect(aspects[i]);
		const withCount = current.length + 1;
		const withAspect = currentAspectSum + aspect;
		const naturalWidthWith =
			withAspect * rowHeight + Math.max(0, withCount - 1) * g;

		if (naturalWidthWith < width || current.length === 0) {
			current.push(i);
			currentAspectSum = withAspect;
			continue;
		}

		const heightWith = rowHeightFor(withAspect, withCount);
		const heightWithout = rowHeightFor(currentAspectSum, current.length);

		if (
			Math.abs(heightWith - rowHeight) <=
			Math.abs(heightWithout - rowHeight)
		) {
			current.push(i);
			rows.push(current);
			current = [];
			currentAspectSum = 0;
		} else {
			rows.push(current);
			current = [i];
			currentAspectSum = aspect;
		}
	}

	if (current.length > 0) {
		rows.push(current);
	}

	return rows;
}

/**
 * @param {Object} rules
 * @return {{mode:string,target:number,window:number,threshold:number,direction:string,maxRows:number,pageEndHide:boolean}}
 */
function normalizeRules(rules) {
	const r = rules || {};
	const direction = String(r.direction || 'auto');
	const num = (value, fallback) => {
		const n = Number(value);
		return Number.isFinite(n) ? n : fallback;
	};
	return {
		mode: r.mode === 'match' ? 'match' : 'fill',
		target: Math.max(1, Math.trunc(num(r.target, 12))),
		window: Math.max(0, Math.min(100, num(r.window, 20))),
		threshold: Math.max(0, Math.min(100, num(r.threshold, 85))) / 100,
		direction: ['auto', 'prefer_remove', 'prefer_add'].includes(direction)
			? direction
			: 'auto',
		maxRows: Math.max(0, Math.trunc(num(r.maxRows, 0))),
		pageEndHide: !!r.pageEndHide,
	};
}

function fixedPages(total, start, target) {
	const pages = [];
	for (let cursor = start; cursor < total; cursor += target) {
		pages.push({ offset: cursor, size: Math.min(target, total - cursor) });
	}
	return pages;
}

function rowFill(row, aspects, width, gap, height) {
	let sum = 0;
	for (let i = 0; i < row.length; i++) {
		sum += sanitizeAspect(aspects[row[i]]);
	}
	const natural = sum * height + Math.max(0, row.length - 1) * gap;
	return Math.min(1, natural / width);
}

function matchEnd(cursor, total, cap, rowEnds, rules) {
	let end = Math.min(total, cursor + rules.target, cap);
	if (rules.pageEndHide && end < total && !rowEnds.includes(end)) {
		let best = 0;
		for (let i = 0; i < rowEnds.length; i++) {
			if (rowEnds[i] > cursor && rowEnds[i] <= end) {
				best = rowEnds[i];
			}
		}
		if (best > 0) {
			end = best;
		}
	}
	return end;
}

function phpRound(value) {
	return value < 0 ? -Math.round(-value) : Math.round(value);
}

function fillEnd(
	cursor,
	total,
	cap,
	rows,
	rowEnds,
	rowOf,
	aspects,
	width,
	gap,
	height,
	rules
) {
	const target = rules.target;
	const windowItems = phpRound((target * rules.window) / 100);
	const minPageSize = Math.max(1, target - windowItems);
	const maxPageSize = target + windowItems;

	const candidates = [];
	for (let i = 0; i < rowEnds.length; i++) {
		const rowEnd = rowEnds[i];
		if (rowEnd <= cursor) {
			continue;
		}
		if (rowEnd > cap) {
			break;
		}
		const size = rowEnd - cursor;
		if (size >= minPageSize) {
			candidates.push(rowEnd);
		}
		if (size >= maxPageSize) {
			break;
		}
	}

	if (candidates.length === 0) {
		return Math.min(total, cap);
	}
	if (candidates.includes(total)) {
		return total;
	}

	const inWindow = candidates.filter((end) => end - cursor <= maxPageSize);
	let pool = inWindow.length === 0 ? candidates : inWindow;

	const fillOf = (end) =>
		rowFill(rows[rowOf[end - 1]], aspects, width, gap, height);

	const clean = pool.filter((end) => fillOf(end) >= rules.threshold);
	if (clean.length > 0) {
		pool = clean;
	}

	let direction = rules.direction;
	if (direction === 'auto') {
		let nearest = candidates[0];
		for (let i = 0; i < candidates.length; i++) {
			if (
				Math.abs(candidates[i] - cursor - target) <
				Math.abs(nearest - cursor - target)
			) {
				nearest = candidates[i];
			}
		}
		direction = fillOf(nearest) < 0.5 ? 'prefer_remove' : 'prefer_add';
	}

	pool = pool.slice().sort((a, b) => {
		const deltaA = Math.abs(a - cursor - target);
		const deltaB = Math.abs(b - cursor - target);
		if (deltaA !== deltaB) {
			return deltaA - deltaB;
		}
		return direction === 'prefer_remove' ? a - b : b - a;
	});

	return pool[0];
}

/**
 * Cuts the sequence into pages, from `start` to the end.
 *
 * @param {number[]} aspects  Aspect ratios in sequence order.
 * @param {{width:number,gap:number,rowHeight:number}} geometry
 * @param {{mode?:string,target?:number,window?:number,threshold?:number,direction?:string,maxRows?:number,pageEndHide?:boolean}} rules
 * @param {number}   [start]  Index of the first item of the first page.
 * @return {Array<{offset:number,size:number}>}
 */
export function cutPages(aspects, geometry, rules, start = 0) {
	const total = aspects.length;
	const from = Math.max(0, Math.trunc(start) || 0);
	if (from >= total) {
		return [];
	}

	const r = normalizeRules(rules);
	const g = geometry || {};
	const width = Number(g.width) || 0;
	const gap = Math.max(0, Number(g.gap) || 0);
	const height = Number(g.rowHeight) || 0;
	const rows =
		width > 0 && height > 0 ? packRows(aspects, width, gap, height) : [];

	if (rows.length === 0) {
		return fixedPages(total, from, r.target);
	}

	const rowOf = [];
	const rowEnds = [];
	let at = 0;
	rows.forEach((row, index) => {
		row.forEach((item) => {
			rowOf[item] = index;
		});
		at += row.length;
		rowEnds.push(at);
	});

	const pages = [];
	let cursor = from;
	while (cursor < total) {
		let cap = total;
		if (r.maxRows > 0) {
			const capRow = Math.min(
				rowEnds.length - 1,
				rowOf[cursor] + r.maxRows - 1
			);
			cap = rowEnds[capRow];
		}

		const end =
			r.mode === 'match'
				? matchEnd(cursor, total, cap, rowEnds, r)
				: fillEnd(
						cursor,
						total,
						cap,
						rows,
						rowEnds,
						rowOf,
						aspects,
						width,
						gap,
						height,
						r
					);

		pages.push({ offset: cursor, size: end - cursor });
		cursor = end;
	}

	return pages;
}

/**
 * Returns the 1-based page holding `index`, clamped to the first and last page.
 *
 * @param {Array<{offset:number,size:number}>} pages
 * @param {number} index
 * @return {number}
 */
export function pageContaining(pages, index) {
	if (!pages || pages.length === 0) {
		return 1;
	}
	for (let i = 0; i < pages.length; i++) {
		if (index < pages[i].offset + pages[i].size) {
			return i + 1;
		}
	}
	return pages.length;
}
