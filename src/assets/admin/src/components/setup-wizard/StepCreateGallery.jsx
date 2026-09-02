import React from 'react';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

/**
 * Card artwork - one grid motif in two states.
 *
 * Both cards share the same cell geometry so the pair reads as a single
 * comparison: outlined and empty on the left, filled and arranged on the
 * right. Colours come from SCSS classes, never from attributes, so the
 * artwork follows the admin colour tokens.
 */
const ART_VIEWBOX = '0 0 224 98';

const ScratchArt = () => (
    <svg
        className="fotogrids-setup__create-art"
        viewBox={ ART_VIEWBOX }
        aria-hidden="true"
        focusable="false"
    >
        <g className="fotogrids-setup__create-art-outline">
            <rect x="24" y="18" width="39.5" height="28" rx="3" />
            <rect x="69.5" y="18" width="39.5" height="28" rx="3" />
            <rect x="115" y="18" width="39.5" height="28" rx="3" />
            <rect x="160.5" y="18" width="39.5" height="28" rx="3" />
            <rect x="24" y="52" width="39.5" height="28" rx="3" />
            <rect x="69.5" y="52" width="39.5" height="28" rx="3" />
            <rect x="115" y="52" width="39.5" height="28" rx="3" />
            <rect x="160.5" y="52" width="39.5" height="28" rx="3" />
        </g>
        <g className="fotogrids-setup__create-art-mark">
            <line x1="39" y1="32" x2="48.5" y2="32" />
            <line x1="43.75" y1="27.25" x2="43.75" y2="36.75" />
        </g>
    </svg>
);

const TemplateArt = () => (
    <svg
        className="fotogrids-setup__create-art"
        viewBox={ ART_VIEWBOX }
        aria-hidden="true"
        focusable="false"
    >
        <g className="fotogrids-setup__create-art-accent">
            <rect x="24" y="18" width="39.5" height="62" rx="3" opacity="1" />
            <rect x="69.5" y="52" width="39.5" height="28" rx="3" opacity="0.35" />
            <rect x="115" y="18" width="39.5" height="18" rx="3" opacity="0.5" />
            <rect x="160.5" y="62" width="39.5" height="18" rx="3" opacity="0.6" />
        </g>
        <g className="fotogrids-setup__create-art-cell">
            <rect x="69.5" y="18" width="39.5" height="28" rx="3" opacity="0.18" />
            <rect x="115" y="42" width="39.5" height="38" rx="3" opacity="0.18" />
            <rect x="160.5" y="18" width="39.5" height="38" rx="3" opacity="0.28" />
        </g>
    </svg>
);

/**
 * Step 5 - Create your first gallery.
 *
 * Two equal-weight *action* cards: clicking either one closes the wizard
 * and navigates the user to the matching surface. There is no selection
 * state - each card *is* the action.
 *
 * Props
 * ─────
 * onClose  fn()  Tells the wizard shell to close itself. We call this
 *                before issuing the navigation so the close fires
 *                synchronously while the click is in-flight.
 */
const CARDS = [
    {
        id:    'custom',
        icon:  'layout',
        color: 'var(--fg-background-secondary)',
        art:   ScratchArt,
        title: __( 'Build from scratch', 'fotogrids' ),
        body:  __( 'Start with an empty gallery. Drop in photos, pick a layout, embed on a page.', 'fotogrids' ),
        cta:   __( 'Build custom', 'fotogrids' ),
        href:  'post-new.php?post_type=fotogrids_gallery',
    },
    {
        id:    'template',
        icon:  'templates',
        color: 'color-mix(in srgb, var(--fg-blue) 8%, var(--fg-background-primary))',
        art:   TemplateArt,
        title: __( 'Choose a template', 'fotogrids' ),
        body:  __( 'Start from a ready-made layout we’ll fill with your photos.', 'fotogrids' ),
        cta:   __( 'Browse templates', 'fotogrids' ),
        href:  'admin.php?page=fotogrids-templates&fg_choose=1',
    },
];

const StepCreateGallery = ( { onClose } ) => {
    const handleClick = ( e, card ) => {
        e.preventDefault();
        if ( typeof onClose === 'function' ) {
            onClose();
        }
        window.location.assign( card.href );
    };

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--create">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'Create your first gallery', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'You can always change layout, items, and style later.', 'fotogrids' ) }
            </p>

            <div className="fotogrids-setup__card-grid fotogrids-setup__card-grid--create">
                { CARDS.map( ( card ) => {
                    const baseClass = 'fotogrids-setup__create-card';
                    const Art       = card.art;

                    return (
                        <button
                            type="button"
                            key={ card.id }
                            className={ `${ baseClass } ${ baseClass }--${ card.id }` }
                            style={ { '--fg-tool-card-color': card.color } }
                            onClick={ ( e ) => handleClick( e, card ) }
                        >
                            <div className={ `${ baseClass }-image` }>
                                <Art />
                            </div>
                            <div className={ `${ baseClass }-body` }>
                                <div className={ `${ baseClass }-body-header` }>
                                    <Icon name={ card.icon } />
                                    <span className={ `${ baseClass }-title` }>{ card.title }</span>
                                </div>
                                <span className={ `${ baseClass }-text` }>{ card.body }</span>
                                <span className={ `${ baseClass }-cta` }>
                                    { card.cta }
                                    <Icon name="arrow_right" />
                                </span>
                            </div>
                        </button>
                    );
                } ) }
            </div>
        </div>
    );
};

export default StepCreateGallery;
