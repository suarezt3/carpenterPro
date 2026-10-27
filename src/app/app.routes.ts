import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'designer',
  },
  {
    path: 'designer',
    loadComponent: () =>
      import('./components/module-designer/module-designer').then(
        (m) => m.ModuleDesignerComponent
      ),
  },
  {
    path: 'parts',
    loadComponent: () =>
      import('./components/parts-list/parts-list').then(
        (m) => m.PartsListComponent
      ),
  },
  {
    path: 'optimizer',
    loadComponent: () =>
      import('./components/cut-optimizer-view/cut-optimizer-view').then(
        (m) => m.CutOptimizerViewComponent
      ),
  },
  {
    path: 'budget',
    loadComponent: () =>
      import('./components/budget-view/budget-view').then(
        (m) => m.BudgetViewComponent
      ),
  },
  {
    path: 'labels',
    loadComponent: () =>
      import('./components/labels-view/labels-view').then(
        (m) => m.LabelsViewComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'designer',
  },
];

