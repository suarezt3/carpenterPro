import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectStorageService } from '../../services/project-storage.service';
import { FurnitureModule, FurnitureModuleType, Material } from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';

@Component({
  selector: 'app-module-designer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Furniture3dViewerComponent],
  templateUrl: './module-designer.html'
})
export class ModuleDesignerComponent {
  private projectService = inject(ProjectStorageService);
  private cabinetGen = inject(CabinetGeneratorService);
  private fb = inject(FormBuilder);

  readonly project = this.projectService.currentProject;
  readonly materials = this.projectService.materialsList;
  readonly modules = this.projectService.modulesList;

  // Visualizer mode: '3d' (Three.js real 3D) or '2d' (SVG Technical Blueprint)
  activeVisualizer = signal<'3d' | '2d'>('3d');
  viewMode = signal<'exterior' | 'interior'>('exterior');
  isEditingModule = signal<string | null>(null);

  // Form for module
  moduleForm: FormGroup = this.fb.group({
    name: ['Bajo Mesada 800 (2 Puertas)', Validators.required],
    type: ['base_cabinet' as FurnitureModuleType, Validators.required],
    width: [800, [Validators.required, Validators.min(200), Validators.max(2600)]],
    height: [850, [Validators.required, Validators.min(300), Validators.max(2600)]],
    depth: [580, [Validators.required, Validators.min(150), Validators.max(1200)]],
    boardThickness: [18, Validators.required],
    shelvesCount: [1, [Validators.required, Validators.min(0), Validators.max(10)]],
    doorsCount: [2, [Validators.required, Validators.min(0), Validators.max(4)]],
    drawersCount: [0, [Validators.required, Validators.min(0), Validators.max(6)]],
    hasPlinth: [true],
    plinthHeight: [100, [Validators.min(0), Validators.max(200)]],
    backType: ['groove', Validators.required],
    backThickness: [3, Validators.required],
    materialId: ['', Validators.required],
    defaultThinEdge: [true],
    defaultThickDoors: [true]
  });

  // Reactive Signal mirroring form values on every single keystroke / input event
  readonly formValueSignal = signal(this.moduleForm.getRawValue());

  constructor() {
    // Set default material
    const mats = this.materials();
    if (mats.length > 0) {
      this.moduleForm.patchValue({
        materialId: mats[0].id
      });
      this.formValueSignal.set(this.moduleForm.getRawValue());
    }

    // Subscribe to form value changes to trigger immediate 60fps reactive updates
    this.moduleForm.valueChanges.subscribe(() => {
      this.formValueSignal.set(this.moduleForm.getRawValue());
    });
  }

  // Reactive preview module driven by formValueSignal
  readonly previewModule = computed<FurnitureModule>(() => {
    const raw = this.formValueSignal();
    const mats = this.materials();
    const fallbackMatId = mats[0]?.id || 'mat_default';

    return {
      id: this.isEditingModule() || 'preview_temp',
      name: raw.name || 'Módulo',
      type: raw.type,
      width: Number(raw.width) || 800,
      height: Number(raw.height) || 850,
      depth: Number(raw.depth) || 580,
      boardThickness: Number(raw.boardThickness) || 18,
      backThickness: Number(raw.backThickness) || 3,
      backType: raw.backType,
      shelvesCount: Number(raw.shelvesCount) || 0,
      doorsCount: Number(raw.doorsCount) || 0,
      doorsType: 'overlay',
      drawersCount: Number(raw.drawersCount) || 0,
      hasPlinth: Boolean(raw.hasPlinth),
      plinthHeight: Number(raw.plinthHeight) || 100,
      materialId: raw.materialId || fallbackMatId,
      defaultThinEdge: Boolean(raw.defaultThinEdge),
      defaultThickDoors: Boolean(raw.defaultThickDoors)
    };
  });

  readonly previewPartsAndHardware = computed(() => {
    const mod = this.previewModule();
    const mats = this.materials();
    return this.cabinetGen.generatePartsForModule(mod, mats);
  });

  readonly selectedMaterial = computed<Material | undefined>(() => {
    const id = this.previewModule().materialId;
    return this.materials().find(m => m.id === id) || this.materials()[0];
  });

  readonly svgMetrics = computed(() => {
    const mod = this.previewModule();
    const wMm = mod.width;
    const hMm = mod.height;
    const plinthMm = mod.hasPlinth ? mod.plinthHeight : 0;
    const scale = 240 / Math.max(wMm, hMm, 800);
    const svgW = wMm * scale;
    const svgH = hMm * scale;
    const svgPlinth = plinthMm * scale;
    const svgX = 250 - (svgW / 2);
    const svgY = 220 - (svgH / 2);
    const thick = mod.boardThickness * scale * 1.5;
    const carcassH = svgH - svgPlinth;
    const doorW = (svgW - 4) / 2;

    return {
      wMm,
      hMm,
      plinthMm,
      scale,
      svgW,
      svgH,
      svgPlinth,
      svgX,
      svgY,
      thick,
      carcassH,
      doorW
    };
  });

  adjustDimension(field: 'width' | 'height' | 'depth', delta: number) {
    const current = Number(this.moduleForm.get(field)?.value) || 0;
    const next = Math.max(150, Math.min(3000, current + delta));
    this.moduleForm.patchValue({ [field]: next });
  }

  applyPreset(presetKey: string) {
    const mats = this.materials();
    const matWood = mats.find(m => m.hasGrain) || mats[0];
    const matWhite = mats.find(m => !m.hasGrain && m.thickness === 18) || mats[0];

    if (presetKey === 'base_2doors') {
      this.moduleForm.patchValue({
        name: 'Bajo Mesada 800 (2 Puertas)',
        type: 'base_cabinet',
        width: 800,
        height: 850,
        depth: 580,
        doorsCount: 2,
        drawersCount: 0,
        shelvesCount: 1,
        hasPlinth: true,
        plinthHeight: 100,
        materialId: matWhite ? matWhite.id : mats[0]?.id
      });
    } else if (presetKey === 'base_drawers') {
      this.moduleForm.patchValue({
        name: 'Cajonera 4 Cajones Telescópicos',
        type: 'base_cabinet',
        width: 500,
        height: 850,
        depth: 580,
        doorsCount: 0,
        drawersCount: 4,
        shelvesCount: 0,
        hasPlinth: true,
        plinthHeight: 100,
        materialId: matWood ? matWood.id : mats[0]?.id
      });
    } else if (presetKey === 'wall_cabinet') {
      this.moduleForm.patchValue({
        name: 'Alacena Aérea 800 (2 Puertas)',
        type: 'wall_cabinet',
        width: 800,
        height: 700,
        depth: 320,
        doorsCount: 2,
        drawersCount: 0,
        shelvesCount: 1,
        hasPlinth: false,
        plinthHeight: 0,
        materialId: matWhite ? matWhite.id : mats[0]?.id
      });
    } else if (presetKey === 'closet_column') {
      this.moduleForm.patchValue({
        name: 'Ropero / Torre 2 Puertas',
        type: 'tall_cabinet',
        width: 900,
        height: 2100,
        depth: 550,
        doorsCount: 2,
        drawersCount: 0,
        shelvesCount: 3,
        hasPlinth: true,
        plinthHeight: 80,
        materialId: matWood ? matWood.id : mats[0]?.id
      });
    }
  }

  saveModuleToProject() {
    if (this.moduleForm.invalid) return;

    const modData = this.previewModule();
    if (this.isEditingModule()) {
      this.projectService.updateModule(modData);
      this.isEditingModule.set(null);
    } else {
      const newMod: FurnitureModule = {
        ...modData,
        id: 'mod_' + crypto.randomUUID().slice(0, 8)
      };
      this.projectService.addModule(newMod);
    }

    // Reset to generic name
    this.moduleForm.patchValue({
      name: `Módulo ${this.modules().length + 1}`
    });
  }

  editExistingModule(mod: FurnitureModule) {
    this.isEditingModule.set(mod.id);
    this.moduleForm.patchValue({
      name: mod.name,
      type: mod.type,
      width: mod.width,
      height: mod.height,
      depth: mod.depth,
      boardThickness: mod.boardThickness,
      shelvesCount: mod.shelvesCount,
      doorsCount: mod.doorsCount,
      drawersCount: mod.drawersCount,
      hasPlinth: mod.hasPlinth,
      plinthHeight: mod.plinthHeight,
      backType: mod.backType,
      backThickness: mod.backThickness,
      materialId: mod.materialId,
      defaultThinEdge: mod.defaultThinEdge,
      defaultThickDoors: mod.defaultThickDoors
    });
  }

  cancelEdit() {
    this.isEditingModule.set(null);
    this.moduleForm.patchValue({
      name: 'Nuevo Módulo'
    });
  }

  deleteModule(modId: string) {
    if (confirm('¿Eliminar este módulo y sus piezas correspondientes?')) {
      this.projectService.deleteModule(modId);
      if (this.isEditingModule() === modId) {
        this.cancelEdit();
      }
    }
  }
}
