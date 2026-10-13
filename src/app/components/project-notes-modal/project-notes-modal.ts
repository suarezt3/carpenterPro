import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ProjectNoteItem } from '../../models/melamine.models';

@Component({
  selector: 'app-project-notes-modal',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './project-notes-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectNotesModalComponent {
  readonly themeService = inject(ThemeService);
  private projectService = inject(ProjectStorageService);
  private fb = inject(FormBuilder);

  isOpen = input<boolean>(false);
  modalClose = output<void>();

  activeFilter = signal<'all' | 'pending' | 'adjustment' | 'design' | 'general' | 'completed'>('all');
  searchQuery = signal<string>('');
  editingNoteId = signal<string | null>(null);
  showAddForm = signal<boolean>(false);

  readonly project = this.projectService.currentProject;
  readonly notes = this.projectService.projectNotes;
  readonly autoSyncEnabled = this.projectService.autoSyncEnabled;

  noteForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    content: ['', [Validators.required]],
    category: ['pending' as const, [Validators.required]]
  });

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

  openNewNoteForm() {
    this.editingNoteId.set(null);
    this.noteForm.reset({
      title: '',
      content: '',
      category: 'pending'
    });
    this.showAddForm.set(true);
  }

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

  saveNote() {
    if (this.noteForm.invalid) return;

    const val = this.noteForm.value;
    const editId = this.editingNoteId();

    if (editId) {
      this.projectService.updateProjectNote(editId, {
        title: val.title.trim(),
        content: val.content.trim(),
        category: val.category
      });
    } else {
      this.projectService.addProjectNote({
        title: val.title.trim(),
        content: val.content.trim(),
        category: val.category
      });
    }

    this.cancelForm();
  }

  toggleComplete(noteId: string, event: Event) {
    event.stopPropagation();
    this.projectService.toggleProjectNoteComplete(noteId);
  }

  deleteNote(noteId: string, event: Event) {
    event.stopPropagation();
    if (confirm('¿Deseas eliminar esta nota del proyecto?')) {
      this.projectService.deleteProjectNote(noteId);
      if (this.editingNoteId() === noteId) {
        this.cancelForm();
      }
    }
  }

  close() {
    this.modalClose.emit();
  }

  getCategoryBadge(category: ProjectNoteItem['category']): { label: string; bgClass: string; textClass: string; icon: string } {
    switch (category) {
      case 'adjustment':
        return { label: 'Ajuste Pendiente', bgClass: 'bg-rose-500/10 border-rose-500/30', textClass: 'text-rose-500', icon: 'build' };
      case 'design':
        return { label: 'Diseño CAD', bgClass: 'bg-indigo-500/10 border-indigo-500/30', textClass: 'text-indigo-500', icon: 'architecture' };
      case 'general':
        return { label: 'General / Taller', bgClass: 'bg-sky-500/10 border-sky-500/30', textClass: 'text-sky-500', icon: 'assignment' };
      case 'pending':
      default:
        return { label: 'Por Hacer', bgClass: 'bg-amber-500/10 border-amber-500/30', textClass: 'text-amber-500', icon: 'pending_actions' };
    }
  }
}
