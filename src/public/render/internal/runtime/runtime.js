/**
 * FotoGrids Frontend Runtime
 *
 * The minimum amount of JavaScript that must be present on any page
 * rendering a FotoGrids gallery or album. It does NOT implement any
 * feature - no filters, no lightbox, no sharing, no masonry, no stats,
 * no password gate. Its sole job is to discover collection elements
 * (galleries and albums) and announce them so the per-feature modules
 * can attach to each one.
 *
 * See README.md in this directory for the full contract.
 *
 * No imports - standalone vanilla JS compiled by webpack.
 */

(function () {
	'use strict';

	const VERSION = '1.2.0';

	/**
	 * Three independent callback queues, one per public subscription API.
	 * Each queue is kept sorted by (priority asc, seq asc) so registration
	 * order is preserved within a priority bucket.
	 *
	 * @type {Object<string, Array<{ cb: (element: Element) => void, priority: number, seq: number }>>}
	 */
	const queues = {
		gallery: [],
		album: [],
		collection: [],
	};

	/**
	 * Monotonic counter used as a tiebreaker when two callbacks share
	 * a priority - preserves registration order within a priority bucket.
	 *
	 * @type {number}
	 */
	let callbackSeq = 0;

	/**
	 * Initialized collection elements (WeakSet so detached elements GC).
	 *
	 * @type {WeakSet<Element>}
	 */
	const initialized = new WeakSet();

	/**
	 * List of initialized collection records, exposed via getInstances().
	 * Each record carries the collection kind so late-subscribed callbacks
	 * can be replayed only against matching elements.
	 *
	 * @type {Array<{ element: Element, galleryId: string|null, kind: string }>}
	 */
	const instances = [];

	/**
	 * The MutationObserver, installed exactly once.
	 *
	 * @type {MutationObserver|null}
	 */
	let collectionObserver = null;

	/**
	 * Used until a wrapper supplies the site's configuration.
	 *
	 * @type {{ mobile: number, tablet: number, detect: string }}
	 */
	const DEFAULT_BREAKPOINTS = {
		mobile: 767,
		tablet: 1024,
		detect: 'viewport',
	};

	/**
	 * @type {{ mobile: number, tablet: number, detect: string }|null}
	 */
	let breakpointConfig = null;

	/**
	 * The site's breakpoint configuration. Every wrapper carries the same
	 * values, so the first one found answers for the page.
	 *
	 * @return {{ mobile: number, tablet: number, detect: string }}
	 */
	function readBreakpoints() {
		if (breakpointConfig) {
			return breakpointConfig;
		}

		const el = document.querySelector(
			'.fotogrids-collection[data-fg-breakpoints]'
		);
		if (!el) {
			return DEFAULT_BREAKPOINTS;
		}

		const widths = el
			.getAttribute('data-fg-breakpoints')
			.trim()
			.split(/\s+/);
		const mobile = parseInt(widths[0], 10);
		const tablet = parseInt(widths[1], 10);

		breakpointConfig = {
			mobile: mobile > 0 ? mobile : DEFAULT_BREAKPOINTS.mobile,
			tablet: tablet > 0 ? tablet : DEFAULT_BREAKPOINTS.tablet,
			detect:
				el.getAttribute('data-fg-breakpoint-detect') === 'device'
					? 'device'
					: 'viewport',
		};

		return breakpointConfig;
	}

	/**
	 * @param {string} query
	 * @return {boolean|null} Null where matchMedia is missing.
	 */
	function mediaMatches(query) {
		if (typeof window.matchMedia !== 'function') {
			return null;
		}
		return window.matchMedia(query).matches;
	}

	/**
	 * @param {number} width
	 * @param {{ mobile: number, tablet: number }} config
	 * @return {string} 'desktop', 'tablet' or 'mobile'.
	 */
	function breakpointForWidth(width, config) {
		if (width <= config.mobile) {
			return 'mobile';
		}
		if (width <= config.tablet) {
			return 'tablet';
		}
		return 'desktop';
	}

	/**
	 * Classifies the window, using the same max-width conditions as the
	 * server-emitted `@media` blocks.
	 *
	 * @param {{ mobile: number, tablet: number }} config
	 * @return {string}
	 */
	function viewportBreakpoint(config) {
		const isMobile = mediaMatches('(max-width: ' + config.mobile + 'px)');
		if (null === isMobile) {
			return breakpointForWidth(
				window.innerWidth || document.documentElement.clientWidth || 0,
				config
			);
		}
		if (isMobile) {
			return 'mobile';
		}
		return mediaMatches('(max-width: ' + config.tablet + 'px)')
			? 'tablet'
			: 'desktop';
	}

	/**
	 * Classifies the device rather than the window, by the short side of its
	 * screen, so a phone stays mobile in landscape and a narrowed desktop
	 * window stays desktop.
	 *
	 * @param {{ mobile: number, tablet: number }} config
	 * @return {string}
	 */
	function deviceBreakpoint(config) {
		if (!mediaMatches('(pointer: coarse)')) {
			return 'desktop';
		}

		const screen = window.screen;
		const shortSide = screen
			? Math.min(screen.width || 0, screen.height || 0)
			: 0;
		if (shortSide > 0) {
			return breakpointForWidth(shortSide, config);
		}

		// Tablets report mobile: true as often as phones do, so this only
		// decides when the screen size is unreadable.
		const uaData = window.navigator && window.navigator.userAgentData;
		if (uaData && true === uaData.mobile) {
			return 'mobile';
		}

		return viewportBreakpoint(config);
	}

	/**
	 * @return {string} 'desktop', 'tablet' or 'mobile'.
	 */
	function activeBreakpoint() {
		const config = readBreakpoints();
		return config.detect === 'device'
			? deviceBreakpoint(config)
			: viewportBreakpoint(config);
	}

	/**
	 * Writes the device class to html[data-fg-breakpoint], which the rules
	 * Breakpoint_Config::scope() emits in device mode select on.
	 */
	function applyBreakpointAttribute() {
		const config = readBreakpoints();
		if (config.detect !== 'device' || config === DEFAULT_BREAKPOINTS) {
			return;
		}
		document.documentElement.setAttribute(
			'data-fg-breakpoint',
			deviceBreakpoint(config)
		);
	}

	/**
	 * The client-side counterpart of Breakpoint_Config::scope().
	 *
	 * @param {string} breakpoint   'tablet' or 'mobile'.
	 * @param {string} selector
	 * @param {string} declarations Declarations without braces.
	 * @return {string}
	 */
	function scopeCss(breakpoint, selector, declarations) {
		const config = readBreakpoints();
		const width = breakpoint === 'mobile' ? config.mobile : config.tablet;
		const media = '@media (max-width: ' + width + 'px) { ';

		if (config.detect !== 'device') {
			return media + selector + ' { ' + declarations + ' } }';
		}

		const classes =
			breakpoint === 'mobile' ? ['mobile'] : ['tablet', 'mobile'];
		const selectors = classes.map(function (name) {
			return 'html[data-fg-breakpoint="' + name + '"] ' + selector;
		});

		return (
			selectors.join(', ') +
			' { ' +
			declarations +
			' }\n' +
			media +
			'html:not([data-fg-breakpoint]) ' +
			selector +
			' { ' +
			declarations +
			' } }'
		);
	}

	/**
	 * Returns the kind of collection wrapper this element represents.
	 * Album wrappers carry the `fotogrids-album` discriminator class;
	 * gallery wrappers carry `fotogrids-gallery`. Both also carry the
	 * umbrella class `fotogrids-collection`.
	 *
	 * @param {Element} el
	 * @return {string} 'album' or 'gallery'
	 */
	function collectionKind(el) {
		return el && el.classList && el.classList.contains('fotogrids-album')
			? 'album'
			: 'gallery';
	}

	/**
	 * Inserts a callback into the named queue, kept sorted by (priority, seq).
	 *
	 * @param {string}                     queueName One of 'gallery', 'album', 'collection'.
	 * @param {(element: Element) => void} cb
	 * @param {number}                     priority
	 */
	function insertCallback(queueName, cb, priority) {
		const q = queues[queueName];
		q.push({ cb, priority, seq: callbackSeq++ });
		q.sort(function (a, b) {
			if (a.priority !== b.priority) {
				return a.priority - b.priority;
			}
			return a.seq - b.seq;
		});
	}

	/**
	 * Runs every callback in a queue against a single collection element.
	 * Catches and logs any callback error so one broken module can't stop
	 * the others.
	 *
	 * @param {string}  queueName
	 * @param {Element} collectionElement
	 */
	function runQueue(queueName, collectionElement) {
		const q = queues[queueName];
		for (let i = 0; i < q.length; i++) {
			try {
				q[i].cb(collectionElement);
			} catch (err) {
				if (window.console && console.warn) {
					console.warn(
						'FotoGrids: ' + queueName + ' callback threw',
						err
					);
				}
			}
		}
	}

	/**
	 * Initializes a single collection element: marks it initialized, records
	 * it, runs the matching callback queues against it, then dispatches
	 * fotogrids:gallery_initialized.
	 *
	 * Safe to call multiple times on the same element - second and later
	 * calls are no-ops.
	 *
	 * @param {Element} collectionElement
	 */
	function initializeCollection(collectionElement) {
		if (!collectionElement || initialized.has(collectionElement)) {
			return;
		}
		initialized.add(collectionElement);

		applyBreakpointAttribute();

		const kind = collectionKind(collectionElement);

		// The pipeline writes data-fg-gallery-id on every wrapper
		// (Render_Controller::build_wrapper); data-gallery-id is never emitted.
		const record = {
			element: collectionElement,
			galleryId: collectionElement.dataset.fgGalleryId || null,
			kind,
		};
		instances.push(record);

		// Mark the element so existing CSS / external code can detect it.
		collectionElement.dataset.fotogridsInitialized = '1';

		// Kind-specific queue first, then the always-fires collection queue.
		runQueue(kind, collectionElement);
		runQueue('collection', collectionElement);

		document.dispatchEvent(
			new CustomEvent('fotogrids:gallery_initialized', {
				bubbles: true,
				detail: {
					galleryElement: collectionElement,
					galleryId: record.galleryId,
					kind,
					instance: record,
				},
			})
		);
	}

	/**
	 * Finds every collection element in the document and initializes each
	 * one. Idempotent - initializeCollection() guards against double init.
	 */
	function initializeAllCollections() {
		const elements = document.querySelectorAll('.fotogrids-collection');
		for (let i = 0; i < elements.length; i++) {
			initializeCollection(elements[i]);
		}
	}

	/**
	 * Installs the runtime's single MutationObserver. Feature modules MUST
	 * NOT install their own - they subscribe via FotoGrids.onGallery(),
	 * onAlbum() or onCollection() and the same callback fires for static
	 * and dynamic collections.
	 */
	function installObserver() {
		if (collectionObserver !== null || !('MutationObserver' in window)) {
			return;
		}

		collectionObserver = new MutationObserver(function (mutations) {
			for (let i = 0; i < mutations.length; i++) {
				const added = mutations[i].addedNodes;
				if (!added || added.length === 0) {
					continue;
				}

				for (let j = 0; j < added.length; j++) {
					const node = added[j];
					if (!(node instanceof Element)) {
						continue;
					}

					if (node.matches && node.matches('.fotogrids-collection')) {
						announceInserted(node);
					}

					if (node.querySelectorAll) {
						const nested = node.querySelectorAll(
							'.fotogrids-collection'
						);
						for (let k = 0; k < nested.length; k++) {
							announceInserted(nested[k]);
						}
					}
				}
			}
		});

		collectionObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	/**
	 * Fires fotogrids:gallery_inserted and then
	 * initializes the collection. Skips already-initialized elements.
	 *
	 * @param {Element} collectionElement
	 */
	function announceInserted(collectionElement) {
		if (initialized.has(collectionElement)) {
			return;
		}

		document.dispatchEvent(
			new CustomEvent('fotogrids:gallery_inserted', {
				bubbles: true,
				detail: {
					galleryElement: collectionElement,
					galleryId: collectionElement.dataset.fgGalleryId || null,
					kind: collectionKind(collectionElement),
				},
			})
		);

		initializeCollection(collectionElement);
	}

	/**
	 * Builds a subscription function (onGallery/onAlbum/onCollection).
	 * Each returned function inserts into its own queue, validates input,
	 * and replays against already-initialized matching instances so late
	 * subscribers never miss a collection.
	 *
	 * @param {string} queueName 'gallery' | 'album' | 'collection'
	 * @return {(cb: (element: Element) => void, priority?: number) => void}
	 */
	function makeSubscriber(queueName) {
		return function (cb, priority) {
			if (typeof cb !== 'function') {
				return;
			}
			const pri =
				typeof priority === 'number' && isFinite(priority)
					? priority
					: 10;
			insertCallback(queueName, cb, pri);

			// Late subscriber - replay against already-initialized instances
			// whose kind matches this queue.
			if (instances.length === 0) {
				return;
			}
			for (let i = 0; i < instances.length; i++) {
				const rec = instances[i];
				if (queueName !== 'collection' && rec.kind !== queueName) {
					continue;
				}
				try {
					cb(rec.element);
				} catch (err) {
					if (window.console && console.warn) {
						console.warn(
							'FotoGrids: ' +
								queueName +
								' replay callback threw',
							err
						);
					}
				}
			}
		};
	}

	const publicApi = {
		version: VERSION,

		/**
		 * Subscribe to per-gallery initialization. Fires ONLY for gallery
		 * wrappers (`.fotogrids-collection.fotogrids-gallery`).
		 *
		 * Fires once per gallery - for every gallery present at
		 * DOMContentLoaded AND for every gallery the MutationObserver
		 * picks up later. If subscribed AFTER galleries are already
		 * initialized, the callback is invoked against every existing
		 * gallery immediately, so late-loaded modules don't miss them.
		 *
		 * Lower priority runs first. Same priority preserves registration
		 * order.
		 *
		 * @param {(element: Element) => void} cb         Receives (galleryElement).
		 * @param {number}                     [priority] Default 10.
		 */
		onGallery: makeSubscriber('gallery'),

		/**
		 * Subscribe to per-album initialization. Fires ONLY for album
		 * wrappers (`.fotogrids-collection.fotogrids-album`).
		 *
		 * Same replay-on-late-subscribe semantics as onGallery.
		 *
		 * @param {(element: Element) => void} cb         Receives (albumElement).
		 * @param {number}                     [priority] Default 10.
		 */
		onAlbum: makeSubscriber('album'),

		/**
		 * Subscribe to per-collection initialization. Fires for BOTH
		 * galleries and albums - any element matching
		 * `.fotogrids-collection`. Use this only when a module genuinely
		 * needs to run against both kinds; most modules want onGallery or
		 * onAlbum instead.
		 *
		 * @param {(element: Element) => void} cb         Receives (collectionElement).
		 * @param {number}                     [priority] Default 10.
		 */
		onCollection: makeSubscriber('collection'),

		/**
		 * Returns the current list of initialized collection records.
		 *
		 * @return {Array<{ element: Element, galleryId: string|null, kind: string }>}
		 */
		getInstances() {
			return instances.slice();
		},

		/**
		 * The visitor's breakpoint under the site's detection mode.
		 *
		 * @return {string} 'desktop', 'tablet' or 'mobile'.
		 */
		activeBreakpoint,

		/**
		 * @return {{ mobile: number, tablet: number, detect: string }} A copy.
		 */
		getBreakpoints() {
			const config = readBreakpoints();
			return {
				mobile: config.mobile,
				tablet: config.tablet,
				detect: config.detect,
			};
		},

		/**
		 * Scopes declarations to a breakpoint and every narrower one.
		 *
		 * @param {string} breakpoint   'tablet' or 'mobile'.
		 * @param {string} selector
		 * @param {string} declarations Declarations without braces.
		 * @return {string}
		 */
		scopeCss,

		/**
		 * Namespace where feature modules register their cross-module APIs.
		 * Populated by modules; the runtime itself never reads or writes
		 * properties on this object.
		 *
		 * @type {Object<string, unknown>}
		 */
		modules: {},
	};

	function boot() {
		installObserver();
		initializeAllCollections();
		document.dispatchEvent(
			new CustomEvent('fotogrids:ready', { bubbles: true })
		);
	}

	// Expose the API BEFORE booting so module scripts that load earlier in
	// the page (defer) can already call onGallery()/onAlbum()/onCollection()
	// during their own init.
	window.FotoGrids = publicApi;

	// The runtime loads after the wrappers, so this need not wait for DOMReady.
	applyBreakpointAttribute();

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
