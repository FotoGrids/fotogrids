import React from 'react';

const TabLocation = ({
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata
}) => {
    return (
        <div className="fotogrids-tab-panel active">
            <div className="fotogrids-metadata-section">
                <div className="fotogrids-metadata-input">
                    <input
                        type="text"
                        placeholder="Add location..."
                        value={metadataInput.location}
                        onChange={(e) => setMetadataInput(prev => ({ ...prev, location: e.target.value }))}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addMetadataItem('locations', metadataInput.location);
                            }
                        }}
                    />
                    <button 
                        type="button" 
                        className="button"
                        onClick={() => addMetadataItem('locations', metadataInput.location)}
                    >
                        Add
                    </button>
                </div>
                
                {/* Autocomplete suggestions */}
                {metadataInput.location && (
                    <div className="fotogrids-autocomplete">
                        {(availableMetadata.locations || [])
                            .filter(loc => 
                                loc && loc.name &&
                                loc.name.toLowerCase().includes(metadataInput.location.toLowerCase()) &&
                                (!metadata.location || metadata.location.id !== loc.id)
                            )
                            .slice(0, 5)
                            .map(location => (
                                <div 
                                    key={location.id} 
                                    className="fotogrids-autocomplete-item"
                                    onClick={() => selectExistingMetadata('locations', location)}
                                >
                                    {location.name}
                                </div>
                            ))
                        }
                    </div>
                )}
                
                {/* Current location */}
                {metadata.location && (
                    <div className="fotogrids-metadata-list">
                        <span className="fotogrids-metadata-item">
                            {metadata.location.name}
                            <button 
                                type="button" 
                                className="fotogrids-remove-metadata"
                                onClick={() => removeMetadataItem('location', metadata.location.id)}
                            >
                                ×
                            </button>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabLocation;
