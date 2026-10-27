import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { HeaderComponent } from './components/header/header';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';
import { ThemeService } from './services/theme.service';

type MainTab = 'modules' | 'parts' | 'optimizer' | 'budget' | 'labels';

const TAB_TO_ROUTE: Record<MainTab, string> = {
  modules: '/designer',
  parts: '/parts',
  optimizer: '/optimizer',
  budget: '/budget',
  labels: '/labels',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    ConfirmDialog
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  activeTab = signal<MainTab>('modules');

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;
        if (url.startsWith('/parts')) {
          this.activeTab.set('parts');
        } else if (url.startsWith('/optimizer')) {
          this.activeTab.set('optimizer');
        } else if (url.startsWith('/budget')) {
          this.activeTab.set('budget');
        } else if (url.startsWith('/labels')) {
          this.activeTab.set('labels');
        } else {
          this.activeTab.set('modules');
        }
      });
  }

  onTabChanged(tab: MainTab) {
    this.activeTab.set(tab);
    const targetRoute = TAB_TO_ROUTE[tab] || '/designer';
    void this.router.navigateByUrl(targetRoute);
  }
}
