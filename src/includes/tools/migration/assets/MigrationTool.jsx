import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import Icon from '@/admin/src/components/shared/Icon.jsx';
import { Button } from '@/admin/src/components/shared/Button';

const baseClass = 'fg-migration';

/**
 * The source plugins we plan to support, in the order they ship.
 *
 * SCAFFOLD: `detected` / `count` are placeholders. Once the
 * /admin/tools/migration/sources endpoint exists, this list is replaced
 * by the manifest it returns, and `detected` reflects whether the source
 * plugin's data is actually present on this site.
 *
 * @see Plugin/docs/migration-tool-plan.md
 */
const SOURCES = [
    {
        id: 'envira',
        label: __('Envira Gallery', 'fotogrids'),
        description: __('Galleries stored as Envira posts, with per-image captions and links.', 'fotogrids'),
        icon: 'image',
    },
    {
        id: 'modula',
        label: __('Modula', 'fotogrids'),
        description: __('Grid, masonry, and custom galleries with per-image metadata.', 'fotogrids'),
        icon: 'masonry',
    },
    {
        id: 'nextgen',
        label: __('NextGEN Gallery', 'fotogrids'),
        description: __('Galleries and albums stored in NextGEN’s own database tables.', 'fotogrids'),
        icon: 'grid',
    },
    {
        id: 'wp-core',
        label: __('WordPress galleries', 'fotogrids'),
        description: __('Classic [gallery] shortcodes and core gallery blocks already in your posts.', 'fotogrids'),
        icon: 'folder',
    },
];

/**
 * A single source-plugin card. Non-functional in this pass: selecting a
 * card just marks it active and shows the not-yet-available notice. The
 * "Select" action is disabled.
 */
const SourceCard = ({ source, active, onSelect }) => {
    const cardClasses = [
        `${baseClass}__source-card`,
        active ? `${baseClass}__source-card--active` : '',
    ].filter(Boolean).join(' ');

    return (
        <button
            type="button"
            className={cardClasses}
            onClick={() => onSelect(source.id)}
            aria-pressed={active}
        >
            <span className={`${baseClass}__source-icon`}>
                <Icon name={source.icon} />
            </span>
            <span className={`${baseClass}__source-body`}>
                <span className={`${baseClass}__source-label`}>{source.label}</span>
                <span className={`${baseClass}__source-description`}>{source.description}</span>
            </span>
            <span className={`${baseClass}__source-status`}>
                {__('Coming soon', 'fotogrids')}
            </span>
        </button>
    );
};

/**
 * Migration Tool
 *
 * SCAFFOLD STATE: renders the source-plugin picker chrome only. No scan,
 * preview, or import behaviour is wired up yet - selecting a source shows
 * a "not available yet" panel. See migration-tool-plan.md for the full
 * intended flow (source picker → scan → preview → import → log).
 *
 * REST base (planned): /fotogrids/v1/admin/tools/migration/
 */
const MigrationTool = () => {
    const [selectedSource, setSelectedSource] = useState(null);

    const current = SOURCES.find(s => s.id === selectedSource) || null;

    return (
        <>
            <Panel
                title={__('Migration', 'fotogrids')}
                description={__('Choose the plugin you’re moving from. FotoGrids will read its galleries and recreate them here, so you don’t have to rebuild anything by hand.', 'fotogrids')}
                noBody
            />

            <Panel equalBodyPadding>
                <div className={`${baseClass}__sources`}>
                    {SOURCES.map(source => (
                        <SourceCard
                            key={source.id}
                            source={source}
                            active={selectedSource === source.id}
                            onSelect={setSelectedSource}
                        />
                    ))}
                </div>
            </Panel>

            {current && (
                <Panel equalBodyPadding>
                    <div className={`${baseClass}__placeholder`}>
                        <span className={`${baseClass}__placeholder-icon`}>
                            <Icon name="rocket" />
                        </span>
                        <h3 className={`${baseClass}__placeholder-title`}>
                            {/* translators: %s: source plugin name */}
                            {current.label}
                        </h3>
                        <p className={`${baseClass}__placeholder-text`}>
                            {__('Migration for this source isn’t available yet. The groundwork is in place - scanning and importing will arrive in an upcoming release.', 'fotogrids')}
                        </p>
                        <Button variant="primary" disabled>
                            {__('Scan galleries', 'fotogrids')}
                        </Button>
                    </div>
                </Panel>
            )}
        </>
    );
};

export default MigrationTool;
