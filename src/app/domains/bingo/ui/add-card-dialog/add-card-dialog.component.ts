import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { COLUMNS, COLUMN_RANGES } from '../../domain/bingo-column.type';
import { BingoFacade } from '../../application/bingo.facade';

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
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Add Bingo Card</h2>

    <mat-dialog-content>
      <mat-tab-group>
        <!-- Manual Entry Tab -->
        <mat-tab label="Manual Entry">
          <div class="manual-entry">
            <mat-form-field appearance="outline" class="code-field">
              <mat-label>Card Code (optional)</mat-label>
              <input matInput [(ngModel)]="cardCode" placeholder="e.g., My Card" maxlength="20" />
            </mat-form-field>

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
                      <div class="grid-cell free-cell">FREE</div>
                    } @else {
                      <input
                        class="grid-cell-input"
                        [class.invalid]="isCellInvalid(r, c)"
                        type="number"
                        [min]="getMin(c)"
                        [max]="getMax(c)"
                        [ngModel]="getGridValue(r, c)"
                        (ngModelChange)="setGridValue(r, c, $event)"
                        [attr.aria-label]="'Row ' + (r + 1) + ', Column ' + columnLabels[c]"
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
        <mat-tab label="Photo Upload">
          <div class="photo-upload">
            <p>Upload a photo of your bingo card to extract numbers.</p>

            <div
              class="drop-zone"
              [class.dragging]="isDragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave()"
              (drop)="onDrop($event)"
            >
              @if (!selectedFile()) {
                <div class="drop-content">
                  <mat-icon class="upload-icon">cloud_upload</mat-icon>
                  <p>Drag & drop an image here, or click to browse</p>
                  <input
                    #fileInput
                    type="file"
                    accept="image/*"
                    (change)="onFileSelected($event)"
                    hidden
                  />
                  <button mat-stroked-button (click)="fileInput.click()">Browse</button>
                </div>
              } @else {
                <div class="file-selected">
                  <mat-icon>image</mat-icon>
                  <p>{{ selectedFile()?.name }}</p>
                  <button mat-stroked-button (click)="clearFile()">Change</button>
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
                Extract Numbers
              </button>
            }

            @if (isProcessing()) {
              <div class="processing">
                <mat-spinner diameter="32" />
                <span>Processing image…</span>
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!isManualEntryValid()"
        (click)="onAddManual()"
      >
        Add Card
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
    .free-cell {
      display: flex; align-items: center; justify-content: center;
      background: var(--bingo-free-bg); border: 1px dashed var(--bingo-cell-border);
      border-radius: 4px; font-size: 0.8rem; font-weight: 700;
      color: var(--bingo-free-text); padding: 8px 4px;
    }
    .validation-error { color: #f44336; font-size: 0.85rem; margin-top: 8px; }
    .photo-upload { padding: 16px 0; }
    .drop-zone {
      border: 2px dashed #ccc; border-radius: 8px; padding: 32px;
      text-align: center; cursor: pointer; transition: border-color 0.2s; margin-bottom: 16px;
    }
    .drop-zone.dragging { border-color: var(--bingo-header-bg); background: rgba(211, 47, 47, 0.05); }
    .upload-icon { font-size: 48px; width: 48px; height: 48px; color: #999; }
    .file-selected { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .process-btn { width: 100%; }
    .processing { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px; }
  `],
})
export class AddCardDialogComponent {
  private readonly facade = inject(BingoFacade);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly dialogRef = inject(MatDialogRef<AddCardDialogComponent>);

  protected readonly columnLabels = COLUMNS;
  protected readonly cardCode = signal('');

  /** Internal 5×5 grid as a flat record keyed by "row-col" */
  private readonly gridData = signal<Record<string, number | null>>({});
  protected readonly validationError = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly isProcessing = signal(false);
  protected readonly isDragging = signal(false);

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
      this.snackBar.open('Card added!', 'OK', { duration: 2000 });
      this.dialogRef.close(true);
    } else {
      this.validationError.set('Failed to add card.');
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.selectedFile.set(input.files[0]);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(): void {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files[0]) {
      this.selectedFile.set(event.dataTransfer.files[0]);
    }
  }

  protected clearFile(): void {
    this.selectedFile.set(null);
  }

  protected async processImage(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.isProcessing.set(true);
    try {
      await this.facade.processOcrImage(file);
      this.snackBar.open('Image processed!', 'OK', { duration: 2000 });
    } catch {
      this.snackBar.open(
        'OCR not yet fully integrated. Use manual entry for now.',
        'OK',
        { duration: 4000 },
      );
    } finally {
      this.isProcessing.set(false);
    }
  }
}
