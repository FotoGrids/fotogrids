import React from 'react';
import { useModalContext } from '../hooks/useModalContext';

const ModalHeaderTitle = ({
    level = 2,
    as,
    className = '',
    children,
    ...rest
}) => {
    const ctx = useModalContext();
    const Tag = as || `h${ level }`;
    const classes = [
        'fg-modal__header__title',
        `fg-modal__header__title--level-${ level }`,
        className,
    ].filter(Boolean).join(' ');

    return (
        <Tag className={ classes } id={ ctx?.titleId } { ...rest }>
            { children }
        </Tag>
    );
};

export default ModalHeaderTitle;
