import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZoneCabinetBuilderComponent } from './zone-cabinet-builder';
import {
  CabinetZoneNode,
  Material,
  ParametricCabinetConfig
} from '../../models/melamine.models';
import {
  CabinetGeneratorService,
  computeZoneBoundsLayout
} from '../../services/cabinet-generator.service';

const BUILDER_MATERIALS: Material[] = [
  {
    id: 'mat_blanco_15',
    name: 'Melamina Blanco Mate 15mm',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 145000,
    hasGrain: false,
    colorHex: '#f8fafc',
    category: 'board'
  },
  {
    id: 'mat_roble_18',
    name: 'Melamina Roble Natural 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    colorHex: '#c29b68',
    category: 'board'
  },
  {
    id: 'mat_mdf_3',
    name: 'Fondo MDF 3mm',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 35000,
    hasGrain: false,
    colorHex: '#e4e4e7',
    family: 'mdf_back',
    category: 'mdf'
  },
  {
    id: 'mat_cuarzo_calacatta',
    name: 'Cuarzo Calacatta Blanco 20mm',
    thickness: 20,
    sheetLength: 3000,
    sheetWidth: 1400,
    sheetCost: 980000,
    hasGrain: false,
    textureType: 'stone',
    colorHex: '#ffffff',
    category: 'stone'
  }
];

function createCustomZoneTreeConfig(): ParametricCabinetConfig {
  const tree: CabinetZoneNode = {
    id: 'zone_root',
    splitDirection: 'vertical',
    children: [
      {
        id: 'zone_col_1',
        splitDirection: 'none',
        exactSizeMm: 350,
        content: {
          type: 'shelves',
          shelvesCount: 2,
          shelfSetbackMm: 20
        }
      },
      {
        id: 'zone_col_2',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'drawers',
          drawers: {
            count: 3,
            frontMount: 'overlay',
            deductTopMm: 0,
            deductBottomMm: 0,
            deductLeftMm: 0,
            deductRightMm: 0,
            openingSystem: 'handle',
            slideType: 'telescopic',
            bottomType: 'grooved'
          }
        }
      }
    ]
  };

  return {
    id: 'mod_existing_1',
    code: 'MOD_EX1',
    name: 'Módulo Existente',
    moduleType: 'base_cabinet',
    category: 'custom',
    width: 900,
    height: 820,
    depth: 580,
    structureThickness: 18,
    doorThickness: 18,
    backThickness: 3,
    backType: 'groove',
    hasBackPanel: true,
    shelvesCount: 2,
    drawersCount: 3,
    doorOpening: 'none',
    structureMaterialId: 'mat_blanco_15',
    doorMaterialId: 'mat_roble_18',
    backMaterialId: 'mat_mdf_3',
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    facadeGap: 3,
    baseType: 'plinth',
    hasPlinth: true,
    plinthHeight: 80,
    posX: 450,
    posY: 410,
    posZ: 120,
    zoneTree: tree,
    highlightedZoneId: 'zone_col_2'
  };
}

describe('ZoneCabinetBuilderComponent: Paso A, Esquema 2D, Divisiones Recursivas, Contenidos y Live Sync', () => {
  let fixture: ComponentFixture<ZoneCabinetBuilderComponent>;
  let component: ZoneCabinetBuilderComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoneCabinetBuilderComponent],
      providers: [CabinetGeneratorService]
    }).compileComponents();

    fixture = TestBed.createComponent(ZoneCabinetBuilderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('materials', BUILDER_MATERIALS);
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function findButtonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(hostEl.querySelectorAll('button')).find(btn =>
      btn.textContent?.trim().includes(text)
    ) as HTMLButtonElement | undefined;
  }

  it('debe inicializar en estado limpio con zone_root vacío y filtrar piedras/MDF de boardMaterials', () => {
    expect(component.moduleName()).toBe('Módulo a Medida');
    expect(component.width()).toBe(800);
    expect(component.height()).toBe(800);
    expect(component.depth()).toBe(500);
    expect(component.baseType()).toBe('plinth');
    expect(component.backType()).toBe('groove');
    expect(component.zoneTree().id).toBe('zone_root');
    expect(component.selectedZoneId()).toBe('zone_root');

    const boardIds = component.boardMaterials().map(m => m.id);
    expect(boardIds).toContain('mat_blanco_15');
    expect(boardIds).toContain('mat_roble_18');
    expect(boardIds).not.toContain('mat_cuarzo_calacatta');
    expect(boardIds).not.toContain('mat_mdf_3');
  });

  it('debe hidratar initialConfig preservando id, coordenadas, base, trasera, zoneTree y highlightedZoneId', () => {
    const existing = createCustomZoneTreeConfig();
    const highlightedEvents: (string | null)[] = [];
    component.highlightedZoneChange.subscribe(id => highlightedEvents.push(id));

    fixture.componentRef.setInput('editingGroupId', 'grp_existing_1');
    fixture.componentRef.setInput('initialConfig', existing);
    fixture.detectChanges();

    expect(component.moduleName()).toBe('Módulo Existente');
    expect(component.width()).toBe(900);
    expect(component.height()).toBe(820);
    expect(component.depth()).toBe(580);
    expect(component.structureThickness()).toBe(18);
    expect(component.useSameMaterialForDoors()).toBe(false);
    expect(component.doorMaterialId()).toBe('mat_roble_18');
    expect(component.totalLeafZonesCount()).toBe(2);
    expect(component.selectedZoneId()).toBe('zone_col_2');
    expect(highlightedEvents[highlightedEvents.length - 1]).toBe('zone_col_2');

    const snap = component.currentConfig();
    expect(snap.id).toBe('mod_existing_1');
    expect(snap.posX).toBe(450);
    expect(snap.posY).toBe(410);
    expect(snap.posZ).toBe(120);
  });

  it('debe actualizar Paso A (dimensiones, espesor, base patas/zócalo/sin base, trasera, material) emitiendo configLiveChange', () => {
    const liveSnapshots: ParametricCabinetConfig[] = [];
    component.configLiveChange.subscribe(cfg => liveSnapshots.push(cfg));

    const nameInput = hostEl.querySelector('#zcb-module-name') as HTMLInputElement;
    nameInput.value = 'Armario Estudio';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.moduleName()).toBe('Armario Estudio');

    const widthInput = hostEl.querySelector('#zcb-width') as HTMLInputElement;
    widthInput.value = '1200';
    widthInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.width()).toBe(1200);

    // Clamping en change fuera de rango
    const depthInput = hostEl.querySelector('#zcb-depth') as HTMLInputElement;
    depthInput.value = '50';
    depthInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.depth()).toBe(120);

    findButtonByText('18 mm')?.click();
    fixture.detectChanges();
    expect(component.structureThickness()).toBe(18);

    findButtonByText('Patas')?.click();
    fixture.detectChanges();
    expect(component.baseType()).toBe('legs');
    expect(component.plinthHeight()).toBeGreaterThanOrEqual(50);

    findButtonByText('Sin zócalo')?.click();
    fixture.detectChanges();
    expect(component.baseType()).toBe('none');

    findButtonByText('Rebajado')?.click();
    fixture.detectChanges();
    expect(component.backType()).toBe('rebate');

    component.toggleUseSameMaterialForDoors();
    fixture.detectChanges();
    expect(component.useSameMaterialForDoors()).toBe(false);

    const doorMatSelect = hostEl.querySelector('#zcb-door-material') as HTMLSelectElement | null;
    expect(doorMatSelect).toBeTruthy();
    doorMatSelect!.value = 'mat_roble_18';
    doorMatSelect!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.doorMaterialId()).toBe('mat_roble_18');

    expect(liveSnapshots.length).toBeGreaterThanOrEqual(6);
    const latest = liveSnapshots[liveSnapshots.length - 1];
    expect(latest.name).toBe('Armario Estudio');
    expect(latest.width).toBe(1200);
    expect(latest.structureThickness).toBe(18);
    expect(latest.baseType).toBe('none');
    expect(latest.backType).toBe('rebate');
    expect(latest.doorMaterialId).toBe('mat_roble_18');
  });

  it('debe dividir zonas vertical/horizontalmente, emitir highlightedZoneChange al seleccionar en esquema 2D, editar medida exacta y liberar', () => {
    const highlightedIds: (string | null)[] = [];
    const liveConfigs: ParametricCabinetConfig[] = [];
    component.highlightedZoneChange.subscribe(id => highlightedIds.push(id));
    component.configLiveChange.subscribe(cfg => liveConfigs.push(cfg));

    // División vertical 2 columnas -> luego 3 columnas
    const addVertBtn = hostEl.querySelector(
      'button[aria-label="Agregar división vertical"]'
    ) as HTMLButtonElement;
    expect(addVertBtn).toBeTruthy();
    addVertBtn.click();
    fixture.detectChanges();

    expect(component.zoneTree().splitDirection).toBe('vertical');
    expect(component.zoneTree().children?.length).toBe(2);
    expect(component.totalLeafZonesCount()).toBe(2);

    addVertBtn.click();
    fixture.detectChanges();
    expect(component.zoneTree().children?.length).toBe(3);

    // Quitar una columna -> vuelve a 2
    const removeVertBtn = hostEl.querySelector(
      'button[aria-label="Quitar división vertical"]'
    ) as HTMLButtonElement;
    removeVertBtn.click();
    fixture.detectChanges();
    expect(component.zoneTree().children?.length).toBe(2);

    // Seleccionar la primera zona hija desde el esquema 2D
    const leafButtons = Array.from(
      hostEl.querySelectorAll('.zcb-carcass-frame [role="button"][aria-label^="Zona "]')
    ) as HTMLElement[];
    expect(leafButtons.length).toBe(2);
    leafButtons[0].click();
    fixture.detectChanges();

    const col1Id = component.zoneTree().children![0].id;
    expect(component.selectedZoneId()).toBe(col1Id);
    expect(highlightedIds).toContain(col1Id);
    expect(component.breadcrumbs().map(b => b.label)).toEqual(['Raíz', 'Col. 1']);

    // Fijar Medida Exacta (mm) en Col. 1 y verificar rebalanceo automático de Col. 2
    const exactInput = hostEl.querySelector('#zcb-exact-size') as HTMLInputElement | null;
    expect(exactInput).toBeTruthy();
    exactInput!.value = '300';
    exactInput!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.selectedZoneNode().exactSizeMm).toBe(300);
    const layoutAfterExact = computeZoneBoundsLayout(component.currentConfig());
    expect(layoutAfterExact.children[0].innerWidth).toBe(300);
    const expectedSiblingW = layoutAfterExact.innerWidth - 300 - component.structureThickness();
    expect(layoutAfterExact.children[1].innerWidth).toBeCloseTo(expectedSiblingW, 1);

    // Liberar medida exacta vuelve a proporción automática
    const releaseBtn = findButtonByText('Liberar');
    expect(releaseBtn).toBeTruthy();
    releaseBtn!.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().exactSizeMm).toBeUndefined();

    // Subdividir Col. 1 horizontalmente en 2 niveles
    const addHorizBtn = hostEl.querySelector(
      'button[aria-label="Agregar división horizontal"]'
    ) as HTMLButtonElement;
    addHorizBtn.click();
    fixture.detectChanges();

    expect(component.selectedZoneNode().splitDirection).toBe('horizontal');
    expect(component.totalLeafZonesCount()).toBe(3);

    // Botón Padre vuelve al nodo raíz
    const parentBtn = findButtonByText('Padre');
    expect(parentBtn).toBeTruthy();
    parentBtn!.click();
    fixture.detectChanges();
    expect(component.selectedZoneId()).toBe('zone_root');
    expect(liveConfigs.length).toBeGreaterThan(0);
  });

  it('debe asignar los 5 tipos de contenido (empty, shelves, drawers, doors, hanging_rod) y puertas de bloque', () => {
    // 1. Repisas móviles con ajuste de cantidad y remetida
    findButtonByText('Repisas Móviles')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.type).toBe('shelves');
    expect(component.selectedZoneNode().content?.shelvesCount).toBe(2);

    const incShelves = hostEl.querySelector('button[aria-label="Aumentar repisas"]') as HTMLButtonElement;
    incShelves.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.shelvesCount).toBe(3);

    const setbackInput = hostEl.querySelector('#zcb-shelf-setback') as HTMLInputElement;
    setbackInput.value = '35';
    setbackInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.shelfSetbackMm).toBe(35);

    // 2. Cajonera (1..6, overlay/inset, apertura, corredera, fondo, descuentos)
    findButtonByText('Cajonera')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.type).toBe('drawers');

    component.setDrawersCount(5);
    component.setDrawerFrontMount('inset');
    component.setDrawerOpeningSystem('finger_pull');
    component.setDrawerSlideType('undermount');
    component.setDrawerBottomType('nailed');
    fixture.detectChanges();

    const deductTop = hostEl.querySelector('#zcb-deduct-top') as HTMLInputElement;
    deductTop.value = '12';
    deductTop.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const drawerCfg = component.selectedZoneNode().content?.drawers;
    expect(drawerCfg?.count).toBe(5);
    expect(drawerCfg?.frontMount).toBe('inset');
    expect(drawerCfg?.openingSystem).toBe('finger_pull');
    expect(drawerCfg?.slideType).toBe('undermount');
    expect(drawerCfg?.bottomType).toBe('nailed');
    expect(drawerCfg?.deductTopMm).toBe(12);

    // Cambiar a push sincroniza slideType a push_open
    component.setDrawerOpeningSystem('push');
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.drawers?.slideType).toBe('push_open');

    // 3. Puertas (left/right/double/sliding, mount, tirador, equipamiento interior)
    findButtonByText('Puertas')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.type).toBe('doors');

    component.setDoorOpening('sliding');
    component.setDoorMount('inset');
    component.setDoorHasHandle(false);
    component.setInteriorHangingRodsForDoor(1);
    fixture.detectChanges();

    const doorContent = component.selectedZoneNode().content;
    expect(doorContent?.doors?.opening).toBe('sliding');
    expect(doorContent?.doors?.mount).toBe('inset');
    expect(doorContent?.doors?.hasHandle).toBe(false);
    expect(doorContent?.hangingRodsCount).toBe(1);

    // 4. Barra colgadora (1 y 2 barras)
    findButtonByText('Barra Colgadora')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.type).toBe('hanging_rod');
    component.setHangingRodsCount(2);
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.hangingRodsCount).toBe(2);

    // 5. Vacío / Nicho
    findButtonByText('Vacío / Nicho')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.type).toBe('empty');

    // 6. Puertas sobre contenedor dividido
    component.adjustSplit('vertical', 1);
    fixture.detectChanges();
    findButtonByText('Puertas bloque')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content?.type).toBe('doors');
  });

  it('debe soportar Retroceder un nivel, Limpiar Zona, Confirmar Módulo en Escena y Cancelar', () => {
    const confirmedPayloads: ParametricCabinetConfig[] = [];
    let cancelledCalls = 0;
    component.confirmed.subscribe(cfg => confirmedPayloads.push(cfg));
    component.cancelled.subscribe(() => {
      cancelledCalls += 1;
    });

    const undoBtn = findButtonByText('Retroceder un nivel')!;
    expect(undoBtn.disabled).toBe(true);

    component.adjustSplit('vertical', 1);
    component.setSelectedZoneContentType('doors');
    fixture.detectChanges();
    expect(component.zoneHistory().length).toBe(2);
    expect(undoBtn.disabled).toBe(false);

    // Retroceder un nivel revierte la asignación de puertas en bloque
    undoBtn.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().content).toBeUndefined();
    expect(component.selectedZoneNode().splitDirection).toBe('vertical');

    // Limpiar Zona elimina subdivisiones y deja la zona vacía
    findButtonByText('Limpiar Zona')?.click();
    fixture.detectChanges();
    expect(component.selectedZoneNode().splitDirection).toBe('none');
    expect(component.selectedZoneNode().content?.type).toBe('empty');

    // Confirmar emite el snapshot final con zoneTree
    findButtonByText('Confirmar Módulo en Escena')?.click();
    fixture.detectChanges();
    expect(confirmedPayloads.length).toBe(1);
    expect(confirmedPayloads[0].zoneTree).toBeDefined();
    expect(confirmedPayloads[0].width).toBe(component.width());

    // Cancelar emite cancelled
    findButtonByText('Cancelar')?.click();
    fixture.detectChanges();
    expect(cancelledCalls).toBe(1);
  });
});
