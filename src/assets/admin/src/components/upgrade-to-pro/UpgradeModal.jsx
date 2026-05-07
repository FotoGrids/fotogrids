import React, { useState, useEffect, useRef } from 'react';
const UpgradeModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentBenefit, setCurrentBenefit] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [slideFromRight, setSlideFromRight] = useState(false);
    const autoAdvanceRef = useRef(null);

    const modalData = window.fotogridsUpgradeModal || {};
    const benefits = modalData.benefits || [];
    const strings = modalData.strings;
    const upgradeUrl = modalData.urls?.upgrade;
    const comparisonUrl = modalData.urls?.comparison;

    useEffect(() => {
        const openModal = (benefitKey = 0) => {
            let benefitIndex = 0;
            if (typeof benefitKey === 'string') {
                benefitIndex = benefits.findIndex(benefit => benefit.key === benefitKey);
                if (benefitIndex === -1) benefitIndex = 0;
            } else if (typeof benefitKey === 'number') {
                benefitIndex = Math.max(0, Math.min(benefitKey, benefits.length - 1));
            }

            setCurrentBenefit(benefitIndex);
            setIsOpen(true);
        };

        const closeModal = () => setIsOpen(false);

        window.FotoGridsUpgrade = {
            launch: openModal,
            close: closeModal,
            launchForFeature: {
                bulkOperations: () => openModal('bulk_operations'),
                advancedLayouts: () => openModal('advanced_layouts'),
                customCSS: () => openModal('custom_css'),
                prioritySupport: () => openModal('priority_support'),
                templates: () => openModal('templates'),
                analytics: () => openModal('analytics'),
                integrations: () => openModal('integrations'),
                unlimitedGalleries: () => openModal('unlimited_galleries'),
                templates: () => openModal('templates')
            },
            BENEFIT_KEYS: {
                BULK_OPERATIONS: 'bulk_operations',
                ADVANCED_LAYOUTS: 'advanced_layouts',
                CUSTOM_CSS: 'custom_css',
                PRIORITY_SUPPORT: 'priority_support',
                TEMPLATES: 'templates',
                ANALYTICS: 'analytics',
                INTEGRATIONS: 'integrations',
                UNLIMITED_GALLERIES: 'unlimited_galleries',
                TEMPLATES: 'templates'
            }
        };

        return () => {
            delete window.FotoGridsUpgrade;
        };
    }, [benefits]);

    const startAutoAdvance = () => {
        if (autoAdvanceRef.current) {
            clearInterval(autoAdvanceRef.current);
        }

        if (isOpen && benefits.length > 1) {
            autoAdvanceRef.current = setInterval(() => {
                setCurrentBenefit(prev => {
                    const nextIndex = (prev + 1) % benefits.length;
                    const nextBenefit = benefits[nextIndex];

                    const imageElement = document.querySelector('.fotogrids-upgrade-modal__image');

                    if (imageElement && nextBenefit) {
                        imageElement.classList.remove('slide-from-right');
                        imageElement.style.setProperty('--next-bg-color', nextBenefit.color);

                        setIsTransitioning(true);

                        setTimeout(() => {
                            setCurrentBenefit(nextIndex);
                        }, 400);

                        setTimeout(() => {
                            setIsTransitioning(false);
                            imageElement.style.removeProperty('--next-bg-color');
                        }, 600);
                    }

                    return prev;
                });
            }, 5000);
        }
    };

    const resetAutoAdvance = () => {
        if (autoAdvanceRef.current) {
            clearInterval(autoAdvanceRef.current);
        }
        startAutoAdvance();
    };

    useEffect(() => {
        startAutoAdvance();
        return () => {
            if (autoAdvanceRef.current) {
                clearInterval(autoAdvanceRef.current);
            }
        };
    }, [isOpen, benefits.length]);

    const handleBenefitChange = (index, resetTimer = false) => {
        if (index === currentBenefit || isTransitioning) {
            return;
        }

        const nextBenefit = benefits[index];
        const imageElement = document.querySelector('.fotogrids-upgrade-modal__image');

        if (!imageElement || !nextBenefit) {
            return;
        }

        if (!imageElement.dataset.debugId) {
            imageElement.dataset.debugId = 'debug-' + Date.now();
        }

        const isGoingBack = index < currentBenefit;

        setSlideFromRight(isGoingBack ? true : false);
        imageElement.style.setProperty('--next-bg-color', nextBenefit.color);

        setIsTransitioning(true);

        setTimeout(() => {
            setCurrentBenefit(index);
        }, 400);

        setTimeout(() => {
            setIsTransitioning(false);
            setSlideFromRight(false);
            imageElement.style.removeProperty('--next-bg-color');

            if (resetTimer) {
                resetAutoAdvance();
            }
        }, 600);
    };

    const handleUpgrade = () => {
        if (upgradeUrl) window.open(upgradeUrl, '_blank');
    };

    const handleComparison = () => {
        if (comparisonUrl) window.open(comparisonUrl, '_blank');
    };

    if (benefits.length === 0) {
        return null;
    }

    const currentBenefitData = benefits[currentBenefit];

    return (
        <div
            className={`fotogrids-upgrade-modal-overlay ${isOpen ? 'fotogrids-modal--open' : ''}`}
            style={{
                pointerEvents: isOpen ? 'auto' : 'none',
                opacity: isOpen ? 1 : 0,
                visibility: isOpen ? 'visible' : 'hidden'
            }}
            onClick={() => setIsOpen(false)}
        >
            <div className="fotogrids-upgrade-modal" onClick={e => e.stopPropagation()}>
                <button className="fotogrids-upgrade-modal__close" onClick={() => setIsOpen(false)}>×</button>

                <div className="fotogrids-upgrade-modal__content">
                    <div
                        className={`fotogrids-upgrade-modal__image ${isTransitioning ? 'transitioning' : ''} ${slideFromRight ? 'slide-from-right' : ''}`}
                        style={{ backgroundColor: currentBenefitData.color }}
                    >
                        {currentBenefitData.image && (
                            <img
                                src={currentBenefitData.image}
                                alt=""
                                className={isTransitioning ? 'transitioning' : ''}
                            />
                        )}
                    </div>

                    <div className="fotogrids-upgrade-modal__text">
                        <div className={`fotogrids-upgrade-modal__text-content ${isTransitioning ? 'transitioning' : ''}`}>
                            <h2>
                                {currentBenefitData.title}
                                <br />
                                <span className="highlight">{currentBenefitData.subtitle}</span>
                            </h2>
                            <p>{currentBenefitData.content}</p>
                        </div>

                        <div className="fotogrids-upgrade-modal__actions">
                            <button
                                className="fotogrids-upgrade-modal__upgrade-btn"
                                onClick={handleUpgrade}
                            >
                                {strings.upgradeNow}
                            </button>
                            <button
                                className="fotogrids-upgrade-modal__comparison-btn"
                                onClick={handleComparison}
                            >
                                {strings.freeVsPro}
                            </button>
                        </div>

                        {benefits.length > 1 && (
                            <div className="fotogrids-upgrade-modal__bullets">
                                {benefits.map((benefit, index) => (
                                    <button
                                        key={benefit.key}
                                        className={`bullet ${index === currentBenefit ? 'fg-is-active' : ''}`}
                                        onClick={() => {
                                            handleBenefitChange(index, true);
                                        }}
                                        title={benefit.shortTitle}
                                    >
                                        <span className="tooltip">
                                            <span>{benefit.shortTitle}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;
