import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectStorageService } from '../../services/project-storage.service';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ModuleDesignerComponent } from './module-designer';
import { Part } from '../../models/melamine.models';

interface ViewerInitHandle {
  initThree: () => void;
}

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function buildTestPart(overrides: Partial<Part> = {}): Part {
  return {
    id: overrides.id ?? 'part-test-1',
    name: overrides.name ?? 'PIEZA LIBRE',
    length: overrides.length ?? 800,
    width: overrides.width ?? 500,
    thickness: overrides.thickness ?? 18,
    quantity: overrides.quantity ?? 1,
    materialId: overrides.materialId ?? 'mat_white_18',
    materialName: overrides.materialName ?? 'Melamina Blanco 18mm',
    grain: overrides.grain ?? 'length',
    edges: overrides.edges ?? { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: overrides.posX ?? 0,
    posY: overrides.posY ?? 400,
    posZ: overrides.posZ ?? 0,
    orientation: overrides.orientation ?? 'vertical_yz',
    componentRole: overrides.componentRole ?? 'free',
    ...overrides
  };
}

describe('ModuleDesigner: Quick-Role Selector Pills, hasCustomName & Barra Flotante', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let projectService: ProjectStorageService;

  beforeEach(async () => {
    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitHandle,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [ProjectStorageService]
    }).compileComponents();

    projectService = TestBed.inject(ProjectStorageService);
    projectService.clearFurniture();

    fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('debe exponer los 9 presets exactos en quickRolePresets desde Lateral Izq. hasta Zócalo', () => {
    expect(component.quickRolePresets).toEqual([
      { label: 'Lateral Izq.', partName: 'LATERAL IZQUIERDO', role: 'side_left' },
      { label: 'Lateral Der.', partName: 'LATERAL DERECHO', role: 'side_right' },
      { label: 'Tapa / Cubierta', partName: 'TAPA SUPERIOR', role: 'top' },
      { label: 'Piso / Base', partName: 'PISO INFERIOR', role: 'bottom' },
      { label: 'Entrepaño', partName: 'ENTREPAÑO', role: 'shelf' },
      { label: 'División', partName: 'DIVISIÓN VERTICAL', role: 'divider' },
      { label: 'Amarre', partName: 'AMARRE TRASERO', role: 'tie' },
      { label: 'Fondo', partName: 'FONDO TRASERO', role: 'back' },
      { label: 'Zócalo', partName: 'ZÓCALO FRONTAL', role: 'plinth' }
    ]);
  });

  it('applyQuickRoleToPart debe actualizar nombre, componentRole, hasCustomName: true y limpiar renamingPartId', () => {
    const part = buildTestPart({
      id: 'qr-part-1',
      name: 'Tablero Libre 1',
      componentRole: 'free',
      hasCustomName: false
    });
    projectService.updateProject(p => ({ ...p, parts: [part] }), false);
    component.selectedPartId.set(part.id);
    component.selectedPartIds.set([part.id]);
    component.startRenameSelectedPart();

    expect(component.renamingPartId()).toBe(part.id);

    const stopPropagation = vi.fn();
    const mockEvent = { stopPropagation } as unknown as MouseEvent;
    const preset = component.quickRolePresets[1]; // Lateral Der.

    component.applyQuickRoleToPart(part.id, preset, mockEvent);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(component.renamingPartId()).toBeNull();
    expect(component.renamingPartName()).toBe('');

    const updated = projectService.partsList().find(p => p.id === part.id);
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('LATERAL DERECHO');
    expect(updated!.componentRole).toBe('side_right');
    expect(updated!.hasCustomName).toBe(true);

    expect(component.selectedPart()?.name).toBe('LATERAL DERECHO');
    expect(component.selectedPart()?.componentRole).toBe('side_right');
    expect(component.toastMessage()).toContain('Rol asignado: "LATERAL DERECHO"');
    expect(EMOJI_REGEX.test(component.toastMessage() || '')).toBe(false);
  });

  it('saveRenamePart debe preservar !hasCustomName si el nombre no cambia y marcar hasCustomName: true al editarlo', () => {
    const autoPart = buildTestPart({
      id: 'rename-part-1',
      name: 'LATERAL IZQUIERDO',
      componentRole: 'side_left',
      hasCustomName: false
    });
    const otherPart = buildTestPart({
      id: 'rename-part-2',
      name: 'PISO INFERIOR',
      componentRole: 'bottom',
      posX: 0,
      posY: 9,
      orientation: 'horizontal'
    });
    projectService.updateProject(p => ({ ...p, parts: [autoPart, otherPart] }), false);

    // 1. Guardar sin cambiar el texto conserva !hasCustomName
    component.startRenamePart(autoPart);
    component.saveRenamePart(autoPart.id);

    expect(component.renamingPartId()).toBeNull();
    expect(component.renamingPartName()).toBe('');
    const unchanged = projectService.partsList().find(p => p.id === autoPart.id);
    expect(unchanged?.name).toBe('LATERAL IZQUIERDO');
    expect(Boolean(unchanged?.hasCustomName)).toBe(false);

    // 2. Rechazar duplicado sin sobrescribir ni emitir emojis
    component.startRenamePart(autoPart);
    component.renamingPartName.set('PISO INFERIOR');
    component.saveRenamePart(autoPart.id);

    expect(component.renamingPartId()).toBe(autoPart.id);
    expect(projectService.partsList().find(p => p.id === autoPart.id)?.name).toBe('LATERAL IZQUIERDO');
    expect(EMOJI_REGEX.test(component.toastMessage() || '')).toBe(false);

    // 3. Guardar nombre distinto marca hasCustomName = true y limpia señales
    component.renamingPartName.set('Costado Izquierdo TV');
    component.saveRenamePart(autoPart.id);

    expect(component.renamingPartId()).toBeNull();
    expect(component.renamingPartName()).toBe('');
    const renamed = projectService.partsList().find(p => p.id === autoPart.id);
    expect(renamed?.name).toBe('Costado Izquierdo TV');
    expect(renamed?.hasCustomName).toBe(true);
    expect(component.toastMessage()).toContain('Costado Izquierdo TV');
    expect(EMOJI_REGEX.test(component.toastMessage() || '')).toBe(false);
  });

  it('updateSelectedPartManualName debe marcar hasCustomName: true para nombres no vacíos', () => {
    const part = buildTestPart({
      id: 'manual-part-1',
      name: 'TAPA SUPERIOR',
      componentRole: 'top',
      orientation: 'horizontal',
      hasCustomName: false
    });
    projectService.updateProject(p => ({ ...p, parts: [part] }), false);
    component.selectedPartId.set(part.id);
    component.selectedPartIds.set([part.id]);

    component.updateSelectedPartManualName('Cubierta Barra Desayuno');

    const updated = component.selectedPart();
    expect(updated?.name).toBe('Cubierta Barra Desayuno');
    expect(updated?.hasCustomName).toBe(true);

    component.updateSelectedPartManualName('   ');
    const cleared = component.selectedPart();
    expect(cleared?.hasCustomName).toBe(false);
  });

  it('selectedPart() debe reflejar reactivamente las actualizaciones semánticas desde ProjectStorageService', () => {
    component.addPieceFromCatalog('side_left');
    const firstSide = component.selectedPart();
    expect(firstSide).not.toBeNull();
    expect(firstSide!.componentRole).toBe('side_left');
    expect(Boolean(firstSide!.hasCustomName)).toBe(false);

    // Al duplicar el lateral, el motor semántico nombra la copia como LATERAL DERECHO
    component.duplicateSelectedPart();
    const duplicated = component.selectedPart();
    expect(duplicated).not.toBeNull();
    expect(duplicated!.id).not.toBe(firstSide!.id);
    expect(duplicated!.name).toBe('LATERAL DERECHO');
    expect(duplicated!.componentRole).toBe('side_right');
    expect(Boolean(duplicated!.hasCustomName)).toBe(false);

    // Asignación directa en el servicio se refleja reactivamente en selectedPart()
    projectService.assignPartQuickRole(duplicated!.id, 'divider', 'DIVISIÓN VERTICAL');
    expect(component.selectedPart()?.name).toBe('DIVISIÓN VERTICAL');
    expect(component.selectedPart()?.componentRole).toBe('divider');
    expect(component.selectedPart()?.hasCustomName).toBe(true);
  });

  it('la barra flotante y el inspector deben renderizar las 9 pastillas en Inter, aplicar rol en 1 clic y registrar edición manual', () => {
    const part = buildTestPart({
      id: 'dom-part-1',
      name: 'LATERAL IZQUIERDO',
      componentRole: 'side_left',
      hasCustomName: false
    });
    projectService.updateProject(p => ({ ...p, parts: [part] }), false);
    component.selectedPartId.set(part.id);
    component.selectedPartIds.set([part.id]);
    component.activeDockTab.set('piece');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.md-quick-role-strip')).toBeNull();

    const editBtn = host.querySelector<HTMLButtonElement>(
      'button[title="Renombrar esta pieza o asignar rol rápido"]'
    );
    expect(editBtn).not.toBeNull();
    editBtn!.click();
    fixture.detectChanges();

    const strip = host.querySelector<HTMLElement>('.md-quick-role-strip');
    expect(strip).not.toBeNull();
    expect(strip!.textContent).toContain('Rol rápido:');
    expect(strip!.classList.contains('font-mono')).toBe(false);

    const pills = Array.from(strip!.querySelectorAll<HTMLButtonElement>('.md-quick-role-pill'));
    expect(pills.map(b => b.textContent?.trim())).toEqual([
      'Lateral Izq.',
      'Lateral Der.',
      'Tapa / Cubierta',
      'Piso / Base',
      'Entrepaño',
      'División',
      'Amarre',
      'Fondo',
      'Zócalo'
    ]);

    for (const pill of pills) {
      expect(pill.classList.contains('font-mono')).toBe(false);
      expect(pill.classList.contains('font-sans')).toBe(true);
    }

    // Pastilla activa resaltada en Azul Acero (border-sky-500 / text-sky-300)
    const activePill = pills[0];
    expect(activePill.classList.contains('border-sky-500')).toBe(true);
    expect(activePill.classList.contains('text-sky-300')).toBe(true);

    // Clic en "Tapa / Cubierta" aplica rol y cierra la tira
    const topPill = pills[2];
    expect(topPill.classList.contains('border-zinc-700')).toBe(true);
    topPill.click();
    fixture.detectChanges();

    expect(host.querySelector('.md-quick-role-strip')).toBeNull();
    expect(component.selectedPart()?.name).toBe('TAPA SUPERIOR');
    expect(component.selectedPart()?.componentRole).toBe('top');
    expect(component.selectedPart()?.hasCustomName).toBe(true);

    // Edición manual desde el inspector derecho marca hasCustomName = true
    const manualInput = host.querySelector<HTMLInputElement>(
      'input[aria-label="Nombre de la pieza"]'
    );
    expect(manualInput).not.toBeNull();
    expect(manualInput!.value).toBe('TAPA SUPERIOR');

    manualInput!.value = 'Estante Maestro';
    manualInput!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedPart()?.name).toBe('Estante Maestro');
    expect(component.selectedPart()?.hasCustomName).toBe(true);
  });
});
