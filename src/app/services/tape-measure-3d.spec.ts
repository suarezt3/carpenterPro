import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import {
  AXIS_COLORS,
  AXIS_CSS_COLORS,
  AXIS_LOCK_THRESHOLD_MM,
  AXIS_LOCK_THRESHOLD_PX,
  CLICK_DRAG_THRESHOLD_PX,
  SNAP_CORNER_RADIUS_PX,
  SNAP_EDGE_RADIUS_PX,
  SNAP_MIDPOINT_RADIUS_PX,
  TAPE_MEASURE_RENDER_ORDER,
  TapeMeasure3dService,
  ViewportRect,
  configureMeasureOverlayMaterial,
  extractStruckFaceFeatures,
  isClickWithinThreshold,
  pickClosestVisibleSurfaceHit
} from './tape-measure-3d.service';

const VIEWPORT: ViewportRect = {
  left: 0,
  top: 0,
  width: 1000,
  height: 800
};

function makeCamera(
  pos: [number, number, number] = [0, 0, 1500],
  lookAt: [number, number, number] = [0, 0, 0]
): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(45, VIEWPORT.width / VIEWPORT.height, 1, 20000);
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.lookAt(lookAt[0], lookAt[1], lookAt[2]);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function projectToClient(
  worldPt: THREE.Vector3,
  camera: THREE.Camera,
  rect: ViewportRect = VIEWPORT
): { x: number; y: number } {
  camera.updateMatrixWorld();
  const ndc = worldPt.clone().project(camera);
  return {
    x: rect.left + ((ndc.x + 1) * 0.5) * rect.width,
    y: rect.top + ((-ndc.y + 1) * 0.5) * rect.height
  };
}

function makeSolidBox(
  w: number,
  h: number,
  d: number,
  pos: [number, number, number],
  userData: Record<string, unknown> = {},
  color = 0xd4d4d8
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.userData = userData;
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('TapeMeasure3dService (Motor Matemático Cinta Métrica 3D CAD)', () => {
  let service: TapeMeasure3dService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TapeMeasure3dService]
    });
    service = TestBed.inject(TapeMeasure3dService);
  });

  describe('1. Constantes y Umbral Clic vs Arrastre (<= 5 px)', () => {
    it('debe exportar constantes CAD y colores oficiales exactos', () => {
      expect(TAPE_MEASURE_RENDER_ORDER).toBe(995);
      expect(CLICK_DRAG_THRESHOLD_PX).toBe(5);
      expect(SNAP_CORNER_RADIUS_PX).toBe(10);
      expect(SNAP_MIDPOINT_RADIUS_PX).toBe(10);
      expect(SNAP_EDGE_RADIUS_PX).toBe(12);
      expect(AXIS_LOCK_THRESHOLD_PX).toBe(15);
      expect(AXIS_LOCK_THRESHOLD_MM).toBe(25);
      expect(AXIS_COLORS).toEqual({
        x: 0xef4444,
        y: 0x10b981,
        z: 0x0284c7,
        direct: 0xd97706
      });
      expect(AXIS_CSS_COLORS).toEqual({
        x: '#EF4444',
        y: '#10B981',
        z: '#0284C7',
        direct: '#D97706'
      });
    });

    it('isClickWithinThreshold debe aceptar <= 5px y rechazar 5.1px o arrastres', () => {
      expect(service.isClickWithinThreshold(200, 200, 200, 200)).toBe(true);
      expect(service.isClickWithinThreshold(200, 200, 203, 204)).toBe(true); // 3-4-5 exacto
      expect(service.isClickWithinThreshold(200, 200, 205, 200)).toBe(true);
      expect(service.isClickWithinThreshold(200, 200, 205.1, 200)).toBe(false);
      expect(isClickWithinThreshold(100, 100, 104, 103.1)).toBe(false);
      expect(isClickWithinThreshold(Number.NaN, 0, 0, 0)).toBe(false);
    });
  });

  describe('2. Raycasting estricto sobre superficie visible más cercana (hits[0])', () => {
    it('debe retornar estrictamente hits[0] e ignorar helpers, líneas, sprites, gizmos y mallas ocultas', () => {
      const root = new THREE.Group();

      const frontBoard = makeSolidBox(
        400,
        400,
        18,
        [0, 0, 100],
        { part: { id: 'p-front', name: 'Puerta Frontal' } }
      );
      const backBoard = makeSolidBox(
        800,
        800,
        18,
        [0, 0, -100],
        { part: { id: 'p-back', name: 'Fondo Trasero' } }
      );

      // Objetos auxiliares delante de todo (más cerca de la cámara) que DEBEN ser ignorados
      const hiddenParent = new THREE.Group();
      hiddenParent.visible = false;
      const hiddenMesh = makeSolidBox(500, 500, 18, [0, 0, 300], {
        part: { id: 'p-hidden', name: 'Oculto' }
      });
      hiddenParent.add(hiddenMesh);

      const hitboxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(500, 500, 18),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      );
      hitboxMesh.position.set(0, 0, 350);
      hitboxMesh.name = 'raycast_hitbox';

      const helperFlagMesh = makeSolidBox(500, 500, 18, [0, 0, 360], { isHelper: true });
      const gizmoMesh = makeSolidBox(500, 500, 18, [0, 0, 370], { isGizmo: true });
      const wallGizmoMesh = makeSolidBox(500, 500, 18, [0, 0, 380], { isWallGizmo: true });
      const appGizmoMesh = makeSolidBox(500, 500, 18, [0, 0, 390], { isApplianceGizmo: true });
      const cotaMesh = makeSolidBox(500, 500, 18, [0, 0, 400], { isCota: true });
      const measureMesh = makeSolidBox(500, 500, 18, [0, 0, 410], { isMeasurementVisual: true });
      const auxMesh = makeSolidBox(500, 500, 18, [0, 0, 420], { isAuxiliaryVisual: true });

      const boxHelper = new THREE.BoxHelper(frontBoard, 0x0284c7);
      const lineSegs = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(500, 500, 50)),
        new THREE.LineBasicMaterial({ color: 0x000000 })
      );
      lineSegs.position.set(0, 0, 430);
      const lineObj = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-100, 0, 440),
          new THREE.Vector3(100, 0, 440)
        ]),
        new THREE.LineBasicMaterial({ color: 0x000000 })
      );
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
      sprite.position.set(0, 0, 450);
      sprite.scale.set(400, 400, 1);

      root.add(
        backBoard,
        frontBoard,
        hiddenParent,
        hitboxMesh,
        helperFlagMesh,
        gizmoMesh,
        wallGizmoMesh,
        appGizmoMesh,
        cotaMesh,
        measureMesh,
        auxMesh,
        boxHelper,
        lineSegs,
        lineObj,
        sprite
      );

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 0, 1200),
        new THREE.Vector3(0, 0, -1),
        1,
        5000
      );

      const hit = service.pickClosestVisibleSurfaceHit(raycaster, [root]);
      expect(hit).not.toBeNull();
      expect(hit?.object).toBe(frontBoard);
      expect(hit?.objectName).toBe('Puerta Frontal');
      expect(hit?.point.z).toBeCloseTo(109, 3);
    });

    it('debe resolver nombres de electrodoméstico (en grupo padre), muro, piso y excluir hiddenPartIds', () => {
      const appGroup = new THREE.Group();
      appGroup.userData = {
        appliance: { id: 'app-1', name: 'Horno Empotrable', type: 'oven' },
        applianceId: 'app-1'
      };
      const appBody = makeSolidBox(595, 595, 550, [0, 300, 0], {
        isAppliance: true,
        applianceId: 'app-1'
      });
      appGroup.add(appBody);

      const wallMesh = makeSolidBox(2000, 2400, 150, [0, 1200, -500], { isWall: true });
      const floorMesh = makeSolidBox(4000, 10, 4000, [0, -5, 0], { isFloor: true });

      const hiddenPart = makeSolidBox(400, 400, 18, [0, 300, 400], {
        part: { id: 'part-hidden', name: 'Oculta por Filtro' }
      });

      const rayApp = new THREE.Raycaster(
        new THREE.Vector3(0, 300, 1200),
        new THREE.Vector3(0, 0, -1)
      );
      const hitApp = pickClosestVisibleSurfaceHit(rayApp, [appGroup, wallMesh, hiddenPart], {
        hiddenPartIds: new Set(['part-hidden'])
      });
      expect(hitApp?.objectName).toBe('Horno Empotrable');

      const rayWall = new THREE.Raycaster(
        new THREE.Vector3(0, 1200, 1000),
        new THREE.Vector3(0, 0, -1)
      );
      expect(pickClosestVisibleSurfaceHit(rayWall, [wallMesh])?.objectName).toBe('Muro');

      const rayFloor = new THREE.Raycaster(
        new THREE.Vector3(0, 500, 0),
        new THREE.Vector3(0, -1, 0)
      );
      expect(pickClosestVisibleSurfaceHit(rayFloor, [floorMesh])?.objectName).toBe('Piso');
    });
  });

  describe('3. Extracción exclusiva de esquinas y aristas de la cara impactada', () => {
    it('debe eliminar la diagonal interna de una caja y excluir las 4 esquinas traseras', () => {
      const board = makeSolidBox(800, 600, 18, [0, 300, 0]);
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 300, 1000),
        new THREE.Vector3(0, 0, -1)
      );
      const hit = service.pickClosestVisibleSurfaceHit(raycaster, [board]);
      expect(hit).not.toBeNull();

      const features = extractStruckFaceFeatures(hit!);
      expect(features).not.toBeNull();
      expect(features!.isFallbackObb).toBe(false);
      expect(features!.corners.length).toBe(4);
      expect(features!.edges.length).toBe(4);

      // Todas las esquinas y aristas deben estar únicamente en la cara frontal (Z = +9)
      for (const c of features!.corners) {
        expect(c.z).toBeCloseTo(9, 4);
      }
      for (const edge of features!.edges) {
        expect(edge.p1.z).toBeCloseTo(9, 4);
        expect(edge.p2.z).toBeCloseTo(9, 4);
        // Ninguna arista diagonal (longitud ~1000mm); solo 800mm o 600mm
        const len = Math.round(edge.length);
        expect(len === 800 || len === 600).toBe(true);
      }
    });

    it('debe fusionar aristas colineales contiguas en mallas subdivididas o extruidas', () => {
      const subdividedGeo = new THREE.BoxGeometry(800, 400, 18, 4, 2, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(subdividedGeo, mat);
      mesh.rotation.y = THREE.MathUtils.degToRad(30);
      mesh.position.set(100, 200, 0);
      mesh.updateMatrixWorld(true);

      const worldNormal = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(30))
        .normalize();
      const rayOrigin = mesh.position.clone().addScaledVector(worldNormal, 800);
      const raycaster = new THREE.Raycaster(rayOrigin, worldNormal.clone().negate());

      const hit = service.pickClosestVisibleSurfaceHit(raycaster, [mesh]);
      expect(hit).not.toBeNull();

      const features = service.extractStruckFaceFeatures(hit!);
      expect(features).not.toBeNull();
      // Aunque el frente tiene 4x2 = 8 quads (16 triángulos), el perímetro fusionado tiene 4 esquinas y 4 aristas
      expect(features!.corners.length).toBe(4);
      expect(features!.edges.length).toBe(4);
    });

    it('debe extraer contorno exterior + agujero interior en mesón extruido (ExtrudeGeometry) suprimiendo diagonales', () => {
      // Mesón rectangular de 1200x600 con calado rectangular central de 400x300
      const outer = new THREE.Shape([
        new THREE.Vector2(-600, -300),
        new THREE.Vector2(600, -300),
        new THREE.Vector2(600, 300),
        new THREE.Vector2(-600, 300)
      ]);
      const hole = new THREE.Path([
        new THREE.Vector2(-200, -150),
        new THREE.Vector2(-200, 150),
        new THREE.Vector2(200, 150),
        new THREE.Vector2(200, -150)
      ]);
      outer.holes.push(hole);

      const extrudeGeo = new THREE.ExtrudeGeometry(outer, { depth: 30, bevelEnabled: false });
      extrudeGeo.rotateX(Math.PI / 2); // Cara superior en Y = 0
      const mesh = new THREE.Mesh(extrudeGeo, new THREE.MeshStandardMaterial({ color: 0xe4e4e7 }));
      mesh.position.set(0, 850, 0);
      mesh.updateMatrixWorld(true);

      // Rayo golpeando la zona sólida del mesón entre borde exterior y hueco (x = 400, z = 0)
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(400, 1500, 0),
        new THREE.Vector3(0, -1, 0)
      );
      const hit = service.pickClosestVisibleSurfaceHit(raycaster, [mesh]);
      expect(hit).not.toBeNull();

      const features = service.extractStruckFaceFeatures(hit!);
      expect(features).not.toBeNull();
      expect(features!.isFallbackObb).toBe(false);
      // 4 esquinas del perímetro exterior + 4 esquinas del calado interior = 8 esquinas y 8 aristas (0 diagonales)
      expect(features!.corners.length).toBe(8);
      expect(features!.edges.length).toBe(8);
      for (const c of features!.corners) {
        expect(c.y).toBeCloseTo(850, 2);
      }
    });

    it('debe usar OBB local de la cara impactada para mallas GLB high-poly (> 600 triángulos)', () => {
      const highPolyGeo = new THREE.SphereGeometry(200, 24, 24); // 24*24*2 = 1152 triángulos (> 600)
      const mesh = new THREE.Mesh(highPolyGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
      mesh.position.set(0, 200, 0);
      mesh.updateMatrixWorld(true);

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 200, 1000),
        new THREE.Vector3(0, 0, -1)
      );
      const hit = service.pickClosestVisibleSurfaceHit(raycaster, [mesh]);
      expect(hit).not.toBeNull();

      const features = service.extractStruckFaceFeatures(hit!);
      expect(features).not.toBeNull();
      expect(features!.isFallbackObb).toBe(true);
      expect(features!.corners.length).toBe(4);
      expect(features!.edges.length).toBe(4);
      for (const c of features!.corners) {
        expect(c.z).toBeCloseTo(200, 1);
      }
    });
  });

  describe('4. Oclusión frontal vs trasera + Jerarquía de Snapping en Pantalla + Supresión de diagonal', () => {
    it('NUNCA debe enganchar a esquina trasera o mueble oculto detrás aunque esté a <= 2px en 2D', () => {
      const camera = makeCamera([0, 300, 1500], [0, 300, 0]);

      // Panel frontal ancho cubriendo el centro: Z = +100..+118, X = [-400..400], Y = [0..600]
      const frontPanel = makeSolidBox(
        800,
        600,
        18,
        [0, 300, 109],
        { part: { id: 'front-panel', name: 'Lateral Frontal' } }
      );

      // Mueble trasero oculto detrás del panel frontal: una de sus esquinas (0, 300, -100) cae justo detrás del centro
      const hiddenRearFurniture = makeSolidBox(
        400,
        400,
        18,
        [200, 100, -109],
        { part: { id: 'rear-panel', name: 'Mueble Oculto Atrás' } }
      );

      // Proyectar la esquina superior-izquierda del mueble trasero (0, 300, -100) en pantalla
      const rearCorner = new THREE.Vector3(0, 300, -100);
      const rearScreen = projectToClient(rearCorner, camera);

      // Mover el cursor apenas 1 px al lado de la proyección 2D de esa esquina oculta
      const candidate = service.findClosestVisibleSnapCandidate(
        rearScreen.x + 1,
        rearScreen.y + 1,
        VIEWPORT,
        camera,
        [hiddenRearFurniture, frontPanel]
      );

      expect(candidate).not.toBeNull();
      // Debe impactar el panel frontal en su cara, JAMÁS enganchar la esquina trasera oculta
      expect(candidate!.objectName).toBe('Lateral Frontal');
      expect(candidate!.type).toBe('face');
      expect(candidate!.worldPos.z).toBeCloseTo(118, 2);
    });

    it('debe suprimir diagonales internas: el centro de una cara rectangular devuelve "face" y NO "edge"', () => {
      const camera = makeCamera([0, 300, 1500], [0, 300, 0]);
      const board = makeSolidBox(
        800,
        600,
        18,
        [0, 300, 0],
        { part: { id: 'board-1', name: 'Tablero Central' } }
      );

      // El centro exacto (0, 300, 9) atraviesa la diagonal del BoxGeometry
      const centerScreen = projectToClient(new THREE.Vector3(0, 300, 9), camera);
      const candidate = service.findClosestVisibleSnapCandidate(
        centerScreen.x,
        centerScreen.y,
        VIEWPORT,
        camera,
        [board]
      );

      expect(candidate).not.toBeNull();
      expect(candidate!.type).toBe('face');
      expect(candidate!.label).toBe('En cara');
      expect(candidate!.colorCss).toBe('#0284C7');
    });

    it('debe respetar exactamente radios en pantalla: <=10px esquina, <=10px punto medio, <=12px arista continua sin salto a esquina, >12px cara', () => {
      const camera = makeCamera([0, 300, 1500], [0, 300, 0]);
      const board = makeSolidBox(
        800,
        600,
        18,
        [0, 300, 0],
        { part: { id: 'board-snap', name: 'Tapa Superior' } }
      );

      const topLeftCorner = new THREE.Vector3(-400, 600, 9);
      const topMidpoint = new THREE.Vector3(0, 600, 9);
      const topSlidePoint = new THREE.Vector3(-180, 600, 9);

      const cornerPx = projectToClient(topLeftCorner, camera);
      const midpointPx = projectToClient(topMidpoint, camera);
      const slidePx = projectToClient(topSlidePoint, camera);

      // 1. Esquina (6px dentro de la cara hacia adentro para que el rayo golpee la malla, <= 10px de la esquina)
      const cornerCand = service.findClosestVisibleSnapCandidate(
        cornerPx.x + 6,
        cornerPx.y + 6, // hypot(6, 6) = 8.48px <= 10px
        VIEWPORT,
        camera,
        [board]
      );
      expect(cornerCand).not.toBeNull();
      expect(cornerCand!.type).toBe('corner');
      expect(cornerCand!.label).toBe('Esquina');
      expect(cornerCand!.colorCss).toBe('#10B981');
      expect(cornerCand!.worldPos.distanceTo(topLeftCorner)).toBeLessThan(1e-3);

      // 2. Punto medio (7px hacia abajo del punto medio superior, <= 10px)
      const midCand = service.findClosestVisibleSnapCandidate(
        midpointPx.x,
        midpointPx.y + 7,
        VIEWPORT,
        camera,
        [board]
      );
      expect(midCand).not.toBeNull();
      expect(midCand!.type).toBe('midpoint');
      expect(midCand!.label).toBe('Punto medio');
      expect(midCand!.colorCss).toBe('#0284C7');
      expect(midCand!.worldPos.distanceTo(topMidpoint)).toBeLessThan(1e-3);

      // 3. Deslizamiento continuo en arista a 11px de la esquina y 3px debajo de la arista superior (sin saltar a la esquina!)
      const edgeNearCornerCand = service.findClosestVisibleSnapCandidate(
        cornerPx.x + 11,
        cornerPx.y + 3,
        VIEWPORT,
        camera,
        [board]
      );
      expect(edgeNearCornerCand).not.toBeNull();
      expect(edgeNearCornerCand!.type).toBe('edge');
      expect(edgeNearCornerCand!.label).toBe('En arista');
      expect(edgeNearCornerCand!.colorCss).toBe('#D97706');
      expect(edgeNearCornerCand!.worldPos.distanceTo(topLeftCorner)).toBeGreaterThan(5);
      expect(edgeNearCornerCand!.worldPos.y).toBeCloseTo(600, 1);

      // 4. Deslizamiento continuo en tramo intermedio de la arista (8px debajo, <= 12px)
      const edgeSlideCand = service.findClosestVisibleSnapCandidate(
        slidePx.x,
        slidePx.y + 8,
        VIEWPORT,
        camera,
        [board]
      );
      expect(edgeSlideCand).not.toBeNull();
      expect(edgeSlideCand!.type).toBe('edge');
      expect(edgeSlideCand!.worldPos.x).toBeCloseTo(-180, 0);
      expect(edgeSlideCand!.worldPos.y).toBeCloseTo(600, 1);

      // 5. Cara (> 12px desde el borde hacia el interior)
      const faceCand = service.findClosestVisibleSnapCandidate(
        slidePx.x,
        slidePx.y + 15,
        VIEWPORT,
        camera,
        [board]
      );
      expect(faceCand).not.toBeNull();
      expect(faceCand!.type).toBe('face');
      expect(faceCand!.label).toBe('En cara');
      expect(faceCand!.colorCss).toBe('#0284C7');
    });

    it('debe respetar viewports desplazados (left/top != 0) y piezas rotadas 45 grados', () => {
      const offsetRect: ViewportRect = { left: 280, top: 72, width: 1000, height: 800 };
      const camera = makeCamera([0, 300, 1600], [0, 300, 0]);
      const board = makeSolidBox(
        600,
        400,
        18,
        [0, 300, 0],
        { part: { id: 'rot-board', name: 'Puerta 45°' } }
      );
      board.rotation.y = THREE.MathUtils.degToRad(45);
      board.updateMatrixWorld(true);

      // Esquina superior derecha de la cara frontal (+Z local) en mundo
      const localCorner = new THREE.Vector3(300, 200, 9);
      const worldCorner = localCorner.clone().applyMatrix4(board.matrixWorld);
      const clientCorner = projectToClient(worldCorner, camera, offsetRect);

      // Desplazar cursor ligeramente hacia el interior de la cara para garantizar impacto en malla
      const centerWorld = new THREE.Vector3(0, 0, 9).applyMatrix4(board.matrixWorld);
      const clientCenter = projectToClient(centerWorld, camera, offsetRect);
      const inwardDir = new THREE.Vector2(
        clientCenter.x - clientCorner.x,
        clientCenter.y - clientCorner.y
      ).normalize();

      const cand = service.findClosestVisibleSnapCandidate(
        clientCorner.x + inwardDir.x * 5,
        clientCorner.y + inwardDir.y * 5,
        offsetRect,
        camera,
        [board]
      );

      expect(cand).not.toBeNull();
      expect(cand!.type).toBe('corner');
      expect(cand!.objectName).toBe('Puerta 45°');
      expect(cand!.worldPos.distanceTo(worldCorner)).toBeLessThan(1e-2);
    });

    it('debe enganchar directamente sobre esquinas, puntos medios y aristas en el límite exacto de la silueta aunque el rayo central falle', () => {
      const camera = makeCamera([0, 450, 1800], [0, 300, 0]);
      const board = makeSolidBox(
        800,
        600,
        20,
        [0, 300, 0],
        { part: { id: 'sil-board', name: 'Lateral Silueta' } }
      );

      const topLeftCorner = new THREE.Vector3(-400, 600, 10);
      const topRightCorner = new THREE.Vector3(400, 600, 10);
      const topMidpoint = new THREE.Vector3(0, 600, 10);
      const topSlidePt = new THREE.Vector3(-200, 600, 10);
      const leftMidpoint = new THREE.Vector3(-400, 300, 10);

      const topLeftPx = projectToClient(topLeftCorner, camera);
      const topRightPx = projectToClient(topRightCorner, camera);
      const topMidPx = projectToClient(topMidpoint, camera);
      const topSlidePx = projectToClient(topSlidePt, camera);
      const leftMidPx = projectToClient(leftMidpoint, camera);

      const cLeft = service.findClosestVisibleSnapCandidate(
        topLeftPx.x,
        topLeftPx.y,
        VIEWPORT,
        camera,
        [board]
      );
      expect(cLeft).not.toBeNull();
      expect(cLeft!.type).toBe('corner');
      expect(cLeft!.worldPos.distanceTo(topLeftCorner)).toBeLessThan(1e-2);

      const cRight = service.findClosestVisibleSnapCandidate(
        topRightPx.x,
        topRightPx.y,
        VIEWPORT,
        camera,
        [board]
      );
      expect(cRight).not.toBeNull();
      expect(cRight!.type).toBe('corner');
      expect(cRight!.worldPos.distanceTo(topRightCorner)).toBeLessThan(1e-2);

      const cTopMid = service.findClosestVisibleSnapCandidate(
        topMidPx.x,
        topMidPx.y,
        VIEWPORT,
        camera,
        [board]
      );
      expect(cTopMid).not.toBeNull();
      expect(cTopMid!.type).toBe('midpoint');
      expect(cTopMid!.worldPos.distanceTo(topMidpoint)).toBeLessThan(1e-2);

      const cTopEdge = service.findClosestVisibleSnapCandidate(
        topSlidePx.x,
        topSlidePx.y,
        VIEWPORT,
        camera,
        [board]
      );
      expect(cTopEdge).not.toBeNull();
      expect(cTopEdge!.type).toBe('edge');
      expect(cTopEdge!.worldPos.distanceTo(topSlidePt)).toBeLessThan(1.5);

      const cLeftMid = service.findClosestVisibleSnapCandidate(
        leftMidPx.x,
        leftMidPx.y,
        VIEWPORT,
        camera,
        [board]
      );
      expect(cLeftMid).not.toBeNull();
      expect(cLeftMid!.type).toBe('midpoint');
      expect(cLeftMid!.worldPos.distanceTo(leftMidpoint)).toBeLessThan(1e-2);
    });

    it('debe enganchar dentro del halo magnético exterior <= 10px/12px de silueta y retornar null > 12px (jamás "face")', () => {
      const camera = makeCamera([0, 450, 1800], [0, 300, 0]);
      const board = makeSolidBox(
        800,
        600,
        20,
        [0, 300, 0],
        { part: { id: 'halo-board', name: 'Puerta Halo' } }
      );

      const topLeftCorner = new THREE.Vector3(-400, 600, 10);
      const topSlidePt = new THREE.Vector3(-180, 600, 10);
      const cornerPx = projectToClient(topLeftCorner, camera);
      const slidePx = projectToClient(topSlidePt, camera);

      // 5px izquierda y 5px arriba fuera de la esquina en espacio vacío (hypot ~ 7.07px <= 10px)
      const nearCornerOutside = service.findClosestVisibleSnapCandidate(
        cornerPx.x - 5,
        cornerPx.y - 5,
        VIEWPORT,
        camera,
        [board]
      );
      expect(nearCornerOutside).not.toBeNull();
      expect(nearCornerOutside!.type).toBe('corner');
      expect(nearCornerOutside!.label).toBe('Esquina');
      expect(nearCornerOutside!.worldPos.distanceTo(topLeftCorner)).toBeLessThan(1e-2);

      // 6px arriba fuera de la arista superior en espacio vacío (<= 12px)
      const nearEdgeOutside = service.findClosestVisibleSnapCandidate(
        slidePx.x,
        slidePx.y - 6,
        VIEWPORT,
        camera,
        [board]
      );
      expect(nearEdgeOutside).not.toBeNull();
      expect(nearEdgeOutside!.type).toBe('edge');
      expect(nearEdgeOutside!.worldPos.x).toBeCloseTo(-180, 0);
      expect(nearEdgeOutside!.worldPos.y).toBeCloseTo(600, 1);

      // > 12px fuera de la esquina y fuera de la arista: el rayo central falla y NO debe emitir 'face'
      expect(
        service.findClosestVisibleSnapCandidate(
          cornerPx.x - 10,
          cornerPx.y - 10, // hypot ~ 14.14px > 12px
          VIEWPORT,
          camera,
          [board]
        )
      ).toBeNull();

      expect(
        service.findClosestVisibleSnapCandidate(
          slidePx.x,
          slidePx.y - 13, // 13px > 12px
          VIEWPORT,
          camera,
          [board]
        )
      ).toBeNull();
    });

    it('debe bloquear esquinas ocultas de un panel trasero cuando el sondeo roza la silueta del panel frontal', () => {
      const camera = makeCamera([0, 300, 1500], [0, 300, 0]);

      // Panel frontal en Z = [90..110], X = [-400..400], Y = [0..600]
      const frontPanel = makeSolidBox(
        800,
        600,
        20,
        [0, 300, 100],
        { part: { id: 'sil-front', name: 'Panel Frontal' } }
      );

      // Panel trasero en Z = [-110..-90]: su esquina superior izquierda (438, 639, -90) cae ~2.5px por debajo
      // del borde superior frontal y ~11px a la izquierda de la esquina frontal derecha (oculta detrás del panel frontal),
      // mientras su extremo derecho (x = 600) sobresale por la derecha y entra al radio del sondeo exterior.
      const rearPanel = makeSolidBox(
        162,
        440,
        20,
        [519, 419, -100],
        { part: { id: 'sil-rear', name: 'Panel Trasero Oculto' } }
      );

      // Cursor 3px por encima de la arista superior del panel frontal cerca de X_front = 385:
      // está a >10px de la esquina frontal (400,600,110), dentro de 10px de la esquina trasera oculta (438,639,-90),
      // y el micro-anillo de 12px alcanza el ala expuesta del panel trasero.
      const frontEdgeRef = projectToClient(new THREE.Vector3(385, 600, 110), camera);
      const candidate = service.findClosestVisibleSnapCandidate(
        frontEdgeRef.x,
        frontEdgeRef.y - 3,
        VIEWPORT,
        camera,
        [rearPanel, frontPanel]
      );

      expect(candidate).not.toBeNull();
      expect(candidate!.objectName).toBe('Panel Frontal');
      expect(candidate!.type).toBe('edge');
      expect(candidate!.worldPos.z).toBeCloseTo(110, 1);
    });
  });

  describe('5. Proyección Perpendicular Automática (25mm, 15px, Shift y Modos explícitos)', () => {
    it('debe bloquear ejes X/Y/Z automáticamente cuando la desviación lateral es <= 25 mm', () => {
      const pointA = { x: 100, y: 200, z: 50 };

      const resX = service.resolvePerpendicularPointB(pointA, { x: 650, y: 218, z: 42 });
      expect(resX.axisLock).toBe('x');
      expect(resX.pointB).toEqual({ x: 650, y: 200, z: 50 });

      const resY = service.resolvePerpendicularPointB(pointA, { x: 112, y: 820, z: 60 });
      expect(resY.axisLock).toBe('y');
      expect(resY.pointB).toEqual({ x: 100, y: 820, z: 50 });

      const resZ = service.resolvePerpendicularPointB(pointA, { x: 85, y: 210, z: 450 });
      expect(resZ.axisLock).toBe('z');
      expect(resZ.pointB).toEqual({ x: 100, y: 200, z: 450 });

      // Si supera 25mm sin cámara ni Shift -> cota libre directa (sin bloqueo)
      const resDirect = service.resolvePerpendicularPointB(pointA, { x: 650, y: 240, z: 50 });
      expect(resDirect.axisLock).toBeNull();
      expect(resDirect.pointB).toEqual({ x: 650, y: 240, z: 50 });
    });

    it('debe bloquear al eje proyectado en pantalla cuando la distancia perpendicular es <= 15 px aunque > 25 mm', () => {
      // Cámara lejana (~4000mm) para que 45mm equivalgan a ~12px (< 15px) pero > 25mm
      const camera = makeCamera([0, 300, 4000], [0, 300, 0]);
      const pointA = { x: -300, y: 300, z: 0 };
      const rawPoint = { x: 300, y: 345, z: 0 }; // desviación Y = 45mm (> 25mm), pero ~12px en pantalla

      const result = service.resolvePerpendicularPointB(pointA, rawPoint, {
        camera,
        viewportRect: VIEWPORT
      });

      expect(result.axisLock).toBe('x');
      expect(result.pointB).toEqual({ x: 300, y: 300, z: 0 });
    });

    it('debe bloquear al eje dominante cuando shiftPressed = true y respetar modos forzados', () => {
      const pointA = { x: 0, y: 100, z: 0 };
      const raw = { x: 200, y: 550, z: 120 };

      const shiftRes = service.resolvePerpendicularPointB(pointA, raw, { shiftPressed: true });
      expect(shiftRes.axisLock).toBe('y');
      expect(shiftRes.pointB).toEqual({ x: 0, y: 550, z: 0 });

      const forcedZ = service.resolvePerpendicularPointB(pointA, raw, { mode: 'z' });
      expect(forcedZ.axisLock).toBe('z');
      expect(forcedZ.pointB).toEqual({ x: 0, y: 100, z: 120 });
    });
  });

  describe('6. Helpers: buildSavedMeasurement, proyección 3D->2D 360° y material overlay 995', () => {
    it('buildSavedMeasurement debe calcular distancia, deltas por eje y conservar axisLock', () => {
      const m = service.buildSavedMeasurement(
        { x: 10, y: 20, z: 30 },
        { x: 410.4, y: 20, z: 30 },
        'x',
        'm-test-1'
      );

      expect(m).toEqual({
        id: 'm-test-1',
        pointA: { x: 10, y: 20, z: 30 },
        pointB: { x: 410.4, y: 20, z: 30 },
        distanceMm: 400.4,
        deltaX: 400.4,
        deltaY: 0,
        deltaZ: 0,
        axisLock: 'x'
      });
    });

    it('buildProjectedBadges debe proyectar con precisión a 360° y ocultar etiquetas detrás de cámara', () => {
      const mX = service.buildSavedMeasurement(
        { x: -200, y: 300, z: 0 },
        { x: 200, y: 300, z: 0 },
        'x',
        'm-x'
      );
      const mDirect = service.buildSavedMeasurement(
        { x: 0, y: 0, z: 0 },
        { x: 300, y: 400, z: 0 },
        null,
        'm-d'
      );

      const frontCam = makeCamera([0, 300, 1500], [0, 300, 0]);
      const badgesFront = service.buildProjectedBadges([mX, mDirect], frontCam, 1000, 800);
      expect(badgesFront.length).toBe(2);
      expect(badgesFront[0].visible).toBe(true);
      expect(badgesFront[0].x).toBeCloseTo(500, 1);
      expect(badgesFront[0].y).toBeCloseTo(400, 1);
      expect(badgesFront[0].colorCss).toBe('#EF4444');
      expect(badgesFront[0].formattedDistance).toBe('400 mm');
      expect(badgesFront[1].colorCss).toBe('#D97706');
      expect(badgesFront[1].formattedDistance).toBe('500 mm');

      // Rotación lateral 90°: el punto medio (0, 300, 0) sigue en el centro mirando al origen
      const sideCam = makeCamera([1500, 300, 0], [0, 300, 0]);
      const badgesSide = service.buildProjectedBadges([mX], sideCam, 1000, 800);
      expect(badgesSide[0].visible).toBe(true);
      expect(badgesSide[0].x).toBeCloseTo(500, 1);

      // Cámara mirando en dirección opuesta (medición detrás de la cámara) -> visible: false
      const awayCam = makeCamera([0, 300, 1500], [0, 300, 3000]);
      const badgesBehind = service.buildProjectedBadges([mX], awayCam, 1000, 800);
      expect(badgesBehind[0].visible).toBe(false);
    });

    it('configureMeasureOverlayMaterial debe desactivar depthTest/depthWrite y retornar renderOrder 995', () => {
      const mat = new THREE.LineBasicMaterial({ color: 0xef4444 });
      mat.depthTest = true;
      mat.depthWrite = true;
      const initialVer = mat.version;

      const order = configureMeasureOverlayMaterial(mat);
      expect(order).toBe(995);
      expect(mat.depthTest).toBe(false);
      expect(mat.depthWrite).toBe(false);
      expect(mat.version).toBe(initialVer + 1);

      // Segunda invocación idempotente no incrementa mat.version innecesariamente
      const verAfter = mat.version;
      expect(service.configureMeasureOverlayMaterial(mat)).toBe(995);
      expect(mat.version).toBe(verAfter);
    });
  });
});
