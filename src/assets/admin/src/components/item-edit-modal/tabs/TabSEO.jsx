import React from 'react';
import Icon from '../../shared/Icon';
import ProFeatureNotice from '../../shared/ProFeatureNotice';
import {
    getItemSeoChecks,
    summarizeSeoChecks,
    resolveEmittedAlt,
    CHECK_PASS,
    CHECK_WARN,
    CHECK_FAIL,
    BAND_BAD,
    BAND_NEEDS_IMPROVEMENT,
    BAND_GOOD,
} from '../seo-checks';

const STATUS_ICONS = {
    [CHECK_PASS]: 'check_circle',
    [CHECK_WARN]: 'alert_circle',
    [CHECK_FAIL]: 'x_circle',
};

const CHECK_LABEL_KEYS = {
    alt: 'altText',
    filename: 'filename',
    title: 'title',
    caption: 'caption',
    description: 'description',
    credit: 'credit',
    weight: 'seoCheckWeightLabel',
};

const BAND_KEYS = {
    [BAND_BAD]: 'seoBandBad',
    [BAND_NEEDS_IMPROVEMENT]: 'seoBandNeedsImprovement',
    [BAND_GOOD]: 'seoBandGood',
};

const ALT_SOURCE_KEYS = {
    alt: 'seoEmitsAltFromAlt',
    title: 'seoEmitsAltFromTitle',
    empty: 'seoEmitsAltEmpty',
};

const messageKey = (code) =>
    'seoCheck' + code.replace(/(^|_)([a-z])/g, (match, prefix, letter) => letter.toUpperCase());

const TabSEO = ({ formData, itemData, setActiveTab, disabled = false, strings = {} }) => {
    const isProActive = window.fotogridsSettings?.isProActive || false;

    if (disabled) {
        return <div className="fotogrids-tab-panel fg-is-active" />;
    }

    const checks = getItemSeoChecks(formData, itemData);
    const { ready, total, band } = summarizeSeoChecks(checks);
    const emittedAlt = resolveEmittedAlt(formData);

    const handleUpgrade = () => {
        if (window.FotoGridsUpgrade) {
            window.FotoGridsUpgrade.launch();
        } else if (window.fotogridsUpgradeModal?.urls?.upgrade) {
            window.open(window.fotogridsUpgradeModal.urls.upgrade, '_blank');
        }
    };

    const handleFix = (item) => {
        if (!item.tab) {
            return;
        }

        setActiveTab(item.tab);

        if (!item.fieldId) {
            return;
        }

        window.requestAnimationFrame(() => {
            const field = document.getElementById(item.fieldId);

            if (field) {
                field.focus();
            }
        });
    };

    const summary = (strings.seoReadyCount || '')
        .replace('%1$d', String(ready))
        .replace('%2$d', String(total));

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-seo-checkup">
                <div className="fotogrids-seo-checkup__header">
                    <h4 className="fotogrids-seo-checkup__title">{strings.seoCheckupTitle}</h4>
                    <div className="fotogrids-seo-checkup__score">
                        <span className={`fotogrids-seo-band fotogrids-seo-band--${band}`}>
                            {strings[BAND_KEYS[band]]}
                        </span>
                        <span className="fotogrids-seo-checkup__count">{summary}</span>
                    </div>
                </div>

                <ul className="fotogrids-seo-checkup__list">
                    {checks.map((item) => (
                        <li
                            key={item.id}
                            className={`fotogrids-seo-check fotogrids-seo-check--${item.status}`}
                        >
                            <Icon
                                name={STATUS_ICONS[item.status] || 'info_circle'}
                                className="fotogrids-seo-check__icon"
                            />
                            <div className="fotogrids-seo-check__body">
                                <span className="fotogrids-seo-check__label">
                                    {strings[CHECK_LABEL_KEYS[item.id]]}
                                </span>
                                <span className="fotogrids-seo-check__message">
                                    {strings[messageKey(item.code)]}
                                </span>
                            </div>
                            {item.detail && (
                                <span className="fotogrids-seo-check__detail">{item.detail}</span>
                            )}
                            {item.tab && CHECK_PASS !== item.status && (
                                <button
                                    type="button"
                                    className="fotogrids-seo-check__fix"
                                    onClick={() => handleFix(item)}
                                >
                                    {strings.seoCheckFix}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="fotogrids-seo-emits">
                <h4 className="fotogrids-seo-emits__title">{strings.seoEmitsTitle}</h4>
                <p className="fotogrids-seo-emits__description">{strings.seoEmitsDescription}</p>

                <div className="fotogrids-seo-emits__row">
                    <code className="fotogrids-seo-emits__code">
                        {`<img alt="${emittedAlt.value}">`}
                    </code>
                    <span className="fotogrids-seo-emits__source">
                        {strings[ALT_SOURCE_KEYS[emittedAlt.source]]}
                    </span>
                </div>

                {itemData?.filename && (
                    <div className="fotogrids-seo-emits__row">
                        <code className="fotogrids-seo-emits__code">{itemData.filename}</code>
                        <span className="fotogrids-seo-emits__source">
                            {strings.seoEmitsFilenameSource}
                        </span>
                    </div>
                )}
            </div>

            {!isProActive && (
                <ProFeatureNotice
                    badge={strings.pro}
                    actionLabel={strings.upgradeToPro}
                    onAction={handleUpgrade}
                    center
                >
                    {strings.seoProNotice}
                </ProFeatureNotice>
            )}
        </div>
    );
};

export default TabSEO;
