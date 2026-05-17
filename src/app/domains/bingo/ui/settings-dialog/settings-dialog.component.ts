import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { BingoFacade } from '../../application/bingo.facade';
import { DEFAULT_PATTERN_SETTINGS } from '../../domain/win-pattern.type';
import type { WinPatternKind } from '../../domain/win-pattern.type';
import { LanguageService } from '../../../../shared/i18n/language.service';

/** Patterns the user can toggle (excludes inferred patterns like multi-line and full-house) */
const TOGGLEABLE_PATTERNS: WinPatternKind[] = [
  'single-line',
  'four-corners',
  'postage-stamp',
  'letter-x',
  'letter-l',
  'letter-t',
  'frame',
];

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>tune</mat-icon>
      {{ t()('settings.title') }}
    </h2>

    <mat-dialog-content>
      <p class="description">{{ t()('settings.description') }}</p>

      <div class="settings-list">
        @for (kind of toggleablePatterns; track kind) {
          <label class="setting-row">
            <span class="setting-label">{{ t()('pattern.' + kind) }}</span>
            <mat-slide-toggle
              [checked]="enabledSet().has(kind)"
              (toggleChange)="toggle(kind)"
            />
          </label>
        }
      </div>

      <div class="always-on">
        <mat-icon>info_outline</mat-icon>
        <span>{{ t()('settings.alwaysOn') }}</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="resetToDefaults()">{{ t()('settings.resetDefaults') }}</button>
      <button mat-raised-button color="primary" (click)="dialogRef.close()">{{ t()('common.done') }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .description {
      color: #666;
      font-size: 0.9rem;
      margin: 0 0 16px;
    }
    .settings-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .setting-row:hover {
      background: #f5f0e8;
    }
    .setting-label {
      font-weight: 500;
      font-size: 1rem;
    }
    .always-on {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      padding: 10px 12px;
      background: #fff8e1;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #666;
    }
    .always-on mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #f9a825;
    }
  `],
})
export class SettingsDialogComponent {
  private readonly facade = inject(BingoFacade);
  private readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;
  readonly dialogRef = inject(MatDialogRef<SettingsDialogComponent>);

  protected readonly toggleablePatterns = TOGGLEABLE_PATTERNS;

  protected readonly enabledSet = signal<Set<WinPatternKind>>(
    new Set(this.facade.patternSettings().enabled),
  );

  protected toggle(kind: WinPatternKind): void {
    this.enabledSet.update(s => {
      const next = new Set(s);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
    this.facade.setPatternSettings({
      enabled: [...this.enabledSet()],
    });
  }

  protected resetToDefaults(): void {
    this.enabledSet.set(new Set(DEFAULT_PATTERN_SETTINGS.enabled));
    this.facade.setPatternSettings(DEFAULT_PATTERN_SETTINGS);
  }
}
