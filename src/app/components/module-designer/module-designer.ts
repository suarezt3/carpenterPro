import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
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
  PartHardwareConfig,
  WorkspaceMode,
  RoomConfiguration,
  RoomLayoutType,
  FloorMaterialType,
  WallMaterialType,
  DEFAULT_ROOM_CONFIG,
  FLOOR_FINISHES_CATALOG,
  WALL_FINISHES_CATALOG,
  FloorFinishCategory,
  WallFinishCategory,
  ApplianceItem,
  AppliancePreset,
  ApplianceFinish,
  ApplianceType,
  APPLIANCES_CATALOG_PRESETS,
  APPLIANCE_FINISH_OPTIONS,
  ParametricCabinetConfig
} from '../../models/melamine.models';
import { Furniture3dViewerComponent, ClearanceInfo } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { TechnicalSheetModalComponent } from '../technical-sheet-modal/technical-sheet-modal';
import { ComponentOptionsModalComponent } from '../component-options-modal/component-options-modal';
import { TemplatesModalComponent } from '../templates-modal/templates-modal';
import { FurnitureTemplate, TemplatesCatalogService } from '../../services/templates-catalog.service';

/**
 * Componente principal de diseño y modelado 3D (Modo Módulo y Modo Habitación 3D).
 * Coordina el visor Three.js, el inspector de propiedades de piezas, el catálogo de módulos
 * paramétricos, el asistente de cajones y la colocación de electrodomésticos.
 */
@Component({
  selector: 'app-module-designer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Furniture3dViewerComponent,
    TechnicalSheetModalComponent,
    ComponentOptionsModalComponent,
    TemplatesModalComponent
  ],
  templateUrl: './module-designer.html',
  styleUrl: './module-designer.css',
  host: {
    '(window:keydown)': 'handleGlobalKeyDown($event)'
  }
})
export class ModuleDesignerComponent {
  readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly joineryEngine = inject(JoineryEngineService);
  private readonly dxfExporter = inject(DxfExporterService);
  private readonly cabinetGen = inject(CabinetGeneratorService);
  private readonly templatesCatalog = inject(TemplatesCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  readonly hardwareCatalog = inject(HardwareCatalogService);

  // Referencia al visor 3D y al contenedor horizontal de chips de piezas
  readonly viewer3d = viewChild<Furniture3dViewerComponent>('viewer3d');
  readonly viewer3dRef = this.viewer3d;
  readonly chipsScrollContainer = viewChild<ElementRef<HTMLDivElement>>('chipsScrollContainer');

  // Signals principales sincronizados con ProjectStorageService
  readonly project = this.projectService.currentProject;
  readonly materials = this.projectService.materialsList;
  readonly currentParts = this.projectService.partsList;

  // Estado del Modal de Opciones de Componente Paramétrico
  readonly selectedParametricConfig = signal<ParametricCabinetConfig | null>(null);
  readonly showComponentOptionsModal = signal<boolean>(false);

  /**
   * Abre el modal de configuración paramétrica precargando los valores de una plantilla.
   */
  onConfigureParametric(template: FurnitureTemplate) {
    if (template.parametricConfig) {
      this.selectedParametricConfig.set(template.parametricConfig as ParametricCabinetConfig);
    } else {
      this.selectedParametricConfig.set(null);
    }
    this.showComponentOptionsModal.set(true);
  }

  openCabinetOptionsModal() {
    this.selectedParametricConfig.set(null);
    this.showComponentOptionsModal.set(true);
  }

  /**
   * Genera e inserta un nuevo módulo paramétrico en la escena 3D calculando su desplazamiento X
   * automático para no superponerse con muebles existentes.
   */
  onCabinetSubmitted(config: ParametricCabinetConfig) {
    let targetX = config.posX ?? 0;
    if (this.currentParts().length > 0 && targetX === 0) {
      targetX = this.templatesCatalog.calculateTemplateOffset(this.currentParts(), config.width);
    }
    const finalConfig = { ...config, posX: targetX };
    const res = this.cabinetGen.generateParametricWallCabinet(finalConfig, this.materials());
    this.projectService.addParametricCabinet(res);

    const partIds = res.parts.map(p => p.id);
    this.selectedPartIds.set(partIds);
    const doorPart = res.parts.find(p => p.componentRole === 'door') || res.parts[0];
    if (doorPart) {
      this.selectedPartId.set(doorPart.id);
      this.activeDockTab.set('piece');
    }
    this.showToast(`✨ Módulo "${res.module.name}" insertado. Puedes moverlo libremente en 3D.`);
  }

  onCabinetCreated(event: { config: ParametricCabinetConfig; mode: 'replace' | 'append' }) {
    if (event.mode === 'replace') {
      this.projectService.clearFurniture();
    }
    this.onCabinetSubmitted(event.config);
    this.showTemplatesModal.set(false);
  }

  readonly showGroupMaterialDropdown = signal<boolean>(false);

  toggleGroupMaterialDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.showGroupMaterialDropdown.update(v => !v);
  }

  applyGroupMaterial(materialId: string, target: 'all' | 'structure' | 'doors' = 'all') {
    const gId = this.activeSelectedGroupId();
    if (gId) {
      this.projectService.changeGroupMaterial(gId, materialId, target);
      this.showToast('🎨 Material del módulo actualizado');
      this.showGroupMaterialDropdown.set(false);
    }
  }

  // Estado de selección en 3D (pieza individual, multiselección y luz libre)
  readonly selectedPartId = signal<string | null>(null);
  readonly selectedPartIds = signal<string[]>([]);
  readonly clearanceInfo = signal<ClearanceInfo | null>(null);

  readonly Math = Math;

  // Grupos y Cajones Modulares
  readonly groups = this.projectService.groupsList;

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

  readonly ungroupedParts = computed(() => {
    return this.currentParts().filter(p => !p.groupId);
  });

  /**
   * Identifica el ID del grupo activo cuando la pieza o conjunto seleccionado pertenece a un módulo/cajón.
   */
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

  readonly openGroupCardIds = signal<Set<string>>(new Set());

  // Estado del Asistente de Cajón Modular
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

  // Modal de agrupación manual y renombrado en línea
  readonly showGroupNamingModal = signal<boolean>(false);
  readonly newGroupNameInput = signal<string>('Cajón 1');
  readonly renamingGroupId = signal<string | null>(null);
  readonly renamingGroupName = signal<string>('');
  readonly renamingPartId = signal<string | null>(null);
  readonly renamingPartName = signal<string>('');

  readonly isNewGroupNameDuplicate = computed(() => {
    const name = this.newGroupNameInput().trim();
    if (!name) return false;
    return this.isGroupNameTaken(name);
  });

  readonly suggestedUniqueGroupName = computed(() => {
    return this.getNextUniqueGroupName('Cajón');
  });

  readonly isDrawerWizardNameDuplicate = computed(() => {
    const name = this.drawerForm().name.trim();
    if (!name) return false;
    return this.isGroupNameTaken(name);
  });

  readonly suggestedDrawerWizardName = computed(() => {
    return this.getNextUniqueGroupName('Cajón');
  });

  // Control de visibilidad (Ocultar / Mostrar piezas y grupos con tecla H / Alt+H)
  readonly hiddenPartIds = signal<Set<string>>(new Set());
  readonly hiddenPartsCount = computed(() => this.hiddenPartIds().size);

  // Configuración del Modo Habitación 3D y Catálogos de Acabados Arquitectónicos
  readonly workspaceMode = signal<WorkspaceMode>('module');
  readonly roomConfig = signal<RoomConfiguration>(DEFAULT_ROOM_CONFIG);
  readonly showRoomSettingsModal = signal<boolean>(false);
  readonly selectedWall = signal<'main' | 'side' | null>(null);

  readonly floorCatalog = FLOOR_FINISHES_CATALOG;
  readonly wallCatalog = WALL_FINISHES_CATALOG;
  readonly activeFloorCategory = signal<FloorFinishCategory>('all');
  readonly activeWallCategory = signal<WallFinishCategory>('all');

  readonly filteredFloorCatalog = computed(() => {
    const cat = this.activeFloorCategory();
    if (cat === 'all') return this.floorCatalog;
    return this.floorCatalog.filter(item => item.category === cat);
  });

  readonly filteredWallCatalog = computed(() => {
    const cat = this.activeWallCategory();
    if (cat === 'all') return this.wallCatalog;
    return this.wallCatalog.filter(item => item.category === cat);
  });

  readonly showTechnicalSheetModal = signal<boolean>(false);
  readonly isDimensionsWidgetMinimized = signal<boolean>(false);

  // Notificación flotante tipo Toast con limpieza automática
  readonly toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showToast(msg: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(msg);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 2800);
  }

  /**
   * Atajos globales de teclado del diseñador 3D:
   * - Ctrl+Z / Ctrl+Y: Deshacer y Rehacer
   * - Delete / Backspace: Eliminar pieza, grupo o electrodoméstico seleccionado
   * - H / Alt+H: Ocultar selección o mostrar todas las piezas ocultas
   */
  handleGlobalKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (this.projectService.canUndo()) {
        this.projectService.undo();
        this.showToast('↺ Acción deshecha (Ctrl+Z)');
      }
      return;
    }

    if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      if (this.projectService.canRedo()) {
        this.projectService.redo();
        this.showToast('↻ Acción rehecha (Ctrl+Y)');
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
      const selAppId = this.selectedApplianceId();
      if (selAppId) {
        e.preventDefault();
        const app = this.selectedAppliance();
        const appName = app ? app.name : 'Equipo';
        this.projectService.removeAppliance(selAppId);
        this.showToast(`🗑️ "${appName}" eliminado (Delete)`);
        return;
      }

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

    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'h' || e.key === 'H')) {
      if (this.isAnyGroupSelected()) {
        e.preventDefault();
        this.hideActiveGroup();
        return;
      } else if (this.selectedPartId()) {
        e.preventDefault();
        this.hideSelectedPart();
        return;
      }
    }

    if (e.altKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      this.showAllParts();
      return;
    }
  }

  // Pestaña activa de la bandeja derecha: 'piece', 'catalog' o 'appliances'
  readonly activeDockTab = signal<'piece' | 'catalog' | 'appliances'>('catalog');

  // Electrodomésticos y Accesorios 3D
  readonly appliances = this.projectService.appliancesList;
  readonly selectedApplianceId = this.projectService.selectedApplianceId;
  readonly selectedAppliance = this.projectService.selectedAppliance;
  readonly appliancesCatalog = APPLIANCES_CATALOG_PRESETS;
  readonly applianceFinishOptions = APPLIANCE_FINISH_OPTIONS;
  readonly activeApplianceCategory = signal<'all' | 'cold' | 'cooking' | 'extraction' | 'washing' | 'microwave' | 'coffee' | 'legs'>('all');

  readonly filteredAppliances = computed(() => {
    const cat = this.activeApplianceCategory();
    if (cat === 'all') return this.appliancesCatalog;
    return this.appliancesCatalog.filter(a => a.category === cat);
  });

  getApplianceIcon(type: ApplianceType): string {
    switch (type) {
      case 'refrigerator': return 'kitchen';
      case 'sink': return 'wash';
      case 'hood': return 'air';
      case 'cooktop': return 'mode_heat';
      case 'microwave': return 'microwave';
      case 'coffee_maker': return 'coffee';
      case 'table_leg':
      case 'table_legs_set': return 'table_bar';
      case 'oven':
      default: return 'microwave';
    }
  }

  /**
   * Inserta un electrodoméstico o juego de patas desde el catálogo calculando su elevación
   * y posición inicial según el tipo de montaje (suelo, encimera, pared o empotrado).
   */
  addApplianceFromPreset(preset: AppliancePreset) {
    const config = this.roomConfig();
    const selPart = this.selectedPart();
    let posX = 0;
    let posY = 0;
    let posZ = 0;
    let targetWidth = preset.defaultWidth;
    let targetDepth = preset.defaultDepth;
    let targetHeight = preset.defaultHeight;

    if (preset.type === 'table_legs_set') {
      if (selPart && (selPart.orientation === 'horizontal' || !selPart.orientation)) {
        targetWidth = selPart.length;
        targetDepth = selPart.width;
        posX = selPart.posX || 0;
        posZ = selPart.posZ || 0;
        posY = 0;
        const partUnderside = (selPart.posY || 738) - (selPart.thickness || 18) / 2;
        if (partUnderside > 150) {
          targetHeight = partUnderside;
        }
      }
    } else if (preset.type === 'table_leg') {
      if (selPart) {
        posX = (selPart.posX || 0) + (selPart.length / 2 - 40);
        posZ = (selPart.posZ || 0) + (selPart.width / 2 - 40);
        posY = 0;
        const partUnderside = (selPart.posY || 738) - (selPart.thickness || 18) / 2;
        if (partUnderside > 150) {
          targetHeight = partUnderside;
        }
      }
    } else if (preset.type === 'coffee_maker') {
      if (selPart) {
        posX = selPart.posX || 0;
        posY = (selPart.posY || 0) + (selPart.thickness || 18) / 2;
        posZ = selPart.posZ || 0;
      } else {
        const parts = this.currentParts();
        let highestY = 0;
        for (const p of parts) {
          if (p.orientation === 'horizontal') {
            const top = (p.posY || 0) + (p.thickness || 18) / 2;
            if (top > highestY) highestY = top;
          }
        }
        posY = highestY > 0 ? highestY : 880;
        posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
      }
    } else if (preset.defaultMountType === 'floor') {
      posY = 0;
      posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
    } else if (preset.defaultMountType === 'countertop') {
      if (selPart && (selPart.orientation === 'horizontal' || !selPart.orientation)) {
        posX = selPart.posX || 0;
        posY = (selPart.posY || 0) + (selPart.thickness || 18) / 2;
        posZ = selPart.posZ || 0;
      } else {
        const parts = this.currentParts();
        let highestY = 0;
        for (const p of parts) {
          if (p.orientation === 'horizontal') {
            const top = (p.posY || 0) + (p.thickness || 18) / 2;
            if (top > highestY) highestY = top;
          }
        }
        posY = highestY > 0 ? highestY : 880;
        posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
      }
    } else if (preset.defaultMountType === 'wall') {
      posY = preset.type === 'hood' ? 1500 : 1200;
      posZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (preset.defaultDepth / 2);
    } else if (preset.defaultMountType === 'built_in') {
      posY = 800;
      posZ = preset.defaultDepth / 2;
    }

    const newApp: ApplianceItem = {
      id: 'appliance_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: preset.type,
      name: preset.name,
      brand: preset.brand,
      modelCode: preset.modelCode,
      width: targetWidth,
      depth: targetDepth,
      height: targetHeight,
      finish: preset.defaultFinish,
      position: { x: posX, y: posY, z: posZ },
      rotation: 0,
      mountType: preset.defaultMountType,
      price: preset.defaultPrice,
      includeInBudget: true,
      notes: preset.description
    };

    this.projectService.addAppliance(newApp);
    this.deselectPart();
    this.activeDockTab.set('appliances');
    this.showToast(`✨ ${newApp.name} añadido`);
  }

  attachTableLegsToSelectedPart(style: 'hairpin' | 'cylindrical_inox' | 'scandinavian_wood' = 'hairpin') {
    const presetId = style === 'hairpin'
      ? 'preset_legs_hairpin_set'
      : (style === 'cylindrical_inox' ? 'preset_legs_cylindrical_inox_set' : 'preset_legs_scandinavian_wood_set');
    const preset = this.appliancesCatalog.find(p => p.id === presetId);
    if (!preset) return;

    this.addApplianceFromPreset(preset);
    this.showToast(`🛠️ Juego de patas (${style === 'hairpin' ? 'Horquilla' : (style === 'cylindrical_inox' ? 'Inox' : 'Nórdica')}) añadido a la mesa`);
  }

  selectAppliance(id: string | null) {
    this.projectService.selectAppliance(id);
    if (id) {
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
      this.activeDockTab.set('appliances');
    }
  }

  updateApplianceDimension(prop: 'width' | 'depth' | 'height', val: number | string) {
    const sel = this.selectedAppliance();
    const num = Number(val);
    if (!sel || isNaN(num) || num <= 0) return;
    this.projectService.updateAppliance(sel.id, { [prop]: Math.round(num) });
  }

  updateAppliancePosition(axis: 'x' | 'y' | 'z', delta: number) {
    const sel = this.selectedAppliance();
    if (!sel) return;
    const currentPos = { ...sel.position };
    currentPos[axis] = Math.round(currentPos[axis] + delta);
    this.projectService.updateAppliance(sel.id, { position: currentPos });
  }

  setAppliancePositionDirect(axis: 'x' | 'y' | 'z', val: number | string) {
    const sel = this.selectedAppliance();
    const num = Number(val);
    if (!sel || isNaN(num)) return;
    const currentPos = { ...sel.position };
    currentPos[axis] = Math.round(num);
    this.projectService.updateAppliance(sel.id, { position: currentPos });
  }

  updateApplianceFinish(finish: ApplianceFinish) {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.updateAppliance(sel.id, { finish });
    const finishLabel = finish === 'stainless_steel' ? 'Acero Inox' : finish === 'black_matte' ? 'Negro Mate' : 'Blanco Brillante';
    this.showToast(`🎨 Acabado cambiado a ${finishLabel}`);
  }

  rotateAppliance(delta: 90 | -90 | 180) {
    const sel = this.selectedAppliance();
    if (!sel) return;
    let nextRot = (sel.rotation + delta) % 360;
    if (nextRot < 0) nextRot += 360;
    this.projectService.updateAppliance(sel.id, { rotation: nextRot });
  }

  snapSelectedAppliance(target: 'floor' | 'countertop' | 'wall' | 'auto') {
    const sel = this.selectedAppliance();
    const viewer = this.viewer3d();
    if (!sel || !viewer) return;
    viewer.snapApplianceToContact(sel, target);
    const targetLabel = target === 'floor' ? 'el suelo' : target === 'countertop' ? 'la mesada' : target === 'wall' ? 'la pared' : 'superficie';
    this.showToast(`🧲 Imán: adherido a ${targetLabel}`);
  }

  duplicateSelectedAppliance() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.duplicateAppliance(sel.id);
    this.showToast(`📋 Copia de "${sel.name}" creada`);
  }

  deleteSelectedAppliance() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    const name = sel.name;
    this.projectService.removeAppliance(sel.id);
    this.showToast(`🗑️ "${name}" retirado`);
  }

  toggleApplianceBudgetInclusion() {
    const sel = this.selectedAppliance();
    if (!sel) return;
    this.projectService.updateAppliance(sel.id, { includeInBudget: !sel.includeInBudget });
  }

  updateAppliancePrice(price: number | string) {
    const sel = this.selectedAppliance();
    const num = Number(price);
    if (!sel || isNaN(num) || num < 0) return;
    this.projectService.updateAppliance(sel.id, { price: Math.round(num) });
  }

  updateApplianceName(name: string) {
    const sel = this.selectedAppliance();
    if (!sel || !name.trim()) return;
    this.projectService.updateAppliance(sel.id, { name: name.trim() });
  }

  onApplianceSelectedFrom3D(app: ApplianceItem | null) {
    if (app) {
      this.projectService.selectAppliance(app.id);
      this.selectedPartId.set(null);
      this.selectedPartIds.set([]);
      this.activeDockTab.set('appliances');
    } else {
      this.projectService.selectAppliance(null);
    }
  }

  onApplianceModifiedFromViewer(evt: { appliance: ApplianceItem; updates: Partial<ApplianceItem> }) {
    this.projectService.updateAppliance(evt.appliance.id, evt.updates);
  }

  onApplianceDeletedFromViewer(id: string) {
    const app = this.appliances().find(a => a.id === id);
    const name = app ? app.name : 'Equipo';
    this.projectService.removeAppliance(id);
    this.showToast(`🗑️ "${name}" eliminado (Delete)`);
  }

  // Control de colapso de la bandeja lateral y modal de plantillas/edición de módulos
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly showTemplatesDropdown = signal<boolean>(false);
  readonly showTemplatesModal = signal<boolean>(false);
  readonly editingGroupId = signal<string | null>(null);
  readonly editingGroupConfig = signal<ParametricCabinetConfig | null>(null);

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  openTemplatesModal() {
    this.editingGroupId.set(null);
    this.editingGroupConfig.set(null);
    this.showTemplatesDropdown.set(false);
    this.showTemplatesModal.set(true);
  }

  closeTemplatesModal() {
    this.showTemplatesModal.set(false);
    this.editingGroupId.set(null);
    this.editingGroupConfig.set(null);
  }

  openEditSelectedGroup(event?: Event) {
    event?.stopPropagation();
    const gId = this.activeSelectedGroupId();
    if (gId) {
      this.openEditGroup(gId, event);
    }
  }

  /**
   * Abre el asistente paramétrico cargando las dimensiones actuales del grupo seleccionado.
   * Cancela previamente cualquier interacción activa en el visor 3D.
   */
  openEditGroup(groupId: string, event?: Event) {
    event?.stopPropagation();
    this.viewer3d()?.cancelActiveInteractions();

    const parts = this.currentParts().filter(p => p.groupId === groupId);
    if (parts.length === 0) {
      this.showToast('⚠️ No se encontraron piezas para editar en este módulo');
      return;
    }
    const group = this.groups().find(g => g.id === groupId) || {
      id: groupId,
      name: parts[0]?.groupName || parts[0]?.moduleName || 'Módulo Paramétrico',
      type: 'assembly' as const
    };

    const safeConfig = this.cabinetGen.reconstructConfigFromParts(parts, group);
    this.editingGroupConfig.set({ ...safeConfig });
    this.editingGroupId.set(groupId);
    this.showTemplatesDropdown.set(false);
    this.showTemplatesModal.set(true);
  }

  /**
   * Actualiza un módulo paramétrico conservando su centro exacto (posX, posY, posZ) en el espacio 3D.
   * Toma el centro X del techo/piso (o el punto medio entre ambos laterales) para evitar desplazamientos.
   */
  onCabinetUpdated(event: { groupId: string; config: ParametricCabinetConfig }) {
    const groupParts = this.currentParts().filter(p => p.groupId === event.groupId);
    const sidePart = groupParts.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right') || groupParts[0];
    const topOrBottom = groupParts.find(p => p.componentRole === 'top' || p.componentRole === 'bottom');
    const doorPart = groupParts.find(p => p.componentRole === 'door');

    const posX = topOrBottom?.posX ?? event.config.posX ?? 0;
    const posY = sidePart?.posY ?? event.config.posY;
    const doorOffsetZ = doorPart ? (Number(doorPart.thickness || event.config.doorThickness || 15) / 2) : 0;
    const posZ = sidePart !== undefined && sidePart.posZ !== undefined
      ? sidePart.posZ + doorOffsetZ
      : (event.config.posZ ?? 0);

    const finalConfig: ParametricCabinetConfig = {
      ...event.config,
      posX,
      posY,
      posZ
    };

    const res = this.cabinetGen.generateParametricCabinet(finalConfig, this.materials());
    const updatedParts = res.parts.map(p => ({
      ...p,
      groupId: event.groupId,
      groupName: finalConfig.name
    }));

    this.projectService.updateParametricCabinet(event.groupId, updatedParts, finalConfig.name, finalConfig);
    this.showToast(`✨ Módulo "${finalConfig.name}" actualizado`);
    this.closeTemplatesModal();

    const partIds = updatedParts.map(p => p.id);
    this.selectedPartIds.set(partIds);
    if (partIds.length > 0) {
      this.selectedPartId.set(partIds[0]);
    }
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

  readonly selectedPartDrillHoles = computed<DrillHole[]>(() => {
    const sel = this.selectedPart();
    if (!sel) return [];
    return this.joineryData().drillHolesByPart.get(sel.id) || [];
  });

  readonly selectedPart = computed<Part | null>(() => {
    const id = this.selectedPartId();
    if (!id) return null;
    return this.currentParts().find(p => p.id === id) || null;
  });

  readonly selectedPartMaterial = computed<Material | null>(() => {
    const sel = this.selectedPart();
    if (!sel) return null;
    return this.materials().find(m => m.id === sel.materialId) || null;
  });

  readonly selectedPartsList = computed<Part[]>(() => {
    const ids = this.selectedPartIds();
    return this.currentParts().filter(p => ids.includes(p.id));
  });

  readonly totalAreaM2 = computed(() => {
    const parts = this.currentParts();
    const sumMm2 = parts.reduce((acc, p) => acc + (p.length * p.width * p.quantity), 0);
    return (sumMm2 / 1_000_000).toFixed(2);
  });

  /**
   * Calcula las dimensiones envolventes totales del mobiliario (Ancho × Alto × Fondo)
   * delegando el cálculo geométrico de cada pieza a JoineryEngineService.
   */
  readonly overallDimensions = computed(() => {
    const parts = this.currentParts();
    if (parts.length === 0) return { width: 0, height: 0, depth: 0 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of parts) {
      const b = this.joineryEngine.getPartBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
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
    const parts = this.currentParts();
    if (parts.length > 0) {
      const topPart = parts.find(p => p.name.toUpperCase().includes('TECHO') || p.id === 'desk_top') || parts[0];
      this.selectedPartId.set(topPart.id);
      this.selectedPartIds.set([topPart.id]);
      this.activeDockTab.set('piece');
    }

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
    });
  }

  // --- SELECCIÓN DE PIEZAS Y GRUPOS ---

  onSelectPartFrom3D(part: Part | null) {
    if (part) {
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
      const part = this.currentParts().find(p => p.id === id);
      this.selectedPartId.set(id);
      if (part?.groupId) {
        const groupParts = this.currentParts().filter(p => p.groupId === part.groupId);
        this.selectedPartIds.set(groupParts.map(p => p.id));
      } else {
        this.selectedPartIds.set([id]);
      }
      this.activeDockTab.set('piece');
    }
  }

  getGroupName(groupId?: string): string | null {
    if (!groupId) return null;
    const grp = this.groups().find(g => g.id === groupId);
    return grp ? grp.name : null;
  }

  deselectPart() {
    this.deselectAll();
  }

  // --- EDICIÓN EN TIEMPO REAL DE PIEZAS Y GRUPOS ---

  /**
   * Permite realizar scroll lateral suave en la cinta inferior de piezas usando la rueda del ratón.
   */
  onPiecesBarWheel(event: WheelEvent) {
    const el = this.chipsScrollContainer()?.nativeElement;
    if (!el) return;
    if (Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0) {
      event.preventDefault();
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      el.scrollLeft += delta;
    }
  }

  onChipsScrollWheel(event: WheelEvent, container?: HTMLElement) {
    const el = container || (event.currentTarget as HTMLElement) || this.chipsScrollContainer()?.nativeElement;
    if (!el) return;
    if (Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0) {
      event.preventDefault();
      event.stopPropagation();
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      el.scrollLeft += delta;
    }
  }

  /**
   * Actualiza las propiedades de la pieza seleccionada. Si se modifican coordenadas espaciales
   * (posX, posY, posZ) y la pieza pertenece a un grupo, desplaza todo el grupo en bloque.
   */
  updateSelectedPart(changes: Partial<Part>) {
    const current = this.selectedPart();
    if (!current) return;

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
    this.viewer3d()?.togglePartOpen(partId);
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

  onDragStarted() {
    this.projectService.pushSnapshot();
  }

  onPartModifiedFromViewer(event: { part: Part; updates: Partial<Part> }) {
    const targetPart = this.currentParts().find(p => p.id === event.part.id) || event.part;
    const updated: Part = {
      ...targetPart,
      ...event.updates
    };
    this.projectService.updatePart(updated, false);
  }

  onMultiplePartsModifiedFromViewer(event: { updates: { part: Part; updates: Partial<Part> }[] }) {
    const updatesList = event.updates.map(u => ({ partId: u.part.id, updates: u.updates }));
    this.projectService.updateMultipleParts(updatesList, false);
  }

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
      componentRole: 'free',
      shapeType: partData.shapeType || 'rectangle',
      radius: partData.radius,
      diameter: partData.diameter,
      contourPoints: partData.contourPoints
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

  onMaterialChange(matId: string) {
    const mat = this.materials().find(m => m.id === matId);
    if (!mat) return;
    this.updateSelectedPart({
      materialId: mat.id,
      materialName: mat.name
    });
  }

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
    const viewer = this.viewer3d();
    if (viewer) {
      viewer.rotatePart90(sel, axis);
    } else {
      const prop = axis === 'x' ? 'rotationX' : (axis === 'y' ? 'rotationY' : 'rotationZ');
      const current = sel[prop] || 0;
      this.updateSelectedPart({ [prop]: (current + 90) % 360 });
    }
    this.showToast('🔄 Pieza girada 90°');
  }

  rotateSelectedPart3DAngle(axis: 'x' | 'y' | 'z', delta: number) {
    const sel = this.selectedPart();
    if (!sel) return;
    const prop = axis === 'x' ? 'rotationX' : (axis === 'y' ? 'rotationY' : 'rotationZ');
    const current = sel[prop] || 0;
    const next = ((current + delta) % 360 + 360) % 360;
    this.updateSelectedPart({ [prop]: next });
    this.showToast(`🔄 Rotación ${axis.toUpperCase()}: ${next}°`);
  }

  setPartRotationAngle(axis: 'x' | 'y' | 'z', angle: number) {
    const sel = this.selectedPart();
    if (!sel || isNaN(angle)) return;
    const normAngle = ((Math.round(angle) % 360) + 360) % 360;
    const prop = axis === 'x' ? 'rotationX' : (axis === 'y' ? 'rotationY' : 'rotationZ');
    this.updateSelectedPart({ [prop]: normAngle });
  }

  resetSelectedPartRotation() {
    this.updateSelectedPart({ rotationX: 0, rotationY: 0, rotationZ: 0 });
    this.showToast('↺ Rotación restablecida a 0°');
  }

  updatePartDiameter(diameter: number) {
    const sel = this.selectedPart();
    if (!sel || isNaN(diameter) || diameter <= 0) return;
    const d = Math.max(10, Math.round(diameter));
    const r = Math.round(d / 2);
    this.updateSelectedPart({
      diameter: d,
      radius: r,
      width: d
    });
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

    const bounds = this.joineryEngine.getPartBounds(current);
    const sy = bounds.sy;

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

  /**
   * Elimina la pieza o conjunto de piezas seleccionadas en una única transacción de historial.
   */
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
      this.projectService.deleteMultipleParts(selIds);
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

  // --- CATÁLOGO DE PIEZAS INDIVIDUALES ---

  addPieceFromCatalog(role: ComponentRole) {
    const mats = this.materials();
    const mainMat = mats.find(m => m.hasGrain) || mats[0];
    const whiteMat = mats.find(m => !m.hasGrain && m.thickness >= 15) || mats[0];
    const mdfMat = mats.find(m => m.thickness <= 6) || mats[0];

    const defaultT = 15;
    let newPart: Part;

    const currentParts = this.currentParts();
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

      default:
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

    if (this.isPieceNameTaken(newPart.name)) {
      newPart.name = this.getNextUniquePieceName(newPart.name);
    }
    this.projectService.addPart(newPart);
    this.selectedPartId.set(newPart.id);
    this.activeDockTab.set('piece');
  }

  onClearanceCalculated(info: ClearanceInfo | null) {
    this.clearanceInfo.set(info);
  }

  // --- ACCIONES DE LIENZO Y PLANTILLAS ---

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

  // --- ACORDEÓN Y GESTIÓN DE GRUPOS ---

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

  // --- ASISTENTE DE CAJÓN MODULAR ---

  openDrawerWizard() {
    const uniqueName = this.getNextUniqueGroupName('Cajón');
    const defaultMat = this.materials()[0];
    const mdfMat = this.materials().find(m => m.thickness === 3) || defaultMat;
    this.drawerForm.set({
      name: uniqueName,
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
      posY: 100 + (this.groups().length) * 200,
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
    const cleanName = config.name.trim();
    if (!cleanName) {
      this.showToast('⚠️ Ingresa un nombre para el cajón');
      return;
    }
    if (this.isGroupNameTaken(cleanName)) {
      const suggestion = this.getNextUniqueGroupName('Cajón');
      this.showToast(`⚠️ Ya existe un cajón llamado "${cleanName}". Sugerencia: ${suggestion}`);
      return;
    }
    const grp = this.projectService.addParametricDrawer({ ...config, name: cleanName });
    this.showDrawerWizard.set(false);
    this.selectEntireGroup(grp.id);
    this.openGroupCardIds.update(s => new Set(s).add(grp.id));
    this.showToast(`✨ ${grp.name} generado con 5-6 piezas ensambladas`);
  }

  // --- AGRUPACIÓN MANUAL Y DESAGRUPACIÓN ---

  openGroupNamingModal() {
    const selCount = this.selectedPartIds().length;
    if (selCount < 2) {
      this.showToast('Selecciona al menos 2 piezas para agrupar (usa Shift+Clic en 3D o en lista)');
      return;
    }
    const selParts = this.currentParts().filter(p => this.selectedPartIds().includes(p.id));
    const isDrawerLike = selParts.some(p =>
      p.name.toUpperCase().includes('CAJ') ||
      p.name.toUpperCase().includes('GAVET') ||
      p.componentRole?.includes('drawer')
    );
    const baseDefault = isDrawerLike ? 'Cajón' : 'Conjunto';
    const uniqueName = this.getNextUniqueGroupName(baseDefault);
    this.newGroupNameInput.set(uniqueName);
    this.showGroupNamingModal.set(true);
  }

  closeGroupNamingModal() {
    this.showGroupNamingModal.set(false);
  }

  confirmCreateGroup() {
    const selIds = this.selectedPartIds();
    if (selIds.length < 2) return;

    const selParts = this.currentParts().filter(p => selIds.includes(p.id));
    const isDrawerLike = selParts.length >= 4 && selParts.every(p =>
      p.componentRole?.includes('drawer') || p.id.includes('caj_ind_')
    );
    const baseDefault = isDrawerLike ? 'Cajón' : 'Conjunto';
    const name = this.newGroupNameInput().trim() || this.getNextUniqueGroupName(baseDefault);

    if (this.isGroupNameTaken(name)) {
      const suggestion = this.getNextUniqueGroupName(baseDefault);
      this.showToast(`⚠️ Ya existe un grupo llamado "${name}". Sugerencia: ${suggestion}`);
      return;
    }

    const groupType: 'drawer' | 'assembly' = isDrawerLike ? 'drawer' : 'assembly';
    const grp = this.projectService.createGroup(name, selIds, groupType);
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
    this.viewer3d()?.setActiveTool('move');
  }

  toggleSelectedGroupOpen() {
    const gId = this.activeSelectedGroupId();
    if (gId) {
      this.viewer3d()?.toggleGroupAnimation(gId);
      this.projectService.toggleGroupOpen(gId);
      return;
    }
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId) || this.selectedPart();
    if (part?.groupId) {
      this.viewer3d()?.toggleGroupAnimation(part.groupId);
      this.projectService.toggleGroupOpen(part.groupId);
    } else if (part) {
      this.viewer3d()?.togglePartOpen(part.id);
    }
  }

  isGroupOpen(): boolean {
    const gId = this.activeSelectedGroupId();
    if (gId) {
      return this.viewer3d()?.isGroupOpen(gId) ?? false;
    }
    const ids = this.selectedPartIds();
    const part = this.currentParts().find(p => ids.includes(p.id) && p.groupId) || this.selectedPart();
    if (part?.groupId) {
      return this.viewer3d()?.isGroupOpen(part.groupId) ?? false;
    } else if (part) {
      return this.viewer3d()?.isPartOpen(part.id) ?? false;
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

  startRenameActiveGroup(event?: MouseEvent) {
    if (event) event.stopPropagation();
    const gId = this.activeSelectedGroupId();
    if (!gId) return;
    const name = this.activeSelectedGroupName() || 'Cajón';
    this.renamingGroupId.set(gId);
    this.renamingGroupName.set(name);
  }

  saveRenameActiveGroup() {
    const gId = this.renamingGroupId();
    if (!gId) return;
    this.saveRenameGroup(gId);
  }

  startRenameGroup(group: PartGroup, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.renamingGroupId.set(group.id);
    this.renamingGroupName.set(group.name);
  }

  saveRenameGroup(groupId: string) {
    const name = this.renamingGroupName().trim();
    if (!name) {
      this.cancelRenameGroup();
      return;
    }
    if (this.isGroupNameTaken(name, groupId)) {
      const suggestion = this.getNextUniqueGroupName(name);
      this.showToast(`⚠️ Ya existe otro cajón llamado "${name}". Sugerencia: ${suggestion}`);
      return;
    }
    this.projectService.updateGroup(groupId, { name });
    this.showToast(`✏️ Grupo renombrado a "${name}"`);
    this.renamingGroupId.set(null);
  }

  cancelRenameGroup() {
    this.renamingGroupId.set(null);
  }

  isGroupNameTaken(name: string, excludeGroupId?: string | null): boolean {
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return this.groups().some(g => g.id !== excludeGroupId && g.name.trim().toLowerCase() === clean);
  }

  getNextUniqueGroupName(baseName = 'Cajón'): string {
    const existing = this.groups().map(g => g.name.trim().toLowerCase());
    let counter = 1;
    while (existing.includes(`${baseName.toLowerCase()} ${counter}`)) {
      counter++;
    }
    return `${baseName} ${counter}`;
  }

  isPieceNameTaken(name: string, excludePartId?: string | null): boolean {
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return this.currentParts().some(p => p.id !== excludePartId && p.name.trim().toLowerCase() === clean);
  }

  getNextUniquePieceName(baseName: string): string {
    const cleanBase = baseName.trim().replace(/\s+\(Copia.*?\)$/i, '').replace(/\s+\d+$/, '').trim();
    const existing = this.currentParts().map(p => p.name.trim().toLowerCase());
    if (!existing.includes(cleanBase.toLowerCase())) {
      return cleanBase;
    }
    let counter = 2;
    while (existing.includes(`${cleanBase.toLowerCase()} ${counter}`)) {
      counter++;
    }
    return `${cleanBase} ${counter}`;
  }

  // --- RENOMBRADO DE PIEZAS ---

  startRenameSelectedPart(event?: MouseEvent) {
    if (event) event.stopPropagation();
    const part = this.selectedPart();
    if (!part) return;
    this.renamingPartId.set(part.id);
    this.renamingPartName.set(part.name);
  }

  saveRenameSelectedPart() {
    const partId = this.renamingPartId();
    if (!partId) return;
    this.saveRenamePart(partId);
  }

  startRenamePart(part: Part, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.renamingPartId.set(part.id);
    this.renamingPartName.set(part.name);
  }

  saveRenamePart(partId: string) {
    const newName = this.renamingPartName().trim();
    if (!newName) {
      this.cancelRenamePart();
      return;
    }
    const part = this.currentParts().find(p => p.id === partId);
    if (!part) {
      this.cancelRenamePart();
      return;
    }
    if (this.isPieceNameTaken(newName, partId)) {
      const suggestion = this.getNextUniquePieceName(newName);
      this.showToast(`⚠️ Ya existe otra pieza llamada "${newName}". Sugerencia: ${suggestion}`);
      return;
    }
    this.projectService.updatePart({ ...part, name: newName });
    this.showToast(`✏️ Pieza renombrada a "${newName}"`);
    this.renamingPartId.set(null);
  }

  cancelRenamePart() {
    this.renamingPartId.set(null);
    this.renamingPartName.set('');
  }

  roundPercent(val?: number): number {
    return Math.round((val || 0) * 100);
  }

  // --- VISIBILIDAD DE PIEZAS Y GRUPOS ---

  isPartHidden(partId: string): boolean {
    return this.hiddenPartIds().has(partId);
  }

  isGroupHidden(groupId: string): boolean {
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    if (groupParts.length === 0) return false;
    return groupParts.every(p => this.hiddenPartIds().has(p.id));
  }

  isGroupPartiallyHidden(groupId: string): boolean {
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    if (groupParts.length === 0) return false;
    const hiddenCount = groupParts.filter(p => this.hiddenPartIds().has(p.id)).length;
    return hiddenCount > 0 && hiddenCount < groupParts.length;
  }

  hideSelectedPart() {
    const selId = this.selectedPartId();
    if (!selId) return;
    const part = this.currentParts().find(p => p.id === selId);
    const partName = part ? part.name : 'Pieza';

    const next = new Set(this.hiddenPartIds());
    next.add(selId);
    this.hiddenPartIds.set(next);

    this.viewer3d()?.hidePartById(selId);

    this.selectedPartId.set(null);
    this.selectedPartIds.set([]);
    this.activeDockTab.set('catalog');

    this.showToast(`👁️ "${partName}" oculta temporalmente (Alt+H para mostrar)`);
  }

  hideActiveGroup() {
    const gId = this.activeSelectedGroupId();
    if (!gId) return;
    const group = this.groups().find(g => g.id === gId);
    const groupName = group ? group.name : 'Grupo';
    const groupParts = this.currentParts().filter(p => p.groupId === gId);
    if (groupParts.length === 0) return;

    const next = new Set(this.hiddenPartIds());
    const partIds = groupParts.map(p => p.id);
    for (const id of partIds) {
      next.add(id);
    }
    this.hiddenPartIds.set(next);

    this.viewer3d()?.hidePartsByIds(partIds);
    this.deselectAll();

    this.showToast(`👁️ "${groupName}" oculto (${groupParts.length} piezas). Alt+H para mostrar`);
  }

  togglePartVisibility(partId: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    const part = this.currentParts().find(p => p.id === partId);
    const partName = part ? part.name : 'Pieza';

    const next = new Set(this.hiddenPartIds());
    if (next.has(partId)) {
      next.delete(partId);
      this.hiddenPartIds.set(next);
      this.viewer3d()?.showPartById(partId);
      this.showToast(`👁️ "${partName}" visible`);
    } else {
      next.add(partId);
      this.hiddenPartIds.set(next);
      this.viewer3d()?.hidePartById(partId);
      if (this.selectedPartId() === partId) {
        this.selectedPartId.set(null);
        this.selectedPartIds.set([]);
        this.activeDockTab.set('catalog');
      }
      this.showToast(`👁️ "${partName}" oculta`);
    }
  }

  toggleGroupVisibility(groupId: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    const group = this.groups().find(g => g.id === groupId);
    const groupName = group ? group.name : 'Grupo';
    const groupParts = this.currentParts().filter(p => p.groupId === groupId);
    if (groupParts.length === 0) return;

    const partIds = groupParts.map(p => p.id);
    const allHidden = partIds.every(id => this.hiddenPartIds().has(id));

    const next = new Set(this.hiddenPartIds());
    if (allHidden) {
      for (const id of partIds) {
        next.delete(id);
      }
      this.hiddenPartIds.set(next);
      this.viewer3d()?.showPartsByIds(partIds);
      this.showToast(`👁️ "${groupName}" visible`);
    } else {
      for (const id of partIds) {
        next.add(id);
      }
      this.hiddenPartIds.set(next);
      this.viewer3d()?.hidePartsByIds(partIds);
      if (this.activeSelectedGroupId() === groupId) {
        this.deselectAll();
      }
      this.showToast(`👁️ "${groupName}" oculto`);
    }
  }

  showAllParts() {
    const prevCount = this.hiddenPartIds().size;
    if (prevCount === 0) {
      this.showToast('Todas las piezas ya son visibles');
      return;
    }
    this.hiddenPartIds.set(new Set());
    this.viewer3d()?.showAllParts();
    this.showToast(`👁️ Se restauraron ${prevCount} pieza(s) ocultas`);
  }

  onHiddenPartsChangedFromViewer(hiddenIds: string[]) {
    this.hiddenPartIds.set(new Set(hiddenIds));
  }

  // --- MODO HABITACIÓN Y ENTORNO ARQUITECTÓNICO ---

  setWorkspaceMode(mode: WorkspaceMode) {
    this.workspaceMode.set(mode);
    if (mode === 'room') {
      setTimeout(() => {
        this.viewer3d()?.frameRoomView();
      }, 60);
      this.showToast('🏠 Modo Habitación 3D activado');
    } else {
      this.showToast('🪵 Modo Módulo Individual activado');
    }
  }

  toggleWorkspaceMode() {
    this.setWorkspaceMode(this.workspaceMode() === 'module' ? 'room' : 'module');
  }

  openRoomSettings() {
    this.showRoomSettingsModal.set(true);
  }

  closeRoomSettings() {
    this.showRoomSettingsModal.set(false);
  }

  updateRoomConfig(updates: Partial<RoomConfiguration>) {
    this.roomConfig.update(c => ({ ...c, ...updates }));
  }

  setRoomLayout(layout: RoomLayoutType) {
    this.updateRoomConfig({ layout });
    const label = layout === 'u_shape' ? 'Distribución en U' : layout === 'l_shape' ? 'Esquina en L' : 'Pared Recta';
    this.showToast(`📐 Disposición: ${label}`);
  }

  setFloorMaterial(mat: FloorMaterialType) {
    this.updateRoomConfig({ floorMaterial: mat });
    this.showToast('✨ Material de piso actualizado');
  }

  setWallMaterial(mat: WallMaterialType) {
    this.updateRoomConfig({ wallMaterial: mat });
    this.showToast('🎨 Material de pared actualizado');
  }

  setFloorCategory(cat: FloorFinishCategory) {
    this.activeFloorCategory.set(cat);
  }

  setWallCategory(cat: WallFinishCategory) {
    this.activeWallCategory.set(cat);
  }

  toggleFloorGrid() {
    this.updateRoomConfig({ showFloorGrid: !this.roomConfig().showFloorGrid });
  }

  toggleSkirting() {
    this.updateRoomConfig({ showSkirting: !this.roomConfig().showSkirting });
  }

  frameRoomCamera() {
    this.viewer3d()?.frameRoomView();
  }

  alignWallsToEdge() {
    this.updateRoomConfig({ wallOffsetX: 0, wallOffsetZ: 0 });
    this.showToast('📐 Muros alineados al borde exacto del piso');
  }

  nudgeWalls(dx: number, dz: number) {
    const curX = this.roomConfig().wallOffsetX ?? 0;
    const curZ = this.roomConfig().wallOffsetZ ?? 0;
    this.updateRoomConfig({
      wallOffsetX: curX + dx,
      wallOffsetZ: curZ + dz
    });
  }

  stretchMainWall(delta: number) {
    const curL = this.roomConfig().mainWallLength;
    const nextL = Math.max(1200, Math.min(10000, curL + delta));
    this.updateRoomConfig({ mainWallLength: nextL });
    this.showToast(`📏 Muro Principal: ${nextL} mm`);
  }

  stretchSideWall(delta: number) {
    const curL = this.roomConfig().sideWallLength;
    const nextL = Math.max(1000, Math.min(10000, curL + delta));
    this.updateRoomConfig({ sideWallLength: nextL });
    this.showToast(`📏 Muro Lateral: ${nextL} mm`);
  }

  setFloorDimensions(width: number, depth: number) {
    this.updateRoomConfig({
      floorWidth: width,
      floorDepth: depth
    });
    this.showToast(`📐 Suelo ampliado: ${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`);
  }

  onWallSelected(wall: 'main' | 'side' | null) {
    this.selectedWall.set(wall);
    if (wall) {
      this.showToast(`🧱 Seleccionado: ${wall === 'main' ? 'Muro Principal' : 'Muro Lateral L'}`);
    }
  }

  moveEntireFurniture() {
    this.selectAllParts();
    this.activateMoveToolOnViewer();
    this.showToast('🧲 Mueble completo listo: arrástralo libremente hacia las paredes con imán inteligente');
  }
}