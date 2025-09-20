const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏗️  Building FotoGrids Plugin for WordPress testing...');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Step 1: Build with webpack first
console.log('🔧 Running webpack build...');
try {
    execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Webpack build failed:', error.message);
    process.exit(1);
}

// Step 2: Create final dist directory
const finalDistDir = path.join(__dirname, 'dist-final');
if (fs.existsSync(finalDistDir)) {
    fs.rmSync(finalDistDir, { recursive: true });
}
fs.mkdirSync(finalDistDir);

// Step 3: Copy PHP source files
console.log('📁 Copying PHP source files...');
copyDir(path.join(__dirname, 'src'), finalDistDir);

// Step 4: Copy webpack-built assets
const webpackDistDir = path.join(__dirname, 'dist/prod');
console.log('📦 Copying webpack-built assets from:', webpackDistDir);

if (fs.existsSync(webpackDistDir)) {
    // Copy built JS files
    const builtJsDir = path.join(webpackDistDir, 'assets/js');
    const targetJsDir = path.join(finalDistDir, 'assets/js');
    if (fs.existsSync(builtJsDir)) {
        fs.mkdirSync(targetJsDir, { recursive: true });
        const jsFiles = fs.readdirSync(builtJsDir);
        jsFiles.forEach(file => {
            console.log('  Copying JS:', file);
            fs.copyFileSync(path.join(builtJsDir, file), path.join(targetJsDir, file));
        });
    }
    
    // Copy built CSS files if they exist
    const builtCssDir = path.join(webpackDistDir, 'assets/css');
    const targetCssDir = path.join(finalDistDir, 'assets/css');
    if (fs.existsSync(builtCssDir)) {
        fs.mkdirSync(targetCssDir, { recursive: true });
        const cssFiles = fs.readdirSync(builtCssDir);
        cssFiles.forEach(file => {
            console.log('  Copying CSS:', file);
            fs.copyFileSync(path.join(builtCssDir, file), path.join(targetCssDir, file));
        });
    }
} else {
    console.log('❌ No webpack build found at:', webpackDistDir);
    process.exit(1);
}

// Step 5: Clean up intermediate build
fs.rmSync(path.join(__dirname, 'dist'), { recursive: true });

// Step 6: Rename final dist
fs.renameSync(finalDistDir, path.join(__dirname, 'dist'));

console.log('✅ Build complete! Plugin ready for testing.');
console.log('📦 Plugin files are in: ./dist/');
console.log('');
console.log('🚀 To test in WordPress:');
console.log('1. Copy the entire ./dist/ folder to your WordPress wp-content/plugins/');
console.log('2. Rename it to "fotogrids"');
console.log('3. Activate the plugin in WordPress admin');
console.log('4. Look for "FotoGrids" in the admin menu');
console.log('5. The React admin interface should now load!');
