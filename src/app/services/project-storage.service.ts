import { Injectable, signal, computed, inject } from '@angular/core';
import {
  FurnitureModule,
  HardwareItem,
  Material,
  ParametricCabinetConfig,
  ParametricDrawerConfig,
  Part,
  PartGroup,
  Project,
  ProjectNoteItem,
  ProjectSettings,
  ApplianceItem,
  CountertopLayoutShape,
  HandleFinish,
  HandleType,
  PartCornerCutConfig,
  isCountertopMaterial,
  DEFAULT_COUNTERTOP_MATERIALS,
  RoomConfiguration,
  DEFAULT_ROOM_CONFIG,
  getResolvedRoomWalls,
  rescaleWallsToFloor,
  WorkspaceMode,
  Camera3DState
} from '../models/melamine.models';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { JoineryEngineService } from './joinery-engine.service';
import { CutOptimizerService } from './cut-optimizer.service';
import { SupabaseService, CloudProjectRecord } from './supabase.service';
import { FurnitureTemplate } from './templates-catalog.service';

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

@Injectable({
  providedIn: 'root'
})
export class ProjectStorageService {
  private cabinetGen = inject(CabinetGeneratorService);
  private joineryEngine = inject(JoineryEngineService);
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
      appliances: (p.appliances || []).map(a => a.id === id ? { ...a, ...updates } : a)
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
        return upd ? { ...a, ...upd } : a;
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
   * Crea el proyecto de referencia inicial con el catálogo base de melaminas y piezas de muestra.
   */
  createDemoProject(): Project {
    const matRoble: Material = {
      id: 'mat_roble_18',
      name: 'Melamina Roble Nebraska',
      thickness: 15,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 175000,
      hasGrain: true,
      colorHex: '#b48a60',
      textureType: 'wood'
    };

    const matNogal: Material = {
      id: 'mat_nogal_18',
      name: 'Melamina Nogal Terracota',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 210000,
      hasGrain: true,
      colorHex: '#5c3a21',
      textureType: 'wood'
    };

    const matRobleMiel: Material = {
      id: 'mat_roblemiel_18',
      name: 'Melamina Roble Miel Cálido',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 205000,
      hasGrain: true,
      colorHex: '#c29b68',
      textureType: 'wood'
    };

    const matTeca: Material = {
      id: 'mat_teca_18',
      name: 'Melamina Teca Natural',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 215000,
      hasGrain: true,
      colorHex: '#8b5a2b',
      textureType: 'wood'
    };

    const matFresno: Material = {
      id: 'mat_fresno_18',
      name: 'Melamina Fresno Nórdico Claro',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 198000,
      hasGrain: true,
      colorHex: '#d9c5a5',
      textureType: 'wood'
    };

    const matCalacatta: Material = {
      id: 'mat_calacatta_18',
      name: 'Melamina Mármol Calacatta Blanco',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 245000,
      hasGrain: false,
      colorHex: '#f5f5f7',
      textureType: 'stone'
    };

    const matGranito: Material = {
      id: 'mat_granito_18',
      name: 'Melamina Granito Negro Absoluto',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 240000,
      hasGrain: false,
      colorHex: '#262626',
      textureType: 'stone'
    };

    const matBlanco: Material = {
      id: 'mat_blanco_18',
      name: 'Melamina Blanco Frost Mate',
      thickness: 15,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 135000,
      hasGrain: false,
      colorHex: '#f8fafc',
      textureType: 'solid'
    };

    const matGrafito: Material = {
      id: 'mat_grafito_18',
      name: 'Melamina Negro Grafito Antihuella',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 185000,
      hasGrain: false,
      colorHex: '#1e293b',
      textureType: 'solid'
    };

    const matSalvia: Material = {
      id: 'mat_salvia_18',
      name: 'Melamina Verde Salvia Mate',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 190000,
      hasGrain: false,
      colorHex: '#4a5d4e',
      textureType: 'solid'
    };

    const matTerracota: Material = {
      id: 'mat_terracota_18',
      name: 'Melamina Terracota / Barro Cálido',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 190000,
      hasGrain: false,
      colorHex: '#9c533e',
      textureType: 'solid'
    };

    const matAntracita: Material = {
      id: 'mat_antracita_18',
      name: 'Melamina Gris Antracita',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 165000,
      hasGrain: false,
      colorHex: '#334155',
      textureType: 'solid'
    };

    const matGris15: Material = {
      id: 'mat_gris_15',
      name: 'Melamina Gris Perla',
      thickness: 15,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 130000,
      hasGrain: false,
      colorHex: '#9ca3af',
      textureType: 'solid'
    };

    const matMdfFondo: Material = {
      id: 'mat_mdf_3',
      name: 'MDF Durolac Blanco',
      thickness: 3,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 45000,
      hasGrain: false,
      colorHex: '#e5e5e5',
      textureType: 'solid'
    };

    const matMesonCarrara: Material = {
      id: 'mat_stone_carrara_30',
      name: 'Piedra Mármol Carrara Pulido (Mesón)',
      thickness: 30,
      sheetLength: 3000,
      sheetWidth: 1600,
      sheetCost: 1450000,
      hasGrain: false,
      colorHex: '#f8fafc',
      textureType: 'stone',
      category: 'countertop'
    };

    const matMesonCuarzoBlanco: Material = {
      id: 'mat_stone_quartz_polar_20',
      name: 'Cuarzo Blanco Polar Silestone (Mesón)',
      thickness: 20,
      sheetLength: 3000,
      sheetWidth: 1600,
      sheetCost: 1320000,
      hasGrain: false,
      colorHex: '#f1f5f9',
      textureType: 'stone',
      category: 'countertop'
    };

    const matMesonGranitoNegro: Material = {
      id: 'mat_stone_granite_black_30',
      name: 'Granito Negro San Gabriel (Mesón)',
      thickness: 30,
      sheetLength: 2800,
      sheetWidth: 1600,
      sheetCost: 1180000,
      hasGrain: false,
      colorHex: '#1e293b',
      textureType: 'stone',
      category: 'countertop'
    };

    const matMesonDektonGris: Material = {
      id: 'mat_stone_dekton_gray_20',
      name: 'Piedra Sinterizada Gris Dekton (Mesón)',
      thickness: 20,
      sheetLength: 3200,
      sheetWidth: 1440,
      sheetCost: 1680000,
      hasGrain: false,
      colorHex: '#64748b',
      textureType: 'stone',
      category: 'countertop'
    };

    const matMesonMaderaRoble: Material = {
      id: 'mat_wood_butcher_36',
      name: 'Madera Roble Macizo Alistonado (Mesón)',
      thickness: 36,
      sheetLength: 2440,
      sheetWidth: 1220,
      sheetCost: 620000,
      hasGrain: true,
      colorHex: '#b47b48',
      textureType: 'wood',
      category: 'countertop'
    };

    const defaultMaterials = [
      matRoble,
      matNogal,
      matRobleMiel,
      matTeca,
      matFresno,
      matCalacatta,
      matGranito,
      matBlanco,
      matGrafito,
      matSalvia,
      matTerracota,
      matAntracita,
      matGris15,
      matMdfFondo,
      matMesonCarrara,
      matMesonCuarzoBlanco,
      matMesonGranitoNegro,
      matMesonDektonGris,
      matMesonMaderaRoble
    ];

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

  addModule(module: FurnitureModule) {
    const partsRes = this.cabinetGen.generatePartsForModule(module, this.currentProject().materials);
    this.updateProject(p => ({
      ...p,
      modules: [...p.modules, module],
      parts: [...p.parts, ...partsRes.parts],
      hardware: [...p.hardware, ...partsRes.hardware]
    }));
  }

  updateModule(module: FurnitureModule) {
    const current = this.currentProject();
    const partsRes = this.cabinetGen.generatePartsForModule(module, current.materials);
    const otherParts = current.parts.filter(p => p.moduleId !== module.id);
    const otherModules = current.modules.map(m => m.id === module.id ? module : m);

    this.updateProject(p => ({
      ...p,
      modules: otherModules,
      parts: [...otherParts, ...partsRes.parts]
    }));
  }

  addParametricCabinet(cabinet: { module: FurnitureModule; parts: Part[]; group: PartGroup }) {
    this.updateProject(p => ({
      ...p,
      modules: [...p.modules, cabinet.module],
      groups: [...(p.groups || []), cabinet.group],
      parts: [...p.parts, ...cabinet.parts]
    }));
  }

  updateParametricCabinet(groupId: string, newParts: Part[], newName?: string, newConfig?: ParametricCabinetConfig) {
    this.updateProject(p => ({
      ...p,
      groups: (p.groups || []).map(g => g.id === groupId ? {
        ...g,
        name: newName || g.name,
        parametricConfig: newConfig || g.parametricConfig
      } : g),
      parts: [
        ...p.parts.filter(pt => pt.groupId !== groupId),
        ...newParts
      ]
    }));
  }

  deleteModule(moduleId: string) {
    this.updateProject(p => ({
      ...p,
      modules: p.modules.filter(m => m.id !== moduleId),
      parts: p.parts.filter(pt => pt.moduleId !== moduleId)
    }));
  }

  clearFurniture() {
    this.selectedApplianceId.set(null);
    this.selectedApplianceIds.set([]);
    this.updateProject(p => ({
      ...p,
      modules: [],
      parts: [],
      groups: [],
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
      newParts = res.parts;
      templateGroup = res.group;
      templateModule = res.module;
    } else {
      newParts = template.generateParts(mats, offsetX);
      const groupId = 'group_' + template.id + '_' + crypto.randomUUID().slice(0, 6);
      templateGroup = {
        id: groupId,
        name: template.name,
        type: 'assembly',
        colorHex: template.previewColor?.accent || '#6366f1'
      };
      newParts = newParts.map(p => ({
        ...p,
        groupId,
        groupName: template.name
      }));
    }

    if (mode === 'replace') {
      this.updateProject(p => ({
        ...p,
        name: template.name,
        modules: templateModule ? [templateModule] : [],
        groups: templateGroup ? [templateGroup] : [],
        parts: newParts
      }));
    } else {
      this.updateProject(p => ({
        ...p,
        modules: templateModule ? [...p.modules, templateModule] : p.modules,
        groups: templateGroup ? [...(p.groups || []), templateGroup] : (p.groups || []),
        parts: [...p.parts, ...newParts]
      }));
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

  addPart(part: Part) {
    this.updateProject(p => ({
      ...p,
      parts: [...p.parts, part]
    }));
  }

  updatePart(part: Part, recordHistory = true) {
    this.updateProject(p => {
      const updatedParts = p.parts.map(pt => pt.id === part.id ? part : pt);
      return {
        ...p,
        parts: this.syncCountertopBacksplashes(updatedParts)
      };
    }, recordHistory);
  }

  updateMultipleParts(updatesList: { partId: string; updates: Partial<Part> }[], recordHistory = true) {
    this.updateProject(p => {
      const updatesMap = new Map(updatesList.map(u => [u.partId, u.updates]));
      const updatedParts = p.parts.map(pt => {
        const upd = updatesMap.get(pt.id);
        return upd ? { ...pt, ...upd } : pt;
      });
      return {
        ...p,
        parts: this.syncCountertopBacksplashes(updatedParts)
      };
    }, recordHistory);
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

    const clone: Part = {
      ...part,
      id: crypto.randomUUID(),
      name: candidate,
      posX: (part.posX ?? 0) + 40,
      posY: part.posY ?? 0,
      posZ: (part.posZ ?? 0) + 20
    };
    this.addPart(clone);
    return clone;
  }

  deletePart(partId: string) {
    this.updateProject(p => {
      const remainingParts = p.parts.filter(pt => pt.id !== partId);
      const usedGroupIds = new Set(remainingParts.map(pt => pt.groupId).filter(Boolean));
      const filteredGroups = (p.groups || []).filter(g => usedGroupIds.has(g.id));
      return {
        ...p,
        parts: remainingParts,
        groups: filteredGroups
      };
    });
  }

  deleteMultipleParts(partIds: string[]) {
    const idsSet = new Set(partIds);
    this.updateProject(p => {
      const remainingParts = p.parts.filter(pt => !idsSet.has(pt.id));
      const usedGroupIds = new Set(remainingParts.map(pt => pt.groupId).filter(Boolean));
      const filteredGroups = (p.groups || []).filter(g => usedGroupIds.has(g.id));
      return {
        ...p,
        parts: remainingParts,
        groups: filteredGroups
      };
    });
  }

  deleteMultiplePartsAndAppliances(partIds: string[], applianceIds: string[]) {
    const partIdsSet = new Set(partIds);
    const appIdsSet = new Set(applianceIds);
    this.updateProject(p => {
      const remainingParts = p.parts.filter(pt => !partIdsSet.has(pt.id));
      const usedGroupIds = new Set(remainingParts.map(pt => pt.groupId).filter(Boolean));
      const filteredGroups = (p.groups || []).filter(g => usedGroupIds.has(g.id));
      const remainingAppliances = (p.appliances || []).filter(a => !appIdsSet.has(a.id));
      return {
        ...p,
        parts: remainingParts,
        groups: filteredGroups,
        appliances: remainingAppliances
      };
    });
  }

  // ==========================================
  // ACCIONES DE GRUPOS (CAJONES Y ENSAMBLES)
  // ==========================================

  createGroup(
    name: string,
    partIds: string[],
    type: 'drawer' | 'door_set' | 'assembly' | 'custom' = 'drawer',
    slideLength = 450,
    isCountertop?: boolean
  ): PartGroup {
    const currentParts = (this.currentProject().parts || []).filter(pt => partIds.includes(pt.id));
    const isCountertopDetected = !!isCountertop || currentParts.some(p =>
      p.componentRole === 'countertop' ||
      p.componentRole === 'backsplash' ||
      (p.name && (p.name.toUpperCase().includes('MESÓN') || p.name.toUpperCase().includes('MESON') || p.name.toUpperCase().includes('SALPICADERO')))
    );

    const newGroup: PartGroup = {
      id: 'grp_' + crypto.randomUUID().slice(0, 8),
      name: name || (isCountertopDetected ? 'Mesón Cocina' : `Módulo ${(this.groupsList().length) + 1}`),
      type: isCountertopDetected ? 'assembly' : type,
      isOpen: false,
      slideExtension: 0,
      slideLength,
      slideType: 'telescopic',
      frontGap: 26,
      ...(isCountertopDetected ? { isCountertop: true, facingDirection: 'front' as const } : {})
    };

    this.updateProject(p => {
      const currentGroups = p.groups || [];
      const updatedParts = p.parts.map(pt => {
        if (partIds.includes(pt.id)) {
          return {
            ...pt,
            groupId: newGroup.id,
            groupName: newGroup.name
          };
        }
        return pt;
      });

      return {
        ...p,
        groups: [...currentGroups, newGroup],
        parts: updatedParts
      };
    });

    return newGroup;
  }

  ungroup(groupId: string) {
    this.updateProject(p => {
      const currentGroups = (p.groups || []).filter(g => g.id !== groupId);
      const updatedParts = p.parts.map(pt => {
        if (pt.groupId === groupId) {
          const copy = { ...pt };
          delete copy.groupId;
          delete copy.groupName;
          return copy;
        }
        return pt;
      });
      return {
        ...p,
        groups: currentGroups,
        parts: updatedParts
      };
    });
  }

  updateGroup(groupId: string, updates: Partial<PartGroup>) {
    this.updateProject(p => {
      const currentGroups = (p.groups || []).map(g => {
        if (g.id === groupId) {
          return { ...g, ...updates };
        }
        return g;
      });

      let updatedParts = p.parts;
      if (updates.name) {
        updatedParts = p.parts.map(pt => {
          if (pt.groupId === groupId) {
            return { ...pt, groupName: updates.name };
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

  changeGroupMaterial(groupId: string, materialId: string, target: 'all' | 'structure' | 'doors' = 'all') {
    const mat = this.materialsList().find(m => m.id === materialId)
      || DEFAULT_COUNTERTOP_MATERIALS.find(m => m.id === materialId);
    if (!mat) return;

    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(pt => {
        if (pt.groupId !== groupId) return pt;

        const isCountertopUnit = pt.componentRole === 'countertop' || pt.componentRole === 'backsplash';
        if (isCountertopUnit) {
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

        const isDoor = pt.componentRole === 'door' || pt.componentRole === 'drawer_front';
        const isBack = pt.componentRole === 'back' && pt.thickness <= 6;
        if (isBack) return pt;

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

  deleteGroup(groupId: string, deleteParts = false) {
    this.updateProject(p => {
      const currentGroups = (p.groups || []).filter(g => g.id !== groupId);
      let updatedParts = p.parts;
      let updatedAppliances = p.appliances || [];
      if (deleteParts) {
        updatedParts = p.parts.filter(pt => pt.groupId !== groupId);
        updatedAppliances = updatedAppliances.filter(a => a.groupId !== groupId);
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
      return {
        ...p,
        groups: currentGroups,
        parts: updatedParts,
        appliances: updatedAppliances
      };
    });
  }

  toggleGroupOpen(groupId: string) {
    const group = (this.groupsList()).find(g => g.id === groupId);
    if (!group) return;
    const nextState = !group.isOpen;
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
      const groupParts = p.parts.filter(pt => pt.groupId === groupId);
      let effDy = deltaY;
      if (groupParts.length > 0 && deltaY < 0) {
        let grpMinY = Infinity;
        for (const gp of groupParts) {
          const b = this.joineryEngine.getPartBounds(gp);
          if (b.minY < grpMinY) grpMinY = b.minY;
        }
        if (grpMinY !== Infinity) {
          effDy = Math.max(-grpMinY, deltaY);
        }
      }

      return {
        ...p,
        parts: p.parts.map(pt => {
          if (pt.groupId === groupId) {
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

  duplicateGroup(groupId: string): { newGroup: PartGroup; newPartIds: string[] } | null {
    const currentProj = this.currentProject();
    if (!currentProj) return null;

    const group = (currentProj.groups || []).find(g => g.id === groupId);
    if (!group) return null;

    const groupParts = currentProj.parts.filter(pt => pt.groupId === groupId);
    if (groupParts.length === 0) return null;

    let grpMinY = Infinity;
    let grpMaxY = -Infinity;
    for (const gp of groupParts) {
      const b = this.joineryEngine.getPartBounds(gp);
      if (b.minY < grpMinY) grpMinY = b.minY;
      if (b.maxY > grpMaxY) grpMaxY = b.maxY;
    }
    const groupHeight = grpMaxY > grpMinY ? grpMaxY - grpMinY : 180;
    const deltaY = Math.round(groupHeight + 15);

    const existingGroups = currentProj.groups || [];
    let nextName = `${group.name} (Copia)`;
    const match = group.name.match(/^(.*?caj[oó]n\s*)(\d+)/i);
    if (match) {
      const prefix = match[1];
      let maxNum = parseInt(match[2], 10);
      for (const g of existingGroups) {
        const m = g.name.match(new RegExp(`^${prefix}(\\d+)`, 'i'));
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
      nextName = `${prefix}${maxNum + 1}`;
    } else {
      nextName = `${group.name} ${existingGroups.length + 1}`;
    }

    const existingGroupNames = existingGroups.map(g => g.name.trim().toLowerCase());
    let groupCandidate = nextName;
    let groupSuffix = 2;
    while (existingGroupNames.includes(groupCandidate.trim().toLowerCase())) {
      groupCandidate = `${nextName} ${groupSuffix++}`;
    }
    nextName = groupCandidate;

    const newGroupId = 'grp_' + crypto.randomUUID().slice(0, 8);
    const newGroup: PartGroup = {
      ...group,
      id: newGroupId,
      name: nextName,
      isOpen: false,
      slideExtension: 0
    };

    const existingPartNames = currentProj.parts.map(p => p.name.trim().toLowerCase());
    const newPartIds: string[] = [];

    const newParts: Part[] = groupParts.map(pt => {
      const newId = 'part_' + crypto.randomUUID().slice(0, 8) + '_' + (pt.componentRole || 'drawer');
      newPartIds.push(newId);

      let partNameCandidate = pt.name;
      if (group.name && pt.name.toLowerCase().includes(group.name.toLowerCase())) {
        partNameCandidate = pt.name.replace(new RegExp(group.name, 'gi'), nextName);
      } else {
        partNameCandidate = `${pt.name} (${nextName})`;
      }

      let pCandidate = partNameCandidate;
      let pCounter = 2;
      while (existingPartNames.includes(pCandidate.trim().toLowerCase())) {
        pCandidate = `${partNameCandidate} ${pCounter++}`;
      }
      existingPartNames.push(pCandidate.trim().toLowerCase());

      return {
        ...pt,
        id: newId,
        name: pCandidate,
        groupId: newGroupId,
        groupName: nextName,
        posY: Math.round(((pt.posY ?? 0) + deltaY) * 10) / 10
      };
    });

    const groupAppliances = (currentProj.appliances || []).filter(a => a.groupId === groupId);
    const newAppliances: ApplianceItem[] = groupAppliances.map(app => {
      const newAppId = 'appliance_' + crypto.randomUUID().slice(0, 8);
      return {
        ...app,
        id: newAppId,
        groupId: newGroupId,
        position: {
          ...app.position,
          y: Math.round(((app.position.y ?? 0) + deltaY) * 10) / 10
        }
      };
    });

    this.updateProject(p => {
      return {
        ...p,
        groups: [...(p.groups || []), newGroup],
        parts: [...p.parts, ...newParts],
        appliances: [...(p.appliances || []), ...newAppliances]
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
      const targetParts = p.parts.filter(pt => partIds.includes(pt.id));
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
        if (!partIds.includes(pt.id)) return pt;

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

            if ((isBacksplash || isPlinth || isDrawerBoxSide) && horizontalSpan > verticalHeight) {
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
          contourPoints: newContourPoints
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
      let currentGroups = p.groups ? [...p.groups] : [];
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
        return {
          ...g,
          facingDirection: facingOrder[nextIdx]
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
      || DEFAULT_COUNTERTOP_MATERIALS.find(m => m.id === materialId);
    if (!mat) return;
    const isTargetMatCountertop = isCountertopMaterial(mat);

    this.updateProject(p => ({
      ...p,
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
            materialName: mat.name
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
    const groupParts = this.currentProject().parts.filter(pt => pt.groupId === groupId);
    if (groupParts.length === 0) return;
    this.rotateMultiplePartsRigidly(groupParts.map(p => p.id), angleDelta);
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

    let oldMinX = Infinity, oldMaxX = -Infinity;
    let oldMinY = Infinity, oldMaxY = -Infinity;
    let oldMinZ = Infinity, oldMaxZ = -Infinity;
    for (const pt of groupParts) {
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
        groupName: group.name
      }));
      this.updateParametricCabinet(groupId, updatedParts, group.name, nextCfg);

      if (facing === 'right') {
        this.rotateGroupRigidly(groupId, -90);
      } else if (facing === 'left') {
        this.rotateGroupRigidly(groupId, 90);
      } else if (facing === 'back') {
        this.rotateGroupRigidly(groupId, 180);
      }

      // Restaurar el centro (oldCx, oldCz) y la base (oldMinY) originales del módulo
      const afterParts = this.currentProject().parts.filter(pt => pt.groupId === groupId);
      let newMinX = Infinity, newMaxX = -Infinity;
      let newMinY = Infinity;
      let newMinZ = Infinity, newMaxZ = -Infinity;
      for (const pt of afterParts) {
        const b = this.joineryEngine.getPartBounds(pt);
        if (b.minX < newMinX) newMinX = b.minX;
        if (b.maxX > newMaxX) newMaxX = b.maxX;
        if (b.minY < newMinY) newMinY = b.minY;
        if (b.minZ < newMinZ) newMinZ = b.minZ;
        if (b.maxZ > newMaxZ) newMaxZ = b.maxZ;
      }
      const newCx = (newMinX + newMaxX) / 2;
      const newCz = (newMinZ + newMaxZ) / 2;
      const dx = Math.round((oldCx - newCx) * 10) / 10;
      const dy = Math.round((oldMinY - newMinY) * 10) / 10;
      const dz = Math.round((oldCz - newCz) * 10) / 10;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || Math.abs(dz) > 0.1) {
        this.moveGroup(groupId, dx, dy, dz);
      }
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

          if ((isPlinth || isDrawerBoxSide) && newSz > newSy) {
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
    const groupParts = parts.filter(pt => pt.groupId === groupId);
    if (groupParts.length === 0) return 'front';

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

  addParametricDrawer(cfg: ParametricDrawerConfig): PartGroup {
    const defaultMat = this.materialsList().find(m => m.id === cfg.materialId) || this.materialsList()[0];
    const mdfMat = this.materialsList().find(m => m.id === cfg.bottomMaterialId || m.thickness === 3) || defaultMat;

    const t = cfg.boxThickness || 15;
    const bT = cfg.bottomThickness || 3;
    const gap = cfg.slideGap ?? 26;
    const boxWidth = Math.max(120, cfg.outerWidth - gap);
    const boxLen = cfg.slideLength || 450;
    const boxH = cfg.boxHeight || 140;

    const basePosX = cfg.posX ?? 0;
    const basePosY = cfg.posY ?? 100;
    const basePosZ = cfg.posZ ?? 0;

    const groupId = 'grp_caj_' + crypto.randomUUID().slice(0, 8);
    const groupName = cfg.name || `Cajón ${(this.groupsList().length) + 1}`;

    const newGroup: PartGroup = {
      id: groupId,
      name: groupName,
      type: 'drawer',
      isOpen: false,
      slideExtension: 0,
      slideLength: boxLen,
      slideType: 'telescopic',
      frontGap: gap
    };

    const fondo: Part = {
      id: `${groupId}_fondo_mdf`,
      name: `Fondo MDF (${groupName})`,
      groupId,
      groupName,
      length: boxWidth,
      width: boxLen,
      thickness: bT,
      quantity: 1,
      materialId: mdfMat ? mdfMat.id : 'mat_mdf_3',
      materialName: mdfMat ? mdfMat.name : 'MDF Durolac Blanco',
      grain: 'none',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: basePosX,
      posY: basePosY + (bT / 2),
      posZ: basePosZ,
      orientation: 'horizontal',
      componentRole: 'drawer_box',
      notes: 'Fondo MDF 3mm colocado por debajo de la caja'
    };

    const boxCenterY = basePosY + bT + (boxH / 2);

    const latIzq: Part = {
      id: `${groupId}_lat_izq`,
      name: `Lateral Izq (${groupName})`,
      groupId,
      groupName,
      length: boxLen,
      width: boxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: basePosX - (boxWidth / 2) + (t / 2),
      posY: boxCenterY,
      posZ: basePosZ,
      orientation: 'vertical_yz',
      componentRole: 'drawer_box',
      notes: `Corredera ${boxLen}mm`
    };

    const latDer: Part = {
      id: `${groupId}_lat_der`,
      name: `Lateral Der (${groupName})`,
      groupId,
      groupName,
      length: boxLen,
      width: boxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: basePosX + (boxWidth / 2) - (t / 2),
      posY: boxCenterY,
      posZ: basePosZ,
      orientation: 'vertical_yz',
      componentRole: 'drawer_box',
      notes: `Corredera ${boxLen}mm`
    };

    const testeraWidth = Math.max(80, boxWidth - (2 * t));
    const contraFrente: Part = {
      id: `${groupId}_contrafrente`,
      name: `Contra-frente (${groupName})`,
      groupId,
      groupName,
      length: testeraWidth,
      width: boxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: basePosX,
      posY: boxCenterY,
      posZ: basePosZ + (boxLen / 2) - (t / 2),
      orientation: 'vertical_xy',
      componentRole: 'drawer_box',
      notes: 'Frente interior de caja'
    };

    const trasera: Part = {
      id: `${groupId}_trasera`,
      name: `Trasera (${groupName})`,
      groupId,
      groupName,
      length: testeraWidth,
      width: boxH,
      thickness: t,
      quantity: 1,
      materialId: defaultMat ? defaultMat.id : 'mat-1',
      materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
      grain: defaultMat?.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: basePosX,
      posY: boxCenterY,
      posZ: basePosZ - (boxLen / 2) + (t / 2),
      orientation: 'vertical_xy',
      componentRole: 'drawer_box',
      notes: 'Trasera de caja'
    };

    const newParts: Part[] = [latIzq, latDer, contraFrente, trasera, fondo];

    const includeFront = cfg.includeFront !== false;
    if (includeFront) {
      const fW = cfg.frontWidth || cfg.outerWidth;
      const fH = cfg.frontHeight || (boxH + bT + 30);
      const frente: Part = {
        id: `${groupId}_frente`,
        name: `Frente Vista (${groupName})`,
        groupId,
        groupName,
        length: fW,
        width: fH,
        thickness: t,
        quantity: 1,
        materialId: defaultMat ? defaultMat.id : 'mat-1',
        materialName: defaultMat ? defaultMat.name : 'Melamina Estándar',
        grain: defaultMat?.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: basePosX,
        posY: basePosY + (fH / 2),
        posZ: basePosZ + (boxLen / 2) + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'drawer_front',
        hardwareConfig: {
          isMovable: true,
          movableType: 'drawer',
          handleType: 'bar_modern',
          handlePosition: 'centered',
          slideType: 'telescopic',
          isOpen: false
        },
        notes: 'Frente visto con tirador y cantos gruesos'
      };
      newParts.push(frente);
    }

    const slideHwItem: HardwareItem = {
      id: 'hw_slide_' + crypto.randomUUID().slice(0, 8),
      name: `Par Correderas Telescópicas ${boxLen}mm (${groupName})`,
      category: 'slide',
      unit: 'par',
      quantity: 1,
      unitCost: 18500,
      notes: `Para ${groupName}`
    };

    this.updateProject(p => {
      const curGroups = p.groups || [];
      const curHw = p.hardware || [];
      return {
        ...p,
        groups: [...curGroups, newGroup],
        parts: [...p.parts, ...newParts],
        hardware: [...curHw, slideHwItem]
      };
    });

    return newGroup;
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
    this.updateProject(p => ({
      ...p,
      hardware: p.hardware.map(h => h.id === item.id ? item : h)
    }));
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

    const rows = parts.map(p => [
      `"${p.name}"`,
      `"${p.moduleName || 'Manual'}"`,
      `"${p.materialName}"`,
      p.quantity,
      p.length,
      p.width,
      p.thickness,
      p.grain === 'length' ? 'Longitudinal' : p.grain === 'width' ? 'Transversal' : 'Sin Veta',
      p.edges.l1,
      p.edges.l2,
      p.edges.a1,
      p.edges.a2,
      `"${p.notes || ''}"`
    ]);

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
    const project = this.currentProject();
    const mat = project.materials.find(m => m.id === materialId);
    if (!mat) return 0;

    let updatedCount = 0;
    const isStone = mat.textureType === 'stone';

    this.updateProject(p => ({
      ...p,
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
    let mat =
      project.materials.find(m => m.id === options.materialId && isCountertopMaterial(m)) ||
      project.materials.find(m => isCountertopMaterial(m)) ||
      defaultStone;

    if (!project.materials.some(m => m.id === mat.id)) {
      project.materials.push(mat);
    }

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
      }));
    }

    return newParts;
  }
}