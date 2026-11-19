import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleDesignerComponent } from './module-designer';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import {
  CabinetZoneHighlightBox,
  isPartParametricGenerated,
  Material,
  ParametricCabinetConfig,
  Part,
  PartGroup,
  ProjectSettings
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { I18nService } from '../../services/i18n.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';

interface ViewerInitInternals {
  initThree: () => void;
}

interface ViewerPieceEntry {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
}

interface ViewerSceneInternals {
  initThree: () => void;
  scene: THREE.Scene;
  furnitureGroup: THREE.Group;
  selectionOutlineGroup: THREE.Group;
  zoneHighlightGroup: THREE.Group;
  dimensionGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  drillGroup: THREE.Group;
  internalClearanceGroup: THREE.Group;
  pieceObjects: ViewerPieceEntry[];
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
  updateSelectionHighlights: (
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean
  ) => void;
  updateZoneHighlightScene: (box: CabinetZoneHighlightBox | null) => void;
  previewPartUpdatesInPlace: (
    partUpdates: { part: Part; updates: Partial<Part> }[]
  ) => void;
  commitLiveDragUpdates?: () => void;
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
    name: 'Melamina Roble Natural 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    textureType: 'solid',
    colorHex: '#c29b68',
    category: 'board'
  },
  {
    id: 'mat_walnut_18',
    name: 'Melamina Nogal Oscuro 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 195000,
    hasGrain: true,
    textureType: 'solid',
    colorHex: '#6b4423',
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

function attachHeadlessScene(viewer: Furniture3dViewerComponent): ViewerSceneInternals {
  const internals = viewer as unknown as ViewerSceneInternals;
  internals.scene = new THREE.Scene();
  internals.scene.add(internals.furnitureGroup);
  internals.scene.add(internals.selectionOutlineGroup);
  internals.scene.add(internals.zoneHighlightGroup);
  internals.scene.add(internals.dimensionGroup);
  internals.scene.add(internals.gizmoGroup);
  internals.scene.add(internals.drillGroup);
  internals.scene.add(internals.internalClearanceGroup);
  return internals;
}

function computeGroupEnvelope(
  parts: Part[],
  joinery: JoineryEngineService
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const p of parts) {
    const b = joinery.getPartBounds(p);
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2
  };
}

function makeZoneCabinetConfig(
  overrides: Partial<ParametricCabinetConfig> = {}
): ParametricCabinetConfig {
  return {
    code: 'MOD_TEST',
    name: 'Módulo Base Prueba',
    moduleType: 'base_cabinet',
    category: 'custom',
    width: 800,
    height: 820,
    depth: 500,
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
    posY: 410,
    posZ: 0,
    zoneTree: {
      id: 'zone_root',
      splitDirection: 'none',
      content: { type: 'empty' }
    },
    ...overrides
  };
}

describe('Integración Zone Builder (Bugs 1, 2, 3) y ModuleDesignerComponent', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let joineryEngine: JoineryEngineService;
  let cutOptimizer: CutOptimizerService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
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
        JoineryEngineService,
        CutOptimizerService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    cutOptimizer = TestBed.inject(CutOptimizerService);

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

  describe('BUG 1: Movimiento libre, rotación y seguimiento en vivo sin salto de regreso', () => {
    it('debe actualizar highlightedZoneBox inmediatamente al mover/rotar y mantener ancladas las piezas regeneradas en la nueva posición y orientación', () => {
      component.openZoneBuilderNew();
      fixture.detectChanges();

      expect(component.isZoneBuilderOpen()).toBe(true);
      const groupId = component.zoneBuilderEditingGroupId()!;
      expect(groupId).toBeTruthy();

      const initialParts = component.currentParts().filter(p => p.groupId === groupId);
      const initialEnv = computeGroupEnvelope(initialParts, joineryEngine);
      const initialBox = component.highlightedZoneBox()!;
      expect(initialBox).not.toBeNull();
      const initialBoxCenterX = (initialBox.minX + initialBox.maxX) / 2;
      const initialBoxCenterZ = (initialBox.minZ + initialBox.maxZ) / 2;
      const initialBoxDepthOffset = initialBoxCenterZ - initialEnv.centerZ;
      expect(initialBoxCenterX).toBeCloseTo(initialEnv.centerX, 0);

      // 1) Simular arrastre 3D del módulo completo hacia una nueva posición (dx=+950, dy=+120, dz=-540)
      const dragDeltaX = 950;
      const dragDeltaY = 120;
      const dragDeltaZ = -540;
      component.onMultiplePartsModifiedFromViewer({
        updates: initialParts.map(part => ({
          part,
          updates: {
            posX: (part.posX ?? 0) + dragDeltaX,
            posY: (part.posY ?? 0) + dragDeltaY,
            posZ: (part.posZ ?? 0) + dragDeltaZ
          }
        }))
      });
      fixture.detectChanges();

      const movedParts = component.currentParts().filter(p => p.groupId === groupId);
      const movedEnv = computeGroupEnvelope(movedParts, joineryEngine);
      expect(movedEnv.centerX).toBeCloseTo(initialEnv.centerX + dragDeltaX, 0);
      expect(movedEnv.minY).toBeCloseTo(initialEnv.minY + dragDeltaY, 0);
      expect(movedEnv.centerZ).toBeCloseTo(initialEnv.centerZ + dragDeltaZ, 0);

      const movedBox = component.highlightedZoneBox()!;
      expect(movedBox).not.toBeNull();
      expect((movedBox.minX + movedBox.maxX) / 2).toBeCloseTo(initialBoxCenterX + dragDeltaX, 0);
      expect((movedBox.minZ + movedBox.maxZ) / 2).toBeCloseTo(initialBoxCenterZ + dragDeltaZ, 0);
      expect(movedBox.minY).toBeCloseTo(initialBox.minY + dragDeltaY, 0);

      // El hijo ZoneCabinetBuilder debe haber sincronizado su posición mundial sin perder estado
      const builder = component.zoneBuilderRef()!;
      expect(builder).toBeTruthy();
      expect(builder.currentConfig().posX).toBeCloseTo(movedEnv.centerX, 0);
      expect(builder.currentConfig().posZ).toBeCloseTo(movedEnv.centerZ, 0);

      // 2) Mover adicionalmente vía inspector y rotar 90° mientras el Asistente sigue abierto
      component.updateSelectedGroupPosition('x', 1450);
      component.updateSelectedGroupPosition('y', 180);
      component.updateSelectedGroupPosition('z', -620);
      component.onGroupRotationRequested({ groupId, deltaAngle: 90 });
      fixture.detectChanges();

      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');
      const rotatedParts = component.currentParts().filter(p => p.groupId === groupId);
      const rotatedEnv = computeGroupEnvelope(rotatedParts, joineryEngine);
      expect(rotatedEnv.centerX).toBeCloseTo(1450, 0);
      expect(rotatedEnv.minY).toBeCloseTo(180, 0);
      expect(rotatedEnv.centerZ).toBeCloseTo(-620, 0);

      const rotatedBox = component.highlightedZoneBox()!;
      expect(rotatedBox).not.toBeNull();
      // En facing 'right', el frente apunta a +X y la trasera ranurada al eje -X
      expect((rotatedBox.minX + rotatedBox.maxX) / 2).toBeCloseTo(
        rotatedEnv.centerX + initialBoxDepthOffset,
        0
      );
      expect((rotatedBox.minZ + rotatedBox.maxZ) / 2).toBeCloseTo(rotatedEnv.centerZ, 0);

      // 3) Modificar material, ancho, divisiones y repisas en vivo via onZoneBuilderLiveChange
      const liveEditedCfg: ParametricCabinetConfig = {
        ...builder.currentConfig(),
        name: 'Módulo Movido y Rotado',
        width: 900,
        depth: 500,
        structureMaterialId: 'mat_oak_18',
        doorMaterialId: 'mat_oak_18',
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'vertical',
          children: [
            {
              id: 'zone_col_1',
              splitDirection: 'none',
              sizeRatio: 1,
              content: { type: 'shelves', shelvesCount: 3, shelfSetbackMm: 20 }
            },
            {
              id: 'zone_col_2',
              splitDirection: 'none',
              sizeRatio: 1,
              content: { type: 'empty' }
            }
          ]
        },
        highlightedZoneId: 'zone_col_1'
      };
      component.onZoneBuilderLiveChange(liveEditedCfg);
      fixture.detectChanges();

      const regeneratedParts = component.currentParts().filter(p => p.groupId === groupId);
      const regenEnv = computeGroupEnvelope(regeneratedParts, joineryEngine);

      // NUNCA debe regresar a (0, 0, 0) ni perder la rotación de 90° (facing 'right')
      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');
      expect(regenEnv.centerX).toBeCloseTo(1450, 1);
      expect(regenEnv.minY).toBeCloseTo(180, 1);
      expect(regenEnv.centerZ).toBeCloseTo(-620, 1);
      // Con rotación 90° (facing 'right'), el ancho de 900mm corre a lo largo del eje Z y la profundidad de 500mm a lo largo del eje X
      expect(regenEnv.maxZ - regenEnv.minZ).toBeCloseTo(900, 2);
      expect(regenEnv.maxX - regenEnv.minX).toBeCloseTo(500, 2);

      // Verificar material aplicado y repisas generadas
      const shelves = regeneratedParts.filter(p => p.componentRole === 'shelf');
      expect(shelves.length).toBe(3);
      const sidePart = regeneratedParts.find(p => p.componentRole === 'side_left')!;
      expect(sidePart.materialId).toBe('mat_oak_18');

      // El resaltado de zona debe permanecer anclado sobre la nueva posición rotada
      const boxAfterLive = component.highlightedZoneBox()!;
      expect(boxAfterLive).not.toBeNull();
      expect(boxAfterLive.zoneId).toBe('zone_col_1');
      expect((boxAfterLive.minX + boxAfterLive.maxX) / 2).toBeCloseTo(
        regenEnv.centerX + initialBoxDepthOffset,
        0
      );
      expect(boxAfterLive.maxZ).toBeLessThanOrEqual(regenEnv.maxZ + 2);
      expect(boxAfterLive.minZ).toBeGreaterThanOrEqual(regenEnv.minZ - 2);

      // Confirmar y verificar que mantiene la ubicación y orientación final
      component.onZoneBuilderConfirmed(liveEditedCfg);
      fixture.detectChanges();

      const confirmedParts = component.currentParts().filter(p => p.groupId === groupId);
      const confirmedEnv = computeGroupEnvelope(confirmedParts, joineryEngine);
      expect(confirmedEnv.centerX).toBeCloseTo(1450, 1);
      expect(confirmedEnv.minY).toBeCloseTo(180, 1);
      expect(confirmedEnv.centerZ).toBeCloseTo(-620, 1);
      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');
    });
  });

  describe('BUG 2: Intercepción de tecla Supr/Delete y cero cajas azules fantasma', () => {
    it('debe interceptar Delete en dos pasos (vaciar Col. 1 -> reducir división padre) sin borrar el módulo de la escena', () => {
      component.openZoneBuilderNew();
      fixture.detectChanges();

      const groupId = component.zoneBuilderEditingGroupId()!;
      const builder = component.zoneBuilderRef()!;
      expect(builder).toBeTruthy();

      // Configurar 2 columnas y Col. 1 con 3 repisas móviles
      builder.adjustSplit('vertical', 1);
      fixture.detectChanges();

      const col1Id = builder.zoneTree().children![0].id;
      const col2Id = builder.zoneTree().children![1].id;
      builder.selectZone(col1Id);
      builder.setSelectedZoneContentType('shelves');
      builder.adjustShelvesCount(1); // 2 -> 3 repisas móviles
      fixture.detectChanges();

      expect(builder.selectedZoneId()).toBe(col1Id);
      expect(builder.selectedZoneNode().content?.type).toBe('shelves');
      expect(builder.selectedZoneNode().content?.shelvesCount).toBe(3);
      expect(
        component.currentParts().filter(p => p.groupId === groupId && p.componentRole === 'shelf').length
      ).toBe(3);
      const carcassCountBefore = component
        .currentParts()
        .filter(
          p =>
            p.groupId === groupId &&
            (p.componentRole === 'side_left' ||
              p.componentRole === 'side_right' ||
              p.componentRole === 'top' ||
              p.componentRole === 'bottom')
        ).length;
      expect(carcassCountBefore).toBe(4);

      // 1ra pulsación de tecla Delete a nivel window (prueba además ausencia de doble disparo con el visor)
      const firstDelEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(firstDelEvent);
      fixture.detectChanges();

      expect(firstDelEvent.defaultPrevented).toBe(true);
      expect(component.isZoneBuilderOpen()).toBe(true);
      // Las 2 columnas siguen existiendo, pero Col. 1 quedó vacía y sus 3 repisas desaparecieron
      expect(builder.zoneTree().splitDirection).toBe('vertical');
      expect(builder.zoneTree().children?.length).toBe(2);
      expect(builder.selectedZoneId()).toBe(col1Id);
      expect(builder.selectedZoneNode().content?.type).toBe('empty');
      expect(
        component.currentParts().filter(p => p.groupId === groupId && p.componentRole === 'shelf').length
      ).toBe(0);
      // El casco del módulo sigue intacto en escena
      expect(
        component
          .currentParts()
          .filter(
            p =>
              p.groupId === groupId &&
              (p.componentRole === 'side_left' ||
                p.componentRole === 'side_right' ||
                p.componentRole === 'top' ||
                p.componentRole === 'bottom')
          ).length
      ).toBe(4);

      // 2da pulsación de Delete sobre Col. 1 ahora vacía -> reduce la división padre y conserva Col. 2/casco
      const secondDelEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true
      });
      component.handleGlobalKeyDown(secondDelEvent);
      fixture.detectChanges();

      expect(secondDelEvent.defaultPrevented).toBe(true);
      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(builder.zoneTree().splitDirection).toBe('none');
      expect(builder.zoneTree().children).toBeUndefined();
      expect(builder.selectedZoneId()).toBe('zone_root');
      expect(builder.totalLeafZonesCount()).toBe(1);
      // El divisor vertical ya no existe y la zona restante ocupa todo el ancho interno
      expect(builder.selectedLayoutNode().innerWidth).toBeCloseTo(
        builder.width() - 2 * builder.structureThickness(),
        1
      );
      expect(component.highlightedZoneBox()).not.toBeNull();
      expect(col2Id).toBeTruthy();

      // El módulo sigue completamente vivo en la escena 3D
      const aliveParts = component.currentParts().filter(p => p.groupId === groupId);
      expect(aliveParts.length).toBeGreaterThanOrEqual(4);

      // 3ra pulsación sobre raíz vacía -> noop, nunca borra el casco
      const thirdDelEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true
      });
      component.handleGlobalKeyDown(thirdDelEvent);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(component.currentParts().filter(p => p.groupId === groupId).length).toBe(aliveParts.length);

      // Protección adicional: onPartDeletedFromViewer dirigido al grupo activo tampoco destruye el tablero
      component.onPartDeletedFromViewer(aliveParts[0].id);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(component.currentParts().filter(p => p.groupId === groupId).length).toBe(aliveParts.length);
    });

    it('debe eliminar por completo el resaltado 3D (cero cubos azules fantasma) al cancelar, confirmar, eliminar externamente o desagrupar', () => {
      const viewer = component.viewer3d()!;
      expect(viewer).toBeTruthy();
      const viewerInternals = attachHeadlessScene(viewer);

      // 1) Cancelar
      component.openZoneBuilderNew();
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(component.highlightedZoneBox()).not.toBeNull();
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(true);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(2);

      component.onZoneBuilderCancelled();
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.highlightedZoneBox()).toBeNull();
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(false);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(0);

      // 2) Confirmar
      component.openZoneBuilderNew();
      fixture.detectChanges();
      const confirmedGroupId = component.zoneBuilderEditingGroupId()!;
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(true);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(2);

      component.onZoneBuilderConfirmed(component.zoneBuilderConfig()!);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.highlightedZoneBox()).toBeNull();
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(false);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(0);

      // 3) Eliminación externa directa en ProjectStorageService mientras el Asistente está abierto
      component.openZoneBuilderForExistingGroup(confirmedGroupId);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(true);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(2);

      projectService.deleteGroup(confirmedGroupId, true);
      fixture.detectChanges();
      // Segundo detectChanges para propagar el efecto reactivo al input del visor hijo
      fixture.detectChanges();

      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.highlightedZoneBox()).toBeNull();
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(false);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(0);

      // 4) Desagrupar mientras el Asistente está abierto
      component.openZoneBuilderNew();
      fixture.detectChanges();
      const ungroupTargetId = component.zoneBuilderEditingGroupId()!;
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(true);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(2);

      component.ungroup(ungroupTargetId);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.highlightedZoneBox()).toBeNull();
      expect(viewerInternals.zoneHighlightGroup.visible).toBe(false);
      expect(viewerInternals.zoneHighlightGroup.children.length).toBe(0);
    });
  });

  describe('BUG 3: Preservación de piezas manuales vinculadas, indicador UI y sincronización externa', () => {
    it('debe preservar tablero manual agrupado, mostrar indicador en UI, sincronizar material externo, mantenerlo en despiece/movimiento y permitir retirarlo explícitamente', () => {
      // 1) Crear y confirmar un módulo paramétrico
      component.openZoneBuilderNew();
      fixture.detectChanges();

      const initialGroupId = component.zoneBuilderEditingGroupId()!;
      const initialCfg: ParametricCabinetConfig = {
        ...component.zoneBuilderConfig()!,
        name: 'Gabinete Base Principal',
        width: 800,
        height: 820,
        depth: 500,
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15'
      };
      component.onZoneBuilderConfirmed(initialCfg);
      fixture.detectChanges();

      const parametricInitialParts = projectService
        .partsList()
        .filter(p => p.groupId === initialGroupId);
      expect(parametricInitialParts.length).toBeGreaterThan(0);
      expect(parametricInitialParts.every(p => p.isParametricGenerated === true)).toBe(true);

      // 2) Añadir un tablero libre manual y personalizar sus dimensiones y posición
      component.addFreeBoard();
      fixture.detectChanges();

      const manualFreeBoard = projectService
        .partsList()
        .find(p => !p.groupId && p.isParametricGenerated === false)!;
      expect(manualFreeBoard).toBeDefined();

      projectService.updatePart({
        ...manualFreeBoard,
        name: 'Tapa Lateral Manual',
        hasCustomName: true,
        length: 520,
        width: 310,
        thickness: 15,
        materialId: 'mat_walnut_18',
        posX: 430,
        posY: 410,
        posZ: 0
      });
      fixture.detectChanges();

      // 3) Agrupar el tablero manual junto con el módulo paramétrico
      const combinedPartIds = [
        ...parametricInitialParts.map(p => p.id),
        manualFreeBoard.id
      ];
      component.selectedPartIds.set(combinedPartIds);
      component.selectedPartId.set(parametricInitialParts[0].id);
      component.quickGroupSelectedParts();
      fixture.detectChanges();
      component.newGroupNameInput.set('Gabinete Con Pieza Manual');
      component.confirmCreateGroup();
      fixture.detectChanges();

      const mergedGroup = projectService
        .groupsList()
        .find(g => g.name === 'Gabinete Con Pieza Manual')!;
      expect(mergedGroup).toBeDefined();
      expect(mergedGroup.parametricConfig).toBeDefined();

      const mergedParts = projectService.partsList().filter(p => p.groupId === mergedGroup.id);
      const linkedManualBefore = mergedParts.find(p => p.id === manualFreeBoard.id)!;
      expect(linkedManualBefore).toBeDefined();
      expect(linkedManualBefore.isParametricGenerated).toBe(false);

      const carcassPartIds = mergedParts
        .filter(
          p =>
            isPartParametricGenerated(p, mergedParts) &&
            (p.componentRole === 'side_left' ||
              p.componentRole === 'side_right' ||
              p.componentRole === 'top' ||
              p.componentRole === 'bottom')
        )
        .map(p => p.id);
      expect(carcassPartIds.length).toBe(4);

      // 4) Cambiar externamente el material del casco paramétrico fuera del Asistente (Blanco -> Roble 18mm)
      projectService.changeMultiplePartsMaterial(carcassPartIds, 'mat_oak_18');
      fixture.detectChanges();

      // 5) Reabrir Asistente de Zonas sobre el grupo
      component.openZoneBuilderForExistingGroup(mergedGroup.id);
      fixture.detectChanges();

      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(component.activeZoneBuilderManualParts().length).toBe(1);
      expect(component.activeZoneBuilderManualParts()[0].id).toBe(manualFreeBoard.id);

      // Verificar sincronización del material externo sin revertir a Blanco
      expect(component.zoneBuilderConfig()?.structureMaterialId).toBe('mat_oak_18');
      const builder = component.zoneBuilderRef()!;
      expect(builder.structureMaterialId()).toBe('mat_oak_18');

      // Verificar indicador "+ 1 pieza manual vinculada" en el DOM de <app-zone-cabinet-builder>
      const builderEl = hostEl.querySelector('app-zone-cabinet-builder') as HTMLElement;
      expect(builderEl).toBeTruthy();
      const manualCard = builderEl.querySelector('.zcb-manual-parts-card') as HTMLElement;
      expect(manualCard).toBeTruthy();
      expect(manualCard.textContent?.replace(/\s+/g, ' ').trim()).toContain('+ 1 pieza manual vinculada');

      // Expandir el acordeón de piezas manuales y validar medidas
      const expandBtn = manualCard.querySelector('button') as HTMLButtonElement;
      expandBtn.click();
      fixture.detectChanges();
      expect(manualCard.textContent).toContain('Tapa Lateral Manual');
      expect(manualCard.textContent).toContain('520 × 310 × 15 mm');

      // 6) Modificar zonas y repisas en vista previa en vivo y confirmar haciendo clic en "Confirmar Módulo en Escena"
      builder.adjustSplit('vertical', 1);
      fixture.detectChanges();
      const col1Id = builder.zoneTree().children![0].id;
      builder.selectZone(col1Id);
      builder.setSelectedZoneContentType('shelves');
      fixture.detectChanges();

      const confirmBtn = Array.from(builderEl.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Confirmar Módulo en Escena')
      ) as HTMLButtonElement;
      expect(confirmBtn).toBeTruthy();
      confirmBtn.click();
      fixture.detectChanges();

      expect(component.isZoneBuilderOpen()).toBe(false);
      expect(component.highlightedZoneBox()).toBeNull();

      // La pieza manual sobrevive intacta con su groupId, dimensiones, posición y material
      const partsAfterConfirm = projectService.partsList();
      const survivingManual = partsAfterConfirm.find(p => p.id === manualFreeBoard.id)!;
      expect(survivingManual).toBeDefined();
      expect(survivingManual.groupId).toBe(mergedGroup.id);
      expect(survivingManual.isParametricGenerated).toBe(false);
      expect(survivingManual.length).toBe(520);
      expect(survivingManual.width).toBe(310);
      expect(survivingManual.thickness).toBe(15);
      expect(survivingManual.materialId).toBe('mat_walnut_18');
      expect(survivingManual.posX).toBe(430);
      expect(survivingManual.posY).toBe(410);
      expect(survivingManual.posZ).toBe(0);

      // Las piezas paramétricas regeneradas tienen el nuevo material sincronizado (Roble) y las 2 repisas
      const updatedParametricParts = partsAfterConfirm.filter(
        p => p.groupId === mergedGroup.id && p.isParametricGenerated === true
      );
      expect(updatedParametricParts.filter(p => p.componentRole === 'shelf').length).toBe(2);
      expect(
        updatedParametricParts.find(p => p.componentRole === 'side_left')?.materialId
      ).toBe('mat_oak_18');

      // CutOptimizer incluye las piezas paramétricas cortables + el tablero manual intacto
      const optResult = cutOptimizer.optimizeProject(
        partsAfterConfirm,
        TEST_MATERIALS,
        TEST_SETTINGS
      );
      const expectedCuttableQty = partsAfterConfirm
        .filter(p => !p.excludeFromCutlist)
        .reduce((acc, p) => acc + (p.quantity || 1), 0);
      expect(optResult.totalPartsCount).toBe(expectedCuttableQty);
      const placedManual = optResult.sheets.some(s =>
        s.placedParts.some(pp => pp.part.id === manualFreeBoard.id)
      );
      expect(placedManual).toBe(true);

      // Al mover el grupo, la pieza manual se desplaza rígidamente junto al resto del módulo
      projectService.moveGroup(mergedGroup.id, 300, 0, -150);
      fixture.detectChanges();
      const movedManual = projectService.partsList().find(p => p.id === manualFreeBoard.id)!;
      expect(movedManual.posX).toBeCloseTo(730, 1);
      expect(movedManual.posY).toBeCloseTo(410, 1);
      expect(movedManual.posZ).toBeCloseTo(-150, 1);

      // 7) Reabrir Asistente y probar eliminación explícita de la pieza manual sin cerrar el Asistente
      component.openZoneBuilderForExistingGroup(mergedGroup.id);
      fixture.detectChanges();
      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(component.activeZoneBuilderManualParts().length).toBe(1);

      // Guard: intentar retirar una pieza paramétrica mediante onRemoveZoneBuilderManualPart debe ignorarse
      const someParametricId = updatedParametricParts[0].id;
      component.onRemoveZoneBuilderManualPart(someParametricId);
      fixture.detectChanges();
      expect(projectService.partsList().some(p => p.id === someParametricId)).toBe(true);

      // Retiro explícito de la pieza manual
      component.onRemoveZoneBuilderManualPart(manualFreeBoard.id);
      fixture.detectChanges();

      expect(component.isZoneBuilderOpen()).toBe(true);
      expect(component.activeZoneBuilderManualParts().length).toBe(0);
      expect(projectService.partsList().some(p => p.id === manualFreeBoard.id)).toBe(false);
      // Todas las piezas paramétricas permanecen vivas
      const remainingParametricCount = projectService
        .partsList()
        .filter(p => p.groupId === mergedGroup.id && p.isParametricGenerated === true).length;
      expect(remainingParametricCount).toBe(updatedParametricParts.length);
      expect(hostEl.querySelector('.zcb-manual-parts-card')).toBeNull();
    });

    it('reconstructConfigFromParts debe sincronizar dimensiones/materiales externos en módulo rotado 90° ignorando piezas manuales acopladas', () => {
      const baseCfg = makeZoneCabinetConfig({
        width: 800,
        height: 820,
        depth: 500,
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15',
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
      });

      const generated = cabinetGen.generateZoneCabinet(baseCfg, TEST_MATERIALS);
      projectService.addParametricCabinet(generated);
      const groupId = generated.group.id;

      // Cambiar material externo de puerta a Nogal y casco a Roble
      const groupParts = projectService.partsList().filter(p => p.groupId === groupId);
      const carcassIds = groupParts
        .filter(p => p.componentRole === 'side_left' || p.componentRole === 'side_right' || p.componentRole === 'top' || p.componentRole === 'bottom')
        .map(p => p.id);
      const doorIds = groupParts.filter(p => p.componentRole === 'door').map(p => p.id);
      projectService.changeMultiplePartsMaterial(carcassIds, 'mat_oak_18');
      projectService.changeMultiplePartsMaterial(doorIds, 'mat_walnut_18');

      // Rotar 90° para validar que ancho/profundidad no se invierten al reconstruir
      projectService.rotateGroupRigidly(groupId, 90);

      // Adjuntar una pieza manual sobresaliendo del módulo (+600mm en X)
      const manualOutlier: Part = {
        id: 'manual_outlier_board',
        name: 'Extensión Manual Lateral',
        length: 900,
        width: 400,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_walnut_18',
        materialName: 'Melamina Nogal Oscuro 18mm',
        orientation: 'horizontal',
        posX: 900,
        posY: 820,
        posZ: 0,
        groupId,
        groupName: generated.group.name,
        isParametricGenerated: false,
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        grain: 'length'
      };
      projectService.addPart(manualOutlier);

      const finalGroup = projectService.groupsList().find(g => g.id === groupId)!;
      const allGroupParts = projectService.partsList().filter(p => p.groupId === groupId);
      const reconstructed = cabinetGen.reconstructConfigFromParts(allGroupParts, finalGroup);

      expect(reconstructed.structureMaterialId).toBe('mat_oak_18');
      expect(reconstructed.doorMaterialId).toBe('mat_walnut_18');
      // Ancho y profundidad no se invirtieron por la rotación de 90° ni se inflaron por la pieza manual
      expect(reconstructed.width).toBeCloseTo(800, 1);
      expect(reconstructed.height).toBeCloseTo(820, 1);
      expect(reconstructed.depth).toBeCloseTo(500, 2);
    });
  });
});

describe('Furniture3dViewerComponent: Mejora 4 (Selección CAD por aristas, color en vivo, opacidad de zona, GPU disposal) y Bugs 1.2 / 2.1', () => {
  let viewerFixture: ComponentFixture<Furniture3dViewerComponent>;
  let viewer: Furniture3dViewerComponent;
  let internals: ViewerSceneInternals;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(async () => {
    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [CabinetGeneratorService, JoineryEngineService, ProjectStorageService, I18nService]
    }).compileComponents();

    cabinetGen = TestBed.inject(CabinetGeneratorService);
    viewerFixture = TestBed.createComponent(Furniture3dViewerComponent);
    viewer = viewerFixture.componentInstance;
    internals = attachHeadlessScene(viewer);
    viewerFixture.componentRef.setInput('materials', TEST_MATERIALS);
    viewerFixture.detectChanges();
  });

  afterEach(() => {
    viewerFixture?.destroy();
    vi.restoreAllMocks();
  });

  it('BUG 1.2: previewPartUpdatesInPlace debe trasladar zoneHighlightGroup.position en tiempo real durante arrastre y resetearlo al confirmar/actualizar', () => {
    const modA = cabinetGen.generateZoneCabinet(
      makeZoneCabinetConfig({ code: 'DRAG_A', name: 'Módulo Drag A', posX: 0, posY: 410, posZ: 0 }),
      TEST_MATERIALS
    );
    const modB = cabinetGen.generateZoneCabinet(
      makeZoneCabinetConfig({ code: 'DRAG_B', name: 'Módulo Drag B', posX: 1200, posY: 410, posZ: 0 }),
      TEST_MATERIALS
    );

    const allParts = [...modA.parts, ...modB.parts];
    const allGroups: PartGroup[] = [modA.group, modB.group];

    viewerFixture.componentRef.setInput('parts', allParts);
    viewerFixture.componentRef.setInput('partGroups', allGroups);
    viewerFixture.componentRef.setInput('isZoneBuilderActive', true);
    viewerFixture.componentRef.setInput('zoneBuilderGroupId', modA.group.id);
    viewerFixture.detectChanges();

    const initialBox: CabinetZoneHighlightBox = {
      zoneId: 'zone_root',
      minX: -385,
      maxX: 385,
      minY: 95,
      maxY: 805,
      minZ: -230,
      maxZ: 235
    };
    viewerFixture.componentRef.setInput('highlightedZoneBox', initialBox);
    viewerFixture.detectChanges();

    expect(internals.zoneHighlightGroup.visible).toBe(true);
    expect(internals.zoneHighlightGroup.children.length).toBe(2);
    expect(internals.zoneHighlightGroup.position.x).toBe(0);
    expect(internals.zoneHighlightGroup.position.y).toBe(0);
    expect(internals.zoneHighlightGroup.position.z).toBe(0);

    // Arrastrar otro grupo NO debe mover zoneHighlightGroup
    internals.previewPartUpdatesInPlace(
      modB.parts.map(part => ({
        part,
        updates: { posX: (part.posX ?? 0) + 200 }
      }))
    );
    expect(internals.zoneHighlightGroup.position.x).toBe(0);
    expect(internals.zoneHighlightGroup.position.y).toBe(0);
    expect(internals.zoneHighlightGroup.position.z).toBe(0);

    // Arrastrar el grupo activo del Zone Builder traslada zoneHighlightGroup en tiempo real
    internals.previewPartUpdatesInPlace(
      modA.parts.map(part => ({
        part,
        updates: {
          posX: (part.posX ?? 0) + 320,
          posY: (part.posY ?? 0) + 85,
          posZ: (part.posZ ?? 0) - 190
        }
      }))
    );
    expect(internals.zoneHighlightGroup.position.x).toBeCloseTo(320, 2);
    expect(internals.zoneHighlightGroup.position.y).toBeCloseTo(85, 2);
    expect(internals.zoneHighlightGroup.position.z).toBeCloseTo(-190, 2);

    // Al cancelar o actualizar el highlight tras el drop, position se resetea exactamente a (0,0,0)
    viewer.cancelActiveInteractions();
    expect(internals.zoneHighlightGroup.position.x).toBe(0);
    expect(internals.zoneHighlightGroup.position.y).toBe(0);
    expect(internals.zoneHighlightGroup.position.z).toBe(0);

    // Re-arrastrar y luego refrescar via updateZoneHighlightScene -> sin doble desplazamiento
    internals.previewPartUpdatesInPlace(
      modA.parts.map(part => ({
        part,
        updates: {
          posX: (part.posX ?? 0) + 150,
          posZ: (part.posZ ?? 0) + 75
        }
      }))
    );
    expect(internals.zoneHighlightGroup.position.x).toBeCloseTo(150, 2);
    expect(internals.zoneHighlightGroup.position.z).toBeCloseTo(75, 2);

    const movedBox: CabinetZoneHighlightBox = {
      zoneId: 'zone_root',
      minX: initialBox.minX + 150,
      maxX: initialBox.maxX + 150,
      minY: initialBox.minY,
      maxY: initialBox.maxY,
      minZ: initialBox.minZ + 75,
      maxZ: initialBox.maxZ + 75
    };
    internals.updateZoneHighlightScene(movedBox);
    expect(internals.zoneHighlightGroup.position.x).toBe(0);
    expect(internals.zoneHighlightGroup.position.y).toBe(0);
    expect(internals.zoneHighlightGroup.position.z).toBe(0);
    expect(internals.zoneHighlightGroup.children[0].position.x).toBeCloseTo(
      (movedBox.minX + movedBox.maxX) / 2,
      2
    );
    expect(internals.zoneHighlightGroup.children[0].position.z).toBeCloseTo(
      (movedBox.minZ + movedBox.maxZ) / 2,
      2
    );
  });

  it('BUG 2.1: handleViewerKeyDown y menú contextual deben emitir zoneDeleteRequested y bloquear partDeleted/applianceDeleted cuando isZoneBuilderActive es true', () => {
    const mod = cabinetGen.generateZoneCabinet(
      makeZoneCabinetConfig({ code: 'DEL_V', name: 'Módulo Delete Viewer' }),
      TEST_MATERIALS
    );
    viewerFixture.componentRef.setInput('parts', mod.parts);
    viewerFixture.componentRef.setInput('partGroups', [mod.group]);
    viewerFixture.componentRef.setInput('selectedPartId', mod.parts[0].id);
    viewerFixture.componentRef.setInput('selectedPartIds', mod.parts.map(p => p.id));
    viewerFixture.componentRef.setInput('isZoneBuilderActive', true);
    viewerFixture.componentRef.setInput('zoneBuilderGroupId', mod.group.id);
    viewerFixture.detectChanges();

    const zoneDeleteSpy = vi.fn();
    const partDeleteSpy = vi.fn();
    const appDeleteSpy = vi.fn();
    viewer.zoneDeleteRequested.subscribe(zoneDeleteSpy);
    viewer.partDeleted.subscribe(partDeleteSpy);
    viewer.applianceDeleted.subscribe(appDeleteSpy);

    for (const key of ['Delete', 'Backspace', 'Del']) {
      const ev = new KeyboardEvent('keydown', { key, cancelable: true });
      viewer.handleViewerKeyDown(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(zoneDeleteSpy).toHaveBeenCalledTimes(3);
    expect(partDeleteSpy).not.toHaveBeenCalled();
    expect(appDeleteSpy).not.toHaveBeenCalled();

    // Menú contextual sobre el grupo activo y sobre una pieza del grupo activo
    viewer.contextMenuPart.set(mod.parts[0]);
    expect(viewer.contextMenuGroup()?.id).toBe(mod.group.id);
    viewer.deleteContextMenuGroup();
    viewer.contextMenuPart.set(mod.parts[0]);
    viewer.deleteContextMenuPart();

    expect(zoneDeleteSpy).toHaveBeenCalledTimes(5);
    expect(partDeleteSpy).not.toHaveBeenCalled();

    // Al desactivar Zone Builder, Delete vuelve a emitir partDeleted con normalidad
    viewerFixture.componentRef.setInput('isZoneBuilderActive', false);
    viewerFixture.detectChanges();

    const normalDel = new KeyboardEvent('keydown', { key: 'Delete', cancelable: true });
    viewer.handleViewerKeyDown(normalDel);
    expect(zoneDeleteSpy).toHaveBeenCalledTimes(5);
    expect(partDeleteSpy).toHaveBeenCalledTimes(mod.parts.length);
  });

  it('MEJORA 4: selección CAD solo por aristas (#0284C7, scale 1.001) preservando color auténtico de melamina, cambio de color en vivo sin deseleccionar y wireframe AABB exterior de grupo', () => {
    const standaloneBoard: Part = {
      id: 'board_single_1',
      name: 'Tablero Roble Individual',
      length: 700,
      width: 450,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_oak_18',
      materialName: 'Melamina Roble Natural 18mm',
      orientation: 'horizontal',
      posX: -900,
      posY: 400,
      posZ: 0,
      edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
      grain: 'length'
    };

    const mod = cabinetGen.generateZoneCabinet(
      makeZoneCabinetConfig({
        code: 'CAD_SEL',
        name: 'Módulo Selección CAD',
        structureMaterialId: 'mat_white_15',
        doorMaterialId: 'mat_white_15',
        posX: 400,
        posY: 410,
        posZ: 0
      }),
      TEST_MATERIALS
    );

    const allParts = [standaloneBoard, ...mod.parts];
    viewerFixture.componentRef.setInput('parts', allParts);
    viewerFixture.componentRef.setInput('partGroups', [mod.group]);
    viewerFixture.componentRef.setInput('selectedPartId', standaloneBoard.id);
    viewerFixture.componentRef.setInput('selectedPartIds', [standaloneBoard.id]);
    viewerFixture.detectChanges();

    const oakColorHex = new THREE.Color('#c29b68').getHex();
    const walnutColorHex = new THREE.Color('#6b4423').getHex();
    const whiteColorHex = new THREE.Color('#f8fafc').getHex();

    // 1) Pieza individual seleccionada: conserva color auténtico Roble (jamás tinte azul 0x3b82f6 / emissive 0x1d4ed8)
    const singleItem = internals.pieceObjects.find(item => item.part.id === standaloneBoard.id)!;
    expect(singleItem).toBeDefined();
    const singleMat = singleItem.mesh.material as THREE.MeshStandardMaterial;
    expect(singleMat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(singleMat.color.getHex()).toBe(oakColorHex);
    expect(singleMat.color.getHex()).not.toBe(0x3b82f6);
    expect(singleMat.emissive.getHex()).not.toBe(0x1d4ed8);
    expect(singleMat.polygonOffset).toBe(true);

    const singleEdges = singleItem.mesh.children.find(
      c => c instanceof THREE.LineSegments
    ) as THREE.LineSegments;
    expect(singleEdges).toBeDefined();
    const singleEdgeMat = singleEdges.material as THREE.LineBasicMaterial;
    expect(singleEdgeMat.color.getHex()).toBe(0x0284c7);
    expect(singleEdges.scale.x).toBeCloseTo(1.001, 4);
    expect(singleEdges.scale.y).toBeCloseTo(1.001, 4);
    expect(singleEdges.scale.z).toBeCloseTo(1.001, 4);
    expect(singleEdges.renderOrder).toBe(20);

    // Pieza individual sin grupo -> selectionOutlineGroup permanece oculto
    expect(internals.selectionOutlineGroup.visible).toBe(false);
    expect(internals.selectionOutlineGroup.children.length).toBe(0);

    // 2) Cambiar materialId de la pieza MIENTRAS SIGUE SELECCIONADA -> actualización inmediata al color Nogal sin deseleccionar
    const updatedBoard: Part = { ...standaloneBoard, materialId: 'mat_walnut_18' };
    viewerFixture.componentRef.setInput('parts', [updatedBoard, ...mod.parts]);
    viewerFixture.componentRef.setInput('selectedPartId', updatedBoard.id);
    viewerFixture.detectChanges();

    const refreshedSingleItem = internals.pieceObjects.find(
      item => item.part.id === standaloneBoard.id
    )!;
    const refreshedMat = refreshedSingleItem.mesh.material as THREE.MeshStandardMaterial;
    expect(refreshedMat.color.getHex()).toBe(walnutColorHex);
    expect(refreshedMat.color.getHex()).not.toBe(0x3b82f6);
    expect(viewer.selectedPartIds()).toEqual([standaloneBoard.id]);

    // 3) Seleccionar módulo multipieza completo -> cada pieza mantiene su melamina real + aristas #0284C7 + marco exterior CAD en selectionOutlineGroup
    const modPartIds = mod.parts.map(p => p.id);
    viewerFixture.componentRef.setInput('selectedPartId', mod.parts[0].id);
    viewerFixture.componentRef.setInput('selectedPartIds', modPartIds);
    viewerFixture.detectChanges();

    const sideLeftItem = internals.pieceObjects.find(
      item => item.part.groupId === mod.group.id && item.part.componentRole === 'side_left'
    )!;
    const sideMat = sideLeftItem.mesh.material as THREE.MeshStandardMaterial;
    expect(sideMat.color.getHex()).toBe(whiteColorHex);
    expect(sideMat.color.getHex()).not.toBe(0x3b82f6);
    expect(sideMat.emissive.getHex()).not.toBe(0x1d4ed8);

    for (const modItem of internals.pieceObjects.filter(i => i.part.groupId === mod.group.id)) {
      const line = modItem.mesh.children.find(
        c => c instanceof THREE.LineSegments
      ) as THREE.LineSegments;
      expect(line).toBeDefined();
      expect((line.material as THREE.LineBasicMaterial).color.getHex()).toBe(0x0284c7);
      expect(line.scale.x).toBeCloseTo(1.001, 4);
    }

    expect(internals.selectionOutlineGroup.visible).toBe(true);
    expect(internals.selectionOutlineGroup.children.length).toBe(1);
    const groupOutline = internals.selectionOutlineGroup.children[0] as THREE.LineSegments;
    expect(groupOutline).toBeInstanceOf(THREE.LineSegments);
    expect(groupOutline.userData['isSelectionGroupOutline']).toBe(true);
    expect(groupOutline.userData['groupId']).toBe(mod.group.id);
    const groupOutlineMat = groupOutline.material as THREE.LineBasicMaterial;
    expect(groupOutlineMat.color.getHex()).toBe(0x0284c7);
    expect(groupOutlineMat.depthWrite).toBe(false);

    // El wireframe exterior del grupo debe ser no-raycasteable
    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(400, 410, 1500), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(internals.selectionOutlineGroup, true).length).toBe(0);

    // 4) Cambiar color de todas las piezas del módulo seleccionado en vivo -> actualiza sin deseleccionar
    const recoloredModParts = mod.parts.map(p =>
      p.componentRole === 'back' ? p : { ...p, materialId: 'mat_walnut_18' }
    );
    viewerFixture.componentRef.setInput('parts', [updatedBoard, ...recoloredModParts]);
    viewerFixture.componentRef.setInput('selectedPartId', recoloredModParts[0].id);
    viewerFixture.detectChanges();

    const recoloredSide = internals.pieceObjects.find(
      item => item.part.groupId === mod.group.id && item.part.componentRole === 'side_left'
    )!;
    expect((recoloredSide.mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      walnutColorHex
    );
    expect(viewer.selectedPartIds()).toEqual(modPartIds);
    expect(internals.selectionOutlineGroup.visible).toBe(true);
  });

  it('MEJORA 4: colisiones conservan advertencia roja, resaltado de zona usa opacidad sutil (0.06..0.10, depthWrite: false), y deselección / ngOnDestroy liberan recursos GPU', () => {
    // 1) Dos tableros superpuestos provocando colisión real
    const collidingA: Part = {
      id: 'col_board_a',
      name: 'Tablero Colisión A',
      length: 600,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_oak_18',
      materialName: 'Melamina Roble Natural 18mm',
      orientation: 'horizontal',
      posX: 0,
      posY: 400,
      posZ: 0,
      groupId: 'grp_col',
      edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
      grain: 'length'
    };
    const collidingB: Part = {
      id: 'col_board_b',
      name: 'Tablero Colisión B',
      length: 600,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_15',
      materialName: 'Melamina Blanco Mate 15mm',
      orientation: 'vertical_yz',
      posX: 0,
      posY: 400,
      posZ: 0,
      groupId: 'grp_col',
      edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
      grain: 'length'
    };
    const colGroup: PartGroup = {
      id: 'grp_col',
      name: 'Grupo Colisión',
      type: 'assembly',
      isOpen: false
    };

    viewerFixture.componentRef.setInput('parts', [collidingA, collidingB]);
    viewerFixture.componentRef.setInput('partGroups', [colGroup]);
    viewerFixture.componentRef.setInput('selectedPartId', collidingA.id);
    viewerFixture.componentRef.setInput('selectedPartIds', [collidingA.id, collidingB.id]);
    viewerFixture.detectChanges();

    const itemA = internals.pieceObjects.find(i => i.part.id === collidingA.id)!;
    const colMat = itemA.mesh.material as THREE.MeshStandardMaterial;
    expect(colMat.color.getHex()).toBe(0xef4444);
    expect(colMat.emissive.getHex()).toBe(0x991b1b);

    const colEdge = itemA.mesh.children.find(
      c => c instanceof THREE.LineSegments
    ) as THREE.LineSegments;
    expect((colEdge.material as THREE.LineBasicMaterial).color.getHex()).toBe(0xef4444);
    expect(colEdge.scale.x).toBeCloseTo(1.001, 4);

    // 2) Verificar opacidad sutil (0.06..0.10) y depthWrite: false en zoneHighlightGroup
    const zoneBox: CabinetZoneHighlightBox = {
      zoneId: 'zone_subtle',
      minX: -300,
      maxX: 300,
      minY: 100,
      maxY: 700,
      minZ: -200,
      maxZ: 200
    };
    viewerFixture.componentRef.setInput('highlightedZoneBox', zoneBox);
    viewerFixture.detectChanges();

    expect(internals.zoneHighlightGroup.visible).toBe(true);
    expect(internals.zoneHighlightGroup.children.length).toBe(2);

    const fillMesh = internals.zoneHighlightGroup.children.find(
      c => c instanceof THREE.Mesh
    ) as THREE.Mesh;
    const edgeLines = internals.zoneHighlightGroup.children.find(
      c => c instanceof THREE.LineSegments
    ) as THREE.LineSegments;
    expect(fillMesh).toBeDefined();
    expect(edgeLines).toBeDefined();

    const fillMat = fillMesh.material as THREE.MeshBasicMaterial;
    expect(fillMat.color.getHex()).toBe(0x0284c7);
    expect(fillMat.transparent).toBe(true);
    expect(fillMat.opacity).toBeGreaterThanOrEqual(0.06);
    expect(fillMat.opacity).toBeLessThanOrEqual(0.1);
    expect(fillMat.depthWrite).toBe(false);

    const zoneEdgeMat = edgeLines.material as THREE.LineBasicMaterial;
    expect(zoneEdgeMat.color.getHex()).toBe(0x0284c7);
    expect(zoneEdgeMat.depthWrite).toBe(false);

    // 3) Deseleccionar (clearSelection) debe limpiar y hacer dispose() en GPU de selectionOutlineGroup
    expect(internals.selectionOutlineGroup.visible).toBe(true);
    expect(internals.selectionOutlineGroup.children.length).toBe(1);
    const outlineBeforeClear = internals.selectionOutlineGroup.children[0] as THREE.LineSegments;
    const outlineGeoDisposeSpy = vi.spyOn(outlineBeforeClear.geometry, 'dispose');
    const outlineMatDisposeSpy = vi.spyOn(
      outlineBeforeClear.material as THREE.Material,
      'dispose'
    );

    viewer.clearSelection();
    expect(outlineGeoDisposeSpy).toHaveBeenCalledTimes(1);
    expect(outlineMatDisposeSpy).toHaveBeenCalledTimes(1);
    expect(internals.selectionOutlineGroup.visible).toBe(false);
    expect(internals.selectionOutlineGroup.children.length).toBe(0);

    // 4) Re-crear selectionOutlineGroup + mantener zoneHighlightGroup y destruir el componente (ngOnDestroy)
    internals.updateSelectionHighlights([collidingA.id, collidingB.id], TEST_MATERIALS, false);
    expect(internals.selectionOutlineGroup.children.length).toBe(1);
    expect(internals.zoneHighlightGroup.children.length).toBe(2);

    const destroyOutline = internals.selectionOutlineGroup.children[0] as THREE.LineSegments;
    const destroyOutlineGeoSpy = vi.spyOn(destroyOutline.geometry, 'dispose');
    const destroyOutlineMatSpy = vi.spyOn(destroyOutline.material as THREE.Material, 'dispose');

    const destroyFillGeoSpy = vi.spyOn(fillMesh.geometry, 'dispose');
    const destroyFillMatSpy = vi.spyOn(fillMat, 'dispose');
    const destroyEdgeGeoSpy = vi.spyOn(edgeLines.geometry, 'dispose');
    const destroyEdgeMatSpy = vi.spyOn(zoneEdgeMat, 'dispose');

    viewerFixture.destroy();

    expect(destroyOutlineGeoSpy).toHaveBeenCalled();
    expect(destroyOutlineMatSpy).toHaveBeenCalled();
    expect(destroyFillGeoSpy).toHaveBeenCalled();
    expect(destroyFillMatSpy).toHaveBeenCalled();
    expect(destroyEdgeGeoSpy).toHaveBeenCalled();
    expect(destroyEdgeMatSpy).toHaveBeenCalled();
    expect(internals.selectionOutlineGroup.children.length).toBe(0);
    expect(internals.zoneHighlightGroup.children.length).toBe(0);
  });
});
