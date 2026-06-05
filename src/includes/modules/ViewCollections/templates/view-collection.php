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

$fg_post = Router::current_post();
if ( ! $fg_post instanceof \WP_Post ) {
    return;
}

$fg_view = Renderer::for_post( $fg_post );
$fg_view->enqueue_assets();
$fg_view->track_view();
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html( $fg_view->page_title() ); ?></title>
    <?php
    echo $fg_view->head_meta(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

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
<body <?php echo $fg_view->body_attrs(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
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
        echo $fg_view->header_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

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

        echo $fg_view->gallery_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

        /**
         * Fires after the gallery/album markup.
         *
         * @since 1.0.0
         * @param \WP_Post $fg_post
         */
        do_action( Actions_View::AFTER_GALLERY, $fg_post );
        ?>
    </main>

    <footer class="fotogrids-view__footer">
        <?php
        echo $fg_view->share_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo $fg_view->footer_credit_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

        /**
         * Fires at the end of the footer region.
         *
         * @since 1.0.0
         * @param \WP_Post $fg_post
         */
        do_action( Actions_View::FOOTER, $fg_post );
        ?>
    </footer>

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
