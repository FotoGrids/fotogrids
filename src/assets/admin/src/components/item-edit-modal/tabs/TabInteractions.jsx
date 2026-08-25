import React from 'react';
import Icon from '../../shared/Icon';
import useItemClickBehavior from '../useItemClickBehavior';

const EXTERNAL_BEHAVIOR = 'external';

const TabInteractions = ({ formData, handleInputChange, strings = {}, disabled = false }) => {
    const clickBehavior = useItemClickBehavior();
    const showNotice = '' !== clickBehavior && EXTERNAL_BEHAVIOR !== clickBehavior;

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-interactions-section">
                <h4>{strings.itemInteractions}</h4>

                {showNotice && (
                    <div className="fotogrids-edit-item-notice fotogrids-edit-item-notice--warning">
                        <Icon name="alert_circle" className="fotogrids-edit-item-notice__icon" />
                        <div className="fotogrids-edit-item-notice__body">
                            <strong>
                                {strings.externalUrlIgnoredTitle}
                            </strong>
                            <span>{strings.externalUrlIgnoredBody}</span>
                        </div>
                    </div>
                )}

                <div className="fotogrids-external-url-section">
                    <div className="fotogrids-field-group">
                        <label htmlFor="fotogrids-item-external-url">
                            {strings.externalUrl}
                        </label>
                        <input
                            type="url"
                            id="fotogrids-item-external-url"
                            placeholder="https://example.com"
                            value={formData?.external_url || ''}
                            onChange={(e) => handleInputChange('external_url', e.target.value)}
                            disabled={disabled}
                        />
                        <p className="description">
                            {strings.externalUrlDesc}
                        </p>
                    </div>
                    <div className="fotogrids-field-group">
                        <label htmlFor="fotogrids-item-link-target">
                            {strings.linkTarget}
                        </label>
                        <select
                            id="fotogrids-item-link-target"
                            value={formData?.link_target || ''}
                            onChange={(e) => handleInputChange('link_target', e.target.value)}
                            disabled={disabled}
                        >
                            <option value="global">
                                {strings.linkTargetGlobal}
                            </option>
                            <option value="_self">
                                {strings.linkTargetSelf}
                            </option>
                            <option value="_blank">
                                {strings.linkTargetBlank}
                            </option>
                        </select>
                        <p className="description">
                            {strings.linkTargetDesc}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabInteractions;
