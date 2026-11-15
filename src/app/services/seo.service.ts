import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Constante única del dominio oficial de producción de Piezo3D Studio.
 * Al adquirir o configurar el dominio definitivo en producción, actualiza únicamente esta línea.
 */
export const OFFICIAL_PRODUCTION_DOMAIN = 'https://piezo3d.com';

export interface SiteConfig {
  readonly domain: string;
  readonly name: string;
  readonly ogImagePath: string;
  readonly ogImageUrl: string;
  readonly locale: string;
  readonly contactEmail: string;
}

const NORMALIZED_DOMAIN = OFFICIAL_PRODUCTION_DOMAIN.replace(/\/+$/, '');

const PRODUCTION_HOSTNAME = (() => {
  try {
    return new URL(NORMALIZED_DOMAIN).hostname.toLowerCase();
  } catch {
    return 'piezo3d.com';
  }
})();

const ALLOWED_PRODUCTION_HOSTNAMES = new Set<string>(
  PRODUCTION_HOSTNAME.startsWith('www.')
    ? [PRODUCTION_HOSTNAME, PRODUCTION_HOSTNAME.slice(4)]
    : [PRODUCTION_HOSTNAME, `www.${PRODUCTION_HOSTNAME}`]
);

export const SITE_CONFIG: SiteConfig = {
  domain: OFFICIAL_PRODUCTION_DOMAIN,
  name: 'Piezo3D Studio',
  ogImagePath: '/assets/og-preview.png',
  ogImageUrl: `${NORMALIZED_DOMAIN}/assets/og-preview.png`,
  locale: 'es_ES',
  contactEmail: 'piezo3dstudio@gmail.com',
};

export const ROBOTS_INDEX_DIRECTIVE =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const ROBOTS_NOINDEX_DIRECTIVE = 'noindex, nofollow';

export interface RouteSeoMetadata {
  readonly title: string;
  readonly description: string;
  readonly keywords: string;
}

const PUBLIC_INDEXABLE_ROUTES = new Set<string>([
  '/',
  '/auth',
  '/terms',
  '/privacy',
  '/refunds',
]);

const PRIVATE_ROUTE_PREFIXES: readonly string[] = [
  '/studio',
  '/admin',
  '/designer',
  '/parts',
  '/cutlist',
  '/optimizer',
  '/budget',
  '/labels',
];

const HOME_METADATA: RouteSeoMetadata = {
  title:
    'Piezo3D Studio | Software de Diseño 3D de Muebles de Melamina, Despiece y Optimizador de Corte 2D',
  description:
    'Diseña muebles de melamina, cocinas integrales y closets en 3D desde el navegador sin instalar programas. Calcula despiece automático, optimización de corte 2D guillotina, presupuesto de carpintería, etiquetas y archivos DXF CNC en minutos.',
  keywords:
    'diseño de muebles 3d online, software despiece melamina, optimizador de corte 2d, programa para carpinteros, diseño de cocinas 3d, planos de armado rta, exportación dxf cnc',
};

const PRIVATE_STUDIO_METADATA: RouteSeoMetadata = {
  title: 'Estudio de Diseño Paramétrico 3D | Piezo3D Studio',
  description:
    'Estudio interactivo 3D de carpintería paramétrica, despiece técnico y optimización de corte para producción en taller.',
  keywords:
    'estudio paramétrico 3d, carpintería paramétrica, despiece técnico, optimización de corte 2d, taller de carpintería',
};

const PUBLIC_ROUTE_METADATA = new Map<string, RouteSeoMetadata>([
  ['/', HOME_METADATA],
  [
    '/auth',
    {
      title: 'Iniciar Sesión o Crear Cuenta Gratis | Piezo3D Studio',
      description:
        'Accede a Piezo3D Studio y comienza a diseñar muebles en 3D con despiece automático, optimizador de corte 2D y cotización para tu taller de carpintería.',
      keywords:
        'iniciar sesión piezo3d studio, crear cuenta diseño de muebles 3d, acceso software carpintería, despiece melamina online, optimizador de corte 2d',
    },
  ],
  [
    '/terms',
    {
      title: 'Términos y Condiciones del Servicio | Piezo3D Studio',
      description:
        'Conoce los términos legales de uso, propiedad intelectual de tus diseños 3D y condiciones de los planes de suscripción de Piezo3D Studio.',
      keywords:
        'términos y condiciones piezo3d studio, licencia software diseño muebles 3d, propiedad intelectual diseños carpintería',
    },
  ],
  [
    '/privacy',
    {
      title: 'Política de Privacidad y Protección de Datos | Piezo3D Studio',
      description:
        'Información transparente sobre la seguridad en la nube de tus proyectos de carpintería 3D, pagos seguros PCI-DSS y privacidad en Piezo3D Studio.',
      keywords:
        'política de privacidad piezo3d studio, protección de datos carpintería 3d, seguridad en la nube, pagos pci-dss',
    },
  ],
  [
    '/refunds',
    {
      title: 'Política de Reembolsos y Cancelación | Piezo3D Studio',
      description:
        'Garantía de reembolso de 7 días calendario y libertad de cancelación en cualquier momento para suscriptores de Piezo3D Studio.',
      keywords:
        'política de reembolsos piezo3d studio, garantía 7 días, cancelación suscripción software carpintería',
    },
  ],
]);

/**
 * Servicio central de SEO dinámico por ruta, etiquetas Open Graph / Twitter Cards,
 * enlace canónico y protección automática anti-indexación para previews y rutas privadas.
 */
@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private isRouteListenerInitialized = false;

  /**
   * Inicializa la escucha de navegación de rutas una única vez.
   * Aplica de inmediato los metadatos de la ruta activa y reacciona a cada NavigationEnd.
   */
  initRouteSeoListener(): void {
    if (this.isRouteListenerInitialized) {
      return;
    }
    this.isRouteListenerInitialized = true;

    this.updateSeoForUrl(this.router.url || '/');

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.updateSeoForUrl(event.urlAfterRedirects || event.url || '/');
      });
  }

  /**
   * Actualiza título, metadatos, robots, canonical, Open Graph y Twitter Cards para una URL.
   * Acepta hostnameOverride para pruebas unitarias determinísticas sin depender del host actual.
   */
  updateSeoForUrl(url: string, hostnameOverride?: string): void {
    const normalizedPath = this.normalizePath(url);
    const hostname = hostnameOverride ?? this.getCurrentHostname();
    const robotsDirective = this.resolveRobotsDirective(normalizedPath, hostname);
    const metadata = this.resolveMetadata(normalizedPath);
    const canonicalUrl = `${NORMALIZED_DOMAIN}${normalizedPath}`;

    this.titleService.setTitle(metadata.title);

    this.metaService.updateTag({ name: 'description', content: metadata.description });
    this.metaService.updateTag({ name: 'keywords', content: metadata.keywords });
    this.metaService.updateTag({ name: 'robots', content: robotsDirective });

    this.updateCanonicalLink(canonicalUrl);

    this.metaService.updateTag({ property: 'og:title', content: metadata.title });
    this.metaService.updateTag({ property: 'og:description', content: metadata.description });
    this.metaService.updateTag({ property: 'og:url', content: canonicalUrl });
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:site_name', content: SITE_CONFIG.name });
    this.metaService.updateTag({ property: 'og:locale', content: SITE_CONFIG.locale });
    this.metaService.updateTag({ property: 'og:image', content: SITE_CONFIG.ogImageUrl });

    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: metadata.title });
    this.metaService.updateTag({ name: 'twitter:description', content: metadata.description });
    this.metaService.updateTag({ name: 'twitter:image', content: SITE_CONFIG.ogImageUrl });
  }

  /**
   * Determina la directiva robots según dominio activo y visibilidad de la ruta.
   */
  resolveRobotsDirective(path: string, hostname: string = this.getCurrentHostname()): string {
    const normalizedPath = this.normalizePath(path).toLowerCase();
    const isBlockedHost = this.isNonProductionHostname(hostname);
    const isPublicRoute = PUBLIC_INDEXABLE_ROUTES.has(normalizedPath);

    if (isBlockedHost || this.isPrivateRoute(normalizedPath) || !isPublicRoute) {
      return ROBOTS_NOINDEX_DIRECTIVE;
    }

    return ROBOTS_INDEX_DIRECTIVE;
  }

  /**
   * Indica si una ruta pertenece al entorno privado o a sus alias internos.
   */
  isPrivateRoute(path: string): boolean {
    const normalized = this.normalizePath(path).toLowerCase();
    return PRIVATE_ROUTE_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    );
  }

  /**
   * Normaliza la ruta removiendo origen, query params, hash y trailing slash (salvo '/').
   */
  normalizePath(url: string): string {
    let raw = (url ?? '').trim();
    if (!raw) {
      return '/';
    }

    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        raw = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        // Si falla el parseo como URL completa, continuar con limpieza estándar
      }
    }

    const withoutHash = raw.split('#')[0] ?? '';
    const withoutQuery = withoutHash.split('?')[0] ?? '';
    let path = withoutQuery.trim();

    if (!path) {
      return '/';
    }

    if (!path.startsWith('/')) {
      path = `/${path}`;
    }

    path = path.replace(/\/{2,}/g, '/');

    if (path.length > 1) {
      path = path.replace(/\/+$/, '') || '/';
    }

    return path;
  }

  private getCurrentHostname(): string {
    return this.document.location?.hostname ?? '';
  }

  private normalizeHostname(hostname: string): string {
    const rawHost = (hostname ?? '').trim().toLowerCase();
    if (!rawHost) {
      return '';
    }

    const colonCount = (rawHost.match(/:/g) ?? []).length;
    const hostWithoutPort = rawHost.startsWith('[')
      ? rawHost.replace(/\]:\d+$/, ']')
      : colonCount === 1
        ? rawHost.replace(/:\d+$/, '')
        : rawHost;

    return hostWithoutPort.replace(/\.+$/, '');
  }

  private isNonProductionHostname(hostname: string): boolean {
    const normalizedHost = this.normalizeHostname(hostname);
    if (!normalizedHost) {
      return true;
    }

    const isVercelPreviewHost =
      normalizedHost === 'vercel.app' || normalizedHost.endsWith('.vercel.app');
    const isLocalHost =
      normalizedHost === 'localhost' ||
      normalizedHost.endsWith('.localhost') ||
      normalizedHost === '127.0.0.1' ||
      normalizedHost === '0.0.0.0' ||
      normalizedHost === '::1' ||
      normalizedHost === '[::1]';

    if (isVercelPreviewHost || isLocalHost) {
      return true;
    }

    return !ALLOWED_PRODUCTION_HOSTNAMES.has(normalizedHost);
  }

  private resolveMetadata(normalizedPath: string): RouteSeoMetadata {
    const lower = normalizedPath.toLowerCase();
    if (this.isPrivateRoute(lower)) {
      return PRIVATE_STUDIO_METADATA;
    }

    return PUBLIC_ROUTE_METADATA.get(lower) ?? HOME_METADATA;
  }

  private updateCanonicalLink(canonicalUrl: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }

    let canonicalLink = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = this.document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      head.appendChild(canonicalLink);
    }

    canonicalLink.setAttribute('href', canonicalUrl);
  }
}
