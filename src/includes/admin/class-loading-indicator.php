<?php
/**
 * Admin loading indicator markup.
 *
 * @package FotoGrids\Admin
 * @since   1.1.1
 */

declare(strict_types=1);

namespace FotoGrids\Admin;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders the animated FotoGrids mark used as a loading indicator in server-
 * rendered admin placeholders, before a React tree has mounted.
 *
 * The React counterpart is `components/shared/LoadingIcon.jsx`; the markup and
 * the styles in `styles/loading-screen.scss` are shared, so the indicator does
 * not change when the tree takes over.
 *
 * @since 1.1.1
 */
final class Loading_Indicator {

	/**
	 * Echo a loading indicator with an optional label beside it.
	 *
	 * @since 1.1.1
	 * @param string $label Optional. Text announced next to the mark.
	 * @return void
	 */
	public static function render( string $label = '' ): void {
		?>
		<div class="fotogrids-loading-screen">
			<span class="fotogrids-loading-screen__icon" aria-hidden="true">
				<span class="fotogrids-loading-mark">
					<span class="fotogrids-loading-mark__bar fotogrids-loading-mark__bar--1"></span>
					<span class="fotogrids-loading-mark__bar fotogrids-loading-mark__bar--2"></span>
					<span class="fotogrids-loading-mark__bar fotogrids-loading-mark__bar--3"></span>
					<span class="fotogrids-loading-mark__bar fotogrids-loading-mark__bar--4"></span>
					<span class="fotogrids-loading-mark__bar fotogrids-loading-mark__bar--5"></span>
				</span>
			</span>
			<?php if ( '' !== $label ) : ?>
				<p class="fotogrids-loading-screen__label"><?php echo esc_html( $label ); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}
}
