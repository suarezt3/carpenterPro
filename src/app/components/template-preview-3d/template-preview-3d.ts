import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { HugeiconsIconComponent, IconSvgObject } from '@hugeicons/angular';
import { CubeIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  HandleFinish,
  Material,
  Part,
  PartHardwareConfig
} from '../../models/melamine.models';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { FurnitureTemplate } from '../../services/templates-catalog.service';
import { ProceduralTextureFactory } from '../../utils/procedural-textures';

const PLAY_ICON: IconSvgObject = [
  [
    'path',
    {
      d: 'M18.8906 12.846C18.5371 14.189 16.8667 15.138 13.5257 17.0361C10.296 18.8709 8.6812 19.7884 7.37983 19.4196C6.8418 19.2671 6.35159 18.9776 5.95624 18.5787C5 17.6139 5 15.7426 5 12C5 8.2574 5 6.3861 5.95624 5.42132C6.35159 5.02245 6.8418 4.73288 7.37983 4.58042C8.6812 4.21165 10.296 5.12907 13.5257 6.96393C16.8667 8.86197 18.5371 9.811 18.8906 11.154C19.0365 11.7084 19.0365 12.2916 18.8906 12.846Z',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
      key: 'play_0'
    }
  ]
];

const PAUSE_ICON: IconSvgObject = [
  [
    'path',
    {
      d: 'M4 7C4 5.58579 4 4.87868 4.43934 4.43934C4.87868 4 5.58579 4 7 4C8.41421 4 9.12132 4 9.56066 4.43934C10 4.87868 10 5.58579 10 7V17C10 18.4142 10 19.1213 9.56066 19.5607C9.12132 20 8.41421 20 7 20C5.58579 20 4.87868 20 4.43934 19.5607C4 19.1213 4 18.4142 4 17V7Z',
      stroke: 'currentColor',
      strokeWidth: '1.5',
      key: 'pause_0'
    }
  ],
  [
    'path',
    {
      d: 'M14 7C14 5.58579 14 4.87868 14.4393 4.43934C14.8787 4 15.5858 4 17 4C18.4142 4 19.1213 4 19.5607 4.43934C20 4.87868 20 5.58579 20 7V17C20 18.4142 20 19.1213 19.5607 19.5607C19.1213 20 18.4142 20 17 20C15.5858 20 14.8787 20 14.4393 19.5607C14 19.1213 14 18.4142 14 17V7Z',
      stroke: 'currentColor',
      strokeWidth: '1.5',
      key: 'pause_1'
    }
  ]
];

const ROTATE_360_ICON: IconSvgObject = [
  [
    'path',
    {
      d: 'M20.4371 12.5061C23.4219 7.00258 22.0614 3.26685 16.9548 3C13.2433 3.07086 9.41471 5.07063 6.35871 8.16433C3.79408 10.7606 1.26891 14.479 2.1959 18.018C2.40059 18.7994 2.79969 19.3318 3.43015 19.8328C5.12441 21.1791 6.7874 21.2976 9.99031 20.5113C13.2339 19.5257 15.2448 18.0408 16.9404 16.5217M16.9404 16.5217C16.9421 16.5201 16.9439 16.5185 16.9457 16.5169C16.9489 16.5141 16.9468 16.5087 16.9425 16.5087C16.9393 16.5087 16.937 16.512 16.9381 16.515C16.9389 16.5173 16.9396 16.5195 16.9404 16.5217ZM16.9404 16.5217C17.3108 17.6169 17.0762 18.5944 16.4385 20.5113',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
      key: 'rot360_0'
    }
  ]
];

const DEFAULT_PREVIEW_MATERIALS: readonly Material[] = [
  {
    id: 'preview_mat_blanco_15',
    name: 'Melamina Blanco Nieve Mate',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 135000,
    hasGrain: false,
    colorHex: '#F8FAFC',
    textureType: 'solid',
    family: 'solid_matte',
    category: 'board'
  },
  {
    id: 'preview_mat_roble_15',
    name: 'Melamina Roble Natural',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    colorHex: '#C29B68',
    textureType: 'wood',
    family: 'wood_light',
    category: 'board'
  },
  {
    id: 'preview_mat_mdf_3',
    name: 'MDF Fondo Blanco',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 45000,
    hasGrain: false,
    colorHex: '#E4E4E7',
    textureType: 'solid',
    family: 'mdf_back',
    category: 'mdf'
  }
];

type CardinalFacing = 'front' | 'right' | 'back' | 'left';
type HingeSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Visor 3D interactivo autónomo para previsualizar plantillas paramétricas de mobiliario
 * con encuadre automático, texturas procedurales, herrajes metálicos y rotación orbital 360°.
 */
@Component({
  selector: 'app-template-preview-3d',
  standalone: true,
  imports: [HugeiconsIconComponent],
  templateUrl: './template-preview-3d.html',
  styleUrl: './template-preview-3d.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatePreview3dComponent implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly partGeometry = inject(PartGeometryService);
  private readonly hardwareCatalog = inject(HardwareCatalogService);
  private readonly joineryEngine = inject(JoineryEngineService);

  readonly template = input.required<FurnitureTemplate>();
  readonly materials = input<Material[]>([]);
  readonly autoRotate = input<boolean>(true);

  readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('previewContainer');
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('previewCanvas');

  readonly icons = {
    play: PLAY_ICON,
    pause: PAUSE_ICON,
    rotate360: ROTATE_360_ICON,
    resetCamera: RefreshIcon,
    cube: CubeIcon
  };

  readonly isAutoRotating = signal<boolean>(true);
  readonly webglUnavailable = signal<boolean>(false);
  private readonly isSceneReady = signal<boolean>(false);

  readonly effectiveMaterials = computed<Material[]>(() => {
    const provided = this.materials();
    if (provided.length > 0) {
      return provided;
    }
    return [...DEFAULT_PREVIEW_MATERIALS];
  });

  readonly generatedParts = computed<Part[]>(() => {
    const tpl = this.template();
    const mats = this.effectiveMaterials();
    try {
      return tpl.generateParts(mats);
    } catch {
      return [];
    }
  });

  readonly dimensionsLabel = computed<string>(() => {
    const dims = this.template().dimensions;
    return `${dims.width} × ${dims.height} × ${dims.depth} mm`;
  });

  readonly renderedPartsCount = computed<number>(() => {
    const parts = this.generatedParts();
    return parts.length > 0 ? parts.length : this.template().partsCount;
  });

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;

  private readonly moduleGroup = new THREE.Group();
  private keyLight: THREE.DirectionalLight | null = null;
  private floorShadowMesh: THREE.Mesh | null = null;
  private floorGrid: THREE.GridHelper | null = null;

  private readonly materialCache = new Map<string, THREE.Material>();
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();

  private readonly defaultCameraPos = new THREE.Vector3(1200, 950, 1600);
  private readonly defaultCameraTarget = new THREE.Vector3(0, 420, 0);
  private isUserDragging = false;
  private needsRender = true;
  private isDestroyed = false;

  private readonly initRenderHook = afterNextRender(() => {
    this.initThree();
  });

  private readonly syncAutoRotateEffect = effect(() => {
    const shouldRotate = this.autoRotate();
    untracked(() => {
      this.isAutoRotating.set(shouldRotate);
      this.applyAutoRotateState();
    });
  });

  private readonly rebuildTemplateEffect = effect(() => {
    const parts = this.generatedParts();
    const mats = this.effectiveMaterials();
    const ready = this.isSceneReady();
    if (!ready || !this.scene) {
      return;
    }
    untracked(() => {
      this.rebuildModuleScene(parts, mats);
    });
  });

  toggleAutoRotate(): void {
    this.isAutoRotating.update(prev => !prev);
    this.applyAutoRotateState();
  }

  resetCamera(): void {
    if (!this.camera || !this.controls) {
      return;
    }
    this.camera.position.copy(this.defaultCameraPos);
    this.controls.target.copy(this.defaultCameraTarget);
    this.controls.update();
    this.needsRender = true;
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.initRenderHook.destroy();
    this.syncAutoRotateEffect.destroy();
    this.rebuildTemplateEffect.destroy();
    this.disposeThreeResources();
  }

  private disposeThreeResources(): void {
    if (this.animationFrameId !== null && isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.disposeGroup(this.moduleGroup);

    if (this.floorShadowMesh) {
      this.floorShadowMesh.geometry.dispose();
      if (!Array.isArray(this.floorShadowMesh.material)) {
        this.floorShadowMesh.material.dispose();
      }
      this.floorShadowMesh = null;
    }

    if (this.floorGrid) {
      this.disposeGrid(this.floorGrid);
      this.floorGrid = null;
    }

    for (const geo of this.geometryCache.values()) {
      geo.dispose();
    }
    this.geometryCache.clear();

    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    this.materialCache.clear();

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.keyLight = null;
  }

  private initThree(): void {
    if (this.isDestroyed || !isPlatformBrowser(this.platformId)) {
      this.webglUnavailable.set(true);
      return;
    }

    const hasWebGlApi =
      typeof window !== 'undefined' &&
      ('WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window);
    if (!hasWebGlApi) {
      this.webglUnavailable.set(true);
      return;
    }

    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container) {
      this.webglUnavailable.set(true);
      return;
    }

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 5, 40000);
      camera.position.copy(this.defaultCameraPos);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = scene;
      this.camera = camera;
      this.renderer = renderer;

      this.setupLighting(scene);
      this.setupFloorShadow(scene);
      scene.add(this.moduleGroup);

      this.ngZone.runOutsideAngular(() => {
        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.autoRotate = this.isAutoRotating();
        controls.autoRotateSpeed = 2.0;
        controls.minPolarAngle = 0.14;
        controls.maxPolarAngle = Math.PI / 2 + 0.04;
        controls.target.copy(this.defaultCameraTarget);
        controls.update();

        controls.addEventListener('start', () => {
          this.isUserDragging = true;
          controls.autoRotate = false;
          this.needsRender = true;
        });
        controls.addEventListener('change', () => {
          this.needsRender = true;
        });
        controls.addEventListener('end', () => {
          this.isUserDragging = false;
          controls.autoRotate = this.isAutoRotating();
          this.needsRender = true;
        });

        this.controls = controls;

        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(() => {
            this.handleResize();
          });
          this.resizeObserver.observe(container);
        }

        this.startAnimationLoop();
      });

      this.isSceneReady.set(true);
      this.rebuildModuleScene(this.generatedParts(), this.effectiveMaterials());
    } catch {
      this.webglUnavailable.set(true);
      this.disposeThreeResources();
    }
  }

  private setupLighting(scene: THREE.Scene): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xe4e4e7, 0.72);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(1600, 2400, 1800);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 100;
    key.shadow.camera.far = 9000;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.keyLight = key;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xf0f9ff, 0.55);
    fill.position.set(-1600, 1200, -1400);
    scene.add(fill);

    const frontRim = new THREE.DirectionalLight(0xffffff, 0.35);
    frontRim.position.set(0, 700, 2200);
    scene.add(frontRim);
  }

  private setupFloorShadow(scene: THREE.Scene): void {
    const shadowPlaneGeo = new THREE.PlaneGeometry(12000, 12000);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.11 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.5;
    shadowPlane.receiveShadow = true;
    this.floorShadowMesh = shadowPlane;
    scene.add(shadowPlane);
  }

  private updateFloorGrid(spanMm: number): void {
    if (!this.scene) {
      return;
    }
    if (this.floorGrid) {
      this.scene.remove(this.floorGrid);
      this.disposeGrid(this.floorGrid);
      this.floorGrid = null;
    }

    const gridSpan = Math.max(1200, Math.ceil(spanMm / 200) * 200);
    const divisions = Math.max(10, Math.min(24, Math.round(gridSpan / 150)));
    const grid = new THREE.GridHelper(gridSpan, divisions, 0xd4d4d8, 0xe4e4e7);
    grid.position.y = -0.2;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const mat of gridMaterials) {
      mat.transparent = true;
      mat.opacity = 0.55;
    }
    this.floorGrid = grid;
    this.scene.add(grid);
  }

  private rebuildModuleScene(parts: Part[], mats: Material[]): void {
    if (!this.scene) {
      return;
    }

    this.disposeGroup(this.moduleGroup);
    this.moduleGroup.position.set(0, 0, 0);

    for (const part of parts) {
      const partObj = this.buildPartMesh(part, parts, mats);
      if (partObj) {
        this.moduleGroup.add(partObj);
      }
    }

    this.frameModuleToCamera();
    this.needsRender = true;
  }

  private buildPartMesh(part: Part, allParts: Part[], mats: Material[]): THREE.Object3D | null {
    const bounds = this.partGeometry.getWorldAABB(part);
    const localDims = this.partGeometry.getLocalDimensions(part);

    const geometry = this.buildPartGeometry(part, localDims.sx, localDims.sy, localDims.sz);
    const { isDoor, isDrawerFront } = this.classifyPartRole(part);
    const material = this.createPartMaterial(part, mats, isDoor || isDrawerFront);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(bounds.px, bounds.py, bounds.pz);

    if (part.rotationX || part.rotationY || part.rotationZ) {
      mesh.rotation.set(
        THREE.MathUtils.degToRad(part.rotationX || 0),
        THREE.MathUtils.degToRad(part.rotationY || 0),
        THREE.MathUtils.degToRad(part.rotationZ || 0),
        'XYZ'
      );
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edgeThreshold = part.shapeType === 'circle' ? 42 : 25;
    const edgeGeometry = this.getEdgesGeometry(geometry, edgeThreshold);
    const edgeMaterial = this.getCachedEdgeMaterial(isDoor || isDrawerFront, part.shapeType === 'circle');
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    mesh.add(edgeLines);

    if (isDoor || isDrawerFront) {
      const hw = part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part);
      const facing = this.joineryEngine.getPartFacingDirection(part, allParts);
      const hingeSide = this.resolveHingeSide(part, hw);
      const handleGroup = this.createHandleMesh(
        hw,
        localDims.sx,
        localDims.sy,
        localDims.sz,
        isDoor,
        hingeSide,
        facing
      );
      if (handleGroup) {
        mesh.add(handleGroup);
      }
    }

    return mesh;
  }

  private buildPartGeometry(part: Part, sx: number, sy: number, sz: number): THREE.BufferGeometry {
    if (part.shapeType === 'circle') {
      const radius = part.radius || (part.diameter ? part.diameter / 2 : Math.max(8, (part.width || 600) / 2));
      const isRod = Boolean(part.length && part.length > (part.thickness || 0) * 1.2);
      const cylHeight = isRod ? part.length : Math.max(1, part.thickness || 15);
      const orient = part.orientation || 'horizontal';
      const cylKey = `cyl_${radius}_${cylHeight}_${orient}_${isRod ? 'rod' : 'disc'}`;

      return this.getCachedGeometry(cylKey, () => {
        const geo = new THREE.CylinderGeometry(radius, radius, cylHeight, 36);
        if (isRod) {
          if (orient === 'horizontal') {
            geo.rotateZ(Math.PI / 2);
          } else if (orient === 'vertical_xy') {
            geo.rotateX(Math.PI / 2);
          }
        } else {
          if (orient === 'vertical_xy') {
            geo.rotateX(Math.PI / 2);
          } else if (orient === 'vertical_yz') {
            geo.rotateZ(Math.PI / 2);
          }
        }
        return geo;
      });
    }

    if (
      part.cornerCutConfig ||
      (part.shapeType === 'freehand' && part.contourPoints && part.contourPoints.length >= 3)
    ) {
      return this.partGeometry.buildExtrudedBoardGeometry(part);
    }

    const boxKey = `box_${sx}_${sy}_${sz}`;
    return this.getCachedGeometry(boxKey, () => new THREE.BoxGeometry(sx, sy, sz));
  }

  private createPartMaterial(part: Part, mats: Material[], isFront: boolean): THREE.Material {
    if (part.shapeType === 'circle' || part.materialId === 'hw_rod_chrome') {
      return this.getCachedMaterial('chrome_rod', () =>
        new THREE.MeshStandardMaterial({
          color: 0xd8e0e8,
          metalness: 0.88,
          roughness: 0.16
        })
      );
    }

    const assignedMat = mats.find(m => m.id === part.materialId);
    let colorHex = assignedMat?.colorHex || part.colorHex || '#F8FAFC';
    const texType = assignedMat?.textureType || 'solid';
    const grain = part.grain || 'length';

    const nameLow = (part.name || '').toLowerCase();
    const isBackOrBottom =
      part.componentRole === 'back' ||
      part.componentRole === 'drawer_bottom' ||
      (part.thickness <= 4 && part.componentRole !== 'countertop') ||
      ((nameLow.includes('fondo') || nameLow.includes('trasera')) &&
        part.componentRole !== 'countertop' &&
        part.componentRole !== 'backsplash');

    if (isBackOrBottom && texType === 'solid') {
      colorHex = '#E4E4E7';
    }

    const effectiveHex = isFront && texType === 'solid' ? this.computeFrontContrastHex(colorHex) : colorHex;
    const key = `part_${effectiveHex}_${texType}_${grain}_${isFront ? 'front' : 'body'}`;

    return this.getCachedMaterial(key, () => {
      let textureMap: THREE.CanvasTexture | null = null;
      if (typeof document !== 'undefined' && texType !== 'solid') {
        textureMap = ProceduralTextureFactory.getBoardTexture(effectiveHex, texType, grain, false);
      }

      const tintColor = isFront && texType !== 'solid'
        ? new THREE.Color(effectiveHex).multiplyScalar(0.95)
        : new THREE.Color(effectiveHex);

      return new THREE.MeshStandardMaterial({
        color: tintColor,
        map: textureMap,
        roughness: this.resolveRoughness(texType, isFront),
        metalness: this.resolveMetalness(texType, isFront)
      });
    });
  }

  private computeFrontContrastHex(hex: string): string {
    const color = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.l > 0.85) {
      color.setHSL(hsl.h, Math.min(1, hsl.s + 0.04), Math.max(0.75, hsl.l - 0.048));
    } else if (hsl.l < 0.22) {
      color.setHSL(hsl.h, hsl.s, Math.min(0.32, hsl.l + 0.06));
    } else {
      color.setHSL(hsl.h, hsl.s, Math.max(0.12, hsl.l - 0.035));
    }
    return `#${color.getHexString()}`;
  }

  private resolveRoughness(texType: string, isFront: boolean): number {
    switch (texType) {
      case 'wood':
        return isFront ? 0.56 : 0.65;
      case 'stone':
        return 0.25;
      case 'gloss':
        return 0.09;
      case 'linen':
        return 0.72;
      case 'wpc':
        return 0.58;
      default:
        return isFront ? 0.34 : 0.48;
    }
  }

  private resolveMetalness(texType: string, isFront: boolean): number {
    if (texType === 'stone') return 0.1;
    if (texType === 'gloss') return 0.15;
    if (texType === 'solid') return isFront ? 0.06 : 0.03;
    return 0.04;
  }

  private createHandleMesh(
    hw: PartHardwareConfig,
    sx: number,
    sy: number,
    sz: number,
    isDoor: boolean,
    hingeSide: HingeSide,
    facing: CardinalFacing
  ): THREE.Group | null {
    const handleType = hw.handleType || 'bar_modern';
    if (
      hw.handlePosition === 'none' ||
      handleType === 'none' ||
      handleType === 'push' ||
      handleType === 'push_open' ||
      handleType === 'finger_pull' ||
      handleType === 'gola_less'
    ) {
      return null;
    }

    const effectiveFinish: HandleFinish =
      hw.handleFinish || (handleType === 'bar_black' ? 'black' : 'brushed_steel');
    const hexColor = this.hardwareCatalog.getFinishHexColor(effectiveFinish);
    const metalness = effectiveFinish === 'black' ? 0.35 : 0.88;
    const roughness = effectiveFinish === 'black' ? 0.4 : 0.2;

    const handleMat = this.getCachedMaterial(`handle_${effectiveFinish}`, () =>
      new THREE.MeshStandardMaterial({
        color: hexColor,
        metalness,
        roughness
      })
    );

    const group = new THREE.Group();

    if (handleType === 'bar_modern' || handleType === 'bar_black') {
      const isHorizontalBar = !isDoor || hingeSide === 'top' || hingeSide === 'bottom';
      const maxSpan = isHorizontalBar ? sx : sy;
      const requestedLen = hw.handleLength || (handleType === 'bar_black' ? 192 : 160);
      const len = Math.max(40, Math.min(requestedLen, Math.max(48, maxSpan - 36)));

      const barGeo = handleType === 'bar_black'
        ? this.getCachedGeometry(`bar_box_${len}`, () => new THREE.BoxGeometry(10, len, 12))
        : this.getCachedGeometry(`bar_cyl_${len}`, () => new THREE.CylinderGeometry(5.5, 5.5, len, 16));
      const barMesh = new THREE.Mesh(barGeo, handleMat);

      const standoffGeo = this.getCachedGeometry('bar_standoff', () => {
        const g = new THREE.CylinderGeometry(4, 4, 22, 12);
        g.rotateX(Math.PI / 2);
        return g;
      });
      const standoffOffset = Math.max(12, len / 2 - 18);

      const standoff1 = new THREE.Mesh(standoffGeo, handleMat);
      standoff1.position.set(0, standoffOffset, -10);

      const standoff2 = new THREE.Mesh(standoffGeo, handleMat);
      standoff2.position.set(0, -standoffOffset, -10);

      group.add(barMesh, standoff1, standoff2);
    } else if (handleType === 'knob_round') {
      const stemGeo = this.getCachedGeometry('knob_r_stem', () => {
        const g = new THREE.CylinderGeometry(4, 6, 16, 14);
        g.rotateX(Math.PI / 2);
        return g;
      });
      const headGeo = this.getCachedGeometry('knob_r_head', () => {
        const g = new THREE.CylinderGeometry(14, 12, 9, 20);
        g.rotateX(Math.PI / 2);
        return g;
      });
      const stem = new THREE.Mesh(stemGeo, handleMat);
      stem.position.set(0, 0, -8);
      const head = new THREE.Mesh(headGeo, handleMat);
      head.position.set(0, 0, 4);
      group.add(stem, head);
    } else if (handleType === 'knob_square') {
      const stemGeo = this.getCachedGeometry('knob_s_stem', () => new THREE.BoxGeometry(8, 8, 16));
      const headGeo = this.getCachedGeometry('knob_s_head', () => new THREE.BoxGeometry(22, 22, 8));
      const stem = new THREE.Mesh(stemGeo, handleMat);
      stem.position.set(0, 0, -8);
      const head = new THREE.Mesh(headGeo, handleMat);
      head.position.set(0, 0, 4);
      group.add(stem, head);
    } else if (handleType === 'cup_vintage') {
      const backGeo = this.getCachedGeometry('cup_back', () => new THREE.BoxGeometry(92, 34, 4));
      const hoodGeo = this.getCachedGeometry('cup_hood', () => {
        const g = new THREE.CylinderGeometry(15, 15, 64, 18, 1, false, 0, Math.PI);
        g.rotateZ(Math.PI / 2);
        return g;
      });
      const back = new THREE.Mesh(backGeo, handleMat);
      back.position.set(0, 0, -9);
      const hood = new THREE.Mesh(hoodGeo, handleMat);
      hood.position.set(0, 0, -7);
      group.add(back, hood);
    }

    const isVerticalBar = handleType === 'bar_modern' || handleType === 'bar_black';
    if (isDoor) {
      const exteriorFaceZ = sz / 2 + 14;
      if (hingeSide === 'top') {
        if (isVerticalBar) group.rotation.z = Math.PI / 2;
        const bottomMargin = sy >= 120 ? 40 : Math.max(20, sy * 0.25);
        group.position.set(0, -sy / 2 + bottomMargin, exteriorFaceZ);
      } else if (hingeSide === 'bottom') {
        if (isVerticalBar) group.rotation.z = Math.PI / 2;
        const topMargin = sy >= 120 ? 40 : Math.max(20, sy * 0.25);
        group.position.set(0, sy / 2 - topMargin, exteriorFaceZ);
      } else {
        const marginX = sx >= 250 ? 42 : Math.max(20, sx * 0.16);
        const handleX = hingeSide === 'left' ? sx / 2 - marginX : -sx / 2 + marginX;
        const vertMargin = Math.min(115, Math.max(42, sy * 0.2));
        let handleY = 0;
        if (hw.handlePosition === 'top') {
          handleY = sy / 2 - vertMargin;
        } else if (hw.handlePosition === 'bottom') {
          handleY = -sy / 2 + vertMargin;
        }
        group.position.set(handleX, handleY, exteriorFaceZ);
      }
    } else {
      const barRoll = isVerticalBar ? Math.PI / 2 : 0;
      if (facing === 'right') {
        group.position.set(sx / 2 + 14, 0, 0);
        group.rotation.set(0, Math.PI / 2, barRoll, 'YXZ');
      } else if (facing === 'left') {
        group.position.set(-sx / 2 - 14, 0, 0);
        group.rotation.set(0, -Math.PI / 2, barRoll, 'YXZ');
      } else if (facing === 'back') {
        group.position.set(0, 0, -sz / 2 - 14);
        group.rotation.set(0, Math.PI, barRoll, 'YXZ');
      } else {
        group.position.set(0, 0, sz / 2 + 14);
        group.rotation.set(0, 0, barRoll, 'YXZ');
      }
    }

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });

    return group;
  }

  private classifyPartRole(part: Part): { isDoor: boolean; isDrawerFront: boolean } {
    const upperName = (part.name || '').toUpperCase();
    const role = part.componentRole;
    const isCarcass =
      role === 'side_left' ||
      role === 'side_right' ||
      role === 'top' ||
      role === 'bottom' ||
      role === 'plinth' ||
      role === 'back' ||
      role === 'shelf' ||
      role === 'tie' ||
      role === 'divider' ||
      role === 'countertop' ||
      role === 'backsplash';

    if (isCarcass) {
      return { isDoor: false, isDrawerFront: false };
    }

    const hw = part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part);
    const isDoor =
      (hw.movableType === 'door' || role === 'door' || upperName.includes('PUERTA')) &&
      !upperName.includes('CAJ');

    const isInternalDrawerBox =
      role === 'drawer_box' ||
      role === 'drawer_lateral' ||
      role === 'drawer_bottom' ||
      (upperName.includes('CAJ') &&
        (upperName.includes('LATERAL') ||
          upperName.includes('COSTADO') ||
          upperName.includes('TRASERA') ||
          upperName.includes('FONDO') ||
          upperName.includes('CONTRAFRENTE') ||
          upperName.includes('INTERIOR')));

    const isDrawerFront =
      !isDoor &&
      !isInternalDrawerBox &&
      (role === 'drawer_front' ||
        hw.movableType === 'drawer' ||
        (upperName.includes('FRENTE') && (upperName.includes('CAJ') || upperName.includes('GAVET'))));

    return { isDoor, isDrawerFront };
  }

  private resolveHingeSide(part: Part, hw: PartHardwareConfig): HingeSide {
    if (hw.openingDirection) {
      return hw.openingDirection;
    }
    const upperName = (part.name || '').toUpperCase();
    if (upperName.includes('BASCULANTE') || upperName.includes('ELEVABLE')) {
      return 'top';
    }
    if (upperName.includes('DER') || (part.posX || 0) > 0) {
      return 'right';
    }
    return 'left';
  }

  private frameModuleToCamera(): void {
    if (!this.camera || !this.controls) {
      return;
    }

    const box = new THREE.Box3().setFromObject(this.moduleGroup);
    let size = new THREE.Vector3(600, 800, 500);

    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      size = box.getSize(new THREE.Vector3());
      this.moduleGroup.position.set(-center.x, -box.min.y, -center.z);
    }

    const maxSpan = Math.max(size.x, size.y, size.z, 350);
    const radius = Math.max(180, size.length() * 0.5);

    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(0.5, this.camera.aspect || 1);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const minHalfFov = Math.min(vFov / 2, hFov / 2);
    const distance = (radius / Math.sin(minHalfFov)) * 1.16;

    const targetY = size.y * 0.48;
    this.defaultCameraTarget.set(0, targetY, 0);

    const dir = new THREE.Vector3(0.56, 0.36, 0.74).normalize();
    this.defaultCameraPos.copy(this.defaultCameraTarget).addScaledVector(dir, distance);

    this.camera.near = Math.max(2, distance * 0.01);
    this.camera.far = Math.max(20000, distance * 12);
    this.camera.position.copy(this.defaultCameraPos);
    this.camera.updateProjectionMatrix();

    this.controls.minDistance = Math.max(180, radius * 0.45);
    this.controls.maxDistance = Math.max(4500, distance * 3.5);
    this.controls.target.copy(this.defaultCameraTarget);
    this.controls.update();

    if (this.keyLight) {
      const frustum = maxSpan * 1.5;
      this.keyLight.position.set(maxSpan * 1.4, maxSpan * 2.2, maxSpan * 1.6);
      this.keyLight.shadow.camera.left = -frustum;
      this.keyLight.shadow.camera.right = frustum;
      this.keyLight.shadow.camera.top = frustum;
      this.keyLight.shadow.camera.bottom = -frustum;
      this.keyLight.shadow.camera.far = Math.max(6000, maxSpan * 7);
      this.keyLight.shadow.camera.updateProjectionMatrix();
    }

    this.updateFloorGrid(Math.max(size.x, size.z) * 2.4);
  }

  private handleResize(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container || !this.renderer || !this.camera) {
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.needsRender = true;
  }

  private startAnimationLoop(): void {
    const renderFrame = () => {
      if (this.isDestroyed || !this.renderer || !this.scene || !this.camera || !this.controls) {
        return;
      }

      const controlsChanged = this.controls.update();
      if (this.needsRender || controlsChanged || this.isAutoRotating() || this.isUserDragging) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }

      this.animationFrameId = requestAnimationFrame(renderFrame);
    };

    this.animationFrameId = requestAnimationFrame(renderFrame);
  }

  private applyAutoRotateState(): void {
    if (!this.controls) {
      return;
    }
    this.controls.autoRotate = this.isAutoRotating() && !this.isUserDragging;
    this.needsRender = true;
  }

  private getCachedGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const existing = this.geometryCache.get(key);
    if (existing) {
      return existing;
    }
    const created = factory();
    created.userData = { ...(created.userData || {}), isCached: true };
    this.geometryCache.set(key, created);
    return created;
  }

  private getEdgesGeometry(baseGeometry: THREE.BufferGeometry, thresholdAngle: number): THREE.EdgesGeometry {
    if (!baseGeometry.userData?.['isCached']) {
      return new THREE.EdgesGeometry(baseGeometry, thresholdAngle);
    }

    const edgeKey = `edges_${baseGeometry.uuid}_${thresholdAngle}`;
    const existing = this.geometryCache.get(edgeKey) as THREE.EdgesGeometry | undefined;
    if (existing) {
      return existing;
    }
    const created = new THREE.EdgesGeometry(baseGeometry, thresholdAngle);
    created.userData = { isCached: true };
    this.geometryCache.set(edgeKey, created);
    return created;
  }

  private getCachedMaterial(key: string, factory: () => THREE.Material): THREE.Material {
    const existing = this.materialCache.get(key);
    if (existing) {
      return existing;
    }
    const created = factory();
    created.userData = { ...(created.userData || {}), isCached: true };
    this.materialCache.set(key, created);
    return created;
  }

  private getCachedEdgeMaterial(isFront: boolean, isCircular: boolean): THREE.LineBasicMaterial {
    const key = isCircular ? 'edge_circular' : (isFront ? 'edge_front' : 'edge_body');
    return this.getCachedMaterial(key, () =>
      new THREE.LineBasicMaterial({
        color: isFront ? 0x71717a : 0xa1a1aa,
        transparent: true,
        opacity: isCircular ? 0.25 : (isFront ? 0.65 : 0.48)
      })
    ) as THREE.LineBasicMaterial;
  }

  private disposeGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          if (obj.geometry && !obj.geometry.userData?.['isCached']) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              for (const mat of obj.material) {
                if (mat && !mat.userData?.['isCached']) {
                  mat.dispose();
                }
              }
            } else if (!obj.material.userData?.['isCached']) {
              obj.material.dispose();
            }
          }
        }
      });
    }
  }

  private disposeGrid(grid: THREE.GridHelper): void {
    grid.geometry.dispose();
    if (Array.isArray(grid.material)) {
      for (const mat of grid.material) {
        mat.dispose();
      }
    } else {
      grid.material.dispose();
    }
  }
}
