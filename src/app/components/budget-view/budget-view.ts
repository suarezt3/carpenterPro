import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProjectStorageService, formatCurrencyValue } from '../../services/project-storage.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { HardwareItem, Material } from '../../models/melamine.models';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-budget-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './budget-view.html'
})
export class BudgetViewComponent {
  private projectService = inject(ProjectStorageService);
  private confirmService = inject(ConfirmDialogService);
  private optimizer = inject(CutOptimizerService);
  private fb = inject(FormBuilder);

  readonly project = this.projectService.currentProject;
  readonly materials = this.projectService.materialsList;
  readonly hardware = this.projectService.hardwareList;
  readonly settings = this.projectService.projectSettings;

  showAddHardwareModal = signal<boolean>(false);
  showClientQuotation = signal<boolean>(false);

  hardwareForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    category: ['accessory', Validators.required],
    unit: ['und', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitCost: [1.0, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  // Calculate optimization result for sheets count & edges
  readonly optResult = computed(() => {
    return this.optimizer.optimizeProject(
      this.projectService.partsList(),
      this.materials(),
      this.settings()
    );
  });

  // Sheets cost breakdown grouped by material
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

  // Edge banding cost breakdown
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

  // Hardware total cost
  readonly hardwareCostTotal = computed(() => {
    return this.hardware().reduce((sum, h) => sum + (h.quantity * h.unitCost), 0);
  });

  // Direct materials cost
  readonly totalMaterialsCost = computed(() => {
    return (
      this.sheetsCostBreakdown().totalSheetsCost +
      this.edgesCostBreakdown().totalEdgeCost +
      this.hardwareCostTotal()
    );
  });

  // Labor cost
  readonly laborTotal = computed(() => {
    const p = this.project();
    if (p.laborType === 'percent') {
      return (this.totalMaterialsCost() * (p.laborCost / 100));
    }
    return p.laborCost;
  });

  // Production Cost (Materials + Labor)
  readonly productionCost = computed(() => {
    return this.totalMaterialsCost() + this.laborTotal();
  });

  // Profit Margin
  readonly profitAmount = computed(() => {
    const margin = this.project().profitMarginPercent;
    return this.productionCost() * (margin / 100);
  });

  // Subtotal before tax
  readonly subtotalBeforeTax = computed(() => {
    return this.productionCost() + this.profitAmount();
  });

  // Tax amount
  readonly taxAmount = computed(() => {
    const tax = this.project().taxPercent;
    return this.subtotalBeforeTax() * (tax / 100);
  });

  // Final Suggested Client Price
  readonly finalClientPrice = computed(() => {
    return this.subtotalBeforeTax() + this.taxAmount();
  });

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
      name: val.name,
      category: val.category,
      unit: val.unit,
      quantity: Number(val.quantity),
      unitCost: Number(val.unitCost),
      notes: val.notes
    };

    this.projectService.addHardware(newItem);
    this.showAddHardwareModal.set(false);
  }

  printQuote() {
    window.print();
  }

  format(amount: number): string {
    return formatCurrencyValue(amount, this.settings().currency);
  }

  setCurrency(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select && select.value) {
      this.projectService.updateCurrency(select.value);
    }
  }
}
