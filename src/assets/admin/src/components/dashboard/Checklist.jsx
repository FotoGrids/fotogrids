/**
 * Setup Checklist Component
 */
import React from 'react';

const { __ } = wp.i18n;

const Checklist = ({ galleriesCount, shortcodesUsed }) => {
    const completedSteps = 2 + (galleriesCount > 0 ? 1 : 0) + (shortcodesUsed ? 1 : 0);
    const progressPercent = Math.min(100, (completedSteps / 5) * 100);

    return (
        <div className="fotogrids-admin-block-card fg-abc-checklist">
            <div className="fotogrids-admin-block-card-header">
                <div
                    className="fotogrids-admin-block-card-header-icon fg-header-icon-light"
                    dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.list }}
                />
                <h3>{__('Complete Your Setup', 'fotogrids')}</h3>
            </div>
            <ul className="fg-abc-checklist-items">
                <li className="completed">
                    <span dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.check }} />
                    {__('Plugin installed and activated', 'fotogrids')}
                </li>
                <li className="completed">
                    <span dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.check }} />
                    {__('Dashboard page visited', 'fotogrids')}
                </li>
                <li className={galleriesCount > 0 ? 'completed' : ''}>
                    {galleriesCount > 0 ? (
                        <span dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.check }} />
                    ) : (
                        <span />
                    )}
                    {__('Create your first gallery', 'fotogrids')}
                </li>
                <li>
                    <span />
                    {__('Configure display settings', 'fotogrids')}
                </li>
                <li className={shortcodesUsed ? 'completed' : ''}>
                    {shortcodesUsed ? (
                        <span dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.check }} />
                    ) : (
                        <span />
                    )}
                    {__('Publish gallery on your site', 'fotogrids')}
                </li>
            </ul>
            <div className="progress-bar-container">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
};

export default Checklist;

