const fs = require('fs');
const path = require('path');

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

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

// Copy source files
console.log('📁 Copying source files...');
copyDir(path.join(__dirname, 'src'), distDir);

// Copy webpack-built assets
const webpackDistDir = path.join(__dirname, 'dist/prod');
console.log('Looking for webpack build in:', webpackDistDir);
if (fs.existsSync(webpackDistDir)) {
    console.log('📦 Copying webpack-built assets...');
    
    // Copy built JS files
    const builtJsDir = path.join(webpackDistDir, 'assets/js');
    const targetJsDir = path.join(distDir, 'assets/js');
    if (fs.existsSync(builtJsDir)) {
        fs.mkdirSync(targetJsDir, { recursive: true });
        const jsFiles = fs.readdirSync(builtJsDir);
        jsFiles.forEach(file => {
            fs.copyFileSync(path.join(builtJsDir, file), path.join(targetJsDir, file));
        });
    }
    
    // Copy built CSS files if they exist
    const builtCssDir = path.join(webpackDistDir, 'assets/css');
    const targetCssDir = path.join(distDir, 'assets/css');
    if (fs.existsSync(builtCssDir)) {
        fs.mkdirSync(targetCssDir, { recursive: true });
        const cssFiles = fs.readdirSync(builtCssDir);
        cssFiles.forEach(file => {
            fs.copyFileSync(path.join(builtCssDir, file), path.join(targetCssDir, file));
        });
    }
} else {
    console.log('⚠️  No webpack build found, creating basic assets...');
    
    // Fallback: Create basic assets if webpack build doesn't exist
    const assetsDir = path.join(distDir, 'assets');
    fs.mkdirSync(path.join(assetsDir, 'js'), { recursive: true });
    fs.mkdirSync(path.join(assetsDir, 'css'), { recursive: true });

    const adminJs = `console.log('FotoGrids Admin loaded - basic version');`;
    const frontendJs = `console.log('FotoGrids Frontend loaded');`;
    const adminCss = `.fotogrids-admin { max-width: 1200px; margin: 0 auto; }`;

    fs.writeFileSync(path.join(assetsDir, 'js', 'admin.js'), adminJs);
    fs.writeFileSync(path.join(assetsDir, 'js', 'frontend.js'), frontendJs);
    fs.writeFileSync(path.join(assetsDir, 'css', 'admin.css'), adminCss);
}

console.log('✅ Build complete! Plugin ready for testing.');
console.log('📦 Plugin files are in: ./dist/');
console.log('');
console.log('🚀 To test in WordPress:');
console.log('1. Copy the entire ./dist/ folder to your WordPress wp-content/plugins/');
console.log('2. Rename it to "fotogrids"');
console.log('3. Activate the plugin in WordPress admin');
console.log('4. Look for "FotoGrids" in the admin menu');
