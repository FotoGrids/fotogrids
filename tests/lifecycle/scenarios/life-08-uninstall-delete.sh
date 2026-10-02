# LIFE-10. Uninstall with data deletion on removes everything the plugin owns,
# and nothing it does not.
#
# The setting is stored inverted: the Advanced tab's "delete data on uninstall"
# writes `fotogrids_preserve_data_on_uninstall` as false.

scratch_install life08
scratch_activate

gallery=$( $WP post create --post_type=fotogrids_gallery --post_title="life08" --porcelain )
album=$( $WP post create --post_type=fotogrids_album --post_title="life08 album" --porcelain )
page=$( $WP post create --post_type=page --post_title="life08 page" --porcelain )
attachment=$( $WP post create --post_type=attachment --post_title="life08 image" --porcelain )

$WP post meta update "$gallery" fotogrids_layout grid --quiet
$WP post meta update "$attachment" _fotogrids_watermark_variants '{"full":1}' --quiet
$WP post meta update "$attachment" _wp_attachment_image_alt 'alt text the site owns' --quiet
$WP user meta update 1 fotogrids_saved_templates 'a template' --quiet
$WP eval 'global $wpdb; $wpdb->insert( $wpdb->prefix . "fotogrids_tags",
	array( "name" => "life08", "slug" => "life08" ) );'

$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet
assert_eq 0 "$( $WP option get fotogrids_preserve_data_on_uninstall )" \
	"the site asked for its data to be deleted"

uninstall_as_admin

# --- what the plugin owns ---------------------------------------------------

assert_eq 0 \
	"$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )" \
	"every table was dropped"
assert_eq 0 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE \"fotogrids\_%\"" );' )" \
	"every option was deleted"
assert_eq 0 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts}
		WHERE post_type IN (\"fotogrids_gallery\",\"fotogrids_album\",\"fotogrids_embed\")" );' )" \
	"the gallery and album posts were deleted"
assert_eq 0 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->postmeta}
		WHERE meta_key LIKE \"fotogrids\_%\" OR meta_key LIKE \"\_fotogrids\_%\"" );' )" \
	"both post-meta prefixes were cleared, including the watermark variants"
assert_eq 0 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->usermeta}
		WHERE meta_key LIKE \"fotogrids\_%\" OR meta_key LIKE \"\_fotogrids\_%\"" );' )" \
	"the saved templates in user meta were cleared"
assert_eq 0 \
	"$( $WP eval '$r = get_role( "administrator" );
		echo count( array_filter( array_keys( array_filter( $r->capabilities ) ),
			fn( $c ) => false !== strpos( $c, "fotogrids" ) ) );' )" \
	"the administrator's capabilities were removed"

# --- what it does not ------------------------------------------------------

assert_eq page "$( $WP post get "$page" --field=post_type )" "a page the site owns survived"
assert_eq attachment "$( $WP post get "$attachment" --field=post_type )" "the attachment survived"
assert_eq 'alt text the site owns' "$( $WP post meta get "$attachment" _wp_attachment_image_alt )" \
	"core's alt text survived, since the plugin does not own that key"

scratch_teardown
