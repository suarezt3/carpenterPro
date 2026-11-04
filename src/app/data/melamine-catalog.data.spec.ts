import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { MELAMINE_MATERIALS_CATALOG, MELAMINE_FAMILIES } from './melamine-catalog.data';
import {
  FLOOR_FINISHES_CATALOG,
  WALL_FINISHES_CATALOG,
  APPLIANCES_CATALOG_PRESETS,
  EnvironmentLine
} from '../models/melamine.models';
import { Appliance3dBuilderService } from '../services/appliance-3d-builder.service';

describe('Fase 4: Catálogo Maestro de Melaminas, Acabados Arquitectónicos y Equipos 3D', () => {
  let applianceBuilder: Appliance3dBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Appliance3dBuilderService]
    });
    applianceBuilder = TestBed.inject(Appliance3dBuilderService);
  });

  describe('1. Catálogo Maestro de Melaminas (MELAMINE_MATERIALS_CATALOG)', () => {
    it('debe contener más de 35 referencias categorizadas (actualmente 48+)', () => {
      expect(MELAMINE_MATERIALS_CATALOG.length).toBeGreaterThanOrEqual(35);
    });

    it('debe cubrir las 8 familias de melamina requeridas', () => {
      const familyIds = new Set(MELAMINE_MATERIALS_CATALOG.map(m => m.family));
      expect(familyIds.has('wood_light')).toBe(true);
      expect(familyIds.has('wood_medium')).toBe(true);
      expect(familyIds.has('wood_dark')).toBe(true);
      expect(familyIds.has('solid_matte')).toBe(true);
      expect(familyIds.has('high_gloss')).toBe(true);
      expect(familyIds.has('textile_linen')).toBe(true);
      expect(familyIds.has('stone_countertop')).toBe(true);
      expect(familyIds.has('mdf_back')).toBe(true);
    });

    it('debe contener todas las maderas claras requeridas por la especificación', () => {
      const names = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'wood_light').map(m => m.name.toLowerCase());
      expect(names.some(n => n.includes('roble kendal'))).toBe(true);
      expect(names.some(n => n.includes('miel'))).toBe(true);
      expect(names.some(n => n.includes('nórdico') || n.includes('nordico'))).toBe(true);
      expect(names.some(n => n.includes('haya natural'))).toBe(true);
      expect(names.some(n => n.includes('fresno blanco'))).toBe(true);
      expect(names.some(n => n.includes('roble santana'))).toBe(true);
    });

    it('debe contener todas las maderas medias requeridas por la especificación', () => {
      const names = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'wood_medium').map(m => m.name.toLowerCase());
      expect(names.some(n => n.includes('caramelo'))).toBe(true);
      expect(names.some(n => n.includes('roble rústico') || n.includes('rustico'))).toBe(true);
      expect(names.some(n => n.includes('teca ártico') || n.includes('artico'))).toBe(true);
      expect(names.some(n => n.includes('nogal amazónico') || n.includes('amazonico'))).toBe(true);
      expect(names.some(n => n.includes('cedro'))).toBe(true);
      expect(names.some(n => n.includes('parota'))).toBe(true);
    });

    it('debe contener todas las maderas oscuras requeridas por la especificación', () => {
      const names = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'wood_dark').map(m => m.name.toLowerCase());
      expect(names.some(n => n.includes('wengué') || n.includes('wengue'))).toBe(true);
      expect(names.some(n => n.includes('nogal terracota'))).toBe(true);
      expect(names.some(n => n.includes('tabaco'))).toBe(true);
      expect(names.some(n => n.includes('ébano') || n.includes('ebano'))).toBe(true);
      expect(names.some(n => n.includes('roble moro'))).toBe(true);
      expect(names.some(n => n.includes('cenizo'))).toBe(true);
    });

    it('debe contener los unicolores mate satinados requeridos', () => {
      const names = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'solid_matte').map(m => m.name.toLowerCase());
      expect(names.some(n => n.includes('blanco nieve'))).toBe(true);
      expect(names.some(n => n.includes('blanco cálido') || n.includes('calido'))).toBe(true);
      expect(names.some(n => n.includes('arena'))).toBe(true);
      expect(names.some(n => n.includes('gris humo'))).toBe(true);
      expect(names.some(n => n.includes('taupe'))).toBe(true);
      expect(names.some(n => n.includes('grafito'))).toBe(true);
      expect(names.some(n => n.includes('negro mate'))).toBe(true);
      expect(names.some(n => n.includes('verde salvia'))).toBe(true);
      expect(names.some(n => n.includes('azul naval'))).toBe(true);
      expect(names.some(n => n.includes('terracota'))).toBe(true);
    });

    it('debe contener variantes de alto brillo (high_gloss)', () => {
      const hg = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'high_gloss');
      expect(hg.length).toBeGreaterThanOrEqual(4);
      expect(hg.some(m => m.name.toLowerCase().includes('blanco'))).toBe(true);
      expect(hg.some(m => m.name.toLowerCase().includes('negro'))).toBe(true);
    });

    it('debe contener textiles y linos para interiores de closet', () => {
      const names = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'textile_linen').map(m => m.name.toLowerCase());
      expect(names.some(n => n.includes('lino cancún') || n.includes('cancun'))).toBe(true);
      expect(names.some(n => n.includes('lino oscuro'))).toBe(true);
      expect(names.some(n => n.includes('textil cuerda'))).toBe(true);
      expect(names.some(n => n.includes('cuero visón') || n.includes('vison'))).toBe(true);
    });

    it('debe contener piedras, mármoles y cuarzos para mesones', () => {
      const names = MELAMINE_MATERIALS_CATALOG.filter(m => m.family === 'stone_countertop').map(m => m.name.toLowerCase());
      expect(names.some(n => n.includes('blanco estelar'))).toBe(true);
      expect(names.some(n => n.includes('calacatta oro'))).toBe(true);
      expect(names.some(n => n.includes('carrara'))).toBe(true);
      expect(names.some(n => n.includes('san gabriel'))).toBe(true);
      expect(names.some(n => n.includes('pietra'))).toBe(true);
      expect(names.some(n => n.includes('terrazzo'))).toBe(true);
    });

    it('debe tener precios comerciales realistas en COP y especificaciones por espesor (15mm y 18mm)', () => {
      const boards = MELAMINE_MATERIALS_CATALOG.filter(m => m.category === 'board');
      for (const b of boards) {
        expect(b.sheetCost).toBeGreaterThan(100000);
        expect(b.sheetCost).toBeLessThan(1000000);
        expect(b.thicknessSpecs).toBeTruthy();
        expect(b.thicknessSpecs?.['15']).toBeTruthy();
        expect(b.thicknessSpecs?.['18']).toBeTruthy();
        expect(b.thicknessSpecs?.['15'].sheetCost).toBeLessThanOrEqual(b.thicknessSpecs?.['18'].sheetCost ?? Infinity);
      }
    });

    it('debe definir hasGrain = true únicamente para maderas y linos tramados', () => {
      const roble = MELAMINE_MATERIALS_CATALOG.find(m => m.id === 'mat_roble_18');
      const blanco = MELAMINE_MATERIALS_CATALOG.find(m => m.id === 'mat_blanco_18');
      const lino = MELAMINE_MATERIALS_CATALOG.find(m => m.id === 'mat_lino_cancun_18');

      expect(roble?.hasGrain).toBe(true);
      expect(blanco?.hasGrain).toBe(false);
      expect(lino?.hasGrain).toBe(true);
    });
  });

  describe('2. Acabados Arquitectónicos de Pisos y Muros (0 emojis)', () => {
    it('FLOOR_FINISHES_CATALOG debe incluir porcelanatos rectificados, pisos SPC y microcemento', () => {
      const floorIds = FLOOR_FINISHES_CATALOG.map(f => f.id);
      expect(floorIds).toContain('porcelain_rectified_white');
      expect(floorIds).toContain('porcelain_rectified_gray');
      expect(floorIds).toContain('spc_herringbone_honey');
      expect(floorIds).toContain('spc_herringbone_nordic');
      expect(floorIds).toContain('spc_plank_oak');
      expect(floorIds).toContain('microcement_light');
      expect(floorIds).toContain('terrazzo_veneciano');

      // Erradicación de emojis
      for (const f of FLOOR_FINISHES_CATALOG) {
        const text = `${f.name} ${f.tag} ${f.description}`;
        expect(text).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
      }
    });

    it('WALL_FINISHES_CATALOG debe incluir Subway navy, hidráulicos y listones WPC', () => {
      const wallIds = WALL_FINISHES_CATALOG.map(w => w.id);
      expect(wallIds).toContain('subway_tile_navy');
      expect(wallIds).toContain('hydraulic_tile_patchwork');
      expect(wallIds).toContain('hydraulic_tile_geo');
      expect(wallIds).toContain('wpc_slats_walnut');
      expect(wallIds).toContain('wpc_slats_black');
      expect(wallIds).toContain('microcement_wall');
      expect(wallIds).toContain('paint_sage_green');

      // Erradicación de emojis
      for (const w of WALL_FINISHES_CATALOG) {
        const text = `${w.name} ${w.tag} ${w.description}`;
        expect(text).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
      }
    });
  });

  describe('3. Filtrado Contextual de Equipos 3D por Ambiente', () => {
    it('todos los presets de APPLIANCES_CATALOG_PRESETS deben tener environmentLines definido', () => {
      for (const preset of APPLIANCES_CATALOG_PRESETS) {
        expect(preset.environmentLines).toBeDefined();
        expect(preset.environmentLines?.length).toBeGreaterThan(0);
      }
    });

    it('el filtrado por ambiente "bathroom" no debe filtrar neveras, hornos ni camas', () => {
      const bathroomAppliances = APPLIANCES_CATALOG_PRESETS.filter(a =>
        a.environmentLines?.includes('bathroom')
      );

      const types = new Set(bathroomAppliances.map(a => a.type));
      expect(types.has('refrigerator')).toBe(false);
      expect(types.has('oven')).toBe(false);
      expect(types.has('cooktop')).toBe(false);
      expect(types.has('bed')).toBe(false);

      // Debe incluir lavamanos, inodoro y espejo
      expect(types.has('washbasin_vessel')).toBe(true);
      expect(types.has('washbasin_undermount')).toBe(true);
      expect(types.has('bathroom_mirror_led')).toBe(true);
      expect(types.has('toilet')).toBe(true);
    });

    it('el filtrado por ambiente "closet" debe incluir tubos colgadores, camas y espejos, pero no estufas ni inodoros', () => {
      const closetAppliances = APPLIANCES_CATALOG_PRESETS.filter(a =>
        a.environmentLines?.includes('closet')
      );

      const types = new Set(closetAppliances.map(a => a.type));
      expect(types.has('closet_rod')).toBe(true);
      expect(types.has('bed')).toBe(true);
      expect(types.has('tv')).toBe(true);

      expect(types.has('cooktop')).toBe(false);
      expect(types.has('toilet')).toBe(false);
      expect(types.has('washbasin_vessel')).toBe(false);
    });

    it('el filtrado por ambiente "living_office" debe incluir Smart TVs, estaciones de trabajo y sillas, pero no sanitarios', () => {
      const officeAppliances = APPLIANCES_CATALOG_PRESETS.filter(a =>
        a.environmentLines?.includes('living_office')
      );

      const types = new Set(officeAppliances.map(a => a.type));
      expect(types.has('tv')).toBe(true);
      expect(types.has('desktop_workspace')).toBe(true);
      expect(types.has('office_chair')).toBe(true);

      expect(types.has('toilet')).toBe(false);
      expect(types.has('washbasin_vessel')).toBe(false);
      expect(types.has('bed')).toBe(false);
    });
  });

  describe('4. Pooling y Caching en Appliance3dBuilderService', () => {
    it('debe compartir la geometría y material de HitBox entre instancias de iguales dimensiones', () => {
      const app1 = {
        id: 'app_test_1',
        name: 'Item 1',
        type: 'refrigerator' as const,
        width: 900,
        depth: 700,
        height: 1800,
        finish: 'stainless_steel' as const,
        mountType: 'floor' as const,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        includeInBudget: true,
        price: 1000000
      };

      const app2 = {
        ...app1,
        id: 'app_test_2'
      };

      const group1 = applianceBuilder.buildApplianceGroup(app1);
      const group2 = applianceBuilder.buildApplianceGroup(app2);

      const hit1 = group1.children.find(c => c.userData?.['isApplianceHitBox']) as THREE.Mesh;
      const hit2 = group2.children.find(c => c.userData?.['isApplianceHitBox']) as THREE.Mesh;

      expect(hit1).toBeTruthy();
      expect(hit2).toBeTruthy();
      expect(hit1.geometry).toBe(hit2.geometry);
      expect(hit1.material).toBe(hit2.material);
    });

    it('desktop_workspace debe aislar el material de soporte entre acabados black_matte y stainless_steel', () => {
      const wsDark = {
        id: 'ws_dark',
        name: 'WS Dark',
        type: 'desktop_workspace' as const,
        width: 850,
        depth: 450,
        height: 420,
        finish: 'black_matte' as const,
        mountType: 'countertop' as const,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        includeInBudget: true,
        price: 3000000
      };

      const wsLight = {
        id: 'ws_light',
        name: 'WS Light',
        type: 'desktop_workspace' as const,
        width: 850,
        depth: 450,
        height: 420,
        finish: 'stainless_steel' as const,
        mountType: 'countertop' as const,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        includeInBudget: true,
        price: 3000000
      };

      const gDark = applianceBuilder.buildApplianceGroup(wsDark);
      const gLight = applianceBuilder.buildApplianceGroup(wsLight);

      // Encontrar la base del soporte
      const baseDark = gDark.children[0] as THREE.Mesh;
      const baseLight = gLight.children[0] as THREE.Mesh;

      expect(baseDark.material).not.toBe(baseLight.material);
    });
  });
});
