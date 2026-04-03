/**
 * 号証つけるくん - Application Logic
 */

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application State
const state = {
    files: [], // { id, file, originalName, arrayBuffer, isBranch: false }
    selectedFileId: null,
    settings: {
        symbol: '甲',
        customSymbol: '',
        format: 'goushou',
        startNumber: 1,
        color: '#ff0000',
        fontSize: 24,
        fontFamily: 'gothic', // 'gothic' or 'mincho'
        position: 'top-right',
        customX: 0,
        customY: 0,
        whiteBackground: true,
        drawBorder: true
    }
};

// DOM Elements
const DOM = {
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    dashboard: document.getElementById('dashboard'),
    fileList: document.getElementById('fileList'),
    fileCount: document.getElementById('fileCount'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    addFileInput: document.getElementById('addFileInput'),
    miniDropZone: document.getElementById('miniDropZone'),
    
    // Preview
    pdfPreview: document.getElementById('pdfPreview'),
    previewStamp: document.getElementById('previewStamp'),
    previewPlaceholder: document.getElementById('previewPlaceholder'),
    previewLoading: document.getElementById('previewLoading'),
    
    // Settings
    symbol: document.getElementById('symbol'),
    customSymbolGroup: document.getElementById('customSymbolGroup'),
    customSymbol: document.getElementById('customSymbol'),
    numberFormat: document.getElementById('numberFormat'),
    startNumber: document.getElementById('startNumber'),
    stampColor: document.getElementById('stampColor'),
    fontSize: document.getElementById('fontSize'),
    fontSizeDisplay: document.getElementById('fontSizeDisplay'),
    fontFamily: document.getElementById('fontFamily'),
    position: document.getElementById('position'),
    whiteBackground: document.getElementById('whiteBackground'),
    drawBorder: document.getElementById('drawBorder'),
    
    // Actions
    processBtn: document.getElementById('processBtn'),
    downloadIndividualBtn: document.getElementById('downloadIndividualBtn'),
    downloadCombinedBtn: document.getElementById('downloadCombinedBtn')
};

// --- Initialization & Event Listeners ---
function init() {
    setupDragAndDrop();
    setupEventListeners();
}

function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, () => DOM.dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, () => DOM.dropZone.classList.remove('dragover'), false);
    });

    DOM.dropZone.addEventListener('drop', handleDrop, false);
    document.addEventListener('dragover', preventDefaults, false);
    document.addEventListener('drop', preventDefaults, false);
    DOM.fileInput.addEventListener('change', handleFileSelect, false);

    // Add-more-files input
    DOM.addFileInput.addEventListener('change', handleFileSelect, false);

    // Mini drop zone for adding files when dashboard is visible
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        DOM.miniDropZone.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        DOM.miniDropZone.addEventListener(eventName, () => DOM.miniDropZone.classList.add('dragover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        DOM.miniDropZone.addEventListener(eventName, () => DOM.miniDropZone.classList.remove('dragover'), false);
    });
    DOM.miniDropZone.addEventListener('drop', handleDrop, false);
    DOM.miniDropZone.addEventListener('click', () => DOM.addFileInput.click(), false);
}

function setupEventListeners() {
    // Settings changes
    DOM.symbol.addEventListener('change', (e) => {
        state.settings.symbol = e.target.value;
        DOM.customSymbolGroup.classList.toggle('hidden', e.target.value !== 'custom');
        updatePreviewStamp();
    });
    
    DOM.customSymbol.addEventListener('input', (e) => {
        state.settings.customSymbol = e.target.value;
        updatePreviewStamp();
    });
    
    DOM.numberFormat.addEventListener('change', (e) => {
        state.settings.format = e.target.value;
        updatePreviewStamp();
    });
    
    DOM.startNumber.addEventListener('input', (e) => {
        state.settings.startNumber = parseInt(e.target.value, 10) || 1;
        updatePreviewStamp();
    });
    
    DOM.stampColor.addEventListener('input', (e) => {
        state.settings.color = e.target.value;
        updatePreviewStampStyle();
    });
    
    DOM.fontSize.addEventListener('input', (e) => {
        state.settings.fontSize = parseInt(e.target.value, 10);
        DOM.fontSizeDisplay.textContent = `${state.settings.fontSize}px`;
        updatePreviewStampStyle();
    });
    
    DOM.fontFamily.addEventListener('change', (e) => {
        state.settings.fontFamily = e.target.value;
        updatePreviewStampStyle();
    });
    
    DOM.position.addEventListener('change', (e) => {
        state.settings.position = e.target.value;
        if (state.settings.position !== 'custom') {
            // Reset custom coordinates if a preset is selected
            state.settings.customX = 0;
            state.settings.customY = 0;
        }
        updatePreviewStampStyle();
    });
    
    DOM.whiteBackground.addEventListener('change', (e) => {
        state.settings.whiteBackground = e.target.checked;
        updatePreviewStampStyle();
    });
    
    DOM.drawBorder.addEventListener('change', (e) => {
        state.settings.drawBorder = e.target.checked;
        updatePreviewStampStyle();
    });

    setupStampDrag();

    // List Actions
    DOM.clearAllBtn.addEventListener('click', clearAllFiles);
    
    // Process Actions
    DOM.processBtn.addEventListener('click', async () => {
        // Simple logic for single processing just for testing, 
        // real processing logic will be hooked to download buttons
        alert('設定を適用しました。ダウンロードボタンから出力してください。');
    });
    
    DOM.downloadIndividualBtn.addEventListener('click', processAndDownloadIndividual);
    DOM.downloadCombinedBtn.addEventListener('click', processAndDownloadCombined);
}

// --- File Handling ---
function handleDrop(e) {
    if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
    e.target.value = ''; // Reset so the same file can be added again
}

async function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(file => 
        file.type === 'application/pdf' || 
        file.type.startsWith('image/')
    );
    if (validFiles.length === 0) return;

    // Show dashboard
    DOM.dashboard.classList.remove('hidden');
    DOM.dropZone.style.display = 'none';

    for (let file of validFiles) {
        const id = 'file_' + Math.random().toString(36).substr(2, 9);
        let arrayBuffer = await file.arrayBuffer();
        let pdfName = file.name;
        
        // If it's an image, convert to PDF
        if (file.type.startsWith('image/')) {
            try {
                const pdfDoc = await PDFLib.PDFDocument.create();
                let image;
                if (file.type === 'image/jpeg') {
                    image = await pdfDoc.embedJpg(arrayBuffer);
                } else if (file.type === 'image/png') {
                    image = await pdfDoc.embedPng(arrayBuffer);
                } else {
                    // Fallback or skip if unsupported image type (e.g. some BMPs might not be directly supported, but let's try)
                    console.warn('Unsupported image type for direct embed', file.type);
                    continue; // Skip for now if we can't embed
                }
                
                // Calculate scaled dimensions (fit to A4 roughly)
                const MAX_DIM = 841.89; // A4 max dimension in points
                let scale = 1;

                if (image.width > MAX_DIM || image.height > MAX_DIM) {
                    if (image.width > image.height) {
                        scale = MAX_DIM / image.width;
                    } else {
                        scale = MAX_DIM / image.height;
                    }
                }
                
                const finalWidth = image.width * scale;
                const finalHeight = image.height * scale;

                const page = pdfDoc.addPage([finalWidth, finalHeight]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: finalWidth,
                    height: finalHeight,
                });
                
                // Replace the original image arrayBuffer with the new PDF arrayBuffer
                arrayBuffer = await pdfDoc.save();
                
                // Replace file extension
                pdfName = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
                
            } catch (err) {
                console.error('Failed to convert image to PDF:', err);
                continue;
            }
        }
        
        state.files.push({
            id,
            file,
            originalName: pdfName,
            arrayBuffer,
            isBranch: false
        });
    }

    renderFileList();
    
    if (state.files.length > 0 && !state.selectedFileId) {
        selectFile(state.files[0].id);
    }
    
    updateDownloadButtonsState();
}

// ── Drag & Drop reorder state ──
let dragState = { draggedId: null, draggedEl: null, placeholder: null };

function renderFileList() {
    DOM.fileList.innerHTML = '';
    DOM.fileCount.textContent = state.files.length;

    state.files.forEach((fileObj, index) => {
        const li = document.createElement('li');
        li.className = `file-item ${fileObj.id === state.selectedFileId ? 'selected' : ''} ${fileObj.isBranch ? 'is-branch' : ''}`;
        li.dataset.id = fileObj.id;
        li.draggable = true;

        // Calculate expected number text
        const numberText = generateStampText(index);

        // Branch toggle: only show for index > 0
        const branchBtnHtml = index > 0
            ? `<button class="icon-btn branch-toggle ${fileObj.isBranch ? 'active' : ''}" onclick="toggleBranch('${fileObj.id}', event)" title="${fileObj.isBranch ? '枝番を解除' : '前の号証の枝番にする'}">
                ${fileObj.isBranch ? '↳' : '┃'}
               </button>`
            : '<div class="branch-spacer"></div>';

        li.innerHTML = `
            ${branchBtnHtml}
            <div class="drag-handle">☰</div>
            <div class="file-info">
                <div class="file-name" title="${fileObj.originalName}">${fileObj.originalName}</div>
                <div class="file-meta">
                    <span class="stamp-preview-badge">${numberText}</span>
                    <span>${(fileObj.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="icon-btn delete" onclick="removeFile('${fileObj.id}', event)" title="削除">✖</button>
            </div>
        `;

        // ── Drag events ──
        li.addEventListener('dragstart', (e) => {
            dragState.draggedId = fileObj.id;
            dragState.draggedEl = li;
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Need a tiny delay so the browser captures the element image before we style it
            requestAnimationFrame(() => li.style.opacity = '0.4');
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            li.style.opacity = '';
            if (dragState.placeholder && dragState.placeholder.parentNode) {
                dragState.placeholder.parentNode.removeChild(dragState.placeholder);
            }
            dragState = { draggedId: null, draggedEl: null, placeholder: null };
            // Remove all drag-over styles
            DOM.fileList.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
                el.classList.remove('drag-over-above', 'drag-over-below');
            });
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!dragState.draggedId || dragState.draggedId === fileObj.id) return;

            // Determine if cursor is in top half or bottom half
            const rect = li.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const isAbove = e.clientY < midY;

            // Clear all indicators
            DOM.fileList.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
                el.classList.remove('drag-over-above', 'drag-over-below');
            });

            li.classList.add(isAbove ? 'drag-over-above' : 'drag-over-below');
        });

        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over-above', 'drag-over-below');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over-above', 'drag-over-below');
            if (!dragState.draggedId || dragState.draggedId === fileObj.id) return;

            const fromIndex = state.files.findIndex(f => f.id === dragState.draggedId);
            const toIndex = state.files.findIndex(f => f.id === fileObj.id);
            if (fromIndex === -1 || toIndex === -1) return;

            // Determine insert position
            const rect = li.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const isAbove = e.clientY < midY;

            // Remove dragged item
            const [movedFile] = state.files.splice(fromIndex, 1);

            // Calculate new index
            let insertIndex = state.files.findIndex(f => f.id === fileObj.id);
            if (!isAbove) insertIndex += 1;

            // If moved to first position, clear branch flag
            if (insertIndex === 0) movedFile.isBranch = false;

            state.files.splice(insertIndex, 0, movedFile);

            renderFileList();
            updatePreviewStamp();
        });

        li.addEventListener('click', () => selectFile(fileObj.id));
        DOM.fileList.appendChild(li);
    });
}

function toggleBranch(id, event) {
    event.stopPropagation();
    const fileObj = state.files.find(f => f.id === id);
    if (!fileObj) return;
    fileObj.isBranch = !fileObj.isBranch;
    renderFileList();
    updatePreviewStamp();
}

function removeFile(id, event) {
    event.stopPropagation();
    state.files = state.files.filter(f => f.id !== id);
    if (state.selectedFileId === id) {
        state.selectedFileId = state.files.length > 0 ? state.files[0].id : null;
        if(state.selectedFileId) {
            selectFile(state.selectedFileId);
        } else {
            clearPreview();
        }
    }
    renderFileList();
    updateDownloadButtonsState();
    
    if (state.files.length === 0) {
        DOM.dashboard.classList.add('hidden');
        DOM.dropZone.style.display = 'flex';
    }
}

function clearAllFiles() {
    state.files = [];
    state.selectedFileId = null;
    clearPreview();
    renderFileList();
    updateDownloadButtonsState();
    DOM.dashboard.classList.add('hidden');
    DOM.dropZone.style.display = 'flex';
}

function selectFile(id) {
    state.selectedFileId = id;
    renderFileList(); // Update selected class
    renderPreview(id);
}

function updateDownloadButtonsState() {
    const hasFiles = state.files.length > 0;
    DOM.downloadIndividualBtn.disabled = !hasFiles;
    DOM.downloadCombinedBtn.disabled = !hasFiles;
}

// --- Stamp Text Generation Logic ---
function getActualSymbol() {
    if (state.settings.symbol === 'custom') {
        return state.settings.customSymbol || '（空）';
    }
    return state.settings.symbol;
}

/**
 * Compute numbering info for all files, accounting for branches.
 * Returns array of { mainNum, branchNum (null if no branch), hasBranches }
 */
function computeNumbering() {
    const result = [];
    let mainNum = state.settings.startNumber - 1;
    let branchCount = 0;

    for (let i = 0; i < state.files.length; i++) {
        const file = state.files[i];
        if (!file.isBranch || i === 0) {
            // New main number
            mainNum++;
            branchCount = 1;
            result.push({ mainNum, branchNum: branchCount });
        } else {
            // Branch of previous main number
            branchCount++;
            result.push({ mainNum, branchNum: branchCount });
        }
    }

    // Determine which groups actually have branches (more than 1 file in group)
    // If a main number only has 1 file, remove the branch suffix
    const groupCounts = {};
    for (const r of result) {
        groupCounts[r.mainNum] = (groupCounts[r.mainNum] || 0) + 1;
    }
    for (const r of result) {
        r.hasBranches = groupCounts[r.mainNum] > 1;
    }

    return result;
}

function generateStampText(index) {
    const numbering = computeNumbering();
    if (index < 0 || index >= numbering.length) return '';

    const { mainNum, branchNum, hasBranches } = numbering[index];
    const sym = getActualSymbol();
    const format = state.settings.format;
    const paddedNum = mainNum.toString().padStart(3, '0');

    let base;
    if (format === 'mints') {
        base = `${sym}${paddedNum}`;
    } else if (format === 'simple') {
        base = `${sym}${mainNum}`;
    } else if (format === 'hyphen') {
        base = `${sym}${mainNum}`;
    } else if (format === 'formal') {
        base = `${sym}第${mainNum}号証`;
    } else if (format === 'goushou') {
        base = `${sym}${mainNum}号証`;
    } else {
        base = `${sym}${mainNum}`;
    }

    // Append branch suffix only if this group has multiple files
    if (hasBranches) {
        if (format === 'hyphen') {
            base += `-${branchNum}`;
        } else {
            base += `の${branchNum}`;
        }
    }

    return base;
}

// --- Preview Rendering with PDF.js ---
let renderTask = null;

async function renderPreview(id) {
    const fileObj = state.files.find(f => f.id === id);
    if (!fileObj) return;

    DOM.previewPlaceholder.classList.add('hidden');
    DOM.previewLoading.classList.remove('hidden');
    DOM.pdfPreview.style.visibility = 'hidden';
    DOM.previewStamp.style.display = 'none';

    try {
        const loadingTask = pdfjsLib.getDocument({ data: fileObj.arrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Render first page

        const scale = 1.0;
        const viewport = page.getViewport({ scale });
        
        state.currentPdfWidth = viewport.width;
        state.currentPdfHeight = viewport.height;

        // Fit canvas to viewport constraints
        const canvas = DOM.pdfPreview;
        const context = canvas.getContext('2d');
        const container = canvas.parentElement.parentElement; // preview-container
        
        // Let's make the visual size fit the container nicely
        const parentWidth = container.clientWidth - 40;
        const parentHeight = container.clientHeight - 60; // account for headers
        
        // Calculate the scale required to fit the page inside the parent container
        const widthScale = parentWidth / viewport.width;
        const heightScale = parentHeight / viewport.height;
        const scaleFit = Math.min(widthScale, heightScale);
        
        const scaledViewport = page.getViewport({ scale: scaleFit });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };

        if (renderTask) {
            await renderTask.cancel();
        }

        renderTask = page.render(renderContext);
        await renderTask.promise;

        DOM.previewLoading.classList.add('hidden');
        DOM.pdfPreview.style.visibility = 'visible';

        // Display Stamp Overlay
        updatePreviewStamp();

    } catch (err) {
        console.error('Error rendering PDF preview:', err);
        DOM.previewLoading.textContent = 'プレビューの読み込みに失敗しました';
    }
}

function clearPreview() {
    const canvas = DOM.pdfPreview;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    DOM.previewPlaceholder.classList.remove('hidden');
    DOM.pdfPreview.style.visibility = 'hidden';
    DOM.previewStamp.style.display = 'none';
}

function updatePreviewStamp() {
    if (!state.selectedFileId) return;
    
    const index = state.files.findIndex(f => f.id === state.selectedFileId);
    if (index === -1) return;

    const text = generateStampText(index);
    DOM.previewStamp.textContent = text;
    DOM.previewStamp.style.display = 'block';
    
    // Also update all file lists instantly
    renderFileList();
    
    updatePreviewStampStyle();
}

function updatePreviewStampStyle() {
    if (DOM.previewStamp.style.display === 'none') return;
    
    const stamp = DOM.previewStamp;
    const canvas = DOM.pdfPreview;
    
    // Scale font size down to match the canvas visual scale
    // True visual scale factor from PDF points to screen pixels
    const renderScale = state.currentPdfWidth ? (canvas.clientWidth / state.currentPdfWidth) : 1;
    
    const displayFontSize = state.settings.fontSize * renderScale;

    stamp.style.color = state.settings.color;
    // Update font family preview based on selection
    if (state.settings.fontFamily === 'mincho') {
        stamp.style.fontFamily = "'Noto Serif JP', 'MS Mincho', serif";
    } else {
        stamp.style.fontFamily = "'Noto Sans JP', 'MS Gothic', sans-serif";
    }
    stamp.style.fontSize = `${Math.max(4, displayFontSize)}px`;
    stamp.style.fontWeight = 'normal'; // Matches Noto Sans/Serif Regular weight
    stamp.style.lineHeight = '1.15'; // Match our approximate textHeight bounding box
    
    const paddingPoints = 4;
    stamp.style.padding = `${paddingPoints * renderScale}px`;
    
    stamp.style.backgroundColor = state.settings.whiteBackground ? 'rgba(255, 255, 255, 0.9)' : 'transparent';
    
    const borderWidth = Math.max(1, 2 * renderScale);
    stamp.style.border = state.settings.drawBorder ? `${borderWidth}px solid ${state.settings.color}` : 'none';
    
    // Position based on actual rendered canvas dimensions (clientWidth/Height)
    // margin of 20 points in PDF space translates to margin * renderScale in visual space
    const marginVisual = 20 * renderScale;
    
    stamp.style.top = 'auto';
    stamp.style.bottom = 'auto';
    stamp.style.left = 'auto';
    stamp.style.right = 'auto';

    switch (state.settings.position) {
        case 'custom':
            // Custom coordinates (percentage mapped to visual)
            const xVisual = state.settings.customX * canvas.clientWidth;
            const yVisual = state.settings.customY * canvas.clientHeight;
            stamp.style.left = `${Math.max(0, Math.min(xVisual, canvas.clientWidth - stamp.offsetWidth))}px`;
            stamp.style.top = `${Math.max(0, Math.min(yVisual, canvas.clientHeight - stamp.offsetHeight))}px`;
            break;
        case 'top-right':
            stamp.style.top = `${marginVisual}px`;
            stamp.style.right = `${marginVisual}px`;
            break;
        case 'top-left':
            stamp.style.top = `${marginVisual}px`;
            stamp.style.left = `${marginVisual}px`;
            break;
        case 'bottom-right':
            stamp.style.bottom = `${marginVisual}px`;
            stamp.style.right = `${marginVisual}px`;
            break;
        case 'bottom-left':
            stamp.style.bottom = `${marginVisual}px`;
            stamp.style.left = `${marginVisual}px`;
            break;
    }
}

// --- Stamp Dragging Logic ---
function setupStampDrag() {
    const stamp = DOM.previewStamp;
    const container = document.querySelector('.canvas-container'); // Need relative boundaries

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    stamp.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const style = window.getComputedStyle(stamp);
        // Force the dropdown to 'custom' automatically
        if (state.settings.position !== 'custom') {
            state.settings.position = 'custom';
            DOM.position.value = 'custom';
            // Explicitly set left/top since they might have been auto via right/bottom properties
            stamp.style.left = style.left;
            stamp.style.top = style.top;
            stamp.style.right = 'auto';
            stamp.style.bottom = 'auto';
        }
        
        initialLeft = parseFloat(style.left) || 0;
        initialTop = parseFloat(style.top) || 0;
        
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const canvasWidth = DOM.pdfPreview.clientWidth;
        const canvasHeight = DOM.pdfPreview.clientHeight;
        const stampWidth = stamp.offsetWidth;
        const stampHeight = stamp.offsetHeight;
        
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        
        // Boundaries constraint so we don't drag it off the canvas entirely
        newLeft = Math.max(0, Math.min(newLeft, canvasWidth - stampWidth));
        newTop = Math.max(0, Math.min(newTop, canvasHeight - stampHeight));

        stamp.style.left = `${newLeft}px`;
        stamp.style.top = `${newTop}px`;
        
        // Save relative state for PDF generation
        state.settings.customX = newLeft / canvasWidth;
        state.settings.customY = newTop / canvasHeight;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}


// --- PDF Processing and Exporting using pdf-lib ---

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 0, b: 0 };
}

async function addStampToPdfDoc(pdfDoc, text) {
    const { rgb } = PDFLib;
    
    // Fetch a base font based on user setting
    let fontUrl = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf'; // default Gothic
    if (state.settings.fontFamily === 'mincho') {
        fontUrl = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/Japanese/NotoSerifCJKjp-Regular.otf';
    }

    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    
    pdfDoc.registerFontkit(window.fontkit); // Requires fontkit to be loaded
    const customFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    const size = state.settings.fontSize;
    const textWidth = customFont.widthOfTextAtSize(text, size);
    // pdf-lib's heightAtSize for these CJK fonts includes massive ascender space.
    // Use a tighter visual bounding box based on the font size for the background/border.
    const textHeight = size * 1.15; 
    const baselineOffset = size * 0.12; // Shift baseline up from the bottom of the box
    
    const colorRGB = hexToRgb(state.settings.color);
    const stampColor = rgb(colorRGB.r, colorRGB.g, colorRGB.b);
    
    let boxLeft, boxTopY;
    const margin = 20;

    const PADDING = 4;
    const boxWidth = textWidth + PADDING * 2;
    const boxHeight = textHeight + PADDING * 2;

    switch (state.settings.position) {
        case 'custom':
            // Web coordinates (customX, customY): percentage mapped to top-left of box.
            // PDF coordinates: (0,0) is bottom-left of page.
            boxLeft = state.settings.customX * width;
            boxTopY = height - (state.settings.customY * height);
            break;
        case 'top-right':
            boxLeft = width - margin - boxWidth;
            boxTopY = height - margin;
            break;
        case 'top-left':
            boxLeft = margin;
            boxTopY = height - margin;
            break;
        case 'bottom-right':
            boxLeft = width - margin - boxWidth;
            boxTopY = margin + boxHeight;
            break;
        case 'bottom-left':
            boxLeft = margin;
            boxTopY = margin + boxHeight;
            break;
    }

    // Ensure we don't stamp outside PDF boundaries in custom mode
    boxLeft = Math.max(0, Math.min(boxLeft, width - boxWidth));
    boxTopY = Math.max(boxHeight, Math.min(boxTopY, height));
    
    const boxBottomY = boxTopY - boxHeight;

    if (state.settings.whiteBackground) {
        firstPage.drawRectangle({
            x: boxLeft,
            y: boxBottomY,
            width: boxWidth,
            height: boxHeight,
            color: rgb(1, 1, 1),
            opacity: 0.9,
        });
    }

    if (state.settings.drawBorder) {
        firstPage.drawRectangle({
            x: boxLeft,
            y: boxBottomY,
            width: boxWidth,
            height: boxHeight,
            borderColor: stampColor,
            borderWidth: 2,
            color: rgb(1, 1, 1),
            opacity: state.settings.whiteBackground ? 0.9 : 0
        });
    }

    firstPage.drawText(text, {
        x: boxLeft + PADDING,
        y: boxBottomY + PADDING + baselineOffset, 
        size: size,
        font: customFont,
        color: stampColor,
    });
}

function downloadByteArray(fileName, byte) {
    const blob = new Blob([byte], { type: "application/pdf" });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    const newName = fileName.replace('.pdf', '');
    link.download = `${newName}.pdf`;
    link.click();
}

async function processAndDownloadIndividual() {
    DOM.processBtn.textContent = '処理中...';
    DOM.processBtn.disabled = true;
    
    try {
        if (!window.fontkit) {
            // dynamically load fontkit if missing
            await new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }

        for (let i = 0; i < state.files.length; i++) {
            const fileObj = state.files[i];
            const text = generateStampText(i);
            
            const pdfDoc = await PDFLib.PDFDocument.load(fileObj.arrayBuffer.slice(0));
            await addStampToPdfDoc(pdfDoc, text);
            
            const pdfBytes = await pdfDoc.save();
            
            // Generate filename based on user preference
            const formatSetting = document.querySelector('input[name="filenameFormat"]:checked').value;
            let finalName;
            
            if (formatSetting === 'symbol_only') {
                finalName = text; // Just the stamp text itself, e.g. 甲1号証
            } else {
                const prefix = text.replace(/号証$/, '').replace(/第/, ''); // 簡易的なファイル名プレフィックス
                finalName = `${prefix}_${fileObj.originalName}`;
            }
            // Ensure .pdf extension
            if (!finalName.toLowerCase().endsWith('.pdf')) {
                finalName += '.pdf';
            }
            
            downloadByteArray(finalName, pdfBytes);
            
            // tiny delay to prevent browser crash
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (err) {
        console.error('Processing error:', err);
        alert(`処理中にエラーが発生しました。\n詳細: ${err.message}`);
    } finally {
        DOM.processBtn.textContent = '設定を反映して処理する';
        DOM.processBtn.disabled = false;
    }
}

async function processAndDownloadCombined() {
    alert('結合ダウンロード機能は開発中です。');
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', init);
