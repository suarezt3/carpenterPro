import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CabinetBaseType,
  CabinetZoneDrawerConfig,
  CabinetZoneNode,
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../models/melamine.models';
import { AssemblyGuideService } from './assembly-guide.service';
import {
  CabinetGeneratorService,
  computeZoneBoundsLayout
} from './cabinet-generator.service';
import { CutOptimizerService } from './cut-optimizer.service';
import { HardwareCatalogService } from './hardware-catalog.service';
import { JoineryEngineService } from './joinery-engine.service';
import { ProjectStorageService } from './project-storage.service';
import { TemplatesCatalogService } from './templates-catalog.service';

const SYNC_TEST_MATERIALS: Material[] = [
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

function makeZoneBaseConfig(
  overrides: Partial<ParametricCabinetConfig> = {}
): ParametricCabinetConfig {
  return {
    code: 'ZON_SYNC',
    name: 'Módulo Zonas Sync',
    moduleType: 'base_cabinet',
    category: 'custom',
    width: 800,
    height: 820,
    depth: 580,
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

describe('Motor Paramétrico por Zonas y Sincronización Cero-Duplicados (Fase 1 & Fase 5)', () => {
  let cabinetGen: CabinetGeneratorService;
  let joineryEngine: JoineryEngineService;
  let hardwareCatalog: HardwareCatalogService;
  let projectStorage: ProjectStorageService;
  let cutOptimizer: CutOptimizerService;
  let assemblyGuide: AssemblyGuideService;
  let templatesCatalog: TemplatesCatalogService;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    TestBed.configureTestingModule({
      providers: [
        CabinetGeneratorService,
        JoineryEngineService,
        HardwareCatalogService,
        ProjectStorageService,
        CutOptimizerService,
        AssemblyGuideService,
        TemplatesCatalogService
      ]
    });

    cabinetGen = TestBed.inject(CabinetGeneratorService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    hardwareCatalog = TestBed.inject(HardwareCatalogService);
    projectStorage = TestBed.inject(ProjectStorageService);
    cutOptimizer = TestBed.inject(CutOptimizerService);
    assemblyGuide = TestBed.inject(AssemblyGuideService);
    templatesCatalog = TestBed.inject(TemplatesCatalogService);

    projectStorage.clearFurniture();
    projectStorage.updateProject(
      p => ({
        ...p,
        materials: [...SYNC_TEST_MATERIALS],
        settings: { ...TEST_SETTINGS }
      }),
      false
    );
  });

  const expectZeroCollisions = (parts: Part[]): void => {
    const physicalParts = parts.filter(p => !p.excludeFromCutlist || p.componentRole === 'accessory');
    const detectCols = joineryEngine.detectCollisions(physicalParts);
    const joineryCols = joineryEngine.calculateJoinery(physicalParts).collisions;
    expect(detectCols.length).toBe(0);
    expect(joineryCols.length).toBe(0);
  };

  describe('1. Casco Exterior (baseType y backType), Subdivisiones Recursivas y exactSizeMm', () => {
    it('debe generar cascos con base none, plinth y legs + fondos groove, rebate, overlay y none con 0 colisiones', () => {
      const baseTypes: CabinetBaseType[] = ['none', 'plinth', 'legs'];
      const backTypes: ('groove' | 'rebate' | 'overlay' | 'none')[] = [
        'groove',
        'rebate',
        'overlay',
        'none'
      ];

      for (const baseType of baseTypes) {
        for (const backType of backTypes) {
          const cfg = makeZoneBaseConfig({
            baseType,
            hasPlinth: baseType === 'plinth',
            plinthHeight: baseType === 'legs' ? 120 : baseType === 'plinth' ? 80 : 0,
            backType,
            hasBackPanel: backType !== 'none'
          });
          const res = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);

          const plinthParts = res.parts.filter(p => p.componentRole === 'plinth');
          const legParts = res.parts.filter(
            p => p.componentRole === 'accessory' && p.materialId === 'hw_leg_inox'
          );
          const backParts = res.parts.filter(p => p.componentRole === 'back');

          if (baseType === 'plinth') {
            expect(plinthParts.length).toBe(4);
            expect(legParts.length).toBe(0);
          } else if (baseType === 'legs') {
            expect(plinthParts.length).toBe(0);
            expect(legParts.length).toBe(4);
            for (const leg of legParts) {
              expect(leg.shapeType).toBe('circle');
              expect(leg.excludeFromCutlist).toBe(true);
            }
          } else {
            expect(plinthParts.length).toBe(0);
            expect(legParts.length).toBe(0);
          }

          if (backType === 'none') {
            expect(backParts.length).toBe(0);
          } else {
            expect(backParts.length).toBe(1);
          }

          expectZeroCollisions(res.parts);
        }
      }
    });

    it('computeZoneBoundsLayout debe respetar orden determinista vertical (izq->der), horizontal (arriba->abajo) y rebalanceo exactSizeMm', () => {
      const tree: CabinetZoneNode = {
        id: 'root',
        splitDirection: 'vertical',
        children: [
          {
            id: 'col_left',
            splitDirection: 'horizontal',
            exactSizeMm: 300,
            children: [
              {
                id: 'top_niche',
                splitDirection: 'none',
                exactSizeMm: 220,
                content: { type: 'empty' }
              },
              {
                id: 'bottom_shelves',
                splitDirection: 'none',
                sizeRatio: 1,
                content: { type: 'shelves', shelvesCount: 2, shelfSetbackMm: 25 }
              }
            ]
          },
          {
            id: 'col_right',
            splitDirection: 'none',
            sizeRatio: 1,
            content: { type: 'hanging_rod', hangingRodsCount: 1 }
          }
        ]
      };

      const cfg = makeZoneBaseConfig({
        width: 1000,
        height: 1800,
        depth: 600,
        structureThickness: 15,
        zoneTree: tree
      });

      const layout = computeZoneBoundsLayout(cfg);
      expect(layout.children.length).toBe(2);

      const leftCol = layout.children[0];
      const rightCol = layout.children[1];
      // Vertical: izquierda (-X) a derecha (+X)
      expect(leftCol.maxX).toBeLessThan(rightCol.minX);
      expect(leftCol.innerWidth).toBe(300);
      expect(rightCol.innerWidth).toBeCloseTo(layout.innerWidth - 300 - 15, 1);

      // Horizontal en col_left: arriba (+Y) hacia abajo (-Y)
      const topNiche = leftCol.children[0];
      const bottomShelves = leftCol.children[1];
      expect(topNiche.minY).toBeGreaterThan(bottomShelves.maxY);
      expect(topNiche.innerHeight).toBe(220);
      expect(bottomShelves.innerHeight).toBeCloseTo(leftCol.innerHeight - 220 - 15, 1);

      // Over-budget exactSizeMm debe reservar mínimo 20mm por hijo flexible sin desbordar
      const clampedCfg = makeZoneBaseConfig({
        width: 400,
        structureThickness: 15,
        zoneTree: {
          id: 'root_clamp',
          splitDirection: 'vertical',
          children: [
            { id: 'c1', splitDirection: 'none', exactSizeMm: 500, content: { type: 'empty' } },
            { id: 'c2', splitDirection: 'none', sizeRatio: 1, content: { type: 'empty' } }
          ]
        }
      });
      const clampedLayout = computeZoneBoundsLayout(clampedCfg);
      expect(clampedLayout.children[1].innerWidth).toBeGreaterThanOrEqual(20);
      expect(
        clampedLayout.children[0].innerWidth + clampedLayout.children[1].innerWidth + 15
      ).toBeCloseTo(clampedLayout.innerWidth, 1);

      const generated = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);
      expect(generated.parts.filter(p => p.zoneId === 'bottom_shelves').length).toBe(2);
      expect(generated.parts.filter(p => p.zoneId === 'col_right').length).toBe(1);
      expectZeroCollisions(generated.parts);
    });
  });

  describe('2. Repisas Móviles, Cajones 1..6, Puertas (Incl. Corredizas) y Barras Colgadoras con 0 Colisiones', () => {
    it('debe generar repisas móviles con remetida frontal exacta (shelfSetbackMm) e isMovableShelf = true', () => {
      const cfg = makeZoneBaseConfig({
        width: 700,
        height: 1000,
        depth: 500,
        zoneTree: {
          id: 'zone_shelves',
          splitDirection: 'none',
          content: { type: 'shelves', shelvesCount: 3, shelfSetbackMm: 35 }
        }
      });

      const res = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);
      const shelves = res.parts.filter(p => p.componentRole === 'shelf');
      const sides = res.parts.filter(p => p.componentRole === 'side_left');
      expect(shelves.length).toBe(3);
      expect(sides.length).toBe(1);

      const sideBounds = joineryEngine.getPartBounds(sides[0]);
      for (const shelf of shelves) {
        expect(shelf.hardwareConfig?.isMovableShelf).toBe(true);
        expect(shelf.zoneId).toBe('zone_shelves');
        const shelfBounds = joineryEngine.getPartBounds(shelf);
        // Setback frontal de 35mm respecto al borde delantero del casco
        expect(sideBounds.maxZ - shelfBounds.maxZ).toBeCloseTo(35, 1);
      }
      expectZeroCollisions(res.parts);
    });

    it('debe generar de 1 a 6 cajones en todas las combinaciones (overlay/inset, descuentos, apertura, corredera y fondo) con 0 colisiones', () => {
      const counts = [1, 2, 3, 4, 5, 6] as const;
      const variants: Omit<CabinetZoneDrawerConfig, 'count'>[] = [
        {
          frontMount: 'overlay',
          deductTopMm: 0,
          deductBottomMm: 0,
          deductLeftMm: 0,
          deductRightMm: 0,
          openingSystem: 'handle',
          slideType: 'telescopic',
          bottomType: 'grooved'
        },
        {
          frontMount: 'inset',
          deductTopMm: 10,
          deductBottomMm: 6,
          deductLeftMm: 8,
          deductRightMm: 8,
          openingSystem: 'finger_pull',
          slideType: 'undermount',
          bottomType: 'nailed'
        },
        {
          frontMount: 'overlay',
          deductTopMm: 4,
          deductBottomMm: 4,
          deductLeftMm: 4,
          deductRightMm: 4,
          openingSystem: 'push',
          slideType: 'push_open',
          bottomType: 'grooved'
        }
      ];

      for (const count of counts) {
        for (const variant of variants) {
          const cfg = makeZoneBaseConfig({
            width: 650,
            height: 1100,
            depth: 560,
            zoneTree: {
              id: 'zone_drawers',
              splitDirection: 'none',
              content: {
                type: 'drawers',
                drawers: {
                  count,
                  ...variant
                }
              }
            }
          });
          const res = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);
          const fronts = res.parts.filter(p => p.componentRole === 'drawer_front');
          expect(fronts.length).toBe(count);
          for (const front of fronts) {
            expect(front.zoneId).toBe('zone_drawers');
            expect(front.hardwareConfig?.frontMountType).toBe(variant.frontMount);
            expect(front.hardwareConfig?.slideType).toBe(variant.slideType);
            expect(front.hardwareConfig?.drawerOpeningSystem).toBe(variant.openingSystem);
          }
          expectZeroCollisions(res.parts);
        }
      }
    });

    it('debe generar puertas left/right/double/sliding en overlay e inset y barras colgadoras 1/2 con 0 colisiones', () => {
      const doorModes: ('left' | 'right' | 'double' | 'sliding')[] = [
        'left',
        'right',
        'double',
        'sliding'
      ];
      const mounts: ('overlay' | 'inset')[] = ['overlay', 'inset'];

      for (const opening of doorModes) {
        for (const mount of mounts) {
          const cfg = makeZoneBaseConfig({
            width: 900,
            height: 1800,
            depth: 600,
            zoneTree: {
              id: 'zone_doors',
              splitDirection: 'none',
              content: {
                type: 'doors',
                doors: {
                  opening,
                  mount,
                  hasHandle: true,
                  handleType: 'bar_modern',
                  handleFinish: 'brushed_steel'
                },
                shelvesCount: 2,
                shelfSetbackMm: 20,
                hangingRodsCount: 1
              }
            }
          });
          const res = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);
          const doors = res.parts.filter(p => p.componentRole === 'door');
          const expectedDoorCount = opening === 'double' || opening === 'sliding' ? 2 : 1;
          expect(doors.length).toBe(expectedDoorCount);
          expect(res.parts.filter(p => p.componentRole === 'shelf').length).toBe(2);
          expect(
            res.parts.filter(p => p.shapeType === 'circle' && p.materialId === 'hw_rod_chrome').length
          ).toBe(1);
          expectZeroCollisions(res.parts);
        }
      }

      // Barra colgadora doble (2 tubos + 1 divisor fijo sin isMovableShelf)
      const doubleRodRes = cabinetGen.generateZoneCabinet(
        makeZoneBaseConfig({
          width: 900,
          height: 2000,
          depth: 600,
          zoneTree: {
            id: 'zone_rods_2',
            splitDirection: 'none',
            content: { type: 'hanging_rod', hangingRodsCount: 2 }
          }
        }),
        SYNC_TEST_MATERIALS
      );
      const rods = doubleRodRes.parts.filter(
        p => p.shapeType === 'circle' && p.materialId === 'hw_rod_chrome'
      );
      const dividerShelf = doubleRodRes.parts.find(p => p.componentRole === 'shelf');
      expect(rods.length).toBe(2);
      expect(dividerShelf).toBeDefined();
      expect(dividerShelf?.hardwareConfig?.isMovableShelf).not.toBe(true);
      expectZeroCollisions(doubleRodRes.parts);
    });

    it('regresión: cajones overlay e inset dentro de zona ancestro con puertas (overlay, inset y corredizas sliding) deben quedar remetidos con 0 colisiones', () => {
      const doorCombos: { opening: 'double' | 'sliding'; doorMount: 'overlay' | 'inset' }[] = [
        { opening: 'double', doorMount: 'overlay' },
        { opening: 'sliding', doorMount: 'overlay' },
        { opening: 'sliding', doorMount: 'inset' }
      ];
      const drawerMounts: ('overlay' | 'inset')[] = ['overlay', 'inset'];

      for (const combo of doorCombos) {
        for (const frontMount of drawerMounts) {
          const cfg = makeZoneBaseConfig({
            width: 1200,
            height: 2000,
            depth: 600,
            zoneTree: {
              id: 'zone_ancestor_doors',
              splitDirection: 'vertical',
              content: {
                type: 'doors',
                doors: {
                  opening: combo.opening,
                  mount: combo.doorMount,
                  hasHandle: true,
                  handleType: 'bar_modern',
                  handleFinish: 'brushed_steel'
                }
              },
              children: [
                {
                  id: 'col_drawers',
                  splitDirection: 'none',
                  exactSizeMm: 500,
                  content: {
                    type: 'drawers',
                    drawers: {
                      count: 4,
                      frontMount,
                      deductTopMm: 0,
                      deductBottomMm: 0,
                      deductLeftMm: 0,
                      deductRightMm: 0,
                      openingSystem: 'handle',
                      slideType: 'undermount',
                      bottomType: 'grooved'
                    }
                  }
                },
                {
                  id: 'col_rod',
                  splitDirection: 'none',
                  sizeRatio: 1,
                  content: {
                    type: 'hanging_rod',
                    hangingRodsCount: 1
                  }
                }
              ]
            }
          });

          const res = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);
          const doors = res.parts.filter(p => p.componentRole === 'door');
          const drawerFronts = res.parts.filter(p => p.componentRole === 'drawer_front');
          expect(doors.length).toBe(2);
          expect(drawerFronts.length).toBe(4);

          const minDoorMinZ = Math.min(...doors.map(d => joineryEngine.getPartBounds(d).minZ));
          for (const front of drawerFronts) {
            const fb = joineryEngine.getPartBounds(front);
            expect(fb.maxZ).toBeLessThan(minDoorMinZ);
          }

          expectZeroCollisions(res.parts);
        }
      }
    });
  });

  describe('3. computeZoneHighlightBoxes, hydrateTemplateConfig y reconstructConfigFromParts', () => {
    it('debe alinear computeZoneHighlightBoxes a módulos rotados/trasladados y preservar zoneTree en hidratación y reconstrucción', () => {
      const tree: CabinetZoneNode = {
        id: 'zone_root',
        splitDirection: 'vertical',
        children: [
          {
            id: 'zone_left',
            splitDirection: 'none',
            exactSizeMm: 280,
            content: { type: 'shelves', shelvesCount: 2, shelfSetbackMm: 15 }
          },
          {
            id: 'zone_right',
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
          }
        ]
      };

      const cfg = makeZoneBaseConfig({ width: 800, height: 820, depth: 580, zoneTree: tree });
      const res = cabinetGen.generateZoneCabinet(cfg, SYNC_TEST_MATERIALS);

      // Cajas canónicas
      const canonicalBoxes = cabinetGen.computeZoneHighlightBoxes(cfg, res.parts);
      const leftBox = canonicalBoxes.get('zone_left')!;
      const rightBox = canonicalBoxes.get('zone_right')!;
      expect(leftBox).toBeDefined();
      expect(rightBox).toBeDefined();
      expect(leftBox.maxX - leftBox.minX).toBeCloseTo(280, 1);
      expect(leftBox.maxX).toBeLessThan(rightBox.minX);

      // Trasladar y rotar el módulo 90° (facing 'right')
      const rotatedParts = res.parts.map(p => ({
        ...p,
        posX: (p.posZ ?? 0) + 1200,
        posZ: -(p.posX ?? 0) + 400,
        orientation:
          p.orientation === 'vertical_yz'
            ? ('vertical_xy' as const)
            : p.orientation === 'vertical_xy'
              ? ('vertical_yz' as const)
              : ('horizontal' as const)
      }));
      const rotatedBoxes = cabinetGen.computeZoneHighlightBoxes(cfg, rotatedParts);
      const rotLeft = rotatedBoxes.get('zone_left')!;
      const rotRight = rotatedBoxes.get('zone_right')!;
      // En facing 'right', el eje X del mueble rota hacia -Z
      expect(rotLeft.minZ).toBeGreaterThan(rotRight.maxZ);
      expect((rotLeft.minX + rotLeft.maxX) / 2).toBeGreaterThan(1000);

      // reconstructConfigFromParts debe preservar zoneTree exacto
      const reconstructed = cabinetGen.reconstructConfigFromParts(res.parts, res.group);
      expect(reconstructed.zoneTree?.id).toBe('zone_root');
      expect(reconstructed.zoneTree?.children?.length).toBe(2);
      expect(reconstructed.zoneTree?.children?.[0].exactSizeMm).toBe(280);

      // hydrateTemplateConfig debe hidratar zoneTree en todas las plantillas del catálogo
      for (const tpl of templatesCatalog.templates.slice(0, 6)) {
        const hydrated = cabinetGen.hydrateTemplateConfig(tpl, SYNC_TEST_MATERIALS);
        expect(hydrated.zoneTree).toBeDefined();
        expect(hydrated.width).toBeGreaterThanOrEqual(200);
      }
    });
  });

  describe('4. Fase 5: Sincronización Cero-Duplicados y Cero-Huérfanos al Re-Editar en Vivo', () => {
    it('debe sincronizar HardwareCatalogService, ProjectStorageService (tapacantos/piezas), CutOptimizerService y AssemblyGuideService con 0 duplicados y 0 huérfanos', () => {
      // Paso 1: Crear módulo inicial con 3 repisas móviles + 2 puertas abatibles con tiradores
      const initialCfg = makeZoneBaseConfig({
        name: 'Módulo Sync V1',
        width: 800,
        height: 900,
        depth: 560,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: {
            type: 'doors',
            doors: {
              opening: 'double',
              mount: 'overlay',
              hasHandle: true,
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel'
            },
            shelvesCount: 3,
            shelfSetbackMm: 20
          }
        }
      });

      const initialRes = cabinetGen.generateZoneCabinet(initialCfg, SYNC_TEST_MATERIALS);
      projectStorage.addParametricCabinet(initialRes);
      const groupId = initialRes.group.id;
      const moduleId = initialRes.module.id;

      let parts = projectStorage.currentProject().parts;
      let hwList = hardwareCatalog.computeRequiredHardwareList(parts);
      expect(hwList.find(h => h.id === 'hw_soportes_repisa')?.quantity).toBe(12); // 3 repisas * 4 pines
      expect(hwList.find(h => h.id === 'hw_bisagra_35')?.quantity).toBeGreaterThanOrEqual(4);
      expect(hwList.find(h => h.id === 'hw_tiradores')?.quantity).toBe(2);

      // Paso 2: Live re-edit -> 2 columnas: izq 4 cajones corredera oculta (undermount) + der 2 barras colgadoras + puertas corredizas + patas
      const liveCfgV2 = makeZoneBaseConfig({
        id: moduleId,
        name: 'Módulo Sync V2',
        width: 1200,
        height: 2000,
        depth: 600,
        baseType: 'legs',
        hasPlinth: false,
        plinthHeight: 120,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'vertical',
          content: {
            type: 'doors',
            doors: {
              opening: 'sliding',
              mount: 'overlay',
              hasHandle: true,
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel'
            }
          },
          children: [
            {
              id: 'z_drawers',
              splitDirection: 'none',
              exactSizeMm: 500,
              content: {
                type: 'drawers',
                drawers: {
                  count: 4,
                  frontMount: 'inset',
                  deductTopMm: 0,
                  deductBottomMm: 0,
                  deductLeftMm: 0,
                  deductRightMm: 0,
                  openingSystem: 'finger_pull',
                  slideType: 'undermount',
                  bottomType: 'grooved'
                }
              }
            },
            {
              id: 'z_rods',
              splitDirection: 'none',
              sizeRatio: 1,
              content: {
                type: 'hanging_rod',
                hangingRodsCount: 2
              }
            }
          ]
        }
      });

      const genV2 = cabinetGen.generateZoneCabinet(liveCfgV2, SYNC_TEST_MATERIALS, {
        groupId,
        moduleId
      });
      projectStorage.liveUpdateParametricModuleParts(
        groupId,
        genV2.parts,
        liveCfgV2.name,
        genV2.group.parametricConfig,
        false,
        { module: genV2.module }
      );

      // Verificar 0 duplicados de grupos/piezas y 0 módulos/herrajes huérfanos
      const projV2 = projectStorage.currentProject();
      expect((projV2.groups || []).length).toBe(1);
      expect(projV2.groups![0].id).toBe(groupId);
      expect(projV2.modules.length).toBe(1);
      expect(projV2.modules[0].id).toBe(moduleId);

      parts = projV2.parts;
      expect(new Set(parts.map(p => p.id)).size).toBe(parts.length);
      expect(parts.every(p => p.groupId === groupId)).toBe(true);
      expectZeroCollisions(parts);

      hwList = hardwareCatalog.computeRequiredHardwareList(parts);
      expect(new Set(hwList.map(h => h.id)).size).toBe(hwList.length);
      // Soportes de repisa y bisagras anteriores deben desaparecer por completo (0 huérfanos)
      expect(hwList.find(h => h.id === 'hw_soportes_repisa')).toBeUndefined();
      expect(hwList.find(h => h.id === 'hw_bisagra_35')).toBeUndefined();
      // Nuevos herrajes presentes en cantidad exacta
      expect(hwList.find(h => h.id === 'hw_correderas_oculta')?.quantity).toBe(4);
      expect(hwList.find(h => h.id === 'hw_tubo_colgador')?.quantity).toBe(2);
      expect(hwList.find(h => h.id === 'hw_kit_closet')?.quantity).toBe(1);
      expect(hwList.find(h => h.id === 'hw_patas_niveladoras')?.quantity).toBe(4);
      // Cajones uñero no suman tiradores; las 2 puertas corredizas sí tienen tirador
      expect(hwList.find(h => h.id === 'hw_tiradores')?.quantity).toBe(2);

      // CutOptimizer debe reflejar únicamente piezas cortables actuales (excluyendo tubos y patas)
      const optV2 = cutOptimizer.optimizeProject(parts, SYNC_TEST_MATERIALS, TEST_SETTINGS);
      const expectedCuttableQty = parts
        .filter(p => !p.excludeFromCutlist)
        .reduce((acc, p) => acc + (p.quantity || 1), 0);
      expect(optV2.totalPartsCount).toBe(expectedCuttableQty);
      expect(optV2.thickEdgeMeters).toBeGreaterThan(0);
      expect(optV2.thinEdgeMeters).toBeGreaterThan(0);

      // AssemblyGuide debe reflejar 1 única guía actualizada con todas las piezas V2 y 0 duplicados
      const guidesV2 = assemblyGuide.generateGuidesForProject(projV2);
      expect(guidesV2.length).toBe(1);
      expect(guidesV2[0].moduleId).toBe(groupId);
      expect(guidesV2[0].moduleName).toBe('Módulo Sync V2');
      expect(guidesV2[0].rawParts.length).toBe(parts.length);
      expect(new Set(guidesV2[0].pieces.map(pc => pc.code)).size).toBe(guidesV2[0].pieces.length);

      // Paso 3: Live re-edit final -> 2 repisas móviles sin puertas y confirmar con updateParametricCabinet
      const liveCfgV3 = makeZoneBaseConfig({
        id: moduleId,
        name: 'Módulo Sync V3 Final',
        width: 700,
        height: 900,
        depth: 450,
        baseType: 'none',
        hasPlinth: false,
        plinthHeight: 0,
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: { type: 'shelves', shelvesCount: 2, shelfSetbackMm: 15 }
        }
      });
      const genV3 = cabinetGen.generateZoneCabinet(liveCfgV3, SYNC_TEST_MATERIALS, {
        groupId,
        moduleId
      });
      projectStorage.updateParametricCabinet(
        groupId,
        genV3.parts,
        liveCfgV3.name,
        genV3.group.parametricConfig,
        genV3.module
      );

      const projV3 = projectStorage.currentProject();
      expect((projV3.groups || []).length).toBe(1);
      expect(projV3.modules.length).toBe(1);

      const hwV3 = hardwareCatalog.computeRequiredHardwareList(projV3.parts);
      expect(hwV3.find(h => h.id === 'hw_soportes_repisa')?.quantity).toBe(8);
      expect(hwV3.find(h => h.id === 'hw_correderas_oculta')).toBeUndefined();
      expect(hwV3.find(h => h.id === 'hw_tubo_colgador')).toBeUndefined();
      expect(hwV3.find(h => h.id === 'hw_kit_closet')).toBeUndefined();
      expect(hwV3.find(h => h.id === 'hw_patas_niveladoras')).toBeUndefined();
      expect(hwV3.find(h => h.id === 'hw_tiradores')).toBeUndefined();

      const optV3 = cutOptimizer.optimizeProject(projV3.parts, SYNC_TEST_MATERIALS, TEST_SETTINGS);
      expect(optV3.totalPartsCount).toBe(projV3.parts.length);
      expect(optV3.thickEdgeMeters).toBe(0);

      const guidesV3 = assemblyGuide.generateGuidesForProject(projV3);
      expect(guidesV3.length).toBe(1);
      expect(guidesV3[0].rawParts.length).toBe(projV3.parts.length);
    });
  });
});
