/**
 * CSS Transform for Jest
 * 
 * Transforms CSS/SCSS imports in tests
 */

module.exports = {
    process() {
        return {
            code: 'module.exports = {};'
        };
    },
    getCacheKey() {
        return 'cssTransform';
    }
};
