// Video Downloader Pro - Extension Settings Logic

document.addEventListener('DOMContentLoaded', function() {
    const toastEl = document.getElementById('toast');
    let toastTimeout = null;

    // Setting inputs
    const defaultQualitySelect = document.getElementById('default-quality');
    const autoBestToggle = document.getElementById('auto-best-toggle');
    const deepScanToggle = document.getElementById('deep-scan-toggle');
    const promptSaveToggle = document.getElementById('prompt-save-toggle');
    const namingFormatSelect = document.getElementById('naming-format');
    const conflictActionSelect = document.getElementById('conflict-action');
    const toastsToggle = document.getElementById('toasts-toggle');

    // Action buttons
    const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
    const clearStorageBtn = document.getElementById('clear-storage-btn');

    // Default Configuration
    const defaultSettings = {
        defaultQuality: 'best',
        autoSelectBest: true,
        deepScan: true,
        promptSave: true,
        namingFormat: 'clean_res',
        conflictAction: 'uniquify',
        toastsEnabled: true
    };

    // Toast Notification
    function showToast(message, type = 'success') {
        if (!toastEl) return;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastEl.textContent = message;
        toastEl.className = 'toast show ' + type;
        toastTimeout = setTimeout(() => {
            toastEl.classList.remove('show');
        }, 2200);
    }

    // Load settings from storage
    function loadSettings() {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(defaultSettings, function(settings) {
                applySettingsToUI(settings);
            });
        } else {
            const saved = localStorage.getItem('extensionSettings');
            const settings = saved ? Object.assign({}, defaultSettings, JSON.parse(saved)) : defaultSettings;
            applySettingsToUI(settings);
        }
    }

    // Apply loaded values to form controls
    function applySettingsToUI(settings) {
        if (defaultQualitySelect) defaultQualitySelect.value = settings.defaultQuality || 'best';
        if (autoBestToggle) autoBestToggle.checked = settings.autoSelectBest !== false;
        if (deepScanToggle) deepScanToggle.checked = settings.deepScan !== false;
        if (promptSaveToggle) promptSaveToggle.checked = settings.promptSave !== false;
        if (namingFormatSelect) namingFormatSelect.value = settings.namingFormat || 'clean_res';
        if (conflictActionSelect) conflictActionSelect.value = settings.conflictAction || 'uniquify';
        if (toastsToggle) toastsToggle.checked = settings.toastsEnabled !== false;
    }

    // Save current UI state to storage
    function saveCurrentSettings(showFeedback = true) {
        const current = {
            defaultQuality: defaultQualitySelect ? defaultQualitySelect.value : 'best',
            autoSelectBest: autoBestToggle ? autoBestToggle.checked : true,
            deepScan: deepScanToggle ? deepScanToggle.checked : true,
            promptSave: promptSaveToggle ? promptSaveToggle.checked : true,
            namingFormat: namingFormatSelect ? namingFormatSelect.value : 'clean_res',
            conflictAction: conflictActionSelect ? conflictActionSelect.value : 'uniquify',
            toastsEnabled: toastsToggle ? toastsToggle.checked : true
        };

        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(current, function() {
                if (showFeedback) showToast('Settings saved successfully');
            });
        } else {
            localStorage.setItem('extensionSettings', JSON.stringify(current));
            if (showFeedback) showToast('Settings saved successfully');
        }
    }

    // Bind auto-save listeners on all controls
    const inputs = [
        defaultQualitySelect, autoBestToggle, deepScanToggle,
        promptSaveToggle, namingFormatSelect, conflictActionSelect, toastsToggle
    ];

    inputs.forEach(input => {
        if (!input) return;
        input.addEventListener('change', () => saveCurrentSettings(true));
    });

    // Reset to Defaults
    if (resetDefaultsBtn) {
        resetDefaultsBtn.addEventListener('click', function() {
            if (confirm('Reset all extension preferences to factory defaults?')) {
                applySettingsToUI(defaultSettings);
                saveCurrentSettings(false);
                showToast('Reset to factory defaults', 'info');
            }
        });
    }

    // Clear Stored Data
    if (clearStorageBtn) {
        clearStorageBtn.addEventListener('click', function() {
            if (confirm('Clear all stored extension data and preferences?')) {
                if (chrome.storage && chrome.storage.local) {
                    chrome.storage.local.clear(function() {
                        applySettingsToUI(defaultSettings);
                        showToast('All stored data cleared', 'error');
                    });
                } else {
                    localStorage.clear();
                    applySettingsToUI(defaultSettings);
                    showToast('All stored data cleared', 'error');
                }
            }
        });
    }

    // ==========================================================================
    // Contact & Support Navigation
    // ==========================================================================
    // Auto-scroll to section if hash is present (#contact-section or #contact)
    if (window.location.hash === '#contact-section' || window.location.hash === '#contact' || window.location.hash === '#report') {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            setTimeout(() => {
                contactSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }

    // Initialize
    loadSettings();
});
