import { TestBed } from '@angular/core/testing';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ModuleDesignerComponent } from './module-designer';
import { MELAMINE_MATERIALS_CATALOG } from '../../data/melamine-catalog.data';
import { DEFAULT_COUNTERTOP_MATERIALS, Material, Part, ApplianceItem } from '../../models/melamine.models';

describe('Separación Estricta de Catálogos de Materiales en ModuleDesigner (Melamina vs Mesón)', () => {
  let component: ModuleDesignerComponent;
  let projectService: ProjectStorageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [ProjectStorageService]
    }).compileComponents();

    projectService = TestBed.inject(ProjectStorageService);
    const fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
  });

  describe('1. Signals Computados: melamineBoardMaterials vs countertopMaterials', () => {
    it('melamineBoardMaterials debe incluir únicamente tableros de mobiliario y MDF Durolac', () => {
      const melamineMats = component.melamineBoardMaterials();
      expect(melamineMats.length).toBeGreaterThan(0);

      for (const m of melamineMats) {
        // Ninguno debe ser de categoría countertop o stone
        expect(m.category).not.toBe('countertop');
        expect(m.category).not.toBe('stone');
        expect(m.family).not.toBe('stone_countertop');
        expect(m.textureType).not.toBe('stone');

        // Ninguno debe contener palabras clave de mesón o sufijo (Mesón)
        const nameLower = m.name.toLowerCase();
        expect(nameLower).not.toContain('(mesón)');
        expect(nameLower).not.toContain('(meson)');
        expect(nameLower).not.toContain('cuarzo');
        expect(nameLower).not.toContain('mármol');
        expect(nameLower).not.toContain('marmol');
        expect(nameLower).not.toContain('granito');
        expect(nameLower).not.toContain('sinterizada');
        expect(nameLower).not.toContain('terrazzo');
        expect(nameLower).not.toContain('terrazo');
        expect(nameLower).not.toContain('dekton');
        expect(nameLower).not.toContain('silestone');
        expect(nameLower).not.toContain('neolith');
        if (m.thickness >= 30) {
          expect(nameLower).not.toContain('macizo');
        }
      }
    });

    it('countertopMaterials debe incluir únicamente materiales de mesón/cubiertas y excluir melaminas y MDF 3mm', () => {
      const ctMats = component.countertopMaterials();
      expect(ctMats.length).toBeGreaterThan(0);

      for (const m of ctMats) {
        const nameLower = m.name.toLowerCase();
        // Debe ser un material de mesón/piedra/macizo
        const isCt = component.isCountertopOrStoneMaterial(m);
        expect(isCt).toBe(true);

        // Excluye melaminas estándar y MDF 3mm
        expect(nameLower).not.toContain('melamina roble');
        expect(nameLower).not.toContain('melamina blanco');
        expect(nameLower).not.toContain('durolac');
        if (m.thickness === 3) {
          expect(m.family).not.toBe('mdf_back');
        }
      }
    });

    it('intersección entre melamineBoardMaterials y countertopMaterials debe ser estrictamente vacía', () => {
      const melIds = new Set(component.melamineBoardMaterials().map(m => m.id));
      const ctIds = new Set(component.countertopMaterials().map(m => m.id));

      for (const id of melIds) {
        expect(ctIds.has(id)).toBe(false);
      }
    });

    it('melaminas con nombre de diseño mármol/piedra deben clasificarse en melamineBoardMaterials y no en countertopMaterials', () => {
      const melMarmol: Material = {
        id: 'mat_test_mel_marmol',
        name: 'Melamina Mármol Carrara Mate',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 210000,
        hasGrain: false,
        colorHex: '#e5e7eb',
        category: 'board'
      };
      projectService.addMaterial(melMarmol);

      const isCt = component.isCountertopOrStoneMaterial(melMarmol);
      expect(isCt).toBe(false);

      const inMel = component.melamineBoardMaterials().some(m => m.id === melMarmol.id);
      const inCt = component.countertopMaterials().some(m => m.id === melMarmol.id);
      expect(inMel).toBe(true);
      expect(inCt).toBe(false);
    });

    it('materiales pétreos personalizados sin sufijo (Mesón) deben clasificarse en countertopMaterials', () => {
      const customStone: Material = {
        id: 'mat_test_custom_stone',
        name: 'Piedra Calacatta Natural 20mm',
        thickness: 20,
        sheetLength: 3000,
        sheetWidth: 1600,
        sheetCost: 1500000,
        hasGrain: false,
        colorHex: '#f3f4f6'
      };
      projectService.addMaterial(customStone);

      const isCt = component.isCountertopOrStoneMaterial(customStone);
      expect(isCt).toBe(true);

      const inMel = component.melamineBoardMaterials().some(m => m.id === customStone.id);
      const inCt = component.countertopMaterials().some(m => m.id === customStone.id);
      expect(inMel).toBe(false);
      expect(inCt).toBe(true);
    });

    it('filteredCountertopMaterials no debe quedar vacío si se selecciona una familia de melamina', () => {
      component.materialSelectedFamily.set('wood_light');
      const ctMats = component.filteredCountertopMaterials();
      expect(ctMats.length).toBeGreaterThan(0);
      expect(ctMats.every(m => component.isCountertopOrStoneMaterial(m))).toBe(true);
    });

    it('melamineBoardFamilies no debe contener la familia stone_countertop', () => {
      const families = component.melamineBoardFamilies;
      expect(families.some(f => f.id === 'stone_countertop')).toBe(false);
      expect(families.some(f => f.id === 'wood_light')).toBe(true);
      expect(families.some(f => f.id === 'wood_medium')).toBe(true);
      expect(families.some(f => f.id === 'wood_dark')).toBe(true);
      expect(families.some(f => f.id === 'solid_matte')).toBe(true);
      expect(families.some(f => f.id === 'high_gloss')).toBe(true);
      expect(families.some(f => f.id === 'textile_linen')).toBe(true);
      expect(families.some(f => f.id === 'mdf_back')).toBe(true);
    });
  });

  describe('2. Detección Inteligente de Piezas y Selección Individual', () => {
    it('isPartCountertop debe identificar piezas con rol countertop o backsplash', () => {
      const slab: Part = {
        id: 'slab_1',
        name: 'CUBIERTA PRINCIPAL',
        length: 1800,
        width: 620,
        thickness: 30,
        quantity: 1,
        materialId: 'mat_stone_carrara_30',
        materialName: 'Piedra Mármol Carrara Pulido (Mesón)',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'countertop'
      };
      expect(component.isPartCountertop(slab)).toBe(true);

      const backsplash: Part = {
        id: 'bs_1',
        name: 'SALPICADERO FRONTAL',
        length: 1800,
        width: 75,
        thickness: 20,
        quantity: 1,
        materialId: 'mat_stone_quartz_polar_20',
        materialName: 'Cuarzo Blanco Polar Silestone (Mesón)',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'backsplash'
      };
      expect(component.isPartCountertop(backsplash)).toBe(true);
    });

    it('isPartCountertop debe retornar false para piezas de mobiliario (laterales, repisas, puertas, frentes)', () => {
      const door: Part = {
        id: 'door_1',
        name: 'PUERTA DERECHA',
        length: 700,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_roble_18',
        materialName: 'Melamina Roble Kendal Natural',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'door'
      };
      expect(component.isPartCountertop(door)).toBe(false);

      const side: Part = {
        id: 'side_1',
        name: 'LATERAL IZQUIERDO',
        length: 720,
        width: 580,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_blanco_18',
        materialName: 'Melamina Blanco Glacial',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_left'
      };
      expect(component.isPartCountertop(side)).toBe(false);
    });

    it('isSelectedPartCountertop debe reaccionar según la pieza seleccionada', () => {
      const parts = projectService.partsList();
      const deskBottom = parts.find(p => p.id === 'desk_bottom');
      expect(deskBottom).toBeTruthy();

      // Seleccionar piso inferior (pieza de melamina)
      component.selectedPartId.set('desk_bottom');
      expect(component.isSelectedPartCountertop()).toBe(false);

      // Si se crea y selecciona un mesón
      const ctParts = projectService.generateSmartCountertop({
        shape: 'straight',
        materialId: 'mat_stone_carrara_30',
        thickness: 30,
        includeBacksplash: true,
        backsplashHeight: 75,
        length: 1200,
        sideLength: 0,
        depth: 600
      });
      expect(ctParts.length).toBeGreaterThan(0);

      component.selectedPartId.set(ctParts[0].id);
      expect(component.isSelectedPartCountertop()).toBe(true);
    });
  });

  describe('3. Edición en Bloque y Aislamiento en Multi-Selección con Shift', () => {
    it('hasSelectedMelamine, hasSelectedCountertops y hasSelectedAppliances deben activarse solo si count > 0', () => {
      // Estado inicial vacío
      component.selectedPartIds.set([]);
      component.selectedApplianceIds.set([]);

      expect(component.hasSelectedMelamine()).toBe(false);
      expect(component.hasSelectedCountertops()).toBe(false);
      expect(component.hasSelectedAppliances()).toBe(false);

      // Agregar pieza de melamina
      component.selectedPartIds.set(['desk_bottom']);
      expect(component.hasSelectedMelamine()).toBe(true);
      expect(component.hasSelectedCountertops()).toBe(false);
      expect(component.hasSelectedAppliances()).toBe(false);

      // Agregar electrodoméstico
      const app: ApplianceItem = {
        id: 'test_oven_1',
        name: 'Horno Empotrable',
        type: 'oven',
        width: 600,
        height: 600,
        depth: 550,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        mountType: 'built_in',
        price: 1500000,
        includeInBudget: true,
        finish: 'stainless_steel'
      };
      projectService.addAppliance(app);

      component.selectedApplianceIds.set([app.id]);
      expect(component.hasSelectedMelamine()).toBe(true);
      expect(component.hasSelectedAppliances()).toBe(true);
      expect(component.hasSelectedCountertops()).toBe(false);

      // Generar mesón y agregarlo a la selección múltiple
      const ctParts = projectService.generateSmartCountertop({
        shape: 'straight',
        materialId: 'mat_stone_granite_black_30',
        thickness: 30,
        includeBacksplash: false,
        backsplashHeight: 0,
        length: 1500,
        sideLength: 0,
        depth: 600
      });

      component.selectedPartIds.set(['desk_bottom', ctParts[0].id]);
      expect(component.hasSelectedMelamine()).toBe(true);
      expect(component.hasSelectedCountertops()).toBe(true);
      expect(component.hasSelectedAppliances()).toBe(true);
    });

    it('applyBulkMelamineMaterial debe cambiar únicamente piezas de melamina dejando intactos mesones y equipos', () => {
      // Crear mesón
      const ctParts = projectService.generateSmartCountertop({
        shape: 'straight',
        materialId: 'mat_stone_carrara_30',
        thickness: 30,
        includeBacksplash: false,
        backsplashHeight: 0,
        length: 1200,
        sideLength: 0,
        depth: 600
      });
      const ctId = ctParts[0].id;

      // Crear electrodoméstico
      const app: ApplianceItem = {
        id: 'test_app_oven',
        name: 'Horno',
        type: 'oven',
        width: 600,
        height: 600,
        depth: 550,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        mountType: 'built_in',
        price: 1500000,
        includeInBudget: true,
        finish: 'stainless_steel'
      };
      projectService.addAppliance(app);
      const appId = app.id;
      const initialAppFinish = app.finish;

      // Multi-seleccionar pieza melamina ('desk_bottom'), mesón y equipo
      component.selectedPartIds.set(['desk_bottom', ctId]);
      component.selectedApplianceIds.set([appId]);

      // Aplicar Melamina en bloque: Nogal Terracota
      const nogalMat = component.melamineBoardMaterials().find(m => m.id.includes('nogal')) || component.melamineBoardMaterials()[1];
      component.applyBulkMelamineMaterial(nogalMat.id);

      // Verificar que la pieza de melamina cambió
      const updatedDesk = projectService.partsList().find(p => p.id === 'desk_bottom');
      expect(updatedDesk?.materialId).toBe(nogalMat.id);

      // Verificar que el mesón NO cambió de material
      const updatedCt = projectService.partsList().find(p => p.id === ctId);
      expect(updatedCt?.materialId).toBe('mat_stone_carrara_30');

      // Verificar que el equipo conservó su acabado intacto
      const updatedApp = projectService.appliancesList().find(a => a.id === appId);
      expect(updatedApp?.finish).toBe(initialAppFinish);
    });

    it('applyBulkCountertopMaterial debe cambiar únicamente mesones dejando intactas piezas de melamina y equipos', () => {
      // Crear mesón
      const ctParts = projectService.generateSmartCountertop({
        shape: 'straight',
        materialId: 'mat_stone_carrara_30',
        thickness: 30,
        includeBacksplash: false,
        backsplashHeight: 0,
        length: 1200,
        sideLength: 0,
        depth: 600
      });
      const ctId = ctParts[0].id;

      // Crear electrodoméstico
      const app: ApplianceItem = {
        id: 'test_app_micro',
        name: 'Microondas',
        type: 'microwave',
        width: 500,
        height: 350,
        depth: 400,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        mountType: 'countertop',
        price: 800000,
        includeInBudget: true,
        finish: 'stainless_steel'
      };
      projectService.addAppliance(app);
      const appId = app.id;
      const initialAppFinish = app.finish;

      const initialDeskMat = projectService.partsList().find(p => p.id === 'desk_bottom')?.materialId;

      // Multi-seleccionar pieza melamina, mesón y equipo
      component.selectedPartIds.set(['desk_bottom', ctId]);
      component.selectedApplianceIds.set([appId]);

      // Cambiar material de mesón en bloque: Granito Negro San Gabriel
      const graniteMat = component.countertopMaterials().find(m => m.id === 'mat_stone_granite_black_30') || component.countertopMaterials()[0];
      component.applyBulkCountertopMaterial(graniteMat.id);

      // Verificar que el mesón cambió
      const updatedCt = projectService.partsList().find(p => p.id === ctId);
      expect(updatedCt?.materialId).toBe(graniteMat.id);

      // Verificar que la melamina NO cambió
      const updatedDesk = projectService.partsList().find(p => p.id === 'desk_bottom');
      expect(updatedDesk?.materialId).toBe(initialDeskMat);

      // Verificar que el equipo NO cambió
      const updatedApp = projectService.appliancesList().find(a => a.id === appId);
      expect(updatedApp?.finish).toBe(initialAppFinish);
    });

    it('applyBulkApplianceFinish debe cambiar únicamente electrodomésticos sin tocar melaminas ni mesones', () => {
      // Crear mesón
      const ctParts = projectService.generateSmartCountertop({
        shape: 'straight',
        materialId: 'mat_stone_carrara_30',
        thickness: 30,
        includeBacksplash: false,
        backsplashHeight: 0,
        length: 1200,
        sideLength: 0,
        depth: 600
      });
      const ctId = ctParts[0].id;

      // Crear electrodoméstico
      const app: ApplianceItem = {
        id: 'test_app_fridge',
        name: 'Nevera',
        type: 'refrigerator',
        width: 900,
        height: 1800,
        depth: 700,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        mountType: 'floor',
        price: 3500000,
        includeInBudget: true,
        finish: 'stainless_steel'
      };
      projectService.addAppliance(app);
      const appId = app.id;

      const initialDeskMat = projectService.partsList().find(p => p.id === 'desk_bottom')?.materialId;

      // Multi-seleccionar
      component.selectedPartIds.set(['desk_bottom', ctId]);
      component.selectedApplianceIds.set([appId]);

      // Cambiar acabado de equipos en bloque a black_matte
      component.applyBulkApplianceFinish('black_matte');

      // Verificar que el electrodoméstico cambió
      const updatedApp = projectService.appliancesList().find(a => a.id === appId);
      expect(updatedApp?.finish).toBe('black_matte');

      // Verificar que la melamina y el mesón se mantuvieron intactos
      const updatedDesk = projectService.partsList().find(p => p.id === 'desk_bottom');
      expect(updatedDesk?.materialId).toBe(initialDeskMat);

      const updatedCt = projectService.partsList().find(p => p.id === ctId);
      expect(updatedCt?.materialId).toBe('mat_stone_carrara_30');
    });

    it('applyBulkMelamineMaterial debe rechazar materiales de mesón y no alterar las piezas seleccionadas', () => {
      const initialDesk = projectService.partsList().find(p => p.id === 'desk_bottom');
      const initialMatId = initialDesk?.materialId;

      component.selectedPartIds.set(['desk_bottom']);
      // Intentar aplicar material de mesón a través de applyBulkMelamineMaterial
      component.applyBulkMelamineMaterial('mat_stone_carrara_30');

      const afterDesk = projectService.partsList().find(p => p.id === 'desk_bottom');
      expect(afterDesk?.materialId).toBe(initialMatId);
    });

    it('applyBulkCountertopMaterial debe rechazar materiales de melamina y no alterar los mesones seleccionados', () => {
      const ctParts = projectService.generateSmartCountertop({
        shape: 'straight',
        materialId: 'mat_stone_carrara_30',
        thickness: 30,
        includeBacksplash: false,
        backsplashHeight: 0,
        length: 1200,
        sideLength: 0,
        depth: 600
      });
      const ctId = ctParts[0].id;

      component.selectedPartIds.set([ctId]);
      // Intentar aplicar melamina a través de applyBulkCountertopMaterial
      component.applyBulkCountertopMaterial('mat_roble_18');

      const afterCt = projectService.partsList().find(p => p.id === ctId);
      expect(afterCt?.materialId).toBe('mat_stone_carrara_30');
    });

    it('changeMultiplePartsMaterial debe sincronizar colorHex y grain en las piezas modificadas', () => {
      const parts = projectService.partsList();
      const deskPart = parts.find(p => p.id === 'desk_bottom');
      expect(deskPart).toBeTruthy();

      const matWengue = component.melamineBoardMaterials().find(m => m.id.includes('wengue')) || component.melamineBoardMaterials()[2];
      projectService.changeMultiplePartsMaterial(['desk_bottom'], matWengue.id);

      const updated = projectService.partsList().find(p => p.id === 'desk_bottom');
      expect(updated?.materialId).toBe(matWengue.id);
      expect(updated?.colorHex).toBe(matWengue.colorHex);
      if (matWengue.hasGrain) {
        expect(updated?.grain).not.toBe('none');
      }
    });

    it('changeGroupMaterial debe proteger mesones de melamina y puertas/cascos de piedra', () => {
      // Módulo con estructura y mesón en el mismo grupo
      const groupId = 'test_combo_group';
      const cabinetPart: Part = {
        id: 'cb_door_1',
        name: 'Puerta Gabinete',
        length: 700,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_roble_18',
        materialName: 'Melamina Roble',
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        groupId,
        componentRole: 'door'
      };
      const ctPart: Part = {
        id: 'cb_meson_1',
        name: 'Mesón Cubierta',
        length: 800,
        width: 600,
        thickness: 30,
        quantity: 1,
        materialId: 'mat_stone_carrara_30',
        materialName: 'Mármol Carrara',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        groupId,
        componentRole: 'countertop'
      };

      projectService.updateProject(p => ({
        ...p,
        groups: [...(p.groups || []), { id: groupId, name: 'Módulo con Mesón', type: 'assembly' }],
        parts: [...p.parts, cabinetPart, ctPart]
      }));

      // 1. Cambiar material del grupo a Melamina Blanco
      projectService.changeGroupMaterial(groupId, 'mat_blanco_18', 'all');
      let currentParts = projectService.partsList();
      let updatedDoor = currentParts.find(p => p.id === 'cb_door_1');
      let updatedCt = currentParts.find(p => p.id === 'cb_meson_1');

      // Puerta debió cambiar a blanco
      expect(updatedDoor?.materialId).toBe('mat_blanco_18');
      // Mesón NO debió cambiar a melamina blanco (conserva mármol carrara)
      expect(updatedCt?.materialId).toBe('mat_stone_carrara_30');

      // 2. Intentar cambiar material del grupo a Granito Negro (piedra)
      projectService.changeGroupMaterial(groupId, 'mat_stone_granite_black_30', 'all');
      currentParts = projectService.partsList();
      updatedDoor = currentParts.find(p => p.id === 'cb_door_1');
      updatedCt = currentParts.find(p => p.id === 'cb_meson_1');

      // Puerta NO debió cambiar a granito (conserva blanco)
      expect(updatedDoor?.materialId).toBe('mat_blanco_18');
      // Mesón SI debió actualizarse a granito negro
      expect(updatedCt?.materialId).toBe('mat_stone_granite_black_30');
    });
  });
});
