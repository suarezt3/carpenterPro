import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BudgetViewComponent } from '../components/budget-view/budget-view';
import { computeFloorClampedExplodedLayout } from '../components/furniture-3d-viewer/furniture-3d-viewer';
import { LabelsViewComponent } from '../components/labels-view/labels-view';
import {
  CabinetZoneNode,
  computePartCutDimensions,
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../models/melamine.models';
import { AssemblyGuideService } from './assembly-guide.service';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { CurrencyExchangeService, DEFAULT_COP_RATES } from './currency-exchange.service';
import { CutOptimizerService } from './cut-optimizer.service';
import { HardwareCatalogService } from './hardware-catalog.service';
import { I18nService } from './i18n.service';
import { PartGeometryService } from './part-geometry.service';
import { PaymentService } from './payment.service';
import { ProjectStorageService } from './project-storage.service';
import { ThemeService } from './theme.service';

const TEST_MATERIALS: Material[] = [
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

function buildClosetConfig(): ParametricCabinetConfig {
  return {
    code: 'CLOSET_CUT',
    name: 'Clóset 3 Cuerpos Despiece',
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

describe('Consistencia Integral: Despiece, Optimizador 2D, Presupuesto y Etiquetas tras Flujo Completo', () => {
  let projectStorage: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let cutOptimizer: CutOptimizerService;
  let hardwareCatalog: HardwareCatalogService;
  let assemblyGuide: AssemblyGuideService;
  let partGeometry: PartGeometryService;
  let budgetFixture: ComponentFixture<BudgetViewComponent> | null = null;
  let labelsFixture: ComponentFixture<LabelsViewComponent> | null = null;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      localStorage.setItem(
        'melamipro_exchange_rates_cache_v1',
        JSON.stringify({ timestamp: Date.now(), rates: DEFAULT_COP_RATES })
      );
    }

    const paymentServiceStub = {
      isWorkshopExportRestricted: () => false,
      openUpgradeModal: () => undefined
    };

    await TestBed.configureTestingModule({
      imports: [BudgetViewComponent, LabelsViewComponent],
      providers: [
        ProjectStorageService,
        CabinetGeneratorService,
        CutOptimizerService,
        HardwareCatalogService,
        AssemblyGuideService,
        PartGeometryService,
        ConfirmDialogService,
        CurrencyExchangeService,
        ThemeService,
        I18nService,
        { provide: PaymentService, useValue: paymentServiceStub }
      ]
    }).compileComponents();

    projectStorage = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    cutOptimizer = TestBed.inject(CutOptimizerService);
    hardwareCatalog = TestBed.inject(HardwareCatalogService);
    assemblyGuide = TestBed.inject(AssemblyGuideService);
    partGeometry = TestBed.inject(PartGeometryService);
    TestBed.inject(I18nService).setLanguage('es');

    projectStorage.clearFurniture();
    projectStorage.updateProject(
      p => ({
        ...p,
        materials: [...TEST_MATERIALS],
        settings: { ...TEST_SETTINGS }
      }),
      false
    );
  });

  afterEach(() => {
    budgetFixture?.destroy();
    budgetFixture = null;
    labelsFixture?.destroy();
    labelsFixture = null;
    projectStorage?.flushPendingStorageSave();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it(
    'debe producir despiece, optimización, herrajes, presupuesto, guía de armado y etiquetas sin NaN, sin dimensiones <= 0, sin IDs duplicados y con conteo exacto tras ungroup -> mover -> reagrupar -> cambiar material -> explosionar',
    () => {
      // 1. Generar clóset de 3 cuerpos + pieza manual adicional
      const generated = cabinetGen.generateZoneCabinet(buildClosetConfig(), TEST_MATERIALS);
      const generatedTotalCount = generated.parts.length;
      const generatedCuttableCount = generated.parts.filter(p => !p.excludeFromCutlist).length;
      projectStorage.addParametricCabinet(generated);

      const manualBoard: Part = {
        id: 'manual_side_trim',
        name: 'Cenefa Lateral Manual',
        length: 2100,
        width: 120,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_oak_18',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: 930,
        posY: 1050,
        posZ: 220,
        orientation: 'vertical_xy',
        isParametricGenerated: false
      };
      projectStorage.addPart(manualBoard);

      const closetPartIds = projectStorage
        .partsList()
        .filter(p => p.groupId === generated.group.id)
        .map(p => p.id);

      // 2. Flujo completo de linaje: ungroup -> mover repisa -> createGroup -> cambiar material
      projectStorage.ungroup(generated.group.id);

      const shelfToMove = projectStorage
        .partsList()
        .find(p => closetPartIds.includes(p.id) && p.componentRole === 'shelf');
      expect(shelfToMove).toBeDefined();
      const targetPosY = Math.round(((shelfToMove!.posY ?? 0) + 100) * 10) / 10;
      projectStorage.updatePart({ ...shelfToMove!, posY: targetPosY });

      const regrouped = projectStorage.createGroup(
        'Clóset 3 Cuerpos Final',
        closetPartIds,
        'assembly'
      );
      const storedRegrouped = projectStorage.groupsList().find(g => g.id === regrouped.id)!;
      const regroupedParts = projectStorage.partsList().filter(p => p.groupId === regrouped.id);
      const reconstructed = cabinetGen.reconstructConfigFromParts(regroupedParts, storedRegrouped);
      const hydrated = cabinetGen.hydrateZoneTreeFromConfig(reconstructed);

      const updatedCfg: ParametricCabinetConfig = {
        ...hydrated,
        structureMaterialId: 'mat_oak_18'
      };
      const regen = cabinetGen.generateZoneCabinet(updatedCfg, TEST_MATERIALS, {
        groupId: storedRegrouped.id,
        moduleId: updatedCfg.id
      });
      projectStorage.updateParametricCabinet(
        storedRegrouped.id,
        regen.parts,
        storedRegrouped.name,
        regen.group.parametricConfig,
        regen.module
      );

      // 3. Explosionar al 50%, 100% y volver a 0%
      const proj = projectStorage.currentProject();
      const parts = proj.parts;
      const groups = proj.groups || [];
      const getWorldAABB = (part: Part) => partGeometry.getWorldAABB(part);

      const exploded50 = computeFloorClampedExplodedLayout(parts, groups, 50, getWorldAABB);
      const exploded100 = computeFloorClampedExplodedLayout(parts, groups, 100, getWorldAABB);
      const restored0 = computeFloorClampedExplodedLayout(parts, groups, 0, getWorldAABB);

      for (const item of [...exploded50, ...exploded100]) {
        expect(Number.isFinite(item.bottomY)).toBe(true);
        expect(item.bottomY).toBeGreaterThanOrEqual(-0.001);
      }
      for (const item of restored0) {
        expect(item.explodedCenter).toEqual(item.originalCenter);
      }

      // 4. Validaciones estructurales de piezas del proyecto
      expect(parts.length).toBe(generatedTotalCount + 1);
      expect(new Set(parts.map(p => p.id)).size).toBe(parts.length);

      for (const pt of parts) {
        expect(Number.isFinite(pt.length)).toBe(true);
        expect(Number.isFinite(pt.width)).toBe(true);
        expect(Number.isFinite(pt.thickness)).toBe(true);
        expect(Number.isFinite(pt.quantity)).toBe(true);
        expect(pt.length).toBeGreaterThan(0);
        expect(pt.width).toBeGreaterThan(0);
        expect(pt.thickness).toBeGreaterThan(0);
        expect(pt.quantity).toBeGreaterThanOrEqual(1);
        expect(Number.isFinite(pt.posX ?? 0)).toBe(true);
        expect(Number.isFinite(pt.posY ?? 0)).toBe(true);
        expect(Number.isFinite(pt.posZ ?? 0)).toBe(true);
      }

      // 5. CutOptimizerService (Despiece y Optimización 2D)
      const cuttableParts = cutOptimizer.getCuttableParts(parts, TEST_MATERIALS);
      const expectedCuttableCount = generatedCuttableCount + 1;
      expect(cuttableParts.length).toBe(expectedCuttableCount);

      for (const pt of cuttableParts) {
        const cutDims = computePartCutDimensions(
          pt,
          !!TEST_SETTINGS.subtractEdgeBandingFromCut,
          TEST_SETTINGS.thinEdgeThickness,
          TEST_SETTINGS.thickEdgeThickness
        );
        expect(Number.isFinite(cutDims.cutLength)).toBe(true);
        expect(Number.isFinite(cutDims.cutWidth)).toBe(true);
        expect(cutDims.cutLength).toBeGreaterThan(0);
        expect(cutDims.cutWidth).toBeGreaterThan(0);
      }

      const opt = cutOptimizer.optimizeProject(parts, TEST_MATERIALS, TEST_SETTINGS);
      expect(opt.unplacedParts.length).toBe(0);
      expect(opt.totalPartsCount).toBe(expectedCuttableCount);
      expect(opt.totalPartsPlaced).toBe(expectedCuttableCount);
      expect(opt.sheets.length).toBeGreaterThan(0);
      expect(Number.isFinite(opt.totalCutMeters)).toBe(true);
      expect(Number.isFinite(opt.totalAreaUsedM2)).toBe(true);
      expect(Number.isFinite(opt.totalAreaSheetsM2)).toBe(true);
      expect(Number.isFinite(opt.overallEfficiency)).toBe(true);
      expect(Number.isFinite(opt.thinEdgeMeters)).toBe(true);
      expect(Number.isFinite(opt.thickEdgeMeters)).toBe(true);
      expect(opt.totalAreaUsedM2).toBeGreaterThan(0);
      expect(opt.totalAreaSheetsM2).toBeGreaterThan(0);
      expect(opt.overallEfficiency).toBeGreaterThan(0);
      expect(opt.thinEdgeMeters).toBeGreaterThanOrEqual(0);
      expect(opt.thickEdgeMeters).toBeGreaterThan(0);

      for (const sheet of opt.sheets) {
        for (const placed of sheet.placedParts) {
          expect(Number.isFinite(placed.x)).toBe(true);
          expect(Number.isFinite(placed.y)).toBe(true);
          expect(Number.isFinite(placed.length)).toBe(true);
          expect(Number.isFinite(placed.width)).toBe(true);
          expect(placed.x).toBeGreaterThanOrEqual(0);
          expect(placed.y).toBeGreaterThanOrEqual(0);
          expect(placed.length).toBeGreaterThan(0);
          expect(placed.width).toBeGreaterThan(0);
        }
      }

      // 6. HardwareCatalogService y BudgetViewComponent (Presupuesto)
      const autoHardware = hardwareCatalog.computeRequiredHardwareList(parts);
      expect(autoHardware.length).toBeGreaterThan(0);
      expect(new Set(autoHardware.map(h => h.id)).size).toBe(autoHardware.length);
      for (const hw of autoHardware) {
        expect(Number.isFinite(hw.quantity)).toBe(true);
        expect(Number.isFinite(hw.unitCost)).toBe(true);
        expect(hw.quantity).toBeGreaterThan(0);
        expect(hw.unitCost).toBeGreaterThanOrEqual(0);
      }

      budgetFixture = TestBed.createComponent(BudgetViewComponent);
      const budget = budgetFixture.componentInstance;
      budgetFixture.detectChanges();

      expect(budget.optResult().totalPartsCount).toBe(expectedCuttableCount);
      expect(Number.isFinite(budget.sheetsCostBreakdown().totalSheetsCost)).toBe(true);
      expect(budget.sheetsCostBreakdown().totalSheetsCost).toBeGreaterThan(0);
      expect(Number.isFinite(budget.edgesCostBreakdown().totalEdgeCost)).toBe(true);
      expect(budget.edgesCostBreakdown().totalEdgeCost).toBeGreaterThan(0);
      expect(Number.isFinite(budget.hardwareCostTotal())).toBe(true);
      expect(budget.hardwareCostTotal()).toBeGreaterThan(0);
      expect(Number.isFinite(budget.totalMaterialsCost())).toBe(true);
      expect(budget.totalMaterialsCost()).toBeGreaterThan(0);
      expect(Number.isFinite(budget.laborTotal())).toBe(true);
      expect(Number.isFinite(budget.productionCost())).toBe(true);
      expect(Number.isFinite(budget.profitAmount())).toBe(true);
      expect(Number.isFinite(budget.subtotalBeforeTax())).toBe(true);
      expect(Number.isFinite(budget.taxAmount())).toBe(true);
      expect(Number.isFinite(budget.finalClientPrice())).toBe(true);
      expect(budget.finalClientPrice()).toBeGreaterThan(0);

      // 7. AssemblyGuideService y LabelsViewComponent (Guía de Armado y Etiquetas)
      const guides = assemblyGuide.generateGuidesForProject(proj);
      expect(guides.length).toBeGreaterThanOrEqual(1);
      const guidePartIds = guides.flatMap(g => g.rawParts.map(rp => rp.id));
      expect(new Set(guidePartIds).size).toBe(guidePartIds.length);
      expect(guidePartIds.length).toBe(parts.length);
      for (const guide of guides) {
        expect(new Set(guide.pieces.map(pc => pc.code)).size).toBe(guide.pieces.length);
      }

      labelsFixture = TestBed.createComponent(LabelsViewComponent);
      const labels = labelsFixture.componentInstance;
      labelsFixture.detectChanges();

      const flatLabels = labels.flatLabels();
      expect(labels.labelableParts().length).toBe(expectedCuttableCount);
      expect(flatLabels.length).toBe(expectedCuttableCount);
      expect(new Set(flatLabels.map(l => l.trackId)).size).toBe(flatLabels.length);
      for (const label of flatLabels) {
        expect(Number.isFinite(label.cutLength)).toBe(true);
        expect(Number.isFinite(label.cutWidth)).toBe(true);
        expect(label.cutLength).toBeGreaterThan(0);
        expect(label.cutWidth).toBeGreaterThan(0);
        expect(label.labelId.length).toBeGreaterThan(0);
        expect(label.moduleName.length).toBeGreaterThan(0);
        expect(label.barcodeBars.length).toBeGreaterThan(0);
      }
    },
    20000
  );
});
