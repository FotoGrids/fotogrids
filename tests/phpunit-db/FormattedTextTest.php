<?php
/**
 * Formatted captions and descriptions: hooks, settings, permission and saves.
 *
 * @package FotoGrids
 */

use FotoGrids\Formatted_Text\Formatted_Text;
use FotoGrids\Hooks\Filters_Formatted_Text;
use FotoGrids\Settings\Text_Formatting_Settings_Store;

class FormattedTextTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		delete_option( Text_Formatting_Settings_Store::OPTION );
		Formatted_Text::reset();
		rest_get_server();
	}

	public function tear_down(): void {
		foreach ( array( 'SCHEMA', 'MODE', 'LINK_POLICY', 'OUTPUT', 'PLAIN_TEXT', 'SANITIZE_FOR_SAVE' ) as $name ) {
			remove_all_filters( constant( Filters_Formatted_Text::class . '::' . $name ) );
		}
		delete_option( Text_Formatting_Settings_Store::OPTION );
		Formatted_Text::reset();
		parent::tear_down();
	}

	private function user( string $role ): int {
		$id = self::factory()->user->create( array( 'role' => $role ) );
		wp_set_current_user( $id );
		return $id;
	}

	private function attachment( int $author, string $caption = '', string $description = '' ): int {
		return self::factory()->attachment->create_object(
			'harbour.jpg',
			0,
			wp_slash(
				array(
					'post_mime_type' => 'image/jpeg',
					'post_title'     => 'Harbour',
					'post_excerpt'   => $caption,
					'post_content'   => $description,
					'post_author'    => $author,
				)
			)
		);
	}

	private function save( int $id, array $body ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', "/fotogrids/v1/items/$id/save" );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( wp_json_encode( $body ) );
		return rest_get_server()->dispatch( $request );
	}

	// ── Display ─────────────────────────────────────────────────────────

	public function test_basic_mode_keeps_allowed_formatting_and_removes_the_rest(): void {
		$html = Formatted_Text::html(
			'<strong>Bold</strong> <span style="color:red" onclick="x()">x</span><script>alert(1)</script>',
			array( 'surface' => 'thumbnail' )
		);
		$this->assertSame( '<strong>Bold</strong> x', $html );
	}

	public function test_plain_mode_setting_shows_text_as_typed(): void {
		Text_Formatting_Settings_Store::save( array( 'mode' => 'plain' ) );
		Formatted_Text::reset();

		$this->assertSame( 'Bold &amp; x<br>y', Formatted_Text::html( "<b>Bold</b> &amp; x\ny" ) );
	}

	public function test_link_policy_comes_from_the_settings_and_a_link_choice_wins(): void {
		Text_Formatting_Settings_Store::save(
			array(
				'links_new_tab'  => false,
				'links_nofollow' => true,
			)
		);
		Formatted_Text::reset();

		$html = Formatted_Text::html(
			'<a href="https://a.test">a</a> <a href="https://b.test" target="_blank" rel="">b</a>',
			array( 'surface' => 'lightbox' )
		);
		$this->assertSame(
			'<a href="https://a.test" rel="nofollow">a</a> <a href="https://b.test" target="_blank" rel="noopener">b<span class="fg-formatted-text-sr"> (opens in a new tab)</span></a>',
			$html
		);
	}

	public function test_quotes_are_encoded_so_wptexturize_leaves_them_as_typed(): void {
		$html = Formatted_Text::html( 'It\'s "dawn" <b>"now"</b>' );
		$this->assertSame( 'It&#039;s &quot;dawn&quot; <b>&quot;now&quot;</b>', $html );
		$this->assertSame( $html, wptexturize( $html ) );
	}

	public function test_thumbnails_show_links_as_text(): void {
		$this->assertSame(
			'see the pier',
			Formatted_Text::html( 'see <a href="https://a.test">the pier</a>', array( 'links' => false ) )
		);
	}

	public function test_schema_filter_can_widen_but_never_past_the_floor(): void {
		$seen = array();
		add_filter(
			Filters_Formatted_Text::SCHEMA,
			static function ( $schema, $profile ) use ( &$seen ) {
				$seen[]                      = $profile;
				$schema['elements']['u']     = array();
				$schema['elements']['script'] = array();
				$schema['elements']['a']['attributes']['onclick'] = array( 'type' => 'text' );
				$schema['elements']['a']['attributes']['class']   = array( 'type' => 'text' );
				$schema['protocols'][]       = 'javascript';
				return $schema;
			},
			10,
			2
		);
		Formatted_Text::reset();

		$html = Formatted_Text::html(
			'<u>u</u> <script>x</script><a href="javascript:alert(1)" onclick="x" class="c">j</a> <a href="https://a.test" class="c">k</a>',
			array(
				'surface' => 'lightbox',
				'links'   => true,
			)
		);
		$this->assertContains( 'item_text', $seen );
		$this->assertSame( '<u>u</u> j <a href="https://a.test" target="_blank" rel="noopener">k<span class="fg-formatted-text-sr"> (opens in a new tab)</span></a>', $html );
	}

	public function test_a_widened_schema_is_sent_to_the_browser(): void {
		$this->assertArrayNotHasKey( 'profile', Formatted_Text::client_config( 'lightbox', 0 ) );

		add_filter(
			Filters_Formatted_Text::SCHEMA,
			static function ( $schema ) {
				$schema['elements']['u'] = array();
				return $schema;
			}
		);
		Formatted_Text::reset();

		$config = Formatted_Text::client_config( 'lightbox', 0 );
		$this->assertArrayHasKey( 'u', $config['profile']['elements'] );
	}

	public function test_mode_filter_applies_per_surface_and_gallery_and_rejects_unknown_modes(): void {
		$calls = array();
		add_filter(
			Filters_Formatted_Text::MODE,
			static function ( $mode, $context ) use ( &$calls ) {
				$calls[] = $context;
				if ( 7 === $context['gallery_id'] ) {
					return 'plain';
				}
				return 'loud';
			},
			10,
			2
		);

		$this->assertSame( 'x', Formatted_Text::html( '<b>x</b>', array( 'gallery_id' => 7 ) ) );
		$this->assertSame( '<b>x</b>', Formatted_Text::html( '<b>x</b>', array( 'gallery_id' => 8 ) ) );
		$this->assertSame( 'plain', Formatted_Text::client_config( 'lightbox_mini', 7 )['mode'] );
		$this->assertSame(
			array(
				'profile'    => 'item_text',
				'surface'    => 'thumbnail',
				'gallery_id' => 7,
			),
			$calls[0]
		);
	}

	public function test_link_policy_filter_keeps_only_allowed_rel_tokens(): void {
		add_filter(
			Filters_Formatted_Text::LINK_POLICY,
			static function () {
				return array(
					'new_tab' => false,
					'rel'     => array( 'sponsored', 'NOREFERRER', 'noopener', 'me', 7, 'sponsored' ),
				);
			}
		);

		$this->assertSame(
			array(
				'newTab' => false,
				'rel'    => array( 'sponsored', 'noreferrer' ),
			),
			Formatted_Text::client_config( 'lightbox', 0 )['policy']
		);
	}

	public function test_output_filter_result_is_sanitized_again(): void {
		$args = null;
		add_filter(
			Filters_Formatted_Text::OUTPUT,
			static function ( $html, $raw, $context ) use ( &$args ) {
				$args = array( $raw, $context );
				return $html . ' <em>added</em><img src=x onerror=alert(1)>';
			},
			10,
			3
		);

		$html = Formatted_Text::html(
			'<b>x</b>',
			array(
				'surface' => 'album_tile',
				'field'   => 'description',
				'item_id' => 5,
			)
		);
		$this->assertSame( '<b>x</b> <em>added</em>', $html );
		$this->assertSame( '<b>x</b>', $args[0] );
		$this->assertSame( 'album_tile', $args[1]['surface'] );
		$this->assertSame( 'description', $args[1]['field'] );
		$this->assertSame( 5, $args[1]['item_id'] );
		$this->assertSame( 'basic', $args[1]['mode'] );
	}

	public function test_output_filter_result_keeps_the_character_limit(): void {
		add_filter(
			Filters_Formatted_Text::OUTPUT,
			static function ( $html ) {
				return $html . ' and more text';
			}
		);

		$this->assertSame( 'abc a…', Formatted_Text::html( 'abc', array( 'max_length' => 5 ) ) );
	}

	public function test_plain_text_filter_and_single_line(): void {
		add_filter(
			Filters_Formatted_Text::PLAIN_TEXT,
			static function ( $text, $raw, $context ) {
				return 'share' === $context['use'] ? strtoupper( $text ) : $text;
			},
			10,
			3
		);

		$this->assertSame( "One & two\n\nthree", Formatted_Text::plain_text( '<p>One &amp; <b>two</b></p><p>three</p>' ) );
		$this->assertSame( 'ONE TWO', Formatted_Text::single_line( "one\ntwo", array( 'use' => 'share' ) ) );
	}

	// ── Settings ────────────────────────────────────────────────────────

	public function test_settings_store_defaults_and_sanitizes(): void {
		$this->assertSame(
			array(
				'mode'           => 'basic',
				'links_new_tab'  => true,
				'links_nofollow' => false,
			),
			Text_Formatting_Settings_Store::get()
		);

		$saved = Text_Formatting_Settings_Store::save(
			array(
				'mode'           => '<script>',
				'links_new_tab'  => '0',
				'links_nofollow' => 'yes',
				'extra'          => 'x',
			)
		);
		$this->assertSame( 'basic', $saved['mode'] );
		$this->assertFalse( $saved['links_new_tab'] );
		$this->assertArrayNotHasKey( 'extra', $saved );
	}

	public function test_settings_route_needs_the_settings_permission(): void {
		$this->user( 'editor' );
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/text-formatting' );
		$request->set_param( 'mode', 'plain' );
		$this->assertSame( 403, rest_get_server()->dispatch( $request )->get_status() );

		$this->user( 'administrator' );
		$response = rest_get_server()->dispatch( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'plain', $response->get_data()['settings']['mode'] );
		$this->assertTrue( $response->get_data()['settings']['links_new_tab'] );
	}

	// ── Permission ──────────────────────────────────────────────────────

	public function test_caps_resync_grants_formatting_from_author_up(): void {
		foreach ( array( 'author', 'editor', 'administrator' ) as $role ) {
			get_role( $role )->remove_cap( Formatted_Text::CAPABILITY );
		}
		update_option( 'fotogrids_caps_version', '1.4' );

		\FotoGrids\Activator::maybe_resync_capabilities();

		foreach ( array( 'author', 'editor', 'administrator' ) as $role ) {
			$this->assertTrue( get_role( $role )->has_cap( Formatted_Text::CAPABILITY ), $role );
		}
		foreach ( array( 'contributor', 'subscriber' ) as $role ) {
			$this->assertFalse( get_role( $role )->has_cap( Formatted_Text::CAPABILITY ), $role );
		}
		$this->assertSame( '1.5', get_option( 'fotogrids_caps_version' ) );
	}

	// ── Saving ──────────────────────────────────────────────────────────

	public function test_an_author_keeps_allowed_formatting_and_loses_the_rest(): void {
		$author = $this->user( 'author' );
		$id     = $this->attachment( $author );

		$response = $this->save(
			$id,
			array(
				'caption'     => 'A <a href="https://a.test" onclick="x()">link</a><script>alert(1)</script>',
				'description' => "Line one\r\nLine <strong>two</strong>",
			)
		);

		$this->assertSame( 200, $response->get_status() );
		$post = get_post( $id );
		$this->assertStringContainsString( '<a href="https://a.test">link</a>', $post->post_excerpt );
		$this->assertStringNotContainsString( 'onclick', $post->post_excerpt );
		$this->assertStringNotContainsString( '<script', $post->post_excerpt );
		$this->assertSame( "Line one\nLine <strong>two</strong>", $post->post_content );
		$this->assertSame( $post->post_excerpt, $response->get_data()['item']['caption'] );
	}

	public function test_a_user_without_the_permission_saves_plain_text(): void {
		get_role( 'author' )->remove_cap( Formatted_Text::CAPABILITY );
		$author = $this->user( 'author' );
		$id     = $this->attachment( $author );

		$this->save( $id, array( 'caption' => "<b>Bold</b> & 1 < 2\nnext" ) );

		get_role( 'author' )->add_cap( Formatted_Text::CAPABILITY );
		$this->assertSame( "Bold &amp; 1 &lt; 2\nnext", get_post( $id )->post_excerpt );
		$this->assertSame( 'Bold &amp; 1 &lt; 2<br>next', Formatted_Text::html( get_post( $id )->post_excerpt ) );
	}

	public function test_a_save_without_text_fields_keeps_them(): void {
		$admin = $this->user( 'administrator' );
		$id    = $this->attachment( $admin, 'By <a href="https://a.test">the admin</a>', 'Kept' );
		update_post_meta( $id, '_wp_attachment_image_alt', 'Alt kept' );

		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		get_role( 'author' )->remove_cap( Formatted_Text::CAPABILITY );
		wp_update_post(
			array(
				'ID'          => $id,
				'post_author' => $author,
			)
		);
		wp_set_current_user( $author );

		$response = $this->save( $id, array( 'title' => 'New title' ) );

		get_role( 'author' )->add_cap( Formatted_Text::CAPABILITY );
		$this->assertSame( 200, $response->get_status() );
		$post = get_post( $id );
		$this->assertSame( 'New title', $post->post_title );
		$this->assertSame( 'By <a href="https://a.test">the admin</a>', $post->post_excerpt );
		$this->assertSame( 'Kept', $post->post_content );
		$this->assertSame( 'Alt kept', get_post_meta( $id, '_wp_attachment_image_alt', true ) );
	}

	public function test_an_empty_string_clears_a_field(): void {
		$author = $this->user( 'author' );
		$id     = $this->attachment( $author, 'Old caption' );

		$this->save( $id, array( 'caption' => '' ) );

		$this->assertSame( '', get_post( $id )->post_excerpt );
	}

	public function test_a_non_string_field_is_refused(): void {
		$author = $this->user( 'author' );
		$id     = $this->attachment( $author, 'Old caption' );

		$response = $this->save( $id, array( 'caption' => array( 'x' ) ) );

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'Old caption', get_post( $id )->post_excerpt );
	}

	public function test_sanitize_for_save_filter_runs_last_with_its_context(): void {
		$author = $this->user( 'author' );
		$id     = $this->attachment( $author );
		$seen   = null;
		add_filter(
			Filters_Formatted_Text::SANITIZE_FOR_SAVE,
			static function ( $value, $raw, $context ) use ( &$seen ) {
				$seen = array( $value, $raw, $context );
				return $value . ' (checked)';
			},
			10,
			3
		);

		$this->save( $id, array( 'description' => '<em>x</em>' ) );

		$this->assertSame( '<em>x</em> (checked)', get_post( $id )->post_content );
		$this->assertSame( '<em>x</em>', $seen[1] );
		$this->assertSame( 'description', $seen[2]['field'] );
		$this->assertSame( $id, $seen[2]['item_id'] );
		$this->assertSame( $author, $seen[2]['user_id'] );
		$this->assertTrue( $seen[2]['can_format'] );
		$this->assertSame( 'item_editor', $seen[2]['source'] );
	}

	public function test_import_applies_the_save_rules(): void {
		get_role( 'author' )->remove_cap( Formatted_Text::CAPABILITY );
		$author = $this->user( 'author' );
		$id     = $this->attachment( $author );

		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
		$method = new ReflectionMethod( \FotoGrids\Tools\ImportExport\Import_Export_Data::class, 'import_item_text' );
		$method->setAccessible( true );
		$method->invoke(
			null,
			$id,
			array(
				'caption'     => '<a href="https://a.test">link</a>',
				'description' => '',
			)
		);

		get_role( 'author' )->add_cap( Formatted_Text::CAPABILITY );
		$this->assertSame( 'link', get_post( $id )->post_excerpt );
	}
}
