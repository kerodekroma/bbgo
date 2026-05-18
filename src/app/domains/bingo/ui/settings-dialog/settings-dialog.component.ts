import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BingoFacade } from '../../application/bingo.facade';
import { DEFAULT_PATTERN_SETTINGS } from '../../domain/win-pattern.type';
import type { WinPatternKind } from '../../domain/win-pattern.type';
import { PATTERN_CELL_COUNTS } from '../../domain/win-pattern.type';
import { LanguageService } from '../../../../shared/i18n/language.service';
import { PatternIconComponent } from '../pattern-icon/pattern-icon.component';

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
    PatternIconComponent,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>tune</mat-icon>
      {{ t()('settings.title') }}
    </h2>

    <mat-dialog-content>
      <p class="description">{{ t()('settings.description') }}</p>

      <!-- Fulfill All master toggle -->
      <div
        class="fulfill-all-bar"
        [class.is-active]="isFulfillAll()"
      >
        <div class="fulfill-all-info">
          <mat-icon>checklist</mat-icon>
          <div class="fulfill-all-text">
            <div class="fulfill-all-name">{{ t()('settings.fulfillAll') }}</div>
            <div class="fulfill-all-desc">{{ t()('settings.fulfillAllDesc') }}</div>
          </div>
        </div>
        <mat-slide-toggle
          [checked]="isFulfillAll()"
          (toggleChange)="toggleFulfillAll()"
        />
      </div>

      <div class="pattern-grid">
        @for (kind of toggleablePatterns; track kind) {
          <div
            class="pattern-card"
            [class.is-enabled]="enabledSet().has(kind)"
            (click)="toggle(kind)"
            (keydown.enter)="toggle(kind)"
            (keydown.space)="toggle(kind); $event.preventDefault()"
            role="button"
            [attr.aria-pressed]="enabledSet().has(kind)"
            [attr.tabindex]="0"
          >
            <div class="card-visual">
              <app-pattern-icon [pattern]="kind" />
            </div>

            <div class="card-body">
              <div class="card-name">{{ t()('pattern.' + kindKey(kind)) }}</div>
              <div class="card-desc">{{ t()('pattern.desc.' + kindKey(kind)) }}</div>
              <div class="card-meta">{{ cellCount(kind) }} cells</div>
            </div>

            <mat-slide-toggle
              class="card-toggle"
              [checked]="enabledSet().has(kind)"
              (toggleChange)="toggle(kind)"
              (click)="$event.stopPropagation()"
            />
          </div>
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

    :host ::ng-deep .mat-mdc-dialog-content {
      max-width: 100vw;
      overflow-x: hidden;
    }

    .fulfill-all-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-radius: 10px;
      border: 2px solid #e8e0d4;
      background: #faf8f5;
      margin-bottom: 14px;
      transition: all 0.15s ease;
    }

    .fulfill-all-bar.is-active {
      border-color: #c62828;
      background: #fefcf9;
      box-shadow: 0 0 0 1px rgba(198,40,40,0.08), 0 2px 8px rgba(198,40,40,0.08);
    }

    .fulfill-all-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .fulfill-all-info mat-icon {
      color: #c62828;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .fulfill-all-bar:not(.is-active) .fulfill-all-info mat-icon {
      color: #999;
    }

    .fulfill-all-name {
      font-weight: 700;
      font-size: 0.9rem;
      color: #1a1a1a;
      line-height: 1.2;
    }

    .fulfill-all-desc {
      font-size: 0.75rem;
      color: #888;
      line-height: 1.2;
    }

    .pattern-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }

    .pattern-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 2px solid #e8e0d4;
      background: #faf8f5;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .pattern-card:hover {
      background: #f5f0e8;
      border-color: #d4c9b0;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .pattern-card:focus-visible {
      outline: 3px solid #c62828;
      outline-offset: 2px;
    }

    .pattern-card.is-enabled {
      background: #fefcf9;
      border-color: #c62828;
      box-shadow: 0 0 0 1px rgba(198,40,40,0.08), 0 2px 8px rgba(198,40,40,0.08);
    }

    .pattern-card.is-enabled:hover {
      border-color: #b71c1c;
      box-shadow: 0 0 0 1px rgba(198,40,40,0.12), 0 3px 12px rgba(198,40,40,0.12);
    }

    .card-visual {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 8px;
      background: #fff;
      border: 1px solid #e8e0d4;
    }

    .is-enabled .card-visual {
      border-color: #c62828;
      background: #fff5f5;
    }

    .card-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .card-name {
      font-weight: 700;
      font-size: 0.85rem;
      color: #1a1a1a;
      line-height: 1.2;
    }

    .card-desc {
      font-size: 0.7rem;
      color: #888;
      line-height: 1.2;
      overflow: hidden;
      min-width: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-toggle {
      flex-shrink: 0;
    }

    .card-meta {
      font-size: 0.65rem;
      color: #aaa;
      font-weight: 600;
      margin-top: 1px;
    }

    .card-toggle {
      flex-shrink: 0;
    }

    .always-on {
      display: flex;
      align-items: center;
      gap: 8px;
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

    @media (max-width: 460px) {
      .pattern-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .pattern-card {
        padding: 8px 10px;
        gap: 8px;
      }
      .fulfill-all-bar {
        padding: 10px 12px;
      }
      .card-visual {
        width: 44px;
        height: 44px;
      }
      .card-meta {
        display: none;
      }
      .card-toggle {
        transform: scale(0.85);
      }
    }

    @media (max-width: 360px) {
      :host ::ng-deep .mat-mdc-dialog-content {
        padding: 0 12px !important;
      }
      .pattern-card {
        gap: 6px;
        padding: 8px;
      }
      .card-visual {
        width: 36px;
        height: 36px;
      }
      .card-name {
        font-size: 0.8rem;
      }
      .card-desc {
        font-size: 0.65rem;
      }
      .fulfill-all-desc {
        display: none;
      }
      .fulfill-all-info mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .fulfill-all-name {
        font-size: 0.85rem;
      }
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

  /** True when ALL toggleable patterns are enabled — drives the "Fulfill All" toggle state */
  protected readonly isFulfillAll = computed(() => {
    const enabled = this.enabledSet();
    return TOGGLEABLE_PATTERNS.every(kind => enabled.has(kind));
  });

  protected kindKey(kind: WinPatternKind): string {
    // Convert 'single-line' → 'singleLine', 'four-corners' → 'fourCorners', etc.
    return kind.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  protected cellCount(kind: WinPatternKind): number {
    return PATTERN_CELL_COUNTS[kind];
  }

  /** Toggle the "Fulfill All" master switch */
  protected toggleFulfillAll(): void {
    if (this.isFulfillAll()) {
      // Currently all enabled → disable all
      this.enabledSet.set(new Set());
    } else {
      // Not all enabled → enable all
      this.enabledSet.set(new Set(TOGGLEABLE_PATTERNS));
    }
    this.facade.setPatternSettings({
      enabled: [...this.enabledSet()],
    });
  }

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
