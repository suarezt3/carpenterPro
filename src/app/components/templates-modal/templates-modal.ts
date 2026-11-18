import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { HugeiconsIconComponent, IconSvgObject } from '@hugeicons/angular';
import {
  Add01Icon,
  Archive01Icon,
  BathIcon,
  BookOpen01Icon,
  Bookshelf01Icon,
  Cabinet01Icon,
  Cabinet02Icon,
  Cancel01Icon,
  ComputerIcon,
  CubeIcon,
  LaptopIcon,
  Layers01Icon,
  RulerIcon,
  Search01Icon,
  SlidersHorizontalIcon,
  SquareIcon,
  Wardrobe01Icon
} from '@hugeicons/core-free-icons';
import { Material } from '../../models/melamine.models';
import {
  FurnitureTemplate,
  TemplatesCatalogService
} from '../../services/templates-catalog.service';
import { TemplatePreview3dComponent } from '../template-preview-3d/template-preview-3d';

export type CatalogCategoryId = 'all' | FurnitureTemplate['category'];

export interface CatalogCategoryFilter {
  id: CatalogCategoryId;
  label: string;
  icon: IconSvgObject;
  count: number;
}

export interface TemplateComponentsSummary {
  partsCount: number;
  doorsCount: number;
  drawersCount: number;
  shelvesCount: number;
  rodsCount: number;
}

const CATEGORY_DEFINITIONS: readonly {
  id: CatalogCategoryId;
  label: string;
  icon: IconSvgObject;
}[] = [
  { id: 'all', label: 'Todas', icon: BookOpen01Icon },
  { id: 'cocina', label: 'Cocina', icon: Cabinet02Icon },
  { id: 'closets', label: 'Closets', icon: Wardrobe01Icon },
  { id: 'cajones', label: 'Cajones', icon: Archive01Icon },
  { id: 'bano', label: 'Baño', icon: BathIcon },
  { id: 'sala_tv', label: 'Sala / TV', icon: ComputerIcon },
  { id: 'oficina', label: 'Oficina', icon: LaptopIcon }
];

const CATEGORY_SHORT_LABELS: Record<FurnitureTemplate['category'], string> = {
  cocina: 'Cocina',
  closets: 'Closets',
  cajones: 'Cajones',
  bano: 'Baño',
  sala_tv: 'Sala / TV',
  oficina: 'Oficina'
};

/**
 * Modal de Catálogo de Plantillas 3D con previsualización interactiva 360°,
 * filtros por categoría y buscador técnico bajo estética Minimalist Studio.
 */
@Component({
  selector: 'app-templates-modal',
  standalone: true,
  imports: [HugeiconsIconComponent, TemplatePreview3dComponent],
  templateUrl: './templates-modal.html',
  styleUrl: './templates-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesModalComponent {
  readonly catalogService = inject(TemplatesCatalogService);

  readonly icons = {
    catalog: BookOpen01Icon,
    close: Cancel01Icon,
    search: Search01Icon,
    ruler: RulerIcon,
    cube3d: CubeIcon,
    layers: Layers01Icon,
    sliders: SlidersHorizontalIcon,
    add: Add01Icon,
    blank: SquareIcon,
    countertop: Cabinet02Icon,
    kitchen: Cabinet01Icon,
    closet: Wardrobe01Icon,
    drawers: Archive01Icon,
    vanity: BathIcon,
    shelves: Bookshelf01Icon,
    tvStand: ComputerIcon,
    office: LaptopIcon
  };

  readonly isOpen = input<boolean>(false);
  readonly materials = input<Material[]>([]);
  readonly initialTemplateId = input<string | null>(null);

  readonly modalClose = output<void>();
  readonly templateSelected = output<{
    template: FurnitureTemplate;
    mode: 'replace' | 'append';
  }>();
  readonly customizeTemplateRequested = output<FurnitureTemplate>();
  readonly startBlankRequested = output<void>();

  readonly searchQuery = signal<string>('');
  readonly activeCategory = signal<CatalogCategoryId>('all');
  readonly selectedTemplate = signal<FurnitureTemplate | null>(null);
  readonly creationMode = signal<'append' | 'replace'>('append');

  readonly categories = computed<CatalogCategoryFilter[]>(() => {
    const allTemplates = this.catalogService.templates;
    return CATEGORY_DEFINITIONS.map(def => ({
      id: def.id,
      label: def.label,
      icon: def.icon,
      count:
        def.id === 'all'
          ? allTemplates.length
          : allTemplates.filter(tpl => tpl.category === def.id).length
    }));
  });

  readonly filteredTemplates = computed<FurnitureTemplate[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const category = this.activeCategory();

    return this.catalogService.templates.filter(tpl => {
      if (category !== 'all' && tpl.category !== category) {
        return false;
      }
      if (!query) {
        return true;
      }
      const dimsCompact = `${tpl.dimensions.width}x${tpl.dimensions.height}x${tpl.dimensions.depth}`;
      const dimsSpaced = `${tpl.dimensions.width} ${tpl.dimensions.height} ${tpl.dimensions.depth}`;
      return (
        tpl.name.toLowerCase().includes(query) ||
        tpl.description.toLowerCase().includes(query) ||
        tpl.badge.toLowerCase().includes(query) ||
        tpl.categoryLabel.toLowerCase().includes(query) ||
        CATEGORY_SHORT_LABELS[tpl.category].toLowerCase().includes(query) ||
        dimsCompact.includes(query) ||
        dimsSpaced.includes(query)
      );
    });
  });

  readonly selectedSummary = computed<TemplateComponentsSummary | null>(() => {
    const tpl = this.selectedTemplate();
    if (!tpl) {
      return null;
    }
    try {
      return this.catalogService.getTemplateComponentsSummary(tpl, this.materials());
    } catch {
      return {
        partsCount: tpl.partsCount,
        doorsCount: 0,
        drawersCount: 0,
        shelvesCount: 0,
        rodsCount: 0
      };
    }
  });

  private wasOpen = false;
  private lastInitialTemplateId: string | null = null;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const initialId = this.initialTemplateId();
      const filtered = this.filteredTemplates();

      untracked(() => {
        if (!open) {
          if (this.wasOpen) {
            this.wasOpen = false;
            this.lastInitialTemplateId = null;
            this.selectedTemplate.set(null);
          }
          return;
        }

        if (!this.wasOpen) {
          this.wasOpen = true;
          this.lastInitialTemplateId = initialId;
          this.creationMode.set('append');
          this.searchQuery.set('');
          this.activeCategory.set('all');

          const matched = initialId
            ? this.catalogService.getTemplateById(initialId) ?? null
            : null;
          this.selectedTemplate.set(matched ?? this.catalogService.templates[0] ?? null);
          return;
        }

        if (initialId !== this.lastInitialTemplateId) {
          this.lastInitialTemplateId = initialId;
          if (initialId) {
            const matched = this.catalogService.getTemplateById(initialId) ?? null;
            if (matched) {
              if (!filtered.some(t => t.id === matched.id)) {
                this.searchQuery.set('');
                this.activeCategory.set('all');
              }
              this.selectedTemplate.set(matched);
              return;
            }
          }
        }

        const current = this.selectedTemplate();
        if (!current || !filtered.some(t => t.id === current.id)) {
          this.selectedTemplate.set(filtered[0] ?? null);
        }
      });
    });
  }

  getCategoryBadgeLabel(category: FurnitureTemplate['category']): string {
    return CATEGORY_SHORT_LABELS[category];
  }

  getCatalogIcon(
    iconName?: string,
    category?: FurnitureTemplate['category']
  ): IconSvgObject {
    if (category === 'sala_tv') {
      return this.icons.tvStand;
    }
    if (category === 'oficina') {
      return this.icons.office;
    }
    switch (iconName) {
      case 'countertops':
        return this.icons.countertop;
      case 'kitchen':
        return this.icons.kitchen;
      case 'door_sliding':
      case 'checkroom':
      case 'meeting_room':
      case 'closets':
        return this.icons.closet;
      case 'bathtub':
      case 'wash':
      case 'bano':
        return this.icons.vanity;
      case 'shelves':
      case 'menu_book':
      case 'bookshelf':
        return this.icons.shelves;
      case 'inbox':
      case 'view_agenda':
      case 'dns':
      case 'table_rows':
      case 'cajones':
        return this.icons.drawers;
      default:
        return this.icons.cube3d;
    }
  }

  selectCategory(categoryId: CatalogCategoryId): void {
    this.activeCategory.set(categoryId);
  }

  onSearchInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    this.searchQuery.set(inputEl?.value ?? '');
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.activeCategory.set('all');
  }

  selectTemplate(template: FurnitureTemplate): void {
    this.selectedTemplate.set(template);
  }

  setCreationMode(mode: 'append' | 'replace'): void {
    this.creationMode.set(mode);
  }

  confirmSelectedTemplate(): void {
    const tpl = this.selectedTemplate();
    if (!tpl) {
      return;
    }
    this.templateSelected.emit({
      template: tpl,
      mode: this.creationMode()
    });
    this.close();
  }

  customizeSelectedTemplate(): void {
    const tpl = this.selectedTemplate();
    if (!tpl) {
      return;
    }
    this.customizeTemplateRequested.emit(tpl);
    this.close();
  }

  onStartBlank(): void {
    this.startBlankRequested.emit();
    this.close();
  }

  close(): void {
    this.selectedTemplate.set(null);
    this.modalClose.emit();
  }
}
