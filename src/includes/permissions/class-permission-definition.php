<?php
/**
 * Permission Definition value object.
 *
 * @package FotoGrids\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable description of a single permission.
 *
 * A Permission_Definition describes WHAT a permission is and how the UI should
 * present it. It never carries grant data (who has it) - that lives in either
 * WP_Role::capabilities (for role-global grants) or the
 * fotogrids_permission_grants table (for everything else).
 *
 * Two kinds of definitions coexist in the registry:
 *
 *   1. Atomic permissions - one row per real WP capability (e.g.
 *      'edit_fotogrids_galleries'). Always show in Panel 2 (full matrix).
 *      May also show in Panel 1 if their `panel` is 'both'.
 *
 *   2. Logical permissions - a user-facing capability that maps to several
 *      atomic ones (e.g. 'manage_fotogrids_galleries' -> 4 atomic caps).
 *      Show in Panel 1 as a single "lowest role" dropdown. Writing one
 *      logical permission writes every atomic cap in `underlying_caps`.
 *
 * @since 1.0.0
 */
final class Permission_Definition {

	/**
	 * Permission key. Either a real WP capability slug (atomic) or a logical
	 * slug that exists only in the registry (e.g. 'manage_fotogrids_galleries').
	 */
	public string $key;

	/**
	 * Short human-readable label, already translated.
	 */
	public string $label;

	/**
	 * Longer description used in tooltips and side panels, already translated.
	 */
	public string $description;

	/**
	 * Group slug used for sorting and section headings.
	 * One of: 'gallery' | 'album' | 'media' | 'stats' | 'plugin' | 'tools' | 'modules' | string.
	 */
	public string $group;

	/**
	 * Which panel(s) the UI should render this in.
	 *
	 * 'simple'   - Panel 1 only (logical caps; never appear in Panel 2 either,
	 *              because they are not real WP caps).
	 * 'advanced' - Panel 2 only (atomic caps).
	 * 'both'     - Panel 2 always; also appears in Panel 1 with a simplified
	 *              presentation (currently unused, reserved for future).
	 */
	public string $panel;

	/**
	 * For logical permissions: the atomic WP capabilities this maps to.
	 * For atomic permissions: empty.
	 *
	 * @var string[]
	 */
	public array $underlying_caps;

	/**
	 * Default lowest WP role that should hold this permission.
	 *
	 * Used by the activator to grant atomic caps on install, and by Panel 1
	 * to render the default value on first paint. One of:
	 * 'administrator' | 'editor' | 'author' | 'contributor' | 'subscriber'.
	 *
	 * For atomic permissions the activator uses this directly. For logical
	 * permissions it uses each underlying cap's own default, which may differ
	 * from the logical default (e.g. an admin-only logical cap whose
	 * underlying caps each remain admin-only).
	 */
	public string $default_lowest_role;

	/**
	 * Source - one of 'fotogrids' | 'fotogrids-pro' | 'third-party'.
	 *
	 * The registry sets this automatically based on which registration path
	 * was used (core bootstrap, harvest from a registered tool/module, or the
	 * 'fotogrids/permissions/register' filter). It is NOT settable from the
	 * outside.
	 */
	public string $source;

	/**
	 * Minimum FotoGrids tier required.
	 *
	 * One of 'free' | 'pro_starter' | 'pro_plus' | 'agency'. Permissions for
	 * Pro-only features are still registered in Free so the matrix can
	 * surface them as teasers, but the activator skips granting them on
	 * Free-only installs.
	 */
	public string $tier;

	/**
	 * Scopes this permission can be granted at.
	 *
	 * One or more of 'global' | 'gallery' | 'album'. Free never writes
	 * non-global grants but ships this metadata so the Pro matrix UI knows
	 * which caps to expose at object level (Team Permissions feature).
	 *
	 * @var string[]
	 */
	public array $scopes;

	/**
	 * Whether this permission is core infrastructure and must never be
	 * revoked from administrators via the UI.
	 *
	 * Examples: 'manage_fotogrids', 'manage_fotogrids_permissions'.
	 */
	public bool $is_core;

	/**
	 * Whether this cap is a WordPress *meta* cap that only makes sense when
	 * checked against a specific post (e.g. 'edit_fotogrids_gallery' which
	 * resolves to 'edit_post' via map_meta_cap).
	 *
	 * Calling current_user_can() on a meta cap without a post id triggers a
	 * _doing_it_wrong notice in WP 6.1+. Loops that snapshot every cap
	 * (e.g. the bag shipped to the React side) skip these.
	 *
	 * Defaults to false. The activator still grants meta caps to roles
	 * because that's how the per-post check eventually resolves to "yes".
	 */
	public bool $is_meta_cap;

	/**
	 * @param array{
	 *     key: string,
	 *     label: string,
	 *     description?: string,
	 *     group?: string,
	 *     panel?: string,
	 *     underlying_caps?: string[],
	 *     default_lowest_role?: string,
	 *     tier?: string,
	 *     scopes?: string[],
	 *     is_core?: bool
	 * } $args
	 */
	public function __construct( array $args ) {
		if ( empty( $args['key'] ) || ! is_string( $args['key'] ) ) {
			throw new \InvalidArgumentException( 'Permission_Definition requires a non-empty string "key".' );
		}
		if ( empty( $args['label'] ) || ! is_string( $args['label'] ) ) {
			throw new \InvalidArgumentException( 'Permission_Definition requires a non-empty string "label".' );
		}

		$this->key                 = $args['key'];
		$this->label               = $args['label'];
		$this->description         = isset( $args['description'] ) ? (string) $args['description'] : '';
		$this->group               = isset( $args['group'] ) ? (string) $args['group'] : 'plugin';
		$this->panel               = isset( $args['panel'] ) ? (string) $args['panel'] : 'advanced';
		$this->underlying_caps     = isset( $args['underlying_caps'] ) && is_array( $args['underlying_caps'] )
			? array_values( array_filter( array_map( 'strval', $args['underlying_caps'] ) ) )
			: array();
		$this->default_lowest_role = isset( $args['default_lowest_role'] ) ? (string) $args['default_lowest_role'] : 'administrator';
		$this->tier                = isset( $args['tier'] ) ? (string) $args['tier'] : 'free';
		$this->scopes              = isset( $args['scopes'] ) && is_array( $args['scopes'] ) && ! empty( $args['scopes'] )
			? array_values( array_filter( array_map( 'strval', $args['scopes'] ) ) )
			: array( 'global' );
		$this->is_core             = ! empty( $args['is_core'] );
		$this->is_meta_cap         = ! empty( $args['is_meta_cap'] );

		// Source is set by the registry, not the caller.
		$this->source = 'fotogrids';

		if ( ! in_array( $this->panel, array( 'simple', 'advanced', 'both' ), true ) ) {
			$this->panel = 'advanced';
		}
	}

	/**
	 * Whether this is a logical permission (panel=simple with underlying caps)
	 * rather than an atomic WP capability.
	 */
	public function is_logical(): bool {
		return 'simple' === $this->panel && ! empty( $this->underlying_caps );
	}

	/**
	 * Internal: set the source. Called by Permission_Registry only.
	 *
	 * @internal
	 */
	public function set_source( string $source ): void {
		if ( ! in_array( $source, array( 'fotogrids', 'fotogrids-pro', 'third-party' ), true ) ) {
			$source = 'third-party';
		}
		$this->source = $source;
	}

	/**
	 * Serialise to an array shape suitable for the REST response and the
	 * admin JS layer.
	 *
	 * @return array<string, mixed>
	 */
	public function to_array(): array {
		return array(
			'key'                 => $this->key,
			'label'               => $this->label,
			'description'         => $this->description,
			'group'               => $this->group,
			'panel'               => $this->panel,
			'underlying_caps'     => $this->underlying_caps,
			'default_lowest_role' => $this->default_lowest_role,
			'source'              => $this->source,
			'tier'                => $this->tier,
			'scopes'              => $this->scopes,
			'is_core'             => $this->is_core,
			'is_meta_cap'         => $this->is_meta_cap,
			'is_logical'          => $this->is_logical(),
		);
	}
}
