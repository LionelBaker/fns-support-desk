# Brand Management System

This project now supports multiple white-label brands through a configuration-based system.

## Available Brands

### DBS (Original/Main)
- **Product**: DBS Support Desk
- **Author**: DBS Technology
- **Email**: dbsdeskza@gmail.com → support@dbstech.co.za
- **GitHub**: dbsdeskza/dbs-support-desk
- **Icon**: DBS_Logo.ico

### FNS (White-label)
- **Product**: FNS Support Desk
- **Author**: FNS Technology
- **Email**: fnsdeskza@gmail.com → support@fnstech.co.za
- **GitHub**: fnsdeskza/fns-support-desk
- **Icon**: FNS_Logo.ico

## Usage

### Development
```bash
# Run DBS version (original)
npm run start:dbs

# Run FNS version (white-label)
npm run start:fns
```

### Building
```bash
# Build DBS version
npm run build:dbs

# Build FNS version
npm run build:fns
```

## Adding New Brands

1. Add brand configuration to `brands.json`:
```json
{
  "yourbrand": {
    "name": "yourbrand-support-desk",
    "productName": "YourBrand Support Desk",
    "description": "YourBrand Support Desk Widget",
    "appId": "com.yourbrand.supportdesk",
    "author": "YourBrand Technology",
    "email": {
      "from": "yourbrand@gmail.com",
      "to": "support@yourbrand.co.za"
    },
    "urls": {
      "contact": "https://yourbrand.com/contact-us/",
      "about": "https://yourbrand.com/about/"
    },
    "github": {
      "owner": "yourbrand",
      "repo": "yourbrand-support-desk"
    },
    "icon": "YourBrand_Logo.ico",
    "toolsDir": "yourbrand-utilities"
  }
}
```

2. Add build scripts to package.json:
```json
"start:yourbrand": "node build-brand.js yourbrand && npm start",
"build:yourbrand": "node build-brand.js yourbrand && npm run build:win"
```

3. Add your brand's icon to `/assets/YourBrand_Logo.ico`
4. Add your brand's tools to `/tools/yourbrand-utilities/`

## Git Workflow

### Main DBS Project
```bash
git remote add origin https://github.com/dbsdeskza/dbs-support-desk.git
git add .
git commit -m "Add brand management system"
git push -u origin main
```

### FNS White-label Repository
```bash
# Create new repository for FNS
# Then push the configured FNS version
git remote add fns-origin https://github.com/fnsdeskza/fns-support-desk.git
npm run start:fns  # Test FNS version
git add .
git commit -m "Configure FNS white-label version"
git push -u origin main
```

## File Structure

```
├── brands.json          # Brand configurations
├── build-brand.js       # Brand switching script
├── package.json         # Updated with brand scripts
├── main.js             # Dynamically updated per brand
├── index.html          # Dynamically updated per brand
├── renderer.js         # Dynamically updated per brand
├── assets/
│   ├── DBS_Logo.ico   # DBS icon
│   ├── FNS_Logo.ico   # FNS icon
│   └── YourBrand_Logo.ico
└── tools/
    ├── dbs-utilities/     # DBS tools
    ├── fns-utilities/     # FNS tools
    └── yourbrand-utilities/ # Your brand tools
```

## Notes

- The `build-brand.js` script dynamically updates all configuration files before building
- Each brand can have its own:
  - Product name and description
  - Email configuration
  - GitHub repository
  - Help menu URLs
  - Icon files
  - Tools directory
- The original DBS configuration is preserved in `brands.json`
- You can maintain separate git repositories for each brand
