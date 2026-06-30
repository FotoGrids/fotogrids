import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';

const readModalData = () => {
    const data = (typeof window !== 'undefined' && window.fotogridsUpgradeModal) || {};
    return {
        benefits:       data.benefits      || [],
        strings:        data.strings       || {},
        upgradeUrl:     data.urls?.upgrade,
        comparisonUrl:  data.urls?.comparison,
    };
};

const UpgradeModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentBenefit, setCurrentBenefit] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [slideFromRight, setSlideFromRight] = useState(false);
    const [, forceUpdate] = useState(0);
    const autoAdvanceRef = useRef(null);

    // Re-read on every render so a late-arriving window.fotogridsUpgradeModal
    // (race with the inline footer script on first paint) still populates the
    // carousel once the user opens it.
    const { benefits, strings, upgradeUrl, comparisonUrl } = readModalData();

    // Install the public window.FotoGridsUpgrade API exactly once per mount.
    // openModal reads benefits live from the global so we don't capture a
    // stale (possibly empty) closure value if the inline-script payload races
    // the React mount.
    useEffect(() => {
        const openModal = (benefitKey = 0) => {
            const liveBenefits = (window.fotogridsUpgradeModal && window.fotogridsUpgradeModal.benefits) || [];
            let benefitIndex = 0;
            if (typeof benefitKey === 'string') {
                benefitIndex = liveBenefits.findIndex(benefit => benefit.key === benefitKey);
                if (benefitIndex === -1) benefitIndex = 0;
            } else if (typeof benefitKey === 'number') {
                benefitIndex = Math.max(0, Math.min(benefitKey, liveBenefits.length - 1));
            }

            // forceUpdate ensures a fresh render that picks up
            // window.fotogridsUpgradeModal even if the inline script wrote it
            // after our initial mount.
            forceUpdate((n) => n + 1);
            setCurrentBenefit(benefitIndex);
            setIsOpen(true);
        };

        const closeModal = () => setIsOpen(false);

        window.FotoGridsUpgrade = {
            launch: openModal,
            close: closeModal,
            launchForFeature: {
                bulkOperations:     () => openModal('bulk_operations'),
                advancedLayouts:    () => openModal('advanced_layouts'),
                customCSS:          () => openModal('custom_css'),
                prioritySupport:    () => openModal('priority_support'),
                templates:          () => openModal('templates'),
                analytics:          () => openModal('analytics'),
                integrations:       () => openModal('integrations'),
                unlimitedGalleries: () => openModal('unlimited_galleries'),
            },
            BENEFIT_KEYS: {
                BULK_OPERATIONS:     'bulk_operations',
                ADVANCED_LAYOUTS:    'advanced_layouts',
                CUSTOM_CSS:          'custom_css',
                PRIORITY_SUPPORT:    'priority_support',
                TEMPLATES:           'templates',
                ANALYTICS:           'analytics',
                INTEGRATIONS:        'integrations',
                UNLIMITED_GALLERIES: 'unlimited_galleries',
            },
        };

        return () => {
            delete window.FotoGridsUpgrade;
        };
    }, []);

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

    if (benefits.length === 0 && !isOpen) {
        return null;
    }

    const currentBenefitData = benefits[currentBenefit] || {
        title:      strings.upgradeToProTitle    || 'Upgrade to FotoGrids Pro',
        subtitle:   '',
        content:    strings.upgradeToProContent  || 'Unlock the full FotoGrids experience.',
        color:      '#3c46f0',
        image:      null,
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            size="ml"
            className="fg-modal--upgrade"
            type="upgrade"
        >
            <Modal.Body padding={false} scroll={false}>
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
                        <div className="fotogrids-upgrade-modal__content-inner">
                            <div className={`fotogrids-upgrade-modal__text-content ${isTransitioning ? 'transitioning' : ''}`}>
                                <h2>
                                    {currentBenefitData.title}
                                    <br />
                                    <span className="fg-highlight">{currentBenefitData.subtitle}</span>
                                </h2>
                                <p>{currentBenefitData.content}</p>
                            </div>

                            <div className="fotogrids-upgrade-modal__actions">
                                <Button variant="primary" size="lg" onClick={handleUpgrade}>
                                    {strings.upgradeNow}
                                </Button>
                                <Button variant="secondary" size="lg" onClick={handleComparison}>
                                    {strings.freeVsPro}
                                </Button>
                            </div>
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
            </Modal.Body>
        </Modal>
    );
};

export default UpgradeModal;
