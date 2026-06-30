import React from 'react';
import FormField from '../../shared/FormField/FormField.jsx';
import FormFields from '../../shared/FormField/FormFields.jsx';

const TabDetails = ({ formData, handleInputChange, strings, disabled = false }) => {
    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <FormFields>
                <FormField
                    label={ strings.title || 'Title' }
                    htmlFor="fotogrids-item-title"
                    layout="column"
                >
                    <input
                        type="text"
                        id="fotogrids-item-title"
                        value={ formData?.title || '' }
                        onChange={ (e) => handleInputChange('title', e.target.value) }
                        disabled={ disabled }
                    />
                </FormField>

                <FormField
                    label={ strings.altText || 'Alt Text' }
                    htmlFor="fotogrids-item-alt"
                    layout="column"
                >
                    <input
                        type="text"
                        id="fotogrids-item-alt"
                        value={ formData?.alt || '' }
                        onChange={ (e) => handleInputChange('alt', e.target.value) }
                        disabled={ disabled }
                    />
                </FormField>

                <FormField
                    label={ strings.caption || 'Caption' }
                    htmlFor="fotogrids-item-caption"
                    layout="column"
                >
                    <textarea
                        id="fotogrids-item-caption"
                        rows="3"
                        value={ formData?.caption || '' }
                        onChange={ (e) => handleInputChange('caption', e.target.value) }
                        disabled={ disabled }
                    />
                </FormField>

                <FormField
                    label={ strings.description || 'Description' }
                    htmlFor="fotogrids-item-description"
                    layout="column"
                >
                    <textarea
                        id="fotogrids-item-description"
                        rows="4"
                        value={ formData?.description || '' }
                        onChange={ (e) => handleInputChange('description', e.target.value) }
                        disabled={ disabled }
                    />
                </FormField>

                <FormField
                    label={ strings.credit || 'Credit' }
                    htmlFor="fotogrids-item-credit"
                    layout="column"
                >
                    <input
                        type="text"
                        id="fotogrids-item-credit"
                        value={ formData?.credit || '' }
                        onChange={ (e) => handleInputChange('credit', e.target.value) }
                        disabled={ disabled }
                    />
                </FormField>
            </FormFields>
        </div>
    );
};

export default TabDetails;
