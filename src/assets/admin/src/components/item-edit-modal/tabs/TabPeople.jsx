import React from 'react';

const TabPeople = ({
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
                        placeholder="Add people..."
                        value={metadataInput.people}
                        onChange={(e) => setMetadataInput(prev => ({ ...prev, people: e.target.value }))}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addMetadataItem('people', metadataInput.people);
                            }
                        }}
                    />
                    <button 
                        type="button" 
                        className="button"
                        onClick={() => addMetadataItem('people', metadataInput.people)}
                    >
                        Add
                    </button>
                </div>
                
                {/* Autocomplete suggestions */}
                {metadataInput.people && (
                    <div className="fotogrids-autocomplete">
                        {(availableMetadata.people || [])
                            .filter(person => 
                                person && person.name &&
                                person.name.toLowerCase().includes(metadataInput.people.toLowerCase()) &&
                                !metadata.people.some(existing => existing.id === person.id)
                            )
                            .slice(0, 5)
                            .map(person => (
                                <div 
                                    key={person.id} 
                                    className="fotogrids-autocomplete-item"
                                    onClick={() => selectExistingMetadata('people', person)}
                                >
                                    {person.name}
                                </div>
                            ))
                        }
                    </div>
                )}
                
                {/* Current people */}
                <div className="fotogrids-metadata-list">
                    {metadata.people.map(person => (
                        <span key={person.id} className="fotogrids-metadata-item">
                            {person.name}
                            <button 
                                type="button" 
                                className="fotogrids-remove-metadata"
                                onClick={() => removeMetadataItem('people', person.id)}
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

export default TabPeople;
