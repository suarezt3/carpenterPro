import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import {
  DIMENSION_LINE_RENDER_ORDER,
  DIMENSION_SPRITE_RENDER_ORDER,
  DimensionAnchor3dService,
  DimensionLineSegment,
  computeClearanceReposition,
  configureDimensionOverlayMaterial,
  getBadgeClearanceAxis,
  resolveClearanceAnchorAndMover
} from './dimension-anchor-3d.service';
import { Part } from '../models/melamine.models';
import { PartWorldAABB } from './part-geometry.service';

function makeTestPart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'test-part-1',
    name: 'Repisa Test',
    componentRole: 'shelf',
    groupId: 'mod-1',
    length: 764,
    width: 380,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-1',
    materialName: 'Blanco 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 500,
    posZ: 0,
    orientation: 'horizontal',
    ...overrides
  };
}

function makeWorldBounds(
  px: number,
  py: number,
  pz: number,
  sx: number,
  sy: number,
  sz: number,
  partOverrides: Partial<Part> = {}
): PartWorldAABB {
  return {
    part: makeTestPart({ posX: px, posY: py, posZ: pz, ...partOverrides }),
    px,
    py,
    pz,
    sx,
    sy,
    sz,
    localSx: sx,
    localSy: sy,
    localSz: sz,
    minX: px - sx / 2,
    maxX: px + sx / 2,
    minY: py - sy / 2,
    maxY: py + sy / 2,
    minZ: pz - sz / 2,
    maxZ: pz + sz / 2
  };
}

function expectVectorClose(actual: THREE.Vector3, expected: THREE.Vector3, tolerance = 1e-6): void {
  expect(actual.distanceTo(expected)).toBeLessThan(tolerance);
}

function expectTicksOrthogonalAndCentered(segment: DimensionLineSegment): void {
  expect(segment.tickSegments.length).toBeGreaterThanOrEqual(4);
  expect(segment.tickSegments.length % 2).toBe(0);

  const edgeDir = segment.p2.clone().sub(segment.p1).normalize();
  const t1Mid = segment.tickSegments[0].clone().add(segment.tickSegments[1]).multiplyScalar(0.5);
  const t2Mid = segment.tickSegments[2].clone().add(segment.tickSegments[3]).multiplyScalar(0.5);

  expectVectorClose(t1Mid, segment.p1);
  expectVectorClose(t2Mid, segment.p2);

  const t1Dir = segment.tickSegments[1].clone().sub(segment.tickSegments[0]).normalize();
  const t2Dir = segment.tickSegments[3].clone().sub(segment.tickSegments[2]).normalize();
  expect(Math.abs(t1Dir.dot(edgeDir))).toBeLessThan(1e-6);
  expect(Math.abs(t2Dir.dot(edgeDir))).toBeLessThan(1e-6);
}

describe('DimensionAnchor3dService', () => {
  let service: DimensionAnchor3dService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DimensionAnchor3dService]
    });
    service = TestBed.inject(DimensionAnchor3dService);
  });

  describe('1. Constantes y Materiales Overlay (depthTest/depthWrite/renderOrder)', () => {
    it('debe exportar renderOrder 950 para líneas y 1000 para sprites', () => {
      expect(DIMENSION_LINE_RENDER_ORDER).toBe(950);
      expect(DIMENSION_SPRITE_RENDER_ORDER).toBe(1000);
    });

    it('configureDimensionOverlayMaterial debe desactivar depthTest/depthWrite, marcar needsUpdate al cambiar y garantizar renderOrder >= 950', () => {
      const mat = new THREE.LineBasicMaterial({ color: 0x2563eb });
      mat.depthTest = true;
      mat.depthWrite = true;
      const initialVersion = mat.version;

      const order = service.configureDimensionOverlayMaterial(mat, 200);

      expect(mat.depthTest).toBe(false);
      expect(mat.depthWrite).toBe(false);
      expect(mat.version).toBe(initialVersion + 1);
      expect(order).toBe(DIMENSION_LINE_RENDER_ORDER);

      const versionAfterFirst = mat.version;
      const spriteOrder = configureDimensionOverlayMaterial(mat, DIMENSION_SPRITE_RENDER_ORDER);
      expect(mat.version).toBe(versionAfterFirst);
      expect(spriteOrder).toBe(1000);
    });
  });

  describe('2. computePieceDimensionSegments (arista-a-arista con 0.0 mm de deriva)', () => {
    it('debe anclar piezas horizontales exactamente sobre sus aristas superior-frontal y superior-derecha', () => {
      const layout = service.computePieceDimensionSegments({
        px: 120,
        py: 500,
        pz: -30,
        sx: 800,
        sy: 18,
        sz: 400,
        orientation: 'horizontal'
      });

      // Arista superior-frontal (+Y=509, +Z=170, X de -280 a +520)
      expectVectorClose(layout.lengthSegment.p1, new THREE.Vector3(-280, 509, 170));
      expectVectorClose(layout.lengthSegment.p2, new THREE.Vector3(520, 509, 170));
      expectVectorClose(layout.lengthSegment.midpoint, new THREE.Vector3(120, 509, 170));
      expect(layout.lengthSegment.witnessSegments).toEqual([]);
      expectTicksOrthogonalAndCentered(layout.lengthSegment);

      // Arista superior-derecha (+X=520, +Y=509, Z de -230 a +170)
      expectVectorClose(layout.widthSegment.p1, new THREE.Vector3(520, 509, -230));
      expectVectorClose(layout.widthSegment.p2, new THREE.Vector3(520, 509, 170));
      expectVectorClose(layout.widthSegment.midpoint, new THREE.Vector3(520, 509, -30));
      expect(layout.widthSegment.witnessSegments).toEqual([]);
      expectTicksOrthogonalAndCentered(layout.widthSegment);
    });

    it('debe anclar piezas vertical_xy en aristas superior-frontal (largo) y derecha-frontal vertical (ancho)', () => {
      const layout = service.computePieceDimensionSegments({
        px: 0,
        py: 400,
        pz: 200,
        sx: 600,
        sy: 720,
        sz: 18,
        orientation: 'vertical_xy'
      });

      expectVectorClose(layout.lengthSegment.p1, new THREE.Vector3(-300, 760, 209));
      expectVectorClose(layout.lengthSegment.p2, new THREE.Vector3(300, 760, 209));
      expectVectorClose(layout.lengthSegment.midpoint, new THREE.Vector3(0, 760, 209));
      expectTicksOrthogonalAndCentered(layout.lengthSegment);

      expectVectorClose(layout.widthSegment.p1, new THREE.Vector3(300, 40, 209));
      expectVectorClose(layout.widthSegment.p2, new THREE.Vector3(300, 760, 209));
      expectVectorClose(layout.widthSegment.midpoint, new THREE.Vector3(300, 400, 209));
      expectTicksOrthogonalAndCentered(layout.widthSegment);
    });

    it('debe anclar paneles laterales vertical_yz en arista vertical frontal-derecha y arista de profundidad superior-derecha', () => {
      const layout = service.computePieceDimensionSegments({
        px: -391,
        py: 1000,
        pz: 0,
        sx: 18,
        sy: 2000,
        sz: 400,
        orientation: 'vertical_yz'
      });

      // Vertical frontal-derecha (+X=-382, +Z=200, Y de 0 a 2000)
      expectVectorClose(layout.lengthSegment.p1, new THREE.Vector3(-382, 0, 200));
      expectVectorClose(layout.lengthSegment.p2, new THREE.Vector3(-382, 2000, 200));
      expectVectorClose(layout.lengthSegment.midpoint, new THREE.Vector3(-382, 1000, 200));
      expectTicksOrthogonalAndCentered(layout.lengthSegment);

      // Profundidad superior-derecha (+X=-382, +Y=2000, Z de -200 a +200)
      expectVectorClose(layout.widthSegment.p1, new THREE.Vector3(-382, 2000, -200));
      expectVectorClose(layout.widthSegment.p2, new THREE.Vector3(-382, 2000, 200));
      expectVectorClose(layout.widthSegment.midpoint, new THREE.Vector3(-382, 2000, 0));
      expectTicksOrthogonalAndCentered(layout.widthSegment);
    });

    it('debe transformar exactamente los vértices reales de una pieza rotada con Euler XYZ respecto al Mesh de Three.js', () => {
      const localLx = 800;
      const localLy = 18;
      const localLz = 400;
      const px = 150;
      const py = 420;
      const pz = -80;
      const rx = 12;
      const ry = 45;
      const rz = -8;

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(localLx, localLy, localLz));
      mesh.position.set(px, py, pz);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz),
        'XYZ'
      );
      mesh.updateMatrixWorld(true);

      const expectedLenP1 = new THREE.Vector3(-localLx / 2, localLy / 2, localLz / 2).applyMatrix4(mesh.matrixWorld);
      const expectedLenP2 = new THREE.Vector3(localLx / 2, localLy / 2, localLz / 2).applyMatrix4(mesh.matrixWorld);
      const expectedWidP1 = new THREE.Vector3(localLx / 2, localLy / 2, -localLz / 2).applyMatrix4(mesh.matrixWorld);
      const expectedWidP2 = new THREE.Vector3(localLx / 2, localLy / 2, localLz / 2).applyMatrix4(mesh.matrixWorld);

      const layout = service.computePieceDimensionSegments({
        px,
        py,
        pz,
        sx: 1000,
        sy: 120,
        sz: 1000,
        orientation: 'horizontal',
        rotationX: rx,
        rotationY: ry,
        rotationZ: rz,
        localLx,
        localLy,
        localLz
      });

      expectVectorClose(layout.lengthSegment.p1, expectedLenP1);
      expectVectorClose(layout.lengthSegment.p2, expectedLenP2);
      expect(layout.lengthSegment.p1.distanceTo(layout.lengthSegment.p2)).toBeCloseTo(localLx, 6);
      expectVectorClose(
        layout.lengthSegment.midpoint,
        expectedLenP1.clone().add(expectedLenP2).multiplyScalar(0.5)
      );
      expectTicksOrthogonalAndCentered(layout.lengthSegment);

      expectVectorClose(layout.widthSegment.p1, expectedWidP1);
      expectVectorClose(layout.widthSegment.p2, expectedWidP2);
      expect(layout.widthSegment.p1.distanceTo(layout.widthSegment.p2)).toBeCloseTo(localLz, 6);
      expectTicksOrthogonalAndCentered(layout.widthSegment);
    });

    it('debe usar exactamente la AABB [px ± sx/2, py ± sy/2, pz ± sz/2] cuando no se proveen localDims', () => {
      const layout = service.computePieceDimensionSegments({
        px: 50,
        py: 200,
        pz: 10,
        sx: 400,
        sy: 18,
        sz: 300,
        orientation: 'horizontal',
        rotationY: 45
      });

      expectVectorClose(layout.lengthSegment.p1, new THREE.Vector3(-150, 209, 160));
      expectVectorClose(layout.lengthSegment.p2, new THREE.Vector3(250, 209, 160));
      expectVectorClose(layout.widthSegment.p1, new THREE.Vector3(250, 209, -140));
      expectVectorClose(layout.widthSegment.p2, new THREE.Vector3(250, 209, 160));
    });
  });

  describe('3. computeModuleInternalClearancesLayout (módulos y repisas remetidas)', () => {
    it('debe anclar bahías verticales al plano frontal exacto, omitir <10 mm, generar testigos para repisa remetida y acotar Luz X / exterior inferior', () => {
      const layout = service.computeModuleInternalClearancesLayout({
        bays: [
          {
            // Bahía 0: piso (Z=200) -> repisa remetida (Z=180)
            yBottom: 18,
            yTop: 600,
            bottomFrontZ: 200,
            topFrontZ: 180,
            shelfFrontZ: 180,
            bayMinX: -382,
            bayMaxX: 382,
            centerX: 0,
            distance: 582
          },
          {
            // Bahía 1: repisa remetida (Z=180) -> techo (Z=200)
            yBottom: 618,
            yTop: 1982,
            bottomFrontZ: 180,
            topFrontZ: 200,
            shelfFrontZ: 180,
            bayMinX: -382,
            bayMaxX: 382,
            centerX: 900, // fuera de rango -> debe clampearse a bayMaxX (382)
            distance: 1364
          },
          {
            // Bahía 2: demasiado pequeña (< 10 mm) -> debe omitirse
            yBottom: 1982,
            yTop: 1988,
            bottomFrontZ: 200,
            topFrontZ: 200,
            shelfFrontZ: 200,
            bayMinX: -382,
            bayMaxX: 382,
            centerX: 0,
            distance: 6
          }
        ],
        leftInnerX: -382,
        rightInnerX: 382,
        leftSideFrontZ: 200,
        rightSideFrontZ: 200,
        bottomFrontZ: 200,
        floorTopY: 18,
        moduleMinX: -400,
        moduleMaxX: 400,
        moduleMinY: 0,
        moduleFrontZ: 200
      });

      expect(layout.verticalBays.length).toBe(2);

      const bay0 = layout.verticalBays[0];
      expect(bay0.bayIndex).toBe(0);
      expect(bay0.anchorX).toBe(0);
      expect(bay0.anchorZ).toBe(180);
      expectVectorClose(bay0.segment.p1, new THREE.Vector3(0, 18, 180));
      expectVectorClose(bay0.segment.p2, new THREE.Vector3(0, 600, 180));
      expectVectorClose(bay0.segment.midpoint, new THREE.Vector3(0, 309, 180));

      // Línea testigo perpendicular de 0-brecha conectando borde frontal del piso (Z=200) con anchorZ (180)
      expect(bay0.segment.witnessSegments.length).toBe(2);
      expectVectorClose(bay0.segment.witnessSegments[0], new THREE.Vector3(0, 18, 200));
      expectVectorClose(bay0.segment.witnessSegments[1], new THREE.Vector3(0, 18, 180));

      // Todos los ticks y puntas de flecha en plano z = anchorZ
      expect(bay0.segment.tickSegments.length).toBe(12);
      for (const pt of bay0.segment.tickSegments) {
        expect(pt.z).toBeCloseTo(180, 6);
      }

      const bay1 = layout.verticalBays[1];
      expect(bay1.bayIndex).toBe(1);
      expect(bay1.anchorX).toBe(382);
      expect(bay1.anchorZ).toBe(180);
      expectVectorClose(bay1.segment.p1, new THREE.Vector3(382, 618, 180));
      expectVectorClose(bay1.segment.p2, new THREE.Vector3(382, 1982, 180));
      expect(bay1.segment.witnessSegments.length).toBe(2);
      expectVectorClose(bay1.segment.witnessSegments[0], new THREE.Vector3(382, 1982, 200));
      expectVectorClose(bay1.segment.witnessSegments[1], new THREE.Vector3(382, 1982, 180));

      // Luz X interna exactamente sobre piso (y=18) y frente lateral (z=200)
      expect(layout.innerWidth).toBe(764);
      expect(layout.innerWidthSegment).not.toBeNull();
      expectVectorClose(layout.innerWidthSegment!.p1, new THREE.Vector3(-382, 18, 200));
      expectVectorClose(layout.innerWidthSegment!.p2, new THREE.Vector3(382, 18, 200));
      expectVectorClose(layout.innerWidthSegment!.midpoint, new THREE.Vector3(0, 18, 200));
      for (const pt of layout.innerWidthSegment!.tickSegments) {
        expect(pt.z).toBeCloseTo(200, 6);
      }

      // Ancho exterior inferior exacto (-400 -> +400 en y=0, z=200)
      expect(layout.outerBottomWidth).toBe(800);
      expect(layout.outerBottomWidthSegment).not.toBeNull();
      expectVectorClose(layout.outerBottomWidthSegment!.p1, new THREE.Vector3(-400, 0, 200));
      expectVectorClose(layout.outerBottomWidthSegment!.p2, new THREE.Vector3(400, 0, 200));
      expectVectorClose(layout.outerBottomWidthSegment!.midpoint, new THREE.Vector3(0, 0, 200));
    });

    it('debe usar moduleMinY cuando floorTopY <= 0 y anclar al plano remetido aunque shelfFrontZ venga con el máximo del módulo', () => {
      const layout = service.computeModuleInternalClearancesLayout({
        bays: [
          {
            yBottom: 700,
            yTop: 1100,
            bottomFrontZ: 180,
            topFrontZ: 200,
            shelfFrontZ: 200,
            bayMinX: -282,
            bayMaxX: 282,
            centerX: 0,
            distance: 400
          }
        ],
        leftInnerX: -282,
        rightInnerX: 282,
        floorTopY: 0,
        moduleMinX: -300,
        moduleMaxX: 300,
        moduleMinY: 700,
        moduleFrontZ: 200
      });

      expect(layout.verticalBays[0].anchorZ).toBe(180);
      expect(layout.innerWidthSegment).not.toBeNull();
      expectVectorClose(layout.innerWidthSegment!.p1, new THREE.Vector3(-282, 700, 200));
      expectVectorClose(layout.innerWidthSegment!.p2, new THREE.Vector3(282, 700, 200));
    });

    it('debe omitir Luz X y ancho exterior cuando el vano <= 40 mm y generar testigo en laterales asimétricos', () => {
      const narrow = service.computeModuleInternalClearancesLayout({
        bays: [],
        leftInnerX: -15,
        rightInnerX: 20,
        floorTopY: 18,
        moduleMinX: -20,
        moduleMaxX: 20,
        moduleMinY: 0,
        moduleFrontZ: 200
      });
      expect(narrow.innerWidthSegment).toBeNull();
      expect(narrow.innerWidth).toBe(0);
      expect(narrow.outerBottomWidthSegment).toBeNull();
      expect(narrow.outerBottomWidth).toBe(0);

      const asym = service.computeModuleInternalClearancesLayout({
        bays: [],
        leftInnerX: -282,
        rightInnerX: 282,
        leftSideFrontZ: 180,
        rightSideFrontZ: 200,
        floorTopY: 18,
        moduleMinX: -300,
        moduleMaxX: 300,
        moduleMinY: 0,
        moduleFrontZ: 200
      });
      expect(asym.innerWidthSegment).not.toBeNull();
      expectVectorClose(asym.innerWidthSegment!.p1, new THREE.Vector3(-282, 18, 180));
      expectVectorClose(asym.innerWidthSegment!.p2, new THREE.Vector3(282, 18, 180));
      expect(asym.innerWidthSegment!.witnessSegments.length).toBe(2);
      expectVectorClose(asym.innerWidthSegment!.witnessSegments[0], new THREE.Vector3(282, 18, 200));
      expectVectorClose(asym.innerWidthSegment!.witnessSegments[1], new THREE.Vector3(282, 18, 180));
    });
  });

  describe('4. computeStandaloneClearanceSegments (piezas sueltas con 0.0 mm en Z)', () => {
    it('debe anclar las 4 direcciones a bounds.maxZ y agregar líneas testigo hacia vecinos con frontZ distinto', () => {
      const bounds = makeWorldBounds(100, 400, 0, 500, 18, 360);
      // maxZ = 180, minX = -150, maxX = 350, minY = 391, maxY = 409
      const layout = service.computeStandaloneClearanceSegments({
        bounds,
        topClearance: 200,
        bottomClearance: 300,
        leftClearance: 120,
        rightClearance: 4, // <= 5 -> debe omitirse
        topNeighborFrontZ: 210,
        bottomNeighborFrontZ: 180,
        leftNeighborFrontZ: 150
      });

      expect(layout.top).not.toBeNull();
      expectVectorClose(layout.top!.p1, new THREE.Vector3(100, 409, 180));
      expectVectorClose(layout.top!.p2, new THREE.Vector3(100, 609, 180));
      expectVectorClose(layout.top!.midpoint, new THREE.Vector3(100, 509, 180));
      expect(layout.top!.witnessSegments.length).toBe(2);
      expectVectorClose(layout.top!.witnessSegments[0], new THREE.Vector3(100, 609, 210));
      expectVectorClose(layout.top!.witnessSegments[1], new THREE.Vector3(100, 609, 180));

      expect(layout.bottom).not.toBeNull();
      expectVectorClose(layout.bottom!.p1, new THREE.Vector3(100, 91, 180));
      expectVectorClose(layout.bottom!.p2, new THREE.Vector3(100, 391, 180));
      expect(layout.bottom!.witnessSegments).toEqual([]);

      expect(layout.left).not.toBeNull();
      expectVectorClose(layout.left!.p1, new THREE.Vector3(-270, 400, 180));
      expectVectorClose(layout.left!.p2, new THREE.Vector3(-150, 400, 180));
      expectVectorClose(layout.left!.midpoint, new THREE.Vector3(-210, 400, 180));
      expect(layout.left!.witnessSegments.length).toBe(2);
      expectVectorClose(layout.left!.witnessSegments[0], new THREE.Vector3(-270, 400, 150));
      expectVectorClose(layout.left!.witnessSegments[1], new THREE.Vector3(-270, 400, 180));

      expect(layout.right).toBeNull();
    });
  });

  describe('5. computeDrawerCavitySegments (cajón modular en frontEdgeCoord exacto)', () => {
    it('debe anclar topLine, bottomLine y widthMidpoint directamente sobre frontEdgeCoord sin offset hacia adelante', () => {
      const layout = service.computeDrawerCavitySegments({
        minY: 18,
        maxY: 400,
        innerWidth: 564,
        centerX: 0,
        centerZ: 0,
        frontEdgeCoord: 220,
        facingDirection: 'front',
        drawerMinY: 50,
        drawerMaxY: 230
      });

      expect(layout.refDepth).toBe(220);
      expect(layout.topClearance).toBe(170);
      expect(layout.bottomClearance).toBe(32);

      expect(layout.topLine).not.toBeNull();
      expectVectorClose(layout.topLine!.p1, new THREE.Vector3(0, 230, 220));
      expectVectorClose(layout.topLine!.p2, new THREE.Vector3(0, 400, 220));
      expectVectorClose(layout.topLine!.midpoint, new THREE.Vector3(0, 315, 220));

      expect(layout.bottomLine).not.toBeNull();
      expectVectorClose(layout.bottomLine!.p1, new THREE.Vector3(0, 18, 220));
      expectVectorClose(layout.bottomLine!.p2, new THREE.Vector3(0, 50, 220));
      expectVectorClose(layout.bottomLine!.midpoint, new THREE.Vector3(0, 34, 220));

      expect(layout.widthLine).not.toBeNull();
      expectVectorClose(layout.widthLine!.p1, new THREE.Vector3(-282, 18, 220));
      expectVectorClose(layout.widthLine!.p2, new THREE.Vector3(282, 18, 220));
      expectVectorClose(layout.widthMidpoint, new THREE.Vector3(0, 18, 220));
    });

    it('debe soportar huecos orientados lateralmente (right/left) proyectando sobre el eje X = frontEdgeCoord', () => {
      const layout = service.computeDrawerCavitySegments({
        minY: 100,
        maxY: 350,
        innerWidth: 480,
        centerX: 0,
        centerZ: -50,
        frontEdgeCoord: 300,
        facingDirection: 'right',
        drawerMinY: 120,
        drawerMaxY: 348 // topClearance = 2 (< 4) -> topLine debe ser null
      });

      expect(layout.topLine).toBeNull();
      expect(layout.bottomLine).not.toBeNull();
      expectVectorClose(layout.bottomLine!.p1, new THREE.Vector3(300, 100, -50));
      expectVectorClose(layout.bottomLine!.p2, new THREE.Vector3(300, 120, -50));
      expectVectorClose(layout.widthLine!.p1, new THREE.Vector3(300, 100, -290));
      expectVectorClose(layout.widthLine!.p2, new THREE.Vector3(300, 100, 190));
      expectVectorClose(layout.widthMidpoint, new THREE.Vector3(300, 100, -50));
    });
  });

  describe('6. Alineación 3D->2D en Órbita de Cámara 360° (< 1e-4 NDC de error)', () => {
    it('debe proyectar extremos y puntos medios de cotas sobre los vértices reales del tablero desde frente, 90° lateral, 180° atrás e isométrica', () => {
      const localLx = 764;
      const localLy = 18;
      const localLz = 380;
      const px = 40;
      const py = 520;
      const pz = -20;
      const ry = 30;

      const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(localLx, localLy, localLz));
      boardMesh.position.set(px, py, pz);
      boardMesh.rotation.set(0, THREE.MathUtils.degToRad(ry), 0, 'XYZ');
      boardMesh.updateMatrixWorld(true);

      const layout = service.computePieceDimensionSegments({
        px,
        py,
        pz,
        sx: 852,
        sy: 18,
        sz: 711,
        orientation: 'horizontal',
        rotationY: ry,
        localLx,
        localLy,
        localLz
      });

      const woodP1 = new THREE.Vector3(-localLx / 2, localLy / 2, localLz / 2).applyMatrix4(boardMesh.matrixWorld);
      const woodP2 = new THREE.Vector3(localLx / 2, localLy / 2, localLz / 2).applyMatrix4(boardMesh.matrixWorld);
      const woodWidP1 = new THREE.Vector3(localLx / 2, localLy / 2, -localLz / 2).applyMatrix4(boardMesh.matrixWorld);
      const woodMid = woodP1.clone().add(woodP2).multiplyScalar(0.5);

      const cameraAngles: { name: string; pos: THREE.Vector3 }[] = [
        { name: 'Frente 0°', pos: new THREE.Vector3(px, py, pz + 2000) },
        { name: 'Derecha 90°', pos: new THREE.Vector3(px + 2000, py, pz) },
        { name: 'Atrás 180°', pos: new THREE.Vector3(px, py, pz - 2000) },
        { name: 'Izquierda 270°', pos: new THREE.Vector3(px - 2000, py, pz) },
        { name: 'Isométrica 45°', pos: new THREE.Vector3(px + 1400, py + 1100, pz + 1400) },
        { name: 'Isométrica Trasera 225°', pos: new THREE.Vector3(px - 1400, py + 900, pz - 1400) }
      ];

      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 1, 10000);
      const lookTarget = new THREE.Vector3(px, py, pz);

      for (const view of cameraAngles) {
        camera.position.copy(view.pos);
        camera.lookAt(lookTarget);
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const projAnchorP1 = layout.lengthSegment.p1.clone().project(camera);
        const projWoodP1 = woodP1.clone().project(camera);
        expect(Math.hypot(projAnchorP1.x - projWoodP1.x, projAnchorP1.y - projWoodP1.y)).toBeLessThan(1e-4);

        const projAnchorP2 = layout.lengthSegment.p2.clone().project(camera);
        const projWoodP2 = woodP2.clone().project(camera);
        expect(Math.hypot(projAnchorP2.x - projWoodP2.x, projAnchorP2.y - projWoodP2.y)).toBeLessThan(1e-4);

        const projAnchorMid = layout.lengthSegment.midpoint.clone().project(camera);
        const projWoodMid = woodMid.clone().project(camera);
        expect(Math.hypot(projAnchorMid.x - projWoodMid.x, projAnchorMid.y - projWoodMid.y)).toBeLessThan(1e-4);

        const projAnchorWidP1 = layout.widthSegment.p1.clone().project(camera);
        const projWoodWidP1 = woodWidP1.clone().project(camera);
        expect(Math.hypot(projAnchorWidP1.x - projWoodWidP1.x, projAnchorWidP1.y - projWoodWidP1.y)).toBeLessThan(1e-4);
      }
    });

    it('debe mantener alineación 360° (< 1e-4 NDC) entre las cotas internas de un módulo y sus esquinas físicas reales', () => {
      const moduleLayout = service.computeModuleInternalClearancesLayout({
        bays: [
          {
            yBottom: 18,
            yTop: 600,
            bottomFrontZ: 200,
            topFrontZ: 180,
            shelfFrontZ: 180,
            bayMinX: -382,
            bayMaxX: 382,
            centerX: 0,
            distance: 582
          }
        ],
        leftInnerX: -382,
        rightInnerX: 382,
        leftSideFrontZ: 200,
        rightSideFrontZ: 200,
        floorTopY: 18,
        moduleMinX: -400,
        moduleMaxX: 400,
        moduleMinY: 0,
        moduleFrontZ: 200
      });

      const realInnerLeft = new THREE.Vector3(-382, 18, 200);
      const realInnerRight = new THREE.Vector3(382, 18, 200);
      const realShelfContact = new THREE.Vector3(0, 600, 180);
      const realFloorWitnessStart = new THREE.Vector3(0, 18, 200);

      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 1, 10000);
      const center = new THREE.Vector3(0, 300, 0);

      for (let deg = 0; deg < 360; deg += 45) {
        const rad = THREE.MathUtils.degToRad(deg);
        camera.position.set(Math.sin(rad) * 2200, 500, Math.cos(rad) * 2200);
        camera.lookAt(center);
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const pLeftProj = moduleLayout.innerWidthSegment!.p1.clone().project(camera);
        const realLeftProj = realInnerLeft.clone().project(camera);
        expect(Math.hypot(pLeftProj.x - realLeftProj.x, pLeftProj.y - realLeftProj.y)).toBeLessThan(1e-4);

        const pRightProj = moduleLayout.innerWidthSegment!.p2.clone().project(camera);
        const realRightProj = realInnerRight.clone().project(camera);
        expect(Math.hypot(pRightProj.x - realRightProj.x, pRightProj.y - realRightProj.y)).toBeLessThan(1e-4);

        const bayTopProj = moduleLayout.verticalBays[0].segment.p2.clone().project(camera);
        const realShelfProj = realShelfContact.clone().project(camera);
        expect(Math.hypot(bayTopProj.x - realShelfProj.x, bayTopProj.y - realShelfProj.y)).toBeLessThan(1e-4);

        const witnessStartProj = moduleLayout.verticalBays[0].segment.witnessSegments[0].clone().project(camera);
        const realFloorWitnessProj = realFloorWitnessStart.clone().project(camera);
        expect(
          Math.hypot(witnessStartProj.x - realFloorWitnessProj.x, witnessStartProj.y - realFloorWitnessProj.y)
        ).toBeLessThan(1e-4);
      }
    });

    it('computeAlongSegmentLabelPosition debe devolver el punto medio exacto de lejos y deslizarse estrictamente sobre la arista en zoom cercano', () => {
      const p1 = new THREE.Vector3(-400, 500, 200);
      const p2 = new THREE.Vector3(400, 500, 200);

      const farPos = service.computeAlongSegmentLabelPosition(
        p1,
        p2,
        new THREE.Vector3(0, 500, 1800),
        new THREE.Vector3(0, 500, 200)
      );
      expectVectorClose(farPos, new THREE.Vector3(0, 500, 200));

      const closePos = service.computeAlongSegmentLabelPosition(
        p1,
        p2,
        new THREE.Vector3(250, 500, 500),
        new THREE.Vector3(250, 500, 200)
      );
      expect(closePos.y).toBeCloseTo(500, 6);
      expect(closePos.z).toBeCloseTo(200, 6);
      expect(closePos.x).toBeGreaterThan(0);
      expect(closePos.x).toBeLessThanOrEqual(400);
    });
  });

  describe('Luces Z, tolerancia 0 mm y matemática de ancla vs pieza móvil (X/Y/Z)', () => {
    it('computeStandaloneClearanceSegments debe construir segmentos Z front/back y soportar allowZeroAxes sin romper umbrales por defecto', () => {
      const bounds = makeWorldBounds(0, 500, 0, 600, 18, 400);

      const defaultLayout = service.computeStandaloneClearanceSegments({
        bounds,
        topClearance: null,
        bottomClearance: 4,
        leftClearance: null,
        rightClearance: 0,
        frontClearance: 90,
        backClearance: 4,
        frontNeighborAnchorXY: { x: 40, y: 500 },
        backNeighborAnchorXY: { x: -20, y: 500 }
      });

      expect(defaultLayout.bottom).toBeNull();
      expect(defaultLayout.right).toBeNull();
      expect(defaultLayout.back).toBeNull();
      expect(defaultLayout.front).not.toBeNull();
      expectVectorClose(defaultLayout.front!.p1, new THREE.Vector3(40, 500, 200));
      expectVectorClose(defaultLayout.front!.p2, new THREE.Vector3(40, 500, 290));

      const zeroAllowedLayout = service.computeStandaloneClearanceSegments({
        bounds,
        topClearance: null,
        bottomClearance: 0,
        leftClearance: null,
        rightClearance: 2,
        frontClearance: 0,
        backClearance: 3,
        frontNeighborAnchorXY: { x: 40, y: 500 },
        backNeighborAnchorXY: { x: -20, y: 500 },
        allowZeroAxes: { bottom: true, right: true, front: true, back: true }
      });

      expect(zeroAllowedLayout.bottom).not.toBeNull();
      expect(zeroAllowedLayout.right).not.toBeNull();
      expect(zeroAllowedLayout.front).not.toBeNull();
      expect(zeroAllowedLayout.back).not.toBeNull();
      expectVectorClose(zeroAllowedLayout.front!.p1, new THREE.Vector3(40, 500, 200));
      expectVectorClose(zeroAllowedLayout.front!.p2, new THREE.Vector3(40, 500, 200));
      expectVectorClose(zeroAllowedLayout.back!.p1, new THREE.Vector3(-20, 500, -203));
      expectVectorClose(zeroAllowedLayout.back!.p2, new THREE.Vector3(-20, 500, -200));
    });

    it('computeModuleInternalClearancesLayout debe respetar allowZeroBayIndices y allowZeroInnerWidth', () => {
      const baseInput = {
        bays: [
          {
            yBottom: 18,
            yTop: 18,
            bottomFrontZ: 200,
            topFrontZ: 200,
            shelfFrontZ: 200,
            bayMinX: 0,
            bayMaxX: 0,
            centerX: 0,
            distance: 0
          }
        ],
        leftInnerX: 0,
        rightInnerX: 0,
        floorTopY: 18,
        moduleMinX: -18,
        moduleMaxX: 18,
        moduleMinY: 0,
        moduleFrontZ: 200
      };

      const hidden = service.computeModuleInternalClearancesLayout(baseInput);
      expect(hidden.verticalBays.length).toBe(0);
      expect(hidden.innerWidthSegment).toBeNull();

      const visibleZero = service.computeModuleInternalClearancesLayout({
        ...baseInput,
        allowZeroBayIndices: [0],
        allowZeroInnerWidth: true
      });
      expect(visibleZero.verticalBays.length).toBe(1);
      expect(visibleZero.verticalBays[0].bay.distance).toBe(0);
      expect(visibleZero.innerWidthSegment).not.toBeNull();
      expect(visibleZero.innerWidth).toBe(0);
    });

    it('getBadgeClearanceAxis debe mapear correctamente cotas en X, Y y Z', () => {
      expect(getBadgeClearanceAxis('top_clearance')).toBe('y');
      expect(getBadgeClearanceAxis('bottom_clearance')).toBe('y');
      expect(getBadgeClearanceAxis('left_clearance')).toBe('x');
      expect(getBadgeClearanceAxis('right_clearance')).toBe('x');
      expect(getBadgeClearanceAxis('inner_width_clearance')).toBe('x');
      expect(getBadgeClearanceAxis('front_clearance')).toBe('z');
      expect(getBadgeClearanceAxis('back_clearance')).toBe('z');
    });

    it('resolveClearanceAnchorAndMover y computeClearanceReposition respetan anclas por defecto, selección, isLocked, 0 mm y minY >= 0', () => {
      const lower = makeTestPart({ id: 'p-low', posY: 7.5, thickness: 15 });
      const upper = makeTestPart({ id: 'p-high', posY: 250, thickness: 15 });
      const lowerBounds = makeWorldBounds(0, 7.5, 0, 600, 15, 400);
      const upperBounds = makeWorldBounds(0, 250, 0, 600, 15, 400);

      // Y por defecto: pieza inferior ancla, superior se mueve; permite 2 mm sin salto a 5 mm
      const yDefault = computeClearanceReposition({
        axis: 'y',
        desiredGapMm: 2,
        minSidePart: lower,
        minSideBounds: lowerBounds,
        maxSidePart: upper,
        maxSideBounds: upperBounds
      });
      expect(yDefault.status).toBe('ok');
      expect(yDefault.anchorPart?.id).toBe('p-low');
      expect(yDefault.moverPart?.id).toBe('p-high');
      expect(yDefault.posProp).toBe('posY');
      // lower.maxY (15) + 2 + upper.halfY (7.5) = 24.5
      expect(yDefault.newPosCoord).toBeCloseTo(24.5, 4);
      expect(yDefault.resultingGapMm).toBeCloseTo(2, 4);

      // Y si la superior está bloqueada y la inferior está libre, mueve la inferior protegiendo suelo minY >= 0
      const yLockedUpper = computeClearanceReposition({
        axis: 'y',
        desiredGapMm: 500,
        minSidePart: lower,
        minSideBounds: lowerBounds,
        maxSidePart: { ...upper, isLocked: true },
        maxSideBounds: upperBounds
      });
      expect(yLockedUpper.status).toBe('ok');
      expect(yLockedUpper.moverPart?.id).toBe('p-low');
      // Clampea minY >= 0 => posY >= halfSize (7.5)
      expect(yLockedUpper.newPosCoord).toBeCloseTo(7.5, 4);

      // X por defecto: lateral izquierdo ancla, derecho se mueve (inner_width_clearance 0 mm)
      const leftSide = makeTestPart({
        id: 'side-l',
        orientation: 'vertical_yz',
        posX: -300,
        posY: 400,
        thickness: 18
      });
      const rightSide = makeTestPart({
        id: 'side-r',
        orientation: 'vertical_yz',
        posX: 300,
        posY: 400,
        thickness: 18
      });
      const leftBounds = makeWorldBounds(-300, 400, 0, 18, 800, 400);
      const rightBounds = makeWorldBounds(300, 400, 0, 18, 800, 400);

      const xZero = computeClearanceReposition({
        axis: 'x',
        desiredGapMm: 0,
        minSidePart: leftSide,
        minSideBounds: leftBounds,
        maxSidePart: rightSide,
        maxSideBounds: rightBounds
      });
      expect(xZero.status).toBe('ok');
      expect(xZero.moverPart?.id).toBe('side-r');
      expect(xZero.posProp).toBe('posX');
      // leftSide.maxX (-291) + 0 + 9 = -282
      expect(xZero.newPosCoord).toBeCloseTo(-282, 4);

      // Z por defecto: pieza trasera (-Z) ancla, delantera (+Z) se mueve
      const backPart = makeTestPart({ id: 'z-back', posZ: -120, width: 100 });
      const frontPart = makeTestPart({ id: 'z-front', posZ: 120, width: 100 });
      const backBounds = makeWorldBounds(0, 500, -120, 600, 18, 100);
      const frontBounds = makeWorldBounds(0, 500, 120, 600, 18, 100);

      const zMoved = computeClearanceReposition({
        axis: 'z',
        desiredGapMm: 60,
        minSidePart: backPart,
        minSideBounds: backBounds,
        maxSidePart: frontPart,
        maxSideBounds: frontBounds
      });
      expect(zMoved.status).toBe('ok');
      expect(zMoved.anchorPart?.id).toBe('z-back');
      expect(zMoved.moverPart?.id).toBe('z-front');
      expect(zMoved.posProp).toBe('posZ');
      // back.maxZ (-70) + 60 + 50 = 40
      expect(zMoved.newPosCoord).toBeCloseTo(40, 4);

      // Ambos bloqueados => status 'locked' sin mover ninguna
      const bothLocked = resolveClearanceAnchorAndMover({
        axis: 'x',
        minSidePart: { ...leftSide, isLocked: true },
        maxSidePart: { ...rightSide, isLocked: true }
      });
      expect(bothLocked.status).toBe('locked');
      expect(bothLocked.moverPart).toBeNull();
    });
  });
});
