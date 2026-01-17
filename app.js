/**
 * PDF Compressor app.js
 * Manages UI interactions and communication with Web Worker.
 */

const CONFIG = {
    LIMITS: {
        MAX_FILE_SIZE_MB: 50,
        MAX_PAGE_COUNT: 100, // This is checked in worker
        WARN_FILE_SIZE_MB: 30,
        WARN_PAGE_COUNT: 50
    }
};

const STRINGS = {
    ERR_PDF_ONLY: 'PDFファイル（.pdf）を選択してください。',
    ERR_HARD_LIMIT_SIZE: (limit) => `ファイルサイズ${limit}MB以上のPDFは処理できません。`,
    ERR_HARD_LIMIT_PAGES: (limit) => `${limit}ページ以上のPDFは処理できません。`,
    ERR_GENERIC: '処理中にエラーが発生しました。ファイルの状態を確認してください。',
    WARN_LARGE_SIZE: (size) => `${size}MBを超える大容量ファイルです。お使いの環境によっては時間がかかったり、ブラウザが停止したりする可能性があります。続行しますか？`,
    WARN_LARGE_PAGES: (count) => `ページ数が多いため（${count}ページ）、処理に時間がかかったりブラウザが停止したりする可能性があります。続行しますか？`,
    STATUS_PROCESSING: (current, total) => `${current} / ${total} ページを処理中`
};

const UIManager = {
    state: {
        currentFile: null,
        originalSize: 0,
        compressedBlob: null,
        isLargeFileConfirmed: false
    },

    worker: null,

    el: {
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        processingView: document.getElementById('processingView'),
        resultView: document.getElementById('resultView'),
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        errorMsg: document.getElementById('errorMsg'),
        quality: document.getElementById('qualitySelect'),
        dpi: document.getElementById('dpiSelect'),
        modal: document.getElementById('howToUseModal')
    },

    init() {
        if (!window.OffscreenCanvas) {
            this.showError('お使いのブラウザはOffscreenCanvasをサポートしていないため、処理が正常に動作しない可能性があります。最新のChrome, Edge, またはSafariをご使用ください。');
        }
        this.setupEventListeners();
        this.initWorker();
    },

    initWorker() {
        this.worker = new Worker('worker.js');
        this.worker.onmessage = (e) => {
            const { type, current, total, blob, message } = e.data;

            switch (type) {
                case 'progress':
                    this.updateProgress(current, total);
                    break;
                case 'done':
                    this.state.compressedBlob = blob;
                    this.showResult();
                    break;
                case 'aborted':
                    this.reset();
                    break;
                case 'error':
                    this.handleError(new Error(message));
                    break;
            }
        };
    },

    setupEventListeners() {
        this.el.uploadArea.onclick = () => this.el.fileInput.click();
        this.el.uploadArea.ondragover = e => { e.preventDefault(); this.el.uploadArea.classList.add('dragging'); };
        this.el.uploadArea.ondragleave = () => this.el.uploadArea.classList.remove('dragging');
        this.el.uploadArea.ondrop = e => {
            e.preventDefault();
            this.el.uploadArea.classList.remove('dragging');
            this.handleFileSelection(e.dataTransfer.files[0]);
        };
        this.el.fileInput.onchange = e => this.handleFileSelection(e.target.files[0]);

        document.getElementById('howToUseBtn').onclick = () => this.el.modal.classList.add('active');
        document.getElementById('closeModalBtn').onclick = () => this.el.modal.classList.remove('active');
        this.el.modal.onclick = e => { if (e.target === this.el.modal) this.el.modal.classList.remove('active'); };

        document.getElementById('downloadBtn').onclick = () => this.download();
        document.getElementById('recompressBtn').onclick = () => this.startProcessing(true);
        document.getElementById('resetBtn').onclick = () => this.reset();
        document.getElementById('cancelBtn').onclick = () => {
            this.worker.postMessage({ type: 'abort' });
        };
    },

    handleFileSelection(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showError(STRINGS.ERR_PDF_ONLY);
            return;
        }

        if (file.size > CONFIG.LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024) {
            this.showError(STRINGS.ERR_HARD_LIMIT_SIZE(CONFIG.LIMITS.MAX_FILE_SIZE_MB));
            return;
        }

        this.state.isLargeFileConfirmed = false;
        if (file.size > CONFIG.LIMITS.WARN_FILE_SIZE_MB * 1024 * 1024) {
            if (!confirm(STRINGS.WARN_LARGE_SIZE(CONFIG.LIMITS.WARN_FILE_SIZE_MB))) return;
            this.state.isLargeFileConfirmed = true;
            if (this.el.dpi.value === "3.0") this.el.dpi.value = "2.0";
        }

        this.state.currentFile = file;
        this.state.originalSize = file.size;
        this.startProcessing();
    },

    startProcessing(isManualRecompress = false) {
        this.hideError();
        this.switchView('processing');

        const options = {
            quality: parseFloat(this.el.quality.value),
            scale: parseFloat(this.el.dpi.value),
            isConfirmed: this.state.isLargeFileConfirmed || isManualRecompress
        };

        this.worker.postMessage({
            type: 'start',
            file: this.state.currentFile,
            options: options
        });
    },

    updateProgress(current, total) {
        const percent = Math.round((current / total) * 100);
        this.el.progressBar.style.width = percent + '%';
        this.el.progressText.textContent = STRINGS.STATUS_PROCESSING(current, total);
    },

    showResult() {
        this.switchView('result');
        const compSize = this.state.compressedBlob.size;
        document.getElementById('originalSize').textContent = this.formatSize(this.state.originalSize);
        document.getElementById('compressedSize').textContent = this.formatSize(compSize);

        const ratio = Math.round((1 - compSize / this.state.originalSize) * 100);
        const reductionEl = document.getElementById('reduction');
        reductionEl.textContent = (ratio >= 0 ? '-' : '+') + Math.abs(ratio) + '%';
        reductionEl.style.color = ratio > 0 ? 'var(--success)' : 'var(--error)';
    },

    download() {
        if (!this.state.compressedBlob) return;
        const url = URL.createObjectURL(this.state.compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.state.currentFile.name.replace('.pdf', '')}_compressed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    },

    reset() {
        this.state = { currentFile: null, originalSize: 0, compressedBlob: null, isLargeFileConfirmed: false };
        this.el.fileInput.value = '';
        this.el.progressBar.style.width = '0%';
        this.el.progressText.textContent = '準備中...';
        this.switchView('upload');
    },

    switchView(view) {
        this.el.uploadArea.classList.toggle('hidden', view !== 'upload');
        this.el.processingView.classList.toggle('hidden', view !== 'processing');
        this.el.resultView.classList.toggle('hidden', view !== 'result');
    },

    handleError(err) {
        if (err.message === 'ABORTED_BY_USER') {
            this.reset();
        } else if (err.message === 'LIMIT_PAGES') {
            this.showError(STRINGS.ERR_HARD_LIMIT_PAGES(CONFIG.LIMITS.MAX_PAGE_COUNT));
            this.switchView('upload');
        } else {
            console.error(err);
            this.showError(STRINGS.ERR_GENERIC);
            this.switchView('upload');
        }
    },

    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    showError(msg) {
        this.el.errorMsg.textContent = msg;
        this.el.errorMsg.classList.remove('hidden');
    },

    hideError() { this.el.errorMsg.classList.add('hidden'); }
};

document.addEventListener('DOMContentLoaded', () => UIManager.init());
