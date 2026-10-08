/**
 * FotoGrids - Stats
 *
 * Fires view and share pings to the REST API.
 *
 * Per-collection activation: the Stats feature module writes
 * data-fg-stats="{...}" onto every gallery and album wrapper for which
 * enable_statistics resolves to true. Collections without that attribute
 * are silently skipped, so a page can mix tracked and untracked
 * collections.
 *
 *   View:  subscribes to FotoGrids.onCollection and fires one ping per
 *          gallery or album on the first init.
 *   Item:  listens for `fotogrids:lightbox:open` and
 *          `fotogrids:lightbox:navigate` and fires one item view ping
 *          for every slide the lightbox shows.
 *   Share: listens for the document-level `fotogrids:share` event
 *          (dispatched by the Sharing module when a user shares an
 *          item, gallery or album) and fires the share ping. Sharing
 *          itself never calls fetch - the Stats module is the only
 *          place that talks to the REST API.
 *
 * No imports - standalone vanilla JS compiled by webpack.
 */

(function () {
	'use strict';

	/**
	 * Read and parse the per-gallery stats config from the wrapper's
	 * data-fg-stats JSON. Returns null if missing or invalid.
	 *
	 * @param {Element} galleryEl
	 * @returns {{enabled: boolean, restUrl: string}|null}
	 */
	function readConfig(galleryEl) {
		const raw = galleryEl.dataset.fgStats;
		if (!raw) {
			return null;
		}
		try {
			const cfg = JSON.parse(raw);
			if (!cfg.enabled) {
				return null;
			}
			return cfg;
		} catch (e) {
			return null;
		}
	}

	/**
	 * Fire-and-forget POST. Network errors are swallowed - stats failure
	 * must never affect gallery functionality.
	 *
	 * Sent without cookies or a nonce: the stats routes are public, and a
	 * nonce baked into cached markup belongs to whoever rendered it first.
	 *
	 * @param {string} url
	 * @param {Object} body
	 */
	function ping(url, body) {
		try {
			fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'omit',
				body: JSON.stringify(body),
			}).catch(() => {});
		} catch (e) {
			// ignore
		}
	}

	/**
	 * Fire a view ping. Called once per collection wrapper via the
	 * runtime's onCollection callback.
	 *
	 * The config carries the explicit objectType ('gallery' or 'album')
	 * and objectId - written by the Stats feature module's PHP based on
	 * the render's collection_kind. Album wrappers ping with the album's
	 * post ID, not the gallery_id (which is 0 on album renders).
	 *
	 * @param {Element} galleryEl
	 */
	function trackView(galleryEl) {
		if (galleryEl.dataset.fgStatsViewSent === '1') {
			return;
		}
		const cfg = readConfig(galleryEl);
		if (!cfg) {
			return;
		}

		const objectType = cfg.objectType || 'gallery';
		const objectId = parseInt(cfg.objectId || '0', 10);
		if (!objectId) {
			return;
		}

		galleryEl.dataset.fgStatsViewSent = '1';

		ping(cfg.restUrl + 'stats/view', {
			object_type: objectType,
			object_id: objectId,
		});
	}

	/**
	 * Handle a fotogrids:lightbox:open or :navigate event by sending an
	 * item view ping. The lightbox's gallery element supplies the stats
	 * config, so a gallery with statistics disabled records nothing.
	 *
	 * @param {CustomEvent} e
	 */
	function trackItemView(e) {
		const detail = e && e.detail;
		if (!detail || !detail.galleryEl || !detail.item) {
			return;
		}

		const cfg = readConfig(detail.galleryEl);
		if (!cfg) {
			return;
		}

		const itemId = parseInt(detail.item.id, 10);
		if (!itemId) {
			return;
		}

		ping(cfg.restUrl + 'stats/view', {
			object_type: 'item',
			object_id: itemId,
		});
	}

	/**
	 * Handle a fotogrids:share event by sending a share ping. The event
	 * fires from the Sharing module when the user clicks a share button.
	 *
	 * An item share is sent only when the gallery it belongs to has
	 * statistics enabled. A gallery or album share is sent only when that
	 * collection has statistics enabled.
	 *
	 * @param {CustomEvent} e
	 */
	function trackShare(e) {
		const detail = e && e.detail;
		if (!detail || !detail.network) {
			return;
		}

		const objectType = detail.objectType || 'item';
		const objectId = parseInt(
			objectType === 'item' ? detail.itemId : detail.objectId,
			10
		);
		if (!objectId) {
			return;
		}

		const cfg =
			objectType === 'item'
				? detail.galleryEl && readConfig(detail.galleryEl)
				: configFor(objectType, objectId);
		if (!cfg) {
			return;
		}

		ping(cfg.restUrl + 'stats/share', {
			object_type: objectType,
			object_id: objectId,
			network: detail.network,
		});
	}

	/**
	 * Stats config of the collection wrapper for one gallery or album.
	 *
	 * @param {string} objectType 'gallery' or 'album'.
	 * @param {number} objectId
	 * @returns {Object|null}
	 */
	function configFor(objectType, objectId) {
		const els = document.querySelectorAll(
			'.fotogrids-collection[data-fg-stats]'
		);
		for (let i = 0; i < els.length; i++) {
			const cfg = readConfig(els[i]);
			if (
				cfg &&
				cfg.objectType === objectType &&
				parseInt(cfg.objectId, 10) === objectId
			) {
				return cfg;
			}
		}
		return null;
	}

	function init() {
		if (
			window.FotoGrids &&
			typeof window.FotoGrids.onCollection === 'function'
		) {
			window.FotoGrids.onCollection(trackView, 50);
		}
		document.addEventListener('fotogrids:lightbox:open', trackItemView);
		document.addEventListener('fotogrids:lightbox:navigate', trackItemView);
		document.addEventListener('fotogrids:share', trackShare);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
