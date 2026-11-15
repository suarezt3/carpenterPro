import { TestBed } from '@angular/core/testing';
import { HardwareCatalogService } from './hardware-catalog.service';
import { JoineryEngineService } from './joinery-engine.service';
import { ProjectStorageService } from './project-storage.service';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { Part } from '../models/melamine.models';

describe('Door Configuration & Hardware Engine (FASE 1-4)', () => {
  let hardwareCatalog: HardwareCatalogService;
  let joineryEngine: JoineryEngineService;
  let storageService: ProjectStorageService;
  let cabinetGenerator: CabinetGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HardwareCatalogService,
        JoineryEngineService,
        ProjectStorageService,
        CabinetGeneratorService
      ]
    });
    hardwareCatalog = TestBed.inject(HardwareCatalogService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    storageService = TestBed.inject(ProjectStorageService);
    cabinetGenerator = TestBed.inject(CabinetGeneratorService);
  });

  describe('HardwareCatalogService - Hinge Rules & Abatible Superior Hardware', () => {
    it('computes hinge count strictly by hinged edge length (<=900 -> 2, 901..1600 -> 3, >1600 -> 4)', () => {
      expect(hardwareCatalog.computeHingeCountForDoor(600)).toBe(2);
      expect(hardwareCatalog.computeHingeCountForDoor(900)).toBe(2);
      expect(hardwareCatalog.computeHingeCountForDoor(901)).toBe(3);
      expect(hardwareCatalog.computeHingeCountForDoor(1200)).toBe(3);
      expect(hardwareCatalog.computeHingeCountForDoor(1600)).toBe(3);
      expect(hardwareCatalog.computeHingeCountForDoor(1601)).toBe(4);
      expect(hardwareCatalog.computeHingeCountForDoor(2100)).toBe(4);
    });

    it('computes centered hinge offsets with 100mm end margins', () => {
      const offsets2 = hardwareCatalog.computeHingeOffsetsMm(700);
      expect(offsets2.length).toBe(2);
      expect(offsets2[0]).toBeCloseTo(-250, 1);
      expect(offsets2[1]).toBeCloseTo(250, 1);

      const offsets3 = hardwareCatalog.computeHingeOffsetsMm(1200);
      expect(offsets3.length).toBe(3);
      expect(offsets3[0]).toBeCloseTo(-500, 1);
      expect(offsets3[1]).toBeCloseTo(0, 1);
      expect(offsets3[2]).toBeCloseTo(500, 1);

      const offsets4 = hardwareCatalog.computeHingeOffsetsMm(2000);
      expect(offsets4.length).toBe(4);
      expect(offsets4[0]).toBeCloseTo(-900, 1);
      expect(offsets4[3]).toBeCloseTo(900, 1);
    });

    it('counts BOTH 2 gas pistons AND 2 top 35mm cup hinges for Abatible Superior doors', () => {
      const liftUpDoor: Part = {
        id: 'door-lift-1',
        name: 'PUERTA ABATIBLE SUPERIOR',
        length: 800,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat-1',
        materialName: 'Blanco Nieve',
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        orientation: 'vertical_xy',
        hardwareConfig: {
          movableType: 'door',
          openingDirection: 'top',
          hingeType: 'gas_piston',
          handleType: 'bar_modern',
          handlePosition: 'horizontal'
        }
      };

      const hwList = hardwareCatalog.computeRequiredHardwareList([liftUpDoor]);
      const gasPistons = hwList.find(h => h.id === 'hw_piston_gas');
      const cupHinges = hwList.find(h => h.id === 'hw_bisagra_35');
      const handles = hwList.find(h => h.id === 'hw_tiradores');

      expect(gasPistons).toBeDefined();
      expect(gasPistons?.quantity).toBe(2);
      expect(cupHinges).toBeDefined();
      expect(cupHinges?.quantity).toBe(2);
      expect(handles).toBeDefined();
      expect(handles?.quantity).toBe(1);
    });

    it('does not count handles when handlePosition is none or handleType is none', () => {
      const handlelessDoor: Part = {
        id: 'door-no-handle',
        name: 'PUERTA IZQUIERDA',
        length: 700,
        width: 450,
        thickness: 18,
        quantity: 1,
        materialId: 'mat-1',
        materialName: 'Blanco Nieve',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        hardwareConfig: {
          movableType: 'door',
          openingDirection: 'left',
          hingeType: 'straight',
          handleType: 'bar_modern',
          handlePosition: 'none'
        }
      };

      const hwList = hardwareCatalog.computeRequiredHardwareList([handlelessDoor]);
      const handles = hwList.find(h => h.id === 'hw_tiradores');
      expect(handles).toBeUndefined();
    });

    it('generates parametric cabinet doors with bottom opening and top handle position via CabinetGeneratorService', () => {
      const generated = cabinetGenerator.generateParametricCabinet(
        {
          code: 'MOD-BOT-01',
          name: 'Alacena Abatible Inferior',
          moduleType: 'wall_cabinet',
          width: 800,
          height: 400,
          depth: 320,
          structureThickness: 18,
          doorThickness: 18,
          backThickness: 3,
          backType: 'groove',
          shelvesCount: 1,
          doorOpening: 'bottom',
          hasHandle: true,
          structureMaterialId: 'mat-1',
          doorMaterialId: 'mat-1',
          backMaterialId: 'mat-1',
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3
        },
        storageService.currentProject().materials
      );
      const doorPart = generated.parts.find(p => p.componentRole === 'door');
      expect(doorPart).toBeDefined();
      expect(doorPart?.hardwareConfig?.openingDirection).toBe('bottom');
      expect(doorPart?.hardwareConfig?.hingeType).toBe('straight');
      expect(doorPart?.hardwareConfig?.handlePosition).toBe('horizontal');
    });
  });

  describe('JoineryEngineService - Interior Door Cup Hinge Drilling', () => {
    it('generates 2, 3, or 4 hinge_35 holes anchored on the INTERIOR face (b.minZ) for front doors', () => {
      const makeFrontDoor = (heightMm: number, openingDir: 'left' | 'right' | 'top' | 'bottom'): Part => ({
        id: `door-${heightMm}-${openingDir}`,
        name: 'PUERTA IZQUIERDA',
        length: 600, // horizontal X in vertical_xy
        width: heightMm, // vertical Y in vertical_xy
        thickness: 18,
        quantity: 1,
        materialId: 'mat-1',
        materialName: 'Blanco Nieve',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        orientation: 'vertical_xy',
        posX: 0,
        posY: heightMm / 2,
        posZ: 300, // minZ = 291, maxZ = 309
        hardwareConfig: {
          movableType: 'door',
          openingDirection: openingDir,
          hingeType: openingDir === 'top' ? 'gas_piston' : 'straight'
        }
      });

      const res2 = joineryEngine.calculateJoinery([makeFrontDoor(800, 'left')]);
      const hinges2 = res2.allDrillHoles.filter(h => h.type === 'hinge_35');
      expect(hinges2.length).toBe(2);
      for (const h of hinges2) {
        expect(h.posZ).toBeCloseTo(291, 1); // b.minZ interior face, NOT 309
        expect(h.posX).toBeCloseTo(-300 + 22, 1); // left edge + 22mm
      }

      const res3 = joineryEngine.calculateJoinery([makeFrontDoor(1400, 'right')]);
      const hinges3 = res3.allDrillHoles.filter(h => h.type === 'hinge_35');
      expect(hinges3.length).toBe(3);
      for (const h of hinges3) {
        expect(h.posZ).toBeCloseTo(291, 1);
        expect(h.posX).toBeCloseTo(300 - 22, 1); // right edge - 22mm
      }

      const res4 = joineryEngine.calculateJoinery([makeFrontDoor(1900, 'left')]);
      const hinges4 = res4.allDrillHoles.filter(h => h.type === 'hinge_35');
      expect(hinges4.length).toBe(4);

      const resTop = joineryEngine.calculateJoinery([makeFrontDoor(450, 'top')]);
      const hingesTop = resTop.allDrillHoles.filter(h => h.type === 'hinge_35');
      expect(hingesTop.length).toBe(2);
      for (const h of hingesTop) {
        expect(h.posZ).toBeCloseTo(291, 1);
        expect(h.posY).toBeCloseTo(450 - 22, 1); // top edge - 22mm
      }

      const resBottom = joineryEngine.calculateJoinery([makeFrontDoor(450, 'bottom')]);
      const hingesBottom = resBottom.allDrillHoles.filter(h => h.type === 'hinge_35');
      expect(hingesBottom.length).toBe(2);
      for (const h of hingesBottom) {
        expect(h.posZ).toBeCloseTo(291, 1);
        expect(h.posY).toBeCloseTo(22, 1); // bottom edge + 22mm
      }
    });
  });

  describe('ProjectStorageService - 1-Click Door Configuration & Double Door Split/Merge', () => {
    it('splits 1 door into 2 symmetric doors with (W - 3) / 2 and 3mm central gap, and merges back with zero duplicates', () => {
      const singleDoor: Part = {
        id: 'door-single-1',
        name: 'PUERTA IZQUIERDA',
        length: 800, // horizontal width W in vertical_xy
        width: 720,  // vertical height H in vertical_xy
        thickness: 18,
        quantity: 1,
        materialId: 'mat-1',
        materialName: 'Blanco Nieve',
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        orientation: 'vertical_xy',
        posX: 0,
        posY: 360,
        posZ: 280,
        groupId: 'grp-1',
        hardwareConfig: {
          movableType: 'door',
          openingDirection: 'left',
          hingeType: 'straight',
          handleType: 'bar_modern',
          handlePosition: 'center'
        }
      };

      storageService.currentProject.update(p => ({
        ...p,
        parts: [singleDoor],
        groups: [
          {
            id: 'grp-1',
            name: 'MÓDULO BASE',
            type: 'assembly',
            partIds: ['door-single-1']
          }
        ]
      }));

      expect(storageService.getDoorConfigurationMode('door-single-1')).toBe('left');

      // 1 -> 2 Puertas (Double)
      const afterSplit = storageService.configureDoorOpeningMode('door-single-1', 'double');
      expect(afterSplit.length).toBe(2);

      const leftLeaf = afterSplit[0];
      const rightLeaf = afterSplit[1];
      expect(leftLeaf.id).toBe('door-single-1');
      expect(leftLeaf.name).toBe('PUERTA IZQUIERDA');
      expect(rightLeaf.name).toBe('PUERTA DERECHA');

      // Each leaf width = (800 - 3) / 2 = 398.5 mm
      expect(leftLeaf.length).toBeCloseTo(398.5, 1);
      expect(rightLeaf.length).toBeCloseTo(398.5, 1);
      // Central gap = (rightLeaf.posX - rightLeaf.length/2) - (leftLeaf.posX + leftLeaf.length/2) = 3 mm
      const gap = (rightLeaf.posX! - rightLeaf.length / 2) - (leftLeaf.posX! + leftLeaf.length / 2);
      expect(gap).toBeCloseTo(3, 1);

      expect(storageService.findPairedDoorSibling(leftLeaf)?.id).toBe(rightLeaf.id);
      expect(storageService.getDoorConfigurationMode('door-single-1')).toBe('double');
      expect(storageService.getDoorConfigurationMode('grp-1')).toBe('double');

      // Update vertical handle position on both paired leaves simultaneously
      storageService.setDoorHandleVerticalPosition('door-single-1', 'top');
      expect(storageService.partsList()[0].hardwareConfig?.handlePosition).toBe('top');
      expect(storageService.partsList()[1].hardwareConfig?.handlePosition).toBe('top');

      // 2 -> 1 Puerta Abatible Superior (Merge back to full width 800mm)
      const afterMergeTop = storageService.configureDoorOpeningMode('grp-1', 'top');
      expect(afterMergeTop.length).toBe(1);
      expect(afterMergeTop[0].id).toBe('door-single-1');
      expect(afterMergeTop[0].name).toBe('PUERTA ABATIBLE SUPERIOR');
      expect(afterMergeTop[0].length).toBeCloseTo(800, 1);
      expect(afterMergeTop[0].posX).toBeCloseTo(0, 1);
      expect(afterMergeTop[0].hardwareConfig?.openingDirection).toBe('top');
      expect(afterMergeTop[0].hardwareConfig?.hingeType).toBe('gas_piston');
      expect(afterMergeTop[0].hardwareConfig?.handlePosition).toBe('horizontal');

      // Switch to Abatible Inferior
      const afterBottom = storageService.configureDoorOpeningMode('door-single-1', 'bottom');
      expect(afterBottom.length).toBe(1);
      expect(afterBottom[0].name).toBe('PUERTA ABATIBLE INFERIOR');
      expect(afterBottom[0].hardwareConfig?.openingDirection).toBe('bottom');
      expect(afterBottom[0].hardwareConfig?.hingeType).toBe('straight');
    });
  });
});
