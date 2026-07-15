// ============================================================
// DIF — FSU Crestron Interface
// Copied + trimmed from script.js (WJB) and adapted to the DIF
// room inventory, plus the Lecture Capture page logic.
// ============================================================

// State variables
let currentSource = null;
let leftPreviewSource = null;
let rightPreviewSource = null;
let leftProjectSource = null;   // What's actually being projected on left
let rightProjectSource = null;  // What's actually being projected on right
let leftProjecting = false;
let rightProjecting = false;
let projectorsMuted = false;    // DIF: single PROJECTOR MUTE toggle (both projectors)
let micPreviousVolume = 50;     // Store previous volume for unmuting
let mainPreviousVolume = 50;    // Store previous volume for unmuting
let systemPower = false;        // Start with power OFF

// Source to wallpaper mapping (using correct capitalization for Wallpapers folder)
const sourceWallpapers = {
    'desktop': 'Wallpapers/DesktopLockScreen.png',
    'laptophdmi': 'Wallpapers/Laptop LockScreen.jpg',
    'laptopusbc': 'Wallpapers/Laptop LockScreen.jpg',
    'wireless': 'Wallpapers/Wireless.png',
    'doccam': null // No wallpaper for doc cam
};

// Map source keys to friendly names for badges
const sourceNames = {
    'desktop': 'Desktop PC',
    'doccam': 'Doc Cam',
    'laptophdmi': 'Laptop HDMI',
    'laptopusbc': 'Laptop USB-C',
    'wireless': 'Wireless'
};

// Toggle demo view (tap the room name)
function toggleDemoView() {
    const demoView = document.querySelector('.student-view-demo');
    demoView.classList.toggle('hidden');
}

// Update time (main header + lecture capture header)
function updateTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    const text = now.toLocaleDateString('en-US', options);
    document.querySelectorAll('.time-display').forEach(el => el.textContent = text);
}

setInterval(updateTime, 1000);
updateTime();

// Power warning flash
function flashPowerWarning() {
    const powerCard = document.querySelector('.power-card');
    powerCard.classList.add('power-warning');
    setTimeout(() => {
        powerCard.classList.remove('power-warning');
    }, 1000);
}

// Source warning flash
function flashSourceWarning() {
    const sourceCards = document.querySelectorAll('.left-section .control-card');
    // Flash the INPUT SOURCES card (first control-card in left-section)
    if (sourceCards.length > 0) {
        sourceCards[0].classList.add('source-warning');
        setTimeout(() => {
            sourceCards[0].classList.remove('source-warning');
        }, 1000);
    }
}

// Source selection
function selectSource(element, source) {
    // LECTURE CAPTURE opens its own page instead of routing video
    if (source === 'lecturecapture') {
        element.classList.add('selected');
        setTimeout(() => element.classList.remove('selected'), 300);
        openLectureCapture();
        return;
    }

    document.querySelectorAll('.source-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
    currentSource = source;
}

// Update room view (what's actually being projected - shown in demo bar)
function updateRoomView(side) {
    const display = document.getElementById(side + 'ProjectorDisplay');
    if (!display) return;

    const projectSource = side === 'left' ? leftProjectSource : rightProjectSource;
    const isProjecting = side === 'left' ? leftProjecting : rightProjecting;

    display.classList.remove('blanked', 'projecting');

    if (!systemPower) {
        display.textContent = '—';
        return;
    }

    if (projectorsMuted) {
        display.textContent = 'MUTED';
        display.classList.add('blanked');
        return;
    }

    if (isProjecting && projectSource) {
        display.textContent = (sourceNames[projectSource] || projectSource).toUpperCase();
        display.classList.add('projecting');
    } else {
        display.textContent = 'No Content';
    }
}

// Preview controls
function togglePreview(element, side) {
    if (!currentSource) {
        flashSourceWarning();
        return;
    }

    if (side === 'left') {
        leftPreviewSource = currentSource;
        updateScreenDisplay('left');
    } else {
        rightPreviewSource = currentSource;
        updateScreenDisplay('right');
    }

    element.classList.add('preview-active');
    setTimeout(() => element.classList.remove('preview-active'), 300);
}

// Update screen display (preview screens - NOT affected by mute/projection)
function updateScreenDisplay(side) {
    const screen = document.getElementById(side + 'Screen');

    if (!screen) {
        return;
    }

    const previewSource = side === 'left' ? leftPreviewSource : rightPreviewSource;

    if (previewSource) {
        const displayText = (sourceNames[previewSource] || previewSource).toUpperCase();
        const badgeText = `Preview: ${sourceNames[previewSource] || displayText}`;
        const wallpaper = sourceWallpapers[previewSource];

        if (wallpaper) {
            // Show wallpaper image with descriptive teal badge
            screen.innerHTML = `<img src="${wallpaper}" alt="${previewSource}"><span class="screen-status preview-badge">${badgeText}</span>`;
        } else {
            // Fallback to text for sources without wallpapers
            screen.innerHTML = `<span>Preview: ${displayText}</span><span class="screen-status preview-badge">${badgeText}</span>`;
        }

        screen.style.backgroundColor = '#425563';
    } else {
        // No preview source - show empty screen without status badge
        screen.innerHTML = `<span>Preview Screen</span>`;
        screen.style.backgroundColor = '#000';
    }
}

// Light controls
function toggleLight(element) {
    document.querySelectorAll('.light-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
}

// Camera presets
function selectCamera(element, preset) {
    // Remove selection from all camera preset buttons (main page only)
    document.querySelectorAll('.left-section .camera-btn').forEach(btn =>
        btn.classList.remove('selected')
    );
    element.classList.add('selected');
}

// Project Controls Menu
function openProjectControls(element) {
    // Check if power is on first
    if (!systemPower) {
        flashPowerWarning();
        return;
    }

    if (!currentSource) {
        flashSourceWarning();
        return;
    }

    // Highlight the PROJECT button
    element.classList.add('menu-open');

    // Open the project controls menu
    const menu = document.getElementById('projectControlsMenu');
    menu.classList.add('active');
}

function closeProjectControls() {
    const menu = document.getElementById('projectControlsMenu');
    menu.classList.remove('active');

    // Remove highlight from PROJECT button
    const projectBtn = document.querySelector('.control-btn.menu-open');
    if (projectBtn) {
        projectBtn.classList.remove('menu-open');
    }
}

function projectToScreen(side) {
    if (!currentSource) {
        flashSourceWarning();
        return;
    }

    if (side === 'left' || side === 'both') {
        leftProjectSource = currentSource;
        leftProjecting = true;
        updateScreenDisplay('left');
        updateRoomView('left');
    }
    if (side === 'right' || side === 'both') {
        rightProjectSource = currentSource;
        rightProjecting = true;
        updateScreenDisplay('right');
        updateRoomView('right');
    }

    // Flash the button that was clicked
    const btnId = side === 'left' ? 'projectLeftBtn' : side === 'right' ? 'projectRightBtn' : 'projectBothBtn';
    flashProjectButton(document.getElementById(btnId));
}

// Flash project button to give feedback
function flashProjectButton(button) {
    button.classList.add('selected');
    setTimeout(() => {
        button.classList.remove('selected');
    }, 300);
}

// DIF: Projector mute/unmute toggle (both projectors)
function toggleProjectorMute(element) {
    // Check if power is on first
    if (!systemPower) {
        flashPowerWarning();
        return;
    }

    projectorsMuted = !projectorsMuted;
    element.classList.toggle('mute-active', projectorsMuted);

    const textSpan = element.querySelector('span:last-child');
    textSpan.textContent = projectorsMuted ? 'PROJECTOR UNMUTE' : 'PROJECTOR MUTE';

    updateRoomView('left');
    updateRoomView('right');
}

// Loading screen
function showLoadingScreen(callback) {
    const overlay = document.getElementById('loadingOverlay');

    overlay.classList.add('active');

    const duration = 15000; // 15 seconds
    let timeout;

    // Function to complete loading immediately
    function skipLoading() {
        clearTimeout(timeout);

        setTimeout(() => {
            overlay.classList.remove('active');
            document.removeEventListener('keydown', skipLoading);
            overlay.removeEventListener('click', skipLoading);

            if (callback) callback();
        }, 300);
    }

    // Keyboard or tap to skip loading
    document.addEventListener('keydown', skipLoading, { once: true });
    overlay.addEventListener('click', skipLoading, { once: true });

    // Wait for duration then hide
    timeout = setTimeout(() => {
        overlay.classList.remove('active');
        document.removeEventListener('keydown', skipLoading);
        overlay.removeEventListener('click', skipLoading);

        // Execute callback after loading completes
        if (callback) callback();
    }, duration);
}

// Power controls
function togglePower(element, isOn) {
    // If trying to power on when already on, just return
    if (isOn && systemPower) {
        return;
    }

    // If trying to power off when system is on, show confirmation modal
    if (!isOn && systemPower) {
        showPowerOffModal();
        return;
    }

    systemPower = isOn;
    document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');

    if (isOn) {
        updateRoomView('left');
        updateRoomView('right');

        // Show loading screen when powering on
        showLoadingScreen();
    }
}

// Show power off confirmation modal
function showPowerOffModal() {
    const modal = document.getElementById('powerOffModal');
    modal.classList.add('active');
}

// Cancel power off
function cancelPowerOff() {
    const modal = document.getElementById('powerOffModal');
    modal.classList.remove('active');
}

// Confirm power off
function confirmPowerOff() {
    const modal = document.getElementById('powerOffModal');
    modal.classList.remove('active');

    // Actually power off the system
    systemPower = false;
    const powerOffBtn = document.querySelectorAll('.power-btn')[1];
    document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('selected'));
    powerOffBtn.classList.add('selected');

    // Power off - close menus and reset everything
    closeProjectControls();
    resetSystem();
}

// Volume slider updates
function updateVolumeSlider(slider, percentId) {
    if (!slider) return;

    const value = parseInt(slider.value);
    const percent = document.getElementById(percentId);

    if (percent) {
        // Warning above 90% volume for main volume
        if (value > 90 && percentId === 'mainPercent') {
            percent.innerHTML = `${value}% <span style="color: #FFC72C; font-size: 9px; margin-left: 4px;">⚠ HIGH</span>`;
            percent.style.background = 'rgba(255, 199, 44, 0.3)';
        } else {
            percent.textContent = value + '%';
            percent.style.background = 'rgba(206, 184, 136, 0.3)';
        }
    }

    const fillPercent = (value / 100) * 100;
    slider.style.background = `linear-gradient(to top, #CEB888 0%, #CEB888 ${fillPercent}%, #425563 ${fillPercent}%, #425563 100%)`;

    // Update mute button state based on slider value
    const muteBtn = slider.closest('.volume-section').querySelector('.mute-btn');

    if (muteBtn) {
        const muteBtnImg = muteBtn.querySelector('img');
        if (muteBtnImg) {
            if (value == 0) {
                // At 0 - show as muted
                muteBtn.classList.add('active');
                muteBtnImg.src = 'Icons/Muted.png';
                muteBtnImg.alt = 'Muted';
            } else {
                // Above 0 - show as unmuted
                muteBtn.classList.remove('active');
                muteBtnImg.src = 'Icons/Unmuted.png';
                muteBtnImg.alt = 'Unmuted';
            }
        }
    }
}

// Mute controls - syncs with volume sliders
function toggleMute(element, type) {
    const slider = type === 'mic' ?
        document.getElementById('micSlider') :
        document.getElementById('mainSlider');
    const percentId = type === 'mic' ? 'micPercent' : 'mainPercent';
    const muteBtnImg = element.querySelector('img');

    element.classList.toggle('active');

    if (element.classList.contains('active')) {
        // MUTING - save current volume and set to 0
        if (type === 'mic') {
            micPreviousVolume = slider.value;
        } else {
            mainPreviousVolume = slider.value;
        }
        slider.value = 0;
        if (muteBtnImg) {
            muteBtnImg.src = 'Icons/Muted.png';
            muteBtnImg.alt = 'Muted';
        }
    } else {
        // UNMUTING - restore previous volume
        const previousVolume = type === 'mic' ?
            micPreviousVolume : mainPreviousVolume;
        slider.value = previousVolume;
        if (muteBtnImg) {
            muteBtnImg.src = 'Icons/Unmuted.png';
            muteBtnImg.alt = 'Unmuted';
        }
    }

    updateVolumeSlider(slider, percentId);
}

// Start Class
function startClass() {
    const wasAlreadyOn = systemPower;

    if (!systemPower) {
        systemPower = true;
        const powerOnBtn = document.querySelectorAll('.power-btn')[0];
        document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('selected'));
        powerOnBtn.classList.add('selected');
    }

    if (wasAlreadyOn) {
        // Skip loading, go straight to setup
        setupClassroom();
    } else {
        // Show loading screen, then setup
        showLoadingScreen(() => {
            setupClassroom();
        });
    }
}

// Setup classroom - used by start class
function setupClassroom() {
    const desktopBtn = document.querySelector('.source-btn');
    selectSource(desktopBtn, 'desktop');

    setTimeout(() => {
        const controlBtns = document.querySelectorAll('.controls-grid .control-btn');
        togglePreview(controlBtns[0], 'left');
        togglePreview(controlBtns[1], 'right');

        setTimeout(() => {
            // Project to BOTH screens
            leftProjectSource = currentSource;
            rightProjectSource = currentSource;
            leftProjecting = true;
            rightProjecting = true;
            updateScreenDisplay('left');
            updateScreenDisplay('right');
            updateRoomView('left');
            updateRoomView('right');
        }, 300);
    }, 300);
}

// Reset system - used when powering off
function resetSystem() {
    currentSource = null;
    leftPreviewSource = null;
    rightPreviewSource = null;
    leftProjectSource = null;
    rightProjectSource = null;
    leftProjecting = false;
    rightProjecting = false;
    projectorsMuted = false;

    updateScreenDisplay('left');
    updateScreenDisplay('right');
    updateRoomView('left');
    updateRoomView('right');

    closeProjectControls();

    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.remove('preview-active', 'project-active', 'mute-active', 'menu-open');
    });

    const pmuteBtn = document.getElementById('projectorMuteBtn');
    if (pmuteBtn) {
        pmuteBtn.querySelector('span:last-child').textContent = 'PROJECTOR MUTE';
    }

    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    document.querySelectorAll('.left-section .camera-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Toast notification (shared)
function showModeToast(message) {
    // Create toast if it doesn't exist
    let toast = document.getElementById('modeToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'modeToast';
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #425563;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10010;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

// Technical Setup
function openTechnicalSetup() {
    const overlay = document.getElementById('technicalSetupOverlay');
    overlay.classList.add('active');
}

function closeTechnicalSetup() {
    const overlay = document.getElementById('technicalSetupOverlay');
    overlay.classList.remove('active');
}

// Help system
function showHelp() {
    const overlay = document.getElementById('helpOverlay');
    overlay.classList.add('active');

    // Show main content, hide detail views
    document.getElementById('helpMainContent').style.display = 'flex';
    document.getElementById('helpTaskDetail').style.display = 'none';
    document.getElementById('helpGuidebook').style.display = 'none';
}

function closeHelp() {
    const overlay = document.getElementById('helpOverlay');
    overlay.classList.remove('active');

    // Reset to main content view when closing
    document.getElementById('helpMainContent').style.display = 'flex';
    document.getElementById('helpTaskDetail').style.display = 'none';
    document.getElementById('helpGuidebook').style.display = 'none';
}

function showTaskDetail(taskType) {
    // Hide main content, show task detail
    document.getElementById('helpMainContent').style.display = 'none';
    document.getElementById('helpTaskDetail').style.display = 'flex';
    document.getElementById('helpGuidebook').style.display = 'none';

    const titleEl = document.getElementById('taskDetailTitle');
    const stepsEl = document.getElementById('taskDetailSteps');
    const gifEl = document.getElementById('taskDetailGif');

    // Define task content
    const tasks = {
        'project': {
            title: 'How to Project Content',
            gif: null,
            steps: [
                { icon: 'Icons/PowerIcon.webp', text: 'Press POWER ON' },
                { icon: 'Icons/DeskTopIcon.png', text: 'Pick what you want to show from the left side (Desktop PC, Laptop, Document Camera, etc.)' },
                { icon: 'Icons/LeftPreviewIcon.png', text: 'Press PREVIEW to check it looks right on your screen first' },
                { icon: 'Icons/ProjectIcon.png', text: 'Press PROJECT to show it on the projectors around the room' },
                { icon: 'Icons/HideRightLeftIcon.png', text: 'To blank the projectors, press PROJECTOR MUTE' }
            ]
        },
        'record': {
            title: 'Record Your Lecture',
            gif: null,
            steps: [
                { icon: 'Icons/CameraIcon.png', text: 'Tap LECTURE CAPTURE in the input sources' },
                { icon: 'Icons/CameraIcon.png', text: 'If your room has a scheduled recording, press CONFIRM. It starts by itself at the scheduled time' },
                { icon: 'Icons/DeskTopIcon.png', text: 'Nothing scheduled? Sign in with your FSUID under NEW RECORDING and pick a duration' },
                { icon: 'Icons/CameraIcon.png', text: 'Choose the camera view: INSTRUCTOR, STUDENTS, or BOTH' },
                { icon: 'Icons/PowerIcon.webp', text: 'When you finish, press END RECORDING. The recording uploads to your My Media in Canvas automatically' }
            ]
        }
    };

    const task = tasks[taskType];
    titleEl.textContent = task.title;

    // Show the GIF (or the coming-soon placeholder)
    if (task.gif) {
        gifEl.innerHTML = `<img src="${task.gif}" alt="${task.title}">`;
    } else {
        gifEl.innerHTML = `<span>Animation Coming Soon</span>`;
    }

    // Build steps
    stepsEl.innerHTML = task.steps.map((step, i) => `
        <div class="help-step">
            <div class="help-step-number">${i + 1}</div>
            ${step.icon ? `<img src="${step.icon}" alt="" class="help-step-icon">` : `<div class="help-step-spacer"></div>`}
            <div class="help-step-text">${step.text}</div>
        </div>
    `).join('');
}

function showGuidebook() {
    document.getElementById('helpMainContent').style.display = 'none';
    document.getElementById('helpTaskDetail').style.display = 'none';
    document.getElementById('helpGuidebook').style.display = 'block';
}

// Fullscreen preview
function enterFullscreen(side) {
    const previewSource = side === 'left' ? leftPreviewSource : rightPreviewSource;
    const overlay = document.getElementById('fullscreenOverlay');
    const fullscreenImage = document.getElementById('fullscreenImage');
    const fullscreenText = document.getElementById('fullscreenText');

    // Show overlay
    overlay.classList.add('active');

    if (!previewSource) {
        // No input selected - show black screen with text
        fullscreenImage.style.display = 'none';
        fullscreenText.style.display = 'block';
        fullscreenText.textContent = 'No Input Selected';
        fullscreenText.classList.remove('no-input');
    } else {
        const wallpaper = sourceWallpapers[previewSource];
        if (wallpaper) {
            fullscreenImage.src = wallpaper;
            fullscreenImage.style.display = 'block';
            fullscreenText.style.display = 'none';
        } else {
            fullscreenImage.style.display = 'none';
            fullscreenText.style.display = 'block';
            fullscreenText.textContent = `Preview: ${(sourceNames[previewSource] || previewSource).toUpperCase()}`;
            fullscreenText.classList.remove('no-input');
        }
    }
}

function exitFullscreen() {
    const overlay = document.getElementById('fullscreenOverlay');
    overlay.classList.remove('active');
}

// Add click handlers to screens
function setupScreenClickHandlers() {
    const leftScreen = document.getElementById('leftScreen');
    const rightScreen = document.getElementById('rightScreen');

    if (leftScreen) {
        leftScreen.addEventListener('click', function (e) {
            if (!e.target.classList.contains('screen-status')) {
                enterFullscreen('left');
            }
        });
    }

    if (rightScreen) {
        rightScreen.addEventListener('click', function (e) {
            if (!e.target.classList.contains('screen-status')) {
                enterFullscreen('right');
            }
        });
    }
}

// ============================================================
// LECTURE CAPTURE page — state-driven kiosk
// The stage IS the module's state machine: exactly one stage page
// (a VT Pro-e subpage in the real build) is visible per state:
//   idle | upnext | confirm | confirmed | recording | holding | ended
// plus the walk-up flow view (entered via the NEW RECORDING entries).
// Every stage page shares ONE fixed zone grid (headline / title /
// big-info / actions / caption / media) and every text element uses
// exactly one of the five ramp styles — see translation_map.md.
// ============================================================

const lc = {
    view: 'stage',          // 'stage' (state-derived page) | 'walkup'
    recording: false,
    hold: 0,                // 0 recording, 1 transitioning, 2 on hold
    holdEngaging: false,    // direction of the transition
    confirmed: false,       // while recording: refers to the NEXT event
    confirmable: false,     // while recording: NEXT event's window open
    recStart: null,
    recEnd: null,
    nowTitle: '',
    upcoming: [],           // today's remaining events: [{title, start, end}]
    ended: false,           // post-stop reassurance page (auto-returns)
    endedTimer: null,
    user: null,
    duration: null,
    customMode: false,
    camera: 'Instructor',
    previewOn: false,       // on-demand rail preview (PreviewShow/PreviewOn_Fb)
    previewBurst: null,     // camera-press burst timer (~15 s, module behavior)
    previewTimeout: null    // v4.15: manual-toggle auto-close (~1 min, module gPvTimeout)
};

// Known demo directory for the walk-up login
const lcDirectory = {
    'lfp24b': 'Lenny Paz',
    'jdoe2': 'Jane Doe',
    'tsmith': 'Taylor Smith'
};

function openLectureCapture() {
    const overlay = document.getElementById('lectureCaptureOverlay');
    overlay.classList.add('active');
    lcRender();
}

function closeLectureCapture() {
    const overlay = document.getElementById('lectureCaptureOverlay');
    overlay.classList.remove('active');
}

// Formatting helpers
function lcFmtClock(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function lcFmtElapsed(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Abbreviated duration — single source for the Z3 hero AND the walk-up
// gap message (v4.15 as-shipped sync 2026-07-15, module FmtDurMin):
// "23 min" / "1 hr" / "1 hr 5 min" / "5 hr 25 min" — never a pluralized
// abbreviation ("hrs"/"mins"), never a raw minute count ("325 minutes").
// Caller guarantees totalMin >= 1.
function lcFmtDurMin(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h} hr ${m} min`;
}

// Bare countdown quantity ("1 hr 35 min" / "12 min" / "under a minute") —
// the Z3 big-info hero; the SCHEDULED IN/FOR wording lives in the band's
// label. v4.15 (as-shipped sync 2026-07-15): "under a minute" below 60s
// (module SetCountdown); floor-based minutes to match the device exactly
// (a rounded-up "1 min" at 61s would overstate the wait).
function lcFmtCountdown(ms) {
    if (ms < 60000) return 'under a minute';
    return lcFmtDurMin(Math.floor(ms / 60000));
}

// Status line: a human sentence, newest fact first, no log framing.
// "Online · Recording started at 8:18 AM" — withTime=false for facts
// that aren't a moment (schedule freshness, prompts).
function lcStatus(action, withTime = true) {
    const el = document.getElementById('lcStatus');
    el.textContent = `Online · ${action}${withTime ? ` at ${lcFmtClock(new Date())}` : ''}`;
}

// Class title shortened to fit the ONE-line next-class strip
// (course code before the dash — handles both "ENT 4934 — Seminar"
// and the pipeline's ASCII "MAN 5721-0001 - Holmes, Robert").
function lcShortTitle(title) {
    const cut = title.split(' — ')[0].split(' - ')[0].trim();
    return cut.length > 18 ? cut.slice(0, 17) + '…' : cut;
}

// Dev-strip state presets (demo only) — each exercises one stage page
function lcSetState(state, devBtn) {
    const now = Date.now();
    const mins = m => new Date(now + m * 60000);

    lc.view = 'stage';
    lc.hold = 0;
    lc.holdEngaging = false;
    lc.recording = false;
    lc.confirmed = false;
    lc.confirmable = false;
    lc.ended = false;
    if (lc.endedTimer) {
        clearTimeout(lc.endedTimer);
        lc.endedTimer = null;
    }
    if (lc.previewBurst) {
        clearTimeout(lc.previewBurst);
        lc.previewBurst = null;
    }
    if (lc.previewTimeout) {
        clearTimeout(lc.previewTimeout);
        lc.previewTimeout = null;
    }
    // Demo previews: v4.4 — RECORDING now demos the DEFAULT off state
    // (TODAY extends into the shared area; press SHOW PREVIEW for the
    // frames); HOLDING keeps the preview open for the splash money shot.
    lc.previewOn = (state === 'holding');

    if (state === 'idle') {
        lc.upcoming = [];
        lcStatus('Schedule up to date. No more scheduled recordings today', false);
    } else if (state === 'upnext') {
        lc.upcoming = [
            { title: 'Panel Demo D', start: mins(95), end: mins(170) },
            { title: 'ENT 4934-0001 - Seminole, Sam', start: mins(185), end: mins(260) },
            { title: 'MAN 5721-0001 - Holmes, Robert', start: mins(300), end: mins(375) }
        ];
        lcStatus('Schedule up to date', false);
    } else if (state === 'confirm' || state === 'confirmed') {
        lc.confirmable = true;
        lc.confirmed = (state === 'confirmed');
        lc.upcoming = [
            { title: 'Panel Demo D', start: mins(12), end: mins(87) },
            { title: 'ENT 4934-0001 - Seminole, Sam', start: mins(110), end: mins(185) },
            { title: 'MAN 5721-0001 - Holmes, Robert', start: mins(225), end: mins(300) },
            { title: 'CHM 1045-0003 - Curie, Marie', start: mins(320), end: mins(395) },
            { title: 'BSC 2010-0002 - Darwin, Charles', start: mins(410), end: mins(485) }
        ];
        lcStatus(state === 'confirmed' ?
            'Confirmed. Panel Demo D records automatically' : 'Panel Demo D is ready to confirm', false);
    } else if (state === 'confirm-started') {
        // Owner v4.1 item 1: the confirm window with the class start
        // already PASSED — START NOW hides (a mid-window CONFIRM records
        // immediately, so the pair would be two identical buttons) and
        // the sub/caption carry the started-honesty wording.
        lc.confirmable = true;
        lc.upcoming = [
            { title: 'Panel Demo D', start: mins(-8), end: mins(67) },
            { title: 'ENT 4934-0001 - Seminole, Sam', start: mins(110), end: mins(185) },
            { title: 'MAN 5721-0001 - Holmes, Robert', start: mins(225), end: mins(300) }
        ];
        lcStatus('Panel Demo D has started. Nothing is recorded until you confirm', false);
    } else if (state === 'recording' || state === 'holding') {
        lc.recording = true;
        lc.nowTitle = 'Panel Demo D';
        lc.recStart = new Date(now - (14 * 60 + 32) * 1000);
        lc.recEnd = mins(21);
        // Device truth: the Pearl opens the NEXT event's confirm window
        // (~30 min ahead) even while this one still records — the
        // next-recording strip surfaces it. HOLDING demos the confirmed
        // variant of the strip. v4.4: enough upcoming rows that the
        // preview-off recording state shows the shared area filled.
        lc.confirmable = true;
        lc.upcoming = [
            { title: 'ENT 4934-0001 - Seminole, Sam', start: mins(29), end: mins(104) },
            { title: 'MAN 5721-0001 - Holmes, Robert', start: mins(190), end: mins(265) },
            { title: 'CHM 1045-0003 - Curie, Marie', start: mins(285), end: mins(360) },
            { title: 'BSC 2010-0002 - Darwin, Charles', start: mins(375), end: mins(450) }
        ];
        if (state === 'holding') {
            lc.hold = 2;
            lc.confirmed = true;
            lcStatus('Recording paused. Viewers see the pause screen', false);
        } else {
            lcStatus('Recording started');
        }
    } else if (state === 'ended') {
        // Post-stop reassurance (state 8) — auto-returns to the schedule.
        lc.nowTitle = 'Panel Demo D';
        lc.upcoming = [
            { title: 'ENT 4934-0001 - Seminole, Sam', start: mins(95), end: mins(170) },
            { title: 'MAN 5721-0001 - Holmes, Robert', start: mins(190), end: mins(265) }
        ];
        lcShowEnded();
        lcStatus('Recording ended');
    } else if (state === 'walkup') {
        // The walk-up FORM view (state 7). Starting it flips to RECORDING.
        lc.view = 'walkup';
        lc.upcoming = [
            { title: 'Panel Demo D', start: mins(95), end: mins(170) },
            { title: 'ENT 4934-0001 - Seminole, Sam', start: mins(185), end: mins(260) }
        ];
        lcStatus('New recording. Verify your FSUID to begin', false);
    }

    if (devBtn) {
        document.querySelectorAll('.lc-dev-btn').forEach(btn => btn.classList.remove('active'));
        devBtn.classList.add('active');
    }

    lcRender();

    // Walk-up entry default: CUSTOM pre-selected (after the page is
    // visible, so the minutes field can take focus)
    if (state === 'walkup') lcApplyWalkupDefaults();
}

// RECORDING actions -------------------------------------------

// STOP opens the confirm overlay (error prevention — VT Pro-e popup;
// the real stop join lives on the inner END RECORDING button).
function lcStop() {
    if (!lc.recording) return;
    document.getElementById('lcStopModalText').textContent =
        `${lc.nowTitle} is still recording. It uploads automatically after it ends.`;
    document.getElementById('lcStopModal').classList.add('active');
}

function lcStopCancel() {
    document.getElementById('lcStopModal').classList.remove('active');
}

function lcStopConfirm() {
    document.getElementById('lcStopModal').classList.remove('active');
    if (!lc.recording) return;
    lc.recording = false;
    lc.hold = 0;
    lc.holdEngaging = false;
    lcShowEnded();
    lcStatus('Recording ended');
    lcRender();
}

// Post-stop reassurance page (state 8). Panel version: shown on the
// recording falling edge, auto-cleared by a one-shot.
// v4.11 (as-built sync 2026-07-13, owner): dwell is 30 s (was ~6 s) so a
// finishing instructor actually reads it — COUPLED to the E5 copy ("goes
// back to the schedule in 30 seconds"); change the number in BOTH places.
// BACK TO SCHEDULE (lcEndedDismiss) ends the dwell early.
function lcShowEnded() {
    lc.ended = true;
    if (lc.endedTimer) clearTimeout(lc.endedTimer);
    lc.endedTimer = setTimeout(() => {
        lc.endedTimer = null;
        if (!lc.ended) return;
        lc.ended = false;
        lcRender();
    }, 30000);
}

// v4.11 (as-built sync 2026-07-13, owner): the ENDED page's BACK TO
// SCHEDULE dismiss — with the 30 s dwell, a back-to-back incoming
// instructor must not be blocked from CONFIRM while the pulse runs.
// Immediate return, the same path as the dwell expiring (panel E6:
// press 155 latches the page off — vis 116 = AND(EndedPulse_Fb, NOT
// latch), the d91 pattern; no module pin).
function lcEndedDismiss() {
    if (!lc.ended) return;
    if (lc.endedTimer) {
        clearTimeout(lc.endedTimer);
        lc.endedTimer = null;
    }
    lc.ended = false;
    lcRender();
}

// Mirrors the module's ExtendReady_Fb: a run event exists AND
// (no upcoming event OR upcoming.start > run.finish + 300s).
// Strict >: landing exactly on the next start still doesn't fit
// (the device 409s on overlap).
function lcExtendFits() {
    if (!lc.recording) return false;
    const next = lc.upcoming[0];
    if (!next) return true;
    return lc.recEnd.getTime() + 5 * 60000 < next.start.getTime();
}

function lcExtend(element) {
    if (!lcExtendFits()) return;
    lc.recEnd = new Date(lc.recEnd.getTime() + 5 * 60000);
    element.classList.add('flash');
    setTimeout(() => element.classList.remove('flash'), 300);
    lcStatus(`Recording extended to ${lcFmtClock(lc.recEnd)}`, false);
    showModeToast('Recording extended 5 minutes');
    lcRender();
}

function lcHold() {
    if (!lc.recording || lc.hold === 1) return;

    if (lc.hold === 0) {
        // Engage: splash + mute while transitioning
        lc.hold = 1;
        lc.holdEngaging = true;
        lcStatus('Pausing recording…', false);
        lcRender();
        setTimeout(() => {
            if (lc.hold === 1 && lc.holdEngaging && lc.recording) {
                lc.hold = 2;
                lcStatus('Recording paused. Viewers see the pause screen', false);
                lcRender();
            }
        }, 1500);
    } else if (lc.hold === 2) {
        // Resume
        lc.hold = 1;
        lc.holdEngaging = false;
        lcRender();
        setTimeout(() => {
            if (lc.hold === 1 && !lc.holdEngaging && lc.recording) {
                lc.hold = 0;
                lcStatus('Recording resumed');
                lcRender();
            }
        }, 1500);
    }
}

// CONFIRM / START NOW actions ---------------------------------

function lcConfirm() {
    if (!lc.confirmable || lc.confirmed || lc.recording || !lc.upcoming.length) return;
    // Device truth: confirming an event whose start has already passed
    // begins recording right away (mid-window confirm) — the sub-deck
    // says "Starts recording now" and means it.
    if (lc.upcoming[0].start.getTime() <= Date.now()) {
        lcStartNow();
        return;
    }
    lc.confirmed = true;
    lcStatus(`Confirmed ${lc.upcoming[0].title}`);
    showModeToast('Confirmed. Recording will start automatically');
    lcRender();
}

function lcStartNow() {
    if (lc.recording || !lc.confirmable || !lc.upcoming.length) return;
    const ev = lc.upcoming.shift();
    lc.confirmed = false;
    lc.confirmable = false;
    lc.recording = true;
    lc.nowTitle = ev.title;
    lc.recStart = new Date();
    lc.recEnd = ev.end;
    lc.hold = 0;
    lcStatus(`Recording started for ${ev.title}`);
    showModeToast('Recording started');
    lcRender();
}

// NEXT-CLASS confirm strip (REC/HOLD pages) --------------------
// The device opens the NEXT class's confirm window while the current
// class still records. Two-tap flow: the quiet strip opens a named
// confirmation popup (prevents mid-lecture fat-fingers and can't be
// mistaken for an action on the CURRENT recording).

function lcNextConfirmOpen() {
    const next = lc.upcoming[0];
    if (!lc.recording || !lc.confirmable || lc.confirmed || !next) return;
    document.getElementById('lcNextModalTitle').textContent =
        `Record ${next.title} at ${lcFmtClock(next.start)}?`;
    document.getElementById('lcNextModal').classList.add('active');
}

function lcNextConfirmCancel() {
    document.getElementById('lcNextModal').classList.remove('active');
}

function lcNextConfirmYes() {
    document.getElementById('lcNextModal').classList.remove('active');
    const next = lc.upcoming[0];
    if (!lc.recording || !lc.confirmable || lc.confirmed || !next) return;
    lc.confirmed = true;
    lcStatus(`Confirmed ${next.title}`);
    lcRender();
}

// HELP overlay (panel-local, zero module joins) ----------------

function lcHelpOpen() {
    lcHelpContextUpdate();
    document.getElementById('lcHelpModal').classList.add('active');
}

// v4.6 (owner item C): the state-contextual THIS SCREEN block. Mock:
// one text driven from the current lc state. Panel build: 8 stacked
// static Simple Labels inside the help subpage, one per kiosk state,
// each riding the EXISTING State*_Fb visibility digitals directly
// (subpage children only render while the subpage shows) — zero new
// joins, zero new SIMPL logic; walk-up rides its panel-local latch.
// The confirm page's post-start variant rides the same v10.6
// NextStarted_Fb candidate that already hides START NOW; until that
// pin ships the panel carries the pre-start wording only.
function lcHelpContextText() {
    const page = lcCurrentPage();
    const next = lc.upcoming[0] || null;
    const started = !!next && next.start.getTime() <= Date.now();
    if (page === 'lcPageIdle')
        // v4.13 (owner-picked A4, 2026-07-13): "starts a recording of
        // your own" doubled "recording" and read clunky — ownership is
        // carried by WHERE RECORDINGS GO + the walk-up "Recording as:"
        // line. (Package Q4 amended the same day.)
        return 'Nothing is scheduled right now. NEW RECORDING is for recording without a schedule.';
    if (page === 'lcPageUpNext')
        // v4.13 (owner-picked verbatim, 2026-07-13; package Q5 amended
        // the same day).
        return 'CONFIRM appears here 30 minutes before the scheduled start. NEW RECORDING lets you record now, no schedule needed.';
    if (page === 'lcPageConfirm')
        return started ?
            'The scheduled start has passed. CONFIRM starts recording right away.' :
            'CONFIRM starts the recording at the scheduled time. START NOW records immediately instead of waiting.';
    if (page === 'lcPageConfirmed')
        return 'This recording is confirmed and starts on its own. START NOW records immediately instead of waiting.';
    if (page === 'lcPageRec')
        return 'PAUSE shows viewers a pause screen. ADD 5 MINUTES extends the end time. END RECORDING stops and uploads.';
    if (page === 'lcPageHold')
        // v4.14 (owner-picked O1, 2026-07-13): descriptive viewer-facing
        // opener; RESUME dropped as the one self-evident face (the panel's
        // help box is a hard 2-liner and the name-all-three version 3-lined
        // into the divider). Package Q9 amended same day, build-verified.
        return 'Viewers see a pause screen while the recording continues. ADD 5 MINUTES extends it. END RECORDING uploads it.';
    if (page === 'lcPageWalkup')
        return 'Verify your FSUID first, then pick a duration. START RECORDING begins right away.';
    if (page === 'lcPageEnded')
        // v4.11 (owner 2026-07-13): "nothing else to press" became false
        // when BACK TO SCHEDULE landed (package Q10 amended the same day).
        return 'The recording uploads on its own. BACK TO SCHEDULE clears this screen right away.';
    return '';
}

function lcHelpContextUpdate() {
    document.getElementById('lcHelpContext').textContent = lcHelpContextText();
}

function lcHelpClose() {
    document.getElementById('lcHelpModal').classList.remove('active');
}

// POPUP SCRIM tap-to-dismiss (all three LC popups) -------------
// v4.12 (as-built sync 2026-07-13, owner): tapping the dark backdrop
// dismisses via the popup's SAFE path — stop popup = the KEEP RECORDING
// path (just close), next-class popup = NOT NOW (close, never confirm),
// help = CLOSE. Panel (field guide §8.5a + package E-1): the scrim is a
// full-screen Advanced Button (style "321 Transparent Advanced")
// pressing the popup latch, and the modal card is a PRESSLESS button
// that swallows misclicks. Mock: the e.target guard IS that pressless
// card — a click on the card or its children targets them, not the
// scrim, so it does nothing; only a click landing on the scrim itself
// dismisses.
function lcScrimDismiss(e, scrim, close) {
    if (e.target !== scrim) return;   // the card swallowed the misclick
    close();
}

// WALK-UP actions ---------------------------------------------

function lcOpenWalkup() {
    if (lc.recording) return;
    lc.view = 'walkup';
    lcStatus('New recording. Verify your FSUID to begin');
    lcRender();
    lcApplyWalkupDefaults();
}

// v4.15 (as-shipped sync 2026-07-15, module PRIVACY CLEAR-ON-OPEN): every
// walk-up open starts completely FRESH — CUSTOM selected (minutes field
// visible, empty, focused), FSUID/title empty, and any previous visitor's
// verification cleared. Replaces the old "a duration picked this visit
// survives a cancel/re-enter" behavior — a lingering pick alone let the
// next walk-up record as the previous person.
function lcApplyWalkupDefaults() {
    lcResetWalkupForm();
    lcPickCustom();
}

function lcCloseWalkup() {
    lc.view = 'stage';
    lcRender();
}

function lcVerify() {
    const field = document.getElementById('lcFsuid');
    const fsuid = field.value.trim().toLowerCase();

    if (!fsuid) {
        field.style.borderColor = 'var(--c-red)';
        setTimeout(() => field.style.borderColor = '', 1000);
        return;
    }

    // v4.15 (as-shipped sync 2026-07-15, module "Checking..." casing): any
    // (re-)verify starts from unverified and shows the in-progress state —
    // mirrors the real device round-trip instead of resolving instantly.
    // "Checking..." has no checkmark span, so it reads flush at the same
    // left edge as the verified line (the gutter checkmark idiom above).
    lc.user = null;
    const verifyBtn = document.getElementById('lcVerifyBtn');
    verifyBtn.classList.remove('selected');
    verifyBtn.textContent = 'VERIFY';
    document.getElementById('lcUserName').textContent = 'Checking...';
    lcStatus('Checking FSUID...', false);
    lcUpdateWalkupReady();

    setTimeout(() => {
        lc.user = lcDirectory[fsuid] || 'Sam Seminole';
        document.getElementById('lcUserName').innerHTML =
            `<span class="lc-user-check">✓</span>Recording as: ${lc.user}`;

        verifyBtn.classList.add('selected');
        verifyBtn.textContent = '✓ VERIFIED';

        lcStatus(`Verified ${lc.user}`);
        lcUpdateWalkupReady();
    }, 500);
}

function lcPickDuration(element, minutes) {
    document.querySelectorAll('.lc-dur-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    lc.customMode = false;
    document.getElementById('lcCustomRow').classList.add('lc-hidden');
    const customField = document.getElementById('lcCustomMin');
    customField.value = '';
    customField.style.borderColor = '';
    document.getElementById('lcDurError').textContent = '';
    lc.duration = minutes;
    lcUpdateWalkupReady();
}

function lcPickCustom() {
    document.querySelectorAll('.lc-dur-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('lcDurCustomBtn').classList.add('active');
    lc.customMode = true;
    lc.duration = null;
    document.getElementById('lcCustomRow').classList.remove('lc-hidden');
    document.getElementById('lcDurError').textContent = '';
    const field = document.getElementById('lcCustomMin');
    field.focus();
    if (field.value.trim() !== '') {
        lcCustomDuration(field);   // re-validate leftover text
    }
    lcUpdateWalkupReady();
}

function lcCustomDuration(field) {
    const raw = field.value.trim();
    const errorEl = document.getElementById('lcDurError');
    errorEl.textContent = '';
    field.style.borderColor = '';

    if (!lc.customMode) return;

    if (raw === '') {
        lc.duration = null;
        lcUpdateWalkupReady();
        return;
    }

    // Module rule: whole minutes only, 1-480. "30.5" is an error, never 305.
    // v4.15 (as-shipped sync 2026-07-15): keeps CUSTOM selected + the field
    // and keyboard alive (only the armed duration drops) — literal module
    // copy, lands on the form's own message line for everyone, verified or not.
    if (!/^\d+$/.test(raw) || parseInt(raw, 10) < 1 || parseInt(raw, 10) > 480) {
        lc.duration = null;
        field.style.borderColor = 'var(--c-yellow)';
        errorEl.textContent = 'whole minutes 1-480 only';
        lcUpdateWalkupReady();
        return;
    }

    lc.duration = parseInt(raw, 10);
    lcUpdateWalkupReady();
}

function lcUpdateWalkupReady() {
    const ready = !!lc.user && !!lc.duration && !lc.recording;
    document.getElementById('lcStartRecBtn').disabled = !ready;
    // Helper line states the unmet condition; reserved box (no reflow)
    document.getElementById('lcWalkupHelper').style.visibility = ready ? 'hidden' : 'visible';
}

function lcStartWalkup() {
    if (!lc.user || !lc.duration || lc.recording) return;

    // v4.15 (as-shipped sync 2026-07-15, module v10.6/v10.8b GAP PRE-CHECK):
    // a duration that cannot fit before the next scheduled event is refused
    // HERE with the reason (the device would 409 it) — boundary-strict, so
    // finish == next-start still counts as a conflict (the largest duration
    // that truly fits is (gap - 1s) whole minutes). Only a FUTURE next-start
    // gates — a stale past value must never block a walk-up. "Room busy -
    // recording scheduled" is the device's own 409 reply text for the rare
    // race this precheck doesn't catch; this mock makes no real network
    // round trip, so that path isn't reachable here.
    const next = lc.upcoming[0];
    const gapGate = !!next && next.start.getTime() > Date.now();
    if (gapGate && Date.now() + lc.duration * 60000 >= next.start.getTime()) {
        let freeS = Math.floor((next.start.getTime() - Date.now()) / 1000) - 1;
        if (freeS < 0) freeS = 0;
        let freeMin = 0;
        if (freeS >= 60) freeMin = Math.floor(Math.min(freeS, 28800) / 60);
        document.getElementById('lcDurError').textContent = freeMin > 0 ?
            `Only ${lcFmtDurMin(freeMin)} free before the next scheduled recording` :
            'The next scheduled recording starts in a moment';
        return;
    }

    const title = document.getElementById('lcTitle').value.trim();
    lc.recording = true;
    lc.nowTitle = title || `New Recording - ${lc.user}`;
    lc.recStart = new Date();
    lc.recEnd = new Date(Date.now() + lc.duration * 60000);
    lc.hold = 0;
    lc.view = 'stage';

    lcStatus(`New recording started for ${lc.user}`);
    showModeToast('Recording started');

    lcResetWalkupForm();
    lcRender();
}

// Auto-clearing ad-hoc fields (mirrors the module's v10.1 behavior)
function lcResetWalkupForm() {
    document.getElementById('lcFsuid').value = '';
    document.getElementById('lcTitle').value = '';
    const customField = document.getElementById('lcCustomMin');
    customField.value = '';
    customField.style.borderColor = '';
    document.getElementById('lcDurError').textContent = '';
    document.getElementById('lcCustomRow').classList.add('lc-hidden');
    document.querySelectorAll('.lc-dur-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('lcUserName').textContent = '';
    const verifyBtn = document.getElementById('lcVerifyBtn');
    verifyBtn.classList.remove('selected');
    verifyBtn.textContent = 'VERIFY';
    lc.user = null;
    lc.duration = null;
    lc.customMode = false;
}

// Camera view -------------------------------------------------

function lcCamera(element, view) {
    document.querySelectorAll('#lectureCaptureOverlay .lc-cam-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
    lc.camera = view;
    lcStatus(`Camera view set to ${view}`);
    // Module behavior (v10.4): a view press with the preview closed
    // opens a short automatic burst so the change is visibly confirmed.
    if (!lc.previewOn) {
        lc.previewOn = true;
        if (lc.previewBurst) clearTimeout(lc.previewBurst);
        lc.previewBurst = setTimeout(() => {
            lc.previewBurst = null;
            lc.previewOn = false;
            lcRender();
        }, 15000);
    }
    lcRender();                   // the CAMERA thumb shows the new view
}

// LIVE PREVIEW on demand (PreviewShow / PreviewOn_Fb). A press on the
// lit toggle ALWAYS closes (v10.4 rule) — including during a view-burst.
// v4.15 (as-shipped sync 2026-07-15, module gPvTimeout): an OPEN preview
// auto-closes after 1 minute (was 3 min) — the panel hint's "Closes after
// a minute." is COUPLED to this timer.
function lcTogglePreview() {
    if (lc.previewBurst) {
        clearTimeout(lc.previewBurst);
        lc.previewBurst = null;
    }
    lc.previewOn = !lc.previewOn;
    if (lc.previewOn) {
        if (lc.previewTimeout) clearTimeout(lc.previewTimeout);
        lc.previewTimeout = setTimeout(() => {
            lc.previewTimeout = null;
            lc.previewOn = false;
            lcRender();
        }, 60000);
    } else if (lc.previewTimeout) {
        clearTimeout(lc.previewTimeout);
        lc.previewTimeout = null;
    }
    // v4.15: the module streams live RTSP now (not a ~1 fps JPEG poll) —
    // the status line follows the hint line's honesty update below.
    lcStatus(lc.previewOn ? 'Preview on. Live view, closes after a minute' : 'Preview off', false);
    lcRender();
}

// The live-preview placeholder is the CAMERAS channel — the CAMERA VIEW
// buttons visibly change the scene (panel version: the polled preview
// JPEG changes because the layout PUT changed the channel).
function lcRenderPreviewScene() {
    const map = { Instructor: 'lcCamSceneInstructor', Students: 'lcCamSceneStudents', Both: 'lcCamSceneBoth' };
    Object.entries(map).forEach(([view, id]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = (lc.camera === view) ? '' : 'none';
    });
}

// Render ------------------------------------------------------

const LC_PAGES = ['lcPageIdle', 'lcPageUpNext', 'lcPageConfirm',
    'lcPageConfirmed', 'lcPageRec', 'lcPageHold', 'lcPageWalkup',
    'lcPageEnded'];

// The stage page for the current state (one subpage visible at a time)
function lcCurrentPage() {
    if (lc.ended) return 'lcPageEnded';
    if (lc.view === 'walkup' && !lc.recording) return 'lcPageWalkup';
    if (lc.recording) {
        // Engaging pending stays on the REC page (button face HOLDING…);
        // engaged + resuming pending show the HOLD page.
        const holdFace = lc.hold === 2 || (lc.hold === 1 && !lc.holdEngaging);
        return holdFace ? 'lcPageHold' : 'lcPageRec';
    }
    if (!lc.upcoming.length) return 'lcPageIdle';
    if (lc.confirmable && lc.confirmed) return 'lcPageConfirmed';
    if (lc.confirmable) return 'lcPageConfirm';
    return 'lcPageUpNext';
}

// Today rail: the running recording + today's remaining events.
// Finished events vanish (module rule); up to 8 rows (the module ships
// Today1$–Today8$) — "+N more" only beyond 8, never a scroll.
// v4.4 space-sharing: rows 1–3 live in the fixed TOP boxes; the lower
// rows live in the SHARED area and swap with the preview frames via
// complementary visibility (panel: lower rows vis = NOT PreviewOn_Fb,
// frame cluster vis = PreviewOn_Fb). v4.5: the confirm strip is pinned
// at the TODAY card's BOTTOM edge, its rectangle always reserved — the
// rows flow uninterrupted; the reserved slot costs the shared area
// ~72px of frame/slack height, and the 8-row + "+N more" budget still
// fits at DIF geometry (measured 2026-07-10).
const LC_TODAY_MAX = 8;
const LC_TODAY_TOP = 3;

function lcRenderToday() {
    const top = document.getElementById('lcTodayTop');
    const more = document.getElementById('lcTodayMore');
    const rows = [];

    if (lc.recording) {
        rows.push({ time: lc.recStart, name: lc.nowTitle, running: true });
    }
    lc.upcoming.forEach(ev => rows.push({ time: ev.start, name: ev.title, running: false }));

    if (!rows.length) {
        top.innerHTML = '<div class="lc-today-empty lc-t-caption">No more scheduled recordings today</div>';
        more.innerHTML = '';
        return;
    }

    // v4.10 (as-built sync 2026-07-13): the running-row dot is NOT part
    // of the row text anymore — it lives in the reserved left GUTTER
    // (.lc-today-row::before), lit by the .running class. Chrome build
    // decision: every row indents by the same gutter width so nothing
    // shifts when a row becomes the running row; panel truth is a
    // separate white dot Image Object — the ● never arrives via serial.
    const rowHtml = row =>
        `<div class="lc-today-row lc-t-caption${row.running ? ' running' : ''}">` +
        `<span class="lc-today-time">${lcFmtClock(row.time)}</span>` +
        `<span class="lc-today-name">${row.name}</span></div>`;

    const shown = rows.slice(0, LC_TODAY_MAX);
    top.innerHTML = shown.slice(0, LC_TODAY_TOP).map(rowHtml).join('');
    let html = shown.slice(LC_TODAY_TOP).map(rowHtml).join('');
    if (rows.length > LC_TODAY_MAX) {
        html += `<div class="lc-today-more lc-t-caption">+${rows.length - LC_TODAY_MAX} more later today</div>`;
    }
    more.innerHTML = html;

    // Fixed-box discipline: never render a half-clipped row. The panel
    // build has 8 fixed row boxes; the mock trims whole rows to the
    // height each container's box allows.
    [top, more].forEach(container => {
        while (container.lastElementChild && container.scrollHeight > container.clientHeight) {
            container.removeChild(container.lastElementChild);
        }
    });
}

function lcRender() {
    // Flip the stage wholesale to the current state's page
    const page = lcCurrentPage();
    LC_PAGES.forEach(id =>
        document.getElementById(id).classList.toggle('active', id === page));

    const next = lc.upcoming[0] || null;

    // IDLE — big clock
    document.getElementById('lcIdleClock').textContent = lcFmtClock(new Date());

    // UP NEXT / CONFIRM / CONFIRMED share the next event's identity
    if (next) {
        const range = `${lcFmtClock(next.start)} – ${lcFmtClock(next.end)}`;
        document.getElementById('lcUpNextTitle').textContent = next.title;
        document.getElementById('lcUpNextTime').textContent = range;
        document.getElementById('lcConfirmTitle').textContent = next.title;
        document.getElementById('lcConfirmTime').textContent = range;
        document.getElementById('lcConfirmedTitle').textContent = next.title;
        document.getElementById('lcConfirmedLine').textContent =
            `Starts recording automatically at ${lcFmtClock(next.start)}.`;
    }
    lcRenderCountdowns();

    // RECORDING / HOLD
    if (lc.recording) {
        document.getElementById('lcRecTitle').textContent = lc.nowTitle;
        const untilLine = `Recording until ${lcFmtClock(lc.recEnd)}`;
        document.getElementById('lcRecUntil').textContent = untilLine;
        // v4.11 (as-built sync 2026-07-13, owner): the PAUSED page keeps
        // the until-line — it stays true during a pause (the recording
        // continues, the end time doesn't move; extend updates both).
        // Panel: the same serial 12 (NowUntil$) feeds both pages.
        document.getElementById('lcHoldUntil').textContent = untilLine;
        document.getElementById('lcHoldClass').textContent = lc.nowTitle;
        lcRenderElapsed();
    }

    // ENDED — names the recording that just stopped
    document.getElementById('lcEndedTitle').textContent = lc.nowTitle || 'Recording';

    // Next-class confirm strip (monitoring rail — v4.5: pinned at the
    // TODAY card's bottom edge, rectangle always reserved): the device
    // opens the NEXT class's confirm window while the current class
    // records. Compact white button, ONE line (class title truncated
    // to fit); confirmed variant is a passive teal chip. Hidden =
    // visibility only (quiet padding, zero reflow).
    // v4.15 (as-shipped sync 2026-07-15, module UpNextConfirmed_Fb / the M13
    // chip fix): verified already-correct here — confirmable/confirmed
    // pertain to `next` (the up-next, non-running event), never the current
    // one, and `!!next` already hides the chip on the last class of the day.
    const stripOn = lc.recording && lc.confirmable && !!next;
    const stripTitle = next ? lcShortTitle(next.title) : '';
    const stripHtml = !stripOn ? '' : (lc.confirmed ?
        `<span class="lc-teal">✓</span>&nbsp; ${stripTitle} · ${lcFmtClock(next.start)} · will record` :
        `Confirm next: ${stripTitle} · ${lcFmtClock(next.start)}`);
    const strip = document.getElementById('lcNextStrip');
    strip.classList.toggle('on', stripOn);
    strip.classList.toggle('confirmed', stripOn && lc.confirmed);
    document.getElementById('lcNextLine').innerHTML = stripHtml;

    // LIVE PREVIEW region (monitoring rail): on-demand thumbs. While
    // paused BOTH recorded channels are on the splash layout, so both
    // thumbs show the pause treatment (design truth); chips carry the
    // pulsing live dot only while actually recording.
    const holdFace = lc.hold === 2 || (lc.hold === 1 && !lc.holdEngaging);
    document.getElementById('lcPreviewRegion').classList.toggle('off', !lc.previewOn);
    const toggle = document.getElementById('lcPreviewToggle');
    toggle.classList.toggle('on', lc.previewOn);
    toggle.textContent = lc.previewOn ? 'HIDE PREVIEW' : 'SHOW PREVIEW';
    document.getElementById('lcSplashScreen').style.display =
        (lc.previewOn && lc.recording && holdFace) ? 'flex' : 'none';
    document.getElementById('lcSplashCamera').style.display =
        (lc.previewOn && lc.recording && holdFace) ? 'flex' : 'none';
    const chipLive = lc.recording && !holdFace;
    document.getElementById('lcChipScreen').classList.toggle('lc-preview-chip--plain', !chipLive);
    document.getElementById('lcChipCamera').classList.toggle('lc-preview-chip--plain', !chipLive);
    // v4.6 item B: the hint line under the toggle STATE-SWAPS (the old
    // in-region caveat relocated here). One reserved line box; panel =
    // two overlapping static labels on PreviewOn_Fb + its existing NOT
    // (zero new joins).
    // v4.15 (as-shipped sync 2026-07-15, module v10.8 STREAMING previews):
    // the thumbs are now live RTSP video, not a ~1 fps JPEG poll, so the
    // caveat becomes the auto-close notice (COUPLED to the 1-minute timer).
    document.getElementById('lcPreviewHint').textContent = lc.previewOn ?
        'Live view. Closes after a minute.' :
        "See what's being recorded.";
    // v4.4 space-sharing: TODAY's lower rows swap with the frames
    // (complementary visibility — the same NOT PreviewOn_Fb signal).
    document.getElementById('lcTodayMore').style.visibility = lc.previewOn ? 'hidden' : 'visible';

    // +5 MIN fit-gate (mirrors ExtendReady_Fb: no overlap with next event).
    // v4.10 (as-built sync 2026-07-13): the PAUSED page carries its own
    // ADD 5 MINUTES instance (owner 2026-07-12 — the mock dropping extend
    // during a hold was an oversight; extend is valid mid-hold, the joins
    // are state-agnostic), gated + noted identically to the REC page's.
    const fits = lcExtendFits();
    const extendNote = (lc.recording && !fits) ? 'Next recording too soon' : '';
    document.getElementById('lcExtendBtn').disabled = !fits;
    document.getElementById('lcExtendNote').textContent = extendNote;
    document.getElementById('lcHoldExtendBtn').disabled = !fits;
    document.getElementById('lcHoldExtendNote').textContent = extendNote;

    // Privacy hold button face (REC page)
    const holdBtn = document.getElementById('lcHoldBtn');
    const engaging = lc.hold === 1 && lc.holdEngaging;
    holdBtn.classList.toggle('lc-hold-pending', engaging);
    // v4.2 face policy: text-only, no inline glyph (the old ⏸ span is gone)
    document.getElementById('lcHoldLabel').textContent = engaging ? 'PAUSING…' : 'PAUSE';

    // Resume face (HOLD page) — v4.10 (as-built sync 2026-07-13): the
    // face reads "RESUME" (short — owner call, the mirrored-trio slot);
    // the RESUMING… pending swap is unchanged.
    const resuming = lc.hold === 1 && !lc.holdEngaging;
    document.getElementById('lcResumeLabel').textContent =
        resuming ? 'RESUMING…' : 'RESUME';
    document.getElementById('lcResumeBtn').classList.toggle('lc-hold-pending', resuming);

    // Main-page LECTURE CAPTURE tile rec lamp (mirrors StopReady_Fb)
    document.getElementById('lcSourceRecLamp').style.display = lc.recording ? 'block' : 'none';

    lcRenderToday();
    lcRenderPreviewScene();
    lcUpdateWalkupReady();
    lcHelpContextUpdate();      // v4.6: THIS SCREEN block tracks the state
}

function lcRenderElapsed() {
    if (!lc.recording) return;
    const seconds = Math.max(0, Math.floor((Date.now() - lc.recStart.getTime()) / 1000));
    const text = lcFmtElapsed(seconds);
    document.getElementById('lcRecElapsed').textContent = text;
    // The recording CONTINUES during a pause — the PAUSED page carries
    // the same Z3 elapsed hero and it keeps ticking (owner v4.1).
    document.getElementById('lcHoldElapsed').textContent = text;
}

// Plain-language countdowns in the Z3 big-info band (label + hero);
// honest wording once the start passes (STARTED AT + the clock time).
// The CONFIRM sub-deck is outcome-explicit (owner decision): it states
// WHEN recording starts, never the event name (the title zone has it).
function lcRenderCountdowns() {
    const next = lc.upcoming[0] || null;
    if (!next) return;

    const untilStart = next.start.getTime() - Date.now();
    const started = untilStart <= 0;
    const label = started ? 'SCHEDULED FOR' : 'SCHEDULED IN';   // v4.12 (owner 2026-07-14): "STARTS IN" implied auto-record on an opt-in system; scheduling != recording
    const big = started ? lcFmtClock(next.start) : lcFmtCountdown(untilStart);

    document.getElementById('lcUpNextBigLabel').textContent = label;
    document.getElementById('lcUpNextBig').textContent = big;
    document.getElementById('lcConfirmBigLabel').textContent = label;
    document.getElementById('lcConfirmBig').textContent = big;
    document.getElementById('lcConfirmBtnSub').textContent = started ?
        'Starts recording now' :
        `Starts recording at ${lcFmtClock(next.start)}`;
    // Post-start, START NOW hides entirely (owner v4.1): a mid-window
    // CONFIRM records immediately, so the pair would be two identical
    // buttons — CONFIRM stands alone, centered. Panel build: needs a
    // "started" signal on this visibility join (v10.6 candidate
    // NextStarted_Fb); pre-start START NOW = the ConfirmStart macro
    // (join 93). The mock demos the behavior.
    document.getElementById('lcStartNowBtn').style.display = started ? 'none' : '';
    // v4.6 (owner item D): the CONFIRM page's walk-up escape hatch hides
    // once the start passes — an ad-hoc would always overlap the running
    // scheduled window (device 409) — riding the same "started" signal
    // as the START NOW hide (v10.6 candidate NextStarted_Fb, inverted).
    document.getElementById('lcConfirmRecNow').style.display = started ? 'none' : '';
    document.getElementById('lcConfirmStatus').textContent = started ?
        'The scheduled start has passed. You can still start recording at any point.' :
        'It records only if you confirm it';
}

// 1-second tick: elapsed timer, countdowns, and idle clock stay live
setInterval(() => {
    const overlay = document.getElementById('lectureCaptureOverlay');
    if (!overlay || !overlay.classList.contains('active')) return;
    lcRenderElapsed();
    lcRenderCountdowns();
    document.getElementById('lcIdleClock').textContent = lcFmtClock(new Date());
}, 1000);

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    const micSlider = document.getElementById('micSlider');
    const mainSlider = document.getElementById('mainSlider');

    updateVolumeSlider(micSlider, 'micPercent');
    updateVolumeSlider(mainSlider, 'mainPercent');

    // Initialize mute button icons to show Unmuted state (since sliders start at 50%)
    document.querySelectorAll('.mute-btn img').forEach(img => {
        img.src = 'Icons/Unmuted.png';
        img.alt = 'Unmuted';
    });

    // Setup fullscreen click handlers
    setupScreenClickHandlers();

    // Setup fullscreen overlay click to exit
    const fullscreenOverlay = document.getElementById('fullscreenOverlay');
    if (fullscreenOverlay) {
        fullscreenOverlay.addEventListener('click', function () {
            exitFullscreen();
        });
    }

    // Initialize room-view demo displays
    updateRoomView('left');
    updateRoomView('right');

    // Seed the lecture capture page with the default demo state
    lcSetState('confirm');

    // ESC closes overlays (development convenience)
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        exitFullscreen();
        closeHelp();
        closeTechnicalSetup();
        lcStopCancel();
        lcNextConfirmCancel();
        lcHelpClose();
        closeLectureCapture();
    });
});
