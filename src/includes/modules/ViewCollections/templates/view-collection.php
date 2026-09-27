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

$fotogrids_post = Router::current_post();
if ( ! $fotogrids_post instanceof \WP_Post ) {
	return;
}

$fotogrids_view = Renderer::for_post( $fotogrids_post );
$fotogrids_view->enqueue_assets();
$fotogrids_view->track_view();
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( $fotogrids_view->page_title() ); ?></title>
	<?php
	echo wp_kses( $fotogrids_view->head_meta(), \FotoGrids\Kses::head_meta_rules() );

	/**
	 * Fires inside the view page document head.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fotogrids_post
	 */
	do_action( Actions_View::HEAD, $fotogrids_post );

	wp_head();
	?>
</head>
<body id="<?php echo esc_attr( Renderer::BODY_ID ); ?>" class="<?php echo esc_attr( $fotogrids_view->body_class() ); ?>">
	<?php
	/**
	 * Fires immediately inside the body, before the shell.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fotogrids_post
	 */
	do_action( Actions_View::BEFORE_SHELL, $fotogrids_post );
	?>

	<?php if ( $fotogrids_view->is_draft_preview() ) : ?>
		<div class="fotogrids-view__notice">
			<?php esc_html_e( 'Draft preview - this collection is not published yet.', 'fotogrids' ); ?>
		</div>
	<?php endif; ?>

	<?php if ( $fotogrids_view->shows_header() ) : ?>
	<header class="fotogrids-view__header">
		<?php
		$fotogrids_header = $fotogrids_view->header_html();
		echo wp_kses( $fotogrids_header, \FotoGrids\Kses::rules( $fotogrids_header ) );

		/**
		 * Fires at the end of the header region.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fotogrids_post
		 */
		do_action( Actions_View::HEADER, $fotogrids_post );
		?>
	</header>
	<?php endif; ?>

	<main class="fotogrids-view__body">
		<?php
		/**
		 * Fires before the gallery/album markup.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fotogrids_post
		 */
		do_action( Actions_View::BEFORE_GALLERY, $fotogrids_post );

		$fotogrids_gallery = $fotogrids_view->gallery_html();
		echo wp_kses( $fotogrids_gallery, \FotoGrids\Kses::rules( $fotogrids_gallery ) );

		/**
		 * Fires after the gallery/album markup.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fotogrids_post
		 */
		do_action( Actions_View::AFTER_GALLERY, $fotogrids_post );
		?>
	</main>

	<?php if ( $fotogrids_view->shows_footer() ) : ?>
	<footer class="fotogrids-view__footer">
		<?php
		$fotogrids_share = $fotogrids_view->share_html();
		echo wp_kses( $fotogrids_share, \FotoGrids\Kses::rules( $fotogrids_share ) );
		$fotogrids_credit = $fotogrids_view->footer_credit_html();
		echo wp_kses( $fotogrids_credit, \FotoGrids\Kses::rules( $fotogrids_credit ) );

		/**
		 * Fires at the end of the footer region.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $fotogrids_post
		 */
		do_action( Actions_View::FOOTER, $fotogrids_post );
		?>
	</footer>
	<?php endif; ?>

	<?php
	/**
	 * Fires immediately before the closing body tag, after the shell.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fotogrids_post
	 */
	do_action( Actions_View::AFTER_SHELL, $fotogrids_post );

	wp_footer();
	?>
</body>
</html>
<?php
exit;
