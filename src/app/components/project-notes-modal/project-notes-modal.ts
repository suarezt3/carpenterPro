import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, viewChild, ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
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
export class ProjectNotesModalComponent {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);

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

  // Estados de formato activo en la barra de herramientas del editor
  readonly activeFont = signal<'Inter' | 'Georgia' | 'JetBrains Mono'>('Inter');
  readonly activeBlock = signal<'p' | 'h3' | 'h4'>('p');

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
        el.focus();
      }
    }, 60);
  }

  cancelForm() {
    this.showAddForm.set(false);
    this.editingNoteId.set(null);
    this.noteForm.reset();
  }

  // --- MÉTODOS DE LA BARRA DE HERRAMIENTAS TIPO WORD ---

  /**
   * Ejecuta un comando estándar de edición enriquecida en la selección del usuario.
   */
  applyFormat(command: string, value: string | undefined = undefined) {
    document.execCommand(command, false, value);
    this.onEditorInput();
    this.editorRef()?.nativeElement?.focus();
  }

  /**
   * Aplica un tipo de letra a la selección o texto.
   */
  applyFontFamily(font: 'Inter' | 'Georgia' | 'JetBrains Mono') {
    this.activeFont.set(font);
    const fontCss = font === 'Inter'
      ? 'Inter, sans-serif'
      : (font === 'Georgia' ? 'Georgia, serif' : 'JetBrains Mono, monospace');
    document.execCommand('fontName', false, fontCss);
    this.onEditorInput();
    this.editorRef()?.nativeElement?.focus();
  }

  /**
   * Aplica estilo de bloque (Párrafo o Encabezado).
   */
  applyBlock(tag: 'p' | 'h3' | 'h4') {
    this.activeBlock.set(tag);
    document.execCommand('formatBlock', false, '<' + tag + '>');
    this.onEditorInput();
    this.editorRef()?.nativeElement?.focus();
  }

  /**
   * Inserta o alterna una lista con viñetas (punticos).
   */
  insertBulletList() {
    document.execCommand('insertUnorderedList', false);
    this.onEditorInput();
    this.editorRef()?.nativeElement?.focus();
  }

  /**
   * Inserta o alterna una lista numerada (1, 2, 3...).
   */
  insertNumberedList() {
    document.execCommand('insertOrderedList', false);
    this.onEditorInput();
    this.editorRef()?.nativeElement?.focus();
  }

  /**
   * Limpia el formato de la selección actual.
   */
  clearFormatting() {
    document.execCommand('removeFormat', false);
    this.onEditorInput();
    this.editorRef()?.nativeElement?.focus();
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
  }

  /**
   * Maneja teclas especiales en el editor, como Tab para indentar sin perder foco.
   */
  onEditorKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      this.onEditorInput();
    }
  }

  /**
   * Guarda una nota nueva o actualiza la nota en edición dentro del proyecto activo.
   */
  saveNote() {
    const el = this.editorRef()?.nativeElement;
    const editorHtml = (el?.innerText?.trim() ? el.innerHTML : '').trim();

    if (!editorHtml) {
      this.noteForm.get('content')?.setErrors({ required: true });
      return;
    }

    const val = this.noteForm.value;
    const title = String(val.title || '').trim();
    if (!title) return;

    const editId = this.editingNoteId();
    if (editId) {
      this.projectService.updateProjectNote(editId, {
        title,
        content: editorHtml,
        category: val.category
      });
    } else {
      this.projectService.addProjectNote({
        title,
        content: editorHtml,
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
    this.modalClose.emit();
  }

  /**
   * Formatea el contenido de la nota para renderizado visual.
   * Si la nota proviene de texto plano con viñetas '•' o saltos de línea,
   * la convierte automáticamente en una lista HTML estructurada para retrocompatibilidad total.
   */
  formatNoteContent(content: string): string {
    if (!content) return '';
    if (/<(p|ul|ol|li|b|i|u|s|h[1-6]|div|span)[>\s]/i.test(content)) {
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
