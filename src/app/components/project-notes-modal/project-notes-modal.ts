import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CloudIcon,
  Compass01Icon,
  Delete02Icon,
  Edit02Icon,
  Note01Icon,
  Search01Icon,
  Settings01Icon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ProjectNoteItem } from '../../models/melamine.models';

/**
 * Modal de gestión de notas técnicas, ajustes pendientes y bitácora del proyecto.
 * Permite crear, categorizar, filtrar y marcar como resueltas las notas de carpintería.
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

  // Registro local de iconos vectoriales de Hugeicons
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
    pending: Clock01Icon
  };

  // Estado de apertura y evento de cierre del modal
  readonly isOpen = input<boolean>(false);
  readonly modalClose = output<void>();

  // Estado reactivo para filtros, búsqueda y edición
  readonly activeFilter = signal<'all' | 'pending' | 'adjustment' | 'design' | 'general' | 'completed'>('all');
  readonly searchQuery = signal<string>('');
  readonly editingNoteId = signal<string | null>(null);
  readonly showAddForm = signal<boolean>(false);

  // Referencias reactivas al proyecto actual y sus notas
  readonly project = this.projectService.currentProject;
  readonly notes = this.projectService.projectNotes;
  readonly autoSyncEnabled = this.projectService.autoSyncEnabled;

  // Formulario reactivo con validaciones para crear o editar notas
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
    this.showAddForm.set(true);
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
  }

  cancelForm() {
    this.showAddForm.set(false);
    this.editingNoteId.set(null);
    this.noteForm.reset();
  }

  /**
   * Guarda una nota nueva o actualiza la nota en edición dentro del proyecto activo.
   */
  saveNote() {
    if (this.noteForm.invalid) return;
    const val = this.noteForm.value;
    const editId = this.editingNoteId();

    if (editId) {
      this.projectService.updateProjectNote(editId, {
        title: String(val.title || '').trim(),
        content: String(val.content || '').trim(),
        category: val.category
      });
    } else {
      this.projectService.addProjectNote({
        title: String(val.title || '').trim(),
        content: String(val.content || '').trim(),
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
   * Solicita confirmación mediante ConfirmDialogService antes de eliminar una nota.
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
   * Devuelve los estilos visuales y el ícono vectorial de Hugeicons correspondiente a cada categoría.
   */
  getCategoryBadge(category: ProjectNoteItem['category']) {
    switch (category) {
      case 'adjustment':
        return { label: 'Ajuste Pendiente', bgClass: 'bg-rose-500/10 border-rose-500/30', textClass: 'text-rose-500', icon: this.icons.adjustment };
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