/**
 * Video → Lightbox Mini glue.
 *
 * Opens a video item in the shared Lightbox Mini overlay. Used when a gallery
 * plays videos in a lightbox but its click behaviour is not the full lightbox
 * (so the full lightbox module is not on the page). Builds the player and hands
 * it to FotoGrids.modules.lightboxMini.open(); the overlay itself is owned by
 * the generic lightbox-mini module.
 */
(function () {
    'use strict';

    const TRIGGER_SELECTOR = '.fg-video[data-fg-playback-mode="lightbox"]';

    function buildYouTubeSrc(embedId, settings) {
        const privacy = !!settings.privacy_mode;
        const host = privacy ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
        const params = new URLSearchParams();
        params.set('autoplay', '1');
        params.set('mute', settings.mute ? '1' : '0');
        params.set('controls', settings.controls === false ? '0' : '1');
        params.set('cc_load_policy', settings.captions ? '1' : '0');
        params.set('rel', settings.suggested_videos === 'any' ? '1' : '0');
        params.set('playsinline', '1');
        if (settings.loop) {
            params.set('loop', '1');
            params.set('playlist', embedId);
        }
        if (settings.start_time) {
            params.set('start', String(parseInt(settings.start_time, 10) || 0));
        }
        if (settings.end_time) {
            params.set('end', String(parseInt(settings.end_time, 10) || 0));
        }
        return `${host}/embed/${encodeURIComponent(embedId)}?${params.toString()}`;
    }

    function buildVimeoSrc(embedId, settings) {
        const params = new URLSearchParams();
        params.set('autoplay', '1');
        params.set('muted', settings.mute ? '1' : '0');
        params.set('loop', settings.loop ? '1' : '0');
        params.set('dnt', settings.privacy_mode ? '1' : '0');
        params.set('title', settings.intro_title ? '1' : '0');
        params.set('portrait', settings.intro_portrait ? '1' : '0');
        params.set('byline', settings.intro_byline ? '1' : '0');
        params.set('playsinline', '1');
        if (typeof settings.controls_color === 'string'
            && /^#[0-9a-fA-F]{3,6}$/.test(settings.controls_color)) {
            params.set('color', settings.controls_color.replace('#', ''));
        }
        let hash = '';
        if (settings.start_time) {
            hash = `#t=${parseInt(settings.start_time, 10) || 0}s`;
        }
        return `https://player.vimeo.com/video/${encodeURIComponent(embedId)}?${params.toString()}${hash}`;
    }

    function readSettings(el) {
        const raw = el.getAttribute('data-fg-embed-settings');
        if (!raw) {
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (err) {
            return {};
        }
    }

    function buildPlayer(el) {
        const itemType = el.getAttribute('data-fg-item-type') || '';
        const settings = readSettings(el);

        if (itemType === 'video_file') {
            const src = el.getAttribute('data-fg-video-src') || '';
            if (!src) {
                return null;
            }
            const video = document.createElement('video');
            video.src = src;
            video.controls = settings.controls === false ? false : true;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = !!settings.mute;
            video.loop = !!settings.loop;
            return video;
        }

        const embedId = el.getAttribute('data-fg-embed-id') || '';
        if (!embedId) {
            return null;
        }
        const src = itemType === 'video_vimeo'
            ? buildVimeoSrc(embedId, settings)
            : buildYouTubeSrc(embedId, settings);
        if (!src) {
            return null;
        }
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('title', 'Video');
        return iframe;
    }

    function open(triggerEl) {
        const mini = window.FotoGrids && window.FotoGrids.modules && window.FotoGrids.modules.lightboxMini;
        if (!mini || typeof mini.open !== 'function') {
            return;
        }
        const player = buildPlayer(triggerEl);
        if (!player) {
            return;
        }
        mini.open(player, { label: 'Video' });
    }

    function attach(galleryElement) {
        galleryElement.addEventListener('click', function (event) {
            const trigger = event.target.closest(TRIGGER_SELECTOR);
            if (!trigger || !galleryElement.contains(trigger)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            open(trigger);
        }, true);
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
