/**
 * FotoGrids - Random sort, client side.
 *
 * Random_Sorter picks its permutation server-side from a seed, so the order
 * is baked into the rendered HTML. Any cache holding that HTML - the
 * FotoGrids render cache, a page-builder cache, a caching plugin, a CDN -
 * hands the same permutation to every visitor for the life of the entry.
 * This module resolves the randomization after delivery instead, which no
 * cache can freeze. Two modes, read from data-fg-random-mode:
 *
 *   refetch - Requests a fresh selection from the render endpoint with a
 *             newly minted seed and swaps it in. The only mode that can
 *             change WHICH items appear, which is what a paginated
 *             collection or a Single Item layout needs. Items are held
 *             hidden until the response lands so the visitor never sees one
 *             set replaced by another.
 *   reorder - Rearranges the items already on the page. No request, but the
 *             selection is whatever the server sent.
 *
 * Runs at priority 0 so it lands before any layout module attaches
 * (bootLayout defaults to 10) - masonry and justified compute positions from
 * DOM order and must see the final list.
 *
 * Server order is the no-JS fallback and needs no further handling.
 *
 * No imports - standalone vanilla JS compiled by webpack.
 */

import { injectMissingStyles } from '../../_helpers/stylesheets.js';

(function () {
	'use strict';

	const MODE_ATTR = 'data-fg-random-mode';
	const MODE_REFETCH = 'refetch';
	const MODE_REORDER = 'reorder';

	/**
	 * How long the items stay hidden waiting for the fetch. Past this the
	 * server order is revealed and a late response is discarded - showing
	 * the visitor a swap is worse than showing them one frozen order.
	 */
	const HOLD_TIMEOUT_MS = 600;

	/** Class the stylesheet hangs the hold on. */
	const PENDING_CLASS = 'fg-random-pending';

	/** Upper bound of the server's random_seed validation. */
	const SEED_MAX = 2147483647;

	/**
	 * Fisher-Yates over a copy of the supplied array.
	 *
	 * @param {Element[]} nodes
	 * @return {Element[]}
	 */
	function shuffled(nodes) {
		const out = nodes.slice();
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = out[i];
			out[i] = out[j];
			out[j] = tmp;
		}
		return out;
	}

	/**
	 * Resolves the element whose children are the collection's items.
	 * Layouts mark it with data-fg-items-root; the parent of the first
	 * `.fg-item` covers the layouts that don't.
	 *
	 * @param {Element} collectionEl
	 * @return {Element|null}
	 */
	function resolveItemsRoot(collectionEl) {
		const explicit = collectionEl.querySelector(
			'[data-fg-items-root="true"]'
		);
		if (explicit) {
			return explicit;
		}
		const firstItem = collectionEl.querySelector('.fg-item');
		return firstItem ? firstItem.parentElement : null;
	}

	/**
	 * @param {Element} root
	 * @return {Element[]}
	 */
	function itemsIn(root) {
		return Array.prototype.slice.call(
			root.querySelectorAll(':scope > .fg-item')
		);
	}

	/**
	 * Redistributes `nodes` across the DOM positions they currently occupy
	 * inside `root`, in shuffled order. Positions held by anything else -
	 * a layout's progress indicator, items from an earlier page - are left
	 * untouched.
	 *
	 * @param {Element}   root
	 * @param {Element[]} nodes
	 */
	function reshuffleInPlace(root, nodes) {
		const present = nodes.filter(function (node) {
			return node && node.parentElement === root;
		});
		if (present.length < 2) {
			return;
		}

		const slots = present.map(function (node) {
			const marker = document.createComment('');
			root.insertBefore(marker, node);
			return marker;
		});

		const order = shuffled(present);
		for (let i = 0; i < slots.length; i++) {
			root.insertBefore(order[i], slots[i]);
			root.removeChild(slots[i]);
		}
	}

	/**
	 * @return {number} A seed inside the range the render endpoint accepts.
	 */
	function mintSeed() {
		return Math.floor(Math.random() * SEED_MAX) + 1;
	}

	/**
	 * Replaces the collection's items with the ones in an items_only
	 * response.
	 *
	 * @param {Element} root
	 * @param {{html: string, css: Record<string,string>}} payload
	 * @return {Element[]|null} The inserted items, or null when the response
	 *         holds no items and the current ones stay.
	 */
	function applyItems(root, payload) {
		if (
			!payload ||
			typeof payload.html !== 'string' ||
			'' === payload.html
		) {
			return null;
		}

		injectMissingStyles(payload.css || {});

		// items_only returns the layout's own items root. Unwrap it, or the
		// swap would nest a second track inside the existing one.
		const template = document.createElement('template');
		template.innerHTML = payload.html;

		const topLevel = Array.prototype.slice.call(template.content.children);
		const incoming =
			1 === topLevel.length &&
			topLevel[0].dataset &&
			'true' === topLevel[0].dataset.fgItemsRoot
				? Array.prototype.slice.call(topLevel[0].children)
				: topLevel;

		// A gate can claim the render; its lock screen is not a set of items.
		if (
			0 === incoming.length ||
			!template.content.querySelector('.fg-item')
		) {
			return null;
		}

		root.innerHTML = '';
		const inserted = [];
		incoming.forEach(function (node) {
			root.appendChild(node);
			inserted.push(node);
		});

		return inserted;
	}

	/**
	 * Announces swapped-in items so per-item modules re-bind.
	 *
	 * @param {Element}   collectionEl
	 * @param {Element[]} items
	 */
	function announceItems(collectionEl, items) {
		collectionEl.dispatchEvent(
			new CustomEvent('fotogrids:items_inserted', {
				bubbles: true,
				detail: { items, galleryEl: collectionEl },
			})
		);
	}

	/**
	 * Hands the swapped-in page 1 to pagination, so it pages later requests
	 * at the same breakpoint.
	 *
	 * @param {Element} collectionEl
	 * @param {object}  payload
	 * @param {string}  breakpoint
	 */
	function adoptIntoPagination(collectionEl, payload, breakpoint) {
		const pagination =
			window.FotoGrids &&
			window.FotoGrids.modules &&
			window.FotoGrids.modules.pagination;
		if (
			'true' !== collectionEl.dataset.fgPaginated ||
			!pagination ||
			typeof pagination.adopt !== 'function'
		) {
			return;
		}
		pagination.adopt(collectionEl, payload, breakpoint);
	}

	/**
	 * Tells pagination the server's page 1 stays, so it can preload page 2.
	 *
	 * @param {Element} collectionEl
	 */
	function keepServerOrder(collectionEl) {
		const pagination =
			window.FotoGrids &&
			window.FotoGrids.modules &&
			window.FotoGrids.modules.pagination;
		if (
			'true' !== collectionEl.dataset.fgPaginated ||
			!pagination ||
			typeof pagination.preloadNext !== 'function'
		) {
			return;
		}
		pagination.preloadNext(collectionEl);
	}

	/**
	 * Requests a fresh random selection and swaps it in, holding the items
	 * hidden until it lands.
	 *
	 * The minted seed is written onto the wrapper once its items are on
	 * screen, so pagination and the Lightbox draw later requests from the
	 * order the visitor sees. A late, failed, superseded or itemless response
	 * leaves the server's seed with the server's order, and pagination is told
	 * when the hold ends.
	 *
	 * @param {Element} collectionEl
	 * @param {Element} root
	 * @param {boolean} [inlineHold] Hold with an inline style, for a gallery
	 *        rendered without the hold stylesheet.
	 */
	function fetchFreshSet(collectionEl, root, inlineHold) {
		const url = collectionEl.dataset.fgRenderUrl || '';
		const galleryId = parseInt(collectionEl.dataset.fgGalleryId || '0', 10);

		if (!url || !galleryId || typeof window.fetch !== 'function') {
			return;
		}

		const seed = mintSeed();

		const breakpoint =
			window.FotoGrids && window.FotoGrids.activeBreakpoint
				? window.FotoGrids.activeBreakpoint()
				: 'desktop';

		root.classList.add(PENDING_CLASS);
		if (inlineHold) {
			root.style.visibility = 'hidden';
		}

		let settled = false;
		let swapped = false;
		const release = function () {
			if (settled) {
				return;
			}
			settled = true;
			root.classList.remove(PENDING_CLASS);
			if (inlineHold) {
				root.style.visibility = '';
			}
			if (!swapped) {
				keepServerOrder(collectionEl);
			}
		};

		// The fresh set is dropped once the visitor filters or pages the server
		// order: those requests use the seed of the order on screen.
		let superseded = false;
		const markSuperseded = function (event) {
			const mode = event.detail && event.detail.mode;
			if (
				'fotogrids:filters_changed' === event.type ||
				'append' === mode ||
				'replace' === mode
			) {
				superseded = true;
			}
		};
		const unlisten = function () {
			collectionEl.removeEventListener(
				'fotogrids:filters_changed',
				markSuperseded
			);
			collectionEl.removeEventListener(
				'fotogrids:page_changed',
				markSuperseded
			);
		};
		collectionEl.addEventListener(
			'fotogrids:filters_changed',
			markSuperseded
		);
		collectionEl.addEventListener('fotogrids:page_changed', markSuperseded);

		const timer = window.setTimeout(release, HOLD_TIMEOUT_MS);

		const instanceIdPattern = new RegExp(
			'^fg-' + galleryId + '-[0-9a-z]{1,34}$'
		);

		const headers = {
			'Content-Type': 'application/json',
			'X-WP-Nonce': collectionEl.dataset.fgRenderNonce || '',
		};
		if (collectionEl.dataset.fgUnlockToken) {
			headers['X-FotoGrids-Unlock'] = collectionEl.dataset.fgUnlockToken;
		}

		const filters =
			window.FotoGrids &&
			window.FotoGrids.modules &&
			window.FotoGrids.modules.filters &&
			typeof window.FotoGrids.modules.filters.getActive === 'function'
				? window.FotoGrids.modules.filters.getActive(collectionEl)
				: {};
		const containerWidth = parseInt(
			collectionEl.dataset.fgContainerWidth || '0',
			10
		);
		const planned = 'true' === collectionEl.dataset.fgSlicePlanned;
		const requestBody = {
			gallery_id: galleryId,
			page: 1,
			breakpoint,
			partial: 'items_only',
			random_seed: seed,
			filters,
			container_width: containerWidth > 0 ? containerWidth : 0,
			instance_id: instanceIdPattern.test(collectionEl.id)
				? collectionEl.id
				: '',
		};
		if (planned) {
			requestBody.with_aspects = true;
		}

		window
			.fetch(url, {
				method: 'POST',
				headers,
				credentials: 'same-origin',
				body: JSON.stringify(requestBody),
			})
			.then(function (response) {
				if (!response.ok) {
					throw new Error('random-sort/http-' + response.status);
				}
				return response.json();
			})
			.then(function (payload) {
				// A response that arrives after the hold expired, or after the
				// visitor moved on, is dropped: they keep the server order.
				const busy = collectionEl.classList.contains(
					'fotogrids-gallery--is-paginating'
				);
				if (settled || superseded || busy) {
					return;
				}
				const inserted = applyItems(root, payload);
				if (inserted) {
					swapped = true;
					collectionEl.dataset.fgRandomSeed = String(seed);
					announceItems(collectionEl, inserted);
					adoptIntoPagination(collectionEl, payload, breakpoint);
					if (Array.isArray(payload.aspects)) {
						collectionEl.dispatchEvent(
							new CustomEvent('fotogrids:sequence_changed', {
								bubbles: true,
								detail: {
									galleryEl: collectionEl,
									aspects: payload.aspects,
								},
							})
						);
					}
				}
			})
			.catch(function () {
				/* Server order stands. */
			})
			.then(function () {
				window.clearTimeout(timer);
				unlisten();
				release();
			});
	}

	/**
	 * Shuffles each newly paginated batch among itself. Re-shuffling the
	 * whole list would move items the visitor is already reading.
	 *
	 * @param {Element} collectionEl
	 */
	function bindInsertedBatches(collectionEl) {
		collectionEl.addEventListener(
			'fotogrids:items_inserted',
			function (event) {
				const inserted = event.detail && event.detail.items;
				if (!inserted || 0 === inserted.length) {
					return;
				}
				const root = resolveItemsRoot(collectionEl);
				if (!root) {
					return;
				}
				reshuffleInPlace(root, Array.prototype.slice.call(inserted));
			}
		);
	}

	function attach(collectionEl) {
		const mode = collectionEl.getAttribute(MODE_ATTR);
		if (
			(MODE_REFETCH !== mode && MODE_REORDER !== mode) ||
			'1' === collectionEl.dataset.fgRandomSortReady
		) {
			return;
		}
		collectionEl.dataset.fgRandomSortReady = '1';

		const root = resolveItemsRoot(collectionEl);
		if (!root) {
			return;
		}

		// A gallery whose pages the browser cuts on row ends cannot be shuffled
		// in place without breaking those rows, so it fetches a fresh order.
		if (
			MODE_REFETCH === mode ||
			'true' === collectionEl.dataset.fgSlicePlanned
		) {
			// The server already applied a fresh permutation for the minted
			// seed, so no client shuffle runs on top - that would desync the
			// sequence indices the Lightbox navigates by.
			fetchFreshSet(collectionEl, root, MODE_REFETCH !== mode);
			return;
		}

		reshuffleInPlace(root, itemsIn(root));
		bindInsertedBatches(collectionEl);
	}

	function init() {
		if (
			window.FotoGrids &&
			typeof window.FotoGrids.onCollection === 'function'
		) {
			window.FotoGrids.onCollection(attach, 0);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
