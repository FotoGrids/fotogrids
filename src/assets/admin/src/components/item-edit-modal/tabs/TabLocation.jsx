import React from 'react';
import MetadataTab from './MetadataTab';

const { __ } = wp.i18n;

/**
 * GeoMapPlaceholder - a lightweight inline SVG dot showing the location's
 * coordinates on a simple equirectangular world grid.
 * Shown when the current location has lat/lng stored.
 */
const GeoMapPlaceholder = ({ location }) => {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;

    // Equirectangular projection: x ∈ [0,300], y ∈ [0,150]
    const x = ((lng + 180) / 360) * 300;
    const y = ((90 - lat) / 180) * 150;

    return (
        <div className="fotogrids-location-map-wrap">
            <svg
                viewBox="0 0 300 150"
                xmlns="http://www.w3.org/2000/svg"
                className="fotogrids-location-map-svg"
                aria-label={__('Location map', 'fotogrids')}
            >
                <rect width="300" height="150" fill="#f0f4f8" rx="4" />
                {/* Grid lines */}
                {[30, 60, 90, 120].map((yg) => (
                    <line key={yg} x1="0" y1={yg} x2="300" y2={yg} stroke="#dde3ec" strokeWidth="0.5" />
                ))}
                {[75, 150, 225].map((xg) => (
                    <line key={xg} x1={xg} y1="0" x2={xg} y2="150" stroke="#dde3ec" strokeWidth="0.5" />
                ))}
                {/* Halo + dot */}
                <circle cx={x} cy={y} r="10" fill="#3c46f0" opacity="0.12" />
                <circle cx={x} cy={y} r="5"  fill="#3c46f0" opacity="0.85" />
                <title>{`${location.name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`}</title>
            </svg>
            <div className="fotogrids-location-map-label">
                <span className="fotogrids-location-map-label__name">{location.name}</span>
                <span className="fotogrids-location-map-label__coords">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
            </div>
        </div>
    );
};

const TabLocation = ({
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    disabled = false,
    strings = {},
}) => {
    const isProActive = Boolean(window.fotogridsSettings?.isProActive);

    // Current location (maxItems=1, so at most one entry).
    const currentLocation = metadata?.locations?.[0] ?? null;

    const proNoticeContent = !isProActive ? {
        badge: strings.pro,
        title: strings.locationSmartSuggestions || __('Smart Location Suggestions', 'fotogrids'),
        description: strings.locationSmartSuggestionsDesc || __('Automatically suggest locations from EXIF GPS data and map galleries geographically.', 'fotogrids'),
        upgradeText: strings.upgradeToPro,
    } : null;

    return (
        <div className="fotogrids-tab-location">
            {/* ── Shared metadata input (search + chips) ── */}
            <MetadataTab
                metadata={metadata}
                availableMetadata={availableMetadata}
                metadataInput={metadataInput}
                setMetadataInput={setMetadataInput}
                addMetadataItem={addMetadataItem}
                removeMetadataItem={removeMetadataItem}
                selectExistingMetadata={selectExistingMetadata}
                disabled={disabled}
                strings={strings}
                metadataKey="locations"
                placeholder={strings.addLocationPlaceholder || ''}
                icon={window.FotoGridsIcons?.location || ''}
                maxItems={1}
                showProNotice={!isProActive}
                proNoticeContent={proNoticeContent}
            />

            {/* ── Map preview (when a location with coordinates is set) ── */}
            {currentLocation && (currentLocation.latitude != null && currentLocation.longitude != null) && (
                <GeoMapPlaceholder location={currentLocation} />
            )}

            {/* ── No-coords empty state for set location without coords ── */}
            {currentLocation && (currentLocation.latitude == null || currentLocation.longitude == null) && (
                <div className="fotogrids-location-no-coords">
                    <span className="fotogrids-location-no-coords__icon">🗺</span>
                    <span>{__('No coordinates for this location.', 'fotogrids')}</span>
                    <a
                        href={`${window.fotogridsAdmin?.adminUrl || '#'}admin.php?page=fotogrids-library&tab=locations`}
                        className="fotogrids-location-no-coords__link"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {__('Add coordinates in Library →', 'fotogrids')}
                    </a>
                </div>
            )}
        </div>
    );
};

export default TabLocation;
