import React from 'react';
import { createRoot } from 'react-dom/client';
import { __ } from '@wordpress/i18n';

// Import the simplified gallery block
import './blocks/gallery-block-simple';

// Simple admin interface
const FotoGridsAdmin: React.FC = () => {
    return (
        <div className="fotogrids-admin">
            <h1>{__('FotoGrids', 'fotogrids')}</h1>
            <div className="fotogrids-admin-content">
                <div className="fotogrids-welcome">
                    <h2>{__('Welcome to FotoGrids!', 'fotogrids')}</h2>
                    <p>{__('Create beautiful photo galleries and albums with ease.', 'fotogrids')}</p>
                    
                    <div className="fotogrids-quick-actions">
                        <a href="edit.php?post_type=fotogrids_gallery" className="button button-primary">
                            {__('Create New Gallery', 'fotogrids')}
                        </a>
                        <a href="edit.php?post_type=fotogrids_album" className="button">
                            {__('Create New Album', 'fotogrids')}
                        </a>
                    </div>
                    
                    <div className="fotogrids-features">
                        <h3>{__('Features', 'fotogrids')}</h3>
                        <ul>
                            <li>{__('Multiple gallery templates (Grid, Masonry, Justified)', 'fotogrids')}</li>
                            <li>{__('Responsive design that works on all devices', 'fotogrids')}</li>
                            <li>{__('Lightbox integration for image viewing', 'fotogrids')}</li>
                            <li>{__('Lazy loading for better performance', 'fotogrids')}</li>
                            <li>{__('Gutenberg block support', 'fotogrids')}</li>
                            <li>{__('Shortcode support for classic editor', 'fotogrids')}</li>
                        </ul>
                    </div>
                    
                    <div className="fotogrids-getting-started">
                        <h3>{__('Getting Started', 'fotogrids')}</h3>
                        <ol>
                            <li>{__('Create a new gallery and upload your images', 'fotogrids')}</li>
                            <li>{__('Choose a template and customize the settings', 'fotogrids')}</li>
                            <li>{__('Insert the gallery using the Gutenberg block or shortcode', 'fotogrids')}</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Initialize admin interface
document.addEventListener('DOMContentLoaded', () => {
    const adminContainer = document.getElementById('fotogrids-admin-root');
    if (adminContainer) {
        const root = createRoot(adminContainer);
        root.render(<FotoGridsAdmin />);
    }
});

// Export for potential use elsewhere
export default FotoGridsAdmin;
