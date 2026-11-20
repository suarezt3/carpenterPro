import { Injectable, signal, computed, inject } from '@angular/core';
import {
  FurnitureModule,
  HardwareItem,
  Material,
  ParametricCabinetConfig,
  ParametricDrawerConfig,
  ParametricModuleLineageEntry,
  Part,
  PartGroup,
  Project,
  ProjectNoteItem,
  ProjectSettings,
  ApplianceItem,
  CabinetOpeningSystem,
  CabinetZoneContent,
  CabinetZoneNode,
  ComponentRole,
  CountertopLayoutShape,
  HandleFinish,
  HandleType,
  PartCornerCutConfig,
  isCountertopMaterial,
  isPartParametricGenerated,
  isStandaloneModularDrawerGroup,
  DEFAULT_COUNTERTOP_MATERIALS,
  RoomConfiguration,
  DEFAULT_ROOM_CONFIG,
  getResolvedRoomWalls,
  rescaleWallsToFloor,
  WorkspaceMode,
  Camera3DState,
  DrawerFrontMountType,
  DrawerOpeningSystem,
  ModuleCavityInfo,
  SlideType,
  CollisionFixOption,
  DoorConfigurationMode,
  DoorHandleVerticalPosition,
  HingeType,
  PartHardwareConfig
} from '../models/melamine.models';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { CutOptimizerService } from './cut-optimizer.service';
import { SupabaseService, CloudProjectRecord } from './supabase.service';
import { FurnitureTemplate } from './templates-catalog.service';
import { MELAMINE_MATERIALS_CATALOG } from '../data/melamine-catalog.data';

declare module '../models/melamine.models' {
  interface ParametricDrawerConfig {
    recessBehindDoor?: boolean;
  }
}

export type ModularDrawerConfig = ParametricDrawerConfig;

const STORAGE_KEY = 'melamipro_current_project';
const PROJECTS_LIST_KEY = 'melamipro_saved_projects_meta';

/**
 * Metadatos ligeros para listar proyectos guardados en localStorage
 * sin necesidad de parsear todas las piezas y módulos de cada proyecto.
 */
export interface ProjectMeta {
  id: string;
  name: string;
  clientName: string;
  updatedAt: string;
  modulesCount: number;
  partsCount: number;
}

/**
 * Formatea valores numéricos a la moneda configurada en el proyecto (COP, CLP, MXN, USD, etc.).
 */
export function formatCurrencyValue(amount: number, currency = 'COP'): string {
  const num = Number(amount) || 0;
  const curr = (currency || 'COP').toUpperCase();
  switch (curr) {
    case 'COP':
      return '$ ' + Math.round(num).toLocaleString('es-CO') + ' COP';
    case 'CLP':
      return '$ ' + Math.round(num).toLocaleString('es-CL') + ' CLP';
    case 'ARS':
      return '$ ' + Math.round(num).toLocaleString('es-AR') + ' ARS';
    case 'MXN':
      return '$ ' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
    case 'EUR':
      return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' € EUR';
    case 'PEN':
      return 'S/ ' + num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PEN';
    case 'USD':
    default:
      return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + curr;
  }
}

/**
 * Normaliza los nombres de materiales eliminando sufijos redundantes de espesor.
 */
export function cleanMaterialName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\d+\s*mm\s*(\(Fondos\))?/gi, '')
    .replace(/\s*\(Fondos\)/gi, '')
    .replace(/^MDF\s*\/\s*Durolac/i, 'MDF Durolac')
    .trim();
}

function isPhysicalHandleType(ht: HandleType | undefined): boolean {
  return Boolean(
    ht &&
      ht !== 'none' &&
      ht !== 'push' &&
      ht !== 'push_open' &&
      ht !== 'gola_less' &&
      ht !== 'gola' &&
      ht !== 'finger_pull'
  );
}

function resolveDrawerOpeningFromHandle(ht: HandleType): DrawerOpeningSystem {
  if (ht === 'none' || ht === 'push_open' || ht === 'push') {
    return 'push';
  }
  if (ht === 'gola_less' || ht === 'gola') {
    return 'gola';
  }
  if (ht === 'finger_pull') {
    return 'finger_pull';
  }
  return 'handle';
}

function mapZoneTreeNodes(
  node: CabinetZoneNode | undefined,
  mapper: (node: CabinetZoneNode) => CabinetZoneContent | undefined
): CabinetZoneNode | undefined {
  if (!node) return undefined;
  const nextContent = node.content ? mapper(node) : undefined;
  return {
    ...node,
    ...(nextContent ? { content: nextContent } : {}),
    ...(node.children
      ? {
          children: node.children.map(
            child => mapZoneTreeNodes(child, mapper) ?? child
          )
        }
      : {})
  };
}

function findZoneContentById(
  node: CabinetZoneNode | undefined,
  zoneId: string
): CabinetZoneContent | undefined {
  if (!node) return undefined;
  if (node.id === zoneId) return node.content;
  if (!node.children) return undefined;
  for (const child of node.children) {
    const found = findZoneContentById(child, zoneId);
    if (found) return found;
  }
  return undefined;
}

function isSlidingDoorOrFixedBlindPanel(part: Part, zoneTree?: CabinetZoneNode): boolean {
  const upperName = (part.name || '').toUpperCase();
  if (upperName.includes('PANEL CIEGO')) {
    return true;
  }
  const lowerName = (part.name || '').toLowerCase();
  const lowerNotes = (part.notes || '').toLowerCase();
  if (
    lowerName.includes('corrediz') ||
    lowerNotes.includes('corrediz') ||
    lowerNotes.includes('riel')
  ) {
    return true;
  }
  if (part.zoneId && zoneTree) {
    const content = findZoneContentById(zoneTree, part.zoneId);
    if (content?.type === 'doors' && content.doors?.opening === 'sliding') {
      return true;
    }
  }
  return false;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectStorageService {
  private cabinetGen = inject(CabinetGeneratorService);
  private joineryEngine = inject(JoineryEngineService);
  private partGeometry = inject(PartGeometryService);
  private cutOptimizer = inject(CutOptimizerService);
  readonly supabase = inject(SupabaseService);
  private autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private localSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingStorageProject: Project | null = null;

  // Pilas de historial Undo / Redo (almacenan snapshots profundos del proyecto activo)
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  readonly canUndo = signal<boolean>(false);
  readonly canRedo = signal<boolean>(false);

  // Preferencia de sincronización automática con Supabase (por defecto manual para ahorrar cuota)
  readonly autoSyncEnabled = signal<boolean>(this.loadAutoSyncPreference());

  // Estado reactivo principal del proyecto activo y lista de proyectos locales
  readonly currentProject = signal<Project>(this.getInitialProject());
  readonly savedProjects = signal<ProjectMeta[]>(this.loadSavedProjectsList());

  // Signals computados derivados automáticamente del proyecto actual
  readonly totalPartsCount = computed(() => {
    return this.currentProject().parts.reduce((sum, p) => sum + p.quantity, 0);
  });

  readonly materialsList = computed(() => this.currentProject().materials);
  readonly modulesList = computed(() => this.currentProject().modules);
  readonly partsList = computed(() => this.currentProject().parts);

  /**
   * Filtra únicamente los grupos que aún tienen piezas activas asociadas en el proyecto.
   */
  readonly groupsList = computed(() => {
    const parts = this.currentProject().parts;
    const groups = this.currentProject().groups || [];
    const activeGroupIds = new Set(parts.map(p => p.groupId).filter(Boolean));
    return groups.filter(g => activeGroupIds.has(g.id));
  });

  readonly hardwareList = computed(() => this.currentProject().hardware);
  readonly appliancesList = computed<ApplianceItem[]>(() => this.currentProject().appliances || []);
  readonly selectedApplianceId = signal<string | null>(null);
  readonly selectedApplianceIds = signal<string[]>([]);
  readonly selectedAppliance = computed<ApplianceItem | null>(() => {
    const id = this.selectedApplianceId();
    if (!id) return null;
    return (this.appliancesList() || []).find(a => a.id === id) || null;
  });
  readonly projectSettings = computed(() => this.currentProject().settings);
  readonly projectNotes = computed<ProjectNoteItem[]>(() => this.currentProject().projectNotes || []);

  // Estado global persistente del entorno Habitación 3D, Cámara 3D y Selección del Diseñador
  readonly workspaceMode = computed<WorkspaceMode>(() => this.currentProject().workspaceMode || 'module');
  readonly roomConfig = computed<RoomConfiguration>(() => this.currentProject().roomConfig || DEFAULT_ROOM_CONFIG);
  readonly lastCameraState = signal<Camera3DState | null>(this.currentProject().cameraState || null);
  readonly selectedWallId = signal<string | null>(null);
  readonly designerSelectedPartId = signal<string | null>(null);
  readonly designerSelectedPartIds = signal<string[]>([]);
  readonly designerActiveDockTab = signal<'piece' | 'catalog' | 'appliances'>('catalog');
  readonly designerRoomDockSubTab = signal<'wall' | 'environment' | 'finishes'>('wall');
  readonly designerSessionInitialized = signal<boolean>(false);

  // ==========================================
  // GESTIÓN DE NOTAS DEL PROYECTO
  // ==========================================

  addProjectNote(noteData: Omit<ProjectNoteItem, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const newNote: ProjectNoteItem = {
      ...noteData,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now
    };
    this.updateProject(p => ({
      ...p,
      projectNotes: [newNote, ...(p.projectNotes || [])]
    }));
    return newNote;
  }

  updateProjectNote(id: string, updates: Partial<ProjectNoteItem>) {
    const now = new Date().toISOString();
    this.updateProject(p => ({
      ...p,
      projectNotes: (p.projectNotes || []).map(n =>
        n.id === id ? { ...n, ...updates, updatedAt: now } : n
      )
    }));
  }

  deleteProjectNote(id: string) {
    this.updateProject(p => ({
      ...p,
      projectNotes: (p.projectNotes || []).filter(n => n.id !== id)
    }));
  }

  toggleProjectNoteComplete(id: string) {
    const now = new Date().toISOString();
    this.updateProject(p => ({
      ...p,
      projectNotes: (p.projectNotes || []).map(n =>
        n.id === id ? { ...n, completed: !n.completed, updatedAt: now } : n
      )
    }));
  }

  // ==========================================
  // GESTIÓN DE ELECTRODOMÉSTICOS Y ACCESORIOS 3D
  // ==========================================

  addAppliance(appliance: ApplianceItem) {
    this.updateProject(p => ({
      ...p,
      appliances: [...(p.appliances || []), appliance]
    }));
    this.selectedApplianceId.set(appliance.id);
  }

  updateAppliance(id: string, updates: Partial<ApplianceItem>) {
    this.updateProject(p => ({
      ...p,
      appliances: (p.appliances || []).map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, ...updates };
        if ('groupId' in updates && updates.groupId === undefined) {
          delete updated.groupId;
        }
        return updated;
      })
    }));
  }

  removeAppliance(id: string) {
    if (this.selectedApplianceId() === id) {
      this.selectedApplianceId.set(null);
    }
    this.updateProject(p => ({
      ...p,
      appliances: (p.appliances || []).filter(a => a.id !== id)
    }));
  }

  duplicateAppliance(id: string) {
    const existing = (this.currentProject().appliances || []).find(a => a.id === id);
    if (!existing) return;
    const copy: ApplianceItem = {
      ...existing,
      id: 'appliance_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: `${existing.name} (Copia)`,
      position: {
        x: existing.position.x + 80,
        y: existing.position.y,
        z: existing.position.z + 80
      }
    };
    this.updateProject(p => ({
      ...p,
      appliances: [...(p.appliances || []), copy]
    }));
    this.selectedApplianceId.set(copy.id);
  }

  duplicateMultipleAppliances(ids: string[]): string[] {
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    const existingList = (this.currentProject().appliances || []).filter(a => idSet.has(a.id));
    if (existingList.length === 0) return [];

    const copies: ApplianceItem[] = existingList.map((existing, idx) => ({
      ...existing,
      id: 'appliance_' + (Date.now() + idx) + '_' + Math.random().toString(36).substring(2, 6),
      name: `${existing.name} (Copia)`,
      position: {
        x: existing.position.x + 80,
        y: existing.position.y,
        z: existing.position.z + 80
      }
    }));

    this.updateProject(p => ({
      ...p,
      appliances: [...(p.appliances || []), ...copies]
    }));
    const newIds = copies.map(c => c.id);
    this.selectedApplianceIds.set(newIds);
    this.selectedApplianceId.set(newIds[0]);
    return newIds;
  }

  selectAppliance(id: string | null) {
    this.selectedApplianceId.set(id);
    this.selectedApplianceIds.set(id ? [id] : []);
  }

  selectAppliances(ids: string[]) {
    this.selectedApplianceIds.set(ids);
    this.selectedApplianceId.set(ids.length > 0 ? ids[0] : null);
  }

  toggleApplianceSelection(id: string) {
    const set = new Set(this.selectedApplianceIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    const arr = Array.from(set);
    this.selectedApplianceIds.set(arr);
    this.selectedApplianceId.set(arr.length > 0 ? arr[0] : null);
  }

  updateMultipleAppliances(updatesList: { id: string; updates: Partial<ApplianceItem> }[]) {
    if (updatesList.length === 0) return;
    const updatesMap = new Map(updatesList.map(u => [u.id, u.updates]));
    this.updateProject(p => ({
      ...p,
      appliances: (p.appliances || []).map(a => {
        const upd = updatesMap.get(a.id);
        if (!upd) return a;
        const updated = { ...a, ...upd };
        if ('groupId' in upd && upd.groupId === undefined) {
          delete updated.groupId;
        }
        return updated;
      })
    }));
  }

  removeMultipleAppliances(ids: string[]) {
    const idsSet = new Set(ids);
    if (this.selectedApplianceId() && idsSet.has(this.selectedApplianceId()!)) {
      this.selectedApplianceId.set(null);
    }
    this.selectedApplianceIds.set(this.selectedApplianceIds().filter(id => !idsSet.has(id)));
    this.updateProject(p => ({
      ...p,
      appliances: (p.appliances || []).filter(a => !idsSet.has(a.id))
    }));
  }

  linkApplianceToGroup(applianceId: string, groupId: string | null) {
    this.updateAppliance(applianceId, { groupId: groupId || undefined });
  }

  unhideAllAppliances() {
    this.updateProject(p => ({
      ...p,
      appliances: (p.appliances || []).map(a => a.isHidden ? { ...a, isHidden: false } : a)
    }));
  }

  formatCurrency(amount: number): string {
    return formatCurrencyValue(amount, this.projectSettings().currency);
  }

  updateCurrency(currency: string) {
    this.updateProject(p => ({
      ...p,
      settings: {
        ...p.settings,
        currency
      }
    }));
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private loadAutoSyncPreference(): boolean {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('melamipro_auto_sync_cloud') === 'true';
    }
    return false;
  }

  toggleAutoSync() {
    const next = !this.autoSyncEnabled();
    this.autoSyncEnabled.set(next);
    if (this.isBrowser()) {
      localStorage.setItem('melamipro_auto_sync_cloud', next ? 'true' : 'false');
    }
    if (next) {
      this.scheduleCloudAutoSync(this.currentProject());
    } else if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
      this.autoSyncTimeout = null;
    }
  }

  constructor() {
    if (this.isBrowser()) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        this.saveToStorage(this.currentProject(), true);
      }
      // Garantizar volcado inmediato a localStorage si el usuario cierra o recarga la pestaña dentro de la ventana de debounce
      const flushHandler = () => this.flushPendingStorageSave();
      window.addEventListener('beforeunload', flushHandler);
      window.addEventListener('pagehide', flushHandler);
    }
  }

  /**
   * Carga el proyecto activo desde localStorage o genera el proyecto de demostración inicial.
   */
  getInitialProject(): Project {
    if (this.isBrowser()) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id && parsed.parts) {
            const demo = this.createDemoProject();
            if (!parsed.materials) parsed.materials = [];
            for (const dm of demo.materials) {
              const existingIdx = parsed.materials.findIndex((m: Material) => m.id === dm.id);
              if (existingIdx === -1) {
                parsed.materials.push(dm);
              } else {
                parsed.materials[existingIdx].name = cleanMaterialName(parsed.materials[existingIdx].name);
                if (dm.category) parsed.materials[existingIdx].category = dm.category;
                if (dm.textureType) parsed.materials[existingIdx].textureType = dm.textureType;
                if (dm.family) parsed.materials[existingIdx].family = dm.family;
                if (dm.familyLabel) parsed.materials[existingIdx].familyLabel = dm.familyLabel;
                if (dm.brand) parsed.materials[existingIdx].brand = dm.brand;
                if (dm.thicknessSpecs) parsed.materials[existingIdx].thicknessSpecs = dm.thicknessSpecs;
              }
            }
            for (const ctMat of DEFAULT_COUNTERTOP_MATERIALS) {
              if (!parsed.materials.some((m: Material) => m.id === ctMat.id)) {
                parsed.materials.push(ctMat);
              }
            }
            parsed.materials = parsed.materials.map((m: Material) => ({
              ...m,
              name: cleanMaterialName(m.name)
            }));
            if (parsed.parts && Array.isArray(parsed.parts)) {
              parsed.parts = parsed.parts.map((p: Part) => ({
                ...p,
                materialName: cleanMaterialName(p.materialName)
              }));
            }
            if (!parsed.settings) {
              parsed.settings = demo.settings;
            } else if (!parsed.settings.defaultBoardThickness) {
              parsed.settings.defaultBoardThickness = 15;
            }
            if (!parsed.groups || !Array.isArray(parsed.groups)) {
              parsed.groups = [];
            }
            if (!parsed.appliances || !Array.isArray(parsed.appliances)) {
              parsed.appliances = [];
            }
            const mergedRoom: RoomConfiguration = {
              ...DEFAULT_ROOM_CONFIG,
              ...(parsed.roomConfig || {})
            };
            mergedRoom.walls = getResolvedRoomWalls(mergedRoom);
            parsed.roomConfig = mergedRoom;
            if (!parsed.workspaceMode) {
              parsed.workspaceMode = 'module';
            }
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse saved project from storage', e);
        }
      }
    }
    return this.createDemoProject();
  }

  /**
   * Crea el proyecto de referencia inicial desacoplado con el catálogo maestro de melaminas y piezas de muestra.
   */
  createDemoProject(): Project {
    const defaultMaterials: Material[] = [...MELAMINE_MATERIALS_CATALOG];
    const matRoble = defaultMaterials.find(m => m.id === 'mat_roble_18') || defaultMaterials[0];

    const initialParts: Part[] = [
      {
        id: 'desk_top',
        name: 'TECHO',
        length: 1800,
        width: 600,
        thickness: 15,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 0,
        posY: 992.5,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'top',
        notes: 'Cubierta superior barra'
      },
      {
        id: 'desk_left_side',
        name: 'LATERAL IZQUIERDO',
        length: 1000,
        width: 600,
        thickness: 15,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: -892.5,
        posY: 500,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'side_left',
        notes: 'Pata / lateral izquierdo'
      },
      {
        id: 'desk_center_divider',
        name: 'DIVISIÓN CENTRAL',
        length: 900,
        width: 600,
        thickness: 15,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'thin' },
        posX: 300,
        posY: 450,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'divider',
        notes: 'Separador interno'
      },
      {
        id: 'desk_right_side',
        name: 'LATERAL DERECHO',
        length: 1000,
        width: 600,
        thickness: 15,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 892.5,
        posY: 500,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'side_right',
        notes: 'Costado derecho'
      },
      {
        id: 'desk_bottom',
        name: 'PISO INFERIOR',
        length: 577.5,
        width: 600,
        thickness: 15,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 596.25,
        posY: 87.5,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'bottom',
        notes: 'Base del módulo'
      },
      {
        id: 'desk_plinth',
        name: 'ZÓCALO',
        length: 577.5,
        width: 80,
        thickness: 15,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 596.25,
        posY: 40,
        posZ: 260,
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo frontal'
      }
    ];

    const initialHardware: HardwareItem[] = [
      {
        id: 'hw_screws',
        name: 'Tornillos Soberbios 4x50mm',
        category: 'screw',
        unit: 'caja',
        quantity: 1,
        unitCost: 18000
      },
      {
        id: 'hw_corners',
        name: 'Escuadras de fijación metálicas',
        category: 'support',
        unit: 'und',
        quantity: 8,
        unitCost: 2500
      }
    ];

    const settings: ProjectSettings = {
      sawKerf: 4,
      trimMargin: 10,
      defaultBoardThickness: 15, // Espesor predeterminado 15 mm en todo el software
      thinEdgeThickness: 0.45,
      thickEdgeThickness: 2.0,
      thinEdgeCostPerMeter: 1800,
      thickEdgeCostPerMeter: 4200,
      optimizationPreference: 'best_fit',
      currency: 'COP'
    };

    return {
      id: 'proj_mueble_estudio',
      name: 'Mueble Barra con Módulo de Apoyo',
      clientName: 'Cliente Ejemplo - Residencia',
      date: new Date().toISOString().split('T')[0],
      notes: 'Estructura de barra con cubierta superior (1800x600 mm) y módulo de guardado lateral.',
      settings,
      materials: defaultMaterials,
      modules: [],
      parts: initialParts,
      groups: [],
      hardware: initialHardware,
      appliances: [],
      laborCost: 350000,
      laborType: 'fixed',
      profitMarginPercent: 25,
      taxPercent: 0,
      workspaceMode: 'module',
      roomConfig: {
        ...DEFAULT_ROOM_CONFIG,
        walls: getResolvedRoomWalls(DEFAULT_ROOM_CONFIG)
      },
      updatedAt: new Date().toISOString()
    };
  }

  // ==========================================
  // HISTORIAL DE CAMBIOS (UNDO / REDO)
  // ==========================================

  private cloneProjectSnapshot(proj: Project): Project {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(proj);
      } catch {
        // Fallback a JSON si algún objeto no es clonable directamente
      }
    }
    return JSON.parse(JSON.stringify(proj));
  }

  pushSnapshot() {
    try {
      const snap = this.cloneProjectSnapshot(this.currentProject());
      this.undoStack.push(snap);
      if (this.undoStack.length > 35) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.canUndo.set(this.undoStack.length > 0);
      this.canRedo.set(false);
    } catch {
      // Fallback seguro si falla la serialización
    }
  }

  saveUndoSnapshot(): void {
    this.pushSnapshot();
  }

  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.canUndo.set(false);
    this.canRedo.set(false);
  }

  undo() {
    if (this.undoStack.length === 0) return;
    try {
      const currentSnap = this.cloneProjectSnapshot(this.currentProject());
      this.redoStack.push(currentSnap);
      const prev = this.undoStack.pop()!;
      this.currentProject.set(prev);
      this.saveToStorage(prev);
      this.canUndo.set(this.undoStack.length > 0);
      this.canRedo.set(true);
    } catch {
      // Fallback
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    try {
      const currentSnap = this.cloneProjectSnapshot(this.currentProject());
      this.undoStack.push(currentSnap);
      const next = this.redoStack.pop()!;
      this.currentProject.set(next);
      this.saveToStorage(next);
      this.canUndo.set(true);
      this.canRedo.set(this.redoStack.length > 0);
    } catch {
      // Fallback
    }
  }

  // ==========================================
  // PERSISTENCIA LOCAL Y EN LA NUBE (SUPABASE)
  // ==========================================

  updateProject(mutator: (p: Project) => Project, recordHistory = true) {
    if (recordHistory) {
      this.pushSnapshot();
    }
    const updated = mutator({ ...this.currentProject() });
    updated.updatedAt = new Date().toISOString();
    this.currentProject.set(updated);
    this.saveToStorage(updated);
  }

  updateProjectName(name: string, clientName?: string) {
    const cleanName = name.trim() || 'Proyecto Melamina';
    const cleanClient = (clientName ?? '').trim();
    this.updateProject(p => ({
      ...p,
      name: cleanName,
      clientName: cleanClient
    }));
  }

  saveToStorage(project: Project, immediate = false) {
    if (!this.isBrowser()) return;

    // 1. Actualizar metadatos en memoria reactiva inmediatamente (sin parsear localStorage en cada cambio)
    const currentList = [...this.savedProjects()];
    const existingIndex = currentList.findIndex(p => p.id === project.id);
    const meta: ProjectMeta = {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      updatedAt: project.updatedAt,
      modulesCount: project.modules.length,
      partsCount: project.parts.reduce((s, p) => s + p.quantity, 0)
    };

    if (existingIndex >= 0) {
      currentList[existingIndex] = meta;
    } else {
      currentList.unshift(meta);
    }
    this.savedProjects.set(currentList);

    // 2. Diferir la serialización pesada JSON.stringify a localStorage con debounce de 280ms
    this.pendingStorageProject = project;
    if (this.localSaveTimeout) {
      clearTimeout(this.localSaveTimeout);
      this.localSaveTimeout = null;
    }

    if (immediate) {
      this.flushPendingStorageSave();
    } else {
      this.localSaveTimeout = setTimeout(() => {
        this.localSaveTimeout = null;
        this.flushPendingStorageSave();
      }, 280);
    }

    if (this.autoSyncEnabled()) {
      this.scheduleCloudAutoSync(project);
    } else if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
      this.autoSyncTimeout = null;
    }
  }

  /**
   * Vuelca inmediatamente cualquier cambio pendiente hacia localStorage,
   * serializando el proyecto una única vez.
   */
  flushPendingStorageSave() {
    if (!this.isBrowser() || !this.pendingStorageProject) return;
    const project = this.pendingStorageProject;
    this.pendingStorageProject = null;
    if (this.localSaveTimeout) {
      clearTimeout(this.localSaveTimeout);
      this.localSaveTimeout = null;
    }
    try {
      const serializedProject = JSON.stringify(project);
      localStorage.setItem(STORAGE_KEY, serializedProject);
      localStorage.setItem(`melamipro_project_${project.id}`, serializedProject);
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(this.savedProjects()));
    } catch (e) {
      console.error('Error writing project to localStorage', e);
    }
  }

  private scheduleCloudAutoSync(project: Project) {
    if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
    }
    this.autoSyncTimeout = setTimeout(() => {
      void this.supabase.saveProject(project);
    }, 1500);
  }

  async saveCurrentToCloud(): Promise<{ success: boolean; error?: string }> {
    return this.supabase.saveProject(this.currentProject());
  }

  async loadCloudProject(record: CloudProjectRecord) {
    if (!record) return;
    let projectData = record.data;

    if (!projectData && record.id) {
      const fullRecord = await this.supabase.getProjectById(record.id);
      if (fullRecord?.data) {
        projectData = fullRecord.data;
      }
    }

    if (projectData) {
      const mergedRoom: RoomConfiguration = {
        ...DEFAULT_ROOM_CONFIG,
        ...(projectData.roomConfig || {})
      };
      mergedRoom.walls = getResolvedRoomWalls(mergedRoom);
      projectData.roomConfig = mergedRoom;
      if (!projectData.workspaceMode) {
        projectData.workspaceMode = 'module';
      }
      this.clearHistory();
      this.selectedApplianceId.set(null);
      this.selectedWallId.set(null);
      this.lastCameraState.set(projectData.cameraState || null);
      this.designerSessionInitialized.set(false);
      this.currentProject.set(projectData);
      this.saveToStorage(projectData);
    }
  }

  async deleteCloudProject(id: string): Promise<boolean> {
    return this.supabase.deleteProject(id);
  }

  loadSavedProjectsList(): ProjectMeta[] {
    if (!this.isBrowser()) return [];
    const list = localStorage.getItem(PROJECTS_LIST_KEY);
    if (list) {
      try {
        return JSON.parse(list);
      } catch {
        return [];
      }
    }
    return [];
  }

  loadProjectById(id: string) {
    if (!this.isBrowser()) return;
    this.flushPendingStorageSave();
    const raw = localStorage.getItem(`melamipro_project_${id}`);
    if (raw) {
      try {
        const proj = JSON.parse(raw) as Project;
        const mergedRoom: RoomConfiguration = {
          ...DEFAULT_ROOM_CONFIG,
          ...(proj.roomConfig || {})
        };
        mergedRoom.walls = getResolvedRoomWalls(mergedRoom);
        proj.roomConfig = mergedRoom;
        if (!proj.workspaceMode) {
          proj.workspaceMode = 'module';
        }
        this.clearHistory();
        this.selectedApplianceId.set(null);
        this.selectedWallId.set(null);
        this.lastCameraState.set(proj.cameraState || null);
        this.designerSessionInitialized.set(false);
        this.currentProject.set(proj);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(proj));
      } catch (e) {
        console.error('Error loading project by ID', e);
      }
    }
  }

  deleteLocalProject(id: string) {
    if (!this.isBrowser()) return;
    localStorage.removeItem(`melamipro_project_${id}`);
    const list = this.loadSavedProjectsList().filter(p => p.id !== id);
    localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(list));
    this.savedProjects.set(list);
  }

  createNewProject(name = 'Nuevo Proyecto de Muebles', clientName = '') {
    const demo = this.createDemoProject();
    const newProj: Project = {
      ...demo,
      id: 'proj_' + crypto.randomUUID().slice(0, 8),
      name,
      clientName,
      date: new Date().toISOString().split('T')[0],
      notes: '',
      modules: [],
      parts: [],
      groups: [],
      appliances: [],
      hardware: [],
      updatedAt: new Date().toISOString()
    };
    this.clearHistory();
    this.selectedApplianceId.set(null);
    this.selectedWallId.set(null);
    this.lastCameraState.set(null);
    this.designerSessionInitialized.set(false);
    this.currentProject.set(newProj);
    this.saveToStorage(newProj);
  }

  resetToDemo() {
    const demo = this.createDemoProject();
    this.clearHistory();
    this.selectedApplianceId.set(null);
    this.selectedWallId.set(null);
    this.lastCameraState.set(null);
    this.designerSessionInitialized.set(false);
    this.currentProject.set(demo);
    this.saveToStorage(demo);
  }

  // ==========================================
  // ACCIONES DE MÓDULOS Y PLANTILLAS
  // ==========================================

  private filterOrphanModules(modules: FurnitureModule[], remainingParts: Part[]): FurnitureModule[] {
    if (!modules || modules.length === 0) return [];
    const usedModuleIds = new Set(remainingParts.map(pt => pt.moduleId).filter(Boolean));
    return modules.filter(m => usedModuleIds.has(m.id));
  }

  private filterOrphanDrawerHardware(
    hardware: HardwareItem[],
    remainingGroups: PartGroup[],
    forceRemoveGroupId?: string
  ): HardwareItem[] {
    if (!hardware || hardware.length === 0) return [];
    const activeGroupIds = new Set(remainingGroups.map(g => g.id));
    const seenIds = new Set<string>();
    const cleaned: HardwareItem[] = [];

    for (const item of hardware) {
      if (!item || !item.id || seenIds.has(item.id)) continue;
      if (item.id.startsWith('hw_slide_') || item.id.startsWith('hw_handle_')) {
        const ownerGroupId = item.id.startsWith('hw_slide_')
          ? item.id.slice('hw_slide_'.length)
          : item.id.slice('hw_handle_'.length);
        if (forceRemoveGroupId && ownerGroupId === forceRemoveGroupId) {
          continue;
        }
        if (ownerGroupId && !activeGroupIds.has(ownerGroupId)) {
          continue;
        }
      }
      seenIds.add(item.id);
      cleaned.push(item);
    }

    return cleaned;
  }

  private cloneParametricConfig(cfg: ParametricCabinetConfig): ParametricCabinetConfig {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(cfg);
      } catch {
        // Fallback a JSON si algún campo no fuera clonable
      }
    }
    return JSON.parse(JSON.stringify(cfg)) as ParametricCabinetConfig;
  }

  private transformPartsToGroupFrame(
    parts: Part[],
    targetCx: number,
    targetMinY: number,
    targetCz: number,
    facing: 'front' | 'right' | 'back' | 'left'
  ): Part[] {
    if (parts.length === 0) return parts;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const pt of parts) {
      const b = this.joineryEngine.getPartBounds(pt);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    const srcCx = (minX + maxX) / 2;
    const srcCz = (minZ + maxZ) / 2;
    const angleDelta: 0 | 90 | -90 | 180 =
      facing === 'right' ? 90 : facing === 'left' ? -90 : facing === 'back' ? 180 : 0;

    const rotated = parts.map(pt => {
      if (angleDelta === 0) return pt;
      const b = this.joineryEngine.getPartBounds(pt);
      const dx = b.px - srcCx;
      const dz = b.pz - srcCz;
      let newDx = dx;
      let newDz = dz;
      if (angleDelta === 90) {
        newDx = dz;
        newDz = -dx;
      } else if (angleDelta === -90) {
        newDx = -dz;
        newDz = dx;
      } else if (angleDelta === 180) {
        newDx = -dx;
        newDz = -dz;
      }

      const curOrient = pt.orientation || 'horizontal';
      let newOrient = curOrient;
      let newLength = pt.length;
      let newWidth = pt.width;

      if (Math.abs(angleDelta) === 90) {
        if (curOrient === 'horizontal') {
          newOrient = 'horizontal';
          newLength = pt.width;
          newWidth = pt.length;
        } else if (curOrient === 'vertical_xy') {
          newOrient = 'vertical_yz';
          const horiz = b.sx;
          const vert = b.sy;
          const isPlinth =
            pt.componentRole === 'plinth' ||
            pt.name.toUpperCase().includes('ZOCALO') ||
            pt.name.toUpperCase().includes('ZÓCALO');
          const isDrawerBox =
            pt.componentRole === 'drawer_box' ||
            pt.componentRole === 'drawer_lateral';
          if (isDrawerBox || (isPlinth && horiz > vert)) {
            newLength = horiz;
            newWidth = vert;
          } else {
            newLength = vert;
            newWidth = horiz;
          }
        } else if (curOrient === 'vertical_yz') {
          newOrient = 'vertical_xy';
          newLength = b.sz;
          newWidth = b.sy;
        }
      }

      return {
        ...pt,
        posX: Math.round((srcCx + newDx) * 10) / 10,
        posZ: Math.round((srcCz + newDz) * 10) / 10,
        orientation: newOrient,
        length: newLength,
        width: newWidth
      };
    });

    let rotMinX = Infinity;
    let rotMaxX = -Infinity;
    let rotMinY = Infinity;
    let rotMinZ = Infinity;
    let rotMaxZ = -Infinity;
    for (const pt of rotated) {
      const b = this.joineryEngine.getPartBounds(pt);
      if (b.minX < rotMinX) rotMinX = b.minX;
      if (b.maxX > rotMaxX) rotMaxX = b.maxX;
      if (b.minY < rotMinY) rotMinY = b.minY;
      if (b.minZ < rotMinZ) rotMinZ = b.minZ;
      if (b.maxZ > rotMaxZ) rotMaxZ = b.maxZ;
    }

    const dxMove = Math.round((targetCx - (rotMinX + rotMaxX) / 2) * 10) / 10;
    const dyMove = Math.round((targetMinY - rotMinY) * 10) / 10;
    const dzMove = Math.round((targetCz - (rotMinZ + rotMaxZ) / 2) * 10) / 10;

    return rotated.map(pt => ({
      ...pt,
      posX: Math.round(((pt.posX ?? 0) + dxMove) * 10) / 10,
      posY: Math.round(((pt.posY ?? 0) + dyMove) * 10) / 10,
      posZ: Math.round(((pt.posZ ?? 0) + dzMove) * 10) / 10
    }));
  }

  addParametricCabinet(cabinet: { module: FurnitureModule; parts: Part[]; group: PartGroup }) {
    const taggedParts: Part[] = cabinet.parts.map(pt => ({
      ...pt,
      isParametricGenerated: pt.isParametricGenerated ?? true
    }));
    this.updateProject(p => ({
      ...p,
      modules: [...p.modules, cabinet.module],
      groups: [...(p.groups || []), cabinet.group],
      parts: [...p.parts, ...taggedParts]
    }));
  }

  updateParametricCabinet(
    groupId: string,
    newParts: Part[],
    newName?: string,
    newConfig?: ParametricCabinetConfig,
    newModule?: FurnitureModule
  ) {
    this.applyParametricModulePartsUpdate(
      groupId,
      newParts,
      newName,
      newConfig,
      newModule,
      true,
      false
    );
  }

  /**
   * Actualiza en vivo las piezas y configuración de un módulo paramétrico/por zonas sin saturar
   * el historial Undo/Redo (`pushHistory = false` por defecto para vista previa en 60 FPS),
   * preservando `groupId`, limpiando módulos/herrajes huérfanos y sincronizando Despiece,
   * Optimizador 2D, Presupuesto, Etiquetas y Guía de Armado.
   */
  liveUpdateParametricModuleParts(
    groupId: string,
    parts: Part[],
    name?: string,
    config?: ParametricCabinetConfig,
    pushHistory = false,
    options?: { preserveTransform?: boolean; module?: FurnitureModule }
  ) {
    this.applyParametricModulePartsUpdate(
      groupId,
      parts,
      name,
      config,
      options?.module,
      pushHistory,
      Boolean(options?.preserveTransform)
    );
  }

  private applyManualPostUngroupOverrides(
    preparedParts: Part[],
    parametricGroupParts: Part[],
    activeLineageIds: ReadonlySet<string>
  ): Part[] {
    if (preparedParts.length === 0 || parametricGroupParts.length === 0) {
      return preparedParts;
    }

    const manuallyModifiedOriginals = parametricGroupParts.filter(
      pt =>
        pt.manuallyModifiedAfterUngroup === true &&
        Boolean(pt.sourceParametricModuleId) &&
        activeLineageIds.has(pt.sourceParametricModuleId!)
    );

    const primaryLineageId =
      parametricGroupParts.find(pt => pt.sourceParametricModuleId)?.sourceParametricModuleId;
    const primarySourceGroupId =
      parametricGroupParts.find(pt => pt.sourceParametricGroupId)?.sourceParametricGroupId;

    const result = preparedParts.map(pt =>
      primaryLineageId
        ? {
            ...pt,
            sourceParametricModuleId: pt.sourceParametricModuleId ?? primaryLineageId,
            ...(primarySourceGroupId && !pt.sourceParametricGroupId
              ? { sourceParametricGroupId: primarySourceGroupId }
              : {})
          }
        : { ...pt }
    );

    if (manuallyModifiedOriginals.length === 0) {
      return result;
    }

    const normName = (value: string | undefined): string => (value || '').trim().toLowerCase();
    const dist3D = (a: Part, b: Part): number => {
      const dx = (a.posX ?? 0) - (b.posX ?? 0);
      const dy = (a.posY ?? 0) - (b.posY ?? 0);
      const dz = (a.posZ ?? 0) - (b.posZ ?? 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    const matchedNewIndices = new Set<number>();

    const pickClosest = (orig: Part, candidateIndices: number[]): number => {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (const idx of candidateIndices) {
        if (matchedNewIndices.has(idx)) continue;
        const d = dist3D(orig, result[idx]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      }
      return bestIdx;
    };

    for (const orig of manuallyModifiedOriginals) {
      const roleMatchedIndices: number[] = [];
      for (let i = 0; i < result.length; i++) {
        if (matchedNewIndices.has(i)) continue;
        if (orig.componentRole && result[i].componentRole !== orig.componentRole) continue;
        roleMatchedIndices.push(i);
      }
      if (roleMatchedIndices.length === 0) continue;

      let chosenIdx = -1;
      const origNormName = normName(orig.name);

      // Nivel 1: mismo zoneId + mismo componentRole + mismo nombre normalizado
      if (orig.zoneId) {
        const tier1 = roleMatchedIndices.filter(
          i => result[i].zoneId === orig.zoneId && normName(result[i].name) === origNormName
        );
        if (tier1.length > 0) {
          chosenIdx = pickClosest(orig, tier1);
        }
      }

      // Nivel 2: mismo zoneId + mismo componentRole (priorizando índice ordinal si coincide, si no el más cercano)
      if (chosenIdx === -1 && orig.zoneId) {
        const origZoneBucket = parametricGroupParts.filter(
          pt => pt.zoneId === orig.zoneId && pt.componentRole === orig.componentRole
        );
        const newZoneBucketIndices: number[] = [];
        for (let i = 0; i < result.length; i++) {
          if (result[i].zoneId === orig.zoneId && result[i].componentRole === orig.componentRole) {
            newZoneBucketIndices.push(i);
          }
        }
        const origOrdinal = origZoneBucket.indexOf(orig);
        if (
          origOrdinal >= 0 &&
          origOrdinal < newZoneBucketIndices.length &&
          !matchedNewIndices.has(newZoneBucketIndices[origOrdinal])
        ) {
          chosenIdx = newZoneBucketIndices[origOrdinal];
        } else {
          const tier2 = roleMatchedIndices.filter(i => result[i].zoneId === orig.zoneId);
          if (tier2.length > 0) {
            chosenIdx = pickClosest(orig, tier2);
          }
        }
      }

      // Nivel 3: mismo componentRole + mismo nombre normalizado
      if (chosenIdx === -1) {
        const tier3 = roleMatchedIndices.filter(i => normName(result[i].name) === origNormName);
        if (tier3.length > 0) {
          chosenIdx = pickClosest(orig, tier3);
        }
      }

      // Nivel 4: mismo componentRole (índice ordinal si el conteo coincide, o posición más cercana)
      if (chosenIdx === -1) {
        const origRoleBucket = parametricGroupParts.filter(
          pt => pt.componentRole === orig.componentRole
        );
        const newRoleBucketIndices: number[] = [];
        for (let i = 0; i < result.length; i++) {
          if (result[i].componentRole === orig.componentRole) {
            newRoleBucketIndices.push(i);
          }
        }
        const origOrdinal = origRoleBucket.indexOf(orig);
        if (
          origRoleBucket.length === newRoleBucketIndices.length &&
          origOrdinal >= 0 &&
          !matchedNewIndices.has(newRoleBucketIndices[origOrdinal])
        ) {
          chosenIdx = newRoleBucketIndices[origOrdinal];
        } else {
          chosenIdx = pickClosest(orig, roleMatchedIndices);
        }
      }

      if (chosenIdx !== -1) {
        matchedNewIndices.add(chosenIdx);
        const baseNew = result[chosenIdx];
        result[chosenIdx] = {
          ...baseNew,
          posX: orig.posX,
          posY: orig.posY,
          posZ: orig.posZ,
          length: orig.length,
          width: orig.width,
          thickness: orig.thickness,
          orientation: orig.orientation,
          ...(orig.rotationX !== undefined ? { rotationX: orig.rotationX } : {}),
          ...(orig.rotationY !== undefined ? { rotationY: orig.rotationY } : {}),
          ...(orig.rotationZ !== undefined ? { rotationZ: orig.rotationZ } : {}),
          manuallyModifiedAfterUngroup: true,
          sourceParametricModuleId: orig.sourceParametricModuleId,
          ...(orig.sourceParametricGroupId
            ? { sourceParametricGroupId: orig.sourceParametricGroupId }
            : {})
        };
      }
    }

    return result;
  }

  private applyParametricModulePartsUpdate(
    groupId: string,
    newParts: Part[],
    newName: string | undefined,
    newConfig: ParametricCabinetConfig | undefined,
    newModule: FurnitureModule | undefined,
    pushHistory: boolean,
    preserveTransform: boolean
  ) {
    const currentProj = this.currentProject();
    if (!currentProj) return;

    const group = (currentProj.groups || []).find(g => g.id === groupId);
    const groupParts = currentProj.parts.filter(pt => pt.groupId === groupId);
    const parametricGroupParts = groupParts.filter(pt => isPartParametricGenerated(pt, groupParts));
    const ctCheckParts = parametricGroupParts.length > 0 ? parametricGroupParts : groupParts;
    const isCt = group?.isCountertop || ctCheckParts.some(p => p.componentRole === 'countertop' || p.componentRole === 'backsplash');
    if (isCt) {
      console.warn('Blocked attempt to convert/update countertop group into parametric cabinet:', groupId);
      return;
    }

    const activeLineageIds = new Set<string>();
    if (group?.parametricConfig?.id) activeLineageIds.add(group.parametricConfig.id);
    if (newConfig?.id) activeLineageIds.add(newConfig.id);
    if (group?.id) activeLineageIds.add(group.id);
    for (const pt of parametricGroupParts) {
      if (pt.sourceParametricModuleId) activeLineageIds.add(pt.sourceParametricModuleId);
    }

    const resolvedName = newName || group?.name || newParts[0]?.groupName || 'Módulo Paramétrico';
    let preparedParts: Part[] = newParts.map(pt => ({
      ...pt,
      groupId,
      groupName: resolvedName,
      moduleName: pt.moduleName || resolvedName,
      isParametricGenerated: true
    }));

    if (preserveTransform && groupParts.length > 0 && preparedParts.length > 0) {
      const unmodifiedParametric = parametricGroupParts.filter(
        pt => !pt.manuallyModifiedAfterUngroup
      );
      const transformAnchorParts =
        unmodifiedParametric.length > 0
          ? unmodifiedParametric
          : parametricGroupParts.length > 0
            ? parametricGroupParts
            : groupParts;
      let oldMinX = Infinity;
      let oldMaxX = -Infinity;
      let oldMinY = Infinity;
      let oldMinZ = Infinity;
      let oldMaxZ = -Infinity;
      for (const gp of transformAnchorParts) {
        const b = this.joineryEngine.getPartBounds(gp);
        if (b.minX < oldMinX) oldMinX = b.minX;
        if (b.maxX > oldMaxX) oldMaxX = b.maxX;
        if (b.minY < oldMinY) oldMinY = b.minY;
        if (b.minZ < oldMinZ) oldMinZ = b.minZ;
        if (b.maxZ > oldMaxZ) oldMaxZ = b.maxZ;
      }
      if (Number.isFinite(oldMinX)) {
        const facing = this.getGroupFacingDirection(groupId);
        preparedParts = this.transformPartsToGroupFrame(
          preparedParts,
          (oldMinX + oldMaxX) / 2,
          oldMinY,
          (oldMinZ + oldMaxZ) / 2,
          facing
        );
      }
    }

    preparedParts = this.applyManualPostUngroupOverrides(
      preparedParts,
      parametricGroupParts,
      activeLineageIds
    );

    const clonedConfig = newConfig ? this.cloneParametricConfig(newConfig) : undefined;

    this.updateProject(p => {
      const latestGroupParts = p.parts.filter(pt => pt.groupId === groupId);
      const preservedManualParts: Part[] = latestGroupParts
        .filter(
          pt =>
            !isPartParametricGenerated(pt, latestGroupParts) &&
            !(pt.sourceParametricModuleId && activeLineageIds.has(pt.sourceParametricModuleId))
        )
        .map(pt => ({
          ...pt,
          groupName: resolvedName
        }));

      const nextParts = [
        ...p.parts.filter(pt => pt.groupId !== groupId),
        ...preparedParts,
        ...preservedManualParts
      ];
      const partIdList = [...preparedParts, ...preservedManualParts].map(pt => pt.id);

      let nextModules = this.filterOrphanModules(p.modules || [], nextParts);
      if (newModule && !nextModules.some(m => m.id === newModule.id)) {
        nextModules = [...nextModules, newModule];
      }
      const nextGroups = (p.groups || []).map(g =>
        g.id === groupId
          ? {
              ...g,
              name: resolvedName,
              ...(g.partIds ? { partIds: partIdList } : {}),
              ...(clonedConfig
                ? { type: 'assembly' as const }
                : {}),
              parametricConfig: clonedConfig
                ? {
                    ...clonedConfig,
                    ...(clonedConfig.id
                      ? {}
                      : g.parametricConfig?.id
                        ? { id: g.parametricConfig.id }
                        : {})
                  }
                : g.parametricConfig
            }
          : g
      );
      const nextHardware = this.filterOrphanDrawerHardware(p.hardware || [], nextGroups, groupId);
      return {
        ...p,
        modules: nextModules,
        groups: nextGroups,
        parts: nextParts,
        hardware: nextHardware
      };
    }, pushHistory);
  }

  clearFurniture() {
    this.selectedApplianceId.set(null);
    this.selectedApplianceIds.set([]);
    this.updateProject(p => ({
      ...p,
      modules: [],
      parts: [],
      groups: [],
      parametricLineageRegistry: {},
      appliances: [],
      hardware: []
    }));
  }

  loadTemplateFurniture(template: FurnitureTemplate, mode: 'replace' | 'append' = 'replace') {
    const mats = this.currentProject().materials;
    let offsetX = 0;

    if (mode === 'append') {
      const existingParts = this.currentProject().parts;
      if (existingParts.length > 0) {
        let maxX = -Infinity;
        for (const part of existingParts) {
          const b = this.joineryEngine.getPartBounds(part);
          if (b.maxX > maxX) maxX = b.maxX;
        }
        if (maxX !== -Infinity) {
          offsetX = Math.round(maxX + (template.dimensions.width / 2) + 200);
        }
      }
    }

    let newParts: Part[] = [];
    let templateGroup: PartGroup | null = null;
    let templateModule: FurnitureModule | null = null;

    if (template.isParametric && template.parametricConfig) {
      const cfg: ParametricCabinetConfig = {
        ...template.parametricConfig as ParametricCabinetConfig,
        posX: offsetX
      };
      const res = this.cabinetGen.generateParametricCabinet(cfg, mats);
      newParts = res.parts.map(pt => ({
        ...pt,
        isParametricGenerated: pt.isParametricGenerated ?? true
      }));
      const hydratedConfig = this.cabinetGen.hydrateConfigFromPartsOrTemplate(
        newParts,
        res.group,
        template,
        mats
      );
      templateGroup = {
        ...res.group,
        parametricConfig: hydratedConfig
      };
      templateModule = res.module;
    } else {
      newParts = template.generateParts(mats, offsetX);
      const groupId = 'group_' + template.id + '_' + crypto.randomUUID().slice(0, 6);
      const baseGroup: PartGroup = {
        id: groupId,
        name: template.name,
        type: 'assembly',
        colorHex: template.previewColor?.accent || '#0284c7'
      };
      newParts = newParts.map(p => ({
        ...p,
        groupId,
        groupName: template.name,
        isParametricGenerated: p.isParametricGenerated ?? true
      }));
      const hydratedConfig = this.cabinetGen.hydrateConfigFromPartsOrTemplate(
        newParts,
        baseGroup,
        template,
        mats
      );
      templateGroup = {
        ...baseGroup,
        parametricConfig: hydratedConfig
      };
    }

    if (mode === 'replace') {
      this.updateProject(p => {
        const nextGroups = templateGroup ? [templateGroup] : [];
        return {
          ...p,
          name: template.name,
          modules: templateModule ? [templateModule] : [],
          groups: nextGroups,
          parts: newParts,
          hardware: this.filterOrphanDrawerHardware(p.hardware || [], nextGroups)
        };
      });
    } else {
      this.updateProject(p => {
        const nextGroups = templateGroup ? [...(p.groups || []), templateGroup] : (p.groups || []);
        return {
          ...p,
          modules: templateModule ? [...p.modules, templateModule] : p.modules,
          groups: nextGroups,
          parts: [...p.parts, ...newParts]
        };
      });
    }
  }

  loadDeskBarFurniture() {
    const mats = this.currentProject().materials;
    const woodMat = mats.find(m => m.hasGrain) || mats[0];
    const defaultT = this.currentProject().settings.defaultBoardThickness || 15;

    const deskParts: Part[] = [
      {
        id: 'desk_top',
        name: 'TECHO',
        length: 1800,
        width: 600,
        thickness: defaultT,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 0,
        posY: 1000 - defaultT / 2,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'top',
        notes: 'Cubierta principal'
      },
      {
        id: 'desk_left_side',
        name: 'LATERAL IZQUIERDO',
        length: 1000,
        width: 600,
        thickness: defaultT,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: -900 + defaultT / 2,
        posY: 500,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'side_left',
        notes: 'Pata / lateral izquierdo'
      },
      {
        id: 'desk_center_divider',
        name: 'DIVISIÓN CENTRAL',
        length: 900,
        width: 600,
        thickness: defaultT,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'thin' },
        posX: 300,
        posY: 450,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'divider',
        notes: 'Separador interno'
      },
      {
        id: 'desk_right_side',
        name: 'LATERAL DERECHO',
        length: 1000,
        width: 600,
        thickness: defaultT,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 900 - defaultT / 2,
        posY: 500,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'side_right',
        notes: 'Costado derecho'
      },
      {
        id: 'desk_bottom',
        name: 'PISO INFERIOR',
        length: 573,
        width: 600,
        thickness: defaultT,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 595.5,
        posY: 80 + defaultT / 2,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'bottom',
        notes: 'Base del módulo'
      },
      {
        id: 'desk_plinth',
        name: 'ZÓCALO',
        length: 573,
        width: 80,
        thickness: defaultT,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 595.5,
        posY: 40,
        posZ: 260,
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo frontal'
      }
    ];

    this.updateProject(p => ({
      ...p,
      modules: [],
      parts: deskParts
    }));
  }

  // ==========================================
  // ACCIONES DE PIEZAS INDIVIDUALES
  // ==========================================

  /**
   * Resuelve un material por ID buscando primero en los materiales del proyecto
   * y luego en los catálogos maestros de melaminas y mesones.
   */
  resolveMaterialById(
    materialId: string | undefined,
    projectMaterials?: readonly Material[]
  ): Material | undefined {
    if (!materialId) return undefined;
    const mats = projectMaterials ?? this.currentProject().materials;
    return (
      mats.find(m => m.id === materialId) ||
      MELAMINE_MATERIALS_CATALOG.find(m => m.id === materialId) ||
      DEFAULT_COUNTERTOP_MATERIALS.find(m => m.id === materialId)
    );
  }

  /**
   * Normaliza una pieza al crearse o actualizarse:
   * - Elimina `hardwareConfig` cuando se pasa explícitamente `undefined` (ej. al revertir puerta a `'free'`).
   * - Fuerza `grain: 'none'` cuando se actualiza `materialId` a un material liso (`hasGrain === false`) sin override manual.
   * - Sincroniza `hingeCount` cuando cambia el tamaño de una puerta y no hubo override manual de cantidad.
   */
  private sanitizeUpdatedPart(
    candidate: Part,
    projectMaterials: readonly Material[],
    prev?: Part,
    explicitUpdates?: Partial<Part>
  ): Part {
    const sanitized: Part = { ...candidate };

    if ('hardwareConfig' in sanitized && sanitized.hardwareConfig === undefined) {
      delete sanitized.hardwareConfig;
    }

    const materialIdUpdated = explicitUpdates
      ? 'materialId' in explicitUpdates && Boolean(explicitUpdates.materialId)
      : Boolean(prev && sanitized.materialId !== prev.materialId);

    if (materialIdUpdated) {
      const targetMat = this.resolveMaterialById(sanitized.materialId, projectMaterials);
      if (targetMat && targetMat.hasGrain === false) {
        const hasManualGrainOverride = explicitUpdates
          ? explicitUpdates.grain !== undefined && explicitUpdates.grain !== 'none'
          : Boolean(prev && sanitized.grain !== prev.grain && sanitized.grain !== 'none');
        if (!hasManualGrainOverride) {
          sanitized.grain = 'none';
        }
      }
    }

    if (
      prev &&
      sanitized.componentRole === 'door' &&
      sanitized.hardwareConfig &&
      typeof sanitized.hardwareConfig.hingeCount === 'number' &&
      sanitized.hardwareConfig.hingeCount === prev.hardwareConfig?.hingeCount
    ) {
      const doorDimChanged =
        sanitized.length !== prev.length ||
        sanitized.width !== prev.width ||
        sanitized.orientation !== prev.orientation ||
        (sanitized.rotationZ ?? 0) !== (prev.rotationZ ?? 0);
      if (doorDimChanged) {
        const dir = sanitized.hardwareConfig.openingDirection || 'left';
        const isHorizontalHinge =
          sanitized.hardwareConfig.hingeType === 'gas_piston' || dir === 'top' || dir === 'bottom';
        const isRot90Z = Math.abs(Math.round(sanitized.rotationZ || 0) % 180) === 90;
        const horizW =
          sanitized.orientation === 'vertical_xy'
            ? (isRot90Z ? sanitized.width : sanitized.length)
            : sanitized.orientation === 'vertical_yz'
              ? sanitized.width
              : Math.min(sanitized.length, sanitized.width);
        const vertH =
          sanitized.orientation === 'vertical_xy'
            ? (isRot90Z ? sanitized.length : sanitized.width)
            : Math.max(sanitized.length, sanitized.width);
        const span = isHorizontalHinge ? horizW : vertH;
        const recomputedCount = span <= 900 ? 2 : span <= 1600 ? 3 : 4;
        sanitized.hardwareConfig = {
          ...sanitized.hardwareConfig,
          hingeCount: recomputedCount
        };
      }
    }

    return sanitized;
  }

  addPart(part: Part) {
    const normalizedPart: Part = {
      ...part,
      isParametricGenerated: part.isParametricGenerated ?? false
    };
    if ('hardwareConfig' in normalizedPart && normalizedPart.hardwareConfig === undefined) {
      delete normalizedPart.hardwareConfig;
    }
    this.updateProject(p => {
      const nextParts = [...p.parts, normalizedPart];
      return {
        ...p,
        parts: this.partGeometry.inferAndApplySemanticPartNames(nextParts, p.groups || [], {
          focusPartIds: new Set([normalizedPart.id])
        })
      };
    });
  }

  updatePart(part: Part, recordHistory = true) {
    this.updateProject(p => {
      const prev = p.parts.find(pt => pt.id === part.id);
      if (!prev) {
        const cleanPart = this.sanitizeUpdatedPart(part, p.materials);
        const updatedParts = p.parts.map(pt => (pt.id === part.id ? cleanPart : pt));
        return {
          ...p,
          parts: this.syncCountertopBacksplashes(updatedParts)
        };
      }

      const normalizedInput = this.sanitizeUpdatedPart(part, p.materials, prev);

      const orientationOrRotationChanged =
        prev.orientation !== normalizedInput.orientation ||
        (prev.rotationX ?? 0) !== (normalizedInput.rotationX ?? 0) ||
        (prev.rotationY ?? 0) !== (normalizedInput.rotationY ?? 0) ||
        (prev.rotationZ ?? 0) !== (normalizedInput.rotationZ ?? 0);

      const geometryChanged =
        orientationOrRotationChanged ||
        (prev.posX ?? 0) !== (normalizedInput.posX ?? 0) ||
        (prev.posY ?? 0) !== (normalizedInput.posY ?? 0) ||
        (prev.posZ ?? 0) !== (normalizedInput.posZ ?? 0) ||
        prev.length !== normalizedInput.length ||
        prev.width !== normalizedInput.width ||
        prev.thickness !== normalizedInput.thickness;

      const effectiveSourceModuleId = normalizedInput.sourceParametricModuleId ?? prev.sourceParametricModuleId;
      const effectiveSourceGroupId = normalizedInput.sourceParametricGroupId ?? prev.sourceParametricGroupId;
      const shouldMarkManualAfterUngroup =
        geometryChanged && !normalizedInput.groupId && Boolean(effectiveSourceModuleId);

      const resolvedPart: Part = shouldMarkManualAfterUngroup
        ? {
            ...normalizedInput,
            sourceParametricModuleId: effectiveSourceModuleId,
            ...(effectiveSourceGroupId ? { sourceParametricGroupId: effectiveSourceGroupId } : {}),
            manuallyModifiedAfterUngroup: true
          }
        : normalizedInput;

      const updatedParts = p.parts.map(pt => (pt.id === part.id ? resolvedPart : pt));
      const syncedParts = this.syncCountertopBacksplashes(updatedParts);

      if (!geometryChanged) {
        return {
          ...p,
          parts: syncedParts
        };
      }

      return {
        ...p,
        parts: this.partGeometry.inferAndApplySemanticPartNames(syncedParts, p.groups || [], {
          focusPartIds: new Set([part.id]),
          ...(orientationOrRotationChanged ? { forceReevaluateIds: new Set([part.id]) } : {})
        })
      };
    }, recordHistory);
  }

  updateMultipleParts(updatesList: { partId: string; updates: Partial<Part> }[], recordHistory = true) {
    this.updateProject(p => {
      const prevMap = new Map<string, Part>(p.parts.map(pt => [pt.id, pt]));
      const updatesMap = new Map(updatesList.map(u => [u.partId, u.updates]));
      const focusPartIds = new Set<string>();
      const forceReevaluateIds = new Set<string>();

      const updatedParts = p.parts.map(pt => {
        const upd = updatesMap.get(pt.id);
        if (!upd) return pt;
        const prev = prevMap.get(pt.id) ?? pt;
        const nextPart = this.sanitizeUpdatedPart({ ...pt, ...upd }, p.materials, prev, upd);

        const orientChanged =
          (upd.orientation !== undefined && upd.orientation !== prev.orientation) ||
          (upd.rotationX !== undefined && (upd.rotationX ?? 0) !== (prev.rotationX ?? 0)) ||
          (upd.rotationY !== undefined && (upd.rotationY ?? 0) !== (prev.rotationY ?? 0)) ||
          (upd.rotationZ !== undefined && (upd.rotationZ ?? 0) !== (prev.rotationZ ?? 0));

        const geomChanged =
          orientChanged ||
          (upd.posX !== undefined && (upd.posX ?? 0) !== (prev.posX ?? 0)) ||
          (upd.posY !== undefined && (upd.posY ?? 0) !== (prev.posY ?? 0)) ||
          (upd.posZ !== undefined && (upd.posZ ?? 0) !== (prev.posZ ?? 0)) ||
          (upd.length !== undefined && upd.length !== prev.length) ||
          (upd.width !== undefined && upd.width !== prev.width) ||
          (upd.thickness !== undefined && upd.thickness !== prev.thickness);

        if (geomChanged) {
          focusPartIds.add(pt.id);
          if (!nextPart.groupId && nextPart.sourceParametricModuleId) {
            nextPart.manuallyModifiedAfterUngroup = true;
          }
        }
        if (orientChanged) {
          forceReevaluateIds.add(pt.id);
        }
        return nextPart;
      });

      const syncedParts = this.syncCountertopBacksplashes(updatedParts);
      if (focusPartIds.size === 0 && forceReevaluateIds.size === 0) {
        return {
          ...p,
          parts: syncedParts
        };
      }

      return {
        ...p,
        parts: this.partGeometry.inferAndApplySemanticPartNames(syncedParts, p.groups || [], {
          focusPartIds,
          ...(forceReevaluateIds.size > 0 ? { forceReevaluateIds } : {})
        })
      };
    }, recordHistory);
  }

  /**
   * Aplica una solución de colisión de 1 clic sobre `fix.targetPartId` con snapshot transaccional
   * de Undo/Redo, clamping de piso (`minY >= 0`) y re-evaluación automática de nombres semánticos.
   */
  applyCollisionFix(fix: CollisionFixOption): boolean {
    const targetPart = this.currentProject().parts.find(p => p.id === fix.targetPartId);
    if (!targetPart || targetPart.isLocked) {
      return false;
    }

    const updates = this.joineryEngine.computePartUpdateForFix(targetPart, fix);
    if (!updates) {
      return false;
    }

    this.updateMultipleParts([{ partId: fix.targetPartId, updates }], true);
    return true;
  }

  /**
   * Resuelve automáticamente todas las colisiones corregibles del proyecto activo
   * guardando un único snapshot atómico para Undo/Redo.
   */
  resolveAllProjectCollisions(): {
    resolvedCount: number;
    stepsApplied: number;
    remainingCount: number;
  } {
    const parts = this.currentProject().parts;
    const result = this.joineryEngine.resolveAllCollisionsIteratively(parts);
    if (result.updates.length > 0) {
      this.updateMultipleParts(result.updates, true);
    }
    return {
      resolvedCount: result.resolvedCount,
      stepsApplied: result.stepsApplied,
      remainingCount: result.remainingCollisions.length
    };
  }

  private syncCountertopBacksplashes(parts: Part[]): Part[] {
    const countertopGroupIds = new Set(
      parts
        .filter(p => p.componentRole === 'countertop' || p.componentRole === 'backsplash')
        .map(p => p.groupId)
        .filter((id): id is string => Boolean(id))
    );

    if (countertopGroupIds.size === 0) return parts;

    let result = [...parts];

    for (const gId of countertopGroupIds) {
      const gParts = result.filter(p => p.groupId === gId);
      const slabs = gParts.filter(p => p.componentRole === 'countertop');
      const splashes = gParts.filter(p => p.componentRole === 'backsplash');

      if (slabs.length === 0 || splashes.length === 0) continue;

      const mainSlab =
        slabs.find(p => p.name.includes('Principal') || p.id.includes('principal') || p.id.includes('recto')) ||
        slabs[0];
      if (!mainSlab || mainSlab.orientation !== 'horizontal') continue;

      const grp = (this.currentProject().groups || []).find(g => g.id === gId);
      const facing = grp?.facingDirection || 'front';
      if (facing !== 'front' || mainSlab.length < mainSlab.width) {
        // Si el mesón ha sido rotado (facing right/back/left), no aplicar las coordenadas fijas en +Z
        continue;
      }

      const mainLen = mainSlab.length;
      const mainDepth = mainSlab.width;
      const mainPosX = mainSlab.posX ?? 0;
      const mainPosY = mainSlab.posY ?? 860;
      const mainPosZ = mainSlab.posZ ?? 0;
      const thick = mainSlab.thickness;
      const matId = mainSlab.materialId;
      const matName = mainSlab.materialName;
      const colHex = mainSlab.colorHex;

      const minX = mainPosX - mainLen / 2;
      const maxX = mainPosX + mainLen / 2;
      const minZ = mainPosZ - mainDepth / 2;
      const maxZ_main = mainPosZ + mainDepth / 2;

      const leftSlab = slabs.find(
        p => p !== mainSlab && (p.name.includes('Retorno') || p.id.includes('retorno')) && (p.posX ?? 0) < mainPosX
      );
      const rightSlab = slabs.find(
        p => p !== mainSlab && (p.name.includes('Retorno') || p.id.includes('retorno')) && (p.posX ?? 0) > mainPosX
      );

      const leftTotalSideLen = leftSlab ? mainDepth + leftSlab.width : 0;
      const rightTotalSideLen = rightSlab ? mainDepth + rightSlab.width : 0;
      const posteriorSplash = splashes.find(p => p.orientation === 'vertical_xy');
      const splashT = posteriorSplash ? Math.min(20, posteriorSplash.thickness || 20) : Math.min(20, thick);

      result = result.map(p => {
        if (p.groupId !== gId) return p;

        if (p === leftSlab) {
          return {
            ...p,
            posY: mainPosY,
            posZ: Math.round(maxZ_main + p.width / 2),
            posX: Math.round(minX + p.length / 2),
            thickness: thick,
            materialId: matId,
            materialName: matName,
            colorHex: colHex
          };
        }

        if (p === rightSlab) {
          return {
            ...p,
            posY: mainPosY,
            posZ: Math.round(maxZ_main + p.width / 2),
            posX: Math.round(maxX - p.length / 2),
            thickness: thick,
            materialId: matId,
            materialName: matName,
            colorHex: colHex
          };
        }

        if (p.componentRole === 'backsplash') {
          const splashH = p.width || 75;
          const splashPosY = Math.round((mainPosY + thick / 2 + splashH / 2 + 0.5) * 10) / 10;

          if (p.orientation === 'vertical_xy') {
            return {
              ...p,
              length: mainLen,
              posX: mainPosX,
              posY: splashPosY,
              posZ: Math.round(minZ + splashT / 2),
              thickness: splashT,
              materialId: matId,
              materialName: matName,
              colorHex: colHex
            };
          } else if (p.orientation === 'vertical_yz') {
            const isRightSide = (p.posX ?? 0) > mainPosX || p.name.includes('Derecho');
            const totalSide = isRightSide
              ? rightTotalSideLen || p.length + splashT
              : leftTotalSideLen || p.length + splashT;
            const sideLengthInZ = Math.max(100, Math.round(totalSide - splashT));
            const targetX = isRightSide ? Math.round(maxX - splashT / 2) : Math.round(minX + splashT / 2);
            const targetZ = Math.round(minZ + splashT + sideLengthInZ / 2);

            return {
              ...p,
              length: sideLengthInZ,
              posX: targetX,
              posY: splashPosY,
              posZ: targetZ,
              thickness: splashT,
              materialId: matId,
              materialName: matName,
              colorHex: colHex
            };
          }
        }

        return p;
      });
    }

    return result;
  }

  duplicatePart(partId: string): Part | null {
    const currentProj = this.currentProject();
    const part = currentProj.parts.find(p => p.id === partId);
    if (!part) return null;

    const existingNames = currentProj.parts.map(p => p.name.trim().toLowerCase());
    const baseClean = part.name.replace(/\s+\(Copia.*?\)$/i, '').replace(/\s+\d+$/, '').trim();
    let candidate = `${baseClean} 2`;
    let counter = 2;
    while (existingNames.includes(candidate.trim().toLowerCase())) {
      counter++;
      candidate = `${baseClean} ${counter}`;
    }

    const isShelf = this.partGeometry.isInternalShelf(part);
    const isDivider = this.partGeometry.isInternalDivider(part);

    let clone: Part;

    if (part.groupId && isShelf) {
      // Escenario A: Duplicación de Entrepaño / Repisa Horizontal Interna
      // PROHIBIDO alterar posX o posZ: conservar exactamente la misma alineación lateral/frontal y rotación
      const cavity = this.partGeometry.getModuleCavityCenter(part, currentProj.parts);
      const vertGap = this.partGeometry.findLargestVerticalGap(part, currentProj.parts);

      let cloneX = part.posX ?? 0;
      let cloneZ = part.posZ ?? 0;
      if (cavity) {
        if (Math.abs((part.posX ?? 0) - cavity.x) > 1.5) {
          cloneX = cavity.x;
        }
        if (Math.abs((part.posZ ?? 0) - cavity.z) > 1.5) {
          cloneZ = cavity.z;
        }
      }

      clone = {
        ...part,
        id: crypto.randomUUID(),
        name: candidate,
        posX: cloneX,
        posY: vertGap.bestY,
        posZ: cloneZ,
        isParametricGenerated: false
      };
    } else if (part.groupId && isDivider) {
      // Escenario B: Duplicación de Divisor Vertical Interno
      // PROHIBIDO alterar posY o la profundidad: ubicar en el centro del hueco horizontal disponible
      const horizGap = this.partGeometry.findLargestHorizontalGap(part, currentProj.parts);
      const cloneX = horizGap.axis === 'x' ? horizGap.bestPos : (part.posX ?? 0);
      const cloneZ = horizGap.axis === 'z' ? horizGap.bestPos : (part.posZ ?? 0);

      clone = {
        ...part,
        id: crypto.randomUUID(),
        name: candidate,
        posX: cloneX,
        posY: part.posY ?? 0,
        posZ: cloneZ,
        isParametricGenerated: false
      };
    } else if (!part.groupId) {
      // Escenario C1: Tablero libre (no pertenece a ningún módulo)
      // Colocar al lado (+X = anchoPieza + 20 mm) a la misma altura (mismo posY y posZ)
      const b = this.partGeometry.getWorldAABB(part);
      const deltaX = Math.round(b.sx + 20);

      clone = {
        ...part,
        id: crypto.randomUUID(),
        name: candidate,
        groupId: undefined,
        groupName: undefined,
        moduleId: undefined,
        moduleName: undefined,
        componentRole: 'free',
        hasCustomName: false,
        posX: Math.round(((part.posX ?? 0) + deltaX) * 10) / 10,
        posY: part.posY ?? 0,
        posZ: part.posZ ?? 0,
        isParametricGenerated: false
      };
    } else {
      // Escenario C2: Pieza estructural externa de un módulo (lateral, techo, piso, puerta, fondo)
      // Desvincular la copia (groupId: undefined) y colocarla fuera del módulo al lado (+X)
      const groupParts = currentProj.parts.filter(p => p.groupId === part.groupId);
      let moduleMaxX = -Infinity;
      for (const gp of groupParts) {
        const gb = this.partGeometry.getWorldAABB(gp);
        if (gb.maxX > moduleMaxX) moduleMaxX = gb.maxX;
      }
      const b = this.partGeometry.getWorldAABB(part);
      const targetX = Math.round(moduleMaxX + 20 + b.sx / 2);

      clone = {
        ...part,
        id: crypto.randomUUID(),
        name: candidate,
        groupId: undefined,
        groupName: undefined,
        moduleId: undefined,
        moduleName: undefined,
        componentRole: 'free',
        hasCustomName: false,
        posX: targetX,
        posY: part.posY ?? 0,
        posZ: part.posZ ?? 0,
        isParametricGenerated: false
      };
    }

    const cleanClone: Part = { ...clone };
    delete cleanClone.sourceParametricModuleId;
    delete cleanClone.sourceParametricGroupId;
    delete cleanClone.manuallyModifiedAfterUngroup;

    this.addPart(cleanClone);
    return this.currentProject().parts.find(p => p.id === cleanClone.id) || cleanClone;
  }

  private clearRemovedHostRefs(groups: PartGroup[], removedHostIds: Set<string>): PartGroup[] {
    if (removedHostIds.size === 0) return groups;
    return groups.map(g => {
      if (!g.hostGroupId || !removedHostIds.has(g.hostGroupId)) {
        return g;
      }
      const nextGroup: PartGroup = { ...g };
      delete nextGroup.hostGroupId;
      delete nextGroup.hostCavityId;
      if (nextGroup.drawerConfig) {
        const nextDrawerCfg = { ...nextGroup.drawerConfig };
        delete nextDrawerCfg.hostGroupId;
        delete nextDrawerCfg.hostCavityId;
        nextGroup.drawerConfig = nextDrawerCfg;
      }
      return nextGroup;
    });
  }

  deletePart(partId: string) {
    this.updateProject(p => {
      const remainingParts = p.parts.filter(pt => pt.id !== partId);
      const usedGroupIds = new Set(remainingParts.map(pt => pt.groupId).filter(Boolean));
      const removedGroupIds = new Set(
        (p.groups || []).filter(g => !usedGroupIds.has(g.id)).map(g => g.id)
      );
      const filteredGroups = this.clearRemovedHostRefs(
        (p.groups || []).filter(g => usedGroupIds.has(g.id)),
        removedGroupIds
      );
      const filteredModules = this.filterOrphanModules(p.modules || [], remainingParts);
      const remainingAppliances = (p.appliances || []).filter(
        a => !(a.groupId && removedGroupIds.has(a.groupId))
      );
      const filteredHardware = this.filterOrphanDrawerHardware(p.hardware || [], filteredGroups);
      return {
        ...p,
        modules: filteredModules,
        parts: remainingParts,
        groups: filteredGroups,
        appliances: remainingAppliances,
        hardware: filteredHardware
      };
    });
  }

  deleteMultipleParts(partIds: string[]) {
    const idsSet = new Set(partIds);
    this.updateProject(p => {
      const remainingParts = p.parts.filter(pt => !idsSet.has(pt.id));
      const usedGroupIds = new Set(remainingParts.map(pt => pt.groupId).filter(Boolean));
      const removedGroupIds = new Set(
        (p.groups || []).filter(g => !usedGroupIds.has(g.id)).map(g => g.id)
      );
      const filteredGroups = this.clearRemovedHostRefs(
        (p.groups || []).filter(g => usedGroupIds.has(g.id)),
        removedGroupIds
      );
      const filteredModules = this.filterOrphanModules(p.modules || [], remainingParts);
      const remainingAppliances = (p.appliances || []).filter(
        a => !(a.groupId && removedGroupIds.has(a.groupId))
      );
      const filteredHardware = this.filterOrphanDrawerHardware(p.hardware || [], filteredGroups);
      return {
        ...p,
        modules: filteredModules,
        parts: remainingParts,
        groups: filteredGroups,
        appliances: remainingAppliances,
        hardware: filteredHardware
      };
    });
  }

  deleteMultiplePartsAndAppliances(partIds: string[], applianceIds: string[]) {
    const partIdsSet = new Set(partIds);
    const appIdsSet = new Set(applianceIds);
    this.updateProject(p => {
      const remainingParts = p.parts.filter(pt => !partIdsSet.has(pt.id));
      const usedGroupIds = new Set(remainingParts.map(pt => pt.groupId).filter(Boolean));
      const removedGroupIds = new Set(
        (p.groups || []).filter(g => !usedGroupIds.has(g.id)).map(g => g.id)
      );
      const filteredGroups = this.clearRemovedHostRefs(
        (p.groups || []).filter(g => usedGroupIds.has(g.id)),
        removedGroupIds
      );
      const filteredModules = this.filterOrphanModules(p.modules || [], remainingParts);
      const remainingAppliances = (p.appliances || []).filter(
        a => !appIdsSet.has(a.id) && !(a.groupId && removedGroupIds.has(a.groupId))
      );
      const filteredHardware = this.filterOrphanDrawerHardware(p.hardware || [], filteredGroups);
      return {
        ...p,
        modules: filteredModules,
        parts: remainingParts,
        groups: filteredGroups,
        appliances: remainingAppliances,
        hardware: filteredHardware
      };
    });
  }

  // ==========================================
  // ACCIONES DE GRUPOS (CAJONES Y ENSAMBLES)
  // ==========================================

  createGroup(
    name: string,
    partIds: string[],
    type: 'drawer' | 'door_set' | 'assembly' | 'custom' = 'assembly',
    slideLength = 450,
    isCountertop?: boolean
  ): PartGroup {
    const proj = this.currentProject();
    const currentParts = (proj.parts || []).filter(pt => partIds.includes(pt.id));
    const existingGroups = proj.groups || [];
    const lineageRegistry = proj.parametricLineageRegistry || {};
    const carcassRoleSet = new Set<ComponentRole>(['side_left', 'side_right', 'top', 'bottom']);

    // Caso A: las piezas seleccionadas incluyen un único módulo paramétrico vivo junto a piezas manuales
    const sourceGroupIds = new Set<string>(
      currentParts.map(pt => pt.groupId).filter((id): id is string => Boolean(id))
    );
    const sourceParametricGroups = Array.from(sourceGroupIds)
      .map(id => existingGroups.find(g => g.id === id))
      .filter((g): g is PartGroup => Boolean(g && g.parametricConfig && !g.isCountertop));

    let inheritedParametricGroup =
      sourceParametricGroups.length === 1 ? sourceParametricGroups[0] : undefined;

    // Agrupar piezas por sourceParametricModuleId para detectar mezcla o restauración tras ungroup
    const partsByLineage = new Map<string, Part[]>();
    for (const pt of currentParts) {
      if (pt.sourceParametricModuleId) {
        const list = partsByLineage.get(pt.sourceParametricModuleId) ?? [];
        list.push(pt);
        partsByLineage.set(pt.sourceParametricModuleId, list);
      }
    }

    // Si hay un grupo paramétrico vivo pero se mezcló con un segundo módulo paramétrico desagrupado,
    // degradar a grupo personalizado sin receta para evitar corrupción estructural.
    if (inheritedParametricGroup) {
      const liveIds = new Set<string>([inheritedParametricGroup.id]);
      if (inheritedParametricGroup.parametricConfig?.id) {
        liveIds.add(inheritedParametricGroup.parametricConfig.id);
      }
      for (const [linId, linParts] of partsByLineage.entries()) {
        if (liveIds.has(linId)) continue;
        const foreignCarcass = linParts.filter(
          pt => pt.componentRole !== undefined && carcassRoleSet.has(pt.componentRole)
        ).length;
        if (linParts.length >= 2 || foreignCarcass >= 1) {
          inheritedParametricGroup = undefined;
          break;
        }
      }
    }

    // Caso B: reagrupación tras ungroup (restauración de linaje paramétrico desde parametricLineageRegistry)
    let restoredLineageEntry: ParametricModuleLineageEntry | undefined;
    if (!inheritedParametricGroup && sourceParametricGroups.length === 0) {
      const competingLineages: { lineageId: string; parts: Part[]; carcassCount: number }[] = [];
      for (const [linId, linParts] of partsByLineage.entries()) {
        const carcassCount = linParts.filter(
          pt => pt.componentRole !== undefined && carcassRoleSet.has(pt.componentRole)
        ).length;
        if (linParts.length >= 2 || carcassCount >= 1) {
          competingLineages.push({ lineageId: linId, parts: linParts, carcassCount });
        }
      }

      if (competingLineages.length === 1) {
        const dominant = competingLineages[0];
        const entry = lineageRegistry[dominant.lineageId];
        if (entry) {
          const hasEnoughCarcass =
            entry.expectedCarcassCount > 0 &&
            dominant.carcassCount >= Math.ceil(entry.expectedCarcassCount / 2);
          const hasEnoughParts =
            entry.expectedPartCount > 0 &&
            dominant.parts.length >= Math.ceil(entry.expectedPartCount * 0.5);
          if (dominant.parts.length >= 3 && (hasEnoughCarcass || hasEnoughParts)) {
            restoredLineageEntry = entry;
          }
        }
      }
    }

    const hasParametricSource = Boolean(inheritedParametricGroup || restoredLineageEntry);
    const isCountertopDetected =
      !hasParametricSource &&
      (Boolean(isCountertop) ||
        currentParts.some(
          p =>
            p.componentRole === 'countertop' ||
            p.componentRole === 'backsplash' ||
            (p.name &&
              (p.name.toUpperCase().includes('MESÓN') ||
                p.name.toUpperCase().includes('MESON') ||
                p.name.toUpperCase().includes('SALPICADERO')))
        ));

    const resolvedGroupName =
      name || (isCountertopDetected ? 'Mesón Cocina' : `Módulo ${this.groupsList().length + 1}`);

    let resolvedGroupType: PartGroup['type'];
    if (isCountertopDetected) {
      resolvedGroupType = 'assembly';
    } else if (inheritedParametricGroup) {
      resolvedGroupType =
        inheritedParametricGroup.type === 'drawer' ? 'assembly' : inheritedParametricGroup.type;
    } else if (restoredLineageEntry) {
      resolvedGroupType =
        restoredLineageEntry.groupType === 'drawer' ? 'assembly' : restoredLineageEntry.groupType;
    } else if (type === 'drawer') {
      const drawerProbeGroup: PartGroup = {
        id: '__drawer_probe__',
        name: resolvedGroupName,
        type: 'drawer'
      };
      resolvedGroupType = isStandaloneModularDrawerGroup(drawerProbeGroup, currentParts)
        ? 'drawer'
        : 'assembly';
    } else {
      resolvedGroupType = type;
    }

    const resolvedFacing =
      isCountertopDetected
        ? ('front' as const)
        : inheritedParametricGroup?.facingDirection ?? restoredLineageEntry?.facingDirection;

    const restoredParametricConfig = inheritedParametricGroup?.parametricConfig
      ? {
          ...this.cloneParametricConfig(inheritedParametricGroup.parametricConfig),
          name: resolvedGroupName
        }
      : restoredLineageEntry
        ? {
            ...this.cloneParametricConfig(restoredLineageEntry.parametricConfig),
            id: restoredLineageEntry.lineageId,
            name: resolvedGroupName
          }
        : undefined;

    const newGroup: PartGroup = {
      id: 'grp_' + crypto.randomUUID().slice(0, 8),
      name: resolvedGroupName,
      type: resolvedGroupType,
      isOpen: false,
      slideExtension: 0,
      slideLength,
      slideType: 'telescopic',
      frontGap: 26,
      ...(isCountertopDetected ? { isCountertop: true } : {}),
      ...(resolvedFacing ? { facingDirection: resolvedFacing } : {}),
      ...(restoredParametricConfig ? { parametricConfig: restoredParametricConfig } : {})
    };

    this.updateProject(p => {
      const currentGroups = p.groups || [];
      const partIdSet = new Set(partIds);
      const updatedParts = p.parts.map(pt => {
        if (partIdSet.has(pt.id)) {
          let explicitFlag: boolean | undefined;
          if (restoredLineageEntry) {
            explicitFlag = pt.sourceParametricModuleId === restoredLineageEntry.lineageId;
          } else if (pt.isParametricGenerated !== undefined) {
            explicitFlag = pt.isParametricGenerated;
          } else if (inheritedParametricGroup) {
            explicitFlag = pt.groupId === inheritedParametricGroup.id;
          }
          return {
            ...pt,
            groupId: newGroup.id,
            groupName: newGroup.name,
            ...(explicitFlag !== undefined ? { isParametricGenerated: explicitFlag } : {})
          };
        }
        return pt;
      });
      const nextGroups = [...currentGroups, newGroup];
      const isEligibleSemanticGroup =
        !isCountertopDetected &&
        !inheritedParametricGroup &&
        !restoredLineageEntry &&
        (newGroup.type === 'assembly' || newGroup.type === 'custom') &&
        updatedParts.some(pt => partIdSet.has(pt.id) && !pt.moduleId);

      const finalParts = isEligibleSemanticGroup
        ? this.partGeometry.inferAndApplySemanticPartNames(updatedParts, nextGroups, {
            focusPartIds: partIdSet
          })
        : updatedParts;

      return {
        ...p,
        groups: nextGroups,
        parts: finalParts
      };
    });

    return newGroup;
  }

  /**
   * Vincula una pieza manual existente a un módulo o grupo objetivo, heredando su identidad
   * de grupo/módulo y preservándola frente a futuras regeneraciones paramétricas.
   */
  attachManualPartToGroup(partId: string, groupId: string): Part | null {
    const proj = this.currentProject();
    if (!proj) return null;

    const part = proj.parts.find(pt => pt.id === partId);
    const targetGroup = (proj.groups || []).find(g => g.id === groupId);
    if (!part || !targetGroup || targetGroup.isCountertop) {
      return null;
    }

    const groupParts = proj.parts.filter(pt => pt.groupId === groupId);
    const refModulePart = groupParts.find(pt => Boolean(pt.moduleId));
    const hasGenericName =
      !part.hasCustomName &&
      /^(pieza|tablero\s*(libre|suelto)?)\b/i.test((part.name || '').trim());

    this.updateProject(p => {
      const nextGroups = (p.groups || []).map(g => {
        if (g.id !== targetGroup.id) return g;
        if (!g.partIds) return g;
        return {
          ...g,
          partIds: Array.from(new Set([...g.partIds, partId]))
        };
      });

      let nextParts = p.parts.map(pt => {
        if (pt.id !== partId) return pt;
        return {
          ...pt,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          ...(refModulePart?.moduleId ? { moduleId: refModulePart.moduleId } : {}),
          ...(refModulePart?.moduleName ? { moduleName: refModulePart.moduleName } : {}),
          isParametricGenerated: false
        };
      });

      if (hasGenericName) {
        const inferred = this.partGeometry.inferAndApplySemanticPartNames(
          nextParts,
          nextGroups,
          {
            focusPartIds: new Set([partId]),
            forceReevaluateIds: new Set([partId])
          }
        );
        const inferredPart = inferred.find(pt => pt.id === partId);
        if (inferredPart) {
          nextParts = nextParts.map(pt => (pt.id === partId ? inferredPart : pt));
        }
      }

      return {
        ...p,
        groups: nextGroups,
        parts: nextParts
      };
    });

    return this.currentProject().parts.find(pt => pt.id === partId) ?? null;
  }

  ungroup(groupId: string, options?: { detachToFreeEdit?: boolean }): void {
    const detachToFreeEdit = options?.detachToFreeEdit !== false;
    this.updateProject(p => {
      const targetGroup = (p.groups || []).find(g => g.id === groupId);
      const currentGroups = this.clearRemovedHostRefs(
        (p.groups || []).filter(g => g.id !== groupId),
        new Set([groupId])
      );
      const groupParts = p.parts.filter(pt => pt.groupId === groupId);

      if (detachToFreeEdit) {
        const lineageIdsToRemove = new Set<string>();
        if (targetGroup?.parametricConfig?.id) {
          lineageIdsToRemove.add(targetGroup.parametricConfig.id);
        }
        if (targetGroup?.id) {
          lineageIdsToRemove.add(targetGroup.id);
        }
        for (const pt of groupParts) {
          if (pt.sourceParametricModuleId) {
            lineageIdsToRemove.add(pt.sourceParametricModuleId);
          }
          if (pt.moduleId) {
            lineageIdsToRemove.add(pt.moduleId);
          }
        }

        let nextRegistry = p.parametricLineageRegistry;
        if (nextRegistry && lineageIdsToRemove.size > 0) {
          let changed = false;
          const clonedRegistry: Record<string, ParametricModuleLineageEntry> = {
            ...nextRegistry
          };
          for (const lid of lineageIdsToRemove) {
            if (lid in clonedRegistry) {
              delete clonedRegistry[lid];
              changed = true;
            }
          }
          if (changed) {
            nextRegistry = clonedRegistry;
          }
        }

        const updatedParts = p.parts.map(pt => {
          if (pt.groupId !== groupId) return pt;
          const copy: Part = {
            ...pt,
            isParametricGenerated: false
          };
          delete copy.groupId;
          delete copy.groupName;
          delete copy.moduleId;
          delete copy.moduleName;
          delete copy.zoneId;
          delete copy.sourceParametricModuleId;
          delete copy.sourceParametricGroupId;
          delete copy.manuallyModifiedAfterUngroup;
          return copy;
        });

        const nextModules = this.filterOrphanModules(p.modules || [], updatedParts);
        const nextAppliances = (p.appliances || []).map(a => {
          if (a.groupId !== groupId) return a;
          const copy = { ...a };
          delete copy.groupId;
          return copy;
        });
        const nextHardware = this.filterOrphanDrawerHardware(
          p.hardware || [],
          currentGroups,
          groupId
        );

        return {
          ...p,
          modules: nextModules,
          groups: currentGroups,
          parts: updatedParts,
          appliances: nextAppliances,
          hardware: nextHardware,
          ...(nextRegistry !== p.parametricLineageRegistry
            ? { parametricLineageRegistry: nextRegistry }
            : {})
        };
      }

      let nextRegistry = p.parametricLineageRegistry;
      let lineageId: string | undefined;
      const parametricPartIds = new Set<string>();

      if (targetGroup?.parametricConfig && !targetGroup.isCountertop) {
        lineageId = targetGroup.parametricConfig.id || targetGroup.id;
        const parametricParts = groupParts.filter(pt => isPartParametricGenerated(pt, groupParts));
        for (const pt of parametricParts) {
          parametricPartIds.add(pt.id);
        }

        const carcassRoleSet = new Set<ComponentRole>(['side_left', 'side_right', 'top', 'bottom']);
        const expectedCarcassCount = parametricParts.filter(
          pt => pt.componentRole !== undefined && carcassRoleSet.has(pt.componentRole)
        ).length;

        const baseSyncedConfig =
          parametricParts.length > 0
            ? this.cabinetGen.reconstructConfigFromParts(parametricParts, targetGroup)
            : this.cloneParametricConfig(targetGroup.parametricConfig);
        const clonedSyncedConfig: ParametricCabinetConfig = {
          ...this.cloneParametricConfig(baseSyncedConfig),
          id: lineageId,
          ...(targetGroup.parametricConfig.zoneTree && !baseSyncedConfig.zoneTree
            ? { zoneTree: this.cloneParametricConfig(targetGroup.parametricConfig).zoneTree }
            : {})
        };

        const facingDirection =
          targetGroup.facingDirection ?? this.computeGeometricFacingDirection(groupId, p.parts);

        const entry: ParametricModuleLineageEntry = {
          lineageId,
          originalGroupId: targetGroup.id,
          groupName: targetGroup.name,
          groupType: targetGroup.type,
          facingDirection,
          parametricConfig: clonedSyncedConfig,
          expectedCarcassCount,
          expectedPartCount: parametricParts.length,
          detachedAt: Date.now()
        };

        nextRegistry = {
          ...(p.parametricLineageRegistry || {}),
          [lineageId]: entry
        };
      }

      const updatedParts = p.parts.map(pt => {
        if (pt.groupId === groupId) {
          const copy: Part = { ...pt };
          delete copy.groupId;
          delete copy.groupName;
          if (lineageId && parametricPartIds.has(pt.id)) {
            copy.sourceParametricModuleId = lineageId;
            copy.sourceParametricGroupId = groupId;
            copy.isParametricGenerated = true;
            if (pt.manuallyModifiedAfterUngroup === true) {
              copy.manuallyModifiedAfterUngroup = true;
            }
          }
          return copy;
        }
        return pt;
      });
      return {
        ...p,
        groups: currentGroups,
        parts: updatedParts,
        ...(nextRegistry !== p.parametricLineageRegistry
          ? { parametricLineageRegistry: nextRegistry }
          : {})
      };
    });
  }

  updateGroup(groupId: string, updates: Partial<PartGroup>) {
    this.updateProject(p => {
      const hostedGroupIds =
        updates.isLocked !== undefined
          ? new Set((p.groups || []).filter(g => g.hostGroupId === groupId).map(g => g.id))
          : new Set<string>();

      const currentGroups = (p.groups || []).map(g => {
        if (g.id === groupId) {
          return { ...g, ...updates };
        }
        if (updates.isLocked !== undefined && hostedGroupIds.has(g.id)) {
          return { ...g, isLocked: updates.isLocked };
        }
        return g;
      });

      let updatedParts = p.parts;
      if (updates.name || updates.isLocked !== undefined) {
        updatedParts = p.parts.map(pt => {
          if (pt.groupId === groupId) {
            return {
              ...pt,
              ...(updates.name ? { groupName: updates.name } : {}),
              ...(updates.isLocked !== undefined ? { isLocked: updates.isLocked } : {})
            };
          }
          if (updates.isLocked !== undefined && pt.groupId && hostedGroupIds.has(pt.groupId)) {
            return { ...pt, isLocked: updates.isLocked };
          }
          return pt;
        });
      }

      return {
        ...p,
        groups: currentGroups,
        parts: updatedParts
      };
    });
  }

  changeGroupMaterial(
    groupId: string,
    materialId: string,
    target: 'all' | 'structure' | 'doors' = 'all'
  ): void {
    const mat =
      this.materialsList().find(m => m.id === materialId) ||
      DEFAULT_COUNTERTOP_MATERIALS.find(m => m.id === materialId) ||
      MELAMINE_MATERIALS_CATALOG.find(m => m.id === materialId);
    if (!mat) return;
    const isStoneMat = isCountertopMaterial(mat);

    this.updateProject(p => ({
      ...p,
      materials: p.materials.some(m => m.id === mat.id) ? p.materials : [...p.materials, mat],
      groups: (p.groups || []).map(g => {
        if (g.id !== groupId || isStoneMat) return g;
        const nextParametricConfig = g.parametricConfig
          ? {
              ...g.parametricConfig,
              structureMaterialId:
                target === 'all' || target === 'structure'
                  ? mat.id
                  : g.parametricConfig.structureMaterialId,
              doorMaterialId:
                target === 'all' || target === 'doors'
                  ? mat.id
                  : g.parametricConfig.doorMaterialId,
              ...(g.parametricConfig.customizeVisibleSides &&
              (target === 'all' || target === 'structure')
                ? { visibleMaterialId: mat.id }
                : {})
            }
          : undefined;
        const nextDrawerConfig = g.drawerConfig
          ? {
              ...g.drawerConfig,
              materialId:
                target === 'all' || target === 'structure'
                  ? mat.id
                  : g.drawerConfig.materialId,
              frontMaterialId:
                target === 'all' || target === 'doors'
                  ? mat.id
                  : g.drawerConfig.frontMaterialId
            }
          : undefined;
        return {
          ...g,
          ...(nextParametricConfig ? { parametricConfig: nextParametricConfig } : {}),
          ...(nextDrawerConfig ? { drawerConfig: nextDrawerConfig } : {})
        };
      }),
      parts: p.parts.map(pt => {
        if (pt.groupId !== groupId) return pt;

        const isCountertopUnit = pt.componentRole === 'countertop' || pt.componentRole === 'backsplash';
        if (isCountertopUnit) {
          if (!isStoneMat) return pt;
          return {
            ...pt,
            materialId: mat.id,
            materialName: mat.name,
            colorHex: mat.colorHex,
            grain: mat.hasGrain ? (pt.grain === 'none' ? 'length' : pt.grain) : 'none',
            excludeFromCutlist: true,
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
          };
        }

        // Si el material seleccionado es de mesón/piedra, NO alterar las piezas de mueble/melamina
        if (isStoneMat) return pt;

        const isDoor = pt.componentRole === 'door' || pt.componentRole === 'drawer_front';
        const isBack = pt.componentRole === 'back' && pt.thickness <= 6;
        const isHardwareOrExcluded =
          pt.componentRole === 'accessory' ||
          pt.shapeType === 'circle' ||
          pt.excludeFromCutlist === true ||
          (pt.materialId || '').startsWith('hw_');
        if (isBack || isHardwareOrExcluded) return pt;

        if (target === 'doors' && !isDoor) return pt;
        if (target === 'structure' && isDoor) return pt;

        return {
          ...pt,
          materialId: mat.id,
          materialName: mat.name,
          grain: mat.hasGrain ? (pt.grain === 'none' ? 'length' : pt.grain) : 'none',
          colorHex: mat.colorHex
        };
      })
    }));
  }

  /**
   * Aplica modelo y acabado de tirador global a todas las puertas y frentes de cajón de un módulo,
   * sincronizando `hardwareConfig`, `parametricConfig` y recursivamente todo `zoneTree`.
   */
  applyGroupGlobalHandles(
    groupId: string,
    handleType: HandleType,
    handleFinish: HandleFinish
  ): number {
    if (!groupId) return 0;
    const proj = this.currentProject();
    const isPhysical = isPhysicalHandleType(handleType);
    const drawerOpening = resolveDrawerOpeningFromHandle(handleType);
    let updatedCount = 0;

    const isTargetFrontPart = (pt: Part): boolean => {
      if (pt.groupId !== groupId) return false;
      if ((pt.name || '').toUpperCase().includes('PANEL CIEGO')) return false;
      return (
        pt.componentRole === 'door' ||
        pt.componentRole === 'drawer_front' ||
        pt.hardwareConfig?.movableType === 'door' ||
        pt.hardwareConfig?.movableType === 'drawer'
      );
    };

    const hasGroup = (proj.groups || []).some(g => g.id === groupId);
    const hasTargets = proj.parts.some(isTargetFrontPart);
    if (!hasGroup && !hasTargets) return 0;

    this.updateProject(p => {
      const nextParts = p.parts.map(pt => {
        if (!isTargetFrontPart(pt)) return pt;
        updatedCount += 1;
        const isDrawer =
          pt.componentRole === 'drawer_front' || pt.hardwareConfig?.movableType === 'drawer';
        const prevHw: PartHardwareConfig = pt.hardwareConfig || {
          isMovable: true,
          movableType: isDrawer ? 'drawer' : 'door'
        };

        let nextHandlePosition: DoorHandleVerticalPosition;
        if (!isPhysical) {
          nextHandlePosition = 'none';
        } else if (prevHw.handlePosition && prevHw.handlePosition !== 'none') {
          nextHandlePosition = prevHw.handlePosition;
        } else if (isDrawer || prevHw.openingDirection === 'top' || prevHw.openingDirection === 'bottom') {
          nextHandlePosition = 'horizontal';
        } else {
          nextHandlePosition = 'vertical';
        }

        const nextHw: PartHardwareConfig = {
          ...prevHw,
          isMovable: prevHw.isMovable ?? true,
          movableType: prevHw.movableType ?? (isDrawer ? 'drawer' : 'door'),
          openingSystem: drawerOpening as CabinetOpeningSystem,
          handleType,
          handleFinish,
          handlePosition: nextHandlePosition,
          ...(isDrawer ? { drawerOpeningSystem: drawerOpening } : {})
        };

        return {
          ...pt,
          hardwareConfig: nextHw
        };
      });

      const nextGroups = (p.groups || []).map(g => {
        if (g.id !== groupId) return g;
        const nextDrawerConfig = g.drawerConfig
          ? { ...g.drawerConfig, handleType: drawerOpening }
          : undefined;
        if (!g.parametricConfig) {
          return nextDrawerConfig ? { ...g, drawerConfig: nextDrawerConfig } : g;
        }

        const nextZoneTree = mapZoneTreeNodes(g.parametricConfig.zoneTree, node => {
          const content = node.content;
          if (!content) return undefined;
          if (content.type === 'doors' && content.doors) {
            return {
              ...content,
              doors: {
                ...content.doors,
                hasHandle: isPhysical,
                openingSystem: drawerOpening as CabinetOpeningSystem,
                handleType,
                handleFinish,
                handlePosition: isPhysical
                  ? content.doors.handlePosition && content.doors.handlePosition !== 'none'
                    ? content.doors.handlePosition
                    : 'vertical'
                  : 'none'
              }
            };
          }
          if (content.type === 'drawers' && content.drawers) {
            return {
              ...content,
              drawers: {
                ...content.drawers,
                openingSystem: drawerOpening
              }
            };
          }
          return content;
        });

        return {
          ...g,
          ...(nextDrawerConfig ? { drawerConfig: nextDrawerConfig } : {}),
          parametricConfig: {
            ...g.parametricConfig,
            hasHandle: handleType !== 'none' && isPhysical,
            openingSystem: drawerOpening as CabinetOpeningSystem,
            handleType,
            handleFinish,
            ...(nextZoneTree ? { zoneTree: nextZoneTree } : {})
          }
        };
      });

      return {
        ...p,
        parts: nextParts,
        groups: nextGroups
      };
    });

    return updatedCount;
  }

  /**
   * Aplica tipo de bisagra global a todas las puertas batientes de un módulo,
   * sincronizando `hardwareConfig`, `parametricConfig.hingeType` y `zoneTree`.
   */
  applyGroupGlobalHinges(groupId: string, hingeType: HingeType): number {
    if (!groupId) return 0;
    const proj = this.currentProject();
    const targetGroup = (proj.groups || []).find(g => g.id === groupId);
    const groupZoneTree = targetGroup?.parametricConfig?.zoneTree;
    let updatedCount = 0;

    const isTargetHingedDoor = (pt: Part): boolean => {
      if (pt.groupId !== groupId) return false;
      const isDoor = pt.componentRole === 'door' || pt.hardwareConfig?.movableType === 'door';
      if (!isDoor) return false;
      return !isSlidingDoorOrFixedBlindPanel(pt, groupZoneTree);
    };

    const hasTargets = proj.parts.some(isTargetHingedDoor);
    if (!targetGroup && !hasTargets) return 0;

    this.updateProject(p => {
      const latestGroup = (p.groups || []).find(g => g.id === groupId);
      const latestTree = latestGroup?.parametricConfig?.zoneTree;

      const nextParts = p.parts.map(pt => {
        if (pt.groupId !== groupId) return pt;
        const isDoor = pt.componentRole === 'door' || pt.hardwareConfig?.movableType === 'door';
        if (!isDoor || isSlidingDoorOrFixedBlindPanel(pt, latestTree)) {
          return pt;
        }
        updatedCount += 1;
        const prevHw: PartHardwareConfig = pt.hardwareConfig || {
          isMovable: true,
          movableType: 'door'
        };
        return {
          ...pt,
          hardwareConfig: {
            ...prevHw,
            isMovable: prevHw.isMovable ?? true,
            movableType: prevHw.movableType ?? 'door',
            hingeType
          }
        };
      });

      const nextGroups = (p.groups || []).map(g => {
        if (g.id !== groupId || !g.parametricConfig) return g;
        const nextZoneTree = mapZoneTreeNodes(g.parametricConfig.zoneTree, node => {
          const content = node.content;
          if (!content) return undefined;
          if (content.type === 'doors' && content.doors && content.doors.opening !== 'sliding') {
            return {
              ...content,
              doors: {
                ...content.doors,
                hingeType
              }
            };
          }
          return content;
        });

        return {
          ...g,
          parametricConfig: {
            ...g.parametricConfig,
            hingeType,
            ...(nextZoneTree ? { zoneTree: nextZoneTree } : {})
          }
        };
      });

      return {
        ...p,
        parts: nextParts,
        groups: nextGroups
      };
    });

    return updatedCount;
  }

  /**
   * Aplica tipo de corredera global a todos los frentes/cajones de un módulo,
   * ajustando coherentemente `drawerOpeningSystem`, `parametricConfig.drawerSlideType` y `zoneTree`.
   */
  applyGroupGlobalSlides(groupId: string, slideType: SlideType): number {
    if (!groupId) return 0;
    const proj = this.currentProject();
    const targetGroup = (proj.groups || []).find(g => g.id === groupId);
    let updatedCount = 0;

    const isTargetDrawerFront = (pt: Part): boolean =>
      pt.groupId === groupId &&
      (pt.componentRole === 'drawer_front' || pt.hardwareConfig?.movableType === 'drawer');

    const hasTargets = proj.parts.some(isTargetDrawerFront);
    if (!targetGroup && !hasTargets) return 0;

    const validZoneSlide: Exclude<SlideType, 'none'> | undefined =
      slideType !== 'none' ? slideType : undefined;

    this.updateProject(p => {
      const grp = (p.groups || []).find(g => g.id === groupId);
      const cfgHandleType = grp?.parametricConfig?.handleType;
      const cfgHandleFinish = grp?.parametricConfig?.handleFinish;
      const cfgHasPhysicalHandle = isPhysicalHandleType(cfgHandleType);

      const nextParts = p.parts.map(pt => {
        if (!isTargetDrawerFront(pt)) return pt;
        updatedCount += 1;
        const prevHw: PartHardwareConfig = pt.hardwareConfig || {
          isMovable: true,
          movableType: 'drawer'
        };

        let nextOpening = prevHw.drawerOpeningSystem;
        let nextCabinetOpening = prevHw.openingSystem;
        let nextHandleType = prevHw.handleType;
        let nextHandleFinish = prevHw.handleFinish;
        let nextHandlePosition = prevHw.handlePosition;

        if (slideType === 'push_open') {
          nextOpening = 'push';
          nextCabinetOpening = 'push';
          nextHandleType = 'push_open';
          nextHandlePosition = 'none';
        } else if (
          prevHw.drawerOpeningSystem === 'push' ||
          prevHw.openingSystem === 'push' ||
          prevHw.handleType === 'push' ||
          prevHw.handleType === 'push_open'
        ) {
          if (cfgHandleType !== 'none') {
            nextOpening = 'handle';
            nextCabinetOpening = 'handle';
            nextHandleType = cfgHasPhysicalHandle ? cfgHandleType : 'bar_modern';
            nextHandleFinish = cfgHandleFinish || prevHw.handleFinish || 'brushed_steel';
            nextHandlePosition = 'horizontal';
          }
        }

        return {
          ...pt,
          hardwareConfig: {
            ...prevHw,
            isMovable: prevHw.isMovable ?? true,
            movableType: prevHw.movableType ?? 'drawer',
            slideType,
            ...(nextCabinetOpening ? { openingSystem: nextCabinetOpening } : {}),
            ...(nextOpening ? { drawerOpeningSystem: nextOpening } : {}),
            ...(nextHandleType ? { handleType: nextHandleType } : {}),
            ...(nextHandleFinish ? { handleFinish: nextHandleFinish } : {}),
            ...(nextHandlePosition ? { handlePosition: nextHandlePosition } : {})
          }
        };
      });

      const nextGroups = (p.groups || []).map(g => {
        if (g.id !== groupId) return g;
        const nextGroupSlide =
          g.slideType !== undefined || g.type === 'drawer' ? slideType : g.slideType;

        if (!g.parametricConfig) {
          return nextGroupSlide !== g.slideType ? { ...g, slideType: nextGroupSlide } : g;
        }

        const nextZoneTree = validZoneSlide
          ? mapZoneTreeNodes(g.parametricConfig.zoneTree, node => {
              const content = node.content;
              if (!content) return undefined;
              if (content.type === 'drawers' && content.drawers) {
                let nextNodeOpening = content.drawers.openingSystem;
                if (validZoneSlide === 'push_open') {
                  nextNodeOpening = 'push';
                } else if (
                  content.drawers.openingSystem === 'push' &&
                  g.parametricConfig?.handleType !== 'none'
                ) {
                  nextNodeOpening = 'handle';
                }
                return {
                  ...content,
                  drawers: {
                    ...content.drawers,
                    slideType: validZoneSlide,
                    openingSystem: nextNodeOpening
                  }
                };
              }
              return content;
            })
          : g.parametricConfig.zoneTree;

        return {
          ...g,
          ...(nextGroupSlide !== undefined ? { slideType: nextGroupSlide } : {}),
          parametricConfig: {
            ...g.parametricConfig,
            ...(validZoneSlide ? { drawerSlideType: validZoneSlide } : {}),
            ...(nextZoneTree ? { zoneTree: nextZoneTree } : {})
          }
        };
      });

      return {
        ...p,
        parts: nextParts,
        groups: nextGroups
      };
    });

    return updatedCount;
  }

  deleteGroup(groupId: string, deleteParts = false) {
    this.updateProject(p => {
      const hostedGroupIds = new Set(
        (p.groups || []).filter(g => g.hostGroupId === groupId).map(g => g.id)
      );
      const removedGroupIds = deleteParts
        ? new Set([groupId, ...hostedGroupIds])
        : new Set([groupId]);

      const currentGroups = deleteParts
        ? (p.groups || []).filter(g => !removedGroupIds.has(g.id))
        : this.clearRemovedHostRefs(
            (p.groups || []).filter(g => g.id !== groupId),
            new Set([groupId])
          );

      let updatedParts = p.parts;
      let updatedAppliances = p.appliances || [];
      let updatedModules = p.modules || [];
      if (deleteParts) {
        updatedParts = p.parts.filter(pt => !pt.groupId || !removedGroupIds.has(pt.groupId));
        updatedAppliances = updatedAppliances.filter(
          a => !a.groupId || !removedGroupIds.has(a.groupId)
        );
        updatedModules = this.filterOrphanModules(updatedModules, updatedParts);
      } else {
        updatedParts = p.parts.map(pt => {
          if (pt.groupId === groupId) {
            const copy = { ...pt };
            delete copy.groupId;
            delete copy.groupName;
            return copy;
          }
          return pt;
        });
        updatedAppliances = updatedAppliances.map(a => {
          if (a.groupId === groupId) {
            const copy = { ...a };
            delete copy.groupId;
            return copy;
          }
          return a;
        });
      }
      const filteredHardware = this.filterOrphanDrawerHardware(p.hardware || [], currentGroups);
      return {
        ...p,
        modules: updatedModules,
        groups: currentGroups,
        parts: updatedParts,
        appliances: updatedAppliances,
        hardware: filteredHardware
      };
    });
  }

  toggleGroupOpen(groupId: string, forceState?: boolean) {
    const group = (this.groupsList()).find(g => g.id === groupId);
    if (!group) return;
    const nextState = forceState !== undefined ? forceState : !group.isOpen;
    this.updateGroup(groupId, {
      isOpen: nextState,
      slideExtension: nextState ? 1 : 0
    });
  }

  setGroupSlideExtension(groupId: string, extension: number) {
    const clamped = Math.max(0, Math.min(1, extension));
    this.updateGroup(groupId, {
      slideExtension: clamped,
      isOpen: clamped > 0.05
    });
  }

  moveGroup(groupId: string, deltaX: number, deltaY: number, deltaZ: number) {
    this.updateProject(p => {
      const hostedGroupIds = new Set(
        (p.groups || []).filter(g => g.hostGroupId === groupId).map(g => g.id)
      );
      const affectedParts = p.parts.filter(
        pt => pt.groupId === groupId || (pt.groupId !== undefined && hostedGroupIds.has(pt.groupId))
      );
      let effDy = deltaY;
      if (affectedParts.length > 0 && deltaY < 0) {
        let grpMinY = Infinity;
        for (const gp of affectedParts) {
          const b = this.partGeometry.getWorldAABB(gp);
          if (b.minY < grpMinY) grpMinY = b.minY;
        }
        if (grpMinY !== Infinity) {
          effDy = Math.max(-grpMinY, deltaY);
        }
      }

      const nextGroups = (p.groups || []).map(g => {
        if (g.id === groupId && g.parametricConfig) {
          return {
            ...g,
            parametricConfig: {
              ...g.parametricConfig,
              ...(g.parametricConfig.posX !== undefined
                ? { posX: Math.round((g.parametricConfig.posX + deltaX) * 10) / 10 }
                : {}),
              ...(g.parametricConfig.posY !== undefined
                ? { posY: Math.round((g.parametricConfig.posY + effDy) * 10) / 10 }
                : {}),
              ...(g.parametricConfig.posZ !== undefined
                ? { posZ: Math.round((g.parametricConfig.posZ + deltaZ) * 10) / 10 }
                : {})
            }
          };
        }
        if (hostedGroupIds.has(g.id) && g.drawerConfig) {
          const facing = g.drawerConfig.facingDirection ?? g.facingDirection ?? 'front';
          const isWidthZ = facing === 'right' || facing === 'left';
          const depthDelta = isWidthZ ? deltaX : deltaZ;
          return {
            ...g,
            drawerConfig: {
              ...g.drawerConfig,
              ...(g.drawerConfig.posX !== undefined
                ? { posX: Math.round((g.drawerConfig.posX + deltaX) * 10) / 10 }
                : {}),
              ...(g.drawerConfig.posY !== undefined
                ? { posY: Math.round((g.drawerConfig.posY + effDy) * 10) / 10 }
                : {}),
              ...(g.drawerConfig.posZ !== undefined
                ? { posZ: Math.round((g.drawerConfig.posZ + deltaZ) * 10) / 10 }
                : {}),
              ...(g.drawerConfig.frontEdgeCoord !== undefined
                ? { frontEdgeCoord: Math.round((g.drawerConfig.frontEdgeCoord + depthDelta) * 10) / 10 }
                : {})
            }
          };
        }
        return g;
      });

      return {
        ...p,
        groups: nextGroups,
        parts: p.parts.map(pt => {
          if (
            pt.groupId === groupId ||
            (pt.groupId !== undefined && hostedGroupIds.has(pt.groupId))
          ) {
            return {
              ...pt,
              posX: Math.round(((pt.posX ?? 0) + deltaX) * 10) / 10,
              posY: Math.round(((pt.posY ?? 0) + effDy) * 10) / 10,
              posZ: Math.round(((pt.posZ ?? 0) + deltaZ) * 10) / 10
            };
          }
          return pt;
        })
      };
    });
  }

  /**
   * Sincroniza la traslación de grupos de cajones alojados (`hostGroupId === hostGroupId`)
   * tras un arrastre 3D del módulo anfitrión, omitiendo piezas ya actualizadas por el visor.
   */
  syncHostedGroupsTranslation(
    hostGroupId: string,
    dx: number,
    dy: number,
    dz: number,
    alreadyMovedPartIds?: Set<string>
  ): void {
    if (!hostGroupId) return;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4 && Math.abs(dz) < 1e-4) return;

    const proj = this.currentProject();
    if (!proj) return;

    const hostedGroups = (proj.groups || []).filter(g => g.hostGroupId === hostGroupId);
    if (hostedGroups.length === 0) return;

    const hostedGroupIds = new Set(hostedGroups.map(g => g.id));

    this.updateProject(p => {
      const nextGroups = (p.groups || []).map(g => {
        if (!hostedGroupIds.has(g.id) || !g.drawerConfig) return g;
        const facing = g.drawerConfig.facingDirection ?? g.facingDirection ?? 'front';
        const isWidthZ = facing === 'right' || facing === 'left';
        const depthDelta = isWidthZ ? dx : dz;
        return {
          ...g,
          drawerConfig: {
            ...g.drawerConfig,
            ...(g.drawerConfig.posX !== undefined
              ? { posX: Math.round((g.drawerConfig.posX + dx) * 10) / 10 }
              : {}),
            ...(g.drawerConfig.posY !== undefined
              ? { posY: Math.round((g.drawerConfig.posY + dy) * 10) / 10 }
              : {}),
            ...(g.drawerConfig.posZ !== undefined
              ? { posZ: Math.round((g.drawerConfig.posZ + dz) * 10) / 10 }
              : {}),
            ...(g.drawerConfig.frontEdgeCoord !== undefined
              ? { frontEdgeCoord: Math.round((g.drawerConfig.frontEdgeCoord + depthDelta) * 10) / 10 }
              : {})
          }
        };
      });

      const nextParts = p.parts.map(pt => {
        if (!pt.groupId || !hostedGroupIds.has(pt.groupId)) return pt;
        if (alreadyMovedPartIds?.has(pt.id)) return pt;
        return {
          ...pt,
          posX: Math.round(((pt.posX ?? 0) + dx) * 10) / 10,
          posY: Math.round(((pt.posY ?? 0) + dy) * 10) / 10,
          posZ: Math.round(((pt.posZ ?? 0) + dz) * 10) / 10
        };
      });

      return {
        ...p,
        groups: nextGroups,
        parts: nextParts
      };
    }, false);
  }

  duplicateGroup(groupId: string): { newGroup: PartGroup; newPartIds: string[] } | null {
    const currentProj = this.currentProject();
    if (!currentProj) return null;

    const group = (currentProj.groups || []).find(g => g.id === groupId);
    if (!group) return null;

    const groupParts = currentProj.parts.filter(pt => pt.groupId === groupId);
    if (groupParts.length === 0) return null;

    const existingGroups = currentProj.groups || [];
    const hostedGroups = existingGroups.filter(g => g.hostGroupId === groupId);
    const hostedGroupIds = new Set(hostedGroups.map(g => g.id));
    const allBoundingParts = [
      ...groupParts,
      ...currentProj.parts.filter(pt => pt.groupId !== undefined && hostedGroupIds.has(pt.groupId))
    ];

    let grpMinX = Infinity;
    let grpMaxX = -Infinity;
    for (const gp of allBoundingParts) {
      const b = this.partGeometry.getWorldAABB(gp);
      if (b.minX < grpMinX) grpMinX = b.minX;
      if (b.maxX > grpMaxX) grpMaxX = b.maxX;
    }
    const groupWidth = grpMaxX > grpMinX ? grpMaxX - grpMinX : 600;
    const deltaX = Math.round(groupWidth + 40);

    const allocatedGroups: PartGroup[] = [...existingGroups];
    const allocateUniqueGroupName = (sourceName: string): string => {
      let candidateBase = `${sourceName} (Copia)`;
      const numMatch = sourceName.match(/^(.*?caj[oó]n\s*)(\d+)/i);
      if (numMatch) {
        const prefix = numMatch[1];
        let maxNum = parseInt(numMatch[2], 10);
        const prefixLower = prefix.toLowerCase();
        for (const g of allocatedGroups) {
          if (g.name.toLowerCase().startsWith(prefixLower)) {
            const rest = g.name.slice(prefix.length).trim();
            const parsed = parseInt(rest, 10);
            if (Number.isFinite(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        }
        candidateBase = `${prefix}${maxNum + 1}`;
      } else {
        candidateBase = `${sourceName} ${allocatedGroups.length + 1}`;
      }

      const usedNames = new Set(allocatedGroups.map(g => g.name.trim().toLowerCase()));
      let candidate = candidateBase;
      let suffix = 2;
      while (usedNames.has(candidate.trim().toLowerCase())) {
        candidate = `${candidateBase} ${suffix++}`;
      }
      return candidate;
    };

    const nextName = allocateUniqueGroupName(group.name);

    const sourceModuleId = groupParts.find(pt => pt.moduleId)?.moduleId;
    const sourceModule = sourceModuleId
      ? (currentProj.modules || []).find(m => m.id === sourceModuleId)
      : undefined;
    const newModuleId = sourceModule ? `module_copy_${crypto.randomUUID().slice(0, 8)}` : undefined;
    const newModule: FurnitureModule | undefined = sourceModule && newModuleId
      ? { ...sourceModule, id: newModuleId, name: nextName }
      : undefined;

    const newGroupId = 'grp_' + crypto.randomUUID().slice(0, 8);
    const existingPartNames = currentProj.parts.map(p => p.name.trim().toLowerCase());
    const newPartIds: string[] = [];

    const newParts: Part[] = groupParts.map(pt => {
      const newId = 'part_' + crypto.randomUUID().slice(0, 8) + '_' + (pt.componentRole || 'drawer');
      newPartIds.push(newId);

      let partNameCandidate = pt.name;
      if (group.name && pt.name.toLowerCase().includes(group.name.toLowerCase())) {
        partNameCandidate = pt.name.replace(new RegExp(group.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), nextName);
      } else {
        partNameCandidate = `${pt.name} (${nextName})`;
      }

      let pCandidate = partNameCandidate;
      let pCounter = 2;
      while (existingPartNames.includes(pCandidate.trim().toLowerCase())) {
        pCandidate = `${partNameCandidate} ${pCounter++}`;
      }
      existingPartNames.push(pCandidate.trim().toLowerCase());

      const isParametric = isPartParametricGenerated(pt, groupParts);
      return {
        ...pt,
        id: newId,
        name: pCandidate,
        moduleId: isParametric ? (newModuleId ?? pt.moduleId) : pt.moduleId,
        moduleName: isParametric && newModule ? nextName : pt.moduleName,
        groupId: newGroupId,
        groupName: nextName,
        isParametricGenerated: pt.isParametricGenerated,
        posX: Math.round(((pt.posX ?? 0) + deltaX) * 10) / 10
      };
    });

    const isDirectStandaloneDrawer =
      group.type === 'drawer' ||
      group.subType === 'drawer' ||
      group.templateId === 'modular_drawer';

    const directFacing = group.drawerConfig?.facingDirection ?? group.facingDirection ?? 'front';
    const directIsWidthZ = directFacing === 'right' || directFacing === 'left';

    const newGroup: PartGroup = {
      ...group,
      id: newGroupId,
      name: nextName,
      isOpen: false,
      slideExtension: 0,
      ...(group.partIds ? { partIds: [...newPartIds] } : {}),
      ...(isDirectStandaloneDrawer && group.hostGroupId ? { hostGroupId: undefined, hostCavityId: undefined } : {}),
      ...(group.drawerConfig
        ? {
            drawerConfig: {
              ...group.drawerConfig,
              name: nextName,
              ...(isDirectStandaloneDrawer && group.drawerConfig.hostGroupId
                ? { hostGroupId: undefined, hostCavityId: undefined }
                : {}),
              ...(group.drawerConfig.posX !== undefined
                ? { posX: Math.round((group.drawerConfig.posX + deltaX) * 10) / 10 }
                : {}),
              ...(directIsWidthZ && group.drawerConfig.frontEdgeCoord !== undefined
                ? { frontEdgeCoord: Math.round((group.drawerConfig.frontEdgeCoord + deltaX) * 10) / 10 }
                : {})
            }
          }
        : {}),
      parametricConfig: group.parametricConfig
        ? {
            ...this.cloneParametricConfig(group.parametricConfig),
            id: newModuleId || group.parametricConfig.id,
            name: nextName,
            posX: Math.round(((group.parametricConfig.posX ?? 0) + deltaX) * 10) / 10
          }
        : undefined
    };
    allocatedGroups.push(newGroup);

    const newHostedGroups: PartGroup[] = [];
    const newHostedParts: Part[] = [];
    const newHostedHardware: HardwareItem[] = [];

    for (const hg of hostedGroups) {
      const hgParts = currentProj.parts.filter(pt => pt.groupId === hg.id);
      if (hgParts.length === 0) continue;

      const newHgId = 'drawer_grp_' + crypto.randomUUID().slice(0, 8);
      const newHgName = allocateUniqueGroupName(hg.name);
      const newHostCavityId = hg.hostCavityId
        ? hg.hostCavityId.split(groupId).join(newGroupId)
        : undefined;

      const hgFacing = hg.drawerConfig?.facingDirection ?? hg.facingDirection ?? 'front';
      const hgIsWidthZ = hgFacing === 'right' || hgFacing === 'left';

      const hgClonedParts: Part[] = hgParts.map(pt => {
        const newPartId = pt.id.startsWith(hg.id)
          ? `${newHgId}${pt.id.slice(hg.id.length)}`
          : `${newHgId}_${crypto.randomUUID().slice(0, 6)}_${pt.componentRole || 'drawer'}`;

        let partNameCandidate = pt.name;
        if (hg.name && pt.name.toLowerCase().includes(hg.name.toLowerCase())) {
          partNameCandidate = pt.name.replace(
            new RegExp(hg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            newHgName
          );
        } else {
          partNameCandidate = `${pt.name} (${newHgName})`;
        }

        let pCandidate = partNameCandidate;
        let pCounter = 2;
        while (existingPartNames.includes(pCandidate.trim().toLowerCase())) {
          pCandidate = `${partNameCandidate} ${pCounter++}`;
        }
        existingPartNames.push(pCandidate.trim().toLowerCase());

        return {
          ...pt,
          id: newPartId,
          name: pCandidate,
          groupId: newHgId,
          groupName: newHgName,
          posX: Math.round(((pt.posX ?? 0) + deltaX) * 10) / 10
        };
      });

      const newHgDrawerConfig: ParametricDrawerConfig | undefined = hg.drawerConfig
        ? {
            ...hg.drawerConfig,
            name: newHgName,
            hostGroupId: newGroupId,
            hostCavityId: newHostCavityId,
            ...(hg.drawerConfig.posX !== undefined
              ? { posX: Math.round((hg.drawerConfig.posX + deltaX) * 10) / 10 }
              : {}),
            ...(hgIsWidthZ && hg.drawerConfig.frontEdgeCoord !== undefined
              ? { frontEdgeCoord: Math.round((hg.drawerConfig.frontEdgeCoord + deltaX) * 10) / 10 }
              : {})
          }
        : undefined;

      const newHg: PartGroup = {
        ...hg,
        id: newHgId,
        name: newHgName,
        isOpen: false,
        slideExtension: 0,
        hostGroupId: newGroupId,
        hostCavityId: newHostCavityId,
        ...(hg.partIds ? { partIds: hgClonedParts.map(p => p.id) } : {}),
        ...(newHgDrawerConfig ? { drawerConfig: newHgDrawerConfig } : {})
      };

      allocatedGroups.push(newHg);
      newHostedGroups.push(newHg);
      newHostedParts.push(...hgClonedParts);

      const matchingHw = (currentProj.hardware || []).filter(
        hw => hw.id === `hw_slide_${hg.id}` || hw.id === `hw_handle_${hg.id}`
      );
      for (const hw of matchingHw) {
        const nextHwId = hw.id.startsWith('hw_slide_')
          ? `hw_slide_${newHgId}`
          : `hw_handle_${newHgId}`;
        const updatedHwName =
          hg.name && hw.name.includes(hg.name)
            ? hw.name.split(hg.name).join(newHgName)
            : `${hw.name} (${newHgName})`;
        const updatedHwNotes =
          hg.name && hw.notes && hw.notes.includes(hg.name)
            ? hw.notes.split(hg.name).join(newHgName)
            : `Para ${newHgName}`;
        newHostedHardware.push({
          ...hw,
          id: nextHwId,
          name: updatedHwName,
          notes: updatedHwNotes
        });
      }
    }

    const groupAppliances = (currentProj.appliances || []).filter(a => a.groupId === groupId);
    const newAppliances: ApplianceItem[] = groupAppliances.map(app => {
      const newAppId = 'appliance_' + crypto.randomUUID().slice(0, 8);
      return {
        ...app,
        id: newAppId,
        groupId: newGroupId,
        position: {
          ...app.position,
          x: Math.round(((app.position.x ?? 0) + deltaX) * 10) / 10
        }
      };
    });

    this.updateProject(p => {
      return {
        ...p,
        modules: newModule ? [...(p.modules || []), newModule] : p.modules,
        groups: [...(p.groups || []), newGroup, ...newHostedGroups],
        parts: [...p.parts, ...newParts, ...newHostedParts],
        appliances: [...(p.appliances || []), ...newAppliances],
        hardware: [...(p.hardware || []), ...newHostedHardware]
      };
    });

    return { newGroup, newPartIds };
  }

  /**
   * Rota rígidamente múltiples piezas, módulos y electrodomésticos seleccionados en el plano horizontal (90°, -90° o 180°)
   * alrededor de su centroide geométrico común (cx, cz), preservando la coherencia entre módulos y equipos.
   */
  rotateMultiplePartsRigidly(partIds: string[], angleDelta: 90 | -90 | 180, applianceIds: string[] = []) {
    if (partIds.length === 0 && applianceIds.length === 0) return;
    this.updateProject(p => {
      const initialIdSet = new Set(partIds);
      const initialTargetParts = p.parts.filter(pt => initialIdSet.has(pt.id));
      const initialGroupIds = new Set<string>(
        initialTargetParts.map(pt => pt.groupId).filter((id): id is string => Boolean(id))
      );

      const effectiveIdSet = new Set<string>(partIds);
      for (const gId of initialGroupIds) {
        const ownParts = p.parts.filter(pt => pt.groupId === gId);
        if (ownParts.length > 0 && ownParts.every(pt => initialIdSet.has(pt.id))) {
          const hostedGroupIds = new Set(
            (p.groups || []).filter(g => g.hostGroupId === gId).map(g => g.id)
          );
          if (hostedGroupIds.size > 0) {
            for (const pt of p.parts) {
              if (pt.groupId && hostedGroupIds.has(pt.groupId)) {
                effectiveIdSet.add(pt.id);
              }
            }
          }
        }
      }

      const targetParts = p.parts.filter(pt => effectiveIdSet.has(pt.id));
      const groupIdsFromParts = new Set<string>(
        targetParts.map(pt => pt.groupId).filter((id): id is string => Boolean(id))
      );
      const targetAppliances = (p.appliances || []).filter(
        a => applianceIds.includes(a.id) || (a.groupId && groupIdsFromParts.has(a.groupId))
      );
      if (targetParts.length === 0 && targetAppliances.length === 0) return p;

      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const pt of targetParts) {
        const b = this.joineryEngine.getPartBounds(pt);
        if (b.minX < minX) minX = b.minX;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.minZ < minZ) minZ = b.minZ;
        if (b.maxZ > maxZ) maxZ = b.maxZ;
      }

      for (const app of targetAppliances) {
        const halfW = (app.width || 600) / 2;
        const halfD = (app.depth || 600) / 2;
        const appMinX = app.position.x - halfW;
        const appMaxX = app.position.x + halfW;
        const appMinZ = app.position.z - halfD;
        const appMaxZ = app.position.z + halfD;
        if (appMinX < minX) minX = appMinX;
        if (appMaxX > maxX) maxX = appMaxX;
        if (appMinZ < minZ) minZ = appMinZ;
        if (appMaxZ > maxZ) maxZ = appMaxZ;
      }

      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      const updatedParts = p.parts.map(pt => {
        if (!effectiveIdSet.has(pt.id)) return pt;

        const oldBounds = this.joineryEngine.getPartBounds(pt);
        const dx = oldBounds.px - cx;
        const dz = oldBounds.pz - cz;
        let newDx = dx;
        let newDz = dz;

        if (angleDelta === 90) {
          newDx = dz;
          newDz = -dx;
        } else if (angleDelta === -90) {
          newDx = -dz;
          newDz = dx;
        } else if (angleDelta === 180) {
          newDx = -dx;
          newDz = -dz;
        }

        const newPosX = Math.round((cx + newDx) * 10) / 10;
        const newPosZ = Math.round((cz + newDz) * 10) / 10;

        const currentOrient = pt.orientation || 'horizontal';
        let newOrientation = currentOrient;
        let newLength = pt.length;
        let newWidth = pt.width;
        let newContourPoints = pt.contourPoints;

        // Rotación de mesones y piezas poligonales / dibujo libre (contourPoints)
        if (pt.shapeType === 'freehand' && pt.contourPoints && pt.contourPoints.length >= 3) {
          const pts = pt.contourPoints;
          let minPtX = Infinity, maxPtX = -Infinity, minPtY = Infinity, maxPtY = -Infinity;
          for (const p of pts) {
            if (p.x < minPtX) minPtX = p.x;
            if (p.x > maxPtX) maxPtX = p.x;
            if (p.y < minPtY) minPtY = p.y;
            if (p.y > maxPtY) maxPtY = p.y;
          }
          const midPtX = (minPtX + maxPtX) / 2;
          const midPtY = (minPtY + maxPtY) / 2;

          const rotatedPts = pts.map(p => {
            const rx = p.x - midPtX;
            const ry = p.y - midPtY;
            let nrx = rx;
            let nry = ry;
            if (angleDelta === 90) {
              nrx = ry;
              nry = -rx;
            } else if (angleDelta === -90) {
              nrx = -ry;
              nry = rx;
            } else if (angleDelta === 180) {
              nrx = -rx;
              nry = -ry;
            }
            return { x: nrx, y: nry };
          });

          let newMinX = Infinity, newMaxX = -Infinity, newMinY = Infinity, newMaxY = -Infinity;
          for (const rp of rotatedPts) {
            if (rp.x < newMinX) newMinX = rp.x;
            if (rp.x > newMaxX) newMaxX = rp.x;
            if (rp.y < newMinY) newMinY = rp.y;
            if (rp.y > newMaxY) newMaxY = rp.y;
          }

          newLength = Math.max(10, Math.round(newMaxX - newMinX));
          newWidth = Math.max(10, Math.round(newMaxY - newMinY));
          newContourPoints = rotatedPts.map(rp => ({
            x: Math.round((rp.x - newMinX) * 10) / 10,
            y: Math.round((rp.y - newMinY) * 10) / 10
          }));
        } else if (Math.abs(angleDelta) === 90) {
          if (currentOrient === 'horizontal') {
            newOrientation = 'horizontal';
            newLength = pt.width;
            newWidth = pt.length;
          } else if (currentOrient === 'vertical_xy') {
            newOrientation = 'vertical_yz';
            const horizontalSpan = oldBounds.sx;
            const verticalHeight = oldBounds.sy;

            const isBacksplash =
              pt.componentRole === 'backsplash' ||
              pt.name.toUpperCase().includes('SALPICADERO');

            const isPlinth =
              !isBacksplash &&
              (pt.componentRole === 'plinth' ||
                pt.name.toUpperCase().includes('ZOCALO') ||
                pt.name.toUpperCase().includes('ZÓCALO'));

            const isCabinetSide =
              !isBacksplash &&
              !isPlinth &&
              (pt.componentRole === 'side_left' ||
                pt.componentRole === 'side_right' ||
                pt.componentRole === 'divider' ||
                pt.componentRole === 'door' ||
                pt.componentRole === 'back' ||
                (pt.name.toUpperCase().includes('LATERAL') &&
                  !pt.name.toUpperCase().includes('CAJ') &&
                  pt.componentRole !== 'drawer_box' &&
                  pt.componentRole !== 'drawer_lateral'));

            const isDrawerBoxSide =
              !isBacksplash &&
              !isPlinth &&
              !isCabinetSide &&
              (pt.componentRole === 'drawer_box' ||
                pt.componentRole === 'drawer_lateral' ||
                (pt.name.toUpperCase().includes('LATERAL') && pt.name.toUpperCase().includes('CAJ')));

            if (isDrawerBoxSide || ((isBacksplash || isPlinth) && horizontalSpan > verticalHeight)) {
              newLength = horizontalSpan;
              newWidth = verticalHeight;
            } else {
              newLength = verticalHeight;
              newWidth = horizontalSpan;
            }
          } else if (currentOrient === 'vertical_yz') {
            newOrientation = 'vertical_xy';
            const horizontalSpan = oldBounds.sz;
            const verticalHeight = oldBounds.sy;
            newLength = horizontalSpan;
            newWidth = verticalHeight;
          }
        }

        return {
          ...pt,
          posX: newPosX,
          posZ: newPosZ,
          orientation: newOrientation,
          length: newLength,
          width: newWidth,
          contourPoints: newContourPoints,
          ...(!pt.groupId && pt.sourceParametricModuleId
            ? { manuallyModifiedAfterUngroup: true }
            : {})
        };
      });

      const targetAppIds = new Set(targetAppliances.map(a => a.id));
      const updatedAppliances = (p.appliances || []).map(a => {
        if (!targetAppIds.has(a.id)) return a;

        const dx = a.position.x - cx;
        const dz = a.position.z - cz;
        let newDx = dx;
        let newDz = dz;

        if (angleDelta === 90) {
          newDx = dz;
          newDz = -dx;
        } else if (angleDelta === -90) {
          newDx = -dz;
          newDz = dx;
        } else if (angleDelta === 180) {
          newDx = -dx;
          newDz = -dz;
        }

        const newPosX = Math.round((cx + newDx) * 10) / 10;
        const newPosZ = Math.round((cz + newDz) * 10) / 10;
        const newRot = (((a.rotation || 0) + angleDelta) % 360 + 360) % 360;

        return {
          ...a,
          position: {
            ...a.position,
            x: newPosX,
            z: newPosZ
          },
          rotation: newRot
        };
      });

      // Actualizar la dirección frontal ('front' | 'right' | 'back' | 'left') de los grupos rotados
      const currentGroups = p.groups ? [...p.groups] : [];
      for (const gId of groupIdsFromParts) {
        if (!currentGroups.some(g => g.id === gId)) {
          const sample = targetParts.find(pt => pt.groupId === gId);
          const isCt = targetParts.some(
            pt => pt.groupId === gId && (pt.componentRole === 'countertop' || pt.componentRole === 'backsplash')
          );
          currentGroups.push({
            id: gId,
            name: sample?.groupName || 'Módulo',
            type: 'assembly',
            isCountertop: isCt,
            facingDirection: 'front'
          });
        }
      }

      const facingOrder: ('front' | 'right' | 'back' | 'left')[] = ['front', 'right', 'back', 'left'];
      const updatedGroups = currentGroups.map(g => {
        if (!groupIdsFromParts.has(g.id)) return g;
        const currentFacing = g.facingDirection || this.computeGeometricFacingDirection(g.id, p.parts);
        const curIdx = facingOrder.indexOf(currentFacing);
        const steps = angleDelta === 90 ? 1 : angleDelta === -90 ? -1 : 2;
        const nextIdx = (curIdx + steps + 4) % 4;
        const nextFacing = facingOrder[nextIdx];

        const isDrawerGrp =
          g.type === 'drawer' ||
          g.subType === 'drawer' ||
          g.templateId === 'modular_drawer' ||
          Boolean(g.drawerConfig);

        if (isDrawerGrp && g.drawerConfig) {
          const gRotatedParts = updatedParts.filter(pt => pt.groupId === g.id);
          const fondo = gRotatedParts.find(
            pt =>
              pt.id.toLowerCase().endsWith('_fondo_mdf') ||
              pt.componentRole === 'drawer_bottom' ||
              (pt.orientation === 'horizontal' && pt.thickness <= 6)
          );
          const lat = gRotatedParts.find(
            pt =>
              pt.id.toLowerCase().endsWith('_lat_izq') ||
              pt.id.toLowerCase().endsWith('_lat_der') ||
              pt.componentRole === 'drawer_lateral' ||
              pt.name.toLowerCase().includes('lateral izq') ||
              pt.name.toLowerCase().includes('lateral der')
          );
          const frente = gRotatedParts.find(
            pt => pt.componentRole === 'drawer_front' || pt.id.toLowerCase().endsWith('_frente')
          );

          let minY = Infinity;
          let sumX = 0;
          let sumZ = 0;
          for (const gp of gRotatedParts) {
            const b = this.partGeometry.getWorldAABB(gp);
            if (b.minY < minY) minY = b.minY;
            sumX += b.px;
            sumZ += b.pz;
          }
          const liveMinY = Number.isFinite(minY)
            ? Math.round(minY * 10) / 10
            : g.drawerConfig.posY ?? 100;
          const fallbackX =
            gRotatedParts.length > 0
              ? Math.round((sumX / gRotatedParts.length) * 10) / 10
              : g.drawerConfig.posX ?? 0;
          const fallbackZ =
            gRotatedParts.length > 0
              ? Math.round((sumZ / gRotatedParts.length) * 10) / 10
              : g.drawerConfig.posZ ?? 0;
          const livePosX = fondo?.posX ?? fallbackX;
          const livePosZ = fondo?.posZ ?? fallbackZ;

          const isWidthZ = nextFacing === 'right' || nextFacing === 'left';
          const dirSign = nextFacing === 'front' || nextFacing === 'right' ? 1 : -1;
          const slideLength = lat
            ? Number(lat.length)
            : g.drawerConfig.slideLength || g.slideLength || 450;
          const ft = frente?.thickness || g.drawerConfig.frontThickness || lat?.thickness || 15;
          const frontMountType =
            frente?.hardwareConfig?.frontMountType ??
            g.drawerConfig.frontMountType ??
            (frente ? 'overlay' : 'none');
          const recessBehindDoor = g.drawerConfig.recessBehindDoor;
          const setback =
            frontMountType === 'inset'
              ? ft + 2
              : frontMountType === 'none'
                ? (recessBehindDoor ? 22 : 5)
                : 0;
          const boxDepthCenter = isWidthZ ? livePosX : livePosZ;
          const liveFrontEdgeCoord =
            Math.round((boxDepthCenter + dirSign * (slideLength / 2 + setback)) * 10) / 10;

          return {
            ...g,
            facingDirection: nextFacing,
            drawerConfig: {
              ...g.drawerConfig,
              facingDirection: nextFacing,
              posX: livePosX,
              posY: liveMinY,
              posZ: livePosZ,
              frontEdgeCoord: liveFrontEdgeCoord
            }
          };
        }

        return {
          ...g,
          facingDirection: nextFacing
        };
      });

      return {
        ...p,
        parts: updatedParts,
        appliances: updatedAppliances,
        groups: updatedGroups
      };
    });
  }

  /**
   * Cambia el material de melamina o mesón a múltiples piezas a la vez (para varios módulos seleccionados).
   * Protege las piezas de mesón para no recibir melamina y las de mueble para no recibir mesón.
   */
  changeMultiplePartsMaterial(partIds: string[], materialId: string) {
    const mat = this.materialsList().find(m => m.id === materialId)
      || DEFAULT_COUNTERTOP_MATERIALS.find(m => m.id === materialId)
      || MELAMINE_MATERIALS_CATALOG.find(m => m.id === materialId);
    if (!mat) return;
    const isTargetMatCountertop = isCountertopMaterial(mat);

    this.updateProject(p => ({
      ...p,
      materials: p.materials.some(m => m.id === mat.id) ? p.materials : [...p.materials, mat],
      groups: (p.groups || []).map(g => {
        if (!g.parametricConfig || isTargetMatCountertop) return g;
        const gParts = p.parts.filter(pt => pt.groupId === g.id);
        const selectedParametric = gParts.filter(
          pt => partIds.includes(pt.id) && isPartParametricGenerated(pt, gParts)
        );
        if (selectedParametric.length === 0) return g;
        const touchesStructure = selectedParametric.some(
          pt =>
            pt.componentRole !== 'door' &&
            pt.componentRole !== 'drawer_front' &&
            pt.componentRole !== 'back'
        );
        const touchesDoor = selectedParametric.some(
          pt => pt.componentRole === 'door' || pt.componentRole === 'drawer_front'
        );
        return {
          ...g,
          parametricConfig: {
            ...g.parametricConfig,
            structureMaterialId: touchesStructure ? mat.id : g.parametricConfig.structureMaterialId,
            doorMaterialId: touchesDoor ? mat.id : g.parametricConfig.doorMaterialId
          }
        };
      }),
      parts: p.parts.map(part => {
        if (partIds.includes(part.id)) {
          const isCtPart = part.componentRole === 'countertop' || part.componentRole === 'backsplash' ||
            (part.name && (part.name.toUpperCase().includes('MESÓN') || part.name.toUpperCase().includes('MESON') || part.name.toUpperCase().includes('SALPICADERO')));

          // Si el material a aplicar es de mesón, NO aplicarlo a piezas que no sean de mesón (ej. muebles estándar)
          if (isTargetMatCountertop && !isCtPart) {
            return part;
          }
          // Si el material a aplicar es melamina, NUNCA aplicarlo a piezas de mesón o salpicadero
          if (!isTargetMatCountertop && isCtPart) {
            return part;
          }

          return {
            ...part,
            materialId: mat.id,
            materialName: mat.name,
            colorHex: mat.colorHex,
            grain: mat.hasGrain ? (part.grain === 'none' ? 'length' : part.grain) : 'none'
          };
        }
        return part;
      })
    }));
  }

  /**
   * Rota rígidamente un módulo, cajón o grupo de piezas en el plano horizontal (90°, -90° o 180°)
   * alrededor de su centro geométrico real (cx, cz), preservando intacta la altura vertical (sy)
   * de cada pieza y evitando pérdida de precisión decimal (.5 mm).
   */
  rotateGroupRigidly(groupId: string, angleDelta: 90 | -90 | 180) {
    const proj = this.currentProject();
    if (!proj) return;
    const hostedGroupIds = new Set(
      (proj.groups || []).filter(g => g.hostGroupId === groupId).map(g => g.id)
    );
    const allPartIds = proj.parts
      .filter(pt => pt.groupId === groupId || (pt.groupId !== undefined && hostedGroupIds.has(pt.groupId)))
      .map(p => p.id);
    if (allPartIds.length === 0) return;
    this.rotateMultiplePartsRigidly(allPartIds, angleDelta);
  }

  /**
   * Redimensiona un módulo o grupo completo en bloque (Ancho, Alto, Profundidad o Espesor Estructural)
   * preservando su orientación, su posición en la escena y las holguras internas sin colisiones.
   */
  resizeGroupStructure(
    groupId: string,
    prop: 'width' | 'height' | 'depth' | 'thickness',
    rawValue: number
  ) {
    if (isNaN(rawValue)) return;
    const currentProj = this.currentProject();
    if (!currentProj) return;

    const group = (currentProj.groups || []).find(g => g.id === groupId);
    const groupParts = currentProj.parts.filter(pt => pt.groupId === groupId);
    if (groupParts.length === 0) return;

    const parametricGroupParts = groupParts.filter(pt => isPartParametricGenerated(pt, groupParts));
    const anchorParts = parametricGroupParts.length > 0 ? parametricGroupParts : groupParts;

    let oldMinX = Infinity, oldMaxX = -Infinity;
    let oldMinY = Infinity, oldMaxY = -Infinity;
    let oldMinZ = Infinity, oldMaxZ = -Infinity;
    for (const pt of anchorParts) {
      const b = this.joineryEngine.getPartBounds(pt);
      if (b.minX < oldMinX) oldMinX = b.minX;
      if (b.maxX > oldMaxX) oldMaxX = b.maxX;
      if (b.minY < oldMinY) oldMinY = b.minY;
      if (b.maxY > oldMaxY) oldMaxY = b.maxY;
      if (b.minZ < oldMinZ) oldMinZ = b.minZ;
      if (b.maxZ > oldMaxZ) oldMaxZ = b.maxZ;
    }

    const oldCx = (oldMinX + oldMaxX) / 2;
    const oldCz = (oldMinZ + oldMaxZ) / 2;
    const facing = this.getGroupFacingDirection(groupId);
    const isRotated90 = facing === 'left' || facing === 'right';

    // 1. Si el grupo tiene configuración paramétrica (Módulo Paramétrico), regeneramos con precisión milimétrica
    if (group?.parametricConfig) {
      const val =
        prop === 'thickness'
          ? Math.max(3, Math.min(50, Math.round(rawValue)))
          : Math.max(120, Math.round(rawValue));

      // Si el módulo está rotado 90° en la escena, el eje X del mundo corresponde a la profundidad del mueble
      // y el eje Z del mundo corresponde al ancho frontal del mueble.
      let targetProp: 'width' | 'height' | 'depth' | 'thickness' = prop;
      if (isRotated90) {
        if (prop === 'width') targetProp = 'depth';
        else if (prop === 'depth') targetProp = 'width';
      }

      const nextCfg: ParametricCabinetConfig = prop === 'thickness'
        ? {
            ...group.parametricConfig,
            structureThickness: Math.max(12, Math.min(22, val)),
            doorThickness: Math.max(12, Math.min(22, val)),
            posX: 0,
            posY: 0,
            posZ: 0
          }
        : {
            ...group.parametricConfig,
            [targetProp]: val,
            posX: 0,
            posY: 0,
            posZ: 0
          };

      const res = this.cabinetGen.generateParametricCabinet(nextCfg, currentProj.materials);
      const updatedParts = res.parts.map(p => ({
        ...p,
        groupId,
        groupName: group.name,
        isParametricGenerated: true
      }));
      const positionedParts = this.transformPartsToGroupFrame(
        updatedParts,
        oldCx,
        oldMinY,
        oldCz,
        facing
      );
      const nextHeight = Math.max(150, Number(nextCfg.height) || 800);
      const syncedCfg: ParametricCabinetConfig = {
        ...nextCfg,
        posX: Math.round(oldCx * 10) / 10,
        posY: Math.round((oldMinY + nextHeight / 2) * 10) / 10,
        posZ: Math.round(oldCz * 10) / 10
      };
      this.updateParametricCabinet(groupId, positionedParts, group.name, syncedCfg, res.module);
      return;
    }

    // 2. Si es un grupo no paramétrico (cajón independiente, plantilla o ensamble manual / mesón)
    if (prop === 'thickness') {
      const newT = Math.max(3, Math.min(50, Math.round(rawValue)));
      const isCountertopGroup = group?.isCountertop || groupParts.some(p => p.componentRole === 'countertop' || p.componentRole === 'backsplash');

      if (isCountertopGroup) {
        const isWaterfallIsland = groupParts.some(p =>
          p.name.toUpperCase().includes('CASCADA') ||
          p.name.toUpperCase().includes('ISLA')
        );

        if (isWaterfallIsland) {
          const cubierta = groupParts.find(p => p.orientation === 'horizontal') || groupParts[0];
          const oldT = cubierta.thickness || 30;
          // Mantener la cota superior de la isla intacta (aprox. 860-890 mm)
          const islandTopY = (cubierta.posY ?? 860) + oldT / 2;
          const newCubiertaPosY = Math.round((islandTopY - newT / 2) * 10) / 10;
          const legH = Math.max(100, Math.round((islandTopY - newT) * 10) / 10);
          const legPosY = Math.round((legH / 2) * 10) / 10;
          const islandLen = cubierta.length || 1800;
          const islandCx = cubierta.posX ?? 0;
          const leftCostadoPosX = Math.round((islandCx - islandLen / 2 + newT / 2) * 10) / 10;
          const rightCostadoPosX = Math.round((islandCx + islandLen / 2 - newT / 2) * 10) / 10;

          this.updateProject(p => ({
            ...p,
            parts: p.parts.map(pt => {
              if (pt.groupId !== groupId) return pt;
              const nameUpper = pt.name.toUpperCase();
              if (pt.orientation === 'horizontal') {
                return {
                  ...pt,
                  thickness: newT,
                  posY: newCubiertaPosY
                };
              }
              if (nameUpper.includes('IZQUIERDO') || (pt.posX ?? 0) < islandCx) {
                return {
                  ...pt,
                  thickness: newT,
                  length: legH,
                  posX: leftCostadoPosX,
                  posY: legPosY
                };
              }
              if (nameUpper.includes('DERECHO') || (pt.posX ?? 0) >= islandCx) {
                return {
                  ...pt,
                  thickness: newT,
                  length: legH,
                  posX: rightCostadoPosX,
                  posY: legPosY
                };
              }
              return { ...pt, thickness: newT };
            })
          }));
          return;
        }

        // Para mesones Rectos, En L o En U con o sin salpicadero:
        const horizontalSlab = groupParts.find(p =>
          p.orientation === 'horizontal' &&
          !p.name.toUpperCase().includes('SALPICADERO')
        ) || groupParts.find(p => p.orientation === 'horizontal') || groupParts[0];

        const oldMesonT = horizontalSlab?.thickness || 30;
        const baseY = (horizontalSlab?.posY ?? 860) - oldMesonT / 2;
        const newMesonPosY = Math.round((baseY + newT / 2) * 10) / 10;
        const splashT = Math.min(20, newT);

        this.updateProject(p => ({
          ...p,
          parts: p.parts.map(pt => {
            if (pt.groupId !== groupId) return pt;
            if (pt.orientation === 'horizontal' || (pt.componentRole === 'countertop' && !pt.name.toUpperCase().includes('SALPICADERO'))) {
              return { ...pt, thickness: newT, posY: newMesonPosY };
            }
            if (pt.componentRole === 'backsplash' || pt.name.toUpperCase().includes('SALPICADERO')) {
              const splashH = pt.width || 75;
              const newSplashPosY = Math.round((newMesonPosY + newT / 2 + splashH / 2 + 0.5) * 10) / 10;
              return { ...pt, thickness: splashT, posY: newSplashPosY };
            }
            return { ...pt, thickness: newT };
          })
        }));
        return;
      }

      this.updateProject(p => ({
        ...p,
        parts: p.parts.map(pt => {
          if (pt.groupId !== groupId) return pt;
          if ((pt.thickness || 15) <= 8 || pt.componentRole === 'back') return pt;
          return { ...pt, thickness: newT };
        })
      }));
      return;
    }

    const targetSpan = Math.max(80, Math.round(rawValue));
    const oldSpanX = Math.max(1, oldMaxX - oldMinX);
    const oldSpanY = Math.max(1, oldMaxY - oldMinY);
    const oldSpanZ = Math.max(1, oldMaxZ - oldMinZ);

    const deltaX = prop === 'width' ? targetSpan - oldSpanX : 0;
    const deltaY = prop === 'height' ? targetSpan - oldSpanY : 0;
    const deltaZ = prop === 'depth' ? targetSpan - oldSpanZ : 0;

    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && Math.abs(deltaZ) < 0.5) return;

    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(pt => {
        if (pt.groupId !== groupId) return pt;
        const b = this.joineryEngine.getPartBounds(pt);
        let newSx = b.sx;
        let newSy = b.sy;
        let newSz = b.sz;
        let newPx = b.px;
        let newPy = b.py;
        let newPz = b.pz;

        if (Math.abs(deltaX) >= 0.5) {
          if (b.sx <= 36 && (b.sy > 36 || b.sz > 36)) {
            // El espesor de la pieza está en X: desplazar su posición X sin alterar su espesor
            const norm = oldSpanX > b.sx ? (b.px - oldCx) / ((oldSpanX - b.sx) / 2) : 0;
            newPx = Math.round((oldCx + norm * ((targetSpan - b.sx) / 2)) * 10) / 10;
          } else {
            // La pieza se extiende a lo largo de X
            if (b.sx >= oldSpanX - 65) {
              newSx = Math.max(40, Math.round((b.sx + deltaX) * 10) / 10);
            } else {
              const ratio = targetSpan / oldSpanX;
              newSx = Math.max(40, Math.round(b.sx * ratio * 10) / 10);
              newPx = Math.round((oldCx + (b.px - oldCx) * ratio) * 10) / 10;
            }
          }
        }

        if (Math.abs(deltaY) >= 0.5) {
          if (b.sy <= 36 && (b.sx > 36 || b.sz > 36)) {
            // Pieza horizontal (piso, techo, repisa): mantener espesor y escalar altura desde la base oldMinY
            if (Math.abs(b.minY - oldMinY) <= 5) {
              newPy = b.py;
            } else if (Math.abs(b.maxY - oldMaxY) <= 5) {
              newPy = Math.round((oldMinY + targetSpan - b.sy / 2) * 10) / 10;
            } else {
              const ratio = targetSpan / oldSpanY;
              newPy = Math.round((oldMinY + (b.py - oldMinY) * ratio) * 10) / 10;
            }
          } else {
            // Pieza vertical (costado, puerta, fondo, frente)
            if (b.sy >= oldSpanY - 130) {
              newSy = Math.max(40, Math.round((b.sy + deltaY) * 10) / 10);
              newPy = Math.round((b.minY + newSy / 2) * 10) / 10;
            } else {
              const ratio = targetSpan / oldSpanY;
              const relMinY = (b.minY - oldMinY) * ratio;
              newSy = Math.max(40, Math.round(b.sy * ratio * 10) / 10);
              newPy = Math.round((oldMinY + relMinY + newSy / 2) * 10) / 10;
            }
          }
        }

        if (Math.abs(deltaZ) >= 0.5) {
          if (b.sz <= 36 && (b.sx > 36 || b.sy > 36)) {
            // El espesor de la pieza está en Z: desplazar su posición Z sin alterar su espesor
            const norm = oldSpanZ > b.sz ? (b.pz - oldCz) / ((oldSpanZ - b.sz) / 2) : 0;
            newPz = Math.round((oldCz + norm * ((targetSpan - b.sz) / 2)) * 10) / 10;
          } else {
            // La pieza se extiende a lo largo de Z
            if (b.sz >= oldSpanZ - 65) {
              newSz = Math.max(40, Math.round((b.sz + deltaZ) * 10) / 10);
            } else {
              const ratio = targetSpan / oldSpanZ;
              newSz = Math.max(40, Math.round(b.sz * ratio * 10) / 10);
              newPz = Math.round((oldCz + (b.pz - oldCz) * ratio) * 10) / 10;
            }
          }
        }

        // Mapear (newSx, newSy, newSz) de vuelta a (length, width) según la orientación de la pieza
        const orient = pt.orientation || 'horizontal';
        let newLength = pt.length;
        let newWidth = pt.width;
        let newContourPoints = pt.contourPoints;

        if (pt.shapeType === 'freehand' && pt.contourPoints && pt.contourPoints.length >= 3) {
          const scaleX = oldSpanX > 10 ? newSx / oldSpanX : 1;
          const scaleZ = oldSpanZ > 10 ? newSz / oldSpanZ : 1;
          newLength = newSx;
          newWidth = newSz;
          newContourPoints = pt.contourPoints.map(p => ({
            x: Math.round(p.x * scaleX * 10) / 10,
            y: Math.round(p.y * scaleZ * 10) / 10
          }));
        } else if (orient === 'horizontal') {
          newLength = newSx;
          newWidth = newSz;
        } else if (orient === 'vertical_xy') {
          newLength = newSx;
          newWidth = newSy;
        } else if (orient === 'vertical_yz') {
          const isPlinth =
            pt.componentRole === 'plinth' ||
            pt.name.toUpperCase().includes('ZOCALO') ||
            pt.name.toUpperCase().includes('ZÓCALO');
          const isCabinetSide =
            !isPlinth &&
            (pt.componentRole === 'side_left' ||
              pt.componentRole === 'side_right' ||
              pt.componentRole === 'divider' ||
              pt.componentRole === 'door' ||
              pt.componentRole === 'back' ||
              (pt.name.toUpperCase().includes('LATERAL') &&
                !pt.name.toUpperCase().includes('CAJ') &&
                pt.componentRole !== 'drawer_box' &&
                pt.componentRole !== 'drawer_lateral'));
          const isDrawerBoxSide =
            !isPlinth &&
            !isCabinetSide &&
            (pt.componentRole === 'drawer_box' ||
              pt.componentRole === 'drawer_lateral' ||
              (pt.name.toUpperCase().includes('LATERAL') && pt.name.toUpperCase().includes('CAJ')));

          if (isDrawerBoxSide || (isPlinth && newSz > newSy)) {
            newLength = newSz;
            newWidth = newSy;
          } else {
            newLength = newSy;
            newWidth = newSz;
          }
        }

        return {
          ...pt,
          length: newLength,
          width: newWidth,
          contourPoints: newContourPoints,
          posX: newPx,
          posY: newPy,
          posZ: newPz
        };
      })
    }));
  }

  /**
   * Detecta la dirección cardinal ('front' | 'right' | 'back' | 'left') hacia la que mira
   * el frente de un módulo, armario, estantería o cajón.
   */
  getGroupFacingDirection(groupId: string): 'front' | 'right' | 'back' | 'left' {
    const currentProj = this.currentProject();
    if (!currentProj) return 'front';
    const grp = (currentProj.groups || []).find(g => g.id === groupId);
    if (grp?.facingDirection) return grp.facingDirection;
    return this.computeGeometricFacingDirection(groupId, currentProj.parts);
  }

  computeGeometricFacingDirection(groupId: string, parts: Part[]): 'front' | 'right' | 'back' | 'left' {
    const rawGroupParts = parts.filter(pt => pt.groupId === groupId);
    if (rawGroupParts.length === 0) return 'front';
    const filteredParametric = rawGroupParts.filter(pt =>
      isPartParametricGenerated(pt, rawGroupParts)
    );
    const groupParts = filteredParametric.length > 0 ? filteredParametric : rawGroupParts;

    let grpMinX = Infinity, grpMaxX = -Infinity;
    let grpMinZ = Infinity, grpMaxZ = -Infinity;
    for (const pt of groupParts) {
      const b = this.joineryEngine.getPartBounds(pt);
      if (b.minX < grpMinX) grpMinX = b.minX;
      if (b.maxX > grpMaxX) grpMaxX = b.maxX;
      if (b.minZ < grpMinZ) grpMinZ = b.minZ;
      if (b.maxZ > grpMaxZ) grpMaxZ = b.maxZ;
    }
    const cx = (grpMinX + grpMaxX) / 2;
    const cz = (grpMinZ + grpMaxZ) / 2;

    // 1. Priorizar puertas, frentes de cajón o zócalos frontales
    const frontPart = groupParts.find(
      p =>
        p.componentRole === 'door' ||
        p.componentRole === 'drawer_front' ||
        p.componentRole === 'plinth' ||
        p.id.includes('frente') ||
        p.name.toUpperCase().includes('FRENTE') ||
        p.name.toUpperCase().includes('PUERTA')
    );

    if (frontPart) {
      const dx = (frontPart.posX ?? 0) - cx;
      const dz = (frontPart.posZ ?? 0) - cz;
      if (frontPart.orientation === 'vertical_yz') {
        return dx >= 0 ? 'right' : 'left';
      }
      return dz >= 0 ? 'front' : 'back';
    }

    // 2. Si es un módulo abierto sin puertas o un mesón, usar el panel de fondo trasero o salpicadero
    const backPart = groupParts.find(
      p =>
        p.componentRole === 'back' ||
        p.componentRole === 'backsplash' ||
        (p.name.toUpperCase().includes('FONDO') && p.orientation !== 'horizontal') ||
        p.name.toUpperCase().includes('TRASERA') ||
        p.name.toUpperCase().includes('SALPICADERO')
    );

    if (backPart) {
      const dx = (backPart.posX ?? 0) - cx;
      const dz = (backPart.posZ ?? 0) - cz;
      if (backPart.orientation === 'vertical_yz') {
        return dx >= 0 ? 'left' : 'right';
      }
      return dz >= 0 ? 'back' : 'front';
    }

    // 3. Fallback por orientación de los laterales estructurales
    const sidePart = groupParts.find(
      p => p.componentRole === 'side_left' || p.componentRole === 'side_right' || p.name.toUpperCase().includes('LATERAL')
    );
    if (sidePart) {
      return sidePart.orientation === 'vertical_xy' ? 'right' : 'front';
    }

    return 'front';
  }

  setGroupFacingDirection(groupId: string, targetFace: 'front' | 'right' | 'back' | 'left') {
    const curFace = this.getGroupFacingDirection(groupId);
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

    this.rotateGroupRigidly(groupId, diff as 90 | -90 | 180);
    this.updateProject(p => {
      const groups = p.groups || [];
      const exists = groups.some(g => g.id === groupId);
      const isCt = p.parts.some(
        pt => pt.groupId === groupId && (pt.componentRole === 'countertop' || pt.componentRole === 'backsplash')
      );
      const updatedGroups = exists
        ? groups.map(g => (g.id === groupId ? { ...g, facingDirection: targetFace, ...(isCt ? { isCountertop: true } : {}) } : g))
        : [
            ...groups,
            {
              id: groupId,
              name: p.parts.find(pt => pt.groupId === groupId)?.groupName || 'Módulo',
              type: 'assembly' as const,
              isCountertop: isCt,
              facingDirection: targetFace
            }
          ];
      return {
        ...p,
        groups: updatedGroups
      };
    });
  }

  /**
   * Construye de forma determinista y con 0 colisiones las piezas 3D de un Cajón Modular
   * según su montaje de frente ('overlay' | 'inset' | 'none'), sistema de apertura
   * ('handle' | 'push' | 'finger_pull') y orientación del mueble ('front' | 'right' | 'back' | 'left').
   */
  buildModularDrawerParts(
    groupId: string,
    groupName: string,
    cfg: ParametricDrawerConfig
  ): { parts: Part[]; normalizedConfig: ParametricDrawerConfig } {
    const currentProj = this.currentProject();
    const materials = this.materialsList();

    const frontMountType: DrawerFrontMountType =
      cfg.frontMountType ?? (cfg.includeFront === false ? 'none' : 'overlay');
    const handleType: DrawerOpeningSystem = cfg.handleType ?? 'handle';

    const t = Math.max(12, cfg.boxThickness || cfg.thickness || 15);
    const ft = Math.max(12, cfg.frontThickness || t);
    const bT = Math.max(3, cfg.bottomThickness || 3);
    const gap = cfg.slideGap ?? 26;

    const effectiveHostGroupId = cfg.hostGroupId || cfg.targetModuleId;
    const effectiveHostCavityId = cfg.hostCavityId || cfg.targetCavityId;

    // Detectar si el cajón se ubica dentro de un hueco existente en la escena
    let matchedCavity: ModuleCavityInfo | undefined;
    if (effectiveHostGroupId && effectiveHostGroupId !== 'floor') {
      const hostGrp = (currentProj?.groups || []).find(g => g.id === effectiveHostGroupId);
      const cavs = this.partGeometry.detectModuleCavities(
        effectiveHostGroupId,
        currentProj?.parts || [],
        hostGrp,
        currentProj?.appliances,
        { includeOccupied: true }
      );
      matchedCavity =
        (effectiveHostCavityId ? cavs.find(c => c.id === effectiveHostCavityId) : undefined) ||
        cavs[0];
    } else if (cfg.hostGroupId !== 'floor' && cfg.frontEdgeCoord === undefined && currentProj) {
      const reqX = cfg.posX ?? 0;
      const reqY = cfg.posY ?? 100;
      const reqZ = cfg.posZ ?? 0;
      const allCavs = this.partGeometry.detectAllSceneCavities(
        currentProj.parts || [],
        currentProj.groups || [],
        currentProj.appliances
      );
      matchedCavity = allCavs.find(c => {
        const isWZ = c.facingDirection === 'right' || c.facingDirection === 'left';
        const spanDist = isWZ ? Math.abs(reqZ - c.centerZ) : Math.abs(reqX - c.centerX);
        const depthDist = isWZ ? Math.abs(reqX - c.centerX) : Math.abs(reqZ - c.centerZ);
        return (
          spanDist <= c.innerWidth / 2 + 40 &&
          depthDist <= c.internalDepth / 2 + 80 &&
          reqY >= c.minY - 25 &&
          reqY <= c.maxY + 25
        );
      });
    }

    const projParts = currentProj?.parts || [];
    const cavRefPart = matchedCavity
      ? projParts.find(p => p.id === matchedCavity.leftPartId) ||
        projParts.find(p => p.id === matchedCavity.rightPartId) ||
        projParts.find(p => p.id === matchedCavity.topPartId) ||
        projParts.find(p => p.id === matchedCavity.bottomPartId)
      : undefined;

    const requestedMatId = cfg.materialId || cavRefPart?.materialId;
    const requestedFrontMatId = cfg.frontMaterialId || cfg.materialId || cavRefPart?.materialId;
    const matchedMat = requestedMatId ? materials.find(m => m.id === requestedMatId) : undefined;
    const matchedFrontMat = requestedFrontMatId
      ? materials.find(m => m.id === requestedFrontMatId)
      : undefined;

    const refMaterialFallback: Material | undefined = cavRefPart
      ? {
          id: cavRefPart.materialId,
          name: cavRefPart.materialName,
          colorHex: cavRefPart.colorHex ?? '#f8fafc',
          thickness: cavRefPart.thickness || 18,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 45000,
          hasGrain: cavRefPart.grain !== 'none'
        }
      : undefined;

    const resolvedBoxMat =
      matchedMat && cavRefPart?.colorHex && (!cfg.materialId || cfg.materialId === cavRefPart.materialId)
        ? { ...matchedMat, colorHex: cavRefPart.colorHex }
        : matchedMat;

    const defaultMat =
      resolvedBoxMat ||
      (!cfg.materialId || cfg.materialId === cavRefPart?.materialId ? refMaterialFallback : undefined) ||
      materials.find(m => m.thickness >= 15) ||
      materials[0];

    const resolvedFrontMat =
      matchedFrontMat &&
      cavRefPart?.colorHex &&
      (!cfg.frontMaterialId || cfg.frontMaterialId === cavRefPart.materialId) &&
      (!cfg.materialId || cfg.materialId === cavRefPart.materialId)
        ? { ...matchedFrontMat, colorHex: cavRefPart.colorHex }
        : matchedFrontMat;

    const frontMat =
      resolvedFrontMat ||
      (!cfg.frontMaterialId && (!cfg.materialId || cfg.materialId === cavRefPart?.materialId)
        ? refMaterialFallback
        : undefined) ||
      defaultMat;

    const mdfMat =
      materials.find(m => m.id === cfg.bottomMaterialId || m.thickness === 3) ||
      defaultMat;

    const facingDirection: 'front' | 'right' | 'back' | 'left' =
      cfg.facingDirection ?? matchedCavity?.facingDirection ?? 'front';
    const isWidthZ = facingDirection === 'right' || facingDirection === 'left';
    const dirSign = facingDirection === 'front' || facingDirection === 'right' ? 1 : -1;

    const st = Math.max(12, cfg.sideThickness ?? matchedCavity?.leftSideThickness ?? 18);

    // Si el usuario pasó el ancho total del módulo (ej. 600mm) o no especificó un ancho personalizado, usar la luz interna real de la cavidad
    const rawRequestedWidth = cfg.outerWidth || cfg.cavityWidth || 0;
    const isOuterCabinetWidth =
      !!matchedCavity &&
      rawRequestedWidth > 0 &&
      Math.abs(
        rawRequestedWidth -
          (matchedCavity.innerWidth + matchedCavity.leftSideThickness + matchedCavity.rightSideThickness)
      ) <= 6;
    let outerWidth = Math.max(140, rawRequestedWidth || matchedCavity?.innerWidth || 564);
    if (matchedCavity) {
      if (rawRequestedWidth <= 0 || isOuterCabinetWidth) {
        outerWidth = matchedCavity.innerWidth;
      } else if (outerWidth > matchedCavity.innerWidth) {
        outerWidth = matchedCavity.innerWidth;
      }
    }

    const isRecessedBehindDoor =
      frontMountType === 'none' &&
      (cfg.recessBehindDoor ?? ((matchedCavity?.coveringDoorIds?.length ?? 0) > 0));

    let slideLength = cfg.slideLength || 450;
    if (matchedCavity) {
      const setback =
        frontMountType === 'inset'
          ? ft + 2
          : frontMountType === 'none'
            ? (isRecessedBehindDoor ? 22 : 5)
            : 0;
      const maxAllowedLength = Math.max(150, Math.floor(matchedCavity.internalDepth - setback - 5));
      if (slideLength > maxAllowedLength) {
        slideLength = this.partGeometry.getOptimalCommercialSlideLength(
          matchedCavity.internalDepth,
          frontMountType,
          ft,
          isRecessedBehindDoor
        );
      }
    }

    const boxWidth = Math.max(100, Math.round((outerWidth - gap) * 10) / 10);
    const testeraWidth = Math.max(60, Math.round((boxWidth - 2 * t) * 10) / 10);

    const nominalFrontH = Math.max(80, Math.round(cfg.frontHeight || (cfg.boxHeight || 140) + bT + 30));
    // Si es Uñero / Gola ('finger_pull'), descontar automáticamente 28 mm en el borde superior del frente
    let effFrontH =
      handleType === 'finger_pull' && frontMountType !== 'none'
        ? Math.max(60, nominalFrontH - 28)
        : nominalFrontH;

    // Ancho del frente según tipo de montaje:
    // - 'inset': anchoInterno - 4 mm (2 mm de holgura por lado en [minX + 2, maxX - 2])
    // - 'overlay': anchoInterno + 2 * espesorLateral - 4 mm (cubre ambos cantos con 2 mm de margen exterior)
    const frontWidth =
      frontMountType === 'inset'
        ? Math.max(100, Math.min(Math.round((outerWidth - 4) * 10) / 10, matchedCavity ? Math.round((matchedCavity.innerWidth - 4) * 10) / 10 : Infinity))
        : cfg.frontWidth && cfg.frontMountType === 'overlay' && Math.abs(cfg.frontWidth - outerWidth) > 2
          ? Math.round(cfg.frontWidth * 10) / 10
          : Math.max(100, Math.round((outerWidth + 2 * st - 4) * 10) / 10);

    const basePosX = matchedCavity && !isWidthZ ? matchedCavity.centerX : (cfg.posX ?? 0);
    const basePosZ = matchedCavity && isWidthZ ? matchedCavity.centerZ : (cfg.posZ ?? 0);
    let basePosY = cfg.posY ?? (matchedCavity ? matchedCavity.minY + 2 : 100);
    if (matchedCavity) {
      if (frontMountType === 'inset') {
        const maxInsetFrontH = Math.max(60, Math.floor(matchedCavity.height - 4));
        if (effFrontH > maxInsetFrontH) {
          effFrontH = maxInsetFrontH;
        }
        basePosY = Math.max(matchedCavity.minY + 2, Math.min(basePosY, matchedCavity.maxY - 2 - effFrontH));
      } else if (basePosY < matchedCavity.minY + 1.5 && basePosY >= matchedCavity.minY - 10) {
        basePosY = matchedCavity.minY + 2;
      }
    }

    const rawBoxH = Math.max(50, Math.round(cfg.boxHeight || 140));
    let effBoxH =
      frontMountType !== 'none'
        ? Math.max(40, Math.min(rawBoxH, effFrontH - bT - 6))
        : rawBoxH;

    // Garantizar que la caja interna quede estrictamente dentro de [minY + 4, maxY - 4]
    const boxBottomY = matchedCavity
      ? Math.max(basePosY, matchedCavity.minY + 4)
      : basePosY;
    if (matchedCavity) {
      const maxSafeBoxH = Math.max(40, Math.floor((matchedCavity.maxY - 4) - (boxBottomY + bT)));
      effBoxH = Math.min(effBoxH, maxSafeBoxH);
    }

    // Coordenada del plano frontal de los laterales del mueble
    const defaultDepthCenter = isWidthZ ? (cfg.posX ?? 0) : (cfg.posZ ?? 0);
    const frontEdgeCoord =
      cfg.frontEdgeCoord ??
      matchedCavity?.frontEdgeCoord ??
      Math.round((defaultDepthCenter + dirSign * (slideLength / 2 + (frontMountType === 'inset' ? ft + 2 : 0))) * 10) / 10;

    // Separación geométrica anti-colisión (tolerancia JoineryEngineService = 1.5 mm):
    // - 'overlay': cara interior del frente a +2.0 mm hacia afuera del casco/caja
    // - 'inset': cara exterior a ras en frontEdgeCoord y caja retrasada (ft + 2.0) mm
    // - 'none': caja retrasada 22 mm detrás de puerta cubriendo, o 5 mm libre
    const boxFrontEdge =
      frontMountType === 'inset'
        ? frontEdgeCoord - dirSign * (ft + 2.0)
        : frontMountType === 'none'
          ? frontEdgeCoord - dirSign * (isRecessedBehindDoor ? 22 : 5)
          : frontEdgeCoord;

    const boxDepthCenter = Math.round((boxFrontEdge - dirSign * (slideLength / 2)) * 10) / 10;
    const contraFrenteDepthPos = Math.round((boxFrontEdge - dirSign * (t / 2)) * 10) / 10;
    const traseraDepthPos = Math.round((boxFrontEdge - dirSign * (slideLength - t / 2)) * 10) / 10;
    const frontDepthPos =
      frontMountType === 'inset'
        ? Math.round((frontEdgeCoord - dirSign * (ft / 2)) * 10) / 10
        : Math.round((frontEdgeCoord + dirSign * (2.0 + ft / 2)) * 10) / 10;

    const boxCenterY = Math.round((boxBottomY + bT + effBoxH / 2) * 10) / 10;
    const fondoCenterY = Math.round((boxBottomY + bT / 2) * 10) / 10;
    const frontCenterY = Math.round((basePosY + effFrontH / 2) * 10) / 10;

    const spanCenter = isWidthZ ? basePosZ : basePosX;
    const leftSpanPos = Math.round((spanCenter - boxWidth / 2 + t / 2) * 10) / 10;
    const rightSpanPos = Math.round((spanCenter + boxWidth / 2 - t / 2) * 10) / 10;

    const partHandleType: HandleType =
      handleType === 'handle'
        ? 'bar_modern'
        : handleType === 'gola'
          ? 'gola_less'
          : handleType === 'finger_pull'
            ? 'finger_pull'
            : 'push';
    const partSlideType: SlideType = handleType === 'push' ? 'push_open' : 'telescopic';

    const fondo: Part = {
      id: `${groupId}_fondo_mdf`,
      name: `Fondo MDF (${groupName})`,
      groupId,
      groupName,
      length: isWidthZ ? slideLength : boxWidth,
      width: isWidthZ ? boxWidth : slideLength,
      thickness: bT,
      quantity: 1,
      materialId: mdfMat ? mdfMat.id : 'mat_mdf_3',
      materialName: mdfMat ? mdfMat.name : 'MDF Durolac Blanco',
      colorHex: mdfMat?.colorHex,
      grain: 'none',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: isWidthZ ? boxDepthCenter : spanCenter,
      posY: fondoCenterY,
      posZ: isWidthZ ? spanCenter : boxDepthCenter,
      orientation: 'horizontal',
      componentRole: 'drawer_box',
      notes: 'Fondo MDF 3mm colocado por debajo de la caja'
    };

    const latIzq: Part = {
      id: `${groupId}_lat_izq`,
      name: `Lateral Izq (${groupName})`,
      groupId,
      groupName,
      length: slideLength,
      width: effBoxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      colorHex: defaultMat?.colorHex,
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: isWidthZ ? boxDepthCenter : leftSpanPos,
      posY: boxCenterY,
      posZ: isWidthZ ? leftSpanPos : boxDepthCenter,
      orientation: isWidthZ ? 'vertical_xy' : 'vertical_yz',
      componentRole: 'drawer_box',
      notes: `Corredera ${slideLength}mm`
    };

    const latDer: Part = {
      id: `${groupId}_lat_der`,
      name: `Lateral Der (${groupName})`,
      groupId,
      groupName,
      length: slideLength,
      width: effBoxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      colorHex: defaultMat?.colorHex,
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: isWidthZ ? boxDepthCenter : rightSpanPos,
      posY: boxCenterY,
      posZ: isWidthZ ? rightSpanPos : boxDepthCenter,
      orientation: isWidthZ ? 'vertical_xy' : 'vertical_yz',
      componentRole: 'drawer_box',
      notes: `Corredera ${slideLength}mm`
    };

    const contraFrente: Part = {
      id: `${groupId}_contrafrente`,
      name: `Contra-frente (${groupName})`,
      groupId,
      groupName,
      length: testeraWidth,
      width: effBoxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      colorHex: defaultMat?.colorHex,
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: isWidthZ ? contraFrenteDepthPos : spanCenter,
      posY: boxCenterY,
      posZ: isWidthZ ? spanCenter : contraFrenteDepthPos,
      orientation: isWidthZ ? 'vertical_yz' : 'vertical_xy',
      componentRole: 'drawer_box',
      ...(frontMountType === 'none'
        ? {
            hardwareConfig: {
              isMovable: true,
              movableType: 'drawer' as const,
              handleType: 'none' as const,
              handlePosition: 'centered' as const,
              slideType: partSlideType,
              frontMountType: 'none' as const,
              drawerOpeningSystem: handleType,
              isOpen: false
            }
          }
        : {}),
      notes: 'Frente interior de caja'
    };

    const trasera: Part = {
      id: `${groupId}_trasera`,
      name: `Trasera (${groupName})`,
      groupId,
      groupName,
      length: testeraWidth,
      width: effBoxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      colorHex: defaultMat?.colorHex,
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: isWidthZ ? traseraDepthPos : spanCenter,
      posY: boxCenterY,
      posZ: isWidthZ ? spanCenter : traseraDepthPos,
      orientation: isWidthZ ? 'vertical_yz' : 'vertical_xy',
      componentRole: 'drawer_box',
      notes: 'Trasera de caja'
    };

    const parts: Part[] = [latIzq, latDer, contraFrente, trasera, fondo];

    if (frontMountType !== 'none') {
      const mountLabel =
        frontMountType === 'inset' ? 'Frente A Ras (Embutido)' : 'Frente Exterior Solapado';
      const openLabel =
        handleType === 'push'
          ? 'Push-to-Open'
          : handleType === 'finger_pull'
            ? 'Uñero Superior (-28mm)'
            : 'Con Tirador';

      const frente: Part = {
        id: `${groupId}_frente`,
        name: `Frente Vista (${groupName})`,
        groupId,
        groupName,
        length: isWidthZ ? effFrontH : frontWidth,
        width: isWidthZ ? frontWidth : effFrontH,
        thickness: ft,
        quantity: 1,
        materialId: frontMat ? frontMat.id : 'mat-1',
        materialName: frontMat ? frontMat.name : 'Melamina Estándar',
        colorHex: frontMat?.colorHex,
        grain: frontMat?.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: isWidthZ ? frontDepthPos : spanCenter,
        posY: frontCenterY,
        posZ: isWidthZ ? spanCenter : frontDepthPos,
        orientation: isWidthZ ? 'vertical_yz' : 'vertical_xy',
        componentRole: 'drawer_front',
        hardwareConfig: {
          isMovable: true,
          movableType: 'drawer',
          handleType: partHandleType,
          handlePosition: 'centered',
          slideType: partSlideType,
          frontMountType,
          drawerOpeningSystem: handleType,
          isOpen: false
        },
        notes: `${mountLabel} · ${openLabel}`
      };
      parts.push(frente);
    }

    const normalizedConfig: ParametricDrawerConfig = {
      name: groupName,
      outerWidth,
      cavityWidth: outerWidth,
      slideLength,
      boxHeight: effBoxH,
      frontHeight: nominalFrontH,
      frontWidth,
      includeFront: frontMountType !== 'none',
      frontMountType,
      handleType,
      materialId: defaultMat?.id || cfg.materialId || 'mat-1',
      frontMaterialId: frontMat?.id || cfg.frontMaterialId || cfg.materialId || 'mat-1',
      bottomMaterialId: mdfMat?.id || cfg.bottomMaterialId || 'mat_mdf_3',
      boxThickness: t,
      thickness: t,
      frontThickness: ft,
      sideThickness: st,
      bottomThickness: bT,
      slideGap: gap,
      posX: isWidthZ ? boxDepthCenter : spanCenter,
      posY: basePosY,
      posZ: isWidthZ ? spanCenter : boxDepthCenter,
      facingDirection,
      frontEdgeCoord,
      hostGroupId: effectiveHostGroupId ?? matchedCavity?.groupId,
      hostCavityId: effectiveHostCavityId ?? matchedCavity?.id,
      drawersCount: 1,
      ...(frontMountType === 'none' ? { recessBehindDoor: isRecessedBehindDoor } : {})
    };

    return { parts, normalizedConfig };
  }

  private buildDrawerHardwareItems(
    groupId: string,
    groupName: string,
    cfg: ParametricDrawerConfig
  ): HardwareItem[] {
    const items: HardwareItem[] = [];
    const boxLen = cfg.slideLength || 450;
    const isPush = cfg.handleType === 'push';
    const isHandle = (cfg.handleType ?? 'handle') === 'handle' && cfg.frontMountType !== 'none';

    items.push({
      id: `hw_slide_${groupId}`,
      name: isPush
        ? `Corredera Telescópica Push-to-Open (Apertura por presión) ${boxLen}mm (${groupName})`
        : `Par Correderas Telescópicas ${boxLen}mm (${groupName})`,
      category: 'slide',
      unit: 'par',
      quantity: 1,
      unitCost: isPush ? 26500 : 18500,
      notes: `Para ${groupName}`
    });

    if (isHandle) {
      items.push({
        id: `hw_handle_${groupId}`,
        name: `Tirador Metálico para Cajón (${groupName})`,
        category: 'handle',
        unit: 'und',
        quantity: 1,
        unitCost: 8500,
        notes: `Para ${groupName}`
      });
    }

    return items;
  }

  addParametricDrawer(cfg: Partial<ParametricDrawerConfig> & Pick<ParametricDrawerConfig, 'slideLength' | 'boxHeight' | 'bottomThickness' | 'includeFront'>): PartGroup {
    const drawerGroupsCount = (this.groupsList() || []).filter(
      g => g.type === 'drawer' || g.subType === 'drawer' || g.templateId === 'modular_drawer'
    ).length;
    const groupId = 'drawer_grp_' + crypto.randomUUID().slice(0, 8);
    const groupName = cfg.name || `Cajón ${drawerGroupsCount + 1}`;

    const hasHostModule = !!(cfg.hostGroupId || cfg.targetModuleId);
    const fullInputCfg: ParametricDrawerConfig = {
      name: groupName,
      outerWidth: cfg.outerWidth || cfg.cavityWidth || (hasHostModule ? 0 : 564),
      boxThickness: cfg.boxThickness || cfg.thickness || 15,
      slideGap: cfg.slideGap ?? 26,
      ...cfg
    };

    const { parts: newParts, normalizedConfig } = this.buildModularDrawerParts(
      groupId,
      groupName,
      fullInputCfg
    );

    const newGroup: PartGroup = {
      id: groupId,
      name: groupName,
      type: 'drawer',
      subType: 'drawer',
      templateId: 'modular_drawer',
      isOpen: false,
      slideExtension: 0,
      slideLength: normalizedConfig.slideLength,
      slideType: normalizedConfig.handleType === 'push' ? 'push_open' : 'telescopic',
      frontGap: normalizedConfig.slideGap ?? 26,
      facingDirection: normalizedConfig.facingDirection ?? 'front',
      drawerConfig: normalizedConfig,
      hostGroupId: normalizedConfig.hostGroupId,
      hostCavityId: normalizedConfig.hostCavityId
    };

    const hwItems = this.buildDrawerHardwareItems(groupId, groupName, normalizedConfig);

    this.updateProject(p => {
      const curGroups = p.groups || [];
      const curHw = p.hardware || [];
      return {
        ...p,
        groups: [...curGroups, newGroup],
        parts: [...p.parts, ...newParts],
        hardware: [...curHw, ...hwItems]
      };
    });

    return newGroup;
  }

  /**
   * Elimina o recorta limpiamente las puertas frontales que cubren una cavidad
   * al insertar cajones exteriores o embutidos, manteniendo >= 2 mm de luz y limpiando herrajes.
   */
  private resolveCoveringDoorsForCavity(cavity: ModuleCavityInfo): void {
    const doorIds = cavity.coveringDoorIds || [];
    if (doorIds.length === 0) return;

    const proj = this.currentProject();
    if (!proj) return;

    const cavityHeight = cavity.internalHeight || cavity.height || (cavity.maxY - cavity.minY);
    const cavityMidY = (cavity.minY + cavity.maxY) / 2;
    const doorIdsToDelete = new Set<string>();
    const doorPatches = new Map<string, Partial<Part>>();

    for (const doorId of doorIds) {
      const door = proj.parts.find(p => p.id === doorId);
      if (!door) continue;

      const doorAABB = this.partGeometry.getWorldAABB(door);
      const doorMinY = doorAABB.minY;
      const doorMaxY = doorAABB.maxY;
      const doorHeight = doorMaxY - doorMinY;
      const doorMidY = (doorMinY + doorMaxY) / 2;

      const coversWholeDoorVertically =
        cavityHeight >= doorHeight * 0.72 ||
        (Math.abs(doorMinY - cavity.minY) <= 45 && Math.abs(doorMaxY - cavity.maxY) <= 45);

      if (coversWholeDoorVertically) {
        doorIdsToDelete.add(door.id);
        continue;
      }

      // Recortar puerta de cuerpo completo dejando 2 mm libres respecto al borde del vano
      let newMinY = doorMinY;
      let newMaxY = doorMaxY;
      if (cavityMidY <= doorMidY) {
        newMinY = Math.round((cavity.maxY + 2) * 10) / 10;
      } else {
        newMaxY = Math.round((cavity.minY - 2) * 10) / 10;
      }

      const newHeight = Math.round((newMaxY - newMinY) * 10) / 10;
      if (newHeight < 80) {
        doorIdsToDelete.add(door.id);
        continue;
      }

      const newCenterY = Math.round(((newMinY + newMaxY) / 2) * 10) / 10;
      const dims = this.partGeometry.getLocalDimensions(door);
      const updatedHw = door.hardwareConfig
        ? {
            ...door.hardwareConfig,
            hingeCount: newHeight >= 1500 ? 4 : newHeight >= 900 ? 3 : 2
          }
        : undefined;

      doorPatches.set(door.id, {
        posY: newCenterY,
        ...(dims.lengthLocalAxis === 'y'
          ? { length: newHeight }
          : dims.widthLocalAxis === 'y'
            ? { width: newHeight }
            : { length: newHeight }),
        ...(updatedHw ? { hardwareConfig: updatedHw } : {})
      });
    }

    if (doorIdsToDelete.size === 0 && doorPatches.size === 0) return;

    this.updateProject(p => {
      const nextParts = p.parts
        .filter(pt => !doorIdsToDelete.has(pt.id))
        .map(pt => {
          const patch = doorPatches.get(pt.id);
          return patch ? { ...pt, ...patch } : pt;
        });

      const usedGroupIds = new Set(nextParts.map(pt => pt.groupId).filter(Boolean));
      const nextGroups = (p.groups || []).filter(g => usedGroupIds.has(g.id));
      const nextHardware = (p.hardware || []).filter(hw => {
        if (doorIdsToDelete.has(hw.id)) return false;
        for (const deletedId of doorIdsToDelete) {
          if (hw.notes?.includes(deletedId)) return false;
        }
        return true;
      });

      return {
        ...p,
        parts: nextParts,
        groups: nextGroups,
        hardware: nextHardware
      };
    });
  }

  /**
   * Inserta 1 a 6 cajones modulares perfectamente encajados en una cavidad/vano
   * de un mueble existente, resolviendo puertas frontales cubiertas y dividiendo la luz vertical.
   */
  addParametricDrawersToCavity(
    arg1: (Partial<ParametricDrawerConfig> & Pick<ParametricDrawerConfig, 'slideLength' | 'boxHeight' | 'bottomThickness' | 'includeFront'>) | ModuleCavityInfo,
    arg2?: ModuleCavityInfo | number,
    arg3?: number | (Partial<ParametricDrawerConfig> & Pick<ParametricDrawerConfig, 'slideLength' | 'boxHeight' | 'bottomThickness' | 'includeFront'>),
    options?: { clearCoveringDoors?: boolean; fillFullCavityHeight?: boolean }
  ): PartGroup[] {
    let cfg: Partial<ParametricDrawerConfig> & Pick<ParametricDrawerConfig, 'slideLength' | 'boxHeight' | 'bottomThickness' | 'includeFront'>;
    let cavity: ModuleCavityInfo | undefined;
    let rawCount = 1;

    if ('innerWidth' in arg1 || 'internalDepth' in arg1) {
      cavity = arg1 as ModuleCavityInfo;
      rawCount = typeof arg2 === 'number' ? arg2 : 1;
      cfg = (arg3 as Partial<ParametricDrawerConfig> & Pick<ParametricDrawerConfig, 'slideLength' | 'boxHeight' | 'bottomThickness' | 'includeFront'>) || {
        outerWidth: cavity.innerWidth,
        slideLength: cavity.optimalSlideLength || 450,
        boxHeight: 140,
        bottomThickness: 3,
        includeFront: true
      };
    } else {
      cfg = arg1;
      if (arg2 && typeof arg2 === 'object' && ('innerWidth' in arg2 || 'internalDepth' in arg2)) {
        cavity = arg2 as ModuleCavityInfo;
        rawCount = typeof arg3 === 'number' ? arg3 : (cfg.drawersCount || 1);
      } else {
        rawCount = typeof arg2 === 'number' ? arg2 : (cfg.drawersCount || 1);
      }
    }

    const count = Math.max(1, Math.min(6, Math.round(rawCount || 1)));
    const currentProj = this.currentProject();

    const effectiveHostGroupId = cfg.hostGroupId || cfg.targetModuleId;
    const effectiveHostCavityId = cfg.hostCavityId || cfg.targetCavityId;

    if (!cavity && effectiveHostGroupId && effectiveHostGroupId !== 'floor' && currentProj) {
      const hostGrp = (currentProj.groups || []).find(g => g.id === effectiveHostGroupId);
      const cavs = this.partGeometry.detectModuleCavities(
        effectiveHostGroupId,
        currentProj.parts || [],
        hostGrp,
        currentProj.appliances,
        effectiveHostCavityId ? { includeOccupied: true } : undefined
      );
      cavity =
        (effectiveHostCavityId ? cavs.find(c => c.id === effectiveHostCavityId) : undefined) || cavs[0];
    }

    if (!cavity) {
      return this.addParametricDrawerStackOnFloor(
        {
          ...cfg,
          name: cfg.name?.trim() || 'Cajón',
          posX: cfg.posX ?? 0,
          posZ: cfg.posZ ?? 0
        },
        count
      );
    }

    const frontMountType: DrawerFrontMountType =
      cfg.frontMountType ?? (cfg.includeFront === false ? 'none' : 'overlay');
    const handleType: DrawerOpeningSystem = cfg.handleType ?? 'handle';
    const ft = Math.max(12, cfg.frontThickness || cfg.boxThickness || cfg.thickness || 15);
    const bT = Math.max(3, cfg.bottomThickness || 3);

    const willClearDoors = frontMountType !== 'none' && options?.clearCoveringDoors !== false;
    if (willClearDoors && cavity.coveringDoorIds?.length) {
      this.resolveCoveringDoorsForCavity(cavity);
    }

    const isRecessedBehindDoor =
      frontMountType === 'none' &&
      (cfg.recessBehindDoor ?? ((cavity.coveringDoorIds?.length ?? 0) > 0 && !willClearDoors));

    const optimalSlide = this.partGeometry.getOptimalCommercialSlideLength(
      cavity.internalDepth,
      frontMountType,
      ft,
      isRecessedBehindDoor
    );
    const setback =
      frontMountType === 'inset'
        ? ft + 2
        : frontMountType === 'none'
          ? (isRecessedBehindDoor ? 22 : 5)
          : 0;
    const maxAllowedLength = Math.max(150, Math.floor(cavity.internalDepth - setback - 5));
    const safeSlideLength =
      cfg.slideLength && cfg.slideLength <= maxAllowedLength
        ? cfg.slideLength
        : optimalSlide;

    const totalFrontSpan = cavity.height;
    const projParts = currentProj?.parts || [];
    const cavityRefPart =
      projParts.find(p => p.id === cavity.leftPartId) ||
      projParts.find(p => p.id === cavity.rightPartId) ||
      projParts.find(p => p.id === cavity.topPartId) ||
      projParts.find(p => p.id === cavity.bottomPartId);
    const inheritedMaterialId = cfg.materialId || cavityRefPart?.materialId;
    const inheritedFrontMaterialId =
      cfg.frontMaterialId || cfg.materialId || cavityRefPart?.materialId;

    if (count === 1) {
      const maxCavityFrontH = Math.max(80, Math.round(totalFrontSpan - 4));
      const slotFrontH =
        !options?.fillFullCavityHeight && cfg.frontHeight && cfg.frontHeight > 0
          ? Math.max(60, Math.min(Math.round(cfg.frontHeight), maxCavityFrontH))
          : maxCavityFrontH;
      const effSlotFrontH =
        handleType === 'finger_pull' && frontMountType !== 'none'
          ? Math.max(60, slotFrontH - 28)
          : slotFrontH;
      const maxSafeBoxH = Math.max(40, Math.floor(cavity.height - 8 - bT));
      const slotBoxH = Math.max(
        40,
        Math.min(cfg.boxHeight || 140, effSlotFrontH - bT - 6, maxSafeBoxH)
      );
      return [
        this.addParametricDrawer({
          ...cfg,
          materialId: inheritedMaterialId,
          frontMaterialId: inheritedFrontMaterialId,
          outerWidth: cavity.innerWidth,
          slideLength: safeSlideLength,
          boxHeight: slotBoxH,
          frontHeight: slotFrontH,
          sideThickness: cavity.leftSideThickness,
          frontMountType,
          handleType,
          recessBehindDoor: frontMountType === 'none' ? isRecessedBehindDoor : cfg.recessBehindDoor,
          posX: cavity.centerX,
          posY: Math.round((cavity.minY + 2) * 10) / 10,
          posZ: cavity.centerZ,
          facingDirection: cavity.facingDirection,
          frontEdgeCoord: cavity.frontEdgeCoord,
          hostGroupId: cavity.groupId,
          hostCavityId: cavity.id,
          drawersCount: 1
        })
      ];
    }

    // Batería de 2 a 6 cajones: dividir automáticamente la luz vertical de la cavidad
    const interGap = 3;
    const usableHeight = Math.max(count * 40, totalFrontSpan - 4 - (count - 1) * interGap);
    const slotNominalFrontH = Math.max(40, Math.floor(usableHeight / count));
    const effFrontH =
      handleType === 'finger_pull' && frontMountType !== 'none'
        ? Math.max(30, slotNominalFrontH - 28)
        : slotNominalFrontH;
    const slotBoxH = Math.max(
      35,
      Math.min(cfg.boxHeight || 140, effFrontH - bT - 6, Math.floor(slotNominalFrontH - bT - 6))
    );

    const createdGroups: PartGroup[] = [];
    for (let i = 0; i < count; i++) {
      const slotPosY = Math.round((cavity.minY + 2 + i * (slotNominalFrontH + interGap)) * 10) / 10;
      const baseName = cfg.name?.trim() || 'Cajón';
      const itemGroup = this.addParametricDrawer({
        ...cfg,
        name: `${baseName} ${i + 1}`,
        materialId: inheritedMaterialId,
        frontMaterialId: inheritedFrontMaterialId,
        outerWidth: cavity.innerWidth,
        slideLength: safeSlideLength,
        boxHeight: slotBoxH,
        frontHeight: slotNominalFrontH,
        sideThickness: cavity.leftSideThickness,
        frontMountType,
        handleType,
        recessBehindDoor: frontMountType === 'none' ? isRecessedBehindDoor : cfg.recessBehindDoor,
        posX: cavity.centerX,
        posY: slotPosY,
        posZ: cavity.centerZ,
        facingDirection: cavity.facingDirection,
        frontEdgeCoord: cavity.frontEdgeCoord,
        hostGroupId: cavity.groupId,
        hostCavityId: cavity.id,
        drawersCount: 1
      });
      createdGroups.push(itemGroup);
    }

    return createdGroups;
  }

  /**
   * Obtiene o reconstruye la configuración paramétrica de un grupo de Cajón Modular,
   * sincronizando siempre su posición real 3D, rotación (facingDirection), plano frontal
   * y pertenencia actual a la cavidad.
   */
  getModularDrawerConfig(groupId: string): ParametricDrawerConfig | null {
    const proj = this.currentProject();
    if (!proj) return null;
    const group = (proj.groups || []).find(g => g.id === groupId);
    if (!group) return null;

    const gParts = proj.parts.filter(p => p.groupId === groupId);
    if (!isStandaloneModularDrawerGroup(group, gParts)) {
      return null;
    }

    const stored = group.drawerConfig;

    const isDrawerBoxCandidate = (p: Part): boolean =>
      p.componentRole === 'drawer_box' ||
      p.componentRole === 'drawer_lateral' ||
      p.componentRole === 'drawer_bottom' ||
      (!p.componentRole &&
        (p.id.toLowerCase().includes('caj_ind_') ||
          p.id.toLowerCase().endsWith('_lat_izq') ||
          p.id.toLowerCase().endsWith('_lat_der') ||
          p.id.toLowerCase().endsWith('_fondo_mdf') ||
          p.id.toLowerCase().endsWith('_contrafrente') ||
          p.id.toLowerCase().endsWith('_trasera')));

    const isDrawerFrontCandidate = (p: Part): boolean =>
      p.componentRole === 'drawer_front' ||
      (!p.componentRole && p.id.toLowerCase().endsWith('_frente'));

    const boxParts = gParts.filter(isDrawerBoxCandidate);
    const fondo = boxParts.find(
      p =>
        p.id.toLowerCase().endsWith('_fondo_mdf') ||
        p.componentRole === 'drawer_bottom' ||
        (p.orientation === 'horizontal' && p.thickness <= 6)
    );
    const lat = boxParts.find(
      p =>
        p.id.toLowerCase().endsWith('_lat_izq') ||
        p.id.toLowerCase().endsWith('_lat_der') ||
        p.componentRole === 'drawer_lateral' ||
        p.name.toLowerCase().includes('lateral izq') ||
        p.name.toLowerCase().includes('lateral der')
    );
    const frente = gParts.find(isDrawerFrontCandidate);
    const contra = boxParts.find(
      p =>
        p.id.toLowerCase().endsWith('_contrafrente') ||
        p.name.toLowerCase().includes('contra-frente')
    );
    const trasera = boxParts.find(
      p => p.id.toLowerCase().endsWith('_trasera') || p.name.toLowerCase().includes('trasera')
    );

    let facingDirection: 'front' | 'right' | 'back' | 'left';
    if (lat && contra && trasera) {
      if (lat.orientation === 'vertical_xy') {
        facingDirection = (contra.posX ?? 0) >= (trasera.posX ?? 0) ? 'right' : 'left';
      } else {
        facingDirection = (contra.posZ ?? 0) >= (trasera.posZ ?? 0) ? 'front' : 'back';
      }
    } else {
      facingDirection =
        group.facingDirection ??
        stored?.facingDirection ??
        this.computeGeometricFacingDirection(groupId, proj.parts);
    }

    const isWidthZ = facingDirection === 'right' || facingDirection === 'left';
    const dirSign = facingDirection === 'front' || facingDirection === 'right' ? 1 : -1;
    const gap = stored?.slideGap ?? group.frontGap ?? 26;
    const boxWidth = fondo
      ? isWidthZ
        ? fondo.width
        : fondo.length
      : stored
        ? stored.outerWidth - gap
        : 538;

    const fallbackOuterW =
      Number.isFinite(stored?.outerWidth) && stored!.outerWidth >= 150 && stored!.outerWidth <= 1200
        ? stored!.outerWidth
        : 564;
    const rawOuterW = Math.round((boxWidth + gap) * 10) / 10;
    const outerWidth =
      Number.isFinite(rawOuterW) && rawOuterW >= 150 && rawOuterW <= 1200
        ? rawOuterW
        : Math.max(150, Math.min(1200, Math.round(fallbackOuterW * 10) / 10));

    const fallbackSlide =
      Number.isFinite(stored?.slideLength) && stored!.slideLength >= 200 && stored!.slideLength <= 700
        ? stored!.slideLength
        : Number.isFinite(group.slideLength) &&
            group.slideLength! >= 200 &&
            group.slideLength! <= 700
          ? group.slideLength!
          : 450;
    const rawSlideLength = lat ? Number(lat.length) : fallbackSlide;
    const slideLength =
      Number.isFinite(rawSlideLength) && rawSlideLength >= 200 && rawSlideLength <= 700
        ? Math.round(rawSlideLength * 10) / 10
        : Math.max(200, Math.min(700, Math.round(fallbackSlide * 10) / 10));

    const fallbackBoxH =
      Number.isFinite(stored?.boxHeight) && stored!.boxHeight >= 50 && stored!.boxHeight <= 450
        ? stored!.boxHeight
        : 140;
    const rawBoxHeight = lat ? Number(lat.width) : fallbackBoxH;
    const boxHeight =
      Number.isFinite(rawBoxHeight) && rawBoxHeight >= 50 && rawBoxHeight <= 450
        ? Math.round(rawBoxHeight * 10) / 10
        : Math.max(50, Math.min(450, Math.round(fallbackBoxH * 10) / 10));

    const frontMountType: DrawerFrontMountType =
      frente?.hardwareConfig?.frontMountType ??
      stored?.frontMountType ??
      (frente ? 'overlay' : 'none');
    const handleType: DrawerOpeningSystem =
      frente?.hardwareConfig?.drawerOpeningSystem ??
      contra?.hardwareConfig?.drawerOpeningSystem ??
      stored?.handleType ??
      (frente?.hardwareConfig?.handleType === 'push_open' ||
      frente?.hardwareConfig?.handleType === 'push'
        ? 'push'
        : frente?.hardwareConfig?.handleType === 'gola_less' ||
            frente?.hardwareConfig?.handleType === 'finger_pull'
          ? 'finger_pull'
          : 'handle');

    const rawFrontH = frente
      ? isWidthZ
        ? frente.length
        : frente.width
      : stored?.frontHeight || boxHeight + 33;
    const nominalFrontH =
      handleType === 'finger_pull' && frente ? rawFrontH + 28 : rawFrontH;

    let minY = Infinity;
    for (const pt of gParts) {
      const b = this.partGeometry.getWorldAABB(pt);
      if (b.minY < minY) minY = b.minY;
    }
    const liveMinY = Number.isFinite(minY) ? Math.round(minY * 10) / 10 : stored?.posY ?? 100;
    const livePosX = fondo?.posX ?? stored?.posX ?? 0;
    const livePosZ = fondo?.posZ ?? stored?.posZ ?? 0;

    const t = lat?.thickness || stored?.boxThickness || 15;
    const ft = frente?.thickness || stored?.frontThickness || t;
    const bT = fondo?.thickness || stored?.bottomThickness || 3;

    const boxDepthCenter = isWidthZ ? livePosX : livePosZ;
    const isRecessedBehindDoor = frontMountType === 'none' && Boolean(stored?.recessBehindDoor);
    const setback =
      frontMountType === 'inset'
        ? ft + 2
        : frontMountType === 'none'
          ? (isRecessedBehindDoor ? 22 : 5)
          : 0;
    const liveFrontEdgeCoord =
      Math.round((boxDepthCenter + dirSign * (slideLength / 2 + setback)) * 10) / 10;

    let hostGroupId = group.hostGroupId ?? stored?.hostGroupId;
    let hostCavityId = group.hostCavityId ?? stored?.hostCavityId;
    let sideThickness = stored?.sideThickness ?? 18;

    if (hostGroupId && hostGroupId !== 'floor') {
      const hostGrp = (proj.groups || []).find(g => g.id === hostGroupId);
      const cavs = this.partGeometry.detectModuleCavities(
        hostGroupId,
        proj.parts || [],
        hostGrp,
        proj.appliances,
        { includeOccupied: true }
      );
      const cav = (hostCavityId ? cavs.find(c => c.id === hostCavityId) : undefined) || cavs[0];
      if (cav) {
        const spanCenter = isWidthZ ? livePosZ : livePosX;
        const cavSpanCenter = isWidthZ ? cav.centerZ : cav.centerX;
        const cavDepthCenter = isWidthZ ? cav.centerX : cav.centerZ;
        const stillInCavity =
          Math.abs(spanCenter - cavSpanCenter) <= cav.innerWidth / 2 + 60 &&
          Math.abs(boxDepthCenter - cavDepthCenter) <= cav.internalDepth / 2 + 100 &&
          liveMinY >= cav.minY - 40 &&
          liveMinY <= cav.maxY + 40;
        if (stillInCavity) {
          hostCavityId = cav.id;
          sideThickness = cav.leftSideThickness;
        } else {
          hostGroupId = undefined;
          hostCavityId = undefined;
        }
      } else {
        hostGroupId = undefined;
        hostCavityId = undefined;
      }
    }

    return {
      ...stored,
      name: group.name,
      outerWidth,
      cavityWidth: outerWidth,
      slideLength,
      boxHeight,
      frontHeight: nominalFrontH,
      frontWidth: frente
        ? isWidthZ
          ? frente.width
          : frente.length
        : stored?.frontWidth || outerWidth,
      includeFront: !!frente,
      frontMountType,
      handleType,
      materialId: lat?.materialId || stored?.materialId || 'mat-1',
      frontMaterialId:
        frente?.materialId || stored?.frontMaterialId || lat?.materialId || 'mat-1',
      bottomMaterialId: fondo?.materialId || stored?.bottomMaterialId || 'mat_mdf_3',
      boxThickness: t,
      thickness: t,
      frontThickness: ft,
      sideThickness,
      bottomThickness: bT,
      slideGap: gap,
      posX: livePosX,
      posY: liveMinY,
      posZ: livePosZ,
      facingDirection,
      frontEdgeCoord: liveFrontEdgeCoord,
      hostGroupId,
      hostCavityId
    };
  }

  /**
   * Actualiza en vivo los parámetros de un Cajón Modular desde el Inspector Contextual,
   * recalculando sus piezas 3D y herrajes sin perder su identidad ni selección.
   */
  updateModularDrawerGroup(
    groupId: string,
    changes: Partial<ParametricDrawerConfig>
  ): PartGroup | null {
    const proj = this.currentProject();
    if (!proj) return null;
    const existingGroup = (proj.groups || []).find(g => g.id === groupId);
    if (!existingGroup) return null;
    const gParts = proj.parts.filter(p => p.groupId === groupId);
    if (!isStandaloneModularDrawerGroup(existingGroup, gParts)) {
      return null;
    }

    const baseCfg = this.getModularDrawerConfig(groupId);
    if (!baseCfg) return null;

    const frontOnlyKeys: ReadonlySet<string> = new Set([
      'frontMountType',
      'includeFront',
      'handleType',
      'frontHeight',
      'frontWidth',
      'frontThickness',
      'frontMaterialId',
      'name',
      'sideThickness'
    ]);
    const changedKeys = (Object.keys(changes) as (keyof ParametricDrawerConfig)[]).filter(
      k => changes[k] !== undefined
    );
    const isFrontOnlyChange =
      changedKeys.length > 0 && changedKeys.every(k => frontOnlyKeys.has(k as string));

    const existingFrontPart = gParts.find(
      p =>
        p.componentRole === 'drawer_front' ||
        (!p.componentRole && p.id.toLowerCase().endsWith('_frente'))
    );
    const existingBoxParts = gParts.filter(p => p !== existingFrontPart);
    const isCurrentlyOpen = !!existingGroup.isOpen;
    const groupName = changes.name || baseCfg.name || existingGroup.name;

    // Ruta no destructiva: al conmutar tipo de montaje ('overlay' | 'inset' | 'none'), apertura o estética
    // del frente sin alterar dimensiones de caja, conservar intactas todas las piezas de caja (5 piezas).
    if (isFrontOnlyChange && existingBoxParts.length >= 3) {
      const nextFrontMountType: DrawerFrontMountType =
        changes.frontMountType ??
        (changes.includeFront === false
          ? 'none'
          : changes.includeFront === true && baseCfg.frontMountType === 'none'
            ? 'overlay'
            : baseCfg.frontMountType ?? (existingFrontPart ? 'overlay' : 'none'));
      const nextHandleType: DrawerOpeningSystem =
        changes.handleType ?? baseCfg.handleType ?? 'handle';

      const facingDirection =
        baseCfg.facingDirection ?? existingGroup.facingDirection ?? 'front';
      const isWidthZ = facingDirection === 'right' || facingDirection === 'left';
      const dirSign = facingDirection === 'front' || facingDirection === 'right' ? 1 : -1;

      let boxMinX = Infinity;
      let boxMaxX = -Infinity;
      let boxMinY = Infinity;
      let boxMinZ = Infinity;
      let boxMaxZ = -Infinity;
      for (const bp of existingBoxParts) {
        const b = this.partGeometry.getWorldAABB(bp);
        if (b.minX < boxMinX) boxMinX = b.minX;
        if (b.maxX > boxMaxX) boxMaxX = b.maxX;
        if (b.minY < boxMinY) boxMinY = b.minY;
        if (b.minZ < boxMinZ) boxMinZ = b.minZ;
        if (b.maxZ > boxMaxZ) boxMaxZ = b.maxZ;
      }

      const boxSpanCenter =
        Math.round(((isWidthZ ? boxMinZ + boxMaxZ : boxMinX + boxMaxX) / 2) * 10) / 10;
      const boxFrontFace = isWidthZ
        ? dirSign > 0
          ? boxMaxX
          : boxMinX
        : dirSign > 0
          ? boxMaxZ
          : boxMinZ;
      const boxBottomY = Math.round(boxMinY * 10) / 10;

      const st = Math.max(12, changes.sideThickness ?? baseCfg.sideThickness ?? 18);
      const ft = Math.max(
        12,
        changes.frontThickness ??
          existingFrontPart?.thickness ??
          baseCfg.frontThickness ??
          baseCfg.boxThickness ??
          15
      );
      const bT = Math.max(3, baseCfg.bottomThickness || 3);
      const nominalFrontH = Math.max(
        80,
        Math.round(
          changes.frontHeight ?? baseCfg.frontHeight ?? (baseCfg.boxHeight || 140) + bT + 30
        )
      );
      const effFrontH =
        nextHandleType === 'finger_pull' && nextFrontMountType !== 'none'
          ? Math.max(60, nominalFrontH - 28)
          : nominalFrontH;

      const outerWidth = baseCfg.outerWidth;
      const computedFrontWidth =
        nextFrontMountType === 'inset'
          ? Math.max(100, Math.round((outerWidth - 4) * 10) / 10)
          : changes.frontWidth !== undefined && changes.frontMountType === undefined
            ? Math.max(100, Math.round(changes.frontWidth * 10) / 10)
            : Math.max(100, Math.round((outerWidth + 2 * st - 4) * 10) / 10);

      const storedPosY = existingGroup.drawerConfig?.posY;
      const existingFrontBottomY = existingFrontPart
        ? Math.round(this.partGeometry.getWorldAABB(existingFrontPart).minY * 10) / 10
        : storedPosY !== undefined && Math.abs(storedPosY - boxBottomY) <= 10
          ? Math.round(storedPosY * 10) / 10
          : boxBottomY;

      const partHandleType: HandleType =
        nextHandleType === 'handle'
          ? 'bar_modern'
          : nextHandleType === 'gola'
            ? 'gola_less'
            : nextHandleType === 'finger_pull'
              ? 'finger_pull'
              : 'push';
      const partSlideType: SlideType = nextHandleType === 'push' ? 'push_open' : 'telescopic';

      const contraPart = existingBoxParts.find(
        p =>
          p.id.toLowerCase().endsWith('_contrafrente') ||
          p.name.toLowerCase().includes('contra-frente')
      );

      const nextBoxParts: Part[] = existingBoxParts.map(bp => {
        const isContra = bp === contraPart;
        const updatedName =
          changes.name && existingGroup.name && bp.name.includes(existingGroup.name)
            ? bp.name.replace(existingGroup.name, groupName)
            : bp.name;
        if (!isContra) {
          return bp.groupName === groupName && updatedName === bp.name
            ? bp
            : { ...bp, name: updatedName, groupName };
        }
        if (nextFrontMountType === 'none') {
          return {
            ...bp,
            name: updatedName,
            groupName,
            hardwareConfig: {
              ...(bp.hardwareConfig || {}),
              isMovable: true,
              movableType: 'drawer' as const,
              handleType: 'none' as const,
              handlePosition: 'centered' as const,
              slideType: partSlideType,
              frontMountType: 'none' as const,
              drawerOpeningSystem: nextHandleType,
              isOpen: isCurrentlyOpen
            }
          };
        }
        const cleanedContra: Part = { ...bp, name: updatedName, groupName };
        if (cleanedContra.hardwareConfig) {
          delete cleanedContra.hardwareConfig;
        }
        return cleanedContra;
      });

      const materials = this.materialsList();
      const targetFrontMatId =
        changes.frontMaterialId ??
        existingFrontPart?.materialId ??
        baseCfg.frontMaterialId ??
        baseCfg.materialId;
      const frontMat =
        (targetFrontMatId ? materials.find(m => m.id === targetFrontMatId) : undefined) ||
        materials.find(m => m.thickness >= 15) ||
        materials[0];
      const latRef = existingBoxParts.find(
        p =>
          p.id.toLowerCase().endsWith('_lat_izq') ||
          p.id.toLowerCase().endsWith('_lat_der') ||
          p.name.toLowerCase().includes('lateral')
      );

      const finalParts: Part[] = [...nextBoxParts];
      if (nextFrontMountType !== 'none') {
        const frontDepthPos = Math.round((boxFrontFace + dirSign * (2.0 + ft / 2)) * 10) / 10;
        const frontCenterY = Math.round((existingFrontBottomY + effFrontH / 2) * 10) / 10;
        const mountLabel =
          nextFrontMountType === 'inset'
            ? 'Frente A Ras (Embutido)'
            : 'Frente Exterior Solapado';
        const openLabel =
          nextHandleType === 'push'
            ? 'Push-to-Open'
            : nextHandleType === 'finger_pull'
              ? 'Uñero Superior (-28mm)'
              : 'Con Tirador';

        const nextFrontPart: Part = {
          id: existingFrontPart?.id || `${groupId}_frente`,
          name: `Frente Vista (${groupName})`,
          groupId,
          groupName,
          length: isWidthZ ? effFrontH : computedFrontWidth,
          width: isWidthZ ? computedFrontWidth : effFrontH,
          thickness: ft,
          quantity: 1,
          materialId:
            frontMat?.id || existingFrontPart?.materialId || latRef?.materialId || 'mat-1',
          materialName:
            frontMat?.name ||
            existingFrontPart?.materialName ||
            latRef?.materialName ||
            'Melamina Estándar',
          colorHex: frontMat?.colorHex ?? existingFrontPart?.colorHex ?? latRef?.colorHex,
          grain: frontMat
            ? frontMat.hasGrain
              ? 'length'
              : 'none'
            : (existingFrontPart?.grain ?? latRef?.grain ?? 'none'),
          edges: existingFrontPart?.edges ?? {
            l1: 'thick',
            l2: 'thick',
            a1: 'thick',
            a2: 'thick'
          },
          posX: isWidthZ ? frontDepthPos : boxSpanCenter,
          posY: frontCenterY,
          posZ: isWidthZ ? boxSpanCenter : frontDepthPos,
          orientation: isWidthZ ? 'vertical_yz' : 'vertical_xy',
          componentRole: 'drawer_front',
          hardwareConfig: {
            ...(existingFrontPart?.hardwareConfig || {}),
            isMovable: true,
            movableType: 'drawer',
            handleType: partHandleType,
            handlePosition: 'centered',
            slideType: partSlideType,
            frontMountType: nextFrontMountType,
            drawerOpeningSystem: nextHandleType,
            isOpen: isCurrentlyOpen
          },
          notes: `${mountLabel} · ${openLabel}`
        };
        finalParts.push(nextFrontPart);
      }

      const normalizedConfig: ParametricDrawerConfig = {
        ...baseCfg,
        name: groupName,
        frontHeight: nominalFrontH,
        frontWidth: nextFrontMountType === 'none' ? baseCfg.frontWidth : computedFrontWidth,
        frontThickness: ft,
        sideThickness: st,
        includeFront: nextFrontMountType !== 'none',
        frontMountType: nextFrontMountType,
        handleType: nextHandleType,
        frontMaterialId:
          nextFrontMountType !== 'none'
            ? (frontMat?.id || baseCfg.frontMaterialId || baseCfg.materialId)
            : baseCfg.frontMaterialId,
        posY: existingFrontBottomY,
        facingDirection
      };

      const updatedGroup: PartGroup = {
        ...existingGroup,
        name: groupName,
        type: 'drawer',
        subType: 'drawer',
        templateId: 'modular_drawer',
        slideLength: normalizedConfig.slideLength,
        slideType: normalizedConfig.handleType === 'push' ? 'push_open' : 'telescopic',
        frontGap: normalizedConfig.slideGap ?? 26,
        facingDirection,
        drawerConfig: normalizedConfig,
        hostGroupId: normalizedConfig.hostGroupId,
        hostCavityId: normalizedConfig.hostCavityId
      };

      const newHwItems = this.buildDrawerHardwareItems(groupId, groupName, normalizedConfig);

      this.updateProject(p => {
        const otherParts = p.parts.filter(pt => pt.groupId !== groupId);
        const otherHw = (p.hardware || []).filter(
          h =>
            h.id !== `hw_slide_${groupId}` &&
            h.id !== `hw_handle_${groupId}` &&
            !h.notes?.includes(existingGroup.name)
        );
        return {
          ...p,
          groups: (p.groups || []).map(g => (g.id === groupId ? updatedGroup : g)),
          parts: [...otherParts, ...finalParts],
          hardware: [...otherHw, ...newHwItems]
        };
      });

      return updatedGroup;
    }

    const mergedCfg: ParametricDrawerConfig = {
      ...baseCfg,
      ...changes
    };

    if (changes.outerWidth !== undefined) {
      mergedCfg.cavityWidth = changes.outerWidth;
    }

    // Si cambió el ancho de hueco manualmente o el tipo de montaje, limpiar frontWidth fijo para que se recalcule según overlay/inset
    if (changes.outerWidth !== undefined || changes.frontMountType !== undefined) {
      delete mergedCfg.frontWidth;
    }

    const { parts: rebuiltParts, normalizedConfig } = this.buildModularDrawerParts(
      groupId,
      groupName,
      mergedCfg
    );

    // Preservar estado abierto/cerrado actual
    const finalParts = rebuiltParts.map(pt => {
      if (pt.hardwareConfig?.isMovable) {
        return {
          ...pt,
          hardwareConfig: {
            ...pt.hardwareConfig,
            isOpen: isCurrentlyOpen
          }
        };
      }
      return pt;
    });

    const updatedGroup: PartGroup = {
      ...existingGroup,
      name: groupName,
      type: 'drawer',
      subType: 'drawer',
      templateId: 'modular_drawer',
      slideLength: normalizedConfig.slideLength,
      slideType: normalizedConfig.handleType === 'push' ? 'push_open' : 'telescopic',
      frontGap: normalizedConfig.slideGap ?? 26,
      facingDirection: normalizedConfig.facingDirection ?? existingGroup.facingDirection ?? 'front',
      drawerConfig: normalizedConfig,
      hostGroupId: normalizedConfig.hostGroupId,
      hostCavityId: normalizedConfig.hostCavityId
    };

    const newHwItems = this.buildDrawerHardwareItems(groupId, groupName, normalizedConfig);

    this.updateProject(p => {
      const otherParts = p.parts.filter(pt => pt.groupId !== groupId);
      const otherHw = (p.hardware || []).filter(
        h =>
          h.id !== `hw_slide_${groupId}` &&
          h.id !== `hw_handle_${groupId}` &&
          !h.notes?.includes(existingGroup.name)
      );
      return {
        ...p,
        groups: (p.groups || []).map(g => (g.id === groupId ? updatedGroup : g)),
        parts: [...otherParts, ...finalParts],
        hardware: [...otherHw, ...newHwItems]
      };
    });

    return updatedGroup;
  }

  /**
   * Auto-encaja en 1 clic (o al arrastrar en 3D) un Cajón Modular dentro de la cavidad
   * de su mueble anfitrión o del mueble más cercano en la escena.
   */
  autoFitModularDrawerToCavity(
    groupId: string,
    targetCavity?: ModuleCavityInfo,
    targetBaseY?: number
  ): ModuleCavityInfo | null {
    const proj = this.currentProject();
    if (!proj) return null;
    const baseCfg = this.getModularDrawerConfig(groupId);
    if (!baseCfg) return null;

    let cavity = targetCavity;
    if (!cavity) {
      if (baseCfg.hostGroupId && baseCfg.hostGroupId !== 'floor') {
        const hostGrp = (proj.groups || []).find(g => g.id === baseCfg.hostGroupId);
        const hostCavs = this.partGeometry.detectModuleCavities(
          baseCfg.hostGroupId,
          proj.parts || [],
          hostGrp,
          proj.appliances,
          { includeOccupied: true }
        );
        cavity =
          (baseCfg.hostCavityId ? hostCavs.find(c => c.id === baseCfg.hostCavityId) : undefined) ||
          hostCavs[0];
      }

      if (!cavity) {
        const allCavities = this.partGeometry.detectAllSceneCavities(
          proj.parts || [],
          proj.groups || [],
          proj.appliances
        );
        if (allCavities.length === 0) return null;

        const gParts = proj.parts.filter(p => p.groupId === groupId);
        let cx = baseCfg.posX ?? 0;
        let cy = baseCfg.posY ?? 100;
        let cz = baseCfg.posZ ?? 0;
        if (gParts.length > 0) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
          for (const pt of gParts) {
            const b = this.partGeometry.getWorldAABB(pt);
            if (b.minX < minX) minX = b.minX;
            if (b.maxX > maxX) maxX = b.maxX;
            if (b.minY < minY) minY = b.minY;
            if (b.maxY > maxY) maxY = b.maxY;
            if (b.minZ < minZ) minZ = b.minZ;
            if (b.maxZ > maxZ) maxZ = b.maxZ;
          }
          cx = (minX + maxX) / 2;
          cy = minY;
          cz = (minZ + maxZ) / 2;
        }

        let bestDist = Infinity;
        for (const cand of allCavities) {
          const d = Math.hypot(cx - cand.centerX, cz - cand.centerZ) + Math.abs(cy - (cand.minY + cand.maxY) / 2) * 0.4;
          if (d < bestDist) {
            bestDist = d;
            cavity = cand;
          }
        }
      }
    }

    if (!cavity) return null;

    const frontMountType = baseCfg.frontMountType ?? 'overlay';
    const ft = baseCfg.frontThickness || baseCfg.boxThickness || 15;
    const optimalSlide = this.partGeometry.getOptimalCommercialSlideLength(
      cavity.internalDepth,
      frontMountType,
      ft
    );

    const desiredY = targetBaseY ?? baseCfg.posY ?? cavity.minY + 2;
    const clampedY = Math.max(
      cavity.minY + 2,
      Math.min(cavity.maxY - Math.max(80, baseCfg.frontHeight || 140) - 2, desiredY)
    );

    this.updateModularDrawerGroup(groupId, {
      outerWidth: cavity.innerWidth,
      slideLength: optimalSlide,
      sideThickness: cavity.leftSideThickness,
      posX: cavity.centerX,
      posY: Math.round(clampedY * 10) / 10,
      posZ: cavity.centerZ,
      facingDirection: cavity.facingDirection,
      frontEdgeCoord: cavity.frontEdgeCoord,
      hostGroupId: cavity.groupId,
      hostCavityId: cavity.id
    });

    return {
      ...cavity,
      optimalSlideLength: optimalSlide
    };
  }

  /**
   * Duplica un Cajón Modular en 1 clic inmediatamente encima (+Y) o debajo (-Y)
   * dentro del mismo hueco, respetando la holgura entre frentes (3 mm en solapado/embutido,
   * o 28 mm si es uñero) con 0 colisiones.
   */
  duplicateModularDrawerVertically(
    groupId: string,
    direction: 'up' | 'down' | 1 | -1
  ): PartGroup | null {
    const proj = this.currentProject();
    if (!proj) return null;
    const baseCfg = this.getModularDrawerConfig(groupId);
    if (!baseCfg) return null;

    const gParts = proj.parts.filter(p => p.groupId === groupId);
    if (gParts.length === 0) return null;

    let minY = Infinity;
    let maxY = -Infinity;
    for (const pt of gParts) {
      const b = this.partGeometry.getWorldAABB(pt);
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    const visualHeight = Math.max(60, maxY - minY);
    const interFrontGap = baseCfg.handleType === 'finger_pull' ? 28 : 3;
    const stepY = visualHeight + interFrontGap;
    const dirSign = direction === 'up' || direction === 1 ? 1 : -1;

    let matchedCavity: ModuleCavityInfo | undefined;
    if (baseCfg.hostGroupId && baseCfg.hostGroupId !== 'floor') {
      const hostGrp = (proj.groups || []).find(g => g.id === baseCfg.hostGroupId);
      const cavs = this.partGeometry.detectModuleCavities(
        baseCfg.hostGroupId,
        proj.parts || [],
        hostGrp,
        proj.appliances,
        { includeOccupied: true }
      );
      matchedCavity =
        (baseCfg.hostCavityId ? cavs.find(c => c.id === baseCfg.hostCavityId) : undefined) ||
        cavs[0];
    }

    const minAllowedY = matchedCavity ? matchedCavity.minY + 1.5 : 0;
    const maxAllowedY = matchedCavity ? matchedCavity.maxY - visualHeight - 1.5 : 3000;

    let candidateMinY = Math.round((minY + dirSign * stepY) * 10) / 10;

    // Si ya existe otro cajón en esa altura dentro de la misma columna, avanzar al siguiente espacio libre
    const allDrawerGroups = (proj.groups || []).filter(g =>
      isStandaloneModularDrawerGroup(
        g,
        proj.parts.filter(p => p.groupId === g.id)
      )
    );

    let foundValidSlot = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (dirSign < 0 && candidateMinY < minAllowedY - 0.5) {
        return null;
      }
      if (dirSign > 0 && matchedCavity && candidateMinY > maxAllowedY + 0.5) {
        return null;
      }

      const candMaxY = candidateMinY + visualHeight;
      const hasVerticalOverlap = allDrawerGroups.some(og => {
        const ogParts = proj.parts.filter(p => p.groupId === og.id);
        if (ogParts.length === 0) return false;
        let oMinX = Infinity, oMaxX = -Infinity, oMinY = Infinity, oMaxY = -Infinity, oMinZ = Infinity, oMaxZ = -Infinity;
        for (const pt of ogParts) {
          const b = this.partGeometry.getWorldAABB(pt);
          if (b.minX < oMinX) oMinX = b.minX;
          if (b.maxX > oMaxX) oMaxX = b.maxX;
          if (b.minY < oMinY) oMinY = b.minY;
          if (b.maxY > oMaxY) oMaxY = b.maxY;
          if (b.minZ < oMinZ) oMinZ = b.minZ;
          if (b.maxZ > oMaxZ) oMaxZ = b.maxZ;
        }
        const sameColumn =
          Math.abs((oMinX + oMaxX) / 2 - (baseCfg.posX ?? 0)) < 120 &&
          Math.abs((oMinZ + oMaxZ) / 2 - (baseCfg.posZ ?? 0)) < 120;
        if (!sameColumn) return false;
        const overlapY = Math.min(candMaxY, oMaxY) - Math.max(candidateMinY, oMinY);
        return overlapY > 0.5;
      });

      if (!hasVerticalOverlap) {
        foundValidSlot = true;
        break;
      }
      candidateMinY = Math.round((candidateMinY + dirSign * stepY) * 10) / 10;
    }

    if (!foundValidSlot || candidateMinY < minAllowedY - 0.5) {
      return null;
    }

    const existingCount = allDrawerGroups.length;
    const cleanBase = (baseCfg.name || 'Cajón').replace(/\s+\d+$/, '').trim();

    return this.addParametricDrawer({
      ...baseCfg,
      name: `${cleanBase} ${existingCount + 1}`,
      posY: candidateMinY
    });
  }

  private findFreeFloorPosition(
    outerWidth: number,
    depth: number,
    baseY: number,
    totalHeight: number,
    requestedX?: number,
    requestedZ?: number
  ): { posX: number; posZ: number } {
    if (requestedX !== undefined || requestedZ !== undefined) {
      return {
        posX: requestedX ?? 0,
        posZ: requestedZ ?? 0
      };
    }

    const parts = this.currentProject()?.parts || [];
    const posZ = 0;
    let candX = 0;
    const minY = baseY;
    const maxY = baseY + totalHeight;
    const minZ = posZ - depth / 2 - 15;
    const maxZ = posZ + depth / 2 + 15;

    for (let attempt = 0; attempt < 16; attempt++) {
      const minX = candX - outerWidth / 2 - 15;
      const maxX = candX + outerWidth / 2 + 15;
      let maxBlockingX = -Infinity;
      let hasOverlap = false;

      for (const pt of parts) {
        const b = this.partGeometry.getWorldAABB(pt);
        const overlapsY = Math.min(maxY, b.maxY) - Math.max(minY, b.minY) > 1;
        const overlapsZ = Math.min(maxZ, b.maxZ) - Math.max(minZ, b.minZ) > 1;
        const overlapsX = Math.min(maxX, b.maxX) - Math.max(minX, b.minX) > 1;
        if (overlapsX && overlapsY && overlapsZ) {
          hasOverlap = true;
          if (b.maxX > maxBlockingX) {
            maxBlockingX = b.maxX;
          }
        }
      }

      if (!hasOverlap) {
        return { posX: Math.round(candX * 10) / 10, posZ };
      }
      candX = maxBlockingX + outerWidth / 2 + 80;
    }

    return { posX: Math.round(candX * 10) / 10, posZ };
  }

  /**
   * Apila 1 a 6 cajones modulares en una posición libre sobre el piso,
   * respetando la luz vertical entre frentes para garantizar 0 colisiones.
   */
  addParametricDrawerStackOnFloor(
    baseConfig: Partial<ModularDrawerConfig> & { name: string },
    count: number
  ): PartGroup[] {
    const safeCount = Math.max(1, Math.min(6, Math.round(count || 1)));
    const frontMountType: DrawerFrontMountType =
      baseConfig.frontMountType ?? (baseConfig.includeFront === false ? 'none' : 'overlay');
    const handleType: DrawerOpeningSystem = baseConfig.handleType ?? 'handle';
    const outerWidth = Math.max(140, Math.round(baseConfig.outerWidth || baseConfig.cavityWidth || 564));
    const slideLength = baseConfig.slideLength || 450;
    const bT = Math.max(3, baseConfig.bottomThickness || 3);
    const ft = Math.max(12, baseConfig.frontThickness || baseConfig.boxThickness || baseConfig.thickness || 15);
    const st = Math.max(12, baseConfig.sideThickness || 18);
    const nominalFrontH = Math.max(
      80,
      Math.round(baseConfig.frontHeight || (baseConfig.boxHeight || 140) + bT + 30)
    );
    const effFrontH =
      handleType === 'finger_pull' && frontMountType !== 'none'
        ? Math.max(60, nominalFrontH - 28)
        : nominalFrontH;
    const desiredBoxH = Math.max(50, Math.round(baseConfig.boxHeight || 140));
    const safeBoxH =
      frontMountType !== 'none'
        ? Math.max(40, Math.min(desiredBoxH, effFrontH - bT - 6))
        : desiredBoxH;
    const stepY =
      frontMountType === 'none'
        ? safeBoxH + bT + 15
        : handleType === 'finger_pull'
          ? effFrontH + 28
          : nominalFrontH + 3;

    const baseY = baseConfig.posY ?? 100;
    const footprintW = frontMountType === 'overlay' ? outerWidth + 2 * st : outerWidth;
    const { posX, posZ } = this.findFreeFloorPosition(
      footprintW,
      slideLength + ft + 10,
      baseY,
      safeCount * stepY,
      baseConfig.posX,
      baseConfig.posZ
    );

    const baseName = baseConfig.name?.trim() || 'Cajón';
    const created: PartGroup[] = [];
    for (let i = 0; i < safeCount; i++) {
      const slotName = safeCount === 1 ? baseName : `${baseName} (${i + 1}/${safeCount})`;
      const group = this.addParametricDrawer({
        ...baseConfig,
        name: slotName,
        outerWidth,
        slideLength,
        boxHeight: safeBoxH,
        frontHeight: nominalFrontH,
        bottomThickness: bT,
        frontThickness: ft,
        sideThickness: st,
        includeFront: frontMountType !== 'none',
        frontMountType,
        handleType,
        posX,
        posY: Math.round((baseY + i * stepY) * 10) / 10,
        posZ,
        hostGroupId: 'floor',
        hostCavityId: undefined,
        drawersCount: 1
      });
      created.push(group);
    }
    return created;
  }

  /**
   * Convierte una pieza seleccionada en una cajonera modular:
   * - Si está dentro o a <= 180 mm de un vano libre, la reemplaza encajando en ese vano con 0 colisiones.
   * - Si está en el piso, la reemplaza por una cajonera sobre el piso heredando ancho, posición y material.
   */
  convertPartToModularDrawer(
    partId: string,
    drawerCount = 1,
    frontMountType: 'overlay' | 'inset' | 'none' = 'overlay'
  ): PartGroup[] {
    const proj = this.currentProject();
    const part = proj?.parts.find(p => p.id === partId);
    if (!proj || !part) return [];

    const safeCount = Math.max(1, Math.min(6, Math.round(drawerCount || 1)));
    const partAABB = this.partGeometry.getWorldAABB(part);
    const allCavs = this.partGeometry.detectAllSceneCavities(
      proj.parts || [],
      proj.groups || [],
      proj.appliances
    );

    let nearestCav: ModuleCavityInfo | undefined;
    let nearestDist = Infinity;

    for (const cav of allCavs) {
      if ((cav.existingDrawerCount ?? 0) > 0) continue;
      const isWZ = cav.facingDirection === 'right' || cav.facingDirection === 'left';
      const cavMinX = isWZ
        ? Math.min(cav.frontEdgeCoord, cav.backInnerCoord)
        : cav.centerX - cav.innerWidth / 2;
      const cavMaxX = isWZ
        ? Math.max(cav.frontEdgeCoord, cav.backInnerCoord)
        : cav.centerX + cav.innerWidth / 2;
      const cavMinZ = isWZ
        ? cav.centerZ - cav.innerWidth / 2
        : Math.min(cav.frontEdgeCoord, cav.backInnerCoord);
      const cavMaxZ = isWZ
        ? cav.centerZ + cav.innerWidth / 2
        : Math.max(cav.frontEdgeCoord, cav.backInnerCoord);

      const dx = Math.max(0, cavMinX - partAABB.maxX, partAABB.minX - cavMaxX);
      const dy = Math.max(0, cav.minY - partAABB.maxY, partAABB.minY - cav.maxY);
      const dz = Math.max(0, cavMinZ - partAABB.maxZ, partAABB.minZ - cavMaxZ);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= 180 && dist < nearestDist) {
        nearestDist = dist;
        nearestCav = cav;
      }
    }

    const cleanName =
      (part.name || 'Cajón')
        .replace(/\b(pieza|puerta|entrepa[ñn]o|repisa|tablero|panel)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Cajón';
    const frontThickness = Math.max(12, Math.min(25, part.thickness || 18));
    const matId = part.materialId;

    if (nearestCav) {
      this.deletePart(partId);
      const afterProj = this.currentProject();
      const hostGrp = (afterProj.groups || []).find(g => g.id === nearestCav!.groupId);
      const refreshedCavs = this.partGeometry.detectModuleCavities(
        nearestCav.groupId,
        afterProj.parts || [],
        hostGrp,
        afterProj.appliances
      );
      const targetCav =
        refreshedCavs.find(c => c.id === nearestCav!.id) ||
        refreshedCavs.find(
          c =>
            c.leftPartId === nearestCav!.leftPartId &&
            c.rightPartId === nearestCav!.rightPartId &&
            Math.abs((c.centerY ?? 0) - (nearestCav!.centerY ?? 0)) <= 200
        ) ||
        [...refreshedCavs].sort(
          (a, b) =>
            Math.hypot(
              a.centerX - nearestCav!.centerX,
              (a.centerY ?? 0) - (nearestCav!.centerY ?? 0),
              a.centerZ - nearestCav!.centerZ
            ) -
            Math.hypot(
              b.centerX - nearestCav!.centerX,
              (b.centerY ?? 0) - (nearestCav!.centerY ?? 0),
              b.centerZ - nearestCav!.centerZ
            )
        )[0] || {
          ...nearestCav,
          coveringDoorIds: (nearestCav.coveringDoorIds || []).filter(id => id !== partId)
        };

      const hasDoor =
        frontMountType === 'none' && (targetCav.coveringDoorIds?.length ?? 0) > 0;
      const optimalSlide = this.partGeometry.getOptimalCommercialSlideLength(
        targetCav.internalDepth,
        frontMountType,
        frontThickness,
        hasDoor
      );

      return this.addParametricDrawersToCavity(
        targetCav,
        safeCount,
        {
          name: cleanName,
          outerWidth: targetCav.innerWidth,
          slideLength: optimalSlide,
          boxHeight: 140,
          boxThickness: 15,
          thickness: 15,
          frontThickness,
          bottomThickness: 3,
          includeFront: frontMountType !== 'none',
          frontMountType,
          handleType: 'handle',
          materialId: matId,
          frontMaterialId: matId
        }
      );
    }

    const isYZ = part.orientation === 'vertical_yz';
    const outerWidth = Math.max(160, Math.round(isYZ ? partAABB.sz : partAABB.sx));
    const rawDepth = isYZ ? partAABB.sx : partAABB.sz;
    const slideLength =
      rawDepth >= 220
        ? this.partGeometry.getOptimalCommercialSlideLength(rawDepth, frontMountType, frontThickness)
        : 450;
    const posX = Math.round(partAABB.px * 10) / 10;
    const posZ = Math.round(partAABB.pz * 10) / 10;
    const posY = Math.max(0, Math.round(partAABB.minY * 10) / 10);
    const facingDirection = isYZ ? 'right' : 'front';

    this.deletePart(partId);

    return this.addParametricDrawerStackOnFloor(
      {
        name: cleanName,
        outerWidth,
        slideLength,
        boxHeight: 140,
        boxThickness: 15,
        thickness: 15,
        frontThickness,
        bottomThickness: 3,
        includeFront: frontMountType !== 'none',
        frontMountType,
        handleType: 'handle',
        facingDirection,
        posX,
        posY,
        posZ,
        materialId: matId,
        frontMaterialId: matId
      },
      safeCount
    );
  }

  private resolveCavityRefContext(
    proj: Project,
    cavity: ModuleCavityInfo
  ): { isLooseStructure: boolean; hostParts: Part[]; hostGroup?: PartGroup; refPart?: Part } {
    const isLooseStructure = cavity.groupId === '__loose_structure__';
    const hostParts = isLooseStructure
      ? proj.parts.filter(p => !p.groupId)
      : proj.parts.filter(p => p.groupId === cavity.groupId);
    const hostGroup = isLooseStructure
      ? undefined
      : (proj.groups || []).find(g => g.id === cavity.groupId);
    const refPart =
      proj.parts.find(p => p.id === cavity.leftPartId) ||
      proj.parts.find(p => p.id === cavity.rightPartId) ||
      proj.parts.find(p => p.id === cavity.topPartId) ||
      proj.parts.find(p => p.id === cavity.bottomPartId) ||
      hostParts.find(p => p.componentRole === 'side_left') ||
      hostParts.find(p => p.componentRole !== 'back' && p.componentRole !== 'plinth') ||
      hostParts[0];
    return { isLooseStructure, hostParts, hostGroup, refPart };
  }

  /**
   * Inserta un entrepaño horizontal exactamente en el centro vertical de una cavidad,
   * con 0.5 mm de luz lateral por costado y retranqueo frontal de 10 mm para 0 colisiones.
   */
  splitCavityWithShelf(cavity: ModuleCavityInfo): Part | null {
    const proj = this.currentProject();
    if (!proj || cavity.height < 90 || cavity.internalDepth < 80 || cavity.innerWidth < 100) {
      return null;
    }

    const { isLooseStructure, hostParts, hostGroup, refPart } = this.resolveCavityRefContext(proj, cavity);

    const t = Math.max(
      12,
      Math.min(
        25,
        hostGroup?.parametricConfig?.structureThickness ||
          refPart?.thickness ||
          Math.round(cavity.leftSideThickness) ||
          18
      )
    );
    const isWidthZ = cavity.facingDirection === 'right' || cavity.facingDirection === 'left';
    const dirSign = cavity.facingDirection === 'front' || cavity.facingDirection === 'right' ? 1 : -1;

    // 0.5 mm de luz lateral por cada lado => innerWidth - 1.0 mm; retranqueo frontal 10 mm y 2 mm traseros
    const spanSize = Math.max(50, Math.round((cavity.innerWidth - 1) * 10) / 10);
    const frontDepth = cavity.frontEdgeCoord - dirSign * 10;
    const backDepth = cavity.backInnerCoord + dirSign * 2;
    const shelfDepth = Math.max(50, Math.round(Math.abs(frontDepth - backDepth) * 10) / 10);
    const depthCenter = Math.round(((frontDepth + backDepth) / 2) * 10) / 10;
    const centerY = Math.round(((cavity.minY + cavity.maxY) / 2) * 10) / 10;

    const existingShelves = hostParts.filter(p => p.componentRole === 'shelf').length;
    const shelfPart: Part = {
      id: `shelf_${isLooseStructure ? 'loose' : cavity.groupId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Entrepaño ${existingShelves + 1}`,
      moduleId: isLooseStructure ? refPart?.moduleId : (refPart?.moduleId || cavity.moduleId),
      moduleName: isLooseStructure ? refPart?.moduleName : (refPart?.moduleName || cavity.moduleName),
      groupId: isLooseStructure ? undefined : cavity.groupId,
      groupName: isLooseStructure ? undefined : (hostGroup?.name || cavity.groupName),
      length: isWidthZ ? shelfDepth : spanSize,
      width: isWidthZ ? spanSize : shelfDepth,
      thickness: t,
      quantity: 1,
      materialId: refPart?.materialId || 'mat-1',
      materialName: refPart?.materialName || 'Melamina Estándar',
      colorHex: refPart?.colorHex,
      grain: refPart?.grain ?? 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: isWidthZ ? depthCenter : cavity.centerX,
      posY: centerY,
      posZ: isWidthZ ? cavity.centerZ : depthCenter,
      orientation: 'horizontal',
      componentRole: 'shelf',
      isParametricGenerated: false,
      notes: 'Entrepaño divisor de vano'
    };

    this.addPart(shelfPart);
    return shelfPart;
  }

  /**
   * Inserta una división vertical en el centro horizontal de una cavidad
   * con altura y profundidad exactas y 0 colisiones.
   */
  splitCavityWithVerticalDivider(cavity: ModuleCavityInfo): Part | null {
    const proj = this.currentProject();
    if (!proj || cavity.innerWidth < 120 || cavity.height < 70 || cavity.internalDepth < 80) {
      return null;
    }

    const { isLooseStructure, hostParts, hostGroup, refPart } = this.resolveCavityRefContext(proj, cavity);

    const t = Math.max(
      12,
      Math.min(
        25,
        hostGroup?.parametricConfig?.structureThickness ||
          refPart?.thickness ||
          Math.round(cavity.leftSideThickness) ||
          18
      )
    );
    const isWidthZ = cavity.facingDirection === 'right' || cavity.facingDirection === 'left';

    const dividerHeight = Math.round(cavity.height * 10) / 10;
    const dividerDepth = Math.round(Math.abs(cavity.frontEdgeCoord - cavity.backInnerCoord) * 10) / 10;
    const depthCenter = Math.round(((cavity.frontEdgeCoord + cavity.backInnerCoord) / 2) * 10) / 10;
    const centerY = Math.round(((cavity.minY + cavity.maxY) / 2) * 10) / 10;

    const existingDividers = hostParts.filter(p => p.componentRole === 'divider').length;
    const dividerPart: Part = {
      id: `divider_${isLooseStructure ? 'loose' : cavity.groupId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `División Vertical ${existingDividers + 1}`,
      moduleId: isLooseStructure ? refPart?.moduleId : (refPart?.moduleId || cavity.moduleId),
      moduleName: isLooseStructure ? refPart?.moduleName : (refPart?.moduleName || cavity.moduleName),
      groupId: isLooseStructure ? undefined : cavity.groupId,
      groupName: isLooseStructure ? undefined : (hostGroup?.name || cavity.groupName),
      length: isWidthZ ? dividerDepth : dividerHeight,
      width: isWidthZ ? dividerHeight : dividerDepth,
      thickness: t,
      quantity: 1,
      materialId: refPart?.materialId || 'mat-1',
      materialName: refPart?.materialName || 'Melamina Estándar',
      colorHex: refPart?.colorHex,
      grain: refPart?.grain ?? 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: isWidthZ ? depthCenter : cavity.centerX,
      posY: centerY,
      posZ: isWidthZ ? cavity.centerZ : depthCenter,
      orientation: isWidthZ ? 'vertical_xy' : 'vertical_yz',
      componentRole: 'divider',
      isParametricGenerated: false,
      notes: 'División vertical de vano'
    };

    this.addPart(dividerPart);
    return dividerPart;
  }

  /**
   * Asigna un rol semántico explícito (y opcionalmente un nombre personalizado) a una pieza,
   * bloqueando el renombre automático futuro y ajustando su configuración de herrajes movibles.
   */
  assignPartQuickRole(partId: string, role: ComponentRole, customName?: string): Part | null {
    const existing = this.currentProject().parts.find(p => p.id === partId);
    if (!existing) {
      return null;
    }

    let hardwareConfig = existing.hardwareConfig;
    if (role === 'door') {
      hardwareConfig = {
        ...existing.hardwareConfig,
        isMovable: true,
        movableType: 'door',
        hingeType:
          existing.hardwareConfig?.hingeType && existing.hardwareConfig.hingeType !== 'none'
            ? existing.hardwareConfig.hingeType
            : 'straight',
        openingDirection: existing.hardwareConfig?.openingDirection || 'left',
        handleType:
          existing.hardwareConfig?.handleType && existing.hardwareConfig.handleType !== 'none'
            ? existing.hardwareConfig.handleType
            : 'bar_modern',
        slideType: 'none'
      };
    } else if (role === 'drawer_front') {
      hardwareConfig = {
        ...existing.hardwareConfig,
        isMovable: true,
        movableType: 'drawer',
        hingeType: 'none',
        handleType:
          existing.hardwareConfig?.handleType && existing.hardwareConfig.handleType !== 'none'
            ? existing.hardwareConfig.handleType
            : 'bar_modern',
        slideType:
          existing.hardwareConfig?.slideType && existing.hardwareConfig.slideType !== 'none'
            ? existing.hardwareConfig.slideType
            : 'telescopic'
      };
    } else {
      hardwareConfig = {
        ...existing.hardwareConfig,
        isMovable: false,
        movableType: 'none',
        handleType: 'none',
        hingeType: 'none',
        slideType: 'none'
      };
    }

    const updatedPart: Part = {
      ...existing,
      componentRole: role,
      name: customName ?? existing.name,
      hasCustomName: true,
      hardwareConfig
    };

    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(pt => (pt.id === partId ? updatedPart : pt))
    }));

    return updatedPart;
  }

  // ==========================================
  // ACCIONES DE MATERIALES, HERRAJES Y AJUSTES
  // ==========================================

  addMaterial(material: Material) {
    this.updateProject(p => ({
      ...p,
      materials: [...p.materials, material]
    }));
  }

  updateMaterial(material: Material) {
    this.updateProject(p => ({
      ...p,
      materials: p.materials.map(m => m.id === material.id ? material : m)
    }));
  }

  /**
   * Actualiza medidas y/o precio del tablero de un material del catálogo para un espesor concreto.
   * Acepta tanto el material base como una variante generada por el optimizador (ej. "mat_roble__15mm").
   */
  updateMaterialSheetSpec(
    materialOrVariant: Material,
    patch: { sheetLength?: number; sheetWidth?: number; sheetCost?: number }
  ) {
    const baseId = materialOrVariant.baseMaterialId || materialOrVariant.id;
    const base = this.currentProject().materials.find(m => m.id === baseId);
    if (!base) return;
    const updated = this.cutOptimizer.applySheetSpec(base, materialOrVariant.thickness, patch);
    this.updateMaterial(updated);
  }

  deleteMaterial(materialId: string) {
    this.updateProject(p => ({
      ...p,
      materials: p.materials.filter(m => m.id !== materialId)
    }));
  }

  addHardware(item: HardwareItem) {
    this.updateProject(p => ({
      ...p,
      hardware: [...p.hardware, item]
    }));
  }

  updateHardware(item: HardwareItem) {
    this.updateProject(p => {
      const exists = p.hardware.some(h => h.id === item.id);
      return {
        ...p,
        hardware: exists
          ? p.hardware.map(h => h.id === item.id ? item : h)
          : [...p.hardware, item]
      };
    });
  }

  deleteHardware(itemId: string) {
    this.updateProject(p => ({
      ...p,
      hardware: p.hardware.filter(h => h.id !== itemId)
    }));
  }

  updateSettings(settings: ProjectSettings, applyToExistingParts = false) {
    this.updateProject(p => {
      let parts = p.parts;
      let materials = p.materials;
      if (applyToExistingParts && settings.defaultBoardThickness) {
        const newT = settings.defaultBoardThickness;
        parts = parts.map(part => {
          // Actualizar piezas de melamina estándar (15 o 18 mm), conservando fondos MDF (3-6mm) y mesones (>25mm)
          if (part.thickness === 15 || part.thickness === 18) {
            return { ...part, thickness: newT };
          }
          return part;
        });
        materials = materials.map(m => {
          if ((m.thickness === 15 || m.thickness === 18) && m.textureType !== 'stone') {
            return { ...m, thickness: newT };
          }
          return m;
        });
      }
      return {
        ...p,
        settings,
        materials,
        parts
      };
    });
  }

  setWorkspaceMode(mode: WorkspaceMode) {
    this.updateProject(p => {
      const curConfig = p.roomConfig || DEFAULT_ROOM_CONFIG;
      const resolvedWalls = getResolvedRoomWalls(curConfig);
      return {
        ...p,
        workspaceMode: mode,
        roomConfig: {
          ...curConfig,
          walls: resolvedWalls
        }
      };
    }, false);
  }

  saveCameraState(
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    persistToProject = false
  ) {
    const cameraState: Camera3DState = {
      position: {
        x: Math.round(position.x * 10) / 10,
        y: Math.round(position.y * 10) / 10,
        z: Math.round(position.z * 10) / 10
      },
      target: {
        x: Math.round(target.x * 10) / 10,
        y: Math.round(target.y * 10) / 10,
        z: Math.round(target.z * 10) / 10
      }
    };
    this.lastCameraState.set(cameraState);
    if (persistToProject) {
      const updated: Project = {
        ...this.currentProject(),
        cameraState
      };
      this.currentProject.set(updated);
      this.saveToStorage(updated);
    }
  }

  updateRoomConfig(updates: Partial<RoomConfiguration>, recordHistory = false) {
    this.updateProject(p => {
      const curConfig = p.roomConfig || DEFAULT_ROOM_CONFIG;
      const targetW = updates.floorWidth ?? curConfig.floorWidth ?? 5000;
      const targetD = updates.floorDepth ?? curConfig.floorDepth ?? 5000;
      const prevW = curConfig.floorWidth ?? 5000;
      const prevD = curConfig.floorDepth ?? 5000;

      let walls = updates.walls
        ? updates.walls.map(w => ({ ...w }))
        : curConfig.walls
          ? curConfig.walls.map(w => ({ ...w }))
          : undefined;
      let extraUpdates: Partial<RoomConfiguration> = {};

      if (updates.walls) {
        const mainWall = updates.walls.find(item => item.id === 'main');
        const sideWall = updates.walls.find(item => item.id === 'side');
        const rightWall = updates.walls.find(item => item.id === 'right_side');
        if (mainWall) extraUpdates.mainWallLength = mainWall.length;
        if (sideWall) extraUpdates.sideWallLength = sideWall.length;
        if (rightWall) extraUpdates.rightWallLength = rightWall.length;
      } else if (targetW !== prevW || targetD !== prevD) {
        const wallT = updates.wallThickness ?? curConfig.wallThickness ?? 150;
        const offX = updates.wallOffsetX ?? curConfig.wallOffsetX ?? 0;
        const offZ = updates.wallOffsetZ ?? curConfig.wallOffsetZ ?? 0;
        const curWalls = getResolvedRoomWalls(curConfig);
        const rescaled = rescaleWallsToFloor(curWalls, prevW, prevD, targetW, targetD, wallT, offX, offZ);
        walls = rescaled;
        const mainWall = rescaled.find(item => item.id === 'main');
        const sideWall = rescaled.find(item => item.id === 'side');
        const rightWall = rescaled.find(item => item.id === 'right_side');
        extraUpdates = {
          mainWallLength: mainWall ? mainWall.length : Math.min(targetW, curConfig.mainWallLength),
          sideWallLength: sideWall ? sideWall.length : Math.min(Math.max(600, targetD - wallT), curConfig.sideWallLength),
          rightWallLength: rightWall ? rightWall.length : (curConfig.rightWallLength ? Math.min(Math.max(600, targetD - wallT), curConfig.rightWallLength) : undefined)
        };
      } else if (walls && walls.length > 0) {
        const dx = updates.wallOffsetX !== undefined ? updates.wallOffsetX - (curConfig.wallOffsetX ?? 0) : 0;
        const dz = updates.wallOffsetZ !== undefined ? updates.wallOffsetZ - (curConfig.wallOffsetZ ?? 0) : 0;
        walls = walls.map(w => {
          const next = { ...w };
          if (updates.wallMaterial !== undefined) next.material = updates.wallMaterial;
          if (updates.showSkirting !== undefined) next.showSkirting = updates.showSkirting;
          if (updates.wallThickness !== undefined) next.thickness = updates.wallThickness;
          if (updates.wallHeight !== undefined) next.height = updates.wallHeight;
          if (updates.isWallsLocked !== undefined) next.isLocked = updates.isWallsLocked;
          if (w.id === 'main' && updates.mainWallLength !== undefined) next.length = updates.mainWallLength;
          if (w.id === 'side' && updates.sideWallLength !== undefined) next.length = updates.sideWallLength;
          if (w.id === 'right_side' && updates.rightWallLength !== undefined) next.length = updates.rightWallLength;
          if (dx !== 0) next.posX = Math.round(next.posX + dx);
          if (dz !== 0) next.posZ = Math.round(next.posZ + dz);
          return next;
        });
      }

      const mergedConfig: RoomConfiguration = {
        ...curConfig,
        ...updates,
        ...extraUpdates,
        ...(walls ? { walls } : {})
      };
      mergedConfig.walls = getResolvedRoomWalls(mergedConfig);

      return {
        ...p,
        roomConfig: mergedConfig
      };
    }, recordHistory);
  }

  updateWorkspaceDimensions(floorWidth: number, floorDepth: number) {
    const w = Math.max(2000, Math.min(25000, floorWidth));
    const d = Math.max(2000, Math.min(25000, floorDepth));
    this.updateProject(p => {
      const curConfig = p.roomConfig || DEFAULT_ROOM_CONFIG;
      const prevW = curConfig.floorWidth || 5000;
      const prevD = curConfig.floorDepth || 5000;
      const wallT = curConfig.wallThickness || 150;
      const offX = curConfig.wallOffsetX ?? 0;
      const offZ = curConfig.wallOffsetZ ?? 0;
      const currentWalls = getResolvedRoomWalls(curConfig);
      const rescaledWalls = rescaleWallsToFloor(currentWalls, prevW, prevD, w, d, wallT, offX, offZ);

      const mainWall = rescaledWalls.find(item => item.id === 'main');
      const sideWall = rescaledWalls.find(item => item.id === 'side');
      const rightWall = rescaledWalls.find(item => item.id === 'right_side');

      return {
        ...p,
        roomConfig: {
          ...curConfig,
          floorWidth: w,
          floorDepth: d,
          mainWallLength: mainWall ? mainWall.length : Math.min(w, curConfig.mainWallLength),
          sideWallLength: sideWall ? sideWall.length : Math.min(Math.max(600, d - wallT), curConfig.sideWallLength),
          rightWallLength: rightWall ? rightWall.length : (curConfig.rightWallLength ? Math.min(Math.max(600, d - wallT), curConfig.rightWallLength) : undefined),
          walls: rescaledWalls
        }
      };
    }, true);
  }

  // ==========================================
  // EXPORTACIÓN E IMPORTACIÓN (JSON / CSV)
  // ==========================================

  exportProjectAsJson(): string {
    return JSON.stringify(this.currentProject(), null, 2);
  }

  downloadProjectJson() {
    const jsonStr = this.exportProjectAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentProject().name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_modulr.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importProjectFromJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString) as Project;
      if (!parsed.id || !Array.isArray(parsed.parts) || !Array.isArray(parsed.materials)) {
        throw new Error('Formato de proyecto inválido');
      }
      const mergedRoom: RoomConfiguration = {
        ...DEFAULT_ROOM_CONFIG,
        ...(parsed.roomConfig || {})
      };
      mergedRoom.walls = getResolvedRoomWalls(mergedRoom);
      parsed.roomConfig = mergedRoom;
      if (!parsed.workspaceMode) {
        parsed.workspaceMode = 'module';
      }
      this.clearHistory();
      this.selectedApplianceId.set(null);
      this.selectedWallId.set(null);
      this.lastCameraState.set(parsed.cameraState || null);
      this.designerSessionInitialized.set(false);
      this.currentProject.set(parsed);
      this.saveToStorage(parsed);
      return true;
    } catch (e) {
      console.error('Error importing project', e);
      return false;
    }
  }

  exportPartsCsv() {
    const parts = this.currentProject().parts;
    const headers = [
      'Pieza',
      'Modulo',
      'Material',
      'Cantidad',
      'Largo (mm)',
      'Ancho (mm)',
      'Espesor (mm)',
      'Veta',
      'Canto L1',
      'Canto L2',
      'Canto A1',
      'Canto A2',
      'Notas'
    ];

    const projectMaterials = this.currentProject().materials;
    const rows = parts.map(p => {
      const mat = this.resolveMaterialById(p.materialId, projectMaterials);
      const effectiveGrain = mat && mat.hasGrain === false ? 'none' : p.grain;
      return [
        `"${p.name}"`,
        `"${p.moduleName || 'Manual'}"`,
        `"${p.materialName}"`,
        p.quantity,
        p.length,
        p.width,
        p.thickness,
        effectiveGrain === 'length' ? 'Longitudinal' : effectiveGrain === 'width' ? 'Transversal' : 'Sin Veta',
        p.edges.l1,
        p.edges.l2,
        p.edges.a1,
        p.edges.a2,
        `"${p.notes || ''}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despiece_${this.currentProject().name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // ESTILO GLOBAL CLICK-CUISINE 2, MESONES INTELIGENTES Y CORTES ESPECIALES
  // =========================================================================

  /**
   * Cambia en 1 clic el material de todas las piezas según su rol constructivo:
   * - 'fronts': Puertas y frentes de cajón ('door', 'drawer_front', 'front')
   * - 'carcass': Estructura / Casco ('side_left', 'side_right', 'top', 'bottom', 'shelf', 'divider', 'tie')
   * - 'plinths': Zócalos inferiores ('plinth')
   * - 'countertop': Mesones / Encimeras y salpicaderos ('countertop', 'backsplash')
   */
  applyGlobalMaterialByRole(
    target: 'fronts' | 'carcass' | 'plinths' | 'countertop',
    materialId: string
  ): number {
    const mat = this.materialsList().find(m => m.id === materialId)
      || DEFAULT_COUNTERTOP_MATERIALS.find(m => m.id === materialId)
      || MELAMINE_MATERIALS_CATALOG.find(m => m.id === materialId);
    if (!mat) return 0;

    let updatedCount = 0;
    const isStone = isCountertopMaterial(mat);

    this.updateProject(p => ({
      ...p,
      materials: p.materials.some(m => m.id === mat.id) ? p.materials : [...p.materials, mat],
      parts: p.parts.map(part => {
        const role = part.componentRole || 'free';
        const nameLow = (part.name || '').toLowerCase();
        let matches = false;

        if (target === 'fronts') {
          matches =
            role === 'door' ||
            role === 'drawer_front' ||
            role === 'front' ||
            nameLow.includes('puerta') ||
            nameLow.includes('frente');
        } else if (target === 'carcass') {
          matches =
            role === 'side_left' ||
            role === 'side_right' ||
            role === 'top' ||
            role === 'bottom' ||
            role === 'shelf' ||
            role === 'divider' ||
            role === 'tie' ||
            role === 'drawer_box' ||
            role === 'drawer_lateral';
        } else if (target === 'plinths') {
          matches = role === 'plinth' || nameLow.includes('zócalo') || nameLow.includes('zocalo');
        } else if (target === 'countertop') {
          matches =
            role === 'countertop' ||
            role === 'backsplash' ||
            nameLow.includes('mesón') ||
            nameLow.includes('meson') ||
            nameLow.includes('encimera') ||
            nameLow.includes('salpicadero');
        }

        if (!matches) return part;
        updatedCount += part.quantity || 1;

        return {
          ...part,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          thickness: target === 'countertop' && role === 'countertop' ? mat.thickness : part.thickness,
          grain: mat.hasGrain ? (part.grain === 'none' ? 'length' : part.grain) : 'none',
          excludeFromCutlist:
            role === 'countertop' || role === 'backsplash' ? isStone : part.excludeFromCutlist
        };
      })
    }));

    return updatedCount;
  }

  /**
   * Cambia en 1 clic el modelo y acabado de tiradores en todas las puertas y frentes de cajón del proyecto.
   */
  applyGlobalHandles(handleType: HandleType, handleFinish: HandleFinish): number {
    let updatedCount = 0;
    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(part => {
        const role = part.componentRole;
        const hw = part.hardwareConfig;
        const isFrontOrDoor =
          role === 'door' ||
          role === 'drawer_front' ||
          hw?.movableType === 'door' ||
          hw?.movableType === 'drawer';
        if (!isFrontOrDoor) return part;

        updatedCount += part.quantity || 1;
        return {
          ...part,
          hardwareConfig: {
            ...(hw || { isMovable: true, movableType: role === 'drawer_front' ? 'drawer' : 'door' }),
            handleType,
            handleFinish
          }
        };
      })
    }));
    return updatedCount;
  }

  /**
   * Aplica o limpia un corte especial paramétrico (chaflán, diagonal, destaje en L, esquinas redondeadas)
   * sobre cualquier pieza o mesón, regenerando su polígono contourPoints.
   */
  applyCornerCutToPart(partId: string, config: PartCornerCutConfig) {
    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(part => {
        if (part.id !== partId) return part;
        if (!config || config.type === 'none') {
          return {
            ...part,
            shapeType: 'rectangle',
            contourPoints: undefined,
            cornerCutConfig: { type: 'none', corner: 'front_right', cutX: 150, cutY: 150 }
          };
        }
        const contourPoints = this.cabinetGen.buildCornerCutContour(part.length, part.width, config);
        return {
          ...part,
          shapeType: 'freehand',
          contourPoints,
          cornerCutConfig: config
        };
      })
    }));
  }

  /**
   * Genera mesones inteligentes de cocina (Auto sobre muebles bajos, Recto, en L, en U o Isla con Cascada)
   * con soporte dual Piedra/Melamina y zócalo/salpicadero trasero opcional.
   */
  generateSmartCountertop(options: {
    shape: CountertopLayoutShape;
    materialId: string;
    thickness?: number;
    includeBacksplash?: boolean;
    backsplashHeight?: number;
    length?: number;
    depth?: number;
    sideLength?: number;
  }): Part[] {
    const project = this.currentProject();
    const defaultStone = DEFAULT_COUNTERTOP_MATERIALS[0];
    const mat =
      project.materials.find(m => m.id === options.materialId && isCountertopMaterial(m)) ||
      project.materials.find(m => isCountertopMaterial(m)) ||
      defaultStone;

    const thick = Number(options.thickness) || mat.thickness || 30;
    const splashH = Number(options.backsplashHeight) || 75;
    const splashT = Math.min(20, thick);
    const includeSplash = options.includeBacksplash !== false;
    const groupId = `group_meson_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupName = `Mesón Cocina (${mat.name})`;

    // Determinar envolvente de los muebles bajos existentes para posicionar el mesón encima
    const baseParts = project.parts.filter(p => {
      if (p.componentRole === 'countertop' || p.componentRole === 'backsplash') return false;
      const topY = (p.posY || 0) + (p.orientation === 'horizontal' ? (p.thickness || 15) / 2 : (p.length || 0) / 2);
      return topY > 400 && topY <= 1050;
    });

    let minX = -900;
    let maxX = 900;
    let minZ = -300;
    let maxZ = 300;
    let maxBaseTopY = 860;

    if (baseParts.length > 0) {
      minX = Infinity;
      maxX = -Infinity;
      minZ = Infinity;
      maxZ = -Infinity;
      maxBaseTopY = 0;

      for (const bp of baseParts) {
        let halfX = (bp.length || 600) / 2;
        let halfY = (bp.thickness || 15) / 2;
        let halfZ = (bp.width || 580) / 2;
        if (bp.orientation === 'vertical_yz') {
          halfX = (bp.thickness || 15) / 2;
          halfY = (bp.length || 750) / 2;
          halfZ = (bp.width || 580) / 2;
        } else if (bp.orientation === 'vertical_xy') {
          halfX = (bp.length || 600) / 2;
          halfY = (bp.width || 750) / 2;
          halfZ = (bp.thickness || 15) / 2;
        }
        const px = bp.posX || 0;
        const py = bp.posY || 0;
        const pz = bp.posZ || 0;
        if (px - halfX < minX) minX = px - halfX;
        if (px + halfX > maxX) maxX = px + halfX;
        if (pz - halfZ < minZ) minZ = pz - halfZ;
        if (pz + halfZ > maxZ) maxZ = pz + halfZ;
        if (py + halfY > maxBaseTopY) maxBaseTopY = py + halfY;
      }
    }

    const overhangFront = 25;
    const overhangSide = 15;
    const newParts: Part[] = [];
    const uid = () => `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (options.shape === 'auto_modules' || options.shape === 'straight') {
      const length =
        options.shape === 'auto_modules' && baseParts.length > 0
          ? Math.max(600, Math.round(maxX - minX + overhangSide * 2))
          : Math.max(600, Number(options.length) || 1800);
      const depth =
        options.shape === 'auto_modules' && baseParts.length > 0
          ? Math.max(550, Math.round(maxZ - minZ + overhangFront))
          : Math.max(500, Number(options.depth) || 620);

      const centerX = options.shape === 'auto_modules' && baseParts.length > 0 ? Math.round((minX + maxX) / 2) : 0;
      const centerZ =
        options.shape === 'auto_modules' && baseParts.length > 0
          ? Math.round((minZ + maxZ + overhangFront) / 2)
          : 0;
      const topPosY = Math.round(maxBaseTopY + thick / 2);
      const splashPosY = Math.round(maxBaseTopY + thick + splashH / 2) + 0.5;

      newParts.push({
        id: `meson_recto_${uid()}`,
        name: 'Mesón Principal de Cocina',
        groupId,
        groupName,
        length,
        width: depth,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: centerX,
        posY: topPosY,
        posZ: centerZ,
        orientation: 'horizontal',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: `Mesón de encimera (${mat.name}) cotizado por m² (${length}x${depth}mm)`
      });

      if (includeSplash) {
        newParts.push({
          id: `salpicadero_recto_${uid()}`,
          name: 'Zócalo / Salpicadero Posterior Mesón',
          groupId,
          groupName,
          length,
          width: splashH,
          thickness: splashT,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: splashPosY,
          posZ: Math.round(centerZ - depth / 2 + splashT / 2),
          orientation: 'vertical_xy',
          componentRole: 'backsplash',
          excludeFromCutlist: true,
          notes: 'Salpicadero trasero sobre encimera'
        });
      }
    } else if (options.shape === 'l_shape') {
      const mainLen = Math.max(1200, Number(options.length) || 2100);
      const sideLen = Math.max(1000, Number(options.sideLength) || 1800);
      let runDepth = Math.max(500, Number(options.depth) || 620);
      if (runDepth > 900) runDepth = 620;
      if (runDepth >= sideLen - 200) runDepth = Math.min(620, Math.max(500, sideLen - 300));

      const topPosY = Math.round(maxBaseTopY + thick / 2);
      const splashPosY = Math.round(topPosY + thick / 2 + splashH / 2) + 0.5;

      const minX = Math.round(-mainLen / 2);
      const maxX = Math.round(mainLen / 2);
      const minZ = Math.round(-sideLen / 2);
      const centerX = Math.round((minX + maxX) / 2);
      const returnZLen = sideLen - runDepth;

      // 1. Tramo Principal (horizontal): Largo principal a lo largo de X, fondo runDepth en Z
      newParts.push({
        id: `meson_l_principal_${uid()}`,
        name: 'Mesón Tramo Principal (En L)',
        groupId,
        groupName,
        length: mainLen,
        width: runDepth,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: centerX,
        posY: topPosY,
        posZ: Math.round(minZ + runDepth / 2),
        orientation: 'horizontal',
        shapeType: 'rectangle',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: `Mesón tramo principal (${mainLen}x${runDepth}mm, e=${thick}mm)`
      });

      // 2. Retorno Lateral (horizontal): ancho runDepth en X, largo (sideLen - runDepth) en Z
      newParts.push({
        id: `meson_l_retorno_${uid()}`,
        name: 'Mesón Retorno Lateral (En L)',
        groupId,
        groupName,
        length: runDepth,
        width: returnZLen,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: Math.round(minX + runDepth / 2),
        posY: topPosY,
        posZ: Math.round(minZ + runDepth + returnZLen / 2),
        orientation: 'horizontal',
        shapeType: 'rectangle',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: `Mesón retorno lateral (${runDepth}x${returnZLen}mm, total ${sideLen}mm)`
      });

      if (includeSplash) {
        // Tramo principal posterior (muro trasero en minZ)
        newParts.push({
          id: `salpicadero_l_fondo_${uid()}`,
          name: 'Salpicadero Tramo Posterior (En L)',
          groupId,
          groupName,
          length: mainLen,
          width: splashH,
          thickness: splashT,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: splashPosY,
          posZ: Math.round(minZ + splashT / 2),
          orientation: 'vertical_xy',
          componentRole: 'backsplash',
          excludeFromCutlist: true
        });

        // Tramo de retorno lateral sincronizado (al ras del borde exterior lateral en minX)
        const sideSplashLen = Math.max(100, sideLen - splashT);
        newParts.push({
          id: `salpicadero_l_retorno_${uid()}`,
          name: 'Salpicadero Retorno Lateral (En L)',
          groupId,
          groupName,
          length: sideSplashLen,
          width: splashH,
          thickness: splashT,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: Math.round(minX + splashT / 2),
          posY: splashPosY,
          posZ: Math.round(minZ + splashT + sideSplashLen / 2),
          orientation: 'vertical_yz',
          componentRole: 'backsplash',
          excludeFromCutlist: true
        });
      }
    } else if (options.shape === 'u_shape') {
      const mainLen = Math.max(1600, Number(options.length) || 2100);
      const sideLen = Math.max(1000, Number(options.sideLength) || 1800);
      let runDepth = Math.max(500, Number(options.depth) || 620);
      if (runDepth > 900) runDepth = 620;
      if (runDepth >= sideLen - 200) runDepth = Math.min(620, Math.max(500, sideLen - 300));

      const topPosY = Math.round(maxBaseTopY + thick / 2);
      const splashPosY = Math.round(topPosY + thick / 2 + splashH / 2) + 0.5;

      const minX = Math.round(-mainLen / 2);
      const maxX = Math.round(mainLen / 2);
      const minZ = Math.round(-sideLen / 2);
      const centerX = Math.round((minX + maxX) / 2);
      const returnZLen = sideLen - runDepth;

      // 1. Tramo Principal (horizontal)
      newParts.push({
        id: `meson_u_principal_${uid()}`,
        name: 'Mesón Tramo Principal (En U)',
        groupId,
        groupName,
        length: mainLen,
        width: runDepth,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: centerX,
        posY: topPosY,
        posZ: Math.round(minZ + runDepth / 2),
        orientation: 'horizontal',
        shapeType: 'rectangle',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: `Mesón tramo principal (${mainLen}x${runDepth}mm, e=${thick}mm)`
      });

      // 2. Retorno Izquierdo (horizontal)
      newParts.push({
        id: `meson_u_retorno_izq_${uid()}`,
        name: 'Mesón Retorno Izquierdo (En U)',
        groupId,
        groupName,
        length: runDepth,
        width: returnZLen,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: Math.round(minX + runDepth / 2),
        posY: topPosY,
        posZ: Math.round(minZ + runDepth + returnZLen / 2),
        orientation: 'horizontal',
        shapeType: 'rectangle',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: `Mesón retorno izquierdo (${runDepth}x${returnZLen}mm)`
      });

      // 3. Retorno Derecho (horizontal)
      newParts.push({
        id: `meson_u_retorno_der_${uid()}`,
        name: 'Mesón Retorno Derecho (En U)',
        groupId,
        groupName,
        length: runDepth,
        width: returnZLen,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: Math.round(maxX - runDepth / 2),
        posY: topPosY,
        posZ: Math.round(minZ + runDepth + returnZLen / 2),
        orientation: 'horizontal',
        shapeType: 'rectangle',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: `Mesón retorno derecho (${runDepth}x${returnZLen}mm)`
      });

      if (includeSplash) {
        const sideSplashLen = Math.max(100, sideLen - splashT);

        // Tramo posterior
        newParts.push({
          id: `salpicadero_u_fondo_${uid()}`,
          name: 'Salpicadero Tramo Posterior (En U)',
          groupId,
          groupName,
          length: mainLen,
          width: splashH,
          thickness: splashT,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: splashPosY,
          posZ: Math.round(minZ + splashT / 2),
          orientation: 'vertical_xy',
          componentRole: 'backsplash',
          excludeFromCutlist: true
        });

        // Retorno lateral izquierdo
        newParts.push({
          id: `salpicadero_u_retorno_izq_${uid()}`,
          name: 'Salpicadero Retorno Izquierdo (En U)',
          groupId,
          groupName,
          length: sideSplashLen,
          width: splashH,
          thickness: splashT,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: Math.round(minX + splashT / 2),
          posY: splashPosY,
          posZ: Math.round(minZ + splashT + sideSplashLen / 2),
          orientation: 'vertical_yz',
          componentRole: 'backsplash',
          excludeFromCutlist: true
        });

        // Retorno lateral derecho
        newParts.push({
          id: `salpicadero_u_retorno_der_${uid()}`,
          name: 'Salpicadero Retorno Derecho (En U)',
          groupId,
          groupName,
          length: sideSplashLen,
          width: splashH,
          thickness: splashT,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: Math.round(maxX - splashT / 2),
          posY: splashPosY,
          posZ: Math.round(minZ + splashT + sideSplashLen / 2),
          orientation: 'vertical_yz',
          componentRole: 'backsplash',
          excludeFromCutlist: true
        });
      }
    } else if (options.shape === 'island_waterfall') {
      const islandLen = Math.max(1200, Number(options.length) || 1800);
      const islandDepth = Math.max(700, Number(options.depth) || 900);
      const islandHeight = Math.round(maxBaseTopY + thick);
      const islandZ = baseParts.length > 0 ? Math.round(maxZ + 1150) : 900;

      // Cubierta superior de la isla
      newParts.push({
        id: `isla_cubierta_${uid()}`,
        name: 'Cubierta Superior Isla con Cascada',
        groupId,
        groupName: `Isla Cascada (${mat.name})`,
        length: islandLen,
        width: islandDepth,
        thickness: thick,
        quantity: 1,
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex,
        grain: mat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: Math.round(islandHeight - thick / 2),
        posZ: islandZ,
        orientation: 'horizontal',
        componentRole: 'countertop',
        excludeFromCutlist: true,
        notes: 'Cubierta principal de isla desayunadora'
      });

      // Costados en cascada (Waterfall Izquierdo y Derecho hasta el suelo)
      const legH = islandHeight - thick;
      for (const side of ['Izquierdo', 'Derecho'] as const) {
        const sign = side === 'Izquierdo' ? -1 : 1;
        newParts.push({
          id: `isla_cascada_${side.toLowerCase()}_${uid()}`,
          name: `Costado Cascada ${side} (Isla)`,
          groupId,
          groupName: `Isla Cascada (${mat.name})`,
          length: legH,
          width: islandDepth,
          thickness: thick,
          quantity: 1,
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: mat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: Math.round(sign * (islandLen / 2 - thick / 2)),
          posY: Math.round(legH / 2),
          posZ: islandZ,
          orientation: 'vertical_yz',
          componentRole: 'countertop',
          excludeFromCutlist: true,
          notes: `Faldón cascada vertical ${side.toLowerCase()} de isla`
        });
      }
    }

    if (newParts.length > 0) {
      this.updateProject(p => ({
        ...p,
        materials: p.materials.some(m => m.id === mat.id) ? p.materials : [...p.materials, mat],
        parts: [...p.parts, ...newParts],
        groups: [
          ...(p.groups || []),
          {
            id: groupId,
            name: newParts[0].groupName || groupName,
            type: 'assembly',
            isCountertop: true,
            facingDirection: 'front',
            isOpen: false
          }
        ]
      }), true);
    }

    return newParts;
  }

  // =========================================================================
  // CONFIGURACIÓN DE PUERTAS EN 1 CLIC (FASE 3 & FASE 4.1)
  // =========================================================================

  private isConfigurableDoorPart(part: Part | null | undefined): boolean {
    if (!part) return false;
    if (
      part.componentRole === 'drawer_front' ||
      part.componentRole === 'drawer_box' ||
      part.componentRole === 'drawer_lateral' ||
      part.componentRole === 'drawer_bottom'
    ) {
      return false;
    }
    const upperName = (part.name || '').toUpperCase();
    if (upperName.includes('PANEL CIEGO')) {
      return false;
    }
    return (
      part.componentRole === 'door' ||
      part.hardwareConfig?.movableType === 'door' ||
      (upperName.includes('PUERTA') && !upperName.includes('CAJ'))
    );
  }

  private getDoorHorizontalMetrics(door: Part): {
    isRotatedZ: boolean;
    wProp: 'length' | 'width';
    hProp: 'length' | 'width';
    coordProp: 'posX' | 'posZ';
    depthProp: 'posX' | 'posZ';
    horizW: number;
    vertH: number;
    horizCenter: number;
    depthCenter: number;
    posY: number;
    minCoord: number;
    maxCoord: number;
  } {
    const isRotatedZ =
      door.orientation === 'vertical_yz' || Math.abs((door.rotationY || 0) % 180) === 90;
    const wProp: 'length' | 'width' = door.orientation === 'vertical_xy' ? 'length' : 'width';
    const hProp: 'length' | 'width' = door.orientation === 'vertical_xy' ? 'width' : 'length';
    const coordProp: 'posX' | 'posZ' = isRotatedZ ? 'posZ' : 'posX';
    const depthProp: 'posX' | 'posZ' = isRotatedZ ? 'posX' : 'posZ';
    const horizW = Math.max(10, Number(door[wProp]) || 0);
    const vertH = Math.max(10, Number(door[hProp]) || 0);
    const horizCenter = Number(door[coordProp]) || 0;
    const depthCenter = Number(door[depthProp]) || 0;
    const posY = door.posY ?? vertH / 2;
    return {
      isRotatedZ,
      wProp,
      hProp,
      coordProp,
      depthProp,
      horizW,
      vertH,
      horizCenter,
      depthCenter,
      posY,
      minCoord: horizCenter - horizW / 2,
      maxCoord: horizCenter + horizW / 2
    };
  }

  /**
   * Busca la puerta hermana par (Doble Hoja) que comparte el mismo vano horizontal y altura.
   */
  findPairedDoorSibling(doorPart: Part, allParts?: Part[]): Part | null {
    if (!doorPart || !this.isConfigurableDoorPart(doorPart)) {
      return null;
    }
    const list = allParts ?? this.partsList();
    const m0 = this.getDoorHorizontalMetrics(doorPart);

    let bestCandidate: Part | null = null;
    let bestScore = Infinity;

    for (const candidate of list) {
      if (candidate.id === doorPart.id) continue;
      if (!this.isConfigurableDoorPart(candidate)) continue;

      if (doorPart.groupId || candidate.groupId) {
        if (doorPart.groupId !== candidate.groupId) continue;
      } else if (doorPart.moduleId || candidate.moduleId) {
        if (doorPart.moduleId !== candidate.moduleId) continue;
      }

      const mc = this.getDoorHorizontalMetrics(candidate);
      if (mc.isRotatedZ !== m0.isRotatedZ) continue;
      if (Math.abs(mc.posY - m0.posY) > 25) continue;
      if (Math.abs(mc.vertH - m0.vertH) > 5 && Math.abs(candidate.length - doorPart.length) > 5) {
        continue;
      }
      if (Math.abs(mc.depthCenter - m0.depthCenter) > 25) continue;

      const edgeGap =
        mc.horizCenter >= m0.horizCenter
          ? mc.minCoord - m0.maxCoord
          : m0.minCoord - mc.maxCoord;

      if (edgeGap >= -5 && edgeGap <= 20) {
        const score = Math.abs(edgeGap - 3) + Math.abs(mc.posY - m0.posY) * 0.1;
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
    }

    return bestCandidate;
  }

  private resolveTargetBayDoors(
    partOrGroupId: string,
    allParts: Part[],
    groups: PartGroup[]
  ): { primaryDoor: Part | null; siblingDoor: Part | null; groupId?: string } {
    const directPart = allParts.find(p => p.id === partOrGroupId);
    if (directPart) {
      if (this.isConfigurableDoorPart(directPart)) {
        const siblingDoor = this.findPairedDoorSibling(directPart, allParts);
        return {
          primaryDoor: directPart,
          siblingDoor,
          groupId: directPart.groupId
        };
      }
      if (directPart.groupId) {
        partOrGroupId = directPart.groupId;
      } else if (directPart.moduleId) {
        partOrGroupId = directPart.moduleId;
      } else {
        return { primaryDoor: null, siblingDoor: null };
      }
    }

    const matchedGroup = groups.find(g => g.id === partOrGroupId);
    const groupPartIds = new Set(matchedGroup?.partIds || []);
    const groupDoors = allParts.filter(
      p =>
        this.isConfigurableDoorPart(p) &&
        (p.groupId === partOrGroupId ||
          p.moduleId === partOrGroupId ||
          groupPartIds.has(p.id))
    );

    if (groupDoors.length === 0) {
      return { primaryDoor: null, siblingDoor: null, groupId: matchedGroup?.id };
    }

    const primaryDoor = groupDoors[0];
    const siblingDoor =
      this.findPairedDoorSibling(primaryDoor, groupDoors) ??
      (groupDoors.length === 2 ? groupDoors[1] : null);

    return {
      primaryDoor,
      siblingDoor,
      groupId: primaryDoor.groupId || matchedGroup?.id
    };
  }

  /**
   * Obtiene el modo actual de configuración de puerta ('left' | 'right' | 'double' | 'top' | 'bottom' | 'none')
   * tanto si se pasa el ID de una puerta individual como el ID de un grupo/módulo.
   */
  getDoorConfigurationMode(partOrGroupId: string): DoorConfigurationMode | 'none' {
    if (!partOrGroupId) return 'none';
    const proj = this.currentProject();
    const allParts = proj.parts || [];
    const groups = proj.groups || [];

    const { primaryDoor, siblingDoor } = this.resolveTargetBayDoors(
      partOrGroupId,
      allParts,
      groups
    );

    if (!primaryDoor) {
      return 'none';
    }
    if (siblingDoor) {
      return 'double';
    }

    const dir = primaryDoor.hardwareConfig?.openingDirection;
    if (dir === 'left' || dir === 'right' || dir === 'top' || dir === 'bottom') {
      return dir;
    }

    const upperName = (primaryDoor.name || '').toUpperCase();
    if (
      upperName.includes('ABATIBLE SUPERIOR') ||
      upperName.includes('BASCULANTE') ||
      upperName.includes('ELEVABLE') ||
      upperName.includes('PISTON') ||
      upperName.includes('PISTÓN')
    ) {
      return 'top';
    }
    if (upperName.includes('ABATIBLE INFERIOR')) {
      return 'bottom';
    }
    if (upperName.includes('DERECHA') || upperName.includes('DER')) {
      return 'right';
    }
    return 'left';
  }

  /**
   * Configura en 1 clic el modo de apertura de la puerta o vano ('left' | 'right' | 'double' | 'top' | 'bottom'),
   * dividiendo automáticamente 1 hoja en 2 hojas simétricas (con luz central de 3 mm) o fusionando 2 hojas en 1
   * sin duplicar ni solapar piezas.
   */
  configureDoorOpeningMode(partOrGroupId: string, mode: DoorConfigurationMode): Part[] {
    if (!partOrGroupId) return [];
    const proj = this.currentProject();
    const allParts = proj.parts || [];
    const groups = proj.groups || [];

    const { primaryDoor, siblingDoor, groupId } = this.resolveTargetBayDoors(
      partOrGroupId,
      allParts,
      groups
    );

    if (!primaryDoor) {
      return [];
    }

    this.saveUndoSnapshot();

    const m1 = this.getDoorHorizontalMetrics(primaryDoor);
    let totalW = m1.horizW;
    let centerCoord = m1.horizCenter;

    if (siblingDoor) {
      const m2 = this.getDoorHorizontalMetrics(siblingDoor);
      const minCoord = Math.min(m1.minCoord, m2.minCoord);
      const maxCoord = Math.max(m1.maxCoord, m2.maxCoord);
      totalW = Math.round((maxCoord - minCoord) * 10) / 10;
      centerCoord = (minCoord + maxCoord) / 2;
    }

    const prevHw: PartHardwareConfig = primaryDoor.hardwareConfig || {};
    const prevPos = prevHw.handlePosition;
    const isHandleNone = prevPos === 'none' || prevHw.handleType === 'none';
    const effectiveHandleType: HandleType = isHandleNone
      ? 'none'
      : prevHw.handleType && prevHw.handleType !== 'none'
        ? prevHw.handleType
        : 'bar_modern';
    const effectiveHandleFinish: HandleFinish = prevHw.handleFinish || 'brushed_steel';
    const prevVerticalHandlePos: DoorHandleVerticalPosition = isHandleNone
      ? 'none'
      : prevPos === 'top' || prevPos === 'center' || prevPos === 'bottom'
        ? prevPos
        : 'center';

    let resultDoors: Part[] = [];

    if (mode === 'double') {
      const leafW = Number(((totalW - 3) / 2).toFixed(1));
      const leftCenter = Number((centerCoord - (leafW / 2 + 1.5)).toFixed(2));
      const rightCenter = Number((centerCoord + (leafW / 2 + 1.5)).toFixed(2));

      const leftHw: PartHardwareConfig = {
        ...prevHw,
        isMovable: true,
        movableType: 'door',
        openingDirection: 'left',
        hingeType: 'straight',
        handleType: effectiveHandleType,
        handleFinish: effectiveHandleFinish,
        handlePosition: prevVerticalHandlePos,
        isOpen: Boolean(prevHw.isOpen)
      };

      const rightHw: PartHardwareConfig = {
        ...prevHw,
        isMovable: true,
        movableType: 'door',
        openingDirection: 'right',
        hingeType: 'straight',
        handleType: effectiveHandleType,
        handleFinish: effectiveHandleFinish,
        handlePosition: prevVerticalHandlePos,
        isOpen: Boolean(prevHw.isOpen)
      };

      if (!siblingDoor) {
        const updatedLeft: Part = {
          ...primaryDoor,
          name: 'PUERTA IZQUIERDA',
          componentRole: 'door',
          [m1.wProp]: leafW,
          [m1.coordProp]: leftCenter,
          hardwareConfig: leftHw
        };

        const newRightId = `${primaryDoor.id}_der_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const createdRight: Part = {
          ...primaryDoor,
          id: newRightId,
          name: 'PUERTA DERECHA',
          componentRole: 'door',
          [m1.wProp]: leafW,
          [m1.coordProp]: rightCenter,
          hardwareConfig: rightHw
        };

        resultDoors = [updatedLeft, createdRight];

        this.updateProject(p => {
          const nextParts: Part[] = [];
          for (const pt of p.parts) {
            if (pt.id === primaryDoor.id) {
              nextParts.push(updatedLeft, createdRight);
            } else {
              nextParts.push(pt);
            }
          }

          const nextGroups = (p.groups || []).map(g => {
            if (g.id !== groupId) return g;
            const nextPartIds = g.partIds
              ? Array.from(new Set([...g.partIds, createdRight.id]))
              : undefined;
            return {
              ...g,
              ...(nextPartIds ? { partIds: nextPartIds } : {}),
              ...(g.parametricConfig
                ? {
                    parametricConfig: {
                      ...g.parametricConfig,
                      doorOpening: 'double' as const
                    }
                  }
                : {})
            };
          });

          return {
            ...p,
            parts: nextParts,
            groups: nextGroups
          };
        }, false);
      } else {
        const m2 = this.getDoorHorizontalMetrics(siblingDoor);
        const isPrimaryLeft = m1.horizCenter <= m2.horizCenter;
        const leftSource = isPrimaryLeft ? primaryDoor : siblingDoor;
        const rightSource = isPrimaryLeft ? siblingDoor : primaryDoor;
        const leftMetrics = isPrimaryLeft ? m1 : m2;
        const rightMetrics = isPrimaryLeft ? m2 : m1;

        const updatedLeft: Part = {
          ...leftSource,
          name: 'PUERTA IZQUIERDA',
          componentRole: 'door',
          [leftMetrics.wProp]: leafW,
          [leftMetrics.coordProp]: leftCenter,
          hardwareConfig: leftHw
        };

        const updatedRight: Part = {
          ...rightSource,
          name: 'PUERTA DERECHA',
          componentRole: 'door',
          [rightMetrics.wProp]: leafW,
          [rightMetrics.coordProp]: rightCenter,
          hardwareConfig: rightHw
        };

        resultDoors = [updatedLeft, updatedRight];

        this.updateProject(p => {
          const nextParts = p.parts.map(pt => {
            if (pt.id === updatedLeft.id) return updatedLeft;
            if (pt.id === updatedRight.id) return updatedRight;
            return pt;
          });

          const nextGroups = (p.groups || []).map(g => {
            if (g.id !== groupId || !g.parametricConfig) return g;
            return {
              ...g,
              parametricConfig: {
                ...g.parametricConfig,
                doorOpening: 'double' as const
              }
            };
          });

          return {
            ...p,
            parts: nextParts,
            groups: nextGroups
          };
        }, false);
      }

      return resultDoors;
    }

    // Modo de 1 hoja ('left' | 'right' | 'top' | 'bottom')
    const singleName =
      mode === 'left'
        ? 'PUERTA IZQUIERDA'
        : mode === 'right'
          ? 'PUERTA DERECHA'
          : mode === 'top'
            ? 'PUERTA ABATIBLE SUPERIOR'
            : 'PUERTA ABATIBLE INFERIOR';

    const singleHingeType: HingeType = mode === 'top' ? 'gas_piston' : 'straight';
    const singleHandlePos: DoorHandleVerticalPosition = isHandleNone
      ? 'none'
      : mode === 'top' || mode === 'bottom'
        ? 'horizontal'
        : prevVerticalHandlePos;

    const updatedSingle: Part = {
      ...primaryDoor,
      name: singleName,
      componentRole: 'door',
      [m1.wProp]: Number(totalW.toFixed(1)),
      [m1.coordProp]: Number(centerCoord.toFixed(2)),
      hardwareConfig: {
        ...prevHw,
        isMovable: true,
        movableType: 'door',
        openingDirection: mode,
        hingeType: singleHingeType,
        handleType: effectiveHandleType,
        handleFinish: effectiveHandleFinish,
        handlePosition: singleHandlePos,
        isOpen: Boolean(prevHw.isOpen)
      }
    };

    const removedSiblingId = siblingDoor?.id ?? null;
    resultDoors = [updatedSingle];

    this.updateProject(p => {
      const nextParts = p.parts
        .filter(pt => pt.id !== removedSiblingId)
        .map(pt => (pt.id === updatedSingle.id ? updatedSingle : pt));

      const nextGroups = (p.groups || []).map(g => {
        if (g.id !== groupId) return g;
        const nextPartIds =
          g.partIds && removedSiblingId
            ? g.partIds.filter(id => id !== removedSiblingId)
            : g.partIds;
        return {
          ...g,
          ...(nextPartIds ? { partIds: nextPartIds } : {}),
          ...(g.parametricConfig
            ? {
                parametricConfig: {
                  ...g.parametricConfig,
                  doorOpening: mode
                }
              }
            : {})
        };
      });

      return {
        ...p,
        parts: nextParts,
        groups: nextGroups
      };
    }, false);

    if (removedSiblingId) {
      if (this.designerSelectedPartId() === removedSiblingId) {
        this.designerSelectedPartId.set(updatedSingle.id);
      }
      const curSelIds = this.designerSelectedPartIds();
      if (curSelIds.includes(removedSiblingId)) {
        const replaced = Array.from(
          new Set(curSelIds.map(id => (id === removedSiblingId ? updatedSingle.id : id)))
        );
        this.designerSelectedPartIds.set(replaced);
      }
    }

    return resultDoors;
  }

  /**
   * Actualiza la posición vertical del tirador ('top' | 'center' | 'bottom' | 'none')
   * en la puerta seleccionada y en su hoja hermana par si es puerta doble.
   */
  setDoorHandleVerticalPosition(
    partOrGroupId: string,
    position: 'top' | 'center' | 'bottom' | 'none'
  ): void {
    if (!partOrGroupId) return;
    const proj = this.currentProject();
    const allParts = proj.parts || [];
    const groups = proj.groups || [];

    const { primaryDoor, siblingDoor, groupId } = this.resolveTargetBayDoors(
      partOrGroupId,
      allParts,
      groups
    );

    if (!primaryDoor) return;

    this.saveUndoSnapshot();

    const targetIds = new Set<string>([primaryDoor.id]);
    if (siblingDoor) {
      targetIds.add(siblingDoor.id);
    }

    this.updateProject(p => {
      const nextParts: Part[] = p.parts.map((pt): Part => {
        if (!targetIds.has(pt.id)) return pt;
        const prevHw: PartHardwareConfig = pt.hardwareConfig || {
          isMovable: true,
          movableType: 'door'
        };
        const nextHandleType: HandleType =
          position === 'none'
            ? 'none'
            : !prevHw.handleType || prevHw.handleType === 'none'
              ? 'bar_modern'
              : prevHw.handleType;

        return {
          ...pt,
          hardwareConfig: {
            ...prevHw,
            isMovable: true,
            movableType: 'door',
            handlePosition: position,
            handleType: nextHandleType
          }
        };
      });

      const nextGroups: PartGroup[] = (p.groups || []).map((g): PartGroup => {
        if (g.id !== groupId || !g.parametricConfig) return g;
        const grpHandleType: HandleType =
          position === 'none'
            ? 'none'
            : !g.parametricConfig.handleType || g.parametricConfig.handleType === 'none'
              ? 'bar_modern'
              : g.parametricConfig.handleType;
        return {
          ...g,
          parametricConfig: {
            ...g.parametricConfig,
            hasHandle: position !== 'none',
            handlePosition: position,
            handleType: grpHandleType
          }
        };
      });

      return {
        ...p,
        parts: nextParts,
        groups: nextGroups
      };
    }, false);
  }
}