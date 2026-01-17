/**
 * PDF Compressor Worker (Hybrid Model)
 * Handles PDF construction using pdf-lib in a background thread.
 * PDF rendering (PDF.js) is handled in the main thread to avoid DOM dependency issues.
 */

importScripts('lib/pdf-lib.min.js');

let newPdf = null;
let isAborted = false;

self.onmessage = async (e) => {
    const { type, data, options } = e.data;

    try {
        switch (type) {
            case 'init':
                isAborted = false;
                newPdf = await PDFLib.PDFDocument.create();
                break;

            case 'addPage':
                if (isAborted) return;
                const { imgBytes, width, height, scale } = data;
                const img = await newPdf.embedJpg(imgBytes);
                const newPage = newPdf.addPage([width / scale, height / scale]);
                newPage.drawImage(img, {
                    x: 0, y: 0,
                    width: newPage.getWidth(),
                    height: newPage.getHeight()
                });
                self.postMessage({ type: 'pageAdded' });
                break;

            case 'finish':
                if (isAborted) return;
                const pdfBytes = await newPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                self.postMessage({ type: 'done', blob: blob });
                newPdf = null;
                break;

            case 'abort':
                isAborted = true;
                newPdf = null;
                self.postMessage({ type: 'aborted' });
                break;
        }
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message });
    }
};
