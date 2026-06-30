import React from 'react';
import Icon from './Icon';

/**
 * DangerZone - a red-tinted row for a destructive action. Carries an icon,
 * a title + optional description, and a control on the right (typically a
 * Toggle or a primary button).
 *
 * Moved from shared/settings/ to shared/ - destructive-action UI is needed
 * in tools, modals, and other surfaces beyond settings pages.
 *
 * @param {Object}                 props
 * @param {string|React.ReactNode} props.title
 * @param {string|React.ReactNode} [props.description]
 * @param {string}                 [props.icon]      FotoGridsIcons name (defaults to "remove_item").
 * @param {React.ReactNode}        props.children    The control (right slot).
 */
const DangerZone = ({
    title,
    description,
    icon = 'alert_bubble',
    children,
}) => {
    const baseClass = 'fotogrids-danger-zone';

    return (
        <div className={baseClass}>
            <div className={`${baseClass}__icon`}>
                <Icon name={icon} />
            </div>
            <div className={`${baseClass}__text`}>
                {title && <h4 className={`${baseClass}__title`}>{title}</h4>}
                {description && (
                    <p className={`${baseClass}__description`}>{description}</p>
                )}
            </div>
            <div className={`${baseClass}__control`}>{children}</div>
        </div>
    );
};

export default DangerZone;
