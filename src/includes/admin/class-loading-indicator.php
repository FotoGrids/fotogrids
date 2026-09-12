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
 * The React counterpart is `components/shared/LoadingIcon.jsx`; both inline the
 * mark so it never depends on an asynchronously fetched icon payload.
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
				<svg width="48" height="48" viewBox="0 0 131 131" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false">
					<g transform="translate(8,8)">
						<rect x="0" y="0" width="115" height="29">
							<animate attributeName="width" dur="3s" repeatCount="indefinite" keyTimes="0;0.267;0.4;0.567;0.7;1" values="115;115;0;0;115;115"/>
							<animate attributeName="x" dur="3s" repeatCount="indefinite" keyTimes="0;0.267;0.4;0.567;0.7;1" values="0;0;115;0;0;0"/>
						</rect>
						<rect x="0" y="43" width="72" height="29">
							<animate attributeName="width" dur="3s" repeatCount="indefinite" keyTimes="0;0.3;0.433;0.6;0.733;1" values="72;72;0;0;72;72"/>
							<animate attributeName="x" dur="3s" repeatCount="indefinite" keyTimes="0;0.3;0.433;0.6;0.733;1" values="0;0;72;0;0;0"/>
						</rect>
						<rect x="0" y="86" width="29" height="29">
							<animate attributeName="width" dur="3s" repeatCount="indefinite" keyTimes="0;0.333;0.45;0.633;0.75;1" values="29;29;0;0;29;29"/>
							<animate attributeName="x" dur="3s" repeatCount="indefinite" keyTimes="0;0.333;0.45;0.633;0.75;1" values="0;0;29;0;0;0"/>
						</rect>
						<rect x="43" y="86" width="29" height="29" opacity="0.7">
							<animate attributeName="height" dur="3s" repeatCount="indefinite" keyTimes="0;0.367;0.483;0.667;0.783;1" values="29;29;0;0;29;29"/>
							<animate attributeName="y" dur="3s" repeatCount="indefinite" keyTimes="0;0.367;0.483;0.667;0.783;1" values="86;86;115;115;86;86"/>
						</rect>
						<rect x="86" y="43" width="29" height="72" opacity="0.7">
							<animate attributeName="height" dur="3s" repeatCount="indefinite" keyTimes="0;0.4;0.533;0.7;0.833;1" values="72;72;0;0;72;72"/>
							<animate attributeName="y" dur="3s" repeatCount="indefinite" keyTimes="0;0.4;0.533;0.7;0.833;1" values="43;43;115;115;43;43"/>
						</rect>
					</g>
				</svg>
			</span>
			<?php if ( '' !== $label ) : ?>
				<p class="fotogrids-loading-screen__label"><?php echo esc_html( $label ); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}
}
