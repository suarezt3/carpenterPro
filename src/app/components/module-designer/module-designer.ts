import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProjectStorageService } from '../../services/project-storage.service';
import {
  ComponentRole,
  EdgeBandingType,
  Part,
  PartOrientation,
  DrillHole
} from '../../models/melamine.models';
import { Furniture3dViewerComponent, ClearanceInfo } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { TechnicalSheetModalComponent } from '../technical-sheet-modal/technical-sheet-modal';
import { TemplatesModalComponent } from '../templates-modal/templates-modal';
import { FurnitureTemplate } from '../../services/templates-catalog.service';

@Component({
  selector: 'app-module-designer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Furniture3dViewerComponent, TechnicalSheetModalComponent, TemplatesModalComponent],
  templateUrl: './module-designer.html'
})
export class ModuleDesignerComponent {
  private projectService = inject(ProjectStorageService);
  private confirmService = inject(ConfirmDialogService);
  private joineryEngine = inject(JoineryEngineService);
  private dxfExporter = inject(DxfExporterService);

  readonly project = this.projectService.currentProject;
  readonly materials = this.projectService.materialsList;
  readonly currentParts = this.projectService.partsList;

  // Selected Part ID in 3D
  readonly selectedPartId = signal<string | null>(null);
  // Selected Multiple Part IDs in 3D (Shift-Click or Select All)
  readonly selectedPartIds = signal<string[]>([]);
  // Dynamic Clearance Info from 3D (Luz libre a elementos adyacentes)
  readonly clearanceInfo = signal<ClearanceInfo | null>(null);

  // Technical Shop Sheet Modal
  readonly showTechnicalSheetModal = signal<boolean>(false);

  // Active dock tab: 'piece' (properties of selected part) or 'catalog' (add pieces & tree)
  readonly activeDockTab = signal<'piece' | 'catalog'>('catalog');

  // Sidebar collapse toggle for 100% full-screen 3D modeling
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly showTemplatesDropdown = signal<boolean>(false);
  readonly showTemplatesModal = signal<boolean>(false);

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  openTemplatesModal() {
    this.showTemplatesDropdown.set(false);
    this.showTemplatesModal.set(true);
  }

  closeTemplatesModal() {
    this.showTemplatesModal.set(false);
  }

  toggleTemplatesDropdown() {
    this.showTemplatesDropdown.update(v => !v);
  }

  closeTemplatesDropdown() {
    this.showTemplatesDropdown.set(false);
  }

  readonly joineryData = computed(() => {
    return this.joineryEngine.calculateJoinery(this.currentParts());
  });

  // Drill holes for the currently selected part
  readonly selectedPartDrillHoles = computed<DrillHole[]>(() => {
    const sel = this.selectedPart();
    if (!sel) return [];
    return this.joineryData().drillHolesByPart.get(sel.id) || [];
  });

  // Computed selected part
  readonly selectedPart = computed<Part | null>(() => {
    const id = this.selectedPartId();
    if (!id) return null;
    return this.currentParts().find(p => p.id === id) || null;
  });

  // Computed multiple selected parts
  readonly selectedPartsList = computed<Part[]>(() => {
    const ids = this.selectedPartIds();
    return this.currentParts().filter(p => ids.includes(p.id));
  });

  // Total square meters computed
  readonly totalAreaM2 = computed(() => {
    const parts = this.currentParts();
    const sumMm2 = parts.reduce((acc, p) => acc + (p.length * p.width * p.quantity), 0);
    return (sumMm2 / 1_000_000).toFixed(2);
  });

  constructor() {
    // If project has parts, auto-select first part or 'desk_top' if present
    const parts = this.currentParts();
    if (parts.length > 0) {
      const topPart = parts.find(p => p.name.toUpperCase().includes('TECHO') || p.id === 'desk_top') || parts[0];
      this.selectedPartId.set(topPart.id);
      this.selectedPartIds.set([topPart.id]);
      this.activeDockTab.set('piece');
    }
  }

  // --- SELECTION ---

  onSelectPartFrom3D(part: Part | null) {
    if (part) {
      this.selectedPartId.set(part.id);
      this.activeDockTab.set('piece');
    } else {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
    }
  }

  onPartsSelectedFrom3D(partIds: string[]) {
    this.selectedPartIds.set(partIds);
    if (partIds.length > 0) {
      this.selectedPartId.set(partIds[0]);
      this.activeDockTab.set('piece');
    } else {
      this.selectedPartId.set(null);
    }
  }

  selectAllParts() {
    const all = this.currentParts().map(p => p.id);
    this.selectedPartIds.set(all);
    if (all.length > 0) {
      this.selectedPartId.set(all[0]);
    }
  }

  deselectAll() {
    this.selectedPartId.set(null);
    this.selectedPartIds.set([]);
    this.activeDockTab.set('catalog');
  }

  isPartSelected(id: string): boolean {
    return this.selectedPartId() === id || this.selectedPartIds().includes(id);
  }

  onChipClick(id: string, event: MouseEvent) {
    this.selectPartById(id, event);
  }

  selectPartById(id: string, e?: MouseEvent) {
    if (e && e.shiftKey) {
      const cur = [...this.selectedPartIds()];
      const idx = cur.indexOf(id);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(id);
      this.selectedPartIds.set(cur);
      this.selectedPartId.set(cur.length > 0 ? cur[0] : null);
    } else {
      this.selectedPartId.set(id);
      this.selectedPartIds.set([id]);
      this.activeDockTab.set('piece');
    }
  }

  deselectPart() {
    this.deselectAll();
  }

  // --- PIECE EDITING (Real-time single & group manipulation) ---

  updateSelectedPart(changes: Partial<Part>) {
    const current = this.selectedPart();
    if (!current) return;

    const updated: Part = {
      ...current,
      ...changes
    };
    this.projectService.updatePart(updated);
  }

  // Called when starting a 3D gizmo translation or stretch drag
  onDragStarted() {
    this.projectService.pushSnapshot();
  }

  // Receives real-time 3D translation & stretch changes directly from the 3D Viewer Gizmo or context menu
  onPartModifiedFromViewer(event: { part: Part; updates: Partial<Part> }) {
    const targetPart = this.currentParts().find(p => p.id === event.part.id) || event.part;
    const updated: Part = {
      ...targetPart,
      ...event.updates
    };
    this.projectService.updatePart(updated, false);
  }

  // Receives synchronized multi-part translation changes from group gizmo
  onMultiplePartsModifiedFromViewer(event: { updates: { part: Part; updates: Partial<Part> }[] }) {
    const updatesList = event.updates.map(u => ({ partId: u.part.id, updates: u.updates }));
    this.projectService.updateMultipleParts(updatesList, false);
  }

  // Receives newly drawn piece from 3D Rectangle Tool
  onPartCreatedFromViewer(partData: Partial<Part>) {
    const defaultMat = this.materials()[0];
    const newPart: Part = {
      id: crypto.randomUUID(),
      name: partData.name || `Pieza ${this.currentParts().length + 1}`,
      length: partData.length || 600,
      width: partData.width || 400,
      thickness: partData.thickness || (defaultMat ? defaultMat.thickness : 18),
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Blanca 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: partData.posX ?? 0,
      posY: partData.posY ?? 9,
      posZ: partData.posZ ?? 0,
      orientation: partData.orientation || 'horizontal',
      componentRole: 'free'
    };
    this.projectService.addPart(newPart);
    this.selectedPartId.set(newPart.id);
    this.selectedPartIds.set([newPart.id]);
    this.activeDockTab.set('piece');
  }

  onPartDeletedFromViewer(partId: string) {
    this.projectService.deletePart(partId);
    if (this.selectedPartId() === partId) {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
    }
  }

  onPartDuplicatedFromViewer(part: Part) {
    const cloned = this.projectService.duplicatePart(part.id);
    if (cloned) {
      this.selectedPartId.set(cloned.id);
      this.selectedPartIds.set([cloned.id]);
      this.activeDockTab.set('piece');
    }
  }

  // Sets material and automatically synchronizes the matching thickness & name
  onMaterialChange(matId: string) {
    const mat = this.materials().find(m => m.id === matId);
    if (!mat) return;
    this.updateSelectedPart({
      materialId: mat.id,
      materialName: mat.name,
      thickness: mat.thickness
    });
  }

  // Quick thickness buttons that match or adapt the project material seamlessly
  onThicknessChange(thickness: number) {
    const matchingMat = this.materials().find(m => m.thickness === thickness);
    if (matchingMat) {
      this.updateSelectedPart({
        thickness,
        materialId: matchingMat.id,
        materialName: matchingMat.name
      });
    } else {
      this.updateSelectedPart({ thickness });
    }
  }

  adjustPartProperty(prop: 'length' | 'width' | 'thickness' | 'posX' | 'posY' | 'posZ', delta: number) {
    const current = this.selectedPart();
    if (!current) return;

    const currentVal = Number(current[prop] ?? 0);
    const newVal = Math.max(prop === 'length' || prop === 'width' || prop === 'thickness' ? 10 : -3000, currentVal + delta);
    this.updateSelectedPart({ [prop]: newVal });
  }

  togglePartEdge(edgeKey: 'l1' | 'l2' | 'a1' | 'a2') {
    const current = this.selectedPart();
    if (!current) return;

    const cycle: Record<EdgeBandingType, EdgeBandingType> = {
      none: 'thin',
      thin: 'thick',
      thick: 'none'
    };

    const nextVal = cycle[current.edges[edgeKey]];
    this.updateSelectedPart({
      edges: {
        ...current.edges,
        [edgeKey]: nextVal
      }
    });
  }

  setPartOrientation(orientation: PartOrientation) {
    this.updateSelectedPart({ orientation });
  }

  alignPart(preset: 'floor' | 'centerX' | 'centerZ' | 'top') {
    const current = this.selectedPart();
    if (!current) return;

    const t = current.thickness || 18;
    const L = current.length;
    const orientation = current.orientation || 'horizontal';

    let sy = t;
    if (orientation === 'vertical_yz') {
      sy = L;
    } else if (orientation === 'vertical_xy') {
      sy = current.width;
    }

    switch (preset) {
      case 'floor':
        this.updateSelectedPart({ posY: sy / 2 });
        break;
      case 'centerX':
        this.updateSelectedPart({ posX: 0 });
        break;
      case 'centerZ':
        this.updateSelectedPart({ posZ: 0 });
        break;
      case 'top':
        this.updateSelectedPart({ posY: 1000 - sy / 2 });
        break;
    }
  }

  duplicateSelectedPart() {
    const selId = this.selectedPartId();
    if (!selId) return;

    const cloned = this.projectService.duplicatePart(selId);
    if (cloned) {
      this.selectedPartId.set(cloned.id);
    }
  }

  async deleteSelectedPart() {
    const selIds = this.selectedPartIds();
    const selId = this.selectedPartId();
    if (selIds.length > 1) {
      const confirmed = await this.confirmService.ask({
        title: `¿Eliminar ${selIds.length} piezas seleccionadas?`,
        message: 'Se eliminarán del modelo 3D todas las piezas seleccionadas actualmente en grupo. Puedes deshacer esta acción con el botón Deshacer o Ctrl+Z.',
        confirmText: `Eliminar ${selIds.length} piezas`,
        cancelText: 'Cancelar',
        severity: 'danger'
      });
      if (!confirmed) return;
      for (const id of selIds) {
        this.projectService.deletePart(id);
      }
      this.selectedPartIds.set([]);
      this.selectedPartId.set(null);
      this.activeDockTab.set('catalog');
      return;
    }

    if (!selId) return;
    const part = this.currentParts().find(p => p.id === selId);
    const partName = part ? `"${part.name}"` : 'la pieza';
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar pieza del despiece?',
      message: `Se eliminará ${partName} del modelo 3D y del listado de corte. Puedes deshacer esta acción si lo necesitas.`,
      confirmText: 'Eliminar Pieza',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (!confirmed) return;

    this.projectService.deletePart(selId);
    const remaining = this.currentParts().filter(p => p.id !== selId);
    if (remaining.length > 0) {
      this.selectedPartId.set(remaining[0].id);
    } else {
      this.selectedPartId.set(null);
      this.activeDockTab.set('catalog');
    }
  }

  async deletePartById(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const part = this.currentParts().find(p => p.id === id);
    const partName = part ? `"${part.name}"` : 'la pieza';
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar pieza del despiece?',
      message: `Se eliminará ${partName} del modelo 3D y de los cálculos del mueble.`,
      confirmText: 'Eliminar Pieza',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (!confirmed) return;

    this.projectService.deletePart(id);
    if (this.selectedPartId() === id) {
      this.selectedPartId.set(null);
      this.activeDockTab.set('catalog');
    }
  }

  // --- CATALOG: ADD PIECES INDIVIDUALLY ---

  addPieceFromCatalog(role: ComponentRole) {
    const mats = this.materials();
    const mainMat = mats.find(m => m.hasGrain) || mats[0];
    const whiteMat = mats.find(m => !m.hasGrain && m.thickness >= 15) || mats[0];
    const mdfMat = mats.find(m => m.thickness <= 6) || mats[0];

    const defaultT = 18;
    let newPart: Part;

    const currentParts = this.currentParts();
    // Approximate reference bounds
    const maxTopY = currentParts.reduce((max, p) => Math.max(max, (p.posY ?? 0) + (p.thickness || 18)), 850);

    switch (role) {
      case 'top':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'TECHO / CUBIERTA',
          length: 1800,
          width: 600,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: 0,
          posY: maxTopY > 100 ? maxTopY + defaultT / 2 : 900,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'top'
        };
        break;

      case 'side_left':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'LATERAL IZQUIERDO',
          length: 850,
          width: 580,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
          posX: -400,
          posY: 425,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'side_left'
        };
        break;

      case 'side_right':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'LATERAL DERECHO',
          length: 850,
          width: 580,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
          posX: 400,
          posY: 425,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'side_right'
        };
        break;

      case 'bottom':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'PISO INFERIOR',
          length: 764,
          width: 580,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 80 + defaultT / 2,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'bottom'
        };
        break;

      case 'divider':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'DIVISIÓN VERTICAL',
          length: 750,
          width: 560,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 450,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'divider'
        };
        break;

      case 'shelf':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'REPISA INTERNA',
          length: 764,
          width: 560,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 450,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'shelf'
        };
        break;

      case 'back':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'FONDO POSTERIOR (MDF)',
          length: 796,
          width: 766,
          thickness: 3,
          quantity: 1,
          materialId: mdfMat.id,
          materialName: mdfMat.name,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 470,
          posZ: -285,
          orientation: 'vertical_xy',
          componentRole: 'back'
        };
        break;

      case 'door':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'PUERTA BATIENTE',
          length: 395,
          width: 760,
          thickness: defaultT,
          quantity: 1,
          materialId: whiteMat.id,
          materialName: whiteMat.name,
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: -200,
          posY: 470,
          posZ: 295,
          orientation: 'vertical_xy',
          componentRole: 'door'
        };
        break;

      case 'drawer_front':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'FRENTE DE CAJÓN',
          length: 794,
          width: 185,
          thickness: defaultT,
          quantity: 1,
          materialId: whiteMat.id,
          materialName: whiteMat.name,
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: 0,
          posY: 180,
          posZ: 295,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front'
        };
        break;

      case 'plinth':
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'ZÓCALO FRONTAL',
          length: 764,
          width: 80,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 40,
          posZ: 250,
          orientation: 'vertical_xy',
          componentRole: 'plinth'
        };
        break;

      default: // free
        newPart = {
          id: 'part_' + crypto.randomUUID().slice(0, 8),
          name: 'PIEZA PERSONALIZADA',
          length: 600,
          width: 400,
          thickness: defaultT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 400,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'free'
        };
        break;
    }

    this.projectService.addPart(newPart);
    this.selectedPartId.set(newPart.id);
    this.activeDockTab.set('piece');
  }

  onClearanceCalculated(info: ClearanceInfo | null) {
    this.clearanceInfo.set(info);
  }

  // --- ACTIONS: START BLANK OR LOAD TEMPLATES ---

  async startBlank() {
    if (this.currentParts().length > 0) {
      const confirmed = await this.confirmService.ask({
        title: '¿Limpiar lienzo 3D?',
        message: 'Se eliminarán todas las piezas del modelo actual para comenzar un mueble desde cero. Puedes deshacer esta acción inmediatamente con el botón Deshacer o Ctrl+Z.',
        confirmText: 'Limpiar Todo',
        cancelText: 'Cancelar',
        severity: 'warning'
      });
      if (!confirmed) return;
    }
    this.projectService.clearFurniture();
    this.selectedPartId.set(null);
    this.selectedPartIds.set([]);
    this.clearanceInfo.set(null);
    this.activeDockTab.set('catalog');
  }

  onTemplateSelected(event: { template: FurnitureTemplate; mode: 'replace' | 'append' }) {
    this.projectService.loadTemplateFurniture(event.template, event.mode);
    const parts = this.currentParts();
    if (parts.length > 0) {
      const top = parts.find(p => p.name.toUpperCase().includes('TECHO') || p.name.toUpperCase().includes('TAPA') || p.name.toUpperCase().includes('ENCIMERA')) || parts[0];
      this.selectedPartId.set(top.id);
      this.selectedPartIds.set([top.id]);
      this.activeDockTab.set('piece');
    }
  }

  loadDeskBarTemplate() {
    this.projectService.loadDeskBarFurniture();
    const parts = this.currentParts();
    const top = parts.find(p => p.id === 'desk_top') || parts[0];
    if (top) {
      this.selectedPartId.set(top.id);
      this.activeDockTab.set('piece');
    }
  }

  loadStandardBaseCabinet() {
    this.projectService.resetToDemo();
    const parts = this.currentParts();
    if (parts.length > 0) {
      this.selectedPartId.set(parts[0].id);
      this.activeDockTab.set('piece');
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
  }
}
