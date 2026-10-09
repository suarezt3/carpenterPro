import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProjectStorageService } from '../../services/project-storage.service';
import {
  ComponentRole,
  EdgeBandingType,
  Material,
  Part,
  PartGroup,
  ParametricDrawerConfig,
  PartOrientation,
  DrillHole,
  PartHardwareConfig
} from '../../models/melamine.models';
import { Furniture3dViewerComponent, ClearanceInfo } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { TechnicalSheetModalComponent } from '../technical-sheet-modal/technical-sheet-modal';
import { FurnitureTemplate } from '../../services/templates-catalog.service';

@Component({
  selector: 'app-module-designer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Furniture3dViewerComponent, TechnicalSheetModalComponent],
  templateUrl: './module-designer.html',
  host: {
    '(window:keydown)': 'handleGlobalKeyDown($event)'
  }
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

  // Groups / Cajones Modulares
  readonly groups = this.projectService.groupsList;

  // Grupos con sus piezas asociadas
  readonly groupsWithParts = computed(() => {
    const grps = this.groups();
    const parts = this.currentParts();
    return grps
      .map(g => ({
        group: g,
        parts: parts.filter(p => p.groupId === g.id)
      }))
      .filter(item => item.parts.length > 0);
  });

  // Piezas libres / sin grupo
  readonly ungroupedParts = computed(() => {
    return this.currentParts().filter(p => !p.groupId);
  });

  // ID del grupo activo si la selección pertenece a un grupo
  readonly activeSelectedGroupId = computed<string | null>(() => {
    const sel = this.selectedPart();
    if (sel?.groupId) return sel.groupId;
    const ids = this.selectedPartIds();
    if (ids.length > 0) {
      const parts = this.currentParts().filter(p => ids.includes(p.id));
      const g = parts.find(p => p.groupId);
      if (g?.groupId) return g.groupId;
    }
    return null;
  });

  // Nombre del grupo activo si la selección pertenece a un grupo
  readonly activeSelectedGroupName = computed(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return null;
    const grp = this.groups().find(g => g.id === gId);
    return grp ? grp.name : 'Cajón';
  });

  readonly isAnyGroupSelected = computed(() => {
    return !!this.activeSelectedGroupId();
  });

  readonly currentGroupFacing = computed<'front' | 'right' | 'back' | 'left'>(() => {
    const gId = this.activeSelectedGroupId();
    if (!gId) return 'front';
    return this.projectService.getGroupFacingDirection(gId);
  });

  // Collapsed / expanded groups in parts list
  readonly openGroupCardIds = signal<Set<string>>(new Set());

  // Drawer Wizard Modal State
  readonly showDrawerWizard = signal<boolean>(false);
  readonly drawerForm = signal<ParametricDrawerConfig>({
    name: 'Cajón 1',
    outerWidth: 400,
    slideLength: 450,
    boxHeight: 140,
    boxThickness: 15,
    bottomThickness: 3,
    slideGap: 26,
    includeFront: true,
    frontHeight: 180,
    frontWidth: 396,
    posX: 0,
    posY: 120,
    posZ: 0
  });

  // Quick group naming modal state
  readonly showGroupNamingModal = signal<boolean>(false);
  readonly newGroupNameInput = signal<string>('Cajón 1');

  // Inline group renaming
  readonly renamingGroupId = signal<string | null>(null);
  readonly renamingGroupName = signal<string>('');

  // Technical Shop Sheet Modal
  readonly showTechnicalSheetModal = signal<boolean>(false);

  // Floating Cutting Dimensions widget minimized state
  readonly isDimensionsWidgetMinimized = signal<boolean>(false);

  // Toast feedback banner
  readonly toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showToast(msg: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(msg);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 2800);
  }

  handleGlobalKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    // Ctrl+Z / Cmd+Z: Deshacer
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (this.projectService.canUndo()) {
        this.projectService.undo();
        this.showToast('↺ Acción deshecha (Ctrl+Z)');
      }
      return;
    }

    // Ctrl+Y / Cmd+Y o Ctrl+Shift+Z: Rehacer
    if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      if (this.projectService.canRedo()) {
        this.projectService.redo();
        this.showToast('↻ Acción rehecha (Ctrl+Y)');
      }
      return;
    }

    // Supr / Delete / Backspace: Eliminar pieza seleccionada inmediatamente con feedback
    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
      const selIds = this.selectedPartIds();
      const selId = this.selectedPartId();

      if (selIds.length > 1) {
        e.preventDefault();
        const count = selIds.length;
        this.projectService.deleteMultipleParts(selIds);
        this.selectedPartIds.set([]);
        this.selectedPartId.set(null);
        this.activeDockTab.set('catalog');
        this.showToast(`🗑️ ${count} piezas eliminadas (Ctrl+Z para restaurar)`);
        return;
      }

      if (selId) {
        e.preventDefault();
        const part = this.currentParts().find(p => p.id === selId);
        const partName = part ? part.name : 'Pieza';
        this.projectService.deletePart(selId);
        const remaining = this.currentParts().filter(p => p.id !== selId);
        if (remaining.length > 0) {
          this.selectedPartId.set(remaining[0].id);
          this.selectedPartIds.set([remaining[0].id]);
        } else {
          this.selectedPartId.set(null);
          this.selectedPartIds.set([]);
          this.activeDockTab.set('catalog');
        }
        this.showToast(`🗑️ "${partName}" eliminada (Ctrl+Z para restaurar)`);
        return;
      }
    }
  }

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

  // Active material object for selected part
  readonly selectedPartMaterial = computed<Material | null>(() => {
    const sel = this.selectedPart();
    if (!sel) return null;
    return this.materials().find(m => m.id === sel.materialId) || null;
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

  // Overall furniture bounding box dimensions (Ancho × Alto × Fondo)
  readonly overallDimensions = computed(() => {
    const parts = this.currentParts();
    if (parts.length === 0) return { width: 0, height: 0, depth: 0 };
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of parts) {
      let sx = p.length || 0;
      let sy = p.width || 0;
      let sz = p.thickness || 18;
      if (p.orientation === 'horizontal') {
        sx = p.length; sy = p.thickness; sz = p.width;
      } else if (p.orientation === 'vertical_yz') {
        const isDrawerLateral = p.componentRole === 'drawer_box' ||
          p.componentRole === 'drawer_lateral' ||
          (p.name.toUpperCase().includes('LATERAL') && (p.name.toUpperCase().includes('CAJ') || !!p.groupId));
        if (isDrawerLateral && (p.length || 0) > (p.width || 0)) {
          sx = p.thickness || 15; sy = p.width; sz = p.length;
        } else {
          sx = p.thickness || 15; sy = p.length; sz = p.width;
        }
      } else {
        const isDrawerBoxHead = p.componentRole === 'drawer_box' ||
          p.name.toUpperCase().includes('CONTRA') ||
          p.name.toUpperCase().includes('TRASERA');
        if (isDrawerBoxHead) {
          sx = p.length; sy = p.width; sz = p.thickness || 15;
        } else {
          sx = p.length; sy = p.width; sz = p.thickness || 18;
        }
      }
      const px = p.posX ?? 0;
      const py = p.posY ?? 0;
      const pz = p.posZ ?? 0;
      minX = Math.min(minX, px - sx / 2);
      maxX = Math.max(maxX, px + sx / 2);
      minY = Math.min(minY, py - sy / 2);
      maxY = Math.max(maxY, py + sy / 2);
      minZ = Math.min(minZ, pz - sz / 2);
      maxZ = Math.max(maxZ, pz + sz / 2);
    }
    return {
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      depth: Math.round(maxZ - minZ)
    };
  });

  updatePartDimension(prop: 'length' | 'width' | 'thickness', rawVal: number | string) {
    const val = Number(rawVal);
    if (isNaN(val) || val <= 0) return;
    if (prop === 'thickness') {
      this.onThicknessChange(val);
    } else {
      this.updateSelectedPart({ [prop]: Math.round(val) });
    }
  }

  swapDimensions() {
    const sel = this.selectedPart();
    if (!sel) return;
    this.updateSelectedPart({
      length: sel.width,
      width: sel.length
    });
    this.showToast('🔄 Dimensiones intercambiadas (Largo ↔ Ancho)');
  }

  toggleDimensionsWidget() {
    this.isDimensionsWidgetMinimized.update(v => !v);
  }

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
      // If we already have multiple parts selected and this part is one of them, do not reset multi-selection
      if (this.selectedPartIds().length > 1 && this.selectedPartIds().includes(part.id)) {
        this.selectedPartId.set(part.id);
        this.activeDockTab.set('piece');
        return;
      }
      this.selectedPartId.set(part.id);
      if (part.groupId) {
        const groupParts = this.currentParts().filter(p => p.groupId === part.groupId);
        this.selectedPartIds.set(groupParts.map(p => p.id));
      } else {
        this.selectedPartIds.set([part.id]);
      }
      this.activeDockTab.set('piece');
    } else {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
    }
  }

  onPartsSelectedFrom3D(partIds: string[]) {
    this.selectedPartIds.set(partIds);
    if (partIds.length > 0) {
      if (!this.selectedPartId() || !partIds.includes(this.selectedPartId()!)) {
        this.selectedPartId.set(partIds[partIds.length - 1]);
      }
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

  readonly hardwareCatalog = inject(HardwareCatalogService);
  readonly viewer3dRef = viewChild<Furniture3dViewerComponent>('viewer3d');

  updateSelectedPart(changes: Partial<Part>) {
    const current = this.selectedPart();
    if (!current) return;

    // If changing spatial coordinates and the part belongs to a group, move the whole group together!
    if (current.groupId && (changes.posX !== undefined || changes.posY !== undefined || changes.posZ !== undefined)) {
      const dx = changes.posX !== undefined ? changes.posX - (current.posX ?? 0) : 0;
      const dy = changes.posY !== undefined ? changes.posY - (current.posY ?? 0) : 0;
      const dz = changes.posZ !== undefined ? changes.posZ - (current.posZ ?? 0) : 0;
      if (dx !== 0 || dy !== 0 || dz !== 0) {
        this.projectService.moveGroup(current.groupId, dx, dy, dz);
        const nonPosChanges = { ...changes };
        delete nonPosChanges.posX;
        delete nonPosChanges.posY;
        delete nonPosChanges.posZ;
        if (Object.keys(nonPosChanges).length > 0) {
          this.projectService.updatePart({ ...current, ...nonPosChanges });
        }
        return;
      }
    }

    const updated: Part = {
      ...current,
      ...changes
    };
    this.projectService.updatePart(updated);
  }

  testPieceAnimation(partId: string) {
    this.viewer3dRef()?.togglePartOpen(partId);
  }

  updateSelectedPartRole(role: ComponentRole) {
    const sel = this.selectedPart();
    if (!sel) return;
    let hw = sel.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(sel);
    if (role === 'door') {
      hw = {
        ...hw,
        isMovable: true,
        movableType: 'door',
        openingDirection: hw.openingDirection || 'left',
        hingeType: hw.hingeType && hw.hingeType !== 'none' ? hw.hingeType : 'straight',
        handleType: hw.handleType && hw.handleType !== 'none' ? hw.handleType : 'bar_modern',
        handleFinish: hw.handleFinish || 'brushed_steel'
      };
    } else if (role === 'drawer_front') {
      hw = {
        ...hw,
        isMovable: true,
        movableType: 'drawer',
        slideType: hw.slideType && hw.slideType !== 'none' ? hw.slideType : 'telescopic',
        handleType: hw.handleType && hw.handleType !== 'none' ? hw.handleType : 'bar_modern',
        handleFinish: hw.handleFinish || 'brushed_steel'
      };
    } else {
      hw = {
        ...hw,
        isMovable: false,
        movableType: 'none',
        handleType: 'none',
        hingeType: 'none',
        slideType: 'none'
      };
    }
    this.updateSelectedPart({ componentRole: role, hardwareConfig: hw });
  }

  updateSelectedPartHardware(updates: Partial<PartHardwareConfig>) {
    const sel = this.selectedPart();
    if (!sel) return;
    const hw: PartHardwareConfig = {
      ...(sel.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(sel)),
      ...updates
    };
    this.updateSelectedPart({ hardwareConfig: hw });
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
      thickness: partData.thickness || 15,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Blanco Frost Mate',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: partData.posX ?? 0,
      posY: partData.posY ?? 7.5,
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

  // Sets melamine color/texture without modifying the piece's custom thickness
  onMaterialChange(matId: string) {
    const mat = this.materials().find(m => m.id === matId);
    if (!mat) return;
    this.updateSelectedPart({
      materialId: mat.id,
      materialName: mat.name
    });
  }

  // Quick or free custom thickness adjustment without altering the assigned melamine
  onThicknessChange(thickness: number) {
    if (isNaN(thickness) || thickness <= 0) return;
    const t = Math.max(1, Math.min(100, Math.round(thickness)));
    this.updateSelectedPart({ thickness: t });
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
    const sel = this.selectedPart();
    if (!sel) return;

    const groupId = this.activeSelectedGroupId();
    if (!groupId) {
      this.updateSelectedPart({ orientation });
      return;
    }

    if (orientation === 'vertical_xy') {
      this.setGroupFaceDirection('front');
    } else if (orientation === 'vertical_yz') {
      this.setGroupFaceDirection('right');
    } else {
      this.rotateSelectedGroup(90);
    }
  }
  rotateSelectedPart90(axis: 'x' | 'y' | 'z' = 'y') {
    const sel = this.selectedPart();
    if (!sel) return;
    if (this.viewer3dRef()) {
      this.viewer3dRef()!.rotatePart90(sel, axis);
    } else {
      if (axis === 'y') {
        this.updateSelectedPart({ length: sel.width, width: sel.length });
      }
    }
    this.showToast(`🔄 Pieza girada 90°`);
  }

  duplicateSelectedGroup() {
    const groupId = this.activeSelectedGroupId();
    if (!groupId) return;
    const result = this.projectService.duplicateGroup(groupId);
    if (result) {
      this.selectedPartIds.set(result.newPartIds);
      if (result.newPartIds.length > 0) {
        this.selectedPartId.set(result.newPartIds[0]);
      }
      this.activeDockTab.set('piece');
      this.showToast(`📋 Se duplicó "${result.newGroup.name}" apilado verticalmente`);
    }
  }

  rotateSelectedGroup(deltaAngle: 90 | -90 | 180 = 90) {
    const groupId = this.activeSelectedGroupId();
    if (!groupId) return;
    this.projectService.rotateGroupRigidly(groupId, deltaAngle);
    this.showToast(`🔄 Cajón girado ${deltaAngle > 0 ? '+' : ''}${deltaAngle}° en bloque`);
  }

  rotateSelectedGroup90() {
    this.rotateSelectedGroup(90);
  }

  setGroupFaceDirection(targetFace: 'front' | 'right' | 'back' | 'left') {
    const groupId = this.activeSelectedGroupId();
    if (!groupId) return;
    const curFace = this.projectService.getGroupFacingDirection(groupId);
    if (curFace === targetFace) return;

    const faceAngles: Record<'front' | 'right' | 'back' | 'left', number> = {
      front: 0,
      right: 90,
      back: 180,
      left: 270
    };

    let diff = faceAngles[targetFace] - faceAngles[curFace];
    if (diff === 270) diff = -90;
    if (diff === -270) diff = 90;
    if (diff === -180) diff = 180;

    this.projectService.rotateGroupRigidly(groupId, diff as 90 | -90 | 180);
    this.showToast(`🧭 Frente orientado hacia: ${targetFace.toUpperCase()}`);
  }

  onGroupRotationRequested(event: { groupId: string; deltaAngle: 90 | -90 | 180 }) {
    this.projectService.rotateGroupRigidly(event.groupId, event.deltaAngle);
    this.showToast(`🔄 Cajón girado ${event.deltaAngle > 0 ? '+' : ''}${event.deltaAngle}° (Atajo: tecla R)`);
  }

  onGroupDuplicationRequested(groupId: string) {
    const result = this.projectService.duplicateGroup(groupId);
    if (result) {
      this.selectedPartIds.set(result.newPartIds);
      if (result.newPartIds.length > 0) {
        this.selectedPartId.set(result.newPartIds[0]);
      }
      this.activeDockTab.set('piece');
      this.showToast(`📋 Se duplicó "${result.newGroup.name}" apilado verticalmente`);
    }
  }

  alignPart(preset: 'floor' | 'centerX' | 'centerZ' | 'top') {
    const current = this.selectedPart();
    if (!current) return;

    const t = current.thickness || 18;
    const L = current.length;
    const orientation = current.orientation || 'horizontal';

    let sy = t;
    if (orientation === 'vertical_yz') {
      const isDrawerLateral = current.componentRole === 'drawer_box' ||
        current.componentRole === 'drawer_lateral' ||
        (current.name.toUpperCase().includes('LATERAL') && (current.name.toUpperCase().includes('CAJ') || !!current.groupId));
      sy = (isDrawerLateral && L > current.width) ? current.width : L;
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
      this.selectedPartIds.set([cloned.id]);
      this.activeDockTab.set('piece');
      this.showToast(`📋 Se duplicó "${cloned.name}"`);
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

    const defaultT = 15;
    let newPart: Part;

    const currentParts = this.currentParts();
    // Approximate reference bounds
    const maxTopY = currentParts.reduce((max, p) => Math.max(max, (p.posY ?? 0) + (p.thickness || 15)), 850);

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

  // --- ACCORDION & GROUP DISPLAY ---
  toggleGroupAccordion(groupId: string) {
    const cur = new Set(this.openGroupCardIds());
    if (cur.has(groupId)) {
      cur.delete(groupId);
    } else {
      cur.add(groupId);
    }
    this.openGroupCardIds.set(cur);
  }

  isGroupAccordionOpen(groupId: string): boolean {
    return this.openGroupCardIds().has(groupId);
  }

  // --- MODULAR DRAWER WIZARD ---
  openDrawerWizard() {
    const nextNum = (this.groups().length || 0) + 1;
    const defaultMat = this.materials()[0];
    const mdfMat = this.materials().find(m => m.thickness === 3) || defaultMat;
    this.drawerForm.set({
      name: `Cajón ${nextNum}`,
      outerWidth: 400,
      slideLength: 450,
      boxHeight: 140,
      boxThickness: 15,
      bottomThickness: 3,
      slideGap: 26,
      includeFront: true,
      frontHeight: 180,
      frontWidth: 396,
      posX: 0,
      posY: 100 + (nextNum - 1) * 200,
      posZ: 0,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      bottomMaterialId: mdfMat ? mdfMat.id : 'mat_mdf_3'
    });
    this.showDrawerWizard.set(true);
  }

  closeDrawerWizard() {
    this.showDrawerWizard.set(false);
  }

  updateDrawerFormField<K extends keyof ParametricDrawerConfig>(field: K, value: ParametricDrawerConfig[K]) {
    this.drawerForm.update(cur => ({ ...cur, [field]: value }));
  }

  submitDrawerWizard() {
    const config = this.drawerForm();
    const grp = this.projectService.addParametricDrawer(config);
    this.showDrawerWizard.set(false);
    this.selectEntireGroup(grp.id);
    this.openGroupCardIds.update(s => new Set(s).add(grp.id));
    this.showToast(`✨ ${grp.name} generado con 5-6 piezas ensambladas`);
  }

  // --- MANUAL GROUPING & UNGROUPING ---
  openGroupNamingModal() {
    const selCount = this.selectedPartIds().length;
    if (selCount < 2) {
      this.showToast('Selecciona al menos 2 piezas para agrupar (usa Shift+Clic en 3D o en lista)');
      return;
    }
    const nextNum = (this.groups().length || 0) + 1;
    this.newGroupNameInput.set(`Cajón ${nextNum}`);
    this.showGroupNamingModal.set(true);
  }

  closeGroupNamingModal() {
    this.showGroupNamingModal.set(false);
  }

  confirmCreateGroup() {
    const name = this.newGroupNameInput().trim() || `Cajón ${(this.groups().length || 0) + 1}`;
    const selIds = this.selectedPartIds();
    if (selIds.length < 2) return;
    const grp = this.projectService.createGroup(name, selIds, 'drawer');
    this.showGroupNamingModal.set(false);
    this.openGroupCardIds.update(s => new Set(s).add(grp.id));
    this.showToast(`🔗 ${grp.name} agrupado (${selIds.length} piezas)`);
  }

  ungroup(groupId: string) {
    const grp = this.groups().find(g => g.id === groupId);
    const name = grp ? grp.name : 'Grupo';
    this.projectService.ungroup(groupId);
    this.showToast(`🔓 ${name} desagrupado (piezas libres)`);
  }

  async deleteGroup(groupId: string, deleteParts = true) {
    const grp = this.groups().find(g => g.id === groupId);
    const name = grp ? grp.name : 'Grupo';
    const confirmed = await this.confirmService.ask({
      title: `¿Eliminar ${name}?`,
      message: `Se eliminará el grupo y ${deleteParts ? 'todas sus piezas ensambladas' : 'se liberarán las piezas'}.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (!confirmed) return;
    this.projectService.deleteGroup(groupId, deleteParts);
    this.deselectAll();
    this.showToast(`🗑️ ${name} eliminado`);
  }

  toggleGroupOpen(groupId: string) {
    this.projectService.toggleGroupOpen(groupId);
  }

  onGroupSlideChange(groupId: string, event: Event) {
    const val = Number((event.target as HTMLInputElement).value) / 100;
    this.projectService.setGroupSlideExtension(groupId, val);
  }

  selectEntireGroup(groupId: string) {
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    const ids = groupParts.map(p => p.id);
    this.selectedPartIds.set(ids);
    this.selectedPartId.set(ids[0] || null);
  }

  activateMoveToolOnViewer() {
    this.viewer3dRef()?.setActiveTool('move');
  }

  toggleSelectedGroupOpen() {
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId) || this.selectedPart();
    if (part?.groupId) {
      this.viewer3dRef()?.toggleGroupAnimation(part.groupId);
      this.projectService.toggleGroupOpen(part.groupId);
    } else if (part) {
      this.viewer3dRef()?.togglePartOpen(part.id);
    }
  }

  isGroupOpen(): boolean {
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId) || this.selectedPart();
    if (part?.groupId) {
      return this.viewer3dRef()?.isGroupOpen(part.groupId) ?? false;
    } else if (part) {
      return this.viewer3dRef()?.isPartOpen(part.id) ?? false;
    }
    return false;
  }

  ungroupSelected() {
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId);
    if (part?.groupId) {
      this.ungroup(part.groupId);
    }
  }

  moveGroup(groupId: string, axis: 'x' | 'y' | 'z', amount: number) {
    const dx = axis === 'x' ? amount : 0;
    const dy = axis === 'y' ? amount : 0;
    const dz = axis === 'z' ? amount : 0;
    this.projectService.moveGroup(groupId, dx, dy, dz);
  }

  startRenameGroup(group: PartGroup, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.renamingGroupId.set(group.id);
    this.renamingGroupName.set(group.name);
  }

  saveRenameGroup(groupId: string) {
    const name = this.renamingGroupName().trim();
    if (name) {
      this.projectService.updateGroup(groupId, { name });
      this.showToast(`✏️ Grupo renombrado a "${name}"`);
    }
    this.renamingGroupId.set(null);
  }

  cancelRenameGroup() {
    this.renamingGroupId.set(null);
  }

  roundPercent(val?: number): number {
    return Math.round((val || 0) * 100);
  }
}
