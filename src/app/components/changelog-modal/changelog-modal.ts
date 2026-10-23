import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  InformationCircleIcon,
  Layers01Icon,
  LightBulb01Icon,
  Megaphone01Icon,
  Rocket01Icon,
  Search01Icon,
  Settings01Icon,
  Tag01Icon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';
import { APP_CURRENT_VERSION, APP_RELEASES, APP_ROADMAP } from '../../data/changelog.data';
import { ChangeType, ReleaseVersion, RoadmapItem, RoadmapStatus } from '../../models/changelog.models';

/**
 * Modal corporativo de Novedades (Changelog) y Hoja de Ruta (Roadmap) de Piezo3D Studio.
 * Diseñado con estética CAD profesional, bordes compactos (rounded-lg/md), alto contraste,
 * iconos Hugeicons unificados y un feed limpio de versiones sin líneas ni elementos flotantes.
 */
@Component({
  selector: 'app-changelog-modal',
  imports: [CommonModule, FormsModule, HugeiconsIconComponent],
  templateUrl: './changelog-modal.html',
  styleUrl: './changelog-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangelogModalComponent {
  readonly themeService = inject(ThemeService);

  readonly isOpen = input<boolean>(false);
  readonly modalClose = output<void>();

  // Versión actual del aplicativo y conjuntos de datos
  readonly currentVersion = APP_CURRENT_VERSION;
  readonly releases: ReleaseVersion[] = APP_RELEASES;
  readonly roadmapItems: RoadmapItem[] = APP_ROADMAP;

  // Estado interactivo de navegación y filtros
  readonly activeTab = signal<'changelog' | 'roadmap'>('changelog');
  readonly searchQuery = signal<string>('');
  readonly activeChangeFilter = signal<'all' | ChangeType>('all');
  readonly activeRoadmapStatus = signal<'all' | RoadmapStatus>('all');

  // Iconos oficiales de la librería Hugeicons
  readonly icons = {
    close: Cancel01Icon,
    megaphone: Megaphone01Icon,
    rocket: Rocket01Icon,
    search: Search01Icon,
    check: Tick02Icon,
    verified: CheckmarkCircle02Icon,
    info: InformationCircleIcon,
    clock: Clock01Icon,
    tag: Tag01Icon,
    layers: Layers01Icon,
    settings: Settings01Icon,
    checkList: CheckListIcon,
    lightbulb: LightBulb01Icon
  };

  // Versiones filtradas según búsqueda y tipo de cambio
  readonly filteredReleases = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.activeChangeFilter();

    return this.releases
      .map(release => {
        const matchedChanges = release.changes.filter(change => {
          const matchesType = filter === 'all' || change.type === filter;
          const matchesQuery = !q ||
            change.title.toLowerCase().includes(q) ||
            change.description.toLowerCase().includes(q) ||
            (change.tag && change.tag.toLowerCase().includes(q));

          return matchesType && matchesQuery;
        });

        const versionMatches = !q ||
          release.version.toLowerCase().includes(q) ||
          release.name.toLowerCase().includes(q) ||
          release.summary.toLowerCase().includes(q);

        if (matchedChanges.length > 0 || (versionMatches && filter === 'all')) {
          return {
            ...release,
            changes: matchedChanges.length > 0 ? matchedChanges : release.changes
          };
        }
        return null;
      })
      .filter((rel): rel is ReleaseVersion => rel !== null);
  });

  // Elementos de Roadmap filtrados
  readonly filteredRoadmap = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.activeRoadmapStatus();

    return this.roadmapItems.filter(item => {
      const matchesStatus = status === 'all' || item.status === status;
      const matchesQuery = !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  });

  // Conteo por estado de Roadmap
  readonly inProgressCount = computed(() =>
    this.roadmapItems.filter(i => i.status === 'in_progress').length
  );

  readonly plannedCount = computed(() =>
    this.roadmapItems.filter(i => i.status === 'planned').length
  );

  readonly evaluatingCount = computed(() =>
    this.roadmapItems.filter(i => i.status === 'evaluating').length
  );

  close() {
    this.modalClose.emit();
  }

  handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  /**
   * Clases de alto contraste para las pastillas de tipo de cambio.
   * Fondo oscuro sólido con texto blanco puro para máxima legibilidad.
   */
  getBadgeClass(type: ChangeType): string {
    switch (type) {
      case 'feature':
        return 'bg-emerald-700 text-white';
      case 'improvement':
        return 'bg-sky-700 text-white';
      case 'fix':
        return 'bg-amber-600 text-white';
      case 'cad':
        return 'bg-indigo-700 text-white';
    }
  }

  getBadgeLabel(type: ChangeType): string {
    switch (type) {
      case 'feature': return 'NUEVO';
      case 'improvement': return 'MEJORA';
      case 'fix': return 'CORREGIDO';
      case 'cad': return 'CAD 3D';
    }
  }

  /**
   * Clases sólidas y legibles para los estados del Roadmap.
   */
  getStatusBadgeClass(status: RoadmapStatus): string {
    switch (status) {
      case 'in_progress':
        return 'bg-emerald-700 text-white';
      case 'planned':
        return 'bg-blue-700 text-white';
      case 'evaluating':
        return 'bg-purple-700 text-white';
    }
  }

  getStatusLabel(status: RoadmapStatus): string {
    switch (status) {
      case 'in_progress': return 'En Desarrollo';
      case 'planned': return 'Planificado';
      case 'evaluating': return 'En Evaluación';
    }
  }
}
