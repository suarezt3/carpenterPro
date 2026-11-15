import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { Material, Part } from '../../models/melamine.models';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ModuleDesignerComponent } from './module-designer';

describe('Inspector UI Swatches, Collapsible Cards & [H]/[O] Integration', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let projectService: ProjectStorageService;

  const createPart = (overrides: Partial<Part> = {}): Part => {
    const id = overrides.id || 'part_' + crypto.randomUUID().slice(0, 8);
    const defaultMatId = component.melamineBoardMaterials()[0]?.id || 'mat_white_15';
    const defaultMatName = component.melamineBoardMaterials()[0]?.name || 'Blanco Estándar';
    return {
      id,
      name: 'Pieza Test',
      length: 600,
      width: 450,
      thickness: 18,
      quantity: 1,
      materialId: defaultMatId,
      materialName: defaultMatName,
      grain: 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 400,
      posZ: 0,
      orientation: 'horizontal',
      componentRole: 'shelf',
      ...overrides
    };
  };

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as { initThree: () => void },
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [
        provideRouter([]),
        ProjectStorageService
      ]
    }).compileComponents();

    projectService = TestBed.inject(ProjectStorageService);
    fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('1. Selector Personalizado de Materiales (Módulo y Pieza) con Muestras de Color', () => {
    it('toggleModuleMaterialDropdown() alterna apertura y renderiza opciones con [style.background-color]', () => {
      const mats = component.melamineBoardMaterials();
      expect(mats.length).toBeGreaterThanOrEqual(2);
      const firstMat = mats[0];

      const side = createPart({
        id: 'mod_side_1',
        name: 'Lateral Izquierdo',
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        materialId: firstMat.id,
        materialName: firstMat.name
      });
      const door = createPart({
        id: 'mod_door_1',
        name: 'Puerta Frontal',
        componentRole: 'door',
        orientation: 'vertical_xy',
        materialId: firstMat.id,
        materialName: firstMat.name
      });
      projectService.addPart(side);
      projectService.addPart(door);

      const group = projectService.createGroup('Módulo Cocina', [side.id, door.id], 'assembly');
      component.isPartMaterialDropdownOpen.set(true);
      component.selectEntireGroup(group.id);
      fixture.detectChanges();

      expect(component.isModuleMaterialDropdownOpen()).toBe(false);
      component.toggleModuleMaterialDropdown();
      fixture.detectChanges();

      expect(component.isModuleMaterialDropdownOpen()).toBe(true);
      expect(component.isPartMaterialDropdownOpen()).toBe(false);

      const host = fixture.nativeElement as HTMLElement;
      const listbox = host.querySelector('[role="listbox"]');
      expect(listbox).not.toBeNull();

      const options = Array.from(host.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
      expect(options.length).toBe(component.filteredMaterials().length);

      const firstOptionSwatch = options[0].querySelector('span.w-5.h-5') as HTMLElement | null;
      expect(firstOptionSwatch).not.toBeNull();
      expect(firstOptionSwatch?.style.backgroundColor).toBeTruthy();

      const triggerSwatch = host.querySelector(
        'button[aria-label="Seleccionar material del módulo"] span.w-6.h-6'
      ) as HTMLElement | null;
      expect(triggerSwatch).not.toBeNull();
      expect(triggerSwatch?.style.backgroundColor).toBeTruthy();
    });

    it('selectModuleMaterial() actualiza el material del grupo y cierra el dropdown', () => {
      const mats = component.melamineBoardMaterials();
      expect(mats.length).toBeGreaterThanOrEqual(2);
      const initialMat: Material = mats[0];
      const targetMat: Material = mats[1];

      const p1 = createPart({
        id: 'm_p1',
        name: 'Lateral',
        componentRole: 'side_left',
        materialId: initialMat.id,
        materialName: initialMat.name
      });
      const p2 = createPart({
        id: 'm_p2',
        name: 'Techo',
        componentRole: 'top',
        materialId: initialMat.id,
        materialName: initialMat.name
      });
      projectService.addPart(p1);
      projectService.addPart(p2);

      const group = projectService.createGroup('Módulo Base', [p1.id, p2.id], 'assembly');
      component.selectEntireGroup(group.id);
      component.toggleModuleMaterialDropdown();
      expect(component.isModuleMaterialDropdownOpen()).toBe(true);

      component.selectModuleMaterial(targetMat.id);
      fixture.detectChanges();

      expect(component.isModuleMaterialDropdownOpen()).toBe(false);
      const updatedParts = component.currentParts().filter(pt => pt.groupId === group.id);
      expect(updatedParts.every(pt => pt.materialId === targetMat.id)).toBe(true);
    });

    it('togglePartMaterialDropdown() y selectPartMaterial() actualizan pieza individual y muestran swatches', () => {
      const mats = component.melamineBoardMaterials();
      expect(mats.length).toBeGreaterThanOrEqual(2);
      const initialMat = mats[0];
      const targetMat = mats[1];

      const part = createPart({
        id: 'single_part_1',
        name: 'Repisa Central',
        componentRole: 'shelf',
        materialId: initialMat.id,
        materialName: initialMat.name,
        colorHex: initialMat.colorHex
      });
      projectService.addPart(part);
      component.selectedPartIds.set([part.id]);
      component.selectedPartId.set(part.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      component.togglePartMaterialDropdown();
      fixture.detectChanges();

      expect(component.isPartMaterialDropdownOpen()).toBe(true);
      expect(component.isModuleMaterialDropdownOpen()).toBe(false);

      const host = fixture.nativeElement as HTMLElement;
      const listbox = host.querySelector('[role="listbox"]');
      expect(listbox).not.toBeNull();

      const options = Array.from(host.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
      expect(options.length).toBe(component.filteredMaterials().length);

      const swatchEl = options[1].querySelector('span.w-5.h-5') as HTMLElement | null;
      expect(swatchEl).not.toBeNull();
      expect(swatchEl?.style.backgroundColor).toBeTruthy();

      component.selectPartMaterial(targetMat.id);
      fixture.detectChanges();

      expect(component.isPartMaterialDropdownOpen()).toBe(false);
      expect(component.selectedPart()?.materialId).toBe(targetMat.id);
    });

    it('selectPartMaterial() también soporta materiales de mesón cuando isSelectedPartCountertop() es true', () => {
      const ctMats = component.countertopMaterials();
      expect(ctMats.length).toBeGreaterThanOrEqual(2);
      const initialCt = ctMats[0];
      const targetCt = ctMats[1];

      const ctPart = createPart({
        id: 'ct_part_1',
        name: 'Mesón Principal',
        componentRole: 'countertop',
        thickness: 30,
        materialId: initialCt.id,
        materialName: initialCt.name,
        colorHex: initialCt.colorHex
      });
      projectService.addPart(ctPart);
      component.selectedPartIds.set([ctPart.id]);
      component.selectedPartId.set(ctPart.id);
      fixture.detectChanges();

      component.togglePartMaterialDropdown();
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      const options = Array.from(host.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
      expect(options.length).toBe(component.filteredCountertopMaterials().length);

      component.selectPartMaterial(targetCt.id);
      fixture.detectChanges();

      expect(component.isPartMaterialDropdownOpen()).toBe(false);
      expect(component.selectedPart()?.materialId).toBe(targetCt.id);
    });

    it('cierra los dropdowns de materiales con Escape y clic fuera del contenedor', () => {
      const part = createPart({ id: 'close_part_1', name: 'Tapa' });
      projectService.addPart(part);
      component.selectedPartIds.set([part.id]);
      component.selectedPartId.set(part.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      component.togglePartMaterialDropdown();
      fixture.detectChanges();
      expect(component.isPartMaterialDropdownOpen()).toBe(true);

      const host = fixture.nativeElement as HTMLElement;
      const listbox = host.querySelector('.md-material-dropdown-container [role="listbox"]') as HTMLElement | null;
      expect(listbox).not.toBeNull();
      listbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(component.isPartMaterialDropdownOpen()).toBe(true);

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(component.isPartMaterialDropdownOpen()).toBe(false);

      component.togglePartMaterialDropdown();
      fixture.detectChanges();
      expect(component.isPartMaterialDropdownOpen()).toBe(true);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(component.isPartMaterialDropdownOpen()).toBe(false);
    });
  });

  describe('2. Tarjetas Colapsables Minimalist Studio en Panel Derecho', () => {
    it('toggleInspectorSection() e isInspectorSectionCollapsed() alternan secciones de forma independiente', () => {
      expect(component.isInspectorSectionCollapsed('part-dimensions')).toBe(false);
      expect(component.isInspectorSectionCollapsed('part-material')).toBe(false);

      component.toggleInspectorSection('part-dimensions');
      expect(component.isInspectorSectionCollapsed('part-dimensions')).toBe(true);
      expect(component.isInspectorSectionCollapsed('part-material')).toBe(false);

      component.toggleInspectorSection('part-dimensions');
      expect(component.isInspectorSectionCollapsed('part-dimensions')).toBe(false);
    });

    it('colapsa y expande el contenido DOM de la tarjeta part-dimensions en pieza individual', () => {
      const part = createPart({ id: 'collapse_part_1', name: 'Lateral' });
      projectService.addPart(part);
      component.selectedPartIds.set([part.id]);
      component.selectedPartId.set(part.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('button[title="+10 mm"]')).not.toBeNull();

      component.toggleInspectorSection('part-dimensions');
      fixture.detectChanges();

      expect(component.isInspectorSectionCollapsed('part-dimensions')).toBe(true);
      expect(host.querySelector('button[title="+10 mm"]')).toBeNull();

      component.toggleInspectorSection('part-dimensions');
      fixture.detectChanges();
      expect(host.querySelector('button[title="+10 mm"]')).not.toBeNull();
    });
  });

  describe('3. Conexión Visor [H] (toggleSelectionVisibility) e Indicador [O]', () => {
    it('toggleSelectionVisibility() oculta pieza/grupo/equipo seleccionado y muestra todo cuando no hay selección', () => {
      const part = createPart({ id: 'vis_part_1', name: 'Repisa Ocultable' });
      projectService.addPart(part);
      component.selectedPartIds.set([part.id]);
      component.selectedPartId.set(part.id);
      fixture.detectChanges();

      component.toggleSelectionVisibility();
      fixture.detectChanges();

      expect(component.hiddenPartsCount()).toBe(1);
      expect(component.totalHiddenCount()).toBe(1);
      expect(component.selectedPartId()).toBeNull();

      // Sin selección y con elementos ocultos -> restaura todo
      component.toggleSelectionVisibility();
      fixture.detectChanges();

      expect(component.hiddenPartsCount()).toBe(0);
      expect(component.totalHiddenCount()).toBe(0);
    });

    it('toggleSelectionVisibility() oculta y restaura electrodomésticos seleccionados', () => {
      const preset = component.appliancesCatalog[0];
      expect(preset).toBeTruthy();

      component.addApplianceFromPreset(preset);
      const createdApp = component.appliances()[0];
      expect(createdApp).toBeTruthy();

      component.selectAppliance(createdApp.id);
      component.selectedPartId.set(null);
      component.selectedPartIds.set([]);
      fixture.detectChanges();

      component.toggleSelectionVisibility();
      fixture.detectChanges();

      expect(component.hiddenAppliancesCount()).toBe(1);
      expect(component.selectedApplianceId()).toBeNull();

      component.toggleSelectionVisibility();
      fixture.detectChanges();

      expect(component.hiddenAppliancesCount()).toBe(0);
      expect(component.totalHiddenCount()).toBe(0);
    });

    it('atajo de teclado H oculta la selección activa y restaura ocultos cuando no hay selección', () => {
      const part = createPart({ id: 'key_part_1', name: 'Puerta Test' });
      projectService.addPart(part);
      component.selectedPartIds.set([part.id]);
      component.selectedPartId.set(part.id);
      fixture.detectChanges();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
      fixture.detectChanges();

      expect(component.hiddenPartsCount()).toBe(1);
      expect(component.selectedPartId()).toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
      fixture.detectChanges();

      expect(component.hiddenPartsCount()).toBe(0);
    });

    it('muestra el indicador [O] y el tooltip correspondiente en controles de abrir/cerrar puerta y módulo', () => {
      const door = createPart({
        id: 'door_badge_1',
        name: 'Puerta Batiente',
        componentRole: 'door',
        orientation: 'vertical_xy'
      });
      projectService.addPart(door);
      component.selectedPartIds.set([door.id]);
      component.selectedPartId.set(door.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      const doorBtn = host.querySelector(
        'button[title*="Abrir o cerrar puerta en 3D [O]"]'
      ) as HTMLButtonElement | null;
      expect(doorBtn).not.toBeNull();
      expect(doorBtn?.textContent).toContain('[O]');

      const drawerFront = createPart({
        id: 'grp_door_1',
        name: 'Frente Cajón',
        componentRole: 'drawer_front',
        orientation: 'vertical_xy'
      });
      projectService.addPart(drawerFront);
      const group = projectService.createGroup('Cajonera Test', [drawerFront.id], 'drawer');
      component.selectEntireGroup(group.id);
      fixture.detectChanges();

      const floatingGroupOpenBtn = host.querySelector(
        'button[title*="[O]"]'
      ) as HTMLButtonElement | null;
      expect(floatingGroupOpenBtn).not.toBeNull();
      expect(floatingGroupOpenBtn?.textContent).toContain('O');
    });
  });
});
