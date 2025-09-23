window.FotoGridsSettings = window.FotoGridsSettings || {};

const SETTINGS_FILES = [
    'layout',
    'interactions', 
    'styling',
    'effects',
    'behavior',
    'advanced'
];

const loadSettingsGroups = async () => {
    const settingsGroups = {};
    const baseUrl = window.fotogridsAdmin?.pluginUrl || '';
    console.log('Loading settings with base URL:', baseUrl);
    
    for (const fileName of SETTINGS_FILES) {
        try {
            const url = `${baseUrl}assets/admin/js/settings/${fileName}.json`;
            console.log(`Loading settings file: ${url}`);
            const response = await fetch(url);
            if (response.ok) {
                const settingGroup = await response.json();
                console.log(`Loaded settings group: ${settingGroup.id}`, settingGroup);
                settingsGroups[settingGroup.id] = settingGroup;
            } else {
                console.warn(`Failed to load settings file: ${fileName}.json`, response.status, response.statusText);
            }
        } catch (error) {
            console.warn(`Error loading settings file ${fileName}.json:`, error);
        }
    }
    
    console.log('Final settings groups:', settingsGroups);
    return settingsGroups;
};

window.FotoGridsSettings.loadSettingsGroups = loadSettingsGroups;
