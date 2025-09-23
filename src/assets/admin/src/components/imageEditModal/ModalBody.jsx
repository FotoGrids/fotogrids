import React from 'react';
import TabDetails from './tabs/TabDetails';
import TabTags from './tabs/TabTags';
import TabPeople from './tabs/TabPeople';
import TabLocation from './tabs/TabLocation';
import TabInteractions from './tabs/TabInteractions';

const ModalBody = ({
    imageData,
    formData,
    activeTab,
    setActiveTab,
    handleInputChange,
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    strings
}) => {
    return (
		<div className="fotogrids-modal-layout">
			{/* Left side - Image preview */}
			<div className="fotogrids-modal-left">
				<div className="fotogrids-image-preview">
					<img src={imageData.medium_url} alt={formData.alt} />
				</div>
			</div>

			{/* Right side - Tabs and content */}
			<div className="fotogrids-modal-right">
				<div className="fotogrids-modal-tabs">
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'details' ? 'active' : ''}`}
						onClick={() => setActiveTab('details')}
					>
						{strings.details || 'Details'}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'tags' ? 'active' : ''}`}
						onClick={() => setActiveTab('tags')}
					>
						{strings.tags || 'Tags'}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'people' ? 'active' : ''}`}
						onClick={() => setActiveTab('people')}
					>
						{strings.people || 'People'}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'location' ? 'active' : ''}`}
						onClick={() => setActiveTab('location')}
					>
						{strings.location || 'Location'}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'interactions' ? 'active' : ''}`}
						onClick={() => setActiveTab('interactions')}
					>
						{strings.interactions || 'Interactions'}
					</button>
				</div>

				<div className="fotogrids-tab-content">
					{activeTab === 'details' && (
						<TabDetails
							formData={formData}
							handleInputChange={handleInputChange}
							strings={strings}
						/>
					)}

					{activeTab === 'tags' && (
						<TabTags
							metadata={metadata}
							availableMetadata={availableMetadata}
							metadataInput={metadataInput}
							setMetadataInput={setMetadataInput}
							addMetadataItem={addMetadataItem}
							removeMetadataItem={removeMetadataItem}
							selectExistingMetadata={selectExistingMetadata}
						/>
					)}

					{activeTab === 'people' && (
						<TabPeople
							metadata={metadata}
							availableMetadata={availableMetadata}
							metadataInput={metadataInput}
							setMetadataInput={setMetadataInput}
							addMetadataItem={addMetadataItem}
							removeMetadataItem={removeMetadataItem}
							selectExistingMetadata={selectExistingMetadata}
						/>
					)}

					{activeTab === 'location' && (
						<TabLocation
							metadata={metadata}
							availableMetadata={availableMetadata}
							metadataInput={metadataInput}
							setMetadataInput={setMetadataInput}
							addMetadataItem={addMetadataItem}
							removeMetadataItem={removeMetadataItem}
							selectExistingMetadata={selectExistingMetadata}
						/>
					)}

					{activeTab === 'interactions' && (
						<TabInteractions
							formData={formData}
							handleInputChange={handleInputChange}
						/>
					)}
				</div>
			</div>
		</div>
    );
};

export default ModalBody;
