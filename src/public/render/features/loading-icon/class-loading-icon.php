<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Loading_Icon;

use FotoGrids\Hooks\Actions_Render;
use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Loading Icon feature module.
 *
 * Responsible for:
 *
 * 1. Emitting window.fotogridsLoadingIcon = { name, svg, animate } as a
 *    plain inline <script> in the page body, immediately after the first
 *    gallery wrapper (via html_after). This runs synchronously as the
 *    browser parses the page - before any images finish loading from cache
 *    and before DOMContentLoaded - so the global is always available when
 *    the per-gallery animate calls immediately follow in the same script.
 *
 *    `animate` is a raw WAAPI function (pre-built from loading-icons-waapi.json
 *    at build time). It accepts an SVG element and returns an array of
 *    Animation / rAF-cancel handles.
 *
 *    The same global is also registered via wp_add_inline_script (footer)
 *    for JS-built surfaces that need it after the page load - lightbox
 *    spinner, AJAX-loaded album items.
 *
 * 2. Writing data-fg-loading-icon="{icon_name}" on the gallery wrapper so
 *    JS can read which icon is active if needed.
 *
 * 3. Providing the --fg-loader-color CSS variable so gallery owners can tint
 *    the spinner via settings.
 *
 * 4. Starting WAAPI animations on all loader SVGs inside each gallery via
 *    an inline <script> in html_after, scoped to that gallery's instance ID.
 *    loading-icon.js (footer) handles state: it cancels animations and sets
 *    data-fg-media-state="loaded" when images settle.
 *
 * __FG_ID__ placeholder
 * ----------------------
 * The icon SVGs use __FG_ID__ as a placeholder for unique ID suffixes so
 * gradient / clipPath IDs don't collide across items. Item_Renderer replaces
 * it per item; the global svg template leaves it raw so JS can replace it
 * when injecting dynamically (lightbox spinner, AJAX items).
 *
 * @package FotoGrids\Render\Features\Loading_Icon
 * @since   1.0.0
 */
final class Loading_Icon implements Feature {

	/**
	 * Default icon name when no setting is configured.
	 *
	 * @since 1.0.0
	 */
	private const DEFAULT_ICON = '12-dots';

	/**
	 * Whether wp_add_inline_script has been scheduled for the footer.
	 *
	 * @since 1.0.0
	 * @var bool
	 */
	private static bool $footer_scheduled = false;

	/**
	 * Distinct icon names used by galleries on this page, in encounter order.
	 *
	 * Populated by assets() as each gallery is rendered. The footer action
	 * reads this to build the full icons map.
	 *
	 * @since 1.0.0
	 * @var array<string, true>
	 */
	private static array $icon_names_seen = array();

	public function id(): string {
		return 'fotogrids/loading-icon';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * Always active - every gallery shows a loader while images are fetched.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function supports( Render_Context $render_context ): bool {
		return true;
	}

	/**
	 * No markup before the layout content.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * No extra markup appended inside the gallery wrapper.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Emits a tiny inline <script> immediately after each gallery wrapper.
	 *
	 * Two responsibilities, both timing-critical:
	 *
	 *  1. Push the gallery's instance ID onto window.fgAnimQueue for the
	 *     footer drain. This is kept as a fallback path for galleries that
	 *     somehow don't get processed inline (defensive only).
	 *
	 *  2. Start the WAAPI loader animations on every .fg-item-loader svg
	 *     inside this gallery, RIGHT NOW, while the parser is still walking
	 *     the page body. This guarantees the animation has a head start
	 *     before any image's load event fires.
	 *
	 *     The previous design queued IDs here and ran animate() in the
	 *     footer. That left a fatal gap on fast networks/cached images:
	 *     by footer time, img.complete was already true, so loading-icon.js
	 *     called markLoaded() immediately, which cancelled the animation
	 *     before it ever became visible. Starting animations here closes
	 *     that window - the animation is already running at the moment
	 *     loading-icon.js wires its load listener.
	 *
	 *     If window.fotogridsLoadingIcons isn't defined yet (footer global
	 *     hasn't run), we fall back to the queue-only path. In practice
	 *     this happens for the very first gallery on a page when the global
	 *     script lands later, hence the dual approach.
	 *
	 * The script contains no JS operators that wptexturize could mangle
	 * outside of string literals.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_after( Render_Context $render_context ): string {
		$instance_id = $render_context->meta->instance_id;
		$id_json     = wp_json_encode( $instance_id );

		// Record this icon so the footer drainer's build_global_js() picks it
		// up. assets() also records it (belt-and-braces), but assets() runs
		// after html_after() and only when the pipeline reaches it.
		$this_icon                           = $this->resolve_icon_name( $render_context );
		self::$icon_names_seen[ $this_icon ] = true;

		// Per-collection inline runner. Runs synchronously as the parser
		// passes the wrapper. Two important constraints govern the script
		// body below:
		//
		//  1. It is emitted into the_content output, which means WordPress
		//     filters (convert_chars, wpautop, block normalizers, kses on
		//     re-saved posts) may HTML-encode any &, &&, <, or > literals
		//     inside it. We MUST therefore avoid those characters and we
		//     MUST NOT interpolate JS source that contains them (the icon
		//     animate functions DO contain `&&` and `<`, so they cannot
		//     appear here - they live in the footer global instead, which
		//     ships via wp_add_inline_script and bypasses the_content).
		//
		//  2. Even with the global not yet defined, the script still does
		//     useful work: it queues the collection ID onto fgAnimQueue,
		//     which the footer drainer reads to start animations for every
		//     collection on the page. On a healthy page the global may
		//     already be present (footer-printed-in-head extension, second
		//     collection on the page after the global painted) and the
		//     inline runner starts the animation immediately.
		//
		// Banned characters below: & (and any operator built from it: &&,
		// &amp;), < and > (other than the script tag bracket itself).
		// `||` and `|` are safe - pipes are not HTML-special.
		return '<script>'
			. '(function(id){'
			. 'if(!window.fgLoaderHandles){window.fgLoaderHandles=new WeakMap();}'
			. 'if(!window.fgAnimQueue){window.fgAnimQueue=[];}'
			. 'window.fgAnimQueue.push(id);'
			. 'var icons=window.fotogridsLoadingIcons;'
			. 'if(!icons){return;}'
			. 'var g=document.getElementById(id);'
			. 'if(!g){return;}'
			. 'var iconName=g.getAttribute("data-fg-loading-icon")||"";'
			. 'var icon=icons[iconName];'
			. 'if(!icon){icon=icons[Object.keys(icons)[0]];}'
			. 'if(!icon){return;}'
			. 'if(typeof icon.animate!=="function"){return;}'
			. 'g.querySelectorAll(".fg-item").forEach(function(item){'
			. 'if(window.fgLoaderHandles.has(item)){return;}'
			. 'var svg=item.querySelector(".fg-item-loader svg");'
			. 'if(!svg){return;}'
			. 'try{'
			. 'var h=icon.animate(svg);'
			. 'window.fgLoaderHandles.set(item,Array.isArray(h)?h:[]);'
			. '}catch(e){}'
			. '});'
			. '})(' . $id_json . ');'
			. '</script>';
	}

	/**
	 * Writes data-fg-loading-icon onto the gallery wrapper.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array(
			'data-fg-loading-icon' => $this->resolve_icon_name( $render_context ),
		);
	}

	/**
	 * Provides --fg-loader-color from the loading_icon_color setting.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function style_vars( Render_Context $render_context ): array {
		$color = $render_context->settings['loading_icon_color'] ?? '';

		if ( ! is_string( $color ) || '' === $color ) {
			return array();
		}

		return array(
			'--fg-loader-color' => $color,
		);
	}

	/**
	 * Declares the loading-icon JS and CSS assets and schedules the footer
	 * global for JS-built surfaces (lightbox spinner, AJAX album items).
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		// Accumulate distinct icon names; footer action reads this later.
		$icon_name                           = $this->resolve_icon_name( $render_context );
		self::$icon_names_seen[ $icon_name ] = true;

		$this->maybe_schedule_footer_global();

		return new Module_Assets(
			array(
				'fotogrids-loading-icon' => new Asset_Decl(
					'../../assets/css/loading-icon-styles.css',
					array(),
					false,
				),
			),
			array(
				'fotogrids-loading-icon' => new Asset_Decl(
					'../../assets/js/loading-icon.js',
					array(),
					true,
				),
			)
		);
	}

	/**
	 * Resolves the icon name from settings, falling back to the default.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	private function resolve_icon_name( Render_Context $render_context ): string {
		$icon = $render_context->settings['loading_icon'] ?? '';
		return ( is_string( $icon ) && '' !== $icon ) ? $icon : self::DEFAULT_ICON;
	}

	/**
	 * Builds JS that defines window.fotogridsLoadingIcons - a map of all icon
	 * names used on this page, each with its svg template and WAAPI animate fn.
	 *
	 * Also sets window.fotogridsLoadingIcon to the first / default icon for
	 * backwards compatibility with lightbox.js which reads that single-icon form.
	 *
	 * @since   1.0.0
	 * @param   array<string, true> $icon_names_seen Distinct icon names to include.
	 * @return  string Raw JS (no <script> tags).
	 */
	private static function build_global_js( array $icon_names_seen ): string {
		$entries = array();
		$first   = null;

		foreach ( array_keys( $icon_names_seen ) as $icon_name ) {
			$svg        = \FotoGrids\Assets\Loading_Icon_Library::svg( $icon_name, '' );
			$animate_fn = \FotoGrids\Assets\Loading_Icon_Library::animate_fn( $icon_name );
			if ( '' === $animate_fn ) {
				$animate_fn = 'function animate(){return [];}';
			}

			$entries[] = sprintf(
				'%s:{svg:%s,animate:%s}',
				wp_json_encode( $icon_name ),
				wp_json_encode( $svg ),
				$animate_fn
			);

			if ( null === $first ) {
				$first = $icon_name;
			}
		}

		$map_js = 'window.fotogridsLoadingIcons={' . implode( ',', $entries ) . '};';

		// Keep window.fotogridsLoadingIcon pointing at the first icon for
		// lightbox.js and other callers that use the single-icon API.
		$default_js = '';
		if ( null !== $first ) {
			$svg        = \FotoGrids\Assets\Loading_Icon_Library::svg( $first, '' );
			$animate_fn = \FotoGrids\Assets\Loading_Icon_Library::animate_fn( $first );
			if ( '' === $animate_fn ) {
				$animate_fn = 'function animate(){return [];}';
			}
			$default_js = sprintf(
				'window.fotogridsLoadingIcon={name:%s,svg:%s,animate:%s};',
				wp_json_encode( $first ),
				wp_json_encode( $svg ),
				$animate_fn
			);
		}

		return $map_js . $default_js;
	}

	/**
	 * Schedules the footer global + queue drainer via wp_add_inline_script.
	 *
	 * wp_add_inline_script bypasses the_content filters (wptexturize etc.) so
	 * the full animate function - which contains &&, <, > - is emitted safely.
	 *
	 * The script:
	 *  1. Defines window.fotogridsLoadingIcon = { name, svg, animate }.
	 *  2. Drains window.fgAnimQueue: for each queued gallery instance ID,
	 *     finds its loader SVGs and calls animate() on each, storing handles
	 *     in window.fgLoaderHandles for loading-icon.js to cancel on load.
	 *
	 * The queue is populated by the tiny per-gallery inline scripts in
	 * html_after() as the page body is parsed, so every gallery is processed
	 * in order as soon as this footer script runs.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  void
	 */
	private function maybe_schedule_footer_global(): void {
		if ( self::$footer_scheduled ) {
			return;
		}

		self::$footer_scheduled = true;

		// Footer drain - defensive fallback for any gallery whose
		// per-gallery inline script bailed (e.g. unexpected DOM state).
		// On a healthy page this is a no-op because every item already
		// has handles set via the inline runner. Skips already-cached
		// images so we don't start an animation only to cancel it in
		// the same frame.
		//
		// The drain runs as a chunked rAF loop instead of one big
		// synchronous pass. Two reasons:
		//   1. icon.animate(svg) attaches a WAAPI animation AND an rAF
		//      attribute interpolator (fgAnimAttr). Starting N of those
		//      in one synchronous loop pins the main thread on the very
		//      first frame, which queues image load events behind the
		//      backlog and visibly batches every gallery's reveals.
		//   2. The same blocking loop is why initial loader animations
		//      don't visibly run - the browser never gets a paint
		//      between animate() and the loading-icon.js wireGallery
		//      cancel pass for already-cached images.
		// We process up to FG_DRAIN_BATCH items per animation frame so
		// the browser can paint between batches.
		$drain_js = '(function(){'
			. 'var icons=window.fotogridsLoadingIcons||{};'
			. 'var q=window.fgAnimQueue||[];'
			. 'if(!window.fgLoaderHandles)window.fgLoaderHandles=new WeakMap();'
			. 'var pending=[];'
			// Collect every (gallery, item, icon) tuple to process - cheap
			// pass, no animate() calls yet.
			. 'for(var i=0;i<q.length;i++){'
			. 'var g=document.getElementById(q[i]);'
			. 'if(!g)continue;'
			. 'var iconName=g.getAttribute("data-fg-loading-icon")||"";'
			. 'var icon=icons[iconName]||icons[Object.keys(icons)[0]];'
			. 'if(!icon||typeof icon.animate!=="function")continue;'
			. 'var items=g.querySelectorAll(".fg-item");'
			. 'for(var j=0;j<items.length;j++){'
			. 'pending.push({item:items[j],icon:icon});'
			. '}'
			. '}'
			// Drain pending in small rAF batches so each animate() call has
			// breathing room to paint. BATCH of 4 keeps a 60-item gallery
			// wired up in ~15 frames (~250ms) while still streaming.
			. 'var BATCH=4;var pos=0;'
			. 'function step(){'
			. 'var end=Math.min(pos+BATCH,pending.length);'
			. 'for(;pos<end;pos++){'
			. 'var item=pending[pos].item;'
			. 'var icon=pending[pos].icon;'
			. 'if(window.fgLoaderHandles.has(item))continue;'
			. 'var img=item.querySelector(".fg-item-media img");'
			. 'if(img && img.complete && img.naturalWidth > 0){'
			. 'window.fgLoaderHandles.set(item,[]);'
			. 'continue;'
			. '}'
			. 'var svg=item.querySelector(".fg-item-loader svg");'
			. 'if(!svg)continue;'
			. 'try{'
			. 'var h=icon.animate(svg);'
			. 'window.fgLoaderHandles.set(item,Array.isArray(h)?h:[]);'
			. '}catch(e){}'
			. '}'
			. 'if(pos<pending.length){'
			. '(window.requestAnimationFrame||function(f){setTimeout(f,16);})(step);'
			. '}'
			. '}'
			. 'if(pending.length){'
			. '(window.requestAnimationFrame||function(f){setTimeout(f,16);})(step);'
			. '}'
			. '})();';

		// Defensive footer drain - catches any galleries whose per-gallery
		// inline script bailed (e.g. unexpected DOM/JS state). On a healthy
		// page this is a no-op because all items already have handles set.
		//
		// Also hooks `fotogrids/render/late_assets`, fired by the admin
		// preview endpoint after the render completes. wp_footer never fires
		// inside a REST request, so without this second hook the loading
		// icons map (window.fotogridsLoadingIcons) is never published to the
		// preview document and every item stays stuck on its spinner.
		$publish_inline = static function () use ( $drain_js ): void {
			$global_js = self::build_global_js( self::$icon_names_seen );
			$inline    = $global_js . $drain_js;
			wp_add_inline_script( 'fotogrids-loading-icon', $inline, 'before' );
		};

		add_action( 'wp_footer', $publish_inline, 10 );
		add_action( Actions_Render::LATE_ASSETS, $publish_inline, 10 );
	}

	/**
	 * Resets per-request static state for tests.
	 *
	 * @since   1.0.0
	 * @return  void
	 */
	public static function reset_for_tests(): void {
		self::$footer_scheduled = false;
		self::$icon_names_seen  = array();
	}
}
