import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  signal,
  viewChild
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FurnitureModule, Material, Part } from '../../models/melamine.models';

interface MeshPieceData {
  mesh: THREE.Object3D;
  part: Part;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  type: 'left_side' | 'right_side' | 'bottom' | 'top' | 'shelf' | 'back' | 'door_left' | 'door_right' | 'drawer' | 'plinth' | 'tie' | 'other';
  openPivot?: THREE.Group;
  initialRotationY?: number;
  initialPosZ?: number;
}

@Component({
  selector: 'app-furniture-3d-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './furniture-3d-viewer.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
  `]
})
export class Furniture3dViewerComponent implements OnDestroy {
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas3d');
  containerRef = viewChild<ElementRef<HTMLDivElement>>('container3d');

  // Inputs
  module = input.required<FurnitureModule>();
  parts = input.required<Part[]>();
  material = input<Material | undefined>();

  // Interactive 3D States
  explodedPercent = signal<number>(0);
  isOpenFrentes = signal<boolean>(false);
  isXRay = signal<boolean>(false);
  selectedPieceName = signal<string | null>(null);
  selectedPieceDetails = signal<string | null>(null);

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private furnitureGroup = new THREE.Group();
  private dimensionGroup = new THREE.Group();
  private pieceObjects: MeshPieceData[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor() {
    afterNextRender(() => {
      this.initThree();
    });

    // Re-build 3D model whenever module, parts, or material changes
    effect(() => {
      const mod = this.module();
      const parts = this.parts();
      const mat = this.material();
      const xRay = this.isXRay();

      if (this.scene) {
        this.buildFurnitureModel(mod, parts, mat, xRay);
        this.updateExplodedOffsets(this.explodedPercent());
        this.updateFrentesOpen(this.isOpenFrentes());
      }
    });

    // Handle exploded slider changes
    effect(() => {
      const exp = this.explodedPercent();
      this.updateExplodedOffsets(exp);
    });

    // Handle open/close frentes
    effect(() => {
      const open = this.isOpenFrentes();
      this.updateFrentesOpen(open);
    });
  }

  private initThree() {
    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121215);

    // Subtle studio fog for depth
    this.scene.fog = new THREE.FogExp2(0x121215, 0.0004);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 10, 10000);
    this.camera.position.set(1300, 1000, 1800);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 6000;
    this.controls.minDistance = 300;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't go below floor
    this.controls.target.set(0, 450, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Floor Grid & Shadow receiver
    this.setupFloorGrid();

    // 7. Add root groups
    this.scene.add(this.furnitureGroup);
    this.scene.add(this.dimensionGroup);

    // Initial build
    this.buildFurnitureModel(this.module(), this.parts(), this.material(), this.isXRay());

    // 8. Start loop
    this.animate();

    // 9. Resize listener
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(container);
    }

    // 10. Click to pick piece
    canvas.addEventListener('pointerdown', (e) => this.onCanvasClick(e));
  }

  private setupLighting() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Hemisphere light for soft top-bottom warm bounce
    const hemiLight = new THREE.HemisphereLight(0xfff6e5, 0x1f242d, 0.6);
    this.scene.add(hemiLight);

    // Key Directional Light with Shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(1200, 2000, 1400);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 200;
    keyLight.shadow.camera.far = 5000;
    const d = 1400;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Soft fill light from opposite angle
    const fillLight = new THREE.DirectionalLight(0x90b4d4, 0.6);
    fillLight.position.set(-1400, 1000, -1000);
    this.scene.add(fillLight);
  }

  private setupFloorGrid() {
    // Floor shadow receiver mesh
    const floorGeo = new THREE.PlaneGeometry(6000, 6000);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Floor Grid helper
    const grid = new THREE.GridHelper(4000, 40, 0xf59e0b, 0x27272a);
    grid.position.y = 0;
    this.scene.add(grid);
  }

  private buildFurnitureModel(
    mod: FurnitureModule,
    parts: Part[],
    mat?: Material,
    xRay = false
  ) {
    // Clear old pieces
    while (this.furnitureGroup.children.length > 0) {
      const obj = this.furnitureGroup.children[0];
      this.furnitureGroup.remove(obj);
    }
    while (this.dimensionGroup.children.length > 0) {
      const obj = this.dimensionGroup.children[0];
      this.dimensionGroup.remove(obj);
    }
    this.pieceObjects = [];

    const W = mod.width;
    const H = mod.height;
    const D = mod.depth;
    const t = mod.boardThickness;
    const plinth = mod.hasPlinth ? mod.plinthHeight : 0;
    const carcassH = H - plinth;
    const baseColor = mat?.colorHex || '#b48a60';

    // Center furniture so bottom sits at y = 0
    // Center in X at 0, Z centered at 0
    this.furnitureGroup.position.set(0, 0, 0);
    this.controls.target.set(0, H / 2, 0);

    // Materials
    const woodMaterial = this.createBoardMaterial(baseColor, xRay);
    const interiorMaterial = this.createBoardMaterial(
      mat?.textureType === 'wood' ? '#c79f74' : baseColor,
      xRay
    );
    const backMaterial = this.createBoardMaterial('#222225', xRay);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15
    });

    // 1. Zócalo
    if (mod.hasPlinth) {
      const plinthZ = D / 2 - 40;
      const plinthMesh = this.createBoxMesh(W - (2 * t), plinth, t, woodMaterial);
      plinthMesh.position.set(0, plinth / 2, plinthZ);
      plinthMesh.castShadow = true;
      plinthMesh.receiveShadow = true;

      const pPart = parts.find(p => p.name.includes('Zócalo')) || parts[0];
      this.registerPiece(plinthMesh, pPart, new THREE.Vector3(0, 0, 80), 'plinth');
    }

    // 2. Lateral Izquierdo
    const leftSideMesh = this.createBoxMesh(t, carcassH, D, woodMaterial);
    const leftSideY = plinth + carcassH / 2;
    const leftSideX = -W / 2 + t / 2;
    leftSideMesh.position.set(leftSideX, leftSideY, 0);
    leftSideMesh.castShadow = true;
    leftSideMesh.receiveShadow = true;

    const leftPart = parts.find(p => p.name.includes('Lateral')) || parts[0];
    this.registerPiece(leftSideMesh, leftPart, new THREE.Vector3(-120, 0, 0), 'left_side');

    // 3. Lateral Derecho
    const rightSideMesh = this.createBoxMesh(t, carcassH, D, woodMaterial);
    const rightSideX = W / 2 - t / 2;
    rightSideMesh.position.set(rightSideX, leftSideY, 0);
    rightSideMesh.castShadow = true;
    rightSideMesh.receiveShadow = true;
    this.registerPiece(rightSideMesh, leftPart, new THREE.Vector3(120, 0, 0), 'right_side');

    // 4. Piso Inferior
    const bottomMesh = this.createBoxMesh(W - 2 * t, t, D, woodMaterial);
    const bottomY = plinth + t / 2;
    bottomMesh.position.set(0, bottomY, 0);
    bottomMesh.castShadow = true;
    bottomMesh.receiveShadow = true;
    const floorPart = parts.find(p => p.name.includes('Piso')) || parts[0];
    this.registerPiece(bottomMesh, floorPart, new THREE.Vector3(0, -80, 0), 'bottom');

    // 5. Techo o Fajas Superiores
    if (mod.type === 'base_cabinet' || mod.type === 'drawer_unit') {
      // 2 fajas superiores de 100mm de ancho
      const tieFront = this.createBoxMesh(W - 2 * t, t, 100, woodMaterial);
      tieFront.position.set(0, plinth + carcassH - t / 2, D / 2 - 50);
      tieFront.castShadow = true;
      this.registerPiece(tieFront, floorPart, new THREE.Vector3(0, 80, 0), 'tie');

      const tieBack = this.createBoxMesh(W - 2 * t, t, 100, woodMaterial);
      tieBack.position.set(0, plinth + carcassH - t / 2, -D / 2 + 50);
      tieBack.castShadow = true;
      this.registerPiece(tieBack, floorPart, new THREE.Vector3(0, 80, 0), 'tie');
    } else {
      // Techo completo (Alacena, Columna/Ropero)
      const topMesh = this.createBoxMesh(W - 2 * t, t, D, woodMaterial);
      topMesh.position.set(0, plinth + carcassH - t / 2, 0);
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      this.registerPiece(topMesh, floorPart, new THREE.Vector3(0, 80, 0), 'top');
    }

    // 6. Fondo (Back panel)
    if (mod.backType !== 'none') {
      const backMesh = this.createBoxMesh(W - 4, carcassH - 4, 3, backMaterial);
      const backZ = -D / 2 + (mod.backType === 'groove' ? 18 : 1.5);
      backMesh.position.set(0, plinth + carcassH / 2, backZ);
      backMesh.castShadow = true;
      const backPart = parts.find(p => p.thickness <= 3 || p.name.includes('Fondo')) || parts[0];
      this.registerPiece(backMesh, backPart, new THREE.Vector3(0, 0, -140), 'back');
    }

    // 7. Repisas interiores
    if (mod.shelvesCount > 0) {
      const usefulH = carcassH - 2 * t;
      const spacing = usefulH / (mod.shelvesCount + 1);
      const shelfPart = parts.find(p => p.name.includes('Repisa') || p.name.includes('Estante')) || floorPart;

      for (let i = 1; i <= mod.shelvesCount; i++) {
        const shelfMesh = this.createBoxMesh(W - 2 * t - 2, t, D - 20, interiorMaterial);
        const shelfY = plinth + t + spacing * i;
        shelfMesh.position.set(0, shelfY, -10);
        shelfMesh.castShadow = true;
        shelfMesh.receiveShadow = true;
        this.registerPiece(shelfMesh, shelfPart, new THREE.Vector3(0, (i - 1) * 20, 40), 'shelf');
      }
    }

    // 8. Puertas (con bisagras interactivas)
    if (mod.doorsCount > 0) {
      const doorH = carcassH - 4;
      const doorPart = parts.find(p => p.name.includes('Puerta')) || parts[0];
      const doorZ = D / 2 + t / 2 + 1;

      if (mod.doorsCount === 1) {
        // Puerta única (Bisagra en lateral izquierdo)
        const doorW = W - 4;
        const pivot = new THREE.Group();
        pivot.position.set(-W / 2 + 2, plinth + carcassH / 2, doorZ);

        const doorMesh = this.createBoxMesh(doorW, doorH, t, woodMaterial);
        doorMesh.position.set(doorW / 2, 0, 0); // local to pivot
        doorMesh.castShadow = true;
        doorMesh.receiveShadow = true;

        // Tirador metálico en el borde derecho
        const handle = this.createHandleMesh(handleMaterial);
        handle.position.set(doorW - 35, 0, t / 2 + 6);
        doorMesh.add(handle);

        pivot.add(doorMesh);
        this.furnitureGroup.add(pivot);

        this.pieceObjects.push({
          mesh: doorMesh,
          part: doorPart,
          originalPos: pivot.position.clone(),
          explodedOffset: new THREE.Vector3(0, 0, 160),
          type: 'door_left',
          openPivot: pivot,
          initialRotationY: 0
        });
      } else if (mod.doorsCount === 2) {
        // Dos puertas
        const doorW = (W - 6) / 2;

        // Puerta Izquierda
        const pivotL = new THREE.Group();
        pivotL.position.set(-W / 2 + 2, plinth + carcassH / 2, doorZ);

        const doorMeshL = this.createBoxMesh(doorW, doorH, t, woodMaterial);
        doorMeshL.position.set(doorW / 2, 0, 0);
        doorMeshL.castShadow = true;
        doorMeshL.receiveShadow = true;

        const handleL = this.createHandleMesh(handleMaterial);
        handleL.position.set(doorW - 25, 0, t / 2 + 6);
        doorMeshL.add(handleL);

        pivotL.add(doorMeshL);
        this.furnitureGroup.add(pivotL);

        this.pieceObjects.push({
          mesh: doorMeshL,
          part: doorPart,
          originalPos: pivotL.position.clone(),
          explodedOffset: new THREE.Vector3(-40, 0, 160),
          type: 'door_left',
          openPivot: pivotL,
          initialRotationY: 0
        });

        // Puerta Derecha
        const pivotR = new THREE.Group();
        pivotR.position.set(W / 2 - 2, plinth + carcassH / 2, doorZ);

        const doorMeshR = this.createBoxMesh(doorW, doorH, t, woodMaterial);
        doorMeshR.position.set(-doorW / 2, 0, 0);
        doorMeshR.castShadow = true;
        doorMeshR.receiveShadow = true;

        const handleR = this.createHandleMesh(handleMaterial);
        handleR.position.set(-doorW + 25, 0, t / 2 + 6);
        doorMeshR.add(handleR);

        pivotR.add(doorMeshR);
        this.furnitureGroup.add(pivotR);

        this.pieceObjects.push({
          mesh: doorMeshR,
          part: doorPart,
          originalPos: pivotR.position.clone(),
          explodedOffset: new THREE.Vector3(40, 0, 160),
          type: 'door_right',
          openPivot: pivotR,
          initialRotationY: 0
        });
      }
    }

    // 9. Cajones (Cajas completas + correderas + frentes)
    if (mod.drawersCount > 0) {
      const n = mod.drawersCount;
      const frontH = (carcassH - (n * 3) - 2) / n;
      const frontW = W - 4;
      const slideL = D - 60;
      const boxH = Math.min(frontH * 0.7, 180);
      const innerW = W - (2 * t);
      const boxW = innerW - 26; // -26mm holgura correderas telescópicas

      const frontPart = parts.find(p => p.name.includes('Frente de Cajón')) || parts[0];

      for (let d = 0; d < n; d++) {
        const drawerGroup = new THREE.Group();
        const drawerCenterY = plinth + carcassH - (frontH / 2) - 2 - (d * (frontH + 3));

        drawerGroup.position.set(0, drawerCenterY, 0);

        // Frente Visto
        const frontMesh = this.createBoxMesh(frontW, frontH, t, woodMaterial);
        frontMesh.position.set(0, 0, D / 2 + t / 2 + 1);
        frontMesh.castShadow = true;

        // Tirador de cajón horizontal
        const handle = this.createDrawerHandleMesh(handleMaterial);
        handle.position.set(0, 0, D / 2 + t + 6);
        drawerGroup.add(handle);

        drawerGroup.add(frontMesh);

        // Caja Interior del Cajón
        // Laterales de la caja
        const boxSideL = this.createBoxMesh(t, boxH, slideL, interiorMaterial);
        boxSideL.position.set(-boxW / 2 + t / 2, -frontH / 2 + boxH / 2 + 10, D / 2 - slideL / 2);
        drawerGroup.add(boxSideL);

        const boxSideR = this.createBoxMesh(t, boxH, slideL, interiorMaterial);
        boxSideR.position.set(boxW / 2 - t / 2, -frontH / 2 + boxH / 2 + 10, D / 2 - slideL / 2);
        drawerGroup.add(boxSideR);

        // Testeras (Frontal y Trasera interior)
        const boxBack = this.createBoxMesh(boxW - 2 * t, boxH, t, interiorMaterial);
        boxBack.position.set(0, -frontH / 2 + boxH / 2 + 10, D / 2 - slideL + t / 2);
        drawerGroup.add(boxBack);

        // Fondo de cajón MDF
        const boxBottom = this.createBoxMesh(boxW, 3, slideL, backMaterial);
        boxBottom.position.set(0, -frontH / 2 + 10, D / 2 - slideL / 2);
        drawerGroup.add(boxBottom);

        this.furnitureGroup.add(drawerGroup);

        this.pieceObjects.push({
          mesh: drawerGroup,
          part: frontPart,
          originalPos: drawerGroup.position.clone(),
          explodedOffset: new THREE.Vector3(0, 0, 140 + (d * 50)),
          type: 'drawer',
          initialPosZ: drawerGroup.position.z
        });
      }
    }

    // 10. Dimension Lines in 3D Space
    this.build3DDimensionGuides(W, H, D);
  }

  private build3DDimensionGuides(w: number, h: number, d: number) {
    const guideMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.75
    });

    // 1. Width Dimension line (at top front)
    const yW = h + 60;
    const zW = d / 2 + 40;
    const wPoints = [
      new THREE.Vector3(-w / 2, yW, zW),
      new THREE.Vector3(w / 2, yW, zW)
    ];
    const wGeo = new THREE.BufferGeometry().setFromPoints(wPoints);
    const wLine = new THREE.Line(wGeo, guideMaterial);
    this.dimensionGroup.add(wLine);

    // End ticks
    const tickGeoW1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-w / 2, yW - 15, zW),
      new THREE.Vector3(-w / 2, yW + 15, zW)
    ]);
    const tickGeoW2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(w / 2, yW - 15, zW),
      new THREE.Vector3(w / 2, yW + 15, zW)
    ]);
    this.dimensionGroup.add(new THREE.Line(tickGeoW1, guideMaterial));
    this.dimensionGroup.add(new THREE.Line(tickGeoW2, guideMaterial));

    // 2. Height Dimension line (at left front)
    const xH = -w / 2 - 60;
    const zH = d / 2 + 40;
    const hPoints = [
      new THREE.Vector3(xH, 0, zH),
      new THREE.Vector3(xH, h, zH)
    ];
    const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
    const hLine = new THREE.Line(hGeo, guideMaterial);
    this.dimensionGroup.add(hLine);

    // End ticks
    const tickGeoH1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xH - 15, 0, zH),
      new THREE.Vector3(xH + 15, 0, zH)
    ]);
    const tickGeoH2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xH - 15, h, zH),
      new THREE.Vector3(xH + 15, h, zH)
    ]);
    this.dimensionGroup.add(new THREE.Line(tickGeoH1, guideMaterial));
    this.dimensionGroup.add(new THREE.Line(tickGeoH2, guideMaterial));

    // 3. Depth Dimension line (at bottom right)
    const xD = w / 2 + 60;
    const yD = 10;
    const dPoints = [
      new THREE.Vector3(xD, yD, -d / 2),
      new THREE.Vector3(xD, yD, d / 2)
    ];
    const dGeo = new THREE.BufferGeometry().setFromPoints(dPoints);
    const dLine = new THREE.Line(dGeo, guideMaterial);
    this.dimensionGroup.add(dLine);
  }

  private registerPiece(
    mesh: THREE.Object3D,
    part: Part,
    explodedOffset: THREE.Vector3,
    type: MeshPieceData['type']
  ) {
    this.furnitureGroup.add(mesh);
    this.pieceObjects.push({
      mesh,
      part,
      originalPos: mesh.position.clone(),
      explodedOffset,
      type
    });
  }

  private createBoxMesh(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, material);

    // Add subtle darker bevel wireframe edges for high-definition CAD feel
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 1,
      transparent: true,
      opacity: 0.25
    });
    const line = new THREE.LineSegments(edges, lineMat);
    mesh.add(line);

    return mesh;
  }

  private createBoardMaterial(colorHex: string, xRay: boolean): THREE.MeshStandardMaterial {
    const color = new THREE.Color(colorHex);

    if (xRay) {
      return new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.1,
        depthWrite: false
      });
    }

    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.05
    });
  }

  private createHandleMesh(material: THREE.Material): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(5, 5, 120, 16);
    const mesh = new THREE.Mesh(geo, material);
    return mesh;
  }

  private createDrawerHandleMesh(material: THREE.Material): THREE.Mesh {
    const geo = new THREE.BoxGeometry(140, 10, 18);
    const mesh = new THREE.Mesh(geo, material);
    return mesh;
  }

  private updateExplodedOffsets(percent: number) {
    const factor = percent / 100;

    for (const p of this.pieceObjects) {
      if (p.openPivot) {
        // Pivot for doors
        p.openPivot.position.copy(p.originalPos).addScaledVector(p.explodedOffset, factor);
      } else {
        p.mesh.position.copy(p.originalPos).addScaledVector(p.explodedOffset, factor);
      }
    }
  }

  private updateFrentesOpen(isOpen: boolean) {
    for (const p of this.pieceObjects) {
      if (p.type === 'door_left' && p.openPivot) {
        p.openPivot.rotation.y = isOpen ? -Math.PI / 2 + 0.15 : 0;
      } else if (p.type === 'door_right' && p.openPivot) {
        p.openPivot.rotation.y = isOpen ? Math.PI / 2 - 0.15 : 0;
      } else if (p.type === 'drawer') {
        const slideOutZ = isOpen ? 320 : 0;
        p.mesh.position.z = (p.initialPosZ || 0) + slideOutZ;
      }
    }
  }

  // --- View Controls ---

  setViewPreset(view: 'iso' | 'front' | 'side' | 'top') {
    const h = this.module().height;
    const targetY = h / 2;
    this.controls.target.set(0, targetY, 0);

    if (view === 'iso') {
      this.camera.position.set(1300, 1100, 1700);
    } else if (view === 'front') {
      this.camera.position.set(0, targetY, 2100);
    } else if (view === 'side') {
      this.camera.position.set(2100, targetY, 0);
    } else if (view === 'top') {
      this.camera.position.set(0, 2200, 0.1);
    }

    this.controls.update();
  }

  toggleOpenClose() {
    this.isOpenFrentes.update(v => !v);
  }

  toggleXRay() {
    this.isXRay.update(v => !v);
  }

  resetCamera() {
    this.setViewPreset('iso');
  }

  private onCanvasClick(event: MouseEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.furnitureGroup.children, true);

    if (intersects.length > 0) {
      let hitMesh: THREE.Object3D | null = intersects[0].object;
      let matchedPiece: MeshPieceData | undefined;

      while (hitMesh && !matchedPiece && hitMesh !== this.furnitureGroup) {
        matchedPiece = this.pieceObjects.find(p => p.mesh === hitMesh || (p.openPivot && p.openPivot === hitMesh));
        hitMesh = hitMesh.parent;
      }

      if (matchedPiece) {
        this.selectedPieceName.set(matchedPiece.part.name);
        this.selectedPieceDetails.set(
          `${matchedPiece.part.length} × ${matchedPiece.part.width} × ${matchedPiece.part.thickness} mm • Canto L1:${matchedPiece.part.edges.l1} L2:${matchedPiece.part.edges.l2}`
        );
      }
    } else {
      this.selectedPieceName.set(null);
      this.selectedPieceDetails.set(null);
    }
  }

  private onResize() {
    const container = this.containerRef()?.nativeElement;
    if (!container || !this.renderer || !this.camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
