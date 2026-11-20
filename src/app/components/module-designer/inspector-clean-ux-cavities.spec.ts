import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CabinetZoneNode,
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { I18nService } from '../../services/i18n.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { PaymentService } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ModuleDesignerComponent } from './module-designer';

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
            frontMount: 'inset',
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
    code: 'CLOSET_A1_A4',
    name: 'Closet 3 Columnas Prueba',
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

function makeFreeManualBoard(
  id: string,
  name: string,
  posX: number,
  posY: number,
  posZ: number
): Part {
  return {
    id,
    name,
    length: 450,
    width: 380,
    thickness: 15,
    quantity: 1,
    materialId: 'mat_oak_18',
    materialName: 'Melamina Roble 18mm',
    grain: 'length',
    edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
    posX,
    posY,
    posZ,
    orientation: 'horizontal',
    componentRole: 'free',
    isParametricGenerated: false
  };
}

describe('ModuleDesignerComponent: Limpieza UX del Inspector, Vanos Libres y Unidad Solidaria (A1-A4)', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let partGeometry: PartGeometryService;
  let joineryEngine: JoineryEngineService;
  let confirmService: ConfirmDialogService;

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
        PartGeometryService,
        JoineryEngineService,
        ConfirmDialogService,
        TemplatesCatalogService,
        ThemeService,
        I18nService,
        { provide: PaymentService, useValue: paymentServiceStub }
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    partGeometry = TestBed.inject(PartGeometryService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    confirmService = TestBed.inject(ConfirmDialogService);

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

  const getInspectorText = (): string =>
    hostEl.querySelector('.md-inspector-panel')?.textContent ?? '';

  it(
    'A1: debe mostrar un inspector limpio para parametric-module sin Huecos / Vanos Libres ni controles planos rotos, conservando Asistente, Dimensiones, Material, Tiradores y Herrajes, Duplicar al Lado (+X) y Posición 3D',
    () => {
      const closet = cabinetGen.generateZoneCabinet(
        buildThreeColumnClosetConfig(),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      component.selectEntireGroup(closet.group.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expect(component.selectionContextType()).toBe('parametric-module');

      const inspectorText = getInspectorText();

      // Controles legacy eliminados en A1 + inyectores de vanos retirados en Hito 2A
      expect(inspectorText).not.toContain('Base del Mueble');
      expect(inspectorText).not.toContain('Flotante / Aéreo');
      expect(inspectorText).not.toContain('Configuración de Puerta y Apertura');
      expect(inspectorText).not.toContain('Repisas:');
      expect(inspectorText).not.toContain('Barras Colgador:');
      expect(inspectorText).not.toContain('Huecos / Vanos Libres');

      // Secciones obligatorias conservadas en A1 + estilos globales Hito 2A
      expect(inspectorText).toContain('Editar Estructura del Módulo (Asistente)');
      expect(inspectorText).toContain('Dimensiones');
      expect(inspectorText).toContain('Material del Módulo');
      expect(inspectorText).toContain('Tiradores y Herrajes');
      expect(inspectorText).toContain('Duplicar al Lado (+X)');
      expect(inspectorText).toContain('Posición 3D');
    },
    20000
  );

  it(
    'A2: debe listar solo cavidades 100% libres (excluyendo bahías con cajones o Tubo Colgador) y sincronizar solidariamente rotación, traslación, duplicación y eliminación de cajones hospedados',
    () => {
      const closet = cabinetGen.generateZoneCabinet(
        buildThreeColumnClosetConfig(),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      // Verificar que existe el Tubo Colgador en la bahía 3
      const rodPart = projectService
        .partsList()
        .find(
          p =>
            p.groupId === closet.group.id &&
            (p.materialId === 'hw_rod_chrome' || /tubo colgador/i.test(p.name))
        );
      expect(rodPart).toBeDefined();

      component.selectEntireGroup(closet.group.id);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      const initialCavities = component.selectedModuleCavities();
      // Bahía 1 tiene 3 repisas => 4 vanos libres; Bahía 2 (2 cajones) y Bahía 3 (Tubo Colgador) quedan excluidas
      expect(initialCavities.length).toBe(4);
      expect(initialCavities.every(c => c.bayIndex === 0)).toBe(true);
      expect(initialCavities.every(c => (c.existingDrawerCount ?? 0) === 0)).toBe(true);
      expect(initialCavities.some(c => c.bayIndex === 1)).toBe(false);
      expect(initialCavities.some(c => c.bayIndex === 2)).toBe(false);

      // Rellenar un vano libre con 2 cajones mediante quickFillCavityWithDrawers
      const targetFreeCavity = initialCavities[0];
      component.quickFillCavityWithDrawers(targetFreeCavity, 2, 'overlay');
      fixture.detectChanges();

      const hostedDrawers = projectService
        .groupsList()
        .filter(g => g.hostGroupId === closet.group.id);
      expect(hostedDrawers.length).toBe(2);

      // El vano rellenado ya no debe figurar en selectedModuleCavities()
      component.selectEntireGroup(closet.group.id);
      fixture.detectChanges();
      const afterFillCavities = component.selectedModuleCavities();
      expect(afterFillCavities.length).toBe(initialCavities.length - 1);
      expect(afterFillCavities.some(c => c.id === targetFreeCavity.id)).toBe(false);

      // Rotación solidaria de 90° del módulo anfitrión junto con sus cajones hospedados
      component.rotateSelectedGroup(90);
      fixture.detectChanges();

      const rotatedClosetGroup = projectService
        .groupsList()
        .find(g => g.id === closet.group.id);
      expect(rotatedClosetGroup?.facingDirection).toBe('right');

      for (const hd of hostedDrawers) {
        const updatedHd = projectService.groupsList().find(g => g.id === hd.id);
        expect(updatedHd?.facingDirection).toBe('right');
        const liveCfg = projectService.getModularDrawerConfig(hd.id);
        expect(liveCfg?.facingDirection).toBe('right');
      }

      const allClosetAndHostedParts = projectService
        .partsList()
        .filter(
          p =>
            p.groupId === closet.group.id ||
            hostedDrawers.some(hd => hd.id === p.groupId)
        );
      expect(joineryEngine.detectCollisions(allClosetAndHostedParts).length).toBe(0);

      // Traslación solidaria del módulo anfitrión y sus cajones hospedados
      const closetPartBeforeMove = projectService
        .partsList()
        .find(p => p.groupId === closet.group.id && p.componentRole === 'side_left')!;
      const hostedPartBeforeMove = projectService
        .partsList()
        .find(p => p.groupId === hostedDrawers[0].id && p.componentRole === 'drawer_front')!;
      const drawerCfgBeforeMove = projectService.getModularDrawerConfig(hostedDrawers[0].id)!;

      const preClosetX = closetPartBeforeMove.posX ?? 0;
      const preClosetZ = closetPartBeforeMove.posZ ?? 0;
      const preHostedX = hostedPartBeforeMove.posX ?? 0;
      const preHostedZ = hostedPartBeforeMove.posZ ?? 0;

      projectService.moveGroup(closet.group.id, 250, 0, -120);
      fixture.detectChanges();

      const closetPartAfterMove = projectService
        .partsList()
        .find(p => p.id === closetPartBeforeMove.id)!;
      const hostedPartAfterMove = projectService
        .partsList()
        .find(p => p.id === hostedPartBeforeMove.id)!;
      const drawerCfgAfterMove = projectService.getModularDrawerConfig(hostedDrawers[0].id)!;

      expect(closetPartAfterMove.posX).toBeCloseTo(preClosetX + 250, 1);
      expect(closetPartAfterMove.posZ).toBeCloseTo(preClosetZ - 120, 1);
      expect(hostedPartAfterMove.posX).toBeCloseTo(preHostedX + 250, 1);
      expect(hostedPartAfterMove.posZ).toBeCloseTo(preHostedZ - 120, 1);
      expect(drawerCfgAfterMove.posX).toBeCloseTo((drawerCfgBeforeMove.posX ?? 0) + 250, 1);
      expect(drawerCfgAfterMove.posZ).toBeCloseTo((drawerCfgBeforeMove.posZ ?? 0) - 120, 1);

      // Duplicación solidaria: clona el clóset y también sus 2 cajones hospedados
      const dupResult = projectService.duplicateGroup(closet.group.id);
      expect(dupResult).not.toBeNull();
      const duplicatedHostedDrawers = projectService
        .groupsList()
        .filter(g => g.hostGroupId === dupResult!.newGroup.id);
      expect(duplicatedHostedDrawers.length).toBe(2);

      // Eliminación solidaria del módulo duplicado junto con sus cajones hospedados
      projectService.deleteGroup(dupResult!.newGroup.id);
      expect(
        projectService.groupsList().some(g => g.hostGroupId === dupResult!.newGroup.id)
      ).toBe(false);
    },
    20000
  );

  it(
    'A3: debe detectar contención espacial 3D de un tablero manual dentro del módulo, ofrecer botón Vincular al Módulo y gestionar confirmación aceptar/rechazar sin bucles de re-pregunta',
    async () => {
      const closet = cabinetGen.generateZoneCabinet(
        buildThreeColumnClosetConfig(),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      // Crear tablero libre manual dentro del AABB del clóset (bahía 1: X aprox -600, Y 500, Z 0)
      const freePart = makeFreeManualBoard('free_board_inside', 'Entrepaño Manual Extra', -580, 520, 0);
      projectService.addPart(freePart);
      fixture.detectChanges();

      const containmentMatch = partGeometry.findContainingModuleGroup(
        freePart,
        projectService.partsList(),
        projectService.groupsList()
      );
      expect(containmentMatch).not.toBeNull();
      expect(containmentMatch?.group.id).toBe(closet.group.id);
      expect(containmentMatch?.overlapRatio ?? 0).toBeGreaterThanOrEqual(0.45);

      // Seleccionar la pieza libre y verificar card contextual en el inspector 'single-piece'
      component.onPartsSelectedFrom3D([freePart.id]);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expect(component.selectionContextType()).toBe('single-piece');
      expect(component.selectedPartContainingModule()?.group.id).toBe(closet.group.id);
      expect(getInspectorText()).toContain('Vincular al Módulo');

      // Caso 1: usuario rechaza vinculación (Promise.resolve(false)) -> queda suelta y no vuelve a preguntar dentro del mismo módulo
      const askSpy = vi.spyOn(confirmService, 'ask').mockResolvedValue(false);

      component.onPartModifiedFromViewer({
        part: freePart,
        updates: { posY: 540 }
      });
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(askSpy).toHaveBeenCalledTimes(1);
      expect(
        projectService.partsList().find(p => p.id === freePart.id)?.groupId
      ).toBeUndefined();

      // Segundo movimiento dentro del mismo módulo: NO debe re-preguntar
      component.onPartModifiedFromViewer({
        part: projectService.partsList().find(p => p.id === freePart.id)!,
        updates: { posY: 560 }
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(askSpy).toHaveBeenCalledTimes(1);

      // Mover fuera del módulo limpia la clave declinada
      component.onPartModifiedFromViewer({
        part: projectService.partsList().find(p => p.id === freePart.id)!,
        updates: { posX: 2400 }
      });
      await Promise.resolve();
      await Promise.resolve();

      // Caso 2: volver a meter la pieza dentro del módulo y aceptar (Promise.resolve(true))
      askSpy.mockResolvedValue(true);
      component.onPartModifiedFromViewer({
        part: projectService.partsList().find(p => p.id === freePart.id)!,
        updates: { posX: -580, posY: 540 }
      });
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(askSpy).toHaveBeenCalledTimes(2);
      const linkedPart = projectService.partsList().find(p => p.id === freePart.id)!;
      expect(linkedPart.groupId).toBe(closet.group.id);
      expect(linkedPart.isParametricGenerated).toBe(false);

      // Al rotar el módulo, la pieza manual vinculada debe rotar solidariamente con él
      const oldLen = linkedPart.length;
      const oldWid = linkedPart.width;
      const oldPosX = linkedPart.posX ?? 0;

      projectService.rotateGroupRigidly(closet.group.id, 90);
      fixture.detectChanges();

      const rotatedLinkedPart = projectService.partsList().find(p => p.id === freePart.id)!;
      expect(rotatedLinkedPart.length).toBe(oldWid);
      expect(rotatedLinkedPart.width).toBe(oldLen);
      expect(rotatedLinkedPart.posZ).toBeCloseTo(-oldPosX, 0);
    },
    20000
  );

  it(
    'A4: debe ocultar controles destructivos en single-piece para piezas estructurales de módulo/cajón y mostrarlos únicamente en tableros libres sin grupo',
    () => {
      const closet = cabinetGen.generateZoneCabinet(
        buildThreeColumnClosetConfig(),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      const drawerFront = projectService
        .partsList()
        .find(p => p.groupId === closet.group.id && p.componentRole === 'drawer_front');
      expect(drawerFront).toBeDefined();

      // Seleccionar un único frente de cajón dentro del clóset
      component.onPartsSelectedFrom3D([drawerFront!.id]);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expect(component.selectionContextType()).toBe('single-piece');
      expect(component.isSelectedPartStructuredMember()).toBe(true);

      const structuredInspectorText = getInspectorText();

      // Controles ocultos para miembros estructurales de módulo o cajón
      expect(structuredInspectorText).not.toContain('Disposición en el Mueble');
      expect(structuredInspectorText).not.toContain('Lateral (YZ)');
      expect(structuredInspectorText).not.toContain('Cortes Especiales');
      expect(structuredInspectorText).not.toContain('Al Suelo');
      expect(structuredInspectorText).not.toContain('Centrar X');
      expect(structuredInspectorText).not.toContain('Centrar Z');
      expect(structuredInspectorText).not.toContain('GIRO X');
      expect(structuredInspectorText).not.toContain('GIRO Y');
      expect(structuredInspectorText).not.toContain('GIRO Z');
      expect(structuredInspectorText).not.toContain('Posición 3D');

      // Controles visibles permitidos en pieza de módulo/cajón
      expect(structuredInspectorText).toContain('Medidas');
      expect(structuredInspectorText).toContain('Largo');
      expect(structuredInspectorText).toContain('Ancho');
      expect(structuredInspectorText).toContain('Espesor');
      expect(structuredInspectorText).toContain('Material y Tapacantos');
      expect(structuredInspectorText).toContain('Seleccionar Módulo Completo');

      // Guard programático: setPartOrientation('horizontal') NO debe acostar el frente de cajón
      const originalOrientation = drawerFront!.orientation;
      component.setPartOrientation('horizontal');
      fixture.detectChanges();
      const afterOrientAttempt = projectService
        .partsList()
        .find(p => p.id === drawerFront!.id)!;
      expect(afterOrientAttempt.orientation).toBe(originalOrientation);
      expect(afterOrientAttempt.orientation).not.toBe('horizontal');

      // Guard programático: rotateSelectedPart90('y') rota el módulo padre en bloque en vez de volcar la pieza sola
      component.rotateSelectedPart90('y');
      fixture.detectChanges();
      const rotatedParentGroup = projectService
        .groupsList()
        .find(g => g.id === closet.group.id);
      expect(rotatedParentGroup?.facingDirection).toBe('right');
      const afterRotatePart = projectService
        .partsList()
        .find(p => p.id === drawerFront!.id)!;
      expect(afterRotatePart.orientation).toBe('vertical_yz');

      // Seleccionar un tablero verdaderamente libre (!part.groupId, componentRole: 'free') fuera del módulo
      const freeBoard = makeFreeManualBoard('truly_free_board', 'Tablero Libre Independiente', 2200, 300, 0);
      projectService.addPart(freeBoard);
      component.onPartsSelectedFrom3D([freeBoard.id]);
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      expect(component.selectionContextType()).toBe('single-piece');
      expect(component.isSelectedPartStructuredMember()).toBe(false);

      const freeInspectorText = getInspectorText();
      expect(freeInspectorText).toContain('Disposición en el Mueble');
      expect(freeInspectorText).toContain('Cortes Especiales');
      expect(freeInspectorText).toContain('Posición 3D');
      expect(freeInspectorText).toContain('Giro 3D');
    },
    20000
  );
});
