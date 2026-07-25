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
        a4Normalize: true,
        shoukoRemarks: false, // 証拠説明書に備考欄（簡裁旧書式）
        mergeBranches: false  // 同種の枝番を1行にまとめる
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
    exportWordBtn: document.getElementById('exportWordBtn'),
    shoukoRemarks: document.getElementById('shoukoRemarks'),
    mergeBranches: document.getElementById('mergeBranches')
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

    if (DOM.shoukoRemarks) DOM.shoukoRemarks.addEventListener('change', (e) => {
        state.settings.shoukoRemarks = e.target.checked;
    });
    if (DOM.mergeBranches) DOM.mergeBranches.addEventListener('change', (e) => {
        state.settings.mergeBranches = e.target.checked;
    });

    setupStampDrag();

    // List Actions
    DOM.clearAllBtn.addEventListener('click', clearAllFiles);

    // Process Actions
    DOM.downloadIndividualBtn.addEventListener('click', processAndDownloadIndividual);
    DOM.downloadCombinedBtn.addEventListener('click', processAndDownloadCombined);
    DOM.exportWordBtn.addEventListener('click', exportShoukoSetsumeiWord);

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
 * PDFの全ページからテキストレイヤーを抽出する（証拠説明書の日付・標目推測に使用）。
 * hasText: テキストレイヤー有無（無い＝スキャン/手書き。証拠説明書出力時にOCRへ回す）
 * text: 抽出テキスト（行構造をhasEOLで復元。日付・標目の判定精度のため）
 * 巨大PDFだけは安全弁として先頭200＋末尾50ページに限定（脱落分はconsoleに明示）。
 */
async function probePdfText(buffer, label) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
        const total = pdf.numPages;
        let pageNums;
        const CAP = 300;
        if (total <= CAP) {
            pageNums = Array.from({ length: total }, (_, i) => i + 1);
        } else {
            const head = Array.from({ length: 200 }, (_, i) => i + 1);
            const tail = Array.from({ length: 50 }, (_, i) => total - 50 + i + 1);
            pageNums = head.concat(tail);
            console.warn(`${label || 'PDF'}: ${total}ページと大きいため、テキスト抽出は先頭200＋末尾50ページに限定しました`);
        }
        let text = '';
        for (let idx = 0; idx < pageNums.length; idx++) {
            const tc = await (await pdf.getPage(pageNums[idx])).getTextContent();
            for (const it of tc.items) {
                text += it.str;
                if (it.hasEOL) text += '\n';
            }
            text += '\n';
            if (total > 8 && label) {
                showConvertingOverlay(`テキスト読取中: ${label}（${idx + 1}/${pageNums.length}ページ）`);
            }
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
            const category = getFileCategory(file);
            const result = await fileToNamedPdfBuffer(file);
            if (!result) continue;
            const probe = await probePdfText(result.buffer, result.name);
            state.files.push({
                id: 'file_' + Math.random().toString(36).substr(2, 9),
                file,
                originalName: result.name,
                arrayBuffer: result.buffer,
                isBranch: false,
                // OCR警告は元からPDFだったものだけ対象
                // （画像・Word等からの変換は文字なしが前提のため警告しない）
                hasTextLayer: category === 'pdf' ? probe.hasText : null,
                extractedText: probe.text,
                // 画像（写真・スキャン画像）は元画像を保持し、OCR時はpdf.js描画を介さず直接読み取る
                sourceImageBlob: category === 'image' ? file : null
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
    DOM.exportWordBtn.disabled = !hasFiles;
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

// 号証番号の数字整形：主番号が1桁なら全角（甲１）、2桁以上は半角（甲16）で統一する（事務所慣例）。
function goushoNumFmt(mainNum) {
    const zen = (n) => String(n).replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
    return mainNum < 10 ? zen : (n) => String(n);
}

// 証拠説明書の号証欄用ラベル（例: 甲１、枝番は 甲１の２）。PDFスタンプと違い「号証」等の接尾辞は付けない。
function generateGoushoLabel(index) {
    const numbering = computeNumbering();
    if (index < 0 || index >= numbering.length) return '';
    const { mainNum, branchNum, hasBranches } = numbering[index];
    const fmt = goushoNumFmt(mainNum);
    let base = `${getActualSymbol()}${fmt(mainNum)}`;   // 甲１ / 甲16
    if (hasBranches) base += `の${fmt(branchNum)}`;      // 甲１の２
    return base;
}

// 枝番をまとめた号証ラベル（例: 甲２の１ないし６ / 甲１の１、甲１の２）。sepは「ないし」等。
function generateGoushoRangeLabel(mainNum, branchNums, sep) {
    const fmt = goushoNumFmt(mainNum);
    const sym = getActualSymbol();
    if (branchNums.length <= 1) return `${sym}${fmt(mainNum)}${branchNums.length ? 'の' + fmt(branchNums[0]) : ''}`;
    const first = branchNums[0], last = branchNums[branchNums.length - 1];
    if (branchNums.length === 2) return `${sym}${fmt(mainNum)}の${fmt(first)}、${sym}${fmt(mainNum)}の${fmt(last)}`;
    return `${sym}${fmt(mainNum)}の${fmt(first)}${sep || 'ないし'}${fmt(last)}`;
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
//   label            : 標目に使う清書名（無ければファイル名/本文から抽出）
//   issuer           : true なら作成者＝発行法人（ファイル名・本文の会社名で補完）
//   dated            : true なら標目を「○年○月○日付＋書類名」にする（回答書・通知書等の往復書面）
//   original         : true なら原本、既定は写し
//   authorNeedsDetail: true なら作成者が定型（機関名のみ等）で具体名の補記が要るため【要確認】
//   yearPrefix       : true なら標目に「令和○年度／○年分／第○期」等の年度冠を付す（税務・決算）
const DOC_TYPE_RULES = [
    { re: /賃貸借契約/, author: '当事者双方', purpose: '賃貸借契約締結の事実及びその内容', original: true },
    { re: /雇用契約|労働契約/, author: '当事者双方', purpose: '雇用契約締結の事実及びその内容', original: true },
    { re: /金銭消費貸借|借用書|借用証/, author: '当事者双方', purpose: '金銭消費貸借契約締結の事実及びその内容', original: true },
    { re: /示談書|合意書|和解書|誓約書/, author: '当事者双方', purpose: '合意成立の事実及びその内容', original: true },
    { re: /承諾書|念書/, author: '', purpose: '承諾（合意）の事実及びその内容', original: true },
    { re: /契約書|覚書/, author: '当事者双方', purpose: '契約締結の事実及びその内容', original: true },
    { re: /回答書/, label: '回答書', author: '', purpose: '照会（問い合わせ）に対する回答の内容', issuer: true, dated: true },
    { re: /催告書/, label: '催告書', author: '', purpose: '催告の事実及びその内容', dated: true },
    { re: /内容証明/, label: '内容証明郵便', author: '', purpose: '通知（催告）の事実及びその内容', dated: true },
    { re: /受任通知/, label: '受任通知', author: '', purpose: '受任通知を発した事実及びその内容', dated: true },
    { re: /通知書/, label: '通知書', author: '', purpose: '通知の事実及びその内容', dated: true },
    { re: /請求書/, author: '', purpose: '請求の事実及びその金額', issuer: true },
    { re: /領収書|レシート/, author: '', purpose: '支払の事実及びその金額', issuer: true },
    { re: /見積/, author: '', purpose: '見積の内容', issuer: true },
    { re: /交通事故証明|事故証明書/, label: '交通事故証明書', author: '自動車安全運転センター', purpose: '本件事故の発生日時、場所及び当事者', authorNeedsDetail: true },
    { re: /登記事項証明書|全部事項証明書|登記簿|登記情報/, author: '法務局登記官', purpose: '本件不動産の所有関係その他の登記上の権利関係', authorNeedsDetail: true },
    { re: /評価証明|課税明細|固定資産/, author: '市区町村長', purpose: '本件不動産の評価額', authorNeedsDetail: true, yearPrefix: true },
    { re: /戸籍|除籍/, author: '市区町村長', purpose: '当事者の身分関係及び相続関係（死亡の事実、相続人の範囲及び法定相続分）', authorNeedsDetail: true },
    { re: /住民票/, author: '市区町村長', purpose: '当事者の住所', authorNeedsDetail: true },
    { re: /診断書/, author: '医師', purpose: '傷病名、治療経過及び症状の内容', authorNeedsDetail: true },
    { re: /診療報酬明細|レセプト/, author: '医療機関', purpose: '治療内容及び治療費の額', authorNeedsDetail: true },
    { re: /確定申告|決算書|決算報告|貸借対照表|損益計算書/, author: '', purpose: '収入（所得）の状況', yearPrefix: true },
    { re: /控除証明|保険料控除/, author: '', purpose: '保険契約の内容', issuer: true, yearPrefix: true },
    { re: /源泉徴収票|給与明細|課税証明/, author: '', purpose: '収入の額', yearPrefix: true },
    { re: /陳述書/, author: '', purpose: '本件の経緯', original: true },
    { re: /議事録/, author: '', purpose: '会議における協議・決議の内容' },
    { re: /就業規則/, author: '', purpose: '就業規則の定めの内容' },
    { re: /メール|LINE|ライン|チャット|メッセージ/, author: '', purpose: '当事者間のやり取りの存在及びその内容' },
    { re: /写真|スクリーンショット|スクショ/, author: '', purpose: '本件現場（対象物）の状況' },
    { re: /図面|見取図/, author: '', purpose: '本件現場（対象物）の位置関係' },
];

// 標目（＝書類の名称）らしい語。ファイル名がこれを含めば利用者が意味ある名前を付けたとみなす。
// 本文からの標目抽出でも同じ語を手がかりにする。
const TITLE_KEYWORDS = /(全部事項証明書|一部事項証明書|登記事項証明書|履歴事項全部証明書|現在事項全部証明書|閉鎖事項証明書|登記簿謄本|登記情報|戸籍全部事項証明書|戸籍謄本|戸籍抄本|除籍謄本|改製原戸籍|住民票|印鑑登録証明書|印鑑証明書|固定資産評価証明書|公図|地積測量図|建物図面|預金取引明細|取引明細|入出金明細|通帳|残高証明書|課税証明書|非課税証明書|所得証明書|源泉徴収票|給与明細|確定申告書|決算書|貸借対照表|損益計算書|試算表|見積書|請求書|領収書|レシート|納品書|注文書|発注書|契約書|覚書|念書|合意書|示談書|和解書|誓約書|借用書|借用証書|金銭消費貸借契約書|賃貸借契約書|売買契約書|雇用契約書|労働契約書|就業規則|定款|議事録|株主総会議事録|取締役会議事録|陳述書|報告書|調査報告書|意見書|鑑定書|診断書|後遺障害診断書|診療報酬明細書|診療録|カルテ|施術証明書|通知書|催告書|内容証明|受任通知|回答書|申入書|理由書|上申書|申立書|答弁書|準備書面|訴状|判決書?|決定書?|和解調書|調停調書|公正証書|遺言書|自筆証書遺言|遺産分割協議書|委任状|委託契約書?|支払明細|利用明細|明細書|証明書|証書|申請書|届出書|承諾書|同意書|確認書|メール|ＬＩＮＥ|LINE|ライン|チャット|メッセージ|写真|画像|録音|反訳書|録取書|図面|見取図|地図|案内図|一覧表|計算書|内訳書|価格.?ガイド|査定書)/;

// テキスト・ファイル名から作成年月日を推測する（全角数字は半角化）。
// 実務の多様な表記に対応：完全日付／範囲（〜）／「頃」／年月のみ／年のみ＋頃。
// 優先: ①範囲 → ②ラベル直後 → ③完全日付 → ④年月のみ → ⑤年のみ＋頃 → ⑥ファイル名の日付
function guessDate(name, text) {
    const normalize = (s) => (s || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    // OCRは文字間に空白を挿入しがち（"令 和 2 年…"）。日付は空白をまたがないので全空白を除去して照合。
    const hay = normalize(text).replace(/[\s　]+/g, '');
    const D = '(?:令和|平成|昭和)(?:元|\\d{1,2})年\\d{1,2}月\\d{1,2}日|(?:19|20)\\d{2}年\\d{1,2}月\\d{1,2}日';
    const YM = '(?:令和|平成|昭和)(?:元|\\d{1,2})年\\d{1,2}月|(?:19|20)\\d{2}年\\d{1,2}月';
    const Y = '(?:令和|平成|昭和)(?:元|\\d{1,2})年|(?:19|20)\\d{2}年';

    // ① 範囲（戸籍一式・メール往復・診療録など）: 日付〜日付
    let m = hay.match(new RegExp('(' + D + ')[〜～~ないし乃至]{1,2}(' + D + ')'));
    if (m) return m[1] + '〜' + m[2];
    // ② ラベル（作成日/発行日/交付等）直後の完全日付（頃許容）
    m = hay.match(new RegExp('(?:作成年月日|作成日|作成|発行日|発行|交付|調製|証明日|証明|届出|日付)[：:]{0,3}(' + D + ')(頃)?'));
    if (m) return m[1] + (m[2] || '');
    // ③ 本文中の最初の完全日付（頃許容）
    m = hay.match(new RegExp('(' + D + ')(頃)?'));
    if (m) return m[1] + (m[2] || '');
    // ④ 年月のみ（頃許容）
    m = hay.match(new RegExp('(' + YM + ')(頃)?'));
    if (m) return m[1] + (m[2] || '');
    // ⑤ 年のみ＋頃
    m = hay.match(new RegExp('(' + Y + ')頃'));
    if (m) return m[1] + '頃';
    // ⑥ ファイル名の日付（例: スクリーンショット 2026-07-24、20260724）
    const n = normalize(name);
    const fn = n.match(/(19|20)(\d{2})[-_.\/年]?(\d{1,2})[-_.\/月]?(\d{1,2})/);
    if (fn) return `${fn[1]}${fn[2]}年${parseInt(fn[3], 10)}月${parseInt(fn[4], 10)}日`;
    return '';
}

// 本文（先頭ページ）から標目＝書類名らしい行を1つ拾う。
// タイトルは通常1ページ目の短い行にあるので、先頭の行から書類名キーワードを含む短い行を探す。
function guessTitleFromContent(text) {
    if (!text) return '';
    const lines = text.split('\n')
        .map(s => s.replace(/[　\t ]+/g, ' ').trim())
        .filter(s => s.length > 0);
    for (const ln of lines.slice(0, 25)) {
        const compact = ln.replace(/\s/g, '');
        if (compact.length < 2 || compact.length > 30) continue;
        const m = compact.match(TITLE_KEYWORDS);
        if (m) {
            // 「◯◯であること」等の文の一部で拾わないよう、行がほぼ書類名だけのときのみ採用
            if (compact.length <= m[0].length + 8) return compact;
        }
    }
    return '';
}

// 法人格を含む語群（会社名抽出用）
const CORP_TOKENS = '株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|社会福祉法人|弁護士法人|司法書士法人|税理士法人|行政書士法人|社会保険労務士法人|医療法人|学校法人|宗教法人|特定非営利活動法人|ＮＰＯ法人|NPO法人';

// 会社名・法人名らしき文字列を1つ拾う（先頭一致。作成者候補）
function guessCompany(text) {
    const re = new RegExp('(?:' + CORP_TOKENS + ')[^\\s　、。，,()（）「」]{1,20}|[^\\s　、。，,()（）「」]{2,20}(?:株式会社|有限会社|合同会社)');
    const m = (text || '').match(re);
    return m ? m[0] : '';
}

// 本文中の法人名を全て拾う（署名欄・差出人特定用）。
// OCRは文字間に空白を入れるため空白を除去してから照合する。
// 法人格の位置で「前置き型（株式会社○○）」と「後置き型（○○株式会社）」の両方に対応する。
const COMPANY_BOUNDARY = '代表取締役|代表者|代表社員|代表理事|理事長|会長|社長|専務|常務|取締役|御中|様|殿|印|、|。|：|:';
function allCompanies(text) {
    if (!text) return [];
    const t = text.replace(/[\s　]+/g, '');
    const corpRe = new RegExp('(?:' + CORP_TOKENS + ')', 'g');
    const bnd = new RegExp(COMPANY_BOUNDARY);
    const bndOrDigit = new RegExp(COMPANY_BOUNDARY + '|\\d', 'g');
    const out = [];
    let m;
    while ((m = corpRe.exec(t)) && out.length < 60) {
        const tok = m[0];
        const tokStart = m.index, tokEnd = m.index + tok.length;

        // 前置き型: 法人格の直後を名称とみなす（境界語まで、最大20字）
        const after = t.slice(tokEnd);
        let aEnd = after.search(bnd);
        if (aEnd < 0 || aEnd > 20) aEnd = Math.min(20, after.length);
        const afterName = after.slice(0, aEnd);

        // 後置き型: 法人格の直前を名称とみなす（直近の境界語/数字より後、最大20字）
        const before = t.slice(0, tokStart);
        let bStart = Math.max(0, before.length - 20);
        const bm = [...before.matchAll(bndOrDigit)];
        if (bm.length) bStart = Math.max(bStart, bm[bm.length - 1].index + bm[bm.length - 1][0].length);
        const beforeName = before.slice(bStart);

        // 直後に名称文字が続けば前置き型、続かなければ後置き型として採用
        if (afterName.length >= 1) out.push(tok + afterName);
        else if (beforeName.length >= 2) out.push(beforeName + tok);
        else out.push(tok);

        corpRe.lastIndex = tokEnd;
    }
    return out;
}

// 会社名の照合キー（中黒・空白を除く。「エスエムエス」と「エス・エム・エス」を同一視するため）
function normCo(s) { return (s || '').replace(/[・･\s　]/g, ''); }

// 作成者＝発行法人を推定する。ファイル名の会社名（利用者が付けた発行者）を手がかりに、
// 本文中の正式名称（中黒付き等の正確な表記）があればそれを採用する。
// 返り値 { author, confident }（confident=本文で裏取りできた／署名欄から取れた）
function guessAuthorCompany(name, fullText) {
    const contentCos = allCompanies(fullText);
    const fnCo = guessCompany(name);
    if (fnCo) {
        const key = normCo(fnCo);
        const hit = contentCos.find(c => { const n = normCo(c); return n === key || n.includes(key) || key.includes(n); });
        if (hit) return { author: hit, confident: true };  // 本文の正式表記を優先（例: 株式会社エス・エム・エス）
        return { author: fnCo, confident: false };          // ファイル名のみ＝正式表記は要確認
    }
    if (contentCos.length) return { author: contentCos[contentCos.length - 1], confident: true }; // 末尾＝署名欄想定
    return { author: '', confident: false };
}

// ファイル名から標目に使う書類名だけを取り出す（会社名や末尾の日付数字等を落とす）。
// 例: 「株式会社エスエムエス　回答書080724」→「回答書」
function cleanFilenameTitle(name) {
    const segs = name.split(/[\s　_]+/).filter(Boolean);
    let seg = segs.find(s => TITLE_KEYWORDS.test(s));
    if (!seg) seg = name;
    seg = seg.replace(/^[（(【\[].*?[）)】\]]/, '').trim(); // 先頭の括弧書き（号証番号等）を除去
    // 末尾の連番・区切り（A／B／1／2／(1)／-2／080724 等。「（土地）」等の語は末尾がCJKなので残る）
    seg = seg.replace(/[（(]?\s*[-_.0-9A-Za-zＡ-Ｚａ-ｚ]+\s*[）)]?\s*$/, '').trim();
    return seg || name;
}

// 日付文字列を「令和○年○月○日」形式（和暦フル）へ変換する（標目の日付前置き用）
function toWarekiFull(dateStr) {
    if (!dateStr) return '';
    const s = dateStr.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    let m = s.match(/(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日/);
    if (m) {
        const y = m[2] === '元' ? 1 : parseInt(m[2], 10);
        return `${m[1]}${y}年${parseInt(m[3], 10)}月${parseInt(m[4], 10)}日`;
    }
    m = s.match(/((?:19|20)\d{2})年(\d{1,2})月(\d{1,2})日/);
    if (m) {
        const y = +m[1], mo = +m[2], d = +m[3];
        let era, ey;
        if (y > 2019 || (y === 2019 && mo >= 5)) { era = '令和'; ey = y - 2018; }
        else if (y > 1989 || (y === 1989 && mo >= 1)) { era = '平成'; ey = y - 1988; }
        else { era = '昭和'; ey = y - 1925; }
        return `${era}${ey}年${mo}月${d}日`;
    }
    return '';
}

/**
 * 書類の内容（ファイル名＋抽出テキスト＝テキスト層又はOCR結果）から証拠説明書の各欄を推測する。
 * 日付・標目・作成者は全文から判定する。確実に分からない欄は空欄のまま返す。
 * OCRは文字間に空白を挿入するため、種別判定は空白除去後のテキストで行う。
 */
function guessDocMeta(fileObj) {
    const name = fileObj.originalName.replace(/\.[^.]+$/, '');
    const fullText = fileObj.extractedText || '';
    // 種別判定用：ファイル名＋本文（先頭2000字）から空白を除いて照合（OCRの字間空白対策）
    const hay = (name + '\n' + fullText.slice(0, 2000)).replace(/[\s　]+/g, '');

    let matchedRule = null;
    for (const rule of DOC_TYPE_RULES) {
        if (rule.re.test(hay)) { matchedRule = rule; break; }
    }

    let author = '', purpose = '', authorConfident = false;
    if (matchedRule) {
        author = matchedRule.author;
        purpose = matchedRule.purpose;
        if (author) authorConfident = true; // 「当事者双方」「法務局登記官」等の定型
    }
    // 発行者系（回答書・請求書・領収書等）は会社名を作成者に補完
    if (!author && matchedRule && matchedRule.issuer) {
        const a = guessAuthorCompany(name, fullText);
        author = a.author;
        authorConfident = a.confident;
    }

    const date = guessDate(name, fullText);

    // 標目のコア（書類名）を決める。titleSource: 'rule'（種別ラベル）/ 'filename' / 'content' / 'fallback'
    let coreName, titleSource;
    if (matchedRule && matchedRule.label) {
        coreName = matchedRule.label; titleSource = 'rule';
    } else {
        const contentTitle = guessTitleFromContent(fullText);
        if (TITLE_KEYWORDS.test(name)) { coreName = cleanFilenameTitle(name); titleSource = 'filename'; }
        else if (contentTitle) { coreName = contentTitle; titleSource = 'content'; }
        else { coreName = name; titleSource = 'fallback'; }
    }

    // 税務・決算・証明書類は「令和○年度／○年分／第○期」等の年度冠を標目頭に付す
    if (matchedRule && matchedRule.yearPrefix) {
        const yp = guessYearPrefix(name, fullText);
        if (yp && !coreName.startsWith(yp)) coreName = yp + coreName;
    }

    // 往復書面（回答書・通知書等）は「○年○月○日付＋書類名」を標目にする
    const datedTitle = !!(matchedRule && matchedRule.dated && date);
    let title = datedTitle ? (toWarekiFull(date) + '付' + coreName) : coreName;

    // 原本／写しの別：契約書・借用書・合意書・陳述書等（事務所ルールで原本提出）は原本、他は写し
    const original = !!(matchedRule && matchedRule.original);
    // 作成者が機関名のみ等の定型で具体名（首長名・支局名等）の補記が要るか
    const authorNeedsDetail = !!(matchedRule && matchedRule.authorNeedsDetail && author);

    return { date, author, authorConfident, authorNeedsDetail, purpose, title, titleSource, original, core: coreName, datedTitle };
}

// 税務・決算・証明書類の標目に冠する年度表記を拾う（令和○年度／○年分／第○期／令和○年分）
function guessYearPrefix(name, fullText) {
    const s = (name + '\n' + fullText.slice(0, 1500)).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[\s　]+/g, '');
    let m = s.match(/(?:令和|平成|昭和)(?:元|\d{1,2})年度/); if (m) return m[0];
    m = s.match(/(?:19|20)\d{2}年度/); if (m) return m[0];
    m = s.match(/(?:令和|平成|昭和)(?:元|\d{1,2})年分/); if (m) return m[0];
    m = s.match(/(?:19|20)\d{2}年分/); if (m) return m[0];
    m = s.match(/第\d{1,3}期/); if (m) return m[0];
    return '';
}

// ── 証拠説明書のWord（.docx）出力 ──
// 事務所ひな形（書類ひな形\00_共通\証拠説明書\証拠説明書.docx）と同じ書式で
// 依存ライブラリなしにOOXMLを直接組み立てる。

// 単一の日付又は年月・年を「R7.3.19」「R4.11」「H27」の短縮和暦へ変換する（不能なら''）
function toShortWarekiOne(s) {
    s = (s || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const E = { '令和': 'R', '平成': 'H', '昭和': 'S' };
    let m = s.match(/(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日/);
    if (m) return `${E[m[1]]}${m[2] === '元' ? 1 : +m[2]}.${+m[3]}.${+m[4]}`;
    m = s.match(/(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月/);
    if (m) return `${E[m[1]]}${m[2] === '元' ? 1 : +m[2]}.${+m[3]}`;
    m = s.match(/(令和|平成|昭和)(元|\d{1,2})年/);
    if (m) return `${E[m[1]]}${m[2] === '元' ? 1 : +m[2]}`;
    const sei = (y, mo, d) => {
        let e, ey;
        if (y > 2019 || (y === 2019 && (mo || 1) >= 5)) { e = 'R'; ey = y - 2018; }
        else if (y > 1989 || (y === 1989 && (mo || 12) >= 1)) { e = 'H'; ey = y - 1988; }
        else { e = 'S'; ey = y - 1925; }
        return e + ey + (mo ? '.' + mo : '') + (d ? '.' + d : '');
    };
    m = s.match(/((?:19|20)\d{2})年(\d{1,2})月(\d{1,2})日/); if (m) return sei(+m[1], +m[2], +m[3]);
    m = s.match(/((?:19|20)\d{2})年(\d{1,2})月/); if (m) return sei(+m[1], +m[2], 0);
    m = s.match(/((?:19|20)\d{2})年/); if (m) return sei(+m[1], 0, 0);
    return '';
}

// 「令和７年３月１９日」「2026年7月24日」等を慣例表記「R7.3.19」へ変換する。
// 範囲（〜）、「頃」、年月のみ、年のみ＋頃にも対応する。
function toShortWareki(dateStr) {
    if (!dateStr) return '';
    const koro = /頃$/.test(dateStr);
    const core = dateStr.replace(/頃$/, '').trim();
    const parts = core.split(/[〜～~]/);
    if (parts.length === 2) {
        const a = toShortWarekiOne(parts[0].trim()) || parts[0].trim();
        const b = toShortWarekiOne(parts[1].trim()) || parts[1].trim();
        return `${a}〜${b}${koro ? '頃' : ''}`;
    }
    const one = toShortWarekiOne(core);
    return (one || dateStr) + (koro ? '頃' : '');
}

// 本日の日付を「令和８年７月２４日」形式（全角数字）で返す
function todayWarekiFull() {
    const now = new Date();
    const y = now.getFullYear() - 2018; // 令和
    const toZen = (n) => String(n).replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
    return `令和${toZen(y)}年${toZen(now.getMonth() + 1)}月${toZen(now.getDate())}日`;
}

function xmlEscape(s) {
    return String(s == null ? '' : s)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ZIP（無圧縮stored）ライター。docxはZIPコンテナなのでこれで十分。
let CRC_TABLE = null;
function crc32(data) {
    if (!CRC_TABLE) {
        CRC_TABLE = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            CRC_TABLE[i] = c >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZipStored(entries) {
    const enc = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const { name, text } of entries) {
        const nameBytes = enc.encode(name);
        const data = enc.encode(text);
        const crc = crc32(data);

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);      // version needed
        lv.setUint16(6, 0x0800, true);  // UTF-8 filename flag
        lv.setUint16(8, 0, true);       // stored（無圧縮）
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        localParts.push(local, data);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centralParts.push(central);
        offset += local.length + data.length;
    }
    const centralSize = centralParts.reduce((a, p) => a + p.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    const out = new Uint8Array(offset + centralSize + 22);
    let pos = 0;
    for (const p of [...localParts, ...centralParts, end]) { out.set(p, pos); pos += p.length; }
    return out;
}

// 表セル内の段落（9pt・行送り486twip atLeast＝ひな形と同じ）
function cellParaXml(text, center) {
    const jc = center ? 'center' : 'left';
    const runs = String(text || '').split('\n').map(line =>
        line === '' ? '' : `<w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`);
    return runs.map(r =>
        `<w:p><w:pPr><w:spacing w:line="486" w:lineRule="atLeast"/><w:jc w:val="${jc}"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>${r}</w:p>`
    ).join('');
}

function tcXml(widthPct, paraXml, gridSpan) {
    const span = gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${widthPct}" w:type="pct"/>${span}</w:tcPr>${paraXml}</w:tc>`;
}

// 前文の1段落（10.5pt既定）。jc: left/center/right、szは半ポイント指定
function preParaXml(text, jc, sz) {
    const szXml = sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : '';
    const run = text === '' ? '' :
        `<w:r><w:rPr><w:rFonts w:hint="eastAsia"/>${szXml}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
    return `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>${run}</w:p>`;
}

/**
 * 証拠説明書のdocxバイナリを生成する（事務所ひな形と同じレイアウト）。
 * rows: [{ gousho, title, copy, date, author, purpose }]
 * options.remarks: true で簡裁・旧書式（末尾に「備考」列を追加）
 */
function buildShoukoDocx(rows, options) {
    const remarks = !!(options && options.remarks);
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

    // ── 前文（弁護士名・事件名・裁判所名は●●のまま。日付は本日） ──
    const preamble =
        preParaXml('令和●年（●）第●●号　●●請求事件', 'left') +
        preParaXml('原　告　　●●', 'left') +
        preParaXml('被　告　　●●', 'left') +
        `<w:p><w:pPr><w:spacing w:line="566" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>証拠説明書</w:t></w:r></w:p>` +
        preParaXml(todayWarekiFull(), 'right') +
        preParaXml('●●裁判所　御中', 'left') +
        preParaXml('', 'left') +
        preParaXml('●●訴訟代理人弁護士　●●', 'right') +
        preParaXml('', 'left');

    // ── 表（6列グリッド。見出し行の「標目」は2列結合＝ひな形と同一構造） ──
    const headerCellPara = (text) =>
        `<w:p><w:pPr><w:spacing w:line="486" w:lineRule="atLeast"/><w:jc w:val="center"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${xmlEscape(text)}</w:t></w:r></w:p>`;
    const hyomokuHeaderPara = ['標　　目', '（原本・写しの別）'].map(t =>
        `<w:p><w:pPr><w:spacing w:line="280" w:lineRule="exact"/><w:jc w:val="center"/><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${t}</w:t></w:r></w:p>`).join('');

    // 列幅（pct・合計5000）。備考列ありのときは立証趣旨を狭めて備考を追加。
    const W = remarks
        ? { purpose: 1300, remark: 496 }
        : { purpose: 1796, remark: 0 };

    const headerRow =
        `<w:tr><w:trPr><w:trHeight w:val="486"/></w:trPr>` +
        tcXml(466, headerCellPara('号証')) +
        tcXml(1331, hyomokuHeaderPara, 2) +
        tcXml(626, headerCellPara('作成年月日')) +
        tcXml(781, headerCellPara('作　成　者')) +
        tcXml(W.purpose, headerCellPara('立　証　趣　旨')) +
        (remarks ? tcXml(W.remark, headerCellPara('備　考')) : '') +
        `</w:tr>`;

    const dataRows = rows.map(row =>
        `<w:tr><w:trPr><w:trHeight w:val="984"/></w:trPr>` +
        tcXml(466, cellParaXml(row.gousho)) +
        tcXml(1018, cellParaXml(row.title)) +
        tcXml(313, cellParaXml(row.copy)) +
        tcXml(626, cellParaXml(row.date)) +
        tcXml(781, cellParaXml(row.author)) +
        tcXml(W.purpose, cellParaXml(row.purpose)) +
        (remarks ? tcXml(W.remark, cellParaXml(row.remark || '')) : '') +
        `</w:tr>`
    ).join('');

    const tblGrid = remarks
        ? `<w:tblGrid><w:gridCol w:w="845"/><w:gridCol w:w="1845"/><w:gridCol w:w="567"/><w:gridCol w:w="1134"/><w:gridCol w:w="1415"/><w:gridCol w:w="2355"/><w:gridCol w:w="900"/></w:tblGrid>`
        : `<w:tblGrid><w:gridCol w:w="845"/><w:gridCol w:w="1845"/><w:gridCol w:w="567"/><w:gridCol w:w="1134"/><w:gridCol w:w="1415"/><w:gridCol w:w="3255"/></w:tblGrid>`;

    const table =
        `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>` +
        `<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders>` +
        `<w:tblCellMar><w:left w:w="52" w:type="dxa"/><w:right w:w="52" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
        tblGrid +
        headerRow + dataRows + `</w:tbl>`;

    const sectPr =
        `<w:sectPr><w:footerReference w:type="default" r:id="rId2"/>` +
        `<w:pgSz w:w="11906" w:h="16838" w:code="9"/>` +
        `<w:pgMar w:top="1985" w:right="1134" w:bottom="1701" w:left="1701" w:header="850" w:footer="850" w:gutter="0"/>` +
        `<w:pgNumType w:start="1"/><w:cols w:space="720"/>` +
        `<w:docGrid w:type="linesAndChars" w:linePitch="486" w:charSpace="2048"/></w:sectPr>`;

    const documentXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:document ${NS}><w:body>${preamble}${table}<w:p/>${sectPr}</w:body></w:document>`;

    const stylesXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>` +
        `<w:rFonts w:ascii="Times New Roman" w:eastAsia="ＭＳ 明朝" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>` +
        `<w:kern w:val="2"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="ja-JP" w:bidi="ar-SA"/>` +
        `</w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>` +
        `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

    const footerXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r><w:instrText xml:space="preserve">PAGE   \\* MERGEFORMAT</w:instrText></w:r>` +
        `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r>` +
        `<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

    const contentTypes =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
        `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
        `</Types>`;

    const rootRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `</Relationships>`;

    const docRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
        `</Relationships>`;

    return buildZipStored([
        { name: '[Content_Types].xml', text: contentTypes },
        { name: '_rels/.rels', text: rootRels },
        { name: 'word/document.xml', text: documentXml },
        { name: 'word/_rels/document.xml.rels', text: docRels },
        { name: 'word/styles.xml', text: stylesXml },
        { name: 'word/footer1.xml', text: footerXml },
    ]);
}

// ── OCR（スキャン・手書きPDF/画像のフォールバック）──
// 完全ローカル（Tesseract.js）。書類データは一切外部送信せず、言語モデルだけCDNから取得する。
// テキスト層の無い書類だけを、証拠説明書出力時にその場で読み取る。
let _ocrWorker = null;
async function getOcrWorker() {
    if (typeof Tesseract === 'undefined') throw new Error('OCRエンジン(Tesseract.js)が読み込まれていません');
    if (!_ocrWorker) {
        // 日本語モデル（横書きjpn＋縦書きjpn_vert）。初回のみCDNから言語データを取得。書類そのものは送信しない。
        _ocrWorker = await Tesseract.createWorker(['jpn', 'jpn_vert']);
    }
    return _ocrWorker;
}

// 画像（写真・スキャン画像）を直接OCRする。pdf.jsの描画を介さないため高速・堅牢。
async function ocrImageBlob(blob, label) {
    const worker = await getOcrWorker();
    showConvertingOverlay(`手書き・スキャン文字を読取中: ${label || ''}`);
    const { data } = await worker.recognize(blob);
    return data.text || '';
}

// PDFバッファの各ページを画像化してOCRし、抽出テキストを返す（進捗はオーバーレイ表示）。
// OCRは低速なため、巨大書類だけ先頭30＋末尾10ページに限定し、脱落分はconsoleに明示する。
async function ocrPdfBuffer(buffer, label) {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const total = pdf.numPages;
    let pageNums;
    if (total <= 40) {
        pageNums = Array.from({ length: total }, (_, i) => i + 1);
    } else {
        const head = Array.from({ length: 30 }, (_, i) => i + 1);
        const tail = Array.from({ length: 10 }, (_, i) => total - 10 + i + 1);
        pageNums = head.concat(tail);
        console.warn(`${label || 'PDF'}: ${total}ページと大きいため、OCRは先頭30＋末尾10ページに限定しました`);
    }
    const worker = await getOcrWorker();
    let text = '';
    for (let idx = 0; idx < pageNums.length; idx++) {
        const page = await pdf.getPage(pageNums[idx]);
        const viewport = page.getViewport({ scale: 2.0 }); // OCR精度のため高解像度で描画
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        showConvertingOverlay(`手書き・スキャン文字を読取中: ${label}（${idx + 1}/${pageNums.length}ページ）`);
        const { data } = await worker.recognize(canvas);
        text += (data.text || '') + '\n';
    }
    return text;
}

/**
 * 現在の号証一覧から証拠説明書の各行（号証・標目・原本写し・作成年月日・作成者・立証趣旨）を組み立てる。
 * 枝番まとめ・同種書類の日付括弧・同上継承・【要確認】付与を含む純粋関数（state.filesとsettingsを参照）。
 */
function computeShoukoRows() {
    // Pass 1: 各ファイルの推測結果と号証番号
    const numbering = computeNumbering();
    const items = state.files.map((f, i) => ({
        g: guessDocMeta(f),
        ocr: !!f.ocrUsed,
        main: numbering[i].mainNum,
        branch: numbering[i].branchNum,
        hasBranches: numbering[i].hasBranches,
    }));

    // Pass 2: 連続する同一主番号をまとめ、同種の枝番のみ（設定ONのとき）1行に統合
    const mergeBranches = state.settings.mergeBranches === true;
    const units = [];
    for (const it of items) {
        const last = units[units.length - 1];
        if (last && last.main === it.main) last.items.push(it);
        else units.push({ main: it.main, items: [it] });
    }
    const descriptors = [];
    for (const u of units) {
        const homogeneous = u.items.length > 1
            && u.items.every(it => it.g.core && it.g.core === u.items[0].g.core && !it.g.datedTitle);
        if (mergeBranches && homogeneous) {
            descriptors.push({
                rep: u.items[0], ocr: u.items.some(x => x.ocr), multi: true,
                gousho: generateGoushoRangeLabel(u.main, u.items.map(x => x.branch), 'ないし'),
            });
        } else {
            for (const it of u.items) {
                const fmt = goushoNumFmt(it.main);
                let gousho = `${getActualSymbol()}${fmt(it.main)}`;
                if (it.hasBranches) gousho += `の${fmt(it.branch)}`;
                descriptors.push({ rep: it, ocr: it.ocr, multi: false, gousho });
            }
        }
    }

    // 同種書類（日付付き書面でないもの）が複数あるかを数える（標目の日付括弧付置用）
    const coreCount = {};
    for (const d of descriptors) {
        const g = d.rep.g;
        if (!d.multi && !g.datedTitle && g.core) coreCount[g.core] = (coreCount[g.core] || 0) + 1;
    }

    // Pass 3: 各行のセルを組み立て（日付括弧・同上継承・【要確認】）
    const rows = [];
    let prevAuthorBase = '', prevPurpose = '';
    for (const d of descriptors) {
        const g = d.rep.g;
        const ocr = d.ocr;

        // 標目：同種書類が複数並ぶなら日付で識別（借用書（H26.9.24付）等）
        let title = g.title;
        if (!d.multi && !g.datedTitle && g.core && coreCount[g.core] >= 2 && g.date) {
            title = `${g.core}（${toShortWareki(g.date)}付）`;
        }
        const titleUnsure = g.titleSource === 'fallback'
            || ((g.titleSource === 'content' || g.titleSource === 'rule') && ocr);
        if (!title) title = '【要確認】';
        else if (titleUnsure) title += '【要確認】';

        const copy = g.original ? '原本' : '写し';

        // 作成年月日：拾えなければ【要確認】、OCR由来・枝番まとめ（各通あり）は値＋【要確認】
        let date = g.date ? toShortWareki(g.date) : '';
        if (!date) date = '【要確認】';
        else if (ocr || d.multi) date += '【要確認】';

        // 作成者：裏取り不可／機関名のみ／OCR由来は【要確認】。直前と同一なら「同上」
        const authorBase = g.author || '';
        let author = authorBase;
        if (author && (!g.authorConfident || g.authorNeedsDetail || ocr)) author += '【要確認】';
        if (authorBase && authorBase === prevAuthorBase) author = '同上';

        // 立証趣旨：直前と同一なら「同上」
        const purposeBase = g.purpose || '';
        const purpose = (purposeBase && purposeBase === prevPurpose) ? '同上' : purposeBase;

        rows.push({ gousho: d.gousho, title, copy, date, author, purpose });
        prevAuthorBase = authorBase;
        prevPurpose = purposeBase;
    }
    return rows;
}

/**
 * 証拠説明書の下書きをWord（.docx）で出力する。
 * テキスト層の無いスキャン・手書き書類は、その場でOCR（完全ローカル）して日付・標目を補う。
 * 号証番号・標目を自動記入し、作成年月日・作成者・立証趣旨は内容から推測できる範囲で仮埋めする。
 * 弁護士名・事件名・裁判所名等の前文は●●のままなので、Wordで開いて埋める。
 */
async function exportShoukoSetsumeiWord() {
    if (state.files.length === 0) return;

    try {
        // テキスト層が無い（スキャン/手書き）書類は、その場でOCRして本文を補う
        const needOcr = state.files.filter(f =>
            !(f.extractedText && f.extractedText.trim().length > 0) && !f.ocrDone);
        if (needOcr.length > 0) {
            if (typeof Tesseract === 'undefined') {
                alert('OCRエンジンの読み込みに失敗しました（オフライン等）。\nスキャン・手書き書類の日付／標目は空欄のまま出力します。');
            } else {
                showConvertingOverlay('手書き・スキャン文字の読み取りを準備中…');
                for (const f of needOcr) {
                    try {
                        // 画像は元画像を直接OCR（高速・堅牢）。PDFスキャンはページを描画してOCR。
                        f.extractedText = f.sourceImageBlob
                            ? await ocrImageBlob(f.sourceImageBlob, f.originalName)
                            : await ocrPdfBuffer(f.arrayBuffer, f.originalName);
                    } catch (e) {
                        console.warn('OCRに失敗:', f.originalName, e);
                    }
                    f.ocrDone = true;  // 二重OCR防止（次回出力時は再読取しない）
                    f.ocrUsed = true;  // OCR由来の値は要確認扱いにする
                }
            }
        }

        const rows = computeShoukoRows();
        const bytes = buildShoukoDocx(rows, { remarks: state.settings.shoukoRemarks === true });
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `証拠説明書下書き_${getActualSymbol()}.docx`;
        link.click();
    } catch (err) {
        console.error('証拠説明書の作成に失敗:', err);
        alert(`証拠説明書の作成中にエラーが発生しました。\n詳細: ${err.message}`);
    } finally {
        hideConvertingOverlay();
    }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', init);
