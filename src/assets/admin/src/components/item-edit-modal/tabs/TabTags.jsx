import React from 'react';

const TabTags = ({
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
                    <div className="fotogrids-input-with-icon">
                        <span className="fotogrids-input-icon" dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.tag || '' }} />
                        <input
                            type="text"
                            placeholder="Add tags..."
                            value={metadataInput.tags}
                            onChange={(e) => setMetadataInput(prev => ({ ...prev, tags: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addMetadataItem('tags', metadataInput.tags);
                                }
                            }}
                        />
                    </div>
                    <button 
                        type="button" 
                        className="button"
                        onClick={() => addMetadataItem('tags', metadataInput.tags)}
                    >
                        Add
                    </button>
                </div>
                
                {/* Autocomplete suggestions */}
                {metadataInput.tags && (
                    <div className="fotogrids-autocomplete">
                        {Array.isArray(availableMetadata.tags) ? availableMetadata.tags
                            .filter(tag => 
                                tag && tag.name && 
                                tag.name.toLowerCase().includes(metadataInput.tags.toLowerCase()) &&
                                !metadata.tags.some(existing => existing.id === tag.id)
                            )
                            .slice(0, 5)
                            .map(tag => (
                                <div 
                                    key={tag.id} 
                                    className="fotogrids-autocomplete-item"
                                    onClick={() => selectExistingMetadata('tags', tag)}
                                >
                                    {tag.name}
                                </div>
                            )) : []
                        }
                    </div>
                )}
                
                {/* Current tags */}
                <div className="fotogrids-metadata-list">
                    {metadata.tags.map(tag => (
                        <span key={tag.id} className="fotogrids-metadata-item fotogrids-tag">
                            <span class="fotogrids-tag-text">{tag.name}</span>
                            <button 
                                type="button" 
                                className="fotogrids-tag-remove-button"
                                onClick={() => removeMetadataItem('tags', tag.id)}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TabTags;
