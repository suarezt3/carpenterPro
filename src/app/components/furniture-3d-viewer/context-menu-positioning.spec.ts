import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Part } from '../../models/melamine.models';
import {
  ContextMenuPositioningService,
  DEFAULT_CONTEXT_MENU_HEIGHT_PX,
  SAFE_VIEWPORT_BOTTOM_MARGIN_PX,
  SAFE_VIEWPORT_LEFT_PX,
  SAFE_VIEWPORT_RIGHT_MARGIN_PX,
  SAFE_VIEWPORT_TOP_PX,
  SubmenuPlacement
} from '../../services/context-menu-positioning.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ScenePickResult, SceneRaycastPickerService } from '../../services/scene-raycast-picker.service';
import { Furniture3dViewerComponent } from './furniture-3d-viewer';

interface ViewerTestInternals {
  initThree: () => void;
  camera: THREE.PerspectiveCamera;
  rightPointerDownTime: number;
  rightPointerDragged: boolean;
  containerRef: () => ElementRef<HTMLElement> | undefined;
  canvasRef: () => ElementRef<HTMLCanvasElement> | undefined;
  contextMenuPanelRef: () => ElementRef<HTMLElement> | undefined;
  contextMenuBodyRef: () => ElementRef<HTMLElement> | undefined;
  contextMenuSubmenuFlip: () => SubmenuPlacement;
  contextMenuMaxHeightPx: () => number | null;
}

function createDomRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}

function createMouseEvent(clientX: number, clientY: number): MouseEvent {
  return new MouseEvent('contextmenu', {
    clientX,
    clientY,
    button: 2,
    bubbles: true,
    cancelable: true
  });
}

function createSamplePart(id = 'part-side-1'): Part {
  return {
    id,
    name: 'Lateral Izquierdo',
    length: 720,
    width: 560,
    thickness: 18,
    quantity: 1,
    materialId: 'blanco-mate',
    materialName: 'Blanco Mate',
    grain: 'length',
    edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'none' },
    posX: 0,
    posY: 360,
    posZ: 0,
    orientation: 'vertical_yz',
    componentRole: 'side_left'
  };
}

describe('Furniture3dViewerComponent Context Menu Smart Positioning', () => {
  let fixture: ComponentFixture<Furniture3dViewerComponent>;
  let component: Furniture3dViewerComponent;
  let internals: ViewerTestInternals;
  let raycastPicker: SceneRaycastPickerService;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let rafQueue: { id: number; callback: FrameRequestCallback }[];
  let nextRafId: number;
  let cancelRafSpy: ReturnType<typeof vi.spyOn>;

  const setViewportSize = (width: number, height: number): void => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: height
    });

    const containerEl = internals.containerRef()?.nativeElement;
    const canvasEl = internals.canvasRef()?.nativeElement;
    if (containerEl) {
      vi.spyOn(containerEl, 'getBoundingClientRect').mockReturnValue(
        createDomRect(0, 0, width, height)
      );
    }
    if (canvasEl) {
      vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(
        createDomRect(0, 0, width, height)
      );
    }
  };

  const mockMenuPanelRect = (width: number, height: number): HTMLElement => {
    const panelEl = fixture.nativeElement.querySelector('.cad-context-menu') as HTMLElement | null;
    expect(panelEl).not.toBeNull();
    const currentPos = component.contextMenuPos() ?? { x: 0, y: 0 };
    vi.spyOn(panelEl as HTMLElement, 'getBoundingClientRect').mockImplementation(() => {
      const latestPos = component.contextMenuPos() ?? currentPos;
      return createDomRect(latestPos.x, latestPos.y, width, height);
    });
    return panelEl as HTMLElement;
  };

  const flushNextRaf = (): void => {
    const pending = [...rafQueue];
    rafQueue = [];
    for (const item of pending) {
      item.callback(performance.now());
    }
    fixture.detectChanges();
  };

  const mockRaycastPartHit = (part: Part): void => {
    const meshObj = new THREE.Object3D();
    const result: ScenePickResult = {
      closest: {
        kind: 'piece',
        distance: 120,
        object: meshObj,
        intersection: {
          distance: 120,
          point: new THREE.Vector3(),
          object: meshObj
        },
        part
      },
      candidates: []
    };
    vi.spyOn(raycastPicker, 'pickClosestSceneCandidate').mockReturnValue(result);
  };

  const mockRaycastEmptyHit = (): void => {
    vi.spyOn(raycastPicker, 'pickClosestSceneCandidate').mockReturnValue({
      closest: null,
      candidates: []
    });
  };

  const triggerRightClick = (clientX: number, clientY: number): void => {
    internals.rightPointerDownTime = Date.now();
    internals.rightPointerDragged = false;
    component.onContextMenu(createMouseEvent(clientX, clientY));
    fixture.detectChanges();
  };

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    rafQueue = [];
    nextRafId = 1;

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback): number => {
        const id = nextRafId++;
        rafQueue.push({ id, callback: cb });
        return id;
      }
    );
    cancelRafSpy = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation((id: number): void => {
        rafQueue = rafQueue.filter(entry => entry.id !== id);
      });

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerTestInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [
        ProjectStorageService,
        JoineryEngineService,
        PartGeometryService,
        SceneRaycastPickerService,
        ContextMenuPositioningService
      ]
    });

    fixture = TestBed.createComponent(Furniture3dViewerComponent);
    component = fixture.componentInstance;
    internals = component as unknown as ViewerTestInternals;
    raycastPicker = TestBed.inject(SceneRaycastPickerService);

    internals.camera = new THREE.PerspectiveCamera(45, 1280 / 800, 1, 10000);
    internals.camera.position.set(0, 600, 2200);
    internals.camera.lookAt(0, 400, 0);
    internals.camera.updateMatrixWorld(true);

    fixture.detectChanges();
    setViewportSize(1280, 800);
    // Clear any initial render animation frame entries queued by Angular afterNextRender
    rafQueue = [];
  });

  afterEach(() => {
    document.querySelectorAll('[data-right-inspector]').forEach(el => el.remove());
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: originalInnerHeight
    });
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('hace flip hacia arriba al hacer clic derecho cerca del borde inferior y mantiene visible Eliminar Pieza dentro del área segura', () => {
    const part = createSamplePart('part-bottom-test');
    fixture.componentRef.setInput('parts', [part]);
    fixture.detectChanges();
    mockRaycastPartHit(part);

    const safeBottom = 800 - SAFE_VIEWPORT_BOTTOM_MARGIN_PX; // 708px
    triggerRightClick(420, 765);

    const initialPos = component.contextMenuPos();
    expect(initialPos).not.toBeNull();
    expect(initialPos!.y).toBeGreaterThanOrEqual(SAFE_VIEWPORT_TOP_PX);
    expect(initialPos!.y + DEFAULT_CONTEXT_MENU_HEIGHT_PX).toBeLessThanOrEqual(safeBottom);

    const panelHeight = 410;
    const panelEl = mockMenuPanelRect(288, panelHeight);
    flushNextRaf();

    const refinedPos = component.contextMenuPos();
    expect(refinedPos).not.toBeNull();
    expect(refinedPos!.y).toBeGreaterThanOrEqual(SAFE_VIEWPORT_TOP_PX);
    expect(refinedPos!.y + panelHeight).toBeLessThanOrEqual(safeBottom);
    expect(panelEl.style.top).toBe(`${refinedPos!.y}px`);
    expect(panelEl.style.left).toBe(`${refinedPos!.x}px`);

    const headerEl = panelEl.querySelector(':scope > .shrink-0');
    const bodyEl = panelEl.querySelector(':scope > .cad-context-menu-body');
    expect(headerEl).not.toBeNull();
    expect(bodyEl).not.toBeNull();

    const deleteBtn = Array.from(bodyEl!.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Eliminar Pieza')
    );
    expect(deleteBtn).toBeDefined();
  });

  it('hace flip horizontal y vertical al hacer clic en la esquina inferior derecha y marca data-submenu-align-left/up', () => {
    const part = createSamplePart('part-corner-br');
    fixture.componentRef.setInput('parts', [part]);
    fixture.detectChanges();
    mockRaycastPartHit(part);

    const safeBottom = 800 - SAFE_VIEWPORT_BOTTOM_MARGIN_PX; // 708px
    const safeRight = 1280 - SAFE_VIEWPORT_RIGHT_MARGIN_PX; // 1264px

    triggerRightClick(1225, 775);

    const menuWidth = 288;
    const menuHeight = 380;
    const panelEl = mockMenuPanelRect(menuWidth, menuHeight);
    flushNextRaf();

    const pos = component.contextMenuPos();
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeGreaterThanOrEqual(SAFE_VIEWPORT_LEFT_PX);
    expect(pos!.x + menuWidth).toBeLessThanOrEqual(safeRight);
    expect(pos!.y).toBeGreaterThanOrEqual(SAFE_VIEWPORT_TOP_PX);
    expect(pos!.y + menuHeight).toBeLessThanOrEqual(safeBottom);

    component.toggleRotateSubmenu();
    fixture.detectChanges();
    flushNextRaf();

    const flipState = component.contextMenuSubmenuFlip();
    expect(flipState.openLeft).toBe(true);
    expect(flipState.openUp).toBe(true);

    const submenuContainer = panelEl.querySelector('[data-submenu-align-left]');
    expect(submenuContainer).not.toBeNull();
    expect(submenuContainer?.getAttribute('data-submenu-align-left')).toBe('true');
    expect(submenuContainer?.getAttribute('data-submenu-align-up')).toBe('true');
  });

  it('sujeta la posición al área segura superior izquierda al hacer clic en coordenadas extremas top-left', () => {
    const part = createSamplePart('part-corner-tl');
    fixture.componentRef.setInput('parts', [part]);
    fixture.detectChanges();
    mockRaycastPartHit(part);

    triggerRightClick(8, 12);
    mockMenuPanelRect(288, 360);
    flushNextRaf();

    const pos = component.contextMenuPos();
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeGreaterThanOrEqual(SAFE_VIEWPORT_LEFT_PX);
    expect(pos!.y).toBeGreaterThanOrEqual(SAFE_VIEWPORT_TOP_PX);
  });

  it('mantiene el menú de espacio vacío (Escenario) por encima de safeBottom al hacer clic derecho cerca del fondo', () => {
    mockRaycastEmptyHit();

    const safeBottom = 800 - SAFE_VIEWPORT_BOTTOM_MARGIN_PX; // 708px
    triggerRightClick(520, 760);

    expect(component.contextMenuPart()).toBeNull();
    expect(component.contextMenuAppliance()).toBeNull();

    const workspaceMenuHeight = 290;
    const panelEl = mockMenuPanelRect(288, workspaceMenuHeight);
    flushNextRaf();

    const pos = component.contextMenuPos();
    expect(pos).not.toBeNull();
    expect(pos!.y).toBeGreaterThanOrEqual(SAFE_VIEWPORT_TOP_PX);
    expect(pos!.y + workspaceMenuHeight).toBeLessThanOrEqual(safeBottom);

    const headerEl = panelEl.querySelector(':scope > .shrink-0');
    const bodyEl = panelEl.querySelector(':scope > .cad-context-menu-body');
    expect(headerEl?.textContent).toContain('Espacio de Trabajo 3D');
    expect(headerEl?.textContent).toContain('Escenario');
    expect(bodyEl).not.toBeNull();
  });

  it('reposiciona el menú al expandir un submenú cerca del fondo, respeta el inspector derecho/resize y cancela rAF al cerrar', () => {
    const part = createSamplePart('part-submenu-reposition');
    fixture.componentRef.setInput('parts', [part]);
    fixture.detectChanges();
    mockRaycastPartHit(part);

    const safeBottom = 800 - SAFE_VIEWPORT_BOTTOM_MARGIN_PX; // 708px
    // Clic en Y=400: colapsado (270px) cabe debajo (400 + 270 = 670 <= 708)
    triggerRightClick(600, 400);

    let dynamicHeight = 270;
    const panelEl = fixture.nativeElement.querySelector('.cad-context-menu') as HTMLElement;
    vi.spyOn(panelEl, 'getBoundingClientRect').mockImplementation(() => {
      const latestPos = component.contextMenuPos() ?? { x: 0, y: 0 };
      return createDomRect(latestPos.x, latestPos.y, 288, dynamicHeight);
    });

    flushNextRaf();
    expect(component.contextMenuPos()!.y).toBe(400);

    // Expandir Cambiar Material hace crecer el menú a 480px -> debe reposicionar hacia arriba sin cruzar 708px
    const materialBtn = Array.from(panelEl.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Cambiar Material de la Pieza')
    );
    expect(materialBtn).toBeDefined();
    dynamicHeight = 480;
    materialBtn!.click();
    fixture.detectChanges();
    flushNextRaf();

    const posAfterMaterial = component.contextMenuPos();
    expect(posAfterMaterial).not.toBeNull();
    expect(posAfterMaterial!.y).toBeLessThan(400);
    expect(posAfterMaterial!.y + dynamicHeight).toBeLessThanOrEqual(safeBottom);
    expect(panelEl.querySelector(':scope > .shrink-0')).not.toBeNull();
    expect(panelEl.querySelector(':scope > .cad-context-menu-body')).not.toBeNull();
    expect(
      panelEl.querySelector(':scope > .cad-context-menu-body [data-submenu-align-left]')
    ).not.toBeNull();

    // Inspector derecho abierto + resize de ventana reubica hacia la izquierda del panel derecho
    const rightInspector = document.createElement('aside');
    rightInspector.setAttribute('data-right-inspector', 'true');
    Object.defineProperty(rightInspector, 'getBoundingClientRect', {
      value: () => createDomRect(820, 64, 340, 700)
    });
    document.body.appendChild(rightInspector);

    setViewportSize(1160, 740);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    // Queda una rAF pendiente antes de flushNextRaf; cerrar debe cancelarla limpiamente
    expect(component.contextMenuPos()!.x + 288).toBeLessThanOrEqual(820 - 12);
    expect(rafQueue.length).toBeGreaterThan(0);

    component.closeContextMenu();
    fixture.detectChanges();
    expect(cancelRafSpy).toHaveBeenCalled();
    expect(component.contextMenuPos()).toBeNull();
    expect(fixture.nativeElement.querySelector('.cad-context-menu')).toBeNull();
  });
});
