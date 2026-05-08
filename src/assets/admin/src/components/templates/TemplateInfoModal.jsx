import React from 'react';
import Modal from '../shared/Modal';

const { __ } = wp.i18n;

const TemplateInfoModal = ({ isOpen, onClose }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={__('About Templates', 'fotogrids')}
            size="medium"
        >
            <div className="fotogrids-template-info-content">
                <div className="fotogrids-template-info-content__section fg-tm-cs__50">
                    <h4>{__("What's a Gallery Template?", 'fotogrids')}</h4>
                    <p>
                        {__('A Gallery Template is a complete, ready-to-use gallery configuration that you can apply to any of your galleries.', 'fotogrids')}
                    </p>
                    <p>
                        {__('It includes all the layout settings, styling options, hover effects, spacing, and display preferences that you\'d expect in a professionally designed gallery.', 'fotogrids')}
                    </p>
                </div>

                <div className="fotogrids-template-info-content__section fg-tm-cs__50">
                    <h4>{__("What's an Album Template?", 'fotogrids')}</h4>
                    <p>
                        {__('An Album is a container that groups multiple galleries together.', 'fotogrids')}
                    </p>
                    <p>
                        {__('An Album Template controls how that container looks - the album grid layout, cover styles, and how visitors browse between the galleries inside it.', 'fotogrids')}
                    </p>
                    <p>
                        {__('Important: an Album Template only affects the album itself, not the individual galleries inside it. Each gallery keeps its own settings and template independently.', 'fotogrids')}
                    </p>
                </div>

                <div className="fotogrids-template-info-content__section">
                    <h4>{__("What's going on in the Template Library?", 'fotogrids')}</h4>
                    <p>
                        {__('Browse through our collection of pre-designed templates organized by category. Each template is optimized for different use cases - from simple grid layouts to complex masonry and justified galleries.', 'fotogrids')}
                    </p>
                    <p>
                        {__('Preview any template to see exactly how it will look with your content. Once you\'ve found the perfect match, apply it to your gallery with just a few clicks.', 'fotogrids')}
                    </p>
                    <p>
                        <span className="fotogrids-pro-badge">{__('PRO', 'fotogrids')}</span>{' '}
                        {__('With a Pro license, you can save your own gallery configurations as reusable templates and share them across multiple galleries.', 'fotogrids')}
                    </p>
                </div>

                <p className="fotogrids-template-info-footer">
                    {__('Happy browsing!', 'fotogrids')}
                </p>
            </div>
        </Modal>
    );
};

export default TemplateInfoModal;

