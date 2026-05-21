import React from 'react';

/**
 * SettingRow — a two-column label/control row.
 *
 * Left column carries the title + description; right column carries the
 * control(s). Replaces the old form-table <tr><th><td> rows with a flexible
 * grid that collapses to a single column on narrow screens.
 *
 * @param {Object} props
 * @param {string|React.ReactNode} props.title          Setting name.
 * @param {string|React.ReactNode} [props.description]  Helper text under the title.
 * @param {string}                 [props.htmlFor]      Ties the label to a control id.
 * @param {boolean}                [props.fullWidth]    Render the control under the label (single column).
 * @param {string}                 [props.className]    Extra class on the root.
 * @param {React.ReactNode}        props.children       The control(s).
 */
const SettingRow = ({
    title,
    description,
    htmlFor,
    fullWidth = false,
    className = '',
    children,
}) => {
    const LabelTag = htmlFor ? 'label' : 'span';

    return (
        <div
            className={
                'fotogrids-setting-row' +
                (fullWidth ? ' fotogrids-setting-row--full' : '') +
                (className ? ` ${className}` : '')
            }
        >
            <div className="fotogrids-setting-row__label-col">
                {title && (
                    <LabelTag
                        className="fotogrids-setting-row__title"
                        htmlFor={htmlFor || undefined}
                    >
                        {title}
                    </LabelTag>
                )}
                {description && (
                    <div className="fotogrids-setting-row__description">{description}</div>
                )}
            </div>
            <div className="fotogrids-setting-row__control-col">
                {children}
            </div>
        </div>
    );
};

export default SettingRow;
