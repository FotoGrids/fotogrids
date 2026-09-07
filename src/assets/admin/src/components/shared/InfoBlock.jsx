import React from 'react';
import Icon from './Icon';

/**
 * InfoBlock - an informational row with icon, text, and control slot.
 * Carries an icon, a title + optional description, and a control on the
 * right (typically a Toggle or a primary button).
 *
 * Shared informational UI that can be reused in tools, modals, and settings
 * surfaces.
 *
 * @param {Object}                 props
 * @param {string|React.ReactNode} props.title
 * @param {string|React.ReactNode} [props.description]
 * @param {string}                 [props.icon]      FotoGridsIcons name. Defaults to the variant's icon.
 * @param {'info'|'warning'}       [props.variant]   Colour treatment. Defaults to "info".
 * @param {React.ReactNode}        props.children    The control (right slot).
 */
const InfoBlock = ({
    title,
    description,
    icon,
    variant = 'info',
    children,
}) => {
    const baseClass = 'fotogrids-info-block';
    const resolvedIcon = icon || ('warning' === variant ? 'alert_circle' : 'info_square');

    return (
        <div className={`${baseClass} ${baseClass}--${variant}`}>
            <div className={`${baseClass}__icon`}>
                <Icon name={resolvedIcon} />
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

export default InfoBlock;
