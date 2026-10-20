/**
 * FotoGrids - Pagination core (shared registry).
 *
 * Exposes `window.FotoGrids.modules.pagination` with:
 *   - state(galleryEl)            - { page, totalPages, pageSize, hasMore }
 *   - goToPage(galleryEl, page, opts)
 *   - prefetch(galleryEl, page)
 *   - onChange(galleryEl, cb)     - subscribe to page changes
 *   - setSlicePlanner(galleryEl, planner) - request exact slices for a gallery
 *   - replan(galleryEl)           - re-read the planner after its cuts moved
 *
 * The per-method modules (endless-scroll, load-more, page-buttons) read
 * `FotoGrids.modules.pagination` and wire their own UI to it. Cross-method
 * coordination such as preload_next_page lives here.
 */

import { injectMissingStyles } from '../../_helpers/stylesheets.js';

(function () {
	'use strict';

	/** Per-gallery change listeners. Keyed by gallery wrapper element. */
	const listeners = new WeakMap();

	/**
	 * Per-gallery filter-view cache. Maps gallery → Map<fingerprint, snapshot>.
	 * Each snapshot is taken after the most recent applyPage() call and
	 * holds enough state to restore the user's exact view of that filter
	 * combination without a re-fetch:
	 *
	 *   {
	 *     html:       String,  // innerHTML of items root at last paint
	 *     page:       Number,  // current page reached
	 *     totalPages: Number,  // total pages of THIS filter set
	 *     hasMore:    Boolean, // mirrors page < totalPages
	 *     pageSize:   Number,  // items per page of the painted view
	 *     breakpoint: String,  // breakpoint the view was paged at
	 *   }
	 *
	 * Lives in JS memory only - cleared on page navigation/refresh.
	 *
	 * @type {WeakMap<Element, Map<string, object>>}
	 */
	const filterViewCache = new WeakMap();

	/**
	 * Per-gallery last-known filter fingerprint: the cache slot a completed paint
	 * is written to. Updated by setActiveFilterFingerprint().
	 *
	 * @type {WeakMap<Element, string>}
	 */
	const activeFingerprint = new WeakMap();

	/**
	 * Per-gallery monotonic request token, bumped on every goToPage /
	 * swapToFilterState fetch. A response whose token has been superseded is
	 * not written to the DOM or the cache, so overlapping filter toggles cannot
	 * paint stale items.
	 *
	 * @type {WeakMap<Element, number>}
	 */
	const inflightToken = new WeakMap();

	/**
	 * Per-gallery slice planners. A layout that cuts its own pages registers one;
	 * requests for that gallery then ask for an exact slice (offset + length)
	 * instead of a page number.
	 *
	 *   next(loaded)          - { offset, length } after `loaded` items, or null
	 *   page(n)               - { offset, length } of 1-based page n, or null
	 *   pageContaining(index) - 1-based page holding sequence index `index`
	 *   total()               - page count
	 *
	 * @type {WeakMap<Element, object>}
	 */
	const planners = new WeakMap();

	/**
	 * @param {Element} galleryEl
	 * @returns {object|null}
	 */
	function plannerFor(galleryEl) {
		return planners.get(galleryEl) || null;
	}

	/**
	 * Items on screen that belong to the loaded run, in order.
	 *
	 * @param {Element} galleryEl
	 * @returns {Element[]}
	 */
	function loadedItems(galleryEl) {
		const root = resolveItemsRoot(galleryEl);
		if (!root) {
			return [];
		}
		return Array.prototype.filter.call(
			root.querySelectorAll('.fg-item'),
			function (node) {
				return !node.hasAttribute('data-fg-overflow');
			}
		);
	}

	/**
	 * Settles the overflow pool before an append: items before the appended
	 * slice belong to the loaded run and show; the rest are replaced by it.
	 *
	 * @param {Element} galleryEl
	 * @param {number}  from Sequence index the appended slice starts at, or -1.
	 */
	function dropOverflow(galleryEl, from) {
		const root = resolveItemsRoot(galleryEl);
		if (!root) {
			return;
		}
		root.querySelectorAll('[data-fg-overflow]').forEach(function (node) {
			const index = parseInt(
				node.getAttribute('data-fg-sequence-index') || '',
				10
			);
			if (from >= 0 && Number.isFinite(index) && index < from) {
				node.removeAttribute('data-fg-overflow');
			} else {
				node.remove();
			}
		});
	}

	/**
	 * Sequence index of the first item on screen.
	 *
	 * @param {Element} galleryEl
	 * @returns {number}
	 */
	function firstSequenceIndex(galleryEl) {
		const first = loadedItems(galleryEl)[0];
		const index = first
			? parseInt(first.getAttribute('data-fg-sequence-index') || '', 10)
			: NaN;
		return Number.isFinite(index) ? index : 0;
	}

	/**
	 * @param {string} method
	 * @returns {boolean}
	 */
	function isAppendMethod(method) {
		return method !== 'pages';
	}

	/**
	 * Per-gallery preloaded page: the response promise of a prefetch(), keyed by
	 * its exact request. A gallery holds one, and goToPage() uses it once.
	 *
	 * @type {WeakMap<Element, {key:string, promise:Promise<object>}>}
	 */
	const heldPages = new WeakMap();

	/**
	 * Per-gallery goToPage() request in flight, so a preload of the same request
	 * waits on it instead of sending a second one.
	 *
	 * @type {WeakMap<Element, {key:string, promise:Promise<object>}>}
	 */
	const pendingRequests = new WeakMap();

	function nextToken(galleryEl) {
		const t = (inflightToken.get(galleryEl) || 0) + 1;
		inflightToken.set(galleryEl, t);
		return t;
	}

	function isCurrentToken(galleryEl, token) {
		return (inflightToken.get(galleryEl) || 0) === token;
	}

	/**
	 * Filter-handling strategy.
	 *
	 *   'server' (default) - every filter change fetches from the server; its
	 *                        total_pages is the only writer of data-fg-page-total.
	 *   'cache'            - every paint is snapshotted per filter fingerprint and
	 *                        restored on revisits, fetching only on a cache miss.
	 *
	 * Toggle via:
	 *   - data-fg-filter-strategy="cache" on the gallery wrapper (per-gallery)
	 *   - FotoGrids.modules.pagination.setFilterStrategy('cache') (global default)
	 *
	 * @type {'server'|'cache'}
	 */
	let defaultFilterStrategy = 'server';

	function strategyFor(galleryEl) {
		if (planners.has(galleryEl)) {
			return 'server';
		}
		const attr =
			galleryEl &&
			galleryEl.dataset &&
			galleryEl.dataset.fgFilterStrategy;
		if (attr === 'server' || attr === 'cache') {
			return attr;
		}
		return defaultFilterStrategy;
	}

	/**
	 * Reads pagination state off the gallery wrapper's data-fg-* attributes.
	 * Always returns a fresh object - never the stored one, callers should
	 * not mutate it.
	 *
	 * @param {Element} galleryEl
	 * @returns {{page:number,totalPages:number,pageSize:number,method:string,preload:boolean,hasMore:boolean}}
	 */
	function readState(galleryEl) {
		const ds = galleryEl.dataset;
		const page = parseInt(ds.fgPageCurrent || '1', 10);
		const totalPages = parseInt(ds.fgPageTotal || '1', 10);
		const pageSize = parseInt(ds.fgPageSize || '0', 10);
		const method = ds.fgPaginationMethod || 'load_more';
		const planner = plannerFor(galleryEl);

		if (planner) {
			const plannedTotal = Math.max(1, planner.total());
			return {
				page: Math.min(page, plannedTotal),
				totalPages: plannedTotal,
				pageSize,
				method,
				preload: ds.fgPaginationPreload === 'true',
				hasMore: isAppendMethod(method)
					? planner.next(loadedItems(galleryEl).length) !== null
					: page < plannedTotal,
			};
		}

		return {
			page,
			totalPages,
			pageSize,
			method,
			preload: ds.fgPaginationPreload === 'true',
			hasMore: page < totalPages,
		};
	}

	/**
	 * Writes page state back to the wrapper. Called after a successful
	 * goToPage().
	 *
	 * @param {Element} galleryEl
	 * @param {{page:number,totalPages:number,pageSize?:number,breakpoint?:string}} next
	 */
	function writeState(galleryEl, next) {
		galleryEl.dataset.fgPageCurrent = String(next.page);
		galleryEl.dataset.fgPageTotal = String(next.totalPages);
		if (next.pageSize > 0) {
			galleryEl.dataset.fgPageSize = String(next.pageSize);
		}
		if (next.breakpoint) {
			galleryEl.dataset.fgViewBreakpoint = next.breakpoint;
		}
	}

	/**
	 * The breakpoint the items on screen were paged at. An append must reuse
	 * it, or its offsets will not line up with them.
	 *
	 * @param {Element} galleryEl
	 * @returns {string}
	 */
	function viewBreakpoint(galleryEl) {
		return galleryEl.dataset.fgViewBreakpoint || 'desktop';
	}

	/**
	 * @returns {string} The visitor's breakpoint, per the runtime.
	 */
	function activeBreakpoint() {
		return window.FotoGrids &&
			typeof window.FotoGrids.activeBreakpoint === 'function'
			? window.FotoGrids.activeBreakpoint()
			: 'desktop';
	}

	/**
	 * Reads data-fg-page-sizes ("<desktop> <tablet> <mobile>").
	 *
	 * @param {Element} galleryEl
	 * @returns {{desktop:number,tablet:number,mobile:number}|null}
	 */
	function readPageSizes(galleryEl) {
		const raw = galleryEl.dataset.fgPageSizes;
		if (!raw) {
			return null;
		}
		const parts = raw
			.trim()
			.split(/\s+/)
			.map(function (n) {
				return parseInt(n, 10);
			});
		if (
			parts.length !== 3 ||
			parts.some(function (n) {
				return !(n > 0);
			})
		) {
			return null;
		}
		return { desktop: parts[0], tablet: parts[1], mobile: parts[2] };
	}

	/**
	 * Resolve the items container to append/replace inside. The layout
	 * module's root has the structural class (e.g. .fg-layout-grid) -
	 * pagination doesn't know which layout is active, so it looks for a
	 * `data-fg-items-root="true"` attribute on the root, falling back to
	 * the wrapper's first non-chrome child when no layout emits it.
	 *
	 * @param {Element} galleryEl
	 * @returns {Element|null}
	 */
	function resolveItemsRoot(galleryEl) {
		const explicit = galleryEl.querySelector('[data-fg-items-root="true"]');
		if (explicit) {
			return explicit;
		}

		// Fallback: first child that isn't a known chrome element.
		const chromeSelectors = [
			'.fotogrids-filters',
			'.fg-pagination',
			'style',
			'.fotogrids-password-gate',
		];
		const children = Array.prototype.slice.call(galleryEl.children);
		for (let i = 0; i < children.length; i++) {
			const el = children[i];
			const isChrome = chromeSelectors.some(function (sel) {
				return el.matches(sel);
			});
			if (!isChrome) {
				return el;
			}
		}
		return null;
	}

	/**
	 * Notify listeners for a gallery that its page has changed.
	 *
	 * @param {Element} galleryEl
	 * @param {object}  detail
	 */
	function notify(galleryEl, detail) {
		const cbs = listeners.get(galleryEl);
		if (cbs) {
			cbs.forEach(function (cb) {
				try {
					cb(detail);
				} catch (err) {
					/* swallow listener errors */
				}
			});
		}
		galleryEl.dispatchEvent(
			new CustomEvent('fotogrids:page_changed', {
				bubbles: true,
				detail,
			})
		);
	}

	/**
	 * Build the render request for a page. Its key covers the body and the
	 * unlock header, so two requests share a key only when they would return
	 * the same page.
	 *
	 * @param {Element} galleryEl
	 * @param {number}  page
	 * @param {string}  [breakpoint] Defaults to the breakpoint of the current view.
	 * @param {{offset?:number,length?:number,withAspects?:boolean}} [extra]
	 *        An exact slice to request, and whether to return the sequence's
	 *        aspect ratios.
	 * @returns {{url:string, options:object, key:string}|null} Null when the
	 *          gallery has no render context.
	 */
	function buildRequest(galleryEl, page, breakpoint, extra) {
		const url =
			galleryEl.dataset.fgRenderUrl ||
			(window.fotogrids && window.fotogrids.renderUrl) ||
			'';
		const nonce =
			galleryEl.dataset.fgRenderNonce ||
			(window.fotogrids && window.fotogrids.renderNonce) ||
			'';
		const galleryId = parseInt(galleryEl.dataset.fgGalleryId || '0', 10);

		if (!url || !galleryId) {
			return null;
		}

		const requestBreakpoint = breakpoint || viewBreakpoint(galleryEl);

		// Pull active filter state from the filters module (if loaded).
		// Sent on every fetch so the server returns items from the
		// filtered set. When no filters are active, sends an empty
		// object which the server treats as "no filter".
		const filters =
			window.FotoGrids &&
			window.FotoGrids.modules &&
			window.FotoGrids.modules.filters &&
			typeof window.FotoGrids.modules.filters.getActive === 'function'
				? window.FotoGrids.modules.filters.getActive(galleryEl)
				: {};

		// Random sort seed - only present when default_sort_order is
		// 'random'. Sending it back unchanged on every paginated request
		// is what keeps the shuffle stable across pages. The server
		// ignores zero/missing.
		const randomSeed = parseInt(galleryEl.dataset.fgRandomSeed || '0', 10);

		const containerWidth = parseInt(
			galleryEl.dataset.fgContainerWidth || '0',
			10
		);

		const instanceIdPattern = new RegExp(
			'^fg-' + galleryId + '-[0-9a-z]{1,34}$'
		);

		const headers = {
			'Content-Type': 'application/json',
			'X-WP-Nonce': nonce,
		};
		if (galleryEl.dataset.fgUnlockToken) {
			headers['X-FotoGrids-Unlock'] = galleryEl.dataset.fgUnlockToken;
		}

		const requestBody = {
			gallery_id: galleryId,
			page,
			breakpoint: requestBreakpoint,
			partial: 'items_only',
			filters,
			random_seed: randomSeed,
			container_width: containerWidth > 0 ? containerWidth : 0,
			instance_id: instanceIdPattern.test(galleryEl.id)
				? galleryEl.id
				: '',
		};
		if (extra && extra.length > 0) {
			requestBody.offset = Math.max(0, extra.offset || 0);
			requestBody.length = extra.length;
		}
		if (extra && extra.withAspects) {
			requestBody.with_aspects = true;
		}

		const body = JSON.stringify(requestBody);

		return {
			url,
			options: {
				method: 'POST',
				headers,
				credentials: 'same-origin',
				body,
			},
			key: (headers['X-FotoGrids-Unlock'] || '') + '\n' + body,
		};
	}

	/**
	 * Send a render request. Resolves with the response payload or rejects.
	 *
	 * @param {{url:string, options:object}} request
	 * @returns {Promise<object>}
	 */
	function sendRequest(request) {
		return fetch(request.url, request.options).then(function (response) {
			if (!response.ok) {
				throw new Error('pagination/http-' + response.status);
			}
			return response.json();
		});
	}

	/**
	 * Apply a fetched page to the gallery DOM.
	 *
	 * @param {Element} galleryEl
	 * @param {{html:string,css:object,page:number,total_pages:number,page_size:number,has_more:boolean}} payload
	 * @param {'replace'|'append'} mode
	 * @param {string} [capturedFingerprint] Fingerprint captured at fetch
	 *        time. When provided, the snapshot taken after this paint is
	 *        keyed against this value rather than the current active
	 *        fingerprint, which can change during overlapping requests.
	 * @param {string} [breakpoint] Breakpoint the page was requested at.
	 * @param {boolean} [reflow] True when the page re-pages the server render
	 *        for the visitor's breakpoint rather than following a visitor action.
	 */
	function applyPage(
		galleryEl,
		payload,
		mode,
		capturedFingerprint,
		breakpoint,
		reflow
	) {
		injectMissingStyles(payload.css || {});

		const root = resolveItemsRoot(galleryEl);
		if (!root) {
			throw new Error('pagination/no-items-root');
		}

		// items_only returns the layout's items root (e.g. .fg-grid-track with
		// data-fg-items-root); it is unwrapped so appending does not nest a second one.
		const template = document.createElement('template');
		template.innerHTML = payload.html;

		const inserted = [];

		// If the top-level element of the response is itself an items
		// root, unwrap it. Otherwise, just take all top-level children.
		const topLevel = Array.prototype.slice.call(template.content.children);

		// A gate can claim the render - a gallery unlocked for this page view
		// only, say - and its lock screen must not be painted into the items
		// root. Anything that is not items leaves the current view alone.
		const isItems =
			topLevel.length > 0 &&
			(topLevel.every(function (el) {
				return el.dataset && el.dataset.fgItemsRoot === 'true';
			}) ||
				!!template.content.querySelector('.fg-item'));
		if (!isItems) {
			throw new Error('pagination/not-items');
		}

		let sourceChildren = [];
		if (
			topLevel.length === 1 &&
			topLevel[0].dataset &&
			topLevel[0].dataset.fgItemsRoot === 'true'
		) {
			sourceChildren = Array.prototype.slice.call(topLevel[0].children);
		} else {
			sourceChildren = topLevel;
		}

		if (mode === 'append') {
			const firstIncoming = sourceChildren[0]
				? parseInt(
						sourceChildren[0].getAttribute(
							'data-fg-sequence-index'
						) || '',
						10
					)
				: NaN;
			dropOverflow(
				galleryEl,
				Number.isFinite(firstIncoming) ? firstIncoming : -1
			);
			sourceChildren.forEach(function (node) {
				root.appendChild(node);
				inserted.push(node);
			});
		} else {
			root.innerHTML = '';
			sourceChildren.forEach(function (node) {
				root.appendChild(node);
				inserted.push(node);
			});
		}

		// Tell per-item modules (lazy-load, loaded-effect, stats, sharing,
		// lightbox) that new items have arrived. They listen for this event
		// on the gallery wrapper.
		galleryEl.dispatchEvent(
			new CustomEvent('fotogrids:items_inserted', {
				bubbles: true,
				detail: { items: inserted, galleryEl },
			})
		);

		// Before the snapshot, so the cached view records what it holds.
		writeState(galleryEl, {
			page: payload.page,
			totalPages: payload.total_pages,
			pageSize: payload.page_size,
			breakpoint,
		});

		// Snapshot into the filter-view cache under the fingerprint captured at fetch
		// time, so an early response cannot be filed under a later filter. Skipped
		// under the 'server' strategy, which never reads the cache.
		if (strategyFor(galleryEl) !== 'server') {
			if (typeof capturedFingerprint === 'string') {
				snapshotCurrentViewAs(galleryEl, capturedFingerprint);
			} else {
				snapshotCurrentView(galleryEl);
			}
		}

		notify(galleryEl, {
			galleryEl,
			page: payload.page,
			mode,
			hasMore: payload.has_more,
			reflow: !!reflow,
		});

		// Kick off preload for the next page if enabled and there is one.
		if (
			payload.has_more &&
			galleryEl.dataset.fgPaginationPreload === 'true'
		) {
			schedulePreload(galleryEl, payload.page + 1);
		}
	}

	/**
	 * The slice a planned gallery requests for a page change, or null when the
	 * planner has nothing there.
	 *
	 * @param {Element} galleryEl
	 * @param {object}  planner
	 * @param {number}  page
	 * @param {'replace'|'append'} mode
	 * @returns {{offset:number,length:number}|null}
	 */
	function plannedSlice(galleryEl, planner, page, mode) {
		return 'append' === mode
			? planner.next(loadedItems(galleryEl).length)
			: planner.page(page);
	}

	/**
	 * Schedule an idle preload of the given page. It is skipped if, by the time
	 * it runs, the page is no longer the one after the current page.
	 *
	 * @param {Element} galleryEl
	 * @param {number}  page
	 */
	function schedulePreload(galleryEl, page) {
		const planner = plannerFor(galleryEl);
		const slice = planner
			? plannedSlice(
					galleryEl,
					planner,
					page,
					isAppendMethod(readState(galleryEl).method)
						? 'append'
						: 'replace'
				)
			: null;
		if (planner && !slice) {
			return;
		}
		const run = function () {
			const s = readState(galleryEl);
			if (s.page + 1 !== page || page > s.totalPages) {
				return;
			}
			prefetch(
				galleryEl,
				page,
				planner ? activeBreakpoint() : undefined,
				slice || undefined
			).catch(function () {
				/* preload errors are silent */
			});
		};

		if (typeof window.requestIdleCallback === 'function') {
			window.requestIdleCallback(run, { timeout: 1500 });
		} else {
			setTimeout(run, 250);
		}
	}

	/**
	 * Read the canonical fingerprint of the currently-active filter map
	 * for this gallery. Delegates to FotoGrids.modules.filters.fingerprint
	 * so filter-ui.js is the single source of truth.
	 *
	 * Returns '' (empty fingerprint) when filters module isn't loaded -
	 * e.g. galleries without filtering enabled. That fingerprint just
	 * means "no filter".
	 *
	 * @param {Element} galleryEl
	 * @returns {string}
	 */
	function currentFingerprint(galleryEl) {
		const fmod =
			window.FotoGrids &&
			window.FotoGrids.modules &&
			window.FotoGrids.modules.filters;
		if (!fmod) {
			return '';
		}
		const map = fmod.getActive ? fmod.getActive(galleryEl) : {};
		return fmod.fingerprint ? fmod.fingerprint(map) : '';
	}

	function ensureCacheBucket(galleryEl) {
		if (!filterViewCache.has(galleryEl)) {
			filterViewCache.set(galleryEl, new Map());
		}
		return filterViewCache.get(galleryEl);
	}

	/**
	 * Snapshot the gallery's current view into the cache, keyed by the
	 * fingerprint last set as active. Called after every applyPage()
	 * so the snapshot always reflects the latest loaded state.
	 *
	 * If the active fingerprint isn't set yet (first paint), seed it
	 * from the current filter state.
	 *
	 * @param {Element} galleryEl
	 */
	function snapshotCurrentView(galleryEl) {
		const root = resolveItemsRoot(galleryEl);
		if (!root) {
			return;
		}

		if (!activeFingerprint.has(galleryEl)) {
			activeFingerprint.set(galleryEl, currentFingerprint(galleryEl));
		}
		const fp = activeFingerprint.get(galleryEl);
		const s = readState(galleryEl);

		ensureCacheBucket(galleryEl).set(fp, {
			html: root.innerHTML,
			page: s.page,
			totalPages: s.totalPages,
			hasMore: s.hasMore,
			pageSize: s.pageSize,
			breakpoint: viewBreakpoint(galleryEl),
		});
	}

	/**
	 * Same as snapshotCurrentView but writes under a caller-supplied
	 * fingerprint instead of the currently-active one. Used by applyPage
	 * so the snapshot key is the fingerprint that was active when the
	 * fetch was kicked off - guaranteeing the cache slot reflects what
	 * the server actually returned.
	 *
	 * @param {Element} galleryEl
	 * @param {string}  fp
	 */
	function snapshotCurrentViewAs(galleryEl, fp) {
		const root = resolveItemsRoot(galleryEl);
		if (!root) {
			return;
		}
		const s = readState(galleryEl);
		ensureCacheBucket(galleryEl).set(fp, {
			html: root.innerHTML,
			page: s.page,
			totalPages: s.totalPages,
			hasMore: s.hasMore,
			pageSize: s.pageSize,
			breakpoint: viewBreakpoint(galleryEl),
		});
	}

	/**
	 * Restore a cached view into the gallery. Used when the user toggles
	 * back to a filter state they've already seen - no fetch, instant
	 * paint.
	 *
	 * @param {Element} galleryEl
	 * @param {string}  fingerprint
	 * @returns {{page:number, hasMore:boolean}|null} restored state or null if cache miss.
	 */
	function restoreCachedView(galleryEl, fingerprint) {
		const bucket = filterViewCache.get(galleryEl);
		if (!bucket) {
			return null;
		}
		const snap = bucket.get(fingerprint);
		if (!snap) {
			return null;
		}

		const root = resolveItemsRoot(galleryEl);
		if (!root) {
			return null;
		}

		// Take the new items list to dispatch in fotogrids:items_inserted
		// so lazy-load, loading-icon, etc. re-bind on the restored DOM.
		root.innerHTML = snap.html;
		const inserted = Array.prototype.slice.call(root.children);

		writeState(galleryEl, {
			page: snap.page,
			totalPages: snap.totalPages,
			pageSize: snap.pageSize,
			breakpoint: snap.breakpoint,
		});
		activeFingerprint.set(galleryEl, fingerprint);

		notify(galleryEl, {
			galleryEl,
			page: snap.page,
			mode: 'replace',
			hasMore: snap.hasMore,
			fromCache: true,
		});

		galleryEl.dispatchEvent(
			new CustomEvent('fotogrids:items_inserted', {
				bubbles: true,
				detail: { items: inserted, galleryEl },
			})
		);

		if (snap.hasMore && galleryEl.dataset.fgPaginationPreload === 'true') {
			schedulePreload(galleryEl, snap.page + 1);
		}

		return { page: snap.page, hasMore: snap.hasMore };
	}

	/**
	 * Swap the gallery to a new filter state, using the cache when
	 * possible. Called by pagination method modules in response to the
	 * `fotogrids:filters_changed` event.
	 *
	 * Behaviour:
	 *   1. Capture the current view under the PREVIOUS fingerprint (this
	 *      already happened on the last applyPage call - but if items
	 *      were inserted by another path since then, refresh).
	 *   2. Compute new fingerprint.
	 *   3. If new fingerprint is in cache → restore from cache, resolve
	 *      immediately.
	 *   4. Else → goToPage(1, { mode: 'replace' }) which fetches from
	 *      the server and applies normally. The next applyPage will
	 *      snapshot the result under the new fingerprint.
	 *
	 * Returns a Promise that resolves to { page, hasMore } in both
	 * cache-hit and cache-miss paths.
	 *
	 * @param {Element} galleryEl
	 * @returns {Promise<{page:number,hasMore:boolean,fromCache:boolean}>}
	 */
	function swapToFilterState(galleryEl) {
		const newFp = currentFingerprint(galleryEl);

		// 'server' strategy: always fetch; nothing reads the cache.
		if (strategyFor(galleryEl) === 'server') {
			activeFingerprint.set(galleryEl, newFp);
			return goToPage(galleryEl, 1, {
				mode: 'replace',
				fingerprint: newFp,
				newSequence: true,
			}).then(function (result) {
				return {
					page: result.page,
					hasMore: result.hasMore,
					fromCache: false,
				};
			});
		}

		// 'cache' strategy. No snapshot here: filter-ui has already marked items for
		// the new state, so the DOM is no longer clean. Clean snapshots come from the
		// onGallery init (cache['']) and from applyPage() under the fingerprint that
		// was active at fetch time.
		const restored = restoreCachedView(galleryEl, newFp);

		if (restored) {
			return Promise.resolve({
				page: restored.page,
				hasMore: restored.hasMore,
				fromCache: true,
			});
		}

		// Cache miss: make the new fingerprint active and pass it to goToPage, so the
		// post-fetch snapshot lands in the right slot even if another swap starts
		// while this fetch is in flight.
		activeFingerprint.set(galleryEl, newFp);

		return goToPage(galleryEl, 1, {
			mode: 'replace',
			fingerprint: newFp,
			newSequence: true,
		}).then(function (result) {
			return {
				page: result.page,
				hasMore: result.hasMore,
				fromCache: false,
			};
		});
	}

	/**
	 * Public state accessor.
	 *
	 * @param {Element} galleryEl
	 */
	function state(galleryEl) {
		return readState(galleryEl);
	}

	/**
	 * Fetch + apply a page.
	 *
	 * @param {Element} galleryEl
	 * @param {number}  page
	 * @param {{mode?:'replace'|'append',fingerprint?:string,reflow?:boolean,newSequence?:boolean}} opts
	 *        `newSequence` asks a planned gallery for a fresh page 1 cut by the
	 *        server, with the new sequence's aspect ratios.
	 * @returns {Promise<{page:number,hasMore:boolean}>}
	 */
	function goToPage(galleryEl, page, opts) {
		const mode = (opts && opts.mode) || 'replace';
		const planner = plannerFor(galleryEl);
		const newSequence = !!(opts && opts.newSequence);
		let slice = null;
		if (planner && !newSequence) {
			slice = plannedSlice(galleryEl, planner, page, mode);
			if (!slice) {
				const s = readState(galleryEl);
				return Promise.resolve({ page: s.page, hasMore: false });
			}
		}

		// Capture the fingerprint and a fresh request token; a response superseded
		// by a later request is not applied.
		const capturedFp =
			opts && typeof opts.fingerprint === 'string'
				? opts.fingerprint
				: currentFingerprint(galleryEl);
		const capturedToken = nextToken(galleryEl);

		galleryEl.classList.add('fotogrids-gallery--is-paginating');

		// A replace repaints everything, so it can move breakpoint; an append
		// extends the current view and keeps its own.
		const breakpoint =
			'replace' === mode || planner
				? activeBreakpoint()
				: viewBreakpoint(galleryEl);
		const reflow = !!(opts && opts.reflow);
		const extra = slice
			? { offset: slice.offset, length: slice.length }
			: { withAspects: !!planner && newSequence };

		return requestPage(galleryEl, page, breakpoint, extra)
			.then(function (payload) {
				if (!isCurrentToken(galleryEl, capturedToken)) {
					// Superseded by a newer request: resolve callers with the payload but
					// leave the DOM and cache to the newer request.
					return {
						page: payload.page,
						hasMore: payload.has_more,
						stale: true,
					};
				}
				if (slice) {
					payload = withPlannedTotals(galleryEl, payload, page, mode);
				}
				applyPage(
					galleryEl,
					payload,
					mode,
					capturedFp,
					breakpoint,
					reflow
				);
				if (Array.isArray(payload.aspects)) {
					galleryEl.dispatchEvent(
						new CustomEvent('fotogrids:sequence_changed', {
							bubbles: true,
							detail: { galleryEl, aspects: payload.aspects },
						})
					);
				}
				if (planner && newSequence) {
					const now = readState(galleryEl);
					return { page: now.page, hasMore: now.hasMore };
				}
				return { page: payload.page, hasMore: !!payload.has_more };
			})
			.catch(function (err) {
				console.warn('[fotogrids] pagination failed:', err);
				throw err;
			})
			.then(
				function (result) {
					galleryEl.classList.remove(
						'fotogrids-gallery--is-paginating'
					);
					return result;
				},
				function (err) {
					galleryEl.classList.remove(
						'fotogrids-gallery--is-paginating'
					);
					throw err;
				}
			);
	}

	/**
	 * Rewrites a planned slice response's page numbers from the planner, which
	 * cut it.
	 *
	 * @param {Element} galleryEl
	 * @param {object}  payload
	 * @param {number}  page
	 * @param {'replace'|'append'} mode
	 * @returns {object}
	 */
	function withPlannedTotals(galleryEl, payload, page, mode) {
		const planner = plannerFor(galleryEl);
		const total = Math.max(1, planner.total());
		if ('append' === mode) {
			const count =
				loadedItems(galleryEl).length + countItems(payload.html);
			return Object.assign({}, payload, {
				page: Math.min(planner.pageContaining(count - 1), total),
				total_pages: total,
				page_size: payload.length || payload.page_size,
				has_more: !!payload.has_more,
			});
		}
		const current = Math.min(Math.max(1, page), total);
		return Object.assign({}, payload, {
			page: current,
			total_pages: total,
			page_size: payload.length || payload.page_size,
			has_more: current < total,
		});
	}

	/**
	 * @param {string} html
	 * @returns {number}
	 */
	function countItems(html) {
		const template = document.createElement('template');
		template.innerHTML = html || '';
		return template.content.querySelectorAll(
			'.fg-item:not([data-fg-overflow])'
		).length;
	}

	/**
	 * Registers the slice planner a layout cuts a gallery's pages with.
	 *
	 * @param {Element}     galleryEl
	 * @param {object|null} planner
	 */
	function setSlicePlanner(galleryEl, planner) {
		if (planner) {
			planners.set(galleryEl, planner);
			galleryEl.dataset.fgSlicePlanner = 'ready';
		} else {
			planners.delete(galleryEl);
			delete galleryEl.dataset.fgSlicePlanner;
		}
	}

	/**
	 * Re-reads a gallery's planner after its cuts moved. Append methods keep the
	 * items on screen and only refresh totals; Page Buttons moves to the page
	 * holding the first item on screen, fetching only when that page's slice
	 * differs from what is shown.
	 *
	 * @param {Element} galleryEl
	 */
	function replan(galleryEl) {
		const planner = plannerFor(galleryEl);
		if (!planner) {
			return;
		}
		const s = readState(galleryEl);

		if (isAppendMethod(s.method)) {
			const loaded = loadedItems(galleryEl).length;
			const page = Math.min(
				planner.pageContaining(Math.max(0, loaded - 1)),
				s.totalPages
			);
			writeState(galleryEl, { page, totalPages: s.totalPages });
			notify(galleryEl, {
				galleryEl,
				page,
				mode: 'replan',
				hasMore: s.hasMore,
				reflow: true,
			});
			return;
		}

		const first = firstSequenceIndex(galleryEl);
		const target = planner.pageContaining(first);
		const slice = planner.page(target);
		const shown = loadedItems(galleryEl).length;

		if (slice && slice.offset === first && slice.length === shown) {
			writeState(galleryEl, {
				page: target,
				totalPages: s.totalPages,
			});
			notify(galleryEl, {
				galleryEl,
				page: target,
				mode: 'replan',
				hasMore: target < s.totalPages,
				reflow: true,
			});
			return;
		}

		goToPage(galleryEl, target, { mode: 'replace', reflow: true }).catch(
			function () {
				/* the current view stands */
			}
		);
	}

	/**
	 * Request a page for goToPage(): the held page when it matches the request,
	 * otherwise a fresh request. A held page that fails falls back to a fresh
	 * request. Any held page is dropped, used or not.
	 *
	 * @param {Element} galleryEl
	 * @param {number}  page
	 * @param {string}  breakpoint
	 * @param {{offset?:number,length?:number,withAspects?:boolean}} [extra]
	 * @returns {Promise<object>}
	 */
	function requestPage(galleryEl, page, breakpoint, extra) {
		const request = buildRequest(galleryEl, page, breakpoint, extra);
		const held = heldPages.get(galleryEl);
		heldPages.delete(galleryEl);

		if (!request) {
			return Promise.reject(new Error('pagination/no-render-context'));
		}

		const promise =
			held && held.key === request.key
				? held.promise.catch(function () {
						return sendRequest(request);
					})
				: sendRequest(request);

		const entry = { key: request.key, promise };
		pendingRequests.set(galleryEl, entry);
		const settle = function () {
			if (pendingRequests.get(galleryEl) === entry) {
				pendingRequests.delete(galleryEl);
			}
		};
		promise.then(settle, settle);

		return promise;
	}

	/**
	 * Prefetch a page and hold the response for the next goToPage() with the
	 * same request. Used by preload_next_page. Reuses a held or in-flight
	 * request for the same page instead of sending another; a newer prefetch
	 * replaces the held one.
	 *
	 * @param {Element} galleryEl
	 * @param {number}  page
	 * @param {string}  [breakpoint] Defaults to the breakpoint of the current view.
	 * @param {{offset?:number,length?:number,withAspects?:boolean}} [extra]
	 * @returns {Promise<object>}
	 */
	function prefetch(galleryEl, page, breakpoint, extra) {
		const request = buildRequest(
			galleryEl,
			page,
			breakpoint || viewBreakpoint(galleryEl),
			extra
		);
		if (!request) {
			return Promise.reject(new Error('pagination/no-render-context'));
		}

		const pending = pendingRequests.get(galleryEl);
		if (pending && pending.key === request.key) {
			return pending.promise;
		}
		const held = heldPages.get(galleryEl);
		if (held && held.key === request.key) {
			return held.promise;
		}

		const entry = { key: request.key, promise: sendRequest(request) };
		heldPages.set(galleryEl, entry);
		entry.promise.catch(function () {
			if (heldPages.get(galleryEl) === entry) {
				heldPages.delete(galleryEl);
			}
		});
		return entry.promise;
	}

	/**
	 * Subscribe to page-change notifications for a specific gallery.
	 *
	 * @param {Element}                  galleryEl
	 * @param {(detail: Object) => void} cb
	 */
	function onChange(galleryEl, cb) {
		if (!listeners.has(galleryEl)) {
			listeners.set(galleryEl, []);
		}
		listeners.get(galleryEl).push(cb);
	}

	/**
	 * Whether the visitor's breakpoint pages differently from the view.
	 *
	 * @param {Element} galleryEl
	 * @returns {boolean}
	 */
	function needsReflow(galleryEl) {
		const sizes = readPageSizes(galleryEl);
		if (!sizes) {
			return false;
		}
		const active = activeBreakpoint();
		const view = viewBreakpoint(galleryEl);
		return active !== view && sizes[active] !== sizes[view];
	}

	/**
	 * Records a page 1 another module fetched and painted, so later requests
	 * page at the same breakpoint.
	 *
	 * @param {Element} galleryEl
	 * @param {{page:number,total_pages:number,page_size:number,has_more:boolean}} payload
	 * @param {string}  breakpoint
	 */
	function adopt(galleryEl, payload, breakpoint) {
		if (!payload || !(payload.total_pages > 0)) {
			return;
		}
		writeState(galleryEl, {
			page: payload.page || 1,
			totalPages: payload.total_pages,
			pageSize: payload.page_size,
			breakpoint,
		});
		notify(galleryEl, {
			galleryEl,
			page: payload.page || 1,
			mode: 'replace',
			hasMore: !!payload.has_more,
			reflow: true,
		});

		if (
			payload.has_more &&
			galleryEl.dataset.fgPaginationPreload === 'true'
		) {
			schedulePreload(galleryEl, (payload.page || 1) + 1);
		}
	}

	function expose() {
		const FG = window.FotoGrids;
		if (!FG) {
			return false;
		}
		if (!FG.modules) {
			FG.modules = {};
		}
		FG.modules.pagination = {
			state,
			goToPage,
			prefetch,
			onChange,
			swapToFilterState,
			adopt,
			setSlicePlanner,
			replan,
			/**
			 * Set the global filter strategy. Per-gallery overrides via
			 * data-fg-filter-strategy still win.
			 *
			 * @param {'server'|'cache'} s
			 */
			setFilterStrategy(s) {
				if (s === 'server' || s === 'cache') {
					defaultFilterStrategy = s;
				}
			},
			/**
			 * Read the strategy that would currently apply to a gallery.
			 * Useful for tests / debugging.
			 *
			 * @param {Element} galleryEl
			 * @returns {'server'|'cache'}
			 */
			getFilterStrategy(galleryEl) {
				return strategyFor(galleryEl);
			},
		};
		return true;
	}

	function init() {
		if (!expose()) {
			// Runtime not yet attached - wait for it.
			document.addEventListener('fotogrids:ready', expose, {
				once: true,
			});
			return;
		}

		// Per paginated gallery: snapshot the server slice (cache strategy
		// only), then re-page to the visitor's breakpoint or preload the next
		// page. A random-sort refetch replaces page 1 instead, and calls adopt(),
		// which preloads the next page of the new order.
		window.FotoGrids.onGallery(function (gEl) {
			if (gEl.dataset.fgPaginated !== 'true') {
				return;
			}
			if (strategyFor(gEl) !== 'server') {
				snapshotCurrentView(gEl);
			}
			// Layouts that loaded first register their slice planner on this.
			gEl.dispatchEvent(
				new CustomEvent('fotogrids:pagination_attached', {
					detail: { galleryEl: gEl },
				})
			);
			const planned = gEl.dataset.fgSlicePlanned === 'true';
			if (planned) {
				return;
			}
			if (gEl.getAttribute('data-fg-random-mode') === 'refetch') {
				return;
			}
			if (needsReflow(gEl)) {
				goToPage(gEl, 1, { mode: 'replace', reflow: true }).catch(
					function () {
						/* server render stands */
					}
				);
				return;
			}
			const s = readState(gEl);
			if (s.preload && s.hasMore) {
				schedulePreload(gEl, s.page + 1);
			}
		}, 5);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
