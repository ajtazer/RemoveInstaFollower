// Instagram Follower Removal Script with UI
// Paste this in the browser console on your Instagram followers page

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        DELAY_BETWEEN_REMOVALS: 2000, // 2 seconds between removals
        DELAY_AFTER_CONFIRMATION: 5000, // 5 seconds after confirmation
        MAX_RETRIES: 3,
        SCROLL_INTERVAL: 3000,
        SCROLL_INCREMENT: 500,
        MAX_FOLLOWERS: 1000,
        AUTO_START: false
    };
    
    // State tracking
    let state = {
        isRunning: false,
        removedCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        startTime: null,
        currentUsername: '',
        isPaused: false
    };
    
    // DOM Elements
    let uiContainer;
    let logContainer;
    let progressBar;
    let statusText;
    let startBtn;
    let stopBtn;
    let pauseBtn;
    let configBtn;
    let statsContainer;
    
    // Utility functions
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    function addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${type}`;
        logElement.innerHTML = `
            <span class="log-time">[${timestamp}]</span>
            <span class="log-message">${message}</span>
        `;
        
        logContainer.appendChild(logElement);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Also log to console
        const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
        switch(type) {
            case 'error': console.error(`${prefix} ${message}`); break;
            case 'success': console.log(`${prefix} ${message}`); break;
            case 'warning': console.warn(`${prefix} ${message}`); break;
            default: console.log(`${prefix} ${message}`);
        }
    }
    
    function updateUI() {
        // Update stats
        statsContainer.innerHTML = `
            <div class="stat">
                <div class="stat-value">${state.removedCount}</div>
                <div class="stat-label">Removed</div>
            </div>
            <div class="stat">
                <div class="stat-value">${state.failedCount}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat">
                <div class="stat-value">${state.totalProcessed}</div>
                <div class="stat-label">Processed</div>
            </div>
            <div class="stat">
                <div class="stat-value">${state.isRunning ? (state.isPaused ? '⏸️' : '▶️') : '⏹️'}</div>
                <div class="stat-label">Status</div>
            </div>
        `;
        
        // Update progress bar
        const progress = state.totalProcessed > 0 ? (state.totalProcessed / CONFIG.MAX_FOLLOWERS) * 100 : 0;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
        
        // Update status text
        if (state.isRunning) {
            if (state.isPaused) {
                statusText.textContent = '⏸️ Paused';
                statusText.style.color = '#FF9800';
            } else if (state.currentUsername) {
                statusText.textContent = `Removing: ${state.currentUsername}`;
                statusText.style.color = '#2196F3';
            } else {
                statusText.textContent = '▶️ Running...';
                statusText.style.color = '#4CAF50';
            }
        } else {
            statusText.textContent = '⏹️ Ready';
            statusText.style.color = '#666';
        }
        
        // Update button states
        startBtn.disabled = state.isRunning && !state.isPaused;
        stopBtn.disabled = !state.isRunning;
        pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
        pauseBtn.disabled = !state.isRunning;
    }
    
    function findRemoveButtons() {
        return Array.from(document.querySelectorAll('div[role="button"]')).filter(btn => 
            btn.textContent === 'Remove' && 
            !btn.closest('._a9-z')
        );
    }
    
    function findConfirmationDialog() {
        return document.querySelector('._a9-v');
    }
    
    function findConfirmRemoveButton() {
        const dialog = findConfirmationDialog();
        if (!dialog) return null;
        
        return Array.from(dialog.querySelectorAll('button')).find(btn => 
            btn.textContent === 'Remove' || 
            btn.classList.contains('_a9-_')
        );
    }
    
    function findCancelButton() {
        const dialog = findConfirmationDialog();
        if (!dialog) return null;
        
        return Array.from(dialog.querySelectorAll('button')).find(btn => 
            btn.textContent === 'Cancel' || 
            btn.classList.contains('_a9_1')
        );
    }
    
    function getFollowerUsername(button) {
        const parentContainer = button.closest('div.x1qnrgzn') || 
                               button.closest('div[role="button"]')?.parentElement?.parentElement;
        
        if (!parentContainer) return 'Unknown';
        
        const usernameElements = parentContainer.querySelectorAll('span._ap3a, a[href*="/"]');
        for (const el of usernameElements) {
            if (el.textContent && el.textContent.trim() && 
                !el.textContent.includes('·') && 
                el.textContent !== 'Follow') {
                return el.textContent.trim();
            }
        }
        
        return 'Unknown';
    }
    
    async function scrollToLoadMore() {
        addLog('Scrolling to load more followers...', 'info');
        const container = document.querySelector('div[style*="height: auto; overflow: hidden auto"]') ||
                         document.querySelector('div[style*="overflow: hidden auto"]');
        
        if (container) {
            const beforeScroll = findRemoveButtons().length;
            container.scrollTop += CONFIG.SCROLL_INCREMENT;
            await sleep(CONFIG.SCROLL_INTERVAL);
            const afterScroll = findRemoveButtons().length;
            
            if (afterScroll > beforeScroll) {
                addLog(`Loaded ${afterScroll - beforeScroll} more followers`, 'success');
            }
            
            return afterScroll > beforeScroll;
        }
        return false;
    }
    
    async function removeFollower(button, retryCount = 0) {
        const username = getFollowerUsername(button);
        state.currentUsername = username;
        updateUI();
        
        const attempt = retryCount + 1;
        addLog(`Attempt #${attempt}: Removing ${username}...`, 'info');
        
        try {
            // Click the remove button
            button.click();
            await sleep(1000);
            
            // Find and click confirmation
            const confirmButton = findConfirmRemoveButton();
            if (!confirmButton) {
                throw new Error('Confirmation dialog not found');
            }
            
            addLog(`Confirming removal of ${username}...`, 'info');
            confirmButton.click();
            
            // Wait for the process to complete
            addLog(`Waiting ${CONFIG.DELAY_AFTER_CONFIRMATION/1000}s for removal...`, 'info');
            await sleep(CONFIG.DELAY_AFTER_CONFIRMATION);
            
            // Verify removal
            if (findConfirmationDialog()) {
                throw new Error('Removal may have failed - dialog still present');
            }
            
            state.removedCount++;
            addLog(`✓ Successfully removed ${username}`, 'success');
            return true;
            
        } catch (error) {
            addLog(`Error removing ${username}: ${error.message}`, 'error');
            
            // Try to close any open dialog
            const cancelButton = findCancelButton();
            if (cancelButton) {
                cancelButton.click();
                await sleep(1000);
            }
            
            if (retryCount < CONFIG.MAX_RETRIES) {
                addLog(`Retrying ${username} (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`, 'warning');
                await sleep(CONFIG.DELAY_BETWEEN_REMOVALS);
                return removeFollower(button, retryCount + 1);
            }
            
            state.failedCount++;
            addLog(`✗ Failed to remove ${username} after ${CONFIG.MAX_RETRIES} attempts`, 'error');
            return false;
        } finally {
            state.currentUsername = '';
            updateUI();
        }
    }
    
    async function processFollowers() {
        if (state.isRunning && !state.isPaused) {
            addLog('Already running!', 'warning');
            return;
        }
        
        state.isRunning = true;
        state.isPaused = false;
        state.startTime = Date.now();
        updateUI();
        
        addLog('🚀 Starting follower removal process...', 'success');
        addLog(`Configuration: ${CONFIG.DELAY_BETWEEN_REMOVALS}ms between removals`, 'info');
        addLog(`Safety limit: ${CONFIG.MAX_FOLLOWERS} followers max`, 'info');
        
        try {
            let hasMoreFollowers = true;
            let consecutiveNoNewFollowers = 0;
            
            while (state.isRunning && state.totalProcessed < CONFIG.MAX_FOLLOWERS) {
                // Check if paused
                while (state.isPaused && state.isRunning) {
                    await sleep(1000);
                }
                
                if (!state.isRunning) break;
                
                // Find all remove buttons
                const buttons = findRemoveButtons();
                
                if (buttons.length === 0) {
                    addLog('No remove buttons found. Scrolling to load more...', 'info');
                    hasMoreFollowers = await scrollToLoadMore();
                    
                    if (!hasMoreFollowers) {
                        consecutiveNoNewFollowers++;
                        if (consecutiveNoNewFollowers >= 3) {
                            addLog('No new followers loaded after multiple attempts. Stopping.', 'info');
                            break;
                        }
                        await sleep(CONFIG.SCROLL_INTERVAL);
                        continue;
                    }
                    consecutiveNoNewFollowers = 0;
                    continue;
                }
                
                // Process each button
                for (const button of buttons) {
                    if (!state.isRunning || state.totalProcessed >= CONFIG.MAX_FOLLOWERS) break;
                    
                    // Check if paused
                    while (state.isPaused && state.isRunning) {
                        await sleep(1000);
                    }
                    
                    if (!state.isRunning) break;
                    
                    state.totalProcessed++;
                    const username = getFollowerUsername(button);
                    
                    addLog(`Processing ${state.totalProcessed}/${CONFIG.MAX_FOLLOWERS}: ${username}`, 'info');
                    
                    const success = await removeFollower(button);
                    
                    if (success) {
                        const elapsed = Date.now() - state.startTime;
                        const avgTime = state.removedCount > 0 ? elapsed / state.removedCount : 0;
                        
                        addLog(`Progress: ${state.removedCount} removed, ${state.failedCount} failed`, 'info');
                        addLog(`Elapsed: ${formatTime(elapsed)}, Avg: ${Math.round(avgTime)}ms/follower`, 'info');
                    }
                    
                    // Wait before next removal
                    if (state.isRunning && state.totalProcessed < CONFIG.MAX_FOLLOWERS) {
                        addLog(`Waiting ${CONFIG.DELAY_BETWEEN_REMOVALS/1000}s before next...`, 'info');
                        await sleep(CONFIG.DELAY_BETWEEN_REMOVALS);
                    }
                }
                
                // After processing all buttons, try to load more
                addLog('Processed current batch. Checking for more followers...', 'info');
                hasMoreFollowers = await scrollToLoadMore();
                
                if (!hasMoreFollowers) {
                    consecutiveNoNewFollowers++;
                    if (consecutiveNoNewFollowers >= 2) {
                        addLog('No more followers to load. Process complete!', 'success');
                        break;
                    }
                } else {
                    consecutiveNoNewFollowers = 0;
                }
            }
            
        } catch (error) {
            addLog(`Fatal error: ${error.message}`, 'error');
            addLog(error.stack, 'error');
        } finally {
            const totalTime = Date.now() - state.startTime;
            
            addLog('='.repeat(50), 'info');
            addLog('🏁 PROCESS COMPLETE', 'success');
            addLog(`Total processed: ${state.totalProcessed}`, 'info');
            addLog(`Successfully removed: ${state.removedCount}`, 'success');
            addLog(`Failed removals: ${state.failedCount}`, state.failedCount > 0 ? 'error' : 'info');
            addLog(`Total time: ${formatTime(totalTime)}`, 'info');
            addLog(`Average time per removal: ${state.removedCount > 0 ? Math.round(totalTime / state.removedCount) : 0}ms`, 'info');
            addLog('='.repeat(50), 'info');
            
            state.isRunning = false;
            state.isPaused = false;
            updateUI();
        }
    }
    
    function createUI() {
        // Remove existing UI if present
        const existingUI = document.getElementById('instagram-follower-remover-ui');
        if (existingUI) {
            existingUI.remove();
        }
        
        // Create main container
        uiContainer = document.createElement('div');
        uiContainer.id = 'instagram-follower-remover-ui';
        uiContainer.innerHTML = `
            <style>
                #instagram-follower-remover-ui {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 400px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                    border: 1px solid #e0e0e0;
                }
                
                .ui-header {
                    background: linear-gradient(135deg, #E1306C 0%, #833AB4 100%);
                    color: white;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .ui-header h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .ui-body {
                    padding: 20px;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                
                .stat {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                    border: 1px solid #e9ecef;
                }
                
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #E1306C;
                    margin-bottom: 4px;
                }
                
                .stat-label {
                    font-size: 11px;
                    color: #6c757d;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .progress-container {
                    background: #e9ecef;
                    border-radius: 10px;
                    height: 6px;
                    margin: 20px 0;
                    overflow: hidden;
                }
                
                .progress-bar {
                    background: linear-gradient(90deg, #E1306C 0%, #833AB4 100%);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s ease;
                }
                
                .status-text {
                    text-align: center;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 10px 0 20px;
                    min-height: 20px;
                }
                
                .button-group {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                
                .btn {
                    padding: 12px;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                
                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .btn-start {
                    background: #4CAF50;
                    color: white;
                }
                
                .btn-start:hover:not(:disabled) {
                    background: #45a049;
                }
                
                .btn-stop {
                    background: #f44336;
                    color: white;
                }
                
                .btn-stop:hover:not(:disabled) {
                    background: #d32f2f;
                }
                
                .btn-pause {
                    background: #FF9800;
                    color: white;
                }
                
                .btn-pause:hover:not(:disabled) {
                    background: #f57c00;
                }
                
                .btn-config {
                    background: #2196F3;
                    color: white;
                    grid-column: span 3;
                }
                
                .btn-config:hover:not(:disabled) {
                    background: #1976D2;
                }
                
                .log-container {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 15px;
                    height: 200px;
                    overflow-y: auto;
                    border: 1px solid #e9ecef;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 12px;
                }
                
                .log-entry {
                    padding: 4px 0;
                    border-bottom: 1px solid #f1f3f5;
                }
                
                .log-time {
                    color: #6c757d;
                    margin-right: 8px;
                }
                
                .log-info .log-message {
                    color: #495057;
                }
                
                .log-success .log-message {
                    color: #4CAF50;
                    font-weight: 600;
                }
                
                .log-error .log-message {
                    color: #f44336;
                    font-weight: 600;
                }
                
                .log-warning .log-message {
                    color: #FF9800;
                }
                
                .instructions {
                    background: #e3f2fd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-top: 15px;
                    font-size: 12px;
                    color: #1565c0;
                }
                
                .instructions h4 {
                    margin: 0 0 8px 0;
                    font-size: 13px;
                }
                
                .instructions ul {
                    margin: 0;
                    padding-left: 20px;
                }
                
                .instructions li {
                    margin: 4px 0;
                }
                
                .drag-handle {
                    cursor: move;
                    margin-left: auto;
                    opacity: 0.7;
                    padding: 4px;
                }
                
                .drag-handle:hover {
                    opacity: 1;
                }
            </style>
            
            <div class="ui-header">
                <div style="font-size: 24px;">👤</div>
                <h2>Instagram Follower Remover</h2>
                <div class="drag-handle" title="Drag to move">⎌</div>
            </div>
            
            <div class="ui-body">
                <div class="stats-grid" id="stats-container"></div>
                
                <div class="progress-container">
                    <div class="progress-bar" id="progress-bar"></div>
                </div>
                
                <div class="status-text" id="status-text">⏹️ Ready</div>
                
                <div class="button-group">
                    <button class="btn btn-start" id="start-btn">
                        <span>▶️</span> Start
                    </button>
                    <button class="btn btn-stop" id="stop-btn" disabled>
                        <span>⏹️</span> Stop
                    </button>
                    <button class="btn btn-pause" id="pause-btn" disabled>
                        <span>⏸️</span> Pause
                    </button>
                    <button class="btn btn-config" id="config-btn">
                        <span>⚙️</span> Settings
                    </button>
                </div>
                
                <div class="log-container" id="log-container"></div>
                
                <div class="instructions">
                    <h4>📋 Instructions:</h4>
                    <ul>
                        <li>Make sure you're on Instagram followers page</li>
                        <li>Click Start to begin removal</li>
                        <li>Keep this tab active</li>
                        <li>Do not navigate away during process</li>
                    </ul>
                </div>
            </div>
        `;
        
        document.body.appendChild(uiContainer);
        
        // Get references to elements
        logContainer = document.getElementById('log-container');
        progressBar = document.getElementById('progress-bar');
        statusText = document.getElementById('status-text');
        statsContainer = document.getElementById('stats-container');
        startBtn = document.getElementById('start-btn');
        stopBtn = document.getElementById('stop-btn');
        pauseBtn = document.getElementById('pause-btn');
        configBtn = document.getElementById('config-btn');
        
        // Add event listeners
        startBtn.addEventListener('click', () => processFollowers());
        stopBtn.addEventListener('click', () => {
            state.isRunning = false;
            addLog('Process stopped by user', 'warning');
            updateUI();
        });
        pauseBtn.addEventListener('click', () => {
            state.isPaused = !state.isPaused;
            addLog(state.isPaused ? 'Process paused' : 'Process resumed', 'info');
            updateUI();
        });
        
        configBtn.addEventListener('click', () => {
            const newDelay = prompt('Enter delay between removals (ms):', CONFIG.DELAY_BETWEEN_REMOVALS);
            const newConfDelay = prompt('Enter delay after confirmation (ms):', CONFIG.DELAY_AFTER_CONFIRMATION);
            const newMax = prompt('Enter maximum followers to process:', CONFIG.MAX_FOLLOWERS);
            
            if (newDelay) CONFIG.DELAY_BETWEEN_REMOVALS = parseInt(newDelay);
            if (newConfDelay) CONFIG.DELAY_AFTER_CONFIRMATION = parseInt(newConfDelay);
            if (newMax) CONFIG.MAX_FOLLOWERS = parseInt(newMax);
            
            addLog('Configuration updated', 'success');
            addLog(`Delay: ${CONFIG.DELAY_BETWEEN_REMOVALS}ms, Confirm: ${CONFIG.DELAY_AFTER_CONFIRMATION}ms, Max: ${CONFIG.MAX_FOLLOWERS}`, 'info');
        });
        
        // Make draggable
        const dragHandle = uiContainer.querySelector('.drag-handle');
        const header = uiContainer.querySelector('.ui-header');
        let isDragging = false;
        let offsetX, offsetY;
        
        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        
        function startDrag(e) {
            if (e.target !== dragHandle && !dragHandle.contains(e.target)) return;
            isDragging = true;
            const rect = uiContainer.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            uiContainer.style.cursor = 'grabbing';
        }
        
        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();
            uiContainer.style.left = (e.clientX - offsetX) + 'px';
            uiContainer.style.top = (e.clientY - offsetY) + 'px';
            uiContainer.style.right = 'auto';
        }
        
        function stopDrag() {
            isDragging = false;
            uiContainer.style.cursor = '';
        }
        
        // Initial update
        updateUI();
        addLog('UI initialized. Ready to start.', 'success');
        addLog('Make sure you are on Instagram followers page.', 'info');
    }
    
    function showConfigModal() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <style>
                .config-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    z-index: 1000000;
                    min-width: 400px;
                }
                
                .config-modal h3 {
                    margin: 0 0 20px 0;
                    color: #E1306C;
                }
                
                .config-group {
                    margin-bottom: 15px;
                }
                
                .config-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 600;
                    color: #333;
                }
                
                .config-group input {
                    width: 100%;
                    padding: 10px;
                    border: 2px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 14px;
                }
                
                .config-group input:focus {
                    outline: none;
                    border-color: #E1306C;
                }
                
                .modal-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 25px;
                }
                
                .modal-btn {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                }
                
                .modal-btn-save {
                    background: #4CAF50;
                    color: white;
                }
                
                .modal-btn-cancel {
                    background: #f44336;
                    color: white;
                }
                
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 999999;
                }
            </style>
            <div class="config-modal">
                <h3>⚙️ Configuration Settings</h3>
                <div class="config-group">
                    <label>Delay between removals (ms):</label>
                    <input type="number" id="config-delay" value="${CONFIG.DELAY_BETWEEN_REMOVALS}">
                </div>
                <div class="config-group">
                    <label>Delay after confirmation (ms):</label>
                    <input type="number" id="config-confirm-delay" value="${CONFIG.DELAY_AFTER_CONFIRMATION}">
                </div>
                <div class="config-group">
                    <label>Maximum followers to process:</label>
                    <input type="number" id="config-max-followers" value="${CONFIG.MAX_FOLLOWERS}">
                </div>
                <div class="config-group">
                    <label>Maximum retry attempts:</label>
                    <input type="number" id="config-retries" value="${CONFIG.MAX_RETRIES}">
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn modal-btn-save" id="save-config">Save</button>
                    <button class="modal-btn modal-btn-cancel" id="cancel-config">Cancel</button>
                </div>
            </div>
            <div class="modal-overlay"></div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#save-config').addEventListener('click', () => {
            CONFIG.DELAY_BETWEEN_REMOVALS = parseInt(document.getElementById('config-delay').value) || 2000;
            CONFIG.DELAY_AFTER_CONFIRMATION = parseInt(document.getElementById('config-confirm-delay').value) || 5000;
            CONFIG.MAX_FOLLOWERS = parseInt(document.getElementById('config-max-followers').value) || 1000;
            CONFIG.MAX_RETRIES = parseInt(document.getElementById('config-retries').value) || 3;
            
            addLog('Configuration saved', 'success');
            modal.remove();
        });
        
        modal.querySelector('#cancel-config').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
    }
    
    // Initialize everything
    function init() {
        // Create UI
        createUI();
        
        // Update config button to use modal
        configBtn.removeEventListener('click', configBtn.onclick);
        configBtn.addEventListener('click', showConfigModal);
        
        // Add initial logs
        addLog('Instagram Follower Remover loaded!', 'success');
        addLog('Version 1.0.0', 'info');
        addLog('Click Start to begin removing followers', 'info');
        
        // Expose functions globally for debugging
        window.followerRemover = {
            start: () => processFollowers(),
            stop: () => { state.isRunning = false; updateUI(); },
            pause: () => { state.isPaused = !state.isPaused; updateUI(); },
            getState: () => ({ ...state, config: CONFIG }),
            updateConfig: (newConfig) => Object.assign(CONFIG, newConfig),
            reset: () => {
                state = {
                    isRunning: false,
                    removedCount: 0,
                    failedCount: 0,
                    totalProcessed: 0,
                    startTime: null,
                    currentUsername: '',
                    isPaused: false
                };
                updateUI();
                addLog('State reset', 'info');
            }
        };
        
        console.log('%c🎯 Instagram Follower Remover Loaded!', 'font-size: 18px; color: #E1306C; font-weight: bold;');
        console.log('%cType "followerRemover.start()" in console or click Start button', 'color: #4CAF50;');
        
        // Auto-start if configured
        if (CONFIG.AUTO_START) {
            setTimeout(() => {
                addLog('Auto-starting in 3 seconds...', 'warning');
                setTimeout(() => processFollowers(), 3000);
            }, 2000);
        }
    }
    
    // Check if we're on Instagram
    if (!window.location.hostname.includes('instagram.com')) {
        const shouldContinue = confirm(
            'This script is designed for Instagram.com\n' +
            'You are currently on: ' + window.location.hostname + '\n\n' +
            'Do you want to continue anyway?'
        );
        
        if (!shouldContinue) {
            console.log('Script cancelled by user');
            return;
        }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();