/**
 * Image Zoom frontend module.
 *
 * Two styles, driven by data-fg-zoom-style on the gallery wrapper:
 *
 *   inline  — a magnifier lens is painted over the media box using the
 *             full-size image as its background. On hover the lens fades in
 *             and pans across the full image on mousemove, revealing detail.
 *   popover — the image opens in the shared Lightbox Mini overlay, on hover
 *             (after the configured delay) or on click, per data-fg-zoom-mode.
 *
 * Both styles read the full-size source from data-fg-zoom-full (resolved from
 * the Media tab's full_image_size setting). The popover overlay is owned by the
 * generic lightbox-mini module.
 */
(function () {
    'use strict';

    const ITEM_SELECTOR = '.fg-item[data-fg-zoom-full]';

    function readHoverDelay(galleryElement) {
        const raw = getComputedStyle(galleryElement).getPropertyValue('--fg-zoom-hover-delay');
        const parsed = parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : 300;
    }

    function buildImage(itemElement) {
        const fullUrl = itemElement.getAttribute('data-fg-zoom-full');
        if (!fullUrl) {
            return null;
        }
        const img = document.createElement('img');
        img.src = fullUrl;
        const sourceImg = itemElement.querySelector('.fg-item-media img');
        img.alt = sourceImg ? sourceImg.alt : '';
        return img;
    }

    function readStyleVars(galleryElement) {
        const styles = getComputedStyle(galleryElement);
        const vars = {};
        ['--fg-lb-mini-backdrop', '--fg-lb-mini-backdrop-blur', '--fg-lb-mini-padding'].forEach(function (name) {
            const value = styles.getPropertyValue(name).trim();
            if (value) {
                vars[name] = value;
            }
        });
        return vars;
    }

    function openPopover(galleryElement, itemElement) {
        const mini = window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.lightboxMini;
        if (!mini || typeof mini.open !== 'function') {
            return;
        }
        const img = buildImage(itemElement);
        if (!img) {
            return;
        }
        mini.open(img, {
            label: img.alt || 'Image',
            closeButton: galleryElement.getAttribute('data-fg-zoom-close-button') !== '0',
            clickOutsideToClose: galleryElement.getAttribute('data-fg-zoom-click-outside') !== '0',
            styleVars: readStyleVars(galleryElement),
        });
    }

    function attachClick(galleryElement) {
        galleryElement.addEventListener('click', function (event) {
            const item = event.target.closest(ITEM_SELECTOR);
            if (!item || !galleryElement.contains(item)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            openPopover(galleryElement, item);
        }, true);
    }

    function attachHover(galleryElement) {
        const delay = readHoverDelay(galleryElement);
        let timer = null;

        galleryElement.addEventListener('mouseover', function (event) {
            const item = event.target.closest(ITEM_SELECTOR);
            if (!item || !galleryElement.contains(item)) {
                return;
            }
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                openPopover(galleryElement, item);
            }, delay);
        });

        galleryElement.addEventListener('mouseout', function (event) {
            const item = event.target.closest(ITEM_SELECTOR);
            if (!item) {
                return;
            }
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        });
    }

    function ensureLens(mediaElement, fullUrl) {
        let lens = mediaElement.querySelector('.fg-zoom-lens');
        if (lens) {
            return lens;
        }
        lens = document.createElement('div');
        lens.className = 'fg-zoom-lens';
        lens.setAttribute('aria-hidden', 'true');
        const loader = new Image();
        loader.onload = function () {
            lens.style.backgroundImage = 'url("' + fullUrl + '")';
            lens.style.backgroundSize = loader.naturalWidth + 'px ' + loader.naturalHeight + 'px';
            lens.dataset.fgZoomW = String(loader.naturalWidth);
            lens.dataset.fgZoomH = String(loader.naturalHeight);
            lens.dataset.fgZoomReady = '1';
        };
        loader.src = fullUrl;
        mediaElement.appendChild(lens);
        return lens;
    }

    /**
     * Pans the lens so the full image is shown at 1:1 pixel size, tracking the
     * cursor across the true image extent. When the full image is larger than
     * the lens box, the cursor's relative position maps to the overflow so the
     * far edges of the image are reachable; smaller dimensions stay centred.
     */
    function panLens(lens, mediaElement, event) {
        const rect = mediaElement.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return;
        }
        const fullW = parseInt(lens.dataset.fgZoomW, 10) || rect.width;
        const fullH = parseInt(lens.dataset.fgZoomH, 10) || rect.height;

        const ratioX = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const ratioY = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

        const overflowX = Math.max(fullW - rect.width, 0);
        const overflowY = Math.max(fullH - rect.height, 0);

        const posX = overflowX > 0 ? -(ratioX * overflowX) : (rect.width - fullW) / 2;
        const posY = overflowY > 0 ? -(ratioY * overflowY) : (rect.height - fullH) / 2;

        lens.style.backgroundPosition = posX + 'px ' + posY + 'px';
    }

    function attachInline(galleryElement) {
        galleryElement.addEventListener('mouseenter', function (event) {
            const item = event.target.closest(ITEM_SELECTOR);
            if (!item || !galleryElement.contains(item)) {
                return;
            }
            const media = item.querySelector('.fg-item-media');
            const fullUrl = item.getAttribute('data-fg-zoom-full');
            if (!media || !fullUrl) {
                return;
            }
            const lens = ensureLens(media, fullUrl);
            if (lens.dataset.fgZoomReady === '1') {
                lens.classList.add('is-active');
            }
        }, true);

        galleryElement.addEventListener('mousemove', function (event) {
            const item = event.target.closest(ITEM_SELECTOR);
            if (!item) {
                return;
            }
            const media = item.querySelector('.fg-item-media');
            const lens = media && media.querySelector('.fg-zoom-lens');
            if (!lens || lens.dataset.fgZoomReady !== '1') {
                return;
            }
            lens.classList.add('is-active');
            panLens(lens, media, event);
        });

        galleryElement.addEventListener('mouseleave', function (event) {
            const item = event.target.closest(ITEM_SELECTOR);
            if (!item) {
                return;
            }
            const media = item.querySelector('.fg-item-media');
            const lens = media && media.querySelector('.fg-zoom-lens');
            if (lens) {
                lens.classList.remove('is-active');
            }
        }, true);
    }

    function attach(galleryElement) {
        const style = galleryElement.getAttribute('data-fg-zoom-style');

        if (style === 'inline') {
            attachInline(galleryElement);
            return;
        }

        if (style !== 'popover') {
            return;
        }

        if (galleryElement.getAttribute('data-fg-zoom-mode') === 'click') {
            attachClick(galleryElement);
        } else {
            attachHover(galleryElement);
        }
    }

    function init() {
        if (!window.FotoGrids || typeof window.FotoGrids.onGallery !== 'function') {
            return;
        }
        window.FotoGrids.onGallery(attach, 10);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
