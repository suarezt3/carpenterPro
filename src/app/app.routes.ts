import { Routes } from '@angular/router';
import { studioAccessGuard } from './guards/studio-access.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./components/landing-page/landing-page').then(
        (m) => m.LandingPageComponent
      ),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./components/auth-page/auth-page').then(
        (m) => m.AuthPageComponent
      ),
  },
  {
    path: 'studio',
    canActivate: [studioAccessGuard],
    loadComponent: () =>
      import('./components/studio-workspace/studio-workspace').then(
        (m) => m.StudioWorkspaceComponent
      ),
    children: [
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
    ],
  },
  // Redirecciones directas retrocompatibles
  {
    path: 'designer',
    redirectTo: 'studio/designer',
  },
  {
    path: 'parts',
    redirectTo: 'studio/parts',
  },
  {
    path: 'optimizer',
    redirectTo: 'studio/optimizer',
  },
  {
    path: 'budget',
    redirectTo: 'studio/budget',
  },
  {
    path: 'labels',
    redirectTo: 'studio/labels',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
