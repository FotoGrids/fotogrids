import { render } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import MainPage from './pages/MainPage';
import TemplatesPage from './pages/TemplatesPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import LicensePage from './pages/LicensePage';

// Import Gutenberg blocks
import './blocks/gallery-block';

// Import styles
import './styles/admin.scss';

// Initialize React components on their respective pages
document.addEventListener('DOMContentLoaded', () => {
    // Main page
    const mainPageElement = document.getElementById('fotogrids-main-page');
    if (mainPageElement) {
        render(<MainPage />, mainPageElement);
    }

    // Templates page
    const templatesPageElement = document.getElementById('fotogrids-templates-page');
    if (templatesPageElement) {
        render(<TemplatesPage />, templatesPageElement);
    }

    // Stats page
    const statsPageElement = document.getElementById('fotogrids-stats-page');
    if (statsPageElement) {
        render(<StatsPage />, statsPageElement);
    }

    // Settings page
    const settingsPageElement = document.getElementById('fotogrids-settings-page');
    if (settingsPageElement) {
        render(<SettingsPage />, settingsPageElement);
    }

    // License page
    const licensePageElement = document.getElementById('fotogrids-license-page');
    if (licensePageElement) {
        render(<LicensePage />, licensePageElement);
    }
});
