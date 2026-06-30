/**
 * Templates module - admin page entry point.
 *
 * Mounts the Templates admin page React tree (the wp-admin "Templates" menu
 * page) into the container rendered by Templates\Module::render_page(). The
 * component lives in the shared admin component tree and is imported via the
 * '@' alias; this entry is owned by the module and builds into
 * includes/modules/Templates/assets/.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import TemplatesPage from '@/admin/src/components/pages/TemplatesPage';
import './templates-page.scss';

function initializeTemplatesPage() {
    const container = document.getElementById('fotogrids-templates-page');
    if (!container) {
        return;
    }

    if (container._reactRootContainer) {
        container._reactRootContainer.render(React.createElement(TemplatesPage));
        return;
    }

    try {
        const root = createRoot(container);
        container._reactRootContainer = root;
        root.render(React.createElement(TemplatesPage));
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('FotoGrids: Error rendering Templates page:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTemplatesPage);
} else {
    setTimeout(initializeTemplatesPage, 0);
}
