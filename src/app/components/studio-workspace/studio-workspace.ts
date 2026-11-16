import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { HeaderComponent } from '../header/header';
import { UpgradePlanModalComponent } from '../upgrade-plan-modal/upgrade-plan-modal';
import { ThemeService } from '../../services/theme.service';
import { AssemblyGuideService } from '../../services/assembly-guide.service';
import { SupabaseService } from '../../services/supabase.service';
import { PaymentService } from '../../services/payment.service';

export type MainTab = 'modules' | 'parts' | 'optimizer' | 'budget' | 'labels';

export const STUDIO_TAB_TO_ROUTE: Record<MainTab, string> = {
  modules: '/studio/designer',
  parts: '/studio/parts',
  optimizer: '/studio/optimizer',
  budget: '/studio/budget',
  labels: '/studio/labels',
};

/**
 * Contenedor del espacio de trabajo de Piezo3D Studio (/studio).
 * Aloja la barra superior del proyecto, la navegación por pestañas de producción
 * (Diseñador 3D, Despiece, Optimizador 2D, Presupuesto, Etiquetas) y el área de trabajo activa.
 */
@Component({
  selector: 'app-studio-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    HeaderComponent,
    UpgradePlanModalComponent
  ],
  templateUrl: './studio-workspace.html',
  styleUrl: './studio-workspace.css',
})
export class StudioWorkspaceComponent {
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly assemblyGuideService = inject(AssemblyGuideService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly paymentService = inject(PaymentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeTab = signal<MainTab>('modules');
  readonly canGenerateAssemblyGuide = this.assemblyGuideService.canGenerateAssemblyGuide;
  private lastTriggeredWompiTxId: string | null = null;

  constructor() {
    this.syncTabFromUrl(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        const nextUrl = event.urlAfterRedirects || event.url;
        this.syncTabFromUrl(nextUrl);
        if (this.supabaseService.isAuthenticated?.() ?? true) {
          this.checkWompiRedirectReturn(nextUrl);
        }
      });

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const offlineHandler = () => {
        void this.handleOfflineDisconnect();
      };
      window.addEventListener('offline', offlineHandler);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('offline', offlineHandler);
      });
    }

    if (this.supabaseService.isAuthenticated?.() ?? true) {
      this.checkWompiRedirectReturn();
    }

    // Si el usuario regresa autenticado desde OAuth o registro con una intención de compra pendiente o retorno de Wompi, procesarlo
    effect(() => {
      const isAuth = this.supabaseService.isAuthenticated?.() ?? false;
      if (isAuth) {
        untracked(() => {
          const pending = this.paymentService.consumePendingCheckout();
          if (pending) {
            void this.paymentService.openCheckout(pending.plan, pending.cycle);
          }
          this.checkWompiRedirectReturn();
        });
      }
    });
  }

  private resolveWompiCandidateUrl(explicitUrl?: string): string {
    if (explicitUrl && (explicitUrl.includes('wompi_checkout=') || explicitUrl.includes('id='))) {
      return explicitUrl;
    }
    const routerUrl = this.router.url || '';
    if (routerUrl.includes('wompi_checkout=') || routerUrl.includes('id=')) {
      return routerUrl;
    }
    if (typeof window !== 'undefined' && window.location?.search) {
      return `${window.location.pathname || ''}${window.location.search}`;
    }
    return explicitUrl || routerUrl;
  }

  private checkWompiRedirectReturn(explicitUrl?: string): void {
    const candidateUrl = this.resolveWompiCandidateUrl(explicitUrl);
    if (!candidateUrl || !candidateUrl.includes('?')) {
      return;
    }
    const query = candidateUrl.slice(candidateUrl.indexOf('?') + 1);
    const params = new URLSearchParams(query);
    const txId = params.get('id')?.trim() ?? '';
    const hasWompiMarker = params.get('wompi_checkout') === '1' || params.has('env');
    if (!txId || !hasWompiMarker || txId === this.lastTriggeredWompiTxId) {
      return;
    }
    this.lastTriggeredWompiTxId = txId;
    void this.paymentService.processWompiRedirectReturn?.();
  }

  async handleOfflineDisconnect(): Promise<void> {
    if (typeof this.supabaseService.signOut === 'function') {
      await this.supabaseService.signOut();
    }
    await this.router.navigateByUrl('/');
  }

  private syncTabFromUrl(url: string): void {
    if (!url) return;
    if (url.includes('/parts') || url.includes('/cutlist')) {
      this.activeTab.set('parts');
    } else if (url.includes('/optimizer')) {
      this.activeTab.set('optimizer');
    } else if (url.includes('/budget')) {
      this.activeTab.set('budget');
    } else if (url.includes('/labels')) {
      this.activeTab.set('labels');
    } else if (url.includes('/designer') || url.includes('/studio')) {
      this.activeTab.set('modules');
    }
  }

  onTabChanged(tab: MainTab): void {
    this.activeTab.set(tab);
    const targetRoute = STUDIO_TAB_TO_ROUTE[tab] || '/studio/designer';
    void this.router.navigateByUrl(targetRoute);
  }
}
