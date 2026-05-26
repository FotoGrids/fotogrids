window.FotoGridsSettings = window.FotoGridsSettings || {};

/**
 * Load the assembled settings tree from the PHP-side Catalog Assembler.
 *
 * The PHP endpoint at /wp-json/fotogrids/v1/admin/catalog/entries returns the
 * final tab/subtab/section tree, with placements (insert_tab / insert_subtab /
 * insert_section / extend_options / replace / hide) already applied. This is
 * the single source of truth - Free, Pro, and any third-party plugin contribute
 * their catalog files through the `fotogrids/catalog/json_files` filter, and
 * the assembler merges them.
 *
 * The legacy approach (fetching each Free JSON file from the browser) couldn't
 * see Pro or third-party files because they live in different plugin directories.
 *
 * @param {string} postType
 * @param {boolean} isDefaultsMode
 * @returns {Promise<Object<string, Object>>} Map of tab id → tab node.
 */
const loadSettingsGroups = async (postType = 'gallery', isDefaultsMode = false) => {
    const normalizedPostType = postType === 'fotogrids_gallery' ? 'gallery' :
                               postType === 'fotogrids_album' ? 'album' :
                               postType;

    const restBase = window.fotogridsSettings?.restUrl
        || window.wpApiSettings?.root
        || '/wp-json/';

    const endpoint = restBase.includes('/fotogrids/v1/')
        ? `${restBase.replace(/\/$/, '')}/admin/catalog/entries`
        : `${restBase.replace(/\/$/, '')}/fotogrids/v1/admin/catalog/entries`;

    const url = `${endpoint}?post_type=${encodeURIComponent(normalizedPostType)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-WP-Nonce': window.wpApiSettings?.nonce
                    || window.fotogridsSettings?.restNonce
                    || ''
            }
        });

        if (!response.ok) {
            console.warn(`FotoGrids: Failed to load assembled catalog (${response.status})`);
            return {};
        }

        const payload = await response.json();
        const groups = payload?.groups || {};

        if (Array.isArray(payload?.warnings) && payload.warnings.length > 0) {
            payload.warnings.forEach(warning => console.warn(`FotoGrids: ${warning}`));
        }

        return filterForDefaultsMode(filterHidden(groups), isDefaultsMode);
    } catch (error) {
        console.warn('FotoGrids: Error loading assembled catalog:', error);
        return {};
    }
};

/**
 * Remove tabs / subtabs / settings marked as `hidden: true` by a `hide`
 * placement. We can't remove them server-side because hidden settings still
 * need their saved values respected at render time - the assembler just tags
 * them, and the UI layer drops them here.
 */
const filterHidden = (groups) => {
    const filtered = {};

    Object.entries(groups).forEach(([tabId, tabNode]) => {
        if (tabNode?.hidden) return;

        const clonedTab = { ...tabNode };

        if (clonedTab.subTabs && typeof clonedTab.subTabs === 'object') {
            const filteredSubTabs = {};
            Object.entries(clonedTab.subTabs).forEach(([subTabId, subTabNode]) => {
                if (subTabNode?.hidden) return;
                filteredSubTabs[subTabId] = filterHiddenSettings(subTabNode);
            });
            clonedTab.subTabs = filteredSubTabs;
        }

        if (Array.isArray(clonedTab.settings)) {
            clonedTab.settings = clonedTab.settings.filter(setting => !setting?.hidden);
        }

        filtered[tabId] = clonedTab;
    });

    return filtered;
};

const filterHiddenSettings = (subTabNode) => {
    if (!Array.isArray(subTabNode?.settings)) return subTabNode;
    return {
        ...subTabNode,
        settings: subTabNode.settings.filter(setting => !setting?.hidden)
    };
};

/**
 * Drop settings/tabs that opted out of defaults mode (e.g. per-gallery overrides
 * that shouldn't appear on the global defaults screen).
 */
const filterForDefaultsMode = (groups, isDefaultsMode) => {
    if (!isDefaultsMode) return groups;

    const filtered = {};
    Object.entries(groups).forEach(([tabId, tabNode]) => {
        if (tabNode?.hideInDefaults === true) return;
        filtered[tabId] = tabNode;
    });

    return filtered;
};

window.FotoGridsSettings.loadSettingsGroups = loadSettingsGroups;
