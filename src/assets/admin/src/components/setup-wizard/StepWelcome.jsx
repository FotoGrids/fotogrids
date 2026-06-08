import React from 'react';

const { __ } = wp.i18n;

/**
 * Step 1 — Welcome. Sets expectations, no inputs.
 *
 * Reduces step-1 abandonment by being warm but factual: tells the user how
 * many steps and roughly how long, then surfaces the three things FotoGrids
 * does for them.
 */
const StepWelcome = () => {
    const features = [
        {
            id: 'galleries',
            title: __( 'Galleries', 'fotogrids' ),
            body: __( 'Pick photos from the Media Library, choose a layout, embed on a page.', 'fotogrids' ),
        },
        {
            id: 'albums',
            title: __( 'Albums', 'fotogrids' ),
            body: __( 'Group galleries together. Same layouts, same lightbox, one shortcode.', 'fotogrids' ),
        },
        {
            id: 'lightbox',
            title: __( 'Lightbox', 'fotogrids' ),
            body: __( 'A clean overlay viewer with keyboard navigation, captions, and sharing.', 'fotogrids' ),
        },
    ];

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--welcome">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'Welcome to FotoGrids', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'Four quick steps. About a minute. Then you’ll build your first gallery.', 'fotogrids' ) }
            </p>

            <ul className="fotogrids-setup__feature-grid" role="list">
                { features.map( ( feature ) => (
                    <li key={ feature.id } className="fotogrids-setup__feature-card">
                        <span
                            className={ `fotogrids-setup__feature-icon fotogrids-setup__feature-icon--${ feature.id }` }
                            aria-hidden="true"
                        />
                        <h3 className="fotogrids-setup__feature-title">{ feature.title }</h3>
                        <p className="fotogrids-setup__feature-body">{ feature.body }</p>
                    </li>
                ) ) }
            </ul>
        </div>
    );
};

export default StepWelcome;
