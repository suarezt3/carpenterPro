import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplianceItem,
  CabinetZoneNode,
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { I18nService } from '../../services/i18n.service';
import { PaymentService } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ModuleDesignerComponent, SelectionContextType } from './module-designer';

interface ViewerInitInternals {
  initThree: () => void;
}

const TEST_MATERIALS: Material[] = [
  {
    id: 'mat_white_15',
    name: 'Melamina Blanco Mate 15mm',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 145000,
    hasGrain: false,
    colorHex: '#f8fafc',
    category: 'board'
  },
  {
    id: 'mat_oak_18',
    name: 'Melamina Roble 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    colorHex: '#c29b68',
    category: 'board'
  },
  {
    id: 'mat_mdf_3',
    name: 'Fondo MDF 3mm',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 35000,
    hasGrain: false,
    colorHex: '#e4e4e7',
    family: 'mdf_back',
    category: 'mdf'
  }
];

const TEST_SETTINGS: ProjectSettings = {
  sawKerf: 4,
  trimMargin: 10,
  defaultBoardThickness: 15,
  thinEdgeThickness: 0.45,
  thickEdgeThickness: 2.0,
  thinEdgeCostPerMeter: 1500,
  thickEdgeCostPerMeter: 3500,
  optimizationPreference: 'best_fit',
  currency: 'COP'
};

function buildThreeColumnClosetZoneTree(): CabinetZoneNode {
  return {
    id: 'closet_root',
    splitDirection: 'vertical',
    children: [
      {
        id: 'bay_1_shelves',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'shelves',
          shelvesCount: 3,
          shelfSetbackMm: 20
        }
      },
      {
        id: 'bay_2_drawers',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'drawers',
          drawers: {
            count: 2,
            frontMount: 'overlay',
            deductTopMm: 0,
            deductBottomMm: 0,
            deductLeftMm: 0,
            deductRightMm: 0,
            openingSystem: 'handle',
            slideType: 'telescopic',
            bottomType: 'grooved'
          }
        }
      },
      {
        id: 'bay_3_doors_rod',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'doors',
          doors: {
            opening: 'double',
            mount: 'overlay',
            hasHandle: true,
            handleType: 'bar_modern',
            handleFinish: 'brushed_steel'
          },
          hangingRodsCount: 1
        }
      }
    ]
  };
}

function buildThreeColumnClosetConfig(): ParametricCabinetConfig {
  return {
    code: 'CLOSET_CTX',
    name: 'Clóset 3 Cuerpos Contexto',
    moduleType: 'closet',
    category: 'custom',
    width: 1800,
    height: 2100,
    depth: 600,
    structureThickness: 15,
    doorThickness: 15,
    backThickness: 3,
    backType: 'groove',
    hasBackPanel: true,
    shelvesCount: 0,
    doorOpening: 'none',
    hasHandle: true,
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    handlePosition: 'vertical',
    structureMaterialId: 'mat_white_15',
    doorMaterialId: 'mat_white_15',
    backMaterialId: 'mat_mdf_3',
    facadeGap: 3,
    baseType: 'plinth',
    hasPlinth: true,
    plinthHeight: 80,
    hasTopCover: true,
    topTieStrips: false,
    posX: 0,
    posY: 1050,
    posZ: 0,
    zoneTree: buildThreeColumnClosetZoneTree()
  };
}

function makeLooseBoard(id: string, name: string, posY: number): Part {
  return {
    id,
    name,
    length: 600,
    width: 350,
    thickness: 18,
    quantity: 1,
    materialId: 'mat_oak_18',
    materialName: 'Melamina Roble 18mm',
    grain: 'length',
    edges: { l1: 'thick', l2: 'none', a1: 'thin', a2: 'thin' },
    posX: 1600,
    posY,
    posZ: 0,
    orientation: 'horizontal',
    isParametricGenerated: false
  };
}

describe('ModuleDesignerComponent: Matriz Contextual Determinista del Panel Derecho', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    const paymentServiceStub = {
      canAddModuleToScene: () => true,
      isWorkshopExportRestricted: () => false,
      isCncExportRestricted: () => false,
      openUpgradeModal: () => undefined
    };

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [
        provideRouter([]),
        ProjectStorageService,
        CabinetGeneratorService,
        TemplatesCatalogService,
        ThemeService,
        I18nService,
        { provide: PaymentService, useValue: paymentServiceStub }
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);

    projectService.clearFurniture();
    projectService.updateProject(
      p => ({
        ...p,
        materials: [...TEST_MATERIALS],
        settings: { ...TEST_SETTINGS }
      }),
      false
    );

    fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture?.destroy();
    projectService?.flushPendingStorageSave();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it(
    'debe clasificar de forma mutuamente excluyente parametric-module, single-piece, standalone-drawer, custom-group y equipment, y bloquear el asistente en custom-group',
    () => {
      const expectContext = (expected: SelectionContextType): void => {
        const current: SelectionContextType = component.selectionContextType();
        expect(current).toBe(expected);
      };

      const inspectorTextUpper = (): string =>
        (hostEl.querySelector('.md-inspector-panel')?.textContent ?? '').toUpperCase();

      const findInspectorButton = (label: string): HTMLButtonElement | undefined =>
        Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(b =>
          b.textContent?.includes(label)
        ) as HTMLButtonElement | undefined;

      // Estado inicial sin selección -> 'none'
      expectContext('none');

      // 1. Clóset paramétrico de 3 cuerpos (repisas + 2 cajones + puertas con tubo colgador)
      const closet = cabinetGen.generateZoneCabinet(
        buildThreeColumnClosetConfig(),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      // 1a. Selección de grupo completo -> 'parametric-module'
      component.selectEntireGroup(closet.group.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expectContext('parametric-module');
      expect(component.selectionContextLabel()).toBe('Módulo Paramétrico');
      expect(component.isSelectedGroupModularDrawer()).toBe(false);
      expect(component.selectedModularDrawerGroup()).toBeNull();
      expect(inspectorTextUpper()).not.toContain('INSPECTOR DE CAJÓN MODULAR');
      expect(findInspectorButton('Editar Estructura del Módulo (Asistente)')).toBeTruthy();

      // 1b. Selección de una única puerta del clóset -> 'single-piece'
      const doorPart = projectService
        .partsList()
        .find(p => p.groupId === closet.group.id && p.componentRole === 'door');
      expect(doorPart).toBeDefined();

      component.onPartsSelectedFrom3D([doorPart!.id]);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expectContext('single-piece');
      expect(component.selectionContextLabel()).toBe('Pieza Individual');
      expect(component.isSelectedGroupModularDrawer()).toBe(false);
      expect(component.selectedModularDrawerGroup()).toBeNull();
      expect(inspectorTextUpper()).not.toContain('INSPECTOR DE CAJÓN MODULAR');
      expect(findInspectorButton('Editar Estructura del Módulo (Asistente)')).toBeUndefined();
      expect(hostEl.querySelector('input[aria-label="Nombre de la pieza"]')).toBeTruthy();
      expect(findInspectorButton('Seleccionar Módulo Completo')).toBeTruthy();

      // Hacer clic en "Seleccionar Módulo Completo" restaura 'parametric-module'
      findInspectorButton('Seleccionar Módulo Completo')!.click();
      fixture.detectChanges();
      expectContext('parametric-module');

      // 2. Cajón modular independiente -> 'standalone-drawer'
      const standaloneDrawer = projectService.addParametricDrawer({
        name: 'Cajón Independiente Prueba',
        outerWidth: 564,
        slideLength: 450,
        boxHeight: 140,
        boxThickness: 15,
        bottomThickness: 3,
        includeFront: true,
        frontMountType: 'overlay',
        handleType: 'handle',
        materialId: 'mat_white_15',
        frontMaterialId: 'mat_white_15',
        bottomMaterialId: 'mat_mdf_3',
        posX: -1400,
        posY: 200,
        posZ: 0
      });
      fixture.detectChanges();

      component.selectEntireGroup(standaloneDrawer.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expectContext('standalone-drawer');
      expect(component.selectionContextLabel()).toBe('Cajón Independiente');
      expect(component.isSelectedGroupModularDrawer()).toBe(true);
      expect(component.selectedModularDrawerGroup()?.id).toBe(standaloneDrawer.id);
      expect(inspectorTextUpper()).toContain('INSPECTOR DE CAJÓN MODULAR');
      expect(findInspectorButton('Editar Estructura del Módulo (Asistente)')).toBeUndefined();

      // Seleccionar solo una pieza individual del cajón -> 'single-piece' sin grupo de cajón activo
      const singleDrawerPart = projectService
        .partsList()
        .find(p => p.groupId === standaloneDrawer.id);
      expect(singleDrawerPart).toBeDefined();
      component.onPartsSelectedFrom3D([singleDrawerPart!.id]);
      fixture.detectChanges();
      expectContext('single-piece');
      expect(component.isSelectedGroupModularDrawer()).toBe(false);
      expect(component.selectedModularDrawerGroup()).toBeNull();
      expect(inspectorTextUpper()).not.toContain('INSPECTOR DE CAJÓN MODULAR');

      // 3. Grupo manual de 3 tableros sueltos -> 'custom-group' y bloqueo del asistente
      const b1 = makeLooseBoard('loose_b1', 'Tablero Suelto 1', 100);
      const b2 = makeLooseBoard('loose_b2', 'Tablero Suelto 2', 350);
      const b3 = makeLooseBoard('loose_b3', 'Tablero Suelto 3', 600);
      projectService.addPart(b1);
      projectService.addPart(b2);
      projectService.addPart(b3);

      const customGroup = projectService.createGroup(
        'Repisero Manual',
        [b1.id, b2.id, b3.id],
        'assembly'
      );
      fixture.detectChanges();

      component.selectEntireGroup(customGroup.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expectContext('custom-group');
      expect(component.selectionContextLabel()).toBe('Grupo Personalizado');
      expect(component.isSelectedGroupModularDrawer()).toBe(false);
      expect(component.selectedModularDrawerGroup()).toBeNull();
      expect(inspectorTextUpper()).not.toContain('INSPECTOR DE CAJÓN MODULAR');
      expect(findInspectorButton('Editar Estructura del Módulo (Asistente)')).toBeUndefined();

      // Intentar abrir el asistente en un custom-group NO debe abrir el constructor
      component.openZoneBuilderForExistingGroup(customGroup.id);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.zoneBuilderEditingGroupId()).toBeNull();

      component.openEditGroup(customGroup.id);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.zoneBuilderEditingGroupId()).toBeNull();

      // 4. Electrodoméstico / equipo 3D -> 'equipment'
      const appliance: ApplianceItem = {
        id: 'app_oven_ctx_1',
        type: 'oven',
        name: 'Horno Empotrable 60cm',
        width: 595,
        height: 595,
        depth: 550,
        finish: 'stainless_steel',
        mountType: 'built_in',
        position: { x: 2400, y: 800, z: 0 },
        rotation: 0,
        price: 1200000,
        includeInBudget: true
      };
      projectService.addAppliance(appliance);
      component.deselectPart();
      component.selectAppliance(appliance.id);
      fixture.detectChanges();

      expectContext('equipment');
      expect(component.selectionContextLabel()).toBe('Equipo');
      expect(component.isSelectedGroupModularDrawer()).toBe(false);
      expect(component.selectedModularDrawerGroup()).toBeNull();

      // 5. Selección múltiple entre grupos distintos -> 'multi-selection'
      component.selectAppliance(null);
      component.onPartsSelectedFrom3D([doorPart!.id, b1.id]);
      fixture.detectChanges();
      expectContext('multi-selection');
      expect(component.isSelectedGroupModularDrawer()).toBe(false);
      expect(component.selectedModularDrawerGroup()).toBeNull();
    },
    20000
  );
});
