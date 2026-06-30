<?php
/**
 * Outbound link builder for FotoGrids marketing and documentation URLs.
 *
 * @package FotoGrids
 * @since   1.0.0
 */

namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds canonical go.fotogrids.com URLs with consistent UTM parameters.
 *
 * Centralising URL construction keeps every outbound link on one host and one
 * UTM convention: utm_source is always "plugin", utm_medium identifies the
 * surface, utm_campaign identifies the destination intent.
 *
 * @since 1.0.0
 */
class Links {

	/**
	 * Redirect host for all outbound marketing and documentation links.
	 *
	 * @var string
	 */
	const BASE_URL = 'https://go.fotogrids.com/';

	/**
	 * Builds an outbound go.fotogrids.com URL with UTM parameters.
	 *
	 * @since  1.0.0
	 * @param  string $path      Path on the redirect host, without a leading slash.
	 * @param  string $medium    Surface the link lives on (utm_medium).
	 * @param  string $campaign  Destination intent (utm_campaign).
	 * @param  string $content   Optional nuance to disambiguate links on one surface (utm_content).
	 * @return string Fully-formed URL.
	 */
	public static function go( string $path, string $medium, string $campaign, string $content = '' ): string {
		$query = array(
			'utm_source'   => 'plugin',
			'utm_medium'   => $medium,
			'utm_campaign' => $campaign,
		);

		if ( '' !== $content ) {
			$query['utm_content'] = $content;
		}

		return self::BASE_URL . ltrim( $path, '/' ) . '?' . http_build_query( $query );
	}
}
