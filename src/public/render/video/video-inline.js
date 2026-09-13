/**
 * Inline video playback.
 *
 * Subscribes to the runtime and, for video items whose playback mode is
 * "inline", swaps the poster for a real player - a <video> for Media Library
 * files, an <iframe> for YouTube / Vimeo embeds.
 *
 * When that swap happens depends on the item's own settings. An autoplaying
 * tile mounts its player as it scrolls into view; a file video showing its
 * controls mounts a paused player straight away, so the native play button is
 * the affordance; anything else waits for a click on the poster.
 *
 * Items whose playback mode is "lightbox" are handled by the lightbox /
 * mini-lightbox modules and are ignored here.
 */
(function () {
    'use strict';

    const PLAYER_SELECTOR = '.fg-video[data-fg-playback-mode="inline"]';

    /**
     * Resolve a URL and return it only when it points at an http(s) resource.
     *
     * Player sources come from data attributes, which a filter or a stray
     * template edit can change after the server has escaped them. Anything
     * that is not http(s) - javascript:, data:, blob: - is dropped.
     *
     * @param {string} url
     * @return {string} The resolved URL, or an empty string when unusable.
     */
    function httpUrl(url) {
        if (!url) {
            return '';
        }
        try {
            const parsed = new URL(url, window.location.href);
            return ('http:' === parsed.protocol || 'https:' === parsed.protocol) ? parsed.href : '';
        } catch (err) {
            return '';
        }
    }

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

        params.set('autoplay', settings.autoplay === false ? '0' : '1');
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

        params.set('autoplay', settings.autoplay === false ? '0' : '1');
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
     * Read the poster image URL off a tile, if it rendered one.
     *
     * @param {HTMLElement} el
     * @return {string}
     */
    function posterSrc(el) {
        const img = el.querySelector('img.fg-video-poster');
        return img ? img.getAttribute('src') || '' : '';
    }

    /**
     * Build the player element for a video item.
     *
     * @param {HTMLElement} el
     * @param {boolean} shouldPlay Whether playback should start on mount.
     * @return {HTMLElement|null}
     */
    function buildPlayer(el, shouldPlay) {
        const itemType = el.getAttribute('data-fg-item-type') || '';
        const settings = readSettings(el);

        if (itemType === 'video_file') {
            const src = httpUrl(el.getAttribute('data-fg-video-src') || '');
            if (!src) {
                return null;
            }
            const poster = posterSrc(el);
            const video = document.createElement('video');
            video.className = 'fg-video-player';
            video.src = src;
            video.controls = settings.controls === false ? false : true;
            video.autoplay = !!shouldPlay;
            video.playsInline = true;
            video.muted = !!settings.mute;
            video.loop = !!settings.loop;
            video.preload = shouldPlay ? 'auto' : 'metadata';
            if (poster) {
                video.poster = poster;
            }
            return video;
        }

        const embedId = el.getAttribute('data-fg-embed-id') || '';
        if (!embedId) {
            return null;
        }

        const embedSettings = shouldPlay
            ? Object.assign({}, settings, { autoplay: true })
            : settings;

        let src = '';
        if (itemType === 'video_youtube') {
            src = buildYouTubeSrc(embedId, embedSettings);
        } else if (itemType === 'video_vimeo') {
            src = buildVimeoSrc(embedId, embedSettings);
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
     * Add a play badge over a mounted player and start playback when it is
     * pressed. Used when a browser refuses an autoplay request on a tile whose
     * controls are hidden, which would otherwise leave the visitor no way in.
     *
     * @param {HTMLElement} el
     * @param {HTMLVideoElement} video
     */
    function addFallbackBadge(el, video) {
        if (el.querySelector('.fg-video-badge')) {
            return;
        }
        const badge = document.createElement('span');
        badge.className = 'fg-video-badge';
        badge.setAttribute('aria-hidden', 'true');
        el.appendChild(badge);
        el.addEventListener('click', function once() {
            el.removeEventListener('click', once);
            badge.remove();
            video.play().catch(function () {});
        });
    }

    /**
     * Swap a tile's poster for its player. Idempotent - a tile that already
     * mounted one is left untouched.
     *
     * @param {HTMLElement} el
     * @param {boolean} shouldPlay Whether playback should start on mount.
     */
    function mountPlayer(el, shouldPlay) {
        if (el.getAttribute('data-fg-playing') === '1') {
            return;
        }

        const player = buildPlayer(el, shouldPlay);
        if (!player) {
            return;
        }

        el.setAttribute('data-fg-playing', '1');
        el.classList.add('fg-video--playing');
        el.innerHTML = '';
        el.appendChild(player);

        if (!shouldPlay || typeof player.play !== 'function') {
            return;
        }

        const started = player.play();
        if (started && typeof started.catch === 'function') {
            started.catch(function () {
                if (!player.controls) {
                    addFallbackBadge(el, player);
                }
            });
        }
    }

    /**
     * Mount a tile's player and start it. The click and public-API entry point.
     *
     * @param {HTMLElement} el
     */
    function playInline(el) {
        mountPlayer(el, true);
    }

    /**
     * Give a tile its resting state.
     *
     * An autoplaying tile mounts its player when it scrolls into view, so a
     * gallery does not fetch every video at once. A file video whose controls
     * are showing mounts a paused player, whose own play button is the
     * affordance. Everything else stays a poster until it is clicked.
     *
     * @param {HTMLElement} el
     */
    function prepare(el) {
        const settings = readSettings(el);

        if (settings.autoplay) {
            observe(el);
            return;
        }

        const isFile = el.getAttribute('data-fg-item-type') === 'video_file';
        if (isFile && settings.controls !== false) {
            mountPlayer(el, false);
        }
    }

    /**
     * Mount an autoplaying tile once it reaches the viewport.
     *
     * @param {HTMLElement} el
     */
    function observe(el) {
        if (typeof window.IntersectionObserver !== 'function') {
            mountPlayer(el, true);
            return;
        }
        const observer = new window.IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                observer.disconnect();
                mountPlayer(entry.target, true);
            });
        }, { rootMargin: '100px' });
        observer.observe(el);
    }

    /**
     * Wire one gallery's inline video tiles.
     *
     * @param {HTMLElement} galleryElement
     */
    function attach(galleryElement) {
        galleryElement.querySelectorAll(PLAYER_SELECTOR).forEach(prepare);

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
            prepare: prepare,
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
