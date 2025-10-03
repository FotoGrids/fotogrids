import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { 
    Card, 
    CardBody, 
    CardHeader, 
    TabPanel, 
    SelectControl, 
    ToggleControl,
    Button,
    Notice
} from '@wordpress/components';

const SettingsPage = () => {
    const [settings, setSettings] = useState({
        general: {
            default_layout: 'grid',
            lazy_load: true,
            retina_support: true,
        },
        permissions: {
            roles_manage: ['administrator'],
            roles_edit: ['administrator', 'editor'],
            roles_view_stats: ['administrator'],
        },
        integrations: {
            elementor: true,
            divi: true,
            beaver: false,
        },
    });
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const layoutOptions = [
        { label: __('Grid', 'fotogrids'), value: 'grid' },
        { label: __('Masonry', 'fotogrids'), value: 'masonry' },
        { label: __('Justified', 'fotogrids'), value: 'justified' },
    ];

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage('');

        try {
            // This would save to WordPress options via REST API
            await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
            setSaveMessage(__('Settings saved successfully!', 'fotogrids'));
        } catch (error) {
            setSaveMessage(__('Error saving settings. Please try again.', 'fotogrids'));
        } finally {
            setSaving(false);
        }
    };

    const updateGeneralSetting = (key: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            general: {
                ...prev.general,
                [key]: value,
            },
        }));
    };

    const updateIntegrationSetting = (key: string, value: boolean) => {
        setSettings(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                [key]: value,
            },
        }));
    };

    const tabs = [
        {
            name: 'general',
            title: __('General', 'fotogrids'),
            content: (
                <Card>
                    <CardBody>
                        <SelectControl
                            label={__('Default Template', 'fotogrids')}
                            value={settings.general.default_layout}
                            options={layoutOptions}
                            onChange={(value) => updateGeneralSetting('default_layout', value)}
                            help={__('Default template for new galleries', 'fotogrids')}
                        />

                        <ToggleControl
                            label={__('Lazy Loading', 'fotogrids')}
                            checked={settings.general.lazy_load}
                            onChange={(value) => updateGeneralSetting('lazy_load', value)}
                            help={__('Load items as they come into view', 'fotogrids')}
                        />

                        <ToggleControl
                            label={__('Retina Support', 'fotogrids')}
                            checked={settings.general.retina_support}
                            onChange={(value) => updateGeneralSetting('retina_support', value)}
                            help={__('Serve high-resolution items for retina displays', 'fotogrids')}
                        />
                    </CardBody>
                </Card>
            ),
        },
        {
            name: 'permissions',
            title: __('Permissions', 'fotogrids'),
            content: (
                <Card>
                    <CardBody>
                        <div className="permissions-info">
                            <p>
                                {__(
                                    'Control which user roles can manage galleries and view statistics.',
                                    'fotogrids'
                                )}
                            </p>
                        </div>

                        <div className="permission-setting">
                            <h4>{__('Roles allowed to manage galleries', 'fotogrids')}</h4>
                            <div className="role-checkboxes">
                                <label>
                                    <input type="checkbox" checked disabled />
                                    {__('Administrator', 'fotogrids')}
                                </label>
                                <label>
                                    <input type="checkbox" checked />
                                    {__('Editor', 'fotogrids')}
                                </label>
                                <label>
                                    <input type="checkbox" />
                                    {__('Author', 'fotogrids')}
                                </label>
                            </div>
                        </div>

                        <div className="permission-setting">
                            <h4>{__('Roles allowed to view statistics', 'fotogrids')}</h4>
                            <div className="role-checkboxes">
                                <label>
                                    <input type="checkbox" checked disabled />
                                    {__('Administrator', 'fotogrids')}
                                </label>
                                <label>
                                    <input type="checkbox" />
                                    {__('Editor', 'fotogrids')}
                                </label>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            ),
        },
        {
            name: 'integrations',
            title: __('Integrations (Pro)', 'fotogrids'),
            content: (
                <Card>
                    <CardBody>
                        <div className="integrations-info">
                            <p>
                                {__(
                                    'Enable integrations with popular page builders. Requires Pro license.',
                                    'fotogrids'
                                )}
                            </p>
                        </div>

                        <ToggleControl
                            label={__('Elementor', 'fotogrids')}
                            checked={settings.integrations.elementor}
                            onChange={(value) => updateIntegrationSetting('elementor', value)}
                            disabled={true}
                            help={__('Add FotoGrids widget to Elementor', 'fotogrids')}
                        />

                        <ToggleControl
                            label={__('Divi', 'fotogrids')}
                            checked={settings.integrations.divi}
                            onChange={(value) => updateIntegrationSetting('divi', value)}
                            disabled={true}
                            help={__('Add FotoGrids module to Divi Builder', 'fotogrids')}
                        />

                        <ToggleControl
                            label={__('Beaver Builder', 'fotogrids')}
                            checked={settings.integrations.beaver}
                            onChange={(value) => updateIntegrationSetting('beaver', value)}
                            disabled={true}
                            help={__('Add FotoGrids module to Beaver Builder', 'fotogrids')}
                        />

                        <div className="pro-notice">
                            <Button variant="primary" href="admin.php?page=fotogrids-license">
                                {__('Upgrade to Pro', 'fotogrids')}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            ),
        },
    ];

    return (
        <div className="fotogrids-settings-page">
            {saveMessage && (
                <Notice 
                    status={saveMessage.includes('Error') ? 'error' : 'success'} 
                    isDismissible={true}
                    onRemove={() => setSaveMessage('')}
                >
                    {saveMessage}
                </Notice>
            )}

            <TabPanel
                className="fotogrids-settings-tabs"
                activeClass="active-tab"
                tabs={tabs}
            >
                {(tab) => tab.content}
            </TabPanel>

            <div className="settings-actions">
                <Button 
                    variant="primary" 
                    onClick={handleSave}
                    isBusy={saving}
                    disabled={saving}
                >
                    {saving ? __('Saving...', 'fotogrids') : __('Save Settings', 'fotogrids')}
                </Button>
            </div>
        </div>
    );
};

export default SettingsPage;
