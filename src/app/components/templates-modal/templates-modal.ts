import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { TemplatesCatalogService, FurnitureTemplate } from '../../services/templates-catalog.service';
import { Material } from '../../models/melamine.models';

@Component({
  selector: 'app-templates-modal',
  imports: [CommonModule],
  templateUrl: './templates-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesModalComponent {
  readonly themeService = inject(ThemeService);
  readonly catalogService = inject(TemplatesCatalogService);

  isOpen = input<boolean>(false);
  materials = input<Material[]>([]);
  modalClose = output<void>();
  templateSelected = output<{ template: FurnitureTemplate; mode: 'replace' | 'append' }>();
  startBlankRequested = output<void>();

  searchQuery = signal<string>('');
  activeCategory = signal<string>('all');
  selectedTemplate = signal<FurnitureTemplate | null>(null);

  readonly categories = computed(() => this.catalogService.getCategories());

  filteredTemplates = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();

    return this.catalogService.templates.filter(t => {
      const matchCat = cat === 'all' || t.category === cat;
      if (!matchCat) return false;

      if (!q) return true;
      const inName = t.name.toLowerCase().includes(q);
      const inDesc = t.description.toLowerCase().includes(q);
      const inBadge = t.badge.toLowerCase().includes(q);
      const inDims = `${t.dimensions.width} ${t.dimensions.height} ${t.dimensions.depth}`.includes(q);
      const inCat = t.categoryLabel.toLowerCase().includes(q);
      return inName || inDesc || inBadge || inDims || inCat;
    });
  });

  categoriesNavRef = viewChild<ElementRef<HTMLDivElement>>('categoriesNav');

  scrollCategories(direction: 'left' | 'right') {
    const el = this.categoriesNavRef()?.nativeElement;
    if (!el) return;
    const scrollAmount = 260;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  onCategoryWheel(event: WheelEvent) {
    const el = this.categoriesNavRef()?.nativeElement;
    if (!el) return;
    // If vertical scrolling wheel, translate to horizontal scroll
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      el.scrollBy({
        left: event.deltaY,
        behavior: 'auto'
      });
      event.preventDefault();
    }
  }

  selectCategory(catId: string) {
    this.activeCategory.set(catId);
  }

  onSelectTemplate(t: FurnitureTemplate, mode: 'replace' | 'append') {
    this.templateSelected.emit({ template: t, mode });
    this.close();
  }

  onStartBlank() {
    this.startBlankRequested.emit();
    this.close();
  }

  close() {
    this.selectedTemplate.set(null);
    this.modalClose.emit();
  }
}
