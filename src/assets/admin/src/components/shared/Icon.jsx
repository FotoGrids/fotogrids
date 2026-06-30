import React from 'react';

const Icon = ({ name, className = "" }) => {
    const icons = window.FotoGridsIcons || {};
    const iconSvg = icons[name];
    
    if (!iconSvg) {
        return <span className={`fotogrids-icon fotogrids-icon--${name} ${className}`}>{name}</span>;
    }
    
    return (
        <span 
            className={`fotogrids-icon fotogrids-icon--${name} ${className}`}
            dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
    );
};

export default Icon;

