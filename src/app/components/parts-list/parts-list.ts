import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectStorageService } from '../../services/project-storage.service';
import { EdgeBandingType, GrainDirection, Part } from '../../models/melamine.models';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Vista de listado técnico de despiece (Melamina y Equipamiento/Electrodomésticos).
 * Permite filtrar piezas, alternar tapacantos y dirección de veta con un clic,
 * editar medidas sin perder el posicionamiento 3D y exportar a CSV.
 */
@Component({
  selector: 'app-parts-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './parts-list.html',
  styleUrl: './parts-list.css'
})
export class PartsListComponent {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);

  // Signals derivados del servicio de almacenamiento
  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly materials = this.projectService.materialsList;
  readonly modules = this.projectService.modulesList;
  readonly appliances = this.projectService.appliancesList;

  readonly totalAppliancesCost = computed(() =>
    this.appliances().reduce((sum, a) => sum + (Number(a.price) || 0), 0)
  );

  // Pestaña activa: despiece de melamina vs equipamiento 3D
  readonly activeTab = signal<'melamine' | 'appliances'>('melamine');

  // Filtros reactivos de búsqueda
  readonly filterModuleId = signal<string>('all');
  readonly filterMaterialId = signal<string>('all');
  readonly searchQuery = signal<string>('');

  // Control del modal de agregar/editar pieza manual
  readonly showAddPartModal = signal<boolean>(false);
  readonly editingPart = signal<Part | null>(null);

  readonly partForm: FormGroup = this.fb.group({
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

  /**
   * Filtra las piezas según el módulo, material y texto buscado.
   */
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
        (p.groupName && p.groupName.toLowerCase().includes(q)) ||
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

  /**
   * Calcula los metros lineales totales de tapacanto delgado (0.45mm) y grueso (2.0mm)
   * de las piezas filtradas actualmente.
   */
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

  // --- MANEJADORES DE EVENTOS DE FILTRO CON TIPADO ESTRICTO ---

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value ?? '');
  }

  onFilterModuleChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    this.filterModuleId.set(target?.value ?? 'all');
  }

  onFilterMaterialChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    this.filterMaterialId.set(target?.value ?? 'all');
  }

  // --- CREACIÓN Y EDICIÓN DE PIEZAS ---

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

  /**
   * Guarda una pieza nueva o actualiza una existente preservando sus coordenadas 3D
   * (`posX`, `posY`, `posZ`), su orientación, grupo (`groupId`) y herrajes (`hardwareConfig`).
   */
  savePart() {
    if (this.partForm.invalid) return;
    const val = this.partForm.value;
    const mats = this.materials();
    const selMat = mats.find(m => m.id === val.materialId) || mats[0];
    const mods = this.modules();
    const selMod = mods.find(m => m.id === val.moduleId);
    const existing = this.editingPart();
    const thickness = Number(val.thickness) || 18;

    const partData: Part = {
      ...(existing ?? {
        posX: 0,
        posY: Math.round(thickness / 2),
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'free'
      }),
      id: existing ? existing.id : 'part_' + crypto.randomUUID().slice(0, 8),
      name: String(val.name || 'Pieza').trim(),
      moduleId: val.moduleId || existing?.moduleId || undefined,
      moduleName: selMod ? selMod.name : existing?.moduleName,
      materialId: selMat.id,
      materialName: selMat.name,
      length: Number(val.length),
      width: Number(val.width),
      thickness,
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

    if (existing) {
      this.projectService.updatePart(partData);
    } else {
      this.projectService.addPart(partData);
    }

    this.showAddPartModal.set(false);
    this.editingPart.set(null);
  }

  /**
   * Alterna cíclicamente el tapacanto de un borde (Ninguno -> Delgado 0.45 -> Grueso 2.0 -> Ninguno).
   */
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

  /**
   * Alterna cíclicamente el sentido de veta (Longitudinal -> Transversal -> Sin Veta).
   */
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

  formatCurrency(amount: number): string {
    return this.projectService.formatCurrency(amount);
  }

  async deleteAppliance(applianceId: string) {
    const app = this.appliances().find(a => a.id === applianceId);
    const name = app ? `"${app.name}"` : 'este equipo';

    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar equipo del proyecto?',
      message: `Se eliminará ${name} de la lista de equipamiento y de la escena 3D.`,
      confirmText: 'Eliminar Equipo',
      cancelText: 'Cancelar',
      severity: 'danger'
    });

    if (confirmed) {
      this.projectService.removeAppliance(applianceId);
    }
  }
}