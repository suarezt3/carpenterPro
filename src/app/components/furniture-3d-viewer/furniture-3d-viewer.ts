import {
  Component,
  ElementRef,
  viewChild,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  afterNextRender,
  effect,
  OnDestroy
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Part, Material } from '../../models/melamine.models';

interface PieceMeshData {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
}

interface GizmoHitData {
  isGizmo: boolean;
  type: 'axis' | 'handle';
  axis?: 'x' | 'y' | 'z';
  handleTarget?: 'length' | 'width';
  dir: number;
}

@Component({
  selector: 'app-furniture-3d-viewer',
  imports: [],
  templateUrl: './furniture-3d-viewer.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full'
  }
})
export class Furniture3dViewerComponent implements OnDestroy {
  // Inputs
  parts = input<Part[]>([]);
  selectedPartId = input<string | null>(null);
  materials = input<Material[]>([]);

  // Outputs
  partSelected = output<Part | null>();
  partModified = output<{ part: Part; updates: Partial<Part> }>();
  dragStarted = output<void>();

  // Canvas and Container refs
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas3d');
  containerRef = viewChild<ElementRef<HTMLDivElement>>('container3d');

  // Interactive View States
  isOpenFrentes = signal<boolean>(false);
  isXRay = signal<boolean>(false);
  explodedPercent = signal<number>(0);
  show3dDimensions = signal<boolean>(true);
  isWhiteTheme = signal<boolean>(true); // Default to clean pure white studio background

  // Active Selected Part computed
  selectedPart = computed(() => {
    const id = this.selectedPartId();
    if (!id) return null;
    return this.parts().find(p => p.id === id) || null;
  });

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Scene Groups
  private furnitureGroup = new THREE.Group();
  private dimensionGroup = new THREE.Group();
  private gizmoGroup = new THREE.Group();
  private gridHelper: THREE.GridHelper | null = null;
  private floorMesh: THREE.Mesh | null = null;

  // Mesh & Raycast Tracking
  private pieceObjects: PieceMeshData[] = [];
  private gizmoHitMeshes: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Dragging State
  private isDragging = false;
  private activeGizmoHit: GizmoHitData | null = null;
  private dragStartPointer = { x: 0, y: 0 };
  private dragInitialPart: Part | null = null;
  private dragPlane = new THREE.Plane();
  private dragPlaneIntersectionStart = new THREE.Vector3();

  constructor() {
    afterNextRender(() => {
      this.initThree();
    });

    // Rebuild scene when pieces, selection, materials, or xRay change
    effect(() => {
      const parts = this.parts();
      const selId = this.selectedPartId();
      const mats = this.materials();
      const xRay = this.isXRay();
      const showDims = this.show3dDimensions();

      if (this.scene) {
        this.buildFurnitureScene(parts, selId, mats, xRay, showDims);
        this.updateExplodedOffsets(this.explodedPercent());
      }
    });

    // Handle exploded view slider
    effect(() => {
      const exp = this.explodedPercent();
      this.updateExplodedOffsets(exp);
    });
  }

  private initThree() {
    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.applyThemeColors();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 10, 15000);
    this.camera.position.set(1500, 1100, 1900);

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
    this.controls.maxDistance = 9000;
    this.controls.minDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08;
    this.controls.target.set(0, 480, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Floor Grid & Shadow Plane
    this.setupFloorGrid();

    // 7. Add Groups
    this.scene.add(this.furnitureGroup);
    this.scene.add(this.dimensionGroup);
    this.scene.add(this.gizmoGroup);

    // Initial Scene Build
    this.buildFurnitureScene(
      this.parts(),
      this.selectedPartId(),
      this.materials(),
      this.isXRay(),
      this.show3dDimensions()
    );

    // 8. Animation Loop
    this.animate();

    // 9. Resize Observer
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(container);
    }

    // 10. Pointer Interactions (Selection, Gizmo Drag, Edge Handles)
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());
    window.addEventListener('pointercancel', () => this.onPointerUp());
  }

  private applyThemeColors() {
    if (!this.scene) return;
    const isWhite = this.isWhiteTheme();

    if (isWhite) {
      // Clean pure studio white with soft contrast
      this.scene.background = new THREE.Color(0xfcfcfd);
      this.scene.fog = new THREE.FogExp2(0xfcfcfd, 0.00012);
      if (this.floorMesh) {
        (this.floorMesh.material as THREE.ShadowMaterial).opacity = 0.09;
      }
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        this.gridHelper = new THREE.GridHelper(5000, 50, 0x0284c7, 0xe2e8f0);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);
      }
    } else {
      // Dark CAD Mode
      this.scene.background = new THREE.Color(0x0e0e11);
      this.scene.fog = new THREE.FogExp2(0x0e0e11, 0.00035);
      if (this.floorMesh) {
        (this.floorMesh.material as THREE.ShadowMaterial).opacity = 0.35;
      }
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        this.gridHelper = new THREE.GridHelper(5000, 50, 0x06b6d4, 0x27272a);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);
      }
    }
  }

  toggleTheme() {
    this.isWhiteTheme.update(v => !v);
    this.applyThemeColors();
  }

  private setupLighting() {
    // Soft Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Warm Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    this.scene.add(hemiLight);

    // Key Directional Light for Crisp Shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(1600, 2600, 1800);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 200;
    keyLight.shadow.camera.far = 7000;
    const d = 2200;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0003;
    this.scene.add(keyLight);

    // Soft Side & Back Fill Lights
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.65);
    fillLight.position.set(-1800, 1400, -1200);
    this.scene.add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.45);
    frontLight.position.set(0, 800, 2200);
    this.scene.add(frontLight);
  }

  private setupFloorGrid() {
    // Soft shadow receiver plane
    const floorGeo = new THREE.PlaneGeometry(8000, 8000);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.09 });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -1;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // Millimetric Grid Helper
    this.gridHelper = new THREE.GridHelper(5000, 50, 0x0284c7, 0xe2e8f0);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);
  }

  private buildFurnitureScene(
    parts: Part[],
    selectedId: string | null,
    mats: Material[],
    xRay: boolean,
    showDims: boolean
  ) {
    // Clear previous furniture & dimensions & gizmo
    while (this.furnitureGroup.children.length > 0) {
      const obj = this.furnitureGroup.children[0];
      this.furnitureGroup.remove(obj);
    }
    while (this.dimensionGroup.children.length > 0) {
      const obj = this.dimensionGroup.children[0];
      this.dimensionGroup.remove(obj);
    }
    while (this.gizmoGroup.children.length > 0) {
      const obj = this.gizmoGroup.children[0];
      this.gizmoGroup.remove(obj);
    }
    this.pieceObjects = [];
    this.gizmoHitMeshes = [];

    if (!parts || parts.length === 0) return;

    let selectedPartData: { part: Part; px: number; py: number; pz: number; sx: number; sy: number; sz: number } | null = null;

    for (const part of parts) {
      const t = part.thickness || 18;
      const L = part.length;
      const W = part.width;

      let sx = L;
      let sy = t;
      let sz = W;

      const orient = part.orientation || 'horizontal';
      if (orient === 'vertical_yz') {
        sx = t;
        sy = L;
        sz = W;
      } else if (orient === 'vertical_xy') {
        sx = L;
        sy = W;
        sz = t;
      }

      const px = part.posX ?? 0;
      const py = part.posY ?? (sy / 2);
      const pz = part.posZ ?? 0;

      const isSelected = selectedId === part.id;
      if (isSelected) {
        selectedPartData = { part, px, py, pz, sx, sy, sz };
      }

      // Geometry with bevel or box
      const geometry = new THREE.BoxGeometry(sx, sy, sz);
      const material = this.createPieceMaterial(part, isSelected, mats, xRay);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(px, py, pz);
      mesh.castShadow = !xRay;
      mesh.receiveShadow = true;
      mesh.userData = { part, isPiece: true };

      // Edges geometry for crisp technical outline
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeColor = isSelected ? 0x60a5fa : (this.isWhiteTheme() ? 0x94a3b8 : 0x3f3f46);
      const edgeMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        linewidth: isSelected ? 2.5 : 1
      });
      const edgeLines = new THREE.LineSegments(edges, edgeMat);
      mesh.add(edgeLines);

      // Exploded vector
      const explodedOffset = new THREE.Vector3(
        px * 0.45,
        (py - 400) * 0.4,
        pz * 0.45
      );

      this.furnitureGroup.add(mesh);
      this.pieceObjects.push({
        part,
        mesh,
        originalPos: mesh.position.clone(),
        explodedOffset
      });
    }

    // If there is an active selected piece, render 3D Dimensions and interactive 3D Gizmo
    if (selectedPartData) {
      if (showDims) {
        this.renderPieceDimensions(
          selectedPartData.part,
          selectedPartData.px,
          selectedPartData.py,
          selectedPartData.pz,
          selectedPartData.sx,
          selectedPartData.sy,
          selectedPartData.sz
        );
      }

      // Build Interactive Translation Arrows and Edge Stretch Handles
      this.buildGizmo(
        selectedPartData.part,
        selectedPartData.px,
        selectedPartData.py,
        selectedPartData.pz,
        selectedPartData.sx,
        selectedPartData.sy,
        selectedPartData.sz
      );
    }
  }

  // Create Interactive 3D Gizmo: Translation Arrows (X, Y, Z) and Edge Stretch Handles
  private buildGizmo(
    part: Part,
    px: number,
    py: number,
    pz: number,
    sx: number,
    sy: number,
    sz: number
  ) {
    const group = new THREE.Group();
    group.position.set(px, py, pz);

    const arrowLength = 160;
    const coneRadius = 14;
    const coneHeight = 36;
    const cylRadius = 4;

    // Helper to build translation axis arrow
    const createAxisArrow = (
      dirVector: THREE.Vector3,
      colorHex: number,
      axis: 'x' | 'y' | 'z',
      dir: number
    ) => {
      const arrowGroup = new THREE.Group();

      // Shaft
      const shaftGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, arrowLength, 12);
      shaftGeo.translate(0, arrowLength / 2, 0);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);

      // Cone Head
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
      coneGeo.translate(0, arrowLength + coneHeight / 2, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        depthTest: false
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);

      // Hitbox for easy clicking
      const hitGeo = new THREE.CylinderGeometry(coneRadius * 1.5, coneRadius * 1.5, arrowLength + coneHeight, 8);
      hitGeo.translate(0, (arrowLength + coneHeight) / 2, 0);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);

      arrowGroup.add(shaft);
      arrowGroup.add(cone);
      arrowGroup.add(hitMesh);

      // Orient arrow towards direction
      arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVector);

      const gizmoData: GizmoHitData = {
        isGizmo: true,
        type: 'axis',
        axis,
        dir
      };
      hitMesh.userData = { ...gizmoData, parentArrow: arrowGroup };
      cone.userData = { ...gizmoData, parentArrow: arrowGroup };
      shaft.userData = { ...gizmoData, parentArrow: arrowGroup };

      this.gizmoHitMeshes.push(hitMesh, cone);
      return arrowGroup;
    };

    // 1. Translation Arrows:
    // X (Red / Bright Coral)
    const arrowX = createAxisArrow(new THREE.Vector3(1, 0, 0), 0xef4444, 'x', 1);
    group.add(arrowX);

    // Y (Green / Emerald)
    const arrowY = createAxisArrow(new THREE.Vector3(0, 1, 0), 0x10b981, 'y', 1);
    group.add(arrowY);

    // Z (Blue / Sky)
    const arrowZ = createAxisArrow(new THREE.Vector3(0, 0, 1), 0x3b82f6, 'z', 1);
    group.add(arrowZ);

    // 2. Edge Stretch Handles (Tiradores de borde interactivos)
    // Cubos/esferas en los bordes para alargar o ensanchar la pieza arrastrando directamente
    const createStretchHandle = (
      pos: THREE.Vector3,
      colorHex: number,
      handleTarget: 'length' | 'width',
      dir: number
    ) => {
      const handleSize = 24;
      const geo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.2,
        metalness: 0.3,
        emissive: colorHex,
        emissiveIntensity: 0.35,
        depthTest: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      // Outline
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false })
      );
      mesh.add(edge);

      const hitData: GizmoHitData = {
        isGizmo: true,
        type: 'handle',
        handleTarget,
        dir
      };
      mesh.userData = hitData;
      this.gizmoHitMeshes.push(mesh);
      return mesh;
    };

    // Determine dimensions orientation
    const orient = part.orientation || 'horizontal';

    if (orient === 'horizontal') {
      // Length along X, Width along Z
      const handleLPlus = createStretchHandle(new THREE.Vector3(sx / 2 + 16, 0, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(-sx / 2 - 16, 0, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, 0, sz / 2 + 16), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, 0, -sz / 2 - 16), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    } else if (orient === 'vertical_yz') {
      // Length along Y (Height), Width along Z
      const handleLPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, 0, sz / 2 + 16), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, 0, -sz / 2 - 16), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    } else {
      // Frontal (XY): Length along X, Width along Y
      const handleLPlus = createStretchHandle(new THREE.Vector3(sx / 2 + 16, 0, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(-sx / 2 - 16, 0, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16, 0), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16, 0), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    }

    group.renderOrder = 999;
    this.gizmoGroup.add(group);
  }

  private createPieceMaterial(
    part: Part,
    isSelected: boolean,
    mats: Material[],
    xRay: boolean
  ): THREE.Material {
    if (isSelected) {
      // Technical Blueprint Cobalt Blue
      return new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        emissive: 0x1e3a8a,
        emissiveIntensity: 0.28,
        roughness: 0.32,
        metalness: 0.12
      });
    }

    // Material color resolution
    const assignedMat = mats.find(m => m.id === part.materialId);
    let colorHex = part.colorHex || assignedMat?.colorHex || '#b48a60';
    if (part.name.toLowerCase().includes('fondo') || part.thickness <= 4) {
      colorHex = '#e5e5e5';
    }

    if (xRay) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.35,
        roughness: 0.4
      });
    }

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: assignedMat?.textureType === 'wood' ? 0.65 : 0.4,
      metalness: 0.05
    });
  }

  // Draw 3D dimension lines and text sprites matching reference image
  private renderPieceDimensions(
    part: Part,
    px: number,
    py: number,
    pz: number,
    sx: number,
    sy: number,
    sz: number
  ) {
    const dimGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 });

    const offsetY = sy / 2 + 35;
    const offsetZ = sz / 2 + 25;

    // Horizontal dimension line along X
    const p1 = new THREE.Vector3(px - sx / 2, py + offsetY, pz + offsetZ);
    const p2 = new THREE.Vector3(px + sx / 2, py + offsetY, pz + offsetZ);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(lineGeo, lineMat);
    dimGroup.add(line);

    const tickH = 15;
    const t1 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.x, p1.y - tickH, p1.z),
        new THREE.Vector3(p1.x, p1.y + tickH, p1.z)
      ]),
      lineMat
    );
    const t2 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p2.x, p2.y - tickH, p2.z),
        new THREE.Vector3(p2.x, p2.y + tickH, p2.z)
      ]),
      lineMat
    );
    dimGroup.add(t1);
    dimGroup.add(t2);

    const lengthSprite = this.createTextSprite(`${part.length} mm`);
    lengthSprite.position.set((p1.x + p2.x) / 2, py + offsetY + 25, (p1.z + p2.z) / 2);
    dimGroup.add(lengthSprite);

    // Width / Depth dimension line
    const p3 = new THREE.Vector3(px + sx / 2 + 30, py, pz - sz / 2);
    const p4 = new THREE.Vector3(px + sx / 2 + 30, py, pz + sz / 2);
    const widthLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p3, p4]),
      lineMat
    );
    dimGroup.add(widthLine);

    const widthSprite = this.createTextSprite(`${part.width} mm`);
    widthSprite.position.set(px + sx / 2 + 45, py + 20, (p3.z + p4.z) / 2);
    dimGroup.add(widthSprite);

    this.dimensionGroup.add(dimGroup);
  }

  // Generates 3D billboard sprite with high-res text
  private createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      const r = 16;
      ctx.beginPath();
      ctx.moveTo(r, 4);
      ctx.lineTo(256 - r, 4);
      ctx.quadraticCurveTo(256 - 4, 4, 256 - 4, r);
      ctx.lineTo(256 - 4, 80 - r);
      ctx.quadraticCurveTo(256 - 4, 80 - 4, 256 - r, 80 - 4);
      ctx.lineTo(r, 80 - 4);
      ctx.quadraticCurveTo(4, 80 - 4, 4, 80 - r);
      ctx.lineTo(4, r);
      ctx.quadraticCurveTo(4, 4, r, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 42);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(130, 42, 1);
    return sprite;
  }

  private updateExplodedOffsets(percent: number) {
    const factor = percent / 100;
    for (const item of this.pieceObjects) {
      const targetPos = item.originalPos
        .clone()
        .addScaledVector(item.explodedOffset, factor);
      item.mesh.position.copy(targetPos);
    }
  }

  // Pointer Down: Detect clicks on Gizmo controls vs Pieces vs Empty space
  private onPointerDown(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check if clicking on Gizmo translation arrow or stretch handle
    if (this.gizmoHitMeshes.length > 0) {
      const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoHitMeshes, true);
      if (gizmoIntersects.length > 0) {
        const hit = gizmoIntersects[0].object;
        const hitData = hit.userData as GizmoHitData;
        const selPart = this.selectedPart();

        if (hitData && hitData.isGizmo && selPart) {
          this.isDragging = true;
          this.activeGizmoHit = hitData;
          this.dragStartPointer = { x: e.clientX, y: e.clientY };
          this.dragInitialPart = { ...selPart };

          // Notify parent to capture history snapshot before starting continuous drag
          this.dragStarted.emit();

          // Disable camera rotation while dragging gizmo
          this.controls.enabled = false;

          // Set up a raycasting plane facing the camera or orthogonal to axis
          const piecePos = new THREE.Vector3(selPart.posX ?? 0, selPart.posY ?? 0, selPart.posZ ?? 0);
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), piecePos);

          const intersectPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            this.dragPlaneIntersectionStart.copy(intersectPoint);
          }

          canvas.style.cursor = 'grabbing';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 2. Normal Piece selection
    const intersects = this.raycaster.intersectObjects(
      this.pieceObjects.map(p => p.mesh),
      false
    );

    if (intersects.length > 0) {
      const topHit = intersects[0].object as THREE.Mesh;
      const part = topHit.userData['part'] as Part;
      if (part) {
        this.partSelected.emit(part);
      }
    } else {
      // Clicked background -> deselect
      this.partSelected.emit(null);
    }
  }

  // Pointer Move: Dragging Gizmo or Updating Hover Cursors
  private onPointerMove(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;

    if (this.isDragging && this.activeGizmoHit && this.dragInitialPart) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const currentIntersection = new THREE.Vector3();

      if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersection)) {
        const deltaWorld = currentIntersection.clone().sub(this.dragPlaneIntersectionStart);
        const hit = this.activeGizmoHit;
        const part = this.dragInitialPart;
        const snap = 5; // 5 mm snapping for high-precision carpentry

        if (hit.type === 'axis') {
          // Axis Translation: X, Y, or Z
          const updates: Partial<Part> = {};

          if (hit.axis === 'x') {
            const rawDelta = deltaWorld.x;
            const steppedDelta = Math.round(rawDelta / snap) * snap;
            updates.posX = (part.posX ?? 0) + steppedDelta;
          } else if (hit.axis === 'y') {
            const rawDelta = deltaWorld.y;
            const steppedDelta = Math.round(rawDelta / snap) * snap;
            updates.posY = Math.max(0, (part.posY ?? 0) + steppedDelta);
          } else if (hit.axis === 'z') {
            const rawDelta = deltaWorld.z;
            const steppedDelta = Math.round(rawDelta / snap) * snap;
            updates.posZ = (part.posZ ?? 0) + steppedDelta;
          }

          this.partModified.emit({ part, updates });
        } else if (hit.type === 'handle') {
          // Edge Stretch Handle: Length or Width
          // Directional stretching: grows ONLY towards the pulled side, keeping the opposite edge anchored
          const updates: Partial<Part> = {};
          const orient = part.orientation || 'horizontal';

          if (hit.handleTarget === 'length') {
            let axisDelta = 0;
            let posAxis: 'posX' | 'posY' | 'posZ' = 'posX';

            if (orient === 'horizontal' || orient === 'vertical_xy') {
              // Length along X axis
              axisDelta = deltaWorld.x * hit.dir;
              posAxis = 'posX';
            } else {
              // vertical_yz: Length is along Y axis (height)
              axisDelta = deltaWorld.y * hit.dir;
              posAxis = 'posY';
            }

            const steppedDelta = Math.round(axisDelta / snap) * snap;
            const newLength = Math.max(50, part.length + steppedDelta);
            const actualDelta = newLength - part.length;

            updates.length = newLength;
            const currentPos = part[posAxis] ?? 0;
            // Shifting center position by half of delta in handle direction anchors the opposite side
            let newPos = currentPos + (actualDelta / 2) * hit.dir;
            if (posAxis === 'posY') {
              newPos = Math.max(newLength / 2, newPos);
            }
            updates[posAxis] = newPos;

          } else if (hit.handleTarget === 'width') {
            let axisDelta = 0;
            let posAxis: 'posX' | 'posY' | 'posZ' = 'posZ';

            if (orient === 'horizontal' || orient === 'vertical_yz') {
              // Width along Z axis (depth)
              axisDelta = deltaWorld.z * hit.dir;
              posAxis = 'posZ';
            } else {
              // vertical_xy: Width is along Y axis (height)
              axisDelta = deltaWorld.y * hit.dir;
              posAxis = 'posY';
            }

            const steppedDelta = Math.round(axisDelta / snap) * snap;
            const newWidth = Math.max(50, part.width + steppedDelta);
            const actualDelta = newWidth - part.width;

            updates.width = newWidth;
            const currentPos = part[posAxis] ?? 0;
            // Shifting center position by half of delta in handle direction anchors the opposite side
            let newPos = currentPos + (actualDelta / 2) * hit.dir;
            if (posAxis === 'posY') {
              newPos = Math.max(newWidth / 2, newPos);
            }
            updates[posAxis] = newPos;
          }

          this.partModified.emit({ part, updates });
        }
      }
      return;
    }

    // Hover cursor updates when not dragging
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.gizmoHitMeshes.length > 0) {
      const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoHitMeshes, true);
      if (gizmoIntersects.length > 0) {
        const hit = gizmoIntersects[0].object.userData as GizmoHitData;
        if (hit.type === 'axis') {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = hit.handleTarget === 'length' ? 'ew-resize' : 'ns-resize';
        }
        return;
      }
    }

    const pieceIntersects = this.raycaster.intersectObjects(
      this.pieceObjects.map(p => p.mesh),
      false
    );
    if (pieceIntersects.length > 0) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // Pointer Up: Release Dragging
  private onPointerUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.activeGizmoHit = null;
      this.dragInitialPart = null;
      this.controls.enabled = true;

      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }
  }

  // Camera preset controls
  setViewPreset(preset: 'iso' | 'front' | 'side' | 'top') {
    if (!this.camera || !this.controls) return;

    const target = this.controls.target.clone();
    const distance = 2200;

    switch (preset) {
      case 'iso':
        this.camera.position.set(target.x + 1400, target.y + 1100, target.z + 1800);
        break;
      case 'front':
        this.camera.position.set(target.x, target.y, target.z + distance);
        break;
      case 'side':
        this.camera.position.set(target.x + distance, target.y, target.z);
        break;
      case 'top':
        this.camera.position.set(target.x, target.y + distance, target.z + 1);
        break;
    }
    this.camera.lookAt(target);
    this.controls.update();
  }

  toggleOpenClose() {
    this.isOpenFrentes.update(v => !v);
  }

  toggleXRay() {
    this.isXRay.update(v => !v);
  }

  toggleDimensions() {
    this.show3dDimensions.update(v => !v);
  }

  resetCamera() {
    if (!this.controls || !this.camera) return;
    this.setViewPreset('iso');
  }

  private onResize() {
    const container = this.containerRef()?.nativeElement;
    if (!container || !this.renderer || !this.camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
