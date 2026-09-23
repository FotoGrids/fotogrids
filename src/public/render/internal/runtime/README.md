# FotoGrids Frontend Runtime

The frontend runtime is the minimum amount of JavaScript that must be present
on any page rendering a FotoGrids gallery or album. It does **not** implement
any feature (no filters, no lightbox, no sharing, no masonry, no stats, no
password gate). Its sole job is to discover **collection** elements
(galleries and albums) and announce them so the per-feature modules can
attach to each one.

Each feature module is a peer of the render pipeline: each module's PHP
class declares its JS via `Module_Assets`, the JS subscribes to the runtime
once, and the runtime does the per-collection dispatch.

## Collections, galleries, albums

Every public-facing wrapper carries the umbrella class
`fotogrids-collection`. Exactly one discriminator class lives alongside it:

| Wrapper kind | Classes on the outer `<div>`             |
| ------------ | ---------------------------------------- |
| Gallery      | `fotogrids-collection fotogrids-gallery` |
| Album        | `fotogrids-collection fotogrids-album`   |

- `.fotogrids-collection` means "this is a FotoGrids wrapper of some kind."
- `.fotogrids-gallery` means "and it's specifically a gallery."
- `.fotogrids-album` means "and it's specifically an album."

The runtime discovery selector is `.fotogrids-collection`. The kind is
read from the discriminator class.

## Public API

The runtime exposes `window.FotoGrids` with these surfaces:

```js
// Subscribe to gallery initialization. Fires ONLY for gallery wrappers
// (.fotogrids-collection.fotogrids-gallery). For every gallery present
// at DOMContentLoaded AND for every gallery the MutationObserver picks
// up later (album-ajax loads, password-gate unlocks, third-party DOM
// injection). Lower priority runs first.
window.FotoGrids.onGallery((galleryElement) => {
	// wire your gallery-only feature here
}, 10);

// Subscribe to album initialization. Fires ONLY for album wrappers
// (.fotogrids-collection.fotogrids-album). Same replay-on-late-subscribe
// semantics as onGallery.
window.FotoGrids.onAlbum((albumElement) => {
	// wire your album-only feature here
}, 10);

// Subscribe to collection initialization. Fires for BOTH galleries and
// albums. Use this only when a module genuinely needs to run against
// both kinds. Most modules want onGallery or onAlbum instead.
window.FotoGrids.onCollection((collectionElement) => {
	// wire your collection-wide feature here
}, 10);

// Returns the current list of collection instances. Each record has
// { element, galleryId, kind } where kind is 'gallery' or 'album'.
window.FotoGrids.getInstances();

// Per-module registry. Each feature module registers itself here so
// other modules can coordinate (e.g. the lightbox calling into the
// sharing module to render a share bar in the toolbar).
window.FotoGrids.modules; // { sharing?, stats?, lazyLoad?, ... }

// The visitor's breakpoint ('desktop' | 'tablet' | 'mobile') under the
// site's configured breakpoints and detection mode.
window.FotoGrids.activeBreakpoint();

// A copy of the site's breakpoint configuration:
// { mobile: 767, tablet: 1024, detect: 'viewport' | 'device' }.
window.FotoGrids.getBreakpoints();

// Wraps declarations so they apply at a breakpoint and every narrower one.
// For modules that build CSS at runtime; mirrors Breakpoint_Config::scope().
window.FotoGrids.scopeCss('tablet', '.my-scope', '--my-var: 2;');

// Runtime version. Bumped if the contract changes.
window.FotoGrids.version;
```

## Breakpoints

Breakpoints are site-level (Settings → Responsiveness). `Render_Controller`
writes them onto every wrapper as `data-fg-breakpoints="<mobile> <tablet>"`
and `data-fg-breakpoint-detect="viewport|device"`; the runtime reads the first
wrapper it finds.

- **Viewport** detection classifies by window width, with the same
  `max-width` conditions as the server-emitted `@media` blocks.
- **Device** detection classifies the device: User-Agent Client Hints
  `mobile`, then a coarse primary pointer, then the short side of the screen.
  The runtime writes the result to `html[data-fg-breakpoint]`, and the
  server-emitted rules select on that attribute. Until the attribute is set,
  `max-width` fallbacks apply.

## Picking the right subscription

| Module scope                                                                                                                                                          | Use            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Only makes sense on galleries (Lightbox, Stats, Lazy_Load, Loading_Icon, Loaded_Effect, Sharing, Captions, Filter_Ui, Password_Gate, pagination, Deep_Linking)        | `onGallery`    |
| Only makes sense on albums (Album_To_Gallery_Ajax, click-behaviour decorators on album tiles)                                                                         | `onAlbum`      |
| Genuinely needs both (rare - Collection_Header is gallery-only because its current job is "show breadcrumbs back to the parent album"; the AJAX module is album-only) | `onCollection` |

## Events

The runtime dispatches two custom events on `document`. Both bubble.

| Event                           | When                                                                                                          | `event.detail`                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `fotogrids:gallery_inserted`    | A MutationObserver saw a `.fotogrids-collection` added to the DOM. Fired _before_ the runtime initializes it. | `{ galleryElement, galleryId, kind }`           |
| `fotogrids:gallery_initialized` | The runtime has fully initialized a collection and run every matching callback queue against it.              | `{ galleryElement, galleryId, kind, instance }` |

The runtime uses `MutationObserver` once (on `document.body`) and dispatches
these events. **Feature modules must not run their own DOM observers** - they
just call `FotoGrids.onGallery(cb)` / `onAlbum(cb)` / `onCollection(cb)` and
the same callback fires for static and dynamically-inserted collections.

## Module integration pattern

```js
// public/render/decorators/sharing/sharing.js  (illustrative)
(function () {
	'use strict';

	function attach(galleryElement) {
		// module's per-gallery logic
	}

	function init() {
		if (
			!window.FotoGrids ||
			typeof window.FotoGrids.onGallery !== 'function'
		) {
			// runtime not loaded - should never happen if PHP declared
			// the dependency correctly, but degrade gracefully.
			return;
		}
		window.FotoGrids.onGallery(attach, 10);

		// Expose any cross-module API your module offers.
		window.FotoGrids.modules.sharing = {
			renderShareBar: renderShareBar,
		};
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
```

## What the runtime does NOT do

- It does not read per-collection settings, only the site-level breakpoint
  configuration. Settings come from each module's
  own `wp_localize_script` payload, or from `data-*` attributes the
  module's PHP class writes onto the wrapper.
- It does not call `fetch()` to the REST API. Stats tracking lives in
  the Stats feature module.
- It does not handle clicks. Click behaviour lives in click-behaviour
  decorators (Lightbox, Direct_Link, External_Link, Album_To_View_Page,
  Album_To_Gallery_Ajax).
- It does not inject CSS. All styles live in module CSS files.

If a piece of code feels like it belongs in the runtime but isn't on this
short list, it almost certainly belongs in a feature module instead.

## Asset registration

The runtime is loaded as a regular render-pipeline asset, via the
`Runtime_Bootstrap` feature module (`public/render/internal/runtime/class-runtime-bootstrap.php`).
That module's `supports()` always returns true, so the runtime is enqueued
exactly when any collection renders.
