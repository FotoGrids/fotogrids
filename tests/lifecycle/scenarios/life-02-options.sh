# LIFE-02. A fresh activation seeds its options.
#
# The version is compared against what the activator writes, read out of the
# source, so the row cannot drift from the code the way the matrix did.

scratch_install life02

expected_db_version=$(
	grep -o "update_option( 'fotogrids_db_version', '[0-9.]*' )" \
		"$SCRATCH_DIR/wp-content/plugins/fotogrids/includes/class-activator.php" \
		| grep -o "'[0-9.]*' )$" | tr -d "' )"
)
[ -n "$expected_db_version" ] || fail "could not read the version the activator writes"

scratch_activate

for option in fotogrids_version fotogrids_db_version fotogrids_caps_version fotogrids_site_id fotogrids_activated_time fotogrids_media_settings; do
	value=$( $WP option get "$option" 2>/dev/null )
	if [ -n "$value" ]; then
		pass "$option is set"
	else
		fail "$option is missing or empty"
	fi
done

assert_eq "$expected_db_version" "$( $WP option get fotogrids_db_version )" \
	"fotogrids_db_version matches what the activator writes"

# A uuid4, not a placeholder.
site_id=$( $WP option get fotogrids_site_id )
if printf '%s' "$site_id" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'; then
	pass "fotogrids_site_id is a uuid4"
else
	fail "fotogrids_site_id is not a uuid4: '$site_id'"
fi

# Autoload flags. The three the activator passes false for must stay out of the
# autoloaded set - dropping that argument grows every request's option load.
autoload_of() {
	$WP eval "global \$wpdb; echo (string) \$wpdb->get_var( \$wpdb->prepare( \"SELECT autoload FROM {\$wpdb->options} WHERE option_name = %s\", '$1' ) );"
}

for option in fotogrids_caps_version fotogrids_site_id fotogrids_media_settings; do
	assert_eq off "$( autoload_of "$option" )" "$option is not autoloaded"
done

for option in fotogrids_version fotogrids_db_version; do
	assert_eq auto "$( autoload_of "$option" )" "$option is autoloaded"
done

scratch_teardown
