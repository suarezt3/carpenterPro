import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, input, output, signal, computed, inject, viewChild, ElementRef, PLATFORM_ID } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  BoldIcon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CloudIcon,
  Compass01Icon,
  Delete02Icon,
  Edit02Icon,
  Heading01Icon,
  Heading02Icon,
  ItalicIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Note01Icon,
  RemoveFormattingIcon,
  Search01Icon,
  Settings01Icon,
  StrikethroughIcon,
  TextFontIcon,
  Tick02Icon,
  UnderlineIcon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ProjectNoteItem } from '../../models/melamine.models';

/**
 * Modal de gestión de notas técnicas, ajustes pendientes y bitácora del proyecto.
 * Incluye editor enriquecido tipo Word con viñetas, negrita, cursiva, subrayado,
 * tachado y tipografías para facilitar la gestión de listas de tareas en carpintería.
 */
@Component({
  selector: 'app-project-notes-modal',
  imports: [ReactiveFormsModule, DatePipe, HugeiconsIconComponent],
  templateUrl: './project-notes-modal.html',
  styleUrl: './project-notes-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectNotesModalComponent implements OnInit, OnDestroy {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Referencia al elemento editable de texto enriquecido (contenteditable)
  readonly editorRef = viewChild<ElementRef<HTMLDivElement>>('editorElement');

  // Registro de iconos Hugeicons para la cabecera, filtros, tarjetas y barra de herramientas
  readonly icons = {
    note: Note01Icon,
    add: Add01Icon,
    close: Cancel01Icon,
    edit: Edit02Icon,
    delete: Delete02Icon,
    check: Tick02Icon,
    search: Search01Icon,
    cloud: CloudIcon,
    completed: CheckmarkCircle02Icon,
    adjustment: Settings01Icon,
    design: Compass01Icon,
    general: CheckListIcon,
    pending: Clock01Icon,
    // Iconos de formato tipo Word
    bold: BoldIcon,
    italic: ItalicIcon,
    underline: UnderlineIcon,
    strikethrough: StrikethroughIcon,
    bulletList: LeftToRightListBulletIcon,
    numberedList: LeftToRightListNumberIcon,
    heading1: Heading01Icon,
    heading2: Heading02Icon,
    font: TextFontIcon,
    clearFormat: RemoveFormattingIcon
  };

  // Estado de apertura y evento de cierre del modal
  readonly isOpen = input<boolean>(false);
  readonly modalClose = output<void>();

  // Estado reactivo para filtros, búsqueda y edición
  readonly activeFilter = signal<'all' | 'pending' | 'adjustment' | 'design' | 'general' | 'completed'>('all');
  readonly searchQuery = signal<string>('');
  readonly editingNoteId = signal<string | null>(null);
  readonly showAddForm = signal<boolean>(false);

  // Estados de formato activo en la barra de herramientas del editor (Reactivos)
  readonly isBold = signal<boolean>(false);
  readonly isItalic = signal<boolean>(false);
  readonly isUnderline = signal<boolean>(false);
  readonly isStrikethrough = signal<boolean>(false);
  readonly isBulletList = signal<boolean>(false);
  readonly isNumberedList = signal<boolean>(false);
  readonly activeFont = signal<'Inter' | 'Georgia' | 'JetBrains Mono'>('Inter');
  readonly activeBlock = signal<'p' | 'h3' | 'h4'>('p');

  // Referencia en memoria a la selección previa dentro del editor para preservación de foco
  private savedRange: Range | null = null;

  // Listener para capturar cambios de selección en el documento
  private readonly onSelectionChange = () => {
    if (this.showAddForm()) {
      this.updateToolbarState();
    }
  };

  // Referencias reactivas al proyecto actual y sus notas
  readonly project = this.projectService.currentProject;
  readonly notes = this.projectService.projectNotes;
  readonly autoSyncEnabled = this.projectService.autoSyncEnabled;

  // Formulario reactivo con validaciones
  readonly noteForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    content: ['', [Validators.required]],
    category: ['pending' as const, [Validators.required]]
  });

  ngOnInit() {
    if (this.isBrowser && typeof document !== 'undefined') {
      document.addEventListener('selectionchange', this.onSelectionChange);
    }
  }

  ngOnDestroy() {
    if (this.isBrowser && typeof document !== 'undefined') {
      document.removeEventListener('selectionchange', this.onSelectionChange);
    }
  }

  /**
   * Filtra dinámicamente la lista de notas según la pestaña activa y el texto de búsqueda.
   */
  readonly filteredNotes = computed(() => {
    let list = this.notes();
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (filter === 'completed') {
      list = list.filter(n => n.completed);
    } else if (filter !== 'all') {
      list = list.filter(n => n.category === filter && !n.completed);
    }

    if (query) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
      );
    }

    return list;
  });

  readonly pendingCount = computed(() => this.notes().filter(n => !n.completed).length);
  readonly completedCount = computed(() => this.notes().filter(n => n.completed).length);

  /**
   * Actualiza el término de búsqueda con tipado seguro desde el evento input.
   */
  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value ?? '');
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  /**
   * Inicializa el formulario en blanco para registrar una nueva nota.
   */
  openNewNoteForm() {
    this.editingNoteId.set(null);
    this.noteForm.reset({
      title: '',
      content: '',
      category: 'pending'
    });
    this.activeFont.set('Inter');
    this.activeBlock.set('p');
    this.isBold.set(false);
    this.isItalic.set(false);
    this.isUnderline.set(false);
    this.isStrikethrough.set(false);
    this.isBulletList.set(false);
    this.isNumberedList.set(false);
    this.savedRange = null;
    this.showAddForm.set(true);
    this.syncEditorContent('');
  }

  /**
   * Carga los datos de una nota existente en el formulario para editarla.
   */
  startEditNote(note: ProjectNoteItem) {
    this.editingNoteId.set(note.id);
    this.noteForm.patchValue({
      title: note.title,
      content: note.content,
      category: note.category
    });
    this.showAddForm.set(true);
    this.syncEditorContent(this.formatNoteContent(note.content));
  }

  private syncEditorContent(html: string) {
    setTimeout(() => {
      const el = this.editorRef()?.nativeElement;
      if (el) {
        el.innerHTML = html;
        el.style.fontFamily = '';
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        this.savedRange = range.cloneRange();
        this.updateToolbarState();
      }
    }, 60);
  }

  cancelForm() {
    this.showAddForm.set(false);
    this.editingNoteId.set(null);
    this.noteForm.reset();
    this.savedRange = null;
    this.isBold.set(false);
    this.isItalic.set(false);
    this.isUnderline.set(false);
    this.isStrikethrough.set(false);
    this.isBulletList.set(false);
    this.isNumberedList.set(false);
  }

  // --- MÉTODOS DE PRESERVACIÓN DE SELECCIÓN Y ESTADO DE FORMATO ---

  /**
   * Guarda el rango de selección actual del editor antes de interactuar con la barra de herramientas.
   */
  saveSelection() {
    if (!this.isBrowser || typeof window === 'undefined') return;
    const el = this.editorRef()?.nativeElement;
    if (!el) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  /**
   * Restaura el rango de selección dentro del editor editable para no perder el foco ni el cursor.
   */
  restoreSelection() {
    if (!this.isBrowser || typeof window === 'undefined') return;
    const el = this.editorRef()?.nativeElement;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;

    if (this.savedRange && el.contains(this.savedRange.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
      el.focus();
    } else {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      this.savedRange = range.cloneRange();
    }
  }

  /**
   * Detecta y sincroniza en tiempo real los formatos activos en la posición actual del cursor.
   */
  updateToolbarState() {
    if (!this.isBrowser || typeof window === 'undefined' || typeof document === 'undefined') return;
    const el = this.editorRef()?.nativeElement;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const anchor = sel.anchorNode;
    if (!anchor || !el.contains(anchor)) return;

    // Guarda el rango activo
    this.savedRange = sel.getRangeAt(0).cloneRange();

    let bold = false;
    let italic = false;
    let underline = false;
    let strikethrough = false;
    let bulletList = false;
    let numberedList = false;

    try {
      bold = document.queryCommandState('bold');
      italic = document.queryCommandState('italic');
      underline = document.queryCommandState('underline');
      strikethrough = document.queryCommandState('strikeThrough');
      bulletList = document.queryCommandState('insertUnorderedList');
      numberedList = document.queryCommandState('insertOrderedList');
    } catch {
      // Ignorar excepciones en contextos desacoplados
    }

    // Inspección en profundidad del árbol de elementos para mayor fiabilidad
    let curr: Node | null = anchor;
    let foundBlock: 'p' | 'h3' | 'h4' = 'p';
    let foundFont: 'Inter' | 'Georgia' | 'JetBrains Mono' = 'Inter';

    while (curr && curr !== el) {
      if (curr.nodeType === Node.ELEMENT_NODE) {
        const elem = curr as HTMLElement;
        const tag = elem.tagName.toLowerCase();
        if (tag === 'h3') foundBlock = 'h3';
        else if (tag === 'h4') foundBlock = 'h4';
        else if (tag === 'ul') bulletList = true;
        else if (tag === 'ol') numberedList = true;
        else if (tag === 'b' || tag === 'strong') bold = true;
        else if (tag === 'i' || tag === 'em') italic = true;
        else if (tag === 'u') underline = true;
        else if (tag === 's' || tag === 'strike' || tag === 'del') strikethrough = true;

        const face = elem.getAttribute('face') || elem.style.fontFamily || '';
        if (/georgia/i.test(face)) foundFont = 'Georgia';
        else if (/jetbrains mono|mono/i.test(face)) foundFont = 'JetBrains Mono';
        else if (/inter/i.test(face)) foundFont = 'Inter';
      }
      curr = curr.parentNode;
    }

    if (foundFont === 'Inter' && el.style.fontFamily) {
      if (/georgia/i.test(el.style.fontFamily)) foundFont = 'Georgia';
      else if (/jetbrains mono|mono/i.test(el.style.fontFamily)) foundFont = 'JetBrains Mono';
    }

    this.isBold.set(bold);
    this.isItalic.set(italic);
    this.isUnderline.set(underline);
    this.isStrikethrough.set(strikethrough);
    this.isBulletList.set(bulletList);
    this.isNumberedList.set(numberedList);
    this.activeBlock.set(foundBlock);
    this.activeFont.set(foundFont);
  }

  // --- MÉTODOS DE LA BARRA DE HERRAMIENTAS TIPO WORD ---

  /**
   * Ejecuta un comando estándar de edición enriquecida en la selección del usuario.
   */
  applyFormat(command: string, value: string | undefined = undefined) {
    this.restoreSelection();
    document.execCommand(command, false, value);
    this.onEditorInput();
    this.updateToolbarState();
  }

  /**
   * Aplica un tipo de letra a la selección o texto nuevo.
   */
  applyFontFamily(font: 'Inter' | 'Georgia' | 'JetBrains Mono') {
    this.restoreSelection();
    this.activeFont.set(font);
    const el = this.editorRef()?.nativeElement;

    if (el && (!el.innerHTML.trim() || el.innerHTML.trim() === '<br>')) {
      const fontCss = font === 'Georgia'
        ? "Georgia, 'Times New Roman', serif"
        : (font === 'JetBrains Mono' ? "'JetBrains Mono', monospace" : "'Inter', sans-serif");
      el.style.fontFamily = fontCss;
    } else {
      document.execCommand('fontName', false, font);
    }

    this.onEditorInput();
    this.updateToolbarState();
  }

  /**
   * Aplica estilo de bloque (Párrafo o Encabezado H3/H4).
   */
  applyBlock(tag: 'p' | 'h3' | 'h4') {
    this.restoreSelection();
    this.activeBlock.set(tag);
    const el = this.editorRef()?.nativeElement;

    if (el && (!el.innerHTML.trim() || el.innerHTML.trim() === '<br>')) {
      el.innerHTML = `<${tag}><br></${tag}>`;
      const blockEl = el.querySelector(tag);
      if (blockEl) {
        const range = document.createRange();
        range.setStart(blockEl, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        this.savedRange = range.cloneRange();
      }
    } else {
      try {
        document.execCommand('formatBlock', false, '<' + tag + '>');
      } catch {
        document.execCommand('formatBlock', false, tag);
      }
    }

    this.onEditorInput();
    this.updateToolbarState();
  }

  /**
   * Inserta o alterna una lista con viñetas (punticos).
   */
  insertBulletList() {
    this.restoreSelection();
    const el = this.editorRef()?.nativeElement;
    if (!el) return;

    const currentContent = el.innerHTML.trim();
    if (!currentContent || currentContent === '<br>') {
      el.innerHTML = '<ul><li><br></li></ul>';
      const li = el.querySelector('li');
      if (li) {
        const range = document.createRange();
        range.setStart(li, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        this.savedRange = range.cloneRange();
      }
    } else {
      document.execCommand('insertUnorderedList', false);
    }

    this.onEditorInput();
    this.updateToolbarState();
    el.focus();
  }

  /**
   * Inserta o alterna una lista numerada (1, 2, 3...).
   */
  insertNumberedList() {
    this.restoreSelection();
    const el = this.editorRef()?.nativeElement;
    if (!el) return;

    const currentContent = el.innerHTML.trim();
    if (!currentContent || currentContent === '<br>') {
      el.innerHTML = '<ol><li><br></li></ol>';
      const li = el.querySelector('li');
      if (li) {
        const range = document.createRange();
        range.setStart(li, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        this.savedRange = range.cloneRange();
      }
    } else {
      document.execCommand('insertOrderedList', false);
    }

    this.onEditorInput();
    this.updateToolbarState();
    el.focus();
  }

  /**
   * Limpia el formato de la selección actual.
   */
  clearFormatting() {
    this.restoreSelection();
    document.execCommand('removeFormat', false);
    try {
      document.execCommand('formatBlock', false, '<p>');
    } catch {
      document.execCommand('formatBlock', false, 'p');
    }
    const el = this.editorRef()?.nativeElement;
    if (el) {
      el.style.fontFamily = '';
    }
    this.onEditorInput();
    this.updateToolbarState();
  }

  /**
   * Evento de entrada de texto en el contenteditable: sincroniza con el ReactiveForm.
   */
  onEditorInput() {
    const el = this.editorRef()?.nativeElement;
    if (!el) return;
    const text = el.innerText?.trim() || '';
    const html = text.length === 0 ? '' : el.innerHTML;
    this.noteForm.patchValue({ content: html }, { emitEvent: false });
    this.noteForm.get('content')?.updateValueAndValidity();
    this.updateToolbarState();
  }

  /**
   * Maneja teclas especiales en el editor, como Tab para indentar sin perder foco.
   */
  onEditorKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      if (this.isBulletList() || this.isNumberedList()) {
        if (event.shiftKey) {
          document.execCommand('outdent', false);
        } else {
          document.execCommand('indent', false);
        }
      } else {
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      }
      this.onEditorInput();
      this.updateToolbarState();
    }
  }

  /**
   * Guarda una nota nueva o actualiza la nota en edición dentro del proyecto activo.
   */
  saveNote() {
    const el = this.editorRef()?.nativeElement;
    const rawText = (el?.innerText || '').trim();
    const rawHtml = (el?.innerHTML || '').trim();

    if (!rawText && !rawHtml.includes('<img') && !rawHtml.includes('<hr')) {
      this.noteForm.get('content')?.setErrors({ required: true });
      return;
    }

    const val = this.noteForm.value;
    const title = String(val.title || '').trim();
    if (!title) {
      this.noteForm.get('title')?.setErrors({ required: true });
      return;
    }

    const editId = this.editingNoteId();
    if (editId) {
      this.projectService.updateProjectNote(editId, {
        title,
        content: rawHtml,
        category: val.category
      });
    } else {
      this.projectService.addProjectNote({
        title,
        content: rawHtml,
        category: val.category
      });
    }

    this.cancelForm();
  }

  /**
   * Alterna el estado completado/pendiente de una nota.
   */
  toggleComplete(noteId: string, event: Event) {
    event.stopPropagation();
    this.projectService.toggleProjectNoteComplete(noteId);
  }

  /**
   * Solicita confirmación antes de eliminar una nota.
   */
  async deleteNote(noteId: string, event: Event) {
    event.stopPropagation();
    const note = this.notes().find(n => n.id === noteId);
    const noteTitle = note ? `"${note.title}"` : 'esta nota';

    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar nota del proyecto?',
      message: `Se eliminará ${noteTitle} de la bitácora del proyecto.`,
      confirmText: 'Eliminar Nota',
      cancelText: 'Cancelar',
      severity: 'danger'
    });

    if (confirmed) {
      this.projectService.deleteProjectNote(noteId);
      if (this.editingNoteId() === noteId) {
        this.cancelForm();
      }
    }
  }

  close() {
    this.cancelForm();
    this.modalClose.emit();
  }

  /**
   * Formatea el contenido de la nota para renderizado visual.
   * Si la nota proviene de texto plano con viñetas '•' o saltos de línea,
   * la convierte automáticamente en una lista HTML estructurada para retrocompatibilidad total.
   */
  formatNoteContent(content: string): string {
    if (!content) return '';
    if (/<(p|ul|ol|li|b|i|u|s|h[1-6]|div|span|font)[>\s]/i.test(content)) {
      return content;
    }

    const lines = content.split('\n');
    let inList = false;
    let html = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[•\-\*]\s+/.test(trimmed) || trimmed.startsWith('•')) {
        if (!inList) {
          html += '<ul class="note-bullet-list">';
          inList = true;
        }
        html += '<li>' + this.escapeHtml(trimmed.replace(/^[•\-\*]\s*/, '')) + '</li>';
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (trimmed.length > 0) {
          html += '<p>' + this.escapeHtml(trimmed) + '</p>';
        }
      }
    }
    if (inList) html += '</ul>';
    return html || this.escapeHtml(content);
  }

  /**
   * Genera el HTML seguro para ser renderizado con [innerHTML] en la tarjeta.
   */
  renderNoteHtml(content: string): SafeHtml {
    const formatted = this.formatNoteContent(content);
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Devuelve los estilos visuales y el ícono vectorial de Hugeicons correspondiente a cada categoría.
   */
  getCategoryBadge(category: ProjectNoteItem['category']) {
    switch (category) {
      case 'adjustment':
        return { label: 'Ajuste de Medidas', bgClass: 'bg-rose-500/10 border-rose-500/30', textClass: 'text-rose-500', icon: this.icons.adjustment };
      case 'design':
        return { label: 'Diseño CAD', bgClass: 'bg-indigo-500/10 border-indigo-500/30', textClass: 'text-indigo-500', icon: this.icons.design };
      case 'general':
        return { label: 'General / Taller', bgClass: 'bg-sky-500/10 border-sky-500/30', textClass: 'text-sky-500', icon: this.icons.general };
      case 'pending':
      default:
        return { label: 'Por Hacer', bgClass: 'bg-amber-500/10 border-amber-500/30', textClass: 'text-amber-500', icon: this.icons.pending };
    }
  }
}
