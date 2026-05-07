/**
 * List table shortcode column: inject clipboard icon and attach copy buttons.
 * Enqueued on edit.php?post_type=fotogrids_gallery and edit.php?post_type=fotogrids_album.
 */

import { attachCopyButtons } from './utils/copy-to-clipboard';

/**
 * Inject SVG from window.FotoGridsIcons into .fotogrids-icon[data-icon] placeholders.
 */
function injectShortcodeCellIcons() {
    if (typeof window.FotoGridsIcons === 'undefined') {
        return;
    }
    const placeholders = document.querySelectorAll('td.column-fotogrids_shortcode .fotogrids-icon[data-icon]');
    placeholders.forEach((el) => {
        const name = el.getAttribute('data-icon');
        const svg = window.FotoGridsIcons[name];
        if (svg) {
            el.innerHTML = svg;
        }
    });
}

/**
 * Initialize shortcode column on the list table: icons + copy buttons.
 */
function initShortcodeColumn() {
    if (!document.querySelector('.column-fotogrids_shortcode')) {
        return;
    }
    injectShortcodeCellIcons();
    attachCopyButtons({ selector: '.fotogrids-shortcode-copy-btn' });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShortcodeColumn);
} else {
    initShortcodeColumn();
}
