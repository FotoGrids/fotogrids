/**
 * FotoGrids Custom Color Picker
 *
 * A self-contained, framework-free color picker widget.
 * Renders inline (no external positioning needed — the caller decides where).
 *
 * Features:
 *  - HSV gradient canvas with draggable handle
 *  - Hue slider
 *  - Alpha slider with checkerboard background
 *  - Text input with HEX / RGBA / HSLA format switcher
 *  - Button slot row (empty for now, populated by future features)
 *  - Emits onChange(cssColorString) on every valid change
 *
 * Color model: internally works in HSV + alpha (0–1).
 * All public I/O is CSS color strings.
 */

window.FGColorPicker = window.FGColorPicker || {};

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function hsvToRgba(h, s, v, a) {
    const { r, g, b } = hsvToRgb(h, s, v);
    const alpha = Math.round(a * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hsvToRgb(h, s, v) {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = 0, v = max;
    if (d !== 0) {
        s = d / max;
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s, v };
}

function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length === 8) h = h.slice(0, 6);
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHexAlpha(r, g, b, a) {
    const hex = rgbToHex(r, g, b);
    if (a >= 1) return hex;
    const aa = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
    return hex + aa;
}

function hsvToHsla(h, s, v, a) {
    const l = v * (1 - s / 2);
    const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
    return `hsla(${Math.round(h)}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%, ${Math.round(a * 100) / 100})`;
}

function parseCssColor(str) {
    if (!str) return null;
    const s = str.trim();

    if (s.startsWith('#')) {
        let hex = s.replace('#', '');
        let a = 1;
        if (hex.length === 8) {
            a = parseInt(hex.slice(6, 8), 16) / 255;
            hex = hex.slice(0, 6);
        }
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        if (hex.length !== 6) return null;
        const n = parseInt(hex, 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        return { ...rgbToHsv(r, g, b), a };
    }

    const rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (rgbMatch) {
        const r = clamp(+rgbMatch[1], 0, 255);
        const g = clamp(+rgbMatch[2], 0, 255);
        const b = clamp(+rgbMatch[3], 0, 255);
        const a = clamp(rgbMatch[4] !== undefined ? +rgbMatch[4] : 1, 0, 1);
        return { ...rgbToHsv(r, g, b), a };
    }

    const hslMatch = s.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/);
    if (hslMatch) {
        const h = clamp(+hslMatch[1], 0, 360);
        const sl = clamp(+hslMatch[2], 0, 100) / 100;
        const l  = clamp(+hslMatch[3], 0, 100) / 100;
        const a = clamp(hslMatch[4] !== undefined ? +hslMatch[4] : 1, 0, 1);
        const v = l + sl * Math.min(l, 1 - l);
        const sv = v === 0 ? 0 : 2 * (1 - l / v);
        return { h, s: sv, v, a };
    }

    return null;
}

function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'style' && typeof v === 'object') {
                Object.assign(node.style, v);
            } else if (k.startsWith('on') && typeof v === 'function') {
                node.addEventListener(k.slice(2).toLowerCase(), v);
            } else {
                node.setAttribute(k, v);
            }
        }
    }
    for (const child of children) {
        if (child == null) continue;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

/**
 * Creates a color picker widget.
 *
 * @param {object} options
 * @param {string}   options.value      Initial CSS color string.
 * @param {function} options.onChange   Called with CSS string on every change.
 * @param {boolean}  [options.disabled] If true, all controls are inert.
 * @returns {{ element: HTMLElement, setValue: function, destroy: function }}
 */
window.FGColorPicker.create = function(options) {
    const { value: initialValue = 'rgba(0, 0, 0, 1)', onChange, disabled = false } = options;

    let state = parseCssColor(initialValue) || { h: 0, s: 0, v: 0, a: 1 };
    let format = 'RGBA';
    let suppressTextUpdate = false;

    const uid = 'fg-cp-' + Math.random().toString(36).slice(2, 8);

    const CANVAS_W = 264;
    const CANVAS_H = 160;

    const thumbStyleEl = document.createElement('style');
    thumbStyleEl.setAttribute('data-fg-cp', uid);
    document.head.appendChild(thumbStyleEl);

    function setThumbStyles(hueColor, alphaColor) {
        thumbStyleEl.textContent = `
            [data-fg-cp-id="${uid}"] .fg-cp__slider--hue::-webkit-slider-thumb { background: ${hueColor} !important; }
            [data-fg-cp-id="${uid}"] .fg-cp__slider--hue::-moz-range-thumb     { background: ${hueColor} !important; }
            [data-fg-cp-id="${uid}"] .fg-cp__slider--alpha::-webkit-slider-thumb { background: ${alphaColor} !important; }
            [data-fg-cp-id="${uid}"] .fg-cp__slider--alpha::-moz-range-thumb     { background: ${alphaColor} !important; }
        `;
    }

    const canvas = el('canvas', {
        class: 'fg-cp__canvas',
        width: CANVAS_W,
        height: CANVAS_H,
    });
    const ctx = canvas.getContext('2d');
    const handleEl = el('div', { class: 'fg-cp__handle' });

    const canvasChecker = el('div', { class: 'fg-cp__canvas-checker' });
    const canvasWrap = el('div', { class: 'fg-cp__canvas-wrap' }, canvasChecker, canvas, handleEl);

    function drawCanvas() {
        const hueRgb = hsvToRgb(state.h, 1, 1);
        const hueStr = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
        const gradH = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
        gradH.addColorStop(0, '#fff');
        gradH.addColorStop(1, hueStr);
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const gradV = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        gradV.addColorStop(0, 'transparent');
        gradV.addColorStop(1, '#000');
        ctx.fillStyle = gradV;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    function syncCanvasAlpha() {
        canvas.style.opacity = state.a;
    }

    function positionHandle() {
        handleEl.style.left = (state.s * 100) + '%';
        handleEl.style.top  = ((1 - state.v) * 100) + '%';
    }

    function canvasRatioFromEvent(e) {
        const rect = canvasWrap.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            s: clamp((clientX - rect.left) / rect.width,  0, 1),
            v: clamp((clientY - rect.top)  / rect.height, 0, 1),
        };
    }

    function onCanvasDrag(e) {
        if (disabled) return;
        e.preventDefault();
        const { s, v } = canvasRatioFromEvent(e);
        // Preserve hue while dragging saturation/value; greyscale values lose hue in rgbToHsv.
        state.s = s;
        state.v = 1 - v;
        positionHandle();
        syncAll();
        emit();
    }

    function startCanvasDrag(e) {
        if (disabled) return;
        onCanvasDrag(e);
        const move = (ev) => onCanvasDrag(ev);
        const up   = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', up);
    }

    canvas.addEventListener('mousedown', startCanvasDrag);
    canvas.addEventListener('touchstart', startCanvasDrag, { passive: false });
    handleEl.addEventListener('mousedown', startCanvasDrag);
    handleEl.addEventListener('touchstart', startCanvasDrag, { passive: false });

    const hueSlider = el('input', {
        type: 'range',
        class: 'fg-cp__slider fg-cp__slider--hue',
        min: 0,
        max: 360,
        step: 1,
        value: Math.round(state.h),
        ...(disabled ? { disabled: '' } : {}),
    });

    hueSlider.addEventListener('input', () => {
        state.h = +hueSlider.value;
        drawCanvas();
        syncAll();
        emit();
    });

    const alphaTrack = el('div', { class: 'fg-cp__alpha-track' });
    const alphaSlider = el('input', {
        type: 'range',
        class: 'fg-cp__slider fg-cp__slider--alpha',
        min: 0,
        max: 100,
        step: 1,
        value: Math.round(state.a * 100),
        ...(disabled ? { disabled: '' } : {}),
    });
    const alphaWrap = el('div', { class: 'fg-cp__alpha-wrap' }, alphaTrack, alphaSlider);

    alphaSlider.addEventListener('input', () => {
        state.a = +alphaSlider.value / 100;
        syncAlphaTrack();
        syncAll();
        emit();
    });

    function syncAlphaTrack() {
        const { r, g, b } = hsvToRgb(state.h, state.s, state.v);
        alphaTrack.style.background =
            `linear-gradient(to right, rgba(${r},${g},${b},0), rgb(${r},${g},${b}))`;
        const hueRgb = hsvToRgb(state.h, 1, 1);
        const hueColor   = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
        const alphaColor = `rgba(${r}, ${g}, ${b}, ${Math.round(state.a * 100) / 100})`;
        setThumbStyles(hueColor, alphaColor);
    }

    const textInput = el('input', {
        type: 'text',
        class: 'fg-cp__text-input',
        spellcheck: 'false',
        autocomplete: 'off',
        ...(disabled ? { disabled: '' } : {}),
    });

    function buildFormatSwitcher() {
        const formats = ['HEX', 'RGBA', 'HSLA'];
        return el('div', { class: 'fg-cp__format-switcher' },
            ...formats.map(f =>
                el('button', {
                    type: 'button',
                    class: 'fg-cp__format-btn' + (f === format ? ' fg-cp__format-btn--active' : ''),
                    ...(disabled ? { disabled: '' } : {}),
                    onclick() {
                        format = f;
                        formatSwitcherEl.querySelectorAll('.fg-cp__format-btn').forEach(btn => {
                            btn.classList.toggle('fg-cp__format-btn--active', btn.textContent === format);
                        });
                        syncTextInput();
                    },
                }, f)
            )
        );
    }

    const formatSwitcherEl = buildFormatSwitcher();
    const textRow = el('div', { class: 'fg-cp__text-row' }, textInput, formatSwitcherEl);

    textInput.addEventListener('change', () => {
        const parsed = parseCssColor(textInput.value);
        if (parsed) {
            // Preserve the current hue when saturation is near zero — rgbToHsv
            // loses hue information for greys/whites (all channels equal).
            if (parsed.s < 0.01) parsed.h = state.h;
            state = parsed;
            drawCanvas();
            positionHandle();
            hueSlider.value = Math.round(state.h);
            alphaSlider.value = Math.round(state.a * 100);
            syncAlphaTrack();
            suppressTextUpdate = true;
            syncTextInput();
            suppressTextUpdate = false;
            emit();
        } else {
            syncTextInput();
        }
    });

    function syncTextInput() {
        if (suppressTextUpdate) return;
        const { r, g, b } = hsvToRgb(state.h, state.s, state.v);
        if (format === 'HEX') {
            textInput.value = rgbToHexAlpha(r, g, b, state.a);
        } else if (format === 'RGBA') {
            textInput.value = `rgba(${r}, ${g}, ${b}, ${Math.round(state.a * 100) / 100})`;
        } else {
            textInput.value = hsvToHsla(state.h, state.s, state.v, state.a);
        }
    }

    function syncAll() {
        syncTextInput();
        syncAlphaTrack();
        syncCanvasAlpha();
    }

    function emit() {
        if (typeof onChange !== 'function') return;
        onChange(hsvToRgba(state.h, state.s, state.v, state.a));
    }

    const buttonSlot = el('div', { class: 'fg-cp__button-slot' });

    const titleBar = el('div', { class: 'fg-cp__title-bar' },
        el('span', { class: 'fg-cp__title' }, 'Color Picker'),
        buttonSlot
    );

    const root = el('div', {
        class: 'fg-cp' + (disabled ? ' fg-cp--disabled' : ''),
        'data-fg-cp-id': uid,
    },
        titleBar,
        canvasWrap,
        el('div', { class: 'fg-cp__sliders' },
            hueSlider,
            alphaWrap,
        ),
        textRow,
    );

    drawCanvas();
    positionHandle();
    syncAll();

    function setValue(cssStr) {
        const parsed = parseCssColor(cssStr);
        if (!parsed) return;
        state = parsed;
        drawCanvas();
        positionHandle();
        hueSlider.value = Math.round(state.h);
        alphaSlider.value = Math.round(state.a * 100);
        syncAll();
    }

    function destroy() {
        root.remove();
        thumbStyleEl.remove();
    }

    return { element: root, setValue, destroy };
};
