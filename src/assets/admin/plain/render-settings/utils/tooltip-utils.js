/**
 * FotoGrids Tooltip Utilities
 *
 * Vanilla-JS (wp.element) tooltip primitives for the non-React render helpers
 * (renderButtonGroup, renderLayoutGrid, renderHoverEffectsGrid, etc.).
 *
 * For React admin pages, import Tooltip / ProBadge from
 * assets/admin/src/components/ instead.
 *
 * Exposes: window.FotoGridsTooltip.ProBadge( props )
 */
( function () {
    'use strict';

    const h = wp.element.createElement;

    // ── Tier label map ────────────────────────────────────────────────────────

    function tierLabel( tier ) {
        switch ( tier ) {
            case 'pro_starter': return 'Pro Starter';
            case 'pro_plus':    return 'Pro Plus';
            case 'agency':      return 'Agency';
            default:            return 'Pro';
        }
    }

    // ── Lock SVG icon ─────────────────────────────────────────────────────────

    function LockIcon() {
        return h( 'svg', {
            className:   'fg-pro-badge__lock-icon',
            xmlns:       'http://www.w3.org/2000/svg',
            viewBox:     '0 0 16 16',
            width:       '10',
            height:      '10',
            'aria-hidden': 'true',
            focusable:   'false',
        },
            h( 'path', {
                fill: 'currentColor',
                d: 'M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1ZM6 5a2 2 0 1 1 4 0v2H6V5Z',
            } )
        );
    }

    // ── Tooltip bubble (portal) ───────────────────────────────────────────────
    //
    // Because render helpers use wp.element (React) without a module system, we
    // implement the tooltip as a small stateful class component so we can use
    // refs and state without importing hooks.

    class TooltipPortal extends wp.element.Component {
        constructor( props ) {
            super( props );
            this.state    = { visible: false, top: 0, left: 0 };
            this.triggerRef = wp.element.createRef();
            this.bubbleRef  = wp.element.createRef();

            this.show = this.show.bind( this );
            this.hide = this.hide.bind( this );
        }

        show() {
            this.setState( { visible: true }, () => this.reposition() );
        }

        hide() {
            this.setState( { visible: false } );
        }

        reposition() {
            if ( ! this.triggerRef.current || ! this.bubbleRef.current ) {
                return;
            }

            const trigger  = this.triggerRef.current.getBoundingClientRect();
            const bubble   = this.bubbleRef.current.getBoundingClientRect();
            const scrollY  = window.scrollY;
            const scrollX  = window.scrollX;
            const gap      = 6;
            const position = this.props.position || 'top';

            let top = 0, left = 0;

            switch ( position ) {
                case 'bottom':
                    top  = trigger.bottom + scrollY + gap;
                    left = trigger.left + scrollX + trigger.width / 2 - bubble.width / 2;
                    break;
                case 'left':
                    top  = trigger.top + scrollY + trigger.height / 2 - bubble.height / 2;
                    left = trigger.left + scrollX - bubble.width - gap;
                    break;
                case 'right':
                    top  = trigger.top + scrollY + trigger.height / 2 - bubble.height / 2;
                    left = trigger.right + scrollX + gap;
                    break;
                case 'top':
                default:
                    top  = trigger.top + scrollY - bubble.height - gap;
                    left = trigger.left + scrollX + trigger.width / 2 - bubble.width / 2;
                    break;
            }

            // Keep inside viewport horizontally.
            const vw = document.documentElement.clientWidth;
            if ( left < 8 ) {
                left = 8;
            } else if ( left + bubble.width > vw - 8 ) {
                left = vw - bubble.width - 8;
            }

            this.setState( { top, left } );
        }

        render() {
            const { children, content, position = 'top' } = this.props;
            const { visible, top, left }                  = this.state;

            const bubble = visible
                ? wp.element.createPortal(
                    h( 'div', {
                        ref:       this.bubbleRef,
                        className: 'fg-tooltip fg-tooltip--' + position,
                        style:     { top, left },
                        role:      'tooltip',
                    }, content ),
                    document.body
                  )
                : null;

            return h( wp.element.Fragment, null,
                h( 'span', {
                    ref:          this.triggerRef,
                    className:    'fg-tooltip-trigger',
                    onMouseEnter: this.show,
                    onMouseLeave: this.hide,
                }, children ),
                bubble
            );
        }
    }

    // ── ProBadge ─────────────────────────────────────────────────────────────

    /**
     * @param {object} props
     * @param {string} props.tier    tier_required from settings JSON
     * @param {string} [props.state] "teaser" | "locked"
     * @param {string} [props.position] tooltip position (default: "top")
     */
    function ProBadge( { tier, state, position } ) {
        if ( ! tier || tier === 'free' ) {
            return null;
        }

        const label   = tierLabel( tier );
        const content = state === 'locked'
            ? 'Renew your ' + label + ' plan to unlock this feature'
            : 'Available from ' + label + ' plan';

        return h( TooltipPortal, { content, position: position || 'top' },
            h( 'span', {
                className:   'fg-pro-badge',
                'aria-label': content,
            }, h( LockIcon ) )
        );
    }

    // ── Export ────────────────────────────────────────────────────────────────

    window.FotoGridsTooltip = window.FotoGridsTooltip || {};
    window.FotoGridsTooltip.ProBadge = ProBadge;

} )();
