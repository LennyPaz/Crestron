// State variables
let projectorMode = 2; // 1 or 2 projectors (default 2)
        let currentSource = null;
        let selectedDocCam = null; // 'left' or 'right' when doc cam is selected
        let leftPreviewSource = null;
        let rightPreviewSource = null;
        let leftDocCamSide = null;  // Track which doc cam is previewed on left screen
        let rightDocCamSide = null; // Track which doc cam is previewed on right screen
        let leftProjectSource = null;  // What's actually being projected on left
        let rightProjectSource = null; // What's actually being projected on right
        let leftProjecting = false;
        let rightProjecting = false;
        let leftMuted = false;
        let rightMuted = false;
        let leftFrozen = false;
        let rightFrozen = false;
        let audioPlaying = false;
        let audioSource = null; // Track which source audio is playing from
        let audioDocCam = null; // Track which doc cam audio is playing from (left/right)
        let micPreviousVolume = 50; // Store previous volume for unmuting
        let mainPreviousVolume = 50; // Store previous volume for unmuting
        let systemPower = false; // Start with power OFF
        
        // PHASE 6: Projector screen and lamp state
        let leftScreenDown = false;     // Physical screen position - START WITH SCREENS UP
        let rightScreenDown = false;
        
        // Phase 1: Source connected state (for "No Input" badge)
        // Only show "No Input" for regular doc cam in 2-projector mode OR left doc cam in 1-projector mode
        function isSourceConnected(source) {
            if (source === 'doccam') {
                // In current 2-projector mode: left doc cam gets "No Input", right is fine
                if (selectedDocCam === 'left') {
                    return false; // Show "No Input" for left doc cam
                } else {
                    return true; // Right doc cam works fine
                }
            }
            // All other sources are connected
            return true;
        }
        
        // Source to wallpaper mapping (using correct capitalization for Wallpapers folder)
        const sourceWallpapers = {
            'desktop': 'Wallpapers/DesktopLockScreen.png',
            'mac': 'Wallpapers/Mac.png',
            'laptop': 'Wallpapers/Laptop LockScreen.jpg',
            'bluray': 'Wallpapers/Blue Ray.webp',
            'wireless': 'Wallpapers/Wireless.png',
            'camera': null, // No wallpaper for camera yet
            'doccam': null // No wallpaper for doc cam yet
        };
        
        // Toggle demo view
        function toggleDemoView() {
            const demoView = document.querySelector('.student-view-demo');
            demoView.classList.toggle('hidden');
        }
        
        // PHASE 2: Switch projector modes
        function switchProjectorMode(mode) {
            if (mode === projectorMode) return; // Already in this mode
            
            projectorMode = mode;
            
            // Power off system and reset to avoid weird interactions
            if (systemPower) {
                systemPower = false;
                const powerOffBtn = document.querySelectorAll('.power-btn')[1];
                document.querySelectorAll('.power-btn').forEach(btn => btn.classList.remove('selected'));
                powerOffBtn.classList.add('selected');
                resetSystem();
            } else {
                // Even if power is off, still need to reset selections and close menus
                currentSource = null;
                selectedDocCam = null;
                
                // Deselect all source buttons
                document.querySelectorAll('.source-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // Close all menus
                closeDocCamMenu();
                closeBlurayMenu();
                closeProjectControls();
                closeHideControls();
                closeFreezeControls();
            }
            
            // Reset volume to 50% for both sliders
            const micSlider = document.getElementById('micSlider');
            const mainSlider = document.getElementById('mainSlider');
            if (micSlider && mainSlider) {
                micSlider.value = 50;
                mainSlider.value = 50;
                micPreviousVolume = 50;
                mainPreviousVolume = 50;
                updateVolumeSlider(micSlider, 'micPercent');
                updateVolumeSlider(mainSlider, 'mainPercent');
            }
            
            // Reset lights to ALL ON
            document.querySelectorAll('.light-btn').forEach(btn => btn.classList.remove('active'));
            const allOnBtn = document.querySelectorAll('.light-btn')[0]; // First light button is ALL ON
            if (allOnBtn) {
                allOnBtn.classList.add('active');
            }
            
            updateUIForProjectorMode();
            
            // Show toast notification
            showModeToast(`Switched to ${mode} Projector Mode`);
        }
        
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
                    z-index: 10000;
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
        
        function updateUIForProjectorMode() {
            const demoView = document.querySelector('.student-view-demo');
            const leftProjectorDisplay = document.getElementById('leftProjectorDisplay');
            const rightProjectorContainer = document.querySelector('.student-projector:last-child');
            
            // PHASE 2: Find the projector screen control buttons (in bottom right)
            const screenControlBtns = document.querySelectorAll('.projector-control-btn');
            const leftScreenUpBtn = screenControlBtns[0]; // Left screen up
            const rightScreenUpBtn = screenControlBtns[1]; // Right screen up
            const leftScreenDownBtn = screenControlBtns[2]; // Left screen down
            const rightScreenDownBtn = screenControlBtns[3]; // Right screen down
            
            // Find the screen controls grid
            const screenControlsGrid = document.querySelector('.screen-controls-grid');
            
            if (projectorMode === 1) {
                // 1 PROJECTOR MODE
                // Update demo view to show "MAIN PROJECTOR" and hide right projector display
                leftProjectorDisplay.previousElementSibling.textContent = 'MAIN PROJECTOR:';
                if (rightProjectorContainer) rightProjectorContainer.style.display = 'none';
                
                // Hide right projector screen control buttons
                if (rightScreenUpBtn) rightScreenUpBtn.style.display = 'none';
                if (rightScreenDownBtn) rightScreenDownBtn.style.display = 'none';
                
                // Update left buttons to say "PROJECTOR SCREEN" instead of "LEFT SCREEN"
                if (leftScreenUpBtn) {
                    const textSpan = leftScreenUpBtn.querySelector('span:last-child');
                    if (textSpan) textSpan.innerHTML = 'PROJECTOR<br>SCREEN<br>UP';
                }
                if (leftScreenDownBtn) {
                    const textSpan = leftScreenDownBtn.querySelector('span:last-child');
                    if (textSpan) textSpan.innerHTML = 'PROJECTOR<br>SCREEN<br>DOWN';
                }
                
                // Make grid single column (1 button per row)
                if (screenControlsGrid) {
                    screenControlsGrid.style.gridTemplateColumns = '1fr';
                }
                
                // Reset right-side states when switching to 1-projector
                rightProjecting = false;
                rightProjectSource = null;
                rightMuted = false;
                updateRoomView('left');
                
            } else {
                // 2 PROJECTOR MODE
                // Update demo view to show "LEFT PROJECTOR" and show right projector display
                leftProjectorDisplay.previousElementSibling.textContent = 'LEFT PROJECTOR:';
                if (rightProjectorContainer) rightProjectorContainer.style.display = 'flex';
                
                // Show right projector screen control buttons
                if (rightScreenUpBtn) rightScreenUpBtn.style.display = 'flex';
                if (rightScreenDownBtn) rightScreenDownBtn.style.display = 'flex';
                
                // Restore left buttons to say "LEFT SCREEN"
                if (leftScreenUpBtn) {
                    const textSpan = leftScreenUpBtn.querySelector('span:last-child');
                    if (textSpan) textSpan.innerHTML = 'LEFT<br>SCREEN<br>UP';
                }
                if (leftScreenDownBtn) {
                    const textSpan = leftScreenDownBtn.querySelector('span:last-child');
                    if (textSpan) textSpan.innerHTML = 'LEFT<br>SCREEN<br>DOWN';
                }
                
                // Restore grid to 2 columns
                if (screenControlsGrid) {
                    screenControlsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                }
                
                updateRoomView('left');
                updateRoomView('right');
            }
        }
        
        // Initialize room view on page load
        function initializeStudentView() {
            updateRoomView('left');
            updateRoomView('right');
        }
        
        // Update time
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
            document.getElementById('timeDisplay').textContent = now.toLocaleDateString('en-US', options);
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
        
        // BATCH 2 FIX #6: Audio warning flash (red) for sources without audio
        function flashAudioWarning(audioButton) {
            // Flash the audio button red once
            const originalBg = audioButton.style.background;
            const originalColor = audioButton.style.color;
            
            audioButton.style.background = '#A6192E';
            audioButton.style.color = 'white';
            
            setTimeout(() => {
                audioButton.style.background = originalBg;
                audioButton.style.color = originalColor;
            }, 500);
        }
        
        // BATCH 2 FIX #5: Update audio button appearance based on mute state
        function updateAudioButtonState() {
            const audioBtn = document.querySelector('.audio-btn');
            if (!audioBtn || !audioPlaying) return;
            
            // PHASE 2: In 1-projector mode, check if main (left) projector is muted
            // In 2-projector mode, check if both are muted
            const shouldWarn = (projectorMode === 1) ? leftMuted : (leftMuted && rightMuted);
            const textSpan = audioBtn.querySelector('span:last-child');
            
            let sourceText = '';
            if (audioSource === 'doccam' && selectedDocCam) {
                sourceText = `${selectedDocCam.toUpperCase()} DOC CAM`;
            } else if (audioSource) {
                sourceText = audioSource.toUpperCase();
            }
            
            if (shouldWarn) {
                // Show warning state (yellow)
                audioBtn.style.background = '#FFC72C';
                audioBtn.style.color = '#101820';
                textSpan.textContent = `PLAYING AUDIO FROM: ${sourceText}`;
            } else {
                // Normal state
                audioBtn.style.background = '';
                audioBtn.style.color = '';
                textSpan.textContent = `PLAYING AUDIO FROM: ${sourceText}`;
            }
        }
        
        // BATCH 3 FIX #7: Update hide button to stay yellow when screens are muted
        function updateHideButtonPersistentState() {
            const hideBtn = document.querySelectorAll('.control-btn')[5]; // 6th button - HIDE & MUTE
            if (hideBtn && !document.getElementById('hideControlsMenu').classList.contains('active')) {
                // Only update if menu is closed
                if (leftMuted || rightMuted) {
                    hideBtn.classList.add('mute-active');
                } else {
                    hideBtn.classList.remove('mute-active');
                }
            }
        }
        
        // Source selection
        function selectSource(element, source) {
            document.querySelectorAll('.source-btn').forEach(btn => btn.classList.remove('selected'));
            element.classList.add('selected');
            currentSource = source;
            
            // PHASE 4: If doc cam is selected, open doc cam menu and auto-select left
            if (source === 'doccam') {
                selectedDocCam = 'left'; // Auto-select left
                openDocCamMenu();
                closeBlurayMenu();
            } else if (source === 'bluray') {
                // PHASE 5: Open Blu-ray controls menu
                openBlurayMenu();
                closeDocCamMenu();
                selectedDocCam = null; // Clear doc cam selection
            } else {
                // CRITICAL FIX: Close both doc cam and bluray menus if switching to different source
                closeDocCamMenu();
                closeBlurayMenu();
                selectedDocCam = null; // Clear doc cam selection when switching away
            }
        }
        
        // Update room view (what's actually being projected)
        function updateRoomView(side) {
            const display = document.getElementById(side + 'ProjectorDisplay');
            const isMuted = side === 'left' ? leftMuted : rightMuted;
            const isFrozen = side === 'left' ? leftFrozen : rightFrozen;
            const isProjecting = side === 'left' ? leftProjecting : rightProjecting;
            const projectSource = side === 'left' ? leftProjectSource : rightProjectSource;
            const screenDown = side === 'left' ? leftScreenDown : rightScreenDown;
            
            display.classList.remove('blanked', 'projecting', 'frozen');
            
            // PHASE 6: Show screen position with bigger arrow
            let screenIcon = screenDown ? ' ▼' : ' ▲';
            
            // PRIORITY ORDER: Mute > Freeze > Projecting > Nothing
            // Mute ALWAYS takes highest priority - even if nothing is projecting!
            if (isMuted) {
                // Show BLANKED regardless of whether anything is projecting
                display.textContent = 'BLANKED' + screenIcon;
                display.classList.add('blanked');
            } else if (isFrozen && isProjecting) {
                // Freeze only shows if NOT muted AND something is projecting
                display.textContent = 'FROZEN' + screenIcon;
                display.classList.add('frozen');
            } else if (isProjecting && projectSource) {
                // PHASE 4: Show which doc cam if doc cam is the source
                if (projectSource === 'doccam' && selectedDocCam) {
                    display.textContent = `${selectedDocCam.toUpperCase()} DOC CAM` + screenIcon;
                } else {
                    display.textContent = projectSource.toUpperCase() + screenIcon;
                }
                display.classList.add('projecting');
            } else {
                display.textContent = '—' + screenIcon;
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
                // NEW: Track doc cam side for this screen
                if (currentSource === 'doccam') {
                    leftDocCamSide = selectedDocCam;
                } else {
                    leftDocCamSide = null;
                }
                updateScreenDisplay('left');
            } else {
                rightPreviewSource = currentSource;
                // NEW: Track doc cam side for this screen
                if (currentSource === 'doccam') {
                    rightDocCamSide = selectedDocCam;
                } else {
                    rightDocCamSide = null;
                }
                updateScreenDisplay('right');
            }
            
            element.classList.add('preview-active');
            setTimeout(() => element.classList.remove('preview-active'), 300);
        }
        
        // Project controls - Always projects current source, doesn't toggle off
        function toggleProject(element, side) {
            // Check if power is on first
            if (!systemPower) {
                flashPowerWarning();
                return;
            }
            
            if (!currentSource) {
                return; // Silently fail if no source
            }
            
            // Always project the CURRENT source (no toggle off)
            if (side === 'left') {
                leftProjectSource = currentSource;
                leftProjecting = true;
                // Don't toggle class - just ensure all left project buttons show active
                document.querySelectorAll('.control-btn').forEach(btn => {
                    if (btn.textContent.includes('LEFT PROJECT')) {
                        btn.classList.remove('project-active');
                    }
                });
            } else {
                rightProjectSource = currentSource;
                rightProjecting = true;
                // Don't toggle class - just ensure all right project buttons show active
                document.querySelectorAll('.control-btn').forEach(btn => {
                    if (btn.textContent.includes('RIGHT PROJECT')) {
                        btn.classList.remove('project-active');
                    }
                });
            }
            
            updateScreenDisplay(side);
            updateRoomView(side);
        }
        
        // Mute/Hide screen (toggles on/off) - affects PROJECTORS only, not preview screens
        function muteScreen(element, side) {
            // Check if power is on first
            if (!systemPower) {
                flashPowerWarning();
                return;
            }
            
            // Toggle the mute state
            element.classList.toggle('mute-active');
            
            if (side === 'left') {
                leftMuted = !leftMuted;
            } else {
                rightMuted = !rightMuted;
            }
            // Update room view to show blanked or unblanked state
            updateRoomView(side);
        }
        
        // Update screen display (preview screens - NOT affected by mute/projection)
        function updateScreenDisplay(side) {
            const screen = document.getElementById(side + 'Screen');
            
            if (!screen) {
                return;
            }
            
            const previewSource = side === 'left' ? leftPreviewSource : rightPreviewSource;
            const docCamSide = side === 'left' ? leftDocCamSide : rightDocCamSide; // NEW: Get tracked doc cam side
            
            // Preview screens ONLY show previews, NOT mute or projection state
            if (previewSource) {
                // NEW: Use tracked doc cam side for this screen
                const effectiveDocCam = (previewSource === 'doccam') ? docCamSide : null;
                const isConnected = (previewSource === 'doccam' && effectiveDocCam === 'left') ? false : true;
                
                // Create more descriptive badge text with source name
                let badgeText = 'Preview';
                let displayText = previewSource.toUpperCase();
                
                if (previewSource === 'doccam' && effectiveDocCam) {
                    displayText = `${effectiveDocCam.toUpperCase()} DOC CAM`;
                    badgeText = `Preview: ${displayText}`;
                } else {
                    // Map source keys to friendly names for badge
                    const sourceNames = {
                        'desktop': 'Desktop PC',
                        'mac': 'Mac',
                        'laptop': 'Laptop',
                        'wireless': 'Wireless',
                        'bluray': 'Blu-ray',
                        'camera': 'Camera'
                    };
                    badgeText = `Preview: ${sourceNames[previewSource] || displayText}`;
                }
                
                if (!isConnected) {
                    // Show "No Input" badge for disconnected sources
                    screen.innerHTML = `<span style="color: #A6192E;">No Input Detected</span><span class="screen-status no-input">${badgeText.replace('Preview:', 'No Input:')}</span>`;
                    screen.style.backgroundColor = '#000';
                } else {
                    const wallpaper = sourceWallpapers[previewSource];
                    
                    if (wallpaper) {
                        // Show wallpaper image with descriptive teal badge
                        screen.innerHTML = `<img src="${wallpaper}" alt="${previewSource}"><span class="screen-status preview-badge">${badgeText}</span>`;
                    } else {
                        // Fallback to text for sources without wallpapers
                        screen.innerHTML = `<span>Preview: ${displayText}</span><span class="screen-status preview-badge">${badgeText}</span>`;
                    }
                    
                    screen.style.backgroundColor = '#425563';
                }
            } else {
                // No preview source - show empty screen without status badge
                screen.innerHTML = `<span>Preview Screen</span>`;
                screen.style.backgroundColor = '#000';
            }
        }
        
        // Audio control
        function toggleAudio(element) {
            // BATCH 1 FIX #1: Check if power is on first
            if (!systemPower) {
                flashPowerWarning();
                return;
            }
            
            if (!currentSource) {
                flashSourceWarning();
                return;
            }
            
            // BATCH 2 FIX #6: Camera doesn't have audio - flash red warning
            if (currentSource === 'camera') {
                flashAudioWarning(element);
                return;
            }
            
            // BATCH 2 FIX #4: Toggle audio on/off for same source
            // Special handling for doc cam - check if SAME doc cam
            if (audioPlaying && audioSource === currentSource) {
                // For doc cam, check if it's the SAME doc cam
                if (currentSource === 'doccam') {
                    // Only turn off if it's the SAME doc cam, otherwise switch
                    if (audioDocCam === selectedDocCam) {
                        // Same doc cam - turn OFF
                        audioPlaying = false;
                        audioSource = null;
                        audioDocCam = null;
                        element.classList.remove('active');
                        element.style.background = '';
                        element.style.color = '';
                        
                        const textSpan = element.querySelector('span:last-child');
                        textSpan.textContent = 'PLAY AUDIO FROM SELECTED INPUT';
                        return;
                    }
                    // Different doc cam - fall through to switch below
                } else {
                    // Turn OFF audio if clicking same non-doc-cam source that's already playing
                    audioPlaying = false;
                    audioSource = null;
                    audioDocCam = null;
                    element.classList.remove('active');
                    element.style.background = '';
                    element.style.color = '';
                    
                    const textSpan = element.querySelector('span:last-child');
                    textSpan.textContent = 'PLAY AUDIO FROM SELECTED INPUT';
                    return;
                }
            }
            
            // BATCH 2 FIX #5: Check if screens are muted
            // PHASE 2: In 1-projector mode, only check left. In 2-projector mode, check both
            const shouldWarn = (projectorMode === 1) ? leftMuted : (leftMuted && rightMuted);
            
            // Switch to current source and play
            audioPlaying = true;
            audioSource = currentSource;
            audioDocCam = (currentSource === 'doccam') ? selectedDocCam : null;
            
            if (shouldWarn) {
                // Both muted - show different state (audio playing but nowhere to go)
                element.classList.add('active');
                element.style.background = '#FFC72C'; // Yellow warning color
                element.style.color = '#101820';
            } else {
                // Normal playing state
                element.classList.add('active');
                element.style.background = ''; // Remove any custom background
                element.style.color = '';
            }
            
            const textSpan = element.querySelector('span:last-child');
            
            // Special handling for doc cam - show which doc cam
            let sourceText = '';
            if (currentSource === 'doccam' && selectedDocCam) {
                sourceText = `${selectedDocCam.toUpperCase()} DOC CAM`;
            } else {
                sourceText = currentSource.toUpperCase();
            }
            
            // Text stays the same regardless of mute state - color shows the warning
            textSpan.textContent = `PLAYING AUDIO FROM: ${sourceText}`;
        }
        
        // Light controls
        function toggleLight(element) {
            document.querySelectorAll('.light-btn').forEach(btn => btn.classList.remove('active'));
            element.classList.add('active');
        }
        
        // Camera presets
        function selectCamera(element, preset) {
            // Remove selection from all camera buttons
            document.querySelectorAll('.camera-btn').forEach(btn => 
                btn.classList.remove('selected')
            );
            
            // Add selection to clicked button
            element.classList.add('selected');
        }
        
        // PHASE 4: Doc Cam Selection Menu Functions
        function openDocCamMenu() {
            const menu = document.getElementById('doccamSelectionMenu');
            menu.classList.add('active');
            
            // Update button states
            updateDocCamButtonStates();
        }
        
        function closeDocCamMenu() {
            const menu = document.getElementById('doccamSelectionMenu');
            menu.classList.remove('active');
        }
        
        function selectDocCam(side) {
            selectedDocCam = side;
            
            // Update highlighting to match source button style
            updateDocCamButtonStates();
        }
        
        function updateDocCamButtonStates() {
            const leftBtn = document.getElementById('doccamLeftBtn');
            const rightBtn = document.getElementById('doccamRightBtn');
            
            // Remove all selected states
            leftBtn.classList.remove('selected');
            rightBtn.classList.remove('selected');
            
            // Add selected state based on current selection
            if (selectedDocCam === 'left') {
                leftBtn.classList.add('selected');
            } else if (selectedDocCam === 'right') {
                rightBtn.classList.add('selected');
            }
        }
        
        // PHASE 5: Blu-ray Controls Menu Functions
        function openBlurayMenu() {
            const menu = document.getElementById('blurayControlsMenu');
            menu.classList.add('active');
        }
        
        function closeBlurayMenu() {
            const menu = document.getElementById('blurayControlsMenu');
            menu.classList.remove('active');
        }
        
        // PHASE 8: Flash blu-ray button to give feedback
        function flashBlurayButton(button) {
            const originalBg = button.style.background || (button.classList.contains('center-btn') ? '#425563' : 'white');
            const originalColor = button.style.color || (button.classList.contains('center-btn') ? 'white' : '#101820');
            
            button.style.background = '#5CB8B2';
            button.style.color = 'white';
            setTimeout(() => {
                button.style.background = originalBg;
                button.style.color = originalColor;
            }, 200);
        }
        
        // PHASE 6: Projector Screen Controls
        function toggleScreen(element, side, direction) {
            // Preview-style flash effect
            element.classList.add('active');
            setTimeout(() => element.classList.remove('active'), 300);
            
            if (side === 'left') {
                leftScreenDown = (direction === 'down');
            } else {
                rightScreenDown = (direction === 'down');
            }
            
            updateRoomView(side);
        }
        
        // PHASE 2: Project Controls Menu Functions
        let projectLeftSelected = false;
        let projectRightSelected = false;
        
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
            
            // PHASE 2: In 1-projector mode, project directly without menu
            if (projectorMode === 1) {
                leftProjectSource = currentSource;
                leftProjecting = true;
                updateScreenDisplay('left');
                updateRoomView('left');
                
                // Flash the button with gold color (same as menu-open style)
                element.classList.add('menu-open');
                setTimeout(() => element.classList.remove('menu-open'), 300);
                return;
            }
            
            // Close hide and freeze menus but NOT doc cam or bluray menus
            closeHideControls();
            closeFreezeControls();
            
            // Update button states to reflect current projection state
            updateProjectButtonStates();
            
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
        
        function updateProjectButtonStates() {
            const leftBtn = document.getElementById('projectLeftBtn');
            const rightBtn = document.getElementById('projectRightBtn');
            const bothBtn = document.getElementById('projectBothBtn');
            
            // Remove all selected states - no highlighting on project buttons
            leftBtn.classList.remove('selected');
            rightBtn.classList.remove('selected');
            bothBtn.classList.remove('selected');
        }
        
        function projectToScreen(side) {
            if (!currentSource) {
                flashSourceWarning();
                return;
            }
            
            if (side === 'left') {
                leftProjectSource = currentSource;
                leftProjecting = true;
                updateScreenDisplay('left');
                updateRoomView('left');
                // Just update button states, don't auto-close
                updateProjectButtonStates();
                
                // PHASE 8: Flash the button that was clicked
                const projectBtn = document.getElementById('projectLeftBtn');
                flashProjectButton(projectBtn);
            } else if (side === 'right') {
                rightProjectSource = currentSource;
                rightProjecting = true;
                updateScreenDisplay('right');
                updateRoomView('right');
                // Just update button states, don't auto-close
                updateProjectButtonStates();
                
                // PHASE 8: Flash the button that was clicked
                const projectBtn = document.getElementById('projectRightBtn');
                flashProjectButton(projectBtn);
            } else if (side === 'both') {
                leftProjectSource = currentSource;
                rightProjectSource = currentSource;
                leftProjecting = true;
                rightProjecting = true;
                updateScreenDisplay('left');
                updateScreenDisplay('right');
                updateRoomView('left');
                updateRoomView('right');
                // Just update button states, don't auto-close
                updateProjectButtonStates();
                
                // PHASE 8: Flash the button that was clicked
                const projectBtn = document.getElementById('projectBothBtn');
                flashProjectButton(projectBtn);
            }
        }
        
        // PHASE 8: Flash project button to give feedback
        function flashProjectButton(button) {
            button.classList.add('selected');
            setTimeout(() => {
                button.classList.remove('selected');
            }, 300);
        }
        
        // PHASE 3: Hide & Mute Controls Menu Functions
        function openHideControls(element) {
            // Check if power is on first
            if (!systemPower) {
                flashPowerWarning();
                return;
            }
            
            // PHASE 2: In 1-projector mode, toggle hide/mute directly
            if (projectorMode === 1) {
                leftMuted = !leftMuted;
                updateRoomView('left');
                
                // Update button appearance to show persistent state
                if (leftMuted) {
                    element.classList.add('mute-active');
                } else {
                    element.classList.remove('mute-active');
                }
                
                updateAudioButtonState();
                return;
            }
            
            // Close project and freeze menus but NOT doc cam or bluray menus
            closeProjectControls();
            closeFreezeControls();
            
            // Update button states to reflect current hide/mute state
            updateHideButtonStates();
            
            // Highlight the HIDE & MUTE button with menu-open style
            // Keep mute-active if screens are muted, just add menu-open on top
            element.classList.add('hide-menu-open');
            
            // Open the hide controls menu
            const menu = document.getElementById('hideControlsMenu');
            menu.classList.add('active');
        }
        
        function closeHideControls() {
            const menu = document.getElementById('hideControlsMenu');
            menu.classList.remove('active');
            
            // Find the hide button by looking for the one that opens this menu
            const hideBtn = document.querySelector('.control-btn[onclick*="openHideControls"]');
            
            if (hideBtn) {
                // Always remove menu-open state first
                hideBtn.classList.remove('hide-menu-open');
                
                // Only add mute-active if at least one screen is actually muted
                // Remove it first to ensure clean state
                hideBtn.classList.remove('mute-active');
                if (leftMuted || rightMuted) {
                    hideBtn.classList.add('mute-active');
                }
            }
        }
        
        function updateHideButtonStates() {
            const leftBtn = document.getElementById('hideLeftBtn');
            const rightBtn = document.getElementById('hideRightBtn');
            const bothBtn = document.getElementById('hideBothBtn');
            
            // Remove all selected states
            leftBtn.classList.remove('selected');
            rightBtn.classList.remove('selected');
            bothBtn.classList.remove('selected');
            
            // Add selected state based on current mute state
            if (leftMuted) {
                leftBtn.classList.add('selected');
            }
            if (rightMuted) {
                rightBtn.classList.add('selected');
            }
        }
        
        function hideScreen(side) {
            if (side === 'left') {
                leftMuted = !leftMuted;
                updateRoomView('left');
                updateHideButtonStates();
            } else if (side === 'right') {
                rightMuted = !rightMuted;
                updateRoomView('right');
                updateHideButtonStates();
            } else if (side === 'both') {
                // Toggle both - if either is visible, hide both. If both hidden, show both.
                const shouldHide = !leftMuted || !rightMuted;
                leftMuted = shouldHide;
                rightMuted = shouldHide;
                updateRoomView('left');
                updateRoomView('right');
                updateHideButtonStates();
            }
            
            // BATCH 2 FIX #5: Update audio button state when muting changes
            updateAudioButtonState();
        }
        
        // Update freeze button persistent state
        function updateFreezeButtonPersistentState() {
            const freezeBtn = document.querySelectorAll('.control-btn')[4]; // 5th button (0-indexed) - after LEFT PREVIEW, RIGHT PREVIEW, PROJECT, FREEZE
            if (freezeBtn && !document.getElementById('freezeControlsMenu').classList.contains('active')) {
                // Only update if menu is closed
                if (leftFrozen || rightFrozen) {
                    freezeBtn.classList.add('freeze-active');
                } else {
                    freezeBtn.classList.remove('freeze-active');
                }
            }
        }
        
        // Helper function to check if freeze is possible
        function canFreeze(side) {
            const isProjecting = side === 'left' ? leftProjecting : rightProjecting;
            
            return systemPower &&      // Power must be ON
                   currentSource &&    // Source must be selected
                   isProjecting;       // Content must be projecting (not just previewed)
                                       // NOTE: Blanked screens CAN be frozen (freeze is hidden by blank)
        }
        
        // Freeze warning flash (like source/power warnings)
        function flashFreezeWarning(element) {
            const originalBg = element.style.background || '';
            const originalColor = element.style.color || '';
            
            // Flash gray to indicate "can't do this"
            element.style.background = '#425563';
            element.style.color = 'white';
            
            setTimeout(() => {
                element.style.background = originalBg;
                element.style.color = originalColor;
            }, 300);
        }
        
        // Project warning flash (gold) - shows when trying to freeze but nothing is projecting yet
        function flashProjectWarning(element) {
            // Flash exactly like the source warning - add/remove class for animation
            element.classList.add('source-warning');
            setTimeout(() => {
                element.classList.remove('source-warning');
            }, 1000);
        }
        
        // Freeze Controls Menu Functions
        function openFreezeControls(element) {
            // Check if power is on first
            if (!systemPower) {
                flashPowerWarning();
                return;
            }
            
            // NEW: Check if anything is actually projecting
            if (!leftProjecting && !rightProjecting) {
                // Nothing projecting - flash the PROJECT button in gold to guide user
                const projectBtn = document.querySelectorAll('.control-btn')[2]; // PROJECT button
                if (projectBtn) {
                    flashProjectWarning(projectBtn);
                }
                return;
            }
            
            // PHASE 2: In 1-projector mode, toggle freeze directly
            if (projectorMode === 1) {
                // Only allow if left can be frozen
                if (!canFreeze('left')) {
                    // Flash warning if conditions not met
                    flashFreezeWarning(element);
                    return;
                }
                
                leftFrozen = !leftFrozen;
                updateRoomView('left'); // NEW: Update room view to show frozen state
                
                // Update button appearance to show persistent state
                if (leftFrozen) {
                    element.classList.add('freeze-active');
                } else {
                    element.classList.remove('freeze-active');
                }
                return;
            }
            
            // Close project and hide menus when freeze opens
            closeProjectControls();
            closeHideControls();
            
            // Update button states to reflect current freeze state
            updateFreezeButtonStates();
            
            // Highlight the FREEZE button with menu-open style
            element.classList.add('freeze-menu-open');
            
            // Open the freeze controls menu
            const menu = document.getElementById('freezeControlsMenu');
            menu.classList.add('active');
        }
        
        function closeFreezeControls() {
            const menu = document.getElementById('freezeControlsMenu');
            menu.classList.remove('active');
            
            // Find the freeze button
            const freezeBtn = document.querySelector('.control-btn[onclick*="openFreezeControls"]');
            
            if (freezeBtn) {
                // Always remove menu-open state first
                freezeBtn.classList.remove('freeze-menu-open');
                
                // Only add freeze-active if at least one screen is actually frozen
                freezeBtn.classList.remove('freeze-active');
                if (leftFrozen || rightFrozen) {
                    freezeBtn.classList.add('freeze-active');
                }
            }
        }
        
        function updateFreezeButtonStates() {
            const leftBtn = document.getElementById('freezeLeftBtn');
            const rightBtn = document.getElementById('freezeRightBtn');
            const bothBtn = document.getElementById('freezeBothBtn');
            
            // Remove all selected states
            leftBtn.classList.remove('selected');
            rightBtn.classList.remove('selected');
            bothBtn.classList.remove('selected');
            
            // Add selected state based on current freeze state
            if (leftFrozen) {
                leftBtn.classList.add('selected');
            }
            if (rightFrozen) {
                rightBtn.classList.add('selected');
            }
        }
        
        function freezeScreen(side) {
            // Can freeze blanked screens - freeze is just hidden by the blank state
            if (side === 'left') {
                // Check if can freeze (power on, source selected, projecting)
                // Blanked screens CAN be frozen
                if (!leftFrozen && !canFreeze('left')) {
                    return; // Can't freeze if not projecting
                }
                leftFrozen = !leftFrozen;
                updateRoomView('left');
                updateFreezeButtonStates();
            } else if (side === 'right') {
                // Check if can freeze
                if (!rightFrozen && !canFreeze('right')) {
                    return; // Can't freeze if not projecting
                }
                rightFrozen = !rightFrozen;
                updateRoomView('right');
                updateFreezeButtonStates();
            } else if (side === 'both') {
                // Toggle both - only affect screens that can be frozen
                const shouldFreeze = !leftFrozen || !rightFrozen;
                
                if (shouldFreeze) {
                    // Trying to freeze - only freeze screens that CAN be frozen
                    if (canFreeze('left')) {
                        leftFrozen = true;
                    }
                    if (canFreeze('right')) {
                        rightFrozen = true;
                    }
                } else {
                    // Trying to unfreeze - always allow
                    leftFrozen = false;
                    rightFrozen = false;
                }
                
                updateRoomView('left');
                updateRoomView('right');
                updateFreezeButtonStates();
            }
        }
        
        // Loading Screen Control
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
                    
                    if (callback) callback();
                }, 300);
            }
            
            // Add keyboard shortcut to skip loading
            document.addEventListener('keydown', skipLoading, { once: true });
            
            // Wait for duration then hide
            timeout = setTimeout(() => {
                overlay.classList.remove('active');
                document.removeEventListener('keydown', skipLoading);
                
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
                // PHASE 6: Drop screens when powering on
                leftScreenDown = true;
                rightScreenDown = true;
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
            
            // USER CONTROL FIX: Raise screens when powering off (return to safe state)
            leftScreenDown = false;
            rightScreenDown = false;
            
            // Update room view to reflect screen changes
            updateRoomView('left');
            updateRoomView('right');
            
            // Power off - close menus and reset everything
            closeProjectControls();
            closeHideControls();
            resetSystem();
        }
        
        // Volume slider updates
        function updateVolumeSlider(slider, percentId) {
            if (!slider) return;
            
            const value = parseInt(slider.value);
            const percent = document.getElementById(percentId);
            
            if (percent) {
                // BATCH 3 FIX #8: Add warning above 90% volume for main volume
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
            // PHASE 6: Drop screens
            leftScreenDown = true;
            rightScreenDown = true;
            
            const desktopBtn = document.querySelector('.source-btn');
            selectSource(desktopBtn, 'desktop');
            
            setTimeout(() => {
                const controlBtns = document.querySelectorAll('.control-btn');
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
                    
                    // PHASE 8: Also play audio from desktop
                    setTimeout(() => {
                        const audioBtn = document.querySelector('.audio-btn');
                        if (audioBtn && currentSource) {
                            audioPlaying = true;
                            audioSource = currentSource;
                            audioBtn.classList.add('active');
                            
                            const textSpan = audioBtn.querySelector('span:last-child');
                            if (textSpan) {
                                textSpan.textContent = `PLAYING AUDIO FROM: ${currentSource.toUpperCase()}`;
                            }
                        }
                    }, 200);
                }, 300);
            }, 300);
        }
        
        // Reset system - used when powering off
        function resetSystem() {
            currentSource = null;
            selectedDocCam = null;
            leftPreviewSource = null;
            rightPreviewSource = null;
            leftProjectSource = null;
            rightProjectSource = null;
            leftProjecting = false;
            rightProjecting = false;
            leftMuted = false;
            rightMuted = false;
            leftFrozen = false;
            rightFrozen = false;
            audioPlaying = false;
            audioSource = null;
            audioDocCam = null;
            
            // PHASE 6: Reset screen state (already done in togglePower, but included for completeness)
            leftScreenDown = false;
            rightScreenDown = false;
            
            updateScreenDisplay('left');
            updateScreenDisplay('right');
            updateRoomView('left');
            updateRoomView('right');
            
            // BATCH 1 FIX #2: Close all menus on power off
            closeDocCamMenu();
            closeBlurayMenu();
            closeProjectControls();
            closeHideControls();
            closeFreezeControls();
            
            document.querySelectorAll('.control-btn').forEach(btn => {
                btn.classList.remove('preview-active', 'project-active', 'mute-active', 'hide-menu-open');
            });
            
            document.querySelectorAll('.source-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            document.querySelectorAll('.camera-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            const audioBtn = document.querySelector('.audio-btn');
            if (audioBtn) {
                audioBtn.classList.remove('active');
                audioBtn.style.background = '';
                audioBtn.style.color = '';
                const textSpan = audioBtn.querySelector('span:last-child');
                if (textSpan) {
                    textSpan.textContent = 'PLAY AUDIO FROM SELECTED INPUT';
                }
            }
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
            
            // Define task content
            const tasks = {
                'project': {
                    title: 'How to Project Content',
                    steps: [
                        { icon: 'Icons/PowerIcon.webp', text: 'Press POWER ON (bottom right corner)' },
                        { icon: 'Icons/DeskTopIcon.png', text: 'Pick what you want to show from the left side (Desktop PC, Laptop, Document Camera, etc.)' },
                        { icon: 'Icons/LeftPreviewIcon.png', text: 'Press PREVIEW to check it looks right on your screen first' },
                        { icon: 'Icons/ProjectIcon.png', text: 'Press PROJECT to show it on the projector screens' },
                        { icon: 'Icons/HideRightLeftIcon.png', text: 'To hide the screens from students, press HIDE & MUTE' }
                    ]
                },
                'audio': {
                    title: 'Play Sound Through Speakers',
                    steps: [
                        { icon: 'Icons/DeskTopIcon.png', text: 'First, pick what you want to play from the left side (Desktop PC, Mac, your Laptop, Document Camera, Blu-ray, or Wireless)' },
                        { icon: 'Icons/PlayAudio.png', text: 'Press the PLAY AUDIO button in the middle section' },
                        { icon: 'Icons/Unmuted.png', text: 'Use the volume sliders on the right to adjust MAIN VOLUME (speakers) or MIC VOLUME. Click the speaker icon below each slider to quickly mute/unmute' }
                    ]
                }
            };
            
            const task = tasks[taskType];
            titleEl.textContent = task.title;
            
            // Build steps HTML with icons
            stepsEl.innerHTML = task.steps.map((step, index) => `
                <div class="help-step">
                    <div class="help-step-number">${index + 1}</div>
                    ${step.icon ? `<img src="${step.icon}" alt="Step ${index + 1}" class="help-step-icon">` : '<div class="help-step-spacer"></div>'}
                    <div class="help-step-text">${step.text}</div>
                </div>
            `).join('');
        }
        
        function showGuidebook() {
            // Hide main content, show guidebook
            document.getElementById('helpMainContent').style.display = 'none';
            document.getElementById('helpTaskDetail').style.display = 'none';
            document.getElementById('helpGuidebook').style.display = 'block';
        }
        

        
        // Phase 1: Fullscreen functionality
        function enterFullscreen(side) {
            const screen = document.getElementById(side + 'Screen');
            const previewSource = side === 'left' ? leftPreviewSource : rightPreviewSource;
            const docCamSide = side === 'left' ? leftDocCamSide : rightDocCamSide; // NEW: Use tracked doc cam side
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
                // NEW: Use the tracked doc cam side for this specific screen
                const effectiveDocCam = (previewSource === 'doccam') ? docCamSide : null;
                const isConnected = (previewSource === 'doccam' && effectiveDocCam === 'left') ? false : true;
                
                if (!isConnected) {
                    // No input detected - show warning with doc cam side info
                    fullscreenImage.style.display = 'none';
                    fullscreenText.style.display = 'block';
                    fullscreenText.textContent = `${effectiveDocCam.toUpperCase()} DOC CAM - No Input Detected`;
                    fullscreenText.classList.add('no-input');
                } else {
                    // Show content
                    const wallpaper = sourceWallpapers[previewSource];
                    if (wallpaper) {
                        fullscreenImage.src = wallpaper;
                        fullscreenImage.style.display = 'block';
                        fullscreenText.style.display = 'none';
                    } else {
                        // Fallback text - use tracked doc cam side
                        fullscreenImage.style.display = 'none';
                        fullscreenText.style.display = 'block';
                        let displayText = previewSource.toUpperCase();
                        if (previewSource === 'doccam' && effectiveDocCam) {
                            displayText = `${effectiveDocCam.toUpperCase()} DOC CAM`;
                        }
                        fullscreenText.textContent = `Preview: ${displayText}`;
                        fullscreenText.classList.remove('no-input');
                    }
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
                leftScreen.addEventListener('click', function(e) {
                    // Don't trigger if clicking on status badge
                    if (!e.target.classList.contains('screen-status')) {
                        enterFullscreen('left');
                    }
                });
            }
            
            if (rightScreen) {
                rightScreen.addEventListener('click', function(e) {
                    // Don't trigger if clicking on status badge
                    if (!e.target.classList.contains('screen-status')) {
                        enterFullscreen('right');
                    }
                });
            }
        }
        
        // ESC key to exit fullscreen (for development/testing only)
        // MOVED TO COMBINED LISTENER AT END OF FILE
        
        // Initialize volume sliders on page load
        document.addEventListener('DOMContentLoaded', function() {
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
                fullscreenOverlay.addEventListener('click', function() {
                    exitFullscreen();
                });
            }
            
            // Initialize student view to show arrows
            initializeStudentView();
            
            // Help system back button - goes back to main content if in detail/guidebook view
            const helpBackBtn = document.getElementById('helpBackBtn');
            if (helpBackBtn) {
                // Remove the onclick from HTML and add smart behavior
                helpBackBtn.onclick = null;
                helpBackBtn.addEventListener('click', function(e) {
                    const mainContent = document.getElementById('helpMainContent');
                    const taskDetail = document.getElementById('helpTaskDetail');
                    const guidebook = document.getElementById('helpGuidebook');
                    
                    // If we're in a detail view, go back to main content
                    if (taskDetail.style.display !== 'none' || guidebook.style.display !== 'none') {
                        mainContent.style.display = 'flex';
                        taskDetail.style.display = 'none';
                        guidebook.style.display = 'none';
                    } else {
                        // Otherwise close the help overlay
                        closeHelp();
                    }
                });
            }
            
            // Save volume when user starts dragging (before they drag to 0)
            micSlider.addEventListener('mousedown', function() {
                if (micSlider.value > 0) {
                    micPreviousVolume = parseInt(micSlider.value);
                }
            });
            micSlider.addEventListener('touchstart', function() {
                if (micSlider.value > 0) {
                    micPreviousVolume = parseInt(micSlider.value);
                }
            });
            
            mainSlider.addEventListener('mousedown', function() {
                if (mainSlider.value > 0) {
                    mainPreviousVolume = parseInt(mainSlider.value);
                }
            });
            mainSlider.addEventListener('touchstart', function() {
                if (mainSlider.value > 0) {
                    mainPreviousVolume = parseInt(mainSlider.value);
                }
            });
        });
        
        // PHASE 2: Combined keyboard shortcuts listener
        document.addEventListener('keydown', function(e) {
            // ESC to exit fullscreen
            if (e.key === 'Escape') {
                exitFullscreen();
            }
            
            // Backtick to toggle demo view
            if (e.key === '`' || e.key === '~') {
                toggleDemoView();
            }
            
            // Shift+1 = 1 projector mode (use e.code to detect actual key, not shifted character)
            if (e.shiftKey && e.code === 'Digit1') {
                e.preventDefault(); // Prevent any default behavior
                switchProjectorMode(1);
            }
            
            // Shift+2 = 2 projector mode
            if (e.shiftKey && e.code === 'Digit2') {
                e.preventDefault(); // Prevent any default behavior
                switchProjectorMode(2);
            }
            
            // Konami code tracking
            konamiCodeTracker(e.key);
        });
        
        // Konami Code Easter Egg
        let konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        let konamiProgress = [];
        
        function konamiCodeTracker(key) {
            konamiProgress.push(key);
            
            // Keep only the last 10 keys
            if (konamiProgress.length > 10) {
                konamiProgress.shift();
            }
            
            // Check if the sequence matches
            if (konamiProgress.length === 10) {
                let matches = true;
                for (let i = 0; i < 10; i++) {
                    if (konamiProgress[i] !== konamiCode[i]) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches) {
                    activateKonamiEasterEgg();
                    konamiProgress = []; // Reset
                }
            }
        }
        
        function activateKonamiEasterEgg() {
            // Create image element
            const img = document.createElement('img');
            img.src = 'Secret/lucas_nobackground_2.png';
            img.id = 'konamiImage';
            img.style.cssText = `
                position: fixed;
                bottom: -1000px;
                right: -300px;
                width: 200px;
                height: auto;
                z-index: 99999;
                display: block;
            `;
            document.body.appendChild(img);
            
            // Play audio
            const audio = new Audio('Secret/screeeching.mp3');
            audio.play();
            
            // Animation sequence: bounce up, bounce down slightly, then slide across
            const bounceDuration = 300;
            const pauseBeforeSlide = 300;
            const slideSpeed = 1700;
            
            // Calculate how far to slide (from current position to off-screen left)
            const slideDistance = window.innerWidth + 400; // Past the left edge
            
            // Step 1: Bounce up to 0
            setTimeout(() => {
                img.style.transition = `bottom ${bounceDuration}ms ease-out`;
                img.style.bottom = '0px';
            }, 50);
            
            // Step 2: Bounce back down slightly
            setTimeout(() => {
                img.style.transition = `bottom ${bounceDuration}ms ease-out`;
                img.style.bottom = '-30px';
            }, 50 + bounceDuration);
            
            // Step 3: Slide across the screen
            setTimeout(() => {
                img.style.transition = `right ${slideSpeed}ms linear`;
                img.style.right = slideDistance + 'px';
            }, 50 + bounceDuration + bounceDuration + pauseBeforeSlide);
            
            // Remove after animation completes
            setTimeout(() => {
                img.remove();
            }, 50 + bounceDuration + bounceDuration + pauseBeforeSlide + slideSpeed + 200);
        }