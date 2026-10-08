import { Injectable, signal, computed, inject } from '@angular/core';
import {
  FurnitureModule,
  HardwareItem,
  Material,
  Part,
  Project,
  ProjectSettings
} from '../models/melamine.models';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { SupabaseService, CloudProjectRecord } from './supabase.service';
import { FurnitureTemplate } from './templates-catalog.service';

const STORAGE_KEY = 'melamipro_current_project';
const PROJECTS_LIST_KEY = 'melamipro_saved_projects_meta';

export interface ProjectMeta {
  id: string;
  name: string;
  clientName: string;
  updatedAt: string;
  modulesCount: number;
  partsCount: number;
}

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
  readonly supabase = inject(SupabaseService);

  private autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;

  // Undo / Redo history stacks (deep cloned snapshots)
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  readonly canUndo = signal<boolean>(false);
  readonly canRedo = signal<boolean>(false);

  // Cloud auto-sync preference (default: false, manual save with button)
  readonly autoSyncEnabled = signal<boolean>(this.loadAutoSyncPreference());

  readonly currentProject = signal<Project>(this.getInitialProject());
  readonly savedProjects = signal<ProjectMeta[]>(this.loadSavedProjectsList());

  // Computed totals
  readonly totalPartsCount = computed(() => {
    return this.currentProject().parts.reduce((sum, p) => sum + p.quantity, 0);
  });

  readonly materialsList = computed(() => this.currentProject().materials);
  readonly modulesList = computed(() => this.currentProject().modules);
  readonly partsList = computed(() => this.currentProject().parts);
  readonly hardwareList = computed(() => this.currentProject().hardware);
  readonly projectSettings = computed(() => this.currentProject().settings);

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
    // If no project existed, initialize demo and persist
    if (this.isBrowser() && !localStorage.getItem(STORAGE_KEY)) {
      this.saveToStorage(this.currentProject());
    }
  }

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
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse saved project from storage', e);
        }
      }
    }
    return this.createDemoProject();
  }

  createDemoProject(): Project {
    const matRoble: Material = {
      id: 'mat_roble_18',
      name: 'Melamina Roble Nebraska',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 195000,
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
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 145000,
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
      matMdfFondo
    ];

    // Inicializar directamente con el modelo de barra/mueble de referencia (Techo 1800x600, laterales, base)
    const initialParts: Part[] = [
      {
        id: 'desk_top',
        name: 'TECHO',
        length: 1800,
        width: 600,
        thickness: 18,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 0,
        posY: 991,
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
        thickness: 18,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: -891,
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
        thickness: 18,
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
        thickness: 18,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 891,
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
        thickness: 18,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 595.5,
        posY: 90,
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
        thickness: 18,
        quantity: 1,
        materialId: matRoble.id,
        materialName: matRoble.name,
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
      hardware: initialHardware,
      laborCost: 350000,
      laborType: 'fixed',
      profitMarginPercent: 25,
      taxPercent: 0,
      updatedAt: new Date().toISOString()
    };
  }

  // --- HISTORY (UNDO / REDO) ---

  pushSnapshot() {
    try {
      const snap = JSON.parse(JSON.stringify(this.currentProject()));
      this.undoStack.push(snap);
      if (this.undoStack.length > 35) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.canUndo.set(this.undoStack.length > 0);
      this.canRedo.set(false);
    } catch {
      // Fallback
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;
    try {
      const currentSnap = JSON.parse(JSON.stringify(this.currentProject()));
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
      const currentSnap = JSON.parse(JSON.stringify(this.currentProject()));
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

  // --- CRUD OPERACIONES ---

  updateProject(mutator: (p: Project) => Project, recordHistory = true) {
    if (recordHistory) {
      this.pushSnapshot();
    }
    const updated = mutator({ ...this.currentProject() });
    updated.updatedAt = new Date().toISOString();
    this.currentProject.set(updated);
    this.saveToStorage(updated);
  }

  saveToStorage(project: Project) {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));

    // Update list metadata
    const list = this.loadSavedProjectsList();
    const existingIndex = list.findIndex(p => p.id === project.id);
    const meta: ProjectMeta = {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      updatedAt: project.updatedAt,
      modulesCount: project.modules.length,
      partsCount: project.parts.reduce((s, p) => s + p.quantity, 0)
    };

    if (existingIndex >= 0) {
      list[existingIndex] = meta;
    } else {
      list.unshift(meta);
    }

    localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(list));
    localStorage.setItem(`melamipro_project_${project.id}`, JSON.stringify(project));
    this.savedProjects.set(list);

    // Only sync to Supabase automatically if user enabled auto-sync
    if (this.autoSyncEnabled()) {
      this.scheduleCloudAutoSync(project);
    } else if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
      this.autoSyncTimeout = null;
    }
  }

  private scheduleCloudAutoSync(project: Project) {
    if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
    }
    this.autoSyncTimeout = setTimeout(() => {
      this.supabase.saveProject(project);
    }, 1500);
  }

  async saveCurrentToCloud(): Promise<{ success: boolean; error?: string }> {
    return this.supabase.saveProject(this.currentProject());
  }

  loadCloudProject(record: CloudProjectRecord) {
    if (record && record.data) {
      const proj = record.data;
      this.currentProject.set(proj);
      if (this.isBrowser()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(proj));
        localStorage.setItem(`melamipro_project_${proj.id}`, JSON.stringify(proj));
      }
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
    const raw = localStorage.getItem(`melamipro_project_${id}`);
    if (raw) {
      try {
        const proj = JSON.parse(raw);
        this.currentProject.set(proj);
        localStorage.setItem(STORAGE_KEY, raw);
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
      hardware: [],
      updatedAt: new Date().toISOString()
    };
    this.currentProject.set(newProj);
    this.saveToStorage(newProj);
  }

  resetToDemo() {
    const demo = this.createDemoProject();
    this.currentProject.set(demo);
    this.saveToStorage(demo);
  }

  // --- MODULE ACTIONS ---

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
    // Regenerar piezas para este módulo
    const partsRes = this.cabinetGen.generatePartsForModule(module, current.materials);
    const otherParts = current.parts.filter(p => p.moduleId !== module.id);
    const otherModules = current.modules.map(m => m.id === module.id ? module : m);

    this.updateProject(p => ({
      ...p,
      modules: otherModules,
      parts: [...otherParts, ...partsRes.parts]
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
    this.updateProject(p => ({
      ...p,
      modules: [],
      parts: []
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
          let halfW = 0;
          if (part.orientation === 'horizontal' || part.orientation === 'vertical_xy') {
            halfW = (part.length || 0) / 2;
          } else {
            halfW = (part.thickness || 18) / 2;
          }
          const rightEdge = (part.posX || 0) + halfW;
          if (rightEdge > maxX) maxX = rightEdge;
        }
        if (maxX !== -Infinity) {
          offsetX = Math.round(maxX + (template.dimensions.width / 2) + 200);
        }
      }
    }

    const newParts = template.generateParts(mats, offsetX);

    if (mode === 'replace') {
      this.updateProject(p => ({
        ...p,
        name: template.name,
        modules: [],
        parts: newParts
      }));
    } else {
      this.updateProject(p => ({
        ...p,
        parts: [...p.parts, ...newParts]
      }));
    }
  }

  loadDeskBarFurniture() {
    const mats = this.currentProject().materials;
    const woodMat = mats.find(m => m.hasGrain) || mats[0];

    // Reference model matching image.png (Desk / Counter with right cabinet)
    const deskParts: Part[] = [
      {
        id: 'desk_top',
        name: 'TECHO',
        length: 1800,
        width: 600,
        thickness: 18,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 0,
        posY: 991,
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
        thickness: 18,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: -891,
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
        thickness: 18,
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
        thickness: 18,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 891,
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
        thickness: 18,
        quantity: 1,
        materialId: woodMat.id,
        materialName: woodMat.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 595.5,
        posY: 90,
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
        thickness: 18,
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

  // --- PARTS ACTIONS ---

  addPart(part: Part) {
    this.updateProject(p => ({
      ...p,
      parts: [...p.parts, part]
    }));
  }

  updatePart(part: Part, recordHistory = true) {
    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(pt => pt.id === part.id ? part : pt)
    }), recordHistory);
  }

  updateMultipleParts(updatesList: { partId: string; updates: Partial<Part> }[], recordHistory = true) {
    this.updateProject(p => {
      const updatesMap = new Map(updatesList.map(u => [u.partId, u.updates]));
      return {
        ...p,
        parts: p.parts.map(pt => {
          const upd = updatesMap.get(pt.id);
          return upd ? { ...pt, ...upd } : pt;
        })
      };
    }, recordHistory);
  }

  duplicatePart(partId: string): Part | null {
    const part = this.currentProject().parts.find(p => p.id === partId);
    if (!part) return null;
    const clone: Part = {
      ...part,
      id: crypto.randomUUID(),
      name: `${part.name} (Copia)`,
      posX: (part.posX ?? 0) + 40,
      posY: part.posY ?? 0,
      posZ: (part.posZ ?? 0) + 20
    };
    this.addPart(clone);
    return clone;
  }

  deletePart(partId: string) {
    this.updateProject(p => ({
      ...p,
      parts: p.parts.filter(pt => pt.id !== partId)
    }));
  }

  // --- MATERIALS ACTIONS ---

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

  deleteMaterial(materialId: string) {
    this.updateProject(p => ({
      ...p,
      materials: p.materials.filter(m => m.id !== materialId)
    }));
  }

  // --- HARDWARE ACTIONS ---

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

  // --- SETTINGS ACTIONS ---

  updateSettings(settings: ProjectSettings) {
    this.updateProject(p => ({
      ...p,
      settings
    }));
  }

  // --- EXPORT & IMPORT ---

  exportProjectAsJson(): string {
    return JSON.stringify(this.currentProject(), null, 2);
  }

  downloadProjectJson() {
    const jsonStr = this.exportProjectAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentProject().name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_melamipro.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importProjectFromJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString) as Project;
      if (!parsed.id || !Array.isArray(parsed.parts) || !Array.isArray(parsed.materials)) {
        throw new Error('Formato de proyecto inválido');
      }
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
}
