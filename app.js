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
        drawBorder: true,
        a4Normalize: true
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
    a4Normalize: document.getElementById('a4Normalize'),
    
    // Actions
    downloadIndividualBtn: document.getElementById('downloadIndividualBtn'),
    downloadCombinedBtn: document.getElementById('downloadCombinedBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn')
};

// --- Initialization & Event Listeners ---
function init() {
    setupDragAndDrop();
    setupEventListeners();
    // Sync UI controls to initial state (position select's first option is 'custom')
    DOM.position.value = state.settings.position;
    DOM.a4Normalize.checked = state.settings.a4Normalize;
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

    // ── 画面全体をドロップ対象にする ──
    // dropZone / miniDropZone 上のドロップは各ハンドラがstopPropagationするため二重処理にならない
    const overlay = document.getElementById('dropOverlay');
    let dragDepth = 0;

    document.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
        dragDepth++;
        overlay.classList.add('visible');
    }, false);

    document.addEventListener('dragleave', () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) overlay.classList.remove('visible');
    }, false);

    document.addEventListener('drop', (e) => {
        dragDepth = 0;
        overlay.classList.remove('visible');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, false);
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

    DOM.a4Normalize.addEventListener('change', (e) => {
        state.settings.a4Normalize = e.target.checked;
    });

    setupStampDrag();

    // List Actions
    DOM.clearAllBtn.addEventListener('click', clearAllFiles);

    // Process Actions
    DOM.downloadIndividualBtn.addEventListener('click', processAndDownloadIndividual);
    DOM.downloadCombinedBtn.addEventListener('click', processAndDownloadCombined);
    DOM.exportCsvBtn.addEventListener('click', exportShoukoSetsumeiCsv);

    // Ctrl+V clipboard paste (screenshots etc.)
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const imageFiles = [];
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const f = item.getAsFile();
                if (f) imageFiles.push(f);
            }
        }
        if (imageFiles.length > 0) handleFiles(imageFiles);
    });
}

// --- File Handling ---
function getFileCategory(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (file.type.startsWith('image/') || ['jpg','jpeg','png','gif','bmp','webp','tiff','tif'].includes(ext)) return 'image';
    if (['docx','doc'].includes(ext) || file.type.includes('word')) return 'docx';
    if (['xlsx','xls'].includes(ext) || file.type.includes('sheet') || file.type.includes('excel')) return 'xlsx';
    if (ext === 'csv' || file.type === 'text/csv') return 'csv';
    if (ext === 'txt' || file.type === 'text/plain') return 'txt';
    return null;
}

async function renderHtmlToPdfBuffer(htmlContent, isPreformatted) {
    const A4_W = 794;
    const SCALE = 1.5;
    const container = document.createElement('div');
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;padding:40px 48px;background:white;font-size:13.5px;line-height:1.7;font-family:'Meiryo','Yu Gothic UI',sans-serif;${isPreformatted ? 'white-space:pre-wrap;font-family:monospace;font-size:12px;' : ''}`;
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const bigCanvas = await html2canvas(container, { scale: SCALE, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    const pageW = bigCanvas.width;
    const pageH = Math.round(1122 * SCALE); // A4 height at 96dpi × scale
    const totalH = bigCanvas.height;
    const pageCount = Math.max(1, Math.ceil(totalH / pageH));

    const pdfDoc = await PDFLib.PDFDocument.create();
    const A4_W_PT = 595.28;
    const A4_H_PT = 841.89;

    for (let p = 0; p < pageCount; p++) {
        const sliceH = Math.min(pageH, totalH - p * pageH);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = pageW;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext('2d').drawImage(bigCanvas, 0, p * pageH, pageW, sliceH, 0, 0, pageW, sliceH);

        const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
        const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
        const pdfImage = await pdfDoc.embedJpg(imgBytes);

        const imgScale = A4_W_PT / pdfImage.width;
        const drawnH = pdfImage.height * imgScale;
        // 常にフルサイズのA4ページを作り、内容を上詰めで配置する（mints対応）
        const page = pdfDoc.addPage([A4_W_PT, A4_H_PT]);
        page.drawImage(pdfImage, { x: 0, y: A4_H_PT - drawnH, width: A4_W_PT, height: drawnH });
    }

    return await pdfDoc.save();
}

async function fileToNamedPdfBuffer(file) {
    const cat = getFileCategory(file);
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    if (cat === 'pdf') {
        return { name: file.name, buffer: await file.arrayBuffer() };
    }

    if (cat === 'image') {
        const rawBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.create();
        let image;

        if (file.type === 'image/jpeg' || file.name.toLowerCase().match(/\.jpe?g$/)) {
            image = await pdfDoc.embedJpg(rawBuffer);
        } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
            image = await pdfDoc.embedPng(rawBuffer);
        } else {
            // BMP / GIF / WebP / TIFF → convert via Canvas
            const img = new Image();
            const url = URL.createObjectURL(file);
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
            const cvs = document.createElement('canvas');
            cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
            cvs.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            const pngBytes = Uint8Array.from(atob(cvs.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
            image = await pdfDoc.embedPng(pngBytes);
        }

        const MAX_DIM = 841.89;
        const scale = (image.width > MAX_DIM || image.height > MAX_DIM)
            ? MAX_DIM / Math.max(image.width, image.height) : 1;
        const w = image.width * scale;
        const h = image.height * scale;
        const page = pdfDoc.addPage([w, h]);
        page.drawImage(image, { x: 0, y: 0, width: w, height: h });
        return { name: baseName + '.pdf', buffer: await pdfDoc.save() };
    }

    if (cat === 'docx') {
        if (typeof mammoth === 'undefined') throw new Error('mammoth.js が読み込まれていません');
        const rawBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: rawBuffer });
        const buffer = await renderHtmlToPdfBuffer(result.value, false);
        return { name: baseName + '.pdf', buffer };
    }

    if (cat === 'xlsx') {
        if (typeof XLSX === 'undefined') throw new Error('SheetJS が読み込まれていません');
        const rawBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(rawBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const htmlTable = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName]);
        const styledHtml = `<style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 8px;font-size:12px}</style>${htmlTable}`;
        const buffer = await renderHtmlToPdfBuffer(styledHtml, false);
        return { name: baseName + '.pdf', buffer };
    }

    if (cat === 'csv' || cat === 'txt') {
        const rawBuffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(rawBuffer);
        const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const buffer = await renderHtmlToPdfBuffer(escaped, true);
        return { name: baseName + '.pdf', buffer };
    }

    return null;
}

function showConvertingOverlay(msg) {
    let el = document.getElementById('convertingOverlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'convertingOverlay';
        el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.78);color:white;padding:18px 32px;border-radius:12px;z-index:9999;font-size:15px;pointer-events:none;';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
}

function hideConvertingOverlay() {
    const el = document.getElementById('convertingOverlay');
    if (el) el.style.display = 'none';
}

/**
 * PDF先頭3ページのテキストを抽出する。
 * hasText: テキストレイヤー有無（mintsはOCR済みPDFが望ましいため、無い場合は一覧で警告）
 * text: 抽出テキスト（証拠説明書下書きの推測に使用）
 */
async function probePdfText(buffer) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
        const pagesToCheck = Math.min(3, pdf.numPages);
        let text = '';
        for (let p = 1; p <= pagesToCheck; p++) {
            const tc = await (await pdf.getPage(p)).getTextContent();
            text += tc.items.map(i => i.str).join('') + '\n';
        }
        return { hasText: text.trim().length > 0, text };
    } catch (e) {
        console.warn('テキスト抽出に失敗:', e);
        return { hasText: null, text: '' };
    }
}

function handleDrop(e) {
    if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
    e.target.value = '';
}

async function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(f => getFileCategory(f) !== null);
    if (validFiles.length === 0) return;

    DOM.dashboard.classList.remove('hidden');
    DOM.dropZone.style.display = 'none';

    for (const file of validFiles) {
        showConvertingOverlay(`変換中: ${file.name}`);
        try {
            const result = await fileToNamedPdfBuffer(file);
            if (!result) continue;
            const probe = await probePdfText(result.buffer);
            state.files.push({
                id: 'file_' + Math.random().toString(36).substr(2, 9),
                file,
                originalName: result.name,
                arrayBuffer: result.buffer,
                isBranch: false,
                // OCR警告は元からPDFだったものだけ対象
                // （画像・Word等からの変換は文字なしが前提のため警告しない）
                hasTextLayer: getFileCategory(file) === 'pdf' ? probe.hasText : null,
                extractedText: probe.text
            });
        } catch (err) {
            console.error('Failed to process file:', file.name, err);
            alert(`${file.name} の処理に失敗しました:\n${err.message}`);
        }
    }

    hideConvertingOverlay();
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
            ? `<button class="branch-pill ${fileObj.isBranch ? 'active' : ''}" onclick="toggleBranch('${fileObj.id}', event)" title="${fileObj.isBranch ? 'クリックで枝番を解除して独立した号証に戻す' : 'クリックで、すぐ上のファイルの枝番（の2, の3…）にする'}">
                ${fileObj.isBranch ? '↳ 枝番' : '枝番にする'}
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
                    ${fileObj.hasTextLayer === false ? '<span class="ocr-warning-badge" title="文字検索できないスキャンPDFです。mints提出はOCR済みPDFが望ましいため、必要ならOCRを掛けてから投入してください。">⚠ OCRなし</span>' : ''}
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
    DOM.exportCsvBtn.disabled = !hasFiles;
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

function generateBaseText(mainNum) {
    const sym = getActualSymbol();
    const format = state.settings.format;

    if (format === 'mints') return `${sym}${mainNum.toString().padStart(3, '0')}`;
    if (format === 'formal') return `${sym}第${mainNum}号証`;
    if (format === 'goushou') return `${sym}${mainNum}号証`;
    return `${sym}${mainNum}`; // simple / hyphen / fallback
}

function generateStampText(index) {
    const numbering = computeNumbering();
    if (index < 0 || index >= numbering.length) return '';

    const { mainNum, branchNum, hasBranches } = numbering[index];
    const format = state.settings.format;
    let base = generateBaseText(mainNum);

    // Append branch suffix only if this group has multiple files
    if (hasBranches) {
        if (format === 'hyphen' || format === 'mints') {
            // mints推奨表記: 甲001-1, 甲001-2
            base += `-${branchNum}`;
        } else {
            base += `の${branchNum}`;
        }
    }

    return base;
}

// mints等のファイル名規則対応: 禁止記号を除去し、拡張子込み50文字以内に収める
function sanitizeFileName(name) {
    let base = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    const MAX_BASE = 46; // 46文字 + ".pdf" = 50文字
    if (base.length > MAX_BASE) base = base.slice(0, MAX_BASE);
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

// --- A4 Normalization (mints対応) ---
const A4_PORTRAIT = { w: 595.28, h: 841.89 };

function isA4Size(w, h) {
    const TOL = 2; // pt
    const near = (a, b) => Math.abs(a - b) <= TOL;
    return (near(w, A4_PORTRAIT.w) && near(h, A4_PORTRAIT.h)) ||
           (near(w, A4_PORTRAIT.h) && near(h, A4_PORTRAIT.w));
}

/**
 * 全ページをA4（縦横は元ページの向きに合わせる）へ拡大縮小・センタリングした
 * 新しいPDFDocumentを返す。全ページが既にA4なら元のdocをそのまま返す。
 */
async function normalizeToA4(pdfDoc) {
    const pages = pdfDoc.getPages();
    if (pages.every(p => { const s = p.getSize(); return isA4Size(s.width, s.height); })) {
        return pdfDoc; // 既にA4：テキストレイヤー保持のため無変換
    }

    const out = await PDFLib.PDFDocument.create();
    const embedded = await out.embedPages(pages);
    for (const ep of embedded) {
        const landscape = ep.width > ep.height;
        const pw = landscape ? A4_PORTRAIT.h : A4_PORTRAIT.w;
        const ph = landscape ? A4_PORTRAIT.w : A4_PORTRAIT.h;
        const scale = Math.min(pw / ep.width, ph / ep.height);
        const w = ep.width * scale;
        const h = ep.height * scale;
        const page = out.addPage([pw, ph]);
        page.drawPage(ep, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    return out;
}

async function mergePdfDocs(docs) {
    if (docs.length === 1) return docs[0];
    const out = await PDFLib.PDFDocument.create();
    for (const doc of docs) {
        const pages = await out.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => out.addPage(p));
    }
    return out;
}

async function ensureFontkit() {
    if (window.fontkit) return;
    await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

// フォントは1回だけ取得してキャッシュ（従来はファイルごとに毎回ダウンロードしていた）
const stampFontCache = {};
async function getStampFontBytes() {
    const key = state.settings.fontFamily === 'mincho' ? 'mincho' : 'gothic';
    if (!stampFontCache[key]) {
        const fontUrl = key === 'mincho'
            ? 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/Japanese/NotoSerifCJKjp-Regular.otf'
            : 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf';
        stampFontCache[key] = await fetch(fontUrl).then(res => res.arrayBuffer());
    }
    return stampFontCache[key];
}

async function addStampToPdfDoc(pdfDoc, text) {
    const { rgb } = PDFLib;

    const fontBytes = await getStampFontBytes();

    pdfDoc.registerFontkit(window.fontkit); // Requires fontkit to be loaded
    // subset: true が無いとフォント全体(約13MB)が埋め込まれ、mintsの容量制限に抵触する
    const customFont = await pdfDoc.embedFont(fontBytes, { subset: true });

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

// 1ファイル分を読み込み、A4統一（設定時）とスタンプ付与を行って返す
async function buildStampedDoc(index) {
    const fileObj = state.files[index];
    let pdfDoc = await PDFLib.PDFDocument.load(fileObj.arrayBuffer.slice(0));
    if (state.settings.a4Normalize) {
        pdfDoc = await normalizeToA4(pdfDoc);
    }
    await addStampToPdfDoc(pdfDoc, generateStampText(index));
    return pdfDoc;
}

async function processAndDownloadIndividual() {
    DOM.downloadIndividualBtn.textContent = '処理中...';
    DOM.downloadIndividualBtn.disabled = true;

    try {
        await ensureFontkit();

        for (let i = 0; i < state.files.length; i++) {
            const fileObj = state.files[i];
            const text = generateStampText(i);

            showConvertingOverlay(`処理中: ${text}`);
            const pdfDoc = await buildStampedDoc(i);
            const pdfBytes = await pdfDoc.save();

            // Generate filename based on user preference
            const formatSetting = document.querySelector('input[name="filenameFormat"]:checked').value;
            let finalName;

            if (formatSetting === 'symbol_only') {
                finalName = text; // Just the stamp text itself, e.g. 甲1号証
            } else if (formatSetting === 'original_only') {
                // タイトルそのまま：元のファイル名を維持（スタンプだけ付与）
                finalName = fileObj.originalName.replace(/\.pdf$/i, '');
            } else {
                const prefix = text.replace(/号証$/, '').replace(/第/, ''); // 簡易的なファイル名プレフィックス
                finalName = `${prefix}_${fileObj.originalName.replace(/\.pdf$/i, '')}`;
            }

            downloadByteArray(sanitizeFileName(finalName), pdfBytes);

            // tiny delay to prevent browser crash
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (err) {
        console.error('Processing error:', err);
        alert(`処理中にエラーが発生しました。\n詳細: ${err.message}`);
    } finally {
        hideConvertingOverlay();
        DOM.downloadIndividualBtn.textContent = '個別ダウンロード';
        DOM.downloadIndividualBtn.disabled = state.files.length === 0;
    }
}

/**
 * mints提出用：枝番を親番号ごとに1つのPDFへ結合してダウンロードする。
 * 各構成ファイルの1ページ目にはそれぞれの号証番号（甲001-1等）をスタンプする。
 * ファイル名は mints の慣行（例: 甲001_1〜3.pdf）に合わせる。
 */
async function processAndDownloadCombined() {
    if (state.files.length === 0) return;
    DOM.downloadCombinedBtn.textContent = '処理中...';
    DOM.downloadCombinedBtn.disabled = true;

    try {
        await ensureFontkit();

        // 親番号（mainNum）ごとに、連続した枝番グループを作る
        const numbering = computeNumbering();
        const groups = [];
        for (let i = 0; i < state.files.length; i++) {
            const last = groups[groups.length - 1];
            if (last && last.mainNum === numbering[i].mainNum) {
                last.indices.push(i);
            } else {
                groups.push({ mainNum: numbering[i].mainNum, indices: [i] });
            }
        }

        for (const group of groups) {
            const base = generateBaseText(group.mainNum);
            showConvertingOverlay(`結合中: ${base}`);

            const stampedDocs = [];
            for (const i of group.indices) {
                stampedDocs.push(await buildStampedDoc(i));
            }
            const merged = await mergePdfDocs(stampedDocs);
            const pdfBytes = await merged.save();

            // ファイル名：枝番ありは「甲001_1〜3」形式、単独は号証番号のみ
            let name;
            if (group.indices.length > 1) {
                name = `${base}_1〜${group.indices.length}`;
            } else {
                name = base;
            }
            downloadByteArray(sanitizeFileName(name), pdfBytes);

            await new Promise(r => setTimeout(r, 200));
        }
    } catch (err) {
        console.error('Combine error:', err);
        alert(`結合処理中にエラーが発生しました。\n詳細: ${err.message}`);
    } finally {
        hideConvertingOverlay();
        DOM.downloadCombinedBtn.textContent = '枝番を結合してダウンロード（mints用）';
        DOM.downloadCombinedBtn.disabled = state.files.length === 0;
    }
}

// ── 証拠説明書下書きの推測ロジック ──

// 書類種別ごとの既定値（ファイル名・本文に含まれる語で判定。上から順に優先）
const DOC_TYPE_RULES = [
    { re: /賃貸借契約/, author: '当事者双方', purpose: '賃貸借契約締結の事実及びその内容' },
    { re: /雇用契約|労働契約/, author: '当事者双方', purpose: '雇用契約締結の事実及びその内容' },
    { re: /金銭消費貸借|借用証/, author: '当事者双方', purpose: '金銭消費貸借契約締結の事実及びその内容' },
    { re: /示談書|合意書|和解/, author: '当事者双方', purpose: '合意成立の事実及びその内容' },
    { re: /契約書|覚書/, author: '当事者双方', purpose: '契約締結の事実及びその内容' },
    { re: /内容証明|催告書|通知書|受任通知/, author: '', purpose: '通知（催告）の事実及びその内容' },
    { re: /請求書/, author: '', purpose: '請求の事実及びその金額' },
    { re: /領収書|レシート/, author: '', purpose: '支払の事実及びその金額' },
    { re: /見積/, author: '', purpose: '見積の内容' },
    { re: /登記事項証明書|全部事項証明書|登記簿/, author: '法務局登記官', purpose: '本件不動産（法人）の登記上の権利関係' },
    { re: /戸籍|住民票/, author: '市区町村長', purpose: '当事者の身分関係（住所）' },
    { re: /診断書/, author: '医師', purpose: '傷病名、治療経過及び症状の内容' },
    { re: /診療報酬明細|レセプト/, author: '医療機関', purpose: '治療内容及び治療費の額' },
    { re: /源泉徴収票|給与明細|課税証明/, author: '', purpose: '収入の額' },
    { re: /陳述書/, author: '', purpose: '本件の経緯' },
    { re: /議事録/, author: '', purpose: '会議における協議・決議の内容' },
    { re: /就業規則/, author: '', purpose: '就業規則の定めの内容' },
    { re: /メール|LINE|ライン|チャット|メッセージ/, author: '', purpose: '当事者間のやり取りの存在及びその内容' },
    { re: /写真|スクリーンショット|スクショ/, author: '', purpose: '本件現場（対象物）の状況' },
    { re: /図面|見取図/, author: '', purpose: '本件現場（対象物）の位置関係' },
];

// テキスト・ファイル名から日付らしき文字列を1つ拾う（全角数字は半角化）
function guessDate(name, text) {
    const normalize = (s) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const hay = normalize(text || '');
    const wareki = hay.match(/(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (wareki) return wareki[0].replace(/\s+/g, '');
    const seireki = hay.match(/(19|20)\d{2}\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (seireki) return seireki[0].replace(/\s+/g, '');
    // ファイル名の日付（例: スクリーンショット 2026-07-24、20260724）
    const n = normalize(name);
    const fn = n.match(/(19|20)(\d{2})[-_.\/年]?(\d{1,2})[-_.\/月]?(\d{1,2})/);
    if (fn) return `${fn[1]}${fn[2]}年${parseInt(fn[3], 10)}月${parseInt(fn[4], 10)}日`;
    return '';
}

// 会社名・法人名らしき文字列を本文から1つ拾う（請求書・領収書等の作成者候補）
function guessCompany(text) {
    const m = (text || '').match(/(株式会社|有限会社|合同会社|弁護士法人|司法書士法人|税理士法人|医療法人)[^\s、。，,()（）]{1,20}|[^\s、。，,()（）]{2,20}(株式会社|有限会社|合同会社)/);
    return m ? m[0] : '';
}

/**
 * 書類の内容（ファイル名＋抽出テキスト）から証拠説明書の各欄を推測する。
 * 確実に分からない欄は空欄のまま返す（あくまで下書き用の仮埋め）。
 */
function guessDocMeta(fileObj) {
    const name = fileObj.originalName.replace(/\.pdf$/i, '');
    const text = (fileObj.extractedText || '').slice(0, 3000);
    const hay = name + '\n' + text.slice(0, 500);

    let author = '';
    let purpose = '';
    let matchedRule = null;
    for (const rule of DOC_TYPE_RULES) {
        if (rule.re.test(hay)) { matchedRule = rule; break; }
    }
    if (matchedRule) {
        author = matchedRule.author;
        purpose = matchedRule.purpose;
    }

    // 発行者系の書類は本文の法人名を作成者候補にする
    if (!author && matchedRule && /請求書|領収書|レシート|見積|診療報酬|源泉徴収/.test(matchedRule.re.source)) {
        author = guessCompany(text);
    }

    return { date: guessDate(name, text), author, purpose };
}

/**
 * 証拠説明書の下書きをCSV（UTF-8 BOM付き・Excelでそのまま開ける）で出力する。
 * 号証番号・標目を自動記入し、作成年月日・作成者・立証趣旨は内容から推測できる範囲で仮埋めする。
 */
function exportShoukoSetsumeiCsv() {
    if (state.files.length === 0) return;

    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['号証', '標目', '原本・写しの別', '作成年月日', '作成者', '立証趣旨']];

    for (let i = 0; i < state.files.length; i++) {
        const title = state.files[i].originalName.replace(/\.pdf$/i, '');
        const guess = guessDocMeta(state.files[i]);
        rows.push([generateStampText(i), title, '写し', guess.date, guess.author, guess.purpose]);
    }

    const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `証拠説明書下書き_${getActualSymbol()}.csv`;
    link.click();
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', init);
