const { ipcRenderer, clipboard } = require('electron');
const path = require('path');

// Persistent cache keys
const PERSISTENT_CACHE_KEYS = {
    STATIC_INFO: 'fns_static_system_info',
    LAST_UPDATE: 'fns_last_system_update',
    CACHE_VERSION: 'fns_cache_version'
};

// System info cache
let STATIC_SYSTEM_INFO = {
    system: null,
    platform: null,
    office: null,
    antivirus: null,
    graphics: null,
    additionalInfo: null,
    battery: null
};

let DYNAMIC_SYSTEM_INFO = {
    memory: null,
    disks: null,
    network: null,
    uptime: null,
    cpu: null
};

let cachedSystemInfo = null;
let lastSystemInfoUpdate = 0;

// Load saved form data from localStorage
function loadFormData() {
    const savedData = localStorage.getItem('supportDeskFormData');
    if (savedData) {
        try {
            const formData = JSON.parse(savedData);
            if (formData.fullName) document.getElementById('full-name').value = formData.fullName;
            if (formData.email) document.getElementById('email').value = formData.email;
            if (formData.phone) document.getElementById('phone-input').value = formData.phone;
            console.log('Loaded saved form data');
        } catch (e) {
            console.error('Error loading saved form data:', e);
        }
    }
}

// Save form data to localStorage
function saveFormData(formData) {
    try {
        const dataToSave = {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone
        };
        localStorage.setItem('supportDeskFormData', JSON.stringify(dataToSave));
        console.log('Form data saved to localStorage');
    } catch (e) {
        console.error('Error saving form data:', e);
    }
}

// Clear saved form data
function clearSavedData() {
    localStorage.removeItem('supportDeskFormData');
    document.getElementById('full-name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone-input').value = '';
    
    // Show confirmation message
    const statusElement = document.getElementById('ticket-status');
    if (statusElement) {
        const originalContent = statusElement.innerHTML;
        statusElement.innerHTML = `
            <div class="alert alert-info" style="margin-top: 10px;">
                Saved form data has been cleared.
            </div>
        `;
        
        // Restore original content after 3 seconds
        setTimeout(() => {
            statusElement.innerHTML = originalContent;
        }, 3000);
    }
}

// Add clear button functionality
function initClearButton() {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn-sm btn-outline-secondary mt-2';
    clearBtn.style.width = '100%';
    clearBtn.innerHTML = '<i class="bi bi-x-circle"></i> Clear Saved Details';
    clearBtn.onclick = clearSavedData;
    
    const formGroup = document.querySelector('.form-group:last-child');
    if (formGroup) {
        formGroup.parentNode.insertBefore(clearBtn, formGroup.nextSibling);
    }
}

// Progress indicator for ticket submission
function showSendingModal() {
    const modal = document.createElement('div');
    modal.id = 'sending-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 4000;
    `;
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); width: 90%; max-width: 400px; text-align: center;">
            <div style="margin-bottom: 20px;">
                <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            <h3 style="margin: 0 0 10px 0; color: #333;">Submitting Ticket</h3>
            <p style="margin: 0 0 15px 0; color: #666; font-size: 0.9em;">Using cached data for instant submission...</p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 0.85em; color: #666;">
                <div>• Validating form data</div>
                <div>• Using cached system information</div>
                <div>• Updating live metrics</div>
                <div>• Preparing email content</div>
                <div>• Sending to support team</div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(modal);
}

function hideSendingModal() {
    const modal = document.getElementById('sending-modal');
    if (modal) {
        try {
            document.body.removeChild(modal);
        } catch (e) {}
    }
}

// Ticket Form Submission
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    // Get form and critical elements
    const ticketForm = document.getElementById('ticket-form');
    const fullNameInput = document.getElementById('full-name');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone-input');
    const descriptionInput = document.getElementById('description');
    const ticketStatus = document.getElementById('ticket-status');
    const submitButton = ticketForm ? ticketForm.querySelector('button[type="submit"]') : null;
    
    // Load saved form data and initialize clear button
    loadFormData();
    initClearButton();

    // Log element existence
    console.log('Critical Elements Check:', {
        ticketForm: !!ticketForm,
        fullNameInput: !!fullNameInput,
        emailInput: !!emailInput,
        phoneInput: !!phoneInput,
        descriptionInput: !!descriptionInput,
        ticketStatus: !!ticketStatus,
        submitButton: !!submitButton
    });

    let isSubmitting = false;

    // --- Modal for sending status ---
    function showSendingModal() {
        let modal = document.getElementById('sending-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sending-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.3)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '2000';
            modal.innerHTML = `
                <div style="background: #fff; padding: 24px 32px; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); min-width: 300px; text-align: center;">
                    <div style="font-size: 1.2em; margin-bottom: 12px;">Sending ticket...</div>
                    <div class="progress" style="height: 18px; margin-bottom: 4px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%; background: #2ecc71; height: 100%;"></div>
                    </div>
                    <div style="font-size: 0.9em; color: #888;">Please wait</div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
    }
    function hideSendingModal() {
        const modal = document.getElementById('sending-modal');
        if (modal) modal.style.display = 'none';
    }

    // Ticket submission event listener
    const handleTicketSubmission = async (e) => {
        e.preventDefault(); // Prevent default form submission

        try {
            // Validate inputs
            showSendingModal();
            if (!fullNameInput.value.trim()) {
                throw new Error('Please enter your full name');
            }

            if (!emailInput.value.trim() || !emailInput.value.includes('@')) {
                throw new Error('Please enter a valid email address');
            }

            // Ask user if they want to enable remote support for this ticket
            function confirmRemoteSupportRequest() {
                return new Promise((resolve) => {
                    const existing = document.getElementById('remote-support-consent-modal');
                    if (existing) {
                        document.body.removeChild(existing);
                    }

                    const modal = document.createElement('div');
                    modal.id = 'remote-support-consent-modal';
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100vw';
                    modal.style.height = '100vh';
                    modal.style.background = 'rgba(0,0,0,0.3)';
                    modal.style.display = 'flex';
                    modal.style.justifyContent = 'center';
                    modal.style.alignItems = 'center';
                    modal.style.zIndex = '2500';
                    modal.innerHTML = `
                        <div style="background: #fff; padding: 18px 18px; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); width: 92%; max-width: 420px; text-align: left;">
                            <div style="font-size: 1.05em; font-weight: 600; margin-bottom: 10px;">Enable Remote Support for this ticket?</div>
                            <div style="font-size: 0.9em; color: #444; margin-bottom: 10px;">
                                Remote support via TeamViewer is attended and only used when a technician assists you.
                            </div>
                            <div style="font-size: 0.85em; color: #666; background: #f8f9fa; border: 1px solid #e9ecef; padding: 10px; border-radius: 8px; margin-bottom: 14px;">
                                <div style="margin-bottom: 8px;"><strong>Simple Steps:</strong></div>
                                <div>• TeamViewer will launch automatically when you click Yes</div>
                                <div>• Copy your TeamViewer ID (9 digits) from the TeamViewer window</div>
                                <div>• Copy your TeamViewer password from the TeamViewer window</div>
                                <div>• Paste both details into the form that will appear</div>
                                <div>• Keep TeamViewer open until the agent connects</div>
                                <div>• Do not work on confidential information during the session</div>
                            </div>
                            <div style="font-size: 0.85em; color: #856404; background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 8px; margin-bottom: 14px;">
                                <strong>Important:</strong> Do not work on confidential information while a remote session is active.
                            </div>
                            <div style="display:flex; gap:10px; justify-content:flex-end;">
                                <button id="remote-support-no" class="btn btn-outline-secondary" type="button">No</button>
                                <button id="remote-support-yes" class="btn btn-primary" type="button">Yes</button>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(modal);

                    const cleanup = () => {
                        try {
                            document.body.removeChild(modal);
                        } catch (e) {}
                    };

                    const yesBtn = document.getElementById('remote-support-yes');
                    const noBtn = document.getElementById('remote-support-no');

                    yesBtn.addEventListener('click', () => {
                        cleanup();
                        resolve(true);
                    });
                    noBtn.addEventListener('click', () => {
                        cleanup();
                        resolve(false);
                    });
                });
            }

            const remoteSupportRequested = await confirmRemoteSupportRequest();

            function showTeamViewerInputForm(resolve) {
                console.log('showTeamViewerInputForm called');
                const modal = document.createElement('div');
                modal.id = 'teamviewer-input-modal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 3000;
                `;
                modal.innerHTML = `
                    <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 90%; max-width: 450px;">
                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 1.2em;">TeamViewer Details</h3>
                        <div style="margin-bottom: 15px; color: #666; font-size: 0.9em;">
                            TeamViewer has been launched. Please copy your ID and password from TeamViewer and paste them below:
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">TeamViewer ID:</label>
                            <input id="teamviewer-id-input" type="text" placeholder="Paste TeamViewer ID here (e.g. 123 456 789)" style="width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 1em; box-sizing: border-box;">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">TeamViewer Password:</label>
                            <input id="teamviewer-password-input" type="password" placeholder="Paste TeamViewer password here" style="width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 1em; box-sizing: border-box;">
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button id="skip-teamviewer" style="padding: 10px 20px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 6px; cursor: pointer; font-size: 0.95em;">Skip</button>
                            <button id="submit-teamviewer" style="padding: 10px 20px; border: none; background: #007bff; color: white; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 500;">Submit</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                console.log('TeamViewer modal added to document');
                
                const skipBtn = document.getElementById('skip-teamviewer');
                const submitBtn = document.getElementById('submit-teamviewer');
                const idInput = document.getElementById('teamviewer-id-input');
                const passwordInput = document.getElementById('teamviewer-password-input');
                
                console.log('TeamViewer form elements found:', {
                    skipBtn: !!skipBtn,
                    submitBtn: !!submitBtn,
                    idInput: !!idInput,
                    passwordInput: !!passwordInput
                });
                
                const cleanupModal = () => {
                    try {
                        document.body.removeChild(modal);
                        console.log('TeamViewer modal cleaned up');
                    } catch (e) {
                        console.log('Error cleaning up modal:', e);
                    }
                };
                
                // Focus on ID input
                setTimeout(() => {
                    if (idInput) {
                        idInput.focus();
                        console.log('ID input focused');
                    }
                }, 100);
                
                skipBtn.addEventListener('click', () => {
                    console.log('Skip button clicked');
                    cleanupModal();
                    resolve({ id: '', password: '' });
                });
                
                submitBtn.addEventListener('click', () => {
                    console.log('Submit button clicked');
                    const id = idInput.value.trim();
                    const password = passwordInput.value.trim();
                    
                    // Format ID if needed
                    const formattedId = id.replace(/\D/g, '').replace(/(.{3})(.{3})(.{3})/, '$1 $2 $3').trim();
                    
                    console.log('TeamViewer details submitted:', { id: formattedId, password: '***' });
                    cleanupModal();
                    resolve({ id: formattedId, password: password });
                });
                
                // Allow Enter key to submit
                passwordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        submitBtn.click();
                    }
                });
                
                console.log('TeamViewer input form setup complete');
            }

            async function promptTeamViewerDetailsIfRequested() {
                if (!remoteSupportRequested) return { id: '', password: '' };

                console.log('promptTeamViewerDetailsIfRequested called, remoteSupportRequested:', remoteSupportRequested);

                // Launch TeamViewer first, then show form
                console.log('Auto-launching TeamViewer for remote support...');
                const result = await ipcRenderer.invoke('launch-teamviewer');
                console.log('TeamViewer launch result:', result);
                
                // Show form immediately regardless of launch result
                return new Promise((resolve) => {
                    console.log('Creating TeamViewer input form');
                    
                    const modal = document.createElement('div');
                    modal.id = 'teamviewer-input-modal';
                    modal.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: rgba(0,0,0,0.5);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 3000;
                    `;
                    
                    const launchStatus = result.success ? 
                        (result.installed ? 'TeamViewer has been launched successfully.' : 'TeamViewer Quick Support has been downloaded and launched.') :
                        'TeamViewer launch failed. You can still enter your details manually.';
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 90%; max-width: 450px;">
                            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 1.2em;">TeamViewer Details</h3>
                            <div style="margin-bottom: 15px; color: #666; font-size: 0.9em;">
                                ${launchStatus}
                                <br><br>
                                Please copy your ID and password from TeamViewer and paste them below:
                            </div>
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">TeamViewer ID:</label>
                                <input id="teamviewer-id-input" type="text" placeholder="Paste TeamViewer ID here (e.g. 123 456 789)" style="width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 1em; box-sizing: border-box;">
                            </div>
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">TeamViewer Password:</label>
                                <input id="teamviewer-password-input" type="password" placeholder="Paste TeamViewer password here" style="width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 1em; box-sizing: border-box;">
                            </div>
                            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                <button id="skip-teamviewer" style="padding: 10px 20px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 6px; cursor: pointer; font-size: 0.95em;">Skip</button>
                                <button id="submit-teamviewer" style="padding: 10px 20px; border: none; background: #007bff; color: white; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 500;">Submit</button>
                            </div>
                        </div>
                    `;
                    
                    document.body.appendChild(modal);
                    console.log('TeamViewer modal added to document');
                    
                    const skipBtn = document.getElementById('skip-teamviewer');
                    const submitBtn = document.getElementById('submit-teamviewer');
                    const idInput = document.getElementById('teamviewer-id-input');
                    const passwordInput = document.getElementById('teamviewer-password-input');
                    
                    console.log('TeamViewer form elements found:', {
                        skipBtn: !!skipBtn,
                        submitBtn: !!submitBtn,
                        idInput: !!idInput,
                        passwordInput: !!passwordInput
                    });
                    
                    const cleanupModal = () => {
                        try {
                            document.body.removeChild(modal);
                            console.log('TeamViewer modal cleaned up');
                        } catch (e) {
                            console.log('Error cleaning up modal:', e);
                        }
                    };
                    
                    // Focus on ID input
                    setTimeout(() => {
                        if (idInput) {
                            idInput.focus();
                            console.log('ID input focused');
                        }
                    }, 100);
                    
                    skipBtn.addEventListener('click', () => {
                        console.log('Skip button clicked');
                        cleanupModal();
                        resolve({ id: '', password: '' });
                    });
                    
                    submitBtn.addEventListener('click', () => {
                        console.log('Submit button clicked');
                        const id = idInput.value.trim();
                        const password = passwordInput.value.trim();
                        
                        // Format ID if needed
                        const formattedId = id.replace(/\D/g, '').replace(/(.{3})(.{3})(.{3})/, '$1 $2 $3').trim();
                        
                        console.log('TeamViewer details submitted:', { id: formattedId, password: '***' });
                        cleanupModal();
                        resolve({ id: formattedId, password: password });
                    });
                    
                    // Allow Enter key to submit
                    passwordInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            submitBtn.click();
                        }
                    });
                    
                    console.log('TeamViewer input form setup complete');
                });
            }

            const teamViewerDetails = await promptTeamViewerDetailsIfRequested();

            // Show progress indicator for ticket submission
            showSendingModal();

            // Prepare ticket data
            const ticketData = {
                fullName: fullNameInput.value.trim(),
                subject: document.getElementById('subject').value.trim(),
                email: emailInput.value.trim(),
                phone: phoneInput.value.trim() || 'Not Provided',
                description: descriptionInput.value.trim(),
                remoteSupport: {
                    requested: remoteSupportRequested,
                    teamViewerId: teamViewerDetails.id,
                    teamViewerPassword: teamViewerDetails.password,
                    teamViewerLaunched: teamViewerDetails.id !== '' || remoteSupportRequested
                },
                systemInfo: await getSystemInfoForTicket() // Use cached data for faster submission
            };

            console.log('Ticket Submission Data:', ticketData);

            // Send ticket via IPC
            const result = await ipcRenderer.invoke('send-ticket', ticketData);

            console.log('Ticket submission result:', result);

            if (result.success) {
                // Save the form data for future use
                saveFormData(ticketData);
                
                hideSendingModal();
                // Confirmation popup
                showTicketConfirmation();
                if (ticketStatus) {
                    ticketStatus.innerHTML = `
                        <div style="color: green; border: 1px solid green; padding: 10px;">
                            <strong>Ticket Submitted Successfully!</strong>
<p>DBS Technology support agent will review your request and revert shortly.</p>
                        </div>`;
                }
                // Reset form but keep the saved data
                ticketForm.reset();
                loadFormData(); // Reload the saved data
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
            } else if (result.savedLocally) {
                // Email failed but ticket saved locally
                hideSendingModal();
                if (ticketStatus) {
                    ticketStatus.innerHTML = `
                        <div style="color: #ff6b35; border: 1px solid #ff6b35; padding: 10px;">
                            <strong>Email Service Unavailable</strong>
<p>Your ticket has been saved locally and will be sent automatically when the email service is available.</p>
<p>Ticket ID: ${new Date().getTime()}</p>
                        </div>`;
                }
                // Reset form but keep the saved data
                ticketForm.reset();
                loadFormData(); // Reload the saved data
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
            } else {
                throw new Error(result.error || 'Unable to submit ticket');
            }
        } catch (error) {
            hideSendingModal();
            console.error('Ticket submission error:', error);
            if (ticketStatus) {
                ticketStatus.innerHTML = `
                    <div style="color: red; border: 1px solid red; padding: 10px;">
                        <strong>Error:</strong> ${error.message}
                    </div>`;
            }
            isSubmitting = false;
            if (submitButton) submitButton.disabled = false;
        }
    };

    // Add event listener to form (once, robust)
    if (ticketForm) {
        ticketForm.addEventListener('submit', handleTicketSubmission);
    } else {
        console.error('Ticket form not found');
    }
});

// Phone Number Formatting Function
function formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if the number is 10 digits long and starts with 0
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
        // Explicitly format as (082) 564-0943
        return `(0${cleaned.slice(1, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    // If the number doesn't match expected format, return original input
    return phoneNumber;
}

// Phone number input element
const phoneInput = document.getElementById('phone-input');

// Add event listener for real-time formatting
phoneInput.addEventListener('input', (e) => {
    console.log('Phone Input Debug:', {
        phoneInputElement: phoneInput,
        phoneInputValue: phoneInput.value,
        phoneInputValueTrimmed: phoneInput.value.trim(),
        phoneInputType: typeof phoneInput.value,
        phoneInputLength: phoneInput.value.length
    });

    // Store current cursor position
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;

    // Format the input
    e.target.value = formatPhoneNumber(e.target.value);

    // Restore cursor position
    e.target.setSelectionRange(start, end);
});

// TeamViewer Button
const teamviewerBtn = document.getElementById('teamviewer-btn');
const teamviewerStatus = document.getElementById('teamviewer-status');

let isProcessing = false; // Flag to prevent multiple simultaneous calls

// TeamViewer Status Confirmation
function showTeamViewerStatus(message, type = 'success') {
    // Remove any existing status messages
    const existingStatus = document.getElementById('teamviewer-status-modal');
    if (existingStatus) {
        document.body.removeChild(existingStatus);
    }

    // Create status container
    const statusContainer = document.createElement('div');
    statusContainer.id = 'teamviewer-status-modal';
    statusContainer.className = `ticket-confirmation alert alert-${type} text-center`;
    
    // Determine icon and message based on type
    const icon = type === 'success' ? '✅' : '❌';
    
    statusContainer.innerHTML = `
        <strong>${icon} TeamViewer Status</strong>
        <p>${message}</p>
        <button id="teamviewer-status-ok" class="btn btn-primary mt-2">OK</button>
    `;
    
    // Style the status message (same as ticket confirmation)
    statusContainer.style.position = 'fixed';
    statusContainer.style.top = '50%';
    statusContainer.style.left = '50%';
    statusContainer.style.transform = 'translate(-50%, -50%)';
    statusContainer.style.zIndex = '1000';
    statusContainer.style.width = '90%';
    statusContainer.style.maxWidth = '400px';
    statusContainer.style.padding = '20px';
    statusContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    
    // Add to document body
    document.body.appendChild(statusContainer);
    
    // Add event listener for OK button
    const okButton = document.getElementById('teamviewer-status-ok');
    okButton.addEventListener('click', () => {
        document.body.removeChild(statusContainer);
    });
}

if (teamviewerBtn) {
    teamviewerBtn.addEventListener('click', async () => {
        // Prevent multiple simultaneous clicks
        if (isProcessing) {
            console.log('TeamViewer process already in progress');
            return;
        }

        try {
            // Set processing flag
            isProcessing = true;

            // Disable button
            teamviewerBtn.disabled = true;

            // Invoke TeamViewer launch/download
            const result = await ipcRenderer.invoke('launch-teamviewer');
            console.log('TeamViewer launch result:', result);

            if (result.success) {
                if (result.installed) {
                    // TeamViewer was already installed and launched
                    showTeamViewerStatus('TeamViewer launched successfully');
                } else {
                    // TeamViewer Quick Support downloaded and launched
                    showTeamViewerStatus('TeamViewer Quick Support downloaded and installed');
                }
            } else {
                // Error during launch/download
                console.error('TeamViewer launch error:', result.error);
                showTeamViewerStatus(result.error || 'Failed to launch TeamViewer', 'danger');
            }
        } catch (error) {
            // Unexpected error
            console.error('Unexpected TeamViewer launch error:', error);
            showTeamViewerStatus('Unexpected error occurred', 'danger');
        } finally {
            // Re-enable button and reset processing flag
            teamviewerBtn.disabled = false;
            isProcessing = false;
        }
    });
}

// Cached system info for faster ticket submission
const SYSTEM_INFO_CACHE_DURATION = 300000; // 5 minutes cache for static info

// Function to capture static system info once on app load
async function captureStaticSystemInfo() {
    console.log('Capturing static system information...');
    try {
        // For first load, get comprehensive system info (this is the only time we do heavy scan)
        // After this, everything uses cache
        const systemInfo = await ipcRenderer.invoke('get-system-info');
        
        // Store static info that rarely changes
        STATIC_SYSTEM_INFO.system = systemInfo.system;
        STATIC_SYSTEM_INFO.platform = systemInfo.platform;
        STATIC_SYSTEM_INFO.office = systemInfo.office;
        STATIC_SYSTEM_INFO.antivirus = systemInfo.antivirus;
        STATIC_SYSTEM_INFO.graphics = systemInfo.graphics;
        STATIC_SYSTEM_INFO.additionalInfo = systemInfo.additionalInfo;
        
        // Store initial dynamic info
        DYNAMIC_SYSTEM_INFO.cpu = systemInfo.cpu;
        DYNAMIC_SYSTEM_INFO.memory = systemInfo.memory;
        DYNAMIC_SYSTEM_INFO.disks = systemInfo.disks;
        DYNAMIC_SYSTEM_INFO.network = systemInfo.network;
        DYNAMIC_SYSTEM_INFO.uptime = systemInfo.uptime;
        STATIC_SYSTEM_INFO.battery = systemInfo.battery; // Battery can change, so treat as dynamic
        
        // Create complete cached system info
        cachedSystemInfo = { ...STATIC_SYSTEM_INFO, ...DYNAMIC_SYSTEM_INFO };
        lastSystemInfoUpdate = Date.now();
        
        // Save static info to persistent cache for future loads
        savePersistentCache();
        
        console.log('Static system info captured successfully');
        return true;
    } catch (error) {
        console.error('Error capturing static system info:', error);
        return false;
    }
}

// Function to update dynamic system info from live metrics
function updateDynamicSystemInfo() {
    try {
        // Update dynamic parts from live performance metrics
        const diskProgressBar = document.getElementById('disk-progress');
        const diskText = document.getElementById('disk-text');
        const memoryProgressBar = document.getElementById('memory-progress');
        const memoryText = document.getElementById('memory-text');
        const cpuProgressBar = document.getElementById('cpu-progress');
        const cpuText = document.getElementById('cpu-text');
        
        // Extract values from live UI (since they're already being updated)
        if (diskText && memoryText && cpuText) {
            // Parse disk usage from UI
            const diskMatch = diskText.textContent.match(/(\d+)%/);
            const diskUsage = diskMatch ? parseInt(diskMatch[1]) : 0;
            
            // Parse memory usage from UI
            const memoryMatch = memoryText.textContent.match(/(\d+)%/);
            const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
            
            // Parse CPU usage from UI
            const cpuMatch = cpuText.textContent.match(/(\d+)%/);
            const cpuUsage = cpuMatch ? parseInt(cpuMatch[1]) : 0;
            
            // Update dynamic system info
            DYNAMIC_SYSTEM_INFO.cpu = { currentLoad: cpuUsage };
            DYNAMIC_SYSTEM_INFO.memory = { 
                used: (memoryUsage / 100) * (DYNAMIC_SYSTEM_INFO.memory?.total || 16000000000), 
                total: DYNAMIC_SYSTEM_INFO.memory?.total || 16000000000 
            };
            
            // Update disk info (use first disk)
            if (cachedSystemInfo && cachedSystemInfo.disks && cachedSystemInfo.disks[0]) {
                const totalGB = cachedSystemInfo.disks[0].total / (1024 * 1024 * 1024);
                const usedGB = (diskUsage / 100) * totalGB;
                DYNAMIC_SYSTEM_INFO.disks[0] = {
                    ...cachedSystemInfo.disks[0],
                    used: usedGB * (1024 * 1024 * 1024),
                    usagePercent: diskUsage
                };
            }
            
            // Update cached system info with latest dynamic data
            // Preserve uptime and network from original cache if they exist
            const originalUptime = cachedSystemInfo?.uptime || DYNAMIC_SYSTEM_INFO.uptime;
            const originalNetwork = cachedSystemInfo?.network || DYNAMIC_SYSTEM_INFO.network;
            
            cachedSystemInfo = { 
                ...STATIC_SYSTEM_INFO, 
                ...DYNAMIC_SYSTEM_INFO,
                uptime: originalUptime,
                network: originalNetwork
            };
            lastSystemInfoUpdate = Date.now();
            
            console.log('Dynamic system info updated from live metrics');
        }
    } catch (error) {
        console.error('Error updating dynamic system info:', error);
    }
}

// Function to get system info (optimized for instant ticket submission)
async function getSystemInfoForTicket() {
    console.log('Getting system info for ticket submission...');
    
    // If we have cached data, return it immediately
    if (cachedSystemInfo) {
        console.log('Using cached system info for instant ticket submission');
        
        // Update dynamic info from live UI for latest values (non-blocking)
        try {
            updateDynamicSystemInfo();
        } catch (error) {
            console.log('Could not update dynamic info, using cached data');
        }
        
        return cachedSystemInfo;
    }
    
    // If no cached data, create minimal system info from UI and submit immediately
    console.log('No cached data available, creating minimal system info from UI');
    
    const minimalSystemInfo = {
        system: STATIC_SYSTEM_INFO.system || { manufacturer: 'Unknown', model: 'Unknown', serial: 'Unknown', uuid: 'Unknown' },
        platform: STATIC_SYSTEM_INFO.platform || 'Unknown Platform',
        office: STATIC_SYSTEM_INFO.office || { found: false, products: [] },
        antivirus: STATIC_SYSTEM_INFO.antivirus || { found: false, products: [] },
        graphics: STATIC_SYSTEM_INFO.graphics || [],
        battery: STATIC_SYSTEM_INFO.battery || { percentage: 'Unknown', charging: false, powerPlan: 'Unknown' },
        additionalInfo: STATIC_SYSTEM_INFO.additionalInfo || { bios: { vendor: 'Unknown', version: 'Unknown', releaseDate: 'Unknown' }, temperatures: { cpu: 'N/A', cores: 'N/A' }, display: [] },
        
        // Get dynamic info from UI
        cpu: { currentLoad: 0 },
        memory: { used: 0, total: 0 },
        disks: [{ usagePercent: 0, used: 0, total: 0 }],
        network: { adapters: [] },
        uptime: 'Unknown'
    };
    
    // Try to get current values from UI
    try {
        const diskText = document.getElementById('disk-text');
        const memoryText = document.getElementById('memory-text');
        const cpuText = document.getElementById('cpu-text');
        
        if (diskText && diskText.textContent.includes('%')) {
            const diskMatch = diskText.textContent.match(/(\d+)%/);
            if (diskMatch) {
                minimalSystemInfo.disks[0].usagePercent = parseInt(diskMatch[1]);
            }
        }
        
        if (memoryText && memoryText.textContent.includes('%')) {
            const memoryMatch = memoryText.textContent.match(/(\d+)%/);
            if (memoryMatch) {
                const memoryUsage = parseInt(memoryMatch[1]);
                minimalSystemInfo.memory.used = (memoryUsage / 100) * 16000000000; // Assume 16GB total
                minimalSystemInfo.memory.total = 16000000000;
            }
        }
        
        if (cpuText && cpuText.textContent.includes('%')) {
            const cpuMatch = cpuText.textContent.match(/(\d+)%/);
            if (cpuMatch) {
                minimalSystemInfo.cpu.currentLoad = parseInt(cpuMatch[1]);
            }
        }
    } catch (error) {
        console.log('Could not get values from UI, using defaults');
    }
    
    console.log('Created minimal system info for instant submission');
    return minimalSystemInfo;
}

// Load persistent cache from localStorage
function loadPersistentCache() {
    try {
        const cachedData = localStorage.getItem(PERSISTENT_CACHE_KEYS.STATIC_INFO);
        const lastUpdate = localStorage.getItem(PERSISTENT_CACHE_KEYS.LAST_UPDATE);
        const cacheVersion = localStorage.getItem(PERSISTENT_CACHE_KEYS.CACHE_VERSION);
        
        if (cachedData && lastUpdate && cacheVersion === '1.0') {
            const staticInfo = JSON.parse(cachedData);
            const updateAge = Date.now() - parseInt(lastUpdate);
            
            // Cache is valid for 7 days (604800000 ms)
            if (updateAge < 604800000) {
                console.log('Loading static system info from persistent cache');
                STATIC_SYSTEM_INFO.system = staticInfo.system;
                STATIC_SYSTEM_INFO.platform = staticInfo.platform;
                STATIC_SYSTEM_INFO.office = staticInfo.office;
                STATIC_SYSTEM_INFO.antivirus = staticInfo.antivirus;
                STATIC_SYSTEM_INFO.graphics = staticInfo.graphics;
                STATIC_SYSTEM_INFO.additionalInfo = staticInfo.additionalInfo;
                STATIC_SYSTEM_INFO.battery = staticInfo.battery;
                
                // Get fresh dynamic data (uptime and network change frequently)
                getFreshDynamicData();
                
                // Create initial cached system info
                cachedSystemInfo = { ...STATIC_SYSTEM_INFO, ...DYNAMIC_SYSTEM_INFO };
                lastSystemInfoUpdate = Date.now();
                
                return true;
            } else {
                console.log('Persistent cache expired, will refresh');
                localStorage.removeItem(PERSISTENT_CACHE_KEYS.STATIC_INFO);
                localStorage.removeItem(PERSISTENT_CACHE_KEYS.LAST_UPDATE);
            }
        }
    } catch (error) {
        console.error('Error loading persistent cache:', error);
    }
    return false;
}

// Function to get fresh dynamic data (uptime and network)
async function getFreshDynamicData() {
    try {
        // Get lightweight performance info which includes current data
        const systemInfo = await ipcRenderer.invoke('get-performance-info');
        
        // Update dynamic info with fresh data
        DYNAMIC_SYSTEM_INFO.cpu = systemInfo.cpu;
        DYNAMIC_SYSTEM_INFO.memory = systemInfo.memory;
        DYNAMIC_SYSTEM_INFO.disks = systemInfo.disks;
        
        // Get comprehensive system info for uptime and network (only if needed)
        try {
            const fullSystemInfo = await ipcRenderer.invoke('get-system-info');
            DYNAMIC_SYSTEM_INFO.uptime = fullSystemInfo.uptime;
            DYNAMIC_SYSTEM_INFO.network = fullSystemInfo.network;
        } catch (error) {
            console.log('Could not get uptime/network, using defaults');
            DYNAMIC_SYSTEM_INFO.uptime = 'Unknown';
            DYNAMIC_SYSTEM_INFO.network = { adapters: [] };
        }
        
        console.log('Fresh dynamic data retrieved');
    } catch (error) {
        console.error('Error getting fresh dynamic data:', error);
    }
}

// Save static info to persistent cache
function savePersistentCache() {
    try {
        const staticData = {
            system: STATIC_SYSTEM_INFO.system,
            platform: STATIC_SYSTEM_INFO.platform,
            office: STATIC_SYSTEM_INFO.office,
            antivirus: STATIC_SYSTEM_INFO.antivirus,
            graphics: STATIC_SYSTEM_INFO.graphics,
            additionalInfo: STATIC_SYSTEM_INFO.additionalInfo,
            battery: STATIC_SYSTEM_INFO.battery
        };
        
        localStorage.setItem(PERSISTENT_CACHE_KEYS.STATIC_INFO, JSON.stringify(staticData));
        localStorage.setItem(PERSISTENT_CACHE_KEYS.LAST_UPDATE, Date.now().toString());
        localStorage.setItem(PERSISTENT_CACHE_KEYS.CACHE_VERSION, '1.0');
        
        console.log('Static system info saved to persistent cache');
    } catch (error) {
        console.error('Error saving persistent cache:', error);
    }
}

// Ensure progress bars are initialized on page load
document.addEventListener('DOMContentLoaded', () => {
    ['disk', 'memory', 'cpu'].forEach(metric => {
        const progressBar = document.getElementById(`${metric}-progress`);
        const textElement = document.getElementById(`${metric}-text`);
        if (progressBar && textElement) {
            progressBar.style.width = '0%';
            progressBar.className = 'progress-bar bg-secondary';
            textElement.textContent = 'Initializing...';
        }
    });

    // Load persistent cache first
    loadPersistentCache();

    // Get quick performance metrics immediately (fast display)
    getQuickPerformanceMetrics();

    // Update metrics every 30 seconds with lightweight scan (for live updates)
    setInterval(async () => {
        try {
            const systemInfo = await ipcRenderer.invoke('get-performance-info');
            updatePerformanceUI(systemInfo);
        } catch (error) {
            console.error('Error updating performance metrics:', error);
        }
    }, 30000); // Every 30 seconds

    // Capture static system info after initial metrics display (only if no cache)
    setTimeout(() => {
        if (!cachedSystemInfo || !cachedSystemInfo.system) {
            captureStaticSystemInfo();
        }
    }, 3000); // Wait 3 seconds for initial metrics to load
});

// Lightweight function for initial performance metrics display (fast)
async function getQuickPerformanceMetrics() {
    try {
        console.log('Getting quick performance metrics for initial display...');
        
        // If we have cached data, use it immediately
        if (cachedSystemInfo && cachedSystemInfo.memory && cachedSystemInfo.disks) {
            console.log('Using cached data for quick performance display');
            updatePerformanceUI(cachedSystemInfo);
            return;
        }
        
        // If no cache, show placeholder data immediately and start background scan
        console.log('No cached data available, showing placeholder and starting background scan');
        showPlaceholderPerformanceData();
        
        // Start background scan to get real data (non-blocking)
        setTimeout(async () => {
            try {
                const systemInfo = await ipcRenderer.invoke('get-performance-info');
                
                // Initialize dynamic system info
                DYNAMIC_SYSTEM_INFO.memory = systemInfo.memory;
                DYNAMIC_SYSTEM_INFO.disks = systemInfo.disks;
                DYNAMIC_SYSTEM_INFO.cpu = systemInfo.cpu;
                
                // Update cached system info
                cachedSystemInfo = { ...STATIC_SYSTEM_INFO, ...DYNAMIC_SYSTEM_INFO };
                lastSystemInfoUpdate = Date.now();
                
                // Update UI with real data
                updatePerformanceUI(systemInfo);
                
                console.log('Background performance scan completed and UI updated');
            } catch (error) {
                console.error('Error in background performance scan:', error);
            }
        }, 1000); // Start after 1 second
        
    } catch (error) {
        console.error('Error getting quick performance metrics:', error);
        
        // Fallback to show error state
        ['disk', 'memory', 'cpu'].forEach(metric => {
            const progressBar = document.getElementById(`${metric}-progress`);
            const textElement = document.getElementById(`${metric}-text`);
            if (progressBar && textElement) {
                progressBar.style.width = '0%';
                progressBar.className = 'progress-bar bg-danger';
                textElement.textContent = 'Error retrieving data';
            }
        });
    }
}

// Show placeholder data while background scan runs
function showPlaceholderPerformanceData() {
    console.log('Showing placeholder performance data');
    
    // Show loading state with estimated values
    const placeholderData = {
        disks: [{ usagePercent: 50, used: 500000000000, total: 1000000000000 }],
        memory: { used: 8000000000, total: 16000000000 },
        cpu: { currentLoad: 25 }
    };
    
    updatePerformanceUI(placeholderData);
    
    // Update text to show "Loading..." status
    ['disk', 'memory', 'cpu'].forEach(metric => {
        const textElement = document.getElementById(`${metric}-text`);
        if (textElement) {
            textElement.textContent = 'Loading...';
        }
    });
}

// Helper function to update performance UI
function updatePerformanceUI(systemInfo) {
    // Disk Space
    const diskUsage = systemInfo.disks && systemInfo.disks[0] || { total: 1, used: 0, usagePercent: 0 };
    const diskUsedPercentage = Math.round(diskUsage.usagePercent || 0);
    const diskProgressBar = document.getElementById('disk-progress');
    const diskText = document.getElementById('disk-text');
    
    if (diskProgressBar && diskText) {
        diskProgressBar.style.width = `${diskUsedPercentage}%`;
        diskProgressBar.className = `progress-bar ${
            diskUsedPercentage < 50 ? 'bg-success' : 
            diskUsedPercentage < 70 ? 'bg-warning' : 'bg-danger'
        }`;
        
        const usedGB = (diskUsage.used || 0) / (1024 * 1024 * 1024);
        const totalGB = (diskUsage.total || 1) / (1024 * 1024 * 1024);
        diskText.textContent = `${diskUsedPercentage}% (${usedGB.toFixed(2)}GB / ${totalGB.toFixed(2)}GB)`;
    }

    // Memory
    const memoryUsage = systemInfo.memory;
    const memoryUsedPercentage = Math.round((memoryUsage.used / memoryUsage.total) * 100);
    const memoryProgressBar = document.getElementById('memory-progress');
    const memoryText = document.getElementById('memory-text');
    
    if (memoryProgressBar && memoryText) {
        memoryProgressBar.style.width = `${memoryUsedPercentage}%`;
        memoryProgressBar.className = `progress-bar ${
            memoryUsedPercentage < 50 ? 'bg-success' : 
            memoryUsedPercentage < 70 ? 'bg-warning' : 'bg-danger'
        }`;
        memoryText.textContent = `${memoryUsedPercentage}% (${(memoryUsage.used / (1024 * 1024 * 1024)).toFixed(2)}GB / ${(memoryUsage.total / (1024 * 1024 * 1024)).toFixed(2)}GB)`;
    }

    // CPU
    const cpuUsage = systemInfo.cpu.currentLoad;
    const cpuProgressBar = document.getElementById('cpu-progress');
    const cpuText = document.getElementById('cpu-text');
    
    if (cpuProgressBar && cpuText) {
        cpuProgressBar.style.width = `${cpuUsage}%`;
        cpuProgressBar.className = `progress-bar ${
            cpuUsage < 50 ? 'bg-success' : 
            cpuUsage < 70 ? 'bg-warning' : 'bg-danger'
        }`;
        cpuText.textContent = `${Math.round(cpuUsage)}%`;
    }
}

// Original updateSystemPerformanceMetrics function (for comprehensive updates)
async function updateSystemPerformanceMetrics() {
    try {
        const systemInfo = await ipcRenderer.invoke('get-performance-info');
        
        // Initialize dynamic system info if not already set
        if (!DYNAMIC_SYSTEM_INFO.memory || !DYNAMIC_SYSTEM_INFO.memory.total) {
            DYNAMIC_SYSTEM_INFO.memory = systemInfo.memory;
            DYNAMIC_SYSTEM_INFO.disks = systemInfo.disks;
            DYNAMIC_SYSTEM_INFO.cpu = systemInfo.cpu;
        }
        
        // Disk Space
        const diskUsage = systemInfo.disks && systemInfo.disks[0] || { total: 1, used: 0, usagePercent: 0 };
        const diskUsedPercentage = Math.round(diskUsage.usagePercent || 0);
        const diskProgressBar = document.getElementById('disk-progress');
        const diskText = document.getElementById('disk-text');
        
        // Ensure the progress bar width matches the actual usage percentage
        diskProgressBar.style.width = `${diskUsedPercentage}%`;
        diskProgressBar.className = `progress-bar ${
            diskUsedPercentage < 50 ? 'bg-success' : 
            diskUsedPercentage < 70 ? 'bg-warning' : 'bg-danger'
        }`;
        
        // Display the actual values
        const usedGB = (diskUsage.used || 0) / (1024 * 1024 * 1024);
        const totalGB = (diskUsage.total || 1) / (1024 * 1024 * 1024);
        diskText.textContent = `${diskUsedPercentage}% (${usedGB.toFixed(2)}GB / ${totalGB.toFixed(2)}GB)`;

        // Memory
        const memoryUsage = systemInfo.memory;
        const memoryUsedPercentage = Math.round((memoryUsage.used / memoryUsage.total) * 100);
        const memoryProgressBar = document.getElementById('memory-progress');
        const memoryText = document.getElementById('memory-text');
        memoryProgressBar.style.width = `${memoryUsedPercentage}%`;
        memoryProgressBar.className = `progress-bar ${
            memoryUsedPercentage < 50 ? 'bg-success' : 
            memoryUsedPercentage < 70 ? 'bg-warning' : 'bg-danger'
        }`;
        memoryText.textContent = `${memoryUsedPercentage}% (${(memoryUsage.used / (1024 * 1024 * 1024)).toFixed(2)}GB / ${(memoryUsage.total / (1024 * 1024 * 1024)).toFixed(2)}GB)`;

        // CPU
        const cpuUsage = systemInfo.cpu.currentLoad;
        const cpuProgressBar = document.getElementById('cpu-progress');
        const cpuText = document.getElementById('cpu-text');
        cpuProgressBar.style.width = `${cpuUsage}%`;
        cpuProgressBar.className = `progress-bar ${
            cpuUsage < 50 ? 'bg-success' : 
            cpuUsage < 70 ? 'bg-warning' : 'bg-danger'
        }`;
        cpuText.textContent = `${Math.round(cpuUsage)}%`;
    } catch (error) {
        console.error('Error updating system performance metrics:', error);
        
        // Fallback to show error state
        ['disk', 'memory', 'cpu'].forEach(metric => {
            const progressBar = document.getElementById(`${metric}-progress`);
            const textElement = document.getElementById(`${metric}-text`);
            if (progressBar && textElement) {
                progressBar.style.width = '0%';
                progressBar.className = 'progress-bar bg-danger';
                textElement.textContent = 'Error retrieving data';
            }
        });
    }
}

// Add performance monitoring to system metrics update
const originalUpdateMetrics = updateSystemPerformanceMetrics;
updateSystemPerformanceMetrics = async function() {
    performance.mark('metricsUpdateStart');
    await originalUpdateMetrics();
    performance.mark('metricsUpdateEnd');
    performance.measure('Metrics Update', 'metricsUpdateStart', 'metricsUpdateEnd');
    
    // Update dynamic system info from live metrics
    updateDynamicSystemInfo();
    
    monitorWidgetPerformance();
}

// Capture static system info after initial metrics display (already called in DOMContentLoaded)
// This function is called from the main DOMContentLoaded event after 3 seconds

// Ticket Submission Confirmation
function showTicketConfirmation() {
    // Create confirmation container
    const confirmationContainer = document.createElement('div');
    confirmationContainer.className = 'ticket-confirmation alert alert-success text-center';
    confirmationContainer.innerHTML = `
        <strong>Ticket Submitted Successfully!</strong>
        <p>Your ticket has been submitted to DBS Technology. Our team will review it shortly. Thank you for reaching out!</p>
        <button id="ticket-confirmation-ok" class="btn btn-primary mt-2">OK</button>
    `;
    
    // Style the confirmation message
    confirmationContainer.style.position = 'fixed';
    confirmationContainer.style.top = '50%';
    confirmationContainer.style.left = '50%';
    confirmationContainer.style.transform = 'translate(-50%, -50%)';
    confirmationContainer.style.zIndex = '1000';
    confirmationContainer.style.width = '90%';
    confirmationContainer.style.maxWidth = '400px';
    confirmationContainer.style.padding = '20px';
    confirmationContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    
    // Add to document body
    document.body.appendChild(confirmationContainer);
    
    // Add event listener for OK button
    const okButton = document.getElementById('ticket-confirmation-ok');
    okButton.addEventListener('click', () => {
        document.body.removeChild(confirmationContainer);
    });
}

// Update status element
const updateStatus = document.getElementById('update-status');

// Display app version
function displayAppVersion() {
  const versionElement = document.getElementById('version-display');
  if (versionElement) {
    // Get version from package.json (set in main.js)
    const version = window.appVersion || '1.0.5';
    
    // Clear any existing content and styles
    versionElement.innerHTML = '';
    versionElement.removeAttribute('style');
    
    // Style the container
    versionElement.style.position = 'fixed';
    versionElement.style.bottom = '10px';
    versionElement.style.left = '10px';
    versionElement.style.zIndex = '1000';
    versionElement.style.pointerEvents = 'none';
    
    // Create and style the version text
    const versionText = document.createElement('span');
    versionText.textContent = `v${version}`;
    versionText.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      color: #2c3e50;
      background: rgba(255, 255, 255, 0.8);
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid #e0e0e0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;
    
    // Add the text to the container
    versionElement.appendChild(versionText);
    
    // Ensure it's in the DOM
    if (!versionElement.parentNode) {
      document.body.appendChild(versionElement);
    }
  } else {
    console.error('Version display element not found');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait a moment for the main process to set the version
  setTimeout(() => {
    displayAppVersion();
  }, 100);
  
  initUpdateNotification();
  
  // Check for updates after a short delay
  setTimeout(() => {
    ipcRenderer.send('check-for-updates');
  }, 2000);
});

// Initialize update notification element
function initUpdateNotification() {
  // Remove any existing update notification
  const existing = document.getElementById('update-notification');
  if (existing) existing.remove();
  
  // Create new notification
  const notification = document.createElement('div');
  notification.id = 'update-notification';
  notification.style.cssText = `
    display: none;
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #2c3e50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    max-width: 300px;
    font-family: 'Segoe UI', Arial, sans-serif;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 id="update-title" style="margin: 0; color: #3498db; font-size: 16px;">Update Available</h3>
      <button id="close-update" style="background: none; border: none; color: #ecf0f1; cursor: pointer; font-size: 16px;">×</button>
    </div>
    <div id="update-progress" style="display: none; margin: 10px 0;">
      <div style="background: #2c3e50; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 5px;">
        <div id="update-progress-bar" style="background: #3498db; height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <div id="update-status-text" style="font-size: 12px; color: #bdc3c7;">Preparing download...</div>
    </div>
    <div id="update-actions" style="display: flex; gap: 8px; margin-top: 10px;">
      <button id="update-action-btn" style="flex: 1; background: #3498db; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Download</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Add event listeners
  document.getElementById('close-update').addEventListener('click', () => {
    notification.style.display = 'none';
  });
  
  document.getElementById('update-action-btn').addEventListener('click', () => {
    ipcRenderer.invoke('download-and-install-update').catch(error => {
      showUpdateError(error.message || 'Failed to start download');
    });
  });
  
  return notification;
}

// Show update notification with specific state
function showUpdateNotification(state, options = {}) {
  const notification = document.getElementById('update-notification') || initUpdateNotification();
  const title = document.getElementById('update-title');
  const progress = document.getElementById('update-progress');
  const progressBar = document.getElementById('update-progress-bar');
  const statusText = document.getElementById('update-status-text');
  const actionBtn = document.getElementById('update-action-btn');
  
  switch (state) {
    case 'available':
      title.textContent = `Update v${options.version} Available`;
      statusText.textContent = 'A new version is available for download.';
      actionBtn.textContent = 'Download Update';
      actionBtn.style.display = 'block';
      progress.style.display = 'none';
      notification.style.display = 'block';
      break;
      
    case 'downloading':
      title.textContent = 'Downloading Update...';
      progress.style.display = 'block';
      actionBtn.style.display = 'none';
      notification.style.display = 'block';
      break;
      
    case 'downloaded':
      title.textContent = 'Update Ready';
      statusText.textContent = 'The update has been downloaded.';
      actionBtn.textContent = 'Restart & Install';
      actionBtn.style.display = 'block';
      notification.style.display = 'block';
      break;
      
    case 'error':
      title.textContent = 'Update Error';
      statusText.textContent = options.message || 'An error occurred during update.';
      actionBtn.textContent = 'Retry';
      actionBtn.style.display = 'block';
      notification.style.display = 'block';
      break;
  }
  
  // Update progress if provided
  if (options.progress !== undefined) {
    const percent = Math.floor(options.progress);
    progressBar.style.width = `${percent}%`;
    
    if (options.bytesPerSecond) {
      const speed = Math.round(options.bytesPerSecond / 1024);
      const downloaded = Math.round(options.transferred / 1024 / 1024 * 100) / 100;
      const total = Math.round(options.total / 1024 / 1024 * 100) / 100;
      statusText.textContent = `Downloading: ${percent}% (${downloaded}MB of ${total}MB) at ${speed}KB/s`;
    } else if (state === 'downloading') {
      statusText.textContent = `Downloading: ${percent}%`;
    }
  }
}

// IPC event handlers
ipcRenderer.on('update-available', (event, info) => {
  showUpdateNotification('available', { version: info.version });
});

ipcRenderer.on('download-progress', (event, progressObj) => {
  showUpdateNotification('downloading', {
    progress: progressObj.percent || 0,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

ipcRenderer.on('update-downloaded', () => {
  showUpdateNotification('downloaded');
});

ipcRenderer.on('update-error', (event, message) => {
  showUpdateNotification('error', { message });
});

ipcRenderer.on('update-not-available', () => {
  // Optionally show a small toast that you're up to date
  const notification = document.getElementById('update-notification');
  if (notification) notification.style.display = 'none';
});

// Theme Management
function initTheme() {
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme') || 
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    // Apply the saved theme
    setTheme(savedTheme);
    
    // Set up theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        updateThemeIcon(savedTheme);
    }
}

function setTheme(theme) {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme icon
    updateThemeIcon(theme);
    
    // Dispatch event in case other components need to react to theme changes
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (!themeIcon) return;
    
    themeIcon.textContent = theme === 'dark' ? '🌞' : '🌙';
    themeIcon.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Set version number from package.json
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('get-app-version').then(version => {
        const versionElement = document.getElementById('version-display');
        if (versionElement) {
            versionElement.textContent = `v${version}`;
        }
    }).catch(console.error);
    
    // Rest of your existing DOMContentLoaded code...
});

// Add this to your existing IPC handlers
ipcRenderer.on('set-theme', (event, theme) => {
    if (theme === 'toggle') {
        toggleTheme();
    } else if (['light', 'dark'].includes(theme)) {
        setTheme(theme);
    }
});

// Add this to your existing IPC handlers
ipcRenderer.on('get-theme', (event) => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    event.returnValue = currentTheme;
});

// Add this to your existing IPC handlers
ipcRenderer.on('system-theme-changed', (event, theme) => {
    // Only change theme if user hasn't set a preference
    if (!localStorage.getItem('theme')) {
        setTheme(theme);
    }
});

// Exit button functionality
const exitButton = document.getElementById('exit-btn');
if (exitButton) {
    exitButton.addEventListener('click', () => {
        ipcRenderer.send('close-app');
    });
}

// Minimize button functionality
const minimizeButton = document.getElementById('minimize-btn');
if (minimizeButton) {
    minimizeButton.addEventListener('click', () => {
        ipcRenderer.send('minimize-window');
    });
}

// DBS Technology Toolbox Management
function initToolbox() {
    console.log('Initializing Toolbox...');
    
    const toolboxToggle = document.getElementById('toolbox-toggle');
    const toolboxPopup = document.getElementById('toolbox-popup');
    const closeToolbox = document.getElementById('close-toolbox');
    const toolboxButtons = document.querySelectorAll('.toolbox-item');

    console.log('Toolbox Elements:', {
        toolboxToggle: !!toolboxToggle,
        toolboxPopup: !!toolboxPopup,
        closeToolbox: !!closeToolbox,
        toolboxButtons: toolboxButtons.length
    });

    const isWindows = process.platform === 'win32';

    // Get the base path for tools based on environment
    const isDev = process.env.NODE_ENV === 'development' || (window && window.process && window.process.type);
    let toolsBasePath;
    
    if (isDev) {
        // Development path (relative to project root)
        toolsBasePath = path.join(__dirname, 'tools', 'dbs-utilities');
    } else {
        // Production path - point to app.asar.unpacked
        const appPath = process.resourcesPath;
        toolsBasePath = path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'tools', 'dbs-utilities');
    }

    console.log('Tools base path:', toolsBasePath);

    // Tool paths mapping - now using the correct base path
    const toolPaths = {
        'disk-cleanup': 'DiskCleaner.exe',
        'uninstall-manager': 'Uninstaler.exe',
        'startup-manager': 'StartupManager.exe',
        'memory-optimizer': 'memdefrag.exe',
        'check-disk': 'CheckDisk.exe',
        'software-update': 'SoftwareUpdate.exe',
        'registry-repair': 'RegistryCleaner.exe',
        'registry-defrag': 'regdefrag.exe'
    };

    // macOS mapping: keep the same buttons, but call into a mac-safe action list
    const macToolActions = {
        'disk-cleanup': { action: 'disk-cleanup' },
        'uninstall-manager': { action: 'uninstall-manager' },
        'startup-manager': { action: 'startup-manager' },
        'memory-optimizer': { action: 'memory-optimizer' },
        'check-disk': { action: 'check-disk' },
        'software-update': { action: 'software-update' },
        'registry-repair': { action: 'registry-repair' },
        'registry-defrag': { action: 'registry-defrag' }
    };

    console.log('Tool paths:', toolPaths);

    // Toggle toolbox popup
    if (toolboxToggle) {
        console.log('Adding click event to toolbox toggle button');
        toolboxToggle.addEventListener('click', (e) => {
            console.log('Toolbox toggle clicked');
            e.stopPropagation();
            const isVisible = toolboxPopup.style.display === 'block';
            console.log('Current popup state:', isVisible ? 'visible' : 'hidden');
            toolboxPopup.style.display = isVisible ? 'none' : 'block';
            console.log('New popup state:', isVisible ? 'hidden' : 'visible');
        });
    } else {
        console.error('Toolbox toggle button not found!');
    }

    // Close toolbox when clicking close button
    if (closeToolbox) {
        closeToolbox.addEventListener('click', (e) => {
            console.log('Close toolbox button clicked');
            e.stopPropagation();
            toolboxPopup.style.display = 'none';
        });
    }

    // Close toolbox when clicking outside
    document.addEventListener('click', (e) => {
        if (toolboxPopup && !toolboxPopup.contains(e.target) && e.target !== toolboxToggle) {
            console.log('Clicked outside toolbox, closing');
            toolboxPopup.style.display = 'none';
        }
    });

    // Handle toolbox button clicks
    if (toolboxButtons.length > 0) {
        console.log(`Found ${toolboxButtons.length} toolbox buttons`);
        toolboxButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const toolId = button.getAttribute('data-tool');
                const toolExe = toolPaths[toolId];
                const toolName = button.querySelector('span').textContent;
                
                console.log(`Tool button clicked: ${toolName} (${toolId})`);
                console.log('Tool executable:', toolExe);
                
                if (!isWindows) {
                    const mapped = macToolActions[toolId];
                    if (!mapped) {
                        showNotification('Unsupported utility on this platform.', 'warning');
                        return;
                    }

                    const originalContent = button.innerHTML;
                    button.disabled = true;
                    button.innerHTML = '<i class="bi bi-hourglass-split"></i> Running...';
                    try {
                        const result = await ipcRenderer.invoke('mac-toolbox-action', mapped.action);
                        if (result && result.success) {
                            showNotification(result.message || `${toolName} completed.`, 'success');
                        } else {
                            showNotification((result && result.error) ? result.error : `Failed to run ${toolName}.`, 'warning');
                        }
                    } catch (err) {
                        showNotification(`Failed to run ${toolName}: ${err.message}`, 'warning');
                    } finally {
                        setTimeout(() => {
                            button.innerHTML = originalContent;
                            button.disabled = false;
                        }, 800);
                    }
                } else if (toolExe) {
                    console.log(`Attempting to launch: ${toolName}`);
                    
                    // Show loading state
                    const originalContent = button.innerHTML;
                    button.disabled = true;
                    button.innerHTML = '<i class="bi bi-hourglass-split"></i> Launching...';
                    
                    try {
                        // Get the full path to the tool
                        const fullPath = path.join(toolsBasePath, toolExe);
                        console.log('Full tool path:', fullPath);
                        
                        // Send the tool path to the main process
                        ipcRenderer.send('launch-tool', {
                            path: fullPath,
                            name: toolName
                        });
                        console.log(`Successfully requested launch of ${toolName}`);
                    } catch (error) {
                        console.error(`Error launching ${toolName}:`, error);
                        showNotification(`Error launching ${toolName}: ${error.message}`, 'error');
                    } finally {
                        // Restore button state after a short delay to show feedback
                        setTimeout(() => {
                            button.innerHTML = originalContent;
                            button.disabled = false;
                        }, 1000);
                    }
                } else {
                    console.error(`No path found for tool: ${toolId}`);
                    showNotification(`Error: Tool configuration missing for ${toolId}`, 'error');
                }
                
                // Close the toolbox after selection
                if (toolboxPopup) {
                    toolboxPopup.style.display = 'none';
                }
            });
        });
    } else {
        console.error('No toolbox buttons found!');
    }
    
    console.log('Toolbox initialization complete');
}

// Handle tool launch success
ipcRenderer.on('tool-launched', (event, { name, pid }) => {
    console.log(`Successfully launched ${name} with PID: ${pid}`);
    showNotification(`${name} launched successfully`, 'success');
});

// Handle tool launch errors
ipcRenderer.on('tool-error', (event, { name, error }) => {
    console.error(`Failed to launch ${name}:`, error);
    showNotification(`Failed to launch ${name}: ${error}`, 'error');
});

// Helper function to show notifications
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.role = 'alert';
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '2000';
    notification.style.minWidth = '300px';
    notification.style.maxWidth = '90%';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Single DOMContentLoaded event listener to rule them all
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing app...');
    
    // Initialize theme
    console.log('Initializing theme...');
    initTheme();
    
    // Initialize toolbox
    console.log('Initializing toolbox...');
    initToolbox();
    
    // Initialize other components
    console.log('Initializing other components...');
    
    // Check if Bootstrap is loaded for tooltips and popovers
    if (typeof bootstrap !== 'undefined') {
        console.log('Bootstrap is available, initializing components...');
        
        // Enable tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(tooltipTriggerEl => {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
        
        // Enable popovers
        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.forEach(popoverTriggerEl => {
            new bootstrap.Popover(popoverTriggerEl);
        });
    } else {
        console.warn('Bootstrap is not available, some UI components may not work correctly');
    }
    
    console.log('App initialization complete');
});

// Add event listener to enable right-click on form fields
document.addEventListener('DOMContentLoaded', () => {
    // Enable right-click on subject and description fields
    const subjectField = document.getElementById('subject');
    const descriptionField = document.getElementById('description');
    
    if (subjectField) {
        subjectField.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
            return true;
        });
    }
    
    if (descriptionField) {
        descriptionField.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
            return true;
        });
    }
    
    console.log('Right-click enabled for form fields');
});
