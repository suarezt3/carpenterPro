import { ChangeDetectionStrategy, Component, inject, signal, output, input } from '@angular/core';
import { ProjectStorageService, ProjectMeta } from '../../services/project-storage.service';
import { ProjectSettings } from '../../models/melamine.models';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './header.html'
})
export class HeaderComponent {
  private projectService = inject(ProjectStorageService);
  private fb = inject(FormBuilder);

  activeTab = input<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>('modules');
  tabChanged = output<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>();

  showProjectsModal = signal(false);
  showSettingsModal = signal(false);
  showNewProjectModal = signal(false);

  readonly project = this.projectService.currentProject;
  readonly savedProjects = this.projectService.savedProjects;
  readonly partsCount = this.projectService.totalPartsCount;

  newProjectForm: FormGroup = this.fb.group({
    name: ['Nuevo Mueble de Cocina', Validators.required],
    clientName: ['']
  });

  settingsForm: FormGroup = this.fb.group({
    sawKerf: [4, [Validators.required, Validators.min(0)]],
    trimMargin: [10, [Validators.required, Validators.min(0)]],
    thinEdgeThickness: [0.45, [Validators.required, Validators.min(0)]],
    thickEdgeThickness: [2.0, [Validators.required, Validators.min(0)]],
    thinEdgeCostPerMeter: [0.40, [Validators.required, Validators.min(0)]],
    thickEdgeCostPerMeter: [1.10, [Validators.required, Validators.min(0)]],
    currency: ['USD', Validators.required],
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
    }
  }

  loadProject(meta: ProjectMeta) {
    this.projectService.loadProjectById(meta.id);
    this.showProjectsModal.set(false);
  }

  resetDemo() {
    if (confirm('¿Restablecer el proyecto de demostración (Cocina Roble & Blanco)? Los cambios no exportados se sobrescribirán.')) {
      this.projectService.resetToDemo();
      this.showProjectsModal.set(false);
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
            alert('¡Proyecto cargado exitosamente!');
            this.showProjectsModal.set(false);
          } else {
            alert('Error: El archivo seleccionado no tiene el formato válido de MelamiPro.');
          }
        }
      };
      reader.readAsText(file);
    }
  }
}
