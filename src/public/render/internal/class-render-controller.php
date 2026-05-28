<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Breakpoint_Config;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Orchestrates the six-stage render pipeline.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Render_Controller {

    public function __construct(
        private readonly Style_Var_Builder $style_var_builder,
        private readonly Asset_Resolver $asset_resolver,
        private readonly Item_Renderer $item_renderer,
        private readonly Breakpoint_Config $breakpoints,
    ) {}

    /**
     * Returns a request-scoped render controller instance.
     *
     * Breakpoint_Config is resolved once from general settings (and filtered)
     * so every gallery on the same page uses consistent breakpoints.
     *
     * @since  1.0.0
     * @return self
     */
    public static function factory(): self {
        static $instance = null;

        if ( $instance === null ) {
            $instance = new self(
                style_var_builder: new Style_Var_Builder(),
                asset_resolver:    Asset_Resolver::instance(),
                item_renderer:     new Item_Renderer(),
                breakpoints:       Breakpoint_Config::from_settings(),
            );
        }

        return $instance;
    }

    /**
     * Renders a collection from the provided context.
     *
     * @since  1.0.0
     * @param  Render_Context $render Render context.
     * @return Render_Result
     */
    public function render( Render_Context $render ): Render_Result {
        try {
            $render = Hooks::apply_filter( 'render_settings', $render, $render );
            Hooks::fire_action( 'before_render', $render );

            $active_modules = [
                'gates'      => [],
                'decorators' => [],
                'layouts'    => [],
                'features'   => [],
                'sidecars'   => [],
            ];

            foreach ( Module_Registry::active_modules( 'gates', $render ) as $gate_module ) {
                $this->asset_resolver->collect( $gate_module->assets( $render ), $gate_module->origin() );
                $active_modules['gates'][] = $gate_module->id();

                $gate_result = $gate_module->evaluate( $render );
                if ( ! $gate_result->passed ) {
                    $this->asset_resolver->flush();
                    $render_result = new Render_Result(
                        html:           $gate_result->blocked_html,
                        instance_id:    $render->meta->instance_id,
                        active_modules: $active_modules,
                        http_status:    $gate_result->http_status,
                    );
                    Hooks::fire_action( 'after_render', $render, $render_result );

                    return $render_result;
                }
            }

            $collection_items        = $render->items;
            $layout_css_classes      = [];
            $wrapper_data_attrs      = [];
            $css_variables           = [];

            foreach ( Module_Registry::active_modules( 'decorators', $render ) as $decorator_module ) {
                $collection_items   = $decorator_module->decorate_items( $collection_items, $render );
                $wrapper_data_attrs = array_merge( $wrapper_data_attrs, $decorator_module->wrapper_data_attrs( $render ) );
                $css_variables      = array_merge( $css_variables, $decorator_module->style_vars( $render ) );
                $this->asset_resolver->collect( $decorator_module->assets( $render ), $decorator_module->origin() );
                $active_modules['decorators'][] = $decorator_module->id();
            }

            $collection_items = Hooks::apply_filter( 'collection_items', $collection_items, $render );
            $render           = $render->with( [ 'items' => $collection_items ] );

            $layout_module = $this->select_layout( $render );
            if ( $layout_module === null ) {
                $show_inline_error = ! empty( $render->settings['_show_render_errors'] );
                $this->asset_resolver->flush();
                return Render_Result::error(
                    message:           sprintf( "No layout supports id '%s'", $render->layout->layout_id ),
                    gallery_id:        $render->meta->gallery_id,
                    instance_id:       $render->meta->instance_id,
                    show_inline_error: $show_inline_error,
                    http_status:       500
                );
            }

            $layout_css_classes = array_merge( $layout_css_classes, $layout_module->structural_classes( $render ) );
            $wrapper_data_attrs = array_merge( $wrapper_data_attrs, $layout_module->wrapper_data_attrs( $render ) );
            $css_variables      = array_merge( $css_variables, $layout_module->style_vars( $render ) );
            $this->asset_resolver->collect( $layout_module->assets( $render ), $layout_module->origin() );
            $active_modules['layouts'][] = $layout_module->id();

            $layout_inner_html     = $layout_module->render( $render, $this->item_renderer );

            // Partial 'items_only' short-circuit. Used by the REST
            // /gallery/render endpoint for pagination requests where the
            // client only needs the new items to append/replace into an
            // existing gallery wrapper — no wrapper, no chrome, no
            // sidecars, no <style> block. The collected CSS asset URLs are
            // still returned via Asset_Resolver so the client can inject
            // any missing stylesheets, mirroring the album-AJAX flow.
            if ( $render->meta->partial === 'items_only' ) {
                $render_result = new Render_Result(
                    html:           $layout_inner_html,
                    instance_id:    $render->meta->instance_id,
                    active_modules: $active_modules,
                    http_status:    200,
                );
                Hooks::fire_action( 'after_render', $render, $render_result );
                $this->asset_resolver->flush();

                return $render_result;
            }

            $feature_before_html   = '';
            $feature_appendix_html = '';
            $feature_after_html    = '';

            foreach ( Module_Registry::active_modules( 'features', $render ) as $feature_module ) {
                $wrapper_data_attrs    = array_merge( $wrapper_data_attrs, $feature_module->wrapper_data_attrs( $render ) );
                $css_variables         = array_merge( $css_variables, $feature_module->style_vars( $render ) );
                $feature_before_html   .= $feature_module->html_before( $render );
                $feature_appendix_html .= $feature_module->html_appendix( $render );
                $feature_after_html    .= $feature_module->html_after( $render );
                $this->asset_resolver->collect( $feature_module->assets( $render ), $feature_module->origin() );
                $active_modules['features'][] = $feature_module->id();
            }

            $sidecar_html = '';
            foreach ( Module_Registry::active_modules( 'sidecars', $render ) as $sidecar_module ) {
                $sidecar_html .= $sidecar_module->render( $render );
                $this->asset_resolver->collect( $sidecar_module->assets( $render ), $sidecar_module->origin() );
                $active_modules['sidecars'][] = $sidecar_module->id();
            }

            $layout_css_classes = Hooks::apply_filter( 'wrapper_css_classes', $layout_css_classes, $render );
            $wrapper_data_attrs = Hooks::apply_filter( 'wrapper_data_attrs', $wrapper_data_attrs, $render );
            $css_variables      = Hooks::apply_filter( 'css_variables', $css_variables, $render );
            $active_modules     = Hooks::apply_filter( 'active_modules', $active_modules, $render );

            $wrapper_html = $this->build_wrapper(
                render:             $render,
                layout_css_classes: $layout_css_classes,
                wrapper_data_attrs: $wrapper_data_attrs,
                css_variables:      $css_variables,
                inner_html:         $feature_before_html . $layout_inner_html . $feature_appendix_html,
            );

            $render_result = new Render_Result(
                html:           $wrapper_html . $feature_after_html . $sidecar_html,
                instance_id:    $render->meta->instance_id,
                active_modules: $active_modules,
                http_status:    200,
            );

            $filtered_html = Hooks::apply_filter( 'final_html', $render_result->html, $render );
            $render_result = $render_result->with_html( is_string( $filtered_html ) ? $filtered_html : $render_result->html );

            Hooks::fire_action( 'after_render', $render, $render_result );
            $this->asset_resolver->flush();

            return $render_result;
        } catch ( \Throwable $throwable ) {
            $show_inline_error = ! empty( $render->settings['_show_render_errors'] );
            $this->asset_resolver->flush();
            return Render_Result::error(
                message:           $throwable->getMessage(),
                gallery_id:        $render->meta->gallery_id,
                instance_id:       $render->meta->instance_id,
                show_inline_error: $show_inline_error,
                http_status:       500
            );
        }
    }

    /**
     * Selects the matching active layout module.
     *
     * @since  1.0.0
     * @param  Render_Context $render Render context.
     * @return Layout|null
     */
    private function select_layout( Render_Context $render ): ?Layout {
        foreach ( Module_Registry::active_modules( 'layouts', $render ) as $layout_module ) {
            if ( $layout_module->layout_key() === $render->layout->layout_id ) {
                return $layout_module;
            }
        }

        return null;
    }

    /**
     * Builds wrapper HTML from assembled rendering state.
     *
     * The wrapper element always carries exactly one class ('fotogrids-gallery'
     * or 'fotogrids-album') plus any layout structural classes (e.g.
     * 'fg-layout-grid'). All decorator and feature state is expressed as
     * 'data-fg-*' attributes. 'data-fg-gallery-id' is always written first.
     *
     * @since  1.0.0
     * @param  Render_Context                       $render             Render context.
     * @param  array<int, string>                   $layout_css_classes Layout structural classes.
     * @param  array<string, string>                $wrapper_data_attrs Merged data-fg-* attributes.
     * @param  array<string, string|Responsive_Var> $css_variables      Accumulated CSS vars.
     * @param  string                               $inner_html         Wrapper inner HTML.
     * @return string
     */
    private function build_wrapper(
        Render_Context $render,
        array $layout_css_classes,
        array $wrapper_data_attrs,
        array $css_variables,
        string $inner_html
    ): string {
        // Base class is 'fotogrids-gallery' for galleries and 'fotogrids-album'
        // for albums-as-collections (collection_kind discriminator on Render_Meta).
        // Layout classes follow.
        $base_class = $render->meta->collection_kind === Collection_Kind::ALBUM
            ? 'fotogrids-album'
            : 'fotogrids-gallery';
        // We keep .fotogrids-gallery on album wrappers too — the runtime's
        // .fotogrids-gallery selector, the MutationObserver and every
        // per-gallery feature module's onGallery() callback all key off it,
        // and an album-as-collection IS a gallery-shaped render. The
        // 'fotogrids-album' class is the additional discriminator decorators
        // and CSS can use to differentiate.
        $base_classes = $render->meta->collection_kind === Collection_Kind::ALBUM
            ? [ 'fotogrids-gallery', 'fotogrids-album' ]
            : [ 'fotogrids-gallery' ];
        $all_classes     = array_values( array_unique( array_merge( $base_classes, $layout_css_classes ) ) );
        $class_attribute = esc_attr( implode( ' ', $all_classes ) );
        unset( $base_class );

        // data-fg-gallery-id is always the first attribute. For album
        // renders gallery_id is 0; data-fg-album-id is added too so
        // anything that needs the primary identifier for an album can
        // read it directly.
        $ordered_attrs = [ 'data-fg-gallery-id' => (string) $render->meta->gallery_id ];
        if ( $render->meta->collection_kind === Collection_Kind::ALBUM && $render->meta->album_id !== null ) {
            $ordered_attrs['data-fg-album-id'] = (string) $render->meta->album_id;
        }
        foreach ( $wrapper_data_attrs as $attr_name => $attr_value ) {
            if ( $attr_name !== 'data-fg-gallery-id' && $attr_name !== 'data-fg-album-id' ) {
                $ordered_attrs[ $attr_name ] = $attr_value;
            }
        }

        $serialized_attributes = '';
        foreach ( $ordered_attrs as $attr_name => $attr_value ) {
            $serialized_attributes .= sprintf( ' %s="%s"', esc_attr( $attr_name ), esc_attr( $attr_value ) );
        }

        $inline_style = $this->style_var_builder->build_style_element(
            css_variables: $css_variables,
            instance_id:   $render->meta->instance_id,
            breakpoints:   $this->breakpoints,
        );

        return sprintf(
            '<div id="%s" class="%s"%s>%s%s</div>',
            esc_attr( $render->meta->instance_id ),
            $class_attribute,
            $serialized_attributes,
            $inline_style,
            $inner_html
        );
    }
}
