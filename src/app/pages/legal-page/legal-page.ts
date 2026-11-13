import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  BookOpen01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Compass01Icon,
  CreditCardIcon,
  InformationCircleIcon,
  Invoice01Icon,
  LockPasswordIcon,
  Mail01Icon,
  Shield01Icon
} from '@hugeicons/core-free-icons';
import { SupabaseService } from '../../services/supabase.service';

export type LegalDocType = 'terms' | 'privacy' | 'refunds';

export interface LegalTabItem {
  id: LegalDocType;
  label: string;
  route: string;
  subtitle: string;
}

@Component({
  selector: 'app-legal-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HugeiconsIconComponent],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.css'
})
export class LegalPageComponent implements OnInit {
  readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly icons = {
    brand: Compass01Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowUp: ArrowUp01Icon,
    shield: Shield01Icon,
    book: BookOpen01Icon,
    checklist: CheckListIcon,
    checkCircle: CheckmarkCircle02Icon,
    creditCard: CreditCardIcon,
    invoice: Invoice01Icon,
    lock: LockPasswordIcon,
    mail: Mail01Icon,
    info: InformationCircleIcon,
    clock: Clock01Icon,
    alert: AlertCircleIcon
  };

  readonly activeDoc = signal<LegalDocType>('terms');

  readonly tabs: readonly LegalTabItem[] = [
    {
      id: 'terms',
      label: 'Términos y Condiciones',
      route: '/terms',
      subtitle: 'Acuerdo de servicio SaaS y responsabilidad técnica'
    },
    {
      id: 'privacy',
      label: 'Política de Privacidad',
      route: '/privacy',
      subtitle: 'Protección de datos, pagos PCI-DSS y derechos ARCO'
    },
    {
      id: 'refunds',
      label: 'Política de Reembolsos y Cancelación',
      route: '/refunds',
      subtitle: 'Garantía de 7 días y libertad de cancelación'
    }
  ];

  readonly supportEmail = computed<string>(() => {
    const settingsFn = (
      this.supabaseService as {
        platformSettings?: () => { support_email?: string } | null;
      }
    ).platformSettings;
    const dynamicEmail = typeof settingsFn === 'function' ? settingsFn()?.support_email?.trim() : '';
    return dynamicEmail || 'eydersuarez900@gmail.com';
  });

  readonly appVersion = computed<string>(() => {
    const settingsFn = (
      this.supabaseService as {
        platformSettings?: () => { app_version?: string } | null;
      }
    ).platformSettings;
    const dynamicVer = typeof settingsFn === 'function' ? settingsFn()?.app_version?.trim() : '';
    return dynamicVer || 'v3.0.0';
  });

  constructor() {
    this.syncDocFromUrl(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.syncDocFromUrl(event.urlAfterRedirects || event.url);
        this.scrollToTop();
      });
  }

  ngOnInit(): void {
    this.syncDocFromUrl(this.router.url);
    const loadFn = (
      this.supabaseService as {
        loadPlatformSettings?: () => Promise<unknown>;
      }
    ).loadPlatformSettings;
    if (typeof loadFn === 'function') {
      void loadFn.call(this.supabaseService);
    }
  }

  selectDoc(doc: LegalDocType): void {
    this.activeDoc.set(doc);
    const targetUrl = `/${doc}`;
    if (!this.router.url.startsWith(targetUrl)) {
      void this.router.navigateByUrl(targetUrl);
    }
    this.scrollToTop();
  }

  onFooterLinkClick(doc: LegalDocType): void {
    this.activeDoc.set(doc);
    this.scrollToTop();
  }

  scrollToTop(): void {
    const hostEl = this.elementRef.nativeElement;
    if (!hostEl) {
      return;
    }
    if (typeof hostEl.scrollTo === 'function') {
      hostEl.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    hostEl.scrollTop = 0;
  }

  private syncDocFromUrl(url: string): void {
    const clean = (url || '').toLowerCase();
    if (clean.includes('/privacy')) {
      this.activeDoc.set('privacy');
    } else if (clean.includes('/refunds')) {
      this.activeDoc.set('refunds');
    } else {
      this.activeDoc.set('terms');
    }
  }
}
