<?php
/**
 * Base class for FotoGrids collection-picker Elementor controls.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Elementor\Controls
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Elementor\Controls;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Base data control shared by the gallery and album pickers.
 *
 * Each subclass declares its `kind` (`gallery` | `album`); the
 * Marionette `content_template` is identical for both. The view is wired
 * in JS (`editor.js`): a rich Select2 with status optgroups + per-row
 * thumbnail / status pill / item count, plus a "Browse all" button that
 * opens the React PickerModal, plus an "Edit" link when something is
 * picked.
 *
 * The control type registers itself with Elementor through
 * `controls_manager->register( new Gallery_Picker() )` etc.; see
 * {@see \FotoGrids\Modules\PageBuilders\Builders\Elementor\Module::register_controls()}.
 *
 * @since 1.0.0
 */
abstract class Base_Collection_Picker extends \Elementor\Base_Data_Control {

	/**
	 * Collection kind this control picks.
	 *
	 * @return string 'gallery' | 'album'
	 */
	abstract protected function get_kind(): string;

	/**
	 * Default value: empty selection.
	 *
	 * Returns a scalar (empty string) rather than an array because
	 * Elementor's `Controls_Manager::add_control_to_stack` does
	 * `array_merge( $control_default_value, $control_data['default'] )`
	 * when the control's default is an array - and our widgets pass a
	 * scalar (the post ID) for `default`. Mismatched shapes fatal there.
	 * The "kind" doesn't need to live in the value; it's a property of
	 * the control type itself, exposed via {@see get_default_settings()}
	 * for the JS view to read.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function get_default_value(): string {
		return '';
	}

	/**
	 * Default control settings exposed to subclasses' `register_controls`.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	protected function get_default_settings(): array {
		return array(
			'label_block' => true,
			'show_label'  => true,
			'separator'   => 'default',
			'description' => '',
			// Tells our editor.js which REST surface to query and which
			// PickerModal `kind` prop to use. The Marionette view reads
			// this off `data.kind`. The PHP `content_template` also
			// reads `$this->get_kind()` directly so the data-attribute
			// we render is correct even on the very first paint before
			// the JS view has hydrated.
			'kind'        => $this->get_kind(),
		);
	}

	/**
	 * Marionette template that Elementor renders inside the panel.
	 *
	 * Mounting hierarchy:
	 *   - `.elementor-control-input-wrapper`
	 *     - `.fg-pb-elementor-picker` ← root our editor.js looks for
	 *       - `<select>` ← jQuery Select2 hydrates this in JS
	 *       - `<button>` Browse-all
	 *       - `<a>` Edit-link (hidden when nothing selected)
	 *
	 * The control's setting is bound by Elementor through the standard
	 * `data-setting={{ data.name }}` attribute on the `<select>`.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function content_template(): void {
		$kind_attr  = $this->get_kind();
		$browse_lbl = $this->get_kind() === 'album'
			? __( 'Browse all albums', 'fotogrids' )
			: __( 'Browse all galleries', 'fotogrids' );
		$edit_lbl   = $this->get_kind() === 'album'
			? __( 'Edit album', 'fotogrids' )
			: __( 'Edit gallery', 'fotogrids' );
		?>
		<div class="elementor-control-field">
			<# if ( data.label ) { #>
				<label for="<?php $this->print_control_uid(); ?>" class="elementor-control-title">{{{ data.label }}}</label>
			<# } #>
			<div class="elementor-control-input-wrapper elementor-control-unit-5">
				<div class="fg-pb-elementor-picker" data-fg-picker-kind="<?php echo esc_attr( $kind_attr ); ?>">
					<select
						id="<?php $this->print_control_uid(); ?>"
						class="fg-pb-elementor-picker__select"
						data-setting="{{ data.name }}"
					></select>
					<div class="fg-pb-elementor-picker__actions">
						<button
							type="button"
							class="fg-pb-elementor-picker__browse fg-button fg-button--variant-primary fg-button--size-sm"
						>
							<span class="fg-button__label"><?php echo esc_html( $browse_lbl ); ?></span>
						</button>
						<a
							href="#"
							class="fg-pb-elementor-picker__edit fg-button fg-button--variant-secondary fg-button--size-sm"
							target="_blank"
							rel="noopener noreferrer"
							hidden
						>
							<span class="fg-button__label"><?php echo esc_html( $edit_lbl ); ?></span>
							<span class="fotogrids-icon fotogrids-icon--click_external fg-button__icon fg-pb-elementor-picker__edit-icon" aria-hidden="true"></span>
						</a>
					</div>
				</div>
			</div>
		</div>
		<# if ( data.description ) { #>
			<div class="elementor-control-field-description">{{{ data.description }}}</div>
		<# } #>
		<?php
	}
}
