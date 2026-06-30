import React from 'react';

const ToggleList = ( {
    children,
    className = '',
    bigger = false,
    noBorder = false,
} ) => {
    const baseClass = 'fotogrids-toggle-list';
    const rootClassName = [
        baseClass,
        bigger ? `${baseClass}--bigger` : '',
        noBorder ? `${baseClass}--no-border` : '',
        className,
    ]
        .filter( Boolean )
        .join( ' ' );

    return (
        <div className={ rootClassName }>
            { children }
        </div>
    );
};

export default ToggleList;
