import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProjectStorageService } from '../../services/project-storage.service';
import { Part } from '../../models/melamine.models';

export interface FlatPartLabel {
  part: Part;
  copyIndex: number;
  totalCopies: number;
  labelId: string;
}

@Component({
  selector: 'app-labels-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './labels-view.html'
})
export class LabelsViewComponent {
  private projectService = inject(ProjectStorageService);

  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly modules = this.projectService.modulesList;
  readonly materials = this.projectService.materialsList;

  selectedModuleFilter = signal<string>('all');
  selectedMaterialFilter = signal<string>('all');
  labelSize = signal<'standard' | 'compact'>('standard');

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
      for (let i = 1; i <= part.quantity; i++) {
        labels.push({
          part,
          copyIndex: i,
          totalCopies: part.quantity,
          labelId: `ETQ-${part.id.slice(0, 5).toUpperCase()}-${i}`
        });
      }
    }

    return labels;
  });

  printLabels() {
    window.print();
  }
}
