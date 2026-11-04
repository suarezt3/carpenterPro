import { TestBed } from '@angular/core/testing';
import { PartGeometryService } from './part-geometry.service';
import { Part } from '../models/melamine.models';

function createMockPart(overrides: Partial<Part>): Part {
  return {
    id: 'test_part_' + Math.random().toString(36).slice(2, 7),
    name: 'Pieza Test',
    length: 600,
    width: 400,
    thickness: 18,
    quantity: 1,
    materialId: 'mat_white',
    materialName: 'Blanco',
    grain: 'none',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    ...overrides
  };
}

describe('PartGeometryService', () => {
  let service: PartGeometryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PartGeometryService]
    });
    service = TestBed.inject(PartGeometryService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('getLocalDimensions', () => {
    it('debe mapear correctamente un tablero horizontal (L en X, W en Z, t en Y)', () => {
      const part = createMockPart({
        id: 'p1',
        name: 'Tapa',
        length: 800,
        width: 600,
        thickness: 18,
        orientation: 'horizontal'
      });
      const dims = service.getLocalDimensions(part);
      expect(dims.sx).toBe(800);
      expect(dims.sy).toBe(18);
      expect(dims.sz).toBe(600);
      expect(dims.lengthLocalAxis).toBe('x');
      expect(dims.widthLocalAxis).toBe('z');
      expect(dims.thicknessLocalAxis).toBe('y');
    });

    it('debe mapear correctamente un frontal vertical_xy (L en X, W en Y, t en Z)', () => {
      const part = createMockPart({
        id: 'p2',
        name: 'Puerta',
        length: 596,
        width: 716,
        thickness: 15,
        orientation: 'vertical_xy',
        componentRole: 'door'
      });
      const dims = service.getLocalDimensions(part);
      expect(dims.sx).toBe(596);
      expect(dims.sy).toBe(716);
      expect(dims.sz).toBe(15);
      expect(dims.lengthLocalAxis).toBe('x');
      expect(dims.widthLocalAxis).toBe('y');
      expect(dims.thicknessLocalAxis).toBe('z');
    });

    it('debe mapear un lateral vertical_yz (t en X, L en Y, W en Z)', () => {
      const part = createMockPart({
        id: 'p3',
        name: 'Lateral Izquierdo',
        length: 720,
        width: 580,
        thickness: 18,
        orientation: 'vertical_yz',
        componentRole: 'side_left'
      });
      const dims = service.getLocalDimensions(part);
      expect(dims.sx).toBe(18);
      expect(dims.sy).toBe(720);
      expect(dims.sz).toBe(580);
      expect(dims.lengthLocalAxis).toBe('y');
      expect(dims.widthLocalAxis).toBe('z');
      expect(dims.thicknessLocalAxis).toBe('x');
    });

    it('debe mapear un zócalo lateral vertical_yz con profundidad en Z (t en X, W en Y, L en Z)', () => {
      const part = createMockPart({
        id: 'p4',
        name: 'Zócalo Lateral',
        length: 500,
        width: 80,
        thickness: 15,
        orientation: 'vertical_yz',
        componentRole: 'plinth'
      });
      const dims = service.getLocalDimensions(part);
      expect(dims.sx).toBe(15);
      expect(dims.sy).toBe(80);
      expect(dims.sz).toBe(500);
      expect(dims.lengthLocalAxis).toBe('z');
      expect(dims.widthLocalAxis).toBe('y');
      expect(dims.thicknessLocalAxis).toBe('x');
    });
  });

  describe('getWorldAABB', () => {
    it('debe calcular límites exactos para pieza horizontal no rotada', () => {
      const part = createMockPart({
        id: 'p1',
        name: 'Repisa',
        length: 600,
        width: 400,
        thickness: 15,
        posX: 100,
        posY: 500,
        posZ: -200,
        orientation: 'horizontal'
      });
      const aabb = service.getWorldAABB(part);
      expect(aabb.minX).toBe(-200);
      expect(aabb.maxX).toBe(400);
      expect(aabb.minY).toBe(492.5);
      expect(aabb.maxY).toBe(507.5);
      expect(aabb.minZ).toBe(-400);
      expect(aabb.maxZ).toBe(0);
      expect(aabb.sx).toBe(600);
      expect(aabb.sy).toBe(15);
      expect(aabb.sz).toBe(400);
    });

    it('debe intercambiar dimensiones XZ en el mundo al rotar 90° en Y', () => {
      const part = createMockPart({
        id: 'p1',
        name: 'Repisa Rotada',
        length: 600,
        width: 400,
        thickness: 15,
        posX: 0,
        posY: 10,
        posZ: 0,
        orientation: 'horizontal',
        rotationY: 90
      });
      const aabb = service.getWorldAABB(part);
      expect(Math.round(aabb.sx)).toBe(400);
      expect(Math.round(aabb.sz)).toBe(600);
      expect(aabb.sy).toBe(15);
    });
  });

  describe('buildExtrudedBoardGeometry', () => {
    it('siempre debe extruir con el espesor real de la pieza sin importar si es vertical', () => {
      const part = createMockPart({
        id: 'vert1',
        name: 'Lateral con Chaflán',
        length: 800,
        width: 600,
        thickness: 18,
        orientation: 'vertical_yz',
        componentRole: 'side_left',
        cornerCutConfig: {
          type: 'chamfer_corner',
          corner: 'front_right',
          cutX: 100,
          cutY: 100
        }
      });

      const geo = service.buildExtrudedBoardGeometry(part);
      expect(geo).toBeTruthy();
      expect(geo.boundingBox).toBeTruthy();
      const bb = geo.boundingBox!;
      const dimX = Math.round(bb.max.x - bb.min.x);
      const dimY = Math.round(bb.max.y - bb.min.y);
      const dimZ = Math.round(bb.max.z - bb.min.z);

      // En vertical_yz estándar: X es espesor (18), Y es largo (800), Z es ancho (600)
      expect(dimX).toBe(18);
      expect(dimY).toBe(800);
      expect(dimZ).toBe(600);
    });

    it('debe extruir piezas horizontales con espesor en Y', () => {
      const part = createMockPart({
        id: 'horiz1',
        name: 'Tapa con Destaje en L',
        length: 1000,
        width: 600,
        thickness: 15,
        orientation: 'horizontal',
        cornerCutConfig: {
          type: 'notch_l',
          corner: 'back_right',
          cutX: 150,
          cutY: 150
        }
      });

      const geo = service.buildExtrudedBoardGeometry(part);
      const bb = geo.boundingBox!;
      const dimX = Math.round(bb.max.x - bb.min.x);
      const dimY = Math.round(bb.max.y - bb.min.y);
      const dimZ = Math.round(bb.max.z - bb.min.z);

      expect(dimX).toBe(1000);
      expect(dimY).toBe(15);
      expect(dimZ).toBe(600);
    });
  });

  describe('arePartsCollidingOBB', () => {
    it('no debe reportar colisión para dos piezas contiguas que solo se tocan al ras (contacto de ensamble)', () => {
      const piso = createMockPart({
        id: 'piso',
        name: 'Piso',
        length: 600,
        width: 500,
        thickness: 18,
        posX: 0,
        posY: 9,
        posZ: 0,
        orientation: 'horizontal'
      });

      const lateral = createMockPart({
        id: 'lat',
        name: 'Lateral',
        length: 700,
        width: 500,
        thickness: 18,
        posX: -291, // Enrasado al borde izquierdo de 600 (-300 a +300): centro en -300 + 9 = -291
        posY: 350 + 18,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'side_left'
      });

      const res = service.arePartsCollidingOBB(piso, lateral, 1.5);
      expect(res.colliding).toBe(false);
    });

    it('debe detectar colisión física cuando dos piezas se interpenetran', () => {
      const p1 = createMockPart({
        id: 'p1',
        name: 'Pieza A',
        length: 400,
        width: 400,
        thickness: 18,
        posX: 0,
        posY: 200,
        posZ: 0,
        orientation: 'horizontal'
      });

      const p2 = createMockPart({
        id: 'p2',
        name: 'Pieza B (Atravesada)',
        length: 400,
        width: 400,
        thickness: 18,
        posX: 50,
        posY: 205, // 13mm de penetración en Y
        posZ: 50,
        orientation: 'horizontal'
      });

      const res = service.arePartsCollidingOBB(p1, p2, 1.5);
      expect(res.colliding).toBe(true);
      expect(res.overlapVolume).toBeGreaterThan(0);
    });
  });
});
