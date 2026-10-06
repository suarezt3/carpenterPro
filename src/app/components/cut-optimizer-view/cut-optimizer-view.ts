import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProjectStorageService } from '../../services/project-storage.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { ThemeService } from '../../services/theme.service';
import { OptimizationResult, PlacedPart, PlacedSheet } from '../../models/melamine.models';

@Component({
  selector: 'app-cut-optimizer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './cut-optimizer-view.html'
})
export class CutOptimizerViewComponent {
  readonly themeService = inject(ThemeService);
  private projectService = inject(ProjectStorageService);
  private optimizer = inject(CutOptimizerService);

  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly materials = this.projectService.materialsList;
  readonly settings = this.projectService.projectSettings;

  selectedSheetIndex = signal<number>(0);
  zoomLevel = signal<number>(1);
  hoveredPart = signal<PlacedPart | null>(null);

  // Computed Optimization
  readonly optimizationResult = computed<OptimizationResult>(() => {
    const parts = this.parts();
    const mats = this.materials();
    const set = this.settings();
    return this.optimizer.optimizeProject(parts, mats, set);
  });

  readonly currentSheet = computed<PlacedSheet | null>(() => {
    const res = this.optimizationResult();
    const idx = this.selectedSheetIndex();
    if (res.sheets.length > 0) {
      return res.sheets[idx] || res.sheets[0];
    }
    return null;
  });

  selectSheet(index: number) {
    this.selectedSheetIndex.set(index);
    this.hoveredPart.set(null);
  }

  zoomIn() {
    this.zoomLevel.update(z => Math.min(z + 0.25, 2.5));
  }

  zoomOut() {
    this.zoomLevel.update(z => Math.max(z - 0.25, 0.75));
  }

  resetZoom() {
    this.zoomLevel.set(1);
  }

  printCurrentSheet() {
    window.print();
  }
}
