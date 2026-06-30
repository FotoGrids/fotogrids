/**
 * Preview asset wiring.
 *
 * Reproduces the runtime conditions a real frontend page has, inside the
 * admin document (or block editor iframe). Consumes the JSON shape returned
 * by the Page Builders preview REST endpoints:
 *
 *   {
 *     html: string,
 *     assets: {
 *       css: { [handle: string]: href },
 *       js:  [{ handle, src, inline_before?, inline_after? }],
 *       localize: { fotogrids: {...} }
 *     }
 *   }
 *
 * Three groups of helpers, all module-scope so dedup state survives React
 * re-mounts:
 *
 *   1. ensurePreviewCssAssets(cssAssets)
 *      Each handle becomes a <link rel="stylesheet"> in document.head exactly
 *      once. Subsequent calls with the same handle are no-ops. Existing
 *      stylesheets with the same href are re-used rather than duplicated.
 *
 *   2. ensureScriptsSequenced(jsDescriptors, ownerDocument?)
 *      Each script loads in order. The 'before' inline payload is inserted
 *      BEFORE the external script (so any global it defines is available),
 *      the 'after' payload after the load event resolves. Subsequent calls
 *      with the same handle return the cached load promise.
 *
 *   3. injectPreviewHtml(container, html)
 *      Replaces container contents with the rendered HTML. innerHTML does
 *      not execute inline <script>s, so each script tag is cloned into a
 *      fresh element (which DOES execute) so per-gallery kickoff scripts
 *      run.
 *
 * The runtime's MutationObserver (window.FotoGrids.onGallery) picks up the
 * inserted `.fotogrids-collection` node and fires
 * `fotogrids:gallery_inserted`, letting every previously-loaded module wire
 * itself onto the new instance.
 *
 * Single source of truth for: the admin metabox gallery preview, the
 * Gutenberg block live preview, and future Elementor / Divi / Bricks
 * widgets.
 */

// ---------------------------------------------------------------------------
// Module-scope dedup registries
//
// These survive React unmounts and concurrent fetches. Multiple concurrent
// callers for the same handle share one in-flight load promise.
// ---------------------------------------------------------------------------

const loadedCssHandles = new Set();
const loadedJsHandles = new Map();        // handle -> Promise<void>
const appliedInlinePayloads = new Set();  // dedup key for inline before/after

/**
 * Ensures every CSS handle from the preview response has a <link> in the
 * document head. Subsequent calls with the same handle are no-ops.
 *
 * @param {Object<string, string>} cssAssets handle -> href map
 * @param {Document} [ownerDocument=document] document to inject into
 */
export const ensurePreviewCssAssets = (cssAssets, ownerDocument = document) => {
    if (!cssAssets || typeof cssAssets !== 'object') {
        return;
    }

    Object.entries(cssAssets).forEach(([handle, href]) => {
        if (!handle || typeof href !== 'string' || !href) {
            return;
        }
        if (loadedCssHandles.has(handle)) {
            return;
        }
        if (ownerDocument.querySelector(`link[data-fotogrids-preview-css="${handle}"]`)) {
            loadedCssHandles.add(handle);
            return;
        }
        const existingByHref = ownerDocument.querySelector(`link[rel="stylesheet"][href="${href}"]`);
        if (existingByHref) {
            existingByHref.setAttribute('data-fotogrids-preview-css', handle);
            loadedCssHandles.add(handle);
            return;
        }
        const link = ownerDocument.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-fotogrids-preview-css', handle);
        ownerDocument.head.appendChild(link);
        loadedCssHandles.add(handle);
    });
};

/**
 * Loads a single external JS handle and resolves once the script's load
 * event fires. Repeated calls for the same handle return the cached promise
 * so the script is only fetched once even when multiple previews are in
 * flight.
 *
 * @param {{ handle: string, src: string }} descriptor
 * @param {Document} ownerDocument
 * @return {Promise<void>}
 */
const ensureScript = (descriptor, ownerDocument) => {
    const { handle, src } = descriptor;
    if (!handle || !src) {
        return Promise.resolve();
    }
    if (loadedJsHandles.has(handle)) {
        return loadedJsHandles.get(handle);
    }

    const promise = new Promise((resolve) => {
        const existing = ownerDocument.querySelector(`script[data-fotogrids-preview-js="${handle}"]`);
        if (existing) {
            resolve();
            return;
        }
        const script = ownerDocument.createElement('script');
        script.src = src;
        script.async = false;  // preserve execution order
        script.setAttribute('data-fotogrids-preview-js', handle);
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => {
            // Resolve anyway - a broken module shouldn't block the rest of
            // the preview. The browser console will surface the network
            // error.
            resolve();
        });
        ownerDocument.head.appendChild(script);
    });

    loadedJsHandles.set(handle, promise);
    return promise;
};

/**
 * Injects an inline script payload exactly once per (handle, position)
 * pair. Used for the loading-icons map / drainer that the loading-icon
 * feature normally attaches via wp_add_inline_script() during wp_footer.
 *
 * @param {string} handle
 * @param {string} position 'before' or 'after'
 * @param {string} code
 * @param {Document} ownerDocument
 */
const ensureInlineScript = (handle, position, code, ownerDocument) => {
    if (!code) {
        return;
    }
    const key = `${handle}::${position}`;
    if (appliedInlinePayloads.has(key)) {
        return;
    }
    const script = ownerDocument.createElement('script');
    script.setAttribute('data-fotogrids-preview-inline', key);
    script.textContent = code;
    ownerDocument.head.appendChild(script);
    appliedInlinePayloads.add(key);
};

/**
 * Loads every JS descriptor returned by the preview endpoint, sequenced so
 * each script's load event resolves before the next one starts.
 *
 * Sequencing matters because module scripts depend on the runtime having
 * defined `window.FotoGrids`, and on the loading-icon main script being on
 * the page before the inline `before` payload (which calls into globals it
 * expects to have been registered).
 *
 * @param {Array<Object>} jsDescriptors
 * @param {Document} [ownerDocument=document] document to inject into
 */
export const ensureScriptsSequenced = async (jsDescriptors, ownerDocument = document) => {
    if (!Array.isArray(jsDescriptors)) {
        return;
    }
    for (const descriptor of jsDescriptors) {
        if (!descriptor || typeof descriptor !== 'object') {
            continue;
        }
        // Apply the inline 'before' payload BEFORE the external script so
        // any global it defines (e.g. window.fotogridsLoadingIcons) is
        // available when the main script executes.
        ensureInlineScript(descriptor.handle, 'before', descriptor.inline_before || '', ownerDocument);
        await ensureScript(descriptor, ownerDocument);
        ensureInlineScript(descriptor.handle, 'after', descriptor.inline_after || '', ownerDocument);
    }
};

/**
 * Inserts the rendered preview HTML into the container and re-runs any
 * inline <script> tags it contains. innerHTML does not execute scripts on
 * its own, so we replace each script element with a fresh clone - that path
 * does execute. The per-gallery loading-icon kickoff
 * (Loading_Icon::html_after) is the main consumer; without this step the
 * spinner never animates and the gallery appears stuck on loading.
 *
 * @param {HTMLElement} container
 * @param {string} html
 */
export const injectPreviewHtml = (container, html) => {
    container.innerHTML = '';
    if (!html) {
        return;
    }
    const template = container.ownerDocument.createElement('template');
    template.innerHTML = html;
    container.appendChild(template.content);

    const scripts = container.querySelectorAll('script');
    scripts.forEach((node) => {
        const replacement = container.ownerDocument.createElement('script');
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            replacement.setAttribute(attr.name, attr.value);
        }
        replacement.textContent = node.textContent;
        node.parentNode.replaceChild(replacement, node);
    });
};

/**
 * Convenience: wire up an entire preview response into a container.
 *
 * Order matters:
 *   1. Merge localize data into window.fotogrids BEFORE any module script
 *      runs, so sharing / lightbox / pagination see deep-link config and
 *      REST endpoints.
 *   2. Ensure CSS handles (idempotent).
 *   3. Sequence JS handles (idempotent).
 *   4. Inject the HTML last, so the MutationObserver only fires after every
 *      module is ready to bind itself.
 *
 * @param {HTMLElement} container - container to inject into.
 * @param {Object}      response  - parsed JSON response from the preview endpoint.
 * @param {Object}      [opts]
 * @param {Window}      [opts.ownerWindow=window] window where the localize merge happens.
 */
export const applyPreviewResponse = async (container, response, opts = {}) => {
    if (!container || !response) {
        return;
    }
    const ownerWindow = opts.ownerWindow || window;
    const ownerDocument = container.ownerDocument || document;

    const localize = response?.assets?.localize?.fotogrids;
    if (localize && typeof localize === 'object') {
        ownerWindow.fotogrids = Object.assign({}, ownerWindow.fotogrids || {}, localize);
    }

    ensurePreviewCssAssets(response?.assets?.css, ownerDocument);
    await ensureScriptsSequenced(response?.assets?.js, ownerDocument);

    injectPreviewHtml(container, response.html || '');
};
