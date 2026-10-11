<?php
/**
 * Stands in for the Freemius API: answers every request to a freemius.com host
 * with the shape the SDK expects and records it in the fs_test_log option.
 * While the fs_test_fail option is set, permission updates fail with a 500.
 * Every other request goes out as usual.
 */
add_filter( 'pre_http_request', function ( $pre, $args, $url ) {
	$host = (string) wp_parse_url( $url, PHP_URL_HOST );
	if ( false === strpos( $host, 'freemius.com' ) ) {
		return $pre;
	}
	$log   = get_option( 'fs_test_log', array() );
	$log[] = array( 'm' => $args['method'] ?? 'GET', 'u' => $url, 'b' => is_array( $args['body'] ?? null ) ? wp_json_encode( $args['body'] ) : (string) ( $args['body'] ?? '' ) );
	update_option( 'fs_test_log', $log, false );
	$path = (string) wp_parse_url( $url, PHP_URL_PATH );
	if ( get_option( 'fs_test_fail' ) && preg_match( '#/permissions\.json#', $path ) ) {
		return array( 'headers' => array( 'content-type' => 'application/json', 'x-api-server' => 'test' ), 'body' => wp_json_encode( array( 'error' => array( 'type' => 'ServerError', 'message' => 'Simulated failure', 'code' => 'server_error', 'http' => 500 ) ) ), 'response' => array( 'code' => 500, 'message' => 'Internal Server Error' ), 'cookies' => array(), 'filename' => null );
	}
	$user = array( 'id' => 11, 'email' => 'admin@example.com', 'first' => 'Ad', 'last' => 'Min', 'public_key' => 'pk_user', 'secret_key' => 'sk_user', 'is_verified' => true );
	$inst = array( 'id' => 22, 'site_id' => 33, 'plugin_id' => 27760, 'user_id' => 11, 'url' => home_url(), 'public_key' => 'pk_inst', 'secret_key' => 'sk_inst', 'is_active' => true, 'is_premium' => false, 'version' => '1.2.0', 'plan_id' => 5, 'license_id' => null, 'trial_plan_id' => null, 'trial_ends' => null, 'is_beta' => false, 'is_disconnected' => false );
	if ( false !== strpos( $path, '/action/service/user/install' ) ) {
		$body = array( 'user_id' => 11, 'user_public_key' => 'pk_user', 'user_secret_key' => 'sk_user', 'install_id' => 22, 'install_public_key' => 'pk_inst', 'install_secret_key' => 'sk_inst', 'is_marketing_allowed' => false, 'is_extensions_tracking_allowed' => true, 'is_diagnostic_tracking_allowed' => true );
	} elseif ( preg_match( '#/permissions\.json#', $path ) ) {
		$body = array( 'install_id' => 22 );
	} elseif ( preg_match( '#/plans\.json$#', $path ) ) {
		$body = array( 'plans' => array( array( 'id' => 5, 'plugin_id' => 27760, 'name' => 'free', 'title' => 'Free', 'is_free_localhost' => true, 'is_block_features' => false ) ) );
	} elseif ( preg_match( '#/installs/22\.json$#', $path ) && 'PUT' === ( $args['method'] ?? '' ) ) {
		$body = $inst;
	} elseif ( preg_match( '#/users/11\.json$#', $path ) ) {
		$body = $user;
	} elseif ( preg_match( '#/installs/22\.json$#', $path ) ) {
		$body = $inst;
	} elseif ( false !== strpos( $path, '/ping' ) ) {
		$body = array( 'api' => 'pong', 'timestamp' => gmdate( 'Y-m-d H:i:s' ) );
	} else {
		$body = array( 'id' => 22, 'install_id' => 22, 'plans' => array(), 'features' => array() );
	}
	return array( 'headers' => array( 'content-type' => 'application/json', 'x-api-server' => 'test' ), 'body' => wp_json_encode( $body ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => null );
}, 10, 3 );
