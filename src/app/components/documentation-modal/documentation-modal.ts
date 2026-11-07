import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  Download01Icon,
  InformationCircleIcon,
  Keyboard01Icon,
  Layers01Icon,
  LockIcon,
  Note01Icon,
  RulerIcon,
  ScissorsIcon,
  Search01Icon,
  Settings01Icon,
  Tag01Icon,
  CubeIcon,
  Cabinet01Icon,
  Cabinet02Icon,
  ViewIcon,
  SlidersHorizontalIcon,
  Exchange01Icon,
  SquareIcon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DocArticle, DocCategory } from '../../models/documentation.models';
import { APP_DOC_ARTICLES_BY_LANG, APP_DOC_CATEGORIES_BY_LANG } from '../../data/documentation-i18n.data';

/**
 * Modal de documentación técnica interactiva y manual de usuario en CarpenterPro.
 * Permite consultar guías paso a paso por categoría, herramientas 3D, mecanizados CNC,
 * cotas HD de luz interna, atajos de teclado y optimización de corte en 6 idiomas.
 */
@Component({
  selector: 'app-documentation-modal',
  imports: [HugeiconsIconComponent, TranslatePipe],
  templateUrl: './documentation-modal.html',
  styleUrl: './documentation-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentationModalComponent {
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);

  // Registro local de iconos Hugeicons oficiales verificados (cero SVGs inline)
  readonly icons = {
    book: BookOpen01Icon,
    close: Cancel01Icon,
    search: Search01Icon,
    cancel: Cancel01Icon,
    searchOff: Search01Icon,
    tune: Settings01Icon,
    listNumbered: CheckListIcon,
    lightbulb: InformationCircleIcon,
    verified: CheckmarkCircle02Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    lock: LockIcon,
    keyboard: Keyboard01Icon,
    cube3d: CubeIcon,
    doorSwing: Cabinet01Icon,
    humanFigure: ViewIcon,
    mouseContext: SlidersHorizontalIcon,
    roomEnvironment: Cabinet02Icon,
    scissors: ScissorsIcon,
    tag: Tag01Icon,
    download: Download01Icon
  };

  // Estado de apertura del modal y eventos de salida
  readonly isOpen = input<boolean>(false);
  readonly modalClose = output<void>();
  readonly openChangelog = output<void>();

  // Signals reactivos para el buscador, categoría activa y artículo seleccionado
  readonly searchQuery = signal<string>('');
  readonly activeCategory = signal<string>('all');
  readonly selectedArticleId = signal<string>('diseno_parametrico_ambientes');

  /**
   * Categorías de documentación reactivas según el idioma activo del sistema.
   */
  readonly categories = computed<DocCategory[]>(() => {
    const lang = this.i18n.currentLang();
    return APP_DOC_CATEGORIES_BY_LANG[lang] || APP_DOC_CATEGORIES_BY_LANG['es'];
  });

  /**
   * Repositorio multilingüe de artículos y guías reactivo según el idioma activo.
   */
  readonly articles = computed<DocArticle[]>(() => {
    const lang = this.i18n.currentLang();
    return APP_DOC_ARTICLES_BY_LANG[lang] || APP_DOC_ARTICLES_BY_LANG['es'];
  });

  /**
   * Filtra los artículos del manual según la categoría seleccionada y el término de búsqueda.
   */
  readonly filteredArticles = computed<DocArticle[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();
    const list = this.articles();

    return list.filter(art => {
      const matchCat = cat === 'all' || art.category === cat;
      if (!matchCat) return false;

      if (!q) return true;
      const inTitle = art.title.toLowerCase().includes(q);
      const inDesc = art.shortDesc.toLowerCase().includes(q);
      const inBadge = art.badge ? art.badge.toLowerCase().includes(q) : false;
      const inSteps = art.steps.some(s => s.toLowerCase().includes(q));
      const inTips = art.tips.some(t => t.toLowerCase().includes(q));
      const inTech = art.technicalDetails
        ? art.technicalDetails.some(td => td.label.toLowerCase().includes(q) || td.value.toLowerCase().includes(q))
        : false;
      return inTitle || inDesc || inBadge || inSteps || inTips || inTech;
    });
  });

  /**
   * Obtiene el artículo actualmente activo para mostrarlo en el panel de lectura derecho.
   */
  readonly selectedArticle = computed<DocArticle | null>(() => {
    const currentId = this.selectedArticleId();
    const list = this.filteredArticles();
    if (list.length === 0) return null;
    const found = list.find(a => a.id === currentId);
    return found || list[0];
  });

  /**
   * Índice del artículo seleccionado dentro de la lista filtrada.
   */
  readonly currentArticleIndex = computed<number>(() => {
    const art = this.selectedArticle();
    if (!art) return -1;
    return this.filteredArticles().findIndex(a => a.id === art.id);
  });

  /**
   * Artículo anterior en la lista de navegación secuencial.
   */
  readonly prevArticleItem = computed<DocArticle | null>(() => {
    const idx = this.currentArticleIndex();
    const list = this.filteredArticles();
    return idx > 0 ? list[idx - 1] : null;
  });

  /**
   * Artículo siguiente en la lista de navegación secuencial.
   */
  readonly nextArticleItem = computed<DocArticle | null>(() => {
    const idx = this.currentArticleIndex();
    const list = this.filteredArticles();
    return (idx >= 0 && idx < list.length - 1) ? list[idx + 1] : null;
  });

  goToPrevArticle(): void {
    const prev = this.prevArticleItem();
    if (prev) {
      this.selectedArticleId.set(prev.id);
    }
  }

  goToNextArticle(): void {
    const next = this.nextArticleItem();
    if (next) {
      this.selectedArticleId.set(next.id);
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value ?? '');
  }

  selectCategory(catId: string): void {
    this.activeCategory.set(catId);
    const filtered = this.filteredArticles();
    if (filtered.length > 0 && !filtered.some(a => a.id === this.selectedArticleId())) {
      this.selectedArticleId.set(filtered[0].id);
    }
  }

  selectArticle(artId: string): void {
    this.selectedArticleId.set(artId);
  }

  close(): void {
    this.modalClose.emit();
  }

  /**
   * Mapea los identificadores de iconos de categoría a Hugeicons oficiales.
   */
  getCategoryIcon(iconName: string) {
    switch (iconName) {
      case 'view_in_ar': return CubeIcon;
      case 'straighten': return RulerIcon;
      case 'architecture': return Compass01Icon;
      case 'adjust': return Settings01Icon;
      case 'precision_manufacturing': return Layers01Icon;
      case 'keyboard': return Keyboard01Icon;
      case 'auto_stories':
      default:
        return BookOpen01Icon;
    }
  }

  /**
   * Mapea los identificadores de iconos de artículos individuales a Hugeicons oficiales.
   */
  getArticleIcon(iconName: string) {
    switch (iconName) {
      case 'view_in_ar':
      case 'cube':
        return CubeIcon;
      case 'straighten':
      case 'ruler':
        return RulerIcon;
      case 'tag':
        return Tag01Icon;
      case 'download':
        return Download01Icon;
      case 'human':
        return ViewIcon;
      case 'lock':
        return LockIcon;
      case 'mouse':
        return SlidersHorizontalIcon;
      case 'room':
        return Cabinet02Icon;
      case 'pan_tool':
        return Exchange01Icon;
      case 'dashboard_customize':
        return Settings01Icon;
      case 'format_shapes':
        return SquareIcon;
      case 'scissors':
        return ScissorsIcon;
      case 'adjust':
        return Settings01Icon;
      case 'door_sliding':
        return Cabinet01Icon;
      case 'precision_manufacturing':
        return Layers01Icon;
      case 'keyboard':
        return Keyboard01Icon;
      case 'note':
        return Note01Icon;
      default:
        return BookOpen01Icon;
    }
  }
}