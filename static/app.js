document.addEventListener('DOMContentLoaded', () => {
    // State management
    let activeMedication = null;
    let selectedImageBase64 = null;
    let cameraStream = null;
    let chatHistory = [];

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const scanLaser = document.getElementById('scanLaser');
    const uploadContent = document.querySelector('.drop-zone-content');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const clearBtn = document.getElementById('clearBtn');

    const inputTabs = document.querySelectorAll('.input-tab-btn');
    const inputPanels = document.querySelectorAll('.input-panel');

    const videoStream = document.getElementById('videoStream');
    const photoCanvas = document.getElementById('photoCanvas');
    const startCameraBtn = document.getElementById('startCameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    const cameraLaser = document.getElementById('cameraLaser');

    const manualSearchInput = document.getElementById('manualSearchInput');
    const manualSearchBtn = document.getElementById('manualSearchBtn');

    const resultsSection = document.getElementById('resultsSection');
    const noResultsPlaceholder = document.getElementById('noResultsPlaceholder');
    const resultsContent = document.getElementById('resultsContent');

    const medicationName = document.getElementById('medicationName');
    const medicationDesc = document.getElementById('medicationDesc');
    const medicationRiskBadge = document.getElementById('medicationRiskBadge');

    const ocrTokensBox = document.getElementById('ocrTokensBox');
    const ocrTokensList = document.getElementById('ocrTokensList');

    const resultTabs = document.querySelectorAll('.result-tab-btn');
    const resultPanels = document.querySelectorAll('.result-panel');

    const activeIngredientsList = document.getElementById('activeIngredientsList');
    const inactiveIngredientsList = document.getElementById('inactiveIngredientsList');
    const alternativesGrid = document.getElementById('alternativesGrid');
    const interactionsList = document.getElementById('interactionsList');
    const seCommonList = document.getElementById('seCommonList');
    const seUncommonList = document.getElementById('seUncommonList');
    const seRareList = document.getElementById('seRareList');

    const historyList = document.getElementById('historyList');
    const historyCount = document.getElementById('historyCount');
    const printReportBtn = document.getElementById('printReportBtn');

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');

    const chatWidget = document.getElementById('chatWidget');
    const chatTrigger = document.getElementById('chatTrigger');
    const chatBox = document.getElementById('chatBox');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatBody = document.getElementById('chatBody');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatBadge = document.getElementById('chatBadge');

    // Initialize application
    fetchHistory();

    // ----------------------------------------------------
    // Theme Switcher Logic
    // ----------------------------------------------------
    const themeButtons = document.querySelectorAll('.theme-btn');
    const savedTheme = localStorage.getItem('mediguard-theme') || 'dark';
    
    applyTheme(savedTheme);
    
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            applyTheme(theme);
        });
    });
    
    function applyTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-cyberpunk');
        
        if (theme !== 'dark') {
            document.body.classList.add(`theme-${theme}`);
        }
        
        themeButtons.forEach(btn => {
            if (btn.getAttribute('data-theme') === theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        localStorage.setItem('mediguard-theme', theme);
    }


    // ----------------------------------------------------
    // Input Method Tab Switching
    // ----------------------------------------------------
    inputTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            inputTabs.forEach(t => t.classList.remove('active'));
            inputPanels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`panel-${targetTab}`).classList.add('active');

            if (targetTab !== 'camera') {
                stopCamera();
            }
        });
    });

    // ----------------------------------------------------
    // File Upload / Drag & Drop
    // ----------------------------------------------------
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });

    function handleImageFile(file) {
        if (file.size > 10 * 1024 * 1024) {
            alert('File is too large. Maximum size is 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImageBase64 = e.target.result;
            imagePreview.src = selectedImageBase64;
            imagePreview.style.display = 'block';
            uploadContent.style.display = 'none';
            analyzeBtn.removeAttribute('disabled');
            clearBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
    }

    // ----------------------------------------------------
    // Camera Handlers
    // ----------------------------------------------------
    startCameraBtn.addEventListener('click', startCamera);

    async function startCamera() {
        cameraPlaceholder.style.display = 'none';
        videoStream.style.display = 'block';
        captureBtn.removeAttribute('disabled');

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            videoStream.srcObject = cameraStream;
        } catch (err) {
            console.error('Camera access failed:', err);
            alert('Could not access device camera. Please check permissions or upload a photo.');
            stopCamera();
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        videoStream.style.display = 'none';
        cameraPlaceholder.style.display = 'flex';
        captureBtn.setAttribute('disabled', 'true');
    }

    captureBtn.addEventListener('click', () => {
        if (!cameraStream) return;
        
        const context = photoCanvas.getContext('2d');
        photoCanvas.width = videoStream.videoWidth || 640;
        photoCanvas.height = videoStream.videoHeight || 480;
        context.drawImage(videoStream, 0, 0, photoCanvas.width, photoCanvas.height);
        
        selectedImageBase64 = photoCanvas.toDataURL('image/jpeg', 0.95);
        stopCamera();

        // Display captured image in Upload Panel Preview
        imagePreview.src = selectedImageBase64;
        imagePreview.style.display = 'block';
        uploadContent.style.display = 'none';
        
        // Switch to upload tab to show preview
        inputTabs[0].click();
        
        analyzeBtn.removeAttribute('disabled');
        clearBtn.style.display = 'inline-flex';
    });

    clearBtn.addEventListener('click', resetScanner);

    function resetScanner() {
        selectedImageBase64 = null;
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        uploadContent.style.display = 'flex';
        fileInput.value = '';
        analyzeBtn.setAttribute('disabled', 'true');
        clearBtn.style.display = 'none';
        scanLaser.classList.remove('scanning');
    }

    // ----------------------------------------------------
    // API Integration: Search & Analyze
    // ----------------------------------------------------
    manualSearchBtn.addEventListener('click', performManualSearch);
    manualSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performManualSearch();
    });

    async function performManualSearch() {
        const query = manualSearchInput.value.trim();
        if (!query) return;

        showLoading('Searching clinical database and analyzing salt composition...');
        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            displayMedication(data);
            fetchHistory();
        } catch (err) {
            console.error(err);
            alert(`Error analyzing medication: ${err.message || err}`);
        } finally {
            hideLoading();
        }
    }

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedImageBase64) return;

        showLoading('Running EasyOCR character extraction & AI verification...');
        scanLaser.classList.add('scanning');

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: selectedImageBase64 })
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            displayMedication(data);
            fetchHistory();
        } catch (err) {
            console.error(err);
            alert(`Error scanning medication label: ${err.message || err}`);
        } finally {
            hideLoading();
            scanLaser.classList.remove('scanning');
        }
    });

    // ----------------------------------------------------
    // Display Medication Details
    // ----------------------------------------------------
    function displayMedication(med) {
        activeMedication = med;

        // Populate header
        medicationName.textContent = med.name || 'Unknown Medication';
        medicationDesc.textContent = med.description || 'No description available.';
        
        // Risk level class
        const risk = (med.risk_level || 'low').toLowerCase();
        medicationRiskBadge.className = `risk-badge ${risk}`;
        medicationRiskBadge.textContent = `${risk} risk`;

        // Render OCR tokens if available
        const tokens = med.extractedTokens || [];
        if (tokens.length > 0) {
            ocrTokensBox.style.display = 'block';
            ocrTokensList.innerHTML = tokens.map(t => `<span class="ocr-token-tag">${t}</span>`).join('');
        } else {
            ocrTokensBox.style.display = 'none';
        }

        // 1. Composition Tab
        activeIngredientsList.innerHTML = '';
        const actives = med.activeIngredients || med.active_ingredients || [];
        if (actives.length > 0) {
            actives.forEach(act => {
                const item = document.createElement('div');
                item.className = 'active-item';
                item.innerHTML = `
                    <span class="active-item-name">${act.name}</span>
                    <span class="active-item-dose">${act.amount || 'Standard Dosage'}</span>
                `;
                activeIngredientsList.appendChild(item);
            });
        } else {
            activeIngredientsList.innerHTML = '<div class="empty-text">No active ingredients specified.</div>';
        }

        inactiveIngredientsList.innerHTML = '';
        const inactives = med.inactiveIngredients || med.inactive_ingredients || [];
        if (inactives.length > 0) {
            inactives.forEach(inact => {
                const pill = document.createElement('span');
                pill.className = 'inactive-pill';
                pill.textContent = inact;
                inactiveIngredientsList.appendChild(pill);
            });
        } else {
            inactiveIngredientsList.innerHTML = '<div class="empty-text">Standard pharmaceutical excipients.</div>';
        }

        // 2. Alternatives Tab
        alternativesGrid.innerHTML = '';
        const alts = med.alternatives || [];
        if (alts.length > 0) {
            alts.forEach(alt => {
                const card = document.createElement('div');
                card.className = 'alt-card';
                card.innerHTML = `
                    <div class="alt-card-header">
                        <div>
                            <span class="alt-name">${alt.name}</span>
                            <span class="alt-type">${alt.type || 'Generic Alternative'}</span>
                        </div>
                        ${alt.savings ? `<span class="alt-badge-savings">${alt.savings} savings</span>` : ''}
                    </div>
                    <div class="alt-details">
                        <div class="alt-stat">
                            <span>Approx Price</span>
                            <strong>${alt.price || '₹20 - ₹50'}</strong>
                        </div>
                        <div class="alt-stat">
                            <span>Bioequivalence</span>
                            <strong>${alt.similarityScore || alt.similarity_score || 95}%</strong>
                        </div>
                    </div>
                `;
                alternativesGrid.appendChild(card);
            });
        } else {
            alternativesGrid.innerHTML = '<div class="empty-text">No alternative brands found.</div>';
        }

        // 3. Interactions Tab
        interactionsList.innerHTML = '';
        const inters = med.interactions || [];
        if (inters.length > 0) {
            inters.forEach(int => {
                const severity = (int.severity || 'LOW').toLowerCase();
                const item = document.createElement('div');
                item.className = 'interaction-item';
                item.innerHTML = `
                    <div class="interaction-header">
                        <span class="interaction-substance">${int.substance}</span>
                        <span class="severity-pill ${severity}">${severity}</span>
                    </div>
                    <span class="interaction-desc">${int.description}</span>
                `;
                interactionsList.appendChild(item);
            });
        } else {
            interactionsList.innerHTML = '<div class="empty-text" style="color: #10b981;">No active substance interactions reported.</div>';
        }

        // Side effects
        seCommonList.innerHTML = '';
        seUncommonList.innerHTML = '';
        seRareList.innerHTML = '';
        const sideEffects = med.sideEffects || med.side_effects || [];
        
        let commonCount = 0, uncommonCount = 0, rareCount = 0;
        sideEffects.forEach(se => {
            const freq = (se.frequency || 'common').toLowerCase();
            const li = document.createElement('li');
            li.textContent = se.name;

            if (freq === 'common') {
                seCommonList.appendChild(li);
                commonCount++;
            } else if (freq === 'uncommon') {
                seUncommonList.appendChild(li);
                uncommonCount++;
            } else if (freq === 'rare') {
                seRareList.appendChild(li);
                rareCount++;
            }
        });

        if (commonCount === 0) seCommonList.innerHTML = '<li>Mild headache or nausea (rare)</li>';
        if (uncommonCount === 0) seUncommonList.innerHTML = '<li>Dizziness</li>';
        if (rareCount === 0) seRareList.innerHTML = '<li>Allergic skin reaction</li>';

        // Display results block & hide placeholder
        noResultsPlaceholder.style.display = 'none';
        resultsContent.style.display = 'flex';

        // Enable chat box & update system trigger
        chatInput.removeAttribute('disabled');
        sendChatBtn.removeAttribute('disabled');
        
        // Reset chat history context
        chatHistory = [];
        chatBody.innerHTML = `
            <div class="chat-msg bot">
                <div class="msg-bubble">
                    I've analyzed <strong>${med.name}</strong>. Ask me anything about its active salts, side effects, or drug interactions.
                </div>
            </div>
        `;
        chatBadge.style.display = 'inline-flex';
    }

    // ----------------------------------------------------
    // Tab switching for Readout Results
    // ----------------------------------------------------
    resultTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-result-tab');
            
            resultTabs.forEach(t => t.classList.remove('active'));
            resultPanels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`res-${targetTab}`).classList.add('active');
        });
    });

    // ----------------------------------------------------
    // History Sidebar
    // ----------------------------------------------------
    async function fetchHistory() {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            
            historyCount.textContent = data.length;
            historyList.innerHTML = '';

            if (data.length === 0) {
                historyList.innerHTML = '<div class="empty-history">No medications scanned yet.</div>';
                return;
            }

            data.forEach(med => {
                const item = document.createElement('div');
                item.className = 'history-item';
                if (activeMedication && activeMedication.id === med.id) {
                    item.classList.add('active');
                }

                const dateObj = new Date(med.scan_date);
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                item.innerHTML = `
                    <div class="history-item-top">
                        <span class="history-item-name">${med.name}</span>
                        <button class="delete-hist-btn" data-id="${med.id}">&times;</button>
                    </div>
                    <span class="history-item-date">${formattedDate}</span>
                    <span class="history-item-badge ${med.risk_level}">${med.risk_level} risk</span>
                `;

                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('delete-hist-btn')) return;
                    displayMedication(med);
                    
                    document.querySelectorAll('.history-item').forEach(hi => hi.classList.remove('active'));
                    item.classList.add('active');
                });

                // Delete event
                item.querySelector('.delete-hist-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.target.getAttribute('data-id');
                    if (confirm('Delete this history record?')) {
                        await deleteHistoryItem(id);
                    }
                });

                historyList.appendChild(item);
            });
        } catch (err) {
            console.error('History fetch failed:', err);
        }
    }

    async function deleteHistoryItem(id) {
        try {
            await fetch(`/api/history/${id}`, { method: 'DELETE' });
            if (activeMedication && activeMedication.id == id) {
                activeMedication = null;
                resultsContent.style.display = 'none';
                noResultsPlaceholder.style.display = 'flex';
                chatInput.setAttribute('disabled', 'true');
                sendChatBtn.setAttribute('disabled', 'true');
            }
            fetchHistory();
        } catch (err) {
            console.error(err);
        }
    }

    // Print Verification Report
    printReportBtn.addEventListener('click', () => {
        window.print();
    });

    // ----------------------------------------------------
    // Chatbot Widget Interaction
    // ----------------------------------------------------
    chatTrigger.addEventListener('click', () => {
        chatBox.classList.toggle('open');
        chatBadge.style.display = 'none';
    });

    chatCloseBtn.addEventListener('click', () => {
        chatBox.classList.remove('open');
    });

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    async function sendChatMessage() {
        const msg = chatInput.value.trim();
        if (!msg || !activeMedication) return;

        appendMessage('user', msg);
        chatInput.value = '';

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    context: activeMedication,
                    chat_history: chatHistory
                })
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            
            appendMessage('bot', data.response);
            
            chatHistory.push({ role: 'user', content: msg });
            chatHistory.push({ role: 'assistant', content: data.response });

            if (data.switch_medication) {
                displayMedication(data.switch_medication);
                fetchHistory();
            }
        } catch (err) {
            console.error(err);
            appendMessage('bot', 'Sorry, I encountered an error checking details. Please try again.');
        }
    }

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}`;
        msgDiv.innerHTML = `<div class="msg-bubble">${text}</div>`;
        chatBody.appendChild(msgDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // ----------------------------------------------------
    // Utility helpers
    // ----------------------------------------------------
    function showLoading(msg) {
        loadingMessage.textContent = msg;
        loadingOverlay.classList.add('active');
    }

    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }
});
