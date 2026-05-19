import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { COLUMNS, COLUMN_RANGES } from '../../domain/bingo-column.type';
import { BingoFacade } from '../../application/bingo.facade';
import { OcrCancelledError } from '../../data/ocr.service';
import { LanguageService } from '../../../../shared/i18n/language.service';

@Component({
  selector: 'app-add-card-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatTabsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ t()('addCard.title') }}</h2>

    <mat-dialog-content>
      <mat-tab-group [(selectedIndex)]="selectedTabIndex">
        <!-- Manual Entry Tab -->
        <mat-tab [label]="t()('addCard.manualEntry')">
          <div class="manual-entry">
            <mat-form-field appearance="outline" class="code-field">
              <mat-label>{{ t()('addCard.cardCode') }}</mat-label>
              <input matInput [(ngModel)]="cardCode" [placeholder]="t()('addCard.cardCodePlaceholder')" maxlength="20" />
            </mat-form-field>

            @if (ocrConfidence() !== null) {
              <div class="ocr-status">
                <mat-icon>{{ ocrConfidence()! >= 60 ? 'check_circle' : 'warning' }}</mat-icon>
                <span>
                  {{ t()('addCard.ocrConfidence', { confidence: ocrConfidence()! }) }}
                  @if (lowConfidenceCells().size > 0) {
                    &nbsp;·&nbsp; {{ t()('addCard.cellsFlagged', { count: lowConfidenceCells().size }) }}
                  }
                </span>
              </div>
            }

            <div class="grid-input">
              <div class="grid-header">
                @for (col of columnLabels; track col) {
                  <div class="header-cell">{{ col }}</div>
                }
              </div>
              @for (r of [0,1,2,3,4]; track r) {
                <div class="grid-row">
                  @for (c of [0,1,2,3,4]; track c) {
                    @if (r === 2 && c === 2) {
                      <div class="grid-cell free-cell">{{ t()('addCard.free') }}</div>
                    } @else {
                      <input
                        class="grid-cell-input"
                        [class.invalid]="isCellInvalid(r, c)"
                        [class.low-confidence]="isLowConfidence(r, c)"
                        type="number"
                        [min]="getMin(c)"
                        [max]="getMax(c)"
                        [ngModel]="getGridValue(r, c)"
                        (ngModelChange)="onGridValueChange(r, c, $event)"
                        [attr.aria-label]="t()('addCard.cellAria', { row: r + 1, col: columnLabels[c] ?? '' })"
                      />
                    }
                  }
                </div>
              }
            </div>

            @if (validationError()) {
              <div class="validation-error">{{ validationError() }}</div>
            }
          </div>
        </mat-tab>

        <!-- Photo Upload Tab -->
        <mat-tab [label]="t()('addCard.photoUpload')">
          <div class="photo-upload">
            <p>{{ t()('addCard.photoDescription') }}</p>

            <div
              class="drop-zone"
              [class.dragging]="isDragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave()"
              (drop)="onDrop($event)"
            >
              @if (!selectedFile()) {
                <div class="drop-content">
                  <mat-icon class="upload-icon">{{ isMobile() ? 'photo_camera' : 'cloud_upload' }}</mat-icon>
                  <p>{{ isMobile() ? t()('addCard.mobilePrompt') : t()('addCard.desktopPrompt') }}</p>
                  <input
                    #fileInput
                    type="file"
                    accept="image/*"
                    capture="environment"
                    (change)="onFileSelected($event)"
                    hidden
                  />
                  <div class="photo-buttons">
                    <button mat-stroked-button (click)="fileInput.click()">
                      <mat-icon>photo_camera</mat-icon>
                      {{ t()('addCard.takePhoto') }}
                    </button>
                    <button mat-stroked-button (click)="fileInput.click(); $event.preventDefault()">
                      <mat-icon>photo_library</mat-icon>
                      {{ t()('addCard.browse') }}
                    </button>
                  </div>
                </div>
              } @else {
                <div class="file-selected">
                  <mat-icon>image</mat-icon>
                  <p>{{ selectedFile()?.name }}</p>
                  <button mat-stroked-button (click)="clearFile()">{{ t()('addCard.change') }}</button>
                </div>
              }
            </div>

            @if (selectedFile() && !isProcessing()) {
              <button
                mat-raised-button
                color="primary"
                (click)="processImage()"
                class="process-btn"
              >
                <mat-icon>auto_fix_high</mat-icon>
                {{ t()('addCard.extractNumbers') }}
              </button>
            }

            @if (isProcessing()) {
              <div class="processing">
                <div class="processing-progress">
                  <mat-progress-bar
                    mode="determinate"
                    [value]="ocrProgress()"
                    class="ocr-progress-bar"
                  />
                  <span class="processing-text">
                    <mat-icon class="processing-icon">auto_fix_high</mat-icon>
                    {{ processingLabel() }}
                    <strong>{{ ocrProgress() }}%</strong>
                  </span>
                </div>
                <button
                  mat-stroked-button
                  color="warn"
                  (click)="onCancelOcr()"
                  class="cancel-ocr-btn"
                  type="button"
                >
                  <mat-icon>close</mat-icon>
                  {{ t()('common.cancel') }}
                </button>
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">{{ t()('common.cancel') }}</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!isManualEntryValid()"
        (click)="onAddManual()"
      >
        {{ t()('card.add') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .manual-entry { padding: 16px 0; }
    .code-field { width: 100%; margin-bottom: 16px; }
    .grid-input { display: flex; flex-direction: column; gap: 4px; }
    .grid-header { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
    .header-cell {
      text-align: center; font-weight: bold; font-size: 1.2rem;
      color: var(--bingo-header-bg); padding: 4px;
    }
    .grid-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
    .grid-cell-input {
      width: 100%; padding: 8px 4px; text-align: center;
      border: 1px solid var(--bingo-cell-border); border-radius: 4px;
      font-size: 1rem; outline: none; box-sizing: border-box;
    }
    .grid-cell-input:focus { border-color: var(--bingo-header-bg); box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.2); }
    .grid-cell-input.invalid { border-color: #f44336; background: #fff5f5; }
    .grid-cell-input.low-confidence { border-color: #ff9800; background: #fff8e1; }
    .grid-cell-input.low-confidence:focus { box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.3); }
    .free-cell {
      display: flex; align-items: center; justify-content: center;
      background: var(--bingo-free-bg); border: 1px dashed var(--bingo-cell-border);
      border-radius: 4px; font-size: 0.8rem; font-weight: 700;
      color: var(--bingo-free-text); padding: 8px 4px;
    }
    .validation-error { color: #f44336; font-size: 0.85rem; margin-top: 8px; }
    .ocr-status {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; margin-bottom: 12px;
      border-radius: 6px; font-size: 0.85rem;
      background: #e8f5e9; color: #2e7d32;
    }
    .ocr-status:has(.mat-icon.warning) { background: #fff3e0; color: #e65100; }
    .ocr-status .mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .photo-upload { padding: 16px 0; }
    .drop-zone {
      border: 2px dashed #ccc; border-radius: 8px; padding: 32px;
      text-align: center; cursor: pointer; transition: border-color 0.2s; margin-bottom: 16px;
    }
    .drop-zone.dragging { border-color: var(--bingo-header-bg); background: rgba(211, 47, 47, 0.05); }
    .upload-icon { font-size: 48px; width: 48px; height: 48px; color: #999; }
    .photo-buttons { display: flex; gap: 8px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
    .photo-buttons button { display: flex; align-items: center; gap: 4px; }
    .file-selected { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .process-btn { width: 100%; }
    .processing { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; }
    .processing-progress { width: 100%; display: flex; flex-direction: column; gap: 8px; }
    .ocr-progress-bar { border-radius: 4px; }
    .processing-text { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: #666; }
    .processing-icon { font-size: 18px; width: 18px; height: 18px; }
    .cancel-ocr-btn { font-size: 0.8rem; }
    @media (max-width: 480px) {
      .grid-header { gap: 2px; }
      .grid-row { gap: 2px; }
      .header-cell { font-size: 1rem; padding: 2px; }
      .grid-cell-input { padding: 6px 2px; font-size: 0.85rem; }
      .free-cell { font-size: 0.65rem; padding: 6px 2px; }
      .drop-zone { padding: 20px 12px; }
      .upload-icon { font-size: 36px; width: 36px; height: 36px; margin: 0; }
      .manual-entry { padding: 8px 0; }
    }
  `],
})
export class AddCardDialogComponent {
  private readonly facade = inject(BingoFacade);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;
  protected readonly dialogRef = inject(MatDialogRef<AddCardDialogComponent>);

  protected readonly columnLabels = COLUMNS;
  protected readonly cardCode = signal('');
  protected readonly selectedTabIndex = signal(0);

  /** Internal 5×5 grid as a flat record keyed by "row-col" */
  private readonly gridData = signal<Record<string, number | null>>({});
  protected readonly validationError = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly isProcessing = signal(false);
  protected readonly isDragging = signal(false);
  protected readonly lowConfidenceCells = signal<Set<string>>(new Set());
  protected readonly ocrConfidence = signal<number | null>(null);
  /** OCR progress percentage (0–100) during processing */
  protected readonly ocrProgress = signal(0);
  /** Human-readable stage label during processing */
  protected readonly processingLabel = signal('Preparing image…');
  /** Detect touch-capable devices to adapt the UI for mobile */
  protected isMobile(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  protected getMin(col: number): number {
    return COLUMN_RANGES[COLUMNS[col]!].min;
  }

  protected getMax(col: number): number {
    return COLUMN_RANGES[COLUMNS[col]!].max;
  }

  protected getGridValue(row: number, col: number): number | null {
    return this.gridData()[`${row}-${col}`] ?? null;
  }

  protected setGridValue(row: number, col: number, value: number | null): void {
    this.gridData.update(data => ({ ...data, [`${row}-${col}`]: value }));
  }

  protected isCellInvalid(row: number, col: number): boolean {
    if (row === 2 && col === 2) return false;
    const val = this.getGridValue(row, col);
    if (val === null || val === undefined) return false;
    return val < this.getMin(col) || val > this.getMax(col);
  }

  protected isManualEntryValid(): boolean {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) continue;
        const val = this.getGridValue(r, c);
        if (!val || val < this.getMin(c) || val > this.getMax(c)) return false;
      }
    }
    return true;
  }

  protected onAddManual(): void {
    if (!this.isManualEntryValid()) return;

    const gridNumbers: number[][] = [];
    for (let r = 0; r < 5; r++) {
      const row: number[] = [];
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) {
          row.push(0); // FREE placeholder
        } else {
          row.push(this.getGridValue(r, c) ?? 0);
        }
      }
      gridNumbers.push(row);
    }

    const code = this.cardCode().trim() || undefined;
    const result = this.facade.addCard(code, gridNumbers);
    if (result.ok) {
      this.snackBar.open(this.t()('addCard.addedSnack'), this.t()('common.ok'), { duration: 2000 });
      this.dialogRef.close(true);
    } else {
      this.validationError.set(this.t()('addCard.failed'));
    }
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    if (this.isProcessing() && !await this.confirmCancelOcr()) return;

    this.selectedFile.set(input.files[0]);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(): void {
    this.isDragging.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragging.set(false);
    if (!event.dataTransfer?.files[0]) return;

    if (this.isProcessing() && !await this.confirmCancelOcr()) return;

    this.selectedFile.set(event.dataTransfer.files[0]);
  }

  protected async clearFile(): Promise<void> {
    if (this.isProcessing() && !await this.confirmCancelOcr()) return;
    this.selectedFile.set(null);
  }

  protected isLowConfidence(row: number, col: number): boolean {
    return this.lowConfidenceCells().has(`${row}-${col}`);
  }

  /** Clear the low-confidence flag when user edits a cell manually */
  protected onGridValueChange(row: number, col: number, value: number | null): void {
    this.setGridValue(row, col, value);
    this.lowConfidenceCells.update(s => {
      const next = new Set(s);
      next.delete(`${row}-${col}`);
      return next;
    });
  }

  protected async processImage(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.isProcessing.set(true);
    this.ocrProgress.set(0);
    this.processingLabel.set(this.t()('addCard.preparing'));

    try {
      const result = await this.facade.processOcrImage(file, (pct) => {
        this.ocrProgress.set(pct);
        if (pct < 25) {
          this.processingLabel.set(this.t()('addCard.preparing'));
        } else if (pct < 90) {
          this.processingLabel.set(this.t()('addCard.reading'));
        } else if (pct < 100) {
          this.processingLabel.set(this.t()('addCard.parsing'));
        } else {
          this.processingLabel.set(this.t()('addCard.done'));
        }
      });

      // Populate the manual entry grid with OCR results
      const data: Record<string, number | null> = {};
      for (let r = 0; r < result.cells.length; r++) {
        for (let c = 0; c < (result.cells[r]?.length ?? 0); c++) {
          if (r === 2 && c === 2) continue;
          data[`${r}-${c}`] = result.cells[r]![c]!.number?.value ?? null;
        }
      }
      this.gridData.set(data);

      // Track low-confidence cells for visual review
      this.lowConfidenceCells.set(
        new Set(result.lowConfidenceCells.map(c => `${c.row}-${c.col}`)),
      );
      this.ocrConfidence.set(result.confidence);

      // Switch to manual entry tab for review/correction
      this.selectedTabIndex.set(0);

      const lowCount = result.lowConfidenceCells.length;
      if (lowCount > 0) {
        this.snackBar.open(
          this.t()('addCard.extractedWithFlags', { confidence: result.confidence, count: lowCount }),
          this.t()('addCard.reviewSnack'),
          { duration: 5000 },
        );
      } else {
        this.snackBar.open(this.t()('addCard.extractedSuccess', { confidence: result.confidence }), this.t()('common.ok'), { duration: 3000 });
      }
    } catch (err) {
      if (err instanceof OcrCancelledError) {
        this.snackBar.open(this.t()('addCard.ocrCancelled'), this.t()('common.ok'), { duration: 2000 });
      } else {
        this.snackBar.open(
          this.t()('addCard.ocrFailed'),
          this.t()('common.ok'),
          { duration: 5000 },
        );
      }
    } finally {
      this.isProcessing.set(false);
      this.ocrProgress.set(0);
    }
  }

  /** Cancel the current OCR processing */
  protected onCancelOcr(): void {
    this.facade.cancelOcr();
  }

  /** Show a confirmation before cancelling OCR in progress. Returns true if user confirms. */
  private async confirmCancelOcr(): Promise<boolean> {
    if (!this.isProcessing()) return true;
    const confirmed = window.confirm(this.t()('addCard.ocrCancelConfirm'));
    if (confirmed) {
      this.onCancelOcr();
    }
    return confirmed;
  }
}
