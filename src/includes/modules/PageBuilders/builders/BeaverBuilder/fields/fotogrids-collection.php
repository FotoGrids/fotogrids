<?php
/**
 * Beaver Builder picker field template.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder
 * @since   1.3.0
 */

if ( ! defined( 'WPINC' ) ) {
	die;
}
?>
<div class="fg-pb-bb-collection">
	<input type="text" class="text text-full fg-pb-bb-collection__input" name="{{data.name}}" value="{{data.value}}" />
	<div class="fg-pb-bb-picker" data-fg-picker-kind="{{data.field.kind}}" data-fg-picker-mode="picker"></div>
</div>
