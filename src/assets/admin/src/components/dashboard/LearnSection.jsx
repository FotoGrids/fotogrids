/**
 * Learn & Get Inspired Section Component
 */
import React from 'react';
import Icon from '../shared/Icon';
import { fgGoUrl } from '../../utils/go-url';

const { __ } = wp.i18n;

const LearnSection = () => {
    return (
        <div className="fotogrids-admin-block-card fg-abc-learn">
            <div className="fotogrids-admin-block-card-header">
                <Icon name="book" className="fotogrids-admin-block-card-header-icon" />
                <h3>{__('Learn & Get Inspired', 'fotogrids')}</h3>
            </div>
            <div className="fg-abc-learn-options">
                <a
                    href={fgGoUrl('getting-started', 'dashboard', 'learn', 'getting-started')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fg-abc-learn-option"
                    data-icon-color="blue"
                >
                    <Icon name="rocket" className="fotogrids-admin-block-card-icon" />
                    {__('Getting Started', 'fotogrids')}
                </a>
                <a
                    href={fgGoUrl('integrations', 'dashboard', 'learn', 'integrations')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fg-abc-learn-option"
                    data-icon-color="yellow"
                >
                    <Icon name="puzzle" className="fotogrids-admin-block-card-icon" />
                    {__('Explore Integrations', 'fotogrids')}
                </a>
                <a
                    href={fgGoUrl('productivity-hacks', 'dashboard', 'learn', 'productivity-hacks')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fg-abc-learn-option"
                    data-icon-color="green"
                >
                    <Icon name="bulb" className="fotogrids-admin-block-card-icon" />
                    {__('Productivity Hacks', 'fotogrids')}
                </a>
                <a
                    href={fgGoUrl('help', 'dashboard', 'learn', 'help-center')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fg-abc-learn-option"
                    data-icon-color="red"
                >
                    <Icon name="help" className="fotogrids-admin-block-card-icon" />
                    {__('Help Center', 'fotogrids')}
                </a>
            </div>
        </div>
    );
};

export default LearnSection;
