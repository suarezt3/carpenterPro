import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleDesignerComponent } from './module-designer';
import {
  Furniture3dViewerComponent
} from '../furniture-3d-viewer/furniture-3d-viewer';
import {
  ApplianceItem,
  CabinetZoneHighlightBox,
  Material,
  ParametricCabinetConfig,
  Part,
  PartGroup
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { I18nService } from '../../services/i18n.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';

interface DesignerViewerInitInternals {
  initThree: () => void;
}

interface ViewerExplodeHighlightInternals {
  initThree: () => void;
  scene: THREE.Scene;
  furnitureGroup: THREE.Group;
  zoneHighlightGroup: THREE.Group;
  pieceObjects: {
    part: Part;
    mesh: THREE.Object3D;
    originalPos: THREE.Vector3;
    explodedOffset: THREE.Vector3;
    isDoor: boolean;
    doorPivot?: THREE.Group;
    doorPivotOriginalPos?: THREE.Vector3;
    doorLocalMeshPos?: THREE.Vector3;
  }[];
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
  updateExplodedOffsets: (percent: number) => void;
  updateZoneHighlightScene: (box: CabinetZoneHighlightBox | null) => void;
}

function createMockSupabase(): Partial<SupabaseService> {
  return {
    isAuthenticated: signal(false),
    isAuthLoading: signal(false),
    currentUser: signal<User | null>(null),
    userProfile: signal(null),
    cloudProjects: signal([]),
    syncStatus: signal<SyncStatus>('idle'),
    lastSyncTime: signal<Date | null>(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(null)
  };
}

const TEST_MATS: Material[] = [
  {
    id: 'mat_white_15',
    name: 'Melamina Blanco 15mm',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 145000,
    hasGrain: false,
    colorHex: '#f8fafc',
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

describe('ModuleDesignerComponent & Furniture3dViewerComponent: 3 Vías de Creación, Re-Edición In-Place, Aislar y Vista Explosiva', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let templatesCatalog: TemplatesCatalogService;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as DesignerViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase() },
        ProjectStorageService,
        TemplatesCatalogService,
        CabinetGeneratorService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    templatesCatalog = TestBed.inject(TemplatesCatalogService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);

    projectService.clearFurniture();
    projectService.updateProject(p => ({ ...p, materials: [...TEST_MATS] }), false);

    fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('debe soportar las 3 vías de creación en + Catálogo (Asistente Live Preview + Confirm/Cancel, Plantillas 3D + Personalizar, Tablero Libre y Mesón)', async () => {
    component.activeDockTab.set('catalog');
    fixture.detectChanges();

    const findCatalogButton = (label: string) =>
      Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(b =>
        b.textContent?.includes(label)
      ) as HTMLButtonElement | undefined;

    // Vía 1: Crear con Asistente -> Live preview + rollback al cancelar + persistencia al confirmar
    findCatalogButton('Crear con Asistente')!.click();
    fixture.detectChanges();

    expect(component.isZoneBuilderOpen()).toBe(true);
    const draftGroupId = component.zoneBuilderEditingGroupId()!;
    expect(draftGroupId).toBeTruthy();
    expect(component.highlightedZoneBox()).not.toBeNull();
    const draftCount = component.currentParts().filter(p => p.groupId === draftGroupId).length;
    expect(draftCount).toBeGreaterThan(0);

    // Cancelar elimina borrador por completo
    component.onZoneBuilderCancelled();
    fixture.detectChanges();
    expect(component.isZoneBuilderOpen()).toBe(false);
    expect(component.currentParts().length).toBe(0);
    expect(component.groups().length).toBe(0);

    // Volver a abrir y confirmar tras editar dimensiones en vivo
    component.activeDockTab.set('catalog');
    fixture.detectChanges();
    findCatalogButton('Crear con Asistente')!.click();
    fixture.detectChanges();

    const confirmedGroupId = component.zoneBuilderEditingGroupId()!;
    const liveCfg: ParametricCabinetConfig = {
      ...component.zoneBuilderConfig()!,
      name: 'Vitrina Asistente',
      width: 900,
      height: 1200,
      zoneTree: {
        id: 'zone_root',
        splitDirection: 'none',
        content: { type: 'shelves', shelvesCount: 3, shelfSetbackMm: 15 }
      }
    };
    component.onZoneBuilderLiveChange(liveCfg);
    component.onZoneBuilderConfirmed(liveCfg);
    fixture.detectChanges();

    expect(component.isZoneBuilderOpen()).toBe(false);
    expect(component.highlightedZoneBox()).toBeNull();
    expect(component.groups().length).toBe(1);
    expect(component.groups()[0].id).toBe(confirmedGroupId);
    expect(component.currentParts().filter(p => p.componentRole === 'shelf').length).toBe(3);

    // Vía 2: Catálogo de Plantillas 3D -> Abrir y Personalizar en Asistente
    component.activeDockTab.set('catalog');
    fixture.detectChanges();
    findCatalogButton('Catálogo de Plantillas 3D')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.showTemplatesModal()).toBe(true);
    const modalEl = hostEl.querySelector('app-templates-modal') as HTMLElement;
    const customizeBtn = Array.from(modalEl.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Abrir y Personalizar en Asistente')
    );
    expect(customizeBtn).toBeTruthy();
    customizeBtn!.click();
    fixture.detectChanges();

    expect(component.showTemplatesModal()).toBe(false);
    expect(component.isZoneBuilderOpen()).toBe(true);
    expect(component.groups().length).toBe(2);
    component.onZoneBuilderConfirmed(component.zoneBuilderConfig()!);
    fixture.detectChanges();

    // Vía 3: Manual (+ Tablero / Pieza Libre y + Mesón de Piedra)
    component.activeDockTab.set('catalog');
    fixture.detectChanges();
    const partsBeforeFree = component.currentParts().length;
    findCatalogButton('+ Tablero / Pieza Libre')!.click();
    fixture.detectChanges();
    expect(component.currentParts().length).toBe(partsBeforeFree + 1);

    component.activeDockTab.set('catalog');
    fixture.detectChanges();
    findCatalogButton('+ Mesón de Piedra')!.click();
    fixture.detectChanges();
    expect(component.showKitchenProPanel()).toBe(true);
    expect(component.kitchenProTab()).toBe('countertop');
  });

  it('debe re-editar módulos y plantillas in-place vía Editar Estructura del Módulo (Asistente) sin duplicar groupId y permitir edición individual de pieza', () => {
    const closetTpl =
      templatesCatalog.getTemplateById('closet_corredizo_2_puertas') ?? templatesCatalog.templates[0];
    component.onTemplateSelected({ template: closetTpl, mode: 'replace' });
    fixture.detectChanges();

    expect(component.groups().length).toBe(1);
    const placedGroupId = component.groups()[0].id;
    const initialPartCount = component.currentParts().length;

    // 1. Selección de grupo completo muestra "Editar Estructura del Módulo (Asistente)"
    component.selectEntireGroup(placedGroupId);
    component.activeDockTab.set('piece');
    fixture.detectChanges();

    const editGroupBtn = Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(b =>
      b.textContent?.includes('Editar Estructura del Módulo (Asistente)')
    ) as HTMLButtonElement | undefined;
    expect(editGroupBtn).toBeTruthy();

    editGroupBtn!.click();
    fixture.detectChanges();

    expect(component.isZoneBuilderOpen()).toBe(true);
    expect(component.zoneBuilderEditingGroupId()).toBe(placedGroupId);

    // Modificar ancho y cancelar -> restaura estado previo exacto sin duplicar grupo
    const modifiedCfg: ParametricCabinetConfig = {
      ...component.zoneBuilderConfig()!,
      width: 1650
    };
    component.onZoneBuilderLiveChange(modifiedCfg);
    expect(component.groups().length).toBe(1);
    component.onZoneBuilderCancelled();
    fixture.detectChanges();

    expect(component.isZoneBuilderOpen()).toBe(false);
    expect(component.groups().length).toBe(1);
    expect(component.currentParts().length).toBe(initialPartCount);

    // 2. Selección de pieza individual dentro del grupo también muestra "Editar Estructura del Módulo (Asistente)" y edición individual
    const firstPart = component.currentParts()[0];
    component.onPartsSelectedFrom3D([firstPart.id]);
    component.activeDockTab.set('piece');
    fixture.detectChanges();

    const nameInput = hostEl.querySelector(
      'input[aria-label="Nombre de la pieza"]'
    ) as HTMLInputElement | null;
    expect(nameInput).toBeTruthy();
    nameInput!.value = 'Pieza Editada Manualmente';
    nameInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.selectedPart()?.name).toBe('Pieza Editada Manualmente');

    const editFromPartBtn = Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(
      b => b.textContent?.includes('Editar Estructura del Módulo (Asistente)')
    ) as HTMLButtonElement | undefined;
    expect(editFromPartBtn).toBeTruthy();

    editFromPartBtn!.click();
    fixture.detectChanges();
    expect(component.zoneBuilderEditingGroupId()).toBe(placedGroupId);

    const committedCfg: ParametricCabinetConfig = {
      ...component.zoneBuilderConfig()!,
      name: 'Plantilla Re-Editada In-Place',
      zoneTree: {
        id: 'zone_root',
        splitDirection: 'none',
        content: { type: 'shelves', shelvesCount: 4, shelfSetbackMm: 20 }
      }
    };
    component.onZoneBuilderConfirmed(committedCfg);
    fixture.detectChanges();

    expect(component.groups().length).toBe(1);
    expect(component.groups()[0].id).toBe(placedGroupId);
    expect(component.groups()[0].name).toBe('Plantilla Re-Editada In-Place');
    expect(component.currentParts().filter(p => p.componentRole === 'shelf').length).toBe(4);
  });

  it('debe accionar Aislar Módulo, Aislar Pieza, Mostrar Todo y Explosionar Piezas (0%..100%) desde Propiedades', () => {
    const modA = cabinetGen.generateZoneCabinet(
      {
        code: 'MOD_A',
        name: 'Módulo A',
        moduleType: 'base_cabinet',
        category: 'custom',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 1,
        doorOpening: 'left',
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15',
        backMaterialId: 'mat_mdf_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3,
        posX: 0,
        posY: 400,
        posZ: 0,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: {
            type: 'doors',
            doors: {
              opening: 'left',
              mount: 'overlay',
              hasHandle: true,
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel'
            },
            shelvesCount: 1
          }
        }
      },
      TEST_MATS
    );
    const modB = cabinetGen.generateZoneCabinet(
      {
        code: 'MOD_B',
        name: 'Módulo B',
        moduleType: 'base_cabinet',
        category: 'custom',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 0,
        doorOpening: 'none',
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15',
        backMaterialId: 'mat_mdf_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3,
        posX: 900,
        posY: 400,
        posZ: 0,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: { type: 'empty' }
        }
      },
      TEST_MATS
    );

    projectService.addParametricCabinet(modA);
    projectService.addParametricCabinet(modB);
    fixture.detectChanges();

    // 1. Seleccionar Módulo A y probar Aislar Módulo + Explosionar Piezas 0%..100%
    component.selectEntireGroup(modA.group.id);
    component.activeDockTab.set('piece');
    fixture.detectChanges();

    const isolateModuleBtn = Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(
      b => b.textContent?.includes('Aislar Módulo')
    ) as HTMLButtonElement;
    expect(isolateModuleBtn).toBeTruthy();
    isolateModuleBtn.click();
    fixture.detectChanges();

    const modBPartIds = modB.parts.map(p => p.id);
    expect(component.hiddenPartIds().size).toBe(modBPartIds.length);
    for (const idB of modBPartIds) {
      expect(component.hiddenPartIds().has(idB)).toBe(true);
    }

    const explodeBtn = Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(b =>
      b.textContent?.includes('Explosionar Piezas')
    ) as HTMLButtonElement;
    explodeBtn.click();
    fixture.detectChanges();
    expect(component.viewerExplodedPercent()).toBe(50);
    expect(component.isViewerExploded()).toBe(true);

    const slider = hostEl.querySelector(
      'input[aria-label="Porcentaje de vista explosiva 3D"]'
    ) as HTMLInputElement;
    expect(slider).toBeTruthy();
    slider.value = '100';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.viewerExplodedPercent()).toBe(100);

    component.resetExplodedView3D();
    fixture.detectChanges();
    expect(component.viewerExplodedPercent()).toBe(0);

    // Mostrar Todo restaura piezas ocultas
    const showAllBtn = Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(b =>
      b.textContent?.includes('Mostrar Todo')
    ) as HTMLButtonElement;
    expect(showAllBtn).toBeTruthy();
    showAllBtn.click();
    fixture.detectChanges();
    expect(component.hiddenPartIds().size).toBe(0);

    // 2. Seleccionar pieza individual y probar Aislar Pieza
    const targetPart = modA.parts[0];
    component.onPartsSelectedFrom3D([targetPart.id]);
    component.activeDockTab.set('piece');
    fixture.detectChanges();

    const isolatePartBtn = Array.from(hostEl.querySelectorAll('.md-inspector-panel button')).find(
      b => b.textContent?.includes('Aislar Pieza')
    ) as HTMLButtonElement;
    expect(isolatePartBtn).toBeTruthy();
    isolatePartBtn.click();
    fixture.detectChanges();

    expect(component.hiddenPartIds().has(targetPart.id)).toBe(false);
    expect(component.hiddenPartIds().size).toBe(component.currentParts().length - 1);
  });
});

describe('Furniture3dViewerComponent: Highlight de Zona, Explosión Centrada por Grupo y Aislamiento 3D', () => {
  let viewerFixture: ComponentFixture<Furniture3dViewerComponent>;
  let viewer: Furniture3dViewerComponent;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(async () => {
    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as DesignerViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [CabinetGeneratorService]
    }).compileComponents();

    cabinetGen = TestBed.inject(CabinetGeneratorService);
    viewerFixture = TestBed.createComponent(Furniture3dViewerComponent);
    viewer = viewerFixture.componentInstance;

    const internals = viewer as unknown as ViewerExplodeHighlightInternals;
    internals.scene = new THREE.Scene();
    internals.scene.add(internals.furnitureGroup);
    internals.scene.add(internals.zoneHighlightGroup);
  });

  afterEach(() => {
    viewerFixture?.destroy();
    vi.restoreAllMocks();
  });

  it('debe renderizar highlightedZoneBox no-raycasteable, explotar piezas por centro de grupo y regresar a originalPos en 0%', () => {
    const mod1 = cabinetGen.generateZoneCabinet(
      {
        code: 'EXP_1',
        name: 'Módulo Explosión 1',
        moduleType: 'base_cabinet',
        category: 'custom',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 0,
        doorOpening: 'left',
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15',
        backMaterialId: 'mat_mdf_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3,
        posX: -800,
        posY: 400,
        posZ: 0,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: {
            type: 'doors',
            doors: {
              opening: 'left',
              mount: 'overlay',
              hasHandle: true,
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel'
            }
          }
        }
      },
      TEST_MATS
    );

    const mod2 = cabinetGen.generateZoneCabinet(
      {
        code: 'EXP_2',
        name: 'Módulo Explosión 2',
        moduleType: 'base_cabinet',
        category: 'custom',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 0,
        doorOpening: 'none',
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15',
        backMaterialId: 'mat_mdf_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3,
        posX: 1200,
        posY: 400,
        posZ: 0,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: { type: 'empty' }
        }
      },
      TEST_MATS
    );

    const allParts = [...mod1.parts, ...mod2.parts];
    const allGroups: PartGroup[] = [mod1.group, mod2.group];

    viewerFixture.componentRef.setInput('parts', allParts);
    viewerFixture.componentRef.setInput('partGroups', allGroups);
    viewerFixture.componentRef.setInput('materials', TEST_MATS);
    viewerFixture.detectChanges();

    const internals = viewer as unknown as ViewerExplodeHighlightInternals;
    internals.buildFurnitureScene(allParts, [], TEST_MATS, false, false);

    // Verificar vectores de explosión centrados en cada módulo
    const mod1LeftSide = internals.pieceObjects.find(
      item => item.part.groupId === mod1.group.id && item.part.componentRole === 'side_left'
    )!;
    const mod1RightSide = internals.pieceObjects.find(
      item => item.part.groupId === mod1.group.id && item.part.componentRole === 'side_right'
    )!;
    const mod1Door = internals.pieceObjects.find(
      item => item.part.groupId === mod1.group.id && item.part.componentRole === 'door'
    )!;
    const mod1Back = internals.pieceObjects.find(
      item => item.part.groupId === mod1.group.id && item.part.componentRole === 'back'
    )!;
    const mod1Top = internals.pieceObjects.find(
      item => item.part.groupId === mod1.group.id && item.part.componentRole === 'top'
    )!;

    // Aunque mod1 está en X = -800, su lateral derecho debe explotar hacia +X respecto a su propio centro
    expect(mod1LeftSide.explodedOffset.x).toBeLessThan(0);
    expect(mod1RightSide.explodedOffset.x).toBeGreaterThan(0);
    expect(mod1Door.explodedOffset.z).toBeGreaterThan(0);
    expect(mod1Back.explodedOffset.z).toBeLessThan(0);
    expect(mod1Top.explodedOffset.y).toBeGreaterThan(0);

    // setExplodedPercent clamping 0..100 y desplazamiento real
    viewer.setExplodedPercent(140);
    expect(viewer.explodedPercent()).toBe(100);
    internals.updateExplodedOffsets(100);

    const topPosAt100 = mod1Top.mesh.position.y;
    expect(topPosAt100).toBeGreaterThan(mod1Top.originalPos.y);

    // Al volver a 0%, todas las piezas y pivotes vuelven exactamente a originalPos
    viewer.resetExploded();
    expect(viewer.explodedPercent()).toBe(0);
    internals.updateExplodedOffsets(0);
    expect(mod1Top.mesh.position.y).toBeCloseTo(mod1Top.originalPos.y, 4);
    expect(mod1Door.doorPivot!.position.z).toBeCloseTo(mod1Door.doorPivotOriginalPos!.z, 4);

    // HighlightedZoneBox debe crear fill + edges excluidos de raycasting
    const box: CabinetZoneHighlightBox = {
      zoneId: 'zone_test',
      minX: -1085,
      maxX: -515,
      minY: 95,
      maxY: 785,
      minZ: -230,
      maxZ: 235
    };
    internals.updateZoneHighlightScene(box);
    expect(internals.zoneHighlightGroup.visible).toBe(true);
    expect(internals.zoneHighlightGroup.children.length).toBe(2);

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(-800, 400, 1000), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(internals.zoneHighlightGroup, true).length).toBe(0);

    internals.updateZoneHighlightScene(null);
    expect(internals.zoneHighlightGroup.visible).toBe(false);
    expect(internals.zoneHighlightGroup.children.length).toBe(0);

    // isolateGroupById debe mantener cajones alojados y equipos vinculados al grupo
    const hostApp: ApplianceItem = {
      id: 'app_host_1',
      name: 'Equipo Vinculado',
      type: 'oven',
      width: 595,
      height: 595,
      depth: 560,
      finish: 'black_matte',
      mountType: 'built_in',
      position: { x: -800, y: 200, z: 0 },
      rotation: 0,
      includeInBudget: false,
      price: 0,
      groupId: mod1.group.id
    };
    const otherApp: ApplianceItem = {
      ...hostApp,
      id: 'app_other_2',
      name: 'Equipo Ajeno',
      groupId: mod2.group.id
    };
    viewerFixture.componentRef.setInput('appliances', [hostApp, otherApp]);
    viewerFixture.detectChanges();

    viewer.isolateGroupById(mod1.group.id);
    expect(viewer.isolatedTarget()?.kind).toBe('group');
    expect(viewer.isolatedTarget()?.id).toBe(mod1.group.id);
    expect(viewer.hiddenPartIds().size).toBe(mod2.parts.length);
    for (const p1 of mod1.parts) {
      expect(viewer.hiddenPartIds().has(p1.id)).toBe(false);
    }

    viewer.showAllParts();
    expect(viewer.isolatedTarget()).toBeNull();
    expect(viewer.hiddenPartIds().size).toBe(0);
  });
});
