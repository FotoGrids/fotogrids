/**
 * Main CTA Component
 * Shows different CTAs based on whether galleries exist
 */
import React from 'react';

const { __ } = wp.i18n;

const MainCTA = ({ galleriesCount, itemsCount }) => {
    if (galleriesCount === 0) {
        return (
            <div className="fotogrids-admin-block-card fg-abc-main-cta">
                <div className="fotogrids-admin-block-card-content">
                    <h3>
                        <span>{__('Create Your', 'fotogrids')} </span>
                        {__('First Gallery', 'fotogrids')}
                    </h3>
                    <p>{__('Build the first beautiful photo gallery in minutes.', 'fotogrids')}</p>
                    <a href="post-new.php?post_type=fotogrids_gallery" className="button button-primary">
                        {__('Get Started', 'fotogrids')}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="fotogrids-admin-block-card fg-abc-main-cta">
            <div className="fotogrids-admin-block-card-content">
                <h3>
                    {__('Grow Your Gallery', 'fotogrids')}
                </h3>
                <p>
                    {itemsCount === 0
                        ? __('Add photos to your galleries to bring them to life.', 'fotogrids')
                        : __('Create more galleries or explore advanced features to showcase your photos.', 'fotogrids')
                    }
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <a href="post-new.php?post_type=fotogrids_gallery" className="button button-primary">
                        {__('New Gallery', 'fotogrids')}
                    </a>
                    {itemsCount === 0 && (
                        <a href="edit.php?post_type=fotogrids_gallery" className="button button-secondary">
                            {__('Add Photos', 'fotogrids')}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainCTA;

