/**
 * Templates module - metabox entry point.
 *
 * Mounts the Templates metabox React tree into the metabox container rendered
 * by Templates\Module::render_metabox(). The component itself lives in the
 * shared admin component tree and is imported via the '@' alias; this entry is
 * owned by the module and builds into includes/modules/Templates/assets/.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import TemplatesMetabox from '@/admin/src/components/TemplatesMetabox.jsx';
import './templates-metabox.scss';

function initializeTemplatesMetabox() {
    const root = document.getElementById('fotogrids-templates-metabox');

    if (root && window.fotogridsTemplatesMetabox) {
        createRoot(root).render(React.createElement(TemplatesMetabox));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTemplatesMetabox);
} else {
    setTimeout(initializeTemplatesMetabox, 0);
}
