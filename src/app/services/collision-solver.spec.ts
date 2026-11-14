import { TestBed } from '@angular/core/testing';
import {
  CollisionFixOption,
  Material,
  ParametricCabinetConfig,
  Part
} from '../models/melamine.models';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { ProjectStorageService } from './project-storage.service';

const TEST_MATERIALS: Material[] = [
  {
    id: 'mat_white_18',
    name: 'Blanco Frost 18mm',
    colorHex: '#f8fafc',
    thickness: 18,
    category: 'board',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 45000,
    hasGrain: false
  },
  {
    id: 'mat_back_3',
    name: 'Fondo MDF Blanco 3mm',
    colorHex: '#ffffff',
    thickness: 3,
    category: 'mdf',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 18000,
    hasGrain: false
  }
];

function makePart(overrides: Partial<Part> & { id: string; name: string }): Part {
  return {
    length: 600,
    width: 600,
    thickness: 18,
    quantity: 1,
    materialId: 'mat_white_18',
    materialName: 'Blanco Frost 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 9,
    posZ: 0,
    orientation: 'horizontal',
    componentRole: 'free',
    ...overrides
  };
}

function buildTableOverlapScenario(): Part[] {
  const leftSide = makePart({
    id: 'side_left',
    name: 'LATERAL IZQUIERDO',
    orientation: 'vertical_yz',
    componentRole: 'side_left',
    length: 850,
    width: 600,
    thickness: 18,
    posX: -291,
    posY: 425,
    posZ: 0
  });

  const rightSide = makePart({
    id: 'side_right',
    name: 'LATERAL DERECHO',
    orientation: 'vertical_yz',
    componentRole: 'side_right',
    length: 850,
    width: 600,
    thickness: 18,
    posX: 291,
    posY: 425,
    posZ: 0
  });

  // Tapa superior de 600x600x18 invadiendo 15 mm hacia abajo en ambos costados (minY = 835 < 850)
  const topPanel = makePart({
    id: 'top_panel',
    name: 'TAPA SUPERIOR',
    orientation: 'horizontal',
    componentRole: 'top',
    length: 600,
    width: 600,
    thickness: 18,
    posX: 0,
    posY: 844,
    posZ: 0
  });

  return [leftSide, rightSide, topPanel];
}

describe('Motor de Resolución Automática de Colisiones 1-Clic y Undo Transaccional', () => {
  let joineryEngine: JoineryEngineService;
  let partGeometry: PartGeometryService;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        JoineryEngineService,
        PartGeometryService,
        ProjectStorageService,
        CabinetGeneratorService
      ]
    });

    joineryEngine = TestBed.inject(JoineryEngineService);
    partGeometry = TestBed.inject(PartGeometryService);
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    projectService.clearHistory();
  });

  it('resuelve mesa de 3 piezas (laterales 850mm + tapa invadiendo 15mm) con 1 clic en Y y restaura con Undo', () => {
    const parts = buildTableOverlapScenario();
    projectService.updateProject(
      p => ({
        ...p,
        materials: TEST_MATERIALS,
        parts,
        groups: []
      }),
      false
    );
    projectService.clearHistory();

    const initialCollisions = joineryEngine.detectCollisions(projectService.currentProject().parts);
    expect(initialCollisions.length).toBe(2);

    const plans = joineryEngine.buildCollisionResolutionPlans(
      projectService.currentProject().parts,
      initialCollisions
    );
    expect(plans.length).toBe(2);

    for (const plan of plans) {
      expect(plan.canFix).toBe(true);
      expect(plan.focusPartId).toBe('top_panel');
      expect(plan.primaryFix).not.toBeNull();
      expect(plan.primaryFix!.axis).toBe('y');
      expect(plan.primaryFix!.direction).toBe(1);
      expect(plan.primaryFix!.deltaMm).toBe(15);
      expect(plan.primaryFix!.absDeltaMm).toBe(15);
      expect(plan.primaryFix!.targetPartId).toBe('top_panel');
      expect(plan.primaryFix!.buttonLabel).toBe('Corregir: Subir +15 mm');
      expect(plan.primaryFix!.shortReason).toContain('Sugerencia: apoyar sobre');
      expect(plan.primaryFix!.actionText).toBe('Subir TAPA SUPERIOR +15 mm (Apoyar encima)');

      expect(plan.secondaryFix).not.toBeNull();
      expect(plan.secondaryFix!.axis).toBe('x');
      expect(plan.secondaryFix!.buttonLabel).toBe('Ajustar al lado (X)');
    }

    const applied = projectService.applyCollisionFix(plans[0].primaryFix!);
    expect(applied).toBe(true);
    expect(projectService.canUndo()).toBe(true);

    const updatedTop = projectService.currentProject().parts.find(p => p.id === 'top_panel')!;
    const updatedTopBounds = partGeometry.getWorldAABB(updatedTop);
    expect(updatedTopBounds.minY).toBe(850);
    expect(updatedTop.posY).toBe(859);

    const postCollisions = joineryEngine.detectCollisions(projectService.currentProject().parts);
    expect(postCollisions.length).toBe(0);

    // Undo restaura exactamente los 2 solapamientos originales
    projectService.undo();
    const restoredTop = projectService.currentProject().parts.find(p => p.id === 'top_panel')!;
    expect(restoredTop.posY).toBe(844);
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(2);

    // Redo vuelve a aplicar la corrección limpia
    projectService.redo();
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(0);
  });

  it('resolveAllProjectCollisions resuelve mesa en 1 paso y cascadas multipieza con 1 único snapshot Undo', () => {
    const tableParts = buildTableOverlapScenario();
    projectService.updateProject(
      p => ({
        ...p,
        materials: TEST_MATERIALS,
        parts: tableParts,
        groups: []
      }),
      false
    );
    projectService.clearHistory();

    const tableSummary = projectService.resolveAllProjectCollisions();
    expect(tableSummary).toEqual({
      resolvedCount: 2,
      stepsApplied: 1,
      remainingCount: 0
    });
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(0);
    expect(projectService.canUndo()).toBe(true);

    // 1 solo Undo revierte ambos solapamientos
    projectService.undo();
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(2);

    // Cascada multipieza: mesa + entrepaño invadiendo costado izq + base invadiendo costado der + bloque encadenado
    const cascadeShelf = makePart({
      id: 'shelf_mid',
      name: 'ENTREPAÑO',
      orientation: 'horizontal',
      componentRole: 'shelf',
      length: 564,
      width: 560,
      thickness: 18,
      posX: -12, // invadiendo lateral izquierdo (-282) en 12 mm
      posY: 400,
      posZ: 0
    });
    const cascadeBottom = makePart({
      id: 'bottom_base',
      name: 'PISO INFERIOR',
      orientation: 'horizontal',
      componentRole: 'bottom',
      length: 564,
      width: 560,
      thickness: 18,
      posX: 10, // invadiendo lateral derecho (+282) en 10 mm
      posY: 9,
      posZ: 0
    });

    projectService.updateProject(
      p => ({
        ...p,
        parts: [...buildTableOverlapScenario(), cascadeShelf, cascadeBottom],
        groups: []
      }),
      false
    );
    projectService.clearHistory();

    const beforeCascade = joineryEngine.detectCollisions(projectService.currentProject().parts);
    expect(beforeCascade.length).toBe(4);

    const cascadeResult = projectService.resolveAllProjectCollisions();
    expect(cascadeResult.resolvedCount).toBe(4);
    expect(cascadeResult.remainingCount).toBe(0);
    expect(cascadeResult.stepsApplied).toBeGreaterThanOrEqual(2);
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(0);

    // 1 único Undo atómico revierte toda la cascada
    projectService.undo();
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(4);
  });

  it('entrepaño intermedio invadiendo un costado en X se desplaza limpiamente sobre el eje X', () => {
    const leftSide = makePart({
      id: 'side_l',
      name: 'LATERAL IZQUIERDO',
      orientation: 'vertical_yz',
      componentRole: 'side_left',
      length: 850,
      width: 500,
      thickness: 18,
      posX: -291,
      posY: 425,
      posZ: 0
    });
    const shelf = makePart({
      id: 'shelf_1',
      name: 'ENTREPAÑO',
      orientation: 'horizontal',
      componentRole: 'shelf',
      length: 564,
      width: 480,
      thickness: 18,
      posX: -14, // minX = -296, invade lateral (-282) por 14 mm
      posY: 420,
      posZ: 0
    });

    const parts = [leftSide, shelf];
    const collisions = joineryEngine.detectCollisions(parts);
    expect(collisions.length).toBe(1);

    const plans = joineryEngine.buildCollisionResolutionPlans(parts, collisions);
    expect(plans.length).toBe(1);
    const fix = plans[0].primaryFix!;
    expect(fix).not.toBeNull();
    expect(fix.targetPartId).toBe('shelf_1');
    expect(fix.axis).toBe('x');
    expect(fix.direction).toBe(1);
    expect(fix.deltaMm).toBe(14);
    expect(fix.buttonLabel).toBe('Corregir: Mover X +14 mm');
    expect(fix.shortReason).toBe('Sugerencia: alinear al costado');

    // No debe sugerir Y (+430mm al techo) como secondaryFix
    expect(plans[0].secondaryFix).toBeNull();

    const updates = joineryEngine.computePartUpdateForFix(shelf, fix)!;
    const fixedParts = [leftSide, { ...shelf, ...updates }];
    expect(joineryEngine.detectCollisions(fixedParts).length).toBe(0);
    expect(partGeometry.getWorldAABB(fixedParts[1]).minX).toBe(-282);
  });

  it('respeta isLocked (mueve la pieza libre y bloquea cuando ambas piezas están congeladas)', () => {
    const lockedTop = makePart({
      id: 'locked_top',
      name: 'TAPA SUPERIOR',
      orientation: 'horizontal',
      componentRole: 'top',
      length: 600,
      width: 600,
      thickness: 18,
      posX: 0,
      posY: 844,
      posZ: 0,
      isLocked: true
    });
    const unlockedSide = makePart({
      id: 'unlocked_side',
      name: 'LATERAL IZQUIERDO',
      orientation: 'vertical_yz',
      componentRole: 'side_left',
      length: 850,
      width: 600,
      thickness: 18,
      posX: -291,
      posY: 425,
      posZ: 0,
      isLocked: false
    });

    projectService.updateProject(
      p => ({
        ...p,
        parts: [unlockedSide, lockedTop],
        groups: []
      }),
      false
    );
    projectService.clearHistory();

    const plans = joineryEngine.buildCollisionResolutionPlans([unlockedSide, lockedTop]);
    expect(plans.length).toBe(1);
    expect(plans[0].canFix).toBe(true);
    expect(plans[0].primaryFix!.targetPartId).toBe('unlocked_side');
    expect(plans[0].primaryFix!.anchorPartId).toBe('locked_top');
    // Como bajar el costado (-15mm) violaría minY >= 0, debe desplazar el costado en X (-18mm)
    expect(plans[0].primaryFix!.axis).toBe('x');
    expect(plans[0].primaryFix!.deltaMm).toBe(-18);

    // No debe aplicar un fix cuyo objetivo esté bloqueado
    const forgedLockedFix: CollisionFixOption = {
      ...plans[0].primaryFix!,
      targetPartId: 'locked_top',
      targetPartName: 'TAPA SUPERIOR'
    };
    expect(projectService.applyCollisionFix(forgedLockedFix)).toBe(false);

    // Aplicar el fix válido mueve solo la pieza desbloqueada
    expect(projectService.applyCollisionFix(plans[0].primaryFix!)).toBe(true);
    const afterTop = projectService.currentProject().parts.find(p => p.id === 'locked_top')!;
    expect(afterTop.posY).toBe(844);
    expect(joineryEngine.detectCollisions(projectService.currentProject().parts).length).toBe(0);

    // Ambas bloqueadas -> canFix: false y resolveAllProjectCollisions no modifica ni guarda snapshot
    const bothLocked = [
      { ...unlockedSide, isLocked: true },
      { ...lockedTop, isLocked: true }
    ];
    projectService.updateProject(
      p => ({
        ...p,
        parts: bothLocked,
        groups: []
      }),
      false
    );
    projectService.clearHistory();

    const lockedPlans = joineryEngine.buildCollisionResolutionPlans(bothLocked);
    expect(lockedPlans.length).toBe(1);
    expect(lockedPlans[0].canFix).toBe(false);
    expect(lockedPlans[0].primaryFix).toBeNull();
    expect(lockedPlans[0].secondaryFix).toBeNull();

    const lockedSummary = projectService.resolveAllProjectCollisions();
    expect(lockedSummary).toEqual({
      resolvedCount: 0,
      stepsApplied: 0,
      remainingCount: 1
    });
    expect(projectService.canUndo()).toBe(false);
  });

  it('garantiza la restricción de piso (minY >= 0) y previene que ninguna pieza baje del suelo', () => {
    // Pieza inferior apoyada en Y=5..23 colisionando con otra pieza superior en Y=15..33
    const lowBoard = makePart({
      id: 'low_board',
      name: 'BASE BAJA',
      length: 600,
      width: 500,
      thickness: 18,
      posX: 0,
      posY: 14, // minY = 5, maxY = 23
      posZ: 0
    });
    const upperBoard = makePart({
      id: 'upper_board',
      name: 'TABLERO SUPERIOR',
      length: 600,
      width: 500,
      thickness: 18,
      posX: 0,
      posY: 24, // minY = 15, maxY = 33
      posZ: 0,
      isLocked: true
    });

    const plans = joineryEngine.buildCollisionResolutionPlans([lowBoard, upperBoard]);
    expect(plans.length).toBe(1);
    expect(plans[0].canFix).toBe(true);
    // Bajar low_board por -18mm dejaría minY = -13 < 0, por lo que debe elegir subir +28mm (minY = 33)
    expect(plans[0].primaryFix!.axis).toBe('y');
    expect(plans[0].primaryFix!.direction).toBe(1);
    expect(plans[0].primaryFix!.deltaMm).toBe(28);

    // Incluso forzando un fix negativo en Y sobre applyCollisionFix, el clamp garantiza minY >= 0
    projectService.updateProject(
      p => ({
        ...p,
        parts: [lowBoard],
        groups: []
      }),
      false
    );
    const forcedDownFix: CollisionFixOption = {
      axis: 'y',
      direction: -1,
      deltaMm: -50,
      absDeltaMm: 50,
      targetPartId: 'low_board',
      targetPartName: 'BASE BAJA',
      anchorPartId: 'upper_board',
      anchorPartName: 'TABLERO SUPERIOR',
      buttonLabel: 'Corregir: Bajar -50 mm',
      shortReason: 'Test',
      actionText: 'Test'
    };
    expect(projectService.applyCollisionFix(forcedDownFix)).toBe(true);
    const clampedPart = projectService.currentProject().parts.find(p => p.id === 'low_board')!;
    const clampedBounds = partGeometry.getWorldAABB(clampedPart);
    expect(clampedBounds.minY).toBeGreaterThanOrEqual(0);
    expect(clampedBounds.minY).toBe(0);
  });

  it('resuelve solapamientos en profundidad (eje Z) y mantiene 0 regresiones en módulos paramétricos', () => {
    const sidePanel = makePart({
      id: 'side_z',
      name: 'LATERAL IZQUIERDO',
      orientation: 'vertical_yz',
      componentRole: 'side_left',
      length: 800,
      width: 560,
      thickness: 18,
      posX: -291,
      posY: 400,
      posZ: 0 // Z: [-280, +280]
    });
    const doorPanel = makePart({
      id: 'door_z',
      name: 'PUERTA FRONTAL',
      orientation: 'vertical_xy',
      componentRole: 'door',
      length: 596,
      width: 794,
      thickness: 18,
      posX: 0,
      posY: 400,
      posZ: 279 // Z: [270, 288] -> invade costado en 10 mm en Z
    });

    const zCollisions = joineryEngine.detectCollisions([sidePanel, doorPanel]);
    expect(zCollisions.length).toBe(1);
    expect(zCollisions[0].overlapZ).toBe(10);

    const zPlans = joineryEngine.buildCollisionResolutionPlans([sidePanel, doorPanel], zCollisions);
    expect(zPlans.length).toBe(1);
    expect(zPlans[0].canFix).toBe(true);
    expect(zPlans[0].primaryFix!.targetPartId).toBe('door_z');
    expect(zPlans[0].primaryFix!.axis).toBe('z');
    expect(zPlans[0].primaryFix!.direction).toBe(1);
    expect(zPlans[0].primaryFix!.deltaMm).toBe(10);
    expect(zPlans[0].primaryFix!.buttonLabel).toBe('Corregir: Mover Z +10 mm');

    const upd = joineryEngine.computePartUpdateForFix(doorPanel, zPlans[0].primaryFix!)!;
    const resolvedDoor = { ...doorPanel, ...upd };
    expect(joineryEngine.detectCollisions([sidePanel, resolvedDoor]).length).toBe(0);
    expect(partGeometry.getWorldAABB(resolvedDoor).minZ).toBe(280);

    // Verificar 0 regresiones en un módulo paramétrico estándar sin colisiones
    const config: ParametricCabinetConfig = {
      code: 'MOD_BASE_CLEAN',
      name: 'Módulo Base Limpio',
      moduleType: 'base_cabinet',
      category: 'kitchen_base',
      width: 600,
      height: 800,
      depth: 560,
      structureThickness: 18,
      doorThickness: 18,
      backThickness: 3,
      backType: 'groove',
      shelvesCount: 1,
      doorOpening: 'left',
      structureMaterialId: 'mat_white_18',
      doorMaterialId: 'mat_white_18',
      backMaterialId: 'mat_back_3',
      handleType: 'bar_modern',
      handleFinish: 'chrome',
      facadeGap: 3,
      posX: 0,
      posY: 0,
      posZ: 0
    };
    const cab = cabinetGen.generateParametricCabinet(config, TEST_MATERIALS);
    expect(joineryEngine.detectCollisions(cab.parts).length).toBe(0);
    expect(joineryEngine.buildCollisionResolutionPlans(cab.parts)).toEqual([]);
  });

  it('detiene de forma segura una escena bloqueada por oscilación entre dos topes congelados', () => {
    const leftWall = makePart({
      id: 'wall_l',
      name: 'MURO IZQ',
      orientation: 'vertical_yz',
      length: 850,
      width: 500,
      thickness: 18,
      posX: -200, // [-209, -191]
      posY: 425,
      posZ: 0,
      isLocked: true
    });
    const rightWall = makePart({
      id: 'wall_r',
      name: 'MURO DER',
      orientation: 'vertical_yz',
      length: 850,
      width: 500,
      thickness: 18,
      posX: 200, // [191, 209]
      posY: 425,
      posZ: 0,
      isLocked: true
    });
    // Tablero demasiado ancho (420 mm) entre luz de 382 mm: no cabe entre ambos muros congelados
    const oversizedBoard = makePart({
      id: 'oversized_shelf',
      name: 'TABLERO SOBREDIMENSIONADO',
      orientation: 'horizontal',
      length: 420,
      width: 480,
      thickness: 18,
      posX: 0, // [-210, +210]
      posY: 420,
      posZ: 0
    });

    const res = joineryEngine.resolveAllCollisionsIteratively([
      leftWall,
      rightWall,
      oversizedBoard
    ]);
    expect(res.stepsApplied).toBeLessThanOrEqual(24);
    expect(res.updatedParts.length).toBe(3);
  });

  it('maneja colisión cercana al piso (desliza H en X si overlapX <= overlapY o sube pieza más alta en +Y)', () => {
    const floorSide = makePart({
      id: 'floor_side',
      name: 'LATERAL PISO',
      orientation: 'vertical_yz',
      length: 850,
      width: 500,
      thickness: 18,
      posX: -291, // [-300, -282]
      posY: 425,
      posZ: 0
    });
    const bottomSmallOverlap = makePart({
      id: 'bottom_x',
      name: 'PISO INFERIOR',
      orientation: 'horizontal',
      length: 564,
      width: 500,
      thickness: 18,
      posX: -12, // [-294, +270] -> overlapX = 12 <= overlapY = 18
      posY: 9,
      posZ: 0
    });

    const plansX = joineryEngine.buildCollisionResolutionPlans([floorSide, bottomSmallOverlap]);
    expect(plansX.length).toBe(1);
    expect(plansX[0].primaryFix!.targetPartId).toBe('bottom_x');
    expect(plansX[0].primaryFix!.axis).toBe('x');
    expect(plansX[0].primaryFix!.deltaMm).toBe(12);

    // Cuando overlapX > overlapY (ej. lateral apoyado encima invadiendo en Y 10mm con overlapX = 18mm), sube el lateral (+Y)
    const liftedSide = makePart({
      id: 'lifted_side',
      name: 'LATERAL ALTO',
      orientation: 'vertical_yz',
      length: 850,
      width: 500,
      thickness: 18,
      posX: -291, // [-300, -282]
      posY: 433, // [8, 858] -> invade piso [0, 18] por overlapY = 10mm < overlapX = 18mm
      posZ: 0
    });
    const fullBottom = makePart({
      id: 'full_bottom',
      name: 'PISO PASANTE',
      orientation: 'horizontal',
      length: 600,
      width: 500,
      thickness: 18,
      posX: 0, // [-300, +300]
      posY: 9, // [0, 18]
      posZ: 0
    });

    const plansY = joineryEngine.buildCollisionResolutionPlans([liftedSide, fullBottom]);
    expect(plansY.length).toBe(1);
    expect(plansY[0].primaryFix!.targetPartId).toBe('lifted_side');
    expect(plansY[0].primaryFix!.axis).toBe('y');
    expect(plansY[0].primaryFix!.direction).toBe(1);
    expect(plansY[0].primaryFix!.deltaMm).toBe(10);
  });

  it('ancla piezas agrupadas sobre piezas sueltas, resuelve cadenas dominó y elimina residuales decimales', () => {
    const groupedPart = makePart({
      id: 'grouped_a',
      name: 'MÓDULO AGRUPADO',
      groupId: 'grp_1',
      length: 400,
      width: 400,
      thickness: 18,
      posX: 0, // [-200, 200]
      posY: 500,
      posZ: 0
    });
    const ungroupedPart = makePart({
      id: 'loose_b',
      name: 'PIEZA SUELTA',
      length: 400,
      width: 400,
      thickness: 18,
      posX: 389.73, // [189.73, 589.73] -> overlapX = 10.27 mm
      posY: 500,
      posZ: 0
    });

    const groupPlans = joineryEngine.buildCollisionResolutionPlans([groupedPart, ungroupedPart]);
    expect(groupPlans.length).toBe(1);
    expect(groupPlans[0].primaryFix!.targetPartId).toBe('loose_b');
    expect(groupPlans[0].primaryFix!.anchorPartId).toBe('grouped_a');
    expect(groupPlans[0].primaryFix!.axis).toBe('x');
    expect(groupPlans[0].primaryFix!.deltaMm).toBe(10.27);

    const looseUpd = joineryEngine.computePartUpdateForFix(ungroupedPart, groupPlans[0].primaryFix!)!;
    const fixedLoose = { ...ungroupedPart, ...looseUpd };
    expect(partGeometry.getWorldAABB(fixedLoose).minX).toBeGreaterThanOrEqual(200);
    expect(joineryEngine.detectCollisions([groupedPart, fixedLoose]).length).toBe(0);

    // Cadena dominó A(locked) - B - C
    const chainA = makePart({
      id: 'chain_a',
      name: 'PIEZA A',
      length: 100,
      width: 200,
      thickness: 18,
      posX: 50, // [0, 100]
      posY: 9,
      posZ: 0,
      isLocked: true
    });
    const chainB = makePart({
      id: 'chain_b',
      name: 'PIEZA B',
      length: 100,
      width: 200,
      thickness: 18,
      posX: 140, // [90, 190] -> choca A (10mm) y C (5mm)
      posY: 9,
      posZ: 0
    });
    const chainC = makePart({
      id: 'chain_c',
      name: 'PIEZA C',
      length: 100,
      width: 200,
      thickness: 18,
      posX: 235, // [185, 285]
      posY: 9,
      posZ: 0
    });

    const chainRes = joineryEngine.resolveAllCollisionsIteratively([chainA, chainB, chainC]);
    expect(chainRes.remainingCollisions.length).toBe(0);
    expect(chainRes.resolvedCount).toBe(2);
    expect(chainRes.updatedParts.find(p => p.id === 'chain_a')!.posX).toBe(50);
  });
});
