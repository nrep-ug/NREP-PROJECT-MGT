# Images Directory

This directory contains static images for the NREP Project Management System.

## Logo

To add your organization's logo to the login page:

1. Place your logo image in this directory with the filename: `logo.png`
   - Supported formats: PNG, JPG, JPEG, SVG, WEBP
   - Recommended size: 200x200px or larger (square format works best)
   - The image will be automatically scaled to fit the logo container

2. If you want to use a different filename or format, update the `LOGO_PATH` constant in:
   ```
   /app/login/page.js
   ```

   Example:
   ```javascript
   const LOGO_PATH = '/images/your-logo-name.svg';
   ```

3. **Fallback Behavior:**
   - If no logo image is found, the login page will display the letter "N" as a fallback
   - You can change this fallback letter by modifying the `FALLBACK_LETTER` constant in `/app/login/page.js`

## File Structure

```
public/
└── images/
    ├── logo.png          (Add your logo here)
    └── README.md         (This file)
```

## Logo Specifications

- **Format:** PNG with transparent background is recommended
- **Dimensions:** Square format (e.g., 500x500px, 1000x1000px)
- **File Size:** Keep under 100KB for optimal loading performance
- **Color:** The logo will be displayed on a dark teal background (#054653), so ensure good contrast
