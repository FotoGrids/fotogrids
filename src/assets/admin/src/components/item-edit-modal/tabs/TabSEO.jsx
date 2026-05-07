import React from 'react';
import Icon from '../../shared/Icon';

const TabSEO = ({ formData, handleInputChange, disabled = false, strings = {} }) => {
    const seoFeatures = [
        {
            key: 'ai_meta_optimization',
            title: strings.seoAiMetaOptimization,
            description: strings.seoAiMetaOptimizationDesc
        },
        {
            key: 'file_optimization',
            title: strings.seoFileOptimization,
            description: strings.seoFileOptimizationDesc
        },
        {
            key: 'schema_markup',
            title: strings.seoSchemaMarkup,
            description: strings.seoSchemaMarkupDesc
        },
        {
            key: 'image_sitemaps',
            title: strings.seoImageSitemaps,
            description: strings.seoImageSitemapsDesc
        }
    ];

    const handleUpgrade = () => {
        if (window.FotoGridsUpgrade) {
            window.FotoGridsUpgrade.launch();
        } else if (window.fotogridsUpgradeModal?.urls?.upgrade) {
            window.open(window.fotogridsUpgradeModal.urls.upgrade, '_blank');
        }
    };

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-seo-section fotogrids-pro-content">
                <div className="fotogrids-pro-content__header">
                    <h4>
                        {strings.seoOptimization}
                        <span className="fotogrids-pro-badge fotogrids-pro-badge-large">{strings.pro}</span>
                    </h4>
                    <p className="fotogrids-pro-content__description">
                        {strings.seoOptimizationDesc}
                    </p>
                </div>

                <div className="fotogrids-pro-content__features">
                    <ul className="fotogrids-feature-list">
                        {seoFeatures.map((feature) => (
                            <li key={feature.key} className="fotogrids-feature-item">
                                <Icon name="check_circle" className="fotogrids-feature-item__icon" />
                                <h5 className="fotogrids-feature-item__title">{feature.title}</h5>
                                <p className="fotogrids-feature-item__description">{feature.description}</p>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="fotogrids-pro-content__actions">
                    <button
                        type="button"
                        className="fotogrids-button fotogrids-button--primary"
                        onClick={handleUpgrade}
                    >
                        {strings.upgradeToPro}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TabSEO;
