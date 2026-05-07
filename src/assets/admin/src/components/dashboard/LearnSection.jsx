/**
 * Learn & Get Inspired Section Component
 */
import React from 'react';

const { __ } = wp.i18n;

const LearnSection = () => {
    return (
        <div className="fotogrids-admin-block-card fg-abc-learn">
            <div className="fotogrids-admin-block-card-header">
                <div
                    className="fotogrids-admin-block-card-header-icon"
                    dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.book }}
                />
                <h3>{__('Learn & Get Inspired', 'fotogrids')}</h3>
            </div>
            <div className="fg-abc-learn-options">
                <a href="#" className="fg-abc-learn-option" data-icon-color="blue">
                    <span
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.rocket }}
                    />
                    {__('Getting Started', 'fotogrids')}
                </a>
                <a href="#" className="fg-abc-learn-option" data-icon-color="yellow">
                    <span
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.puzzle }}
                    />
                    {__('Explore Integrations', 'fotogrids')}
                </a>
                <a href="#" className="fg-abc-learn-option" data-icon-color="green">
                    <span
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.bulb }}
                    />
                    {__('Productivity Hacks', 'fotogrids')}
                </a>
                <a href="#" className="fg-abc-learn-option" data-icon-color="red">
                    <span
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.help }}
                    />
                    {__('Help Center', 'fotogrids')}
                </a>
            </div>
        </div>
    );
};

export default LearnSection;

