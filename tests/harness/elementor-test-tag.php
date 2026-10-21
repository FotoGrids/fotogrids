<?php
/**
 * A dynamic tag for the Elementor spec: outputs the current post's
 * `fg_test_gallery` meta, so a widget can be bound to a gallery ID.
 *
 * @package FotoGrids\Tests
 */

add_action(
	'elementor/dynamic_tags/register',
	function ( $tags ) {
		$tags->register(
			new class() extends \Elementor\Core\DynamicTags\Tag {
				public function get_name() {
					return 'fg-test-gallery';
				}

				public function get_title() {
					return 'FotoGrids test gallery';
				}

				public function get_group() {
					return 'post';
				}

				public function get_categories() {
					return array( 'text' );
				}

				public function render() {
					echo esc_html( (string) get_post_meta( get_the_ID(), 'fg_test_gallery', true ) );
				}
			}
		);
	}
);
