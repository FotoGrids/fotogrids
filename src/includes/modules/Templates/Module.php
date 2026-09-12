<?php
namespace FotoGrids\Modules\Templates;

use FotoGrids\Hooks\Filters_Templates;
use FotoGrids\Modules\Abstract_Module;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Templates Module
 *
 * Fully self-contained Free templates feature. The module owns:
 *   - REST routes        (FotoGrids\REST\Templates\Register_Templates_Routes)
 *   - the editor metabox (register + render + localize + assets)
 *   - the admin page     (render container + assets; menu stays in Admin_Init)
 *   - its own assets      (co-located under assets/, built by module-* webpack
 *                          entries into assets/templates-metabox.{js,css} and
 *                          assets/templates-page.{js,css})
 *
 * Pattern C (Free shell + Pro engine): the Free shell renders everything,
 * including the Save-as-Template slot. Pro supplies the save engine via the
 * fotogrids/templates/save_as_template_button filter, returning a JS component
 * id registered on window.fotogridsProComponents before the metabox renders.
 *
 * @since 1.0.0
 */
class Module extends Abstract_Module {

	/**
	 * Admin page hook suffix for the Templates page. Used to scope enqueues.
	 *
	 * @var string
	 */
	private const PAGE_HOOK = 'fotogrids_page_fotogrids-templates';

	/**
	 * Tab icon markup, copied from `assets/admin/plain/icons.js` (`layout_3x3`)
	 * because that library is JavaScript-only and the placeholder renders
	 * before it loads.
	 */
	private const ICON_LAYOUT_3X3 = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="3" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="3" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="10" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="10" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="17" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="17" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="17" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/></svg>';

	/**
	 * Info-list icon markup, copied from `assets/admin/plain/icons.js`
	 * (`check_circle`) for the same reason.
	 */
	private const ICON_CHECK_CIRCLE = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 12L10.5 15L16.5 9M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

	public function get_id(): string {
		return 'templates';
	}

	public function get_name(): string {
		return __( 'Templates', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Apply ready-made designs to galleries and albums.', 'fotogrids' );
	}

	/**
	 * Admin (metabox + page) and REST (route registration). Never frontend.
	 */
	public function get_contexts(): array {
		return array( 'admin', 'rest' );
	}

	/**
	 * Wire up REST routes and the editor metabox. Asset enqueueing is handled
	 * centrally by Module_Registry::enqueue_all() -> enqueue_assets().
	 */
	public function init(): void {
		// REST routes self-register on rest_api_init so module boot timing is
		// decoupled from REST timing.
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );

		// Editor metabox for both galleries and albums.
		add_action( 'add_meta_boxes', array( $this, 'register_metabox' ) );
	}

	// -------------------------------------------------------------------------
	// REST
	// -------------------------------------------------------------------------

	/**
	 * Register the templates REST routes.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function register_rest_routes(): void {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/templates-permissions.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/templates-data.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/class-templates-catalog.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/register-templates-routes.php';

		\FotoGrids\REST\Templates\Register_Templates_Routes::register();
	}

	// -------------------------------------------------------------------------
	// Metabox
	// -------------------------------------------------------------------------

	/**
	 * Register the Templates metabox on both CPTs.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function register_metabox(): void {
		global $post;

		foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
			// Templates are settings (applying overrides every setting). Same
			// visibility rule as the Collection Settings metabox.
			$settings_cap = \FotoGrids\Permissions\Permission_Gate::settings_cap_for( $post_type );
			$post_id      = ( $post instanceof \WP_Post && $post->post_type === $post_type ) ? (int) $post->ID : 0;
			$can_settings = null === $settings_cap
				|| ( $post_id > 0
					? \FotoGrids\Permissions\Permission_Check::can( $settings_cap, $post_id )
					: \FotoGrids\Permissions\Permission_Check::can( $settings_cap ) );

			if ( ! $can_settings && \FotoGrids\Permissions\Permission_Options::get_unauthorised_visibility() === 'hidden' ) {
				continue;
			}

			add_meta_box(
				$post_type . '_templates',
				__( 'Templates', 'fotogrids' ),
				array( $this, 'render_metabox' ),
				$post_type,
				'side',
				'default'
			);
		}
	}

	/**
	 * Render the Templates metabox container and localize its data.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post The post being edited.
	 * @return void
	 */
	public function render_metabox( $post ): void {
		$post_type = 'fotogrids_gallery' === $post->post_type ? 'gallery' : 'album';

		/**
		 * Save-as-Template button component id. Pro returns its component id
		 * here; Free leaves it null and the shell renders the upgrade CTA.
		 *
		 * @since 1.0.0
		 * @param string|null $component_id
		 * @param \WP_Post    $post
		 */
		$save_as_template_button = apply_filters(
			Filters_Templates::SAVE_AS_TEMPLATE_BUTTON,
			null,
			$post
		);

		$settings_cap = \FotoGrids\Permissions\Permission_Gate::settings_cap_for( $post->post_type );
		$editable     = null === $settings_cap
			|| \FotoGrids\Permissions\Permission_Check::can( $settings_cap, (int) $post->ID );

		wp_localize_script(
			'fotogrids-module-templates-metabox',
			'fotogridsTemplatesMetabox',
			array(
				'postId'               => $post->ID,
				'postType'             => $post_type,
				'isPro'                => \FotoGrids\License_Manager::has_pro(),
				'nonce'                => wp_create_nonce( 'wp_rest' ),
				'restUrl'              => 'fotogrids/v1/',
				'templatesUrl'         => admin_url( 'admin.php?page=fotogrids-templates' ),
				'saveAsTemplateButton' => $save_as_template_button,
				'editable'             => $editable,
				'unauthorisedNotice'   => __( 'You\'re viewing templates in read-only mode. Ask a site administrator if a different template should be applied.', 'fotogrids' ),
				'strings'              => $this->metabox_strings(),
			)
		);
		?>
		<div id="fotogrids-templates-metabox"></div>
		<?php
	}

	// -------------------------------------------------------------------------
	// Admin page
	// -------------------------------------------------------------------------

	/**
	 * Render the Templates admin page container. The menu item is registered
	 * by Admin_Init; this emits the React mount point and the same page chrome
	 * (header + container class) the shared admin renderer used, so appearance
	 * and any styles targeting .fotogrids-admin-page are preserved.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function render_page(): void {
		?>
		<div class="wrap">
			<div class="fotogrids-page-header">
				<h1 class="fotogrids-heading-inline">
					<?php echo esc_html( get_admin_page_title() ); ?>
				</h1>
			</div>
			<div id="fotogrids-templates-page" class="fotogrids-admin-page">
				<?php $this->render_page_placeholder(); ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Render the page chrome the React tree mounts over.
	 *
	 * The page bundle is enqueued in the footer, so without this the screen is
	 * empty until the bundle has downloaded, parsed and mounted - the longest
	 * part of the wait on a slow connection. Everything except the template
	 * grid is server-rendered here and replaced by the equivalent React markup
	 * on mount; the grid area carries the loading indicator until the catalog
	 * request resolves.
	 *
	 * Mirrors the chrome in `assets/admin/src/components/pages/TemplatesPage.jsx`
	 * - the two must be changed together.
	 *
	 * @since 1.1.1
	 * @return void
	 */
	private function render_page_placeholder(): void {
		?>
		<div class="fotogrids-templates-page fotogrids-templates-page--placeholder">
			<?php $this->render_placeholder_info(); ?>

			<div class="fotogrids-templates-page__main">
				<div class="fotogrids-templates-page__header">
					<div class="fotogrids-templates-page__tabs">
						<button type="button" class="fotogrids-templates-page__tab fg-is-active">
							<span class="fotogrids-templates-page__tab__icon">
								<span class="fotogrids-icon fotogrids-icon--layout_3x3"><?php echo self::ICON_LAYOUT_3X3; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Class constant holding static SVG markup. ?></span>
							</span>
							<span class="fotogrids-templates-page__tab__label">
								<?php esc_html_e( 'Gallery Templates', 'fotogrids' ); ?>
							</span>
						</button>
					</div>

					<div class="fotogrids-templates-page__types">
						<?php
						$this->render_placeholder_checkbox(
							__( 'Your Templates', 'fotogrids' ),
							false,
							! \FotoGrids\License_Manager::has_pro()
						);
						$this->render_placeholder_checkbox(
							__( 'FotoGrids Templates', 'fotogrids' ),
							true,
							false
						);
						?>
					</div>
				</div>

				<div class="fotogrids-templates-page__content">
					<?php \FotoGrids\Admin\Loading_Indicator::render( __( 'Loading templates', 'fotogrids' ) ); ?>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Render the "What are Templates?" column of the placeholder chrome.
	 *
	 * Shown to free installations only, matching the React tree.
	 *
	 * @since 1.1.1
	 * @return void
	 */
	private function render_placeholder_info(): void {
		if ( \FotoGrids\License_Manager::has_pro() ) {
			return;
		}

		$items = array(
			array(
				'title'       => __( 'Save valuable time', 'fotogrids' ),
				'description' => __( 'Launch new galleries in minutes using ready-made layouts instead of rebuilding designs from scratch.', 'fotogrids' ),
				'pro'         => false,
			),
			array(
				'title'       => __( 'Keep every gallery on-brand', 'fotogrids' ),
				'description' => __( 'Apply the same spacing, colors and interactions across multiple galleries and albums with one click.', 'fotogrids' ),
				'pro'         => false,
			),
			array(
				'title'       => __( 'Create your own templates', 'fotogrids' ),
				'description' => __( 'Turn your best-performing gallery and album designs into reusable templates that your whole team can apply in a few clicks.', 'fotogrids' ),
				'pro'         => true,
			),
		);
		?>
		<aside class="fotogrids-templates-page__info">
			<h2><?php esc_html_e( 'What are Templates?', 'fotogrids' ); ?></h2>
			<p><?php esc_html_e( 'Templates are complete, ready-to-use gallery and album configurations.', 'fotogrids' ); ?></p>
			<p><?php esc_html_e( 'Templates bundle layout, spacing, hover effects and styling into reusable presets that you can apply in one click.', 'fotogrids' ); ?></p>

			<ul class="fotogrids-templates-page__info-list">
				<?php foreach ( $items as $item ) : ?>
					<li class="fotogrids-templates-page__info-item <?php echo $item['pro'] ? 'fotogrids-templates-page__info-item--pro' : ''; ?>">
						<div class="fotogrids-templates-page__info-item__heading">
							<span class="fotogrids-icon fotogrids-icon--check_circle"><?php echo self::ICON_CHECK_CIRCLE; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Class constant holding static SVG markup. ?></span>
							<h5>
								<?php echo esc_html( $item['title'] ); ?>
								<?php if ( $item['pro'] ) : ?>
									<span class="fotogrids-pro-badge"><?php esc_html_e( 'Pro', 'fotogrids' ); ?></span>
								<?php endif; ?>
							</h5>
						</div>
						<p><?php echo esc_html( $item['description'] ); ?></p>
					</li>
				<?php endforeach; ?>
			</ul>
		</aside>
		<?php
	}

	/**
	 * Render one checkbox of the placeholder chrome.
	 *
	 * Markup matches `components/shared/Checkbox.jsx` so the control does not
	 * change appearance when React takes over.
	 *
	 * @since 1.1.1
	 * @param string $label    Visible label.
	 * @param bool   $checked  Whether the box is ticked.
	 * @param bool   $disabled Whether the control is disabled.
	 * @return void
	 */
	private function render_placeholder_checkbox( string $label, bool $checked, bool $disabled ): void {
		$classes = 'fg-checkbox fg-checkbox--size-md';
		if ( $checked ) {
			$classes .= ' fg-checkbox--checked';
		}
		if ( $disabled ) {
			$classes .= ' fg-checkbox--disabled';
		}
		?>
		<div class="fg-checkbox__wrapper">
			<label class="<?php echo esc_attr( $classes ); ?>">
				<span class="fg-checkbox__control">
					<input type="checkbox" class="fg-checkbox__input" <?php checked( $checked ); ?> <?php disabled( $disabled ); ?> />
					<span class="fg-checkbox__box" aria-hidden="true">
						<svg class="fg-checkbox__check" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
							<path class="fg-checkbox__check-path" d="M3.5 8.5l3 3 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							<path class="fg-checkbox__dash-path" d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
					</span>
				</span>
				<span class="fg-checkbox__label"><?php echo esc_html( $label ); ?></span>
			</label>
		</div>
		<?php
	}

	// -------------------------------------------------------------------------
	// Assets
	// -------------------------------------------------------------------------

	/**
	 * Enqueue the module's metabox and page assets, each guarded to its screen.
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_assets( string $hook ): void {
		$this->maybe_enqueue_metabox( $hook );
		$this->maybe_enqueue_page( $hook );
	}

	/**
	 * Enqueue metabox assets on the gallery/album edit screens only.
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	private function maybe_enqueue_metabox( string $hook ): void {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! in_array( $screen->post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
			return;
		}

		wp_enqueue_script(
			'fotogrids-module-templates-metabox',
			$this->module_asset_url( 'assets/templates-metabox.js' ),
			array( 'wp-element', 'wp-api-fetch', 'wp-i18n' ),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_style(
			'fotogrids-module-templates-metabox',
			$this->module_asset_url( 'assets/templates-metabox.css' ),
			array(),
			FOTOGRIDS_VERSION
		);

		// Frontend CSS is used to render template previews inside the metabox.
		wp_enqueue_style(
			'fotogrids-frontend',
			FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
			array(),
			FOTOGRIDS_VERSION
		);
	}

	/**
	 * Enqueue admin-page assets on the Templates page only.
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	private function maybe_enqueue_page( string $hook ): void {
		if ( self::PAGE_HOOK !== $hook ) {
			return;
		}

		// Depend on fotogrids-admin so the shared admin runtime + design-system
		// CSS load alongside the page bundle (parity with how Tools depend on
		// it). Admin_Init enqueues fotogrids-admin at priority 10; this runs at
		// 20, so the dependency resolves.
		wp_enqueue_script(
			'fotogrids-module-templates-page',
			$this->module_asset_url( 'assets/templates-page.js' ),
			array( 'wp-element', 'wp-api-fetch', 'wp-i18n', 'fotogrids-admin' ),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_style(
			'fotogrids-module-templates-page',
			$this->module_asset_url( 'assets/templates-page.css' ),
			array( 'fotogrids-admin' ),
			FOTOGRIDS_VERSION
		);
	}

	// -------------------------------------------------------------------------
	// Strings
	// -------------------------------------------------------------------------

	/**
	 * Translated strings passed to the metabox React tree.
	 *
	 * @since 1.0.0
	 * @return array<string,string>
	 */
	private function metabox_strings(): array {
		return array(
			'selectTemplate'             => __( 'Select Template', 'fotogrids' ),
			'saveAsTemplate'             => __( 'Save current settings as Template', 'fotogrids' ),
			'applyTemplate'              => __( 'Apply Template', 'fotogrids' ),
			'templatesNoticeDescription' => __( 'Apply beautiful, ready-to-use designs to your galleries and albums instantly. Browse the Templates Library to explore what\'s available.', 'fotogrids' ),
			'proSaveDescriptionGallery'  => __( 'With a {pro_badge} license, you will be able to save the current gallery settings as a reusable template and apply it across multiple galleries.', 'fotogrids' ),
			'proSaveDescriptionAlbum'    => __( 'With a {pro_badge} license, you will be able to save the current album settings as a reusable template and apply it across multiple albums.', 'fotogrids' ),
			'dismiss'                    => __( 'Dismiss', 'fotogrids' ),
			'upgradeToPro'               => __( 'Upgrade to Pro', 'fotogrids' ),
			'loading'                    => __( 'Loading templates', 'fotogrids' ),
			'noTemplates'                => __( 'No templates available', 'fotogrids' ),
			'templateApplied'            => __( 'Template applied successfully', 'fotogrids' ),
			'templateSaved'              => __( 'Template saved successfully', 'fotogrids' ),
			'confirmApplyTitle'          => __( 'Override existing settings?', 'fotogrids' ),
			'confirmApply'               => __( 'This will override your current settings. Are you sure?', 'fotogrids' ),
			'templateName'               => __( 'Template Name', 'fotogrids' ),
			'templateDescription'        => __( 'Description (optional)', 'fotogrids' ),
			'save'                       => __( 'Save', 'fotogrids' ),
			'saving'                     => __( 'Saving...', 'fotogrids' ),
			'cancel'                     => __( 'Cancel', 'fotogrids' ),
			'applying'                   => __( 'Applying...', 'fotogrids' ),
			'myTemplate'                 => __( 'My Template', 'fotogrids' ),
			'userTemplates'              => __( 'User Templates', 'fotogrids' ),
			'fotogridsTemplates'         => __( 'FotoGrids Templates', 'fotogrids' ),
			'templatesLibrary'           => __( 'Templates Library', 'fotogrids' ),
			'templateNameRequired'       => __( 'Template name is required.', 'fotogrids' ),
			'failedToLoadTemplates'      => __( 'Failed to load templates.', 'fotogrids' ),
			'failedToApplyTemplate'      => __( 'Failed to apply template.', 'fotogrids' ),
			'failedToSaveTemplate'       => __( 'Failed to save template.', 'fotogrids' ),
		);
	}
}
