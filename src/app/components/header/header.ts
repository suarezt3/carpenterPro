import { ChangeDetectionStrategy, Component, inject, signal, output, input } from '@angular/core';
import { ProjectStorageService, ProjectMeta } from '../../services/project-storage.service';
import { CloudProjectRecord } from '../../services/supabase.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { TechnicalSheetModalComponent } from '../technical-sheet-modal/technical-sheet-modal';
import { ProjectSettings } from '../../models/melamine.models';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SlicePipe } from '@angular/common';

import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SlicePipe, TechnicalSheetModalComponent],
  host: {
    '(window:keydown)': 'handleGlobalKeyDown($event)'
  },
  templateUrl: './header.html'
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);
  private projectService = inject(ProjectStorageService);
  private confirmService = inject(ConfirmDialogService);
  private dxfExporter = inject(DxfExporterService);
  private fb = inject(FormBuilder);

  activeTab = input<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>('modules');
  tabChanged = output<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>();

  showProjectsModal = signal(false);
  showSettingsModal = signal(false);
  showNewProjectModal = signal(false);
  showSqlModal = signal(false);
  showTechnicalSheetModal = signal(false);
  projectsTab = signal<'cloud' | 'local'>('cloud');
  sqlCopied = signal(false);
  toastMessage = signal<string | null>(null);
  readonly showLabelsTab = signal(false);

  readonly project = this.projectService.currentProject;
  readonly savedProjects = this.projectService.savedProjects;
  readonly partsCount = this.projectService.totalPartsCount;
  readonly supabase = this.projectService.supabase;
  readonly cloudProjects = this.supabase.cloudProjects;
  readonly syncStatus = this.supabase.syncStatus;
  readonly lastSyncTime = this.supabase.lastSyncTime;

  // History & cloud controls
  readonly canUndo = this.projectService.canUndo;
  readonly canRedo = this.projectService.canRedo;
  readonly autoSyncEnabled = this.projectService.autoSyncEnabled;

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  newProjectForm: FormGroup = this.fb.group({
    name: ['Nuevo Mueble de Cocina', Validators.required],
    clientName: ['']
  });

  settingsForm: FormGroup = this.fb.group({
    sawKerf: [4, [Validators.required, Validators.min(0)]],
    trimMargin: [10, [Validators.required, Validators.min(0)]],
    thinEdgeThickness: [0.45, [Validators.required, Validators.min(0)]],
    thickEdgeThickness: [2.0, [Validators.required, Validators.min(0)]],
    thinEdgeCostPerMeter: [1800, [Validators.required, Validators.min(0)]],
    thickEdgeCostPerMeter: [4200, [Validators.required, Validators.min(0)]],
    currency: ['COP', Validators.required],
    optimizationPreference: ['best_fit', Validators.required]
  });

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

  // --- UNDO / REDO & SHORTCUTS ---
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
      this.showToast('💾 Auto-guardado DESACTIVADO (Solo guardado manual)');
    }
  }

  handleGlobalKeyDown(e: KeyboardEvent) {
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

  // --- CLOUD SUPABASE ACTIONS ---
  async saveCurrentToCloud() {
    this.showToast('Guardando en Supabase...');
    const res = await this.projectService.saveCurrentToCloud();
    if (res.success) {
      this.showToast('☁️ ¡Proyecto guardado en la nube exitosamente!');
    } else if (res.error === 'table_needed') {
      this.showSqlModal.set(true);
    } else {
      this.showToast('Aviso: Guardado localmente. Supabase reportó: ' + (res.error || 'Verifica la tabla'));
    }
  }

  loadCloudProject(item: CloudProjectRecord) {
    this.projectService.loadCloudProject(item);
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
    this.supabase.refreshProjects();
    this.showToast('Actualizando proyectos de Supabase...');
  }

  copySqlScript() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.supabase.getSqlSetupScript());
      this.sqlCopied.set(true);
      setTimeout(() => this.sqlCopied.set(false), 3000);
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3500);
  }

  // --- LOCAL ACTIONS ---
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
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          const success = this.projectService.importProjectFromJson(content);
          if (success) {
            this.showToast('¡Proyecto importado exitosamente!');
            this.showProjectsModal.set(false);
          } else {
            this.showToast('Error: El archivo no tiene el formato válido de MelamiPro.');
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

  exportDxf() {
    this.dxfExporter.exportProjectToDxf(this.project());
    this.showToast('📐 Archivo DXF para CNC generado y descargado');
  }
}
