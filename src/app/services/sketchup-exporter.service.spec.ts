import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SketchupExporterService } from './sketchup-exporter.service';
import { PartGeometryService } from './part-geometry.service';
import { MelamineProject } from '../models/melamine.models';

describe('SketchupExporterService (Exportación COLLADA 1.4.1 .DAE 3D para SketchUp)', () => {
  let service: SketchupExporterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SketchupExporterService, PartGeometryService]
    });
    service = TestBed.inject(SketchupExporterService);
  });

  const baseProject: MelamineProject = {
    id: 'proj_skp_test',
    name: 'Cocina Integral Moderna',
    clientName: 'Juan Perez',
    date: '2026-11-06',
    notes: 'Proyecto de prueba para exportar a SketchUp',
    modules: [],
    groups: [
      {
        id: 'group_bajo_1',
        name: 'Modulo Bajo Cocina',
        type: 'assembly'
      },
      {
        id: 'group_torre_1',
        name: 'Torre Hornos',
        type: 'assembly'
      }
    ],
    materials: [
      {
        id: 'mat_roble_18',
        name: 'Melamina Roble Kendal 18mm',
        thickness: 18,
        colorHex: '#b48a60',
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 210000,
        hasGrain: true
      },
      {
        id: 'mat_cuarzo_blanco',
        name: 'Cuarzo Blanco Estelar',
        thickness: 20,
        colorHex: '#f0ede6',
        sheetLength: 3000,
        sheetWidth: 1400,
        sheetCost: 950000,
        hasGrain: false
      }
    ],
    parts: [
      {
        id: 'part_lateral_izq',
        name: 'Lateral Izquierdo',
        groupId: 'group_bajo_1',
        groupName: 'Modulo Bajo Cocina',
        length: 720,
        width: 580,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_roble_18',
        materialName: 'Melamina Roble Kendal 18mm',
        colorHex: '#b48a60',
        grain: 'length',
        edges: { l1: 'thick', l2: 'none', a1: 'thin', a2: 'none' },
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        posX: 100,
        posY: 360,
        posZ: -300
      },
      {
        id: 'part_puerta',
        name: 'Puerta',
        groupId: 'group_bajo_1',
        groupName: 'Modulo Bajo Cocina',
        length: 600,
        width: 714,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_roble_18',
        materialName: 'Melamina Roble Kendal 18mm',
        colorHex: '#b48a60',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'door',
        orientation: 'vertical_xy',
        posX: 300,
        posY: 360,
        posZ: 0
      },
      {
        id: 'part_repisa',
        name: 'Repisa',
        groupId: 'group_bajo_1',
        groupName: 'Modulo Bajo Cocina',
        length: 564,
        width: 550,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_roble_18',
        materialName: 'Melamina Roble Kendal 18mm',
        colorHex: '#b48a60',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'shelf',
        orientation: 'horizontal',
        posX: 300,
        posY: 350,
        posZ: -300
      },
      {
        id: 'part_meson',
        name: 'Meson Cocina',
        groupId: 'group_torre_1',
        groupName: 'Torre Hornos',
        length: 1200,
        width: 620,
        thickness: 20,
        quantity: 1,
        materialId: 'mat_cuarzo_blanco',
        materialName: 'Cuarzo Blanco Estelar',
        colorHex: '#f0ede6',
        grain: 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'countertop',
        orientation: 'horizontal',
        posX: 600,
        posY: 870,
        posZ: -310
      },
      {
        id: 'part_tablero_libre',
        name: 'Panel Decorativo Libre',
        // !part.groupId -> Tablero libre
        length: 1000,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_roble_18',
        materialName: 'Melamina Roble Kendal 18mm',
        colorHex: '#b48a60',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'free',
        orientation: 'vertical_xy',
        posX: 1200,
        posY: 500,
        posZ: 0
      }
    ],
    hardware: [],
    appliances: [],
    laborCost: 150000,
    laborType: 'fixed',
    profitMarginPercent: 30,
    taxPercent: 19,
    updatedAt: '2026-11-06T12:00:00.000Z',
    settings: {
      sawKerf: 4,
      trimMargin: 10,
      defaultBoardThickness: 18,
      thinEdgeThickness: 0.45,
      thickEdgeThickness: 2.0,
      thinEdgeCostPerMeter: 1800,
      thickEdgeCostPerMeter: 4200,
      currency: 'COP',
      optimizationPreference: 'best_fit'
    }
  };

  it('debe crearse correctamente como servicio inyectable singleton', () => {
    expect(service).toBeTruthy();
  });

  describe('1. Encabezado COLLADA 1.4.1 y Escala Milimétrica Z_UP', () => {
    it('debe generar XML COLLADA 1.4.1 con espacio de nombres oficial', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(dae).toContain('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">');
      expect(dae).toContain('</COLLADA>');
    });

    it('debe incluir escala milimétrica exacta 1:1 (<unit name="millimeter" meter="0.001" />)', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toMatch(/<unit\s+name="millimeter"\s+meter="0\.001"\s*\/>/);
    });

    it('debe incluir up_axis Z_UP nativo de SketchUp', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toContain('<up_axis>Z_UP</up_axis>');
    });

    it('debe ser un XML bien formado que parsea sin errores con DOMParser', () => {
      const dae = service.generateColladaDaeString(baseProject);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(dae, 'application/xml');

      const parseErrors = xmlDoc.getElementsByTagName('parsererror');
      expect(parseErrors.length).toBe(0);
      expect(xmlDoc.documentElement.nodeName).toBe('COLLADA');
    });
  });

  describe('2. Materiales, Colores RGB y Efectos (<library_effects> y <library_materials>)', () => {
    it('debe exportar los materiales del proyecto con sus nombres limpios', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toContain('<library_effects>');
      expect(dae).toContain('<library_materials>');
      expect(dae).toContain('Melamina_Roble_Kendal_18mm');
      expect(dae).toContain('Cuarzo_Blanco_Estelar');
    });

    it('debe colocar <ambient> antes de <diffuse> dentro de <phong> cumpliendo estrictamente COLLADA 1.4.1 XSD', () => {
      const dae = service.generateColladaDaeString(baseProject);
      const ambientIndex = dae.indexOf('<ambient>');
      const diffuseIndex = dae.indexOf('<diffuse>');
      expect(ambientIndex).toBeGreaterThan(-1);
      expect(diffuseIndex).toBeGreaterThan(-1);
      expect(ambientIndex).toBeLessThan(diffuseIndex);
    });

    it('debe convertir colorHex (#b48a60) a valores RGB difusos exactos en <phong>', () => {
      const dae = service.generateColladaDaeString(baseProject);

      // #b48a60 -> R: 180/255 = 0.706, G: 138/255 = 0.541, B: 96/255 = 0.376
      const expectedRgb = service.hexToRgb('#b48a60');
      expect(expectedRgb.r).toBeCloseTo(0.706, 2);
      expect(expectedRgb.g).toBeCloseTo(0.541, 2);
      expect(expectedRgb.b).toBeCloseTo(0.376, 2);

      // Verificar que el color difuso aparezca en el XML
      expect(dae).toContain(`${expectedRgb.r.toFixed(4)} ${expectedRgb.g.toFixed(4)} ${expectedRgb.b.toFixed(4)} 1.0`);
    });

    it('debe vincular cada material con su respectivo efecto mediante instance_effect', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toMatch(/<material id="mat_mat_roble_18"[^>]*>/);
      expect(dae).toContain('<instance_effect url="#effect_mat_mat_roble_18"');
      expect(dae).toMatch(/<material id="mat_mat_cuarzo_blanco"[^>]*>/);
      expect(dae).toContain('<instance_effect url="#effect_mat_mat_cuarzo_blanco"');
    });

    it('debe resolver colores de materiales desde MELAMINE_MATERIALS_CATALOG si no están en project.materials', () => {
      const projWithoutMaterials: MelamineProject = {
        ...baseProject,
        materials: [],
        parts: [
          {
            id: 'p1',
            name: 'Lateral',
            materialName: 'Roble Kendal 18mm',
            length: 700,
            width: 500,
            thickness: 18,
            quantity: 1,
            materialId: 'mat_roble_18', // Existe en catálogo
            grain: 'length',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
          }
        ]
      };

      const dae = service.generateColladaDaeString(projWithoutMaterials);
      expect(dae).toContain('Roble');
      expect(dae).toContain('<color>');
    });
  });

  describe('3. Geometría 3D, Mallas Triangulares y Conversión de Ejes', () => {
    it('debe incluir todas las piezas en <library_geometries> con sus posiciones y normales', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toContain('<library_geometries>');
      expect(dae).toContain('id="geom_part_lateral_izq"');
      expect(dae).toContain('id="geom_part_puerta"');
      expect(dae).toContain('id="geom_part_repisa"');
      expect(dae).toContain('id="geom_part_meson"');
      expect(dae).toContain('id="geom_part_tablero_libre"');

      expect(dae).toContain('<triangles');
      expect(dae).toContain('<source id="geom_part_lateral_izq-positions">');
      expect(dae).toContain('<source id="geom_part_lateral_izq-normals">');
      expect(dae).toContain('<vertices id="geom_part_lateral_izq-vertices">');
    });

    it('debe transformar correctamente las coordenadas Three.js (Y-Up) a SketchUp (Z-Up): X_skp = X, Y_skp = -Z, Z_skp = Y', () => {
      // Pieza simple horizontal centrada en X=100, Y=300 (elevación en Three.js), Z=-400 (hacia el fondo en Three.js)
      const testProj: MelamineProject = {
        ...baseProject,
        groups: [],
        parts: [
          {
            id: 'p_coord_test',
            name: 'Base Prueba',
            materialName: 'Melamina Roble',
            length: 100,
            width: 100,
            thickness: 20,
            quantity: 1,
            materialId: 'mat_roble_18',
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            orientation: 'horizontal',
            posX: 100,
            posY: 300,
            posZ: -400
          }
        ]
      };

      const dae = service.generateColladaDaeString(testProj);
      const parser = new DOMParser();
      const doc = parser.parseFromString(dae, 'application/xml');

      const posArrayElem = doc.getElementById('geom_p_coord_test-positions-array');
      expect(posArrayElem).toBeTruthy();
      const floats = (posArrayElem?.textContent || '').trim().split(/\s+/).map(Number);
      expect(floats.length).toBeGreaterThan(0);

      // Calcular centro promedio de los vértices exportados
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      const count = floats.length / 3;
      for (let i = 0; i < floats.length; i += 3) {
        sumX += floats[i];
        sumY += floats[i + 1];
        sumZ += floats[i + 2];
      }
      const avgX = sumX / count;
      const avgY = sumY / count;
      const avgZ = sumZ / count;

      // X_skp debe ser X = 100
      expect(avgX).toBeCloseTo(100, 0);
      // Y_skp debe ser -Z = -(-400) = +400
      expect(avgY).toBeCloseTo(400, 0);
      // Z_skp debe ser Y = 300
      expect(avgZ).toBeCloseTo(300, 0);
    });

    it('debe exportar mesas/tapas circulares con espesor exacto en Z_skp y diámetro correcto en XY', () => {
      const circProj: MelamineProject = {
        ...baseProject,
        groups: [],
        parts: [
          {
            id: 'part_mesa_redonda',
            name: 'Tapa Redonda',
            materialName: 'Melamina Roble',
            shapeType: 'circle',
            diameter: 800,
            radius: 400,
            length: 800,
            width: 800,
            thickness: 25,
            quantity: 1,
            materialId: 'mat_roble_18',
            grain: 'none',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            orientation: 'horizontal',
            posX: 0,
            posY: 750,
            posZ: 0
          }
        ]
      };

      const dae = service.generateColladaDaeString(circProj);
      expect(dae).toContain('id="geom_part_mesa_redonda"');

      const parser = new DOMParser();
      const doc = parser.parseFromString(dae, 'application/xml');
      const triElem = doc.querySelector('geometry[id="geom_part_mesa_redonda"] triangles');
      expect(triElem).toBeTruthy();
      const count = Number(triElem?.getAttribute('count'));
      expect(count).toBeGreaterThan(30);

      // Comprobar que el espesor en SketchUp (eje Z_skp) sea exactamente 25mm y no 800mm
      const posArrayElem = doc.getElementById('geom_part_mesa_redonda-positions-array');
      const floats = (posArrayElem?.textContent || '').trim().split(/\s+/).map(Number);
      let minZ = Infinity, maxZ = -Infinity;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < floats.length; i += 3) {
        minX = Math.min(minX, floats[i]);
        maxX = Math.max(maxX, floats[i]);
        minY = Math.min(minY, floats[i + 1]);
        maxY = Math.max(maxY, floats[i + 1]);
        minZ = Math.min(minZ, floats[i + 2]);
        maxZ = Math.max(maxZ, floats[i + 2]);
      }
      expect(maxZ - minZ).toBeCloseTo(25, 0); // Espesor exacto de 25mm
      expect(maxX - minX).toBeCloseTo(800, 0); // Diámetro de 800mm en X
      expect(maxY - minY).toBeCloseTo(800, 0); // Diámetro de 800mm en Y
    });

    it('debe exportar tubos colgadores circulares con orientación y dimensiones de barra', () => {
      const rodProj: MelamineProject = {
        ...baseProject,
        groups: [],
        parts: [
          {
            id: 'part_tubo_colgador',
            name: 'Tubo Colgador Armario',
            shapeType: 'circle',
            length: 800,
            width: 25,
            thickness: 25, // Diámetro del tubo = 25mm
            quantity: 1,
            materialId: 'mat_roble_18',
            materialName: 'Melamina Roble Kendal 18mm',
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: 400,
            posY: 1800,
            posZ: -300
          }
        ]
      };

      const dae = service.generateColladaDaeString(rodProj);
      const parser = new DOMParser();
      const doc = parser.parseFromString(dae, 'application/xml');
      const posArrayElem = doc.getElementById('geom_part_tubo_colgador-positions-array');
      expect(posArrayElem).toBeTruthy();
      const floats = (posArrayElem?.textContent || '').trim().split(/\s+/).map(Number);
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < floats.length; i += 3) {
        minX = Math.min(minX, floats[i]);
        maxX = Math.max(maxX, floats[i]);
        minZ = Math.min(minZ, floats[i + 2]);
        maxZ = Math.max(maxZ, floats[i + 2]);
      }
      // La longitud de 800mm debe extenderse a lo largo del eje X
      expect(maxX - minX).toBeCloseTo(800, 0);
      // El diámetro de 25mm debe reflejarse en Z
      expect(maxZ - minZ).toBeCloseTo(25, 0);
    });

    it('debe exportar piezas con cortes especiales reales (chaflán, destaje en L, resaque de sifón)', () => {
      const cutsProj: MelamineProject = {
        ...baseProject,
        groups: [],
        parts: [
          {
            id: 'part_destaje_l',
            name: 'Balda con Destaje',
            materialName: 'Melamina Roble',
            length: 800,
            width: 600,
            thickness: 18,
            quantity: 1,
            materialId: 'mat_roble_18',
            grain: 'length',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            orientation: 'horizontal',
            cornerCutConfig: {
              type: 'notch_l',
              corner: 'back_right',
              cutX: 120,
              cutY: 80
            },
            posX: 0,
            posY: 400,
            posZ: 0
          },
          {
            id: 'part_sifon_u',
            name: 'Fondo de Cajón con Sifón',
            materialName: 'Melamina Roble',
            length: 600,
            width: 500,
            thickness: 15,
            quantity: 1,
            materialId: 'mat_roble_18',
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            orientation: 'horizontal',
            cornerCutConfig: {
              type: 'u_siphon_cutout',
              corner: 'back_right',
              cutX: 150,
              cutY: 200
            },
            posX: 0,
            posY: 200,
            posZ: 0
          }
        ]
      };

      const dae = service.generateColladaDaeString(cutsProj);
      expect(dae).toContain('id="geom_part_destaje_l"');
      expect(dae).toContain('id="geom_part_sifon_u"');

      const parser = new DOMParser();
      const doc = parser.parseFromString(dae, 'application/xml');
      const triL = doc.querySelector('geometry[id="geom_part_destaje_l"] triangles');
      const triU = doc.querySelector('geometry[id="geom_part_sifon_u"] triangles');
      expect(Number(triL?.getAttribute('count'))).toBeGreaterThan(10);
      expect(Number(triU?.getAttribute('count'))).toBeGreaterThan(10);
    });
  });

  describe('4. Jerarquía de Grupos y Componentes (<visual_scene>)', () => {
    it('debe estructurar los nodos visuales respetando los módulos (project.groups) y piezas hijas', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toContain('<visual_scene id="Scene" name="Scene">');
      // Grupo de Modulo Bajo Cocina
      expect(dae).toMatch(/<node id="group_group_bajo_1" name="Modulo_Bajo_Cocina" type="NODE">/);
      // Grupo de Torre Hornos
      expect(dae).toMatch(/<node id="group_group_torre_1" name="Torre_Hornos" type="NODE">/);
      // Nodos de piezas hijas dentro de sus respectivos grupos
      expect(dae).toContain('<node id="node_part_lateral_izq" name="Lateral_Izquierdo" type="NODE">');
      expect(dae).toContain('<node id="node_part_puerta" name="Puerta" type="NODE">');
      expect(dae).toContain('<node id="node_part_repisa" name="Repisa" type="NODE">');
      expect(dae).toContain('<node id="node_part_meson" name="Meson_Cocina" type="NODE">');
    });

    it('debe agrupar las piezas libres (!part.groupId) bajo el nodo Tableros_Libres', () => {
      const dae = service.generateColladaDaeString(baseProject);

      expect(dae).toMatch(/<node id="group_tableros_libres" name="Tableros_Libres" type="NODE">/);
      expect(dae).toContain('<node id="node_part_tablero_libre" name="Panel_Decorativo_Libre" type="NODE">');
    });

    it('no debe incluir el nodo Tableros_Libres si todas las piezas tienen groupId asignado', () => {
      const noFreePartsProj: MelamineProject = {
        ...baseProject,
        parts: baseProject.parts.filter(p => !!p.groupId)
      };

      const dae = service.generateColladaDaeString(noFreePartsProj);
      expect(dae).not.toContain('group_tableros_libres');
    });

    it('debe agrupar piezas basadas en project.modules y part.moduleId cuando project.groups esté vacío', () => {
      const moduleProj: MelamineProject = {
        ...baseProject,
        groups: [],
        modules: [
          {
            id: 'mod_cocina_1',
            name: 'Gabinete Superior',
            type: 'wall_cabinet',
            width: 800,
            height: 720,
            depth: 320,
            boardThickness: 18,
            backThickness: 3,
            backType: 'groove',
            shelvesCount: 1,
            doorsCount: 2,
            doorsType: 'overlay',
            drawersCount: 0,
            hasPlinth: false,
            plinthHeight: 0,
            materialId: 'mat_roble_18',
            defaultThinEdge: true,
            defaultThickDoors: true
          }
        ],
        parts: [
          {
            id: 'p_mod_1',
            name: 'Lateral Gabinete',
            moduleId: 'mod_cocina_1',
            moduleName: 'Gabinete Superior',
            length: 720,
            width: 320,
            thickness: 18,
            quantity: 1,
            materialId: 'mat_roble_18',
            materialName: 'Melamina Roble Kendal 18mm',
            grain: 'length',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            orientation: 'vertical_yz',
            posX: 0,
            posY: 1500,
            posZ: 0
          }
        ]
      };

      const dae = service.generateColladaDaeString(moduleProj);
      expect(dae).toContain('name="Gabinete_Superior"');
      expect(dae).not.toContain('Tableros_Libres');
    });

    it('no debe emitir nodos contenedores vacíos si un grupo no tiene piezas válidas', () => {
      const emptyGroupProj: MelamineProject = {
        ...baseProject,
        groups: [
          { id: 'grupo_vacio', name: 'Modulo Fantasma', type: 'assembly' }
        ],
        parts: []
      };

      const dae = service.generateColladaDaeString(emptyGroupProj);
      expect(dae).not.toContain('Modulo_Fantasma');
      expect(dae).not.toContain('group_tableros_libres');
    });

    it('debe resolver colisiones de IDs duplicados garantizando identificadores xs:ID únicos', () => {
      const dupProj: MelamineProject = {
        ...baseProject,
        parts: [
          {
            ...baseProject.parts[0],
            id: 'part_repetida'
          },
          {
            ...baseProject.parts[1],
            id: 'part_repetida'
          }
        ]
      };

      const dae = service.generateColladaDaeString(dupProj);
      const parser = new DOMParser();
      const doc = parser.parseFromString(dae, 'application/xml');
      expect(doc.getElementsByTagName('parsererror').length).toBe(0);

      // Ambas geometrías deben exportarse sin sobrescribirse
      expect(doc.querySelectorAll('geometry').length).toBe(2);

      // Los IDs de los nodos deben ser únicos
      const nodeIds = Array.from(doc.querySelectorAll('visual_scene node')).map(n => n.getAttribute('id'));
      const uniqueNodeIds = new Set(nodeIds);
      expect(uniqueNodeIds.size).toBe(nodeIds.length);
    });
  });

  describe('5. Descarga y Exportación Directa', () => {
    it('debe invocar exportProjectToSketchUp sin lanzar errores y generar el nombre de archivo limpio', () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
        if (tag === 'a') {
          vi.spyOn(el as HTMLElement, 'click').mockImplementation(clickSpy);
        }
        return el;
      });

      service.exportProjectToSketchUp(baseProject);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('debe soportar nombres de proyecto con tildes y caracteres especiales limpiándolos para el archivo .dae', () => {
      const projSpecialName: MelamineProject = {
        ...baseProject,
        name: 'Mueble de Baño & Cocina (Apto 502)'
      };

      let downloadedFileName = '';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
        if (tag === 'a') {
          vi.spyOn(el as HTMLElement, 'click').mockImplementation(() => {
            downloadedFileName = (el as HTMLAnchorElement).download;
          });
        }
        return el;
      });

      service.exportProjectToSketchUp(projSpecialName);
      expect(downloadedFileName).toBe('mueble_de_bano_cocina_apto_502-modelo-3d.dae');
    });

    it('debe manejar proyectos null o undefined sin arrojar excepciones', () => {
      expect(() => service.generateColladaDaeString(null as unknown as MelamineProject)).not.toThrow();
      expect(() => service.exportProjectToSketchUp(undefined as unknown as MelamineProject)).not.toThrow();
    });
  });

  describe('6. Sanitización y Casos Extremos (Edge Cases)', () => {
    it('debe manejar proyectos con 0 piezas sin errores generando estructura XML válida', () => {
      const emptyProj: MelamineProject = {
        ...baseProject,
        parts: [],
        groups: []
      };

      const dae = service.generateColladaDaeString(emptyProj);
      expect(dae).toContain('<COLLADA');
      expect(dae).toContain('<unit name="millimeter" meter="0.001" />');
      expect(dae).toContain('<up_axis>Z_UP</up_axis>');
      expect(dae).toContain('<visual_scene id="Scene" name="Scene">');

      const parser = new DOMParser();
      const doc = parser.parseFromString(dae, 'application/xml');
      expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    });

    it('debe sanitizar IDs con caracteres que no son válidos en XML xs:ID', () => {
      expect(service.sanitizeXmlId('123-abc-ñoño')).toBe('id_123_abc_nono');
      expect(service.sanitizeXmlId('abc_123')).toBe('abc_123');
      expect(service.sanitizeXmlId('')).toBe('id_item');
    });

    it('debe sanitizar nombres preservando legibilidad en Outliner de SketchUp', () => {
      expect(service.sanitizeName('Módulo Bajo / Cocina')).toBe('Modulo_Bajo_Cocina');
      expect(service.sanitizeName('Puerta - Izquierda')).toBe('Puerta_Izquierda');
      expect(service.sanitizeName('')).toBe('Objeto');
    });

    it('debe convertir colores hex en formato corto #RGB y números inválidos', () => {
      const shortRgb = service.hexToRgb('#fff');
      expect(shortRgb.r).toBe(1);
      expect(shortRgb.g).toBe(1);
      expect(shortRgb.b).toBe(1);

      const invalidRgb = service.hexToRgb('invalid-hex');
      expect(invalidRgb.r).toBeCloseTo(0.831, 2);
    });
  });
});
