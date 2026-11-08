import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectNotesModalComponent } from './project-notes-modal';
import { I18nService } from '../../services/i18n.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ThemeService } from '../../services/theme.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

describe('ProjectNotesModalComponent', () => {
  let component: ProjectNotesModalComponent;
  let fixture: ComponentFixture<ProjectNotesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectNotesModalComponent],
      providers: [
        I18nService,
        ProjectStorageService,
        ThemeService,
        ConfirmDialogService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectNotesModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('el formulario debe ser invalido por defecto cuando titulo y contenido estan vacios', () => {
    component.openNewNoteForm();
    fixture.detectChanges();

    expect(component.noteForm.invalid).toBe(true);
    expect(component.noteForm.get('title')?.invalid).toBe(true);
    expect(component.noteForm.get('content')?.invalid).toBe(true);
  });

  it('el formulario debe ser valido cuando se ingresan titulo y contenido', () => {
    component.openNewNoteForm();
    component.noteForm.patchValue({
      title: 'Verificar bisagras de cierre suave',
      content: 'Instalar modelo Blum 110 con freno integrado',
      category: 'pending'
    });
    fixture.detectChanges();

    expect(component.noteForm.valid).toBe(true);
  });

  it('debe mostrar el micro-texto de ayuda adecuado según los campos vacíos', () => {
    component.openNewNoteForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Ambos vacíos
    expect(compiled.textContent).toContain('Ingresa un título y el contenido para habilitar el guardado');

    // Solo título
    component.noteForm.patchValue({ title: 'Nota de Prueba' });
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Ingresa el detalle o contenido para habilitar el guardado');

    // Solo contenido
    component.noteForm.patchValue({ title: '', content: '<p>Detalles</p>' });
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Ingresa el título de la nota para habilitar el guardado');

    // Ambos completos -> el micro-texto desaparece
    component.noteForm.patchValue({ title: 'Nota Completa', content: '<p>Detalles</p>' });
    fixture.detectChanges();
    expect(compiled.textContent).not.toContain('para habilitar el guardado');
  });

  it('debe filtrar las notas por categoria activa', () => {
    component.activeFilter.set('pending');
    expect(component.activeFilter()).toBe('pending');
    component.activeFilter.set('all');
    expect(component.activeFilter()).toBe('all');
  });
});
