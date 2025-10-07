// State variables
let projectorMode = 2; // 1 or 2 projectors (default 2)
        let currentSource = null;
        let selectedDocCam = null; // 'left' or 'right' when doc cam is selected
        let leftPreviewSource = null;
        let rightPreviewSource = null;
        let leftProjectSource = null;  // What's actually being projected on left
        let rightProjectSource = null; // What's actually being projected on right
        let leftProjecting = false;
        let rightProjecting = false;
        let leftMuted = false;
        let rightMuted = false;
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
            const hideBtn = document.querySelectorAll('.control-btn')[4]; // 5th button
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
                selectedDocCam = null;
            } else {
                // Close both doc cam and bluray menus if switching to different source
                closeDocCamMenu();
                closeBlurayMenu();
                selectedDocCam = null;
            }
        }
        
        // Update room view (what's actually being projected)
        function updateRoomView(side) {
            const display = document.getElementById(side + 'ProjectorDisplay');
            const isMuted = side === 'left' ? leftMuted : rightMuted;
            const isProjecting = side === 'left' ? leftProjecting : rightProjecting;
            const projectSource = side === 'left' ? leftProjectSource : rightProjectSource;
            const screenDown = side === 'left' ? leftScreenDown : rightScreenDown;
            
            display.classList.remove('blanked', 'projecting');
            
            // PHASE 6: Show screen position with bigger arrow
            let screenIcon = screenDown ? ' ▼' : ' ▲';
            
            if (isMuted && isProjecting) {
                display.textContent = 'BLANKED' + screenIcon;
                display.classList.add('blanked');
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
                updateScreenDisplay('left');
            } else {
                rightPreviewSource = currentSource;
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
            const status = document.getElementById(side + 'Status');
            
            if (!screen || !status) {
                return;
            }
            
            const previewSource = side === 'left' ? leftPreviewSource : rightPreviewSource;
            
            // Preview screens ONLY show previews, NOT mute or projection state
            if (previewSource) {
                // Check if source is connected
                const isConnected = isSourceConnected(previewSource);
                
                if (!isConnected) {
                    // Show "No Input" badge for disconnected sources
                    let displayText = previewSource.toUpperCase();
                    if (previewSource === 'doccam' && selectedDocCam) {
                        displayText = `${selectedDocCam.toUpperCase()} DOC CAM`;
                    }
                    screen.innerHTML = `<span style="color: #A6192E;">No Input Detected</span><span class="screen-status no-input" id="${side}Status">No Input</span>`;
                    screen.style.backgroundColor = '#000';
                } else {
                    const wallpaper = sourceWallpapers[previewSource];
                    
                    if (wallpaper) {
                        // Show wallpaper image
                        screen.innerHTML = `<img src="${wallpaper}" alt="${previewSource}"><span class="screen-status" id="${side}Status">Preview</span>`;
                    } else {
                        // Fallback to text for sources without wallpapers
                        let displayText = previewSource.toUpperCase();
                        if (previewSource === 'doccam' && selectedDocCam) {
                            displayText = `${selectedDocCam.toUpperCase()} DOC CAM`;
                        }
                        screen.innerHTML = `<span>Preview: ${displayText}</span><span class="screen-status" id="${side}Status">Preview</span>`;
                    }
                    
                    screen.style.backgroundColor = '#425563';
                    const newStatus = document.getElementById(side + 'Status');
                    if (newStatus) {
                        newStatus.style.background = 'rgba(92, 184, 178, 0.9)';
                        newStatus.style.color = '#101820';
                    }
                }
            } else {
                screen.innerHTML = `<span>No Input Selected</span><span class="screen-status" id="${side}Status">Ready</span>`;
                screen.style.backgroundColor = '#000';
                const newStatus = document.getElementById(side + 'Status');
                if (newStatus) {
                    newStatus.style.background = 'rgba(206, 184, 136, 0.9)';
                    newStatus.style.color = '#101820';
                }
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
            
            // Close hide menu but NOT doc cam menu
            closeHideControls();
            
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
            
            // Close project menu but NOT doc cam menu
            closeProjectControls();
            
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
        
        // Loading Screen Control
        function showLoadingScreen(callback) {
            const overlay = document.getElementById('loadingOverlay');
            const progressBar = document.getElementById('progressBar');
            const progressPercentage = document.getElementById('progressPercentage');
            
            overlay.classList.add('active');
            
            let progress = 0;
            const duration = 15000; // 15 seconds
            const intervalTime = 100; // Update every 100ms
            const totalSteps = duration / intervalTime;
            const increment = 100 / totalSteps;
            let interval;
            
            // Function to complete loading immediately
            function skipLoading() {
                clearInterval(interval);
                progress = 100;
                progressBar.style.width = '100%';
                progressPercentage.textContent = '100%';
                
                setTimeout(() => {
                    overlay.classList.remove('active');
                    progressBar.style.width = '0%';
                    progressPercentage.textContent = '0%';
                    document.removeEventListener('keydown', skipLoading);
                    
                    if (callback) callback();
                }, 300);
            }
            
            // Add keyboard shortcut to skip loading
            document.addEventListener('keydown', skipLoading, { once: true });
            
            interval = setInterval(() => {
                progress += increment;
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    // Wait a brief moment at 100% then fade out
                    setTimeout(() => {
                        overlay.classList.remove('active');
                        progressBar.style.width = '0%';
                        progressPercentage.textContent = '0%';
                        document.removeEventListener('keydown', skipLoading);
                        
                        // Execute callback after loading completes
                        if (callback) callback();
                    }, 500);
                }
                
                progressBar.style.width = progress + '%';
                progressPercentage.textContent = Math.round(progress) + '%';
            }, intervalTime);
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
                    percent.innerHTML = `${value}% <span style="color: #FFC72C; font-size: 9px; display: block; line-height: 1.2; margin-top: 2px;">⚠ HIGH</span>`;
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
                // BATCH 1 FIX #3: Swap emojis to show CURRENT state, not action
                if (value == 0) {
                    // At 0 - show as muted (muted speaker icon)
                    muteBtn.classList.add('active');
                    muteBtn.textContent = '🔇';
                } else {
                    // Above 0 - show as unmuted (speaker with sound icon)
                    muteBtn.classList.remove('active');
                    muteBtn.textContent = '🔊';
                }
            }
        }
        
        // Mute controls - syncs with volume sliders
        function toggleMute(element, type) {
            const slider = type === 'mic' ? 
                document.getElementById('micSlider') : 
                document.getElementById('mainSlider');
            const percentId = type === 'mic' ? 'micPercent' : 'mainPercent';
            
            element.classList.toggle('active');
            
            if (element.classList.contains('active')) {
                // MUTING - save current volume and set to 0
                if (type === 'mic') {
                    micPreviousVolume = slider.value;
                } else {
                    mainPreviousVolume = slider.value;
                }
                slider.value = 0;
                element.textContent = '🔇';
            } else {
                // UNMUTING - restore previous volume
                const previousVolume = type === 'mic' ? 
                    micPreviousVolume : mainPreviousVolume;
                slider.value = previousVolume;
                element.textContent = '🔊';
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
            alert(`FSU CLASSROOM CONTROL SYSTEM - QUICK START GUIDE

GETTING STARTED:
• Press "START CLASS" to quickly power on and setup Desktop PC on both screens
• Or follow the 3-step process: Select Input → Preview (optional) → Project

INPUT SOURCES:
Select your content source from the left panel (Desktop PC, Document Camera, Laptop, etc.)

SCREEN CONTROLS:
• PREVIEW: See the input on screen before showing students
• PROJECT: Display the input to students (preview optional)
• HIDE: Blank the screen (students see black screen)

AUDIO:
Use "PLAY AUDIO FROM SELECTED INPUT" to route audio to classroom speakers

LIGHTS:
Control classroom lighting from the center panel

POWER:
Power On/Off controls all classroom equipment

Need more help? Contact IT Support at (850) 644-HELP`);
        }
        
        // Phase 1: Fullscreen functionality
        function enterFullscreen(side) {
            const screen = document.getElementById(side + 'Screen');
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
            } else if (!isSourceConnected(previewSource)) {
                // No input detected - show warning
                fullscreenImage.style.display = 'none';
                fullscreenText.style.display = 'block';
                fullscreenText.textContent = 'No Input Detected';
                fullscreenText.classList.add('no-input');
            } else {
                // Show content
                const wallpaper = sourceWallpapers[previewSource];
                if (wallpaper) {
                    fullscreenImage.src = wallpaper;
                    fullscreenImage.style.display = 'block';
                    fullscreenText.style.display = 'none';
                } else {
                    // Fallback text
                    fullscreenImage.style.display = 'none';
                    fullscreenText.style.display = 'block';
                    let displayText = previewSource.toUpperCase();
                    if (previewSource === 'doccam' && selectedDocCam) {
                        displayText = `${selectedDocCam.toUpperCase()} DOC CAM`;
                    }
                    fullscreenText.textContent = `Preview: ${displayText}`;
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
        });