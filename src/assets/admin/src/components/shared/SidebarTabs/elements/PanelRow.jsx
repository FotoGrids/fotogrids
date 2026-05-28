import React from 'react';

/**
 * PanelRow - a two-column label/control row.
 *
 * Left column carries the title + description; right column carries the
 * control(s). Replaces the old form-table <tr><th><td> rows with a flexible
 * grid that collapses to a single column on narrow screens.
 *
 * @param {Object} props
 * @param {string|React.ReactNode} props.title           Setting name.
 * @param {string|React.ReactNode} [props.description]   Helper text under the title.
 * @param {string}                 [props.htmlFor]       Ties the label to a control id.
 * @param {boolean}                [props.fullWidth]     Render the control under the label (single column).
 * @param {boolean}                [props.splitColumns]  Two equal columns, each min 220px. Use when the
 *                                                       label and control deserve the same visual weight
 *                                                       (e.g. a description-heavy row with a large control).
 * @param {string}                 [props.className]     Extra class on the root.
 * @param {React.ReactNode}        props.children        The control(s).
 */
const PanelRow = ({
    title,
    description,
    htmlFor,
    fullWidth = false,
    splitColumns = false,
    largerLabels = false,
    className = '',
    children,
}) => {
    const LabelTag = htmlFor ? 'label' : 'span';
    const renderDescription = (value) => {
        if (typeof value !== 'string') return value;

        const parts = value.split(/`([^`]+)`/g);
        if (parts.length === 1) return value;

        return parts.map((part, index) => (
            index % 2 === 1
                ? <code key={`code-${index}`}>{part}</code>
                : <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
        ));
    };

    const baseClass = 'fotogrids-sidebar-layout__panel__row';

    const modifierClass = fullWidth    ? ` ${baseClass}--full`
                        : splitColumns ? ` ${baseClass}--split`
                        : largerLabels ? ` ${baseClass}--larger-labels`
                        : '';

    return (
        <div
            className={
                baseClass +
                modifierClass +
                (className ? ` ${className}` : '')
            }
        >
            <div className={`${baseClass}__label-col`}>
                {title && (
                    <LabelTag
                        className={`${baseClass}__title`}
                        htmlFor={htmlFor || undefined}
                    >
                        {title}
                    </LabelTag>
                )}
                {description && (
                    <div className={`${baseClass}__description`}>
                        {renderDescription(description)}
                    </div>
                )}
            </div>
            <div className={`${baseClass}__control-col`}>
                {children}
            </div>
        </div>
    );
};

export default PanelRow;
