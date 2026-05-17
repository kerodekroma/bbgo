import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./domains/bingo/pages/bingo-game-page/bingo-game-page.component').then(
        m => m.BingoGamePageComponent,
      ),
  },
];
