import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
    selector: 'app-contact',
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.css']
})
export class ContactComponent {

    pdfModalOpen = false;
    videoModalOpen = false;
    activePdfTitle = '';
    safePdfUrl: SafeResourceUrl = '';

    constructor(private sanitizer: DomSanitizer) { }

    openPdfModal(pdfPath: string, title: string): void {
        // Append #toolbar=0&navpanes=0 to hide browser PDF toolbar (disables download button in most browsers)
        const urlWithFlags = `${pdfPath}#toolbar=0&navpanes=0&scrollbar=1`;
        this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(urlWithFlags);
        this.activePdfTitle = title;
        this.pdfModalOpen = true;
        document.body.style.overflow = 'hidden';
    }

    openVideoModal(): void {
        this.videoModalOpen = true;
        document.body.style.overflow = 'hidden';
    }

    closeModal(): void {
        this.pdfModalOpen = false;
        this.videoModalOpen = false;
        this.safePdfUrl = '';
        this.activePdfTitle = '';
        document.body.style.overflow = '';
    }
}
