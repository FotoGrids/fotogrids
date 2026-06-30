/**
 * FotoGrids deep-linking.
 *
 * Makes each gallery item addressable by URL and keeps the URL in sync with the
 * open lightbox. Two URL forms:
 *   - View page:  ?fg-item={itemId}     (server reads this to emit per-item OG)
 *   - Embedded:   #fg-{galleryId}-{itemId}
 *
 * When the target gallery has no lightbox (item_click_behavior is direct /
 * external / nothing), the deep link scrolls to and highlights the item in the
 * grid instead of opening a lightbox.
 *
 * Self-contained: it listens to the existing fotogrids:lightbox events and
 * drives the existing lightbox instance; it does not modify the lightbox.
 */
(function () {
	const settings = window.fotogrids || {};
	const hasHistory =
		typeof window.history !== 'undefined' &&
		typeof window.history.replaceState === 'function';

	// The View Page sets the `fotogrids-view` class on <body> (see
	// ViewCollections\Renderer::body_attrs), not on <html>. Check both
	// to be defensive against future moves.
	const isViewPage = () =>
		(document.body && document.body.classList.contains('fotogrids-view')) ||
		document.documentElement.classList.contains('fotogrids-view');

	/**
	 * Parse the deep link from the current URL.
	 *
	 * @returns {{galleryId: (string|null), itemId: string}|null}
	 */
	function parseDeepLink() {
		if (isViewPage()) {
			const params = new URLSearchParams(window.location.search);
			const itemId = params.get('fg-item');
			return itemId ? { galleryId: null, itemId } : null;
		}

		const match = (window.location.hash || '').match(/^#fg-(\d+)-(\d+)$/);
		if (match) {
			return { galleryId: match[1], itemId: match[2] };
		}
		return null;
	}

	/**
	 * Build the deep-link URL for an item.
	 *
	 * @param {HTMLElement} galleryEl
	 * @param {string} itemId
	 * @returns {string}
	 */
	function buildDeepLink(galleryEl, itemId) {
		if (isViewPage()) {
			const url = new URL(window.location.href);
			url.searchParams.set('fg-item', String(itemId));
			url.hash = '';
			return url.toString();
		}

		// Pipeline writes data-fg-gallery-id on the wrapper.
		const galleryId = galleryEl ? galleryEl.dataset.fgGalleryId : '';
		const base = window.location.href.split('#')[0];
		return galleryId ? `${base}#fg-${galleryId}-${itemId}` : base;
	}

	/**
	 * Remove the deep-link identifier from the URL (on lightbox close).
	 */
	function clearDeepLink() {
		if (!hasHistory) return;

		if (isViewPage()) {
			const url = new URL(window.location.href);
			if (!url.searchParams.has('fg-item')) return;
			url.searchParams.delete('fg-item');
			window.history.replaceState({}, '', url.toString());
		} else if (window.location.hash.startsWith('#fg-')) {
			const base = window.location.href.split('#')[0];
			window.history.replaceState({}, '', base);
		}
	}

	/**
	 * Locate a gallery + item by id.
	 *
	 * @param {{galleryId: (string|null), itemId: string}} link
	 * @returns {{galleryEl: HTMLElement, itemEl: HTMLElement, trigger: (HTMLElement|null)}|null}
	 */
	function resolveTarget(link) {
		let galleries;
		if (link.galleryId) {
			galleries = document.querySelectorAll(
				`.fotogrids-collection.fotogrids-gallery[data-fg-gallery-id="${link.galleryId}"]`
			);
		} else {
			galleries = document.querySelectorAll(
				'.fotogrids-collection.fotogrids-gallery'
			);
		}

		for (const galleryEl of galleries) {
			const itemEl = galleryEl.querySelector(
				`[data-fg-item-id="${link.itemId}"]`
			);
			if (itemEl) {
				const figure = itemEl.closest('.fg-item') || itemEl;
				const trigger =
					figure.querySelector('[data-fg-lightbox-trigger]') ||
					(itemEl.matches('[data-fg-lightbox-trigger]')
						? itemEl
						: null);
				return { galleryEl, itemEl: figure, trigger };
			}
		}
		return null;
	}

	/**
	 * Scroll to and briefly highlight an item that has no lightbox.
	 *
	 * @param {HTMLElement} itemEl
	 */
	function highlightItem(itemEl) {
		const reveal = () => {
			try {
				itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} catch (e) {
				itemEl.scrollIntoView();
			}
			itemEl.classList.add('fg-deep-link-highlight');
			setTimeout(
				() => itemEl.classList.remove('fg-deep-link-highlight'),
				2200
			);
		};

		const img = itemEl.querySelector('img[loading="lazy"], img[data-src]');
		if (
			img &&
			!img.complete &&
			typeof IntersectionObserver !== 'undefined'
		) {
			img.addEventListener('load', reveal, { once: true });
			setTimeout(reveal, 800);
		} else {
			reveal();
		}
	}

	/**
	 * Open the deep-linked item: lightbox if available, otherwise highlight.
	 *
	 * @param {number} [attempt] Retry counter while the lightbox instance boots.
	 */
	function openDeepLink(attempt) {
		const link = parseDeepLink();
		if (!link) return;

		const target = resolveTarget(link);
		if (!target) return;

		if (target.trigger && window.FotoGridsLightbox) {
			const lb = window.FotoGridsLightbox.instance;
			if (!lb) {
				// The lightbox manager initialises on DOMContentLoaded too; if
				// it has not exposed its instance yet, retry briefly.
				const n = attempt || 0;
				if (n < 20) {
					setTimeout(() => openDeepLink(n + 1), 50);
					return;
				}
			}
			const triggers = Array.from(
				target.galleryEl.querySelectorAll('[data-fg-lightbox-trigger]')
			);
			const index = triggers.indexOf(target.trigger);
			const instance = lb || new window.FotoGridsLightbox();
			instance.open(target.galleryEl, index >= 0 ? index : 0);
			return;
		}

		highlightItem(target.itemEl);
	}

	/**
	 * Keep the URL pointed at the current lightbox item.
	 *
	 * @param {Event} event  fotogrids:lightbox:open or :navigate
	 */
	function syncUrlToLightbox(event) {
		if (!hasHistory) return;
		const detail = event.detail || {};
		const item = detail.item;
		const galleryEl =
			detail.galleryEl ||
			(item && item.triggerEl
				? item.triggerEl.closest(
						'.fotogrids-collection.fotogrids-gallery'
					)
				: null);
		const itemId = item && item.id ? item.id : null;
		if (!itemId) return;

		window.history.replaceState({}, '', buildDeepLink(galleryEl, itemId));
	}

	/**
	 * Inject the highlight style once, so the scroll-to fallback works in any
	 * context regardless of which gallery stylesheet is present.
	 */
	function injectHighlightStyle() {
		if (document.getElementById('fg-deep-link-style')) return;
		const style = document.createElement('style');
		style.id = 'fg-deep-link-style';
		style.textContent =
			'.fg-deep-link-highlight{outline:3px solid var(--fg-view-accent,#3c46f0);' +
			'outline-offset:3px;border-radius:4px;transition:outline-color .3s ease;' +
			'animation:fg-deep-link-pulse 2.2s ease;}' +
			'@keyframes fg-deep-link-pulse{0%,100%{outline-color:transparent;}15%,60%{outline-color:var(--fg-view-accent,#3c46f0);}}';
		document.head.appendChild(style);
	}

	function init() {
		injectHighlightStyle();

		document.addEventListener('fotogrids:lightbox:open', syncUrlToLightbox);
		document.addEventListener(
			'fotogrids:lightbox:navigate',
			syncUrlToLightbox
		);
		document.addEventListener('fotogrids:lightbox:close', clearDeepLink);

		if (settings.deep_linking_enabled !== false) {
			openDeepLink();
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
