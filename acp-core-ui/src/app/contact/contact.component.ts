import { Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';

function getPdfJs(): any {
    return (window as any)['pdfjsLib'];
}

@Component({
    selector: 'app-contact',
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnDestroy {

    @ViewChild('pdfContainer') pdfContainerRef!: ElementRef<HTMLDivElement>;

    pdfModalOpen = false;
    videoModalOpen = false;
    activePdfTitle = '';

    pdfScale = 1.5;
    totalPages = 0;

    private pdfDoc: any = null;
    private activePdfPath = '';

    constructor() {
        if (!getPdfJs()) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                getPdfJs().GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            };
            document.head.appendChild(script);
        }
    }

    openPdfModal(pdfPath: string, title: string): void {
        this.activePdfPath = pdfPath;
        this.activePdfTitle = title;
        this.pdfModalOpen = true;
        this.pdfScale = 1.5;
        this.pdfDoc = null;
        this.totalPages = 0;
        document.body.style.overflow = 'hidden';
        setTimeout(() => this.loadPdf(pdfPath), 50);
    }

    private loadPdf(pdfPath: string): void {
        const pdfjs = getPdfJs();
        if (!pdfjs) {
            setTimeout(() => this.loadPdf(pdfPath), 200);
            return;
        }
        pdfjs.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        pdfjs.getDocument(pdfPath).promise.then((pdf: any) => {
            this.pdfDoc = pdf;
            this.totalPages = pdf.numPages;
            this.renderAllPages();
        });
    }

    private renderAllPages(): void {
        const container = this.pdfContainerRef?.nativeElement;
        if (!container || !this.pdfDoc) return;

        // Clear previous canvases
        container.innerHTML = '';

        const dpr = window.devicePixelRatio || 1;

        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pdf-page-wrapper';

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);

            this.pdfDoc.getPage(pageNum).then((page: any) => {
                const viewport = page.getViewport({ scale: this.pdfScale });

                // Scale canvas by DPR for crisp rendering on retina/high-DPI screens
                canvas.width = Math.floor(viewport.width * dpr);
                canvas.height = Math.floor(viewport.height * dpr);
                canvas.style.width = viewport.width + 'px';
                canvas.style.height = viewport.height + 'px';

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Scale context so PDF.js renders at full DPR resolution
                ctx.scale(dpr, dpr);

                page.render({ canvasContext: ctx, viewport });
            });
        }
    }

    zoomIn(): void {
        if (this.pdfScale < 3) {
            this.pdfScale = Math.min(3, +(this.pdfScale + 0.25).toFixed(2));
            this.renderAllPages();
        }
    }

    zoomOut(): void {
        if (this.pdfScale > 0.5) {
            this.pdfScale = Math.max(0.5, +(this.pdfScale - 0.25).toFixed(2));
            this.renderAllPages();
        }
    }

    zoomFit(): void {
        if (!this.pdfDoc) return;
        this.pdfDoc.getPage(1).then((page: any) => {
            const containerWidth = (this.pdfContainerRef.nativeElement.clientWidth || 800) - 40;
            const viewport = page.getViewport({ scale: 1 });
            this.pdfScale = +(containerWidth / viewport.width).toFixed(2);
            this.renderAllPages();
        });
    }

    openVideoModal(): void {
        this.videoModalOpen = true;
        document.body.style.overflow = 'hidden';
    }

    closeModal(): void {
        this.pdfModalOpen = false;
        this.videoModalOpen = false;
        this.activePdfTitle = '';
        this.activePdfPath = '';
        this.pdfDoc = null;
        this.totalPages = 0;
        document.body.style.overflow = '';
    }

    ngOnDestroy(): void {
        document.body.style.overflow = '';
    }
}
