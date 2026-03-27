const fs = require('fs');
const path = require('path');

// Get brand from command line argument or default to 'dbs'
const brand = process.argv[2] || 'dbs';

// Load brand configuration
const brands = JSON.parse(fs.readFileSync(path.join(__dirname, 'brands.json'), 'utf8'));
const config = brands[brand];

if (!config) {
  console.error(`Brand '${brand}' not found in brands.json`);
  process.exit(1);
}

console.log(`Building for brand: ${brand.toUpperCase()}`);

// Read package.json template
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Update package.json with brand-specific values
packageJson.name = config.name;
packageJson.description = config.description;
packageJson.author = config.author;
packageJson.build.appId = config.appId;
packageJson.build.productName = config.productName;
packageJson.build.win.icon = `assets/${config.icon}`;
packageJson.build.nsis.installerIcon = `assets/${config.icon}`;
packageJson.build.nsis.uninstallerIcon = `assets/${config.icon}`;

// Handle publish array safely
if (packageJson.publish && packageJson.publish[0]) {
  packageJson.publish[0].owner = config.github.owner;
  packageJson.publish[0].repo = config.github.repo;
}

// Update repository URL
packageJson.repository.url = `https://github.com/${config.github.owner}/${config.github.repo}.git`;
packageJson.keywords[2] = brand;

// Update tools directory references
packageJson.build.extraResources[1].from = `tools/${config.toolsDir}`;
packageJson.build.extraResources[1].to = `tools/${config.toolsDir}`;
packageJson.build.win.asarUnpack[2] = `tools/${config.toolsDir}/**/*`;

// Write updated package.json
fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(packageJson, null, 2));

// Update main.js with brand-specific values
const mainJsPath = path.join(__dirname, 'main.js');
let mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

// Replace brand-specific variables
mainJsContent = mainJsContent.replace(/title: `.* Support Desk v\$\{version\}`/, `title: \`${config.productName} v\${version}\``);
mainJsContent = mainJsContent.replace(/mainWindow\.setTitle\(`.* Support Desk v\$\{version\}`\)/, `mainWindow.setTitle(\`${config.productName} v\${version}\`)`);
mainJsContent = mainJsContent.replace(/tray\.setToolTip\(`.* Support Desk v\$\{app\.getVersion\(\)\}`\)/, `tray.setToolTip(\`${config.productName} v\${app.getVersion()}\`)`);
mainJsContent = mainJsContent.replace(/label: `.* Support Desk v\$\{app\.getVersion\(\)\}`/, `label: \`${config.productName} v\${app.getVersion()}\``);
mainJsContent = mainJsContent.replace(/label: 'Show .* Support Desk'/, `label: 'Show ${config.productName}'`);

// Update email configuration
mainJsContent = mainJsContent.replace(/user: '[^']*',/, `user: '${config.email.from}',`);
mainJsContent = mainJsContent.replace(/from: '[^']*',/, `from: '${config.email.from}',`);
mainJsContent = mainJsContent.replace(/to: '[^']*',/, `to: '${config.email.to}',`);

// Update help menu URLs
mainJsContent = mainJsContent.replace(/label: 'Contact .* Technology',/, `label: 'Contact ${config.author}',`);
mainJsContent = mainJsContent.replace(/await shell\.openExternal\('[^']*'\)/, `await shell.openExternal('${config.urls.contact}')`);
mainJsContent = mainJsContent.replace(/label: 'About .* Technology',/, `label: 'About ${config.author}',`);
mainJsContent = mainJsContent.replace(/label: 'About Future Nation Schools',/, `label: 'About ${config.author}',`);

// Update icon paths
mainJsContent = mainJsContent.replace(/icon: path\.join\(__dirname, 'assets', '[^']*'\)/, `icon: path.join(__dirname, 'assets', '${config.icon}')`);
mainJsContent = mainJsContent.replace(/iconPath = path\.join\(process\.resourcesPath, 'assets', '[^']*'\)/, `iconPath = path.join(process.resourcesPath, 'assets', '${config.icon}')`);
mainJsContent = mainJsContent.replace(/iconPath = path\.join\(__dirname, 'assets', '[^']*'\)/, `iconPath = path.join(__dirname, 'assets', '${config.icon}')`);

// Update tools directory
mainJsContent = mainJsContent.replace(/tools\/[^-utilities-]*-utilities/g, `tools/${config.toolsDir}`);

// Update GitHub URLs - Update BOTH configurations
mainJsContent = mainJsContent.replace(/const updateServerUrl = 'https:\/\/github\.com\/[^']*'/, `const updateServerUrl = 'https://github.com/${config.github.owner}/${config.github.repo}'`);
mainJsContent = mainJsContent.replace(/owner: '[^']*',/, `owner: '${config.github.owner}',`);
mainJsContent = mainJsContent.replace(/repo: '[^']*',/, `repo: '${config.github.repo}',`);

// Update the second update configuration in setupAutoUpdater function
mainJsContent = mainJsContent.replace(/const repo = '[^']*\/[^']*';[\s\S]*?autoUpdater\.setFeedURL\(\{[^}]*owner: '[^']*',[\s\S]*?repo: '[^']*'/, (match) => {
    return match.replace(/const repo = '[^']*\/[^']*';/, `const repo = '${config.github.owner}/${config.github.repo}';`)
            .replace(/owner: '[^']*'/, `owner: '${config.github.owner}'`)
            .replace(/repo: '[^']*'/, `repo: '${config.github.repo}'`);
});

// Write updated main.js
fs.writeFileSync(mainJsPath, mainJsContent);

// Update index.html
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(/<title>.* Support Desk<\/title>/, `<title>${config.productName}</title>`);
indexContent = indexContent.replace(/<h5[^>]*>.* Support Desk<\/h5>/, `<h5 style="margin: 0; font-weight: 600;">${config.productName}</h5>`);
indexContent = indexContent.replace(/title=".* Toolbox"/, `title="${config.author} Toolbox"`);
indexContent = indexContent.replace(/<h5>.* Toolbox<\/h5>/, `<h5>${config.author} Toolbox</h5>`);
indexContent = indexContent.replace(/<!-- .* Toolbox Popup -->/, `<!-- ${config.author} Toolbox Popup -->`);

fs.writeFileSync(indexPath, indexContent);

// Update renderer.js
const rendererPath = path.join(__dirname, 'renderer.js');
let rendererContent = fs.readFileSync(rendererPath, 'utf8');

rendererContent = rendererContent.replace(/\/\/ .* Toolbox Management/, `// ${config.author} Toolbox Management`);

fs.writeFileSync(rendererPath, rendererContent);

console.log(`✅ Brand configuration updated to ${brand.toUpperCase()}`);
console.log(`📦 Ready to build: ${config.productName}`);
console.log(`🔗 GitHub: ${config.github.owner}/${config.github.repo}`);
