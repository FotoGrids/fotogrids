class FotoGrids {
    constructor() {
        this.galleries = [];
        this.lightbox = null;
        this.settings = window.fotogrids || {};
        this.galleryObserver = null;

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeGalleries());
        } else {
            this.initializeGalleries();
        }
    }

    initializeGalleries() {
        this.initializeAlbumGalleryPlaceholders();
        this.initializeLockScreens();

        const galleryElements = document.querySelectorAll('.fotogrids-gallery');

        galleryElements.forEach(element => {
            this.initializeGalleryElement(element);
        });

        if (this.settings.lazy_load) {
            this.initializeLazyLoading();
        } else {
            const lazyContainers = document.querySelectorAll('.fotogrids-lazy');
            if (lazyContainers.length > 0) {
                this.initializeLazyLoading();
            }
        }

        this.initializeDynamicGallerySupport();
    }

    /**
     * Injects <link rel="stylesheet"> tags for any CSS handles that the render
     * pipeline collected during the unlock request but that are not already
     * present in the document.
     *
     * The server returns a { handle: url } map. We use the handle as the <link>
     * element's id attribute so duplicate injections are skipped cheaply.
     *
     * @param {Record<string, string>} cssUrls  handle → absolute URL map
     */
    injectMissingStyles(cssUrls) {
        if (!cssUrls || typeof cssUrls !== 'object') return;

        Object.entries(cssUrls).forEach(([handle, url]) => {
            if (!handle || !url) return;
            const linkId = 'fotogrids-css-' + handle;
            if (document.getElementById(linkId)) return; // already present

            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.id   = linkId;
            link.href = url;
            document.head.appendChild(link);
        });
    }

    /**
     * Wires up submit handlers for all .fg-lock-form elements on the page.
     *
     * Each form carries the gallery ID, the unlock REST URL, and the WP REST
     * nonce as data attributes so no global state is needed.
     */
    initializeLockScreens() {
        const forms = document.querySelectorAll('.fotogrids-gate .fg-lock-form');
        forms.forEach((form) => this.bindLockForm(form));
    }

    bindLockForm(form) {
        if (!form || form.dataset.fotogridsLockBound === '1') {
            return;
        }
        form.dataset.fotogridsLockBound = '1';

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.unlockGallery(form);
        });
    }

    /**
     * Submits the password, swaps in the rendered gallery HTML on success,
     * or shows an inline error on failure — no page reload needed.
     *
     * @param {HTMLFormElement} form
     */
    async unlockGallery(form) {
        const card       = form.closest('.fg-gate-card');
        const errorEl    = form.querySelector('.fg-lock-error');
        const submitBtn  = form.querySelector('.fg-lock-submit');
        const input      = form.querySelector('.fg-lock-input');
        const wrapper    = form.closest('.fotogrids-gate');

        const galleryId  = parseInt(form.dataset.galleryId || '0', 10);
        const unlockUrl  = form.dataset.unlockUrl || '';
        const nonce      = form.dataset.nonce || this.settings.nonce || '';
        const password   = input ? input.value : '';

        if (!galleryId || !unlockUrl) {
            return;
        }

        // Loading state.
        if (card) card.classList.add('is-loading');
        if (submitBtn) submitBtn.disabled = true;
        if (errorEl) errorEl.classList.remove('is-visible');

        try {
            const response = await fetch(unlockUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                credentials: 'same-origin',
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                // Wrong password or server error — show inline error.
                if (errorEl) {
                    errorEl.classList.add('is-visible');
                }
                if (input) {
                    input.value = '';
                    input.focus();
                }
                return;
            }

            // Success — inject any CSS the render pipeline collected that wasn't
            // on the page yet (collection-base.css, grid.css, etc.) before
            // swapping in the gallery HTML, so styles are ready immediately.
            const cssUrls = data.css || {};
            this.injectMissingStyles(cssUrls);

            const html = data.html || '';
            if (!html || !wrapper) {
                // Fallback: reload the page (standalone page case).
                window.location.reload();
                return;
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Replace the entire .fotogrids-gate wrapper with whatever the
            // server rendered (could be one gallery div, or multiple siblings).
            const newNodes = Array.from(tempDiv.childNodes);
            if (newNodes.length === 0) {
                window.location.reload();
                return;
            }

            const parent = wrapper.parentNode;
            if (!parent) {
                window.location.reload();
                return;
            }

            newNodes.forEach((node) => parent.insertBefore(node, wrapper));
            parent.removeChild(wrapper);

            // Wire up lightbox / lazy-loading for the newly inserted gallery.
            newNodes.forEach((node) => {
                if (node instanceof Element && node.classList.contains('fotogrids-gallery')) {
                    this.initializeGalleryElement(node);
                }
            });

        } catch (_err) {
            if (errorEl) {
                errorEl.classList.add('is-visible');
            }
        } finally {
            if (card) card.classList.remove('is-loading');
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    initializeAlbumGalleryPlaceholders() {
        const placeholders = document.querySelectorAll('.fotogrids-gallery-placeholder[data-gallery-id]:not([data-fotogrids-loading="1"]):not([data-fotogrids-loaded="1"])');
        if (placeholders.length === 0) {
            return;
        }

        placeholders.forEach((placeholder) => {
            this.loadAlbumGalleryPlaceholder(placeholder);
        });
    }

    async loadAlbumGalleryPlaceholder(placeholder) {
        if (!placeholder || placeholder.dataset.fotogridsLoading === '1' || placeholder.dataset.fotogridsLoaded === '1') {
            return;
        }

        const galleryId = parseInt(placeholder.dataset.galleryId || '0', 10);
        if (!galleryId || !this.settings?.restUrl) {
            return;
        }

        placeholder.dataset.fotogridsLoading = '1';

        try {
            const response = await fetch(`${this.settings.restUrl}gallery/${galleryId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load gallery ${galleryId}`);
            }

            const payload = await response.json();
            const galleryElement = this.buildAlbumGalleryElement(payload, placeholder);
            if (!galleryElement) {
                return;
            }

            placeholder.replaceWith(galleryElement);
            this.initializeGalleryElement(galleryElement);
            placeholder.dataset.fotogridsLoaded = '1';
        } catch (error) {
            placeholder.dataset.fotogridsError = '1';
            console.warn('FotoGrids: Failed to load album gallery placeholder.', error);
        } finally {
            delete placeholder.dataset.fotogridsLoading;
        }
    }

    buildAlbumGalleryElement(payload, placeholder) {
        if (!payload || typeof payload !== 'object') {
            return null;
        }

        const layout = payload?.meta?.layout || 'grid';
        const columns = parseInt(payload?.meta?.columns || '3', 10) || 3;
        const items = Array.isArray(payload.items) ? payload.items : [];
        const galleryId = parseInt(payload.id || placeholder.dataset.galleryId || '0', 10);

        if (!galleryId || items.length === 0) {
            return null;
        }

        const wrapper = document.createElement('div');
        wrapper.className = `fotogrids-gallery fotogrids-layout-${layout} fotogrids-album-ajax-gallery`;
        wrapper.id = `fotogrids-gallery-${galleryId}-album`;
        wrapper.dataset.galleryId = `${galleryId}`;
        wrapper.dataset.columns = `${columns}`;
        wrapper.dataset.albumId = placeholder.dataset.albumId || '';
        wrapper.dataset.source = placeholder.dataset.source || 'album_ajax';

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'fotogrids-gallery-items';

        items.forEach((item) => {
            const figure = document.createElement('figure');
            figure.className = 'fg-item';
            // data-fg-media-state="loading" mirrors the server-rendered initial
            // state: loader visible, image hidden, pointer-events blocked on <a>.
            // loading-icon.js sets it to "loaded" per-image on img load/error.
            figure.setAttribute('data-fg-media-state', 'loading');

            const mediaWrap = document.createElement('div');
            mediaWrap.className = 'fg-item-media';

            const link = document.createElement('a');
            link.setAttribute('data-fg-lightbox-trigger', '');
            link.href = item.full || item.url || '#';
            if (item.id) {
                link.setAttribute('data-fg-item-id', item.id);
            }
            if (item.caption) {
                link.setAttribute('data-fg-caption', item.caption);
            }
            if (item.title) {
                link.setAttribute('data-fg-title', item.title);
            }

            const image = document.createElement('img');
            image.src = item.medium || item.thumbnail || item.url || '';
            image.alt = item.alt || '';
            image.loading = 'lazy';
            if (item.full) {
                image.dataset.full = item.full;
            }
            if (item.id) {
                image.dataset.id = `${item.id}`;
            }

            link.appendChild(image);
            mediaWrap.appendChild(link);

            // Loader element — the SVG from window.fotogridsLoadingIcon is used
            // when available (injected by the Loading_Icon PHP feature). loading-icon.js
            // will set data-fg-media-state="loaded" on the figure when the image settles.
            const loader = document.createElement('div');
            loader.className = 'fg-item-loader';
            loader.setAttribute('aria-hidden', 'true');
            if ( window.fotogridsLoadingIcon?.svg ) {
                // Give each dynamically-built item a unique suffix for SMIL IDs.
                const uid = 'fgija' + ( window._fgAjaxLoaderCounter = ( window._fgAjaxLoaderCounter || 0 ) + 1 );
                loader.innerHTML = window.fotogridsLoadingIcon.svg.replace( /__FG_ID__/g, uid );
            }
            mediaWrap.appendChild(loader);

            figure.appendChild(mediaWrap);

            if (item.caption) {
                const caption = document.createElement('figcaption');
                caption.className = 'fg-caption';
                caption.textContent = item.caption;
                figure.appendChild(caption);
            }

            itemsContainer.appendChild(figure);
        });

        wrapper.appendChild(itemsContainer);
        return wrapper;
    }

    initializeGalleryElement(element) {
        if (!element || element.dataset.fotogridsInitialized === '1') {
            return;
        }

        const gallery = new FotoGridsGallery(element, this.settings);
        this.galleries.push(gallery);
        element.dataset.fotogridsInitialized = '1';
    }

    initializeDynamicGallerySupport() {
        if (this.galleryObserver !== null) {
            return;
        }

        document.addEventListener('fotogrids:gallery_inserted', (event) => {
            const detail = event.detail || {};
            const galleryElement = detail.galleryElement || detail.element || null;
            this.initializeGalleryElement(galleryElement);
        });

        if (!('MutationObserver' in window)) {
            return;
        }

        this.galleryObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (!mutation.addedNodes || mutation.addedNodes.length === 0) {
                    return;
                }

                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) {
                        return;
                    }

                    // Wire up any lock screens inserted into the DOM dynamically.
                    const lockForms = [];
                    if (node.matches('.fg-lock-form')) lockForms.push(node);
                    node.querySelectorAll('.fg-lock-form').forEach((f) => lockForms.push(f));
                    lockForms.forEach((f) => this.bindLockForm(f));

                    const galleries = [];
                    if (node.matches('.fotogrids-gallery')) {
                        galleries.push(node);
                    }
                    node.querySelectorAll('.fotogrids-gallery').forEach((galleryNode) => galleries.push(galleryNode));

                    galleries.forEach((galleryElement) => {
                        if (galleryElement.dataset.fotogridsInitialized === '1') {
                            return;
                        }

                        if (galleryElement.closest('.fotogrids-album')) {
                            this.initializeGalleryElement(galleryElement);
                            return;
                        }

                        document.dispatchEvent(
                            new CustomEvent('fotogrids:gallery_inserted', {
                                detail: {
                                    galleryElement,
                                    galleryId: galleryElement.dataset.galleryId || null
                                }
                            })
                        );
                    });
                });
            });
        });

        this.galleryObserver.observe(document.body, { childList: true, subtree: true });
    }

    initializeLazyLoading() {
        const lazyImages = document.querySelectorAll('.fotogrids-lazy img[loading="lazy"]');

        if ('IntersectionObserver' in window) {
            const itemObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;

                        img.addEventListener('load', () => {
                            img.classList.add('fotogrids-lazy-loaded');
                        });

                        if (img.complete) {
                            img.classList.add('fotogrids-lazy-loaded');
                        }

                        observer.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => itemObserver.observe(img));
        } else {
            lazyImages.forEach(img => {
                img.classList.add('fotogrids-lazy-loaded');
            });
        }

        const dataSrcImages = document.querySelectorAll('.fotogrids-lazy img[data-src]');
        if (dataSrcImages.length > 0) {
            const dataSrcObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        img.classList.add('fotogrids-lazy-loaded');
                        observer.unobserve(img);
                    }
                });
            });

            dataSrcImages.forEach(img => dataSrcObserver.observe(img));
        }
    }
}

class FotoGridsGallery {
    constructor(element, settings) {
        this.element = element;
        this.settings = settings;
        this.galleryId = element.dataset.galleryId;
        this.items = [];

        this.init();
    }

    init() {
        this.items = Array.from(this.element.querySelectorAll('.fg-item img'));

        this.trackView();

        this.initializeFilters();

        if (this.element.classList.contains('fotogrids-layout-masonry')) {
            this.initializeMasonry();
        }
    }

    trackView() {
        if (!this.settings.stats_tracking || !this.galleryId) {
            return;
        }

        fetch(`${this.settings.restUrl}stats/view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': this.settings.nonce,
            },
            body: JSON.stringify({
                object_type: 'gallery',
                object_id: parseInt(this.galleryId),
            }),
        }).catch(error => {
            console.warn('Error tracking gallery view:', error);
        });
    }

    initializeFilters() {
        const filterContainer = this.element.querySelector('.fotogrids-filters');
        if (!filterContainer) {
            return;
        }

        const filterButtons = filterContainer.querySelectorAll('[data-filter]');

        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.filterItems(button.dataset.filter);

                filterButtons.forEach(btn => btn.classList.remove('fg-is-active'));
                button.classList.add('fg-is-active');
            });
        });
    }

    filterItems(filter) {
        const items = this.element.querySelectorAll('.fg-item');

        items.forEach(item => {
            if (filter === 'all' || item.dataset.tags?.includes(filter)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    initializeMasonry() {
        const items = this.element.querySelectorAll('.fg-item');
        const columns = parseInt(this.element.dataset.columns) || 3;

        const images = this.element.querySelectorAll('img');
        let loadedItems = 0;

        const checkAllLoaded = () => {
            loadedItems++;
            if (loadedItems === images.length) {
                this.layoutMasonry(items, columns);
            }
        };

        images.forEach(img => {
            if (img.complete) {
                checkAllLoaded();
            } else {
                img.addEventListener('load', checkAllLoaded);
                img.addEventListener('error', checkAllLoaded);
            }
        });
    }

    layoutMasonry(items, columns) {
        const rowHeight = 8; // Base row height in pixels
        const gap = 16; // Gap between items

        // Add CSS class for JS-calculated masonry
        this.element.classList.add('fotogrids-layout-masonry--js');

        // Set grid columns and row height via CSS custom properties
        this.element.style.setProperty('--masonry-columns', columns);
        this.element.style.setProperty('--masonry-row-height', `${rowHeight}px`);
        this.element.style.setProperty('--masonry-gap', `${gap}px`);

        items.forEach((item) => {
            // Calculate how many rows this item should span based on its height
            const rows = Math.ceil((item.offsetHeight + gap) / rowHeight);
            item.style.setProperty('--rows', rows);
        });
    }
}

class FotoGridsSharing {
    static trackShare(itemId, network) {
        const settings = window.fotogrids || {};
        if (!settings.stats_tracking) {
            return;
        }

        fetch(`${settings.restUrl}stats/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': settings.nonce,
            },
            body: JSON.stringify({
                object_type: 'item',
                object_id: parseInt(itemId),
                network: network,
            }),
        }).catch(error => {
            console.warn('Error tracking share:', error);
        });
    }

    static shareItem(img, network) {
        const itemUrl = img.dataset.full || img.src;
        const caption = img.alt || '';
        const pageUrl = window.location.href;

        let shareUrl = '';

        switch (network) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(caption)}`;
                break;
            case 'pinterest':
                shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(itemUrl)}&description=${encodeURIComponent(caption)}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${encodeURIComponent(caption)}&body=${encodeURIComponent(pageUrl)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(itemUrl).then(() => {
                });
                this.trackShare(img.dataset.id, network);
                return;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
            this.trackShare(img.dataset.id, network);
        }
    }
}

window.FotoGrids = FotoGrids;
new FotoGrids();

import './pagination.js';
