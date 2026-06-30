/**
 * FotoGrids UI State Manager
 *
 * Centralised persistence for tab and subtab state across admin surfaces.
 * Supports two storage adapters:
 *   - session  (default): sessionStorage, scoped per browser tab, auto-clears on close.
 *   - url:               URL search params, enables deep links and back/forward.
 *
 * Read priority when both adapters are active: URL wins over session.
 * Write priority: URL is only written when a key declares a urlParam; session is
 * always written so refresh works even if the URL param is later stripped.
 *
 * Usage:
 *   const uiState = FotoGridsUiState.createNamespace({ area: 'gallery-items', postId: 42 });
 *
 *   const tab = uiState.getValue({ key: 'main-tab', fallback: 'manage' });
 *   uiState.setValue({ key: 'main-tab', value: 'preview', urlParam: 'tab' });
 *
 *   const subtabs = uiState.getValue({ key: 'subtabs', fallback: {} });
 *   uiState.setValue({ key: 'subtabs', value: { styling: 'thumbnails' } });
 *
 *   uiState.clearValue({ key: 'defaults-subtab', urlParam: 'subtab' });
 */

(function () {
	'use strict';

	/**
	 * Safely read a raw string from sessionStorage.
	 * Returns null on any error (private browsing, storage full, etc.).
	 *
	 * @param {string} storageKey
	 * @returns {string|null}
	 */
	function sessionRead(storageKey) {
		try {
			return window.sessionStorage.getItem(storageKey);
		} catch (_e) {
			return null;
		}
	}

	/**
	 * Safely write a string to sessionStorage. Silently no-ops on error.
	 *
	 * @param {string} storageKey
	 * @param {string} rawValue
	 */
	function sessionWrite(storageKey, rawValue) {
		try {
			window.sessionStorage.setItem(storageKey, rawValue);
		} catch (_e) {}
	}

	/**
	 * Safely remove a key from sessionStorage. Silently no-ops on error.
	 *
	 * @param {string} storageKey
	 */
	function sessionRemove(storageKey) {
		try {
			window.sessionStorage.removeItem(storageKey);
		} catch (_e) {}
	}

	/**
	 * Read a URL search param value.
	 *
	 * @param {string} param
	 * @returns {string|null}
	 */
	function urlRead(param) {
		try {
			return new URLSearchParams(window.location.search).get(param);
		} catch (_e) {
			return null;
		}
	}

	/**
	 * Write a URL search param via pushState. No-ops on error.
	 *
	 * @param {string} param
	 * @param {string} value
	 */
	function urlWrite(param, value) {
		try {
			const url = new URL(window.location.href);
			url.searchParams.set(param, value);
			window.history.pushState({}, '', url.toString());
		} catch (_e) {}
	}

	/**
	 * Remove a URL search param via replaceState. No-ops on error.
	 *
	 * Uses replaceState (not pushState) so clearing a param does not add a
	 * spurious history entry - clearing is a cleanup, not a navigation.
	 *
	 * @param {string} param
	 */
	function urlDelete(param) {
		try {
			const url = new URL(window.location.href);
			url.searchParams.delete(param);
			window.history.replaceState({}, '', url.toString());
		} catch (_e) {}
	}

	/**
	 * Build the sessionStorage key for a given namespace + control key.
	 *
	 * Schema: fg:ui:{area}:{entityType}:{entityId}:{control}
	 *
	 * @param {Object} ns  Namespace config ({ area, entityType, entityId })
	 * @param {string} key Control key (e.g. 'main-tab', 'subtabs')
	 * @returns {string}
	 */
	function buildStorageKey(ns, key) {
		return ['fg:ui', ns.area, ns.entityType, String(ns.entityId), key].join(
			':'
		);
	}

	/**
	 * Create a scoped UI state namespace.
	 *
	 * @param {Object} config
	 * @param {string} config.area         Feature area slug (e.g. 'gallery-items', 'collection-settings').
	 * @param {number|string} [config.postId]  Post ID for post-scoped areas. Omit or pass 0 for global areas.
	 * @returns {Object} Namespace API
	 */
	function createNamespace(config) {
		const area = config.area || 'unknown';
		const postId = config.postId || 0;
		const entityType = postId ? 'post' : 'global';
		const entityId = postId ? postId : 'global';

		const ns = { area, entityType, entityId };

		/**
		 * Read a persisted UI state value.
		 *
		 * Read priority (first non-null wins):
		 *   1. URL search param (if urlParam is provided).
		 *   2. sessionStorage.
		 *   3. fallback.
		 *
		 * Validation: if `allowed` is provided and the resolved value is not
		 * in that list, the fallback is returned instead.
		 *
		 * @param {Object}        opts
		 * @param {string}        opts.key      Storage control key.
		 * @param {*}             opts.fallback Default value when nothing is persisted.
		 * @param {string}        [opts.urlParam]  URL search param name to read from.
		 * @param {Array}         [opts.allowed]   List of valid values; invalid stored value falls back.
		 * @returns {*}
		 */
		function getValue(opts) {
			const { key, fallback, urlParam, allowed } = opts;
			const storageKey = buildStorageKey(ns, key);

			let resolved = null;

			if (urlParam) {
				const urlVal = urlRead(urlParam);
				if (urlVal !== null) {
					resolved = urlVal;
				}
			}

			if (resolved === null) {
				const raw = sessionRead(storageKey);
				if (raw !== null) {
					try {
						resolved = JSON.parse(raw);
					} catch (_e) {
						resolved = raw;
					}
				}
			}

			if (resolved === null) {
				return fallback;
			}

			if (Array.isArray(allowed) && allowed.length > 0) {
				if (!allowed.includes(resolved)) {
					return fallback;
				}
			}

			return resolved;
		}

		/**
		 * Persist a UI state value.
		 *
		 * Always writes to sessionStorage.
		 * Also writes to the URL if urlParam is provided.
		 *
		 * @param {Object}  opts
		 * @param {string}  opts.key       Storage control key.
		 * @param {*}       opts.value     Value to store.
		 * @param {string}  [opts.urlParam]  URL search param name to write.
		 */
		function setValue(opts) {
			const { key, value, urlParam } = opts;
			const storageKey = buildStorageKey(ns, key);

			const raw =
				typeof value === 'string' ? value : JSON.stringify(value);
			sessionWrite(storageKey, raw);

			if (urlParam && typeof value === 'string') {
				urlWrite(urlParam, value);
			}
		}

		/**
		 * Remove a persisted UI state value entirely.
		 *
		 * Always removes from sessionStorage.
		 * Also removes the param from the URL if urlParam is provided.
		 *
		 * Use this (rather than setValue with a default) when a value should
		 * be absent - e.g. a subtab that only applies to one tab and must not
		 * linger in the URL or session when that tab is not active.
		 *
		 * @param {Object}  opts
		 * @param {string}  opts.key        Storage control key.
		 * @param {string}  [opts.urlParam]  URL search param name to remove.
		 */
		function clearValue(opts) {
			const { key, urlParam } = opts;
			const storageKey = buildStorageKey(ns, key);

			sessionRemove(storageKey);

			if (urlParam) {
				urlDelete(urlParam);
			}
		}

		return { getValue, setValue, clearValue };
	}

	window.FotoGridsUiState = {
		createNamespace,
	};
})();
