import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { ApplianceItem, DrillHole, Part } from '../models/melamine.models';
import {
  SceneRaycastPickerService,
  SceneRaycastSources
} from './scene-raycast-picker.service';

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'part_1',
    name: 'Panel Melamina',
    length: 600,
    width: 600,
    thickness: 18,
    quantity: 1,
    materialId: 'mat_white',
    materialName: 'Blanco 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 300,
    posZ: 0,
    ...overrides
  };
}

function makeAppliance(overrides: Partial<ApplianceItem> = {}): ApplianceItem {
  return {
    id: 'fridge_1',
    type: 'refrigerator',
    name: 'Refrigerador',
    width: 900,
    depth: 700,
    height: 1800,
    finish: 'stainless_steel',
    position: { x: 0, y: 0, z: -500 },
    rotation: 0,
    mountType: 'floor',
    price: 2500000,
    includeInBudget: true,
    ...overrides
  };
}

function makeSolidBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color = 0xffffff
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function makeRay(
  origin: [number, number, number],
  target: [number, number, number]
): THREE.Raycaster {
  const originVec = new THREE.Vector3(...origin);
  const dirVec = new THREE.Vector3(...target).sub(originVec).normalize();
  return new THREE.Raycaster(originVec, dirVec, 0.1, 20000);
}

describe('SceneRaycastPickerService (Motor Unificado Closest-First 3D)', () => {
  let service: SceneRaycastPickerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SceneRaycastPickerService]
    });
    service = TestBed.inject(SceneRaycastPickerService);
  });

  describe('1. Ordenamiento estricto por distancia real (Closest-First)', () => {
    it('panel de melamina delante de un refrigerador SIEMPRE gana (panel.distance < fridge.distance), sin importar el orden', () => {
      const panelPart = makePart({ id: 'panel_front', name: 'Frente Melamina' });
      const fridgeApp = makeAppliance({ id: 'fridge_back', name: 'Nevera' });

      const scene = new THREE.Scene();

      // Electrodoméstico en Z = -400 (profundidad 700 -> cara frontal en Z = -50)
      const appliancesGroup = new THREE.Group();
      const fridgeGroup = new THREE.Group();
      fridgeGroup.position.set(0, 0, -400);
      fridgeGroup.userData = { isAppliance: true, applianceId: fridgeApp.id, appliance: fridgeApp };
      const fridgeBody = makeSolidBox(900, 1800, 700, 0, 900, 0, 0xcbd5e1);
      fridgeBody.userData = { isAppliance: true, applianceId: fridgeApp.id };
      fridgeGroup.add(fridgeBody);
      // Añadir primero el electrodoméstico a la escena
      appliancesGroup.add(fridgeGroup);
      scene.add(appliancesGroup);

      // Panel de melamina más cerca de la cámara, en Z = +200 (espesor 18 -> cara frontal en Z = +209)
      const panelMesh = makeSolidBox(500, 700, 18, 0, 900, 200, 0xffffff);
      panelMesh.userData = { part: panelPart, isPiece: true };
      scene.add(panelMesh);

      // Cámara en Z = +2000 apuntando hacia (0, 900, 0)
      const raycaster = makeRay([0, 900, 2000], [0, 900, 0]);

      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [panelMesh],
        appliancesRoot: appliancesGroup
      });

      expect(result.closest).not.toBeNull();
      expect(result.closest?.kind).toBe('piece');
      expect(result.closest?.part?.id).toBe('panel_front');
      expect(result.candidates.length).toBe(2);
      expect(result.candidates[0].kind).toBe('piece');
      expect(result.candidates[1].kind).toBe('appliance');
      expect(result.candidates[1].appliance?.id).toBe('fridge_back');
      expect(result.candidates[0].distance).toBeLessThan(result.candidates[1].distance);
    });

    it('al hacer clic en una porción descubierta del refrigerador selecciona el refrigerador', () => {
      const panelPart = makePart({ id: 'panel_narrow' });
      const fridgeApp = makeAppliance({ id: 'fridge_wide' });

      const panelMesh = makeSolidBox(300, 600, 18, 0, 900, 200);
      panelMesh.userData = { part: panelPart, isPiece: true };

      const appliancesGroup = new THREE.Group();
      const fridgeGroup = new THREE.Group();
      fridgeGroup.position.set(0, 0, -400);
      fridgeGroup.userData = { isAppliance: true, applianceId: fridgeApp.id, appliance: fridgeApp };
      const fridgeBody = makeSolidBox(1000, 1800, 700, 0, 900, 0);
      fridgeGroup.add(fridgeBody);
      appliancesGroup.add(fridgeGroup);

      // Rayo en X = 350 (fuera del panel de ancho 300 [-150..+150], dentro del refrigerador [-500..+500])
      const raycaster = makeRay([350, 900, 2000], [350, 900, -400]);

      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [panelMesh],
        appliancesRoot: appliancesGroup
      });

      expect(result.closest).not.toBeNull();
      expect(result.closest?.kind).toBe('appliance');
      expect(result.closest?.appliance?.id).toBe('fridge_wide');
    });

    it('ordena estrictamente por distancia muro detrás vs muro delante de panel y electrodoméstico', () => {
      const panelPart = makePart({ id: 'panel_mid' });
      const fridgeApp = makeAppliance({ id: 'fridge_back' });

      const panelMesh = makeSolidBox(600, 700, 18, 0, 900, 200);
      panelMesh.userData = { part: panelPart, isPiece: true };

      const appliancesGroup = new THREE.Group();
      const fridgeGroup = new THREE.Group();
      fridgeGroup.position.set(0, 0, -300);
      fridgeGroup.userData = { appliance: fridgeApp, applianceId: fridgeApp.id };
      fridgeGroup.add(makeSolidBox(800, 1800, 500, 0, 900, 0));
      appliancesGroup.add(fridgeGroup);

      // Caso A: Muro detrás en Z = -900
      const wallsGroupA = new THREE.Group();
      const backWall = makeSolidBox(4000, 2600, 150, 0, 1300, -900);
      backWall.userData = { isWall: true, wallId: 'wall_back' };
      wallsGroupA.add(backWall);

      const raycaster = makeRay([0, 900, 2000], [0, 900, -1000]);
      const resultA = service.pickClosestSceneCandidate(raycaster, {
        pieces: [panelMesh],
        appliancesRoot: appliancesGroup,
        wallsRoot: wallsGroupA
      });

      expect(resultA.candidates.map((c) => c.kind)).toEqual(['piece', 'appliance', 'wall']);
      expect(resultA.closest?.kind).toBe('piece');
      expect(resultA.candidates[0].distance).toBeLessThan(resultA.candidates[1].distance);
      expect(resultA.candidates[1].distance).toBeLessThan(resultA.candidates[2].distance);

      // Caso B: Muro delante en Z = +700 (entre cámara y panel)
      const wallsGroupB = new THREE.Group();
      const frontWall = makeSolidBox(4000, 2600, 150, 0, 1300, 700);
      frontWall.userData = { isWall: true, wallId: 'wall_front' };
      wallsGroupB.add(frontWall);

      const resultB = service.pickClosestSceneCandidate(raycaster, {
        pieces: [panelMesh],
        appliancesRoot: appliancesGroup,
        wallsRoot: wallsGroupB
      });

      expect(resultB.candidates.map((c) => c.kind)).toEqual(['wall', 'piece', 'appliance']);
      expect(resultB.closest?.kind).toBe('wall');
      expect(resultB.closest?.wallId).toBe('wall_front');
      expect(resultB.candidates[0].distance).toBeLessThan(resultB.candidates[1].distance);
      expect(resultB.candidates[1].distance).toBeLessThan(resultB.candidates[2].distance);
    });

    it('ignora el plano de piso (isFloor) dentro de wallsRoot para no seleccionarlo como muro', () => {
      const wallsGroup = new THREE.Group();
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(5000, 5000),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0, 0);
      floor.userData = { isFloor: true };
      wallsGroup.add(floor);

      const raycaster = makeRay([0, 1500, 1000], [0, 0, 0]);
      const result = service.pickClosestSceneCandidate(raycaster, {
        wallsRoot: wallsGroup
      });

      expect(result.closest).toBeNull();
      expect(result.candidates).toEqual([]);
    });
  });

  describe('2. Exclusión estricta de helpers auxiliares, ocultos y wireframes', () => {
    it('excluye Line, LineSegments, Points, Sprite, BoxHelper y Box3Helper incluso si están más cerca que una pieza', () => {
      const targetPart = makePart({ id: 'target_panel' });
      const targetMesh = makeSolidBox(600, 600, 18, 0, 500, -500);
      targetMesh.userData = { part: targetPart, isPiece: true };

      const helperGeo = new THREE.BoxGeometry(800, 800, 20);
      const edgesGeo = new THREE.EdgesGeometry(helperGeo);

      const line = new THREE.Line(edgesGeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
      line.position.set(0, 500, 500);

      const lineSegments = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x0284c7 }));
      lineSegments.position.set(0, 500, 450);

      const points = new THREE.Points(helperGeo, new THREE.PointsMaterial({ size: 10 }));
      points.position.set(0, 500, 400);

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
      sprite.position.set(0, 500, 350);
      sprite.scale.set(800, 800, 1);

      const helperTarget = makeSolidBox(800, 800, 20, 0, 500, 300);
      const boxHelper = new THREE.BoxHelper(helperTarget, 0x0284c7);
      const box3Helper = new THREE.Box3Helper(
        new THREE.Box3(new THREE.Vector3(-400, 100, 250), new THREE.Vector3(400, 900, 280)),
        0x0284c7
      );

      for (const helper of [line, lineSegments, points, sprite, boxHelper, box3Helper]) {
        expect(service.isSolidPickableMesh(helper)).toBe(false);
      }

      const raycaster = makeRay([0, 500, 2000], [0, 500, -500]);
      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [line, lineSegments, points, sprite, boxHelper, box3Helper, targetMesh]
      });

      expect(result.closest?.part?.id).toBe('target_panel');
      expect(result.candidates.length).toBe(1);
    });

    it('excluye objetos ocultos (visible=false), grupos padre ocultos, y respeta boundaryRoot', () => {
      const visiblePart = makePart({ id: 'visible_behind' });
      const visibleBehind = makeSolidBox(600, 600, 18, 0, 500, -400);
      visibleBehind.userData = { part: visiblePart };

      // Malla con visible=false delante
      const hiddenDirect = makeSolidBox(800, 800, 20, 0, 500, 300);
      hiddenDirect.visible = false;
      expect(service.isSolidPickableMesh(hiddenDirect)).toBe(false);

      // Malla visible dentro de un grupo padre oculto
      const hiddenParent = new THREE.Group();
      hiddenParent.visible = false;
      const childInHiddenGroup = makeSolidBox(800, 800, 20, 0, 500, 250);
      hiddenParent.add(childInHiddenGroup);
      expect(service.isSolidPickableMesh(childInHiddenGroup)).toBe(false);

      // boundaryRoot detiene la inspección en boundaryRoot (inclusive)
      const outerHidden = new THREE.Group();
      outerHidden.visible = false;
      const innerBoundary = new THREE.Group();
      innerBoundary.visible = true;
      const meshInsideBoundary = makeSolidBox(200, 200, 20, 0, 500, 100);
      innerBoundary.add(meshInsideBoundary);
      outerHidden.add(innerBoundary);
      expect(service.isSolidPickableMesh(meshInsideBoundary, innerBoundary)).toBe(true);
      expect(service.isSolidPickableMesh(meshInsideBoundary, outerHidden)).toBe(false);
      expect(service.isSolidPickableMesh(meshInsideBoundary)).toBe(false);

      const raycaster = makeRay([0, 500, 2000], [0, 500, -400]);
      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [hiddenDirect, hiddenParent, visibleBehind]
      });

      expect(result.closest?.part?.id).toBe('visible_behind');
      expect(result.candidates.length).toBe(1);
    });

    it('excluye materiales ocultos, wireframe o transparentes con opacity <= 0.001 (single Material y Material[])', () => {
      const solidBehind = makeSolidBox(600, 600, 18, 0, 500, -400);
      solidBehind.userData = { part: makePart({ id: 'solid_behind' }) };

      const wireframeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(800, 800, 20),
        new THREE.MeshBasicMaterial({ wireframe: true })
      );
      wireframeMesh.position.set(0, 500, 400);

      const hiddenMatMesh = new THREE.Mesh(
        new THREE.BoxGeometry(800, 800, 20),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hiddenMatMesh.position.set(0, 500, 350);

      const opacity0Mesh = new THREE.Mesh(
        new THREE.BoxGeometry(800, 800, 20),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      );
      opacity0Mesh.position.set(0, 500, 300);

      const multiHiddenArrayMesh = new THREE.Mesh(
        new THREE.BoxGeometry(800, 800, 20),
        [
          new THREE.MeshBasicMaterial({ visible: false }),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0005 }),
          new THREE.MeshBasicMaterial({ wireframe: true })
        ]
      );
      multiHiddenArrayMesh.position.set(0, 500, 250);

      expect(service.isSolidPickableMesh(wireframeMesh)).toBe(false);
      expect(service.isSolidPickableMesh(hiddenMatMesh)).toBe(false);
      expect(service.isSolidPickableMesh(opacity0Mesh)).toBe(false);
      expect(service.isSolidPickableMesh(multiHiddenArrayMesh)).toBe(false);

      const raycaster = makeRay([0, 500, 2000], [0, 500, -400]);
      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [wireframeMesh, hiddenMatMesh, opacity0Mesh, multiHiddenArrayMesh, solidBehind]
      });

      expect(result.closest?.part?.id).toBe('solid_behind');
      expect(result.candidates.length).toBe(1);
    });

    it('en mallas con Material[] mixto ignora caras con material invisible y selecciona caras con material sólido', () => {
      // BoxGeometry tiene 6 grupos: índice 4 es la cara frontal (+Z)
      const geo = new THREE.BoxGeometry(400, 400, 100);
      const hiddenFaceMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
      const solidFaceMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
      // Cara +Z (índice 4) transparente=0, cara -Z (índice 5) sólida
      const materials = [
        solidFaceMat,
        solidFaceMat,
        solidFaceMat,
        solidFaceMat,
        hiddenFaceMat,
        solidFaceMat
      ];
      const box = new THREE.Mesh(geo, materials);
      box.position.set(0, 500, 0);

      const raycaster = makeRay([0, 500, 1000], [0, 500, 0]);
      const hits = service.intersectPickableMeshes(raycaster, box, true);

      // Debe haber descartado el hit de la cara +Z (z=50, dist=950) y conservado la cara trasera sólida (z=-50, dist=1050)
      expect(hits.length).toBe(1);
      expect(hits[0].distance).toBeCloseTo(1050, 1);
    });

    it('excluye TODAS las etiquetas auxiliares de userData y name === "raycast_hitbox" (en malla o ancestro)', () => {
      const solidTarget = makeSolidBox(500, 500, 18, 0, 500, -600);
      solidTarget.userData = { part: makePart({ id: 'solid_target' }) };

      const excludedFlags = [
        'isBoxHelper',
        'isOutline',
        'isWireframe',
        'isFloorCircle',
        'isReferenceFloorCircle',
        'isShadow',
        'isFloorShadow',
        'isGrid',
        'isCota',
        'isDimensionBadge',
        'isMeasureVisual',
        'isSnapGuide',
        'isAuxiliaryVisual',
        'isApplianceHitBox'
      ];

      const auxiliaryObjects: THREE.Object3D[] = [];
      excludedFlags.forEach((flag, idx) => {
        // Etiqueta directa sobre la malla
        const directMesh = makeSolidBox(700, 700, 10, 0, 500, 500 - idx * 5);
        directMesh.userData = { [flag]: true };
        expect(service.isSolidPickableMesh(directMesh)).toBe(false);
        auxiliaryObjects.push(directMesh);

        // Etiqueta heredada desde un grupo ancestro
        const ancGroup = new THREE.Group();
        ancGroup.userData = { [flag]: true };
        const childMesh = makeSolidBox(700, 700, 10, 0, 500, 400 - idx * 5);
        ancGroup.add(childMesh);
        expect(service.isSolidPickableMesh(childMesh)).toBe(false);
        auxiliaryObjects.push(ancGroup);
      });

      const namedHitbox = makeSolidBox(700, 700, 10, 0, 500, 300);
      namedHitbox.name = 'raycast_hitbox';
      expect(service.isSolidPickableMesh(namedHitbox)).toBe(false);
      auxiliaryObjects.push(namedHitbox);

      const raycaster = makeRay([0, 500, 2000], [0, 500, -600]);
      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [...auxiliaryObjects, solidTarget]
      });

      expect(result.closest?.part?.id).toBe('solid_target');
      expect(result.candidates.length).toBe(1);
    });

    it('excluye el aro de suelo de la guía de referencia (isFloorCircle) pero permite seleccionar el maniquí sólido por distancia', () => {
      const panelMesh = makeSolidBox(600, 600, 18, 0, 500, 0);
      panelMesh.userData = { part: makePart({ id: 'panel_behind_ring' }) };

      const guideRoot = new THREE.Group();
      const figureGroup = new THREE.Group();
      figureGroup.position.set(0, 0, 400);

      // Aro de suelo muy grande cerca de la cámara
      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(195, 600, 36),
        new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide })
      );
      baseRing.position.set(0, 500, 200);
      baseRing.userData = {
        isReferenceGuide: true,
        isFloorCircle: true,
        isReferenceFloorCircle: true,
        isAuxiliaryVisual: true
      };
      figureGroup.add(baseRing);

      // Cuerpo del maniquí desplazado a la derecha (X = 500) para que no tape el centro
      const torso = makeSolidBox(260, 500, 140, 500, 500, 0);
      torso.userData = { isReferenceGuide: true };
      figureGroup.add(torso);
      guideRoot.add(figureGroup);

      // Clic hacia (0, 500, 0): pasa por baseRing pero debe ignorarlo y seleccionar el panel detrás
      const rayCenter = makeRay([0, 500, 2000], [0, 500, 0]);
      const resCenter = service.pickClosestSceneCandidate(rayCenter, {
        pieces: [panelMesh],
        referenceGuideRoot: guideRoot
      });
      expect(resCenter.closest?.kind).toBe('piece');
      expect(resCenter.closest?.part?.id).toBe('panel_behind_ring');

      // Clic hacia el torso del maniquí en (500, 500, 400): debe seleccionar reference_guide
      const rayFigure = makeRay([500, 500, 2000], [500, 500, 400]);
      const resFigure = service.pickClosestSceneCandidate(rayFigure, {
        pieces: [panelMesh],
        referenceGuideRoot: guideRoot
      });
      expect(resFigure.closest?.kind).toBe('reference_guide');
      expect(resFigure.closest?.object).toBe(torso);
    });

    it('excluye piezas listadas en hiddenPartIds (incluyendo tiradores y perforaciones asociadas)', () => {
      const hiddenPart = makePart({ id: 'hidden_p1' });
      const visiblePart = makePart({ id: 'visible_p2' });

      const hiddenMesh = makeSolidBox(500, 500, 18, 0, 500, 200);
      hiddenMesh.userData = { part: hiddenPart };
      const handleMesh = makeSolidBox(120, 20, 20, 0, 500, 220);
      handleMesh.userData = { isHandle: true, part: hiddenPart, parentPartId: hiddenPart.id };
      hiddenMesh.add(handleMesh);

      const visibleMesh = makeSolidBox(500, 500, 18, 0, 500, -200);
      visibleMesh.userData = { part: visiblePart };

      const raycaster = makeRay([0, 500, 2000], [0, 500, -200]);
      const result = service.pickClosestSceneCandidate(raycaster, {
        pieces: [hiddenMesh, visibleMesh],
        hiddenPartIds: new Set(['hidden_p1'])
      });

      expect(result.closest?.part?.id).toBe('visible_p2');
      expect(result.candidates.length).toBe(1);
    });
  });

  describe('3. Frescura de matrices y bounds (refreshPickableMatricesAndBounds)', () => {
    it('tras mover, rotar o escalar una malla, refreshPickableMatricesAndBounds actualiza matrixWorld, boundingBox y boundingSphere', () => {
      const geo = new THREE.BoxGeometry(200, 100, 20);
      // Limpiar bounds iniciales para verificar el cálculo explícito
      geo.boundingBox = null;
      geo.boundingSphere = null;

      const parent = new THREE.Group();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
      mesh.userData = { part: makePart({ id: 'moving_part' }) };
      parent.add(mesh);

      // 1. Mover, rotar 90° en Y y escalar (2x en X, 3x en Y)
      parent.position.set(100, 0, 0);
      mesh.position.set(400, 300, -150);
      mesh.rotation.y = Math.PI / 2;
      mesh.scale.set(2, 3, 1);

      service.refreshPickableMatricesAndBounds(parent);

      // Verificar matrixWorld actualizado (100 + 400 = 500 en X, 300 en Y, -150 en Z)
      expect(mesh.matrixWorld.elements[12]).toBeCloseTo(500, 4);
      expect(mesh.matrixWorld.elements[13]).toBeCloseTo(300, 4);
      expect(mesh.matrixWorld.elements[14]).toBeCloseTo(-150, 4);
      expect(geo.boundingBox).not.toBeNull();
      expect(geo.boundingSphere).not.toBeNull();

      // Con escala (2, 3, 1) y rotación 90° en Y, la dimensión X original (200*2=400) queda sobre Z [-350..+50]
      // y la altura (100*3=300) queda sobre Y [150..450].
      const rayNewPos = makeRay([500, 420, 1000], [500, 420, -150]);
      const hitNew = service.pickClosestSceneCandidate(rayNewPos, { pieces: [mesh] });
      expect(hitNew.closest?.part?.id).toBe('moving_part');

      // La posición antigua (0, 300, 0) ya no debe intersectar
      const rayOldPos = makeRay([0, 300, 1000], [0, 300, 0]);
      const hitOld = service.pickClosestSceneCandidate(rayOldPos, { pieces: [mesh] });
      expect(hitOld.closest).toBeNull();
    });

    it('forceRecomputeBounds recalcula boundingBox y boundingSphere tras mutación dinámica de geometría', () => {
      const geo = new THREE.BoxGeometry(100, 100, 100);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff }));

      expect(geo.boundingBox?.max.x).toBeCloseTo(50, 4);

      // Escalar directamente los vértices en buffer (simula modificación dinámica con boundingBox obsoleto)
      const posAttr = geo.getAttribute('position');
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setX(i, posAttr.getX(i) * 3);
      }
      posAttr.needsUpdate = true;
      // Sin forceRecomputeBounds el boundingBox en caché seguiría en 50
      service.refreshPickableMatricesAndBounds(mesh, false);
      expect(geo.boundingBox?.max.x).toBeCloseTo(50, 4);

      // Con forceRecomputeBounds=true se recalculan boundingBox y boundingSphere
      service.refreshPickableMatricesAndBounds(mesh, { forceRecomputeBounds: true });
      expect(geo.boundingBox?.max.x).toBeCloseTo(150, 4);
      expect(geo.boundingBox?.min.x).toBeCloseTo(-150, 4);
      expect(geo.boundingSphere?.radius).toBeGreaterThan(150);
    });
  });

  describe('4. Fallback opcional de Box3, tiradores, perforaciones y Priority-1 Gizmos', () => {
    it('soporta Box3 front-face fallback cuando enableApplianceBoxFallback=true y respeta distancia real frente a paneles', () => {
      const fridgeApp = makeAppliance({ id: 'sparse_table', type: 'dining_table', width: 1000, height: 800, depth: 600 });
      const appliancesGroup = new THREE.Group();
      const tableGroup = new THREE.Group();
      tableGroup.position.set(0, 0, -300);
      tableGroup.userData = { appliance: fridgeApp, applianceId: fridgeApp.id };

      // Dos patas sólidas en los extremos dejando el centro vacío (X = 0 sin malla sólida)
      tableGroup.add(makeSolidBox(60, 800, 600, -470, 400, 0));
      tableGroup.add(makeSolidBox(60, 800, 600, 470, 400, 0));
      appliancesGroup.add(tableGroup);

      // Cámara en Z = 2000 apuntando al hueco central (0, 400, -300)
      const raycaster = makeRay([0, 400, 2000], [0, 400, -300]);

      // Sin fallback: el hueco central no golpea ninguna malla sólida
      const withoutFallback = service.pickClosestSceneCandidate(raycaster, {
        appliancesRoot: appliancesGroup,
        enableApplianceBoxFallback: false
      });
      expect(withoutFallback.closest).toBeNull();

      // Con fallback: golpea la cara frontal del Box3 en Z = 0 -> distance = 2000
      const withFallback = service.pickClosestSceneCandidate(raycaster, {
        appliancesRoot: appliancesGroup,
        enableApplianceBoxFallback: true
      });
      expect(withFallback.closest?.kind).toBe('appliance');
      expect(withFallback.closest?.appliance?.id).toBe('sparse_table');
      expect(withFallback.closest?.distance).toBeCloseTo(2000, 1);

      // Con un panel de melamina delante en Z = +300 -> el panel (dist ~1691) aún gana al Box3 (dist 2000)
      const frontPanel = makeSolidBox(400, 400, 18, 0, 400, 300);
      frontPanel.userData = { part: makePart({ id: 'front_panel' }) };
      const withFrontPanel = service.pickClosestSceneCandidate(raycaster, {
        pieces: [frontPanel],
        appliancesRoot: appliancesGroup,
        enableApplianceBoxFallback: true
      });
      expect(withFrontPanel.closest?.kind).toBe('piece');
      expect(withFrontPanel.closest?.part?.id).toBe('front_panel');
      expect(withFrontPanel.candidates[0].distance).toBeLessThan(withFrontPanel.candidates[1].distance);
    });

    it('detecta tiradores (isHandle), perforaciones (drill_hole) y deduplica doorPivot + mesh', () => {
      const doorPart = makePart({ id: 'door_1', name: 'Puerta Izquierda' });
      const doorPivot = new THREE.Group();
      const doorMesh = makeSolidBox(400, 700, 18, 0, 500, 0);
      doorMesh.userData = { part: doorPart, isPiece: true, isDoor: true };

      const handleMesh = makeSolidBox(20, 120, 25, 160, 0, 22);
      handleMesh.userData = { isHandle: true, part: doorPart, parentPartId: doorPart.id };
      doorMesh.add(handleMesh);
      doorPivot.add(doorMesh);

      const holeMeta: DrillHole = {
        id: 'hole_1',
        type: 'hinge_35',
        diameter: 35,
        depth: 12.5,
        posX: -160,
        posY: 500,
        posZ: 9,
        normalAxis: 'z',
        direction: 1,
        surfaceType: 'face',
        partId: doorPart.id,
        partName: doorPart.name,
        description: 'Cazoleta 35mm'
      };
      const drillGroup = new THREE.Group();
      const drillMesh = makeSolidBox(35, 35, 12, -160, 500, 15);
      drillMesh.userData = { isDrillHole: true, part: doorPart, parentPartId: doorPart.id, drillHole: holeMeta };
      drillGroup.add(drillMesh);

      const sources: SceneRaycastSources = {
        pieces: [doorMesh, doorPivot],
        drillRoot: drillGroup
      };

      // Clic en la manija -> isHandle=true sin candidatos duplicados
      const rayHandle = makeRay([160, 500, 1000], [160, 500, 22]);
      const resHandle = service.pickClosestSceneCandidate(rayHandle, sources);
      expect(resHandle.closest?.kind).toBe('piece');
      expect(resHandle.closest?.isHandle).toBe(true);
      expect(resHandle.closest?.part?.id).toBe('door_1');
      // Debe haber 1 hit de manija + 1 hit de puerta = 2 (no 4 por doorMesh+doorPivot)
      expect(resHandle.candidates.length).toBe(2);

      // Clic en la perforación -> kind='drill_hole' con drillHole y part
      const rayDrill = makeRay([-160, 500, 1000], [-160, 500, 15]);
      const resDrill = service.pickClosestSceneCandidate(rayDrill, sources);
      expect(resDrill.closest?.kind).toBe('drill_hole');
      expect(resDrill.closest?.drillHole?.id).toBe('hole_1');
      expect(resDrill.closest?.part?.id).toBe('door_1');
    });

    it('intersectPriorityHandles permite colliders transparentes de Prioridad 1 pero respeta visible=false en ancestros', () => {
      const gizmoGroup = new THREE.Group();
      const colliderMesh = new THREE.Mesh(
        new THREE.BoxGeometry(80, 80, 80),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      colliderMesh.position.set(0, 500, 100);
      colliderMesh.userData = { isWallGizmo: true, type: 'wall_move' };
      // Hijo LineSegments auxiliar no debe interferir
      const edgeLine = new THREE.LineSegments(
        new THREE.EdgesGeometry(colliderMesh.geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      colliderMesh.add(edgeLine);
      gizmoGroup.add(colliderMesh);

      const raycaster = makeRay([0, 500, 1000], [0, 500, 100]);

      // Visible -> intersectPriorityHandles debe detectar el collider transparente
      const hitsVisible = service.intersectPriorityHandles(raycaster, [colliderMesh], true);
      expect(hitsVisible.length).toBe(1);
      expect(hitsVisible[0].object).toBe(colliderMesh);

      // Grupo padre oculto -> debe excluirse
      gizmoGroup.visible = false;
      const hitsHiddenParent = service.intersectPriorityHandles(raycaster, [colliderMesh], true);
      expect(hitsHiddenParent.length).toBe(0);
    });
  });
});
