// Configure PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cloudflare.com';

let pdfDoc = null;
let pageNum = 1;
let fabricCanvas = null;
let pageCanvasData = {}; // Stores modifications for each page

// DOM Elements
const pdfUpload = document.getElementById('pdf-upload');
const toolbar = document.getElementById('toolbar');
const uploadPrompt = document.getElementById('upload-prompt');
const canvasContainer = document.getElementById('canvas-container');
const pageNumDisplay = document.getElementById('page-num');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const addTextBtn = document.getElementById('add-text-btn');
const addRectBtn = document.getElementById('add-rect-btn');
const pageColorInput = document.getElementById('page-color');
const downloadBtn = document.getElementById('download-btn');

// Initialize Fabric Canvas
function initCanvas(width, height) {
    if (fabricCanvas) {
        fabricCanvas.dispose();
    }
    
    // Set explicit size for container and underlying HTML canvas element
    canvasContainer.style.width = `${width}px`;
    canvasContainer.style.height = `${height}px`;
    
    fabricCanvas = new fabric.Canvas('book-canvas', {
        width: width,
        height: height,
        backgroundColor: '#ffffff'
    });
}

// Render PDF Page as Background of Fabric Canvas
async function renderPage(num) {
    // Save state of current page before shifting
    if (fabricCanvas && pageNum) {
        pageCanvasData[pageNum] = fabricCanvas.toJSON();
    }

    pageNum = num;
    pageNumDisplay.textContent = `Page ${num} / ${pdfDoc.numPages}`;
    
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 1.5 }); // High resolution scaling
    
    // Initialize canvas wrapper sizing
    initCanvas(viewport.width, viewport.height);

    // Create a temporary hidden canvas to draw the raw PDF image context
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;

    const renderContext = {
        canvasContext: tempCtx,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;

    // Set the rendered image context as background image of interactive canvas
    fabric.Image.fromURL(tempCanvas.toDataURL(), (img) => {
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
            scaleX: 1,
            scaleY: 1
        });

        // Restore edits if they exist for this specific page number
        if (pageCanvasData[num]) {
            fabricCanvas.loadFromJSON(pageCanvasData[num], fabricCanvas.renderAll.bind(fabricCanvas));
        }
    });
}

// Handle PDF Upload event
pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    const fileReader = new FileReader();
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        
        // Load the document using PDF.js
        pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
        
        // UI Layout visibility toggling
        uploadPrompt.classList.add('hidden');
        toolbar.classList.remove('hidden');
        canvasContainer.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        
        pageCanvasData = {}; // reset states
        renderPage(1);
    };
    fileReader.readAsArrayBuffer(file);
});

// Interactive Custom Tools Core Logic
addTextBtn.addEventListener('click', () => {
    const text = new fabric.IText('Edit this text', {
        left: 50,
        top: 50,
        fontFamily: 'sans-serif',
        fill: '#111827',
        fontSize: 24
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
});

addRectBtn.addEventListener('click', () => {
    const rect = new fabric.Rect({
        left: 100,
        top: 100,
        fill: 'rgba(99, 102, 241, 0.3)',
        width: 150,
        height: 100,
        stroke: '#6366f1',
        strokeWidth: 2
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
});

// Handle Background Tint Filter overlay modification
pageColorInput.addEventListener('input', (e) => {
    if (!fabricCanvas) return;
    
    // Create an overlay rect for tint coloring
    const overlay = new fabric.Rect({
        left: 0,
        top: 0,
        width: fabricCanvas.width,
        height: fabricCanvas.height,
        fill: e.target.value,
        opacity: 0.15,
        selectable: false,
        evented: false
    });
    
    fabricCanvas.add(overlay);
    fabricCanvas.renderAll();
});

// Navigations 
prevPageBtn.addEventListener('click', () => {
    if (pageNum <= 1) return;
    renderPage(pageNum - 1);
});

nextPageBtn.addEventListener('click', () => {
    if (pageNum >= pdfDoc.numPages) return;
    renderPage(pageNum + 1);
});

// Generate & Download Finished Compilation
downloadBtn.addEventListener('click', async () => {
    // Save layout state of currently active page first
    pageCanvasData[pageNum] = fabricCanvas.toJSON();
    
    const { jsPDF } = window.jspdf;
    let pdfExport = null;

    // Loop through individual data states to compile final format
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        await renderPage(i);
        
        // Extract raw image string from data stream
        const imgData = fabricCanvas.toDataURL({ format: 'jpeg', quality: 0.95 });
        const width = fabricCanvas.width;
        const height = fabricCanvas.height;

        if (i === 1) {
            // Determine structural dimensions match configuration orientation 
            const orientation = width > height ? 'l' : 'p';
            pdfExport = new jsPDF(orientation, 'px', [width, height]);
        } else {
            pdfExport.addPage([width, height]);
        }
        
        pdfExport.addImage(imgData, 'JPEG', 0, 0, width, height);
    }

    pdfExport.save('custom-studio-book.pdf');
    // Return to actual user viewport index page position mapping
    renderPage(pageNum);
});
