import React from 'react';
import Icon from '../Icon';

/**
 * DangerZone — a red-tinted row for a destructive setting, e.g. "delete all
 * data on uninstall". Carries an icon, a title + description, and a control
 * (typically a Toggle) on the right.
 *
 * @param {Object}                 props
 * @param {string|React.ReactNode} props.title
 * @param {string|React.ReactNode} [props.description]
 * @param {string}                 [props.icon]      FotoGridsIcons name (defaults to "remove_item").
 * @param {React.ReactNode}        props.children    The control.
 */
const DangerZone = ({
    title,
    description,
    icon = 'remove_item',
    children,
}) => {
    return (
        <div className="fotogrids-danger-zone">
            <div className="fotogrids-danger-zone__icon">
                <Icon name={icon} />
            </div>
            <div className="fotogrids-danger-zone__text">
                {title && <h4 className="fotogrids-danger-zone__title">{title}</h4>}
                {description && (
                    <p className="fotogrids-danger-zone__description">{description}</p>
                )}
            </div>
            <div className="fotogrids-danger-zone__control">{children}</div>
        </div>
    );
};

export default DangerZone;
