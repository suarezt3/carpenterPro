import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { TemplatesCatalogService, FurnitureTemplate } from '../../services/templates-catalog.service';
import { Material, ParametricCabinetConfig, HandleType, HandleFinish } from '../../models/melamine.models';

export type ModuleCategoryPreset = 
  | 'kitchen_base' 
  | 'kitchen_wall' 
  | 'closet' 
  | 'vanity' 
  | 'bookshelf' 
  | 'custom';

@Component({
  selector: 'app-templates-modal',
  imports: [CommonModule],
  templateUrl: './templates-modal.html',
  styleUrl: './templates-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesModalComponent {
  readonly themeService = inject(ThemeService);
  readonly catalogService = inject(TemplatesCatalogService);

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
    if (cfg.category) this.activePreset.set(cfg.category);
  }

  // Presets de dimensiones según categoría
  readonly widthPresets = computed(() => {
    switch (this.activePreset()) {
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

  // Dimensiones interiores libres calculadas (100% puras)
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

  // Luz libre uniforme entre entrepaños (100% pura)
  readonly uniformShelfGap = computed(() => {
    const count = Math.max(0, Math.min(8, Math.floor(Number(this.shelvesCount()) || 0)));
    const innerH = this.innerHeight();
    if (count <= 0) return innerH;
    const t = Number(this.structureThickness()) || 15;
    const gap = (innerH - (count * t)) / (count + 1);
    return Math.max(0, Math.round(gap));
  });

  // Lista de posiciones relativas de los entrepaños para el diagrama técnico y resumen (100% pura)
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

  // Conteo total de piezas calculadas (100% pura)
  readonly totalPartsCount = computed(() => {
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

  // Catálogo legacy para la vista de exploración
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
    if (this.activePreset() === 'kitchen_wall') {
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

    const config: ParametricCabinetConfig = {
      name: this.moduleName().trim() || 'Módulo Paramétrico',
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
      shelvesCount: this.shelvesCount(),
      shelfDistribution: this.shelfDistribution(),
      shelfManualOffsets: this.shelfDistribution() === 'manual' ? this.shelfManualOffsets() : undefined,
      doorOpening: this.doorOpening(),
      hasHandle: this.hasHandle(),
      handleType: this.hasHandle() ? this.handleType() : 'none',
      handleFinish: this.handleFinish(),
      handlePosition: this.handlePosition(),
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

  // Navegación en catálogo legacy
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
