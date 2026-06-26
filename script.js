pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cloudflare.com';
let pdfDoc = null, pageNum = 1, fabricCanvas = null, pageCanvasData = {};
const pdfUpload = document.getElementById('pdf-upload'), toolbar = document.getElementById('toolbar'), uploadPrompt = document.getElementById('upload-prompt'), canvasContainer = document.getElementById('canvas-container'), pageNumDisplay = document.getElementById('page-num'), prevPageBtn = document.getElementById('prev-page'), nextPageBtn = document.getElementById('next-page'), addTextBtn = document.getElementById('add-text-btn'), addRectBtn = document.getElementById('add-rect-btn'), pageColorInput = document.getElementById('page-color'), downloadBtn = document.getElementById('download-btn');

function initCanvas(width, height) {
    if (fabricCanvas) fabricCanvas.dispose();
    canvasContainer.style.width = `${width}px`; canvasContainer.style.height = `${height}px`;
    fabricCanvas = new fabric.Canvas('book-canvas', { width, height, backgroundColor: '#ffffff' });
}

async function renderPage(num) {
    if (fabricCanvas && pageNum) pageCanvasData[pageNum] = fabricCanvas.toJSON();
    pageNum = num; pageNumDisplay.textContent = `Page ${num} / ${pdfDoc.numPages}`;
    const page = await pdfDoc.getPage(num); const viewport = page.getViewport({ scale: 1.5 });
    initCanvas(viewport.width, viewport.height);
    const tempCanvas = document.createElement('canvas'), tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
    await page.render({ canvasContext: tempCtx, viewport }).promise;
    fabric.Image.fromURL(tempCanvas.toDataURL(), (img) => {
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), { scaleX: 1, scaleY: 1 });
        if (pageCanvasData[num]) fabricCanvas.loadFromJSON(pageCanvasData[num], fabricCanvas.renderAll.bind(fabricCanvas));
    });
}

pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file || file.type !== 'application/pdf') return;
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        pdfDoc = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
        uploadPrompt.classList.add('hidden'); toolbar.classList.remove('hidden'); canvasContainer.classList.remove('hidden'); downloadBtn.classList.remove('hidden');
        pageCanvasData = {}; renderPage(1);
    };
    fileReader.readAsArrayBuffer(file);
});

addTextBtn.addEventListener('click', () => {
    const text = new fabric.IText('Edit this text', { left: 50, top: 50, fontFamily: 'sans-serif', fill: '#111827', fontSize: 24 });
    fabricCanvas.add(text); fabricCanvas.setActiveObject(text);
});

addRectBtn.addEventListener('click', () => {
    const rect = new fabric.Rect({ left: 100, top: 100, fill: 'rgba(99, 102, 241, 0.3)', width: 150, height: 100, stroke: '#6366f1', strokeWidth: 2 });
    fabricCanvas.add(rect); fabricCanvas.setActiveObject(rect);
});

pageColorInput.addEventListener('input', (e) => {
    if (!fabricCanvas) return;
    const overlay = new fabric.Rect({ left: 0, top: 0, width: fabricCanvas.width, height: fabricCanvas.height, fill: e.target.value, opacity: 0.15, selectable: false, evented: false });
    fabricCanvas.add(overlay); fabricCanvas.renderAll();
});

prevPageBtn.addEventListener('click', () => { if (pageNum <= 1) return; renderPage(pageNum - 1); });
nextPageBtn.addEventListener('click', () => { if (pageNum >= pdfDoc.numPages) return; renderPage(pageNum + 1); });

downloadBtn.addEventListener('click', async () => {
    pageCanvasData[pageNum] = fabricCanvas.toJSON();
    const { jsPDF } = window.jspdf; let pdfExport = null;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        await renderPage(i);
        const imgData = fabricCanvas.toDataURL({ format: 'jpeg', quality: 0.95 }), w = fabricCanvas.width, h = fabricCanvas.height;
        if (i === 1) { pdfExport = new jsPDF(w > h ? 'l' : 'p', 'px', [w, h]); } else { pdfExport.addPage([w, h]); }
        pdfExport.addImage(imgData, 'JPEG', 0, 0, w, h);
    }
    pdfExport.save('custom-studio-book.pdf'); renderPage(pageNum);
});
