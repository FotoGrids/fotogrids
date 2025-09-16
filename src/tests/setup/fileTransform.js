/**
 * File Transform for Jest
 * 
 * Transforms static file imports in tests
 */

const path = require('path');

module.exports = {
    process(src, filename) {
        const assetFilename = JSON.stringify(path.basename(filename));
        
        if (filename.match(/\.svg$/)) {
            return {
                code: `
                    const React = require('react');
                    module.exports = {
                        __esModule: true,
                        default: ${assetFilename},
                        ReactComponent: React.forwardRef(function SvgComponent(props, ref) {
                            return React.createElement('svg', Object.assign({}, props, {ref}));
                        })
                    };
                `
            };
        }
        
        return {
            code: `module.exports = ${assetFilename};`
        };
    }
};
