<?php
/**
 * Grants store - read/write helpers for the fotogrids_permission_grants table.
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
 * Thin data layer over wp_fotogrids_permission_grants.
 *
 * Free never writes to this table directly through the UI - it ships role
 * defaults via Activator::add_capabilities() and serves reads for the matrix
 * teaser. Pro hooks the 'fotogrids/permissions/grants' filter on top of the
 * resolved (role × global × cap) view to add user / token / scoped grants.
 *
 * The table is shipped in Free so Pro can write into it on day one without a
 * migration step.
 *
 * @since 1.0.0
 */
final class Grants_Store {

    /*
     * ---------------------------------------------------------------------
     * PHPCS: WPDB direct-query sniffs disabled for this class.
     * ---------------------------------------------------------------------
     * This class is part of the FotoGrids custom-table data layer. Every
     * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
     * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
     * WP placeholders cannot bind. All user-supplied *values* are passed
     * through $wpdb->prepare(); where SQL is assembled incrementally or uses
     * a generated %d IN() list, the prepare call is a separate statement the
     * sniff cannot follow. Custom tables have no WP_Query / core-API
     * equivalent and no object-cache layer applies at this level.
     * ---------------------------------------------------------------------
     */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

    /**
     * Table name (without prefix). Use ::table() to get the prefixed name.
     */
    public const TABLE = 'fotogrids_permission_grants';

    /**
     * Allowed grantee types.
     *
     * @var string[]
     */
    public const GRANTEE_TYPES = [ 'role', 'user', 'token' ];

    /**
     * Allowed scope types.
     *
     * @var string[]
     */
    public const SCOPE_TYPES = [ 'global', 'gallery', 'album' ];

    /**
     * Allowed grant states.
     *
     * @var string[]
     */
    public const STATES = [ 'granted', 'denied' ];

    /**
     * Fully-qualified table name including the WP prefix.
     */
    public static function table(): string {
        global $wpdb;
        return $wpdb->prefix . self::TABLE;
    }

    /**
     * All grants that match the given filter, as raw row arrays.
     *
     * Pass null for any filter slot to leave it open. Typical reads:
     *
     *   - all( [ 'grantee_type' => 'role' ] )      role-level grants only
     *   - all( [ 'capability'   => 'manage_…' ] )  who has this cap?
     *   - all( [ 'scope_type'   => 'gallery',
     *           'scope_id'      => 17 ] )         per-object grants
     *
     * @param array{
     *     grantee_type?: string|null,
     *     grantee_id?: string|null,
     *     scope_type?: string|null,
     *     scope_id?: int|null,
     *     capability?: string|null,
     *     state?: string|null,
     * } $filter
     * @return array<int, array<string, mixed>>
     */
    public static function all( array $filter = [] ): array {
        global $wpdb;
        $table = self::table();

        $where  = [ '1=1' ];
        $params = [];

        foreach ( [ 'grantee_type', 'grantee_id', 'scope_type', 'capability', 'state' ] as $col ) {
            if ( isset( $filter[ $col ] ) && $filter[ $col ] !== null && $filter[ $col ] !== '' ) {
                $where[]  = "$col = %s";
                $params[] = (string) $filter[ $col ];
            }
        }
        if ( isset( $filter['scope_id'] ) && $filter['scope_id'] !== null ) {
            $where[]  = 'scope_id = %d';
            $params[] = (int) $filter['scope_id'];
        }

        $sql = "SELECT * FROM $table WHERE " . implode( ' AND ', $where );
        if ( ! empty( $params ) ) {
            // phpcs:ignore WordPress.DB.PreparedSQL
            $sql = $wpdb->prepare( $sql, $params );
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL
        $rows = $wpdb->get_results( $sql, ARRAY_A );
        return is_array( $rows ) ? $rows : [];
    }

    /**
     * Upsert a single grant.
     *
     * Used by Pro write endpoints. Free never calls this from the UI but Pro
     * hooks here for user + scoped + token grants. Role-global grants
     * additionally double-write to wp_capabilities so native current_user_can
     * keeps working.
     *
     * @param array{
     *     grantee_type: string,
     *     grantee_id:   string,
     *     capability:   string,
     *     scope_type?:  string,
     *     scope_id?:    int,
     *     state?:       string,
     *     source?:      string,
     *     expires_at?:  string|null,
     * } $grant
     * @return bool True on success, false on validation or DB error.
     */
    public static function upsert( array $grant ): bool {
        $grantee_type = isset( $grant['grantee_type'] ) ? (string) $grant['grantee_type'] : '';
        $grantee_id   = isset( $grant['grantee_id'] ) ? (string) $grant['grantee_id'] : '';
        $capability   = isset( $grant['capability'] ) ? (string) $grant['capability'] : '';
        $scope_type   = isset( $grant['scope_type'] ) ? (string) $grant['scope_type'] : 'global';
        $scope_id     = isset( $grant['scope_id'] ) ? (int) $grant['scope_id'] : 0;
        $state        = isset( $grant['state'] ) ? (string) $grant['state'] : 'granted';
        $source       = isset( $grant['source'] ) ? (string) $grant['source'] : 'fotogrids';

        if ( ! in_array( $grantee_type, self::GRANTEE_TYPES, true ) ) {
            return false;
        }
        if ( ! in_array( $scope_type, self::SCOPE_TYPES, true ) ) {
            return false;
        }
        if ( ! in_array( $state, self::STATES, true ) ) {
            return false;
        }
        if ( $grantee_id === '' || $capability === '' ) {
            return false;
        }

        global $wpdb;

        $data = [
            'grantee_type' => $grantee_type,
            'grantee_id'   => $grantee_id,
            'scope_type'   => $scope_type,
            'scope_id'     => $scope_id,
            'capability'   => $capability,
            'state'        => $state,
            'source'       => $source,
            'created_by'   => get_current_user_id(),
            'expires_at'   => array_key_exists( 'expires_at', $grant ) ? $grant['expires_at'] : null,
        ];

        $table = self::table();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$table} WHERE grantee_type = %s AND grantee_id = %s AND scope_type = %s AND scope_id = %d AND capability = %s",
            $grantee_type, $grantee_id, $scope_type, $scope_id, $capability
        ) );

        if ( $existing ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $updated = $wpdb->update( self::table(), $data, [ 'id' => (int) $existing ] );
            return $updated !== false;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $inserted = $wpdb->insert( self::table(), $data );
        return $inserted !== false;
    }

    /**
     * Delete grants matching the filter. Returns the number of rows deleted,
     * or false on DB error.
     *
     * Same filter shape as ::all(). At least one filter key must be set or
     * the call short-circuits with false - safety against accidental
     * truncation.
     *
     * @param array<string, mixed> $filter
     * @return int|false
     */
    public static function delete( array $filter ) {
        if ( empty( $filter ) ) {
            return false;
        }

        global $wpdb;
        $where  = [];
        $params = [];

        foreach ( [ 'grantee_type', 'grantee_id', 'scope_type', 'capability', 'state' ] as $col ) {
            if ( isset( $filter[ $col ] ) && $filter[ $col ] !== null && $filter[ $col ] !== '' ) {
                $where[]  = "$col = %s";
                $params[] = (string) $filter[ $col ];
            }
        }
        if ( isset( $filter['scope_id'] ) && $filter['scope_id'] !== null ) {
            $where[]  = 'scope_id = %d';
            $params[] = (int) $filter['scope_id'];
        }

        if ( empty( $where ) ) {
            return false;
        }

        $table = self::table();
        $sql   = "DELETE FROM {$table} WHERE " . implode( ' AND ', $where );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
        $deleted = $wpdb->query( $wpdb->prepare( $sql, ...$params ) );

        return $deleted === false ? false : (int) $deleted;
    }

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
