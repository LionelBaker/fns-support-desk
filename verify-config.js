#!/usr/bin/env node

/**
 * Verification script to ensure both flavors have correct update configurations
 * Run this after building each flavor to verify no cross-contamination
 */

const fs = require('fs');
const path = require('path');

// Expected configurations for each brand
const EXPECTED_CONFIGS = {
  dbs: {
    updateServerUrl: 'https://github.com/dbsdeskza/dbs-support-desk',
    owner: 'dbsdeskza',
    repo: 'dbs-support-desk',
    productName: 'DBS Support Desk',
    emailTo: 'support@dbstech.co.za'
  },
  fns: {
    updateServerUrl: 'https://github.com/dbsdeskza/fnsmain',
    owner: 'dbsdeskza',
    repo: 'fnsmain',
    productName: 'FNS Support Desk',
    emailTo: 'fns@edudesk360.co.za'
  }
};

function verifyFlavor(brand) {
  console.log(`\n🔍 Verifying ${brand.toUpperCase()} Support Desk configuration...`);
  
  const mainJsPath = path.join(__dirname, 'main.js');
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  
  const expected = EXPECTED_CONFIGS[brand];
  let allCorrect = true;
  
  // Check updateServerUrl (Configuration 1)
  const updateServerUrlMatch = mainJsContent.match(/const updateServerUrl = '([^']+)'/);
  if (updateServerUrlMatch && updateServerUrlMatch[1] === expected.updateServerUrl) {
    console.log(`✅ updateServerUrl: ${updateServerUrlMatch[1]}`);
  } else {
    console.log(`❌ updateServerUrl: Expected ${expected.updateServerUrl}, got ${updateServerUrlMatch ? updateServerUrlMatch[1] : 'NOT FOUND'}`);
    allCorrect = false;
  }
  
  // Check first autoUpdater config (Configuration 2)
  const autoUpdaterMatch = mainJsContent.match(/autoUpdater\.setFeedURL\(\{[^}]*owner: '([^']+)',[^}]*repo: '([^']+)'/);
  if (autoUpdaterMatch && autoUpdaterMatch[1] === expected.owner && autoUpdaterMatch[2] === expected.repo) {
    console.log(`✅ First autoUpdater config: owner=${autoUpdaterMatch[1]}, repo=${autoUpdaterMatch[2]}`);
  } else {
    console.log(`❌ First autoUpdater config: Expected owner=${expected.owner}, repo=${expected.repo}`);
    allCorrect = false;
  }
  
  // Check second autoUpdater config (Configuration 3)
  const secondConfigMatch = mainJsContent.match(/const repo = '([^']+)';[\s\S]*?autoUpdater\.setFeedURL\(\{[^}]*owner: '([^']+)',[^}]*repo: '([^']+)'/);
  if (secondConfigMatch && secondConfigMatch[1] === `${expected.owner}/${expected.repo}` && secondConfigMatch[2] === expected.owner && secondConfigMatch[3] === expected.repo) {
    console.log(`✅ Second autoUpdater config: repo=${secondConfigMatch[1]}, owner=${secondConfigMatch[2]}, repo=${secondConfigMatch[3]}`);
  } else {
    console.log(`❌ Second autoUpdater config: Expected repo=${expected.owner}/${expected.repo}, owner=${expected.owner}, repo=${expected.repo}`);
    allCorrect = false;
  }
  
  // Check product name
  const productNameMatch = mainJsContent.match(/title: `([^`]+) v\$\{version\}`/);
  if (productNameMatch && productNameMatch[1] === expected.productName) {
    console.log(`✅ Product name: ${productNameMatch[1]}`);
  } else {
    console.log(`❌ Product name: Expected ${expected.productName}, got ${productNameMatch ? productNameMatch[1] : 'NOT FOUND'}`);
    allCorrect = false;
  }
  
  // Check email configuration
  const emailMatch = mainJsContent.match(/to: '([^']+)'/);
  if (emailMatch && emailMatch[1] === expected.emailTo) {
    console.log(`✅ Email destination: ${emailMatch[1]}`);
  } else {
    console.log(`❌ Email destination: Expected ${expected.emailTo}, got ${emailMatch ? emailMatch[1] : 'NOT FOUND'}`);
    allCorrect = false;
  }
  
  if (allCorrect) {
    console.log(`🎉 ${brand.toUpperCase()} configuration is CORRECT - All checks passed!`);
  } else {
    console.log(`🚨 ${brand.toUpperCase()} configuration has ISSUES - Do not publish!`);
    process.exit(1);
  }
  
  return allCorrect;
}

// Get current brand from command line
const currentBrand = process.argv[2];
if (!currentBrand || !['dbs', 'fns'].includes(currentBrand)) {
  console.error('Usage: node verify-config.js <dbs|fns>');
  process.exit(1);
}

console.log('🔒 Configuration Verification Tool');
console.log('==================================');

verifyFlavor(currentBrand);
