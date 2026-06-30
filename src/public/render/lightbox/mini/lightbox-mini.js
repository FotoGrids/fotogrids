/**
 * Lightbox Mini.
 *
 * A minimal, general-purpose overlay - backdrop, a centred stage, and a close
 * button - into which any caller can drop a single content node (a video
 * player, an image, an iframe, etc.). It owns no content-specific logic; the
 * caller builds the node and hands it to open().
 *
 * Exposed as window.FotoGrids.modules.lightboxMini.{ open, close }.
 *   open(contentNode, options) - options:
 *     { label, closeButton, clickOutsideToClose, styleVars, dataAttrs }
 *   close()
 */
(function () {
    'use strict';

    let overlay = null;
    let keyHandler = null;
    let lastFocus = null;

    function close() {
        if (!overlay) {
            return;
        }
        overlay.remove();
        overlay = null;
        document.body.style.overflow = '';
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
            keyHandler = null;
        }
        if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus({ preventScroll: true });
        }
        lastFocus = null;
    }

    /**
     * Open the mini lightbox with a single content node.
     *
     * @param {HTMLElement} contentNode The node to display (player, img, etc.).
     * @param {Object}      [options]   Options:
     *   label               - accessible dialog label.
     *   closeButton         - show the close button (default true).
     *   clickOutsideToClose - close when the backdrop is clicked (default true).
     *   styleVars           - map of CSS custom properties set on the overlay
     *                         (e.g. { '--fg-lb-mini-padding': '24px' }).
     *   dataAttrs           - map of data attributes set on the overlay, used
     *                         to select theme/blur in CSS
     *                         (e.g. { 'data-fg-mini-theme': 'dark' }).
     */
    function open(contentNode, options) {
        if (!contentNode) {
            return;
        }
        const opts = options || {};
        const showClose = opts.closeButton !== false;
        const closeOnBackdrop = opts.clickOutsideToClose !== false;
        close();

        lastFocus = document.activeElement;

        overlay = document.createElement('div');
        overlay.className = 'fg-lb-mini';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        if (opts.label) {
            overlay.setAttribute('aria-label', opts.label);
        }
        if (opts.styleVars && typeof opts.styleVars === 'object') {
            Object.keys(opts.styleVars).forEach(function (name) {
                overlay.style.setProperty(name, opts.styleVars[name]);
            });
        }
        if (opts.dataAttrs && typeof opts.dataAttrs === 'object') {
            Object.keys(opts.dataAttrs).forEach(function (name) {
                overlay.setAttribute(name, opts.dataAttrs[name]);
            });
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'fg-lb-mini-backdrop';
        if (closeOnBackdrop) {
            backdrop.addEventListener('click', close);
        }

        const stage = document.createElement('div');
        stage.className = 'fg-lb-mini-stage';

        contentNode.classList.add('fg-lb-mini-content');

        stage.appendChild(contentNode);

        let closeBtn = null;
        if (showClose) {
            closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'fg-lb-mini-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', close);
            stage.appendChild(closeBtn);
        }

        overlay.appendChild(backdrop);
        overlay.appendChild(stage);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        keyHandler = function (event) {
            if (event.key === 'Escape') {
                close();
            }
        };
        document.addEventListener('keydown', keyHandler);

        if (closeBtn) {
            closeBtn.focus();
        } else {
            overlay.setAttribute('tabindex', '-1');
            overlay.focus();
        }
    }

    function init() {
        window.FotoGrids = window.FotoGrids || {};
        window.FotoGrids.modules = window.FotoGrids.modules || {};
        window.FotoGrids.modules.lightboxMini = { open, close };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
