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
							<animate attributeName="width" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.03;0.251;0.528;0.749;1" values="115;115;0;0;115;115"/>
							<animate attributeName="x" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.03;0.251;0.528;0.749;1" values="0;0;115;0;0;0"/>
						</rect>
						<rect x="0" y="43" width="72" height="29">
							<animate attributeName="width" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.085;0.306;0.583;0.804;1" values="72;72;0;0;72;72"/>
							<animate attributeName="x" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.085;0.306;0.583;0.804;1" values="0;0;72;0;0;0"/>
						</rect>
						<rect x="0" y="86" width="29" height="29">
							<animate attributeName="width" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.14;0.334;0.638;0.832;1" values="29;29;0;0;29;29"/>
							<animate attributeName="x" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.14;0.334;0.638;0.832;1" values="0;0;29;0;0;0"/>
						</rect>
						<rect x="43" y="86" width="29" height="29" opacity="0.7">
							<animate attributeName="height" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.196;0.389;0.694;0.887;1" values="29;29;0;0;29;29"/>
							<animate attributeName="y" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.196;0.389;0.694;0.887;1" values="86;86;115;115;86;86"/>
						</rect>
						<rect x="86" y="43" width="29" height="72" opacity="0.7">
							<animate attributeName="height" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.251;0.472;0.749;0.97;1" values="72;72;0;0;72;72"/>
							<animate attributeName="y" dur="1.8s" repeatCount="indefinite" keyTimes="0;0.251;0.472;0.749;0.97;1" values="43;43;115;115;43;43"/>
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
