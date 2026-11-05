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

describe('ProjectStorageService - Duplicación Inteligente y Restricciones Espaciales', () => {
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

  const generateTestModule = (shelvesCount = 1): { parts: Part[]; group: PartGroup } => {
    const config: ParametricCabinetConfig = {
      code: 'MOD_TEST',
      name: 'Módulo Alacena Test',
      moduleType: 'wall_cabinet',
      category: 'kitchen_wall',
      width: 600,
      height: 800,
      depth: 320,
      structureThickness: 18,
      doorThickness: 18,
      backThickness: 3,
      backType: 'groove',
      shelvesCount,
      doorOpening: 'none',
      structureMaterialId: 'mat_white_18',
      doorMaterialId: 'mat_white_18',
      backMaterialId: 'mat_back_3',
      handleType: 'none',
      handleFinish: 'chrome',
      facadeGap: 3,
      posX: 0,
      posY: 400,
      posZ: 0
    };

    const res = cabinetGen.generateParametricCabinet(config, MOCK_MATERIALS);
    return { parts: res.parts, group: res.group };
  };

  describe('1. Duplicar un entrepaño interno en un módulo a 0°', () => {
    it('debe conservar exactamente el mismo posX y posZ, ubicar posY en el vano libre y generar 0 colisiones', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      const originalShelf = parts.find(p => p.componentRole === 'shelf')!;
      expect(originalShelf).toBeDefined();

      const dupShelf = projectService.duplicatePart(originalShelf.id);
      expect(dupShelf).not.toBeNull();
      expect(dupShelf!.id).not.toBe(originalShelf.id);
      expect(dupShelf!.groupId).toBe(originalShelf.groupId);

      // PROHIBIDO alterar posX o posZ: la copia queda exactamente alineada lateral y frontalmente
      expect(dupShelf!.posX).toBe(originalShelf.posX);
      expect(dupShelf!.posZ).toBe(originalShelf.posZ);

      // La altura debe situarse en un vano libre diferente al original
      expect(dupShelf!.posY).not.toBe(originalShelf.posY);
      expect(dupShelf!.posY).toBeGreaterThan(18); // por encima del piso
      expect(dupShelf!.posY).toBeLessThan(782); // por debajo del techo

      // Cero colisiones físicas en todo el proyecto
      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('2. Duplicar un entrepaño interno en un módulo rotado a 90° y 180°', () => {
    it('debe mantener la alineación interna exacta del módulo rotado a 90° con 0 colisiones', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      // Rotar módulo a 90°
      projectService.rotateGroupRigidly(group.id, 90);

      const rotatedParts = projectService.currentProject().parts;
      const originalShelf = rotatedParts.find(p => p.componentRole === 'shelf')!;
      expect(originalShelf).toBeDefined();

      const dupShelf = projectService.duplicatePart(originalShelf.id);
      expect(dupShelf).not.toBeNull();

      // En rotación de 90°, posX y posZ deben conservarse exactamente
      expect(dupShelf!.posX).toBe(originalShelf.posX);
      expect(dupShelf!.posZ).toBe(originalShelf.posZ);

      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });

    it('debe mantener la alineación interna exacta del módulo rotado a 180° con 0 colisiones', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      // Rotar módulo a 180°
      projectService.rotateGroupRigidly(group.id, 180);

      const rotatedParts = projectService.currentProject().parts;
      const originalShelf = rotatedParts.find(p => p.componentRole === 'shelf')!;
      expect(originalShelf).toBeDefined();

      const dupShelf = projectService.duplicatePart(originalShelf.id);
      expect(dupShelf).not.toBeNull();

      expect(dupShelf!.posX).toBe(originalShelf.posX);
      expect(dupShelf!.posZ).toBe(originalShelf.posZ);

      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });

    it('debe mantener la alineación interna exacta del módulo rotado a 270° con 0 colisiones', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      // Rotar módulo a 270° (-90°)
      projectService.rotateGroupRigidly(group.id, -90);

      const rotatedParts = projectService.currentProject().parts;
      const originalShelf = rotatedParts.find(p => p.componentRole === 'shelf')!;
      expect(originalShelf).toBeDefined();

      const dupShelf = projectService.duplicatePart(originalShelf.id);
      expect(dupShelf).not.toBeNull();

      expect(dupShelf!.posX).toBe(originalShelf.posX);
      expect(dupShelf!.posZ).toBe(originalShelf.posZ);

      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });

    it('en módulo de 2 columnas con divisor, duplicar una repisa en una columna no salta a la otra columna', () => {
      const { parts, group } = generateTestModule(0);

      const divider: Part = {
        id: 'mid-divider',
        name: 'Divisor Central',
        groupId: group.id,
        componentRole: 'divider',
        length: 764,
        width: 288,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 400,
        posZ: 6,
        orientation: 'vertical_yz'
      };

      const shelfLeftCol: Part = {
        id: 'shelf-left-col',
        name: 'Repisa Columna Izquierda',
        groupId: group.id,
        componentRole: 'shelf',
        length: 271,
        width: 288,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: -145.5,
        posY: 300,
        posZ: 6,
        orientation: 'horizontal'
      };

      projectService.updateProject(p => ({
        ...p,
        parts: [...parts, divider, shelfLeftCol],
        groups: [group]
      }), false);

      const dupShelf = projectService.duplicatePart(shelfLeftCol.id);
      expect(dupShelf).not.toBeNull();
      // Debe conservar la misma columna izquierda sin saltar al lado derecho
      expect(dupShelf!.posX).toBe(shelfLeftCol.posX);
      expect(dupShelf!.posZ).toBe(shelfLeftCol.posZ);
      expect(dupShelf!.posY).not.toBe(shelfLeftCol.posY);

      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('3. Duplicar 2 y 3 veces seguidas un entrepaño dentro del mismo módulo', () => {
    it('debe ubicar cada copia en los vanos disponibles sin salirse del módulo y con 0 colisiones', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      const shelfOriginal = parts.find(p => p.componentRole === 'shelf')!;

      // 1ra duplicación
      const dup1 = projectService.duplicatePart(shelfOriginal.id)!;
      expect(dup1).toBeDefined();
      expect(dup1.posX).toBe(shelfOriginal.posX);
      expect(dup1.posZ).toBe(shelfOriginal.posZ);

      // 2da duplicación
      const dup2 = projectService.duplicatePart(shelfOriginal.id)!;
      expect(dup2).toBeDefined();
      expect(dup2.posX).toBe(shelfOriginal.posX);
      expect(dup2.posZ).toBe(shelfOriginal.posZ);

      // 3ra duplicación
      const dup3 = projectService.duplicatePart(shelfOriginal.id)!;
      expect(dup3).toBeDefined();
      expect(dup3.posX).toBe(shelfOriginal.posX);
      expect(dup3.posZ).toBe(shelfOriginal.posZ);

      const allShelves = projectService.currentProject().parts.filter(p => p.componentRole === 'shelf');
      expect(allShelves.length).toBe(4);

      // Verificar que todas las alturas son diferentes y están dentro de los límites
      const heights = allShelves.map(s => s.posY!).sort((a, b) => a - b);
      for (let i = 0; i < heights.length - 1; i++) {
        expect(heights[i + 1] - heights[i]).toBeGreaterThan(30); // separación mínima entre repisas
      }

      // Cero colisiones físicas
      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('4. Duplicar un tablero libre (!groupId)', () => {
    it('debe crearse al lado (+X = ancho + 20mm) a la misma altura sin solaparse y poder moverse libremente', () => {
      const freePart: Part = {
        id: 'free-board-1',
        name: 'Tablero Libre',
        length: 500,
        width: 300,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 100,
        posY: 9,
        posZ: 150,
        orientation: 'horizontal'
      };

      projectService.updateProject(p => ({
        ...p,
        parts: [freePart],
        groups: []
      }), false);

      const dupFree = projectService.duplicatePart(freePart.id);
      expect(dupFree).not.toBeNull();
      expect(dupFree!.groupId).toBeUndefined();
      expect(dupFree!.componentRole).toBe('free');

      // Misma altura posY y profundidad posZ
      expect(dupFree!.posY).toBe(freePart.posY);
      expect(dupFree!.posZ).toBe(freePart.posZ);

      // Colocado al lado con holgura de 20 mm: posX original (100) + sx (500) + 20 = 620
      expect(dupFree!.posX).toBe(620);

      // Cero colisiones entre la original y la copia
      const collisions = joineryEngine.detectCollisions([freePart, dupFree!]);
      expect(collisions.length).toBe(0);
    });

    it('si se duplica una pieza estructural (lateral o puerta), debe desvincularse (groupId: undefined) y situarse fuera del módulo', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      const sidePart = parts.find(p => p.componentRole === 'side_right')!;
      expect(sidePart).toBeDefined();

      const dupSide = projectService.duplicatePart(sidePart.id);
      expect(dupSide).not.toBeNull();
      expect(dupSide!.groupId).toBeUndefined();
      expect(dupSide!.componentRole).toBe('free');

      // Debe situarse al lado derecho del módulo completo (+X)
      const groupBounds = parts.map(p => partGeometry.getWorldAABB(p));
      const maxModuleX = Math.max(...groupBounds.map(b => b.maxX));
      expect(dupSide!.posX).toBeGreaterThan(maxModuleX);

      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('Escenario B: Duplicar un divisor vertical interno', () => {
    it('debe conservar posY y profundidad, ubicando la copia en el vano horizontal disponible con 0 colisiones', () => {
      const { parts, group } = generateTestModule(0);

      const divider: Part = {
        id: 'div-1',
        name: 'Divisor Vertical 1',
        groupId: group.id,
        componentRole: 'divider',
        length: 764,
        width: 288,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 400,
        posZ: 6,
        orientation: 'vertical_yz'
      };

      projectService.updateProject(p => ({
        ...p,
        parts: [...parts, divider],
        groups: [group]
      }), false);

      const dupDivider = projectService.duplicatePart(divider.id);
      expect(dupDivider).not.toBeNull();
      expect(dupDivider!.id).not.toBe(divider.id);
      expect(dupDivider!.groupId).toBe(divider.groupId);

      // PROHIBIDO alterar posY o profundidad
      expect(dupDivider!.posY).toBe(divider.posY);
      expect(dupDivider!.posZ).toBe(divider.posZ);

      // Debe haberse desplazado en X al centro de un vano libre
      expect(dupDivider!.posX).not.toBe(divider.posX);

      // Cero colisiones físicas
      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });

    it('debe duplicar divisor vertical en módulo rotado a 90° conservando profundidad (X) y desplazando en Z con 0 colisiones', () => {
      const { parts, group } = generateTestModule(0);

      const divider: Part = {
        id: 'div-rot-1',
        name: 'Divisor Vertical 1',
        groupId: group.id,
        componentRole: 'divider',
        length: 764,
        width: 288,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 400,
        posZ: 6,
        orientation: 'vertical_yz'
      };

      projectService.updateProject(p => ({
        ...p,
        parts: [...parts, divider],
        groups: [group]
      }), false);

      // Rotar a 90°
      projectService.rotateGroupRigidly(group.id, 90);

      const rotatedParts = projectService.currentProject().parts;
      const rotDivider = rotatedParts.find(p => p.id === divider.id)!;
      expect(rotDivider).toBeDefined();

      const dup = projectService.duplicatePart(rotDivider.id);
      expect(dup).not.toBeNull();
      expect(dup!.posY).toBe(rotDivider.posY);
      // En rotación de 90°, el eje de profundidad es X y el de ancho es Z
      expect(dup!.posX).toBe(rotDivider.posX);
      expect(dup!.posZ).not.toBe(rotDivider.posZ);

      const allParts = projectService.currentProject().parts;
      const collisions = joineryEngine.detectCollisions(allParts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('5. Arrastrar un entrepaño que estaba ligeramente desfasado en X', () => {
    it('debe auto-centrarse en la cavidad del módulo eliminando la colisión lateral', () => {
      const { parts, group } = generateTestModule(1);
      // Simular un entrepaño desfasado artificialmente hacia la derecha (+35mm) que colisiona con el lateral
      const shelf = parts.find(p => p.componentRole === 'shelf')!;
      shelf.posX = 35; // Desfasado, penetrando el costado derecho

      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      // Verificar que el entrepaño desfasado produce colisión lateral antes de la corrección
      const initialCollisions = joineryEngine.detectCollisions(projectService.currentProject().parts);
      expect(initialCollisions.length).toBeGreaterThan(0);
      expect(initialCollisions.some(c => c.partAId === shelf.id || c.partBId === shelf.id)).toBe(true);

      // Aplicar cálculo de autocentrado inteligente (self-healing)
      const currentParts = projectService.currentProject().parts;
      const cavity = partGeometry.getModuleCavityCenter(shelf, currentParts);
      expect(cavity).not.toBeNull();
      expect(cavity!.x).toBe(0); // El centro de la cavidad es 0

      // Auto-corregir la posición
      projectService.updatePart({ ...shelf, posX: cavity!.x, posZ: cavity!.z });

      // Cero colisiones tras la auto-corrección
      const healedParts = projectService.currentProject().parts;
      const finalCollisions = joineryEngine.detectCollisions(healedParts);
      expect(finalCollisions.length).toBe(0);
    });
  });

  describe('6. Duplicar un módulo completo (duplicateGroup)', () => {
    it('debe duplicar el módulo completo al costado (+X) a la misma altura base y sin solapamientos', () => {
      const { parts, group } = generateTestModule(1);
      projectService.updateProject(p => ({
        ...p,
        parts,
        groups: [group]
      }), false);

      const result = projectService.duplicateGroup(group.id);
      expect(result).not.toBeNull();
      expect(result!.newGroup.id).not.toBe(group.id);
      expect(result!.newPartIds.length).toBe(parts.length);

      const currentProj = projectService.currentProject();
      expect(currentProj.groups?.length).toBe(2);

      const origParts = currentProj.parts.filter(p => p.groupId === group.id);
      const newParts = currentProj.parts.filter(p => p.groupId === result!.newGroup.id);

      // Misma elevación base
      const origFloor = origParts.find(p => p.componentRole === 'bottom')!;
      const newFloor = newParts.find(p => p.componentRole === 'bottom')!;
      expect(newFloor.posY).toBe(origFloor.posY);

      // Desplazado al costado (+X)
      expect(newFloor.posX).toBeGreaterThan(origFloor.posX! + 600);

      // Cero colisiones físicas en todo el proyecto
      const collisions = joineryEngine.detectCollisions(currentProj.parts);
      expect(collisions.length).toBe(0);
    });
  });
});
