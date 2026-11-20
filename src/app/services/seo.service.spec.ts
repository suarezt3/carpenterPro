import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router, Routes } from '@angular/router';
import {
  OFFICIAL_PRODUCTION_DOMAIN,
  ROBOTS_INDEX_DIRECTIVE,
  ROBOTS_NOINDEX_DIRECTIVE,
  SITE_CONFIG,
  SeoService,
} from './seo.service';

@Component({
  selector: 'app-seo-test-route-stub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class SeoTestRouteStubComponent {}

const TEST_SEO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', component: SeoTestRouteStubComponent },
  { path: 'auth', component: SeoTestRouteStubComponent },
  { path: 'terms', component: SeoTestRouteStubComponent },
  { path: 'privacy', component: SeoTestRouteStubComponent },
  { path: 'refunds', component: SeoTestRouteStubComponent },
  { path: 'admin', component: SeoTestRouteStubComponent },
  {
    path: 'studio',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'designer' },
      { path: 'designer', component: SeoTestRouteStubComponent },
      { path: 'parts', component: SeoTestRouteStubComponent },
    ],
  },
  { path: 'cutlist', redirectTo: 'studio/parts' },
];

const SEO_META_SELECTORS: readonly string[] = [
  'meta[name="description"]',
  'meta[name="keywords"]',
  'meta[name="robots"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:url"]',
  'meta[name="twitter:image"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:type"]',
  'meta[property="og:site_name"]',
  'meta[property="og:locale"]',
  'meta[property="og:image"]',
];

describe('SeoService (SEO Dinámico, Anti-Indexación, Canonical & Open Graph)', () => {
  let service: SeoService;
  let titleService: Title;
  let metaService: Meta;
  let doc: Document;
  let router: Router;

  const cleanSeoHeadTags = (): void => {
    doc.title = '';
    doc.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    for (const selector of SEO_META_SELECTORS) {
      doc.head.querySelectorAll(selector).forEach((el) => el.remove());
    }
  };

  const getMetaContent = (selector: string): string | null =>
    doc.head.querySelector<HTMLMetaElement>(selector)?.getAttribute('content') ?? null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(TEST_SEO_ROUTES)],
    }).compileComponents();

    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    metaService = TestBed.inject(Meta);
    doc = TestBed.inject(DOCUMENT);
    router = TestBed.inject(Router);
    cleanSeoHeadTags();
  });

  afterEach(() => {
    cleanSeoHeadTags();
  });

  describe('Constantes de configuración de dominio', () => {
    it('debe exportar OFFICIAL_PRODUCTION_DOMAIN y SITE_CONFIG correctamente vinculados', () => {
      expect(OFFICIAL_PRODUCTION_DOMAIN).toBe('https://piezo3d.com');
      expect(SITE_CONFIG.domain).toBe(OFFICIAL_PRODUCTION_DOMAIN);
      expect(SITE_CONFIG.name).toBe('Piezo3D Studio');
      expect(SITE_CONFIG.ogImagePath).toBe('/assets/og-preview.png');
      expect(SITE_CONFIG.ogImageUrl).toBe('https://piezo3d.com/assets/og-preview.png');
      expect(SITE_CONFIG.locale).toBe('es_ES');
      expect(SITE_CONFIG.contactEmail).toBe('piezo3dstudio@gmail.com');
    });

    it('debe definir SITE_CONFIG.contactEmail como piezo3dstudio@gmail.com y excluir correos provisionales o marcas prohibidas en metadatos', () => {
      expect(SITE_CONFIG.contactEmail).toBe('piezo3dstudio@gmail.com');

      const forbiddenBrandRegex =
        /(sketchup|melamina\s*3d|mueble\s*m[ií]o|polyboard|promob|lepton|cutlist|opticut|click-cuisine|carpenterpro)/i;
      const legacyEmailRegex = /eydersuarez900@gmail\.com/i;

      expect(SITE_CONFIG.contactEmail).not.toMatch(legacyEmailRegex);
      expect(SITE_CONFIG.contactEmail).not.toMatch(forbiddenBrandRegex);

      const pathsToCheck = ['/', '/auth', '/terms', '/privacy', '/refunds', '/studio/designer', '/admin'];
      for (const path of pathsToCheck) {
        service.updateSeoForUrl(path, 'piezo3d.com');
        const combinedText = [
          titleService.getTitle(),
          getMetaContent('meta[name="description"]') ?? '',
          getMetaContent('meta[name="keywords"]') ?? '',
          getMetaContent('meta[property="og:title"]') ?? '',
          getMetaContent('meta[property="og:description"]') ?? '',
          getMetaContent('meta[name="twitter:title"]') ?? '',
          getMetaContent('meta[name="twitter:description"]') ?? '',
        ].join(' ');

        expect(combinedText).not.toMatch(legacyEmailRegex);
        expect(combinedText).not.toMatch(forbiddenBrandRegex);
      }
    });
  });

  describe('Regla automática anti-indexación (robots)', () => {
    it('debe retornar noindex, nofollow si el hostname es vercel.app, localhost, 127.0.0.1 o vacío', () => {
      const nonProdHosts = [
        'carpenterpro-inky.vercel.app',
        'carpenter-preview.vercel.app',
        'piezo3d-git-feat-seo.vercel.app',
        'localhost',
        '127.0.0.1',
        '',
      ];
      const routesToCheck = [
        '/',
        '/auth',
        '/login',
        '/register',
        '/reset-password',
        '/terms',
        '/privacy',
        '/refunds',
      ];

      for (const host of nonProdHosts) {
        for (const path of routesToCheck) {
          expect(service.resolveRobotsDirective(path, host)).toBe(ROBOTS_NOINDEX_DIRECTIVE);
        }
      }
    });

    it('debe retornar noindex, nofollow para rutas privadas (/auth, /login, /register, /reset-password, /studio, /admin y alias internos) en piezo3d.com y www.piezo3d.com', () => {
      const privatePaths = [
        '/auth',
        '/auth?mode=login',
        '/auth?mode=register',
        '/login',
        '/register',
        '/reset-password',
        '/studio',
        '/studio/designer',
        '/studio/parts',
        '/studio/optimizer',
        '/admin',
        '/admin/metrics',
        '/designer',
        '/parts',
        '/cutlist',
        '/optimizer',
        '/budget',
        '/labels',
      ];

      for (const path of privatePaths) {
        expect(service.isPrivateRoute(path)).toBe(true);
        expect(service.resolveRobotsDirective(path, 'piezo3d.com')).toBe(
          ROBOTS_NOINDEX_DIRECTIVE
        );
        expect(service.resolveRobotsDirective(path, 'www.piezo3d.com')).toBe(
          ROBOTS_NOINDEX_DIRECTIVE
        );
      }
    });

    it('debe retornar directiva completa de indexación cuando hostname es piezo3d.com y la ruta es pública', () => {
      const publicPaths = ['/', '/terms', '/privacy', '/refunds'];

      for (const path of publicPaths) {
        expect(service.isPrivateRoute(path)).toBe(false);
        expect(service.resolveRobotsDirective(path, 'piezo3d.com')).toBe(ROBOTS_INDEX_DIRECTIVE);
      }

      expect(service.resolveRobotsDirective('/privacy/?foo=bar#hash', 'piezo3d.com')).toBe(
        ROBOTS_INDEX_DIRECTIVE
      );
      expect(service.resolveRobotsDirective('/terms/?ref=footer#legal', 'piezo3d.com')).toBe(
        ROBOTS_INDEX_DIRECTIVE
      );
      expect(service.resolveRobotsDirective('/', 'www.piezo3d.com')).toBe(ROBOTS_INDEX_DIRECTIVE);
      expect(service.resolveRobotsDirective('/auth', 'piezo3d.com')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
      expect(service.resolveRobotsDirective('/ruta-no-indexable', 'piezo3d.com')).toBe(
        ROBOTS_NOINDEX_DIRECTIVE
      );
    });

    it('debe permitir indexación en www.piezo3d.com solo para las 4 rutas públicas y bloquear /auth y rutas privadas', () => {
      const publicPaths = ['/', '/terms', '/privacy', '/refunds'];
      const privatePaths = [
        '/auth',
        '/auth?mode=login',
        '/auth?mode=register',
        '/login',
        '/register',
        '/reset-password',
        '/studio',
        '/studio/designer',
        '/admin',
      ];

      for (const path of publicPaths) {
        expect(service.resolveRobotsDirective(path, 'www.piezo3d.com')).toBe(ROBOTS_INDEX_DIRECTIVE);
      }

      for (const path of privatePaths) {
        expect(service.resolveRobotsDirective(path, 'www.piezo3d.com')).toBe(
          ROBOTS_NOINDEX_DIRECTIVE
        );
      }
    });

    it('debe forzar noindex, nofollow en previews de rama develop (*.vercel.app), localhost y dominios no oficiales en todas las rutas', () => {
      const previewAndNonProdHosts: readonly string[] = [
        'carpenterpro-inky.vercel.app',
        'piezo3d-git-develop-suarezt3.vercel.app',
        'carpenterpro-git-develop.vercel.app',
        'piezo3d-preview-pr-42.vercel.app',
        'vercel.app',
        'PIEZO3D-GIT-DEVELOP-SUAREZT3.VERCEL.APP.',
        'localhost',
        'localhost:4200',
        'preview.localhost',
        '127.0.0.1',
        '127.0.0.1:3000',
        '0.0.0.0',
        '::1',
        '[::1]',
        'develop.piezo3d.com',
        'staging.piezo3d.com',
        'vercel.app.evil.com',
        'piezo3d.com.evil.com',
      ];
      const allRoutes: readonly string[] = [
        '/',
        '/auth',
        '/login',
        '/register',
        '/reset-password',
        '/terms',
        '/privacy',
        '/refunds',
        '/studio',
        '/studio/designer',
        '/studio/parts',
        '/admin',
        '/admin/users',
      ];

      for (const host of previewAndNonProdHosts) {
        for (const path of allRoutes) {
          expect(service.resolveRobotsDirective(path, host)).toBe(ROBOTS_NOINDEX_DIRECTIVE);
        }
      }
    });

    it('debe normalizar mayúsculas, puertos y punto final en piezo3d.com y www.piezo3d.com manteniendo bloqueo en /auth y rutas privadas', () => {
      const prodVariants: readonly string[] = [
        'piezo3d.com',
        'www.piezo3d.com',
        'PIEZO3D.COM',
        'WWW.PIEZO3D.COM.',
        'piezo3d.com:443',
      ];
      const publicPaths: readonly string[] = ['/', '/terms', '/privacy', '/refunds'];
      const privatePaths: readonly string[] = [
        '/auth',
        '/login',
        '/register',
        '/reset-password',
        '/studio',
        '/studio/designer',
        '/studio/parts',
        '/admin',
        '/admin/settings',
      ];

      for (const host of prodVariants) {
        for (const path of publicPaths) {
          expect(service.resolveRobotsDirective(path, host)).toBe(ROBOTS_INDEX_DIRECTIVE);
        }
        for (const path of privatePaths) {
          expect(service.resolveRobotsDirective(path, host)).toBe(ROBOTS_NOINDEX_DIRECTIVE);
        }
      }
    });
  });

  describe('Normalización de rutas y políticas de contenido', () => {
    it('debe normalizar query params, hashes, barras finales y orígenes completos', () => {
      expect(service.normalizePath('')).toBe('/');
      expect(service.normalizePath('/')).toBe('/');
      expect(service.normalizePath('/terms/')).toBe('/terms');
      expect(service.normalizePath('/auth?mode=register#form')).toBe('/auth');
      expect(service.normalizePath('/privacy#datos?x=1')).toBe('/privacy');
      expect(service.normalizePath('/studio/designer/?tab=3d')).toBe('/studio/designer');
      expect(service.normalizePath('https://piezo3d.com/refunds/?utm=1#faq')).toBe('/refunds');
    });

    it('no debe incluir menciones a software de terceros ni proveedores backend en metadatos ni keywords', () => {
      const forbiddenBrandRegex =
        /(sketchup|melamina\s*3d|mueble\s*m[ií]o|polyboard|promob|lepton|cutlist|opticut|click-cuisine|carpenterpro)/i;
      const forbiddenInfraRegex =
        /(supabase|postgresql|postgres|umdcxcjrdyckpxomxlmi|sql\s*editor)/i;

      const pathsToCheck = ['/', '/auth', '/terms', '/privacy', '/refunds', '/studio/designer', '/admin'];
      for (const path of pathsToCheck) {
        service.updateSeoForUrl(path, 'piezo3d.com');
        const combinedText = [
          titleService.getTitle(),
          getMetaContent('meta[name="description"]') ?? '',
          getMetaContent('meta[name="keywords"]') ?? '',
          getMetaContent('meta[property="og:title"]') ?? '',
          getMetaContent('meta[property="og:description"]') ?? '',
        ].join(' ');

        expect(combinedText).not.toMatch(forbiddenBrandRegex);
        expect(combinedText).not.toMatch(forbiddenInfraRegex);
      }
    });
  });

  describe('Actualización determinística en DOM con hostnameOverride', () => {
    it('debe inyectar metadatos completos de producción para / en piezo3d.com', () => {
      service.updateSeoForUrl('/', 'piezo3d.com');

      const expectedTitle =
        'Piezo3D Studio | Software de Diseño 3D de Muebles de Melamina, Despiece y Optimizador de Corte 2D';
      const expectedDesc =
        'Diseña muebles de melamina, cocinas integrales y closets en 3D desde el navegador sin instalar programas. Calcula despiece automático, optimización de corte 2D guillotina, presupuesto de carpintería, etiquetas y archivos DXF CNC en minutos.';

      expect(titleService.getTitle()).toBe(expectedTitle);
      expect(getMetaContent('meta[name="description"]')).toBe(expectedDesc);
      expect(getMetaContent('meta[name="keywords"]')).toBeTruthy();
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_INDEX_DIRECTIVE);

      const canonical = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      expect(canonical?.getAttribute('href')).toBe('https://piezo3d.com/');

      expect(getMetaContent('meta[property="og:title"]')).toBe(expectedTitle);
      expect(getMetaContent('meta[property="og:description"]')).toBe(expectedDesc);
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/');
      expect(getMetaContent('meta[property="og:type"]')).toBe('website');
      expect(getMetaContent('meta[property="og:site_name"]')).toBe('Piezo3D Studio');
      expect(getMetaContent('meta[property="og:locale"]')).toBe('es_ES');
      expect(getMetaContent('meta[property="og:image"]')).toBe(
        'https://piezo3d.com/assets/og-preview.png'
      );

      expect(getMetaContent('meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(getMetaContent('meta[name="twitter:title"]')).toBe(expectedTitle);
      expect(getMetaContent('meta[name="twitter:description"]')).toBe(expectedDesc);
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/');
      expect(getMetaContent('meta[name="twitter:image"]')).toBe(
        'https://piezo3d.com/assets/og-preview.png'
      );
    });

    it('debe forzar noindex, nofollow en / y demás rutas para carpenterpro-inky.vercel.app y localhost', () => {
      const nonProdHosts: readonly string[] = [
        'carpenterpro-inky.vercel.app',
        'carpenter-preview.vercel.app',
        'localhost',
      ];
      const routes: readonly string[] = ['/', '/privacy', '/terms', '/refunds', '/auth'];

      for (const host of nonProdHosts) {
        for (const route of routes) {
          service.updateSeoForUrl(route, host);
          expect(getMetaContent('meta[name="robots"]')).toBe('noindex, nofollow');
        }
      }
    });

    it('debe inyectar <meta name="robots" content="noindex, nofollow"> en el DOM para todas las rutas bajo previews develop en *.vercel.app', () => {
      const allRoutes: readonly string[] = [
        '/',
        '/auth',
        '/terms',
        '/privacy',
        '/refunds',
        '/studio',
        '/studio/designer',
        '/admin',
      ];
      const vercelDevelopHosts: readonly string[] = [
        'piezo3d-git-develop-suarezt3.vercel.app',
        'carpenterpro-git-develop.vercel.app',
      ];

      for (const host of vercelDevelopHosts) {
        for (const path of allRoutes) {
          service.updateSeoForUrl(path, host);
          expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
        }
      }
    });

    it('debe mantener el enlace canonical, og:url y twitter:url apuntando a https://piezo3d.com cuando se accede desde www.piezo3d.com', () => {
      service.updateSeoForUrl('/terms', 'www.piezo3d.com');

      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_INDEX_DIRECTIVE);
      expect(doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/terms'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/terms');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/terms');
      expect(getMetaContent('meta[property="og:image"]')).toBe(
        'https://piezo3d.com/assets/og-preview.png'
      );
    });

    it('debe indexar únicamente /, /privacy, /terms y /refunds en piezo3d.com con canonical, og:url y twitter:url normalizados sin www ni trailing slash en subrutas', () => {
      const cases: readonly { input: string; expectedCanonical: string }[] = [
        { input: '/', expectedCanonical: 'https://piezo3d.com/' },
        { input: '/privacy', expectedCanonical: 'https://piezo3d.com/privacy' },
        { input: '/privacy/?foo=bar#hash', expectedCanonical: 'https://piezo3d.com/privacy' },
        { input: '/terms', expectedCanonical: 'https://piezo3d.com/terms' },
        { input: '/refunds', expectedCanonical: 'https://piezo3d.com/refunds' },
      ];

      for (const testCase of cases) {
        service.updateSeoForUrl(testCase.input, 'piezo3d.com');

        expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_INDEX_DIRECTIVE);
        expect(doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href')).toBe(
          testCase.expectedCanonical
        );
        expect(getMetaContent('meta[property="og:url"]')).toBe(testCase.expectedCanonical);
        expect(getMetaContent('meta[name="twitter:url"]')).toBe(testCase.expectedCanonical);
        expect(testCase.expectedCanonical).not.toContain('www.');
      }
    });

    it('debe reutilizar el link[rel="canonical"] existente sin duplicar elementos en document.head', () => {
      const existingCanonical = doc.createElement('link');
      existingCanonical.setAttribute('rel', 'canonical');
      existingCanonical.setAttribute('href', 'https://piezo3d.com/');
      doc.head.appendChild(existingCanonical);

      service.updateSeoForUrl('/terms?ref=footer#planes', 'piezo3d.com');

      const canonicalNodes = doc.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]');
      expect(canonicalNodes.length).toBe(1);
      expect(canonicalNodes[0]?.getAttribute('href')).toBe('https://piezo3d.com/terms');
    });

    it('debe aplicar metadatos correctos y noindex, nofollow a /auth, /login, /register, /reset-password, /studio/designer y /admin en piezo3d.com y www.piezo3d.com', () => {
      service.updateSeoForUrl('/auth', 'piezo3d.com');
      expect(titleService.getTitle()).toBe(
        'Iniciar Sesión o Crear Cuenta Gratis | Piezo3D Studio'
      );
      expect(getMetaContent('meta[name="robots"]')).toBe('noindex, nofollow');
      expect(metaService.getTag('property="og:url"')?.content).toBe('https://piezo3d.com/auth');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/auth');

      const noindexRoutes: readonly string[] = [
        '/auth',
        '/auth?mode=login',
        '/auth?mode=register',
        '/login',
        '/register',
        '/reset-password',
        '/studio/designer',
        '/admin',
        '/ruta-no-registrada',
      ];
      const prodHosts: readonly string[] = ['piezo3d.com', 'www.piezo3d.com'];

      for (const host of prodHosts) {
        for (const route of noindexRoutes) {
          service.updateSeoForUrl(route, host);
          expect(getMetaContent('meta[name="robots"]')).toBe('noindex, nofollow');
        }
      }

      service.updateSeoForUrl('/studio/designer', 'piezo3d.com');
      expect(titleService.getTitle()).toBe('Estudio de Diseño Paramétrico 3D | Piezo3D Studio');
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);

      service.updateSeoForUrl('/admin', 'piezo3d.com');
      expect(titleService.getTitle()).toBe('Estudio de Diseño Paramétrico 3D | Piezo3D Studio');
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
    });
  });

  describe('Actualización dinámica en DOM al navegar con Angular Router', () => {
    it('debe actualizar Title, description, canonical, og:*, twitter:* y robots en cada NavigationEnd', async () => {
      service.initRouteSeoListener();

      await router.navigateByUrl('/');
      expect(titleService.getTitle()).toBe(
        'Piezo3D Studio | Software de Diseño 3D de Muebles de Melamina, Despiece y Optimizador de Corte 2D'
      );
      expect(getMetaContent('meta[name="description"]')).toContain(
        'Diseña muebles de melamina, cocinas integrales y closets en 3D'
      );
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/');
      expect(getMetaContent('meta[name="twitter:card"]')).toBe('summary_large_image');

      await router.navigateByUrl('/auth');
      expect(titleService.getTitle()).toBe(
        'Iniciar Sesión o Crear Cuenta Gratis | Piezo3D Studio'
      );
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/auth'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/auth');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/auth');

      await router.navigateByUrl('/terms');
      expect(titleService.getTitle()).toBe('Términos y Condiciones del Servicio | Piezo3D Studio');
      expect(getMetaContent('meta[name="description"]')).toBe(
        'Conoce los términos legales de uso, propiedad intelectual de tus diseños 3D y condiciones de los planes de suscripción de Piezo3D Studio.'
      );
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/terms'
      );
      expect(getMetaContent('meta[property="og:title"]')).toBe(
        'Términos y Condiciones del Servicio | Piezo3D Studio'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/terms');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/terms');
      expect(getMetaContent('meta[name="twitter:title"]')).toBe(
        'Términos y Condiciones del Servicio | Piezo3D Studio'
      );

      await router.navigateByUrl('/privacy');
      expect(titleService.getTitle()).toBe(
        'Política de Privacidad y Protección de Datos | Piezo3D Studio'
      );
      expect(getMetaContent('meta[name="description"]')).toBe(
        'Información transparente sobre la seguridad en la nube de tus proyectos de carpintería 3D, pagos seguros PCI-DSS y privacidad en Piezo3D Studio.'
      );
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/privacy'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/privacy');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/privacy');

      await router.navigateByUrl('/refunds');
      expect(titleService.getTitle()).toBe(
        'Política de Reembolsos y Cancelación | Piezo3D Studio'
      );
      expect(getMetaContent('meta[name="description"]')).toBe(
        'Garantía de reembolso de 7 días calendario y libertad de cancelación en cualquier momento para suscriptores de Piezo3D Studio.'
      );
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/refunds'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/refunds');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/refunds');

      await router.navigateByUrl('/studio/designer');
      expect(titleService.getTitle()).toBe('Estudio de Diseño Paramétrico 3D | Piezo3D Studio');
      expect(getMetaContent('meta[name="description"]')).toBe(
        'Estudio interactivo 3D de carpintería paramétrica, despiece técnico y optimización de corte para producción en taller.'
      );
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/studio/designer'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe(
        'https://piezo3d.com/studio/designer'
      );
      expect(getMetaContent('meta[name="twitter:url"]')).toBe(
        'https://piezo3d.com/studio/designer'
      );
      expect(getMetaContent('meta[name="twitter:description"]')).toBe(
        'Estudio interactivo 3D de carpintería paramétrica, despiece técnico y optimización de corte para producción en taller.'
      );

      await router.navigateByUrl('/admin');
      expect(titleService.getTitle()).toBe('Estudio de Diseño Paramétrico 3D | Piezo3D Studio');
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/admin'
      );
      expect(getMetaContent('meta[property="og:url"]')).toBe('https://piezo3d.com/admin');
      expect(getMetaContent('meta[name="twitter:url"]')).toBe('https://piezo3d.com/admin');

      await router.navigateByUrl('/cutlist');
      expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://piezo3d.com/studio/parts'
      );
      expect(getMetaContent('meta[name="robots"]')).toBe(ROBOTS_NOINDEX_DIRECTIVE);
    });

    it('debe evitar suscripciones duplicadas al llamar initRouteSeoListener múltiples veces', async () => {
      const updateSpy = vi.spyOn(service, 'updateSeoForUrl');

      service.initRouteSeoListener();
      service.initRouteSeoListener();
      service.initRouteSeoListener();

      expect(updateSpy).toHaveBeenCalledTimes(1);

      await router.navigateByUrl('/terms');
      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenLastCalledWith('/terms');
    });
  });
});
