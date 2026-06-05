import React from 'react';
import Icon from './Icon';

const { __ } = wp.i18n;

/**
 * Read the localised capabilities snapshot. Returns null if the bag isn't
 * present (uncommon - this would mean class-admin-init hasn't run, e.g. a
 * non-admin page) which we treat as "allowed" so we don't accidentally lock
 * unrelated surfaces.
 */
const userHasCap = (cap) => {
    const bag = window.fotogridsAdmin?.capabilities;
    if (!bag) return true;
    return bag[cap] === true;
};

/**
 * SettingsLock - read-only gate around the Collection Settings and Templates
 * metabox content for users who lack the relevant
 * modify_fotogrids_{gallery|album}_settings cap.
 *
 * When the user has the cap, the wrapper is a passthrough.
 *
 * When the user lacks it:
 *   - Children render inside <fieldset disabled> so every form control inside
 *     becomes unusable in one line, regardless of how deep it nests.
 *   - A locked badge is rendered above the children explaining why.
 *
 * The server still enforces via Permission_Gate - this wrapper is the
 * client-side render hint that keeps unauthorised users from generating
 * payloads that would be silently dropped on save.
 *
 * @param {Object}          props
 * @param {string}          props.cap        Atomic cap to gate on.
 * @param {React.ReactNode} props.children   Wrapped content.
 * @param {string}          [props.title]    Override the locked-badge title.
 * @param {string}          [props.message]  Override the locked-badge body.
 * @param {string}          [props.className] Extra class on the root.
 */
const SettingsLock = ({ cap, children, title, message, className = '' }) => {
    if (!cap || userHasCap(cap)) {
        return <>{children}</>;
    }

    return (
        <div className={`fg-settings-lock ${className}`.trim()}>
            <div className="fg-settings-lock__badge" role="note">
                <Icon name="lock" className="fg-settings-lock__icon" />
                <div className="fg-settings-lock__text">
                    <strong>
                        {title || __('Locked — administrator only', 'fotogrids')}
                    </strong>
                    <span>
                        {message || __(
                            'Your role can view these settings but cannot change them. Ask an administrator if you need to make changes here.',
                            'fotogrids'
                        )}
                    </span>
                </div>
            </div>
            <fieldset className="fg-settings-lock__fieldset" disabled aria-disabled="true">
                {children}
            </fieldset>
        </div>
    );
};

export default SettingsLock;

/**
 * Convenience helper for non-component code (event handlers, payload
 * filters) that needs to know whether the current user can modify settings
 * on a given CPT.
 *
 * @param {string} postType 'fotogrids_gallery' | 'fotogrids_album'.
 * @returns {boolean}
 */
export const canModifyCollectionSettings = (postType) => {
    const cap = postType === 'fotogrids_album'
        ? 'modify_fotogrids_album_settings'
        : 'modify_fotogrids_gallery_settings';
    return userHasCap(cap);
};
