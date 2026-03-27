#!/usr/bin/env node

/**
 * Safe Deploy Script - Prevents Cross-Contamination
 * Usage: node safe-deploy.js <dbs|fns|both>
 */

const { execSync } = require('child_process');

function runCommand(command) {
  console.log(`🔧 Running: ${command}`);
  try {
    const result = execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    return result;
  } catch (error) {
    console.error(`❌ Error running: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

function deployFlavor(flavor) {
  console.log(`\n🚀 Deploying ${flavor.toUpperCase()} Support Desk...`);
  
  // Step 1: Build with verification
  console.log('\n📦 Building with verification...');
  runCommand(`npm run build:${flavor}`);
  
  // Step 2: Verify configuration
  console.log('\n🔍 Verifying configuration...');
  runCommand(`node verify-config.js ${flavor}`);
  
  // Step 3: Deploy
  console.log('\n📤 Deploying to repository...');
  runCommand(`npm run deploy:${flavor}`);
  
  console.log(`\n✅ ${flavor.toUpperCase()} Support Desk deployed successfully!`);
}

// Get flavor from command line
const flavor = process.argv[2];
if (!flavor || !['dbs', 'fns', 'both'].includes(flavor)) {
  console.error('❌ Usage: node safe-deploy.js <dbs|fns|both>');
  console.error('   dbs   - Deploy DBS Support Desk');
  console.error('   fns   - Deploy FNS Support Desk');
  console.error('   both  - Deploy both flavors');
  process.exit(1);
}

console.log('🔒 Safe Deploy Script - Prevents Cross-Contamination');
console.log('================================================');

if (flavor === 'both') {
  console.log('\n🔄 Deploying both flavors sequentially...');
  deployFlavor('dbs');
  deployFlavor('fns');
  console.log('\n🎉 Both flavors deployed successfully!');
} else {
  deployFlavor(flavor);
}
