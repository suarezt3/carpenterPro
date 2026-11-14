import { TestBed } from '@angular/core/testing';
import { ProjectStorageService } from './project-storage.service';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { Material, ParametricCabinetConfig, Part, PartGroup } from '../models/melamine.models';

const MOCK_MATERIALS: Material[] = [
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

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: overrides.id ?? `part_${Math.random().toString(36).slice(2, 10)}`,
    name: 'Tablero Libre',
    length: 600,
    width: 400,
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

describe('Motor de Inferencia Semántica de Piezas (Smart Part Naming)', () => {
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let joineryEngine: JoineryEngineService;
  let partGeometry: PartGeometryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjectStorageService,
        CabinetGeneratorService,
        JoineryEngineService,
        PartGeometryService
      ]
    });

    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    partGeometry = TestBed.inject(PartGeometryService);
  });

  const generateParametricCabinet = (doors = false): { parts: Part[]; group: PartGroup } => {
    const config: ParametricCabinetConfig = {
      code: 'MOD_BASE',
      name: 'Módulo Bajo Test',
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
      doorOpening: doors ? 'left' : 'none',
      structureMaterialId: 'mat_white_18',
      doorMaterialId: 'mat_white_18',
      backMaterialId: 'mat_back_3',
      handleType: doors ? 'bar_modern' : 'none',
      handleFinish: 'chrome',
      facadeGap: 3,
      posX: 0,
      posY: 0,
      posZ: 0
    };

    const res = cabinetGen.generateParametricCabinet(config, MOCK_MATERIALS);
    return { parts: res.parts, group: res.group };
  };

  describe('getEffectiveOrientation y rotaciones Euler 90°', () => {
    it('calcula correctamente la orientación física al rotar tableros 90° en X, Y y Z', () => {
      const horizRotZ = makePart({ orientation: 'horizontal', rotationZ: 90 });
      expect(partGeometry.getEffectiveOrientation(horizRotZ)).toBe('vertical_yz');

      const horizRotX = makePart({ orientation: 'horizontal', rotationX: 90 });
      expect(partGeometry.getEffectiveOrientation(horizRotX)).toBe('vertical_xy');

      const vertYzRotZ = makePart({ orientation: 'vertical_yz', rotationZ: 90 });
      expect(partGeometry.getEffectiveOrientation(vertYzRotZ)).toBe('horizontal');

      const vertYzRotY = makePart({ orientation: 'vertical_yz', rotationY: 90 });
      expect(partGeometry.getEffectiveOrientation(vertYzRotY)).toBe('vertical_xy');

      const vertXyRotX = makePart({ orientation: 'vertical_xy', rotationX: 90 });
      expect(partGeometry.getEffectiveOrientation(vertXyRotX)).toBe('horizontal');

      const vertXyRotY = makePart({ orientation: 'vertical_xy', rotationY: 90 });
      expect(partGeometry.getEffectiveOrientation(vertXyRotY)).toBe('vertical_yz');
    });

    it('renombra automáticamente un lateral rotado 90° en Z según su nueva altura', () => {
      const left = makePart({
        id: 'side-l',
        name: 'LATERAL IZQUIERDO',
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        length: 800,
        width: 580,
        thickness: 18,
        posX: -400,
        posY: 400,
        posZ: 0
      });
      const right = makePart({
        id: 'side-r',
        name: 'LATERAL DERECHO',
        componentRole: 'side_right',
        orientation: 'vertical_yz',
        length: 800,
        width: 580,
        thickness: 18,
        posX: 400,
        posY: 400,
        posZ: 0
      });
      const thirdSide = makePart({
        id: 'side-3',
        name: 'LATERAL IZQUIERDO',
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        length: 764,
        width: 580,
        thickness: 18,
        posX: 0,
        posY: 809,
        posZ: 0
      });

      projectService.updateProject(p => ({ ...p, parts: [left, right, thirdSide], groups: [] }), false);

      projectService.updatePart({ ...thirdSide, rotationZ: 90 });

      const updated = projectService.currentProject().parts.find(p => p.id === 'side-3')!;
      expect(updated.name).toBe('TAPA SUPERIOR');
      expect(updated.componentRole).toBe('top');
    });
  });

  describe('Flujo completo de reproducción: LATERAL IZQUIERDO -> LATERAL DERECHO -> TAPA SUPERIOR', () => {
    it('evita nombres tipo LATERAL IZQUIERDO 2/3 al duplicar, separar y convertir orientación', () => {
      projectService.updateProject(p => ({ ...p, parts: [], groups: [] }), false);

      const catalogSideLeft = makePart({
        id: 'cat-left',
        name: 'LATERAL IZQUIERDO',
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        length: 850,
        width: 580,
        thickness: 15,
        posX: -400,
        posY: 425,
        posZ: 0
      });
      projectService.addPart(catalogSideLeft);

      // Paso 1: duplicar LATERAL IZQUIERDO -> copia se vuelve LATERAL DERECHO
      const dupRight = projectService.duplicatePart(catalogSideLeft.id);
      expect(dupRight).not.toBeNull();
      expect(dupRight!.name).toBe('LATERAL DERECHO');
      expect(dupRight!.componentRole).toBe('side_right');

      // Paso 2: mover lateral derecho a +400mm (gap ~ 785mm <= 1600mm) -> conserva LATERAL DERECHO
      projectService.updatePart({ ...dupRight!, posX: 400 });
      const movedRight = projectService.currentProject().parts.find(p => p.id === dupRight!.id)!;
      expect(movedRight.name).toBe('LATERAL DERECHO');
      expect(movedRight.componentRole).toBe('side_right');

      // Paso 3: duplicar lateral izquierdo de nuevo -> puenteado por Pasada 2 en medio como DIVISIÓN VERTICAL
      const dupTopCandidate = projectService.duplicatePart(catalogSideLeft.id)!;
      expect(dupTopCandidate.name).toBe('DIVISIÓN VERTICAL');
      expect(dupTopCandidate.componentRole).toBe('divider');

      // Paso 4: convertir ese tablero a horizontal en la parte superior -> TAPA SUPERIOR
      projectService.updatePart({
        ...dupTopCandidate,
        orientation: 'horizontal',
        length: 815,
        width: 580,
        posX: 0,
        posY: 857.5
      });

      const finalParts = projectService.currentProject().parts;
      expect(finalParts.find(p => p.id === catalogSideLeft.id)?.name).toBe('LATERAL IZQUIERDO');
      expect(finalParts.find(p => p.id === movedRight.id)?.name).toBe('LATERAL DERECHO');
      expect(finalParts.find(p => p.id === dupTopCandidate.id)?.name).toBe('TAPA SUPERIOR');
      expect(finalParts.find(p => p.id === dupTopCandidate.id)?.componentRole).toBe('top');
      expect(finalParts.some(p => /LATERAL IZQUIERDO\s+[23]/i.test(p.name))).toBe(false);
    });

    it('intercambia LATERAL IZQUIERDO y LATERAL DERECHO al cruzar sus posiciones en X', () => {
      const left = makePart({
        id: 'swap-a',
        name: 'LATERAL IZQUIERDO',
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        length: 800,
        width: 500,
        thickness: 18,
        posX: -300,
        posY: 400
      });
      const right = makePart({
        id: 'swap-b',
        name: 'LATERAL DERECHO',
        componentRole: 'side_right',
        orientation: 'vertical_yz',
        length: 800,
        width: 500,
        thickness: 18,
        posX: 300,
        posY: 400
      });

      projectService.updateProject(p => ({ ...p, parts: [left, right], groups: [] }), false);
      projectService.updateMultipleParts([
        { partId: 'swap-a', updates: { posX: 300 } },
        { partId: 'swap-b', updates: { posX: -300 } }
      ]);

      const parts = projectService.currentProject().parts;
      expect(parts.find(p => p.id === 'swap-a')?.name).toBe('LATERAL DERECHO');
      expect(parts.find(p => p.id === 'swap-a')?.componentRole).toBe('side_right');
      expect(parts.find(p => p.id === 'swap-b')?.name).toBe('LATERAL IZQUIERDO');
      expect(parts.find(p => p.id === 'swap-b')?.componentRole).toBe('side_left');
    });
  });

  describe('Regla 1 y Regla 2: Múltiples verticales, tapas, pisos y entrepaños', () => {
    it('nombra 4 paneles vertical_yz como LATERAL IZQUIERDO, DIVISIÓN VERTICAL 1/2 y LATERAL DERECHO', () => {
      const mkSide = (id: string, posX: number): Part =>
        makePart({
          id,
          name: 'Tablero',
          orientation: 'vertical_yz',
          length: 800,
          width: 500,
          thickness: 18,
          posX,
          posY: 400
        });

      const result = partGeometry.inferAndApplySemanticPartNames([
        mkSide('v4', 600),
        mkSide('v2', -200),
        mkSide('v1', -600),
        mkSide('v3', 200)
      ]);

      const byId = new Map(result.map(p => [p.id, p]));
      expect(byId.get('v1')?.name).toBe('LATERAL IZQUIERDO');
      expect(byId.get('v1')?.componentRole).toBe('side_left');
      expect(byId.get('v2')?.name).toBe('DIVISIÓN VERTICAL 1');
      expect(byId.get('v2')?.componentRole).toBe('divider');
      expect(byId.get('v3')?.name).toBe('DIVISIÓN VERTICAL 2');
      expect(byId.get('v3')?.componentRole).toBe('divider');
      expect(byId.get('v4')?.name).toBe('LATERAL DERECHO');
      expect(byId.get('v4')?.componentRole).toBe('side_right');
    });

    it('nombra TAPA SUPERIOR, PISO INFERIOR y ENTREPAÑO 1/2 ordenados de abajo hacia arriba (incluso en alacena elevada)', () => {
      const sideL = makePart({
        id: 'al-l',
        orientation: 'vertical_yz',
        length: 700,
        width: 320,
        thickness: 18,
        posX: -300,
        posY: 1750
      });
      const sideR = makePart({
        id: 'al-r',
        orientation: 'vertical_yz',
        length: 700,
        width: 320,
        thickness: 18,
        posX: 300,
        posY: 1750
      });
      const mkHoriz = (id: string, posY: number): Part =>
        makePart({
          id,
          name: 'Tablero Libre',
          orientation: 'horizontal',
          length: 564,
          width: 320,
          thickness: 18,
          posX: 0,
          posY
        });

      const result = partGeometry.inferAndApplySemanticPartNames([
        sideL,
        sideR,
        mkHoriz('h-top', 2091),
        mkHoriz('h-shelf-2', 1860),
        mkHoriz('h-bottom', 1409),
        mkHoriz('h-shelf-1', 1620)
      ]);

      const byId = new Map(result.map(p => [p.id, p]));
      expect(byId.get('h-bottom')?.name).toBe('PISO INFERIOR');
      expect(byId.get('h-bottom')?.componentRole).toBe('bottom');
      expect(byId.get('h-shelf-1')?.name).toBe('ENTREPAÑO 1');
      expect(byId.get('h-shelf-1')?.componentRole).toBe('shelf');
      expect(byId.get('h-shelf-2')?.name).toBe('ENTREPAÑO 2');
      expect(byId.get('h-shelf-2')?.componentRole).toBe('shelf');
      expect(byId.get('h-top')?.name).toBe('TAPA SUPERIOR');
      expect(byId.get('h-top')?.componentRole).toBe('top');
    });

    it('nombra un único entrepaño sin sufijo numérico', () => {
      const result = partGeometry.inferAndApplySemanticPartNames([
        makePart({ id: 'l', orientation: 'vertical_yz', length: 800, width: 500, thickness: 18, posX: -300, posY: 400 }),
        makePart({ id: 'r', orientation: 'vertical_yz', length: 800, width: 500, thickness: 18, posX: 300, posY: 400 }),
        makePart({ id: 'b', orientation: 'horizontal', length: 564, width: 500, thickness: 18, posX: 0, posY: 9 }),
        makePart({ id: 's', orientation: 'horizontal', length: 564, width: 480, thickness: 18, posX: 0, posY: 400 }),
        makePart({ id: 't', orientation: 'horizontal', length: 600, width: 500, thickness: 18, posX: 0, posY: 809 })
      ]);

      const shelf = result.find(p => p.id === 's')!;
      expect(shelf.name).toBe('ENTREPAÑO');
      expect(shelf.componentRole).toBe('shelf');
    });

    it('no fusiona dos muebles completos puenteados separados por un pasillo <= 1600 mm', () => {
      const makeDesk = (prefix: string, centerX: number): Part[] => [
        makePart({
          id: `${prefix}-l`,
          name: 'LATERAL IZQUIERDO',
          componentRole: 'side_left',
          orientation: 'vertical_yz',
          length: 750,
          width: 600,
          thickness: 18,
          posX: centerX - 500,
          posY: 375
        }),
        makePart({
          id: `${prefix}-r`,
          name: 'LATERAL DERECHO',
          componentRole: 'side_right',
          orientation: 'vertical_yz',
          length: 750,
          width: 600,
          thickness: 18,
          posX: centerX + 500,
          posY: 375
        }),
        makePart({
          id: `${prefix}-t`,
          name: 'TAPA SUPERIOR',
          componentRole: 'top',
          orientation: 'horizontal',
          length: 1018,
          width: 600,
          thickness: 18,
          posX: centerX,
          posY: 759
        })
      ];

      const result = partGeometry.inferAndApplySemanticPartNames([
        ...makeDesk('d1', -1000),
        ...makeDesk('d2', 1000)
      ]);

      expect(result.find(p => p.id === 'd1-r')?.name).toBe('LATERAL DERECHO');
      expect(result.find(p => p.id === 'd2-l')?.name).toBe('LATERAL IZQUIERDO');
      expect(result.filter(p => p.componentRole === 'divider').length).toBe(0);
    });
  });

  describe('Regla 3: Paneles frontales y traseros (vertical_xy) y reset de herrajes de puerta', () => {
    it('clasifica FONDO TRASERO, AMARRE TRASERO, ZÓCALO FRONTAL y FRENTE / PUERTA en contexto de profundidad', () => {
      const sideL = makePart({
        id: 'c-l',
        orientation: 'vertical_yz',
        length: 800,
        width: 580,
        thickness: 18,
        posX: -300,
        posY: 400,
        posZ: 0
      });
      const sideR = makePart({
        id: 'c-r',
        orientation: 'vertical_yz',
        length: 800,
        width: 580,
        thickness: 18,
        posX: 300,
        posY: 400,
        posZ: 0
      });
      const backPanel = makePart({
        id: 'c-back',
        orientation: 'vertical_xy',
        length: 580,
        width: 780,
        thickness: 3,
        posX: 0,
        posY: 400,
        posZ: -280
      });
      const rearTie = makePart({
        id: 'c-tie',
        orientation: 'vertical_xy',
        length: 564,
        width: 100,
        thickness: 18,
        posX: 0,
        posY: 750,
        posZ: -270
      });
      const frontPlinth = makePart({
        id: 'c-plinth',
        orientation: 'vertical_xy',
        length: 564,
        width: 100,
        thickness: 18,
        posX: 0,
        posY: 50,
        posZ: 260
      });
      const frontDoor = makePart({
        id: 'c-door',
        orientation: 'vertical_xy',
        componentRole: 'door',
        length: 594,
        width: 690,
        thickness: 18,
        posX: 0,
        posY: 445,
        posZ: 299
      });
      const frontCover = makePart({
        id: 'c-front',
        orientation: 'vertical_xy',
        componentRole: 'free',
        length: 295,
        width: 690,
        thickness: 18,
        posX: -148,
        posY: 445,
        posZ: 299
      });

      const result = partGeometry.inferAndApplySemanticPartNames([
        sideL,
        sideR,
        backPanel,
        rearTie,
        frontPlinth,
        frontDoor,
        frontCover
      ]);

      const byId = new Map(result.map(p => [p.id, p]));
      expect(byId.get('c-back')?.name).toBe('FONDO TRASERO');
      expect(byId.get('c-back')?.componentRole).toBe('back');
      expect(byId.get('c-tie')?.name).toBe('AMARRE TRASERO');
      expect(byId.get('c-tie')?.componentRole).toBe('tie');
      expect(byId.get('c-plinth')?.name).toBe('ZÓCALO FRONTAL');
      expect(byId.get('c-plinth')?.componentRole).toBe('plinth');
      expect(byId.get('c-door')?.name).toBe('FRENTE / PUERTA');
      expect(byId.get('c-door')?.componentRole).toBe('door');
      expect(byId.get('c-front')?.name).toBe('FRENTE / PUERTA');
      expect(byId.get('c-front')?.componentRole).toBe('front');
    });

    it('evalúa tableros vertical_xy aislados cerca de Z=0 o adelantados al forzar reevaluación (rotación/H-L-F)', () => {
      const floorPlinth = makePart({
        id: 'iso-plinth',
        orientation: 'vertical_xy',
        length: 600,
        width: 100,
        thickness: 18,
        posX: 0,
        posY: 50,
        posZ: 0
      });
      const highTie = makePart({
        id: 'iso-tie',
        orientation: 'vertical_xy',
        length: 600,
        width: 100,
        thickness: 18,
        posX: 0,
        posY: 700,
        posZ: 0
      });
      const tallBack = makePart({
        id: 'iso-back',
        orientation: 'vertical_xy',
        length: 600,
        width: 700,
        thickness: 18,
        posX: 0,
        posY: 350,
        posZ: 0
      });
      const frontDoorAlone = makePart({
        id: 'iso-front',
        orientation: 'vertical_xy',
        length: 600,
        width: 700,
        thickness: 18,
        posX: 0,
        posY: 350,
        posZ: 280
      });

      const resPlinth = partGeometry.inferAndApplySemanticPartNames([floorPlinth], [], {
        forceReevaluateIds: new Set(['iso-plinth'])
      });
      expect(resPlinth[0].name).toBe('ZÓCALO FRONTAL');
      expect(resPlinth[0].componentRole).toBe('plinth');

      const resTie = partGeometry.inferAndApplySemanticPartNames([highTie], [], {
        forceReevaluateIds: new Set(['iso-tie'])
      });
      expect(resTie[0].name).toBe('AMARRE TRASERO');
      expect(resTie[0].componentRole).toBe('tie');

      const resBack = partGeometry.inferAndApplySemanticPartNames([tallBack], [], {
        forceReevaluateIds: new Set(['iso-back'])
      });
      expect(resBack[0].name).toBe('FONDO TRASERO');
      expect(resBack[0].componentRole).toBe('back');

      const resFront = partGeometry.inferAndApplySemanticPartNames([frontDoorAlone], [], {
        forceReevaluateIds: new Set(['iso-front'])
      });
      expect(resFront[0].name).toBe('FRENTE / PUERTA');
      expect(resFront[0].componentRole).toBe('front');
    });

    it('al cambiar una puerta a un rol estructural no-puerta limpia su hardwareConfig movible', () => {
      const doorPart = makePart({
        id: 'door-converted',
        name: 'Puerta Izquierda',
        componentRole: 'door',
        orientation: 'vertical_xy',
        length: 594,
        width: 700,
        thickness: 18,
        posX: 0,
        posY: 500,
        posZ: 200,
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          handleType: 'bar_modern',
          hingeType: 'straight',
          openingDirection: 'left',
          slideType: 'none'
        }
      });

      projectService.updateProject(p => ({ ...p, parts: [doorPart], groups: [] }), false);
      projectService.updatePart({ ...doorPart, orientation: 'horizontal' });

      const updated = projectService.currentProject().parts.find(p => p.id === 'door-converted')!;
      expect(updated.name).toBe('TAPA SUPERIOR');
      expect(updated.componentRole).toBe('top');
      expect(updated.hardwareConfig?.isMovable).toBe(false);
      expect(updated.hardwareConfig?.movableType).toBe('none');
      expect(updated.hardwareConfig?.handleType).toBe('none');
      expect(updated.hardwareConfig?.hingeType).toBe('none');
      expect(updated.hardwareConfig?.slideType).toBe('none');
    });
  });

  describe('createGroup, hasCustomName y assignPartQuickRole', () => {
    it('aplica inferencia semántica al crear un grupo assembly/custom no paramétrico', () => {
      const pLeft = makePart({
        id: 'g-l',
        name: 'Pieza 1',
        orientation: 'vertical_yz',
        length: 750,
        width: 500,
        thickness: 18,
        posX: -300,
        posY: 375
      });
      const pRight = makePart({
        id: 'g-r',
        name: 'Pieza 2',
        orientation: 'vertical_yz',
        length: 750,
        width: 500,
        thickness: 18,
        posX: 300,
        posY: 375
      });
      const pTop = makePart({
        id: 'g-t',
        name: 'Pieza 3',
        orientation: 'horizontal',
        length: 618,
        width: 500,
        thickness: 18,
        posX: 0,
        posY: 759
      });

      projectService.updateProject(p => ({ ...p, parts: [pLeft, pRight, pTop], groups: [] }), false);
      projectService.createGroup('Armario Manual', ['g-l', 'g-r', 'g-t'], 'assembly');

      const parts = projectService.currentProject().parts;
      expect(parts.find(p => p.id === 'g-l')?.name).toBe('LATERAL IZQUIERDO');
      expect(parts.find(p => p.id === 'g-r')?.name).toBe('LATERAL DERECHO');
      expect(parts.find(p => p.id === 'g-t')?.name).toBe('TAPA SUPERIOR');
    });

    it('respeta hasCustomName como referencia espacial sin sobrescribir su nombre ni rol', () => {
      const customLeft = makePart({
        id: 'custom-l',
        name: 'Costado Nogal Izq',
        hasCustomName: true,
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        length: 800,
        width: 550,
        thickness: 18,
        posX: -350,
        posY: 400
      });
      projectService.updateProject(p => ({ ...p, parts: [customLeft], groups: [] }), false);

      const dup = projectService.duplicatePart(customLeft.id)!;
      expect(dup.hasCustomName).toBe(false);
      expect(dup.name).toBe('LATERAL DERECHO');
      expect(dup.componentRole).toBe('side_right');

      const original = projectService.currentProject().parts.find(p => p.id === 'custom-l')!;
      expect(original.name).toBe('Costado Nogal Izq');
      expect(original.hasCustomName).toBe(true);
    });

    it('assignPartQuickRole asigna rol, nombre opcional, hasCustomName y configura herrajes movibles o fijos', () => {
      const board = makePart({ id: 'quick-1', name: 'Tablero Libre', orientation: 'vertical_xy' });
      projectService.updateProject(p => ({ ...p, parts: [board], groups: [] }), false);

      const asDoor = projectService.assignPartQuickRole('quick-1', 'door', 'Puerta Vitrina');
      expect(asDoor).not.toBeNull();
      expect(asDoor!.hasCustomName).toBe(true);
      expect(asDoor!.name).toBe('Puerta Vitrina');
      expect(asDoor!.componentRole).toBe('door');
      expect(asDoor!.hardwareConfig?.isMovable).toBe(true);
      expect(asDoor!.hardwareConfig?.movableType).toBe('door');
      expect(asDoor!.hardwareConfig?.hingeType).toBe('straight');

      const asTop = projectService.assignPartQuickRole('quick-1', 'top');
      expect(asTop!.componentRole).toBe('top');
      expect(asTop!.name).toBe('Puerta Vitrina');
      expect(asTop!.hasCustomName).toBe(true);
      expect(asTop!.hardwareConfig?.isMovable).toBe(false);
      expect(asTop!.hardwareConfig?.movableType).toBe('none');
      expect(asTop!.hardwareConfig?.hingeType).toBe('none');
      expect(asTop!.hardwareConfig?.handleType).toBe('none');
    });
  });

  describe('Exclusiones protegidas y compatibilidad regresiva', () => {
    it('jamás renombra cajones modulares, mesones, salpicaderos ni muros o electrodomésticos', () => {
      const drawerGroup: PartGroup = {
        id: 'grp-drawer',
        name: 'Cajón 1',
        type: 'drawer',
        subType: 'drawer',
        templateId: 'modular_drawer'
      };
      const drawerFront = makePart({
        id: 'dw-front',
        groupId: 'grp-drawer',
        name: 'Frente Cajón 1',
        componentRole: 'drawer_front',
        orientation: 'vertical_xy',
        length: 594,
        width: 140,
        thickness: 18,
        posX: 0,
        posY: 150,
        posZ: 280
      });
      const countertop = makePart({
        id: 'ct-1',
        name: 'MESÓN GRANITO',
        componentRole: 'countertop',
        orientation: 'horizontal',
        length: 1200,
        width: 620,
        thickness: 20,
        posX: 0,
        posY: 860
      });
      const backsplash = makePart({
        id: 'bs-1',
        name: 'SALPICADERO COCINA',
        componentRole: 'backsplash',
        orientation: 'vertical_xy',
        length: 1200,
        width: 120,
        thickness: 20,
        posX: 0,
        posY: 930,
        posZ: -300
      });
      const wall = makePart({
        id: 'wall-1',
        type: 'wall',
        name: 'Muro Posterior',
        orientation: 'vertical_xy',
        length: 3000,
        width: 2400,
        thickness: 150,
        posX: 0,
        posY: 1200,
        posZ: -380
      });

      const result = partGeometry.inferAndApplySemanticPartNames(
        [drawerFront, countertop, backsplash, wall],
        [drawerGroup],
        { forceReevaluateIds: new Set(['dw-front', 'ct-1', 'bs-1', 'wall-1']) }
      );

      expect(result.find(p => p.id === 'dw-front')?.name).toBe('Frente Cajón 1');
      expect(result.find(p => p.id === 'ct-1')?.name).toBe('MESÓN GRANITO');
      expect(result.find(p => p.id === 'bs-1')?.name).toBe('SALPICADERO COCINA');
      expect(result.find(p => p.id === 'wall-1')?.name).toBe('Muro Posterior');
    });

    it('mantiene intactos los nombres de un módulo paramétrico al rotarlo rígidamente, pero reevalúa una sola tabla si cambia su orientación explícita', () => {
      const { parts, group } = generateParametricCabinet(true);
      projectService.updateProject(p => ({ ...p, parts, groups: [group] }), false);

      const originalNames = new Map(projectService.currentProject().parts.map(p => [p.id, p.name]));

      // Rotación rígida completa de 90°: ningún nombre del módulo debe mutar
      projectService.rotateGroupRigidly(group.id, 90);
      const afterRigid = projectService.currentProject().parts;
      for (const part of afterRigid) {
        expect(part.name).toBe(originalNames.get(part.id));
      }

      // Cambio manual de orientación de una sola pieza del módulo: reevalúa solo esa pieza
      const door = afterRigid.find(p => p.componentRole === 'door')!;
      expect(door).toBeDefined();
      projectService.updatePart({ ...door, orientation: 'horizontal' });

      const afterSingleToggle = projectService.currentProject().parts;
      const toggledDoor = afterSingleToggle.find(p => p.id === door.id)!;
      expect(toggledDoor.componentRole).not.toBe('door');

      const otherParts = afterSingleToggle.filter(p => p.id !== door.id);
      for (const sibling of otherParts) {
        expect(sibling.name).toBe(originalNames.get(sibling.id));
      }
    });

    it('preserva compatibilidad C1 (Tablero Libre horizontal duplicado) y C2 (lateral desvinculado único)', () => {
      const freeBoard = makePart({
        id: 'c1-free',
        name: 'Tablero Libre',
        componentRole: 'free',
        orientation: 'horizontal',
        length: 500,
        width: 300,
        thickness: 18,
        posX: 100,
        posY: 9,
        posZ: 150
      });
      projectService.updateProject(p => ({ ...p, parts: [freeBoard], groups: [] }), false);

      const dupFree = projectService.duplicatePart(freeBoard.id)!;
      expect(dupFree.componentRole).toBe('free');
      expect(dupFree.name).toBe('Tablero Libre 2');

      const { parts, group } = generateParametricCabinet(false);
      projectService.updateProject(p => ({ ...p, parts, groups: [group] }), false);

      const moduleSide = parts.find(p => p.componentRole === 'side_right')!;
      const unlinkedSide = projectService.duplicatePart(moduleSide.id)!;
      expect(unlinkedSide.groupId).toBeUndefined();
      expect(unlinkedSide.componentRole).toBe('free');

      const collisions = joineryEngine.detectCollisions(projectService.currentProject().parts);
      expect(collisions.length).toBe(0);
    });
  });
});
