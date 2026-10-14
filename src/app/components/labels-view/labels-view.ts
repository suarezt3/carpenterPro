import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ThemeService } from '../../services/theme.service';
import { Part } from '../../models/melamine.models';

/**
 * Representa una etiqueta individual expandida por unidad física a cortar.
 */
export interface FlatPartLabel {
  trackId: string;
  part: Part;
  copyIndex: number;
  totalCopies: number;
  labelId: string;
}

/**
 * Vista generadora de etiquetas técnicas imprimibles para taller.
 * Desglosa cada pieza según su cantidad (`quantity`) y muestra sus medidas de corte,
 * sentido de veta y esquema visual de tapacantos (L1, L2, A1, A2).
 */
@Component({
  selector: 'app-labels-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './labels-view.html',
  styleUrl: './labels-view.css'
})
export class LabelsViewComponent {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);

  // Signals conectados al estado global del proyecto
  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly modules = this.projectService.modulesList;
  readonly materials = this.projectService.materialsList;

  // Filtros reactivos por módulo y material
  readonly selectedModuleFilter = signal<string>('all');
  readonly selectedMaterialFilter = signal<string>('all');
  readonly labelSize = signal<'standard' | 'compact'>('standard');

  /**
   * Expande la lista de piezas en etiquetas individuales según la cantidad de cada ítem.
   * Genera un `trackId` estrictamente único para el bucle `@for` de Angular.
   */
  readonly flatLabels = computed<FlatPartLabel[]>(() => {
    let list = this.parts();
    const mod = this.selectedModuleFilter();
    const mat = this.selectedMaterialFilter();

    if (mod !== 'all') {
      list = list.filter(p => p.moduleId === mod);
    }
    if (mat !== 'all') {
      list = list.filter(p => p.materialId === mat);
    }

    const labels: FlatPartLabel[] = [];

    for (const part of list) {
      const cleanCode = part.id.replace(/^(part_|desk_)/i, '').slice(-5).toUpperCase();
      for (let i = 1; i <= part.quantity; i++) {
        labels.push({
          trackId: `${part.id}_copy_${i}`,
          part,
          copyIndex: i,
          totalCopies: part.quantity,
          labelId: `ETQ-${cleanCode}-${i}`
        });
      }
    }

    return labels;
  });

  onModuleFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    this.selectedModuleFilter.set(target?.value ?? 'all');
  }

  onMaterialFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    this.selectedMaterialFilter.set(target?.value ?? 'all');
  }

  /**
   * Dispara la ventana nativa de impresión del navegador de forma segura para SSR.
   */
  printLabels() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}