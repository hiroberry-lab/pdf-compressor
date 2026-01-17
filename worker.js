/**
 * PDF Compressor Worker
 * Handles PDF rendering and re-compression in a background thread.
 */

// Polyfill for PDF.js which expects a DOM environment even in workers
if (typeof document === 'undefined') {
    self.document = {
        createElement: (tag) => {
            if (tag === 'canvas') {
                return new OffscreenCanvas(1, 1);
            }
            return { style: {} };
        },
        getElementsByTagName: () => [],
        documentElement: { style: {} },
        URL: self.location.href
    };
    self.window = self;
}

importScripts('lib/pdf.min.js');
importScripts('lib/pdf-lib.min.js');

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

let isAborted = false;

self.onmessage = async (e) => {
    const { type, file, options } = e.data;

    if (type === 'start') {
        isAborted = false;
        try {
            const resultBlob = await processPDF(file, options);
            if (!isAborted) {
                self.postMessage({ type: 'done', blob: resultBlob });
            }
        } catch (error) {
            if (error.message === 'ABORTED_BY_USER') {
                self.postMessage({ type: 'aborted' });
            } else {
                self.postMessage({ type: 'error', message: error.message });
            }
        }
    } else if (type === 'abort') {
        isAborted = true;
    }
};

async function processPDF(file, options) {
    const arrayBuffer = await file.arrayBuffer();
    // Use disableWorker: true to prevent PDF.js from trying to create its own workers inside our worker
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;

    const { quality, scale } = options;
    const newPdf = await PDFLib.PDFDocument.create();
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        if (isAborted) throw new Error('ABORTED_BY_USER');

        self.postMessage({ type: 'progress', current: i, total: totalPages });

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        // Use OffscreenCanvas in Worker
        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        // OffscreenCanvas.convertToBlob is supported in modern browsers
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        const imgBytes = await blob.arrayBuffer();
        const img = await newPdf.embedJpg(imgBytes);

        const newPage = newPdf.addPage([viewport.width / scale, viewport.height / scale]);
        newPage.drawImage(img, {
            x: 0, y: 0,
            width: newPage.getWidth(),
            height: newPage.getHeight()
        });
    }

    const pdfBytes = await newPdf.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
}
