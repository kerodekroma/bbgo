import { test, expect } from '@playwright/test';

/** Build a valid BingoCardJSON for localStorage injection */
function makeCard(id: string, code: string, marks: number[] = []) {
  const grid: Array<{
    row: number; col: number; value: number | null;
    column: string | null; isMarked: boolean; isFree: boolean;
  }> = [];

  const columns = ['B', 'I', 'N', 'G', 'O'];
  const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

  let n = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        grid.push({ row, col, value: null, column: null, isMarked: true, isFree: true });
      } else {
        const val = ranges[col]![0]! + n;
        grid.push({
          row, col,
          value: val,
          column: columns[col]!,
          isMarked: marks.includes(val),
          isFree: false,
        });
        n++;
      }
    }
  }

  return {
    id,
    code,
    createdAt: new Date().toISOString(),
    grid,
  };
}

test.describe('Bingo Card Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows empty state when no cards exist', async ({ page }) => {
    await expect(page.getByText(/no cards yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add card/i })).toBeVisible();
  });

  test.describe('Adding a card', () => {
    test('adds a card via manual entry', async ({ page }) => {
      await page.getByRole('button', { name: /add card/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Row 1
      await page.getByLabel(/row 1.*column B/i).fill('1');
      await page.getByLabel(/row 1.*column I/i).fill('16');
      await page.getByLabel(/row 1.*column N/i).fill('31');
      await page.getByLabel(/row 1.*column G/i).fill('46');
      await page.getByLabel(/row 1.*column O/i).fill('61');
      // Row 2
      await page.getByLabel(/row 2.*column B/i).fill('2');
      await page.getByLabel(/row 2.*column I/i).fill('17');
      await page.getByLabel(/row 2.*column N/i).fill('32');
      await page.getByLabel(/row 2.*column G/i).fill('47');
      await page.getByLabel(/row 2.*column O/i).fill('62');
      // Row 3 — skip FREE center
      await page.getByLabel(/row 3.*column B/i).fill('3');
      await page.getByLabel(/row 3.*column I/i).fill('18');
      await page.getByLabel(/row 3.*column G/i).fill('48');
      await page.getByLabel(/row 3.*column O/i).fill('63');
      // Row 4
      await page.getByLabel(/row 4.*column B/i).fill('4');
      await page.getByLabel(/row 4.*column I/i).fill('19');
      await page.getByLabel(/row 4.*column N/i).fill('34');
      await page.getByLabel(/row 4.*column G/i).fill('49');
      await page.getByLabel(/row 4.*column O/i).fill('64');
      // Row 5
      await page.getByLabel(/row 5.*column B/i).fill('5');
      await page.getByLabel(/row 5.*column I/i).fill('20');
      await page.getByLabel(/row 5.*column N/i).fill('35');
      await page.getByLabel(/row 5.*column G/i).fill('50');
      await page.getByLabel(/row 5.*column O/i).fill('65');

      // Submit (only "Add Card" button exists in dialog)
      await page.getByRole('button', { name: 'Add Card' }).click();

      // Dialog should close and card should appear
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(/test/i)).not.toBeVisible(); // no code was set
    });

    test('disables submit when numbers are out of range', async ({ page }) => {
      await page.getByRole('button', { name: /add card/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Put an invalid number in B column (must be 1-15)
      await page.getByLabel(/row 1.*column B/i).fill('20');

      // Add Card button should be disabled
      await expect(
        page.getByRole('button', { name: 'Add Card' })
      ).toBeDisabled();
    });
  });

  test.describe('Caller mode flow', () => {
    test.beforeEach(async ({ page }) => {
      // Seed a card via localStorage using correct JSON format
      await page.evaluate((card) => {
        localStorage.setItem('bbgo_cards', JSON.stringify([card]));
        localStorage.setItem('bbgo_game_state', JSON.stringify({
          calledNumbers: [],
          gameMode: 'caller',
        }));
      }, makeCard('caller-test', 'Test'));
      await page.reload();
    });

    test('calls a number and marks the card', async ({ page }) => {
      // Input is already in caller mode
      const input = page.getByPlaceholder(/enter/i);
      await input.fill('10');
      await input.press('Enter');

      // The called number should appear in the UI
      await expect(page.getByText(/10/).first()).toBeVisible();
    });

    test('prevents duplicate numbers', async ({ page }) => {
      const input = page.getByPlaceholder(/enter/i);
      await input.fill('7');
      await input.press('Enter');
      await input.fill('7');
      await input.press('Enter');

      await expect(page.getByText(/already been called/i)).toBeVisible();
    });

    test('prevents numbers outside 1-75', async ({ page }) => {
      const input = page.getByPlaceholder(/enter/i);
      await input.fill('0');
      await input.press('Enter');

      await expect(page.getByText(/between 1 and 75/i)).toBeVisible();
    });
  });

  test.describe('Card-only mode', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate((card) => {
        localStorage.setItem('bbgo_cards', JSON.stringify([card]));
        localStorage.setItem('bbgo_game_state', JSON.stringify({
          calledNumbers: [],
          gameMode: 'card-only',
        }));
      }, makeCard('cardonly-test', 'Test'));
      await page.reload();
    });

    test('toggles a cell when clicked', async ({ page }) => {
      const cell = page.locator('[role="gridcell"]').filter({ hasNotText: 'FREE' }).first();
      await cell.click();
      await expect(cell).toHaveClass(/is-marked/);
    });
  });

  test.describe('Persistence', () => {
    test('persists card across page reload', async ({ page }) => {
      // Add card via dialog
      await page.getByRole('button', { name: /add card/i }).click();
      await page.getByLabel(/row 1.*column B/i).fill('1');
      await page.getByLabel(/row 1.*column I/i).fill('16');
      await page.getByLabel(/row 1.*column N/i).fill('31');
      await page.getByLabel(/row 1.*column G/i).fill('46');
      await page.getByLabel(/row 1.*column O/i).fill('61');
      await page.getByLabel(/row 2.*column B/i).fill('2');
      await page.getByLabel(/row 2.*column I/i).fill('17');
      await page.getByLabel(/row 2.*column N/i).fill('32');
      await page.getByLabel(/row 2.*column G/i).fill('47');
      await page.getByLabel(/row 2.*column O/i).fill('62');
      await page.getByLabel(/row 3.*column B/i).fill('3');
      await page.getByLabel(/row 3.*column I/i).fill('18');
      await page.getByLabel(/row 3.*column G/i).fill('48');
      await page.getByLabel(/row 3.*column O/i).fill('63');
      await page.getByLabel(/row 4.*column B/i).fill('4');
      await page.getByLabel(/row 4.*column I/i).fill('19');
      await page.getByLabel(/row 4.*column N/i).fill('34');
      await page.getByLabel(/row 4.*column G/i).fill('49');
      await page.getByLabel(/row 4.*column O/i).fill('64');
      await page.getByLabel(/row 5.*column B/i).fill('5');
      await page.getByLabel(/row 5.*column I/i).fill('20');
      await page.getByLabel(/row 5.*column N/i).fill('35');
      await page.getByLabel(/row 5.*column G/i).fill('50');
      await page.getByLabel(/row 5.*column O/i).fill('65');
      await page.getByRole('button', { name: 'Add Card' }).click();

      // Card tab should be visible
      await expect(page.getByRole('tab')).toBeVisible();

      // Reload
      await page.reload();

      // Card should still be there
      await expect(page.getByRole('tab')).toBeVisible();
    });
  });

  test.describe('Reset game', () => {
    test('reset clears called numbers', async ({ page }) => {
      await page.evaluate((card) => {
        localStorage.setItem('bbgo_cards', JSON.stringify([card]));
        localStorage.setItem('bbgo_game_state', JSON.stringify({
          calledNumbers: [1, 2, 3],
          gameMode: 'caller',
        }));
      }, makeCard('reset-test', 'Test'));
      await page.reload();

      // Click reset button
      await page.getByRole('button', { name: /reset|new game/i }).click();

      // Called numbers section should not show 1, 2, 3
      await expect(page.getByText(/1/).first()).not.toBeVisible();
    });
  });
});
