import { TestBed } from '@angular/core/testing';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ModuleDesignerComponent } from './module-designer';
import { Part } from '../../models/melamine.models';

describe('Gestión de Repisas Internas y Cotas de Luz en ModuleDesigner', () => {
  let component: ModuleDesignerComponent;
  let projectService: ProjectStorageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [ProjectStorageService]
    }).compileComponents();

    projectService = TestBed.inject(ProjectStorageService);
    const fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
  });

  const createTestModule = (): Part[] => {
    const groupId = 'module-1';
    // Módulo de 800mm alto x 600mm ancho x 400mm prof, tableros de 18mm
    // Piso: posY = 9, sy = 18, sx = 564, sz = 400 (top face at 18mm)
    const floor: Part = {
      id: 'floor-1',
      name: 'Piso',
      componentRole: 'bottom',
      groupId,
      length: 564,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_18',
      materialName: 'Blanco 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 9,
      posZ: 0,
      orientation: 'horizontal'
    };

    // Techo: posY = 791, sy = 18, sx = 564, sz = 400 (bottom face at 782mm)
    const roof: Part = {
      id: 'roof-1',
      name: 'Techo',
      componentRole: 'top',
      groupId,
      length: 564,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_18',
      materialName: 'Blanco 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 791,
      posZ: 0,
      orientation: 'horizontal'
    };

    // Lateral Izquierdo: posX = -291, sx = 18, sy = 800 (inner face at -282mm)
    const sideLeft: Part = {
      id: 'side-l',
      name: 'Lateral Izquierdo',
      componentRole: 'side_left',
      groupId,
      length: 800,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_18',
      materialName: 'Blanco 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: -291,
      posY: 400,
      posZ: 0,
      orientation: 'vertical_yz'
    };

    // Lateral Derecho: posX = 291, sx = 18, sy = 800 (inner face at +282mm)
    const sideRight: Part = {
      id: 'side-r',
      name: 'Lateral Derecho',
      componentRole: 'side_right',
      groupId,
      length: 800,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_18',
      materialName: 'Blanco 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: 291,
      posY: 400,
      posZ: 0,
      orientation: 'vertical_yz'
    };

    // Repisa 1: en posY = 260 (thickness 18, bottom at 251, top at 269)
    const shelf1: Part = {
      id: 'shelf-1',
      name: 'Repisa 1',
      componentRole: 'shelf',
      groupId,
      length: 564,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_18',
      materialName: 'Blanco 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 260,
      posZ: 0,
      orientation: 'horizontal'
    };

    // Repisa 2: en posY = 520 (thickness 18, bottom at 511, top at 529)
    const shelf2: Part = {
      id: 'shelf-2',
      name: 'Repisa 2',
      componentRole: 'shelf',
      groupId,
      length: 564,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_white_18',
      materialName: 'Blanco 18mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 520,
      posZ: 0,
      orientation: 'horizontal'
    };

    return [floor, roof, sideLeft, sideRight, shelf1, shelf2];
  };

  const setTestParts = (parts: Part[]) => {
    projectService.updateProject(p => ({ ...p, parts }), false);
  };

  describe('1. Detección de Selección de Repisa Interna (isInternalShelfSelected)', () => {
    it('debe devolver false si no hay piezas seleccionadas', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set(null);
      expect(component.isInternalShelfSelected()).toBe(false);
    });

    it('debe devolver false si la pieza no tiene groupId', () => {
      const looseShelf: Part = {
        id: 'loose-shelf',
        name: 'Repisa Suelta',
        componentRole: 'shelf',
        length: 500,
        width: 300,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 100,
        posZ: 0,
        orientation: 'horizontal'
      };
      setTestParts([looseShelf]);
      component.selectedPartId.set('loose-shelf');
      expect(component.isInternalShelfSelected()).toBe(false);
    });

    it('debe devolver false si se selecciona un lateral o piso', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('floor-1');
      expect(component.isInternalShelfSelected()).toBe(false);

      component.selectedPartId.set('side-l');
      expect(component.isInternalShelfSelected()).toBe(false);
    });

    it('debe devolver true cuando se selecciona una repisa interna de un módulo', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');
      expect(component.isInternalShelfSelected()).toBe(true);
    });

    it('debe devolver true si el nombre contiene "repisa" o "entrepaño" aunque no tenga role explícito', () => {
      const parts = createTestModule();
      const namedShelf: Part = {
        ...parts[4],
        id: 'named-shelf',
        name: 'Entrepaño Móvil',
        componentRole: undefined
      };
      setTestParts([...parts, namedShelf]);
      component.selectedPartId.set('named-shelf');
      expect(component.isInternalShelfSelected()).toBe(true);
    });
  });

  describe('2. Ajuste Numérico de Luz Inferior (onShelfBottomClearanceChange)', () => {
    it('debe recalcular la posición posY de la repisa al cambiar la luz inferior', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Cambiar luz inferior a 300mm
      // Obstáculo inferior: Piso (top face = 18mm).
      // Nueva cara inferior repisa = 18 + 300 = 318mm.
      // Nueva posY repisa = 318 + 9 = 327mm.
      component.onShelfBottomClearanceChange(300);

      const updatedShelf = projectService.partsList().find((p: Part) => p.id === 'shelf-1');
      expect(updatedShelf).toBeDefined();
      expect(updatedShelf!.posY).toBe(327);
    });

    it('debe aplicar clamping para evitar colisión contra la repisa o techo superior', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Intentar forzar una luz inferior de 600mm (chocaría con Repisa 2 cuya cara inferior está en 511mm)
      // Con minGap de 40mm: cara superior máx = 511 - 40 = 471mm.
      // posY máx = 471 - 9 = 462mm.
      component.onShelfBottomClearanceChange(600);

      const updatedShelf = projectService.partsList().find((p: Part) => p.id === 'shelf-1');
      expect(updatedShelf).toBeDefined();
      expect(updatedShelf!.posY).toBeLessThanOrEqual(462);
    });

    it('debe aplicar clamping para evitar colisión contra el piso si se introduce luz inferior = 0', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Intentar forzar luz inferior = 0mm (chocaría contra el piso en 18mm)
      // Con minGap de 40mm: cara inferior mín = 18 + 40 = 58mm.
      // posY mín = 58 + 9 = 67mm.
      component.onShelfBottomClearanceChange(0);

      const updatedShelf = projectService.partsList().find((p: Part) => p.id === 'shelf-1');
      expect(updatedShelf).toBeDefined();
      expect(updatedShelf!.posY).toBeGreaterThanOrEqual(67);
    });
  });

  describe('3. Ajuste Numérico de Luz Superior (onShelfTopClearanceChange)', () => {
    it('debe recalcular la posición posY de la repisa al cambiar la luz superior', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Obstáculo superior: Repisa 2 (bottom face at 511mm).
      // Si fijamos luz superior a 200mm:
      // Cara superior de Repisa 1 = 511 - 200 = 311mm.
      // posY Repisa 1 = 311 - 9 = 302mm.
      component.onShelfTopClearanceChange(200);

      const updatedShelf = projectService.partsList().find((p: Part) => p.id === 'shelf-1');
      expect(updatedShelf).toBeDefined();
      expect(updatedShelf!.posY).toBe(302);
    });

    it('debe aplicar clamping para evitar colisión contra el obstáculo superior si se introduce luz superior = 0', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Obstáculo superior: Repisa 2 (bottom face at 511mm).
      // Con minGap de 40mm: cara superior máx = 511 - 40 = 471mm.
      // posY máx = 471 - 9 = 462mm.
      component.onShelfTopClearanceChange(0);

      const updatedShelf = projectService.partsList().find((p: Part) => p.id === 'shelf-1');
      expect(updatedShelf).toBeDefined();
      expect(updatedShelf!.posY).toBeLessThanOrEqual(462);
    });
  });

  describe('4. Centrado en el Vano (centerShelfInBay)', () => {
    it('debe posicionar la repisa exactamente a la mitad entre el obstáculo inferior y superior', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Obstáculo inferior: Piso (top face = 18mm)
      // Obstáculo superior: Repisa 2 (bottom face = 511mm)
      // Centro exacto = (18 + 511) / 2 = 264.5mm (redondeado a 265mm)
      component.centerShelfInBay();

      const updatedShelf = projectService.partsList().find((p: Part) => p.id === 'shelf-1');
      expect(updatedShelf).toBeDefined();
      expect(Math.round(updatedShelf!.posY!)).toBe(265);
    });
  });

  describe('5. Distribución Equitativa de Repisas (distributeModuleShelvesEqually)', () => {
    it('debe repartir uniformemente todas las repisas del vano en una sola llamada atómica', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');

      // Vano total:
      // Cara superior de Piso = 18mm
      // Cara inferior de Techo = 782mm
      // Vano total disponible = 782 - 18 = 764mm
      // 2 repisas de 18mm = 36mm total espesor repisas
      // Espacio libre total para los 3 huecos = 764 - 36 = 728mm
      // Cada hueco debe medir = 728 / 3 = 242.67mm (aprox 243mm)
      component.distributeModuleShelvesEqually();

      const parts = projectService.partsList();
      const shelf1 = parts.find((p: Part) => p.id === 'shelf-1')!;
      const shelf2 = parts.find((p: Part) => p.id === 'shelf-2')!;

      // Hueco 1: piso (18) a shelf1 bottom (posY - 9)
      const gap1 = (shelf1.posY! - 9) - 18;
      // Hueco 2: shelf1 top (posY + 9) a shelf2 bottom (posY - 9)
      const gap2 = (shelf2.posY! - 9) - (shelf1.posY! + 9);
      // Hueco 3: shelf2 top (posY + 9) a techo bottom (782)
      const gap3 = 782 - (shelf2.posY! + 9);

      // Los 3 huecos deben ser prácticamente idénticos (diferencia <= 2mm por redondeo entero)
      expect(Math.abs(gap1 - gap2)).toBeLessThanOrEqual(2);
      expect(Math.abs(gap2 - gap3)).toBeLessThanOrEqual(2);
      expect(Math.abs(gap1 - gap3)).toBeLessThanOrEqual(2);
    });

    it('debe soportar módulos con amarres (ties) en lugar de tapa superior sólida', () => {
      const parts = createTestModule().filter(p => p.id !== 'roof-1');
      const tieFront: Part = {
        id: 'tie-front',
        name: 'Amarre Frontal',
        componentRole: 'tie',
        groupId: 'module-1',
        length: 564,
        width: 100,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 791,
        posZ: 150,
        orientation: 'horizontal'
      };
      setTestParts([...parts, tieFront]);
      component.selectedPartId.set('shelf-1');

      component.distributeModuleShelvesEqually();
      const updatedParts = projectService.partsList();
      const s1 = updatedParts.find((p: Part) => p.id === 'shelf-1')!;
      const s2 = updatedParts.find((p: Part) => p.id === 'shelf-2')!;

      expect(s1.posY).toBeGreaterThan(18);
      expect(s2.posY).toBeGreaterThan(s1.posY!);
      expect(s2.posY).toBeLessThan(782);
    });
  });

  describe('6. Cálculo Reactivo de effectiveClearanceInfo', () => {
    it('debe computar las cotas de luz libre incluso si el visor 3D no ha emitido evento', () => {
      setTestParts(createTestModule());
      component.selectedPartId.set('shelf-1');
      component.clearanceInfo.set(null);

      const clr = component.effectiveClearanceInfo();
      expect(clr).not.toBeNull();
      // Shelf 1 bottom face is 251, floor top is 18 => 251 - 18 = 233mm
      expect(clr!.bottomClearance).toBe(233);
      // Shelf 1 top face is 269, Shelf 2 bottom is 511 => 511 - 269 = 242mm
      expect(clr!.topClearance).toBe(242);
    });
  });
});
