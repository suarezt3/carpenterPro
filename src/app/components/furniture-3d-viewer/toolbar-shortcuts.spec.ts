import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Part, PartGroup } from '../../models/melamine.models';
import { ContextMenuPositioningService } from '../../services/context-menu-positioning.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SceneRaycastPickerService } from '../../services/scene-raycast-picker.service';
import { Furniture3dViewerComponent } from './furniture-3d-viewer';

interface ViewerShortcutsTestInternals {
  initThree: () => void;
  camera: THREE.PerspectiveCamera;
  openTargetMap: Map<string, number>;
  nudgePart: (axis: 'x' | 'y' | 'z', delta: number) => void;
  findPairedDoorSiblingForPart: (doorPart: Part | null | undefined) => Part | null;
}

function createDoorPart(overrides: Partial<Part> & { id: string }): Part {
  const { id, ...rest } = overrides;
  return {
    id,
    name: 'Puerta Batiente',
    length: 716,
    width: 396,
    thickness: 18,
    quantity: 1,
    materialId: 'blanco-mate',
    materialName: 'Blanco Mate',
    grain: 'length',
    edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
    posX: 0,
    posY: 400,
    posZ: 280,
    orientation: 'vertical_xy',
    componentRole: 'door',
    hardwareConfig: { isMovable: true, movableType: 'door', openingDirection: 'left' },
    ...rest
  };
}

function createDrawerPart(overrides: Partial<Part> & { id: string }): Part {
  const { id, ...rest } = overrides;
  return {
    id,
    name: 'Frente Cajón',
    length: 180,
    width: 596,
    thickness: 18,
    quantity: 1,
    materialId: 'blanco-mate',
    materialName: 'Blanco Mate',
    grain: 'width',
    edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
    posX: 0,
    posY: 160,
    posZ: 280,
    orientation: 'vertical_xy',
    componentRole: 'drawer_front',
    hardwareConfig: { isMovable: true, movableType: 'drawer' },
    ...rest
  };
}

function createSidePart(overrides: Partial<Part> & { id: string }): Part {
  const { id, ...rest } = overrides;
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
    posX: -300,
    posY: 360,
    posZ: 0,
    orientation: 'vertical_yz',
    componentRole: 'side_left',
    ...rest
  };
}

function createKeyboardEvent(
  key: string,
  options: {
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    target?: HTMLElement;
  } = {}
): { event: KeyboardEvent; preventDefaultSpy: ReturnType<typeof vi.fn> } {
  const event = new KeyboardEvent('keydown', {
    key,
    code: options.code,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    bubbles: true,
    cancelable: true
  });
  if (options.target) {
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: options.target
    });
  }
  const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
  return { event, preventDefaultSpy };
}

describe('Furniture3dViewerComponent Toolbar Keycaps, 15 Shortcuts & Smart O Toggle', () => {
  let fixture: ComponentFixture<Furniture3dViewerComponent>;
  let component: Furniture3dViewerComponent;
  let internals: ViewerShortcutsTestInternals;
  let projectStorage: ProjectStorageService;

  beforeEach(() => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerShortcutsTestInternals,
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
    internals = component as unknown as ViewerShortcutsTestInternals;
    projectStorage = TestBed.inject(ProjectStorageService);
    internals.camera = new THREE.PerspectiveCamera(45, 1280 / 800, 1, 10000);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  describe('Left CAD toolbar micro-badges (.cad-key-badge)', () => {
    it('renders exactly the 15 CAD keycap badges inside .cad-toolbar without font-mono and leaves 60 FPS without badge', () => {
      const toolbar = fixture.nativeElement.querySelector('.cad-toolbar') as HTMLElement | null;
      expect(toolbar).not.toBeNull();

      const badges = Array.from(
        toolbar!.querySelectorAll('.cad-key-badge')
      ) as HTMLElement[];

      const labels = badges.map(el => el.textContent?.trim() ?? '');
      expect(labels).toEqual([
        'V', 'R', 'S', 'T', 'O', 'P', 'D', 'K', 'X', 'H', 'J', 'C', 'I', 'G', 'Z'
      ]);

      for (const badge of badges) {
        expect(badge.getAttribute('aria-hidden')).toBe('true');
        expect(badge.classList.contains('font-mono')).toBe(false);
      }

      const fpsBtn = Array.from(toolbar!.querySelectorAll('.cad-tool-btn')).find(btn =>
        (btn.getAttribute('title') || '').includes('60 FPS')
      );
      expect(fpsBtn).toBeDefined();
      expect(fpsBtn!.querySelector('.cad-key-badge')).toBeNull();
    });

    it('invokes toggleSmartDoorsAndDrawers() and updates active class on the O button', () => {
      const door = createDoorPart({ id: 'door-ui-1' });
      fixture.componentRef.setInput('parts', [door]);
      fixture.detectChanges();

      const smartOpenSpy = vi.spyOn(component, 'toggleSmartDoorsAndDrawers');
      const openBtn = Array.from(
        fixture.nativeElement.querySelectorAll('.cad-toolbar button.cad-tool-btn') as NodeListOf<HTMLButtonElement>
      ).find(btn => btn.querySelector('.cad-key-badge')?.textContent?.trim() === 'O') ?? null;
      expect(openBtn).not.toBeNull();
      expect(openBtn!.getAttribute('title')).toContain('[O]');

      expect(component.isSmartOpenActive()).toBe(false);
      openBtn!.click();
      fixture.detectChanges();

      expect(smartOpenSpy).toHaveBeenCalledTimes(1);
      expect(component.isSmartOpenActive()).toBe(true);
      expect(openBtn!.className).toContain('ring-1');
    });

    it('handles toolbar H button emission and respects manageHideInternally flag', () => {
      const side = createSidePart({ id: 'side-h-1' });
      fixture.componentRef.setInput('parts', [side]);
      fixture.componentRef.setInput('selectedPartId', 'side-h-1');
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.hideToggleRequested, 'emit');
      const hideBtn = Array.from(
        fixture.nativeElement.querySelectorAll('.cad-toolbar button.cad-tool-btn') as NodeListOf<HTMLButtonElement>
      ).find(btn => btn.querySelector('.cad-key-badge')?.textContent?.trim() === 'H') ?? null;
      expect(hideBtn).not.toBeNull();
      expect(hideBtn!.getAttribute('title')).toContain('[H]');

      // Default manageHideInternally = true: hides selected part internally + emits
      hideBtn!.click();
      fixture.detectChanges();
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(component.hiddenPartIds().has('side-h-1')).toBe(true);

      // Clicking again with no selection restores hidden parts
      fixture.componentRef.setInput('selectedPartId', null);
      fixture.detectChanges();
      hideBtn!.click();
      fixture.detectChanges();
      expect(emitSpy).toHaveBeenCalledTimes(2);
      expect(component.hiddenPartIds().size).toBe(0);

      // With manageHideInternally = false: only emits hideToggleRequested without internal mutation
      fixture.componentRef.setInput('manageHideInternally', false);
      fixture.componentRef.setInput('selectedPartId', 'side-h-1');
      fixture.detectChanges();
      hideBtn!.click();
      fixture.detectChanges();
      expect(emitSpy).toHaveBeenCalledTimes(3);
      expect(component.hiddenPartIds().size).toBe(0);
    });
  });

  describe('handleViewerKeyDown 15 shortcuts & input guards', () => {
    it('dispatches all 15 keyboard shortcuts and calls preventDefault', () => {
      const side = createSidePart({ id: 'part-sel' });
      fixture.componentRef.setInput('parts', [side]);
      fixture.componentRef.setInput('selectedPartId', 'part-sel');
      fixture.detectChanges();

      const setToolSpy = vi.spyOn(component, 'setActiveTool');
      const magnetSpy = vi.spyOn(component, 'toggleMagneticSnap');
      const smartOpenSpy = vi.spyOn(component, 'toggleSmartDoorsAndDrawers');
      const drillSpy = vi.spyOn(component, 'toggleDrillHoles');
      const dimsSpy = vi.spyOn(component, 'toggleDimensions');
      const clearSpy = vi.spyOn(component, 'toggleClearances');
      const xraySpy = vi.spyOn(component, 'toggleXRay');
      const hwSpy = vi.spyOn(component, 'toggleHardware');
      const flyoutSpy = vi.spyOn(component, 'toggleGroupsFlyout');
      const themeSpy = vi.spyOn(component, 'toggleTheme');
      const guideSpy = vi.spyOn(component, 'toggleReferenceGuide');
      const resetCamSpy = vi.spyOn(component, 'resetCamera');

      const directCases: { key: string; code?: string; assert: () => void }[] = [
        { key: 'v', assert: () => expect(setToolSpy).toHaveBeenLastCalledWith('select') },
        { key: ' ', code: 'Space', assert: () => expect(setToolSpy).toHaveBeenLastCalledWith('select') },
        { key: 's', assert: () => expect(magnetSpy).toHaveBeenCalledTimes(1) },
        { key: 't', assert: () => expect(setToolSpy).toHaveBeenLastCalledWith('measure') },
        { key: 'o', assert: () => expect(smartOpenSpy).toHaveBeenCalledTimes(1) },
        { key: 'p', assert: () => expect(drillSpy).toHaveBeenCalledTimes(1) },
        { key: 'd', assert: () => expect(dimsSpy).toHaveBeenCalledTimes(1) },
        { key: 'k', assert: () => expect(clearSpy).toHaveBeenCalledTimes(1) },
        { key: 'x', assert: () => expect(xraySpy).toHaveBeenCalledTimes(1) },
        { key: 'j', assert: () => expect(hwSpy).toHaveBeenCalledTimes(1) },
        { key: 'c', assert: () => expect(flyoutSpy).toHaveBeenCalledTimes(1) },
        { key: 'I', assert: () => expect(themeSpy).toHaveBeenCalledTimes(1) },
        { key: 'g', assert: () => expect(guideSpy).toHaveBeenCalledTimes(1) },
        { key: 'Z', assert: () => expect(resetCamSpy).toHaveBeenCalledTimes(1) }
      ];

      for (const testCase of directCases) {
        const { event, preventDefaultSpy } = createKeyboardEvent(testCase.key, {
          code: testCase.code
        });
        component.handleViewerKeyDown(event);
        expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
        testCase.assert();
      }

      // H with manageHideInternally = true hides selected part
      const { event: hHideEvt, preventDefaultSpy: hPrev } = createKeyboardEvent('h');
      component.handleViewerKeyDown(hHideEvt);
      expect(hPrev).toHaveBeenCalledTimes(1);
      expect(component.hiddenPartIds().has('part-sel')).toBe(true);

      // R with selection stays coordinated with ModuleDesigner (no rotate_90 tool switch)
      setToolSpy.mockClear();
      const { event: rWithSelEvt } = createKeyboardEvent('r');
      component.handleViewerKeyDown(rWithSelEvt);
      expect(setToolSpy).not.toHaveBeenCalled();

      // R with empty selection activates rotate_90 tool
      fixture.componentRef.setInput('selectedPartId', null);
      fixture.detectChanges();
      const { event: rEmptyEvt, preventDefaultSpy: rEmptyPrev } = createKeyboardEvent('r');
      component.handleViewerKeyDown(rEmptyEvt);
      expect(rEmptyPrev).toHaveBeenCalledTimes(1);
      expect(setToolSpy).toHaveBeenCalledWith('rotate_90');
    });

    it('replaces S vertical nudge with toggleMagneticSnap while preserving Alt+ArrowDown and PageDown nudge', () => {
      const side = createSidePart({ id: 'nudge-part' });
      fixture.componentRef.setInput('parts', [side]);
      fixture.componentRef.setInput('selectedPartId', 'nudge-part');
      fixture.detectChanges();

      const magnetSpy = vi.spyOn(component, 'toggleMagneticSnap');
      const nudgeSpy = vi.spyOn(internals, 'nudgePart');

      const { event: sEvt } = createKeyboardEvent('S');
      component.handleViewerKeyDown(sEvt);
      expect(magnetSpy).toHaveBeenCalledTimes(1);
      expect(nudgeSpy).not.toHaveBeenCalled();

      const { event: altDownEvt } = createKeyboardEvent('ArrowDown', { altKey: true });
      component.handleViewerKeyDown(altDownEvt);
      expect(nudgeSpy).toHaveBeenCalledWith('y', -component.nudgeStep());

      const { event: pageDownEvt } = createKeyboardEvent('PageDown');
      component.handleViewerKeyDown(pageDownEvt);
      expect(nudgeSpy).toHaveBeenCalledWith('y', -component.nudgeStep());
    });

    it('ignores H shortcut when manageHideInternally is false to avoid double execution with ModuleDesigner', () => {
      const side = createSidePart({ id: 'side-ext' });
      fixture.componentRef.setInput('parts', [side]);
      fixture.componentRef.setInput('selectedPartId', 'side-ext');
      fixture.componentRef.setInput('manageHideInternally', false);
      fixture.detectChanges();

      const hideSpy = vi.spyOn(component, 'hidePartsByIds');
      const showSpy = vi.spyOn(component, 'showAllParts');
      const { event } = createKeyboardEvent('h');
      component.handleViewerKeyDown(event);

      expect(hideSpy).not.toHaveBeenCalled();
      expect(showSpy).not.toHaveBeenCalled();
      expect(component.hiddenPartIds().size).toBe(0);
    });

    it('ignores single-letter shortcuts when Ctrl, Meta, or Alt modifier is pressed', () => {
      const resetCamSpy = vi.spyOn(component, 'resetCamera');
      const flyoutSpy = vi.spyOn(component, 'toggleGroupsFlyout');
      const magnetSpy = vi.spyOn(component, 'toggleMagneticSnap');
      const smartOpenSpy = vi.spyOn(component, 'toggleSmartDoorsAndDrawers');

      component.handleViewerKeyDown(createKeyboardEvent('z', { ctrlKey: true }).event);
      component.handleViewerKeyDown(createKeyboardEvent('c', { ctrlKey: true }).event);
      component.handleViewerKeyDown(createKeyboardEvent('s', { ctrlKey: true }).event);
      component.handleViewerKeyDown(createKeyboardEvent('o', { metaKey: true }).event);
      component.handleViewerKeyDown(createKeyboardEvent('z', { altKey: true }).event);

      expect(resetCamSpy).not.toHaveBeenCalled();
      expect(flyoutSpy).not.toHaveBeenCalled();
      expect(magnetSpy).not.toHaveBeenCalled();
      expect(smartOpenSpy).not.toHaveBeenCalled();
    });

    it('ignores shortcuts when target is INPUT, TEXTAREA, SELECT, or contentEditable', () => {
      const setToolSpy = vi.spyOn(component, 'setActiveTool');
      const smartOpenSpy = vi.spyOn(component, 'toggleSmartDoorsAndDrawers');
      const magnetSpy = vi.spyOn(component, 'toggleMagneticSnap');
      const resetCamSpy = vi.spyOn(component, 'resetCamera');

      const inputEl = document.createElement('input');
      const textareaEl = document.createElement('textarea');
      const selectEl = document.createElement('select');
      const editableEl = document.createElement('div');
      editableEl.setAttribute('contenteditable', 'true');

      component.handleViewerKeyDown(createKeyboardEvent('v', { target: inputEl }).event);
      component.handleViewerKeyDown(createKeyboardEvent('o', { target: textareaEl }).event);
      component.handleViewerKeyDown(createKeyboardEvent('s', { target: selectEl }).event);
      component.handleViewerKeyDown(createKeyboardEvent('z', { target: editableEl }).event);

      expect(setToolSpy).not.toHaveBeenCalled();
      expect(smartOpenSpy).not.toHaveBeenCalled();
      expect(magnetSpy).not.toHaveBeenCalled();
      expect(resetCamSpy).not.toHaveBeenCalled();
    });
  });

  describe('Smart [O] toggleSmartDoorsAndDrawers() scoping', () => {
    it('Rule 1a: toggles only the selected single door and leaves other doors & drawers untouched', () => {
      const doorUpper = createDoorPart({
        id: 'door-upper',
        name: 'Puerta Superior',
        groupId: 'mod-1',
        posX: 0,
        posY: 1100
      });
      const doorLower = createDoorPart({
        id: 'door-lower',
        name: 'Puerta Inferior',
        groupId: 'mod-1',
        posX: 0,
        posY: 320
      });
      const doorOtherModule = createDoorPart({
        id: 'door-mod-2',
        name: 'Puerta Modulo 2',
        groupId: 'mod-2',
        posX: 900,
        posY: 400
      });
      const groupM1: PartGroup = { id: 'mod-1', name: 'Módulo 1', type: 'assembly' };
      const groupM2: PartGroup = { id: 'mod-2', name: 'Módulo 2', type: 'assembly' };

      fixture.componentRef.setInput('parts', [doorUpper, doorLower, doorOtherModule]);
      fixture.componentRef.setInput('partGroups', [groupM1, groupM2]);
      fixture.componentRef.setInput('selectedPartId', 'door-upper');
      fixture.detectChanges();

      component.toggleSmartDoorsAndDrawers();
      expect(internals.openTargetMap.get('door-upper')).toBe(1);
      expect(internals.openTargetMap.get('door-lower')).toBeUndefined();
      expect(internals.openTargetMap.get('door-mod-2')).toBeUndefined();
      expect(component.isSmartOpenActive()).toBe(true);

      // Selecting closed door reflects inactive state and toggles only itself
      fixture.componentRef.setInput('selectedPartId', 'door-mod-2');
      fixture.detectChanges();
      expect(component.isSmartOpenActive()).toBe(false);

      component.toggleSmartDoorsAndDrawers();
      expect(internals.openTargetMap.get('door-mod-2')).toBe(1);
      expect(internals.openTargetMap.get('door-upper')).toBe(1);
      expect(internals.openTargetMap.get('door-lower')).toBeUndefined();
    });

    it('Rule 1b: toggles paired double-door sibling via togglePartOpen without touching cabinet drawers', () => {
      const doorLeft = createDoorPart({
        id: 'door-pair-l',
        name: 'Puerta Izquierda',
        groupId: 'mod-double',
        posX: -199,
        posY: 400,
        posZ: 280,
        hardwareConfig: { isMovable: true, movableType: 'door', openingDirection: 'left' }
      });
      const doorRight = createDoorPart({
        id: 'door-pair-r',
        name: 'Puerta Derecha',
        groupId: 'mod-double',
        posX: 199,
        posY: 400,
        posZ: 280,
        hardwareConfig: { isMovable: true, movableType: 'door', openingDirection: 'right' }
      });
      const drawer = createDrawerPart({
        id: 'drawer-bottom',
        groupId: 'mod-double',
        posY: 120
      });
      const groupDouble: PartGroup = { id: 'mod-double', name: 'Módulo Doble', type: 'assembly' };

      vi.spyOn(internals, 'findPairedDoorSiblingForPart').mockImplementation(part =>
        part?.id === 'door-pair-l' ? doorRight : null
      );

      fixture.componentRef.setInput('parts', [doorLeft, doorRight, drawer]);
      fixture.componentRef.setInput('partGroups', [groupDouble]);
      fixture.componentRef.setInput('selectedPartId', 'door-pair-l');
      fixture.detectChanges();

      component.handleViewerKeyDown(createKeyboardEvent('o').event);

      expect(internals.openTargetMap.get('door-pair-l')).toBe(1);
      expect(internals.openTargetMap.get('door-pair-r')).toBe(1);
      expect(internals.openTargetMap.get('drawer-bottom')).toBeUndefined();
    });

    it('Rule 1c: toggles only the selected modular drawer subgroup and updates store slideExtension', () => {
      const modGroup: PartGroup = { id: 'mod-host', name: 'Mueble Base', type: 'assembly' };
      const drawerGroup: PartGroup = {
        id: 'drawer-grp-1',
        name: 'Cajón Modular 1',
        type: 'drawer',
        hostGroupId: 'mod-host',
        slideExtension: 0
      };
      const cabinetDoor = createDoorPart({ id: 'host-door', groupId: 'mod-host' });
      const drawerFront = createDrawerPart({ id: 'd1-front', groupId: 'drawer-grp-1' });
      const drawerSide = createDrawerPart({
        id: 'd1-side',
        name: 'Lateral Cajón',
        componentRole: 'drawer_lateral',
        groupId: 'drawer-grp-1'
      });

      const storeSlideSpy = vi.spyOn(projectStorage, 'setGroupSlideExtension').mockImplementation(() => undefined);

      fixture.componentRef.setInput('parts', [cabinetDoor, drawerFront, drawerSide]);
      fixture.componentRef.setInput('partGroups', [modGroup, drawerGroup]);
      fixture.componentRef.setInput('selectedPartIds', ['d1-front', 'd1-side']);
      fixture.detectChanges();

      component.handleViewerKeyDown(createKeyboardEvent('o').event);

      expect(internals.openTargetMap.get('d1-front')).toBe(1);
      expect(internals.openTargetMap.get('d1-side')).toBe(1);
      expect(internals.openTargetMap.get('host-door')).toBeUndefined();
      expect(storeSlideSpy).toHaveBeenCalledWith('drawer-grp-1', 1);
      expect(component.isSmartOpenActive()).toBe(true);

      // Second press closes that drawer group
      component.handleViewerKeyDown(createKeyboardEvent('O').event);
      expect(internals.openTargetMap.get('d1-front')).toBe(0);
      expect(internals.openTargetMap.get('d1-side')).toBe(0);
      expect(storeSlideSpy).toHaveBeenCalledWith('drawer-grp-1', 0);
      expect(component.isSmartOpenActive()).toBe(false);
    });

    it('Rule 2: coherently closes all doors & hosted drawers of a selected full module if any is open, then opens all', () => {
      const mod1: PartGroup = { id: 'mod-1', name: 'Mueble Principal', type: 'assembly' };
      const hostedDrawer: PartGroup = {
        id: 'hosted-drw-1',
        name: 'Cajón Encajado',
        type: 'drawer',
        hostGroupId: 'mod-1',
        slideExtension: 0
      };
      const mod2: PartGroup = { id: 'mod-2', name: 'Mueble Secundario', type: 'assembly' };

      const m1Side = createSidePart({ id: 'm1-side', groupId: 'mod-1' });
      const m1DoorA = createDoorPart({ id: 'm1-door-a', groupId: 'mod-1', posY: 600 });
      const m1DoorB = createDoorPart({ id: 'm1-door-b', groupId: 'mod-1', posY: 200 });
      const m1DrawerFront = createDrawerPart({ id: 'm1-drw-front', groupId: 'hosted-drw-1' });
      const m2Door = createDoorPart({ id: 'm2-door', groupId: 'mod-2', posX: 950 });

      const storeSlideSpy = vi.spyOn(projectStorage, 'setGroupSlideExtension').mockImplementation(() => undefined);

      fixture.componentRef.setInput('parts', [m1Side, m1DoorA, m1DoorB, m1DrawerFront, m2Door]);
      fixture.componentRef.setInput('partGroups', [mod1, hostedDrawer, mod2]);
      // Pre-open only m1DoorA so module is partially open
      internals.openTargetMap.set('m1-door-a', 1);
      fixture.componentRef.setInput('selectedPartIds', ['m1-side', 'm1-door-a', 'm1-door-b']);
      fixture.detectChanges();

      expect(component.currentSelectedGroup()?.id).toBe('mod-1');
      expect(component.isSmartOpenActive()).toBe(true);

      // 1st O: any part in mod-1 is open -> closes all doors & hosted drawers of mod-1
      component.handleViewerKeyDown(createKeyboardEvent('o').event);
      expect(internals.openTargetMap.get('m1-door-a')).toBe(0);
      expect(internals.openTargetMap.get('m1-door-b')).toBe(0);
      expect(internals.openTargetMap.get('m1-drw-front')).toBe(0);
      expect(internals.openTargetMap.get('m2-door')).toBeUndefined();
      expect(storeSlideSpy).toHaveBeenCalledWith('hosted-drw-1', 0);
      expect(component.isSmartOpenActive()).toBe(false);

      // 2nd O: all closed in mod-1 -> opens all doors & hosted drawers of mod-1
      component.handleViewerKeyDown(createKeyboardEvent('o').event);
      expect(internals.openTargetMap.get('m1-door-a')).toBe(1);
      expect(internals.openTargetMap.get('m1-door-b')).toBe(1);
      expect(internals.openTargetMap.get('m1-drw-front')).toBe(1);
      expect(internals.openTargetMap.get('m2-door')).toBeUndefined();
      expect(storeSlideSpy).toHaveBeenCalledWith('hosted-drw-1', 1);
      expect(component.isSmartOpenActive()).toBe(true);
    });

    it('Rule 3: toggles all doors and drawers across the scene globally when nothing is selected', () => {
      const d1 = createDoorPart({ id: 'global-d1', groupId: 'g1' });
      const d2 = createDrawerPart({ id: 'global-drw2', groupId: 'g2' });
      const side = createSidePart({ id: 'global-side', groupId: 'g1' });

      fixture.componentRef.setInput('parts', [side, d1, d2]);
      fixture.componentRef.setInput('selectedPartId', null);
      fixture.componentRef.setInput('selectedPartIds', []);
      fixture.detectChanges();

      const globalToggleSpy = vi.spyOn(component, 'toggleAllDoorsAndDrawers');

      component.handleViewerKeyDown(createKeyboardEvent('o').event);
      expect(globalToggleSpy).toHaveBeenCalledTimes(1);
      expect(component.isAllOpen()).toBe(true);
      expect(component.isSmartOpenActive()).toBe(true);
      expect(internals.openTargetMap.get('global-d1')).toBe(1);
      expect(internals.openTargetMap.get('global-drw2')).toBe(1);
      expect(internals.openTargetMap.get('global-side')).toBeUndefined();

      component.handleViewerKeyDown(createKeyboardEvent('o').event);
      expect(globalToggleSpy).toHaveBeenCalledTimes(2);
      expect(component.isAllOpen()).toBe(false);
      expect(component.isSmartOpenActive()).toBe(false);
      expect(internals.openTargetMap.get('global-d1')).toBe(0);
      expect(internals.openTargetMap.get('global-drw2')).toBe(0);
    });
  });
});
