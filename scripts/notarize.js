require('dotenv').config();

// This is a no-op script for non-macOS builds
// Notarization is only required for macOS
console.log('Notarization script running...');

module.exports = async function (params) {
  if (process.platform !== 'darwin') {
    console.log('Skipping notarization - not on macOS');
    return;
  }

  console.log('Notarization would happen here on macOS');
  console.log('App path:', params.appOutDir);
};
