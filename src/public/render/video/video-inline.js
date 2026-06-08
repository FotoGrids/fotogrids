/**
 * Inline video playback.
 *
 * Subscribes to the runtime and, for video items whose playback mode is
 * "inline", swaps the poster for a real player (a <video> for Media Library
 * files, an <iframe> for YouTube / Vimeo embeds) when the visitor clicks the
 * tile. Items whose playback mode is "lightbox" are handled by the lightbox /
 * mini-lightbox modules and are ignored here.
 */
(function () {
    'use strict';

    const PLAYER_SELECTOR = '.fg-video[data-fg-playback-mode="inline"]';

    /**
     * Build a YouTube embed URL from the item's stored settings.
     *
     * @param {string} embedId
     * @param {Object} settings
     * @return {string}
     */
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

    /**
     * Build a Vimeo embed URL from the item's stored settings.
     *
     * @param {string} embedId
     * @param {Object} settings
     * @return {string}
     */
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

    /**
     * Read and parse the embed settings JSON from the element.
     *
     * @param {HTMLElement} el
     * @return {Object}
     */
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

    /**
     * Build the player element for a video item.
     *
     * @param {HTMLElement} el
     * @return {HTMLElement|null}
     */
    function buildPlayer(el) {
        const itemType = el.getAttribute('data-fg-item-type') || '';
        const settings = readSettings(el);

        if (itemType === 'video_file') {
            const src = el.getAttribute('data-fg-video-src') || '';
            if (!src) {
                return null;
            }
            const video = document.createElement('video');
            video.className = 'fg-video-player';
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

        let src = '';
        if (itemType === 'video_youtube') {
            src = buildYouTubeSrc(embedId, settings);
        } else if (itemType === 'video_vimeo') {
            src = buildVimeoSrc(embedId, settings);
        }
        if (!src) {
            return null;
        }

        const iframe = document.createElement('iframe');
        iframe.className = 'fg-video-player';
        iframe.src = src;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('title', el.closest('.fg-item')?.querySelector('.fg-video-poster')?.alt || 'Video');
        return iframe;
    }

    /**
     * Replace the poster with the player. Idempotent — a tile that is already
     * playing is left untouched.
     *
     * @param {HTMLElement} el
     */
    function playInline(el) {
        if (el.getAttribute('data-fg-playing') === '1') {
            return;
        }

        const player = buildPlayer(el);
        if (!player) {
            return;
        }

        el.setAttribute('data-fg-playing', '1');
        el.classList.add('fg-video--playing');
        el.innerHTML = '';
        el.appendChild(player);
    }

    /**
     * Wire one gallery's inline video tiles.
     *
     * @param {HTMLElement} galleryElement
     */
    function attach(galleryElement) {
        // Capture phase so inline playback wins over any click-behaviour
        // module (lightbox, direct-link, external-link) that may also be
        // listening on the gallery. stopPropagation prevents those handlers
        // from running once we've claimed the click for inline playback.
        galleryElement.addEventListener('click', function (event) {
            const trigger = event.target.closest(PLAYER_SELECTOR);
            if (!trigger || !galleryElement.contains(trigger)) {
                return;
            }
            if (trigger.getAttribute('data-fg-playing') === '1') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            playInline(trigger);
        }, true);
    }

    function init() {
        if (!window.FotoGrids || typeof window.FotoGrids.onGallery !== 'function') {
            return;
        }
        window.FotoGrids.onGallery(attach, 10);

        window.FotoGrids.modules = window.FotoGrids.modules || {};
        window.FotoGrids.modules.videoInline = {
            play: playInline,
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
