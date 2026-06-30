import React from 'react';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

/**
 * Step 2 - "What best describes you?"
 *
 * Six persona cards, exactly one selectable at a time. Required: the
 * shell disables Continue until `picked` is non-null. State is owned by
 * the shell (SetupWizardPage) so it can drive the Continue gating; this
 * component is purely presentational.
 *
 * @param {Object}            props
 * @param {string|null}       props.picked    Currently selected persona id, or null.
 * @param {Function}          props.onPick    Called with the persona id when a card is clicked.
 */
const PERSONAS = [
    {
        id:    'developer',
        icon:  'code',
        title: __( 'Developer / Web Creator', 'fotogrids' ),
        body:  __( 'Building polished sites and galleries for client projects.', 'fotogrids' ),
    },
    {
        id:    'photographer',
        icon:  'camera',
        title: __( 'Photographer', 'fotogrids' ),
        body:  __( 'Showcasing your work, sharing galleries, and selling prints.', 'fotogrids' ),
    },
    {
        id:    'personal',
        icon:  'feather',
        title: __( 'Personal Website', 'fotogrids' ),
        body:  __( 'Creating a blog, portfolio, hobby site, or creative archive.', 'fotogrids' ),
    },
    {
        id:    'agency',
        icon:  'users',
        title: __( 'Agency', 'fotogrids' ),
        body:  __( 'Managing websites and visual content across many client sites.', 'fotogrids' ),
    },
    {
        id:    'business',
        icon:  'briefcase',
        title: __( 'Business Owner', 'fotogrids' ),
        body:  __( 'Presenting your brand, services, team, products, or portfolio.', 'fotogrids' ),
    },
    {
        id:    'shop',
        icon:  'cart',
        title: __( 'Online Shop', 'fotogrids' ),
        body:  __( 'Selling products with rich, flexible, photo-focused galleries.', 'fotogrids' ),
    },
];

const StepPersona = ( { picked = null, onPick } ) => {
    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--persona">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'What best describes you?', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'We’ll use this to tailor a few defaults. Skip if you’d rather not say.', 'fotogrids' ) }
            </p>

            <div
                className="fotogrids-setup__card-grid fotogrids-setup__card-grid--persona"
                role="radiogroup"
                aria-label={ __( 'Choose the option that best describes you', 'fotogrids' ) }
            >
                { PERSONAS.map( ( opt ) => {
                    const isActive = picked === opt.id;
                    return (
                        <button
                            type="button"
                            key={ opt.id }
                            role="radio"
                            aria-checked={ isActive }
                            data-persona={ opt.id }
                            className={ `fotogrids-setup__choice-card ${ isActive ? 'fg-is-active' : '' }` }
                            onClick={ () => onPick && onPick( opt.id ) }
                        >
                            <span className="fotogrids-setup__choice-card-icon" aria-hidden="true">
                                <Icon name={ opt.icon } />
                            </span>
                            <span className="fotogrids-setup__choice-card-body">
                                <span className="fotogrids-setup__choice-card-title">{ opt.title }</span>
                                <span className="fotogrids-setup__choice-card-text">{ opt.body }</span>
                            </span>
                        </button>
                    );
                } ) }
            </div>
        </div>
    );
};

export default StepPersona;
