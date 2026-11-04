import { Injectable, signal } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

export interface RouteReuseLifecycleAware {
  onRouteDetach?: () => void;
  onRouteAttach?: () => void;
}

/**
 * Estrategia de reutilización de rutas para el Diseñador 3D (Solución al Error #13).
 * Conserva en memoria la instancia viva de ModuleDesignerComponent y Furniture3dViewerComponent
 * cuando el usuario navega entre las diferentes pestañas del sistema (Despiece, Optimizador 2D,
 * Presupuesto, Etiquetas), evitando destruir el WebGLRenderer y los shaders compilados.
 */
@Injectable({
  providedIn: 'root'
})
export class DesignerRouteReuseStrategy implements RouteReuseStrategy {
  private static readonly REUSABLE_ROUTE_PATH = 'designer';
  private storedHandles = new Map<string, DetachedRouteHandle>();

  // Señal reactiva para monitorear si el Diseñador 3D está visible o en pausa
  readonly isDesignerActive = signal<boolean>(true);

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const path = this.getRoutePath(route);
    return path === DesignerRouteReuseStrategy.REUSABLE_ROUTE_PATH;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const path = this.getRoutePath(route);
    if (!path) return;

    if (handle) {
      this.storedHandles.set(path, handle);
      if (path === DesignerRouteReuseStrategy.REUSABLE_ROUTE_PATH) {
        this.isDesignerActive.set(false);
        this.notifyComponent(handle, 'detach');
      }
    } else {
      this.storedHandles.delete(path);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const path = this.getRoutePath(route);
    return path === DesignerRouteReuseStrategy.REUSABLE_ROUTE_PATH && this.storedHandles.has(path);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const path = this.getRoutePath(route);
    if (!path) return null;

    const handle = this.storedHandles.get(path) ?? null;
    if (handle && path === DesignerRouteReuseStrategy.REUSABLE_ROUTE_PATH) {
      this.isDesignerActive.set(true);
      this.notifyComponent(handle, 'attach');
    }
    return handle;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  clearHandles(): void {
    this.storedHandles.clear();
  }

  private getRoutePath(route: ActivatedRouteSnapshot): string {
    return route.routeConfig?.path ?? '';
  }

  private notifyComponent(handle: DetachedRouteHandle, action: 'detach' | 'attach'): void {
    try {
      const compInstance = (handle as unknown as { componentRef?: { instance?: unknown } })?.componentRef?.instance;
      if (compInstance && typeof compInstance === 'object') {
        const candidate = compInstance as RouteReuseLifecycleAware;
        if (action === 'detach' && typeof candidate.onRouteDetach === 'function') {
          candidate.onRouteDetach();
        } else if (action === 'attach' && typeof candidate.onRouteAttach === 'function') {
          candidate.onRouteAttach();
        }
      }
    } catch {
      // Manejo silencioso en entornos SSR / testing
    }
  }
}
