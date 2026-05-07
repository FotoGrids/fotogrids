window.FotoGridsSettings = window.FotoGridsSettings || {};

const SETTINGS_FILES = [
    'layout',
    'interactions',
    'styling',
    'captions',
    'media',
    'video',
    'effects',
    'custom-code',
    'performance',
    'sorting',
    'filtering',
    'permissions',
    'security',
    'sharing',
    'ecommerce',
    'exif',
    'advanced'
];

const loadSettingsGroups = async (postType = 'gallery', isDefaultsMode = false) => {
    const settingsGroups = {};
    const baseUrl = window.fotogridsAdmin?.pluginUrl || '';

    const normalizedPostType = postType === 'fotogrids_gallery' ? 'gallery' :
                               postType === 'fotogrids_album' ? 'album' :
                               postType;

    for (const fileName of SETTINGS_FILES) {
        try {
            const url = `${baseUrl}assets/admin/js/collection-settings/${fileName}.json`;
            const response = await fetch(url);
            if (response.ok) {
                const settingGroup = await response.json();

                // Filter by postType if specified (using normalized post type)
                if (settingGroup.postTypes && !settingGroup.postTypes.includes(normalizedPostType)) {
                    continue;
                }

                // Filter out settings that should be hidden in defaults mode
                if (isDefaultsMode && settingGroup.hideInDefaults === true) {
                    continue;
                }

                // Default to both gallery and album if postTypes not specified
                if (!settingGroup.postTypes) {
                    settingGroup.postTypes = ['gallery', 'album'];
                }

                settingsGroups[settingGroup.id] = settingGroup;
            }
        } catch (error) {
            console.warn(`FotoGrids: Error loading settings file ${fileName}.json:`, error);
        }
    }

    return settingsGroups;
};

window.FotoGridsSettings.loadSettingsGroups = loadSettingsGroups;
