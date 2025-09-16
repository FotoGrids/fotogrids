# FotoGrids WordPress Plugin - Development

A modern, freemium WordPress gallery plugin with Pro features.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- WordPress 5.8+ with PHP 8.0+

### Development Setup
```bash
# Install dependencies
npm install

# Start development (watches for changes)
npm run dev

# The built plugin will be in dist/dev/ - install this folder as a WordPress plugin
```

### Production Build
```bash
# Create production build
npm run build

# Create distributable ZIP
npm run release
```

## 📁 Project Structure

```
Plugin/
├── src/                    # Source code (edit these files)
│   ├── fotogrids.php      # Main plugin file
│   ├── admin/             # Admin interface
│   ├── includes/          # Core PHP classes
│   ├── public/            # Frontend functionality
│   └── assets/            # React/JS/SCSS source files
├── dist/                  # Built plugins (auto-generated)
│   ├── dev/              # Development build
│   └── prod/             # Production build
├── package.json          # Build configuration
└── webpack.config.js     # Build system
```

## 🔧 Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development build with file watching |
| `npm run build` | Production build (minified) |
| `npm run zip:dev` | Create development ZIP for testing |
| `npm run zip:prod` | Create production ZIP for release |
| `npm run release` | Full release: clean + build + zip |
| `npm run clean` | Remove all built files |

## 🎯 Development Workflow

1. **Edit source files** in `/src` directory
2. **Run development build**: `npm run dev`
3. **Install built plugin** from `/dist/dev` in WordPress
4. **Test changes** - build automatically updates
5. **Create release**: `npm run release`

## 📦 Installation

### For Development
```bash
cd Plugin/
npm install
npm run dev
# Install dist/dev/ folder as WordPress plugin
```

### For Production Use
```bash
npm run release
# Upload fotogrids-v0.1.0.zip to WordPress
```

## 🏗️ Architecture

### Frontend (No jQuery)
- **Admin**: React + TypeScript components
- **Public**: Vanilla ES6+ JavaScript
- **Styles**: SCSS compiled to CSS

### Backend
- **PHP 8.0+**: Modern WordPress development
- **Custom Tables**: Optimized database structure
- **REST API**: Frontend/admin communication
- **Gutenberg**: Native block support

### Build System
- **Webpack**: Asset compilation and optimization
- **TypeScript**: Type safety for admin components
- **SCSS**: Advanced styling capabilities
- **File Copying**: Automatic PHP file handling

## 🎨 Features

### Free Version
- ✅ Unlimited galleries & albums
- ✅ Grid, Masonry, Justified layouts
- ✅ Lightbox with keyboard navigation
- ✅ Statistics tracking
- ✅ Shortcodes & Gutenberg blocks

### Pro Features
- 🔒 Advanced templates & animations
- 🔒 Page builder widgets
- 🔒 Video galleries & EXIF data
- 🔒 WooCommerce integration

## 📚 Documentation

- **[BUILD.md](BUILD.md)** - Detailed build system documentation
- **[/Docs](../Docs/)** - Complete development guide
- **[/Plan](../Plan/)** - Original planning documents

## 🧪 Code Quality

```bash
npm run lint        # ESLint + WordPress standards
npm run format      # Prettier code formatting
npm run type-check  # TypeScript validation
```

## 🔒 Security

- Nonce verification for all admin actions
- Capability checks for user permissions
- Input sanitization and output escaping
- WordPress security best practices

## 📈 Performance

- Conditional asset loading
- Lazy loading for images
- Database query optimization
- Modern JavaScript (ES6+)

## 🌐 Internationalization

- Full translation support (`fotogrids` textdomain)
- `.pot` file generation
- RTL language support

## 🤝 Contributing

1. Fork the repository
2. Create feature branch from `develop`
3. Make changes in `/src` directory
4. Test with `npm run dev`
5. Submit pull request

## 📄 License

GPL v2 or later - WordPress compatible licensing

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: `/Docs` folder
- **WordPress.org**: Plugin support forum