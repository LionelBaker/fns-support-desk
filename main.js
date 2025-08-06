const { app, BrowserWindow, ipcMain, screen, Tray, Menu, dialog, MenuItem } = require('electron');
const path = require('path');
const nodemailer = require('nodemailer');
const si = require('systeminformation');
const { download } = require('electron-dl');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { shell } = require('electron');
const https = require('https');
const { systemPreferences } = require('electron');
const { nativeImage } = require('electron');

// Import package.json to get version
const { version } = require('./package.json');

// Configure logging
log.transports.console.level = 'info';
log.transports.file.level = 'debug';
log.info('App starting...');

// Set up auto-updater logging
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.allowPrerelease = false;

require('dotenv').config();

let mainWindow;
let tray = null;
let isTeamViewerHandlerInitialized = false;
let isAppInitialized = false;
let isAppQuitting = false;

// Platform-specific configurations
const PLATFORM_CONFIG = {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
};

// TeamViewer paths for different platforms
const TEAMVIEWER_PATHS = PLATFORM_CONFIG.isWindows
  ? [
      'C:\\Program Files\\TeamViewer\\TeamViewer.exe',
      'C:\\Program Files (x86)\\TeamViewer\\TeamViewer.exe'
    ]
  : PLATFORM_CONFIG.isMac
  ? [
      '/Applications/TeamViewer.app/Contents/MacOS/TeamViewer',
      '/Applications/TeamViewer/TeamViewer.app/Contents/MacOS/TeamViewer'
    ]
  : [
      '/usr/bin/teamviewer',
      '/opt/teamviewer/teamviewer'
    ];

function isTeamViewerInstalled() {
  return TEAMVIEWER_PATHS.some(path => fs.existsSync(path));
}

/**
 * Open a file or folder using the system's default handler
 * @param {string} filePath Path to the file or folder
 * @returns {Promise<void>}
 */
function openFileOrFolder(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to open: ${filePath}`);
    
    let command;
    if (PLATFORM_CONFIG.isWindows) {
      command = `start "" "${filePath}"`;
    } else if (PLATFORM_CONFIG.isMac) {
      command = `open "${filePath}"`;
    } else {
      command = `xdg-open "${filePath}"`;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error opening file: ${error}`);
        console.error(`stderr: ${stderr}`);
        reject(error);
      } else {
        console.log(`Successfully opened: ${filePath}`);
        resolve();
      }
    });
  });
}

/**
 * Download and run TeamViewer QuickSupport
 * @returns {Promise<string>} Path to the downloaded file
 */
async function downloadTeamViewerQuickSupport() {
  const tempDir = os.tmpdir();
  let downloadUrl, fileName;

  if (PLATFORM_CONFIG.isWindows) {
    downloadUrl = 'https://download.teamviewer.com/download/TeamViewerQS.exe';
    fileName = 'TeamViewerQS.exe';
  } else if (PLATFORM_CONFIG.isMac) {
    downloadUrl = 'https://download.teamviewer.com/download/TeamViewerQS.dmg';
    fileName = 'TeamViewerQS.dmg';
  } else {
    throw new Error('Unsupported platform for TeamViewer QuickSupport');
  }

  const tempPath = path.join(tempDir, fileName);
  
  console.log(`Downloading TeamViewer QuickSupport from: ${downloadUrl}`);
  console.log(`Saving to: ${tempPath}`);

  try {
    // Ensure the temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Check if we already have a downloaded file
    if (fs.existsSync(tempPath)) {
      console.log('Found existing TeamViewer download, removing...');
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        console.warn('Could not remove existing TeamViewer file:', e);
      }
    }

    // Show a dialog to inform the user about the download
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Downloading TeamViewer QuickSupport',
        message: 'Please wait while we download TeamViewer QuickSupport...',
        buttons: ['OK']
      });
    }

    // Download the file
    await download(win || BrowserWindow.getAllWindows()[0], downloadUrl, {
      directory: tempDir,
      filename: fileName,
      onProgress: (progress) => {
        const percent = (progress.percent * 100).toFixed(2);
        console.log(`Download progress: ${percent}%`);
      },
      onStarted: () => {
        console.log('Download started');
      },
      onCompleted: (file) => {
        console.log('Download completed:', file.path);
      }
    });

    // Verify the file was downloaded
    if (!fs.existsSync(tempPath)) {
      throw new Error('Downloaded file not found');
    }

    console.log('File downloaded successfully, opening...');

    // Open the downloaded file
    if (PLATFORM_CONFIG.isMac) {
      // Mount the DMG and open the application
      try {
        console.log('Mounting DMG...');
        await execAsync(`hdiutil attach "${tempPath}"`);
        const appPath = '/Volumes/TeamViewer QuickSupport/TeamViewer QuickSupport.app';
        if (fs.existsSync(appPath)) {
          console.log('Launching TeamViewer QuickSupport...');
          await execAsync(`open -a "${appPath}"`);
        } else {
          throw new Error('TeamViewer QuickSupport.app not found in DMG');
        }
      } catch (e) {
        console.error('Error mounting/launching DMG:', e);
        throw new Error('Failed to mount or launch TeamViewer DMG');
      }
    } else {
      // For Windows, just open the downloaded file
      console.log('Launching TeamViewer QuickSupport...');
      await openFileOrFolder(tempPath);
    }

    return tempPath;
  } catch (error) {
    console.error('TeamViewer download/launch error:', error);
    
    // Show error to user
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      dialog.showErrorBox(
        'TeamViewer Download Failed',
        `Could not download or launch TeamViewer QuickSupport. Please try again or contact support.\n\nError: ${error.message}`
      );
    }
    
    throw error;
  }
}

/**
 * Helper function to promisify exec
 */
function execAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      if (error) {
        console.error(`Command failed: ${command}`);
        console.error(`Error: ${error}`);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Comprehensive System Information
ipcMain.handle('get-comprehensive-system-info', async () => {
  try {
    const [
      osInfo, 
      systemHealth, 
      securityScan
    ] = await Promise.all([
      si.osInfo(),
      analyzeSystemHealth(),
      performSecurityScan()
    ]);

    return {
      os: osInfo,
      health: systemHealth,
      security: securityScan,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Comprehensive system info error:', error);
    throw error;
  }
});

// Advanced System Health Monitoring
async function analyzeSystemHealth() {
  try {
    const [
      cpuInfo, 
      memInfo, 
      diskInfo, 
      networkInfo, 
      processesInfo,
      batteryInfo
    ] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.networkInterfaces(),
      si.processes(),
      si.battery()
    ]);

    // Predictive Hardware Failure Detection
    const healthAnalysis = {
      cpu: {
        temperature: await si.cpuTemperature(),
        load: await si.currentLoad(),
        overheating: cpuInfo.temperature > 80 // Threshold for overheating
      },
      memory: {
        usage: memInfo.used / memInfo.total * 100,
        critical: memInfo.used / memInfo.total > 0.9 // Over 90% usage
      },
      storage: {
        health: diskInfo.map(disk => ({
          model: disk.model,
          freeSpace: disk.size - disk.used,
          lowSpace: (disk.size - disk.used) / disk.size < 0.1 // Less than 10% free
        }))
      },
      network: {
        interfaces: networkInfo.map(iface => ({
          name: iface.iface,
          speed: iface.speed,
          operational: iface.operstate === 'up'
        }))
      },
      performance: {
        runningProcesses: processesInfo.list.length,
        topCPUProcesses: processesInfo.list
          .sort((a, b) => b.cpu - a.cpu)
          .slice(0, 5)
      },
      battery: batteryInfo ? {
        percentage: batteryInfo.percent,
        charging: batteryInfo.isCharging,
        lowBattery: batteryInfo.percent < 20
      } : null
    };

    return healthAnalysis;
  } catch (error) {
    console.error('System health analysis error:', error);
    return null;
  }
}

// Security Scanning (Basic Implementation)
async function performSecurityScan() {
  try {
    const firewallStatus = await new Promise((resolve) => {
      exec('netsh advfirewall show currentprofile', (error, stdout) => {
        resolve({
          enabled: !error && stdout.includes('State                                 ON'),
          profile: stdout.match(/Current Profile:\s+(.+)/)?.[1] || 'Unknown'
        });
      });
    });

    const antivirusStatus = await new Promise((resolve) => {
      exec('wmic /namespace:\\\\root\\SecurityCenter2 path AntiVirusProduct get displayName', (error, stdout) => {
        resolve({
          installed: !error && stdout.trim().length > 0,
          products: stdout.trim().split('\n').filter(line => line.trim())
        });
      });
    });

    return {
      firewall: firewallStatus,
      antivirus: antivirusStatus,
      risks: [] // Placeholder for more advanced risk detection
    };
  } catch (error) {
    console.error('Security scan error:', error);
    return null;
  }
}

// Enhanced system information retrieval
ipcMain.handle('get-system-info', async () => {
  try {
    const { execSync } = require('child_process');
    const si = require('systeminformation');

    // Get comprehensive system information
    const [
      osInfo,
      cpuInfo,
      memInfo,
      diskInfo,
      networkInfo,
      graphicsInfo,
      batteryInfo,
      systemUptime,
      systemInfo
    ] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaces(),
      si.graphics(),
      si.battery(),
      si.time(),
      si.system()
    ]);

    // Format system information
    return {
      // System Details
      system: {
        manufacturer: systemInfo.manufacturer,
        model: systemInfo.model,
        serial: systemInfo.serial,
        uuid: systemInfo.uuid
      },
      
      // OS Details
      platform: `${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
      hostname: os.hostname(),
      
      // Uptime
      uptime: `${Math.floor(systemUptime.uptime / 3600)} hours, ${Math.floor((systemUptime.uptime % 3600) / 60)} minutes`,
      
      // CPU Details
      cpu: await (async () => {
        try {
          const [cpuInfo, cpuLoad] = await Promise.all([
            si.cpu(),
            si.currentLoad()
          ]);

          return {
            model: cpuInfo.brand,
            cores: cpuInfo.cores,
            currentLoad: cpuLoad ? cpuLoad.currentLoad : 0
          };
        } catch (error) {
          console.error('CPU information retrieval error:', error);
          return {
            model: 'Unknown',
            cores: 'N/A',
            currentLoad: 0
          };
        }
      })(),
      
      // Memory Details
      memory: {
        total: memInfo.total,
        used: memInfo.used,
        free: memInfo.free,
        usagePercent: ((memInfo.used / memInfo.total) * 100)
      },
      
      // Disk Details
      disks: await (async () => {
  try {
    const [diskInfo, diskLayout, blockDevices] = await Promise.all([
      si.fsSize().catch(() => []),
      si.diskLayout().catch(() => []),
      si.blockDevices().catch(() => [])
    ]);

    // Get detailed disk info from PowerShell (Windows only)
    let detailedDisks = [];
    if (process.platform === 'win32') {
      try {
        const powerShellCommand = `Get-PhysicalDisk | Select-Object DeviceID, MediaType, BusType, FriendlyName, Size, HealthStatus, OperationalStatus | ConvertTo-Json`;
        const result = execSync(`powershell.exe -Command "${powerShellCommand}"`, { encoding: 'utf-8' });
        detailedDisks = JSON.parse(result);
        if (!Array.isArray(detailedDisks)) {
          detailedDisks = [detailedDisks];
        }
      } catch (error) {
        console.error('Error getting detailed disk info from PowerShell:', error);
      }
    }

    return diskInfo.map(disk => {
      try {
        if (!disk || !disk.mount) return null;

        // Find matching disk in layout by size (within 1%)
        const matchedDisk = diskLayout.find(d => 
          d.size && disk.size && Math.abs(d.size - disk.size) / disk.size < 0.01
        );

        // Get detailed disk info from PowerShell
        const detailedDisk = detailedDisks.find(d => 
          d.Size && disk.size && Math.abs(d.Size - disk.size) / disk.size < 0.01
        ) || {};

        // Determine disk type with fallbacks
        let diskType = 'Unknown';
        if (detailedDisk.MediaType) {
          diskType = detailedDisk.MediaType;
        } else if (matchedDisk && matchedDisk.type) {
          diskType = matchedDisk.type;
        }
        if (detailedDisk.BusType === 'NVMe' || (matchedDisk && matchedDisk.interfaceType === 'NVMe')) {
          diskType = 'NVMe SSD';
        }

        // Get make and model
        const make = (detailedDisk.FriendlyName ? detailedDisk.FriendlyName.split(' ')[0] : '') || 
                    (matchedDisk && matchedDisk.vendor) || 
                    'Unknown';
        
        const model = (detailedDisk.FriendlyName || '').replace(make, '').trim() || 
                     (matchedDisk && matchedDisk.name) || 
                     'Unknown';

        return {
          mount: disk.mount,
          type: diskType,
          fs: disk.fs || 'Unknown FS',
          total: disk.size,
          used: disk.used,
          free: disk.available,
          usagePercent: disk.use || 0,
          model: model,
          vendor: make,
          serial: (matchedDisk && matchedDisk.serialNum) || 'Unknown'
        };
      } catch (error) {
        console.error('Error processing disk:', error, disk);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error('Disk information retrieval error:', error);
    return [];
  }
})(),
      
      // Network Details
      network: await (async () => {
        try {
          const { execSync } = require('child_process');
          
          // Retrieve information using multiple methods
          const [
            networkInterfaces, 
            networkStats
          ] = await Promise.all([
            si.networkInterfaces(),
            si.networkStats()
          ]);

          // Get detailed network adapter information using PowerShell (Windows)
          let detailedAdapters = [];
          if (process.platform === 'win32') {
            try {
              const psCommand = `Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, MacAddress, LinkSpeed, InterfaceIndex, ifIndex, ifType, InterfaceAlias, InterfaceOperationalStatus, MediaType, PhysicalMediaType, DriverInformation, DriverVersion, DriverDate | ConvertTo-Json`;
              const result = execSync(`powershell -Command "${psCommand}"`, { encoding: 'utf8' });
              if (result) {
                detailedAdapters = JSON.parse(result);
                if (!Array.isArray(detailedAdapters)) {
                  detailedAdapters = [detailedAdapters];
                }
              }
            } catch (e) {
              console.log('PowerShell network adapter info failed, using basic info');
            }
          }

          // Get IP configuration for all adapters
          const getIPConfig = async (iface) => {
            try {
              const ip4 = iface.ip4 || '';
              const ip6 = iface.ip6 || '';
              const subnet = iface.cidr || '';
              const mac = iface.mac || '';
              
              // Try to get gateway and DNS
              let gateway = 'N/A';
              let dnsServers = [];
              
              if (process.platform === 'win32') {
                try {
                  // Get default gateway
                  const routeCmd = `route print 0.0.0.0 | findstr /r /c:"^ *0.0.0.0"`;
                  const routeOutput = execSync(routeCmd, { encoding: 'utf8' });
                  const gatewayMatch = routeOutput.match(/0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/);
                  if (gatewayMatch) {
                    gateway = gatewayMatch[1];
                  }
                  
                  // Get DNS servers
                  const dnsCmd = `ipconfig /all | findstr /i "DNS Servers"`;
                  const dnsOutput = execSync(dnsCmd, { encoding: 'utf8' });
                  dnsServers = dnsOutput.split('\n')
                    .map(line => line.match(/\d+\.\d+\.\d+\.\d+/))
                    .filter(match => match)
                    .map(match => match[0]);
                } catch (e) {
                  console.error('Error getting network details:', e);
                }
              }
              
              return { ip4, ip6, subnet, mac, gateway, dnsServers };
            } catch (error) {
              console.error('Error in getIPConfig:', error);
              return { ip4: 'N/A', ip6: 'N/A', subnet: 'N/A', mac: 'N/A', gateway: 'N/A', dnsServers: [] };
            }
          };
          
          // Get WiFi network name if applicable
          const getWifiNetworkName = async (iface) => {
            if (iface.type !== 'wireless') return 'N/A';
            
            try {
              if (process.platform === 'win32') {
                const wifiCmd = 'netsh wlan show interfaces';
                const wifiOutput = execSync(wifiCmd, { encoding: 'utf8' });
                const ssidMatch = wifiOutput.match(/SSID\s*:\s*([^\r\n]+)/i);
                return ssidMatch ? ssidMatch[1].trim() : 'Not connected';
              }
              return 'N/A';
            } catch (e) {
              return 'Error retrieving SSID';
            }
          };

          // Process all network interfaces
          const allInterfaces = await Promise.all(networkInterfaces.map(async (iface) => {
            const stats = networkStats.find(stat => stat.iface === iface.iface) || {};
            const ipConfig = await getIPConfig(iface);
            const wifiNetworkName = await getWifiNetworkName(iface);
            
            // Find detailed adapter info
            const detailedInfo = detailedAdapters.find(adapter => 
              adapter.InterfaceIndex === iface.iface ||
              adapter.InterfaceAlias === iface.ifaceName ||
              adapter.Name === iface.ifaceName
            ) || {};
            
            // Determine connection status
            let status = 'Disconnected';
            if (iface.operstate === 'up') status = 'Connected';
            else if (iface.operstate === 'down') status = 'Disabled';
            
            // Get connection type
            let connectionType = iface.type || 'Unknown';
            if (detailedInfo.InterfaceDescription) {
              if (detailedInfo.InterfaceDescription.includes('Wireless')) connectionType = 'Wireless';
              else if (detailedInfo.InterfaceDescription.includes('Ethernet')) connectionType = 'Ethernet';
              else if (detailedInfo.InterfaceDescription.includes('Virtual')) connectionType = 'Virtual';
            }
            
            return {
              name: iface.ifaceName || iface.iface || 'Unknown',
              description: detailedInfo.InterfaceDescription || iface.iface,
              type: connectionType,
              status: status,
              mac: iface.mac || '00:00:00:00:00:00',
              ip4: ipConfig.ip4,
              ip6: ipConfig.ip6,
              subnet: ipConfig.subnet,
              gateway: ipConfig.gateway,
              dnsServers: ipConfig.dnsServers,
              wifiNetwork: wifiNetworkName,
              speed: iface.speed || detailedInfo.LinkSpeed || 'N/A',
              isVirtual: iface.virtual || connectionType === 'Virtual',
              driver: {
                name: detailedInfo.DriverInformation || 'Unknown',
                version: detailedInfo.DriverVersion || 'Unknown',
                date: detailedInfo.DriverDate || 'Unknown'
              },
              stats: {
                rx_bytes: stats.rx_bytes || 0,
                tx_bytes: stats.tx_bytes || 0,
                rx_sec: stats.rx_sec || 0,
                tx_sec: stats.tx_sec || 0,
                ms: stats.ms || 0
              }
            };
          }));
          
          return { adapters: allInterfaces };
          
        } catch (error) {
          console.error('Network information retrieval error:', error);
          return { 
            adapters: [{
              name: 'Network Detection Failed',
              error: error.message || 'Unknown error'
            }] 
          };
        }
      })(),
      
      // Graphics Details
      graphics: graphicsInfo.controllers.map(gpu => ({
        vendor: gpu.vendor,
        model: gpu.model,
        vram: (gpu.vram / (1024 * 1024)).toFixed(2) + ' MB'
      })),
      
      // Battery and Power Information
      battery: await (async () => {
        try {
          const batteryInfo = await si.battery();
          
          // Power Plan retrieval
          let powerPlan = 'Unknown';
          try {
            const { execSync } = require('child_process');
            const powerPlanOutput = execSync('powercfg /getactivescheme', { encoding: 'utf8' });
            const planMatch = powerPlanOutput.match(/Power Scheme GUID: .*\((.*)\)/);
            powerPlan = planMatch ? planMatch[1] : 'Unknown';
          } catch (powerPlanError) {
            console.error('Power plan retrieval error:', powerPlanError);
          }

          return {
            percentage: batteryInfo.percent !== -1 ? `${batteryInfo.percent}%` : 'N/A',
            charging: batteryInfo.isCharging,
            powerPlan: powerPlan
          };
        } catch (error) {
          console.error('Battery information retrieval error:', error);
          return {
            percentage: 'N/A',
            charging: 'Unknown',
            powerPlan: 'Unknown'
          };
        }
      })(),
      
      // Additional System Information
      additionalInfo: await (async () => {
        try {
          const { execSync } = require('child_process');
          
          // Retrieve information using multiple methods
          const [
            biosInfo, 
            temperatureInfo, 
            displayInfo
          ] = await Promise.all([
            si.bios(),
            si.cpuTemperature(),
            si.graphics()
          ]);

          // Prepare additional information object
          const additionalInfo = {};

          // BIOS Information
          if (biosInfo.vendor || biosInfo.version || biosInfo.releaseDate) {
            additionalInfo.bios = {
              vendor: biosInfo.vendor || 'N/A',
              version: biosInfo.version || 'N/A',
              releaseDate: biosInfo.releaseDate || 'N/A'
            };
          }

          // Temperature Information
          if (temperatureInfo.main !== -1 || 
              (temperatureInfo.cores && temperatureInfo.cores.length > 0)) {
            additionalInfo.temperatures = {
              cpu: (typeof temperatureInfo.main === 'number' && isFinite(temperatureInfo.main))
                ? `${temperatureInfo.main.toFixed(1)}°C`
                : 'N/A',
              cores: Array.isArray(temperatureInfo.cores) && temperatureInfo.cores.length > 0
                ? temperatureInfo.cores.map(core => (typeof core === 'number' && isFinite(core) ? `${core.toFixed(1)}°C` : 'N/A')).join(', ')
                : 'N/A'
            };
          }

          // Display Information
          const validDisplays = displayInfo.displays.filter(display => 
            display.model || display.resolutionX || display.resolutionY
          );
          if (validDisplays.length > 0) {
            additionalInfo.display = validDisplays.map(display => ({
              model: display.model || 'Unknown',
              main: display.main,
              resolution: `${display.resolutionX}x${display.resolutionY}`,
              pixelDepth: display.pixelDepth
            }));
          }

          return additionalInfo;
        } catch (error) {
          console.error('Additional system information retrieval error:', error);
          return {};
        }
      })(),
    };
  } catch (error) {
    console.error('Error retrieving system information:', error);
    return null;
  }
});

// IPC handler to get the app version
ipcMain.handle('get-app-version', () => {
  const version = app.getVersion();
  log.info(`Sending app version to renderer: ${version}`);
  return version;
});

// Ticket Submission Handler
ipcMain.handle('send-ticket', async (event, ticketData) => {
    console.log(`[send-ticket handler] Invoked at ${new Date().toISOString()}`);
    try {
        // Prepare email content (plain text)
        const emailContent = `Support Ticket Details:\n\nSubject: ${ticketData.subject || 'No Subject'}\nFull Name: ${ticketData.fullName}\nEmail: ${ticketData.email}\nPhone: ${ticketData.phone}\n\nDescription:\n${ticketData.description}\n\nSystem Information:\n${JSON.stringify(ticketData.systemInfo, null, 2)}\n`;

        // Prepare email content (HTML)
        function systemInfoTable(systemInfo) {
            if (!systemInfo) return '<em>No system info available</em>';
            let html = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;width:100%;margin-top:8px;">';
            function row(label, value) {
                return `<tr><td style=\"background:#f4f4f4;font-weight:bold;\">${label}</td><td>${value}</td></tr>`;
            }
            
            // Add system information at the top
            if (systemInfo.system) {
                html += row('System Manufacturer', systemInfo.system.manufacturer || 'N/A');
                html += row('System Model', systemInfo.system.model || 'N/A');
                html += row('System Serial', systemInfo.system.serial || 'N/A');
            }
            
            // Add a separator
            html += '<tr><td colspan="2" style="background:#e0e0e0;height:1px;padding:0;"></td></tr>';
            
            // Existing system info rows
            html += row('Platform', systemInfo.platform || '');
            html += row('Hostname', systemInfo.hostname || '');
            html += row('Uptime', systemInfo.uptime || '');
            if (systemInfo.cpu) {
                html += row('CPU', `${systemInfo.cpu.model || ''} (${systemInfo.cpu.cores || ''} cores)`);
                html += row('CPU Load', systemInfo.cpu.currentLoad ? systemInfo.cpu.currentLoad.toFixed(1) + '%' : 'N/A');
            if (systemInfo.memory) {
                html += row('Memory', `${(systemInfo.memory.used/1024/1024/1024).toFixed(2)} GB used / ${(systemInfo.memory.total/1024/1024/1024).toFixed(2)} GB total (${systemInfo.memory.usagePercent ? systemInfo.memory.usagePercent.toFixed(1) : '?'}%)`);
            }
            if (systemInfo.disks && Array.isArray(systemInfo.disks) && systemInfo.disks.length > 0) {
  console.log('Debug - Disk data:', JSON.stringify(systemInfo.disks, null, 2));
  html += `<tr><td style="background:#f4f4f4;font-weight:bold;">Disks</td><td><ul style="margin:0;padding-left:15px;">` +
    systemInfo.disks.map(d => {
      try {
        // Format sizes
        const totalGB = (d.total / (1024 * 1024 * 1024)).toFixed(2);
        const usedGB = (d.used / (1024 * 1024 * 1024)).toFixed(2);
        const usagePercent = d.usagePercent ? d.usagePercent.toFixed(1) : '0.0';
        
        // Build disk info string
        const parts = [
          `<strong>${d.mount}</strong>`,
          d.model !== 'Unknown Model' ? d.model : '',
          d.type ? `(${d.type})` : '',
          `[${d.fs}]`,
          `- ${usedGB}GB used of ${totalGB}GB (${usagePercent}%)`,
          d.vendor !== 'Unknown' ? `- Vendor: ${d.vendor}` : '',
          d.serial !== 'Unknown' ? `- S/N: ${d.serial}` : ''
        ].filter(Boolean);
        
        return `<li>${parts.join(' ')}</li>`;
      } catch (error) {
        console.error('Error formatting disk info:', error, d);
        return `<li>Error displaying disk information</li>`;
      }
    }).join('') +
    `</ul></td></tr>`;
}
            if (systemInfo.network && systemInfo.network.adapters && Array.isArray(systemInfo.network.adapters)) {
                html += `<tr><td style="background:#f4f4f4;font-weight:bold;">Network</td><td><ul style="margin:0;padding-left:15px;">` +
                    systemInfo.network.adapters.map(a => {
                        // Format connection status
                        let status = 'Disconnected';
// ... (rest of the code remains the same)
                        if (a.status === 'Connected') status = 'Connected';
                        else if (a.operstate === 'up') status = 'Connected';
                        else if (a.operstate === 'down') status = 'Disabled';
                        
                        // Format connection type
                        const type = a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1).toLowerCase() : 'Unknown';
                        
                        // Get WiFi network name if connected to WiFi
                        let wifiInfo = '';
                        if (type.toLowerCase() === 'wireless' || type.toLowerCase() === 'wifi') {
                            wifiInfo = `, WiFi: ${a.wifiNetwork || a.wifiNetworkName || 'Not connected'}`;
                        }
                        
                        // Format IP address (prefer IPv4, fall back to IPv6)
                        const ipAddress = a.ip4 || a.ip6 || a.ip || 'N/A';
                        
                        // Format MAC address
                        const macAddress = a.mac || 'N/A';
                        
                        // Format the display line
                        return `<li>${a.name || 'Unknown Adapter'} (${type}) - IP: ${ipAddress}, MAC: ${macAddress}${wifiInfo}, Status: ${status}</li>`;
                    }).join('') +
                    `</ul></td></tr>`;
            }
            if (systemInfo.graphics && Array.isArray(systemInfo.graphics)) {
                html += `<tr><td style="background:#f4f4f4;font-weight:bold;">Graphics</td><td><ul style="margin:0;padding-left:15px;">` +
                    systemInfo.graphics.map(g => `<li>${g.vendor || ''} ${g.model || ''} (${g.vram || ''})</li>`).join('') +
                    `</ul></td></tr>`;
            }
            if (systemInfo.battery) {
                html += row('Battery', `Charge: ${systemInfo.battery.percentage || 'N/A'}, Charging: ${systemInfo.battery.charging ? 'Yes' : 'No'}, Power Plan: ${systemInfo.battery.powerPlan || 'N/A'}`);
            }
            if (systemInfo.additionalInfo && systemInfo.additionalInfo.bios) {
                html += row('BIOS', `${systemInfo.additionalInfo.bios.vendor || ''} v${systemInfo.additionalInfo.bios.version || ''} (${systemInfo.additionalInfo.bios.releaseDate || ''})`);
            }

            if (systemInfo.additionalInfo && systemInfo.additionalInfo.display && Array.isArray(systemInfo.additionalInfo.display)) {
                html += `<tr><td style="background:#f4f4f4;font-weight:bold;">Displays</td><td><ul style="margin:0;padding-left:15px;">` +
                    systemInfo.additionalInfo.display.map(d => `<li>${d.model || 'Unknown'} ${d.main ? '(Main)' : ''} - ${d.resolution || ''}, Depth: ${d.pixelDepth || ''}</li>`).join('') +
                    `</ul></td></tr>`;
            }
            html += '</table>';
            return html;
        }

        const emailHtml = `
            <div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#222;max-width:700px;margin:auto;">
                <h2 style="background:#2ecc71;color:#fff;padding:12px 18px;border-radius:6px 6px 0 0;margin:0 0 12px 0;">Support Ticket Details</h2>
                <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:15px;width:100%;margin-bottom:18px;">
                    <tr><td style="font-weight:bold;width:140px;">Subject:</td><td>${ticketData.subject || 'No Subject'}</td></tr>
                    <tr><td style="font-weight:bold;width:140px;">Full Name:</td><td>${ticketData.fullName}</td></tr>
                    <tr><td style="font-weight:bold;">Email:</td><td>${ticketData.email}</td></tr>
                    <tr><td style="font-weight:bold;">Phone:</td><td>${ticketData.phone}</td></tr>
                </table>
                
                <div style="background:#f8f9fa;padding:12px;border-radius:6px;margin-bottom:18px;">
                    <h3 style="margin:0 0 10px 0;color:#2c3e50;">Issue Description:</h3>
                    <div style="white-space:pre-line;">${ticketData.description}</div>
                </div>
                
                ${systemInfoTable(ticketData.systemInfo)}
                
                <div style="margin-top:24px;padding:12px;background:#f5f5f5;border-radius:6px;font-size:13px;color:#666;border-left:4px solid #2ecc71;">
                    <strong>Note:</strong> This is an automated support ticket. A DBS Technology support agent will contact you shortly.
                </div>
            </div>
        `;

        // Send email using nodemailer (existing logic)
        const transporter = nodemailer.createTransport({
          host: 'smtp.dbs-scans.co.za',
          port: 465,
          secure: true, // Use SSL
          auth: {
            user: 'inscaperollout@dbs-scans.co.za',
            pass: 'K619vv4Y39744p'
          },
          tls: {
            // Do not fail on invalid certs
            rejectUnauthorized: false
          }
        });

        const mailOptions = {
          from: 'inscaperollout@dbs-scans.co.za',
          to: 'lionelbakerza@gmail.com',
          subject: ticketData.subject || `Support Ticket from ${ticketData.fullName}`,
          text: emailContent,
          html: emailHtml,
          replyTo: ticketData.email
        };

        console.log('Preparing to send ticket email:', mailOptions);
        const info = await transporter.sendMail(mailOptions);

        console.log('Ticket email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Ticket submission error:', error);
        return { success: false, error: error.message };
    }
});

// IPC handler to launch tools from the DBS Toolbox
ipcMain.on('launch-tool', async (event, { path: toolPath, name }) => {
  try {
    log.info(`Launching tool: ${name} (${toolPath})`);
    
    // Ensure we're using the correct path for production
    let finalPath = toolPath;
    if (app.isPackaged) {
      // In production, ensure we're using the app.asar.unpacked directory
      finalPath = toolPath.replace('app.asar', 'app.asar.unpacked');
      log.info(`Adjusted path for production: ${finalPath}`);
    }
    
    // Normalize the path to handle any path separators
    const normalizedPath = path.normalize(finalPath);
    log.info(`Normalized tool path: ${normalizedPath}`);
    
    // Check if the tool exists
    if (!fs.existsSync(normalizedPath)) {
      const errorMsg = `Tool not found at path: ${normalizedPath}`;
      log.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    log.info(`File exists, attempting to launch: ${normalizedPath}`);
    
    // Use shell.openPath for better Windows compatibility
    const { shell } = require('electron');
    const result = await shell.openPath(normalizedPath);
    
    if (result) {
      // If shell.openPath returns a non-empty string, it means there was an error
      throw new Error(`Failed to launch tool: ${result}`);
    }
    
    log.info(`Successfully requested launch of ${name}`);
    
    // Send success notification to renderer
    if (mainWindow) {
      mainWindow.webContents.send('tool-launched', { 
        success: true, 
        name,
        message: `${name} launched successfully`
      });
    }
  } catch (error) {
    log.error(`Error launching tool ${name}:`, error);
    
    // Send error notification to renderer
    if (mainWindow) {
      mainWindow.webContents.send('tool-error', { 
        name,
        error: error.message 
      });
    }
  }
});

// Add this near other IPC handlers, maybe after the 'get-system-info' handler
ipcMain.handle('get-tools-list', async () => {
  const toolsDir = path.join(__dirname, 'tools', 'dbs-utilities');
  try {
    const files = fs.readdirSync(toolsDir);
    return { success: true, tools: files };
  } catch (error) {
    log.error('Error reading tools directory:', error);
    return { success: false, error: error.message };
  }
});

// Consolidated TeamViewer launch handler
function setupTeamViewerHandler() {
  // Prevent multiple initializations
  if (isTeamViewerHandlerInitialized) {
    console.log('TeamViewer handler already initialized');
    return;
  }

  console.log('Initializing TeamViewer handler...');
  
  // Remove all existing 'launch-teamviewer' handlers
  ipcMain.removeHandler('launch-teamviewer');

  // Add new handler
  ipcMain.handle('launch-teamviewer', async (event) => {
    console.log('TeamViewer launch handler called');

    try {
      // First, check if TeamViewer is already installed
      if (isTeamViewerInstalled()) {
        try {
          // Try to launch existing TeamViewer installations
          const launchPath = TEAMVIEWER_PATHS.find(path => {
            try {
              const exists = fs.existsSync(path);
              console.log(`Checking if TeamViewer exists at ${path}: ${exists}`);
              return exists;
            } catch (e) {
              console.error(`Error checking path ${path}:`, e);
              return false;
            }
          });
          
          if (launchPath) {
            console.log(`Launching existing TeamViewer from: ${launchPath}`);
            await openFileOrFolder(launchPath);
            return { success: true, installed: true };
          }
        } catch (error) {
          console.error('Error in TeamViewer launch process:', error);
          // Continue to download if launch fails
        }
      }

      // If not installed or launch failed, download TeamViewer Quick Support
      console.log('TeamViewer not found or failed to launch, initiating download');
      try {
        const downloadPath = await downloadTeamViewerQuickSupport();
        return { 
          success: true, 
          installed: false, 
          downloadPath: downloadPath 
        };
      } catch (error) {
        console.error('TeamViewer download failed:', error);
        throw new Error(`Failed to download TeamViewer: ${error.message}`);
      }
    } catch (error) {
      console.error('TeamViewer handler error:', error);
      throw error;
    }
  });

  isTeamViewerHandlerInitialized = true;
  console.log('TeamViewer handler initialized successfully');
}

/**
 * Create the application window
 */
function createWindow() {
  // Get the primary display dimensions
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // Adjusted window dimensions to match the second image
  const windowWidth = 380;  // Slightly wider to accommodate content
  const windowHeight = 895; // Increased from 860px to 895px (4% increase) for more space
  const margin = 20;        // Margin from screen edges

  // Create the browser window with native title bar
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: width - windowWidth - margin, // Position on right side
    y: height - windowHeight - margin, // Position near bottom
    minWidth: 380,
    minHeight: 780, // Increased minimum height to maintain proportions
    show: true, // Changed from false to true to show window on startup
    title: `DBS Support Desk v${version}`,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      spellcheck: true,
      webviewTag: true,
      contextMenu: true,
      webSecurity: true
    },
    icon: path.join(__dirname, 'assets', 'DBS_Logo.ico'),
    frame: true, // Keep native frame
    backgroundColor: '#f5f5f5', // Light gray background to match the form
    skipTaskbar: false, // Show in taskbar
    resizable: true,
    autoHideMenuBar: false, // Changed from true to false to show menu bar by default
    titleBarStyle: 'default',
    titleBarOverlay: false
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Show the window when it's ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window is ready');
    // Set the version in the title bar
    mainWindow.setTitle(`DBS Support Desk v${version}`);
    
    // Ensure content is properly sized
    mainWindow.webContents.on('did-finish-load', () => {
      // Add some CSS to ensure proper spacing
      mainWindow.webContents.insertCSS(`
        body {
          padding: 15px;
          margin: 0;
          box-sizing: border-box;
        }
        .form-container {
          max-width: 100%;
          box-sizing: border-box;
        }
        .form-group {
          margin-bottom: 15px;
        }
      `);
    });
  });

  // Handle window close event (minimize to tray instead of quitting)
  mainWindow.on('close', (event) => {
    if (!isAppQuitting) {
      console.log('Window close prevented, minimizing to tray');
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });
  
  // Handle minimize event
  mainWindow.on('minimize', (event) => {
    console.log('Window minimize event');
    event.preventDefault();
    mainWindow.hide();
  });

  // Enable built-in spell checker with multiple languages
  mainWindow.webContents.session.setSpellCheckerEnabled(true);
  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US', 'en-GB']);

  // Enable context menu for text inputs
  mainWindow.webContents.on('context-menu', (event, params) => {
    if (params.isEditable) {
      event.preventDefault();
      const { Menu, MenuItem } = require('electron');
      const menu = new Menu();
      
      // Add each spelling suggestion
      if (params.dictionarySuggestions.length > 0) {
        params.dictionarySuggestions.forEach(suggestion => {
          menu.append(new MenuItem({
            label: suggestion,
            click: () => mainWindow.webContents.replaceMisspelling(suggestion)
          }));
        });
        menu.append(new MenuItem({ type: 'separator' }));
      }
      
      // Add standard editing options
      menu.append(new MenuItem({
        label: 'Undo',
        role: 'undo',
        enabled: params.editFlags.canUndo
      }));
      
      menu.append(new MenuItem({
        label: 'Redo',
        role: 'redo',
        enabled: params.editFlags.canRedo
      }));
      
      menu.append(new MenuItem({ type: 'separator' }));
      
      menu.append(new MenuItem({
        label: 'Cut',
        role: 'cut',
        enabled: params.editFlags.canCut
      }));
      
      menu.append(new MenuItem({
        label: 'Copy',
        role: 'copy',
        enabled: params.editFlags.canCopy
      }));
      
      menu.append(new MenuItem({
        label: 'Paste',
        role: 'paste',
        enabled: params.editFlags.canPaste
      }));
      
      menu.popup();
    }
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Enable DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// Auto-update functionality
async function checkAppDirectoryAccess() {
  try {
    // Use the user data directory instead of the app directory
    const userDataPath = app.getPath('userData');
    log.info(`Checking write access to user data directory: ${userDataPath}`);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Test write access by creating a temporary file
    const testFilePath = path.join(userDataPath, 'write-test.tmp');
    fs.writeFileSync(testFilePath, 'test');
    fs.unlinkSync(testFilePath);
    
    log.info('Write access to user data directory: Granted');
    return true;
  } catch (error) {
    log.error(`No write access to user data directory: ${error.message}`);
    return false;
  }
}

async function checkForUpdates(manualCheck = false) {
  try {
    log.info('Checking for updates...');
    
    // Always check the user data directory, not the app directory
    const hasAccess = await checkAppDirectoryAccess();
    if (!hasAccess) {
      const errorMsg = 'Cannot check for updates: No write access to user data directory';
      log.error(errorMsg);
      if (mainWindow && manualCheck) {
        mainWindow.webContents.send('update-error', errorMsg);
      }
      return { success: false, error: errorMsg };
    }

    // Set the feed URL for GitHub releases
    const updateServerUrl = 'https://github.com/dbsdeskza/dbs-support-desk';
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'dbsdeskza',
      repo: 'dbs-support-desk',
      private: false
    });
    
    log.info('Feed URL set, checking for updates...');
    
    // Check for updates
    const updateCheckResult = await autoUpdater.checkForUpdates();
    log.info('Update check result:', updateCheckResult ? 'Update available' : 'No updates available');
    
    return { success: true, updateInfo: updateCheckResult };
    
  } catch (error) {
    const errorMsg = `Error checking for updates: ${error.message}`;
    log.error(errorMsg);
    if (mainWindow && manualCheck) {
      mainWindow.webContents.send('update-error', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
}

// Configure auto-updater
function setupAutoUpdater() {
  log.info('Setting up auto-updater...');
  
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.fullChangelog = true;
  
  // Set feed URL for GitHub releases
  const repo = 'dbsdeskza/dbs-support-desk';
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'dbsdeskza',
    repo: 'dbs-support-desk',
    private: false,
    vPrefixedTagName: true,
    releaseType: 'release',
  });

  // Event listeners
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', 'Checking for updates...');
    }
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('No updates available');
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent || 0);
    log.info(`Download progress: ${percent}%`);
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded, will install in 5s');
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
    // Auto install after 5 seconds
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 5000);
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', `Auto-update error: ${err.message}`);
    }
  });
  
  // Initial check for updates after a short delay
  setTimeout(() => {
    log.info('Performing initial update check...');
    checkForUpdates();
  }, 3000);
  
  // Check for updates every 4 hours
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
}

// IPC handler for manual update check
ipcMain.on('check-for-updates', () => {
  log.info('Manual update check requested');
  checkForUpdates(true);
});

// IPC handler for manual download and install
ipcMain.handle('download-and-install-update', async () => {
  try {
    log.info('Starting manual update process...');
    
    if (!autoUpdater) {
      log.error('AutoUpdater is not initialized');
      return { success: false, error: 'AutoUpdater not initialized' };
    }

    log.info('Checking for updates...');
    const updateCheckResult = await autoUpdater.checkForUpdates();
    
    if (!updateCheckResult || !updateCheckResult.updateInfo) {
      log.error('No update information available');
      return { success: false, error: 'No update information available' };
    }

    const { version, path, releaseNotes } = updateCheckResult.updateInfo;
    log.info(`Update found: v${version}`, { path, releaseNotes });

    if (mainWindow) {
      mainWindow.webContents.send('update-status', `Found update v${version}, preparing download...`);
    }

    // Set up event listeners for the download
    return new Promise((resolve) => {
      autoUpdater.once('download-progress', (progressObj) => {
        log.info('Download progress:', progressObj);
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', progressObj);
        }
      });

      autoUpdater.once('update-downloaded', (info) => {
        log.info('Update downloaded:', info);
        if (mainWindow) {
          mainWindow.webContents.send('update-downloaded', info);
        }
        resolve({ success: true, version: info.version });
      });

      autoUpdater.once('error', (error) => {
        log.error('Download error:', error);
        if (mainWindow) {
          mainWindow.webContents.send('update-error', error.message);
        }
        resolve({ success: false, error: error.message });
      });

      // Start the download
      log.info('Starting download...');
      autoUpdater.downloadUpdate().catch(error => {
        log.error('Failed to start download:', error);
        if (mainWindow) {
          mainWindow.webContents.send('update-error', `Failed to start download: ${error.message}`);
        }
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    log.error('Error in download handler:', error);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', `Update error: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
});

// IPC handler for force closing the app
ipcMain.on('force-close-app', () => {
  log.info('Force closing app for update...');
  
  // Close all windows
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  });
  
  // Force exit after a short delay
  setTimeout(() => {
    log.info('Force exiting app...');
    app.exit(0);
  }, 500);
});

// IPC handler for restarting the app
ipcMain.on('restart-app', async () => {
  log.info('Preparing to restart app for update...');
  
  try {
    // Close all windows
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.removeAllListeners('close');
      window.close();
    }
    
    // Give some time for windows to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force quit the app
    log.info('Calling quitAndInstall...');
    
    // First try the normal way
    const success = autoUpdater.quitAndInstall(false, true);
    
    // If that fails, force close after a delay
    if (!success) {
      log.warn('quitAndInstall returned false, forcing close...');
      setTimeout(() => {
        app.exit(0);
      }, 1000);
    }
    
  } catch (error) {
    log.error('Error during restart:', error);
    // If we get here, try the forceful approach
    app.exit(0);
    process.exit(0);
  }
});

// IPC handler to get the app version
// Removed duplicate IPC handler

// Handle theme preference changes
ipcMain.on('theme-changed', (event, theme) => {
  // Save theme preference to disk if needed
  // This can be used to persist theme across app restarts
  if (mainWindow) {
    mainWindow.webContents.send('set-theme', theme);
  }
});

// Listen for system theme changes
systemPreferences.on('updated', (event, change) => {
  if (change === 'systemPreferences' && mainWindow) {
    const isDarkMode = systemPreferences.isDarkMode();
    mainWindow.webContents.send('system-theme-changed', isDarkMode ? 'dark' : 'light');
  }
});

// Handle before-quit event
app.on('before-quit', (e) => {
  log.info('App is about to quit...');
  // Prevent the default quit behavior to ensure our cleanup runs
  e.preventDefault();
  
  // Close all windows
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
  
  // Force quit after a short delay
  setTimeout(() => {
    app.exit(0);
  }, 1000);
});

// Auto-update error handler
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', reason instanceof Error ? reason.message : String(reason));
  }
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', error.message || 'An unexpected error occurred');
  }
});

// Create and configure the system tray icon and context menu
function createSystemTray() {
  // Clean up existing tray if it exists
  if (tray) {
    try {
      tray.destroy();
    } catch (e) {
      console.error('Error destroying existing tray:', e);
    }
    tray = null;
  }

  try {
    console.log('Creating system tray...');
    
    // Handle icon path for both development and production
    let iconPath;
    if (app.isPackaged) {
      // In production, use resources path
      iconPath = path.join(process.resourcesPath, 'assets', 'DBS_Logo.ico');
    } else {
      // In development, use the regular path
      iconPath = path.join(__dirname, 'assets', 'DBS_Logo.ico');
    }
    
    console.log('Using icon path:', iconPath);
    
    // Load the icon with error handling
    let trayIcon;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (trayIcon.isEmpty()) {
        throw new Error('Icon file is empty or invalid');
      }
    } catch (error) {
      console.error('Failed to load tray icon:', error);
      // Fallback to a blank icon if the file can't be loaded
      trayIcon = nativeImage.createEmpty();
    }
    
    // Create the tray with the icon
    tray = new Tray(trayIcon);
    
    // Set the tooltip
    tray.setToolTip(`DBS Support Desk v${app.getVersion()}`);
    
    // Handle click events
    tray.on('click', () => {
      console.log('Tray icon clicked');
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Create and set context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `DBS Support Desk v${app.getVersion()}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show DBS Support Desk',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isAppQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    console.log('Tray created successfully');
    
  } catch (error) {
    console.error('Failed to create system tray:', error);
  }
}

// Toggle window visibility
function toggleWindow() {
  console.log('Toggling window...');
  
  if (!mainWindow) {
    console.log('No main window, creating new one...');
    createWindow();
    return;
  }

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    console.log('Window is visible and focused, minimizing...');
    mainWindow.minimize();
    mainWindow.hide();
    if (PLATFORM_CONFIG.isMac) app.dock.hide();
  } else {
    console.log('Showing and focusing window...');
    if (PLATFORM_CONFIG.isMac) app.dock.show();
    
    if (mainWindow.isMinimized()) {
      console.log('Restoring minimized window...');
      mainWindow.restore();
    }
    
    mainWindow.show();
    mainWindow.focus();
    
    // Bring to front
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
  }
}

// Create application menu
function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'close', label: 'Close Window' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      label: 'Help',
      submenu: [
        {
          label: 'Contact DBS Technology',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://dbstechnology.co.za/contact-us/')
          }
        },
        {
          label: 'About DBS Technology',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://dbstechnology.co.za/about-dbs-technology/')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function checkIconFiles() {
  const iconPaths = [
    path.join(__dirname, 'assets', 'DBS_Logo.ico'),
    path.join(__dirname, 'assets', 'icon.ico')
  ];

  console.log('\n=== Checking Icon Files ===');
  
  iconPaths.forEach(iconPath => {
    try {
      const exists = fs.existsSync(iconPath);
      console.log(`\nFile: ${iconPath}`);
      console.log(`Exists: ${exists}`);
      
      if (exists) {
        const stats = fs.statSync(iconPath);
        console.log(`Size: ${stats.size} bytes`);
        
        try {
          const img = nativeImage.createFromPath(iconPath);
          if (img.isEmpty()) {
            console.log('Status: Invalid or corrupted icon file');
          } else {
            console.log('Status: Valid icon file');
            console.log('Dimensions:', img.getSize());
            return img; // Return the first valid icon
          }
        } catch (e) {
          console.log('Error loading icon:', e.message);
        }
      }
    } catch (error) {
      console.error(`Error checking ${iconPath}:`, error.message);
    }
  });
  console.log('=== End of Icon Check ===\n');
  return null;
}

app.whenReady().then(() => {
  console.log('App starting...');
  
  // Check icon files first
  checkIconFiles();
  
  // Create the application menu
  createApplicationMenu();
  
  // Create the window (hidden by default)
  createWindow();
  
  // Create the system tray with the valid icon if available
  createSystemTray();
  
  // Set up other handlers
  setupTeamViewerHandler();
  setupAutoUpdater();
  
  // Set up auto-start on Windows
  if (PLATFORM_CONFIG.isWindows) {
    enableAutoStart().then(enabled => {
      if (!enabled) {
        console.warn('Could not configure auto-start on Windows');
      }
    });
  }
  
  // Initial update check after a short delay
  setTimeout(() => {
    checkForUpdates();
  }, 5000);
  
  console.log('App initialization complete');
}).catch(error => {
  console.error('Error during app initialization:', error);
});

// Update window and auto-start behavior to show window on startup and ensure proper auto-start configuration
async function enableAutoStart() {
  if (!PLATFORM_CONFIG.isWindows) return;
  
  try {
    const appPath = app.getPath('exe');
    const appName = 'DBS Support Desk';
    
    // Create a batch file to launch the app
    const batchContent = `@echo off
start "" "${appPath.replace(/\\/g, '\\\\')}" --minimized`;
    
    const batchPath = path.join(app.getPath('userData'), 'dbs_support_desk_startup.bat');
    fs.writeFileSync(batchPath, batchContent, 'utf8');
    
    // Add to Windows startup
    const regKey = `REG ADD "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "${batchPath.replace(/\\/g, '\\\\')}" /f`;
    require('child_process').execSync(regKey);
    
    console.log('Auto-start configured successfully');
    return true;
  } catch (error) {
    console.error('Error configuring auto-start:', error);
    return false;
  }
}
