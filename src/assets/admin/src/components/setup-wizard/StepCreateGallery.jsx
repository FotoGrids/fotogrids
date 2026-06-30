import React from 'react';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

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
        color: 'var(--fg-interactive-selected-bg-darker)',
        title: __( 'Build from scratch', 'fotogrids' ),
        body:  __( 'Start with an empty gallery. Drop in photos, pick a layout, embed on a page.', 'fotogrids' ),
        cta:   __( 'Build custom', 'fotogrids' ),
        href:  'post-new.php?post_type=fotogrids_gallery',
    },
    {
        id:    'template',
        icon:  'templates',
        color: 'var(--fg-blue)',
        title: __( 'Choose a template', 'fotogrids' ),
        body:  __( 'Start from a ready-made layout we’ll fill with your photos.', 'fotogrids' ),
        cta:   __( 'Browse templates', 'fotogrids' ),
        href:  'admin.php?page=fotogrids-templates',
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

                    return (
                        <button
                            type="button"
                            key={ card.id }
                            className={ `${ baseClass } ${ baseClass }--${ card.id }` }
                            style={ { '--fg-tool-card-color': card.color } }
                            onClick={ ( e ) => handleClick( e, card ) }
                        >
                            <div className={ `${ baseClass }-image` }></div>
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
