import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckListIcon,
  Clock01Icon,
  CloudIcon,
  Compass01Icon,
  Delete02Icon,
  Download01Icon,
  Edit02Icon,
  InformationCircleIcon,
  Layers01Icon,
  Moon02Icon,
  Note01Icon,
  QrCodeIcon,
  Settings01Icon,
  Sun01Icon,
  Tag01Icon,
  Tick02Icon,
  Megaphone01Icon,
  Rocket01Icon
} from '@hugeicons/core-free-icons';
import { ProjectStorageService, ProjectMeta } from '../../services/project-storage.service';
import { CloudProjectRecord } from '../../services/supabase.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { ThemeService } from '../../services/theme.service';
import { TechnicalSheetModalComponent } from '../technical-sheet-modal/technical-sheet-modal';
import { DocumentationModalComponent } from '../documentation-modal/documentation-modal';
import { ProjectNotesModalComponent } from '../project-notes-modal/project-notes-modal';
import { ChangelogModalComponent } from '../changelog-modal/changelog-modal';
import { APP_CURRENT_VERSION } from '../../data/changelog.data';
import { ProjectSettings } from '../../models/melamine.models';

/**
 * Barra de navegación superior global de Piezo3D Studio.
 * Gestiona el cambio de pestañas, edición rápida del nombre del proyecto,
 * historial Undo/Redo, sincronización con Supabase, exportación DXF/PDF/JSON y parámetros de sierra.
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SlicePipe,
    HugeiconsIconComponent,
    TechnicalSheetModalComponent,
    DocumentationModalComponent,
    ProjectNotesModalComponent,
    ChangelogModalComponent
  ],
  host: {
    '(window:keydown)': 'handleGlobalKeyDown($event)',
    '(document:click)': 'closeDropdowns()'
  },
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly dxfExporter = inject(DxfExporterService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Registro local de iconos vectoriales de Hugeicons
  readonly icons = {
    logo3d: Compass01Icon,
    edit: Edit02Icon,
    close: Cancel01Icon,
    check: Tick02Icon,
    tab3d: Compass01Icon,
    tabParts: CheckListIcon,
    tabOptimizer: Layers01Icon,
    tabBudget: Tag01Icon,
    tabLabels: QrCodeIcon,
    sun: Sun01Icon,
    moon: Moon02Icon,
    note: Note01Icon,
    undo: ArrowLeft01Icon,
    redo: ArrowRight01Icon,
    project: Layers01Icon,
    chevronDown: ArrowDown01Icon,
    add: Add01Icon,
    cloud: CloudIcon,
    download: Download01Icon,
    loading: Clock01Icon,
    info: InformationCircleIcon,
    settings: Settings01Icon,
    delete: Delete02Icon,
    megaphone: Megaphone01Icon,
    rocket: Rocket01Icon
  };

  // Versión actual de la aplicación
  readonly appVersion = APP_CURRENT_VERSION;

  // Pestaña activa y evento de navegación hacia App
  readonly activeTab = input<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>('modules');
  readonly tabChanged = output<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>();

  // Estado de menús desplegables y modales
  readonly isProjectDropdownOpen = signal(false);
  readonly isExportDropdownOpen = signal(false);
  readonly showProjectsModal = signal(false);
  readonly showSettingsModal = signal(false);
  readonly showNewProjectModal = signal(false);
  readonly showSqlModal = signal(false);
  readonly showTechnicalSheetModal = signal(false);
  readonly showDocumentationModal = signal(false);
  readonly showNotesModal = signal(false);
  readonly showChangelogModal = signal(false);

  readonly projectsTab = signal<'cloud' | 'local'>('cloud');
  readonly sqlCopied = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly showLabelsTab = signal(false);

  readonly pendingNotesCount = computed(() =>
    this.projectService.projectNotes().filter(n => !n.completed).length
  );

  // Estado de edición rápida del nombre del proyecto y cliente
  readonly isEditingTitle = signal(false);
  readonly titleInput = signal('');
  readonly clientInput = signal('');

  // Signals sincronizados con ProjectStorageService y SupabaseService
  readonly project = this.projectService.currentProject;
  readonly savedProjects = this.projectService.savedProjects;
  readonly partsCount = this.projectService.totalPartsCount;
  readonly supabase = this.projectService.supabase;
  readonly cloudProjects = this.supabase.cloudProjects;
  readonly syncStatus = this.supabase.syncStatus;
  readonly lastSyncTime = this.supabase.lastSyncTime;

  readonly canUndo = this.projectService.canUndo;
  readonly canRedo = this.projectService.canRedo;
  readonly autoSyncEnabled = this.projectService.autoSyncEnabled;

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private sqlCopyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly newProjectForm: FormGroup = this.fb.group({
    name: ['Nuevo Mueble de Cocina', Validators.required],
    clientName: ['']
  });

  readonly settingsForm: FormGroup = this.fb.group({
    sawKerf: [4, [Validators.required, Validators.min(0)]],
    trimMargin: [10, [Validators.required, Validators.min(0)]],
    thinEdgeThickness: [0.45, [Validators.required, Validators.min(0)]],
    thickEdgeThickness: [2.0, [Validators.required, Validators.min(0)]],
    thinEdgeCostPerMeter: [1800, [Validators.required, Validators.min(0)]],
    thickEdgeCostPerMeter: [4200, [Validators.required, Validators.min(0)]],
    currency: ['COP', Validators.required],
    optimizationPreference: ['best_fit', Validators.required]
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      if (this.sqlCopyTimer) clearTimeout(this.sqlCopyTimer);
    });
  }

  // --- MANEJADORES DE ENTRADA TIPADOS ---

  onTitleInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.titleInput.set(target?.value ?? '');
  }

  onClientInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.clientInput.set(target?.value ?? '');
  }

  selectTab(tab: 'modules' | 'parts' | 'optimizer' | 'budget' | 'labels') {
    this.tabChanged.emit(tab);
  }

  openSettings() {
    const s = this.project().settings;
    this.settingsForm.patchValue({
      sawKerf: s.sawKerf,
      trimMargin: s.trimMargin,
      thinEdgeThickness: s.thinEdgeThickness,
      thickEdgeThickness: s.thickEdgeThickness,
      thinEdgeCostPerMeter: s.thinEdgeCostPerMeter,
      thickEdgeCostPerMeter: s.thickEdgeCostPerMeter,
      currency: s.currency,
      optimizationPreference: s.optimizationPreference
    });
    this.showSettingsModal.set(true);
  }

  saveSettings() {
    if (this.settingsForm.valid) {
      const val = this.settingsForm.value as ProjectSettings;
      this.projectService.updateSettings(val);
      this.showSettingsModal.set(false);
    }
  }

  openNewProjectModal() {
    this.newProjectForm.reset({
      name: 'Nuevo Proyecto Melamina',
      clientName: ''
    });
    this.showNewProjectModal.set(true);
  }

  submitNewProject() {
    if (this.newProjectForm.valid) {
      const { name, clientName } = this.newProjectForm.value;
      this.projectService.createNewProject(name, clientName);
      this.showNewProjectModal.set(false);
      this.selectTab('modules');
      this.showToast(`Proyecto "${name}" creado.`);
    }
  }

  // --- HISTORIAL UNDO / REDO Y ATAJOS GLOBALES ---

  undo() {
    if (this.canUndo()) {
      this.projectService.undo();
      this.showToast('↺ Acción deshecha');
    }
  }

  redo() {
    if (this.canRedo()) {
      this.projectService.redo();
      this.showToast('↻ Acción rehecha');
    }
  }

  toggleAutoSync() {
    this.projectService.toggleAutoSync();
    if (this.autoSyncEnabled()) {
      this.showToast('☁️ Auto-guardado en nube ACTIVADO');
    } else {
      this.showToast('☁️ Auto-guardado DESACTIVADO (Solo guardado manual)');
    }
  }

  toggleProjectDropdown(e?: Event) {
    e?.stopPropagation();
    this.isProjectDropdownOpen.update(v => !v);
    this.isExportDropdownOpen.set(false);
  }

  toggleExportDropdown(e?: Event) {
    e?.stopPropagation();
    this.isExportDropdownOpen.update(v => !v);
    this.isProjectDropdownOpen.set(false);
  }

  startEditingTitle(e?: Event) {
    e?.stopPropagation();
    this.titleInput.set(this.project().name);
    this.clientInput.set(this.project().clientName || '');
    this.isEditingTitle.set(true);
    this.closeDropdowns();
  }

  saveTitleChange() {
    if (!this.isEditingTitle()) return;
    const newName = this.titleInput().trim() || 'Proyecto Melamina';
    const newClient = this.clientInput().trim();
    this.projectService.updateProjectName(newName, newClient);
    this.isEditingTitle.set(false);
    this.showToast(`✏️ Nombre del proyecto actualizado a "${newName}"`);
  }

  cancelEditingTitle() {
    this.isEditingTitle.set(false);
  }

  closeDropdowns() {
    this.isProjectDropdownOpen.set(false);
    this.isExportDropdownOpen.set(false);
  }

  /**
   * Gestiona el cierre de menús con Escape y los atajos Ctrl+Z / Ctrl+Y
   * cuando el usuario se encuentra en las pestañas fuera del Diseñador 3D
   * (evitando ejecutar dos veces el Undo cuando ModuleDesignerComponent está activo).
   */
  handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.closeDropdowns();
    }

    if (e.defaultPrevented || this.activeTab() === 'modules') {
      return;
    }

    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        if (this.canRedo()) {
          e.preventDefault();
          this.redo();
        }
      } else {
        if (this.canUndo()) {
          e.preventDefault();
          this.undo();
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      if (this.canRedo()) {
        e.preventDefault();
        this.redo();
      }
    }
  }

  // --- ACCIONES EN LA NUBE CON SUPABASE ---

  async saveCurrentToCloud() {
    this.showToast('Guardando en Supabase...');
    const res = await this.projectService.saveCurrentToCloud();
    if (res.success) {
      this.showToast('¡Proyecto guardado en la nube exitosamente!');
    } else if (res.error === 'table_needed') {
      this.showSqlModal.set(true);
    } else {
      this.showToast('Aviso: Guardado localmente. Supabase reportó: ' + (res.error || 'Verifica la tabla'));
    }
  }

  async loadCloudProject(item: CloudProjectRecord) {
    await this.projectService.loadCloudProject(item);
    this.showProjectsModal.set(false);
    this.showToast(`☁️ Proyecto "${item.name}" cargado desde Supabase`);
  }

  async deleteCloudProject(item: CloudProjectRecord, event: Event) {
    event.stopPropagation();
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar proyecto de la nube?',
      message: `El proyecto "${item.name}" se eliminará permanentemente de tu base de datos de Supabase. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar de la nube',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (confirmed) {
      const ok = await this.projectService.deleteCloudProject(item.id);
      if (ok) {
        this.showToast('Proyecto eliminado de la nube');
      }
    }
  }

  refreshCloud() {
    void this.supabase.refreshProjects();
    this.showToast('Actualizando proyectos de Supabase...');
  }

  copySqlScript() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(this.supabase.getSqlSetupScript());
      this.sqlCopied.set(true);
      if (this.sqlCopyTimer) clearTimeout(this.sqlCopyTimer);
      this.sqlCopyTimer = setTimeout(() => this.sqlCopied.set(false), 3000);
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3500);
  }

  // --- ACCIONES DE ALMACENAMIENTO LOCAL Y EXPORTACIÓN ---

  loadProject(meta: ProjectMeta) {
    this.projectService.loadProjectById(meta.id);
    this.showProjectsModal.set(false);
  }

  async deleteLocalProject(meta: ProjectMeta, event: Event) {
    event.stopPropagation();
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar proyecto local?',
      message: `El proyecto "${meta.name}" se eliminará permanentemente de la memoria local de tu navegador.`,
      confirmText: 'Eliminar Proyecto',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (confirmed) {
      this.projectService.deleteLocalProject(meta.id);
      this.showToast('Proyecto eliminado de la memoria local');
    }
  }

  async resetDemo() {
    const confirmed = await this.confirmService.ask({
      title: '¿Restablecer mueble demo?',
      message: 'Se cargará el mueble demo de barra en Melamina Roble y Blanco con precios en Pesos Colombianos (COP). Cualquier cambio no guardado en la nube o exportado en JSON se sobrescribirá.',
      confirmText: 'Restablecer Demo',
      cancelText: 'Volver',
      severity: 'warning'
    });
    if (confirmed) {
      this.projectService.resetToDemo();
      this.showProjectsModal.set(false);
      this.showToast('Mueble demo restablecido');
    }
  }

  exportJson() {
    this.projectService.downloadProjectJson();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = e => {
        const content = e.target?.result as string;
        if (content) {
          const success = this.projectService.importProjectFromJson(content);
          if (success) {
            this.showToast('¡Proyecto importado exitosamente!');
            this.showProjectsModal.set(false);
          } else {
            this.showToast('Error: El archivo no tiene el formato válido de Piezo3D Studio.');
          }
        }
      };
      reader.readAsText(file);
    }
  }

  openTechnicalSheet() {
    this.showTechnicalSheetModal.set(true);
  }

  closeTechnicalSheet() {
    this.showTechnicalSheetModal.set(false);
  }

  openDocumentationModal() {
    this.closeDropdowns();
    this.showDocumentationModal.set(true);
  }

  closeDocumentationModal() {
    this.showDocumentationModal.set(false);
  }

  openChangelogModal() {
    this.closeDropdowns();
    this.showChangelogModal.set(true);
  }

  closeChangelogModal() {
    this.showChangelogModal.set(false);
  }

  exportDxf() {
    this.dxfExporter.exportProjectToDxf(this.project());
    this.showToast('📐 Archivo DXF para CNC generado y descargado');
  }
}