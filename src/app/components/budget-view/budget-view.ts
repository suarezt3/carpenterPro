import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  Edit02Icon,
  Layers01Icon,
  Note01Icon,
  PrinterIcon,
  RulerIcon,
  Settings01Icon,
  Tag01Icon
} from '@hugeicons/core-free-icons';
import { ProjectStorageService, formatCurrencyValue } from '../../services/project-storage.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';
import { HardwareItem, Material, isStoneMaterial } from '../../models/melamine.models';
import { MELAMINE_MATERIALS_CATALOG } from '../../data/melamine-catalog.data';

/**
 * Vista de Presupuesto Financiero y Cotización Comercial de Carpintería.
 * Calcula automáticamente el costo de tableros enteros requeridos, metros lineales de tapacanto,
 * herrajes, electrodomésticos 3D, mano de obra, margen de utilidad e impuestos.
 */
@Component({
  selector: 'app-budget-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, HugeiconsIconComponent],
  templateUrl: './budget-view.html',
  styleUrl: './budget-view.css'
})
export class BudgetViewComponent {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly confirmService = inject(ConfirmDialogService);
  private readonly optimizer = inject(CutOptimizerService);
  private readonly hardwareCatalog = inject(HardwareCatalogService);
  private readonly fb = inject(FormBuilder);

  // Registro local de iconos vectoriales de Hugeicons
  readonly icons = {
    budget: Tag01Icon,
    currency: Tag01Icon,
    board: Layers01Icon,
    edges: RulerIcon,
    hardware: Settings01Icon,
    appliance: Compass01Icon,
    labor: Edit02Icon,
    star: CheckmarkCircle02Icon,
    add: Add01Icon,
    close: Cancel01Icon,
    calculate: CheckListIcon,
    receipt: Note01Icon,
    print: PrinterIcon
  };

  // Signals sincronizados con el estado global del proyecto
  readonly project = this.projectService.currentProject;
  readonly materials = this.projectService.materialsList;
  readonly hardware = this.projectService.hardwareList;
  readonly groups = this.projectService.groupsList;
  readonly settings = this.projectService.projectSettings;

  // IDs de herrajes automáticos que el usuario ha decidido eliminar manualmente
  readonly excludedAutoHardwareIds = signal<Set<string>>(new Set());

  // Estado de modales y vista de cotización formal imprimible
  readonly showAddHardwareModal = signal<boolean>(false);
  readonly showClientQuotation = signal<boolean>(false);

  readonly hardwareForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    category: ['accessory', Validators.required],
    unit: ['und', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [1.0, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  /**
   * Obtiene el resultado en tiempo real del optimizador de corte para conocer
   * cuántas placas enteras de cada material y cuántos metros de canto se requieren.
   */
  readonly optResult = computed(() => {
    return this.optimizer.optimizeProject(
      this.projectService.partsList(),
      this.materials(),
      this.settings()
    );
  });

  /**
   * Desglose de costos de tableros enteros agrupados por material.
   */
  readonly sheetsCostBreakdown = computed(() => {
    const res = this.optResult();
    const map = new Map<string, { material: Material; count: number }>();

    for (const sheet of res.sheets) {
      const existing = map.get(sheet.material.id);
      if (existing) {
        existing.count++;
      } else {
        map.set(sheet.material.id, { material: sheet.material, count: 1 });
      }
    }

    const items: { material: Material; count: number; subtotal: number }[] = [];
    let totalSheetsCost = 0;

    map.forEach(({ material, count }) => {
      const subtotal = count * material.sheetCost;
      totalSheetsCost += subtotal;
      items.push({ material, count, subtotal });
    });

    return { items, totalSheetsCost };
  });

  /**
   * Desglose de costos de tapacanto delgado (0.45mm) y grueso (2.0mm).
   */
  readonly edgesCostBreakdown = computed(() => {
    const res = this.optResult();
    const set = this.settings();

    const thinCost = res.thinEdgeMeters * set.thinEdgeCostPerMeter;
    const thickCost = res.thickEdgeMeters * set.thickEdgeCostPerMeter;
    const totalEdgeCost = thinCost + thickCost;

    return {
      thinMeters: res.thinEdgeMeters,
      thinRate: set.thinEdgeCostPerMeter,
      thinCost,
      thickMeters: res.thickEdgeMeters,
      thickRate: set.thickEdgeCostPerMeter,
      thickCost,
      totalEdgeCost
    };
  });

  /**
   * Herrajes calculados automáticamente en base a las partes móviles del proyecto (bisagras, correderas, pistones, rieles, tubos).
   */
  readonly autoHardware = computed<HardwareItem[]>(() => {
    return this.hardwareCatalog.computeRequiredHardwareList(this.projectService.partsList());
  });

  /**
   * Lista completa reactiva de herrajes: combina los calculados automáticamente con los personalizados/manuales.
   */
  readonly allHardware = computed<HardwareItem[]>(() => {
    const autoItems = this.autoHardware();
    const manualItems = this.hardware();
    const excluded = this.excludedAutoHardwareIds();
    const map = new Map<string, HardwareItem>();

    for (const it of autoItems) {
      if (!excluded.has(it.id)) {
        map.set(it.id, { ...it });
      }
    }
    for (const it of manualItems) {
      map.set(it.id, { ...it });
    }
    return Array.from(map.values());
  });

  /**
   * Costo total de herrajes, correderas, bisagras y tornillería.
   */
  readonly hardwareCostTotal = computed(() => {
    return this.allHardware().reduce((sum, h) => sum + (h.quantity * h.unitCost), 0);
  });

  /**
   * Electrodomésticos y equipamiento 3D incluidos en la cotización.
   */
  readonly appliances = computed(() => this.projectService.appliancesList());
  readonly appliancesBudgetList = computed(() => this.appliances().filter(a => a.includeInBudget !== false));
  readonly appliancesCostTotal = computed(() => {
    return this.appliancesBudgetList().reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  });

  /**
   * Desglose de mesones y superficies de Piedra / Cuarzo / Granito / Mármol cotizados por m²
   * (excluidos del optimizador de corte de melamina).
   */
  readonly stoneCountertopsBreakdown = computed(() => {
    const parts = this.projectService.partsList();
    const mats = this.materials();
    const stoneParts = parts.filter(p => {
      const m = mats.find(mat => mat.id === p.materialId) || ({ id: p.materialId, name: p.materialName } as Material);
      return isStoneMaterial(m);
    });

    const items = stoneParts.map(part => {
      const mat = mats.find(m => m.id === part.materialId) ||
                  MELAMINE_MATERIALS_CATALOG.find(m => m.id === part.materialId || m.name.toLowerCase() === (part.materialName || '').toLowerCase());
      const sheetAreaM2 = Math.max(1, ((mat?.sheetLength || 3000) * (mat?.sheetWidth || 1600)) / 1_000_000);
      const costPerM2 = Math.round((mat?.sheetCost || 1350000) / sheetAreaM2);
      const areaM2 = Math.round(((part.length * part.width * (part.quantity || 1)) / 1_000_000) * 100) / 100;
      const linearMeters = Math.round(((part.length * (part.quantity || 1)) / 1000) * 100) / 100;
      const subtotal = Math.round(areaM2 * costPerM2);
      return {
        part,
        materialName: mat?.name || part.materialName,
        colorHex: mat?.colorHex || '#f1f5f9',
        areaM2,
        linearMeters,
        costPerM2,
        subtotal
      };
    });

    const totalStoneCost = items.reduce((acc, it) => acc + it.subtotal, 0);
    const totalAreaM2 = Math.round(items.reduce((acc, it) => acc + it.areaM2, 0) * 100) / 100;
    return { items, totalStoneCost, totalAreaM2 };
  });

  /**
   * Costo directo de materiales de carpintería y mesones (Tableros + Mesones Piedra m² + Tapacantos + Herrajes).
   */
  readonly totalMaterialsCost = computed(() => {
    return (
      this.sheetsCostBreakdown().totalSheetsCost +
      this.stoneCountertopsBreakdown().totalStoneCost +
      this.edgesCostBreakdown().totalEdgeCost +
      this.hardwareCostTotal()
    );
  });

  /**
   * Costo de mano de obra (fijo o porcentual sobre materiales).
   */
  readonly laborTotal = computed(() => {
    const p = this.project();
    if (p.laborType === 'percent') {
      return this.totalMaterialsCost() * (p.laborCost / 100);
    }
    return p.laborCost;
  });

  /**
   * Costo total de producción (Materiales + Electrodomésticos cotizados + Mano de Obra).
   */
  readonly productionCost = computed(() => {
    return this.totalMaterialsCost() + this.appliancesCostTotal() + this.laborTotal();
  });

  /**
   * Monto de utilidad bruta según el porcentaje configurado.
   */
  readonly profitAmount = computed(() => {
    const margin = this.project().profitMarginPercent;
    return this.productionCost() * (margin / 100);
  });

  readonly subtotalBeforeTax = computed(() => {
    return this.productionCost() + this.profitAmount();
  });

  readonly taxAmount = computed(() => {
    const tax = this.project().taxPercent;
    return this.subtotalBeforeTax() * (tax / 100);
  });

  /**
   * Precio final sugerido de venta al cliente (con utilidad e impuestos incluidos).
   */
  readonly finalClientPrice = computed(() => {
    return this.subtotalBeforeTax() + this.taxAmount();
  });

  // --- MANEJADORES DE EVENTOS CON TIPADO ESTRICTO (CERO $any) ---

  onMaterialCostChange(material: Material, event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateMaterialCost(material, Number(target?.value) || 0);
  }

  onHardwareQtyChange(item: HardwareItem, event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateHardwareQty(item, Math.max(1, Number(target?.value) || 1));
  }

  onHardwareCostChange(item: HardwareItem, event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateHardwareCost(item, Math.max(0, Number(target?.value) || 0));
  }

  onApplianceIncludeChange(id: string, event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.toggleApplianceBudget(id, !!target?.checked);
  }

  onAppliancePriceChange(id: string, event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateApplianceBudgetPrice(id, Number(target?.value) || 0);
  }

  onLaborCostChange(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateLabor(Math.max(0, Number(target?.value) || 0), this.project().laborType);
  }

  onLaborTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const type = target?.value === 'percent' ? 'percent' : 'fixed';
    this.updateLabor(this.project().laborCost, type);
  }

  onProfitMarginInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateProfitMargin(Math.max(0, Number(target?.value) || 0));
  }

  onTaxChange(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.updateTax(Math.max(0, Number(target?.value) || 0));
  }

  // --- MÉTODOS DE ACTUALIZACIÓN DEL PROYECTO ---

  updateApplianceBudgetPrice(id: string, newCost: number | string) {
    this.projectService.updateAppliance(id, { price: Number(newCost) || 0 });
  }

  toggleApplianceBudget(id: string, include: boolean) {
    this.projectService.updateAppliance(id, { includeInBudget: include });
  }

  updateLabor(cost: number, type: 'percent' | 'fixed') {
    this.projectService.updateProject(p => ({
      ...p,
      laborCost: cost,
      laborType: type
    }));
  }

  updateProfitMargin(percent: number) {
    this.projectService.updateProject(p => ({
      ...p,
      profitMarginPercent: percent
    }));
  }

  updateTax(percent: number) {
    this.projectService.updateProject(p => ({
      ...p,
      taxPercent: percent
    }));
  }

  updateMaterialCost(material: Material, newCost: number) {
    // Funciona tanto para el material base como para variantes de espesor (ej. Roble 15 mm)
    this.projectService.updateMaterialSheetSpec(material, { sheetCost: Number(newCost) });
  }

  /**
   * Módulos calculados a partir de project.groups (con fallback a project.modules para proyectos legados)
   * para presentar en la cotización comercial formal para el cliente.
   */
  readonly clientModules = computed(() => {
    const grps = this.groups();
    if (grps && grps.length > 0) {
      return grps.map(g => {
        const parts = this.projectService.partsList().filter(p => p.groupId === g.id || p.moduleId === g.id);
        const w = g.parametricConfig?.width || (parts.length > 0 ? Math.max(...parts.map(p => p.length)) : 600);
        const h = g.parametricConfig?.height || (parts.length > 0 ? Math.max(...parts.map(p => p.width)) : 720);
        const d = g.parametricConfig?.depth || 300;
        return {
          id: g.id,
          name: g.name,
          width: w,
          height: h,
          depth: d,
          boardThickness: g.parametricConfig?.structureThickness || this.settings().defaultBoardThickness || 15
        };
      });
    }
    return this.project().modules || [];
  });

  /**
   * Espesor(es) reales de melamina usados por las piezas de un módulo (ej. "15mm" o "15 / 18mm"),
   * para que la cotización formal muestre lo mismo que el modelador y el optimizador.
   */
  getModuleBoardThicknessLabel(moduleId: string, fallback: number): string {
    const parts = this.projectService.partsList().filter(p =>
      (p.moduleId === moduleId || p.groupId === moduleId) &&
      (p.thickness || 0) > 8 &&
      p.componentRole !== 'back' &&
      p.componentRole !== 'countertop' &&
      p.componentRole !== 'backsplash'
    );
    if (parts.length === 0) return `${fallback}mm`;
    const set = Array.from(new Set(parts.map(p => Math.round((p.thickness || 0) * 10) / 10))).sort((a, b) => a - b);
    return `${set.join(' / ')}mm`;
  }

  updateHardwareQty(item: HardwareItem, qty: number) {
    this.projectService.updateHardware({
      ...item,
      quantity: Number(qty)
    });
  }

  updateHardwareCost(item: HardwareItem, cost: number) {
    this.projectService.updateHardware({
      ...item,
      unitCost: Number(cost)
    });
  }

  async deleteHardwareItem(itemId: string) {
    const item = this.allHardware().find(h => h.id === itemId);
    const itemName = item ? `"${item.name}"` : 'este herraje';
    const confirmed = await this.confirmService.ask({
      title: '¿Eliminar herraje del presupuesto?',
      message: `Se eliminará ${itemName} del listado de herrajes y costos adicionales.`,
      confirmText: 'Eliminar Herraje',
      cancelText: 'Cancelar',
      severity: 'danger'
    });
    if (confirmed) {
      this.projectService.deleteHardware(itemId);
      this.excludedAutoHardwareIds.update(set => {
        const next = new Set(set);
        next.add(itemId);
        return next;
      });
    }
  }

  openAddHardware() {
    this.hardwareForm.reset({
      name: '',
      category: 'accessory',
      unit: 'und',
      quantity: 1,
      unitCost: 1.0,
      notes: ''
    });
    this.showAddHardwareModal.set(true);
  }

  saveHardware() {
    if (this.hardwareForm.invalid) return;
    const val = this.hardwareForm.value;

    const newItem: HardwareItem = {
      id: 'hw_' + crypto.randomUUID().slice(0, 8),
      name: String(val.name || '').trim(),
      category: val.category,
      unit: val.unit,
      quantity: Number(val.quantity),
      unitCost: Number(val.unitCost),
      notes: val.notes
    };

    this.projectService.addHardware(newItem);
    this.showAddHardwareModal.set(false);
  }

  /**
   * Asegura que la hoja formal de cotización esté visible en el DOM y abre la impresión PDF.
   */
  printQuote() {
    this.showClientQuotation.set(true);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  }

  format(amount: number): string {
    return formatCurrencyValue(amount, this.settings().currency);
  }

  setCurrency(event: Event) {
    const select = event.target as HTMLSelectElement | null;
    if (select && select.value) {
      this.projectService.updateCurrency(select.value);
    }
  }
}