/**
 * Pro Features Component
 */
import React from 'react';
import Icon from '../shared/Icon';
import { Button } from '../shared/Button';

const { __ } = wp.i18n;

const generateProFeatureKey = (str) => {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
};

const ProFeatures = () => {
    return (
        <div className="fotogrids-admin-block-card fg-abc-upgrade">
            <div className="fotogrids-admin-block-card-content">
                <div className="fotogrids-pro-badge">
                    <div className="fotogrids-fireworks" />
                    <span>{__('PRO', 'fotogrids')}</span>
                </div>
                <h3>{__('Unlock PRO Features', 'fotogrids')}</h3>
                <div className="pro-feature-list">
                    {[
                        'Advanced Layouts',
                        'SEO Optimization',
                        'E-Commerce',
                        'Custom Styling',
                        'Priority Support',
                        'Advanced Analytics',
                        'Powerful Integrations',
                        'Bulk Operations',
                    ].map((feature) => (
                        <div key={generateProFeatureKey(feature)}>
                            <Icon name="check_badge_g" />
                            {__(feature, 'fotogrids')}
                        </div>
                    ))}
                </div>
                <p>{__('Plus many more powerful features designed to save time, optimize performance, and help you grow.', 'fotogrids')}</p>
                <div className="fg-abc-buttons">
                    <Button
                        href="https://go.fotogrids.com/upgrade"
                        target="_blank"
                        variant="primary"
                    >
                        {__('Upgrade Now', 'fotogrids')}
                    </Button>
                    <Button
                        href="https://go.fotogrids.com/free-vs-pro"
                        target="_blank"
                        variant="accent"
                        className="fg-button--invert"
                    >
                        {__('Free vs. Pro', 'fotogrids')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ProFeatures;

