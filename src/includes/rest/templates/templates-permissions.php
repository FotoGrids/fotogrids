<?php
namespace FotoGrids\REST\Templates;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Templates Permissions Handler
 *
 * Handles permission checks for template-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Templates_Permissions {

    /**
     * Check if user can view templates
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_templates_read( $request ) {
        return current_user_can( 'edit_posts' );
    }

    /**
     * Check if user can apply templates
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_template_apply( $request ) {
        $post_id = $request->get_param( 'post_id' );
        $post_type = $request->get_param( 'post_type' );

        if ( ! $post_id || ! $post_type ) {
            return false;
        }

        $post = get_post( $post_id );

        if ( ! $post ) {
            return false;
        }

        $expected_types = array(
            'gallery' => 'fotogrids_gallery',
            'album'   => 'fotogrids_album',
        );
        $expected_post_type = isset( $expected_types[ $post_type ] ) ? $expected_types[ $post_type ] : $post_type;

        if ( $post->post_type !== $expected_post_type ) {
            return false;
        }

        return current_user_can( 'edit_post', $post_id );
    }

    /**
     * Check if user can save templates (Pro feature)
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission and Pro license
     */
    public static function check_template_save( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return false;
        }

        // Templates saving is a Pro feature
        return \FotoGrids\License_Manager::has_pro();
    }

    /**
     * Check if user can delete templates
     *
     * @param \WP_REST_Request $request Request object
     * @return bool True if user has permission
     */
    public static function check_template_delete( $request ) {
        if ( ! current_user_can( 'edit_posts' ) ) {
            return false;
        }

        $template_id = $request->get_param( 'id' );

        if ( ! $template_id ) {
            return false;
        }

        // Check if template belongs to current user (for user templates)
        $user_templates = get_user_meta( get_current_user_id(), 'fotogrids_user_templates', true );
        $user_templates = $user_templates ? json_decode( $user_templates, true ) : array();

        // Check if template exists in user templates
        foreach ( $user_templates as $template ) {
            if ( isset( $template['id'] ) && $template['id'] === $template_id ) {
                return true;
            }
        }

        return false;
    }
}





