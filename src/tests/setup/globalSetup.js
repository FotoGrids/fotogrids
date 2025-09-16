/**
 * Global Test Setup
 * 
 * Runs once before all tests
 */

module.exports = async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.WP_DEBUG = 'true';
    
    // Global test setup can go here
    console.log('🧪 Setting up FotoGrids test environment...');
};
