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

@Injectable({
  providedIn: 'root'
})
export class ProjectStorageService {
  private cabinetGen = inject(CabinetGeneratorService);

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

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
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
      name: 'Melamina Roble Nebraska 18mm',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 48.50,
      hasGrain: true,
      colorHex: '#b48a60',
      textureType: 'wood'
    };

    const matBlanco: Material = {
      id: 'mat_blanco_18',
      name: 'Melamina Blanco Mate 18mm',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 36.00,
      hasGrain: false,
      colorHex: '#f1f1f1',
      textureType: 'solid'
    };

    const matMdfFondo: Material = {
      id: 'mat_mdf_3',
      name: 'MDF / Durolac Blanco 3mm (Fondos)',
      thickness: 3,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 14.00,
      hasGrain: false,
      colorHex: '#e5e5e5',
      textureType: 'solid'
    };

    const defaultMaterials = [matRoble, matBlanco, matMdfFondo];

    // Módulo Bajo Mesada Cocina de 800mm de ancho x 850mm de alto x 580mm de profundidad
    const modBajo: FurnitureModule = {
      id: 'mod_bajo_800',
      name: 'Bajo Mesada 800 (2 Puertas)',
      type: 'base_cabinet',
      width: 800,
      height: 850,
      depth: 580,
      boardThickness: 18,
      backThickness: 3,
      backType: 'groove',
      shelvesCount: 1,
      doorsCount: 2,
      doorsType: 'overlay',
      drawersCount: 0,
      hasPlinth: true,
      plinthHeight: 100,
      materialId: matBlanco.id,
      backMaterialId: matMdfFondo.id,
      defaultThinEdge: true,
      defaultThickDoors: true
    };

    // Módulo Cajonera de 500mm con 3 cajones telescópicos
    const modCajonera: FurnitureModule = {
      id: 'mod_cajonera_500',
      name: 'Cajonera 500 (3 Cajones)',
      type: 'base_cabinet',
      width: 500,
      height: 850,
      depth: 580,
      boardThickness: 18,
      backThickness: 3,
      backType: 'groove',
      shelvesCount: 0,
      doorsCount: 0,
      doorsType: 'overlay',
      drawersCount: 3,
      hasPlinth: true,
      plinthHeight: 100,
      materialId: matRoble.id,
      backMaterialId: matMdfFondo.id,
      defaultThinEdge: true,
      defaultThickDoors: true
    };

    // Módulo Alacena Alta de 800mm x 700mm x 320mm
    const modAlacena: FurnitureModule = {
      id: 'mod_alacena_800',
      name: 'Alacena Superior 800 (2 Puertas)',
      type: 'wall_cabinet',
      width: 800,
      height: 700,
      depth: 320,
      boardThickness: 18,
      backThickness: 3,
      backType: 'groove',
      shelvesCount: 1,
      doorsCount: 2,
      doorsType: 'overlay',
      drawersCount: 0,
      hasPlinth: false,
      plinthHeight: 0,
      materialId: matBlanco.id,
      backMaterialId: matMdfFondo.id,
      defaultThinEdge: true,
      defaultThickDoors: true
    };

    const modules = [modBajo, modCajonera, modAlacena];

    // Generar despiece paramétrico inicial
    let initialParts: Part[] = [];
    let initialHardware: HardwareItem[] = [];

    for (const mod of modules) {
      const res = this.cabinetGen.generatePartsForModule(mod, defaultMaterials);
      initialParts = [...initialParts, ...res.parts];
      initialHardware = [...initialHardware, ...res.hardware];
    }

    const settings: ProjectSettings = {
      sawKerf: 4,
      trimMargin: 10,
      thinEdgeThickness: 0.45,
      thickEdgeThickness: 2.0,
      thinEdgeCostPerMeter: 0.40,
      thickEdgeCostPerMeter: 1.10,
      optimizationPreference: 'best_fit',
      currency: 'USD'
    };

    return {
      id: 'proj_demo_cocina',
      name: 'Cocina Moderna Roble & Blanco',
      clientName: 'Cliente Ejemplo - Residencia Las Palmas',
      date: new Date().toISOString().split('T')[0],
      notes: 'Proyecto modelo: Bajo mesada 2 puertas + cajonera 3 frentes + alacena aérea. Incluye optimización de corte y presupuesto de herrajes.',
      settings,
      materials: defaultMaterials,
      modules,
      parts: initialParts,
      hardware: initialHardware,
      laborCost: 150,
      laborType: 'fixed',
      profitMarginPercent: 25,
      taxPercent: 0,
      updatedAt: new Date().toISOString()
    };
  }

  // --- CRUD OPERACIONES ---

  updateProject(mutator: (p: Project) => Project) {
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

  // --- PARTS ACTIONS ---

  addPart(part: Part) {
    this.updateProject(p => ({
      ...p,
      parts: [...p.parts, part]
    }));
  }

  updatePart(part: Part) {
    this.updateProject(p => ({
      ...p,
      parts: p.parts.map(pt => pt.id === part.id ? part : pt)
    }));
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
