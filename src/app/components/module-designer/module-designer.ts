import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  Alert02Icon,
  Archive01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  Delete02Icon,
  Edit02Icon,
  InformationCircleIcon,
  Layers01Icon,
  PaintBoardIcon,
  RulerIcon,
  Settings01Icon,
  Tag01Icon,
  Tick02Icon,
  ViewIcon
} from '@hugeicons/core-free-icons';
import { ProjectStorageService } from '../../services/project-storage.service';
import {
  ComponentRole,
  EdgeBandingType,
  Material,
  Part,
  PartGroup,
  ParametricDrawerConfig,
  PartOrientation,
  DrillHole,
  PartHardwareConfig,
  WorkspaceMode,
  RoomConfiguration,
  RoomWallInstance,
  getResolvedRoomWalls,
  rescaleWallsToFloor,
  RoomLayoutType,
  FloorMaterialType,
  WallMaterialType,
  DEFAULT_ROOM_CONFIG,
  FLOOR_FINISHES_CATALOG,
  WALL_FINISHES_CATALOG,
  FloorFinishCategory,
  WallFinishCategory,
  ApplianceItem,
  AppliancePreset,
  ApplianceFinish,
  ApplianceType,
  APPLIANCES_CATALOG_PRESETS,
  APPLIANCE_FINISH_OPTIONS,
  ParametricCabinetConfig,
  CountertopLayoutShape,
  HandleFinish,
  HandleType,
  LayerVisibilityState,
  PartCornerCutConfig,
  SpecialCutPresetType,
  isCountertopMaterial,
  DEFAULT_COUNTERTOP_MATERIALS
} from '../../models/melamine.models';
import { Furniture3dViewerComponent, ClearanceInfo } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { TechnicalSheetModalComponent } from '../technical-sheet-modal/technical-sheet-modal';
import { ComponentOptionsModalComponent } from '../component-options-modal/component-options-modal';
import { TemplatesModalComponent } from '../templates-modal/templates-modal';
import { FurnitureTemplate, TemplatesCatalogService } from '../../services/templates-catalog.service';

type HugeIconDef = typeof Compass01Icon;
const cadSvg = (paths: string[]): HugeIconDef =>
  paths.map((d, idx) => ['path', { d, key: `md_${idx}` }]) as unknown as HugeIconDef;

/**
 * Componente principal de diseño y modelado 3D (Modo Módulo y Modo Habitación 3D).
 * Coordina el visor Three.js, el inspector de propiedades de piezas, el catálogo de módulos
 * paramétricos, el asistente de cajones y la colocación de electrodomésticos.
 */
@Component({
  selector: 'app-module-designer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    HugeiconsIconComponent,
    Furniture3dViewerComponent,
    TechnicalSheetModalComponent,
    ComponentOptionsModalComponent,
    TemplatesModalComponent
  ],
  templateUrl: './module-designer.html',
  styleUrl: './module-designer.css',
  host: {
    '(window:keydown)': 'handleGlobalKeyDown($event)'
  }
})
export class ModuleDesignerComponent {
  readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly joineryEngine = inject(JoineryEngineService);
  private readonly dxfExporter = inject(DxfExporterService);
  private readonly cabinetGen = inject(CabinetGeneratorService);
  private readonly templatesCatalog = inject(TemplatesCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  readonly hardwareCatalog = inject(HardwareCatalogService);

  // Registro centralizado de iconos vectoriales para las barras flotantes, el panel derecho y los modales
  readonly icons = {
    cube3d: cadSvg([
      'M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z',
      'M12 12L20 7.5',
      'M12 12L4 7.5',
      'M12 12V21'
    ]),
    homeRoof: cadSvg([
      'M3 10.5L12 3L21 10.5',
      'M5 9.5V20H19V9.5',
      'M9.5 20V14H14.5V20'
    ]),
    templatesGrid: cadSvg([
      'M4 4H10V10H4V4Z',
      'M14 4H20V10H14V4Z',
      'M4 14H10V20H4V14Z',
      'M17 14V20',
      'M14 17H20'
    ]),
    tune: Settings01Icon,
    delete: Delete02Icon,
    sidebarToggle: cadSvg([
      'M4 5A1 1 0 0 1 5 4H19A1 1 0 0 1 20 5V19A1 1 0 0 1 19 20H5A1 1 0 0 1 4 19V5Z',
      'M15 4V20'
    ]),
    close: Cancel01Icon,
    edit: Edit02Icon,
    check: Tick02Icon,
    checkCircle: CheckmarkCircle02Icon,
    inbox: Archive01Icon,
    link: cadSvg([
      'M10 13A5 5 0 0 0 17.5 13.5L19.5 11.5A5 5 0 0 0 12.5 4.5L11 6',
      'M14 11A5 5 0 0 0 6.5 10.5L4.5 12.5A5 5 0 0 0 11.5 19.5L13 18'
    ]),
    unlink: cadSvg([
      'M10 14L14 10',
      'M7.5 16.5L5.5 18.5A3.5 3.5 0 0 1 5.5 13.5L7.5 11.5',
      'M16.5 7.5L18.5 5.5A3.5 3.5 0 0 1 18.5 10.5L16.5 12.5'
    ]),
    copy: cadSvg([
      'M9 9H19V19H9V9Z',
      'M5 15H4V4H15V5'
    ]),
    moveAxes: cadSvg([
      'M12 3V21',
      'M3 12H21',
      'M9.5 5.5L12 3L14.5 5.5',
      'M9.5 18.5L12 21L14.5 18.5',
      'M5.5 9.5L3 12L5.5 14.5',
      'M18.5 9.5L21 12L18.5 14.5'
    ]),
    doorClosed: cadSvg([
      'M5 3H19V21H5V3Z',
      'M12 3V21',
      'M9.5 11.5V12.5',
      'M14.5 11.5V12.5'
    ]),
    doorOpen: cadSvg([
      'M5 3H19V21H5V3Z',
      'M12 3L17.5 5.5V18.5L12 21V3Z',
      'M9.5 11.5V12.5'
    ]),
    rotateLeft: cadSvg([
      'M4 11A8 8 0 1 1 6.4 16.6',
      'M4 6V11H9'
    ]),
    rotateRight: cadSvg([
      'M20 11A8 8 0 1 0 17.6 16.6',
      'M20 6V11H15'
    ]),
    rotate: cadSvg([
      'M20 11A8 8 0 1 0 17.6 16.6',
      'M20 6V11H15'
    ]),
    compass: Compass01Icon,
    eye: ViewIcon,
    eyeOff: cadSvg([
      'M3 3L21 21',
      'M10.6 10.6A2 2 0 0 0 13.4 13.4',
      'M9.9 5.1A10.5 10.5 0 0 1 12 5C17 5 20.5 9 21.5 12C21 13.4 20.1 14.9 18.8 16.1',
      'M6.2 6.2C4.4 7.5 3.1 9.5 2.5 12C3.5 15 7 19 12 19C13.8 19 15.4 18.5 16.8 17.6'
    ]),
    squareShape: cadSvg(['M4 4H20V20H4V4Z']),
    circleShape: cadSvg(['M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z']),
    freehandWave: cadSvg(['M3.5 16.5C6.5 8.5 10 8.5 12 12.5C14 16.5 17.5 16.5 20.5 7.5']),
    magnet: cadSvg(['M6 4V11A6 6 0 0 0 18 11V4', 'M6 8H9', 'M15 8H18']),
    ruler: RulerIcon,
    alignLeft: cadSvg(['M4 4V20', 'M8 7H20V11H8V7Z', 'M8 13H16V17H8V13Z']),
    alignRight: cadSvg(['M20 4V20', 'M4 7H16V11H4V7Z', 'M8 13H16V17H8V13Z']),
    alignCenter: cadSvg(['M12 3V21', 'M6 7H18V11H6V7Z', 'M8 13H16V17H8V13Z']),
    alignBottom: cadSvg(['M4 20H20', 'M12 4V16', 'M8 12L12 16L16 12']),
    cameraFocus: cadSvg([
      'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8',
      'M16 4H18.5A1.5 1.5 0 0 1 20 5.5V8',
      'M20 16V18.5A1.5 1.5 0 0 1 18.5 20H16',
      'M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16',
      'M14 12A2 2 0 1 1 10 12A2 2 0 0 1 14 12Z'
    ]),
    chevronLeft: ArrowLeft01Icon,
    chevronRight: ArrowRight01Icon,
    arrowUp: ArrowUp01Icon,
    arrowDown: ArrowDown01Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    layers: Layers01Icon,
    selectAll: cadSvg([
      'M4 4H7', 'M10 4H14', 'M17 4H20V7',
      'M20 10V14', 'M20 17V20H17',
      'M14 20H10', 'M7 20H4V17',
      'M4 14V10', 'M8 8H16V16H8V8Z'
    ]),
    add: Add01Icon,
    minus: cadSvg(['M5 12H19']),
    appliance: cadSvg([
      'M6 3H18A1 1 0 0 1 19 4V20A1 1 0 0 1 18 21H6A1 1 0 0 1 5 20V4A1 1 0 0 1 6 3Z',
      'M5 10H19',
      'M8 6.5V7.5',
      'M8 13V16'
    ]),
    clearanceVert: cadSvg([
      'M8.5 8.5L12 5L15.5 8.5',
      'M8.5 15.5L12 19L15.5 15.5',
      'M5 3H19',
      'M5 21H19'
    ]),
    palette: PaintBoardIcon,
    cncTarget: cadSvg([
      'M20 12A8 8 0 1 1 4 12A8 8 0 0 1 20 12Z',
      'M14.5 12A2.5 2.5 0 1 1 9.5 12A2.5 2.5 0 0 1 14.5 12Z'
    ]),
    tableBar: cadSvg([
      'M3 7H21',
      'M5 7V19',
      'M19 7V19',
      'M3 10H21'
    ]),
    columns: cadSvg([
      'M4 4H20V20H4V4Z',
      'M9.5 4V20',
      'M14.5 4V20'
    ]),
    woodLeg: cadSvg([
      'M7 4H17L14.5 20H9.5L7 4Z',
      'M8.5 16H15.5'
    ]),
    cursorSelect: cadSvg(['M4.5 3.5L19.5 10.5L12.5 13L10 20L4.5 3.5Z']),
    tableRows: cadSvg([
      'M4 4H20V20H4V4Z',
      'M4 9.5H20',
      'M4 14.5H20'
    ]),
    shelfSplit: cadSvg([
      'M4 5H20',
      'M4 12H20',
      'M4 19H20',
      'M4 5V19',
      'M20 5V19'
    ]),
    plinthBottom: cadSvg([
      'M4 4H20V16H4V4Z',
      'M6 16V20H18V16'
    ]),
    externalLink: cadSvg([
      'M14 4H20V10',
      'M20 4L11 13',
      'M20 14V19A1 1 0 0 1 19 20H5A1 1 0 0 1 4 19V5A1 1 0 0 1 5 4H10'
    ]),
    listNumbered: CheckListIcon,
    currency: Tag01Icon,
    coffee: cadSvg([
      'M4 8H16V15A4 4 0 0 1 12 19H8A4 4 0 0 1 4 15V8Z',
      'M16 9H18.5A2.5 2.5 0 0 1 18.5 14H16',
      'M3 21H17'
    ]),
    sink: cadSvg([
      'M4 12H20V16A4 4 0 0 1 16 20H8A4 4 0 0 1 4 16V12Z',
      'M12 12V6A2.5 2.5 0 0 1 17 6V7'
    ]),
    hood: cadSvg([
      'M4 15L8 7H16L20 15H4Z',
      'M9 4V7',
      'M15 4V7',
      'M4 15V18H20V15'
    ]),
    cooktop: cadSvg([
      'M3 6H21V18H3V6Z',
      'M8.5 12A2.5 2.5 0 1 1 3.5 12',
      'M15.5 12A2.5 2.5 0 1 1 20.5 12'
    ]),
    microwave: cadSvg([
      'M3 6H21V18H3V6Z',
      'M6 9H14V15H6V9Z',
      'M17.5 10V10.5',
      'M17.5 13.5V14'
    ]),
    warning: Alert02Icon,
    info: InformationCircleIcon,
 expandArea: cadSvg([
      'M4 9V4H9',
      'M15 4H20V9',
      'M20 15V20H15',
      'M9 20H4V15'
    ]),
    lock: cadSvg([
      'M6 10V8A6 6 0 0 1 18 8V10',
      'M5 10H19A1 1 0 0 1 20 11V20A1 1 0 0 1 19 21H5A1 1 0 0 1 4 20V11A1 1 0 0 1 5 10Z',
      'M12 14V17'
    ]),
    unlock: cadSvg([
      'M6 10V8A6 6 0 0 1 18 8V6',
      'M5 10H19A1 1 0 0 1 20 11V20A1 1 0 0 1 19 21H5A1 1 0 0 1 4 20V11A1 1 0 0 1 5 10Z',
      'M12 14V17'
    ]),
    chair: cadSvg([
      'M7 4V12H17V4',
      'M6 12H18V15H6V12Z',
      'M7 15V20',
      'M17 15V20'
    ]),
    lamp: cadSvg([
      'M12 3V8',
      'M6 14L9 8H15L18 14H6Z',
      'M10 14A2 2 0 0 0 14 14'
    ]),
    windowFrame: cadSvg([
      'M4 4H20V20H4V4Z',
      'M12 4V20',
      'M4 12H20'
    ]),
    countertopPro: cadSvg([
      'M3 7H21V11H3V7Z',
      'M5 11V19H19V11',
      'M12 11V19'
    ]),
    chamferCut: cadSvg([
      'M4 4H14L20 10V20H4V4Z',
      'M14 4V10H20'
    ])
  };

  /**
   * Devuelve el icono vectorial de Hugeicons correspondiente al tipo o nombre de ícono de un electrodoméstico.
   */
  getApplianceHugeIcon(typeOrIcon: string): HugeIconDef {
    switch (typeOrIcon) {
      case 'refrigerator':
      case 'kitchen':
        return this.icons.appliance;
      case 'sink':
      case 'wash':
        return this.icons.sink;
      case 'hood':
      case 'air':
        return this.icons.hood;
      case 'cooktop':
      case 'mode_heat':
        return this.icons.cooktop;
      case 'coffee_maker':
      case 'coffee':
        return this.icons.coffee;
      case 'table_leg':
      case 'table_legs_set':
      case 'table_bar':
      case 'dining_table':
      case 'table_restaurant':
        return this.icons.tableBar;
      case 'bar_stool':
      case 'dining_chair':
      case 'chair':
        return this.icons.chair;
      case 'pendant_lamp':
      case 'light':
        return this.icons.lamp;
      case 'window_frame':
      case 'door_frame':
      case 'window':
      case 'door_front':
        return this.icons.windowFrame;
      case 'view_column':
        return this.icons.columns;
      case 'park':
        return this.icons.woodLeg;
      case 'microwave':
      case 'oven':
      default:
        return this.icons.microwave;
    }
  }

  // Referencia al visor 3D y al contenedor horizontal de chips de piezas
  readonly viewer3d = viewChild<Furniture3dViewerComponent>('viewer3d');
  readonly viewer3dRef = this.viewer3d;
  readonly chipsScrollContainer = viewChild<ElementRef<HTMLDivElement>>('chipsScrollContainer');

  // Signals principales sincronizados con ProjectStorageService
  readonly project = this.projectService.currentProject;
  readonly materials = this.projectService.materialsList;
  readonly currentParts = this.projectService.partsList;
  readonly defaultBoardThickness = computed(() => this.project().settings?.defaultBoardThickness || 15);

  // Estado del Modal de Opciones de Componente Paramétrico
  readonly selectedParametricConfig = signal<ParametricCabinetConfig | null>(null);
  readonly showComponentOptionsModal = signal<boolean>(false);

  /**
   * Abre el modal de configuración paramétrica precargando los valores de una plantilla.
   */
  onConfigureParametric(template: FurnitureTemplate) {
    if (template.parametricConfig) {
      this.selectedParametricConfig.set(template.parametricConfig as ParametricCabinetConfig);
    } else {
      this.selectedParametricConfig.set(null);
    }
    this.showComponentOptionsModal.set(true);
  }

  openCabinetOptionsModal() {
    this.selectedParametricConfig.set(null);
    this.showComponentOptionsModal.set(true);
  }

  /**
   * Genera e inserta un nuevo módulo paramétrico en la escena 3D calculando su desplazamiento X
   * automático para no superponerse con muebles existentes.
   */
  onCabinetSubmitted(config: ParametricCabinetConfig) {
    let targetX = config.posX ?? 0;
    if (this.currentParts().length > 0 && targetX === 0) {
      targetX = this.templatesCatalog.calculateTemplateOffset(this.currentParts(), config.width);
    }
    const finalConfig = { ...config, posX: targetX };
    const res = this.cabinetGen.generateParametricWallCabinet(finalConfig, this.materials());
    this.projectService.addParametricCabinet(res);

    const partIds = res.parts.map(p => p.id);
    this.selectedPartIds.set(partIds);
    const doorPart = res.parts.find(p => p.componentRole === 'door') || res.parts[0];
    if (doorPart) {
      this.selectedPartId.set(doorPart.id);
      this.activeDockTab.set('piece');
    }
    this.showToast(`✨ Módulo "${res.module.name}" insertado. Puedes moverlo libremente en 3D.`);
  }

  onCabinetCreated(event: { config: ParametricCabinetConfig; mode: 'replace' | 'append' }) {
    if (event.mode === 'replace') {
      this.projectService.clearFurniture();
    }
    this.onCabinetSubmitted(event.config);
    this.showTemplatesModal.set(false);
  }

  readonly showGroupMaterialDropdown = signal<boolean>(false);

  toggleGroupMaterialDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.showGroupMaterialDropdown.update(v => !v);
  }

  applyGroupMaterial(materialId: string, target: 'all' | 'structure' | 'doors' = 'all') {
    const gId = this.activeSelectedGroupId();
    if (gId) {
      this.projectService.changeGroupMaterial(gId, materialId, target);
      this.showToast('🎨 Material del módulo actualizado');
      this.showGroupMaterialDropdown.set(false);
    }
  }

  // Estado de selección en 3D (pieza individual, multiselección y luz libre)
  readonly selectedPartId = signal<string | null>(null);
  readonly selectedPartIds = signal<string[]>([]);
  readonly clearanceInfo = signal<ClearanceInfo | null>(null);

  readonly Math = Math;

  // Grupos y Cajones Modulares
  readonly groups = this.projectService.groupsList;

  readonly groupsWithParts = computed(() => {
    const grps = this.groups();
    const parts = this.currentParts();
    const partsByGroup = new Map<string, Part[]>();
    for (const p of parts) {
      if (!p.groupId) continue;
      let list = partsByGroup.get(p.groupId);
      if (!list) {
        list = [];
        partsByGroup.set(p.groupId, list);
      }
      list.push(p);
    }
    return grps
      .map(g => ({
        group: g,
        parts: partsByGroup.get(g.id) || []
      }))
      .filter(item => item.parts.length > 0);
  });

  readonly ungroupedParts = computed(() => {
    return this.currentParts().filter(p => !p.groupId);
  });

  /**
   * Obtiene los IDs únicos de todos los módulos/grupos involucrados en la selección actual.
   */
  readonly selectedGroupIds = computed<string[]>(() => {
    const ids = this.selectedPartIds();
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    const gIds = new Set<string>();
    for (const p of this.currentParts()) {
      if (p.groupId && idSet.has(p.id)) {
        gIds.add(p.groupId);
      }
    }
    return Array.from(gIds);
  });

  /**
   * Indica si hay 2 o más módulos seleccionados simultáneamente (Multi-Selección de Módulos).
   */
  readonly isMultiGroupSelected = computed<boolean>(() => {
    return this.selectedGroupIds().length > 1;
  });

  /**
   * Indica si hay una selección múltiple activa (múltiples módulos, piezas y/o electrodomésticos).
   */
  readonly isMultiSelection = computed<boolean>(() => {
    const partCount = this.selectedPartIds().length;
    const appCount = this.selectedApplianceIds().length;
    const total = partCount + appCount;
    if (total <= 1) return false;
    const gIds = this.selectedGroupIds();
    if (gIds.length > 1) return true;
    if (appCount > 0 && partCount > 0) return true;
    if (appCount > 1) return true;
    if (partCount > 1 && !this.isAnyGroupSelected()) return true;
    return false;
  });

  /**
   * Indica si la selección actual contiene 2 o más piezas que no forman ya un único módulo/grupo,
   * permitiendo agruparlas o reagruparlas como módulo o mesón 3D.
   */
  readonly canGroupSelection = computed<boolean>(() => {
    const ids = this.selectedPartIds();
    if (ids.length < 2) return false;
    const parts = this.selectedPartsList();
    const groupIds = new Set(parts.map(p => p.groupId).filter(Boolean));
    const allHaveSameGroup = groupIds.size === 1 && parts.every(p => p.groupId);
    return !allHaveSameGroup;
  });

  /**
   * Indica si la multiselección activa contiene piezas con rol de mesón o salpicadero.
   */
  readonly isCountertopMultiSelection = computed<boolean>(() => {
    const parts = this.selectedPartsList();
    if (parts.length === 0) return false;
    return parts.some(p =>
      p.componentRole === 'countertop' ||
      p.componentRole === 'backsplash' ||
      (p.name && (p.name.toUpperCase().includes('MESÓN') || p.name.toUpperCase().includes('MESON') || p.name.toUpperCase().includes('SALPICADERO')))
    );
  });

  /**
   * Colección de los módulos actualmente seleccionados.
   */
  readonly selectedGroups = computed<PartGroup[]>(() => {
    const gIds = this.selectedGroupIds();
    if (gIds.length === 0) return [];
    return gIds.map(id => {
      const found = this.groups().find(g => g.id === id);
      if (found) return found;
      const part = this.currentParts().find(p => p.groupId === id);
      return {
        id,
        name: part?.groupName || part?.moduleName || 'Módulo',
        type: 'assembly'
      } as PartGroup;
    });
  });

  /**
   * Módulos seleccionados con detalle de piezas para el panel inspector de multiselección.
   */
  readonly selectedGroupsWithCount = computed(() => {
    const gIds = this.selectedGroupIds();
    if (gIds.length === 0) return [];
    const parts = this.currentParts();
    return gIds.map(id => {
      const found = this.groups().find(g => g.id === id);
      const groupParts = parts.filter(p => p.groupId === id);
      const name = found?.name || groupParts[0]?.groupName || groupParts[0]?.moduleName || 'Módulo';
      return {
        id,
        name,
        partsCount: groupParts.length,
        type: found?.type || 'assembly'
      };
    });
  });

  /**
   * Identifica el ID del grupo activo cuando un ÚNICO módulo/cajón completo está seleccionado.
   * Si hay múltiples módulos seleccionados o si se aisló una sola pieza, devuelve null
   * para evitar mostrar funciones o cotas que no aplican a conjuntos dispares.
   */
  readonly activeSelectedGroupId = computed<string | null>(() => {
    const ids = this.selectedPartIds();
    if (ids.length === 0) return null;

    // Si hay más de un módulo en la selección, no hay un único grupo activo
    if (this.selectedGroupIds().length > 1) {
      return null;
    }

    if (ids.length === 1) {
      const sel = this.currentParts().find(p => p.id === ids[0]);
      if (sel?.groupId) {
        if (this.isCountertopGroup(sel.groupId)) {
          return sel.groupId;
        }
        const groupPartsCount = this.currentParts().filter(p => p.groupId === sel.groupId).length;
        if (groupPartsCount > 1) {
          return null; // Aislamiento de pieza individual dentro del módulo
        }
        return sel.groupId;
      }
      return null;
    }

    if (ids.length > 1) {
      const parts = this.currentParts().filter(p => ids.includes(p.id));
      const g = parts.find(p => p.groupId);
      if (g?.groupId) return g.groupId;
    }
    return null;
  });

  /**
   * Devuelve el grupo padre de la pieza seleccionada (incluso cuando se inspecciona una sola pieza del grupo).
   */
  readonly selectedPartParentGroup = computed<PartGroup | null>(() => {
    const sel = this.selectedPart();
    if (!sel?.groupId) return null;
    return this.groups().find(g => g.id === sel.groupId) || {
      id: sel.groupId,
      name: sel.groupName || sel.moduleName || 'Módulo',
      type: 'assembly'
    };
  });

  readonly selectedGroupParts = computed<Part[]>(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return [];
    return this.currentParts().filter(p => p.groupId === gId);
  });

  readonly selectedGroupStats = computed(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return null;
    const grpParts = this.currentParts().filter(p => p.groupId === gId);
    if (grpParts.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let structuralThickness = 15;
    let mainMaterialId = grpParts[0].materialId;

    for (const p of grpParts) {
      const b = this.joineryEngine.getPartBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    const isCt = this.isCountertopGroup(gId);
    if (isCt) {
      // En mesones 3D, el espesor del grupo debe ser exclusivamente el de la placa horizontal principal,
      // ignorando el espesor de 20 mm de los salpicaderos para que el inspector refleje 20, 30 o 40 mm exactos
      const horizontalSlab = grpParts.find(p =>
        p.orientation === 'horizontal' &&
        !p.name.toUpperCase().includes('SALPICADERO')
      ) || grpParts.find(p => p.componentRole === 'countertop' && !p.name.toUpperCase().includes('SALPICADERO')) || grpParts[0];

      structuralThickness = horizontalSlab.thickness || 30;
      mainMaterialId = horizontalSlab.materialId;
    } else {
      for (const p of grpParts) {
        if ((p.thickness || 15) > 8 && p.componentRole !== 'back') {
          structuralThickness = p.thickness || 15;
          mainMaterialId = p.materialId;
        }
      }
    }

    const mat = this.materials().find(m => m.id === mainMaterialId) || this.materials()[0] || null;

    return {
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      depth: Math.round(maxZ - minZ),
      thickness: structuralThickness,
      centerX: Math.round((minX + maxX) / 2),
      minY: Math.round(minY),
      centerZ: Math.round((minZ + maxZ) / 2),
      partsCount: grpParts.length,
      materialId: mainMaterialId,
      material: mat
    };
  });

  readonly activeSelectedGroupName = computed(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return null;
    const grp = this.groups().find(g => g.id === gId);
    return grp ? grp.name : 'Cajón';
  });

  readonly isAnyGroupSelected = computed(() => {
    return !!this.activeSelectedGroupId();
  });

  readonly currentGroupFacing = computed<'front' | 'right' | 'back' | 'left'>(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return 'front';
    return this.projectService.getGroupFacingDirection(gId);
  });

  readonly openGroupCardIds = signal<Set<string>>(new Set());

  // Estado del Asistente de Cajón Modular
  readonly showDrawerWizard = signal<boolean>(false);
  readonly drawerForm = signal<ParametricDrawerConfig>({
    name: 'Cajón 1',
    outerWidth: 400,
    slideLength: 450,
    boxHeight: 140,
    boxThickness: 15,
    bottomThickness: 3,
    slideGap: 26,
    includeFront: true,
    frontHeight: 180,
    frontWidth: 396,
    posX: 0,
    posY: 120,
    posZ: 0
  });

  // Modal de agrupación manual y renombrado en línea
  readonly showGroupNamingModal = signal<boolean>(false);
  readonly newGroupNameInput = signal<string>('Cajón 1');
  readonly renamingGroupId = signal<string | null>(null);
  readonly renamingGroupName = signal<string>('');
  readonly renamingPartId = signal<string | null>(null);
  readonly renamingPartName = signal<string>('');

  readonly isNewGroupNameDuplicate = computed(() => {
    const name = this.newGroupNameInput().trim();
    if (!name) return false;
    return this.isGroupNameTaken(name);
  });

  readonly suggestedUniqueGroupName = computed(() => {
    return this.getNextUniqueGroupName('Cajón');
  });

  readonly isDrawerWizardNameDuplicate = computed(() => {
    const name = this.drawerForm().name.trim();
    if (!name) return false;
    return this.isGroupNameTaken(name);
  });

  readonly suggestedDrawerWizardName = computed(() => {
    return this.getNextUniqueGroupName('Cajón');
  });

  // Control de visibilidad (Ocultar / Mostrar piezas, módulos y electrodomésticos con tecla H / Alt+H)
  readonly hiddenPartIds = signal<Set<string>>(new Set());
  readonly hiddenPartsCount = computed(() => this.hiddenPartIds().size);
  readonly hiddenAppliancesCount = computed(() => this.appliances().filter(a => a.isHidden).length);
  readonly hiddenModulesCount = computed(() => this.groups().filter(g => this.isGroupHidden(g.id)).length);
  readonly hiddenPiecesOnlyCount = computed(() => {
    const hiddenPIds = this.hiddenPartIds();
    const groupsHidden = this.groups().filter(g => this.isGroupHidden(g.id));
    const hiddenGroupPartIds = new Set(this.currentParts().filter(p => p.groupId && groupsHidden.some(g => g.id === p.groupId)).map(p => p.id));
    return Array.from(hiddenPIds).filter(id => !hiddenGroupPartIds.has(id)).length;
  });
  readonly totalHiddenCount = computed(() => this.hiddenPartIds().size + this.hiddenAppliancesCount());

  // Configuración del Modo Habitación 3D y Catálogos de Acabados Arquitectónicos
  readonly workspaceMode = signal<WorkspaceMode>('module');
  readonly roomConfig = signal<RoomConfiguration>(DEFAULT_ROOM_CONFIG);
  readonly showRoomSettingsModal = signal<boolean>(false);
  readonly selectedWall = signal<string | null>(null);
  readonly roomDockSubTab = signal<'wall' | 'environment' | 'finishes'>('wall');

  readonly resolvedWalls = computed(() => getResolvedRoomWalls(this.roomConfig()));
  readonly selectedWallInstance = computed(() => {
    const sel = this.selectedWall();
    if (!sel) return null;
    return this.resolvedWalls().find(w => w.id === sel) || null;
  });

  readonly floorCatalog = FLOOR_FINISHES_CATALOG;
  readonly wallCatalog = WALL_FINISHES_CATALOG;
  readonly activeFloorCategory = signal<FloorFinishCategory>('all');
  readonly activeWallCategory = signal<WallFinishCategory>('all');

  readonly filteredFloorCatalog = computed(() => {
    const cat = this.activeFloorCategory();
    if (cat === 'all') return this.floorCatalog;
    return this.floorCatalog.filter(item => item.category === cat);
  });

  readonly filteredWallCatalog = computed(() => {
    const cat = this.activeWallCategory();
    if (cat === 'all') return this.wallCatalog;
    return this.wallCatalog.filter(item => item.category === cat);
  });

  readonly showTechnicalSheetModal = signal<boolean>(false);
  readonly isDimensionsWidgetMinimized = signal<boolean>(false);

  // Notificación flotante tipo Toast con limpieza automática
  readonly toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showToast(msg: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(msg);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 2800);
  }

  /**
   * Atajos globales de teclado del diseñador 3D:
   * - Ctrl+Z / Ctrl+Y: Deshacer y Rehacer
   * - Delete / Backspace: Eliminar pieza, grupo o electrodoméstico seleccionado
   * - H / Alt+H: Ocultar selección o mostrar todas las piezas ocultas
   */
  handleGlobalKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (this.projectService.canUndo()) {
        this.projectService.undo();
        this.showToast('↺ Acción deshecha (Ctrl+Z)');
      }
      return;
    }

    if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      if (this.projectService.canRedo()) {
        this.projectService.redo();
        this.showToast('↻ Acción rehecha (Ctrl+Y)');
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
      if (this.workspaceMode() === 'room' && this.selectedWall()) {
        e.preventDefault();
        this.deleteWall(this.selectedWall()!);
        return;
      }

      const selAppId = this.selectedApplianceId();
      if (selAppId) {
        e.preventDefault();
        const app = this.selectedAppliance();
        const appName = app ? app.name : 'Equipo';
        this.projectService.removeAppliance(selAppId);
        this.showToast(`🗑️ "${appName}" eliminado (Delete)`);
        return;
      }

      const selIds = this.selectedPartIds();
      const selId = this.selectedPartId();

      if (selIds.length > 1) {
        e.preventDefault();
        const count = selIds.length;
        this.projectService.deleteMultipleParts(selIds);
        this.selectedPartIds.set([]);
        this.selectedPartId.set(null);
        this.activeDockTab.set('catalog');
        this.showToast(`🗑️ ${count} piezas eliminadas (Ctrl+Z para restaurar)`);
        return;
      }

      if (selId) {
        e.preventDefault();
        const part = this.currentParts().find(p => p.id === selId);
        const partName = part ? part.name : 'Pieza';
        this.projectService.deletePart(selId);
        const remaining = this.currentParts().filter(p => p.id !== selId);
        if (remaining.length > 0) {
          this.selectedPartId.set(remaining[0].id);
          this.selectedPartIds.set([remaining[0].id]);
        } else {
          this.selectedPartId.set(null);
          this.selectedPartIds.set([]);
          this.activeDockTab.set('catalog');
        }
        this.showToast(`🗑️ "${partName}" eliminada (Ctrl+Z para restaurar)`);
        return;
      }
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'h' || e.key === 'H')) {
      if (this.isAnyGroupSelected() || this.isMultiSelection()) {
        e.preventDefault();
        this.hideActiveGroup();
        return;
      } else if (this.selectedApplianceId()) {
        e.preventDefault();
        this.hideSelectedAppliance();
        return;
      } else if (this.selectedPartId()) {
        e.preventDefault();
        this.hideSelectedPart();
        return;
      }
    }

    // Atajo R: Rotar selección en 90° (idéntico a controles de cinta y panel lateral)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'r' || e.key === 'R')) {
      if (this.workspaceMode() === 'room' && this.selectedWall()) {
        e.preventDefault();
        this.rotateWall(this.selectedWall()!, 90);
        return;
      }
      if (this.selectedApplianceId() || this.selectedPartId() || this.selectedPartIds().length > 0 || this.isAnyGroupSelected()) {
        e.preventDefault();
        this.rotateSelectedGroup(90);
        return;
      }
    }

    if (e.altKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      this.showAllParts();
      return;
    }
  }

  // Pestaña activa de la bandeja derecha: 'piece', 'catalog' o 'appliances'
  readonly activeDockTab = signal<'piece' | 'catalog' | 'appliances'>('catalog');

  // Electrodomésticos y Accesorios 3D
  readonly appliances = this.projectService.appliancesList;
  readonly selectedApplianceId = this.projectService.selectedApplianceId;
  readonly selectedApplianceIds = this.projectService.selectedApplianceIds;
  readonly selectedAppliance = this.projectService.selectedAppliance;
  readonly selectedAppliances = computed(() => {
    const ids = this.selectedApplianceIds();
    return this.appliances().filter(a => ids.includes(a.id));
  });
  readonly activeModuleAppliances = computed(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return [];
    return this.appliances().filter(a => a.groupId === gId);
  });
  readonly appliancesCatalog = APPLIANCES_CATALOG_PRESETS;
  readonly applianceFinishOptions = APPLIANCE_FINISH_OPTIONS;
  readonly activeApplianceCategory = signal<'all' | 'cold' | 'cooking' | 'extraction' | 'washing' | 'microwave' | 'coffee' | 'legs' | 'seating' | 'lighting' | 'architecture'>('all');

  readonly filteredAppliances = computed(() => {
    const cat = this.activeApplianceCategory();
    if (cat === 'all') return this.appliancesCatalog;
    return this.appliancesCatalog.filter(a => a.category === cat);
  });

  getApplianceIcon(type: ApplianceType): string {
    switch (type) {
      case 'refrigerator': return 'kitchen';
      case 'sink': return 'wash';
      case 'hood': return 'air';
      case 'cooktop': return 'mode_heat';
      case 'microwave': return 'microwave';
      case 'coffee_maker': return 'coffee';
      case 'table_leg':
      case 'table_legs_set': return 'table_bar';
      case 'oven':
      default: return 'microwave';
    }
  }

  /**
   * Inserta un electrodoméstico o juego de patas desde el catálogo calculando su elevación
   * y posición inicial según el tipo de montaje (suelo, encimera, pared o empotrado).
   */
  addApplianceFromPreset(preset: AppliancePreset) {
    const config = this.roomConfig();
    const selPart = this.selectedPart();
    let posX = 0;
    let posY = 0;
    let posZ = 0;
    let targetWidth = preset.defaultWidth;
    let targetDepth = preset.defaultDepth;
    let targetHeight = preset.defaultHeight;

    if (preset.type === 'table_legs_set') {
      if (selPart && (selPart.orientation === 'horizontal' || !selPart.orientation)) {
        targetWidth = selPart.length;
        targetDepth = selPart.width;
        posX = selPart.posX || 0;
        posZ = selPart.posZ || 0;
        posY = 0;
        const partUnderside = (selPart.posY || 738) - (selPart.thickness || 18) / 2;
        if (partUnderside > 150) {
          targetHeight = partUnderside;
        }
      }
    } else if (preset.type === 'table_leg') {
      if (selPart) {
        posX = (selPart.posX || 0) + (selPart.length / 2 - 40);
        posZ = (selPart.posZ || 0) + (selPart.width / 2 - 40);
        posY = 0;
        const partUnderside = (selPart.posY || 738) - (selPart.thickness || 18) / 2;
        if (partUnderside > 150) {
          targetHeight = partUnderside;
        }
      }
    } else if (preset.type === 'coffee_maker') {
      if (selPart) {
        posX = selPart.posX || 0;
        posY = (selPart.posY || 0) + (selPart.thickness || 18) / 2;
        posZ = selPart.posZ || 0;
      } else {
        const parts = this.currentParts();
        let highestY = 0;
        for (const p of parts) {
          if (p.orientation === 'horizontal') {
            const top = (p.posY || 0) + (p.thickness || 18) / 2;
            if (top > highestY) highestY = top;
          }
        }
        posY = highestY > 0 ? highestY : 880;
        posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
      }
    } else if (preset.defaultMountType === 'floor') {
      posY = 0;
      posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
    } else if (preset.defaultMountType === 'countertop') {
      if (selPart && (selPart.orientation === 'horizontal' || !selPart.orientation)) {
        posX = selPart.posX || 0;
        posY = (selPart.posY || 0) + (selPart.thickness || 18) / 2;
        posZ = selPart.posZ || 0;
      } else {
        const parts = this.currentParts();
        let highestY = 0;
        for (const p of parts) {
          if (p.orientation === 'horizontal') {
            const top = (p.posY || 0) + (p.thickness || 18) / 2;
            if (top > highestY) highestY = top;
          }
        }
        posY = highestY > 0 ? highestY : 880;
        posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
      }
    } else if (preset.defaultMountType === 'wall') {
      if (preset.type === 'pendant_lamp') {
        posY = 1950;
        posZ = 650;
      } else if (preset.type === 'window_frame') {
        posY = 1050;
        posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
      } else {
        posY = preset.type === 'hood' ? 1500 : 1200;
        posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
      }
    } else if (preset.defaultMountType === 'built_in') {
      posY = 800;
      posZ = preset.defaultDepth / 2;
    }

    const newApp: ApplianceItem = {
      id: 'appliance_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: preset.type,
      name: preset.name,
      brand: preset.brand,
      modelCode: preset.modelCode,
      width: targetWidth,
      depth: targetDepth,
      height: targetHeight,
      finish: preset.defaultFinish,
      position: { x: posX, y: posY, z: posZ },
      rotation: 0,
      mountType: preset.defaultMountType,
      price: preset.defaultPrice,
      includeInBudget: true,
      notes: preset.description
    };

    this.projectService.addAppliance(newApp);
    this.deselectPart();
    this.activeDockTab.set('appliances');
    this.showToast(`✨ ${newApp.name} añadido`);
  }

  attachTableLegsToSelectedPart(style: 'hairpin' | 'cylindrical_inox' | 'scandinavian_wood' = 'hairpin') {
    const presetId = style === 'hairpin'
      ? 'preset_legs_hairpin_set'
      : (style === 'cylindrical_inox' ? 'preset_legs_cylindrical_inox_set' : 'preset_legs_scandinavian_wood_set');
    const preset = this.appliancesCatalog.find(p => p.id === presetId);
    if (!preset) return;

    this.addApplianceFromPreset(preset);
    this.showToast(`🛠️ Juego de patas (${style === 'hairpin' ? 'Horquilla' : (style === 'cylindrical_inox' ? 'Inox' : 'Nórdica')}) añadido a la mesa`);
  }

  selectAppliance(id: string | null) {
    this.projectService.selectAppliance(id);
    if (id) {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
      this.activeDockTab.set('appliances');
    }
  }

  updateApplianceDimension(prop: 'width' | 'depth' | 'height', val: number | string) {
    const sel = this.selectedAppliance();
    const num = Number(val);
    if (!sel || isNaN(num) || num <= 0) return;
    this.projectService.updateAppliance(sel.id, { [prop]: Math.round(num) });
  }

  updateAppliancePosition(axis: 'x' | 'y' | 'z', delta: number) {
    const sel = this.selectedAppliance();
    if (!sel) return;
    const currentPos = { ...sel.position };
    currentPos[axis] = Math.round(currentPos[axis] + delta);
    this.projectService.updateAppliance(sel.id, { position: currentPos });
  }

  setAppliancePositionDirect(axis: 'x' | 'y' | 'z', val: number | string) {
    const sel = this.selectedAppliance();
    const num = Number(val);
    if (!sel || isNaN(num)) return;
    const currentPos = { ...sel.position };
    currentPos[axis] = Math.round(num);
    this.projectService.updateAppliance(sel.id, { position: currentPos });
  }

  updateApplianceFinish(finish: ApplianceFinish) {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.updateAppliance(sel.id, { finish });
    const finishLabel = finish === 'stainless_steel' ? 'Acero Inox' : finish === 'black_matte' ? 'Negro Mate' : 'Blanco Brillante';
    this.showToast(`🎨 Acabado cambiado a ${finishLabel}`);
  }

  rotateAppliance(delta: 90 | -90 | 180) {
    const sel = this.selectedAppliance();
    if (!sel) return;
    let nextRot = (sel.rotation + delta) % 360;
    if (nextRot < 0) nextRot += 360;
    this.projectService.updateAppliance(sel.id, { rotation: nextRot });
  }

  snapSelectedAppliance(target: 'floor' | 'countertop' | 'wall' | 'auto') {
    const sel = this.selectedAppliance();
    const viewer = this.viewer3d();
    if (!sel || !viewer) return;
    viewer.snapApplianceToContact(sel, target);
    const targetLabel = target === 'floor' ? 'el suelo' : target === 'countertop' ? 'la mesada' : target === 'wall' ? 'la pared' : 'superficie';
    this.showToast(`🧲 Imán: adherido a ${targetLabel}`);
  }

  duplicateSelectedAppliance() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.duplicateAppliance(sel.id);
    this.showToast(`📋 Copia de "${sel.name}" creada`);
  }

  deleteSelectedAppliance() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    const name = sel.name;
    this.projectService.removeAppliance(sel.id);
    this.showToast(`🗑️ "${name}" retirado`);
  }

  toggleSelectedApplianceLock() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    const next = !sel.isLocked;
    this.projectService.updateAppliance(sel.id, { isLocked: next });
    this.showToast(next ? `🔒 "${sel.name}" inmovilizado (fijo)` : `🔓 "${sel.name}" desbloqueado para mover`);
  }

  hideSelectedAppliance() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.updateAppliance(sel.id, { isHidden: true });
    this.selectedApplianceId.set(null);
    this.selectedApplianceIds.set([]);
    this.activeDockTab.set('catalog');
    this.showToast(`👁️ "${sel.name}" oculto temporalmente (Alt+H para restaurar)`);
  }

  toggleApplianceBudgetInclusion() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.updateAppliance(sel.id, { includeInBudget: !sel.includeInBudget });
  }

  updateAppliancePrice(price: number | string) {
    const sel = this.selectedAppliance();
    const num = Number(price);
    if (!sel || isNaN(num) || num < 0) return;
    this.projectService.updateAppliance(sel.id, { price: Math.round(num) });
  }

  updateApplianceName(name: string) {
    const sel = this.selectedAppliance();
    if (!sel || !name.trim()) return;
    this.projectService.updateAppliance(sel.id, { name: name.trim() });
  }

  onApplianceSelectedFrom3D(app: ApplianceItem | null) {
    if (app) {
      this.projectService.selectAppliance(app.id);
      this.projectService.selectAppliances([app.id]);
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
      this.selectedWall.set(null);
      this.activeDockTab.set('appliances');
    } else {
      this.projectService.selectAppliance(null);
      this.projectService.selectAppliances([]);
    }
  }

  onAppliancesSelectedFrom3D(appIds: string[]) {
    this.projectService.selectAppliances(appIds);
    if (appIds.length > 0) {
      if (appIds.length === 1 && this.selectedPartIds().length === 0) {
        this.projectService.selectAppliance(appIds[0]);
        this.activeDockTab.set('appliances');
      } else {
        this.activeDockTab.set('piece');
      }
    }
  }

  onMultipleAppliancesModifiedFromViewer(evt: { updates: { id: string; updates: Partial<ApplianceItem> }[] }) {
    this.projectService.updateMultipleAppliances(evt.updates);
  }

  selectOnlyAppliance(appId: string) {
    this.selectedPartIds.set([]);
    this.selectedPartId.set(null);
    this.projectService.selectAppliance(appId);
    this.projectService.selectAppliances([appId]);
    this.activeDockTab.set('appliances');
  }

  toggleApplianceInSelection(appId: string) {
    this.projectService.toggleApplianceSelection(appId);
  }

  toggleApplianceModuleLink(applianceId: string, groupId: string | null) {
    this.projectService.linkApplianceToGroup(applianceId, groupId);
    const app = this.appliances().find(a => a.id === applianceId);
    const group = groupId ? this.groups().find(g => g.id === groupId) : null;
    if (groupId && group) {
      this.showToast(`🔗 "${app?.name || 'Equipo'}" vinculado al módulo "${group.name}"`);
    } else {
      this.showToast(`🔓 "${app?.name || 'Equipo'}" desvinculado (ahora es independiente)`);
    }
  }

  onApplianceModifiedFromViewer(evt: { appliance: ApplianceItem; updates: Partial<ApplianceItem> }) {
    this.projectService.updateAppliance(evt.appliance.id, evt.updates);
  }

  onApplianceDeletedFromViewer(id: string) {
    const app = this.appliances().find(a => a.id === id);
    const name = app ? app.name : 'Equipo';
    this.projectService.removeAppliance(id);
    this.showToast(`🗑️ "${name}" eliminado (Delete)`);
  }

  onApplianceDuplicatedFromViewer(id: string) {
    this.projectService.duplicateAppliance(id);
    this.showToast('📋 Electrodoméstico duplicado');
  }

  onApplianceDirectDimChange(appId: string, prop: 'width' | 'depth' | 'height', val: number | string) {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      this.projectService.updateAppliance(appId, { [prop]: Math.round(num) });
    }
  }

  // Control de colapso de la bandeja lateral y modal de plantillas/edición de módulos
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly showTemplatesDropdown = signal<boolean>(false);
  readonly showTemplatesModal = signal<boolean>(false);
  readonly editingGroupId = signal<string | null>(null);
  readonly editingGroupConfig = signal<ParametricCabinetConfig | null>(null);

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  openTemplatesModal() {
    this.editingGroupId.set(null);
    this.editingGroupConfig.set(null);
    this.showTemplatesDropdown.set(false);
    this.showTemplatesModal.set(true);
  }

  closeTemplatesModal() {
    this.showTemplatesModal.set(false);
    this.editingGroupId.set(null);
    this.editingGroupConfig.set(null);
  }

  isCountertopGroup(groupId: string | null | undefined): boolean {
    if (!groupId) return false;
    const grp = this.groups().find(g => g.id === groupId);
    if (grp?.isCountertop) return true;
    if (
      grp?.name &&
      (grp.name.toUpperCase().includes('MESÓN') ||
        grp.name.toUpperCase().includes('MESON') ||
        grp.name.toUpperCase().includes('ENCIMERA') ||
        grp.name.toUpperCase().includes('ISLA CASCADA'))
    ) {
      return true;
    }
    const parts = this.currentParts().filter(p => p.groupId === groupId);
    if (parts.length > 0) {
      return parts.some(
        p =>
          p.componentRole === 'countertop' ||
          p.componentRole === 'backsplash' ||
          p.name.toUpperCase().includes('MESÓN') ||
          p.name.toUpperCase().includes('MESON') ||
          p.name.toUpperCase().includes('SALPICADERO')
      );
    }
    return false;
  }

  readonly isSelectedGroupCountertop = computed<boolean>(() => {
    const gId = this.activeSelectedGroupId();
    if (gId && this.isCountertopGroup(gId)) {
      return true;
    }
    const ids = this.selectedPartIds();
    if (ids.length > 0) {
      const parts = this.currentParts().filter(p => ids.includes(p.id));
      if (
        parts.some(
          p =>
            p.componentRole === 'countertop' ||
            p.componentRole === 'backsplash' ||
            p.name.toUpperCase().includes('MESÓN') ||
            p.name.toUpperCase().includes('MESON') ||
            p.name.toUpperCase().includes('SALPICADERO')
        )
      ) {
        return true;
      }
    }
    const sel = this.selectedPart();
    if (
      sel &&
      (sel.componentRole === 'countertop' ||
        sel.componentRole === 'backsplash' ||
        sel.name.toUpperCase().includes('MESÓN') ||
        sel.name.toUpperCase().includes('MESON') ||
        sel.name.toUpperCase().includes('SALPICADERO') ||
        (sel.groupId && this.isCountertopGroup(sel.groupId)))
    ) {
      return true;
    }
    return false;
  });

  openEditSelectedGroup(event?: Event) {
    event?.stopPropagation();
    const gId = this.activeSelectedGroupId();
    if (gId) {
      this.openEditGroup(gId, event);
    }
  }

  /**
   * Abre el asistente paramétrico cargando las dimensiones actuales del grupo seleccionado.
   * Si el grupo es un Mesón / Encimera 3D, abre la pestaña Mesones 3D de Cocina Pro Studio.
   */
  openEditGroup(groupId: string, event?: Event) {
    event?.stopPropagation();
    this.viewer3d()?.cancelActiveInteractions();

    const parts = this.currentParts().filter(p => p.groupId === groupId);
    if (parts.length === 0) {
      this.showToast('⚠️ No se encontraron piezas para editar en este módulo');
      return;
    }

    if (this.appliances().some(a => a.groupId === groupId)) {
      this.showToast('ℹ️ Módulo Pro protegido con equipos integrados. Para cambiar dimensiones usa el inspector derecho.');
      return;
    }

    if (this.isCountertopGroup(groupId)) {
      this.showTemplatesDropdown.set(false);
      this.showKitchenProPanel.set(true);
      this.kitchenProTab.set('countertop');
      const isIsland = parts.some(p => p.name.includes('Cascada') || p.name.includes('Isla'));
      const isU = parts.some(p => p.name.includes('En U') || p.id.includes('meson_u_'));
      const isL = parts.some(p => p.name.includes('En L') || p.id.includes('meson_l_'));
      if (isIsland) this.countertopShape.set('island_waterfall');
      else if (isU) this.countertopShape.set('u_shape');
      else if (isL) this.countertopShape.set('l_shape');
      else this.countertopShape.set('straight');

      const ctParts = parts.filter(p => p.componentRole === 'countertop');
      const ctPart = ctParts.find(p => p.name.includes('Principal')) || ctParts[0] || parts[0];
      const returnPart = ctParts.find(p => p.name.includes('Retorno'));
      const bsPart = parts.find(p => p.componentRole === 'backsplash');
      if (ctPart) {
        this.countertopMaterialId.set(ctPart.materialId);
        if (ctPart.thickness === 20 || ctPart.thickness === 30 || ctPart.thickness === 40) {
          this.countertopThickness.set(ctPart.thickness);
        }
        this.countertopBacksplash.set(isIsland ? false : !!bsPart);
        if (ctPart.length >= 400) {
          this.countertopLength.set(Math.round(ctPart.length));
        }
        const depthVal = Math.min(Math.round(ctPart.width), 900);
        if (depthVal >= 300) {
          this.countertopDepth.set(depthVal);
        }
        if (returnPart) {
          const sideLen = Math.round(returnPart.width + ctPart.width);
          if (sideLen >= 600) {
            this.countertopSideLength.set(sideLen);
          }
        }
      }
      this.showToast('🪨 Configura el mesón en Cocina Pro o ajusta sus medidas directamente en el panel derecho');
      return;
    }

    const group = this.groups().find(g => g.id === groupId) || {
      id: groupId,
      name: parts[0]?.groupName || parts[0]?.moduleName || 'Módulo Paramétrico',
      type: 'assembly' as const
    };

    const safeConfig = this.cabinetGen.reconstructConfigFromParts(parts, group);
    this.editingGroupConfig.set({ ...safeConfig });
    this.editingGroupId.set(groupId);
    this.showTemplatesDropdown.set(false);
    this.showTemplatesModal.set(true);
  }

  /**
   * Actualiza un módulo paramétrico conservando su centro horizontal (X, Z), su nivel de apoyo (minY)
   * y su orientación de rotación en el espacio 3D.
   */
  onCabinetUpdated(event: { groupId: string; config: ParametricCabinetConfig }) {
    const groupParts = this.currentParts().filter(p => p.groupId === event.groupId);
    let oldMinX = Infinity, oldMaxX = -Infinity;
    let oldMinY = Infinity;
    let oldMinZ = Infinity, oldMaxZ = -Infinity;

    for (const p of groupParts) {
      const b = this.joineryEngine.getPartBounds(p);
      if (b.minX < oldMinX) oldMinX = b.minX;
      if (b.maxX > oldMaxX) oldMaxX = b.maxX;
      if (b.minY < oldMinY) oldMinY = b.minY;
      if (b.minZ < oldMinZ) oldMinZ = b.minZ;
      if (b.maxZ > oldMaxZ) oldMaxZ = b.maxZ;
    }

    const hasOldBounds = groupParts.length > 0 && Number.isFinite(oldMinX);
    const oldCx = hasOldBounds ? (oldMinX + oldMaxX) / 2 : (event.config.posX ?? 0);
    const oldCz = hasOldBounds ? (oldMinZ + oldMaxZ) / 2 : (event.config.posZ ?? 0);
    const baseMinY = hasOldBounds ? oldMinY : 0;
    const facing = this.projectService.getGroupFacingDirection(event.groupId);

    const finalConfig: ParametricCabinetConfig = {
      ...event.config,
      posX: 0,
      posY: (Number(event.config.height) || 800) / 2,
      posZ: 0
    };

    const res = this.cabinetGen.generateParametricCabinet(finalConfig, this.materials());
    const updatedParts = res.parts.map(p => ({
      ...p,
      groupId: event.groupId,
      groupName: finalConfig.name
    }));

    this.projectService.updateParametricCabinet(event.groupId, updatedParts, finalConfig.name, finalConfig);

    if (facing === 'right') {
      this.projectService.rotateGroupRigidly(event.groupId, -90);
    } else if (facing === 'left') {
      this.projectService.rotateGroupRigidly(event.groupId, 90);
    } else if (facing === 'back') {
      this.projectService.rotateGroupRigidly(event.groupId, 180);
    }

    const afterParts = this.currentParts().filter(p => p.groupId === event.groupId);
    if (afterParts.length > 0) {
      let newMinX = Infinity, newMaxX = -Infinity;
      let newMinY = Infinity;
      let newMinZ = Infinity, newMaxZ = -Infinity;
      for (const p of afterParts) {
        const b = this.joineryEngine.getPartBounds(p);
        if (b.minX < newMinX) newMinX = b.minX;
        if (b.maxX > newMaxX) newMaxX = b.maxX;
        if (b.minY < newMinY) newMinY = b.minY;
        if (b.minZ < newMinZ) newMinZ = b.minZ;
        if (b.maxZ > newMaxZ) newMaxZ = b.maxZ;
      }
      const newCx = (newMinX + newMaxX) / 2;
      const newCz = (newMinZ + newMaxZ) / 2;
      const dx = Math.round((oldCx - newCx) * 10) / 10;
      const dy = Math.round((baseMinY - newMinY) * 10) / 10;
      const dz = Math.round((oldCz - newCz) * 10) / 10;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || Math.abs(dz) > 0.1) {
        this.projectService.moveGroup(event.groupId, dx, dy, dz);
      }
    }

    this.showToast(`✨ Módulo "${finalConfig.name}" actualizado`);
    this.closeTemplatesModal();

    const partIds = updatedParts.map(p => p.id);
    this.selectedPartIds.set(partIds);
    if (partIds.length > 0) {
      this.selectedPartId.set(partIds[0]);
    }
  }

  toggleTemplatesDropdown() {
    this.showTemplatesDropdown.update(v => !v);
  }

  closeTemplatesDropdown() {
    this.showTemplatesDropdown.set(false);
  }

  readonly joineryData = computed(() => {
    return this.joineryEngine.calculateJoinery(this.currentParts());
  });

  readonly selectedPartDrillHoles = computed<DrillHole[]>(() => {
    const sel = this.selectedPart();
    if (!sel) return [];
    return this.joineryData().drillHolesByPart.get(sel.id) || [];
  });

  readonly selectedGroupDrillHolesCount = computed<number>(() => {
    const grpParts = this.selectedGroupParts();
    if (grpParts.length === 0) return 0;
    const map = this.joineryData().drillHolesByPart;
    let total = 0;
    for (const p of grpParts) {
      total += (map.get(p.id) || []).length;
    }
    return total;
  });

  readonly selectedPart = computed<Part | null>(() => {
    const id = this.selectedPartId();
    if (!id) return null;
    return this.currentParts().find(p => p.id === id) || null;
  });

  readonly selectedPartMaterial = computed<Material | null>(() => {
    const sel = this.selectedPart();
    if (!sel) return null;
    return this.materials().find(m => m.id === sel.materialId) || null;
  });

  readonly selectedPartsList = computed<Part[]>(() => {
    const ids = this.selectedPartIds();
    return this.currentParts().filter(p => ids.includes(p.id));
  });

  readonly totalAreaM2 = computed(() => {
    const parts = this.currentParts();
    const sumMm2 = parts.reduce((acc, p) => acc + (p.length * p.width * p.quantity), 0);
    return (sumMm2 / 1_000_000).toFixed(2);
  });

  /**
   * Calcula las dimensiones envolventes totales del mobiliario (Ancho × Alto × Fondo)
   * delegando el cálculo geométrico de cada pieza a JoineryEngineService.
   */
  readonly overallDimensions = computed(() => {
    const parts = this.currentParts();
    if (parts.length === 0) return { width: 0, height: 0, depth: 0 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of parts) {
      const b = this.joineryEngine.getPartBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    return {
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      depth: Math.round(maxZ - minZ)
    };
  });

  updatePartDimension(prop: 'length' | 'width' | 'thickness', rawVal: number | string) {
    const val = Number(rawVal);
    if (isNaN(val) || val <= 0) return;
    if (prop === 'thickness') {
      this.onThicknessChange(val);
    } else {
      this.updateSelectedPart({ [prop]: Math.round(val) });
    }
  }

  swapDimensions() {
    const sel = this.selectedPart();
    if (!sel) return;
    this.updateSelectedPart({
      length: sel.width,
      width: sel.length
    });
    this.showToast('🔄 Dimensiones intercambiadas (Largo ↔ Ancho)');
  }

  toggleDimensionsWidget() {
    this.isDimensionsWidgetMinimized.update(v => !v);
  }

  constructor() {
    const parts = this.currentParts();
    if (parts.length > 0) {
      const topPart = parts.find(p => p.name.toUpperCase().includes('TECHO') || p.id === 'desk_top') || parts[0];
      this.selectedPartId.set(topPart.id);
      this.selectedPartIds.set([topPart.id]);
      this.activeDockTab.set('piece');
    }

    // Sincronizar roomConfig si se modifica desde la Configuración de Proyecto (Header)
    effect(() => {
      const projRoom = this.project().roomConfig;
      if (projRoom) {
        const cur = this.roomConfig();
        if (
          cur.floorWidth !== projRoom.floorWidth ||
          cur.floorDepth !== projRoom.floorDepth ||
          cur.mainWallLength !== projRoom.mainWallLength ||
          cur.sideWallLength !== projRoom.sideWallLength ||
          cur.rightWallLength !== projRoom.rightWallLength ||
          cur.wallHeight !== projRoom.wallHeight ||
          cur.layout !== projRoom.layout
        ) {
          this.roomConfig.set({ ...cur, ...projRoom });
        }
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
    });
  }

  // --- SELECCIÓN DE PIEZAS Y GRUPOS ---

  onSelectPartFrom3D(part: Part | null) {
    if (part) {
      this.selectedWall.set(null);
      // Si ya hay una multiselección activa que contiene a esta pieza (por Shift+Clic, Todo o lazo),
      // la preservamos intacta y solo actualizamos la pieza activa en el inspector
      if (this.selectedPartIds().length > 1 && this.selectedPartIds().includes(part.id)) {
        this.selectedPartId.set(part.id);
        this.activeDockTab.set('piece');
        return;
      }

      if (this.isCountertopGroup(part.groupId) || part.componentRole === 'countertop' || part.componentRole === 'backsplash') {
        // En mesones y salpicaderos clicados individualmente sin multiselección previa,
        // seleccionamos el tramo individual para ajustar dimensiones y ver tirantes 3D
        this.selectedPartId.set(part.id);
        this.selectedPartIds.set([part.id]);
        this.activeDockTab.set('piece');
        return;
      }

      if (this.selectedPartIds().includes(part.id)) {
        this.selectedPartId.set(part.id);
        this.activeDockTab.set('piece');
        return;
      }
      this.selectedPartId.set(part.id);
      if (part.groupId) {
        const groupParts = this.currentParts().filter(p => p.groupId === part.groupId);
        this.selectedPartIds.set(groupParts.map(p => p.id));
      } else {
        this.selectedPartIds.set([part.id]);
      }
      this.activeDockTab.set('piece');
    } else {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
    }
  }

  onPartsSelectedFrom3D(partIds: string[]) {
    this.selectedPartIds.set(partIds);
    if (partIds.length > 0) {
      this.selectedWall.set(null);
      if (!this.selectedPartId() || !partIds.includes(this.selectedPartId()!)) {
        this.selectedPartId.set(partIds[partIds.length - 1]);
      }
      this.activeDockTab.set('piece');
    } else {
      this.selectedPartId.set(null);
    }
  }

  selectAllParts() {
    const all = this.currentParts().map(p => p.id);
    this.selectedPartIds.set(all);
    if (all.length > 0) {
      this.selectedPartId.set(all[0]);
    }
  }

  deselectAll() {
    this.selectedPartId.set(null);
    this.selectedPartIds.set([]);
    this.projectService.selectAppliances([]);
    this.projectService.selectAppliance(null);
    this.selectedWall.set(null);
    this.activeDockTab.set('catalog');
  }

  isPartSelected(id: string): boolean {
    return this.selectedPartId() === id || this.selectedPartIds().includes(id);
  }

  onChipClick(id: string, event: MouseEvent) {
    this.selectPartById(id, event);
  }

  selectSinglePartById(id: string, event?: Event) {
    event?.stopPropagation();
    const targetPart = this.currentParts().find(p => p.id === id);
    if (targetPart?.groupId && this.isCountertopGroup(targetPart.groupId)) {
      // Mesón y salpicadero forman una unidad rígida monolítica indivisible
      const groupParts = this.currentParts().filter(p => p.groupId === targetPart.groupId);
      this.selectedPartId.set(id);
      this.selectedPartIds.set(groupParts.map(p => p.id));
      this.activeDockTab.set('piece');
      return;
    }
    this.selectedPartId.set(id);
    this.selectedPartIds.set([id]);
    this.activeDockTab.set('piece');
  }

  selectPartById(id: string, e?: MouseEvent) {
    const targetPart = this.currentParts().find(p => p.id === id);
    if (e && e.shiftKey) {
      const cur = [...this.selectedPartIds()];
      const isUngrouped = !targetPart?.groupId;
      const idsToToggle = (isUngrouped || this.isCountertopGroup(targetPart?.groupId))
        ? [id]
        : this.currentParts().filter(p => p.groupId === targetPart?.groupId).map(p => p.id);

      const allPresent = idsToToggle.every(tid => cur.includes(tid));
      if (allPresent) {
        for (const tid of idsToToggle) {
          const idx = cur.indexOf(tid);
          if (idx >= 0) cur.splice(idx, 1);
        }
      } else {
        for (const tid of idsToToggle) {
          if (!cur.includes(tid)) cur.push(tid);
        }
      }
      this.selectedPartIds.set(cur);
      this.selectedPartId.set(cur.length > 0 ? (cur.includes(id) ? id : cur[0]) : null);
      if (cur.length > 0) {
        this.activeDockTab.set('piece');
      }
    } else {
      this.selectedPartId.set(id);
      if (targetPart?.groupId && !this.isCountertopGroup(targetPart.groupId)) {
        const groupParts = this.currentParts().filter(p => p.groupId === targetPart.groupId);
        this.selectedPartIds.set(groupParts.map(p => p.id));
      } else {
        this.selectedPartIds.set([id]);
      }
      this.activeDockTab.set('piece');
    }
  }

  getGroupName(groupId?: string): string {
    if (!groupId) return 'Módulo';
    const grp = this.groups().find(g => g.id === groupId);
    return grp ? grp.name : 'Módulo';
  }

  deselectPart() {
    this.deselectAll();
  }

  // --- EDICIÓN EN TIEMPO REAL DE PIEZAS Y GRUPOS ---

  /**
   * Permite realizar scroll lateral suave en la cinta inferior de piezas usando la rueda del ratón.
   */
  onPiecesBarWheel(event: WheelEvent) {
    const el = this.chipsScrollContainer()?.nativeElement;
    if (!el) return;
    if (Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0) {
      event.preventDefault();
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      el.scrollLeft += delta;
    }
  }

  onChipsScrollWheel(event: WheelEvent, container?: HTMLElement) {
    const el = container || (event.currentTarget as HTMLElement) || this.chipsScrollContainer()?.nativeElement;
    if (!el) return;
    if (Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0) {
      event.preventDefault();
      event.stopPropagation();
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      el.scrollLeft += delta;
    }
  }

  /**
   * Actualiza las propiedades de la pieza seleccionada. Si se modifican coordenadas espaciales
   * (posX, posY, posZ) y el módulo/grupo completo está seleccionado, desplaza todo el grupo en bloque
   * impidiendo que cualquier pieza o módulo sobrepase el nivel del suelo (Y = 0).
   */
  updateSelectedPart(changes: Partial<Part>) {
    const current = this.selectedPart();
    if (!current) return;

    if (this.isAnyGroupSelected() && current.groupId && (changes.posX !== undefined || changes.posY !== undefined || changes.posZ !== undefined)) {
      const dx = changes.posX !== undefined ? changes.posX - (current.posX ?? 0) : 0;
      let dy = changes.posY !== undefined ? changes.posY - (current.posY ?? 0) : 0;
      const dz = changes.posZ !== undefined ? changes.posZ - (current.posZ ?? 0) : 0;

      if (dy !== 0) {
        const groupParts = this.currentParts().filter(p => p.groupId === current.groupId);
        let grpMinY = Infinity;
        for (const gp of groupParts) {
          const b = this.joineryEngine.getPartBounds(gp);
          if (b.minY < grpMinY) grpMinY = b.minY;
        }
        if (grpMinY !== Infinity) {
          dy = Math.max(-grpMinY, dy);
        }
      }

      if (dx !== 0 || dy !== 0 || dz !== 0) {
        this.projectService.moveGroup(current.groupId, dx, dy, dz);
        const nonPosChanges = { ...changes };
        delete nonPosChanges.posX;
        delete nonPosChanges.posY;
        delete nonPosChanges.posZ;
        if (Object.keys(nonPosChanges).length > 0) {
          this.projectService.updatePart({ ...current, ...nonPosChanges });
        }
        return;
      }
    }

    const updated: Part = {
      ...current,
      ...changes
    };

    // Asegurar que la base inferior de la pieza nunca quede por debajo del piso (minY >= 0)
    const bounds = this.joineryEngine.getPartBounds(updated);
    const minPosY = Math.round(bounds.sy / 2);
    if ((updated.posY ?? 0) < minPosY) {
      updated.posY = minPosY;
    }

    this.projectService.updatePart(updated);
  }

  /**
   * Redimensiona el módulo/grupo activo en bloque (Ancho, Alto, Profundidad o Espesor Estructural)
   * y sincroniza la selección de piezas para mantener el módulo activo tras regeneraciones paramétricas.
   */
  updateSelectedGroupDimension(
    prop: 'width' | 'height' | 'depth' | 'thickness',
    rawVal: number | string
  ) {
    const gId = this.activeSelectedGroupId();
    if (!gId) return;
    const val = Number(rawVal);
    if (isNaN(val) || val <= 0) return;
    this.projectService.resizeGroupStructure(gId, prop, val);
    this.syncGroupSelectionAfterUpdate(gId);
  }

  adjustSelectedGroupDimension(
    prop: 'width' | 'height' | 'depth' | 'thickness',
    delta: number
  ) {
    const stats = this.selectedGroupStats();
    if (!stats) return;
    const current = stats[prop];
    const minVal = prop === 'thickness' ? 3 : 120;
    const nextVal = Math.max(minVal, current + delta);
    this.updateSelectedGroupDimension(prop, nextVal);
  }

  onGroupResizeRequestedFromViewer(event: {
    groupId: string;
    prop: 'width' | 'height' | 'depth' | 'thickness';
    value: number;
  }) {
    this.projectService.resizeGroupStructure(event.groupId, event.prop, event.value);
    this.syncGroupSelectionAfterUpdate(event.groupId);
  }

  private syncGroupSelectionAfterUpdate(groupId: string) {
    const updatedParts = this.currentParts().filter(p => p.groupId === groupId);
    if (updatedParts.length > 0) {
      this.selectedPartIds.set(updatedParts.map(p => p.id));
      if (!this.selectedPartId() || !updatedParts.some(p => p.id === this.selectedPartId())) {
        this.selectedPartId.set(updatedParts[0].id);
      }
    }
  }

  updateSelectedGroupPosition(axis: 'x' | 'y' | 'z', rawTargetVal: number | string) {
    const gId = this.activeSelectedGroupId();
    const stats = this.selectedGroupStats();
    const targetVal = Number(rawTargetVal);
    if (!gId || !stats || isNaN(targetVal)) return;

    if (axis === 'x') {
      const dx = Math.round(targetVal) - stats.centerX;
      if (dx !== 0) this.projectService.moveGroup(gId, dx, 0, 0);
    } else if (axis === 'y') {
      const safeTargetY = Math.max(0, Math.round(targetVal));
      const dy = safeTargetY - stats.minY;
      if (dy !== 0) this.projectService.moveGroup(gId, 0, dy, 0);
    } else if (axis === 'z') {
      const dz = Math.round(targetVal) - stats.centerZ;
      if (dz !== 0) this.projectService.moveGroup(gId, 0, 0, dz);
    }
  }

  adjustSelectedGroupPosition(axis: 'x' | 'y' | 'z', delta: number) {
    const stats = this.selectedGroupStats();
    if (!stats) return;
    const current = axis === 'x' ? stats.centerX : (axis === 'y' ? stats.minY : stats.centerZ);
    this.updateSelectedGroupPosition(axis, current + delta);
  }

  alignSelectedGroup(preset: 'floor' | 'centerX' | 'centerZ') {
    if (preset === 'floor') {
      this.updateSelectedGroupPosition('y', 0);
      this.showToast('📐 Módulo apoyado sobre el suelo (Y = 0)');
    } else if (preset === 'centerX') {
      this.updateSelectedGroupPosition('x', 0);
      this.showToast('📐 Módulo centrado en X (X = 0)');
    } else if (preset === 'centerZ') {
      this.updateSelectedGroupPosition('z', 0);
      this.showToast('📐 Módulo centrado en profundidad (Z = 0)');
    }
  }

  testPieceAnimation(partId: string) {
    this.viewer3d()?.togglePartOpen(partId);
  }

  updateSelectedPartRole(role: ComponentRole) {
    const sel = this.selectedPart();
    if (!sel) return;
    let hw = sel.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(sel);
    if (role === 'door') {
      hw = {
        ...hw,
        isMovable: true,
        movableType: 'door',
        openingDirection: hw.openingDirection || 'left',
        hingeType: hw.hingeType && hw.hingeType !== 'none' ? hw.hingeType : 'straight',
        handleType: hw.handleType && hw.handleType !== 'none' ? hw.handleType : 'bar_modern',
        handleFinish: hw.handleFinish || 'brushed_steel'
      };
    } else if (role === 'drawer_front') {
      hw = {
        ...hw,
        isMovable: true,
        movableType: 'drawer',
        slideType: hw.slideType && hw.slideType !== 'none' ? hw.slideType : 'telescopic',
        handleType: hw.handleType && hw.handleType !== 'none' ? hw.handleType : 'bar_modern',
        handleFinish: hw.handleFinish || 'brushed_steel'
      };
    } else {
      hw = {
        ...hw,
        isMovable: false,
        movableType: 'none',
        handleType: 'none',
        hingeType: 'none',
        slideType: 'none'
      };
    }
    this.updateSelectedPart({ componentRole: role, hardwareConfig: hw });
  }

  updateSelectedPartHardware(updates: Partial<PartHardwareConfig>) {
    const sel = this.selectedPart();
    if (!sel) return;
    const hw: PartHardwareConfig = {
      ...(sel.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(sel)),
      ...updates
    };
    this.updateSelectedPart({ hardwareConfig: hw });
  }

  onDragStarted() {
    this.projectService.pushSnapshot();
  }

  onPartModifiedFromViewer(event: { part: Part; updates: Partial<Part> }) {
    const targetPart = this.currentParts().find(p => p.id === event.part.id) || event.part;
    const updated: Part = {
      ...targetPart,
      ...event.updates
    };
    this.projectService.updatePart(updated, false);
  }

  onMultiplePartsModifiedFromViewer(event: { updates: { part: Part; updates: Partial<Part> }[] }) {
    const updatesList = event.updates.map(u => ({ partId: u.part.id, updates: u.updates }));
    this.projectService.updateMultipleParts(updatesList, false);
  }

  onPartCreatedFromViewer(partData: Partial<Part>) {
    const defaultMat = this.materials()[0];
    const defaultT = this.projectService.currentProject().settings.defaultBoardThickness || 15;
    const resolvedT = partData.thickness || defaultT;
    const newPart: Part = {
      id: crypto.randomUUID(),
      name: partData.name || `Pieza ${this.currentParts().length + 1}`,
      length: partData.length || 600,
      width: partData.width || 400,
      thickness: resolvedT,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Blanco Frost Mate',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: partData.posX ?? 0,
      posY: partData.posY ?? (resolvedT / 2),
      posZ: partData.posZ ?? 0,
      orientation: partData.orientation || 'horizontal',
      componentRole: 'free',
      shapeType: partData.shapeType || 'rectangle',
      radius: partData.radius,
      diameter: partData.diameter,
      contourPoints: partData.contourPoints
    };
    this.projectService.addPart(newPart);
    this.selectedPartId.set(newPart.id);
    this.selectedPartIds.set([newPart.id]);
    this.activeDockTab.set('piece');
  }

  onPartDeletedFromViewer(partId: string) {
    this.projectService.deletePart(partId);
    if (this.selectedPartId() === partId) {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
    }
  }

  onPartDuplicatedFromViewer(part: Part) {
    const cloned = this.projectService.duplicatePart(part.id);
    if (cloned) {
      this.selectedPartId.set(cloned.id);
      this.selectedPartIds.set([cloned.id]);
      this.activeDockTab.set('piece');
    }
  }

  onMaterialChange(matId: string) {
    const mat = this.materials().find(m => m.id === matId) || this.countertopMaterials().find(m => m.id === matId);
    if (!mat) return;

    if (this.isSelectedGroupCountertop()) {
      const gId = this.activeSelectedGroupId() || this.selectedPart()?.groupId;
      if (gId) {
        this.projectService.changeGroupMaterial(gId, mat.id, 'all');
        this.countertopMaterialId.set(mat.id);
        this.showToast(`🪨 Mesón y salpicaderos actualizados a "${mat.name}"`);
        return;
      }
    }

    this.updateSelectedPart({
      materialId: mat.id,
      materialName: mat.name
    });
  }

  onThicknessChange(thickness: number) {
    if (isNaN(thickness) || thickness <= 0) return;
    const t = Math.max(1, Math.min(100, Math.round(thickness)));

    if (this.isSelectedGroupCountertop()) {
      const gId = this.activeSelectedGroupId() || this.selectedPart()?.groupId;
      if (gId) {
        this.projectService.resizeGroupStructure(gId, 'thickness', t);
        this.syncGroupSelectionAfterUpdate(gId);
        this.showToast(`📐 Espesor de encimera ajustado a ${t} mm`);
        return;
      }
    }

    this.updateSelectedPart({ thickness: t });
  }

  adjustPartProperty(prop: 'length' | 'width' | 'thickness' | 'posX' | 'posY' | 'posZ', delta: number) {
    const current = this.selectedPart();
    if (!current) return;

    const currentVal = Number(current[prop] ?? 0);
    const newVal = Math.max(prop === 'length' || prop === 'width' || prop === 'thickness' ? 10 : -3000, currentVal + delta);
    this.updateSelectedPart({ [prop]: newVal });
  }

  togglePartEdge(edgeKey: 'l1' | 'l2' | 'a1' | 'a2') {
    const current = this.selectedPart();
    if (!current) return;

    const cycle: Record<EdgeBandingType, EdgeBandingType> = {
      none: 'thin',
      thin: 'thick',
      thick: 'none'
    };

    const nextVal = cycle[current.edges[edgeKey]];
    this.updateSelectedPart({
      edges: {
        ...current.edges,
        [edgeKey]: nextVal
      }
    });
  }

  setPartOrientation(orientation: PartOrientation) {
    const sel = this.selectedPart();
    if (!sel) return;

    const groupId = this.activeSelectedGroupId();
    if (!groupId) {
      this.updateSelectedPart({ orientation });
      return;
    }

    if (orientation === 'vertical_xy') {
      this.setGroupFaceDirection('front');
    } else if (orientation === 'vertical_yz') {
      this.setGroupFaceDirection('right');
    } else {
      this.rotateSelectedGroup(90);
    }
  }

  rotateSelectedPart90(axis: 'x' | 'y' | 'z' = 'y') {
    const groupId = this.activeSelectedGroupId();
    if (groupId) {
      this.rotateSelectedGroup(90);
      return;
    }
    const sel = this.selectedPart();
    if (!sel) return;
    const viewer = this.viewer3d();
    if (viewer) {
      viewer.rotatePart90(sel, axis);
    } else {
      const prop = axis === 'x' ? 'rotationX' : (axis === 'y' ? 'rotationY' : 'rotationZ');
      const current = sel[prop] || 0;
      this.updateSelectedPart({ [prop]: (current + 90) % 360 });
    }
    this.showToast('🔄 Pieza girada 90°');
  }

  rotateSelectedPart3DAngle(axis: 'x' | 'y' | 'z', delta: number) {
    if (this.isAnyGroupSelected()) {
      if (axis === 'y') {
        this.rotateSelectedGroup(delta > 0 ? 90 : -90);
      } else {
        this.showToast('ℹ️ Para inclinar piezas en X/Z, desagrupa el módulo primero');
      }
      return;
    }
    const sel = this.selectedPart();
    if (!sel) return;
    const prop = axis === 'x' ? 'rotationX' : (axis === 'y' ? 'rotationY' : 'rotationZ');
    const current = sel[prop] || 0;
    const next = ((current + delta) % 360 + 360) % 360;
    this.updateSelectedPart({ [prop]: next });
    this.showToast(`🔄 Rotación ${axis.toUpperCase()}: ${next}°`);
  }

  setPartRotationAngle(axis: 'x' | 'y' | 'z', angle: number) {
    if (this.isAnyGroupSelected()) return;
    const sel = this.selectedPart();
    if (!sel || isNaN(angle)) return;
    const normAngle = ((Math.round(angle) % 360) + 360) % 360;
    const prop = axis === 'x' ? 'rotationX' : (axis === 'y' ? 'rotationY' : 'rotationZ');
    this.updateSelectedPart({ [prop]: normAngle });
  }

  resetSelectedPartRotation() {
    if (this.isAnyGroupSelected()) {
      this.setGroupFaceDirection('front');
      this.showToast('↺ Orientación del módulo restablecida al frente');
      return;
    }
    this.updateSelectedPart({ rotationX: 0, rotationY: 0, rotationZ: 0 });
    this.showToast('↺ Rotación restablecida a 0°');
  }

  updatePartDiameter(diameter: number) {
    const sel = this.selectedPart();
    if (!sel || isNaN(diameter) || diameter <= 0) return;
    const d = Math.max(10, Math.round(diameter));
    const r = Math.round(d / 2);
    this.updateSelectedPart({
      diameter: d,
      radius: r,
      width: d
    });
  }

  duplicateSelectedGroup() {
    if (this.isMultiGroupSelected()) {
      const gIds = this.selectedGroupIds();
      const allNewIds: string[] = [];
      for (const gid of gIds) {
        const res = this.projectService.duplicateGroup(gid);
        if (res) allNewIds.push(...res.newPartIds);
      }
      if (allNewIds.length > 0) {
        this.selectedPartIds.set(allNewIds);
        if (allNewIds.length > 0) {
          this.selectedPartId.set(allNewIds[0]);
        }
        this.activeDockTab.set('piece');
        this.showToast(`📋 Se duplicaron ${gIds.length} módulos seleccionados`);
      }
      return;
    }
    const groupId = this.activeSelectedGroupId();
    if (!groupId) return;
    const result = this.projectService.duplicateGroup(groupId);
    if (result) {
      this.selectedPartIds.set(result.newPartIds);
      if (result.newPartIds.length > 0) {
        this.selectedPartId.set(result.newPartIds[0]);
      }
      this.activeDockTab.set('piece');
      this.showToast(`📋 Se duplicó "${result.newGroup.name}" apilado verticalmente`);
    }
  }

  rotateSelectedGroup(deltaAngle: 90 | -90 | 180 = 90) {
    const partIds = this.selectedPartIds();
    const appIds = this.selectedApplianceIds();
    if (this.isMultiSelection() || partIds.length > 1 || (partIds.length > 0 && appIds.length > 0) || appIds.length > 1) {
      this.projectService.rotateMultiplePartsRigidly(partIds, deltaAngle, appIds);
      const gCount = this.selectedGroupIds().length;
      const totalCount = (gCount > 0 ? gCount : partIds.length) + appIds.length;
      this.showToast(`🔄 ${totalCount} elementos girados ${deltaAngle > 0 ? '+' : ''}${deltaAngle}° en bloque`);
      return;
    }
    if (appIds.length === 1 && partIds.length === 0) {
      const app = this.selectedAppliance();
      if (app) {
        const nextRot = (((app.rotation || 0) + deltaAngle) % 360 + 360) % 360;
        this.projectService.updateAppliance(app.id, { rotation: nextRot });
        this.showToast(`🔄 ${app.name} girado ${deltaAngle > 0 ? '+' : ''}${deltaAngle}°`);
      }
      return;
    }
    const groupId = this.activeSelectedGroupId();
    if (!groupId) {
      if (partIds.length === 1) {
        this.rotateSelectedPart90('y');
      }
      return;
    }
    this.projectService.rotateGroupRigidly(groupId, deltaAngle);
    const isCt = this.isCountertopGroup(groupId);
    this.showToast(`🔄 ${isCt ? 'Mesón' : 'Módulo'} girado ${deltaAngle > 0 ? '+' : ''}${deltaAngle}° en bloque`);
  }

  /**
   * Aplica un material de melamina o mesón a todas las piezas o módulos actualmente seleccionados en 1 solo clic.
   */
  applyMaterialToSelection(materialId: string) {
    const ids = this.selectedPartIds();
    if (ids.length === 0) return;
    const mat = this.projectService.materialsList().find(m => m.id === materialId)
      || this.countertopMaterials().find(m => m.id === materialId);
    if (!mat) return;
    this.projectService.changeMultiplePartsMaterial(ids, materialId);
    const gCount = this.selectedGroupIds().length;
    if (gCount > 1) {
      this.showToast(`🎨 "${mat.name}" aplicado a los ${gCount} módulos seleccionados (${ids.length} piezas)`);
    } else {
      this.showToast(`🎨 "${mat.name}" aplicado a ${ids.length} piezas seleccionadas`);
    }
  }

  rotateSelectedGroup90() {
    this.rotateSelectedGroup(90);
  }

  setGroupFaceDirection(targetFace: 'front' | 'right' | 'back' | 'left') {
    const groupId = this.activeSelectedGroupId();
    if (!groupId) return;
    this.projectService.setGroupFacingDirection(groupId, targetFace);
    this.showToast(`🧭 Frente orientado hacia: ${targetFace.toUpperCase()}`);
  }

  onGroupRotationRequested(event: { groupId: string; deltaAngle: 90 | -90 | 180 }) {
    this.projectService.rotateGroupRigidly(event.groupId, event.deltaAngle);
    const grp = this.groups().find(g => g.id === event.groupId);
    const isCt = this.isCountertopGroup(event.groupId) || grp?.isCountertop;
    const label = isCt ? 'Mesón' : (grp?.type === 'drawer' ? 'Cajón' : 'Módulo');
    this.showToast(`🔄 ${label} girado ${event.deltaAngle > 0 ? '+' : ''}${event.deltaAngle}° (Atajo: tecla R)`);
  }

  onGroupDuplicationRequested(groupId: string) {
    const result = this.projectService.duplicateGroup(groupId);
    if (result) {
      this.selectedPartIds.set(result.newPartIds);
      if (result.newPartIds.length > 0) {
        this.selectedPartId.set(result.newPartIds[0]);
      }
      this.activeDockTab.set('piece');
      this.showToast(`📋 Se duplicó "${result.newGroup.name}" apilado verticalmente`);
    }
  }

  alignPart(preset: 'floor' | 'centerX' | 'centerZ' | 'top') {
    if (this.isAnyGroupSelected() && preset !== 'top') {
      this.alignSelectedGroup(preset);
      return;
    }
    const current = this.selectedPart();
    if (!current) return;

    const bounds = this.joineryEngine.getPartBounds(current);
    const sy = bounds.sy;

    switch (preset) {
      case 'floor':
        this.updateSelectedPart({ posY: sy / 2 });
        break;
      case 'centerX':
        this.updateSelectedPart({ posX: 0 });
        break;
      case 'centerZ':
        this.updateSelectedPart({ posZ: 0 });
        break;
      case 'top':
        this.updateSelectedPart({ posY: 1000 - sy / 2 });
        break;
    }
  }

  duplicateSelectedPart() {
    if (this.isAnyGroupSelected()) {
      this.duplicateSelectedGroup();
      return;
    }
    const selId = this.selectedPartId();
    if (!selId) return;

    const cloned = this.projectService.duplicatePart(selId);
    if (cloned) {
      this.selectedPartId.set(cloned.id);
      this.selectedPartIds.set([cloned.id]);
      this.activeDockTab.set('piece');
      this.showToast(`📋 Se duplicó "${cloned.name}"`);
    }
  }

  /**
   * Alterna la inclusión o exclusión de un módulo completo dentro de la multi-selección activa.
   */
  toggleGroupInSelection(groupId: string) {
    const currentSel = new Set(this.selectedPartIds());
    const groupPartIds = this.currentParts().filter(p => p.groupId === groupId).map(p => p.id);
    const hasGroup = groupPartIds.some(id => currentSel.has(id));

    if (hasGroup) {
      for (const id of groupPartIds) currentSel.delete(id);
    } else {
      for (const id of groupPartIds) currentSel.add(id);
    }

    const nextIds = Array.from(currentSel);
    this.selectedPartIds.set(nextIds);
    this.selectedPartId.set(nextIds.length > 0 ? nextIds[0] : null);
    if (nextIds.length === 0) {
      this.activeDockTab.set('catalog');
    }
  }

  /**
   * Aísla y selecciona exclusivamente el módulo especificado, pasando al modo inspector individual.
   */
  selectOnlyGroup(groupId: string) {
    const groupPartIds = this.currentParts().filter(p => p.groupId === groupId).map(p => p.id);
    this.selectedPartIds.set(groupPartIds);
    this.selectedPartId.set(groupPartIds.length > 0 ? groupPartIds[0] : null);
    this.activeDockTab.set('piece');
  }

  /**
   * Elimina la pieza, electrodoméstico o conjunto seleccionado en una única transacción de historial.
   */
  async deleteSelectedPart() {
    const selIds = this.selectedPartIds();
    const selId = this.selectedPartId();
    const selAppIds = this.selectedApplianceIds();

    if (selIds.length > 1 || (selIds.length > 0 && selAppIds.length > 0) || selAppIds.length > 1) {
      const isMulti = this.isMultiSelection();
      const gCount = this.selectedGroupIds().length;
      const appCount = selAppIds.length;
      const partCount = selIds.length;

      let labelDesc = '';
      if (gCount > 0) labelDesc += `${gCount} módulo(s) (${partCount} pzs)`;
      else if (partCount > 0) labelDesc += `${partCount} pieza(s)`;
      if (appCount > 0) labelDesc += `${labelDesc ? ' y ' : ''}${appCount} equipo(s)`;

      const confirmed = await this.confirmService.ask({
        title: `¿Eliminar selección (${labelDesc})?`,
        message: `Se eliminarán del modelo 3D los elementos seleccionados. Puedes deshacer esta acción con el botón Deshacer o Ctrl+Z.`,
        confirmText: 'Eliminar selección',
        cancelText: 'Cancelar',
        severity: 'danger'
      });
      if (!confirmed) return;

      this.projectService.deleteMultiplePartsAndAppliances(selIds, selAppIds);
      this.selectedPartIds.set([]);
      this.selectedPartId.set(null);
      this.projectService.selectAppliances([]);
      this.projectService.selectAppliance(null);
      this.activeDockTab.set('catalog');
      return;
    }

    if (selAppIds.length === 1 && selIds.length === 0) {
      const app = this.appliances().find(a => a.id === selAppIds[0]);
      const appName = app ? `"${app.name}"` : 'el equipo';
      const confirmed = await this.confirmService.ask({
        title: '¿Eliminar equipo de la escena?',
        message: `Se eliminará ${appName} del modelo 3D.`,
        confirmText: 'Eliminar Equipo',
        cancelText: 'Cancelar',
        severity: 'danger'
      });
      if (!confirmed) return;
      this.projectService.removeAppliance(selAppIds[0]);
      this.projectService.selectAppliances([]);
      this.projectService.selectAppliance(null);
      this.activeDockTab.set('catalog');
      return;
    }

    if (!selId) return;
    const part = this.currentParts().find(p => p.id === selId);
    const partName = part ? `"${part.name}"` : 'la pieza';
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar pieza del despiece?',
      message: `Se eliminará ${partName} del modelo 3D y del listado de corte. Puedes deshacer esta acción si lo necesitas.`,
      confirmText: 'Eliminar Pieza',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (!confirmed) return;

    this.projectService.deletePart(selId);
    const remaining = this.currentParts().filter(p => p.id !== selId);
    if (remaining.length > 0) {
      this.selectedPartId.set(remaining[0].id);
    } else {
      this.selectedPartId.set(null);
      this.activeDockTab.set('catalog');
    }
  }

  async deletePartById(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const part = this.currentParts().find(p => p.id === id);
    const partName = part ? `"${part.name}"` : 'la pieza';
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar pieza del despiece?',
      message: `Se eliminará ${partName} del modelo 3D y de los cálculos del mueble.`,
      confirmText: 'Eliminar Pieza',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (!confirmed) return;

    this.projectService.deletePart(id);
    if (this.selectedPartId() === id) {
      this.selectedPartId.set(null);
      this.activeDockTab.set('catalog');
    }
  }

  // --- CATÁLOGO DE PIEZAS INDIVIDUALES ---

  addPieceFromCatalog(role: ComponentRole) {
    const mats = this.materials();
    const mainMat = mats.find(m => m.hasGrain) || mats[0];
    const whiteMat = mats.find(m => !m.hasGrain && m.thickness >= 15) || mats[0];
    const mdfMat = mats.find(m => m.thickness <= 6) || mats[0];

    const defaultT = this.projectService.currentProject().settings.defaultBoardThickness || 15;
    let newPart: Part;

    const currentParts = this.currentParts();
    const maxTopY = currentParts.reduce((max, p) => Math.max(max, (p.posY ?? 0) + (p.thickness || 15)), 850);

    switch (role) {
      case 'top':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'TECHO / CUBIERTA',
          length: 1800,
          width: 600,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: 0,
          posY: maxTopY > 100 ? maxTopY + defaultT / 2 : 900,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'top'
        };
        break;

      case 'side_left':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'LATERAL IZQUIERDO',
          length: 850,
          width: 580,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
          posX: -400,
          posY: 425,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'side_left'
        };
        break;

      case 'side_right':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'LATERAL DERECHO',
          length: 850,
          width: 580,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
          posX: 400,
          posY: 425,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'side_right'
        };
        break;

      case 'bottom':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'PISO INFERIOR',
          length: 764,
          width: 580,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 80 + defaultT / 2,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'bottom'
        };
        break;

      case 'divider':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'DIVISIÓN VERTICAL',
          length: 750,
          width: 560,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 450,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'divider'
        };
        break;

      case 'shelf':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'REPISA INTERNA',
          length: 764,
          width: 560,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 450,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'shelf'
        };
        break;

      case 'back':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'FONDO POSTERIOR (MDF)',
          length: 796,
          width: 766,
          thickness: 3,
          quantity: 1,
          materialId: mdfMat.id,
          materialName: mdfMat.name,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 470,
          posZ: -285,
          orientation: 'vertical_xy',
          componentRole: 'back'
        };
        break;

      case 'door':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'PUERTA BATIENTE',
          length: 395,
          width: 760,
          thickness: defaultT,
          quantity: 1,
          materialId: whiteMat.id,
          materialName: whiteMat.name,
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: -200,
          posY: 470,
          posZ: 295,
          orientation: 'vertical_xy',
          componentRole: 'door'
        };
        break;

      case 'drawer_front':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'FRENTE DE CAJÓN',
          length: 794,
          width: 185,
          thickness: defaultT,
          quantity: 1,
          materialId: whiteMat.id,
          materialName: whiteMat.name,
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: 0,
          posY: 180,
          posZ: 295,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front'
        };
        break;

      case 'plinth':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'ZÓCALO FRONTAL',
          length: 764,
          width: 80,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 40,
          posZ: 250,
          orientation: 'vertical_xy',
          componentRole: 'plinth'
        };
        break;

      default:
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'PIEZA PERSONALIZADA',
          length: 600,
          width: 400,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 400,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'free'
        };
        break;
    }

    if (this.isPieceNameTaken(newPart.name)) {
      newPart.name = this.getNextUniquePieceName(newPart.name);
    }
    this.projectService.addPart(newPart);
    this.selectedPartId.set(newPart.id);
    this.activeDockTab.set('piece');
  }

  onClearanceCalculated(info: ClearanceInfo | null) {
    this.clearanceInfo.set(info);
  }

  // --- ACCIONES DE LIENZO Y PLANTILLAS ---

  async startBlank() {
    const hasItems = this.currentParts().length > 0 || this.appliances().length > 0;
    if (hasItems) {
      const confirmed = await this.confirmService.ask({
        title: '¿Limpiar lienzo 3D?',
        message: 'Se eliminarán todas las piezas y equipos del modelo actual para comenzar un mueble desde cero. Puedes deshacer esta acción inmediatamente con el botón Deshacer o Ctrl+Z.',
        confirmText: 'Limpiar Todo',
        cancelText: 'Cancelar',
        severity: 'warning'
      });
      if (!confirmed) return;
    }
    this.projectService.clearFurniture();
    this.selectedPartId.set(null);
    this.selectedPartIds.set([]);
    this.selectAppliance(null);
    this.hiddenPartIds.set(new Set());
    this.clearanceInfo.set(null);
    this.activeDockTab.set('catalog');
  }

  onTemplateSelected(event: { template: FurnitureTemplate; mode: 'replace' | 'append' }) {
    this.projectService.loadTemplateFurniture(event.template, event.mode);
    const parts = this.currentParts();
    if (parts.length > 0) {
      const top = parts.find(p => p.name.toUpperCase().includes('TECHO') || p.name.toUpperCase().includes('TAPA') || p.name.toUpperCase().includes('ENCIMERA')) || parts[0];
      this.selectedPartId.set(top.id);
      this.selectedPartIds.set([top.id]);
      this.activeDockTab.set('piece');
    }
  }

  loadDeskBarTemplate() {
    this.projectService.loadDeskBarFurniture();
    const parts = this.currentParts();
    const top = parts.find(p => p.id === 'desk_top') || parts[0];
    if (top) {
      this.selectedPartId.set(top.id);
      this.activeDockTab.set('piece');
    }
  }

  loadStandardBaseCabinet() {
    this.projectService.resetToDemo();
    const parts = this.currentParts();
    if (parts.length > 0) {
      this.selectedPartId.set(parts[0].id);
      this.activeDockTab.set('piece');
    }
  }

  openTechnicalSheet() {
    this.showTechnicalSheetModal.set(true);
  }

  closeTechnicalSheet() {
    this.showTechnicalSheetModal.set(false);
  }

  exportDxf() {
    this.dxfExporter.exportProjectToDxf(this.project());
  }

  // --- ACORDEÓN Y GESTIÓN DE GRUPOS ---

  toggleGroupAccordion(groupId: string) {
    const cur = new Set(this.openGroupCardIds());
    if (cur.has(groupId)) {
      cur.delete(groupId);
    } else {
      cur.add(groupId);
    }
    this.openGroupCardIds.set(cur);
  }

  isGroupAccordionOpen(groupId: string): boolean {
    return this.openGroupCardIds().has(groupId);
  }

  // --- ASISTENTE DE CAJÓN MODULAR ---

  openDrawerWizard() {
    const uniqueName = this.getNextUniqueGroupName('Cajón');
    const defaultMat = this.materials()[0];
    const mdfMat = this.materials().find(m => m.thickness === 3) || defaultMat;
    this.drawerForm.set({
      name: uniqueName,
      outerWidth: 400,
      slideLength: 450,
      boxHeight: 140,
      boxThickness: 15,
      bottomThickness: 3,
      slideGap: 26,
      includeFront: true,
      frontHeight: 180,
      frontWidth: 396,
      posX: 0,
      posY: 100 + (this.groups().length) * 200,
      posZ: 0,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      bottomMaterialId: mdfMat ? mdfMat.id : 'mat_mdf_3'
    });
    this.showDrawerWizard.set(true);
  }

  closeDrawerWizard() {
    this.showDrawerWizard.set(false);
  }

  updateDrawerFormField<K extends keyof ParametricDrawerConfig>(field: K, value: ParametricDrawerConfig[K]) {
    this.drawerForm.update(cur => ({ ...cur, [field]: value }));
  }

  submitDrawerWizard() {
    const config = this.drawerForm();
    const cleanName = config.name.trim();
    if (!cleanName) {
      this.showToast('⚠️ Ingresa un nombre para el cajón');
      return;
    }
    if (this.isGroupNameTaken(cleanName)) {
      const suggestion = this.getNextUniqueGroupName('Cajón');
      this.showToast(`⚠️ Ya existe un cajón llamado "${cleanName}". Sugerencia: ${suggestion}`);
      return;
    }
    const grp = this.projectService.addParametricDrawer({ ...config, name: cleanName });
    this.showDrawerWizard.set(false);
    this.selectEntireGroup(grp.id);
    this.openGroupCardIds.update(s => new Set(s).add(grp.id));
    this.showToast(`✨ ${grp.name} generado con 5-6 piezas ensambladas`);
  }

  // --- AGRUPACIÓN MANUAL Y DESAGRUPACIÓN ---

  quickGroupSelectedParts() {
    const selIds = this.selectedPartIds();
    if (selIds.length < 2) return;
    const isCt = this.isCountertopMultiSelection();
    if (isCt) {
      const mat = this.selectedCountertopMaterial();
      const matName = mat?.name ? ` (${mat.name})` : '';
      const baseName = `Mesón Cocina${matName}`;
      const uniqueName = this.getNextUniqueGroupName(baseName);
      const grp = this.projectService.createGroup(uniqueName, selIds, 'assembly', 450, true);
      this.selectEntireGroup(grp.id);
      this.showToast(`🪨 ${grp.name} reagrupado exitosamente`);
      return;
    }
    this.openGroupNamingModal();
  }

  openGroupNamingModal() {
    const selCount = this.selectedPartIds().length;
    if (selCount < 2) {
      this.showToast('Selecciona al menos 2 piezas para agrupar (usa Shift+Clic en 3D o en lista)');
      return;
    }
    const selParts = this.currentParts().filter(p => this.selectedPartIds().includes(p.id));
    const isCountertopLike = selParts.some(p =>
      p.componentRole === 'countertop' ||
      p.componentRole === 'backsplash' ||
      (p.name && (p.name.toUpperCase().includes('MESÓN') || p.name.toUpperCase().includes('MESON') || p.name.toUpperCase().includes('SALPICADERO')))
    );
    const isDrawerLike = !isCountertopLike && selParts.some(p =>
      p.name.toUpperCase().includes('CAJ') ||
      p.name.toUpperCase().includes('GAVET') ||
      p.componentRole?.includes('drawer')
    );
    const baseDefault = isCountertopLike ? 'Mesón Cocina' : (isDrawerLike ? 'Cajón' : 'Conjunto');
    const uniqueName = this.getNextUniqueGroupName(baseDefault);
    this.newGroupNameInput.set(uniqueName);
    this.showGroupNamingModal.set(true);
  }

  closeGroupNamingModal() {
    this.showGroupNamingModal.set(false);
  }

  confirmCreateGroup() {
    const selIds = this.selectedPartIds();
    if (selIds.length < 2) return;

    const selParts = this.currentParts().filter(p => selIds.includes(p.id));
    const isCountertopLike = selParts.some(p =>
      p.componentRole === 'countertop' ||
      p.componentRole === 'backsplash' ||
      (p.name && (p.name.toUpperCase().includes('MESÓN') || p.name.toUpperCase().includes('MESON') || p.name.toUpperCase().includes('SALPICADERO')))
    );
    const isDrawerLike = !isCountertopLike && selParts.length >= 4 && selParts.every(p =>
      p.componentRole?.includes('drawer') || p.id.includes('caj_ind_')
    );
    const baseDefault = isCountertopLike ? 'Mesón Cocina' : (isDrawerLike ? 'Cajón' : 'Conjunto');
    const name = this.newGroupNameInput().trim() || this.getNextUniqueGroupName(baseDefault);

    if (this.isGroupNameTaken(name)) {
      const suggestion = this.getNextUniqueGroupName(baseDefault);
      this.showToast(`⚠️ Ya existe un grupo llamado "${name}". Sugerencia: ${suggestion}`);
      return;
    }

    const groupType: 'drawer' | 'assembly' = isDrawerLike ? 'drawer' : 'assembly';
    const grp = this.projectService.createGroup(name, selIds, groupType, 450, isCountertopLike);
    this.showGroupNamingModal.set(false);
    this.openGroupCardIds.update(s => new Set(s).add(grp.id));
    this.selectEntireGroup(grp.id);
    this.showToast(`🔗 ${grp.name} agrupado (${selIds.length} piezas)`);
  }

  ungroup(groupId: string) {
    const grp = this.groups().find(g => g.id === groupId);
    const name = grp ? grp.name : 'Grupo';
    this.projectService.ungroup(groupId);
    this.showToast(`🔓 ${name} desagrupado (piezas libres)`);
  }

  async deleteGroup(groupId: string, deleteParts = true) {
    const grp = this.groups().find(g => g.id === groupId);
    const name = grp ? grp.name : 'Grupo';
    const confirmed = await this.confirmService.ask({
      title: `¿Eliminar ${name}?`,
      message: `Se eliminará el grupo y ${deleteParts ? 'todas sus piezas ensambladas' : 'se liberarán las piezas'}.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (!confirmed) return;
    this.projectService.deleteGroup(groupId, deleteParts);
    this.deselectAll();
    this.showToast(`🗑️ ${name} eliminado`);
  }

  toggleGroupOpen(groupId: string) {
    this.projectService.toggleGroupOpen(groupId);
  }

  onGroupSlideChange(groupId: string, event: Event) {
    const val = Number((event.target as HTMLInputElement).value) / 100;
    this.projectService.setGroupSlideExtension(groupId, val);
  }

  selectEntireGroup(groupId: string) {
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    const ids = groupParts.map(p => p.id);
    this.selectedPartIds.set(ids);
    this.selectedPartId.set(ids[0] || null);
    this.activeDockTab.set('piece');
  }

  updateActiveGroupName(rawName: string) {
    const gId = this.activeSelectedGroupId();
    const clean = rawName.trim();
    if (!gId || !clean) return;
    this.projectService.updateGroup(gId, { name: clean });
  }

  activateMoveToolOnViewer() {
    this.viewer3d()?.setActiveTool('move');
  }

  toggleSelectedGroupOpen() {
    const gId = this.activeSelectedGroupId();
    if (gId) {
      this.viewer3d()?.toggleGroupAnimation(gId);
      this.projectService.toggleGroupOpen(gId);
      return;
    }
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId) || this.selectedPart();
    if (part?.groupId) {
      this.viewer3d()?.toggleGroupAnimation(part.groupId);
      this.projectService.toggleGroupOpen(part.groupId);
    } else if (part) {
      this.viewer3d()?.togglePartOpen(part.id);
    }
  }

  isGroupOpen(): boolean {
    const gId = this.activeSelectedGroupId();
    if (gId) {
      return this.viewer3d()?.isGroupOpen(gId) ?? false;
    }
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId) || this.selectedPart();
    if (part?.groupId) {
      return this.viewer3d()?.isGroupOpen(part.groupId) ?? false;
    } else if (part) {
      return this.viewer3d()?.isPartOpen(part.id) ?? false;
    }
    return false;
  }

  ungroupSelected() {
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId);
    if (part?.groupId) {
      this.ungroup(part.groupId);
    }
  }

  moveGroup(groupId: string, axis: 'x' | 'y' | 'z', amount: number) {
    const dx = axis === 'x' ? amount : 0;
    const dy = axis === 'y' ? amount : 0;
    const dz = axis === 'z' ? amount : 0;
    this.projectService.moveGroup(groupId, dx, dy, dz);
  }

  startRenameActiveGroup(event?: MouseEvent) {
    if (event) event.stopPropagation();
    const gId = this.activeSelectedGroupId();
    if (!gId) return;
    const name = this.activeSelectedGroupName() || 'Cajón';
    this.renamingGroupId.set(gId);
    this.renamingGroupName.set(name);
  }

  saveRenameActiveGroup() {
    const gId = this.renamingGroupId();
    if (!gId) return;
    this.saveRenameGroup(gId);
  }

  startRenameGroup(group: PartGroup, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.renamingGroupId.set(group.id);
    this.renamingGroupName.set(group.name);
  }

  saveRenameGroup(groupId: string) {
    const name = this.renamingGroupName().trim();
    if (!name) {
      this.cancelRenameGroup();
      return;
    }
    if (this.isGroupNameTaken(name, groupId)) {
      const suggestion = this.getNextUniqueGroupName(name);
      this.showToast(`⚠️ Ya existe otro cajón llamado "${name}". Sugerencia: ${suggestion}`);
      return;
    }
    this.projectService.updateGroup(groupId, { name });
    this.showToast(`✏️ Grupo renombrado a "${name}"`);
    this.renamingGroupId.set(null);
  }

  cancelRenameGroup() {
    this.renamingGroupId.set(null);
  }

  isGroupNameTaken(name: string, excludeGroupId?: string | null): boolean {
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return this.groups().some(g => g.id !== excludeGroupId && g.name.trim().toLowerCase() === clean);
  }

  getNextUniqueGroupName(baseName = 'Cajón'): string {
    const existing = this.groups().map(g => g.name.trim().toLowerCase());
    let counter = 1;
    while (existing.includes(`${baseName.toLowerCase()} ${counter}`)) {
      counter++;
    }
    return `${baseName} ${counter}`;
  }

  isPieceNameTaken(name: string, excludePartId?: string | null): boolean {
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return this.currentParts().some(p => p.id !== excludePartId && p.name.trim().toLowerCase() === clean);
  }

  getNextUniquePieceName(baseName: string): string {
    const cleanBase = baseName.trim().replace(/\s+\(Copia.*?\)$/i, '').replace(/\s+\d+$/, '').trim();
    const existing = this.currentParts().map(p => p.name.trim().toLowerCase());
    if (!existing.includes(cleanBase.toLowerCase())) {
      return cleanBase;
    }
    let counter = 2;
    while (existing.includes(`${cleanBase.toLowerCase()} ${counter}`)) {
      counter++;
    }
    return `${cleanBase} ${counter}`;
  }

  // --- RENOMBRADO DE PIEZAS ---

  startRenameSelectedPart(event?: MouseEvent) {
    if (event) event.stopPropagation();
    const part = this.selectedPart();
    if (!part) return;
    this.renamingPartId.set(part.id);
    this.renamingPartName.set(part.name);
  }

  saveRenameSelectedPart() {
    const partId = this.renamingPartId();
    if (!partId) return;
    this.saveRenamePart(partId);
  }

  startRenamePart(part: Part, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.renamingPartId.set(part.id);
    this.renamingPartName.set(part.name);
  }

  saveRenamePart(partId: string) {
    const newName = this.renamingPartName().trim();
    if (!newName) {
      this.cancelRenamePart();
      return;
    }
    const part = this.currentParts().find(p => p.id === partId);
    if (!part) {
      this.cancelRenamePart();
      return;
    }
    if (this.isPieceNameTaken(newName, partId)) {
      const suggestion = this.getNextUniquePieceName(newName);
      this.showToast(`⚠️ Ya existe otra pieza llamada "${newName}". Sugerencia: ${suggestion}`);
      return;
    }
    this.projectService.updatePart({ ...part, name: newName });
    this.showToast(`✏️ Pieza renombrada a "${newName}"`);
    this.renamingPartId.set(null);
  }

  cancelRenamePart() {
    this.renamingPartId.set(null);
    this.renamingPartName.set('');
  }

  roundPercent(val?: number): number {
    return Math.round((val || 0) * 100);
  }

  // --- VISIBILIDAD DE PIEZAS Y GRUPOS ---

  isPartHidden(partId: string): boolean {
    return this.hiddenPartIds().has(partId);
  }

  isGroupHidden(groupId: string): boolean {
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    if (groupParts.length === 0) return false;
    return groupParts.every(p => this.hiddenPartIds().has(p.id));
  }

  isGroupPartiallyHidden(groupId: string): boolean {
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    if (groupParts.length === 0) return false;
    const hiddenCount = groupParts.filter(p => this.hiddenPartIds().has(p.id)).length;
    return hiddenCount > 0 && hiddenCount < groupParts.length;
  }

  hideSelectedPart() {
    if (this.isAnyGroupSelected()) {
      this.hideActiveGroup();
      return;
    }
    const selId = this.selectedPartId();
    if (!selId) return;
    const part = this.currentParts().find(p => p.id === selId);
    const partName = part ? part.name : 'Pieza';

    const next = new Set(this.hiddenPartIds());
    next.add(selId);
    this.hiddenPartIds.set(next);

    this.viewer3d()?.hidePartById(selId);

    this.selectedPartId.set(null);
    this.selectedPartIds.set([]);
    this.activeDockTab.set('catalog');

    this.showToast(`👁️ "${partName}" oculta temporalmente (Alt+H para mostrar)`);
  }

  hideActiveGroup() {
    const selAppIds = this.selectedApplianceIds();
    if (selAppIds.length > 0) {
      const appUpdates = selAppIds.map(id => ({ id, updates: { isHidden: true } }));
      this.projectService.updateMultipleAppliances(appUpdates);
    }

    if (this.isMultiSelection() || this.isMultiGroupSelected() || this.selectedPartIds().length > 1) {
      const ids = this.selectedPartIds();
      if (ids.length > 0) {
        const next = new Set(this.hiddenPartIds());
        for (const id of ids) next.add(id);
        this.hiddenPartIds.set(next);
        this.viewer3d()?.hidePartsByIds(ids);
      }
      this.deselectAll();
      this.showToast('👁️ Selección oculta temporalmente. Alt+H para mostrar');
      return;
    }
    const gId = this.activeSelectedGroupId();
    if (!gId && selAppIds.length > 0) {
      this.deselectAll();
      return;
    }
    if (!gId) return;
    const group = this.groups().find(g => g.id === gId);
    const groupName = group ? group.name : 'Grupo';
    const groupParts = this.currentParts().filter(p => p.groupId === gId);
    if (groupParts.length === 0) return;

    const next = new Set(this.hiddenPartIds());
    const partIds = groupParts.map(p => p.id);
    for (const id of partIds) {
      next.add(id);
    }
    this.hiddenPartIds.set(next);

    this.viewer3d()?.hidePartsByIds(partIds);
    this.deselectAll();

    this.showToast(`👁️ "${groupName}" oculto (${groupParts.length} piezas). Alt+H para mostrar`);
  }

  // --- CONGELAR / DESCONGELAR PIEZAS Y MÓDULOS (BLOQUEO DE POSICIÓN) ---

  isPartLocked(partId: string): boolean {
    const part = this.currentParts().find(p => p.id === partId);
    if (!part) return false;
    if (part.isLocked) return true;
    if (part.groupId) {
      return this.isGroupLocked(part.groupId);
    }
    return false;
  }

  isGroupLocked(groupId: string): boolean {
    const grp = this.groups().find(g => g.id === groupId);
    if (grp?.isLocked) return true;
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    return groupParts.length > 0 && groupParts.some(p => !!p.isLocked);
  }

  isActiveSelectionLocked(): boolean {
    const selAppIds = this.selectedApplianceIds();
    const selApps = this.appliances().filter(a => selAppIds.includes(a.id));
    if (selApps.some(a => !!a.isLocked)) return true;

    const gId = this.activeSelectedGroupId();
    if (gId) {
      return this.isGroupLocked(gId);
    }
    const selIds = this.selectedPartIds();
    if (selIds.length > 1) {
      return this.currentParts()
        .filter(p => selIds.includes(p.id))
        .some(p => !!p.isLocked);
    }
    const sel = this.selectedPart();
    if (sel) return this.isPartLocked(sel.id);
    const selApp = this.selectedAppliance();
    return selApp ? !!selApp.isLocked : false;
  }

  toggleSelectedPartLock(event?: Event) {
    event?.stopPropagation();
    const sel = this.selectedPart();
    if (!sel) return;
    this.togglePartLockById(sel.id, event);
  }

  togglePartLockById(partId: string, event?: Event) {
    event?.stopPropagation();
    const part = this.currentParts().find(p => p.id === partId);
    if (!part) return;
    const nextLocked = !part.isLocked;
    this.projectService.updatePart({ ...part, isLocked: nextLocked });
    this.showToast(
      nextLocked
        ? `🔒 "${part.name}" congelada (fija en su posición)`
        : `🔓 "${part.name}" descongelada`
    );
  }

  toggleActiveGroupLock(event?: Event) {
    event?.stopPropagation();
    const selAppIds = this.selectedApplianceIds();
    const selPartIds = this.selectedPartIds();
    const gId = this.activeSelectedGroupId();

    const currentlyLocked = this.isActiveSelectionLocked();
    const nextLocked = !currentlyLocked;

    if (selAppIds.length > 0) {
      const appUpdates = selAppIds.map(id => ({ id, updates: { isLocked: nextLocked } }));
      this.projectService.updateMultipleAppliances(appUpdates);
    }

    if (gId) {
      this.toggleGroupLockById(gId, event);
      return;
    }

    if (selPartIds.length > 0) {
      const selParts = this.currentParts().filter(p => selPartIds.includes(p.id));
      const updatesList = selParts.map(p => ({
        partId: p.id,
        updates: { isLocked: nextLocked }
      }));
      this.projectService.updateMultipleParts(updatesList);
    }

    this.showToast(nextLocked ? '🔒 Elementos inmovilizados' : '🔓 Elementos desbloqueados');
  }

  toggleGroupLockById(groupId: string, event?: Event) {
    event?.stopPropagation();
    const grp = this.groups().find(g => g.id === groupId);
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    if (groupParts.length === 0) return;

    const currentlyLocked = this.isGroupLocked(groupId);
    const nextLocked = !currentlyLocked;

    this.projectService.updateGroup(groupId, { isLocked: nextLocked });
    const updatesList = groupParts.map(p => ({
      partId: p.id,
      updates: { isLocked: nextLocked }
    }));
    this.projectService.updateMultipleParts(updatesList, false);

    const groupName = grp ? grp.name : 'Módulo';
    this.showToast(
      nextLocked
        ? `🔒 "${groupName}" congelado (no se moverá por error)`
        : `🔓 "${groupName}" descongelado`
    );
  }

  togglePartVisibility(partId: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    const part = this.currentParts().find(p => p.id === partId);
    const partName = part ? part.name : 'Pieza';

    const next = new Set(this.hiddenPartIds());
    if (next.has(partId)) {
      next.delete(partId);
      this.hiddenPartIds.set(next);
      this.viewer3d()?.showPartById(partId);
      this.showToast(`👁️ "${partName}" visible`);
    } else {
      next.add(partId);
      this.hiddenPartIds.set(next);
      this.viewer3d()?.hidePartById(partId);
      if (this.selectedPartId() === partId) {
        this.selectedPartId.set(null);
        this.selectedPartIds.set([]);
        this.activeDockTab.set('catalog');
      }
      this.showToast(`👁️ "${partName}" oculta`);
    }
  }

  toggleGroupVisibility(groupId: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    const group = this.groups().find(g => g.id === groupId);
    const groupName = group ? group.name : 'Grupo';
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    const groupApps = this.appliances().filter(a => a.groupId === groupId);
    if (groupParts.length === 0 && groupApps.length === 0) return;

    const partIds = groupParts.map(p => p.id);
    const allHidden = partIds.length > 0
      ? partIds.every(id => this.hiddenPartIds().has(id))
      : groupApps.every(a => a.isHidden);

    const next = new Set(this.hiddenPartIds());
    if (allHidden) {
      for (const id of partIds) {
        next.delete(id);
      }
      if (groupApps.length > 0) {
        this.projectService.updateMultipleAppliances(groupApps.map(a => ({ id: a.id, updates: { isHidden: false } })));
      }
      this.hiddenPartIds.set(next);
      this.viewer3d()?.showPartsByIds(partIds);
      this.showToast(`👁️ "${groupName}" visible`);
    } else {
      for (const id of partIds) {
        next.add(id);
      }
      if (groupApps.length > 0) {
        this.projectService.updateMultipleAppliances(groupApps.map(a => ({ id: a.id, updates: { isHidden: true } })));
      }
      this.hiddenPartIds.set(next);
      this.viewer3d()?.hidePartsByIds(partIds);
      if (this.activeSelectedGroupId() === groupId) {
        this.deselectAll();
      }
      this.showToast(`👁️ "${groupName}" oculto`);
    }
  }

  toggleApplianceVisibility(appId: string, event?: Event) {
    event?.stopPropagation();
    const app = this.appliances().find(a => a.id === appId);
    if (!app) return;
    const nextHidden = !app.isHidden;
    this.projectService.updateAppliance(appId, { isHidden: nextHidden });
    this.showToast(nextHidden ? `👁️ "${app.name}" oculto (Alt+H para restaurar)` : `👁️ "${app.name}" visible`);
  }

  toggleApplianceLockById(appId: string, event?: Event) {
    event?.stopPropagation();
    const app = this.appliances().find(a => a.id === appId);
    if (!app) return;
    const nextLocked = !app.isLocked;
    this.projectService.updateAppliance(appId, { isLocked: nextLocked });
    this.showToast(nextLocked ? `🔒 "${app.name}" inmovilizado` : `🔓 "${app.name}" desbloqueado`);
  }

  showAllParts() {
    const prevParts = this.hiddenPartIds().size;
    const prevApps = this.appliances().filter(a => a.isHidden).length;
    const total = prevParts + prevApps;
    if (total === 0) {
      this.showToast('Todas las piezas y equipos ya son visibles');
      return;
    }
    this.hiddenPartIds.set(new Set());
    this.projectService.unhideAllAppliances();
    this.viewer3d()?.showAllParts();
    this.showToast(`👁️ Se restauraron ${total} elemento(s) ocultos`);
  }

  onHiddenPartsChangedFromViewer(hiddenIds: string[]) {
    this.hiddenPartIds.set(new Set(hiddenIds));
  }

  // --- MODO HABITACIÓN Y ENTORNO ARQUITECTÓNICO ---

  setWorkspaceMode(mode: WorkspaceMode) {
    this.workspaceMode.set(mode);
    if (mode === 'room') {
      setTimeout(() => {
        this.viewer3d()?.frameRoomView();
      }, 60);
      this.showToast('🏠 Modo Habitación 3D activado');
    } else {
      this.showToast('🪵 Modo Módulo Individual activado');
    }
  }

  toggleWorkspaceMode() {
    this.setWorkspaceMode(this.workspaceMode() === 'module' ? 'room' : 'module');
  }

  openRoomSettings() {
    this.showRoomSettingsModal.set(true);
  }

  closeRoomSettings() {
    this.showRoomSettingsModal.set(false);
  }

  updateRoomConfig(updates: Partial<RoomConfiguration>) {
    const cur = this.roomConfig();
    const targetW = updates.floorWidth ?? cur.floorWidth ?? 5000;
    const targetD = updates.floorDepth ?? cur.floorDepth ?? 5000;
    const prevW = cur.floorWidth ?? 5000;
    const prevD = cur.floorDepth ?? 5000;

    let walls = updates.walls ?? cur.walls;
    let extraUpdates: Partial<RoomConfiguration> = {};

    if ((targetW !== prevW || targetD !== prevD) && !updates.walls) {
      const wallT = updates.wallThickness ?? cur.wallThickness ?? 150;
      const offX = updates.wallOffsetX ?? cur.wallOffsetX ?? 0;
      const offZ = updates.wallOffsetZ ?? cur.wallOffsetZ ?? 0;
      const curWalls = getResolvedRoomWalls(cur);
      const rescaled = rescaleWallsToFloor(curWalls, prevW, prevD, targetW, targetD, wallT, offX, offZ);
      walls = rescaled;
      const mainWall = rescaled.find(item => item.id === 'main');
      const sideWall = rescaled.find(item => item.id === 'side');
      const rightWall = rescaled.find(item => item.id === 'right_side');
      extraUpdates = {
        mainWallLength: mainWall ? mainWall.length : Math.min(targetW, cur.mainWallLength),
        sideWallLength: sideWall ? sideWall.length : Math.min(Math.max(600, targetD - wallT), cur.sideWallLength),
        rightWallLength: rightWall ? rightWall.length : (cur.rightWallLength ? Math.min(Math.max(600, targetD - wallT), cur.rightWallLength) : undefined)
      };
    }

    const merged = { ...updates, ...extraUpdates, ...(walls ? { walls } : {}) };
    this.roomConfig.update(c => ({ ...c, ...merged }));
    this.projectService.updateRoomConfig(merged);
  }

  setRoomLayout(layout: RoomLayoutType) {
    const cur = this.roomConfig();
    const newWalls = getResolvedRoomWalls({ ...cur, layout, walls: undefined });
    this.updateRoomConfig({ layout, walls: newWalls });
    const label = layout === 'u_shape' ? 'Distribución en U' : layout === 'l_shape' ? 'Esquina en L' : 'Pared Recta';
    this.showToast(`📐 Disposición: ${label}`);
  }

  setFloorMaterial(mat: FloorMaterialType) {
    this.updateRoomConfig({ floorMaterial: mat });
    this.showToast('✨ Material de piso actualizado');
  }

  setWallMaterial(mat: WallMaterialType) {
    this.updateRoomConfig({ wallMaterial: mat });
    this.showToast('🎨 Material de pared actualizado');
  }

  setFloorCategory(cat: FloorFinishCategory) {
    this.activeFloorCategory.set(cat);
  }

  setWallCategory(cat: WallFinishCategory) {
    this.activeWallCategory.set(cat);
  }

  toggleFloorGrid() {
    this.updateRoomConfig({ showFloorGrid: !this.roomConfig().showFloorGrid });
  }

  toggleSkirting() {
    this.updateRoomConfig({ showSkirting: !this.roomConfig().showSkirting });
  }

  toggleAllWallsLock() {
    const cur = !this.roomConfig().isWallsLocked;
    this.updateRoomConfig({ isWallsLocked: cur });
    this.showToast(cur ? '🔒 Todos los muros bloqueados' : '🔓 Muros desbloqueados para edición');
  }

  frameRoomCamera() {
    this.viewer3d()?.frameRoomView();
  }

  alignWallsToEdge() {
    this.updateRoomConfig({ wallOffsetX: 0, wallOffsetZ: 0 });
    this.showToast('📐 Muros alineados al borde exacto del piso');
  }

  nudgeWalls(dx: number, dz: number) {
    const curX = this.roomConfig().wallOffsetX ?? 0;
    const curZ = this.roomConfig().wallOffsetZ ?? 0;
    this.updateRoomConfig({
      wallOffsetX: curX + dx,
      wallOffsetZ: curZ + dz
    });
  }

  stretchMainWall(delta: number) {
    const curL = this.roomConfig().mainWallLength;
    const maxL = this.roomConfig().floorWidth || 5000;
    const nextL = Math.max(600, Math.min(maxL, curL + delta));
    this.updateRoomConfig({ mainWallLength: nextL });
    this.showToast(`📏 Muro Principal: ${nextL} mm`);
  }

  stretchSideWall(delta: number) {
    const curL = this.roomConfig().sideWallLength;
    const maxL = Math.max(600, (this.roomConfig().floorDepth || 5000) - (this.roomConfig().wallThickness || 150));
    const nextL = Math.max(600, Math.min(maxL, curL + delta));
    this.updateRoomConfig({ sideWallLength: nextL });
    this.showToast(`📏 Muro Lateral: ${nextL} mm`);
  }

  setWorkspaceSize(width: number, depth: number) {
    const curCfg = this.roomConfig();
    const prevW = curCfg.floorWidth || 5000;
    const prevD = curCfg.floorDepth || 5000;
    const w = Math.max(2000, Math.min(25000, width));
    const d = Math.max(2000, Math.min(25000, depth));

    const currentWalls = getResolvedRoomWalls(curCfg);
    const wallT = curCfg.wallThickness || 150;
    const offX = curCfg.wallOffsetX ?? 0;
    const offZ = curCfg.wallOffsetZ ?? 0;
    const rescaledWalls = rescaleWallsToFloor(currentWalls, prevW, prevD, w, d, wallT, offX, offZ);

    const mainWall = rescaledWalls.find(item => item.id === 'main');
    const sideWall = rescaledWalls.find(item => item.id === 'side');
    const rightWall = rescaledWalls.find(item => item.id === 'right_side');

    this.projectService.updateWorkspaceDimensions(w, d);
    const updated = this.projectService.currentProject().roomConfig || DEFAULT_ROOM_CONFIG;
    this.roomConfig.set({
      ...this.roomConfig(),
      ...updated,
      floorWidth: w,
      floorDepth: d,
      mainWallLength: mainWall ? mainWall.length : Math.min(w, curCfg.mainWallLength),
      sideWallLength: sideWall ? sideWall.length : Math.min(Math.max(600, d - wallT), curCfg.sideWallLength),
      rightWallLength: rightWall ? rightWall.length : undefined,
      walls: rescaledWalls
    });
    this.showToast(`📐 Espacio adaptado: ${(w / 1000).toFixed(1)} × ${(d / 1000).toFixed(1)} m`);
  }

  setFloorDimensions(width: number, depth: number) {
    this.setWorkspaceSize(width, depth);
  }

  onWallSelected(wall: string | null) {
    this.selectedWall.set(wall);
    if (wall) {
      this.roomDockSubTab.set('wall');
      this.activeDockTab.set('piece');
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
      this.projectService.selectAppliance(null);
      this.projectService.selectAppliances([]);
      const inst = this.getWallInstance(wall);
      const wallName = inst ? inst.name : wall;
      this.showToast(`🧱 Seleccionado: ${wallName}`);
    }
  }

  getWallInstance(wallId: string): RoomWallInstance | null {
    return this.resolvedWalls().find(w => w.id === wallId) || null;
  }

  getWallLength(wallId: string): number {
    const w = this.getWallInstance(wallId);
    return w ? w.length : 2400;
  }

  getWallHeight(wallId: string): number {
    const w = this.getWallInstance(wallId);
    return w ? w.height : (this.roomConfig().wallHeight || 2600);
  }

  getWallThickness(wallId: string): number {
    const w = this.getWallInstance(wallId);
    return w ? w.thickness : (this.roomConfig().wallThickness || 150);
  }

  getWallRotation(wallId: string): number {
    const w = this.getWallInstance(wallId);
    return w ? (w.rotationY || 0) : 0;
  }

  isWallLocked(wallId: string): boolean {
    const cfg = this.roomConfig();
    const w = this.getWallInstance(wallId);
    return !!cfg.isWallsLocked || !!w?.isLocked || !!cfg.lockedWalls?.[wallId];
  }

  toggleWallLock(wallId: string) {
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const w = walls.find(item => item.id === wallId);
    const cur = this.isWallLocked(wallId);
    const updatedWalls = walls.map(item => {
      if (item.id === wallId) {
        return { ...item, isLocked: !cur };
      }
      return item;
    });
    const lockedWalls = { ...(cfg.lockedWalls || {}) };
    lockedWalls[wallId] = !cur;
    this.updateRoomConfig({ walls: updatedWalls, lockedWalls });
    const wallName = w ? w.name : 'Muro';
    this.showToast(cur ? `🔓 ${wallName} desbloqueado` : `🔒 ${wallName} congelado (inmóvil)`);
  }

  isWallHidden(wallId: string): boolean {
    const w = this.getWallInstance(wallId);
    return !!w?.isHidden || !!this.roomConfig().hiddenWalls?.[wallId];
  }

  toggleWallVisibility(wallId: string) {
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const w = walls.find(item => item.id === wallId);
    const cur = this.isWallHidden(wallId);
    const updatedWalls = walls.map(item => {
      if (item.id === wallId) {
        return { ...item, isHidden: !cur };
      }
      return item;
    });
    const hiddenWalls = { ...(cfg.hiddenWalls || {}) };
    hiddenWalls[wallId] = !cur;
    this.updateRoomConfig({ walls: updatedWalls, hiddenWalls });
    const wallName = w ? w.name : 'Muro';
    this.showToast(cur ? `👁️ ${wallName} visible` : `🙈 ${wallName} oculto`);
  }

  setWallLength(wallId: string, length: number) {
    const cfg = this.roomConfig();
    const floorW = cfg.floorWidth || 5000;
    const floorD = cfg.floorDepth || 5000;
    const maxLen = Math.max(floorW, floorD);
    const val = Math.max(400, Math.min(maxLen, length));
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, length: val };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  nudgeWallLength(wallId: string, delta: number) {
    const cur = this.getWallLength(wallId);
    this.setWallLength(wallId, cur + delta);
  }

  setWallHeight(wallId: string, height: number) {
    const val = Math.max(400, Math.min(4500, height));
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, height: val };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  nudgeWallHeight(wallId: string, delta: number) {
    const cur = this.getWallHeight(wallId);
    this.setWallHeight(wallId, cur + delta);
  }

  setWallRotation(wallId: string, rotationDeg: number) {
    const normalized = ((rotationDeg % 360) + 360) % 360;
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, rotationY: normalized };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
    this.showToast(`🔄 Giro de muro: ${normalized}°`);
  }

  rotateWall(wallId: string, deltaDeg = 90) {
    const cur = this.getWallRotation(wallId);
    this.setWallRotation(wallId, cur + deltaDeg);
  }

  setWallOrientation(wallId: string, orientation: 'horizontal' | 'vertical') {
    this.setWallRotation(wallId, orientation === 'horizontal' ? 0 : 90);
  }

  addRoomWall() {
    const cfg = this.roomConfig();
    const current = getResolvedRoomWalls(cfg);
    const newId = 'wall_' + Date.now();
    const newWall: RoomWallInstance = {
      id: newId,
      name: `Muro Divisorio ${current.length + 1}`,
      length: 2400,
      height: cfg.wallHeight || 2600,
      thickness: cfg.wallThickness || 150,
      posX: 0,
      posZ: 0,
      rotationY: 0,
      material: cfg.wallMaterial,
      showSkirting: cfg.showSkirting,
      isLocked: false,
      isHidden: false
    };
    this.updateRoomConfig({ walls: [...current, newWall] });
    this.onWallSelected(newId);
    this.showToast(`🧱 Creado "${newWall.name}". Puedes arrastrarlo libremente o girarlo con 'R'`);
  }

  duplicateWall(wallId?: string) {
    const targetId = wallId || this.selectedWall();
    if (!targetId) return;
    const cfg = this.roomConfig();
    const current = getResolvedRoomWalls(cfg);
    const original = current.find(w => w.id === targetId);
    if (!original) return;
    const newId = 'wall_' + Date.now();
    const clonedWall: RoomWallInstance = {
      ...original,
      id: newId,
      name: `${original.name} (Copia)`,
      posX: original.posX + 200,
      posZ: original.posZ + 200,
      isLocked: false,
      isHidden: false
    };
    this.updateRoomConfig({ walls: [...current, clonedWall] });
    this.onWallSelected(newId);
    this.showToast(`📋 Duplicado "${clonedWall.name}"`);
  }

  deleteWall(wallId?: string) {
    const targetId = wallId || this.selectedWall();
    if (!targetId) return;
    const cfg = this.roomConfig();
    const current = getResolvedRoomWalls(cfg);
    const wallToDelete = current.find(w => w.id === targetId);
    const wallName = wallToDelete ? wallToDelete.name : 'Muro';
    const remaining = current.filter(w => w.id !== targetId);
    this.updateRoomConfig({ walls: remaining });
    if (this.selectedWall() === targetId) {
      this.selectedWall.set(remaining.length > 0 ? remaining[0].id : null);
    }
    this.showToast(`🗑️ "${wallName}" eliminado`);
  }

  nudgeWallPos(wallId: string, axis: 'x' | 'z', delta: number) {
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) {
        return {
          ...w,
          posX: axis === 'x' ? w.posX + delta : w.posX,
          posZ: axis === 'z' ? w.posZ + delta : w.posZ
        };
      }
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  setWallThickness(wallId: string, thickness: number) {
    const val = Math.max(50, Math.min(600, thickness));
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, thickness: val };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  setWallPosX(wallId: string, posX: number) {
    const cfg = this.roomConfig();
    const floorW = cfg.floorWidth || 5000;
    const val = Math.max(-floorW / 2, Math.min(floorW / 2, posX));
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, posX: val };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  setWallPosZ(wallId: string, posZ: number) {
    const cfg = this.roomConfig();
    const floorD = cfg.floorDepth || 5000;
    const val = Math.max(-floorD / 2, Math.min(floorD / 2, posZ));
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, posZ: val };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  updateWallName(wallId: string, name: string) {
    if (!name.trim()) return;
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg);
    const updatedWalls = walls.map(w => {
      if (w.id === wallId) return { ...w, name: name.trim() };
      return w;
    });
    this.updateRoomConfig({ walls: updatedWalls });
  }

  nudgeWallThickness(delta: number) {
    const cur = this.roomConfig().wallThickness || 150;
    const nextVal = Math.max(50, Math.min(600, cur + delta));
    const cfg = this.roomConfig();
    const walls = getResolvedRoomWalls(cfg).map(w => ({ ...w, thickness: nextVal }));
    this.updateRoomConfig({ wallThickness: nextVal, walls });
  }

  nudgeFloorDimension(axis: 'width' | 'depth', delta: number) {
    const cfg = this.roomConfig();
    if (axis === 'width') {
      const cur = cfg.floorWidth || 5000;
      this.setWorkspaceSize(cur + delta, cfg.floorDepth || 5000);
    } else {
      const cur = cfg.floorDepth || 5000;
      this.setWorkspaceSize(cfg.floorWidth || 5000, cur + delta);
    }
  }

  nudgeWallOffset(axis: 'x' | 'z', delta: number) {
    if (axis === 'x') {
      this.nudgeWalls(delta, 0);
    } else {
      this.nudgeWalls(0, delta);
    }
  }

  moveEntireFurniture() {
    this.selectAllParts();
    this.activateMoveToolOnViewer();
    this.showToast('🧲 Mueble completo listo: arrástralo libremente hacia las paredes con imán inteligente');
  }

  // =========================================================================
  // PANEL MAESTRO "COCINA PRO / ESTILO GLOBAL" (CLICK-CUISINE 2) & CORTES CAD
  // =========================================================================

  readonly showKitchenProPanel = signal<boolean>(false);
  readonly kitchenProTab = signal<'styles' | 'countertop' | 'modules'>('styles');

  readonly layerVisibility = signal<LayerVisibilityState>({
    showCountertops: true,
    showFronts: true,
    showHandles: true,
    showPlinths: true,
    showAppliances: true
  });

  readonly countertopShape = signal<CountertopLayoutShape>('straight');
  readonly countertopMaterialId = signal<string>('mat_stone_carrara_30');
  readonly countertopThickness = signal<number>(30);
  readonly countertopBacksplash = signal<boolean>(true);
  readonly countertopLength = signal<number>(2100);
  readonly countertopSideLength = signal<number>(1800);
  readonly countertopDepth = signal<number>(620);

  readonly globalHandleType = signal<HandleType>('bar_modern');
  readonly globalHandleFinish = signal<HandleFinish>('brushed_steel');

  readonly specialCutCorner = signal<PartCornerCutConfig['corner']>('front_right');
  readonly specialCutX = signal<number>(150);
  readonly specialCutY = signal<number>(150);

  readonly countertopMaterials = computed(() => {
    const fromProject = this.materials().filter(m => isCountertopMaterial(m));
    if (fromProject.length > 0) return fromProject;
    return DEFAULT_COUNTERTOP_MATERIALS;
  });

  readonly selectedCountertopMaterial = computed(() => {
    const stats = this.selectedGroupStats();
    const gMatId = stats?.materialId;
    if (gMatId) {
      const found = this.countertopMaterials().find(m => m.id === gMatId);
      if (found) return found;
    }
    const sel = this.selectedPart();
    if (sel?.materialId) {
      const found = this.countertopMaterials().find(m => m.id === sel.materialId);
      if (found) return found;
    }
    const id = this.countertopMaterialId();
    return this.countertopMaterials().find(m => m.id === id) || this.countertopMaterials()[0];
  });

  readonly selectedCountertopThickness = computed<number>(() => {
    const stats = this.selectedGroupStats();
    if (this.isSelectedGroupCountertop() && stats) {
      return stats.thickness;
    }
    const gId = this.activeSelectedGroupId() || this.selectedPart()?.groupId;
    if (gId) {
      const parts = this.currentParts().filter(p => p.groupId === gId);
      const horizontalSlab = parts.find(p =>
        p.orientation === 'horizontal' &&
        !p.name.toUpperCase().includes('SALPICADERO')
      ) || parts.find(p => p.componentRole === 'countertop' && !p.name.toUpperCase().includes('SALPICADERO'));
      if (horizontalSlab) return horizontalSlab.thickness || 30;
    }
    const sel = this.selectedPart();
    if (sel) {
      if (sel.orientation === 'horizontal' && !sel.name.toUpperCase().includes('SALPICADERO')) {
        return sel.thickness || 30;
      }
      if (sel.groupId) {
        const parts = this.currentParts().filter(p => p.groupId === sel.groupId);
        const horizontalSlab = parts.find(p => p.orientation === 'horizontal' && !p.name.toUpperCase().includes('SALPICADERO'));
        if (horizontalSlab) return horizontalSlab.thickness || 30;
      }
      return sel.thickness || 30;
    }
    return this.countertopThickness();
  });

  toggleKitchenProPanel() {
    this.showKitchenProPanel.update(v => !v);
  }

  toggleLayerVisibility(key: keyof LayerVisibilityState) {
    this.layerVisibility.update(cur => {
      const nextVal = !cur[key];
      const labels: Record<keyof LayerVisibilityState, string> = {
        showCountertops: 'Mesones y Encimeras',
        showFronts: 'Puertas y Frentes',
        showHandles: 'Tiradores',
        showPlinths: 'Zócalos',
        showAppliances: 'Equipos y Mobiliario'
      };
      this.showToast(`${nextVal ? '👁️ Mostrando' : '🚫 Ocultando'}: ${labels[key]}`);
      return { ...cur, [key]: nextVal };
    });
  }

  applyGlobalRoleMaterial(
    target: 'fronts' | 'carcass' | 'plinths' | 'countertop',
    materialId: string
  ) {
    const count = this.projectService.applyGlobalMaterialByRole(target, materialId);
    const mat = this.materials().find(m => m.id === materialId);
    const targetNames: Record<typeof target, string> = {
      fronts: 'Puertas y Frentes',
      carcass: 'Estructura Interna',
      plinths: 'Zócalos',
      countertop: 'Mesones y Salpicaderos'
    };
    if (count > 0) {
      this.showToast(`🎨 ${targetNames[target]} actualizados a "${mat?.name || 'Material'}" (${count} pzs)`);
    } else {
      this.showToast(`ℹ️ No se encontraron piezas de tipo ${targetNames[target]} en la escena`);
    }
  }

  applyGlobalHandleStyle() {
    const count = this.projectService.applyGlobalHandles(
      this.globalHandleType(),
      this.globalHandleFinish()
    );
    if (count > 0) {
      this.showToast(`✨ Tiradores actualizados globalmente en ${count} puertas/frentes`);
    } else {
      this.showToast('ℹ️ No hay puertas o frentes de cajón en la escena');
    }
  }

  generateKitchenCountertop() {
    const isWaterfall = this.countertopShape() === 'island_waterfall';
    const created = this.projectService.generateSmartCountertop({
      shape: this.countertopShape(),
      materialId: this.countertopMaterialId(),
      thickness: this.countertopThickness(),
      includeBacksplash: isWaterfall ? false : this.countertopBacksplash(),
      backsplashHeight: 75,
      length: this.countertopLength(),
      sideLength: this.countertopSideLength(),
      depth: this.countertopDepth()
    });

    if (created.length > 0) {
      const mat = this.selectedCountertopMaterial();
      const isStone = mat?.textureType === 'stone';
      this.selectedPartId.set(created[0].id);
      this.selectedPartIds.set([created[0].id]);
      this.activeDockTab.set('piece');
      this.showToast(
        isStone
          ? `🪨 Mesón de piedra generado (${created.length} pzs) · Cotizado por m² en Presupuesto`
          : `🪵 Mesón de madera/melamina generado (${created.length} pzs) · Incluido en Corte 2D`
      );
    }
  }

  insertSpecializedKitchenModule(templateId: string, withAutoAppliance = true) {
    const tpl = this.templatesCatalog.getTemplateById(templateId);
    if (!tpl) return;

    const existingParts = this.currentParts();
    const offsetX = this.templatesCatalog.calculateTemplateOffset(existingParts, tpl.dimensions.width);
    const mats = this.materials();

    if (tpl.isParametric && tpl.parametricConfig) {
      const defaultT = this.projectService.currentProject().settings.defaultBoardThickness || 15;
      const matBody = mats[0] || { id: 'mat_blanco_15', thickness: defaultT };
      const isOvenOrSink = tpl.parametricConfig.category === 'oven_base' || tpl.parametricConfig.category === 'sink_base';
      const defaultBackType = isOvenOrSink ? 'none' : 'groove';
      const resolvedBackType = tpl.parametricConfig.backType || defaultBackType;
      const resolvedHasBack = tpl.parametricConfig.hasBackPanel !== undefined
        ? tpl.parametricConfig.hasBackPanel
        : (resolvedBackType !== 'none');

      const fullCfg: ParametricCabinetConfig = {
        code: tpl.parametricConfig.code || 'KPRO',
        name: tpl.name,
        moduleType: tpl.parametricConfig.moduleType || 'base_cabinet',
        category: tpl.parametricConfig.category || 'kitchen_base',
        width: tpl.dimensions.width,
        height: tpl.dimensions.height,
        depth: tpl.dimensions.depth,
        structureThickness: tpl.parametricConfig.structureThickness || matBody.thickness || defaultT,
        doorThickness: tpl.parametricConfig.doorThickness || defaultT,
        backThickness: tpl.parametricConfig.backThickness || 3,
        backType: resolvedBackType,
        hasBackPanel: resolvedHasBack,
        shelvesCount: tpl.parametricConfig.shelvesCount ?? 1,
        doorOpening: tpl.parametricConfig.doorOpening || 'left',
        structureMaterialId: matBody.id,
        doorMaterialId: matBody.id,
        backMaterialId: matBody.id,
        facadeGap: 3,
        hasPlinth: tpl.parametricConfig.hasPlinth !== false,
        plinthHeight: tpl.parametricConfig.plinthHeight || 80,
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        posX: offsetX,
        posY: tpl.dimensions.height / 2,
        posZ: 0
      };

      const generated = this.cabinetGen.generateParametricCabinet(fullCfg, mats);
      this.projectService.addParametricCabinet(generated);
      const partIds = generated.parts.map(p => p.id);
      this.selectedPartIds.set(partIds);
      this.selectedPartId.set(partIds[0] || null);

      // Auto-encastre inteligente de electrodomésticos 3D sobre/dentro del módulo insertado
      if (withAutoAppliance) {
        const modGroupId = generated.group?.id;
        if (tpl.parametricConfig.category === 'oven_base') {
          const ovenPreset = this.appliancesCatalog.find(p => p.id === 'preset_oven_60cm');
          const cooktopPreset = this.appliancesCatalog.find(p => p.id === 'preset_cooktop_induction_60cm');
          if (ovenPreset) {
            this.projectService.addAppliance({
              id: `appliance_oven_${Date.now()}`,
              type: 'oven',
              name: ovenPreset.name,
              brand: ovenPreset.brand,
              modelCode: ovenPreset.modelCode,
              width: 595,
              depth: 560,
              height: 595,
              finish: 'black_matte',
              position: { x: offsetX, y: 200, z: 10 },
              rotation: 0,
              mountType: 'built_in',
              price: ovenPreset.defaultPrice,
              includeInBudget: true,
              groupId: modGroupId
            });
          }
          if (cooktopPreset) {
            this.projectService.addAppliance({
              id: `appliance_cooktop_${Date.now() + 1}`,
              type: 'cooktop',
              name: cooktopPreset.name,
              brand: cooktopPreset.brand,
              modelCode: cooktopPreset.modelCode,
              width: 590,
              depth: 520,
              height: 60,
              finish: 'black_matte',
              position: { x: offsetX, y: tpl.dimensions.height, z: 0 },
              rotation: 0,
              mountType: 'countertop',
              price: cooktopPreset.defaultPrice,
              includeInBudget: true,
              groupId: modGroupId
            });
          }
        } else if (tpl.parametricConfig.category === 'sink_base') {
          const sinkPreset = this.appliancesCatalog.find(p => p.id === 'preset_sink_single_drainer');
          if (sinkPreset) {
            this.projectService.addAppliance({
              id: `appliance_sink_${Date.now()}`,
              type: 'sink',
              name: sinkPreset.name,
              brand: sinkPreset.brand,
              modelCode: sinkPreset.modelCode,
              width: 780,
              depth: 480,
              height: 210,
              finish: 'stainless_steel',
              position: { x: offsetX, y: tpl.dimensions.height, z: 0 },
              rotation: 0,
              mountType: 'countertop',
              price: sinkPreset.defaultPrice,
              includeInBudget: true,
              groupId: modGroupId
            });
          }
        } else if (tpl.parametricConfig.category === 'oven_tower') {
          const ovenPreset = this.appliancesCatalog.find(p => p.id === 'preset_oven_60cm');
          const microPreset = this.appliancesCatalog.find(p => p.id === 'preset_micro_builtin_trim');
          const plinthH = 80;
          const sideH = tpl.dimensions.height - plinthH;
          const lowerZoneH = Math.round(sideH * 0.32);
          const ovenBaseY = plinthH + lowerZoneH + 18;
          const microBaseY = ovenBaseY + 595 + 18;

          if (ovenPreset) {
            this.projectService.addAppliance({
              id: `appliance_tower_oven_${Date.now()}`,
              type: 'oven',
              name: ovenPreset.name,
              brand: ovenPreset.brand,
              modelCode: ovenPreset.modelCode,
              width: 595,
              depth: 560,
              height: 595,
              finish: 'black_matte',
              position: { x: offsetX, y: ovenBaseY, z: 10 },
              rotation: 0,
              mountType: 'built_in',
              price: ovenPreset.defaultPrice,
              includeInBudget: true,
              groupId: modGroupId
            });
          }
          if (microPreset) {
            this.projectService.addAppliance({
              id: `appliance_tower_micro_${Date.now() + 1}`,
              type: 'microwave',
              name: microPreset.name,
              brand: microPreset.brand,
              modelCode: microPreset.modelCode,
              width: 595,
              depth: 390,
              height: 388,
              finish: 'black_matte',
              position: { x: offsetX, y: microBaseY, z: 95 },
              rotation: 0,
              mountType: 'built_in',
              price: microPreset.defaultPrice,
              includeInBudget: true,
              groupId: modGroupId
            });
          }
        }
      }

      this.showToast(`✨ "${tpl.name}" insertado en la cocina`);
    }
  }

  applySpecialCutToSelectedPart(type: SpecialCutPresetType) {
    const sel = this.selectedPart();
    if (!sel) return;
    const cfg: PartCornerCutConfig = {
      type,
      corner: this.specialCutCorner(),
      cutX: Math.max(15, Number(this.specialCutX()) || 150),
      cutY: Math.max(15, Number(this.specialCutY()) || 150)
    };
    this.projectService.applyCornerCutToPart(sel.id, cfg);
    const labelMap: Record<SpecialCutPresetType, string> = {
      none: 'Rectángulo Estándar restaurado',
      chamfer_corner: `Chaflán (${cfg.cutX}×${cfg.cutY}mm) aplicado`,
      diagonal_side: `Corte Diagonal (${cfg.cutX}mm) aplicado`,
      notch_l: `Destaje en L (${cfg.cutX}×${cfg.cutY}mm) aplicado`,
      rounded_corners: `Esquinas redondeadas (R=${cfg.cutX}mm) aplicadas`
    };
    this.showToast(`📐 ${labelMap[type]} en "${sel.name}"`);
  }
}