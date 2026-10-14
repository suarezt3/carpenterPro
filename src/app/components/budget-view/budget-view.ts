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
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';
import { HardwareItem, Material } from '../../models/melamine.models';

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
  readonly settings = this.projectService.projectSettings;

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
   * Costo total de herrajes, correderas, bisagras y tornillería.
   */
  readonly hardwareCostTotal = computed(() => {
    return this.hardware().reduce((sum, h) => sum + (h.quantity * h.unitCost), 0);
  });

  /**
   * Electrodomésticos y equipamiento 3D incluidos en la cotización.
   */
  readonly appliances = computed(() => this.projectService.appliancesList());
  readonly appliancesBudgetList = computed(() => this.appliances().filter(a => a.includeInBudget));
  readonly appliancesCostTotal = computed(() => {
    return this.appliancesBudgetList().reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  });

  /**
   * Costo directo de materiales de carpintería (Tableros + Tapacantos + Herrajes).
   */
  readonly totalMaterialsCost = computed(() => {
    return (
      this.sheetsCostBreakdown().totalSheetsCost +
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
    this.projectService.updateMaterial({
      ...material,
      sheetCost: Number(newCost)
    });
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
    const item = this.hardware().find(h => h.id === itemId);
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