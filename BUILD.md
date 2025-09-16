# FotoGrids Build System

## Overview

FotoGrids uses a modern build system that compiles source code from `/src` and creates distribution-ready WordPress plugins in `/dist`.

## Project Structure

```
Plugin/
├── src/                          # Source code
│   ├── fotogrids.php            # Main plugin file
│   ├── readme.txt               # WordPress plugin readme
│   ├── index.php                # Security file
│   ├── uninstall.php            # Uninstall handler
│   ├── admin/                   # Admin PHP classes
│   ├── includes/                # Core PHP classes
│   ├── public/                  # Frontend PHP classes
│   ├── assets/                  # Source assets
│   │   ├── admin/src/           # React/TypeScript admin
│   │   └── frontend/src/        # Vanilla JS frontend
│   └── languages/               # Translation files
├── dist/                        # Built plugins (auto-generated)
│   ├── dev/                     # Development build
│   └── prod/                    # Production build
├── package.json                 # Build configuration
├── webpack.config.js            # Webpack configuration
├── tsconfig.json               # TypeScript configuration
├── .eslintrc.js                # Linting rules
└── .prettierrc                 # Code formatting
```

## Build Commands

### Development Build
```bash
npm run dev
```
- Creates development build in `dist/dev/`
- Includes source maps for debugging
- Watches for file changes
- Optimized for development speed

### Production Build
```bash
npm run build
```
- Creates production build in `dist/prod/`
- Minified and optimized assets
- No source maps
- Ready for distribution

### Development Build (One-time)
```bash
npm run build:dev
```
- Creates development build without watching

### Clean Build
```bash
npm run clean
```
- Removes all files from `dist/` directory

## Distribution Commands

### Create Development ZIP
```bash
npm run zip:dev
```
- Builds development version
- Creates `fotogrids-dev.zip` in Plugin root
- Ready for testing in WordPress

### Create Production ZIP
```bash
npm run zip:prod
```
- Builds production version
- Creates `fotogrids-v{version}.zip` in Plugin root
- Ready for distribution/WordPress.org

### Full Release Build
```bash
npm run release
```
- Cleans previous builds
- Creates production build
- Creates production ZIP
- One-command release process

## What Gets Built

### PHP Files
- All PHP files copied from `src/` to appropriate locations
- Path references updated for built structure
- WordPress plugin structure maintained

### JavaScript & TypeScript
- Admin React/TypeScript components compiled to `assets/js/admin.js`
- Frontend vanilla JS compiled to `assets/js/frontend.js`
- Vendor libraries split into separate chunks

### CSS & SCSS
- SCSS files compiled to CSS
- Admin styles: `assets/css/admin.css`
- CSS files minified in production

### Static Assets
- Images, fonts copied to `assets/images/`, `assets/fonts/`
- Template files and other static assets preserved
- Language files copied to `languages/`

## Built Plugin Structure

```
dist/prod/  (or dist/dev/)
├── fotogrids.php               # Main plugin file
├── readme.txt                  # WordPress readme
├── index.php                   # Security file
├── uninstall.php              # Uninstall handler
├── admin/                     # Admin PHP classes
├── includes/                  # Core PHP classes
├── public/                    # Frontend PHP classes
├── assets/                    # Compiled assets
│   ├── js/
│   │   ├── admin.js          # Admin React app
│   │   ├── frontend.js       # Frontend functionality
│   │   └── vendors.js        # Vendor libraries
│   ├── css/
│   │   ├── admin.css         # Admin styles
│   │   └── frontend.css      # Frontend styles
│   ├── images/               # Image assets
│   └── fonts/                # Font assets
└── languages/                # Translation files
```

## Development Workflow

### 1. Start Development
```bash
cd Plugin/
npm install
npm run dev
```

### 2. Test Changes
- Development build automatically updates in `dist/dev/`
- Install `dist/dev/` folder as WordPress plugin for testing
- Changes in `src/` automatically rebuild

### 3. Create Release
```bash
npm run release
```
- Creates production-ready `fotogrids-v0.1.0.zip`
- Ready for WordPress.org or distribution

## Path Management

The build system automatically updates file paths:
- Source files reference build structure paths
- Asset URLs point to compiled locations
- Include paths use plugin root structure

### Example Path Updates
- `src/assets/admin/src/index.tsx` → `assets/js/admin.js`
- `src/public/assets/fotogrids.css` → `public/assets/fotogrids.css`
- `src/includes/class-*.php` → `includes/class-*.php`

## Environment Variables

- `NODE_ENV=development` - Development build
- `NODE_ENV=production` - Production build

## Webpack Configuration

Key features:
- TypeScript compilation
- SCSS processing
- Asset optimization
- File copying
- Path resolution
- Code splitting

## Quality Assurance

### Code Quality
```bash
npm run lint        # Check code quality
npm run lint:fix    # Fix linting issues
npm run format      # Format code
npm run type-check  # TypeScript validation
```

### Testing
```bash
npm run test        # Run tests
```

## Troubleshooting

### Build Fails
1. Check Node.js version (requires 18+)
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Clear dist: `npm run clean`

### Asset Path Issues
- Verify webpack configuration paths
- Check PHP file path references
- Ensure CopyWebpackPlugin patterns are correct

### WordPress Installation Issues
- Use built plugin from `dist/dev/` or `dist/prod/`
- Never install `src/` directly as plugin
- Check file permissions after extraction

## Best Practices

1. **Always use built version** - Install `dist/` folder, not `src/`
2. **Test with dev build** - Use `npm run zip:dev` for testing
3. **Release with prod build** - Use `npm run release` for distribution
4. **Version control** - Add `dist/` to `.gitignore`, only commit source
5. **Clean builds** - Run `npm run clean` before important builds
