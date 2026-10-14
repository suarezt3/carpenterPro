import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  effect,
  untracked
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  Layers01Icon,
  PaintBoardIcon,
  RulerIcon,
  Settings01Icon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';
import { Material, ParametricCabinetConfig, HandleType, HandleFinish } from '../../models/melamine.models';

/**
 * Modal de configuración rápida de opciones de componente paramétrico (alacenas y gabinetes).
 * Muestra un diagrama técnico SVG de fachada con líneas de abatimiento en vivo.
 */
@Component({
  selector: 'app-component-options-modal',
  imports: [HugeiconsIconComponent],
  templateUrl: './component-options-modal.html',
  styleUrl: './component-options-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentOptionsModalComponent {
  readonly themeService = inject(ThemeService);

  // Registro local de iconos vectoriales de Hugeicons
  readonly icons = {
    compass: Compass01Icon,
    close: Cancel01Icon,
    ruler: RulerIcon,
    settings: Settings01Icon,
    layers: Layers01Icon,
    palette: PaintBoardIcon,
    checkCircle: CheckmarkCircle02Icon,
    add: Add01Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    arrowUp: ArrowUp01Icon,
    arrowDown: ArrowDown01Icon
  };

  // Inputs y Outputs del modal
  readonly isOpen = input<boolean>(false);
  readonly materials = input<Material[]>([]);
  readonly initialConfig = input<ParametricCabinetConfig | null>(null);

  readonly modalClose = output<void>();
  readonly cabinetSubmitted = output<ParametricCabinetConfig>();

  // Signals reactivos de los parámetros del módulo
  readonly code = signal<string>('MALT1PU001');
  readonly name = signal<string>('Módulo Alto 1 Puerta');
  readonly width = signal<number>(600);
  readonly height = signal<number>(800);
  readonly depth = signal<number>(320);

  readonly structureThickness = signal<number>(18);
  readonly doorThickness = signal<number>(18);
  readonly backThickness = signal<number>(3);
  readonly backType = signal<'groove' | 'rebate' | 'overlay'>('groove');

  readonly shelvesCount = signal<number>(1);
  readonly doorOpening = signal<'left' | 'right' | 'top' | 'bottom' | 'double' | 'none'>('left');

  readonly structureMaterialId = signal<string>('');
  readonly doorMaterialId = signal<string>('');
  readonly backMaterialId = signal<string>('');

  readonly handleType = signal<HandleType>('bar_modern');
  readonly handleFinish = signal<HandleFinish>('brushed_steel');
  readonly facadeGap = signal<number>(3);
  readonly elevationY = signal<number>(1450);

  // Dimensiones interiores libres y medidas de corte de puerta
  readonly innerWidth = computed(() => Math.max(50, this.width() - (2 * this.structureThickness())));
  readonly innerHeight = computed(() => Math.max(50, this.height() - (2 * this.structureThickness())));
  readonly innerDepth = computed(() => Math.max(50, this.depth() - this.doorThickness()));
  readonly doorWidth = computed(() => Math.max(50, this.width() - this.facadeGap()));
  readonly doorHeight = computed(() => Math.max(50, this.height() - this.facadeGap()));

  /**
   * Arreglo de índices 1..N para renderizar las repisas en el diagrama SVG sin usar `[].constructor()`.
   */
  readonly shelvesIndices = computed<number[]>(() =>
    Array.from({ length: Math.max(0, this.shelvesCount()) }, (_, i) => i + 1)
  );

  readonly widthPresets = [300, 400, 450, 500, 600];
  readonly heightPresets = [600, 720, 800, 900];
  readonly depthPresets = [280, 300, 320, 350];

  constructor() {
    // 1. Cargar configuración inicial usando untracked() para no re-ejecutar el efecto al editar height()
    effect(() => {
      const cfg = this.initialConfig();
      const open = this.isOpen();
      if (cfg && open) {
        untracked(() => {
          this.initFromConfig(cfg);
        });
      }
    });

    // 2. Asegurar selección de material predeterminado cuando la lista de materiales esté disponible
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
  }

  /**
   * Inicializa los signals del formulario a partir de una configuración existente.
   */
  initFromConfig(config: ParametricCabinetConfig) {
    const h = config.height || 800;
    this.code.set(config.code || 'MALT1PU001');
    this.name.set(config.name || 'Módulo Alto 1 Puerta');
    this.width.set(config.width || 600);
    this.height.set(h);
    this.depth.set(config.depth || 320);
    this.structureThickness.set(config.structureThickness || 18);
    this.doorThickness.set(config.doorThickness || 18);
    this.backThickness.set(config.backThickness || 3);
    this.backType.set(config.backType !== 'none' ? config.backType : 'groove');
    this.shelvesCount.set(config.shelvesCount ?? 1);
    this.doorOpening.set(config.doorOpening || 'left');
    this.structureMaterialId.set(config.structureMaterialId || '');
    this.doorMaterialId.set(config.doorMaterialId || '');
    this.backMaterialId.set(config.backMaterialId || '');
    this.handleType.set(config.handleType || 'bar_modern');
    this.handleFinish.set(config.handleFinish || 'brushed_steel');
    this.facadeGap.set(config.facadeGap || 3);
    if (config.posY !== undefined) {
      this.elevationY.set(Math.max(0, config.posY - (h / 2)));
    }
  }

  // --- MANEJADORES DE FORMULARIO TIPADOS ---

  onNumberInput(field: 'width' | 'height' | 'depth', event: Event) {
    const target = event.target as HTMLInputElement | null;
    const val = Number(target?.value);
    if (isNaN(val) || val <= 0) return;
    if (field === 'width') this.width.set(val);
    else if (field === 'height') this.height.set(val);
    else if (field === 'depth') this.depth.set(val);
  }

  onNumberSelectChange(field: 'shelvesCount' | 'structureThickness' | 'doorThickness' | 'backThickness', event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const val = Number(target?.value);
    if (isNaN(val)) return;
    if (field === 'shelvesCount') this.shelvesCount.set(val);
    else if (field === 'structureThickness') this.structureThickness.set(val);
    else if (field === 'doorThickness') this.doorThickness.set(val);
    else if (field === 'backThickness') this.backThickness.set(val);
  }

  onHandleTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    if (target?.value) {
      this.handleType.set(target.value as HandleType);
    }
  }

  onMaterialSelectChange(targetType: 'structure' | 'door', event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const val = target?.value ?? '';
    if (targetType === 'structure') {
      this.structureMaterialId.set(val);
    } else {
      this.doorMaterialId.set(val);
    }
  }

  setWidth(val: number) {
    this.width.set(val);
  }

  setHeight(val: number) {
    this.height.set(val);
  }

  setDepth(val: number) {
    this.depth.set(val);
  }

  setDoorOpening(dir: 'left' | 'right' | 'top' | 'bottom' | 'double' | 'none') {
    this.doorOpening.set(dir);
  }

  getStructureMat(): Material | undefined {
    return this.materials().find(m => m.id === this.structureMaterialId()) || this.materials()[0];
  }

  getDoorMat(): Material | undefined {
    return this.materials().find(m => m.id === this.doorMaterialId()) || this.getStructureMat();
  }

  /**
   * Construye el objeto ParametricCabinetConfig final y lo emite para insertarlo en la escena 3D.
   */
  onSubmit() {
    const defaultMat = this.materials()[0]?.id || 'mat_default';
    const sMat = this.structureMaterialId() || defaultMat;
    const dMat = this.doorMaterialId() || sMat;
    const bMat = this.backMaterialId() || this.materials().find(m => m.thickness <= 6)?.id || sMat;

    const h = this.height();
    const elev = this.elevationY();
    const centerY = elev + (h / 2);

    const config: ParametricCabinetConfig = {
      code: this.code(),
      name: this.name(),
      moduleType: 'wall_cabinet',
      width: this.width(),
      height: this.height(),
      depth: this.depth(),
      structureThickness: this.structureThickness(),
      doorThickness: this.doorThickness(),
      backThickness: this.backThickness(),
      backType: this.backType(),
      shelvesCount: this.shelvesCount(),
      doorOpening: this.doorOpening(),
      structureMaterialId: sMat,
      doorMaterialId: dMat,
      backMaterialId: bMat,
      handleType: this.handleType(),
      handleFinish: this.handleFinish(),
      facadeGap: this.facadeGap(),
      posY: centerY,
      posX: 0,
      posZ: 0
    };

    this.cabinetSubmitted.emit(config);
    this.close();
  }

  close() {
    this.modalClose.emit();
  }
}