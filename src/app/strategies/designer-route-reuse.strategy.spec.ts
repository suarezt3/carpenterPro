import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';
import { DesignerRouteReuseStrategy, RouteReuseLifecycleAware } from './designer-route-reuse.strategy';

function createMockSnapshot(path: string): ActivatedRouteSnapshot {
  return {
    routeConfig: { path }
  } as unknown as ActivatedRouteSnapshot;
}

class MockComponentInstance implements RouteReuseLifecycleAware {
  detachedCount = 0;
  attachedCount = 0;

  onRouteDetach(): void {
    this.detachedCount++;
  }

  onRouteAttach(): void {
    this.attachedCount++;
  }
}

function createMockHandle(instance: unknown): DetachedRouteHandle {
  return {
    componentRef: {
      instance
    }
  } as unknown as DetachedRouteHandle;
}

describe('DesignerRouteReuseStrategy (Fase 2 - Persistencia WebGL)', () => {
  let strategy: DesignerRouteReuseStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerRouteReuseStrategy]
    });
    strategy = TestBed.inject(DesignerRouteReuseStrategy);
    strategy.clearHandles();
  });

  it('debe crearse correctamente', () => {
    expect(strategy).toBeTruthy();
  });

  describe('shouldDetach', () => {
    it('debe retornar true únicamente para la ruta "designer"', () => {
      expect(strategy.shouldDetach(createMockSnapshot('designer'))).toBe(true);
    });

    it('debe retornar false para otras rutas (parts, optimizer, budget, labels)', () => {
      expect(strategy.shouldDetach(createMockSnapshot('parts'))).toBe(false);
      expect(strategy.shouldDetach(createMockSnapshot('optimizer'))).toBe(false);
      expect(strategy.shouldDetach(createMockSnapshot('budget'))).toBe(false);
      expect(strategy.shouldDetach(createMockSnapshot('labels'))).toBe(false);
    });
  });

  describe('store y retrieve con ciclo de vida', () => {
    it('debe almacenar el handle de "designer", notificar detach y pausar la señal isDesignerActive', () => {
      const comp = new MockComponentInstance();
      const handle = createMockHandle(comp);
      const snapshot = createMockSnapshot('designer');

      strategy.store(snapshot, handle);

      expect(comp.detachedCount).toBe(1);
      expect(strategy.isDesignerActive()).toBe(false);
      expect(strategy.shouldAttach(snapshot)).toBe(true);
    });

    it('debe recuperar el handle de "designer", notificar attach y activar la señal isDesignerActive', () => {
      const comp = new MockComponentInstance();
      const handle = createMockHandle(comp);
      const snapshot = createMockSnapshot('designer');

      strategy.store(snapshot, handle);
      const retrieved = strategy.retrieve(snapshot);

      expect(retrieved).toBe(handle);
      expect(comp.attachedCount).toBe(1);
      expect(strategy.isDesignerActive()).toBe(true);
    });

    it('debe eliminar el handle cuando store se llama con null', () => {
      const comp = new MockComponentInstance();
      const handle = createMockHandle(comp);
      const snapshot = createMockSnapshot('designer');

      strategy.store(snapshot, handle);
      expect(strategy.shouldAttach(snapshot)).toBe(true);

      strategy.store(snapshot, null);
      expect(strategy.shouldAttach(snapshot)).toBe(false);
      expect(strategy.retrieve(snapshot)).toBeNull();
    });

    it('debe limpiar todos los handles con clearHandles', () => {
      const comp = new MockComponentInstance();
      const handle = createMockHandle(comp);
      const snapshot = createMockSnapshot('designer');

      strategy.store(snapshot, handle);
      strategy.clearHandles();

      expect(strategy.shouldAttach(snapshot)).toBe(false);
      expect(strategy.retrieve(snapshot)).toBeNull();
    });
  });

  describe('shouldReuseRoute', () => {
    it('debe reutilizar rutas si coinciden sus routeConfig', () => {
      const config = { path: 'designer' };
      const future = { routeConfig: config } as unknown as ActivatedRouteSnapshot;
      const curr = { routeConfig: config } as unknown as ActivatedRouteSnapshot;
      expect(strategy.shouldReuseRoute(future, curr)).toBe(true);
    });

    it('no debe reutilizar si difieren sus routeConfig', () => {
      const future = { routeConfig: { path: 'parts' } } as unknown as ActivatedRouteSnapshot;
      const curr = { routeConfig: { path: 'designer' } } as unknown as ActivatedRouteSnapshot;
      expect(strategy.shouldReuseRoute(future, curr)).toBe(false);
    });
  });
});
