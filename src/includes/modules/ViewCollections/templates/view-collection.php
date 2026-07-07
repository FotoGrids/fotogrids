<?php
/**
 * Standalone view page document for a gallery or album.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Hooks\Actions_View;

if ( ! defined( 'WPINC' ) ) {
	die;
}

// This standalone view-page template is include()d by the router. $fg_post and
// $fg_view are file-scoped locals (note the fg_ prefix already); the sniff flags
// them only because a template's top level is technically global scope.
// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
$fg_post = Router::current_post();
if ( ! $fg_post instanceof \WP_Post ) {
	return;
}

$fg_view = Renderer::for_post( $fg_post );
$fg_view->enqueue_assets();
$fg_view->track_view();
// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( $fg_view->page_title() ); ?></title>
	<?php
	echo wp_kses( $fg_view->head_meta(), \FotoGrids\Kses::head_meta_rules() );

	/**
	 * Fires inside the view page document head.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post
	 */
	do_action( Actions_View::HEAD, $fg_post );

	wp_head();
	?>
</head>
<body id="<?php echo esc_attr( Renderer::BODY_ID ); ?>" class="<?php echo esc_attr( $fg_view->body_class() ); ?>">
	<?php
	/**
	 * Fires immediately inside the body, before the shell.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post
	 */
	do_action( Actions_View::BEFORE_SHELL, $fg_post );
	?>

	<?php if ( $fg_view->is_draft_preview() ) : ?>
		<div class="fotogrids-view__notice">
			<?php esc_html_e( 'Draft preview - this collection is not published yet.', 'fotogrids' ); ?>
		</div>
	<?php endif; ?>

	<?php if ( $fg_view->shows_header() ) : ?>
	<header class="fotogrids-view__header">
		<?php
		$fotogrids_header = $fg_view->header_html();
		echo wp_kses( $fotogrids_header, \FotoGrids\Kses::rules( $fotogrids_header ) );

		/**
		 * Fires at the end of the header region.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fg_post
		 */
		do_action( Actions_View::HEADER, $fg_post );
		?>
	</header>
	<?php endif; ?>

	<main class="fotogrids-view__body">
		<?php
		/**
		 * Fires before the gallery/album markup.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fg_post
		 */
		do_action( Actions_View::BEFORE_GALLERY, $fg_post );

		$fotogrids_gallery = $fg_view->gallery_html();
		echo wp_kses( $fotogrids_gallery, \FotoGrids\Kses::rules( $fotogrids_gallery ) );

		/**
		 * Fires after the gallery/album markup.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fg_post
		 */
		do_action( Actions_View::AFTER_GALLERY, $fg_post );
		?>
	</main>

	<?php if ( $fg_view->shows_footer() ) : ?>
	<footer class="fotogrids-view__footer">
		<?php
		$fotogrids_share = $fg_view->share_html();
		echo wp_kses( $fotogrids_share, \FotoGrids\Kses::rules( $fotogrids_share ) );
		$fotogrids_credit = $fg_view->footer_credit_html();
		echo wp_kses( $fotogrids_credit, \FotoGrids\Kses::rules( $fotogrids_credit ) );

		/**
		 * Fires at the end of the footer region.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fg_post
		 */
		do_action( Actions_View::FOOTER, $fg_post );
		?>
	</footer>
	<?php endif; ?>

	<?php
	/**
	 * Fires immediately before the closing body tag, after the shell.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post
	 */
	do_action( Actions_View::AFTER_SHELL, $fg_post );

	wp_footer();
	?>
</body>
</html>
<?php
exit;
