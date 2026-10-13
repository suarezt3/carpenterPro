import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { Material, ParametricCabinetConfig, HandleType, HandleFinish } from '../../models/melamine.models';

@Component({
  selector: 'app-component-options-modal',
  imports: [CommonModule],
  templateUrl: './component-options-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentOptionsModalComponent {
  readonly themeService = inject(ThemeService);

  isOpen = input<boolean>(false);
  materials = input<Material[]>([]);
  initialConfig = input<ParametricCabinetConfig | null>(null);

  modalClose = output<void>();
  cabinetSubmitted = output<ParametricCabinetConfig>();

  constructor() {
    effect(() => {
      const cfg = this.initialConfig();
      if (cfg && this.isOpen()) {
        this.initFromConfig(cfg);
      }
    });
  }

  // Form Signals
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
  readonly doorOpening = signal<'left' | 'right' | 'top' | 'bottom'>('left');
  readonly structureMaterialId = signal<string>('');
  readonly doorMaterialId = signal<string>('');
  readonly backMaterialId = signal<string>('');
  readonly handleType = signal<HandleType>('bar_modern');
  readonly handleFinish = signal<HandleFinish>('brushed_steel');
  readonly facadeGap = signal<number>(3);
  readonly elevationY = signal<number>(1450); // Altura de montaje alacena desde suelo (mm)

  // Derived inner dimensions
  readonly innerWidth = computed(() => Math.max(50, this.width() - (2 * this.structureThickness())));
  readonly innerHeight = computed(() => Math.max(50, this.height() - (2 * this.structureThickness())));
  readonly innerDepth = computed(() => Math.max(50, this.depth() - this.doorThickness()));
  readonly doorWidth = computed(() => Math.max(50, this.width() - this.facadeGap()));
  readonly doorHeight = computed(() => Math.max(50, this.height() - this.facadeGap()));

  // Presets
  readonly widthPresets = [300, 400, 450, 500, 600];
  readonly heightPresets = [600, 720, 800, 900];
  readonly depthPresets = [280, 300, 320, 350];

  initFromConfig(config: ParametricCabinetConfig) {
    this.code.set(config.code || 'MALT1PU001');
    this.name.set(config.name || 'Módulo Alto 1 Puerta');
    this.width.set(config.width || 600);
    this.height.set(config.height || 800);
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
      this.elevationY.set(Math.max(0, config.posY - (this.height() / 2)));
    }
  }

  setWidth(val: number) { this.width.set(val); }
  setHeight(val: number) { this.height.set(val); }
  setDepth(val: number) { this.depth.set(val); }
  setDoorOpening(dir: 'left' | 'right' | 'top' | 'bottom') { this.doorOpening.set(dir); }

  getStructureMat(): Material | undefined {
    return this.materials().find(m => m.id === this.structureMaterialId()) || this.materials()[0];
  }

  getDoorMat(): Material | undefined {
    return this.materials().find(m => m.id === this.doorMaterialId()) || this.getStructureMat();
  }

  onSubmit() {
    const defaultMat = this.materials()[0]?.id || 'mat_default';
    const sMat = this.structureMaterialId() || defaultMat;
    const dMat = this.doorMaterialId() || sMat;
    const bMat = this.backMaterialId() || this.materials().find(m => m.thickness <= 6)?.id || sMat;

    const h = this.height();
    const elev = this.elevationY();
    // Center Y in 3D scene
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
