# FotoGrids Gutenberg Block

A modern, feature-rich Gutenberg block for inserting FotoGrids galleries with live preview and comprehensive customization options.

## Features

### 🎨 **Live Preview**
- Real-time gallery preview in the block editor
- Template-specific layout rendering
- Responsive preview that adapts to different screen sizes
- Image loading with fallbacks

### 🖼️ **Gallery Selection**
- Visual gallery browser with thumbnails
- Search and filter galleries
- Quick gallery creation from block editor
- Gallery information display (image count, creation date)

### 🎯 **Template System**
- Visual template selector with previews
- Support for free and Pro templates
- Template-specific settings and options
- Responsive template behavior

### ⚙️ **Comprehensive Settings**
- **Layout Settings**: Template selection, columns, row heights
- **Display Options**: Captions, lightbox, lazy loading
- **Advanced Options**: Custom CSS, alignment controls
- **Responsive Controls**: Mobile-optimized settings

### 🔧 **WordPress Integration**
- Full Gutenberg block API v2 support
- Block alignment (left, right, center, wide, full)
- Block transforms (shortcode ↔ block)
- WordPress color and typography support
- Accessibility compliant

## Block Structure

```
src/assets/admin/src/blocks/
├── gallery-block.tsx          # Main block registration
├── components/blocks/
│   ├── GalleryBlockEdit.tsx   # Block editor component
│   ├── GalleryBlockSave.tsx   # Saved content component
│   ├── GallerySelector.tsx    # Gallery selection interface
│   ├── TemplateSelector.tsx   # Template selection interface
│   └── GalleryPreview.tsx     # Live preview component
└── README.md                  # This documentation
```

## Block Attributes

### Core Attributes
```typescript
interface GalleryBlockAttributes {
    galleryId: number;        // Selected gallery ID
    template: string;         // Template identifier ('grid', 'masonry', 'justified')
    columns: number;          // Number of columns (1-6) or row height setting
    showCaptions: boolean;    // Display image captions
    lightbox: boolean;        // Enable lightbox functionality
    lazyLoad: boolean;        // Enable lazy loading
    customCSS?: string;       // Custom CSS styles
    align?: string;           // Block alignment
}
```

### Default Values
```typescript
{
    galleryId: 0,
    template: 'grid',
    columns: 3,
    showCaptions: true,
    lightbox: true,
    lazyLoad: true,
    align: 'none'
}
```

## Components

### 1. GalleryBlockEdit
Main block editor component that handles:
- Gallery selection state management
- Template and settings configuration
- Inspector controls rendering
- Block controls toolbar
- Error handling and loading states

**Key Features:**
- Async gallery and template loading
- Real-time preview updates
- Responsive inspector controls
- Accessibility support

### 2. GallerySelector
Visual gallery selection interface featuring:
- Grid-based gallery browser
- Gallery thumbnails and metadata
- Search functionality
- "Create New Gallery" option
- Empty state handling

**UI Elements:**
- Gallery cards with thumbnails
- Image count and metadata
- Selection states
- Create new gallery prompt

### 3. TemplateSelector
Template selection interface with:
- Visual template previews
- Free vs Pro template distinction
- Template descriptions and features
- Responsive grid layout

**Template Categories:**
- **Free Templates**: Grid, Masonry, Justified
- **Pro Templates**: Slider, Polaroid, and more

### 4. GalleryPreview
Live preview component that renders:
- Template-specific layouts
- Image thumbnails and captions
- Responsive preview behavior
- Loading and error states

**Preview Features:**
- Layout-specific rendering
- Image lazy loading
- Caption overlay
- Responsive adjustments

### 5. GalleryBlockSave
Saved content component that:
- Generates shortcode output
- Handles custom CSS injection
- Maintains block alignment
- Ensures frontend compatibility

## REST API Integration

The block communicates with these REST endpoints:

### Gallery Endpoints
```
GET /wp-json/fotogrids/v1/galleries
GET /wp-json/fotogrids/v1/galleries/{id}/images
GET /wp-json/fotogrids/v1/templates
```

### Response Formats
```typescript
// Gallery List
interface Gallery {
    id: number;
    title: string;
    image_count: number;
    featured_image?: string;
    created: string;
    modified: string;
}

// Gallery Images
interface Image {
    id: number;
    position: number;
    caption: string;
    description: string;
    url: string;
    thumbnail: string;
    medium: string;
    large: string;
    full: string;
    alt: string;
    title: string;
}

// Templates
interface Template {
    id: string;
    name: string;
    description: string;
    type: 'free' | 'starter' | 'expert' | 'commerce';
    preview: string;
}
```

## Block Registration

### Block Metadata
```typescript
{
    apiVersion: 2,
    title: 'FotoGrids Gallery',
    description: 'Display a FotoGrids gallery with customizable layouts and settings.',
    category: 'media',
    icon: gallery,
    keywords: ['gallery', 'photos', 'images', 'fotogrids'],
    supports: {
        align: ['left', 'center', 'right', 'wide', 'full'],
        spacing: { margin: true, padding: true },
        typography: { fontSize: true, lineHeight: true },
        color: { background: true, text: true, link: true },
    }
}
```

### Block Transforms

#### From Shortcode
Converts `[fotogrids_gallery]` shortcodes to blocks:
```
[fotogrids_gallery id="123" template="grid" cols="4" captions="true"]
```

#### To Shortcode
Converts blocks back to shortcodes for compatibility.

## Inspector Controls

### Gallery Settings Panel
- Gallery selection dropdown
- "Change Gallery" button
- Gallery information display

### Layout Settings Panel
- Template selector (visual)
- Column count slider (Grid/Masonry)
- Row height selector (Justified)
- Template-specific options

### Display Settings Panel
- Show captions toggle
- Enable lightbox toggle
- Lazy loading toggle
- Additional display options

### Advanced Panel
- Custom CSS textarea
- Advanced styling options
- Developer settings

## Block Controls

### Toolbar Controls
- Block alignment toolbar
- Change gallery button
- Template quick-switch
- Settings access

### Alignment Support
- Left, Right, Center alignment
- Wide and Full-width support
- Responsive alignment behavior

## Styling and CSS

### Block Editor Styles
```scss
.fotogrids-block-gallery {
    // Block container styles
    // Preview styling
    // Responsive adjustments
}
```

### Component Styles
```scss
.fotogrids-gallery-selector {
    // Gallery selection interface
}

.fotogrids-template-selector {
    // Template selection interface
}

.fotogrids-block-preview {
    // Live preview styling
}
```

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interfaces
- Accessibility considerations

## Error Handling

### Loading States
- Gallery loading spinner
- Template loading indicators
- Image loading states
- Progressive enhancement

### Error States
- Network error handling
- Gallery not found errors
- Permission error messages
- Retry mechanisms

### Fallbacks
- Default template selection
- Empty gallery handling
- Missing image fallbacks
- Graceful degradation

## Accessibility

### Keyboard Navigation
- Tab order support
- Enter/Space activation
- Arrow key navigation
- Focus management

### Screen Reader Support
- ARIA labels and descriptions
- Semantic HTML structure
- Alternative text handling
- Status announcements

### Visual Accessibility
- High contrast support
- Reduced motion respect
- Focus indicators
- Color contrast compliance

## Performance Optimization

### Lazy Loading
- Image intersection observer
- Progressive image loading
- Placeholder handling
- Bandwidth optimization

### API Optimization
- Request caching
- Pagination support
- Efficient queries
- Error recovery

### Bundle Optimization
- Code splitting
- Tree shaking
- Minimal dependencies
- Optimized builds

## Development

### Adding New Templates
1. Add template to REST API response
2. Update template selector component
3. Add template-specific preview logic
4. Include template assets

### Extending Block Attributes
1. Update TypeScript interfaces
2. Add to block registration
3. Update inspector controls
4. Handle in save component

### Custom Components
1. Follow existing patterns
2. Use WordPress components
3. Implement accessibility
4. Add proper styling

## Testing

### Unit Tests
- Component rendering
- State management
- API interactions
- Error handling

### Integration Tests
- Block registration
- WordPress integration
- REST API communication
- Template rendering

### Manual Testing
- Different WordPress versions
- Various themes
- Mobile devices
- Accessibility tools

## Browser Support

### Modern Browsers
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Fallbacks
- IE11 graceful degradation
- Legacy browser support
- Progressive enhancement
- Feature detection

## Future Enhancements

### Planned Features
- Drag-and-drop gallery creation
- Bulk image management
- Advanced filtering options
- Animation presets

### Pro Features
- Advanced template options
- Custom template builder
- Advanced analytics
- Priority support

This Gutenberg block provides a comprehensive, user-friendly interface for inserting FotoGrids galleries while maintaining full compatibility with WordPress standards and accessibility requirements.
