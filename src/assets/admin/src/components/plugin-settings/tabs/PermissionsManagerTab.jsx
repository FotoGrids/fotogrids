import React, { useState, useEffect } from 'react';
import Icon from '../../shared/Icon';

const { __ } = wp.i18n;

const FOTOGRIDS_PERMISSIONS = [
    {
        key: 'edit_fotogrids_gallery',
        label: __('Edit Gallery Items', 'fotogrids'),
        description: __('Allows users to edit individual gallery items and their metadata.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'read_fotogrids_gallery',
        label: __('Read Gallery Items', 'fotogrids'),
        description: __('Allows users to view gallery items and their details.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'delete_fotogrids_gallery',
        label: __('Delete Gallery Items', 'fotogrids'),
        description: __('Allows users to delete individual gallery items.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'edit_fotogrids_galleries',
        label: __('Edit Gallery Settings', 'fotogrids'),
        description: __('Allows users to edit gallery settings, layout, and configuration.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'edit_others_fotogrids_galleries',
        label: __('Edit Others\' Galleries', 'fotogrids'),
        description: __('Allows users to edit galleries created by other users.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'publish_fotogrids_galleries',
        label: __('Publish Galleries', 'fotogrids'),
        description: __('Allows users to publish galleries and make them publicly visible.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'read_private_fotogrids_galleries',
        label: __('Read Private Galleries', 'fotogrids'),
        description: __('Allows users to view private galleries that are not publicly accessible.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'delete_fotogrids_galleries',
        label: __('Delete Galleries', 'fotogrids'),
        description: __('Allows users to delete entire galleries.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'delete_private_fotogrids_galleries',
        label: __('Delete Private Galleries', 'fotogrids'),
        description: __('Allows users to delete private galleries.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'delete_published_fotogrids_galleries',
        label: __('Delete Published Galleries', 'fotogrids'),
        description: __('Allows users to delete published galleries.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'delete_others_fotogrids_galleries',
        label: __('Delete Others\' Galleries', 'fotogrids'),
        description: __('Allows users to delete galleries created by other users.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'edit_private_fotogrids_galleries',
        label: __('Edit Private Galleries', 'fotogrids'),
        description: __('Allows users to edit private galleries.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'edit_published_fotogrids_galleries',
        label: __('Edit Published Galleries', 'fotogrids'),
        description: __('Allows users to edit published galleries.', 'fotogrids'),
        category: 'gallery'
    },
    {
        key: 'edit_fotogrids_album',
        label: __('Edit Album Items', 'fotogrids'),
        description: __('Allows users to edit individual album items.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'read_fotogrids_album',
        label: __('Read Album Items', 'fotogrids'),
        description: __('Allows users to view album items and their details.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'delete_fotogrids_album',
        label: __('Delete Album Items', 'fotogrids'),
        description: __('Allows users to delete individual album items.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'edit_fotogrids_albums',
        label: __('Edit Album Settings', 'fotogrids'),
        description: __('Allows users to edit album settings and configuration.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'edit_others_fotogrids_albums',
        label: __('Edit Others\' Albums', 'fotogrids'),
        description: __('Allows users to edit albums created by other users.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'publish_fotogrids_albums',
        label: __('Publish Albums', 'fotogrids'),
        description: __('Allows users to publish albums and make them publicly visible.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'read_private_fotogrids_albums',
        label: __('Read Private Albums', 'fotogrids'),
        description: __('Allows users to view private albums that are not publicly accessible.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'delete_fotogrids_albums',
        label: __('Delete Albums', 'fotogrids'),
        description: __('Allows users to delete entire albums.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'delete_private_fotogrids_albums',
        label: __('Delete Private Albums', 'fotogrids'),
        description: __('Allows users to delete private albums.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'delete_published_fotogrids_albums',
        label: __('Delete Published Albums', 'fotogrids'),
        description: __('Allows users to delete published albums.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'delete_others_fotogrids_albums',
        label: __('Delete Others\' Albums', 'fotogrids'),
        description: __('Allows users to delete albums created by other users.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'edit_private_fotogrids_albums',
        label: __('Edit Private Albums', 'fotogrids'),
        description: __('Allows users to edit private albums.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'edit_published_fotogrids_albums',
        label: __('Edit Published Albums', 'fotogrids'),
        description: __('Allows users to edit published albums.', 'fotogrids'),
        category: 'album'
    },
    {
        key: 'manage_fotogrids',
        label: __('Manage FotoGrids', 'fotogrids'),
        description: __('Full access to all FotoGrids features and administration.', 'fotogrids'),
        category: 'plugin'
    },
    {
        key: 'view_fotogrids_stats',
        label: __('View Statistics', 'fotogrids'),
        description: __('Allows users to view gallery and album statistics and analytics.', 'fotogrids'),
        category: 'plugin'
    },
    {
        key: 'manage_fotogrids_settings',
        label: __('Manage Plugin Settings', 'fotogrids'),
        description: __('Allows users to access and modify global plugin settings.', 'fotogrids'),
        category: 'plugin'
    },
    {
        key: 'assign_albums_to_galleries',
        label: __('Assign Albums to Galleries', 'fotogrids'),
        description: __('Allows users to assign albums to galleries and manage relationships.', 'fotogrids'),
        category: 'plugin'
    },
    {
        key: 'apply_templates',
        label: __('Apply Templates', 'fotogrids'),
        description: __('Allows users to apply templates to galleries and albums.', 'fotogrids'),
        category: 'plugin'
    }
];

const PermissionsManagerTab = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const apiUrl = window.fotogridsAdmin?.apiUrl || '';
                const restUrl = window.fotogridsAdmin?.restUrl || 'fotogrids/v1/';
                const nonce = window.fotogridsAdmin?.restNonce || '';

                const response = await fetch(`${apiUrl}${restUrl}admin/roles`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': nonce
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setRoles(data.roles || []);
                } else {
                    console.error('Failed to fetch roles');
                }
            } catch (error) {
                console.error('Error fetching roles:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRoles();
    }, []);

    const hasCapability = (role, capability) => {
        return role.capabilities && role.capabilities[capability] === true;
    };

    const getPermissionsByCategory = (category) => {
        return FOTOGRIDS_PERMISSIONS.filter(perm => perm.category === category);
    };

    const getCategoryLabel = (category) => {
        switch (category) {
            case 'gallery':
                return __('Gallery Permissions', 'fotogrids');
            case 'album':
                return __('Album Permissions', 'fotogrids');
            case 'plugin':
                return __('Plugin Permissions', 'fotogrids');
            default:
                return '';
        }
    };

    const buildRows = () => {
        const rows = [];
        const categories = ['gallery', 'album', 'plugin'];

        categories.forEach((category, categoryIndex) => {
            const permissions = getPermissionsByCategory(category);

            rows.push({
                type: 'header',
                category: category,
                label: getCategoryLabel(category)
            });

            permissions.forEach(permission => {
                rows.push({
                    type: 'permission',
                    permission: permission
                });
            });
        });

        return rows;
    };

    const rows = buildRows();
    const totalColumns = Math.max(roles.length, 1);

    if (loading) {
        return (
            <div className="fotogrids-permissions-manager">
                <p>{__('Loading roles...', 'fotogrids')}</p>
            </div>
        );
    }

    if (roles.length === 0) {
        return (
            <div className="fotogrids-permissions-manager">
                <h3>{__('Permissions Manager', 'fotogrids')}</h3>
                <p className="description">
                    {__('No roles found.', 'fotogrids')}
                </p>
            </div>
        );
    }

    const handleUpgradeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const upgradeUrl = window.fotogridsUpgradeModal?.urls?.upgrade;
        window.open(upgradeUrl, '_blank');
    };

    return (
        <div className="fotogrids-permissions-manager">
            <div className="fg-rpm__pro-box">
                <span className="fotogrids-pro-badge">{__('PRO', 'fotogrids')}</span>
                <div className="fg-rpm__pro-box-text">
                    {__('Take full control of permissions for any role and customize access levels with precision.', 'fotogrids')}
                </div>
                <button
                    type="button"
                    className="fotogrids-button fotogrids-button--primary fotogrids-button--small"
                    onClick={handleUpgradeClick}
                >
                    {__('Upgrade Now', 'fotogrids')}
                </button>
            </div>

            <div
                className="fg-rpm__table"
                style={{ '--columns': totalColumns }}
            >
                <div className="fg-rpm__header-cell fg-rpm__header-cell--permission">
                </div>
                {roles.map((role) => (
                    <div key={`header-${role.key}`} className="fg-rpm__header-cell">
                        {role.name}
                    </div>
                ))}

                {rows.map((row, rowIndex) => {
                    if (row.type === 'header') {
                        return (
                            <div key={`header-${row.category}`} className="fg-rpm__category-header">
                                <div className="fg-rpm__category-header-content">
                                    {row.label}
                                </div>
                            </div>
                        );
                    }

                    const { permission } = row;
                    const permissionRows = rows.filter(r => r.type === 'permission');
                    const permissionIndex = permissionRows.findIndex(r => r.permission.key === permission.key);
                    const isEven = permissionIndex % 2 === 0;

                    return (
                        <React.Fragment key={permission.key}>
                            <div className={`fg-rpm__cell fg-rpm__cell--permission ${isEven ? 'fg-rpm__cell--even' : 'fg-rpm__cell--odd'}`}>
                                <span
                                    className="fg-rpm__permission-name"
                                    data-tooltip={permission.description}
                                >
                                    {permission.label}
                                </span>
                            </div>
                            {roles.map((role) => {
                                const isChecked = hasCapability(role, permission.key);
                                const iconName = isChecked ? 'check_circle' : 'circle';

                                return (
                                    <div key={role.key} className={`fg-rpm__cell fg-rpm__cell--checkbox ${isChecked ? 'fg-rpm__cell--checkbox-checked' : ''} ${isEven ? 'fg-rpm__cell--even' : 'fg-rpm__cell--odd'}`}>
                                        <Icon name={iconName} />
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default PermissionsManagerTab;
