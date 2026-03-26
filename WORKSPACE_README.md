# 🚀 Unified Support Desk Workspace

**Single Folder - Multiple Brands - Easy Management**

## 📁 Your Workspace Location
```
C:\Users\lione\OneDrive - DBS Technology\Code\DBS_Support_Desk\dbs-support-desk
```

## 🎯 Daily Workflow (One Folder Only!)

### **Development & Testing**
```bash
# Always work in this folder
cd "C:\Users\lione\OneDrive - DBS Technology\Code\DBS_Support_Desk\dbs-support-desk"

# Make your code changes (edit main.js, renderer.js, index.html, etc.)

# Test both brands
npm run start:dbs    # 🔵 Shows "DBS Support Desk"
npm run start:fns    # 🟢 Shows "FNS Support Desk"
```

### **Building & Deployment**
```bash
# Build individual brands
npm run build:dbs    # Build DBS version only
npm run build:fns    # Build FNS version only

# Deploy to repositories
npm run deploy:dbs   # Build + push to DBS repo
npm run deploy:fns   # Build + push to FNS repo
npm run deploy:both  # Build + push to BOTH repos
```

## 🔄 Git Configuration

Your workspace has **two git remotes**:
- `origin` → DBS repository (dbsdeskza/dbs-support-desk)
- `fns-origin` → FNS repository (fnsdeskza/fns-support-desk)

### **Manual Git Commands**
```bash
# Push to DBS repository
git push origin main

# Push to FNS repository  
git push fns-origin main

# Push to both
git push origin main && git push fns-origin main
```

## 📋 Available Commands

### **Development Commands**
- `npm start` - Start current configured brand
- `npm run start:dbs` - Start DBS Support Desk
- `npm run start:fns` - Start FNS Support Desk

### **Build Commands**
- `npm run build:dbs` - Build DBS version
- `npm run build:fns` - Build FNS version
- `npm run build:win` - Build Windows version

### **Deployment Commands**
- `npm run deploy:dbs` - Deploy to DBS repository
- `npm run deploy:fns` - Deploy to FNS repository  
- `npm run deploy:both` - Deploy to both repositories

## 🎨 Brand Management

### **Configure Brands**
Edit `brands.json` to modify:
- Product names
- Email addresses
- Help URLs
- GitHub repositories
- Icon files

### **Add New Brand**
1. Add configuration to `brands.json`
2. Add brand icon to `/assets/`
3. Add build scripts to `package.json`

## 📂 File Structure

```
dbs-support-desk/           # 🏠 YOUR ONLY WORKSPACE
├── brands.json              # Brand configurations
├── build-brand.js           # Brand switching logic
├── deploy.ps1               # Deployment automation
├── deploy.sh                # Bash deployment script
├── package.json             # Dependencies & scripts
├── main.js                  # Main app logic
├── renderer.js              # UI functionality
├── index.html               # HTML structure
├── assets/                  # Icons & resources
│   ├── DBS_Logo.ico        # DBS icon
│   ├── FNS_Logo.ico        # FNS icon
│   └── icon.ico            # Default icon
├── tools/                   # Utility tools
│   ├── dbs-utilities/      # DBS tools
│   └── fns-utilities/      # FNS tools
└── dist/                    # Build output
    ├── dbs-support-desk    # DBS build
    └── fns-support-desk    # FNS build
```

## 🔄 Typical Work Session

### **1. Make Changes**
```bash
# Edit your files
# main.js, renderer.js, index.html, etc.
```

### **2. Test Both Brands**
```bash
npm run start:dbs    # Test DBS branding
npm run start:fns    # Test FNS branding
```

### **3. Deploy**
```bash
# Deploy to both repositories
npm run deploy:both
```

## 💡 Pro Tips

### **Quick Brand Switching**
```bash
# Switch to DBS mode
node build-brand.js dbs

# Switch to FNS mode  
node build-brand.js fns
```

### **Check Git Remotes**
```bash
git remote -v
# Should show both 'origin' and 'fns-origin'
```

### **Check Current Brand**
Look at the app title when you run `npm start` - it shows the current brand.

## 🎯 Benefits of This Setup

✅ **Single Workspace** - No folder confusion  
✅ **Edit Once** - Changes apply to both brands  
✅ **Automatic Branding** - Names, logos, emails switch automatically  
✅ **Easy Deployment** - One command deploys to both repos  
✅ **Version Control** - Track changes in one place  
✅ **Testing** - Switch brands with one command  

## 🚀 Getting Started

1. **Work in this folder only**: `C:\Users\lione\OneDrive - DBS Technology\Code\DBS_Support_Desk\dbs-support-desk`

2. **Test your setup**:
   ```bash
   npm run start:dbs    # Should show "DBS Support Desk"
   npm run start:fns    # Should show "FNS Support Desk"
   ```

3. **Make your first deployment**:
   ```bash
   npm run deploy:both
   ```

That's it! You now have a **single, unified workspace** that manages both brands automatically! 🎉
