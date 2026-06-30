/**
 * FotoGrids Elementor editor bundle.
 *
 * Registers the custom Marionette control views for the gallery and
 * album pickers, hydrates a rich Select2 inside each, and mounts the
 * shared React PickerModal when the "Browse all" button is clicked.
 *
 * The control type's PHP `content_template` ships static markup
 * (`<select>`, Browse button, Edit link). The Marionette view here
 * takes over post-render: fetches the picker items via REST once per
 * editor session, builds Select2 optgroups (status-bucketed,
 * groups ordered by most-recently-modified group first, within-group
 * order = modified DESC), and writes the picked id into the
 * Elementor setting via `setValue()` so Elementor's preview re-renders.
 *
 * Hosts: window.fotogridsPbElementor (localized in PHP) carries
 * { restUrl, restNonce, galleryCreateUrl, albumCreateUrl,
 *   galleryEditBase, albumEditBase }.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { __ } from '@wordpress/i18n';

import PickerModal from '../../../../core/assets/src/components/PickerModal';
import '../../../../core/assets/src/collection.scss';
import './editor.scss';

const CONTROL_VIEW_PARENT = window.elementor && window.elementor.modules
    ? window.elementor.modules.controls.BaseData
    : null;

/**
 * Fetch the full picker payload for a given kind. Cached for the life
 * of the editor session - invalidated only when the modal triggers a
 * selection (we re-fetch on next open so newly created items appear).
 */
const cache = { gallery: null, album: null };
async function fetchItems(kind) {
    if (cache[kind]) {
        return cache[kind];
    }
    const cfg = window.fotogridsPbElementor || {};
    const url = new URL(`${cfg.restUrl || ''}picker/items`);
    url.searchParams.set('type', kind);
    url.searchParams.set('per_page', '200');
    url.searchParams.set('orderby', 'modified');

    const response = await fetch(url.toString(), {
        headers: { 'X-WP-Nonce': cfg.restNonce || '' },
    });
    if (!response.ok) {
        throw new Error('FotoGrids picker REST failed');
    }
    const body = await response.json();
    cache[kind] = body.items || [];
    return cache[kind];
}

function invalidateCache(kind) {
    cache[kind] = null;
}

/**
 * Group picker items by status, preserving the order in which each
 * status first appears in the input. Items inside each group keep
 * their input order. Caller is responsible for sorting the input
 * (we expect modified DESC).
 */
function groupByStatus(items) {
    const groups = new Map();
    for (const item of items) {
        const status = item.status || 'publish';
        if (!groups.has(status)) {
            groups.set(status, { label: item.status_label || status, items: [] });
        }
        groups.get(status).items.push(item);
    }
    return groups;
}

/**
 * Build the Select2 options DOM for a given items array.
 * Returns a string of `<optgroup>`s + `<option>`s.
 */
function buildOptionsHtml(items) {
    const groups = groupByStatus(items);
    let html = `<option value=""></option>`; // placeholder
    for (const [, group] of groups) {
        const groupLabel = `${escapeHtml(group.label)} (${group.items.length})`;
        html += `<optgroup label="${groupLabel}">`;
        for (const item of group.items) {
            html += `<option value="${item.id}">${escapeHtml(item.title || `#${item.id}`)}</option>`;
        }
        html += '</optgroup>';
    }
    return html;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
}

/**
 * Select2 templateResult / templateSelection renderer. The argument
 * `option` is the underlying <option> element; we look up the full
 * picker-item record from a side-table on the <select>.
 */
function renderRow(option) {
    if (!option.id) return option.text;
    const $ = window.jQuery;
    const $select = $(option.element).closest('select');
    const items = $select.data('fg-items') || [];
    const item = items.find((it) => String(it.id) === String(option.id));
    if (!item) return option.text;

    const itemCountLabel = item.kind === 'album'
        ? (item.item_count === 1
            ? __('1 gallery', 'fotogrids')
            : __('%d galleries', 'fotogrids').replace('%d', item.item_count))
        : (item.item_count === 1
            ? __('1 item', 'fotogrids')
            : __('%d items', 'fotogrids').replace('%d', item.item_count));

    const statusPill = item.status && item.status !== 'publish'
        ? `<span class="fg-pb-elementor-picker__pill is-${escapeHtml(item.status)}">${escapeHtml(item.status_label || item.status)}</span>`
        : '';

    // Thumb resolution:
    //   1. Has a featured thumb → render the image.
    //   2. No items at all → render the shared `image_x` icon (matches
    //      the React picker card empty state).
    //   3. Has items but no thumb → fall back to the "FG" wordmark.
    const icons = (window && window.FotoGridsIcons) || {};
    const isEmpty = !item.item_count;
    const emptyIcon = isEmpty && icons.image_x
        ? icons.image_x
        : null;
    const thumb = item.featured_thumb
        ? `<img class="fg-pb-elementor-picker__thumb" src="${escapeHtml(item.featured_thumb)}" alt="" />`
        : emptyIcon
            ? `<span class="fg-pb-elementor-picker__thumb is-placeholder is-empty" aria-hidden="true">${emptyIcon}</span>`
            : `<span class="fg-pb-elementor-picker__thumb is-placeholder" aria-hidden="true">FG</span>`;

    const metaClass = isEmpty
        ? 'fg-pb-elementor-picker__meta is-empty'
        : 'fg-pb-elementor-picker__meta';

    const $row = $(
        `<span class="fg-pb-elementor-picker__row">
            ${thumb}
            <span class="fg-pb-elementor-picker__row-body">
                <span class="fg-pb-elementor-picker__title">${escapeHtml(item.title || __('(no title)', 'fotogrids'))}</span>
                <span class="${metaClass}">${escapeHtml(itemCountLabel)}</span>
            </span>
            ${statusPill}
        </span>`
    );
    return $row;
}

/**
 * Update the inline "Edit" link href to point at the editor URL for
 * the currently selected item, or hide it when nothing is selected.
 */
function updateEditLink($root, selectedId, kind) {
    const $link = $root.find('.fg-pb-elementor-picker__edit');

    // Lazy-fill the inline SVG for the trailing "open in new tab" icon. The
    // markup ships an empty <span class="fotogrids-icon fotogrids-icon--click_external">,
    // we fill it once per link from window.FotoGridsIcons. Idempotent.
    const $icon = $link.find('.fg-pb-elementor-picker__edit-icon');
    if ($icon.length && !$icon.children().length) {
        const icons = (window && window.FotoGridsIcons) || {};
        if (icons.click_external) {
            $icon.html(icons.click_external);
        }
    }

    if (!selectedId) {
        $link.attr('hidden', 'hidden');
        return;
    }
    const cfg = window.fotogridsPbElementor || {};
    const base = kind === 'album' ? cfg.albumEditBase : cfg.galleryEditBase;
    if (!base) {
        $link.attr('hidden', 'hidden');
        return;
    }
    $link.attr('href', base + selectedId).removeAttr('hidden');
}

/**
 * Mount the React PickerModal into a portal div appended to <body>,
 * resolve with the selected item (or null on cancel).
 */
function openPickerModal(kind, currentId) {
    return new Promise((resolve) => {
        const host = document.createElement('div');
        host.className = 'fg-pb-elementor-picker__modal-host';
        document.body.appendChild(host);
        const root = createRoot(host);

        const cfg = window.fotogridsPbElementor || {};
        const createNewUrl = kind === 'album' ? cfg.albumCreateUrl : cfg.galleryCreateUrl;

        const cleanup = () => {
            root.unmount();
            if (host.parentNode) {
                host.parentNode.removeChild(host);
            }
        };

        const onSelect = (item) => {
            cleanup();
            resolve(item);
        };
        const onClose = () => {
            cleanup();
            resolve(null);
        };

        root.render(
            <PickerModal
                kind={kind}
                restUrl={cfg.restUrl}
                restNonce={cfg.restNonce}
                selectedId={Number(currentId) || 0}
                onSelect={onSelect}
                onClose={onClose}
                createNewUrl={createNewUrl}
            />
        );
    });
}

/**
 * Build the Marionette control view class. Subclassed once per kind
 * because Elementor uses `module:` strings as the lookup key and we
 * want clean separation in the codebase.
 */
function buildControlView(kind) {
    if (!CONTROL_VIEW_PARENT) {
        // eslint-disable-next-line no-console
        console.warn('[FotoGrids] Elementor BaseData control view unavailable; skipping.');
        return null;
    }

    // The Marionette BaseData parent doesn't reliably define every
    // lifecycle method (`onBeforeDestroy` in particular is undefined on
    // some Elementor versions). Calling `.apply(this, args)` on an
    // undefined property crashes the destroy pass and freezes the panel.
    // This helper safely invokes a parent method when present and
    // returns its result, otherwise returns a fallback.
    const callParent = (method, self, args, fallback) => {
        const proto = CONTROL_VIEW_PARENT.prototype;
        if (proto && typeof proto[method] === 'function') {
            return proto[method].apply(self, args);
        }
        return fallback;
    };

    return CONTROL_VIEW_PARENT.extend({
        ui() {
            const parentUi = callParent('ui', this, arguments, {}) || {};
            return {
                ...parentUi,
                select: '.fg-pb-elementor-picker__select',
                browse: '.fg-pb-elementor-picker__browse',
                edit: '.fg-pb-elementor-picker__edit',
            };
        },
        events() {
            const parentEvents = callParent('events', this, arguments, {}) || {};
            return {
                ...parentEvents,
                'click @ui.browse': 'onBrowseClick',
                'change @ui.select': 'onSelectChange',
            };
        },
        async onReady() {
            const $select = this.ui.select;
            const $ = window.jQuery;
            const currentVal = this.getControlValue();

            try {
                const items = await fetchItems(kind);
                $select.data('fg-items', items);

                // Annotate each item with its kind so the row renderer
                // can choose the right pluralisation without re-passing.
                for (const item of items) item.kind = kind;

                $select.html(buildOptionsHtml(items));

                $select.select2({
                    width: '100%',
                    placeholder: kind === 'album'
                        ? __('Select an album…', 'fotogrids')
                        : __('Select a gallery…', 'fotogrids'),
                    templateResult: renderRow,
                    templateSelection: renderRow,
                    escapeMarkup: (m) => m, // we already escape inside renderRow
                });

                if (currentVal) {
                    $select.val(String(currentVal)).trigger('change.select2');
                }

                updateEditLink(this.$el, currentVal, kind);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[FotoGrids] picker load failed', err);
            }
        },
        async onBrowseClick(event) {
            event.preventDefault();
            const currentVal = this.getControlValue();
            const item = await openPickerModal(kind, currentVal);
            if (!item) return;

            // Selection from the modal may include items not currently
            // in the cache (newly created, freshly published). Drop the
            // cache so the next render rebuilds from REST.
            invalidateCache(kind);

            const $ = window.jQuery;
            const items = await fetchItems(kind);
            for (const it of items) it.kind = kind;
            this.ui.select.data('fg-items', items);
            this.ui.select.html(buildOptionsHtml(items));
            this.ui.select.val(String(item.id)).trigger('change.select2');
            this.setValue(String(item.id));
            updateEditLink(this.$el, item.id, kind);
        },
        onSelectChange() {
            const val = this.ui.select.val();
            this.setValue(val || '');
            updateEditLink(this.$el, val, kind);
        },
        onBeforeDestroy() {
            try {
                if (this.ui.select && this.ui.select.length) {
                    this.ui.select.select2('destroy');
                }
            } catch (e) {
                // Select2 not initialised yet; ignore.
            }
            callParent('onBeforeDestroy', this, arguments, undefined);
        },
    });
}

/**
 * Register both control views with Elementor once the editor is ready.
 */
function registerControlViews() {
    if (!window.elementor || !window.elementor.addControlView) {
        return;
    }
    const galleryView = buildControlView('gallery');
    const albumView = buildControlView('album');
    if (galleryView) {
        window.elementor.addControlView('fotogrids_gallery_picker', galleryView);
    }
    if (albumView) {
        window.elementor.addControlView('fotogrids_album_picker', albumView);
    }
}

if (window.elementor) {
    if (window.elementor.on) {
        window.elementor.on('panel:init', registerControlViews);
    }
    // Belt-and-braces in case panel:init has already fired.
    registerControlViews();
} else if (window.jQuery) {
    window.jQuery(window).on('elementor:init', registerControlViews);
}

/**
 * Capture-phase guard: when a widget's preview renders with
 * `preview_pagination=false`, the wrapper carries `is-fg-pb-pagination-frozen`.
 * Clicks on `.fg-pagination` chrome inside it are swallowed so the buttons
 * show their final styling but don't paginate. Mirrors LivePreview.jsx.
 *
 * Elementor renders widgets in an iframe, so a listener on the outer document
 * only sees panel clicks; this binds on the outer doc and the preview iframe's
 * document (via `elementor.$previewContents`) too.
 */
function bindPaginationGuard(targetDocument) {
    if (!targetDocument || targetDocument.__fgPbGuardBound) return;
    targetDocument.__fgPbGuardBound = true;

    targetDocument.addEventListener(
        'click',
        (event) => {
            const target = event.target;
            if (!target || !target.closest) return;
            const frozen = target.closest('.is-fg-pb-pagination-frozen');
            if (!frozen) return;
            if (target.closest('.fg-pagination, .fg-pagination__btn')) {
                event.stopPropagation();
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        },
        true
    );
}

bindPaginationGuard(document);

/**
 * Discover the Elementor preview iframe document and bind the same
 * guard there. Elementor publishes `elementor.$previewContents` (a
 * jQuery wrapper of the iframe document) once the preview iframe has
 * loaded. We listen on `preview:loaded` to catch the first iframe and
 * also poll briefly as belt-and-braces for older Elementor builds.
 */
function tryBindIframe() {
    if (!window.elementor) return false;
    const $contents = window.elementor.$previewContents;
    if ($contents && $contents.length) {
        const previewDoc = $contents[0];
        bindPaginationGuard(previewDoc);
        return true;
    }
    return false;
}

if (window.elementor && window.elementor.on) {
    window.elementor.on('preview:loaded', tryBindIframe);
}
// Belt-and-braces: try immediately + once on next tick in case the
// iframe is already there.
tryBindIframe();
setTimeout(tryBindIframe, 0);
setTimeout(tryBindIframe, 1000);

// ─── Empty-state CTA bridge ─────────────────────────────────────────────────
// When a gallery/album widget renders its empty-state panel inside the
// Elementor preview iframe, the inline "Add items/galleries" button
// can't open a new tab itself (the iframe blocks target=_blank /
// window.open). It postMessages the URL up here; we open it from the
// editor window where popup permissions are normal.
function isAllowedEmptyStateMessage(event) {
    if (!event || typeof event.data !== 'object' || event.data === null) return false;
    if (event.data.type !== 'fg-pb-empty-state:open') return false;
    if (typeof event.data.url !== 'string') return false;
    // Same-origin only - the preview iframe shares the editor's origin.
    try {
        const url = new URL(event.data.url, window.location.origin);
        return url.origin === window.location.origin;
    } catch (e) {
        return false;
    }
}

window.addEventListener('message', (event) => {
    if (!isAllowedEmptyStateMessage(event)) return;
    window.open(event.data.url, '_blank', 'noopener,noreferrer');
});
