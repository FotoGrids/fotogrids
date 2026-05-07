import React from 'react';
import { createRoot } from 'react-dom/client';
import TemplatesMetabox from './components/TemplatesMetabox.jsx';

function initializeTemplatesMetabox() {
    const templatesMetaboxRoot = document.getElementById('fotogrids-templates-metabox');

    if (templatesMetaboxRoot && window.fotogridsTemplatesMetabox) {
        const root = createRoot(templatesMetaboxRoot);
        root.render(React.createElement(TemplatesMetabox));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTemplatesMetabox);
} else {
    setTimeout(initializeTemplatesMetabox, 0);
}

