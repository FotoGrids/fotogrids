const fs = require('fs-extra');
const path = require('path');

console.log('🏗️  Building FotoGrids Plugin for WordPress testing...');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
fs.ensureDirSync(distDir);

// Copy all PHP files
console.log('📁 Copying PHP files...');
fs.copySync(path.join(__dirname, 'src'), distDir, {
  filter: (src) => {
    return src.endsWith('.php') || 
           src.endsWith('.txt') || 
           src.endsWith('.css') || 
           src.endsWith('.js') ||
           src.includes('/assets/') ||
           fs.statSync(src).isDirectory();
  }
});

// Create basic compiled assets directories
const assetsDir = path.join(distDir, 'assets');
fs.ensureDirSync(path.join(assetsDir, 'js'));
fs.ensureDirSync(path.join(assetsDir, 'css'));

// Create basic admin.js (minimal version)
const adminJs = `
// Basic FotoGrids Admin Script
jQuery(document).ready(function($) {
    console.log('FotoGrids Admin loaded');
    
    // Basic gallery management
    if (window.fotogridsAdmin) {
        // Initialize admin interface
        const adminContainer = document.getElementById('fotogrids-admin-root');
        if (adminContainer) {
            adminContainer.innerHTML = '<div class="wrap"><h1>FotoGrids</h1><p>Admin interface loading...</p></div>';
        }
    }
});
`;

// Create basic frontend.js
const frontendJs = `
// Basic FotoGrids Frontend Script
(function() {
    'use strict';
    
    console.log('FotoGrids Frontend loaded');
    
    // Basic gallery functionality
    document.addEventListener('DOMContentLoaded', function() {
        const galleries = document.querySelectorAll('.fotogrids-gallery');
        
        galleries.forEach(function(gallery) {
            const items = gallery.querySelectorAll('.fotogrids-item img');
            
            items.forEach(function(img) {
                img.addEventListener('click', function() {
                    console.log('Image clicked:', img.src);
                    // Basic lightbox functionality would go here
                });
            });
        });
    });
})();
`;

// Create basic admin.css
const adminCss = `
/* Basic FotoGrids Admin Styles */
.fotogrids-admin {
    max-width: 1200px;
    margin: 0 auto;
}

.fotogrids-gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    padding: 20px;
}

.fotogrids-gallery-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s;
}

.fotogrids-gallery-item:hover {
    transform: scale(1.02);
}

.fotogrids-gallery-item img {
    width: 100%;
    height: auto;
    display: block;
}
`;

// Write compiled assets
fs.writeFileSync(path.join(assetsDir, 'js', 'admin.js'), adminJs);
fs.writeFileSync(path.join(assetsDir, 'js', 'frontend.js'), frontendJs);
fs.writeFileSync(path.join(assetsDir, 'css', 'admin.css'), adminCss);

// Copy main plugin file to root of dist
fs.copyFileSync(
    path.join(__dirname, 'src', 'fotogrids.php'),
    path.join(distDir, 'fotogrids.php')
);

// Copy readme.txt to root of dist  
fs.copyFileSync(
    path.join(__dirname, 'src', 'readme.txt'),
    path.join(distDir, 'readme.txt')
);

// Copy uninstall.php to root of dist
fs.copyFileSync(
    path.join(__dirname, 'src', 'uninstall.php'),
    path.join(distDir, 'uninstall.php')
);

// Copy index.php to root of dist
fs.copyFileSync(
    path.join(__dirname, 'src', 'index.php'),
    path.join(distDir, 'index.php')
);

console.log('✅ Build complete! Plugin ready for testing.');
console.log('📦 Plugin files are in: ./dist/');
console.log('');
console.log('🚀 To test in WordPress:');
console.log('1. Zip the dist folder: npm run zip');
console.log('2. Upload to WordPress: Plugins > Add New > Upload Plugin');
console.log('3. Or copy dist folder to wp-content/plugins/fotogrids/');
