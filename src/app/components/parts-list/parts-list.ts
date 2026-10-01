import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectStorageService } from '../../services/project-storage.service';
import { EdgeBandingType, GrainDirection, Part } from '../../models/melamine.models';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-parts-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './parts-list.html'
})
export class PartsListComponent {
  private projectService = inject(ProjectStorageService);
  private confirmService = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly materials = this.projectService.materialsList;
  readonly modules = this.projectService.modulesList;

  // Filters
  filterModuleId = signal<string>('all');
  filterMaterialId = signal<string>('all');
  searchQuery = signal<string>('');

  // Modals
  showAddPartModal = signal<boolean>(false);
  editingPart = signal<Part | null>(null);

  partForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    moduleId: [''],
    materialId: ['', Validators.required],
    length: [600, [Validators.required, Validators.min(10)]],
    width: [400, [Validators.required, Validators.min(10)]],
    thickness: [18, [Validators.required, Validators.min(1)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    grain: ['length' as GrainDirection, Validators.required],
    l1: ['none' as EdgeBandingType],
    l2: ['none' as EdgeBandingType],
    a1: ['none' as EdgeBandingType],
    a2: ['none' as EdgeBandingType],
    notes: ['']
  });

  readonly filteredParts = computed(() => {
    let list = this.parts();
    const mod = this.filterModuleId();
    const mat = this.filterMaterialId();
    const q = this.searchQuery().toLowerCase().trim();

    if (mod !== 'all') {
      list = list.filter(p => p.moduleId === mod);
    }
    if (mat !== 'all') {
      list = list.filter(p => p.materialId === mat);
    }
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.moduleName && p.moduleName.toLowerCase().includes(q)) ||
        p.materialName.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    }
    return list;
  });

  readonly totalPartsCount = computed(() => {
    return this.filteredParts().reduce((sum, p) => sum + p.quantity, 0);
  });

  readonly totalAreaM2 = computed(() => {
    const totalMm2 = this.filteredParts().reduce((sum, p) => sum + (p.length * p.width * p.quantity), 0);
    return (totalMm2 / 1_000_000).toFixed(2);
  });

  readonly totalEdgeMeters = computed(() => {
    let thinMeters = 0;
    let thickMeters = 0;

    for (const p of this.filteredParts()) {
      const q = p.quantity;
      const lM = (p.length / 1000) * q;
      const wM = (p.width / 1000) * q;

      if (p.edges.l1 === 'thin') thinMeters += lM;
      if (p.edges.l1 === 'thick') thickMeters += lM;
      if (p.edges.l2 === 'thin') thinMeters += lM;
      if (p.edges.l2 === 'thick') thickMeters += lM;

      if (p.edges.a1 === 'thin') thinMeters += wM;
      if (p.edges.a1 === 'thick') thickMeters += wM;
      if (p.edges.a2 === 'thin') thinMeters += wM;
      if (p.edges.a2 === 'thick') thickMeters += wM;
    }

    return {
      thin: thinMeters.toFixed(1),
      thick: thickMeters.toFixed(1),
      total: (thinMeters + thickMeters).toFixed(1)
    };
  });

  openAddModal() {
    this.editingPart.set(null);
    const mats = this.materials();
    this.partForm.reset({
      name: 'Pieza Personalizada',
      moduleId: '',
      materialId: mats[0]?.id || '',
      length: 600,
      width: 400,
      thickness: 18,
      quantity: 1,
      grain: 'length',
      l1: 'thin',
      l2: 'none',
      a1: 'none',
      a2: 'none',
      notes: ''
    });
    this.showAddPartModal.set(true);
  }

  editPart(part: Part) {
    this.editingPart.set(part);
    this.partForm.patchValue({
      name: part.name,
      moduleId: part.moduleId || '',
      materialId: part.materialId,
      length: part.length,
      width: part.width,
      thickness: part.thickness,
      quantity: part.quantity,
      grain: part.grain,
      l1: part.edges.l1,
      l2: part.edges.l2,
      a1: part.edges.a1,
      a2: part.edges.a2,
      notes: part.notes || ''
    });
    this.showAddPartModal.set(true);
  }

  savePart() {
    if (this.partForm.invalid) return;

    const val = this.partForm.value;
    const mats = this.materials();
    const selMat = mats.find(m => m.id === val.materialId) || mats[0];
    const mods = this.modules();
    const selMod = mods.find(m => m.id === val.moduleId);

    const partData: Part = {
      id: this.editingPart() ? this.editingPart()!.id : 'part_' + crypto.randomUUID().slice(0, 8),
      name: val.name,
      moduleId: val.moduleId || undefined,
      moduleName: selMod ? selMod.name : undefined,
      materialId: selMat.id,
      materialName: selMat.name,
      length: Number(val.length),
      width: Number(val.width),
      thickness: Number(val.thickness),
      quantity: Number(val.quantity),
      grain: val.grain,
      edges: {
        l1: val.l1,
        l2: val.l2,
        a1: val.a1,
        a2: val.a2
      },
      notes: val.notes
    };

    if (this.editingPart()) {
      this.projectService.updatePart(partData);
    } else {
      this.projectService.addPart(partData);
    }

    this.showAddPartModal.set(false);
    this.editingPart.set(null);
  }

  cycleEdgeBanding(part: Part, edgeKey: 'l1' | 'l2' | 'a1' | 'a2') {
    const current = part.edges[edgeKey];
    let next: EdgeBandingType = 'none';
    if (current === 'none') next = 'thin';
    else if (current === 'thin') next = 'thick';
    else if (current === 'thick') next = 'none';

    const updated: Part = {
      ...part,
      edges: {
        ...part.edges,
        [edgeKey]: next
      }
    };
    this.projectService.updatePart(updated);
  }

  toggleGrain(part: Part) {
    let next: GrainDirection = 'length';
    if (part.grain === 'length') next = 'width';
    else if (part.grain === 'width') next = 'none';
    else if (part.grain === 'none') next = 'length';

    const updated: Part = {
      ...part,
      grain: next
    };
    this.projectService.updatePart(updated);
  }

  async deletePart(partId: string) {
    const part = this.parts().find(p => p.id === partId);
    const partName = part ? `"${part.name}"` : 'esta pieza';
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar pieza de la lista?',
      message: `Se eliminará ${partName} del despiece y de todos los cálculos de corte.`,
      confirmText: 'Eliminar Pieza',
      cancelText: 'Cancelar',
      severity: 'danger'
    });

    if (confirmed) {
      this.projectService.deletePart(partId);
    }
  }

  exportCsv() {
    this.projectService.exportPartsCsv();
  }
}
