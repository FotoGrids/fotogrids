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
            // Also activate if any gallery on the page has data-fg-lazy set
            // (can happen when per-gallery setting differs from the site default).
            const lazyContainers = document.querySelectorAll('[data-fg-lazy]');
            if (lazyContainers.length > 0) {
                this.initializeLazyLoading();
            }
        }

        this.initializeDynamicGallerySupport();
        this.initializeFooterShare();
    }

    /**
     * Populate view-page footer share containers from their resolved config.
     */
    initializeFooterShare() {
        if (!window.FotoGridsSharing) return;

        document.querySelectorAll('[data-fg-share-footer]').forEach((container) => {
            if (container.querySelector('.fotogrids-share-bar')) return;

            let config;
            try {
                config = JSON.parse(container.dataset.fgShareFooter);
            } catch (e) {
                return;
            }
            if (!config || !config.enabled) return;

            const bar = window.FotoGridsSharing.renderShareBar(config, {
                id: '',
                fullUrl: '',
                caption: document.title || '',
                galleryEl: null,
                galleryId: '',
            });
            if (bar) {
                bar.classList.add('fotogrids-share-bar--footer');
                container.appendChild(bar);
            }
        });
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
     * or shows an inline error on failure - no page reload needed.
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
                // Wrong password or server error - show inline error.
                if (errorEl) {
                    errorEl.classList.add('is-visible');
                }
                if (input) {
                    input.value = '';
                    input.focus();
                }
                return;
            }

            // Success - inject any CSS the render pipeline collected that wasn't
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
        // Mirror the data-fg-lazy attribute that the render pipeline emits for
        // server-rendered galleries so the IntersectionObserver layer applies here too.
        if (this.settings.lazy_load !== false) {
            wrapper.dataset.fgLazy = '1';
        }

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

            // Loader element - the SVG from window.fotogridsLoadingIcon is used
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
        window.fotogridsInstances = window.fotogridsInstances || [];
        window.fotogridsInstances.push(gallery);
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
        const lazyImages = document.querySelectorAll('[data-fg-lazy] img[loading="lazy"]');

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

        const dataSrcImages = document.querySelectorAll('[data-fg-lazy] img[data-src]');
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
        this.initializeShareBars();

        if (this.element.classList.contains('fotogrids-layout-masonry')) {
            this.initializeMasonry();
        }
    }

    /**
     * Render share bars on grid thumbnails when sharing is enabled for this
     * gallery and the 'thumbnail' placement applies. Reads the resolved config
     * the sharing decorator wrote onto the gallery wrapper.
     */
    initializeShareBars() {
        const raw = this.element.dataset.fgSharing;
        if (!raw || !window.FotoGridsSharing) return;

        let config;
        try {
            config = JSON.parse(raw);
        } catch (e) {
            return;
        }

        if (!config.enabled || !Array.isArray(config.placements) || !config.placements.includes('thumbnail')) {
            return;
        }

        this.element.querySelectorAll('.fg-item').forEach((figure) => {
            if (figure.querySelector('.fotogrids-share-bar')) return;
            const img = figure.querySelector('img');
            if (!img) return;

            const bar = window.FotoGridsSharing.renderShareBar(config, {
                id: img.dataset.id || (figure.querySelector('[data-fg-item-id]') ? figure.querySelector('[data-fg-item-id]').dataset.fgItemId : ''),
                fullUrl: img.dataset.full || img.src,
                caption: img.alt || '',
                galleryEl: this.element,
                galleryId: this.galleryId,
            });

            if (bar) {
                bar.classList.add('fotogrids-share-bar--thumbnail');
                figure.appendChild(bar);
            }
        });
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

        // Per-source active filter sets: Map<sourceId, Set<string>>
        // An empty Set means "show all for this source".
        this._filterState = new Map();

        const style = this.element.dataset.fgFilterStyle || 'buttons';

        if (style === 'dropdowns') {
            this._initFilterDropdowns(filterContainer);
        } else if (style === 'checkboxes') {
            this._initFilterCheckboxes(filterContainer);
        } else {
            this._initFilterButtons(filterContainer);
        }

        // Global "All" reset button (present in all styles).
        const allBtn = filterContainer.querySelector('[data-fg-filter-all]');
        if (allBtn) {
            allBtn.addEventListener('click', () => {
                this._filterState.clear();
                this._applyFilters();
                this._syncFilterUI(filterContainer);
            });
        }

        // Toggle button (only rendered when filter_display_mode === 'toggle').
        // Lives as a sibling of .fotogrids-filters, inside the gallery wrapper.
        const toggleBtn = this.element.querySelector('[data-fg-filter-toggle]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const collapsed = filterContainer.getAttribute('data-fg-filter-collapsed') === 'true';
                if (collapsed) {
                    filterContainer.removeAttribute('data-fg-filter-collapsed');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                } else {
                    filterContainer.setAttribute('data-fg-filter-collapsed', 'true');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }

    /**
     * Button-style filter: each button toggles one value on/off within its
     * source group. OR logic within a source.
     * @param {Element} filterContainer
     */
    _initFilterButtons(filterContainer) {
        const groups = filterContainer.querySelectorAll('.fg-filter-group');

        groups.forEach(group => {
            const sourceId = group.dataset.fgFilterSource;
            const buttons  = group.querySelectorAll('[data-fg-filter]');

            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.fgFilter;
                    let state = this._filterState.get(sourceId);
                    if (!state) {
                        state = new Set();
                        this._filterState.set(sourceId, state);
                    }

                    if (state.has(value)) {
                        state.delete(value);
                        if (state.size === 0) {
                            this._filterState.delete(sourceId);
                        }
                    } else {
                        state.add(value);
                    }

                    this._applyFilters();
                    this._syncFilterUI(filterContainer);
                });
            });

            // Arrow-key keyboard navigation within each button group.
            const btns = Array.from(group.querySelectorAll('.fg-filter-btn'));
            group.addEventListener('keydown', (e) => {
                const focused = document.activeElement;
                const idx = btns.indexOf(focused);
                if (idx === -1) return;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    btns[(idx + 1) % btns.length].focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    btns[(idx - 1 + btns.length) % btns.length].focus();
                }
            });
        });
    }

    /**
     * Dropdown-style filter: custom dropdown per source group.
     * Clicking an option selects that value; clicking the active option or "All"
     * clears that source. Only one value can be active per dropdown (single-select).
     * @param {Element} filterContainer
     */
    _initFilterDropdowns(filterContainer) {
        const groups = filterContainer.querySelectorAll('.fg-filter-group');

        groups.forEach(group => {
            const sourceId = group.dataset.fgFilterSource;
            const dropdown = group.querySelector('.fg-filter-dropdown');
            if (!dropdown) return;

            const trigger = dropdown.querySelector('.fg-filter-dropdown-trigger');
            const list    = dropdown.querySelector('.fg-filter-dropdown-list');
            if (!trigger || !list) return;

            const valueLabel = trigger.querySelector('.fg-filter-dropdown-value');

            // Open / close toggle
            const openDropdown = () => {
                list.classList.add('fg-is-open');
                trigger.setAttribute('aria-expanded', 'true');
                // Close other open dropdowns in this filter bar
                filterContainer.querySelectorAll('.fg-filter-dropdown-list.fg-is-open').forEach(other => {
                    if (other !== list) {
                        other.classList.remove('fg-is-open');
                        other.closest('.fg-filter-dropdown')
                            ?.querySelector('.fg-filter-dropdown-trigger')
                            ?.setAttribute('aria-expanded', 'false');
                    }
                });
            };

            const closeDropdown = () => {
                list.classList.remove('fg-is-open');
                trigger.setAttribute('aria-expanded', 'false');
            };

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                list.classList.contains('fg-is-open') ? closeDropdown() : openDropdown();
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target)) closeDropdown();
            });

            // Option selection
            list.querySelectorAll('.fg-filter-dropdown-option').forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.dataset.fgFilter ?? '';

                    if (value === '') {
                        this._filterState.delete(sourceId);
                    } else {
                        // Clicking the already-active value deselects it
                        const current = this._filterState.get(sourceId);
                        if (current && current.has(value)) {
                            this._filterState.delete(sourceId);
                        } else {
                            this._filterState.set(sourceId, new Set([value]));
                        }
                    }

                    closeDropdown();
                    this._applyFilters();
                    this._syncFilterUI(filterContainer);
                });

                // Keyboard: Enter/Space to select, Escape to close
                option.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        option.click();
                    } else if (e.key === 'Escape') {
                        closeDropdown();
                        trigger.focus();
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = option.nextElementSibling;
                        if (next) next.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = option.previousElementSibling;
                        if (prev) prev.focus();
                        else { closeDropdown(); trigger.focus(); }
                    }
                });
            });

            // Keyboard on trigger: arrow down opens
            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDropdown();
                    list.querySelector('.fg-filter-dropdown-option')?.focus();
                }
            });
        });
    }

    /**
     * Checkbox-style filter: each checkbox independently toggles a value.
     * Multiple checkboxes checked = OR within source.
     * @param {Element} filterContainer
     */
    _initFilterCheckboxes(filterContainer) {
        const groups = filterContainer.querySelectorAll('.fg-filter-group');

        groups.forEach(group => {
            const sourceId   = group.dataset.fgFilterSource;
            const checkboxes = group.querySelectorAll('[data-fg-filter]');

            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    let state = this._filterState.get(sourceId);
                    if (!state) {
                        state = new Set();
                        this._filterState.set(sourceId, state);
                    }

                    if (cb.checked) {
                        state.add(cb.value);
                    } else {
                        state.delete(cb.value);
                        if (state.size === 0) {
                            this._filterState.delete(sourceId);
                        }
                    }

                    this._applyFilters();
                    this._syncFilterUI(filterContainer);
                });
            });
        });
    }

    /**
     * Applies the current filter state to all gallery items.
     *
     * Visibility logic:
     *   - If no source has an active filter set → show all items.
     *   - Otherwise, an item is visible if it satisfies every active source
     *     (AND across sources). Within one source, the item needs to carry at
     *     least one of the active values (OR within source).
     *
     * Show/hide uses class-based toggling (fg-is-filtered-out) rather than
     * style.display, enabling CSS transitions in the filter-ui stylesheet.
     */
    _applyFilters() {
        const items = this.element.querySelectorAll('.fg-item');

        if (this._filterState.size === 0) {
            // No active filters - show everything.
            items.forEach(item => {
                item.classList.remove('fg-is-filtered-out');
                item.removeAttribute('aria-hidden');
            });
            this._recalculateCounts();
            return;
        }

        items.forEach(item => {
            let visible = true;

            for (const [sourceId, activeValues] of this._filterState) {
                // Find the group element for this source to read its attr key.
                const group = this.element.querySelector(
                    `.fg-filter-group[data-fg-filter-source="${sourceId}"]`
                );
                const attrKey = group?.dataset?.fgFilterAttr || 'data-fg-tags';
                // data-fg-tags → fgTags in dataset (camelCase, strip "data-" prefix)
                const datasetKey = attrKey
                    .replace(/^data-/, '')
                    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());

                const rawValue = item.dataset[datasetKey] || '';
                const itemTokens = rawValue !== ''
                    ? new Set(rawValue.split(' ').filter(Boolean))
                    : new Set();

                // OR within source: item needs at least one matching token.
                let sourceMatch = false;
                for (const value of activeValues) {
                    if (itemTokens.has(value)) {
                        sourceMatch = true;
                        break;
                    }
                }

                if (!sourceMatch) {
                    visible = false;
                    break;
                }
            }

            if (visible) {
                item.classList.remove('fg-is-filtered-out');
                item.removeAttribute('aria-hidden');
            } else {
                item.classList.add('fg-is-filtered-out');
                item.setAttribute('aria-hidden', 'true');
            }
        });

        this._recalculateCounts();
    }

    /**
     * Recalculates and updates the visible item count badges on filter controls.
     *
     * For each source group, recounts how many items would be visible if only
     * that source's filter changed (i.e. treating other sources as fixed).
     * This gives accurate "live counts" as the user builds up a multi-source
     * filter.
     */
    _recalculateCounts() {
        const filterContainer = this.element.querySelector('.fotogrids-filters');
        if (!filterContainer) return;

        const allItems = Array.from(this.element.querySelectorAll('.fg-item'));
        const groups   = filterContainer.querySelectorAll('.fg-filter-group');

        groups.forEach(group => {
            const sourceId  = group.dataset.fgFilterSource;
            const attrKey   = group.dataset.fgFilterAttr || 'data-fg-tags';
            const datasetKey = attrKey
                .replace(/^data-/, '')
                .replace(/-([a-z])/g, (_, c) => c.toUpperCase());

            // Compute items that pass all OTHER sources (without this source's filter).
            const otherItems = allItems.filter(item => {
                for (const [sid, activeValues] of this._filterState) {
                    if (sid === sourceId) continue;
                    const otherGroup = this.element.querySelector(
                        `.fg-filter-group[data-fg-filter-source="${sid}"]`
                    );
                    const otherAttr = otherGroup?.dataset?.fgFilterAttr || 'data-fg-tags';
                    const otherKey  = otherAttr
                        .replace(/^data-/, '')
                        .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                    const raw    = item.dataset[otherKey] || '';
                    const tokens = new Set(raw !== '' ? raw.split(' ').filter(Boolean) : []);
                    let match = false;
                    for (const v of activeValues) {
                        if (tokens.has(v)) { match = true; break; }
                    }
                    if (!match) return false;
                }
                return true;
            });

            // Update counts on each filter control within this group.
            const controls = group.querySelectorAll('[data-fg-filter]');
            controls.forEach(ctrl => {
                const filterValue = ctrl.dataset.fgFilter ?? ctrl.value ?? '';
                if (filterValue === '') return; // "All" option - no count badge

                const count = otherItems.filter(item => {
                    const raw    = item.dataset[datasetKey] || '';
                    const tokens = new Set(raw !== '' ? raw.split(' ').filter(Boolean) : []);
                    return tokens.has(filterValue);
                }).length;

                // Badge lookup: inside the control itself, or inside its closest label/button.
                const badge =
                    ctrl.querySelector('.fg-filter-count') ||
                    ctrl.closest('label')?.querySelector('.fg-filter-count') ||
                    ctrl.closest('.fg-filter-btn')?.querySelector('.fg-filter-count') ||
                    ctrl.closest('.fg-filter-dropdown-option')?.querySelector('.fg-filter-count');

                if (badge) {
                    badge.textContent = count;
                }
            });
        });
    }

    /**
     * Syncs the visual active state of all filter controls to match
     * this._filterState. Called after every state change.
     * @param {Element} filterContainer
     */
    _syncFilterUI(filterContainer) {
        const hasActiveFilters = this._filterState.size > 0;

        // "All" button: active when no filters are active.
        const allBtn = filterContainer.querySelector('[data-fg-filter-all]');
        if (allBtn) {
            allBtn.classList.toggle('fg-is-active', !hasActiveFilters);
            allBtn.setAttribute('aria-pressed', String(!hasActiveFilters));
        }

        const style = this.element.dataset.fgFilterStyle || 'buttons';

        const groups = filterContainer.querySelectorAll('.fg-filter-group');
        groups.forEach(group => {
            const sourceId   = group.dataset.fgFilterSource;
            const activeVals = this._filterState.get(sourceId) || new Set();

            if (style === 'dropdowns') {
                // Custom dropdown: update trigger label + option aria-selected states
                const dropdown = group.querySelector('.fg-filter-dropdown');
                if (dropdown) {
                    const trigger    = dropdown.querySelector('.fg-filter-dropdown-trigger');
                    const valueLabel = trigger?.querySelector('.fg-filter-dropdown-value');
                    const options    = dropdown.querySelectorAll('.fg-filter-dropdown-option');
                    const activeVal  = activeVals.size > 0 ? [...activeVals][0] : '';

                    options.forEach(opt => {
                        const val = opt.dataset.fgFilter ?? '';
                        const isActive = val === activeVal || (val === '' && activeVal === '');
                        opt.classList.toggle('fg-is-active', isActive);
                        opt.setAttribute('aria-selected', String(isActive));
                    });

                    // Update trigger label to show selected option or "All" default
                    if (valueLabel) {
                        const activeOpt = activeVal !== ''
                            ? dropdown.querySelector(`.fg-filter-dropdown-option[data-fg-filter="${CSS.escape(activeVal)}"]`)
                            : dropdown.querySelector('.fg-filter-dropdown-option[data-fg-filter=""]');
                        valueLabel.textContent = activeOpt?.firstChild?.textContent?.trim()
                            || activeOpt?.textContent?.trim()
                            || '';
                    }
                }
            } else if (style === 'checkboxes') {
                group.querySelectorAll('[data-fg-filter]').forEach(cb => {
                    cb.checked = activeVals.has(cb.value);
                });
            } else {
                // Buttons
                group.querySelectorAll('[data-fg-filter]').forEach(btn => {
                    const active = activeVals.has(btn.dataset.fgFilter);
                    btn.classList.toggle('fg-is-active', active);
                    btn.setAttribute('aria-pressed', String(active));
                });
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

    /**
     * Resolve the URL to share for an item, by context.
     *
     * Never returns the raw image file (that gives a context-less link with no
     * preview). On a view page the share is the view URL with a deep-link to the
     * item; on an embedded page it is the host page, optionally with a deep-link
     * hash, governed by the embedded_share_target setting.
     *
     * @param {HTMLElement} img
     * @returns {string}
     */
    static resolveShareUrl(img) {
        const settings = window.fotogrids || {};
        const itemId = img.dataset.id || '';
        const base = window.location.href.split('#')[0];
        const isViewPage = document.documentElement.classList.contains('fotogrids-view');
        const deepLinking = settings.deep_linking_enabled !== false;

        if (isViewPage) {
            if (deepLinking && itemId) {
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.set('fg-item', String(itemId));
                    url.hash = '';
                    return url.toString();
                } catch (e) {
                    return base;
                }
            }
            return base;
        }

        const target = settings.embedded_share_target || 'image';
        if (target === 'image' && deepLinking && itemId) {
            const galleryEl = img.closest('.fotogrids-gallery');
            const galleryId = galleryEl ? galleryEl.dataset.galleryId : '';
            if (galleryId) {
                return `${base}#fg-${galleryId}-${itemId}`;
            }
        }
        return base;
    }

    static shareItem(img, network) {
        const itemUrl = img.dataset.full || img.src;
        const caption = img.alt || '';
        const shareTarget = FotoGridsSharing.resolveShareUrl(img);

        let shareUrl = '';

        switch (network) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareTarget)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareTarget)}&text=${encodeURIComponent(caption)}`;
                break;
            case 'pinterest':
                shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareTarget)}&media=${encodeURIComponent(itemUrl)}&description=${encodeURIComponent(caption)}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${encodeURIComponent(caption)}&body=${encodeURIComponent(shareTarget)}`;
                break;
            case 'copy':
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareTarget).catch(() => {});
                }
                this.trackShare(img.dataset.id, network);
                return;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
            this.trackShare(img.dataset.id, network);
        }
    }

    /**
     * Network display labels keyed by the stored network id.
     */
    static get NETWORK_LABELS() {
        const { __ } = (window.wp && window.wp.i18n) ? window.wp.i18n : { __: (s) => s };
        return {
            facebook: __('Facebook', 'fotogrids'),
            x: __('X', 'fotogrids'),
            pinterest: __('Pinterest', 'fotogrids'),
            linkedin: __('LinkedIn', 'fotogrids'),
            whatsapp: __('WhatsApp', 'fotogrids'),
            telegram: __('Telegram', 'fotogrids'),
            reddit: __('Reddit', 'fotogrids'),
            email: __('Email', 'fotogrids'),
            copy_link: __('Copy link', 'fotogrids'),
        };
    }

    /**
     * Inline brand/glyph SVGs keyed by network id. Use currentColor so they
     * inherit the button's text colour.
     */
    static get NETWORK_ICONS() {
        return {
            facebook: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>',
            x: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>',
            pinterest: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.62 11.16-.1-.95-.2-2.4.04-3.44.22-.93 1.4-5.96 1.4-5.96s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 4-.28 1.2.6 2.18 1.78 2.18 2.14 0 3.78-2.26 3.78-5.51 0-2.88-2.07-4.9-5.02-4.9-3.42 0-5.43 2.56-5.43 5.21 0 1.03.4 2.14.9 2.74.1.12.11.22.08.34l-.33 1.37c-.05.22-.18.27-.4.16-1.5-.7-2.43-2.88-2.43-4.64 0-3.78 2.75-7.25 7.92-7.25 4.16 0 7.39 2.96 7.39 6.92 0 4.13-2.6 7.45-6.22 7.45-1.21 0-2.35-.63-2.74-1.38l-.75 2.84c-.27 1.04-1 2.35-1.49 3.15A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/></svg>',
            linkedin: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0Z"/></svg>',
            whatsapp: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M.06 24l1.68-6.13A11.82 11.82 0 0 1 .16 11.9C.16 5.34 5.5 0 12.06 0a11.8 11.8 0 0 1 8.4 3.49 11.8 11.8 0 0 1 3.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 0 1-5.68-1.45L.06 24Zm6.6-3.8c1.67.99 3.27 1.58 5.4 1.58 5.45 0 9.9-4.43 9.9-9.88a9.85 9.85 0 0 0-9.9-9.9C6.6 2 2.16 6.43 2.16 11.9c0 2.24.65 3.92 1.75 5.68l-1 3.63 3.74-.98ZM17.6 14.6c-.07-.12-.27-.2-.56-.34-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47a8.96 8.96 0 0 1-1.65-2.06c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.28.18-1.4Z"/></svg>',
            telegram: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-1.99.93l-5.5-4.05-2.66 2.56c-.3.3-.55.55-1.12.55l.4-5.65 10.32-9.32c.45-.4-.1-.62-.7-.22L6.1 13.4l-5.45-1.7c-1.18-.37-1.2-1.18.25-1.74L22.5 1.95c.97-.36 1.83.22 1.4 1.84Z"/></svg>',
            reddit: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M24 11.78a2.34 2.34 0 0 0-2.33-2.34c-.62 0-1.18.24-1.6.63a11.4 11.4 0 0 0-6.16-1.95l1.05-4.93 3.43.73a1.67 1.67 0 1 0 .19-.92l-3.83-.82a.4.4 0 0 0-.48.31l-1.17 5.5a11.46 11.46 0 0 0-6.25 1.95 2.32 2.32 0 0 0-1.6-.63A2.34 2.34 0 0 0 .9 13.83a2.34 2.34 0 0 0 1.35 2.13 4.2 4.2 0 0 0-.05.62c0 3.18 3.7 5.76 8.27 5.76 4.57 0 8.27-2.58 8.27-5.76 0-.21-.02-.42-.05-.62A2.34 2.34 0 0 0 24 11.78ZM6.33 13.46a1.67 1.67 0 1 1 3.34 0 1.67 1.67 0 0 1-3.34 0Zm9.34 4.42c-1.14 1.14-3.32 1.23-3.97 1.23-.65 0-2.83-.09-3.97-1.23a.43.43 0 0 1 .61-.61c.72.72 2.26.97 3.36.97 1.1 0 2.64-.25 3.36-.97a.43.43 0 1 1 .61.61Zm-.28-2.75a1.67 1.67 0 1 1 0-3.34 1.67 1.67 0 0 1 0 3.34Z"/></svg>',
            email: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
            copy_link: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
        };
    }

    /**
     * Map a stored network id to the shareItem network key.
     */
    static networkKeyFor(network) {
        if (network === 'x') return 'twitter';
        if (network === 'copy_link') return 'copy';
        return network;
    }

    /**
     * Build a share bar element from a resolved sharing config and an item
     * context. Reused by the lightbox, the grid decorator and the view footer.
     *
     * @param {Object} config  Resolved sharing - { networks, button_style, button_size }.
     * @param {Object} context - { id, fullUrl, caption, galleryId, galleryEl }.
     * @returns {HTMLElement|null}
     */
    /**
     * Inject the share-bar base styles once. Self-contained so the bar is
     * styled in any context regardless of which stylesheet is present.
     */
    static injectStyles() {
        if (document.getElementById('fotogrids-share-bar-style')) return;
        const style = document.createElement('style');
        style.id = 'fotogrids-share-bar-style';
        style.textContent =
            '.fotogrids-share-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}' +
            '.fotogrids-share-bar__btn{display:inline-flex;align-items:center;gap:6px;' +
            'border:0;cursor:pointer;border-radius:6px;padding:8px;line-height:1;' +
            'background:rgba(0,0,0,.06);color:inherit;font-size:13px;transition:background .15s ease,transform .1s ease;}' +
            '.fotogrids-share-bar__btn:hover{background:rgba(0,0,0,.12);}' +
            '.fotogrids-share-bar__btn:active{transform:scale(.94);}' +
            '.fotogrids-share-bar__icon{display:inline-flex;width:18px;height:18px;}' +
            '.fotogrids-share-bar--small .fotogrids-share-bar__icon{width:15px;height:15px;}' +
            '.fotogrids-share-bar--small .fotogrids-share-bar__btn{padding:6px;font-size:12px;}' +
            '.fotogrids-share-bar--large .fotogrids-share-bar__icon{width:22px;height:22px;}' +
            '.fotogrids-share-bar--large .fotogrids-share-bar__btn{padding:10px;font-size:15px;}' +
            '.fotogrids-share-bar--labels_only .fotogrids-share-bar__btn{padding-left:12px;padding-right:12px;}' +
            // Thumbnail overlay context.
            '.fg-item{position:relative;}' +
            '.fotogrids-share-bar--thumbnail{position:absolute;right:8px;bottom:8px;' +
            'opacity:0;transition:opacity .15s ease;background:rgba(0,0,0,.45);' +
            'padding:4px;border-radius:8px;backdrop-filter:blur(2px);}' +
            '.fotogrids-share-bar--thumbnail .fotogrids-share-bar__btn{background:transparent;color:#fff;}' +
            '.fotogrids-share-bar--thumbnail .fotogrids-share-bar__btn:hover{background:rgba(255,255,255,.2);}' +
            '.fg-item:hover .fotogrids-share-bar--thumbnail,' +
            '.fg-item:focus-within .fotogrids-share-bar--thumbnail{opacity:1;}' +
            // Footer + lightbox contexts inherit the surrounding text colour.
            '.fotogrids-share-bar--footer,.fotogrids-share-bar--lightbox{justify-content:flex-start;}';
        document.head.appendChild(style);
    }

    static renderShareBar(config, context) {
        if (!config || !config.networks) return null;

        FotoGridsSharing.injectStyles();

        const order = ['facebook', 'x', 'pinterest', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'copy_link'];
        const active = order.filter((n) => config.networks[n]);
        if (active.length === 0) return null;

        const labels = FotoGridsSharing.NETWORK_LABELS;
        const style = config.button_style || 'icons_only';
        const size = config.button_size || 'medium';

        const bar = document.createElement('div');
        bar.className = `fotogrids-share-bar fotogrids-share-bar--${style} fotogrids-share-bar--${size}`;

        // A detached element carrying the item data shareItem expects.
        const proxy = document.createElement('span');
        proxy.dataset.id = context.id != null ? String(context.id) : '';
        proxy.dataset.full = context.fullUrl || '';
        proxy.alt = context.caption || '';
        if (context.galleryEl) {
            // closest() needs the proxy in the tree; instead expose gallery id
            // directly so resolveShareUrl can read it.
            proxy.dataset.galleryId = context.galleryId || (context.galleryEl.dataset ? context.galleryEl.dataset.galleryId : '');
        }
        proxy.closest = (sel) => (sel === '.fotogrids-gallery' && context.galleryEl ? context.galleryEl : null);

        const icons = FotoGridsSharing.NETWORK_ICONS;
        const label = (network) => labels[network] || network;

        active.forEach((network) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `fotogrids-share-bar__btn fotogrids-share-bar__btn--${network}`;
            btn.setAttribute('aria-label', label(network));
            btn.dataset.network = network;

            const showIcon = style !== 'labels_only';
            const showLabel = style !== 'icons_only';

            if (showIcon && icons[network]) {
                const iconWrap = document.createElement('span');
                iconWrap.className = 'fotogrids-share-bar__icon';
                iconWrap.innerHTML = icons[network];
                btn.appendChild(iconWrap);
            }
            if (showLabel) {
                const labelEl = document.createElement('span');
                labelEl.className = 'fotogrids-share-bar__label';
                labelEl.textContent = label(network);
                btn.appendChild(labelEl);
            }
            const { __ } = (window.wp && window.wp.i18n) ? window.wp.i18n : { __: (s) => s };
            const tooltip = network === 'copy_link'
                ? __('Copy link', 'fotogrids')
                : __('Share on %s', 'fotogrids').replace('%s', label(network));
            btn.dataset.fgTooltip = tooltip;
            btn.dataset.fgTooltipDir = 'above';
            if (!showLabel) {
                btn.title = tooltip;
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                FotoGridsSharing.shareItem(proxy, FotoGridsSharing.networkKeyFor(network));

                if (network === 'copy_link') {
                    const copied = __('Link copied', 'fotogrids');
                    btn.dataset.fgTooltip = copied;
                    btn.title = copied;
                    if (window.FgTooltip) {
                        window.FgTooltip.bind(btn, copied);
                        window.FgTooltip.refresh?.(btn);
                    }
                    setTimeout(() => {
                        const base = __('Copy link', 'fotogrids');
                        btn.dataset.fgTooltip = base;
                        btn.title = base;
                        if (window.FgTooltip) {
                            window.FgTooltip.bind(btn, base);
                        }
                    }, 2000);
                }
            });

            if (window.FgTooltip) {
                window.FgTooltip.bind(btn, tooltip);
            }

            bar.appendChild(btn);
        });

        return bar;
    }
}

window.FotoGrids = FotoGrids;
window.FotoGridsSharing = FotoGridsSharing;
new FotoGrids();
