import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  viewChild,
  ElementRef,
  effect,
  untracked
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  Archive01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  Delete02Icon,
  InformationCircleIcon,
  Layers01Icon,
  PaintBoardIcon,
  RulerIcon,
  Search01Icon,
  Settings01Icon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';
import { TemplatesCatalogService, FurnitureTemplate } from '../../services/templates-catalog.service';
import { Material, ParametricCabinetConfig, HandleType, HandleFinish } from '../../models/melamine.models';

type HugeIconDef = typeof Compass01Icon;
const cadSvg = (paths: string[]): HugeIconDef =>
  paths.map((d, idx) => ['path', { d, key: `tm_${idx}` }]) as unknown as HugeIconDef;

export type ModuleCategoryPreset =
  | 'kitchen_base'
  | 'kitchen_wall'
  | 'closet'
  | 'vanity'
  | 'bookshelf'
  | 'drawers'
  | 'custom';

@Component({
  selector: 'app-templates-modal',
  imports: [HugeiconsIconComponent],
  templateUrl: './templates-modal.html',
  styleUrl: './templates-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesModalComponent {
  readonly themeService = inject(ThemeService);
  readonly catalogService = inject(TemplatesCatalogService);

  // Registro local de iconos vectoriales de Hugeicons y trazos CAD
  readonly icons = {
    tune: Settings01Icon,
    magicWand: cadSvg([
      'M14.5 4.5L19.5 9.5L7.5 21.5L2.5 16.5L14.5 4.5Z',
      'M12 7L17 12',
      'M19 2V5',
      'M17.5 3.5H20.5',
      'M6 3V5',
      'M5 4H7'
    ]),
    book: cadSvg([
      'M4 5.5A2.5 2.5 0 0 1 6.5 3H20V19H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z',
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
      'M8 7H16',
      'M8 11H14'
    ]),
    close: Cancel01Icon,
    countertop: cadSvg([
      'M3 7H21V10H3V7Z',
      'M4 10V20H20V10',
      'M12 10V20',
      'M9.5 14V15.5',
      'M14.5 14V15.5'
    ]),
    kitchen: cadSvg([
      'M4 4H20V16H4V4Z',
      'M12 4V16',
      'M9.5 9V11',
      'M14.5 9V11',
      'M4 20H20'
    ]),
    closetDoor: cadSvg([
      'M5 3H19V21H5V3Z',
      'M12 3V21',
      'M9.5 11.5V12.5',
      'M14.5 11.5V12.5'
    ]),
    vanity: cadSvg([
      'M4 10H20V20H4V10Z',
      'M7 10V8A5 5 0 0 1 17 8V10',
      'M12 4V6',
      'M8 14H16'
    ]),
    shelves: cadSvg([
      'M4 3H20V21H4V3Z',
      'M4 9H20',
      'M4 15H20'
    ]),
    ruler: RulerIcon,
    squareShape: cadSvg(['M4 4H20V20H4V4Z']),
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    arrowUp: ArrowUp01Icon,
    doubleArrows: cadSvg([
      'M3 9H21',
      'M7 5L3 9L7 13',
      'M21 15H3',
      'M17 11L21 15L17 19'
    ]),
    knob: cadSvg([
      'M20 12A8 8 0 1 1 4 12A8 8 0 0 1 20 12Z',
      'M15 12A3 3 0 1 1 9 12A3 3 0 0 1 15 12Z'
    ]),
    tableRows: cadSvg([
      'M4 4H20V20H4V4Z',
      'M4 9.5H20',
      'M4 14.5H20'
    ]),
    equalizer: cadSvg([
      'M6 18V10',
      'M12 18V6',
      'M18 18V13',
      'M4 18H20'
    ]),
    editAttributes: cadSvg([
      'M4 7H20',
      'M4 12H14',
      'M4 17H11',
      'M16 14L20 18',
      'M20 14L16 18'
    ]),
    info: InformationCircleIcon,
    palette: PaintBoardIcon,
    compass: Compass01Icon,
    lightbulb: InformationCircleIcon,
    cube3d: cadSvg([
      'M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z',
      'M12 12L20 7.5',
      'M12 12L4 7.5',
      'M12 12V21'
    ]),
    checkCircle: CheckmarkCircle02Icon,
    chevronLeft: ArrowLeft01Icon,
    chevronRight: ArrowRight01Icon,
    search: Search01Icon,
    add: Add01Icon,
    delete: Delete02Icon,
    inbox: Archive01Icon,
    layers: Layers01Icon
  };

  /**
   * Mapea el nombre de ícono de una categoría o plantilla del catálogo a su vector de Hugeicons.
   */
  getCatalogIcon(iconName?: string): HugeIconDef {
    switch (iconName) {
      case 'countertops':
        return this.icons.countertop;
      case 'kitchen':
        return this.icons.kitchen;
      case 'door_sliding':
      case 'checkroom':
      case 'meeting_room':
        return this.icons.closetDoor;
      case 'bathtub':
      case 'wash':
        return this.icons.vanity;
      case 'shelves':
      case 'menu_book':
      case 'table_rows':
        return this.icons.shelves;
      case 'inbox':
      case 'view_agenda':
      case 'dns':
        return this.icons.inbox;
      case 'tune':
        return this.icons.tune;
      case 'apps':
      case 'grid_view':
      case 'dashboard':
      case 'view_in_ar':
      default:
        return this.icons.cube3d;
    }
  }

  isOpen = input<boolean>(false);
  materials = input<Material[]>([]);
  editingGroupId = input<string | null>(null);
  editingConfig = input<ParametricCabinetConfig | null>(null);

  modalClose = output<void>();
  cabinetCreated = output<{ config: ParametricCabinetConfig; mode: 'replace' | 'append' }>();
  cabinetUpdated = output<{ groupId: string; config: ParametricCabinetConfig }>();
  templateSelected = output<{ template: FurnitureTemplate; mode: 'replace' | 'append' }>();
  configureParametricRequested = output<FurnitureTemplate>();
  startBlankRequested = output<void>();

  // Modo de vista: 'assistant' (por defecto) o 'catalog'
  activeView = signal<'assistant' | 'catalog'>('assistant');

  // Categoría activa del asistente
  activePreset = signal<ModuleCategoryPreset>('kitchen_base');

  // Parámetros reactivos del módulo
  moduleName = signal<string>('Módulo Cocina Bajo');
  width = signal<number>(600);
  height = signal<number>(820);
  depth = signal<number>(580);

  structureThickness = signal<number>(15);
  doorThickness = signal<number>(15);

  doorOpening = signal<'none' | 'left' | 'right' | 'double' | 'top' | 'bottom'>('left');
  hasHandle = signal<boolean>(true);
  handleType = signal<HandleType>('bar_modern');
  handleFinish = signal<HandleFinish>('brushed_steel');
  handlePosition = signal<'vertical' | 'horizontal' | 'centered'>('vertical');

  // Parámetros reactivos específicos para Cajoneras (Gavetas)
  drawersCount = signal<number>(3);
  drawerSlideType = signal<'telescopic' | 'soft_close' | 'telescopic_35' | 'undermount'>('telescopic');
  drawerFrontType = signal<'overlay' | 'inset'>('overlay');
  hasPlinth = signal<boolean>(true);
  plinthHeight = signal<number>(70);

  shelvesCount = signal<number>(1);
  shelfDistribution = signal<'uniform' | 'manual'>('uniform');
  shelfManualOffsets = signal<number[]>([380]);

  hasBackPanel = signal<boolean>(true);
  backThickness = signal<number>(3);

  structureMaterialId = signal<string>('');
  doorMaterialId = signal<string>('');
  useSameMaterialForDoors = signal<boolean>(true);

  creationMode = signal<'append' | 'replace'>('append');

  loadConfig(cfg: ParametricCabinetConfig) {
    this.activeView.set('assistant');
    if (cfg.name) this.moduleName.set(cfg.name);
    const safeWidth = Math.max(150, Number(cfg.width) || 600);
    const safeHeight = Math.max(200, Number(cfg.height) || 820);
    const safeDepth = Math.max(150, Number(cfg.depth) || 580);
    const safeStructT = Number(cfg.structureThickness) || 15;
    const safeDoorT = Number(cfg.doorThickness) || 15;
    const safeShelvesCount = Math.max(0, Math.min(8, Math.floor(Number(cfg.shelvesCount) || 0)));

    this.width.set(safeWidth);
    this.height.set(safeHeight);
    this.depth.set(safeDepth);
    this.structureThickness.set(safeStructT);
    this.doorThickness.set(safeDoorT);
    if (cfg.doorOpening) this.doorOpening.set(cfg.doorOpening);
    this.hasHandle.set(cfg.hasHandle !== false);
    if (cfg.handleType) this.handleType.set(cfg.handleType);
    if (cfg.handleFinish) this.handleFinish.set(cfg.handleFinish);
    if (cfg.handlePosition) this.handlePosition.set(cfg.handlePosition);
    this.shelvesCount.set(safeShelvesCount);
    this.shelfDistribution.set(cfg.shelfDistribution || 'uniform');

    if (cfg.category === 'drawers' || cfg.moduleType === 'drawer_unit') {
      this.activePreset.set('drawers');
    } else if (cfg.category) {
      this.activePreset.set(cfg.category as ModuleCategoryPreset);
    }
    if (cfg.drawersCount) this.drawersCount.set(Math.max(2, Math.min(6, Math.floor(Number(cfg.drawersCount)))));
    if (cfg.drawerSlideType) this.drawerSlideType.set(cfg.drawerSlideType);
    if (cfg.drawerFrontType) this.drawerFrontType.set(cfg.drawerFrontType);
    if (cfg.hasPlinth !== undefined) this.hasPlinth.set(cfg.hasPlinth);
    if (cfg.plinthHeight) this.plinthHeight.set(Number(cfg.plinthHeight));

    const innerH = Math.max(50, safeHeight - (2 * safeStructT));
    if (cfg.shelfManualOffsets && Array.isArray(cfg.shelfManualOffsets) && cfg.shelfManualOffsets.length === safeShelvesCount) {
      this.shelfManualOffsets.set(cfg.shelfManualOffsets.map((val, idx) => {
        const n = Number(val);
        return (!isNaN(n) && n > 20 && n < innerH) ? Math.round(n) : Math.round((innerH / (safeShelvesCount + 1)) * (idx + 1));
      }));
    } else {
      this.syncManualOffsets();
    }

    this.hasBackPanel.set(cfg.hasBackPanel !== false && cfg.backType !== 'none');
    if (cfg.structureMaterialId) this.structureMaterialId.set(cfg.structureMaterialId);
    if (cfg.doorMaterialId) {
      this.doorMaterialId.set(cfg.doorMaterialId);
      this.useSameMaterialForDoors.set(cfg.doorMaterialId === (cfg.structureMaterialId || this.structureMaterialId()));
    }
  }

  // Presets de dimensiones según categoría
  readonly widthPresets = computed(() => {
    switch (this.activePreset()) {
      case 'drawers':
        return [400, 450, 500, 600, 700, 800, 900];
      case 'kitchen_base':
      case 'kitchen_wall':
        return [300, 400, 450, 500, 600, 800, 900];
      case 'closet':
        return [600, 800, 900, 1000, 1200, 1500];
      case 'vanity':
        return [500, 600, 700, 800, 1000];
      case 'bookshelf':
        return [600, 800, 900, 1000, 1200];
      default:
        return [400, 600, 800, 1000];
    }
  });

  readonly heightPresets = computed(() => {
    switch (this.activePreset()) {
      case 'drawers':
        return [600, 700, 750, 800, 850, 900, 1000];
      case 'kitchen_base':
        return [720, 800, 820, 850, 900];
      case 'kitchen_wall':
        return [600, 700, 720, 800, 900];
      case 'closet':
        return [1800, 2000, 2100, 2200, 2400];
      case 'vanity':
        return [500, 600, 650, 700, 800];
      case 'bookshelf':
        return [1200, 1500, 1800, 2000, 2200];
      default:
        return [600, 800, 1200, 1800];
    }
  });

  readonly depthPresets = computed(() => {
    switch (this.activePreset()) {
      case 'drawers':
        return [400, 450, 500, 550, 600];
      case 'kitchen_base':
        return [500, 550, 580, 600];
      case 'kitchen_wall':
        return [300, 320, 350, 380];
      case 'closet':
        return [500, 550, 580, 600];
      case 'vanity':
        return [400, 450, 500, 550];
      case 'bookshelf':
        return [280, 300, 350, 400];
      default:
        return [300, 400, 500, 600];
    }
  });

  // Dimensiones interiores libres calculadas
  readonly innerWidth = computed(() => {
    const w = Number(this.width()) || 600;
    const t = Number(this.structureThickness()) || 15;
    return Math.max(50, w - (2 * t));
  });

  readonly innerHeight = computed(() => {
    const h = Number(this.height()) || 820;
    const t = Number(this.structureThickness()) || 15;
    return Math.max(50, h - (2 * t));
  });

  readonly innerDepth = computed(() => {
    const d = Number(this.depth()) || 580;
    const doorT = Number(this.doorThickness()) || 15;
    const hasDoor = this.doorOpening() !== 'none';
    return Math.max(50, d - (hasDoor ? doorT : 0));
  });

  // Dimensiones de corte de puerta
  readonly doorCutWidth = computed(() => {
    const w = Number(this.width()) || 600;
    if (this.doorOpening() === 'double') {
      return Math.max(50, Math.round((w / 2) - 3));
    }
    return Math.max(50, Math.round(w - 3));
  });

  readonly doorCutHeight = computed(() => {
    const h = Number(this.height()) || 820;
    return Math.max(50, Math.round(h - 3));
  });

  // Dimensiones de corte de frente de cajón y blueprint
  readonly drawerFrontWidth = computed(() => {
    const w = Number(this.width()) || 600;
    if (this.drawerFrontType() === 'inset') {
      return Math.max(50, this.innerWidth() - 4);
    }
    return Math.max(50, w - 4);
  });

  readonly drawerFrontHeight = computed(() => {
    const count = Math.max(1, Math.min(6, Math.floor(Number(this.drawersCount()) || 3)));
    const totalH = Number(this.height()) || 750;
    const plinthH = this.hasPlinth() ? (Number(this.plinthHeight()) || 70) : 0;
    const topT = Number(this.structureThickness()) || 18;
    const availH = Math.max(50, totalH - plinthH - topT);
    const gap = 3;
    const frontH = (availH - ((count - 1) * gap)) / count;
    return Math.max(40, Math.round(frontH));
  });

  readonly recommendedSlideLength = computed(() => {
    const d = Number(this.depth()) || 500;
    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    return standardLengths.filter(l => l <= d - 35).pop() || 400;
  });

  readonly drawerBoxesBlueprint = computed(() => {
    const count = Math.max(1, Math.min(6, Math.floor(Number(this.drawersCount()) || 3)));
    const plinthSvgH = this.hasPlinth() ? 20 : 0;
    const availSvgH = 190 - plinthSvgH;
    const gapSvg = 2;
    const boxSvgH = (availSvgH - ((count - 1) * gapSvg)) / count;

    return Array.from({ length: count }, (_, idx) => {
      const y = 25 + (idx * (boxSvgH + gapSvg));
      return {
        index: idx + 1,
        y,
        height: boxSvgH,
        handleY: y + (boxSvgH / 2) - 2
      };
    });
  });

  // Luz libre uniforme entre entrepaños
  readonly uniformShelfGap = computed(() => {
    const count = Math.max(0, Math.min(8, Math.floor(Number(this.shelvesCount()) || 0)));
    const innerH = this.innerHeight();
    if (count <= 0) return innerH;
    const t = Number(this.structureThickness()) || 15;
    const gap = (innerH - (count * t)) / (count + 1);
    return Math.max(0, Math.round(gap));
  });

  // Lista de posiciones relativas de los entrepaños para el diagrama técnico y resumen
  readonly effectiveShelvesList = computed(() => {
    const count = Math.max(0, Math.min(8, Math.floor(Number(this.shelvesCount()) || 0)));
    if (count <= 0) return [];
    const innerH = Math.max(50, this.innerHeight());

    if (this.shelfDistribution() === 'manual') {
      const offsets = this.shelfManualOffsets();
      return Array.from({ length: count }, (_, idx) => {
        const rawOff = offsets[idx];
        const off = (rawOff !== undefined && !isNaN(Number(rawOff)))
          ? Number(rawOff)
          : Math.round((innerH / (count + 1)) * (idx + 1));
        const pct = Math.min(95, Math.max(5, (off / innerH) * 100));
        return { index: idx + 1, offset: off, percentage: pct };
      });
    }

    // Uniforme
    const step = innerH / (count + 1);
    return Array.from({ length: count }, (_, idx) => {
      const off = Math.round(step * (idx + 1));
      const pct = ((idx + 1) / (count + 1)) * 100;
      return { index: idx + 1, offset: off, percentage: pct };
    });
  });

  // Conteo total de piezas calculadas
  readonly totalPartsCount = computed(() => {
    if (this.activePreset() === 'drawers') {
      let count = 4; // 2 laterales + 1 tapa + 1 piso
      if (this.hasPlinth()) count += 4; // 4 piezas de zócalo perimetral (frontal, trasero, 2 laterales)
      if (this.hasBackPanel()) count += 1;
      count += (this.drawersCount() * 6);
      return count;
    }
    let count = 4; // 2 laterales + 1 piso + 1 techo
    count += Math.max(0, Math.min(8, Math.floor(Number(this.shelvesCount()) || 0)));
    if (this.hasBackPanel()) count += 1;
    if (this.doorOpening() === 'double') count += 2;
    else if (this.doorOpening() !== 'none') count += 1;
    return count;
  });

  // Material seleccionado
  readonly selectedStructureMat = computed(() => {
    const mats = this.materials();
    if (mats.length === 0) return null;
    return mats.find(m => m.id === this.structureMaterialId()) || mats[0];
  });

  readonly selectedDoorMat = computed(() => {
    if (this.useSameMaterialForDoors()) {
      return this.selectedStructureMat();
    }
    const mats = this.materials();
    if (mats.length === 0) return null;
    return mats.find(m => m.id === this.doorMaterialId()) || this.selectedStructureMat();
  });

  // Catálogo para la vista de exploración
  searchQuery = signal<string>('');
  activeCategory = signal<string>('all');
  selectedTemplate = signal<FurnitureTemplate | null>(null);

  readonly categories = computed(() => this.catalogService.getCategories());

  filteredTemplates = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();

    return this.catalogService.templates.filter(t => {
      const matchCat = cat === 'all' || t.category === cat;
      if (!matchCat) return false;
      if (!q) return true;
      const inName = t.name.toLowerCase().includes(q);
      const inDesc = t.description.toLowerCase().includes(q);
      const inBadge = t.badge.toLowerCase().includes(q);
      const inDims = `${t.dimensions.width} ${t.dimensions.height} ${t.dimensions.depth}`.includes(q);
      const inCat = t.categoryLabel.toLowerCase().includes(q);
      return inName || inDesc || inBadge || inDims || inCat;
    });
  });

  categoriesNavRef = viewChild<ElementRef<HTMLDivElement>>('categoriesNav');

  constructor() {
    // 1. Cargar configuración del módulo a editar: SOLO depende de isOpen(), editingGroupId() y editingConfig()
    effect(() => {
      const open = this.isOpen();
      const groupId = this.editingGroupId();
      const cfg = this.editingConfig();
      if (open && groupId && cfg) {
        untracked(() => {
          this.loadConfig(cfg);
        });
      }
    });

    // 2. Inicializar materiales cuando estén listos: SOLO depende de materials()
    effect(() => {
      const mats = this.materials();
      if (mats.length > 0) {
        untracked(() => {
          if (!this.structureMaterialId()) {
            this.structureMaterialId.set(mats[0].id);
          }
          if (!this.doorMaterialId()) {
            this.doorMaterialId.set(mats[0].id);
          }
        });
      }
    });

    // 3. Ajustar puertas dobles si el ancho es >= 800 mm en modo creación (nunca sobrescribir al editar un grupo)
    effect(() => {
      const w = this.width();
      untracked(() => {
        if (this.editingGroupId()) return;
        const currentOpening = this.doorOpening();
        if (w >= 800 && (currentOpening === 'left' || currentOpening === 'right') && this.activePreset() !== 'custom') {
          this.doorOpening.set('double');
        }
      });
    });
  }

  // Selección de preset
  selectPreset(preset: ModuleCategoryPreset) {
    this.activePreset.set(preset);
    switch (preset) {
      case 'drawers':
        this.moduleName.set('Cajonera 3 Cajones');
        this.width.set(600);
        this.height.set(750);
        this.depth.set(500);
        this.drawersCount.set(3);
        this.drawerSlideType.set('telescopic');
        this.drawerFrontType.set('overlay');
        this.hasPlinth.set(true);
        this.plinthHeight.set(70);
        this.doorOpening.set('none');
        this.shelvesCount.set(0);
        this.hasHandle.set(true);
        this.handleType.set('bar_modern');
        this.handlePosition.set('horizontal');
        this.hasBackPanel.set(true);
        break;
      case 'kitchen_base':
        this.moduleName.set('Módulo Cocina Bajo');
        this.width.set(600);
        this.height.set(820);
        this.depth.set(580);
        this.doorOpening.set('left');
        this.shelvesCount.set(1);
        this.hasHandle.set(true);
        this.hasBackPanel.set(true);
        break;
      case 'kitchen_wall':
        this.moduleName.set('Alacena Aérea');
        this.width.set(600);
        this.height.set(720);
        this.depth.set(320);
        this.doorOpening.set('left');
        this.shelvesCount.set(2);
        this.hasHandle.set(true);
        this.hasBackPanel.set(true);
        break;
      case 'closet':
        this.moduleName.set('Armario / Closet');
        this.width.set(800);
        this.height.set(2000);
        this.depth.set(600);
        this.doorOpening.set('double');
        this.shelvesCount.set(4);
        this.hasHandle.set(true);
        this.hasBackPanel.set(true);
        break;
      case 'vanity':
        this.moduleName.set('Vanitorio Baño');
        this.width.set(600);
        this.height.set(650);
        this.depth.set(450);
        this.doorOpening.set('left');
        this.shelvesCount.set(1);
        this.hasHandle.set(true);
        this.hasBackPanel.set(true);
        break;
      case 'bookshelf':
        this.moduleName.set('Estantería Abierta');
        this.width.set(800);
        this.height.set(1800);
        this.depth.set(350);
        this.doorOpening.set('none');
        this.shelvesCount.set(4);
        this.hasHandle.set(false);
        this.hasBackPanel.set(true);
        break;
      case 'custom':
        this.moduleName.set('Módulo a Medida');
        this.width.set(600);
        this.height.set(800);
        this.depth.set(400);
        this.doorOpening.set('left');
        this.shelvesCount.set(1);
        this.hasHandle.set(true);
        this.hasBackPanel.set(true);
        break;
    }
    this.syncManualOffsets();
  }

  // Cambiar cantidad de entrepaños
  setShelvesCount(count: number) {
    const clamped = Math.max(0, Math.min(8, Math.floor(Number(count) || 0)));
    this.shelvesCount.set(clamped);
    this.syncManualOffsets();
  }

  setShelfDistribution(mode: 'uniform' | 'manual') {
    this.shelfDistribution.set(mode);
    if (mode === 'manual') {
      this.syncManualOffsets();
    }
  }

  syncManualOffsets() {
    const count = Math.max(0, Math.min(8, Math.floor(Number(this.shelvesCount()) || 0)));
    const innerH = Math.max(50, Number(this.innerHeight()) || 750);
    const current = Array.isArray(this.shelfManualOffsets()) ? [...this.shelfManualOffsets()] : [];
    const step = innerH / (count + 1);
    const next: number[] = [];
    for (let i = 0; i < count; i++) {
      const existingVal = Number(current[i]);
      if (!isNaN(existingVal) && existingVal > 20 && existingVal < innerH) {
        next.push(Math.round(existingVal));
      } else {
        next.push(Math.round(step * (i + 1)));
      }
    }
    this.shelfManualOffsets.set(next);
  }

  updateManualShelfOffset(index: number, val: number) {
    const current = [...this.shelfManualOffsets()];
    const innerH = Math.max(50, Number(this.innerHeight()) || 750);
    const safeVal = Number(val) || 30;
    const clamped = Math.min(innerH - 20, Math.max(30, Math.round(safeVal)));
    current[index] = clamped;
    this.shelfManualOffsets.set(current);
  }

  // Creación del módulo paramétrico
  onSubmitAssistant() {
    const defaultMat = this.materials()[0]?.id || 'mat-1';
    const structMat = this.structureMaterialId() || defaultMat;
    const doorMat = this.useSameMaterialForDoors() ? structMat : (this.doorMaterialId() || structMat);
    const backMat = this.materials().find(m => m.thickness <= 6)?.id || structMat;

    let moduleType: ParametricCabinetConfig['moduleType'] = 'base_cabinet';
    if (this.activePreset() === 'drawers') {
      moduleType = 'drawer_unit';
    } else if (this.activePreset() === 'kitchen_wall') {
      moduleType = 'wall_cabinet';
    } else if (this.activePreset() === 'closet') {
      moduleType = 'closet';
    } else if (this.activePreset() === 'vanity') {
      moduleType = 'vanity';
    } else if (this.activePreset() === 'bookshelf') {
      moduleType = 'bookshelf';
    }

    // Elevación predeterminada:
    let elevationY = 0;
    if (moduleType === 'wall_cabinet') {
      elevationY = 1450 + (this.height() / 2);
    } else if (moduleType === 'vanity') {
      elevationY = 250 + (this.height() / 2);
    } else {
      elevationY = this.height() / 2;
    }

    const isDrawers = this.activePreset() === 'drawers';

    const config: ParametricCabinetConfig = {
      name: this.moduleName().trim() || (isDrawers ? `Cajonera ${this.drawersCount()} Cajones` : 'Módulo Paramétrico'),
      code: 'MOD_' + Math.floor(100 + Math.random() * 900),
      moduleType,
      category: this.activePreset(),
      width: this.width(),
      height: this.height(),
      depth: this.depth(),
      structureThickness: this.structureThickness(),
      doorThickness: this.doorThickness(),
      backThickness: this.backThickness(),
      backType: this.hasBackPanel() ? 'groove' : 'none',
      hasBackPanel: this.hasBackPanel(),
      shelvesCount: isDrawers ? 0 : this.shelvesCount(),
      shelfDistribution: this.shelfDistribution(),
      shelfManualOffsets: (!isDrawers && this.shelfDistribution() === 'manual') ? this.shelfManualOffsets() : undefined,
      doorOpening: isDrawers ? 'none' : this.doorOpening(),
      drawersCount: isDrawers ? this.drawersCount() : undefined,
      drawerSlideType: isDrawers ? this.drawerSlideType() : undefined,
      drawerFrontType: isDrawers ? this.drawerFrontType() : undefined,
      hasPlinth: isDrawers ? this.hasPlinth() : undefined,
      plinthHeight: isDrawers ? this.plinthHeight() : undefined,
      hasTopCover: isDrawers ? true : undefined,
      hasHandle: this.hasHandle(),
      handleType: this.hasHandle() ? this.handleType() : 'none',
      handleFinish: this.handleFinish(),
      handlePosition: isDrawers ? 'horizontal' : this.handlePosition(),
      structureMaterialId: structMat,
      doorMaterialId: doorMat,
      backMaterialId: backMat,
      facadeGap: 3,
      posY: elevationY
    };

    if (this.editingGroupId()) {
      this.cabinetUpdated.emit({ groupId: this.editingGroupId()!, config });
    } else {
      this.cabinetCreated.emit({ config, mode: this.creationMode() });
    }
    this.close();
  }

  // Navegación en catálogo
  scrollCategories(direction: 'left' | 'right') {
    const el = this.categoriesNavRef()?.nativeElement;
    if (!el) return;
    const scrollAmount = 260;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  onCategoryWheel(event: WheelEvent) {
    const el = this.categoriesNavRef()?.nativeElement;
    if (!el) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      el.scrollBy({ left: event.deltaY, behavior: 'auto' });
      event.preventDefault();
    }
  }

  selectCategory(catId: string) {
    this.activeCategory.set(catId);
  }

  onSelectTemplate(t: FurnitureTemplate, mode: 'replace' | 'append') {
    this.templateSelected.emit({ template: t, mode });
    this.close();
  }

  onConfigureTemplate(t: FurnitureTemplate) {
    this.configureParametricRequested.emit(t);
    this.close();
  }

  onStartBlank() {
    this.startBlankRequested.emit();
    this.close();
  }

  close() {
    this.selectedTemplate.set(null);
    this.modalClose.emit();
  }
}