import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Furniture3dViewerComponent, DimensionBadgeUserData } from './furniture-3d-viewer';
import { ProjectStorageService } from '../../services/project-storage.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { Part, PartGroup, ModuleCavityInfo } from '../../models/melamine.models';
import {
  DIMENSION_LINE_RENDER_ORDER,
  DIMENSION_SPRITE_RENDER_ORDER
} from '../../services/dimension-anchor-3d.service';
import * as THREE from 'three';

describe('Furniture3dViewerComponent - Cotas 3D HD, Edición Inline y Tirantes CAD', () => {
  let component: Furniture3dViewerComponent;
  let projectStorage: ProjectStorageService;
  let partGeometry: PartGeometryService;

  const testShelf: Part = {
    id: 'shelf-1',
    name: 'Repisa Central',
    componentRole: 'shelf',
    groupId: 'mod-1',
    length: 764,
    width: 380,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-1',
    materialName: 'Blanco 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 350,
    posZ: 0,
    orientation: 'horizontal'
  };

  const testFloor: Part = {
    id: 'floor-1',
    name: 'Piso',
    componentRole: 'bottom',
    groupId: 'mod-1',
    length: 764,
    width: 380,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-1',
    materialName: 'Blanco 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 9,
    posZ: 0,
    orientation: 'horizontal'
  };

  const testRoof: Part = {
    id: 'roof-1',
    name: 'Techo',
    componentRole: 'top',
    groupId: 'mod-1',
    length: 764,
    width: 380,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-1',
    materialName: 'Blanco 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 791,
    posZ: 0,
    orientation: 'horizontal'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [ProjectStorageService, PartGeometryService]
    });

    projectStorage = TestBed.inject(ProjectStorageService);
    partGeometry = TestBed.inject(PartGeometryService);
    const fixture = TestBed.createComponent(Furniture3dViewerComponent);
    component = fixture.componentInstance;
  });

  describe('1. Rediseño Visual HD y Canvas Textures para Cotas 3D', () => {
    it('debe generar CanvasTexture de alta resolución (512x136) con LinearFilter y sin mipmaps', () => {
      const sprite = (component as unknown as { createTextSprite: (t: string) => THREE.Sprite }).createTextSprite('800 mm');
      expect(sprite).toBeDefined();
      expect(sprite.isSprite).toBe(true);

      const mat = sprite.material;
      expect(mat.map).toBeDefined();
      const texture = mat.map!;
      expect(texture.minFilter).toBe(THREE.LinearFilter);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.generateMipmaps).toBe(false);

      const canvas = texture.image as HTMLCanvasElement;
      expect(canvas.width).toBe(512);
      expect(canvas.height).toBe(136);
    });

    it('debe registrar materiales idle y hover en userData del Sprite para resaltar el borde al pasar el cursor', () => {
      const sprite = (component as unknown as { createClearanceSprite: (t: string) => THREE.Sprite }).createClearanceSprite('↕ 334 mm');
      expect(sprite.userData['idleMaterial']).toBeDefined();
      expect(sprite.userData['hoverMaterial']).toBeDefined();
      expect(sprite.userData['idleMaterial']).not.toBe(sprite.userData['hoverMaterial']);

      // Simular hover sobre la cota
      (component as unknown as { setHoveredDimensionSprite: (s: THREE.Sprite | null) => void }).setHoveredDimensionSprite(sprite);
      expect(sprite.material).toBe(sprite.userData['hoverMaterial']);
      expect(sprite.userData['isHovered']).toBe(true);

      // Simular unhover
      (component as unknown as { setHoveredDimensionSprite: (s: THREE.Sprite | null) => void }).setHoveredDimensionSprite(null);
      expect(sprite.material).toBe(sprite.userData['idleMaterial']);
      expect(sprite.userData['isHovered']).toBe(false);
    });

    it('debe centrar el texto sin dibujar el icono de edición cuando showEditIndicator es false (ej. cotas de ancho útil)', () => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arcTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetY: 0,
        lineCap: '',
        lineJoin: ''
      } as unknown as CanvasRenderingContext2D;
      vi.spyOn(ctx, 'fillText');

      (component as unknown as {
        drawEnterprisePillBadge: (
          ctx: CanvasRenderingContext2D,
          w: number,
          h: number,
          text: string,
          color: string,
          hover: boolean,
          edit: boolean
        ) => void;
      }).drawEnterprisePillBadge(ctx, 512, 136, '↔ 570 mm', '#10b981', false, false);

      expect(ctx.fillText).toHaveBeenCalledWith('↔ 570 mm', 256, 69);
    });

    it('createClearanceSprite con isEditable=false debe generar material no editable reutilizado para hover', () => {
      const sprite = (component as unknown as { createClearanceSprite: (t: string, e: boolean) => THREE.Sprite }).createClearanceSprite('↔ 400 mm', false);
      expect(sprite.userData['idleMaterial']).toBeDefined();
      expect(sprite.userData['hoverMaterial']).toBe(sprite.userData['idleMaterial']);
    });
  });

  describe('2. Edición Directa con Clic sobre Cotas 3D (Inline Dimension Editor)', () => {
    it('debe abrir el editor inline proyectando coordenadas 3D a pantalla con su valor actual', () => {
      const sprite = new THREE.Sprite();
      sprite.position.set(0, 350, 200);

      const badgeData: DimensionBadgeUserData = {
        isDimensionBadge: true,
        badgeType: 'bottom_clearance',
        part: testShelf,
        currentValue: 323,
        label: 'Luz Inferior',
        referenceY: 18
      };

      // Mock de cámara y canvas para proyección 2D
      vi.spyOn(component as unknown as { projectWorldToScreen: (v: THREE.Vector3) => { x: number; y: number } | null }, 'projectWorldToScreen')
        .mockReturnValue({ x: 420, y: 280 });

      component.openInlineDimensionEditor(sprite, badgeData);

      const editor = component.inlineDimensionEditor();
      expect(editor).not.toBeNull();
      expect(editor!.x).toBe(420);
      expect(editor!.y).toBe(280);
      expect(editor!.value).toBe(323);
      expect(editor!.propType).toBe('bottom_clearance');
      expect(editor!.label).toBe('Luz Inferior');
      expect(editor!.referenceY).toBe(18);
    });

    it('al editar Luz Inferior con 250 mm debe posicionar la repisa exactamente a 250 mm del piso', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testFloor, testShelf, testRoof]);
      fixture.detectChanges();

      const emitSpy = vi.spyOn(comp.partModified, 'emit');
      const storageSpy = vi.spyOn(projectStorage, 'updatePart');

      comp.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 323,
        propType: 'bottom_clearance',
        part: testShelf,
        label: 'Luz Inferior',
        referenceY: 18, // Top of floor panel is at Y=18
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      comp.confirmInlineDimension('250');

      // targetPosY = referenceY(18) + numVal(250) + halfThick(9) = 277 mm
      expect(storageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shelf-1', posY: 277 }),
        true
      );
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ updates: { posY: 277 } })
      );
      expect(comp.inlineDimensionEditor()).toBeNull();
    });

    it('al editar Luz Superior con 200 mm debe posicionar la repisa exactamente a 200 mm del techo', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testFloor, testShelf, testRoof]);
      fixture.detectChanges();

      const storageSpy = vi.spyOn(projectStorage, 'updatePart');

      comp.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 423,
        propType: 'top_clearance',
        part: testShelf,
        label: 'Luz Superior',
        referenceY: 782, // Bottom of roof panel is at Y=782
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      comp.confirmInlineDimension('200');

      // targetPosY = referenceY(782) - numVal(200) - halfThick(9) = 573 mm
      expect(storageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shelf-1', posY: 573 }),
        true
      );
    });

    it('debe limpiar cadenas con sufijo "mm" o espacios (" 250 mm ") correctamente', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testFloor, testShelf, testRoof]);
      fixture.detectChanges();

      const storageSpy = vi.spyOn(projectStorage, 'updatePart');

      comp.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 323,
        propType: 'bottom_clearance',
        part: testShelf,
        label: 'Luz Inferior',
        referenceY: 18,
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      comp.confirmInlineDimension(' 250 mm ');

      expect(storageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ posY: 277 }),
        true
      );
    });

    it('debe admitir números con coma decimal ("250,5 mm") redondeando al milímetro más cercano', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testFloor, testShelf, testRoof]);
      fixture.detectChanges();

      const storageSpy = vi.spyOn(projectStorage, 'updatePart');

      comp.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 323,
        propType: 'bottom_clearance',
        part: testShelf,
        label: 'Luz Inferior',
        referenceY: 18,
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      comp.confirmInlineDimension(' 250,5 mm ');

      // numVal = round(250.5) = 251. targetPosY = 18 + 251 + 9 = 278 mm
      expect(storageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ posY: 278 }),
        true
      );
    });

    it('al editar Largo o Ancho debe actualizar la dimensión física exacta en mm', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testShelf]);
      fixture.detectChanges();

      const storageSpy = vi.spyOn(projectStorage, 'updatePart');

      comp.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 764,
        propType: 'length',
        part: testShelf,
        label: 'Largo',
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      comp.confirmInlineDimension('850');

      expect(storageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shelf-1', length: 850 }),
        true
      );
    });

    it('al presionar Escape o cancelar debe cerrar el editor sin modificar la pieza', () => {
      const storageSpy = vi.spyOn(projectStorage, 'updatePart');

      component.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 764,
        propType: 'length',
        part: testShelf,
        label: 'Largo',
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      component.cancelInlineDimension();

      expect(component.inlineDimensionEditor()).toBeNull();
      expect(storageSpy).not.toHaveBeenCalled();
    });

    it('al presionar Escape en el visor (handleViewerKeyDown) debe cerrar el inlineDimensionEditor prioritariamente', () => {
      component.inlineDimensionEditor.set({
        x: 100,
        y: 100,
        value: 764,
        propType: 'length',
        part: testShelf,
        label: 'Largo',
        worldPos: new THREE.Vector3(0, 350, 0)
      });

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleViewerKeyDown(escapeEvent);

      expect(component.inlineDimensionEditor()).toBeNull();
    });
  });

  describe('3. Rediseño CAD Moderno de Tirantes (Handles)', () => {
    it('debe crear tirantes estilizados de borde (CapsuleGeometry) y esquinas (SphereGeometry) sin usar cubos BoxGeometry en gizmo', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testShelf]);
      fixture.detectChanges();

      (comp as unknown as {
        buildGizmo: (p: Part, x: number, y: number, z: number, sx: number, sy: number, sz: number) => void;
      }).buildGizmo(testShelf, 0, 350, 0, 764, 18, 380);

      const gizmoHitMeshes = (comp as unknown as { gizmoHitMeshes: THREE.Mesh[] }).gizmoHitMeshes;
      expect(gizmoHitMeshes.length).toBeGreaterThanOrEqual(8); // 4 de borde + 4 de esquina

      // Ningún tirador debe ser un cubo BoxGeometry tosco
      for (const mesh of gizmoHitMeshes) {
        expect(mesh.geometry.type).not.toBe('BoxGeometry');
      }

      // Debe haber tiradores de cápsula para bordes y esferas para esquinas
      const capsuleHandles = gizmoHitMeshes.filter(m => m.geometry.type === 'CapsuleGeometry');
      const sphereHandles = gizmoHitMeshes.filter(m => m.geometry.type === 'SphereGeometry');

      expect(capsuleHandles.length).toBe(4);
      expect(sphereHandles.length).toBe(4);
    });

    it('los tiradores de esquina deben tener userData con type "corner_handle" y cursores diagonales', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      fixture.componentRef.setInput('parts', [testShelf]);
      fixture.detectChanges();

      (comp as unknown as {
        buildGizmo: (p: Part, x: number, y: number, z: number, sx: number, sy: number, sz: number) => void;
      }).buildGizmo(testShelf, 0, 350, 0, 764, 18, 380);

      const gizmoHitMeshes = (comp as unknown as { gizmoHitMeshes: THREE.Mesh[] }).gizmoHitMeshes;
      const cornerHandles = gizmoHitMeshes.filter(m => m.userData?.['type'] === 'corner_handle');

      expect(cornerHandles.length).toBe(4);
      for (const ch of cornerHandles) {
        expect(ch.userData['isGizmo']).toBe(true);
        expect(ch.userData['handleTarget']).toBe('corner');
        expect(['nwse-resize', 'nesw-resize']).toContain(ch.userData['cursor']);
      }
    });
  });

  describe('4. Cajones Modulares: Selección Indivisible, Apertura Persistente y Cotas CAD Sin Pastilla', () => {
    const drawerGroup: PartGroup = {
      id: 'drv-grp-1',
      name: 'Cajón 1',
      type: 'drawer',
      subType: 'drawer',
      templateId: 'modular_drawer',
      isOpen: false,
      slideExtension: 0
    };

    const drawerFront: Part = {
      id: 'drv-front',
      name: 'Frente Cajón 1',
      componentRole: 'drawer_front',
      groupId: 'drv-grp-1',
      length: 594,
      width: 180,
      thickness: 15,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Blanco 15mm',
      grain: 'length',
      edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
      posX: 0,
      posY: 120,
      posZ: 220,
      orientation: 'vertical_xy'
    };

    const drawerBottomMdf: Part = {
      id: 'drv-bottom',
      name: 'Fondo MDF Cajón 1',
      componentRole: 'drawer_box',
      groupId: 'drv-grp-1',
      length: 514,
      width: 450,
      thickness: 3,
      quantity: 1,
      materialId: 'mat-mdf',
      materialName: 'MDF 3mm',
      grain: 'none',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 50,
      posZ: 0,
      orientation: 'horizontal'
    };

    const drawerSideLeft: Part = {
      id: 'drv-side-l',
      name: 'Lateral Izquierdo Cajón 1',
      componentRole: 'drawer_box',
      groupId: 'drv-grp-1',
      length: 450,
      width: 140,
      thickness: 15,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Blanco 15mm',
      grain: 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: -250,
      posY: 110,
      posZ: 0,
      orientation: 'vertical_yz'
    };

    it('isModularDrawerGroup debe reconocer cajones modulares y seleccionar siempre el grupo completo en onPointerDown', () => {
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      const drawerParts = [drawerFront, drawerBottomMdf, drawerSideLeft];

      fixture.componentRef.setInput('parts', drawerParts);
      fixture.componentRef.setInput('partGroups', [drawerGroup]);
      fixture.detectChanges();

      const internal = comp as unknown as {
        isModularDrawerGroup: (gId: string | undefined) => boolean;
        onPointerDown: (e: PointerEvent) => void;
        canvasRef: () => { nativeElement: HTMLCanvasElement } | undefined;
        renderer: { domElement: HTMLCanvasElement; dispose: () => void };
        camera: THREE.PerspectiveCamera;
        controls: { enabled: boolean; target: THREE.Vector3; dispose: () => void };
        scene: THREE.Scene;
        raycaster: THREE.Raycaster;
        isDirectPieceDrag: boolean;
        pieceObjects: { mesh: THREE.Mesh; part: Part; isDrawer?: boolean; isDoor?: boolean; originalPos?: THREE.Vector3 }[];
        openTargetMap: Map<string, number>;
      };

      expect(internal.isModularDrawerGroup('drv-grp-1')).toBe(true);
      expect(internal.isModularDrawerGroup('mod-1')).toBe(false);

      const canvasEl = internal.canvasRef()?.nativeElement ?? document.createElement('canvas');
      canvasEl.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
      internal.canvasRef = () => ({ nativeElement: canvasEl });
      internal.renderer = { domElement: canvasEl, dispose: vi.fn() };
      internal.camera = new THREE.PerspectiveCamera(45, 800 / 600, 1, 10000);
      internal.controls = { enabled: true, target: new THREE.Vector3(), dispose: vi.fn() };
      internal.scene = new THREE.Scene();

      const bottomMesh = new THREE.Mesh();
      bottomMesh.userData = { part: drawerBottomMdf, isDrawer: true };
      const frontMesh = new THREE.Mesh();
      frontMesh.userData = { part: drawerFront, isDrawer: true };
      const handleMesh = new THREE.Mesh();
      handleMesh.userData = { part: drawerFront, isHandle: true, isDrawer: true };
      frontMesh.add(handleMesh);
      internal.pieceObjects = [
        { mesh: bottomMesh, part: drawerBottomMdf, isDrawer: true, isDoor: false, originalPos: new THREE.Vector3() },
        { mesh: frontMesh, part: drawerFront, isDrawer: true, isDoor: false, originalPos: new THREE.Vector3() }
      ];

      vi.spyOn(internal.raycaster, 'setFromCamera').mockImplementation(() => undefined);
      const intersectSpy = vi.spyOn(internal.raycaster, 'intersectObjects').mockImplementation((objs) => {
        if (objs.some(o => o === bottomMesh)) {
          return [{ object: bottomMesh, distance: 100, point: new THREE.Vector3() } as THREE.Intersection];
        }
        return [];
      });

      const emittedGroups: string[][] = [];
      comp.partsSelected.subscribe(ids => emittedGroups.push(ids));

      const downEvt = {
        button: 0,
        clientX: 400,
        clientY: 300,
        shiftKey: false,
        altKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as PointerEvent;

      // Clic simple sobre Fondo MDF: debe seleccionar las 3 piezas del cajón modular
      internal.onPointerDown(downEvt);
      expect(emittedGroups.length).toBeGreaterThan(0);
      expect(emittedGroups[emittedGroups.length - 1]).toEqual(['drv-front', 'drv-bottom', 'drv-side-l']);

      // Doble clic sobre la misma pieza: jamás debe aislar una sub-pieza individual
      intersectSpy.mockImplementation((objs) => {
        if (objs.some(o => o === frontMesh)) {
          return [{ object: frontMesh, distance: 90, point: new THREE.Vector3() } as THREE.Intersection];
        }
        return [];
      });
      fixture.componentRef.setInput('selectedPartIds', ['drv-front', 'drv-bottom', 'drv-side-l']);
      fixture.detectChanges();

      internal.onPointerDown(downEvt);
      internal.onPointerDown(downEvt);
      expect(emittedGroups[emittedGroups.length - 1]).toEqual(['drv-front', 'drv-bottom', 'drv-side-l']);

      // Clic sobre manija (isHandle): abre el cajón sin iniciar drag ni romper selección del grupo
      const toggleSpy = vi.spyOn(comp, 'togglePartOpen');
      intersectSpy.mockImplementation((objs) => {
        if (objs.some(o => o === frontMesh)) {
          return [{ object: handleMesh, distance: 80, point: new THREE.Vector3() } as THREE.Intersection];
        }
        return [];
      });
      internal.onPointerDown(downEvt);
      expect(toggleSpy).toHaveBeenCalledWith('drv-front');
      expect(internal.isDirectPieceDrag).toBe(false);
    });

    it('togglePartOpen debe sincronizar projectStorage.setGroupSlideExtension / isOpen y no revertir en effect() #8', () => {
      projectStorage.updateProject(
        p => ({
          ...p,
          groups: [{ ...drawerGroup }],
          parts: [drawerFront, drawerBottomMdf, drawerSideLeft]
        }),
        false
      );

      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;

      const internal = comp as unknown as {
        scene: THREE.Scene;
        pieceObjects: { mesh: THREE.Mesh; part: Part; isDrawer: boolean; isDoor: boolean; originalPos: THREE.Vector3 }[];
        openTargetMap: Map<string, number>;
        openCurrentMap: Map<string, number>;
      };
      internal.scene = new THREE.Scene();
      internal.pieceObjects = [
        { mesh: new THREE.Mesh(), part: drawerFront, isDrawer: true, isDoor: false, originalPos: new THREE.Vector3() },
        { mesh: new THREE.Mesh(), part: drawerBottomMdf, isDrawer: true, isDoor: false, originalPos: new THREE.Vector3() }
      ];

      fixture.componentRef.setInput('parts', projectStorage.partsList());
      fixture.componentRef.setInput('partGroups', projectStorage.groupsList());
      fixture.detectChanges();

      const slideSpy = vi.spyOn(projectStorage, 'setGroupSlideExtension');

      comp.togglePartOpen('drv-front');
      expect(slideSpy).toHaveBeenCalledWith('drv-grp-1', 1);
      expect(internal.openTargetMap.get('drv-front')).toBe(1);
      expect(internal.openTargetMap.get('drv-bottom')).toBe(1);
      expect(projectStorage.groupsList().find(g => g.id === 'drv-grp-1')?.isOpen).toBe(true);
      expect(projectStorage.groupsList().find(g => g.id === 'drv-grp-1')?.slideExtension).toBe(1);

      // Re-evaluar señales y efectos: con animación aún en curAnim=0, NO debe revertir a cerrado
      fixture.componentRef.setInput('partGroups', [...projectStorage.groupsList()]);
      fixture.detectChanges();
      expect(internal.openTargetMap.get('drv-front')).toBe(1);

      // Segundo clic: cierra el cajón completamente y sincroniza isOpen=false
      comp.togglePartOpen('drv-front');
      expect(slideSpy).toHaveBeenCalledWith('drv-grp-1', 0);
      expect(internal.openTargetMap.get('drv-front')).toBe(0);
      expect(projectStorage.groupsList().find(g => g.id === 'drv-grp-1')?.isOpen).toBe(false);
    });

    it('isInternalShelf debe excluir drawer_box y piezas con nombre Fondo MDF / Frente / Trasera', () => {
      expect(component.isInternalShelf(testShelf)).toBe(true);
      expect(component.isInternalShelf(drawerBottomMdf)).toBe(false);
      expect(component.isInternalShelf(drawerFront)).toBe(false);
      expect(
        component.isInternalShelf({
          ...testShelf,
          id: 'drawer-bottom-unnamed-role',
          name: 'Fondo MDF 3mm',
          componentRole: 'free'
        })
      ).toBe(false);
    });

    it('drawEnterprisePillBadge en modo idle no debe dibujar caja ni pastilla opaca sobre la escena', () => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arcTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        lineCap: '',
        lineJoin: '',
        miterLimit: 0
      } as unknown as CanvasRenderingContext2D;

      (component as unknown as {
        drawEnterprisePillBadge: (
          ctx: CanvasRenderingContext2D,
          w: number,
          h: number,
          text: string,
          color: string,
          hover: boolean,
          edit: boolean
        ) => void;
      }).drawEnterprisePillBadge(ctx, 512, 136, '↔ 514 mm', '#10b981', false, true);

      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.arcTo).not.toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith('↔ 514 mm', 256, 69);
    });
  });

  describe('5. Anclaje Exacto Arista-a-Arista (0.0 mm float) y Perspectiva 360°', () => {
    interface ViewerTestHarness {
      camera: THREE.PerspectiveCamera;
      controls: {
        enabled: boolean;
        target: THREE.Vector3;
        minDistance: number;
        maxDistance: number;
        update: () => void;
      };
      canvasRef: () => { nativeElement: { getBoundingClientRect: () => DOMRect } };
      requestRender: () => void;
      dimensionGroup: THREE.Group;
      internalClearanceGroup: THREE.Group;
      furnitureGroup: THREE.Group;
      editableDimensionSprites: THREE.Sprite[];
      internalClearanceLineMat: THREE.LineDashedMaterial;
      internalClearanceTickMat: THREE.LineBasicMaterial;
      renderPieceDimensions: (
        part: Part,
        px: number,
        py: number,
        pz: number,
        sx: number,
        sy: number,
        sz: number
      ) => void;
      renderModuleInternalClearances: (
        groupId: string,
        selectedOrDraggingPart?: Part,
        overridePosY?: number
      ) => void;
      renderClearanceDimensions: (part: Part, allParts: Part[]) => void;
      renderDrawerCavityClearances: (
        cavity: ModuleCavityInfo,
        drawerMinY: number,
        drawerMaxY: number
      ) => void;
      updateAdaptiveGizmoScale: () => void;
      openInlineDimensionEditor: (sprite: THREE.Sprite, data: DimensionBadgeUserData) => void;
      confirmInlineDimension: (rawValue: string) => void;
      projectWorldToScreen: (worldPos: THREE.Vector3) => { x: number; y: number } | null;
      inlineDimensionEditor: () => {
        x: number;
        y: number;
        value: number;
        propType: string;
        part: Part;
      } | null;
    }

    let harness: ViewerTestHarness;
    let currentParts: Part[];
    let currentGroups: PartGroup[];
    let restoreGetContext: (() => void) | null = null;
    let restoreHarnessState: (() => void) | null = null;

    const isMainLine = (obj: THREE.Line | THREE.LineSegments): boolean =>
      obj instanceof THREE.Line && !(obj instanceof THREE.LineSegments);

    const makePart = (overrides: Partial<Part> & { id: string }): Part => ({
      name: overrides.id,
      length: 600,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Blanco',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      orientation: 'horizontal',
      posX: 0,
      posY: 0,
      posZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      ...overrides
    });

    const collectGroupVisuals = (group: THREE.Group) => {
      group.updateMatrixWorld(true);
      const lineObjects: {
        object: THREE.Line | THREE.LineSegments;
        segments: [THREE.Vector3, THREE.Vector3][];
      }[] = [];
      const sprites: THREE.Sprite[] = [];

      group.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Sprite) {
          sprites.push(obj);
          return;
        }
        if (obj instanceof THREE.LineSegments) {
          const attr = obj.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
          const segs: [THREE.Vector3, THREE.Vector3][] = [];
          if (attr) {
            for (let i = 0; i + 1 < attr.count; i += 2) {
              const p1 = new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(obj.matrixWorld);
              const p2 = new THREE.Vector3().fromBufferAttribute(attr, i + 1).applyMatrix4(obj.matrixWorld);
              segs.push([p1, p2]);
            }
          }
          lineObjects.push({ object: obj, segments: segs });
          return;
        }
        if (obj instanceof THREE.Line) {
          const attr = obj.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
          const segs: [THREE.Vector3, THREE.Vector3][] = [];
          if (attr) {
            for (let i = 0; i + 1 < attr.count; i++) {
              const p1 = new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(obj.matrixWorld);
              const p2 = new THREE.Vector3().fromBufferAttribute(attr, i + 1).applyMatrix4(obj.matrixWorld);
              segs.push([p1, p2]);
            }
          }
          lineObjects.push({ object: obj, segments: segs });
        }
      });

      return { lineObjects, sprites };
    };

    const assertOverlayContract = (group: THREE.Group) => {
      const { lineObjects, sprites } = collectGroupVisuals(group);
      expect(lineObjects.length).toBeGreaterThan(0);
      expect(sprites.length).toBeGreaterThan(0);

      for (const { object } of lineObjects) {
        expect(object.renderOrder).toBe(DIMENSION_LINE_RENDER_ORDER);
        expect(object.userData['isCota']).toBe(true);
        expect(object.userData['isAuxiliaryVisual']).toBe(true);
        expect(object.geometry.userData['isCota']).toBe(true);
        expect(object.geometry.userData['isAuxiliaryVisual']).toBe(true);

        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) {
          expect(mat.depthTest).toBe(false);
          expect(mat.depthWrite).toBe(false);
        }
      }

      for (const sprite of sprites) {
        expect(sprite.renderOrder).toBe(DIMENSION_SPRITE_RENDER_ORDER);
        expect(sprite.material.depthTest).toBe(false);
        expect(sprite.material.depthWrite).toBe(false);
      }

      return { lineObjects, sprites };
    };

    const getBoxCornersWorld = (
      px: number,
      py: number,
      pz: number,
      sx: number,
      sy: number,
      sz: number,
      rxDeg = 0,
      ryDeg = 0,
      rzDeg = 0
    ): THREE.Vector3[] => {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rxDeg),
        THREE.MathUtils.degToRad(ryDeg),
        THREE.MathUtils.degToRad(rzDeg),
        'XYZ'
      );
      const center = new THREE.Vector3(px, py, pz);
      const hx = sx / 2;
      const hy = sy / 2;
      const hz = sz / 2;
      const corners: THREE.Vector3[] = [];
      for (const dx of [-hx, hx]) {
        for (const dy of [-hy, hy]) {
          for (const dz of [-hz, hz]) {
            corners.push(new THREE.Vector3(dx, dy, dz).applyEuler(euler).add(center));
          }
        }
      }
      return corners;
    };

    const minDistToPoints = (pt: THREE.Vector3, targets: THREE.Vector3[]): number =>
      targets.reduce((best, target) => Math.min(best, pt.distanceTo(target)), Infinity);

    const pointToSegmentDistance3D = (
      p: THREE.Vector3,
      a: THREE.Vector3,
      b: THREE.Vector3
    ): { distance: number; t: number } => {
      const ab = b.clone().sub(a);
      const lenSq = ab.lengthSq();
      if (lenSq <= 1e-9) {
        return { distance: p.distanceTo(a), t: 0 };
      }
      const rawT = p.clone().sub(a).dot(ab) / lenSq;
      const t = Math.max(0, Math.min(1, rawT));
      const proj = a.clone().addScaledVector(ab, t);
      return { distance: p.distanceTo(proj), t: rawT };
    };

    const projectWorldPixel = (
      worldPos: THREE.Vector3,
      camera: THREE.PerspectiveCamera,
      width: number,
      height: number
    ): { x: number; y: number } => {
      const ndc = worldPos.clone().project(camera);
      return {
        x: (ndc.x * 0.5 + 0.5) * width,
        y: (-ndc.y * 0.5 + 0.5) * height
      };
    };

    beforeEach(() => {
      currentParts = [];
      currentGroups = [];

      const testCanvas = document.createElement('canvas');
      if (!testCanvas.getContext('2d')) {
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = (function (contextId: string) {
          if (contextId === '2d') {
            return {
              save: vi.fn(),
              restore: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(),
              arcTo: vi.fn(),
              closePath: vi.fn(),
              fill: vi.fn(),
              stroke: vi.fn(),
              fillText: vi.fn(),
              strokeText: vi.fn(),
              clearRect: vi.fn(),
              measureText: (txt: string) => ({ width: txt.length * 10 }),
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 0,
              font: '',
              textAlign: '',
              textBaseline: '',
              lineCap: '',
              lineJoin: '',
              miterLimit: 0
            } as unknown as CanvasRenderingContext2D;
          }
          return null;
        }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
        restoreGetContext = () => {
          HTMLCanvasElement.prototype.getContext = origGetContext;
        };
      }

      harness = component as unknown as ViewerTestHarness;
      const origCamera = harness.camera;
      const origControls = harness.controls;
      const origCanvasRef = harness.canvasRef;
      const origRequestRender = harness.requestRender;

      Object.defineProperty(component, 'parts', {
        value: () => currentParts,
        configurable: true
      });
      Object.defineProperty(component, 'partGroups', {
        value: () => currentGroups,
        configurable: true
      });

      const camera = new THREE.PerspectiveCamera(45, 1000 / 800, 1, 10000);
      camera.position.set(0, 1000, 2600);
      camera.lookAt(0, 1000, 0);
      camera.updateMatrixWorld(true);

      harness.camera = camera;
      harness.controls = {
        enabled: true,
        target: new THREE.Vector3(0, 1000, 0),
        minDistance: 100,
        maxDistance: 8000,
        update: vi.fn()
      };
      harness.canvasRef = () => ({
        nativeElement: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          getBoundingClientRect: () =>
            ({
              left: 0,
              top: 0,
              width: 1000,
              height: 800,
              right: 1000,
              bottom: 800,
              x: 0,
              y: 0,
              toJSON: () => ({})
            }) as DOMRect
        } as unknown as HTMLCanvasElement
      });
      harness.requestRender = vi.fn();
      harness.dimensionGroup.clear();
      harness.dimensionGroup.position.set(0, 0, 0);
      harness.internalClearanceGroup.clear();
      harness.internalClearanceGroup.position.set(0, 0, 0);
      harness.editableDimensionSprites.length = 0;

      restoreHarnessState = () => {
        harness.camera = origCamera;
        harness.controls = origControls;
        harness.canvasRef = origCanvasRef;
        harness.requestRender = origRequestRender;
      };
    });

    afterEach(() => {
      if (restoreHarnessState) {
        restoreHarnessState();
        restoreHarnessState = null;
      }
      if (restoreGetContext) {
        restoreGetContext();
        restoreGetContext = null;
      }
    });

    const buildTallCabinetParts = (shelf1Recessed = false): { groupId: string; parts: Part[] } => {
      const groupId = 'alacena-1';
      const parts: Part[] = [
        makePart({
          id: 'cab-bottom',
          name: 'Base',
          groupId,
          moduleId: groupId,
          componentRole: 'bottom',
          orientation: 'horizontal',
          length: 764,
          width: 400,
          thickness: 18,
          posX: 0,
          posY: 9,
          posZ: 0
        }),
        makePart({
          id: 'cab-top',
          name: 'Techo',
          groupId,
          moduleId: groupId,
          componentRole: 'top',
          orientation: 'horizontal',
          length: 764,
          width: 400,
          thickness: 18,
          posX: 0,
          posY: 1991,
          posZ: 0
        }),
        makePart({
          id: 'cab-side-l',
          name: 'Lateral Izquierdo',
          groupId,
          moduleId: groupId,
          componentRole: 'side_left',
          orientation: 'vertical_yz',
          length: 2000,
          width: 400,
          thickness: 18,
          posX: -391,
          posY: 1000,
          posZ: 0
        }),
        makePart({
          id: 'cab-side-r',
          name: 'Lateral Derecho',
          groupId,
          moduleId: groupId,
          componentRole: 'side_right',
          orientation: 'vertical_yz',
          length: 2000,
          width: 400,
          thickness: 18,
          posX: 391,
          posY: 1000,
          posZ: 0
        }),
        makePart({
          id: 'cab-shelf-1',
          name: 'Repisa 1',
          groupId,
          moduleId: groupId,
          componentRole: 'shelf',
          orientation: 'horizontal',
          length: 764,
          width: shelf1Recessed ? 360 : 400,
          thickness: 18,
          posX: 0,
          posY: 609,
          posZ: shelf1Recessed ? -20 : 0
        }),
        makePart({
          id: 'cab-shelf-2',
          name: 'Repisa 2',
          groupId,
          moduleId: groupId,
          componentRole: 'shelf',
          orientation: 'horizontal',
          length: 764,
          width: 400,
          thickness: 18,
          posX: 0,
          posY: 1309,
          posZ: 0
        })
      ];
      return { groupId, parts };
    };

    it('alacena alta con 2 repisas ancla luces Y/X a Z=200 (0.0 mm float), witness en repisa remetida y drag en vivo', () => {
      const { groupId, parts } = buildTallCabinetParts(false);
      currentParts = parts;
      currentGroups = [{ id: groupId, name: 'Alacena Alta', type: 'assembly' }];

      harness.renderModuleInternalClearances(groupId);
      const { lineObjects, sprites } = assertOverlayContract(harness.internalClearanceGroup);

      // Todos los vértices de líneas y ticks de bayas y luz X deben estar en Z === 200 (cero float)
      for (const { object, segments } of lineObjects) {
        if (isMainLine(object)) {
          expect(segments.length).toBe(1);
          const [p1, p2] = segments[0];
          expect(p1.z).toBeCloseTo(200, 4);
          expect(p2.z).toBeCloseTo(200, 4);
        }
        for (const [p1, p2] of segments) {
          expect(p1.z).toBeCloseTo(200, 4);
          expect(p2.z).toBeCloseTo(200, 4);
        }
      }

      // Verificar exactamente los 3 vanos verticales (582, 682, 664 mm) y la luz X interna (-382..382 en Y=18, Z=200)
      const verticalLines = lineObjects
        .filter(({ object, segments }) => {
          if (!isMainLine(object) || segments.length !== 1) return false;
          const [p1, p2] = segments[0];
          return Math.abs(p1.x - p2.x) < 1e-4 && Math.abs(p2.y - p1.y) > 10;
        })
        .map(({ segments }) => segments[0])
        .sort((a, b) => Math.min(a[0].y, a[1].y) - Math.min(b[0].y, b[1].y));

      expect(verticalLines.length).toBe(3);
      expect([Math.min(verticalLines[0][0].y, verticalLines[0][1].y), Math.max(verticalLines[0][0].y, verticalLines[0][1].y)]).toEqual([18, 600]);
      expect([Math.min(verticalLines[1][0].y, verticalLines[1][1].y), Math.max(verticalLines[1][0].y, verticalLines[1][1].y)]).toEqual([618, 1300]);
      expect([Math.min(verticalLines[2][0].y, verticalLines[2][1].y), Math.max(verticalLines[2][0].y, verticalLines[2][1].y)]).toEqual([1318, 1982]);

      const horizLines = lineObjects
        .filter(({ object, segments }) => {
          if (!isMainLine(object) || segments.length !== 1) return false;
          const [p1, p2] = segments[0];
          return Math.abs(p1.y - p2.y) < 1e-4 && Math.abs(p2.x - p1.x) > 100;
        })
        .map(({ segments }) => segments[0]);

      expect(horizLines.length).toBe(1);
      const [hx1, hx2] = horizLines[0];
      expect(Math.min(hx1.x, hx2.x)).toBeCloseTo(-382, 4);
      expect(Math.max(hx1.x, hx2.x)).toBeCloseTo(382, 4);
      expect(hx1.y).toBeCloseTo(18, 4);
      expect(hx1.z).toBeCloseTo(200, 4);

      // Sprites centrados en midpoint exacto y editableDimensionSprites íntegros
      for (const sprite of sprites) {
        const edgeP1 = sprite.userData['edgeP1'] as THREE.Vector3 | undefined;
        const edgeP2 = sprite.userData['edgeP2'] as THREE.Vector3 | undefined;
        const labelOffset = sprite.userData['labelOffset'] as THREE.Vector3 | undefined;
        expect(edgeP1).toBeDefined();
        expect(edgeP2).toBeDefined();
        expect(labelOffset?.length()).toBeCloseTo(0, 5);
        const expectedMid = edgeP1!.clone().add(edgeP2!).multiplyScalar(0.5);
        expect(sprite.position.distanceTo(expectedMid)).toBeLessThan(1e-4);
      }

      expect(sprites.length).toBe(4);
      const bayBadges = harness.editableDimensionSprites.filter(
        s => s.userData['isDimensionBadge'] === true
      );
      expect(bayBadges.length).toBe(4);
      expect(
        bayBadges.some(
          s =>
            s.userData['badgeType'] === 'inner_width_clearance' &&
            s.userData['currentValue'] === 764
        )
      ).toBe(true);
      expect(
        bayBadges.some(
          s =>
            s.userData['badgeType'] === 'bottom_clearance' &&
            (s.userData['part'] as Part | undefined)?.id === 'cab-shelf-1' &&
            s.userData['referenceY'] === 18
        )
      ).toBe(true);
      expect(
        bayBadges.some(
          s =>
            s.userData['badgeType'] === 'top_clearance' &&
            (s.userData['part'] as Part | undefined)?.id === 'cab-shelf-2' &&
            s.userData['referenceY'] === 1982
        )
      ).toBe(true);

      // Drag en vivo de repisa 1 a Y=709 actualiza los vanos (682 -> 582, 582 -> 682)
      const shelf1 = parts.find(p => p.id === 'cab-shelf-1')!;
      harness.renderModuleInternalClearances(groupId, shelf1, 709);
      const draggedEditable = harness.editableDimensionSprites.find(
        s =>
          s.userData['badgeType'] === 'bottom_clearance' &&
          (s.userData['part'] as Part | undefined)?.id === 'cab-shelf-1'
      );
      expect(draggedEditable?.userData['currentValue']).toBe(682);

      // Caso repisa remetida (maxZ = 160 vs base/repisa2 maxZ = 200): ancla en Z=160 con witness 160<->200
      const recessed = buildTallCabinetParts(true);
      currentParts = recessed.parts;
      harness.renderModuleInternalClearances(recessed.groupId);
      const recessedVisuals = assertOverlayContract(harness.internalClearanceGroup);

      const bayLinesAt160 = recessedVisuals.lineObjects.filter(({ object, segments }) => {
        if (!isMainLine(object) || segments.length !== 1) return false;
        const [p1, p2] = segments[0];
        return Math.abs(p1.x - p2.x) < 1e-4 && Math.abs(p1.z - 160) < 1e-4 && Math.abs(p2.z - 160) < 1e-4;
      });
      expect(bayLinesAt160.length).toBe(2);

      const witnessBridgeFound = recessedVisuals.lineObjects.some(({ object, segments }) => {
        if (!(object instanceof THREE.LineSegments)) return false;
        return segments.some(([p1, p2]) => {
          const zMin = Math.min(p1.z, p2.z);
          const zMax = Math.max(p1.z, p2.z);
          return Math.abs(p1.y - p2.y) < 1e-4 && Math.abs(zMin - 160) < 1e-4 && Math.abs(zMax - 200) < 1e-4;
        });
      });
      expect(witnessBridgeFound).toBe(true);
    });

    it('rotación 360° de cámara (frontal, perfil der/izq 90°, trasera 180°, isométrica) proyecta cotas sobre aristas con < 0.5 px de error y zoom cercano desliza sobre el segmento', () => {
      const board = makePart({
        id: 'rot-360-board',
        name: 'Tapa Horizontal',
        orientation: 'horizontal',
        length: 800,
        width: 400,
        thickness: 18,
        posX: 0,
        posY: 500,
        posZ: 0
      });
      currentParts = [board];

      const boardCorners = getBoxCornersWorld(0, 500, 0, 800, 18, 400);
      harness.renderPieceDimensions(board, 0, 500, 0, 800, 18, 400);

      const { lineObjects, sprites } = assertOverlayContract(harness.dimensionGroup);
      const dimLines = lineObjects.filter(
        ({ object, segments }) => isMainLine(object) && segments.length === 1
      );
      expect(dimLines.length).toBe(2);

      for (const { segments } of dimLines) {
        const [p1, p2] = segments[0];
        expect(minDistToPoints(p1, boardCorners)).toBeLessThan(1e-4);
        expect(minDistToPoints(p2, boardCorners)).toBeLessThan(1e-4);
      }

      const cameraAngles: { name: string; pos: THREE.Vector3 }[] = [
        { name: 'frontal-0', pos: new THREE.Vector3(0, 500, 2600) },
        { name: 'perfil-der-90', pos: new THREE.Vector3(2600, 500, 0) },
        { name: 'perfil-izq-270', pos: new THREE.Vector3(-2600, 500, 0) },
        { name: 'trasera-180', pos: new THREE.Vector3(0, 500, -2600) },
        { name: 'isometrica', pos: new THREE.Vector3(1600, 1600, 1600) }
      ];

      harness.controls.target.set(0, 500, 0);

      for (const angle of cameraAngles) {
        harness.camera.position.copy(angle.pos);
        harness.camera.lookAt(harness.controls.target);
        harness.camera.updateMatrixWorld(true);
        harness.updateAdaptiveGizmoScale();

        for (const { segments } of dimLines) {
          const [p1, p2] = segments[0];
          const nearestC1 = boardCorners.reduce((best, c) =>
            p1.distanceTo(c) < p1.distanceTo(best) ? c : best
          );
          const nearestC2 = boardCorners.reduce((best, c) =>
            p2.distanceTo(c) < p2.distanceTo(best) ? c : best
          );

          const projP1 = projectWorldPixel(p1, harness.camera, 1000, 800);
          const projC1 = projectWorldPixel(nearestC1, harness.camera, 1000, 800);
          const projP2 = projectWorldPixel(p2, harness.camera, 1000, 800);
          const projC2 = projectWorldPixel(nearestC2, harness.camera, 1000, 800);

          expect(Math.hypot(projP1.x - projC1.x, projP1.y - projC1.y)).toBeLessThan(0.5);
          expect(Math.hypot(projP2.x - projC2.x, projP2.y - projC2.y)).toBeLessThan(0.5);
        }

        for (const sprite of sprites) {
          const edgeP1 = sprite.userData['edgeP1'] as THREE.Vector3;
          const edgeP2 = sprite.userData['edgeP2'] as THREE.Vector3;
          const mid = edgeP1.clone().add(edgeP2).multiplyScalar(0.5);
          expect(sprite.position.distanceTo(mid)).toBeLessThan(1e-4);
        }
      }

      // Zoom cercano (< 850 mm) descentrado hacia una esquina: sprite desliza solo sobre P1..P2 sin deriva fuera del eje
      harness.controls.target.set(280, 509, 180);
      harness.camera.position.set(280, 720, 420);
      harness.camera.lookAt(harness.controls.target);
      harness.camera.updateMatrixWorld(true);
      harness.updateAdaptiveGizmoScale();

      for (const sprite of sprites) {
        const edgeP1 = sprite.userData['edgeP1'] as THREE.Vector3;
        const edgeP2 = sprite.userData['edgeP2'] as THREE.Vector3;
        const { distance, t } = pointToSegmentDistance3D(sprite.position, edgeP1, edgeP2);
        expect(distance).toBeLessThan(1e-4);
        expect(t).toBeGreaterThanOrEqual(-1e-6);
        expect(t).toBeLessThanOrEqual(1 + 1e-6);
      }
    });

    it('renderPieceDimensions ancla a vértices reales (0.0 mm float) en horizontal, vertical_yz profundidad y rotada rotationY=35°', () => {
      // 1) Horizontal estándar
      const horiz = makePart({
        id: 'p-horiz',
        orientation: 'horizontal',
        length: 750,
        width: 420,
        thickness: 18,
        posX: 120,
        posY: 300,
        posZ: -40
      });
      currentParts = [horiz];
      harness.dimensionGroup.clear();
      harness.editableDimensionSprites.length = 0;
      harness.renderPieceDimensions(horiz, 120, 300, -40, 750, 18, 420);

      const horizCorners = getBoxCornersWorld(120, 300, -40, 750, 18, 420);
      const horizVisuals = assertOverlayContract(harness.dimensionGroup);
      const horizLines = horizVisuals.lineObjects.filter(
        ({ object, segments }) => isMainLine(object) && segments.length === 1
      );
      expect(horizLines.length).toBe(2);
      for (const { segments } of horizLines) {
        expect(minDistToPoints(segments[0][0], horizCorners)).toBeLessThan(1e-4);
        expect(minDistToPoints(segments[0][1], horizCorners)).toBeLessThan(1e-4);
      }
      for (const sprite of horizVisuals.sprites) {
        const labelOffset = sprite.userData['labelOffset'] as THREE.Vector3;
        expect(labelOffset.length()).toBeCloseTo(0, 5);
      }
      expect(harness.editableDimensionSprites.length).toBe(2);
      const lengthBadge = harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'length')!;
      harness.openInlineDimensionEditor(lengthBadge, lengthBadge.userData as DimensionBadgeUserData);
      expect(harness.inlineDimensionEditor()?.value).toBe(750);

      // 2) vertical_yz orientada por profundidad (plinth: largo en Z, ancho en Y)
      const plinth = makePart({
        id: 'p-plinth',
        componentRole: 'plinth',
        orientation: 'vertical_yz',
        length: 620,
        width: 100,
        thickness: 18,
        posX: -200,
        posY: 50,
        posZ: 10
      });
      expect(partGeometry.getLocalDimensions(plinth).lengthLocalAxis).toBe('z');
      currentParts = [plinth];
      harness.dimensionGroup.clear();
      harness.editableDimensionSprites.length = 0;
      harness.renderPieceDimensions(plinth, -200, 50, 10, 18, 100, 620);

      const plinthCorners = getBoxCornersWorld(-200, 50, 10, 18, 100, 620);
      const plinthVisuals = assertOverlayContract(harness.dimensionGroup);
      const plinthLines = plinthVisuals.lineObjects.filter(
        ({ object, segments }) => isMainLine(object) && segments.length === 1
      );
      expect(plinthLines.length).toBe(2);
      const plinthSegLengths = plinthLines.map(({ segments }) => segments[0][0].distanceTo(segments[0][1])).sort((a, b) => a - b);
      expect(plinthSegLengths[0]).toBeCloseTo(100, 4);
      expect(plinthSegLengths[1]).toBeCloseTo(620, 4);
      for (const { segments } of plinthLines) {
        expect(minDistToPoints(segments[0][0], plinthCorners)).toBeLessThan(1e-4);
        expect(minDistToPoints(segments[0][1], plinthCorners)).toBeLessThan(1e-4);
      }

      // 3) Pieza rotada en Y (rotationY = 35°)
      const rotated = makePart({
        id: 'p-rot35',
        orientation: 'horizontal',
        length: 900,
        width: 500,
        thickness: 18,
        posX: 50,
        posY: 720,
        posZ: -80,
        rotationY: 35
      });
      currentParts = [rotated];
      harness.dimensionGroup.clear();
      harness.editableDimensionSprites.length = 0;
      harness.renderPieceDimensions(rotated, 50, 720, -80, 900, 18, 500);

      const rotatedCorners = getBoxCornersWorld(50, 720, -80, 900, 18, 500, 0, 35, 0);
      const rotVisuals = assertOverlayContract(harness.dimensionGroup);
      const rotLines = rotVisuals.lineObjects.filter(
        ({ object, segments }) => isMainLine(object) && segments.length === 1
      );
      expect(rotLines.length).toBe(2);
      for (const { segments } of rotLines) {
        expect(minDistToPoints(segments[0][0], rotatedCorners)).toBeLessThan(1e-4);
        expect(minDistToPoints(segments[0][1], rotatedCorners)).toBeLessThan(1e-4);
      }
      for (const sprite of rotVisuals.sprites) {
        const edgeP1 = sprite.userData['edgeP1'] as THREE.Vector3;
        const edgeP2 = sprite.userData['edgeP2'] as THREE.Vector3;
        const mid = edgeP1.clone().add(edgeP2).multiplyScalar(0.5);
        expect(sprite.position.distanceTo(mid)).toBeLessThan(1e-4);
      }
    });

    it('cotas de proximidad libre y vano de cajón anclan sin flotación en Z y preservan edición inline', () => {
      const bottomPart = makePart({
        id: 'free-bottom',
        name: 'Base',
        orientation: 'horizontal',
        length: 600,
        width: 400,
        thickness: 18,
        posX: 0,
        posY: 9,
        posZ: 0
      });
      const upperPart = makePart({
        id: 'free-upper',
        name: 'Superior',
        orientation: 'horizontal',
        length: 600,
        width: 350,
        thickness: 18,
        posX: 0,
        posY: 509,
        posZ: -25
      });
      currentParts = [bottomPart, upperPart];

      harness.dimensionGroup.clear();
      harness.editableDimensionSprites.length = 0;
      harness.renderClearanceDimensions(upperPart, currentParts);

      const freeVisuals = assertOverlayContract(harness.dimensionGroup);
      const clearanceMainLines = freeVisuals.lineObjects.filter(
        ({ object, segments }) => isMainLine(object) && segments.length === 1
      );
      expect(clearanceMainLines.length).toBeGreaterThanOrEqual(1);

      // upperPart tiene Z [-200, 150]; toda línea principal ancla exactamente en Z = 150 (sin +30/+46)
      for (const { segments } of clearanceMainLines) {
        const [p1, p2] = segments[0];
        expect(p1.z).toBeCloseTo(150, 4);
        expect(p2.z).toBeCloseTo(150, 4);
      }

      // Witness perpendicular conecta Z=200 (vecino) con Z=150 (pieza)
      const hasWitnessToNeighbor = freeVisuals.lineObjects.some(({ object, segments }) => {
        if (!(object instanceof THREE.LineSegments)) return false;
        return segments.some(([p1, p2]) => {
          const zMin = Math.min(p1.z, p2.z);
          const zMax = Math.max(p1.z, p2.z);
          return Math.abs(zMin - 150) < 1e-4 && Math.abs(zMax - 200) < 1e-4;
        });
      });
      expect(hasWitnessToNeighbor).toBe(true);

      for (const sprite of freeVisuals.sprites) {
        const edgeP1 = sprite.userData['edgeP1'] as THREE.Vector3;
        const edgeP2 = sprite.userData['edgeP2'] as THREE.Vector3;
        const labelOffset = sprite.userData['labelOffset'] as THREE.Vector3;
        expect(labelOffset.length()).toBeCloseTo(0, 5);
        expect(sprite.position.z).toBeCloseTo(150, 4);
        expect(sprite.position.distanceTo(edgeP1.clone().add(edgeP2).multiplyScalar(0.5))).toBeLessThan(1e-4);
      }

      // Verificar que clic + edición inline sobre bottom_clearance sigue funcionando
      const bottomBadge = harness.editableDimensionSprites.find(
        s =>
          s.userData['badgeType'] === 'bottom_clearance' &&
          (s.userData['part'] as Part | undefined)?.id === 'free-upper'
      );
      expect(bottomBadge).toBeDefined();
      const modifiedEvents: { part: Part; updates: Partial<Part> }[] = [];
      const sub = component.partModified.subscribe(ev => modifiedEvents.push(ev));

      harness.openInlineDimensionEditor(bottomBadge!, bottomBadge!.userData as DimensionBadgeUserData);
      expect(harness.inlineDimensionEditor()?.value).toBe(482);
      harness.confirmInlineDimension('400');
      sub.unsubscribe();

      expect(modifiedEvents.length).toBe(1);
      expect(modifiedEvents[0].updates.posY).toBeCloseTo(427, 4);

      // Cotas en vano de cajón: Luz Sup, Luz Inf y Hueco estrictamente en cavity.frontEdgeCoord = 250
      const cavity: ModuleCavityInfo = {
        id: 'cav-1',
        groupId: 'mod-1',
        moduleId: 'mod-1',
        moduleName: 'Bajo 1',
        groupName: 'Módulo Bajo 1',
        label: 'Vano 1',
        facingDirection: 'front',
        rotationY: 0,
        minSpan: -282,
        maxSpan: 282,
        centerSpan: 0,
        innerWidth: 564,
        internalWidth: 564,
        leftSideThickness: 18,
        rightSideThickness: 18,
        sideThickness: 18,
        lateralThickness: 18,
        minY: 18,
        maxY: 700,
        height: 682,
        internalHeight: 682,
        frontEdgeCoord: 250,
        frontPlaneZ: 250,
        backInnerCoord: -230,
        internalDepth: 480,
        optimalSlideLength: 450,
        centerX: 0,
        centerY: 359,
        centerZ: 10
      };

      harness.renderDrawerCavityClearances(cavity, 100, 260);
      const cavityVisuals = assertOverlayContract(harness.internalClearanceGroup);

      for (const { segments } of cavityVisuals.lineObjects) {
        for (const [p1, p2] of segments) {
          expect(p1.z).toBeCloseTo(250, 4);
          expect(p2.z).toBeCloseTo(250, 4);
        }
      }

      const cavityMainLines = cavityVisuals.lineObjects
        .filter(({ object, segments }) => isMainLine(object) && segments.length === 1)
        .map(({ segments }) => segments[0]);
      expect(cavityMainLines.length).toBe(3);

      for (const sprite of cavityVisuals.sprites) {
        const edgeP1 = sprite.userData['edgeP1'] as THREE.Vector3;
        const edgeP2 = sprite.userData['edgeP2'] as THREE.Vector3;
        const labelOffset = sprite.userData['labelOffset'] as THREE.Vector3;
        expect(sprite.position.z).toBeCloseTo(250, 4);
        expect(labelOffset.length()).toBeCloseTo(0, 5);
        expect(sprite.position.distanceTo(edgeP1.clone().add(edgeP2).multiplyScalar(0.5))).toBeLessThan(1e-4);
      }
    });
  });

  describe('6. Edición Directa en Vivo para TODAS las Cotas Verdes (X, Y, Z), Hover, Bloqueo y Undo', () => {
    interface LiveClearanceHarness {
      camera: THREE.PerspectiveCamera;
      controls: {
        enabled: boolean;
        target: THREE.Vector3;
        minDistance: number;
        maxDistance: number;
        update: () => void;
        dispose: () => void;
      };
      raycaster: THREE.Raycaster;
      dimensionGroup: THREE.Group;
      internalClearanceGroup: THREE.Group;
      pieceObjectMap: Map<
        string,
        {
          part: Part;
          mesh: THREE.Mesh;
          originalPos: THREE.Vector3;
          explodedOffset: THREE.Vector3;
        }
      >;
      editableDimensionSprites: THREE.Sprite[];
      hoveredDimensionSprite: THREE.Sprite | null;
      lastHoverRaycastTime: number;
      renderClearanceDimensions: (part: Part, allParts: Part[]) => void;
      renderModuleInternalClearances: (
        groupId: string,
        selectedOrDraggingPart?: Part,
        overridePosY?: number,
        overrideParts?: Part[]
      ) => void;
      onPointerMove: (e: PointerEvent) => void;
      onPointerDown: (e: PointerEvent) => void;
      onCanvasPointerLeave: () => void;
      openInlineDimensionEditor: (sprite: THREE.Sprite, data: DimensionBadgeUserData) => void;
      confirmInlineDimension: (rawValue: string) => void;
      cancelInlineDimension: () => void;
    }

    const createPart = (overrides: Partial<Part> & { id: string }): Part => ({
      name: overrides.id,
      length: 600,
      width: 400,
      thickness: 15,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Blanco 15mm',
      grain: 'length',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      orientation: 'horizontal',
      posX: 0,
      posY: 0,
      posZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      ...overrides
    });

    const installCanvas2dMock = (): (() => void) => {
      const testCanvas = document.createElement('canvas');
      if (testCanvas.getContext('2d')) {
        return () => undefined;
      }
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = (function (contextId: string) {
        if (contextId === '2d') {
          return {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            arcTo: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            fillText: vi.fn(),
            strokeText: vi.fn(),
            clearRect: vi.fn(),
            measureText: (txt: string) => ({ width: txt.length * 10 }),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            font: '',
            textAlign: '',
            textBaseline: '',
            lineCap: '',
            lineJoin: '',
            miterLimit: 0
          } as unknown as CanvasRenderingContext2D;
        }
        return null;
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
      return () => {
        HTMLCanvasElement.prototype.getContext = origGetContext;
      };
    };

    const setupLiveFixture = (initialParts: Part[]) => {
      const restoreCtx = installCanvas2dMock();
      const fixture = TestBed.createComponent(Furniture3dViewerComponent);
      const comp = fixture.componentInstance;
      const harness = comp as unknown as LiveClearanceHarness;

      projectStorage.updateProject(p => ({ ...p, parts: initialParts, modules: [] }), false);
      projectStorage.clearHistory();
      fixture.componentRef.setInput('parts', initialParts);
      fixture.detectChanges();

      const camera = new THREE.PerspectiveCamera(45, 1000 / 800, 1, 10000);
      camera.position.set(0, 400, 2200);
      camera.lookAt(0, 400, 0);
      camera.updateMatrixWorld(true);

      const canvasEl = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
      vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 1000,
        height: 800,
        right: 1000,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect);

      const origCamera = harness.camera;
      const origControls = harness.controls;
      harness.camera = camera;
      harness.controls = {
        enabled: true,
        target: new THREE.Vector3(0, 400, 0),
        minDistance: 100,
        maxDistance: 8000,
        update: vi.fn(),
        dispose: vi.fn()
      };

      const registerPieceMesh = (part: Part): THREE.Mesh => {
        const mesh = new THREE.Mesh();
        mesh.position.set(part.posX ?? 0, part.posY ?? 0, part.posZ ?? 0);
        mesh.userData['part'] = part;
        harness.pieceObjectMap.set(part.id, {
          part,
          mesh,
          originalPos: new THREE.Vector3(part.posX ?? 0, part.posY ?? 0, part.posZ ?? 0),
          explodedOffset: new THREE.Vector3()
        });
        return mesh;
      };

      return {
        fixture,
        comp,
        harness,
        camera,
        canvasEl,
        registerPieceMesh,
        cleanup: () => {
          harness.camera = origCamera;
          harness.controls = origControls;
          restoreCtx();
        }
      };
    };

    const projectToClient = (
      worldPos: THREE.Vector3,
      camera: THREE.PerspectiveCamera
    ): { clientX: number; clientY: number } => {
      const ndc = worldPos.clone().project(camera);
      return {
        clientX: (ndc.x * 0.5 + 0.5) * 1000,
        clientY: (-ndc.y * 0.5 + 0.5) * 800
      };
    };

    it('debe hacer clicables y editables las cotas internas de módulo: vano vacío (sin entrepaños) y Luz Interna X', () => {
      const modId = 'mod-empty-1';
      const bottom = createPart({
        id: 'empty-bottom',
        groupId: modId,
        componentRole: 'bottom',
        length: 770,
        width: 400,
        thickness: 15,
        posX: 0,
        posY: 7.5,
        posZ: 0
      });
      const roof = createPart({
        id: 'empty-roof',
        groupId: modId,
        componentRole: 'top',
        length: 770,
        width: 400,
        thickness: 15,
        posX: 0,
        posY: 792.5,
        posZ: 0
      });
      const leftSide = createPart({
        id: 'empty-left',
        groupId: modId,
        componentRole: 'side_left',
        orientation: 'vertical_yz',
        length: 800,
        width: 400,
        thickness: 15,
        posX: -392.5,
        posY: 400,
        posZ: 0
      });
      const rightSide = createPart({
        id: 'empty-right',
        groupId: modId,
        componentRole: 'side_right',
        orientation: 'vertical_yz',
        length: 800,
        width: 400,
        thickness: 15,
        posX: 392.5,
        posY: 400,
        posZ: 0
      });

      const env = setupLiveFixture([bottom, roof, leftSide, rightSide]);
      try {
        env.harness.renderModuleInternalClearances(modId);

        const emptyBaySprite = env.harness.editableDimensionSprites.find(
          s =>
            s.userData['isDimensionBadge'] === true &&
            s.userData['badgeType'] !== 'inner_width_clearance'
        );
        const innerWidthSprite = env.harness.editableDimensionSprites.find(
          s =>
            s.userData['isDimensionBadge'] === true &&
            s.userData['badgeType'] === 'inner_width_clearance'
        );

        expect(emptyBaySprite).toBeDefined();
        expect(emptyBaySprite!.userData['currentValue']).toBe(770);
        expect(innerWidthSprite).toBeDefined();
        expect(innerWidthSprite!.userData['currentValue']).toBe(770);

        // Editar vano vacío (sin entrepaños) a 500 mm: mueve el techo sobre la base anclada
        env.harness.openInlineDimensionEditor(
          emptyBaySprite!,
          emptyBaySprite!.userData as DimensionBadgeUserData
        );
        env.fixture.detectChanges();
        env.harness.confirmInlineDimension('500');
        const updatedRoof = projectStorage.currentProject().parts.find(p => p.id === 'empty-roof');
        // bottom.maxY (15) + 500 + roof.halfY (7.5) = 522.5
        expect(updatedRoof?.posY).toBeCloseTo(522.5, 4);
        expect(projectStorage.currentProject().parts.find(p => p.id === 'empty-bottom')?.posY).toBeCloseTo(7.5, 4);

        // Editar Luz Interna X a 600 mm desplaza el lateral derecho (izquierdo queda anclado en -392.5)
        const freshInnerWidthSprite = env.harness.editableDimensionSprites.find(
          s =>
            s.userData['isDimensionBadge'] === true &&
            s.userData['badgeType'] === 'inner_width_clearance'
        );
        expect(freshInnerWidthSprite).toBeDefined();
        env.harness.openInlineDimensionEditor(
          freshInnerWidthSprite!,
          freshInnerWidthSprite!.userData as DimensionBadgeUserData
        );
        env.fixture.detectChanges();

        const inputEl = env.fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
        expect(inputEl).not.toBeNull();
        expect(inputEl.getAttribute('min')).toBe('0');

        env.harness.confirmInlineDimension('600');
        const updatedRight = projectStorage.currentProject().parts.find(p => p.id === 'empty-right');
        // leftInnerX (-385) + 600 + halfThick (7.5) = 222.5
        expect(updatedRight?.posX).toBeCloseTo(222.5, 4);
        expect(projectStorage.currentProject().parts.find(p => p.id === 'empty-left')?.posX).toBeCloseTo(-392.5, 4);

        // Editar Luz Interna X a 0 mm deja ambos laterales tocándose y conserva la cota editable
        const innerAfter = env.harness.editableDimensionSprites.find(
          s => s.userData['badgeType'] === 'inner_width_clearance'
        );
        expect(innerAfter).toBeDefined();
        env.harness.openInlineDimensionEditor(innerAfter!, innerAfter!.userData as DimensionBadgeUserData);
        env.harness.confirmInlineDimension('0');
        const updatedRightZero = projectStorage.currentProject().parts.find(p => p.id === 'empty-right');
        expect(updatedRightZero?.posX).toBeCloseTo(-377.5, 4);
        const innerZeroBadge = env.harness.editableDimensionSprites.find(
          s => s.userData['badgeType'] === 'inner_width_clearance'
        );
        expect(innerZeroBadge?.userData['currentValue']).toBe(0);
      } finally {
        env.cleanup();
      }
    });

    it('debe activar hover, cursor pointer y tooltip en canvas y limpiarlos al salir o abrir editor; clic izquierdo abre editor y frena OrbitControls', async () => {
      const back = createPart({
        id: 'h-left',
        posX: -250,
        posY: 300,
        posZ: 0,
        length: 100,
        thickness: 20
      });
      const right = createPart({
        id: 'h-right',
        posX: 250,
        posY: 300,
        posZ: 0,
        length: 100,
        thickness: 20
      });
      const env = setupLiveFixture([back, right]);

      try {
        env.harness.renderClearanceDimensions(back, [back, right]);
        const rightBadge = env.harness.editableDimensionSprites.find(
          s => s.userData['badgeType'] === 'right_clearance'
        );
        expect(rightBadge).toBeDefined();

        rightBadge!.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        rightBadge!.getWorldPosition(worldPos);
        const { clientX, clientY } = projectToClient(worldPos, env.camera);

        // Simulamos raycast sobre la cota en hover
        let shouldHitBadge = true;
        env.harness.lastHoverRaycastTime = 0;
        const intersectSpy = vi
          .spyOn(env.harness.raycaster, 'intersectObjects')
          .mockImplementation((objs: THREE.Object3D[]) => {
            if (shouldHitBadge && objs.includes(rightBadge!)) {
              return [{ object: rightBadge!, distance: 100, point: worldPos.clone() }] as THREE.Intersection[];
            }
            return [];
          });

        env.harness.onPointerMove({ clientX, clientY } as PointerEvent);
        env.fixture.detectChanges();

        expect(env.canvasEl.style.cursor).toBe('pointer');
        expect(env.harness.hoveredDimensionSprite).toBe(rightBadge);
        expect(env.comp.hoveredDimensionTooltip()).toBe('Clic para editar separación en mm');
        expect(env.canvasEl.getAttribute('title')).toBe('Clic para editar separación en mm');

        // Al salir del canvas se limpia tooltip y cursor
        env.harness.onCanvasPointerLeave();
        env.fixture.detectChanges();
        expect(env.harness.hoveredDimensionSprite).toBeNull();
        expect(env.comp.hoveredDimensionTooltip()).toBeNull();
        expect(env.canvasEl.style.cursor).toBe('grab');

        // Al volver a pasar y hacer clic izquierdo se bloquea OrbitControls y se previene propagación
        const focusProtoSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');
        const selectProtoSpy = vi.spyOn(HTMLInputElement.prototype, 'select');
        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();
        env.harness.onPointerDown({
          button: 0,
          clientX,
          clientY,
          shiftKey: false,
          preventDefault,
          stopPropagation
        } as unknown as PointerEvent);
        env.fixture.detectChanges();

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(stopPropagation).toHaveBeenCalledTimes(1);
        expect(env.harness.controls.enabled).toBe(false);
        expect(env.comp.inlineDimensionEditor()?.propType).toBe('right_clearance');
        expect(env.comp.inlineDimensionEditor()?.value).toBe(400);

        const inputEl = env.fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
        expect(inputEl).not.toBeNull();
        expect(inputEl.value).toBe('400');

        // Focus + auto-select tras timeout de apertura
        await new Promise(resolve => setTimeout(resolve, 75));
        expect(focusProtoSpy).toHaveBeenCalled();
        expect(selectProtoSpy).toHaveBeenCalled();

        // Clic fuera de la cota cancela el editor inline sin cambios
        shouldHitBadge = false;
        env.harness.onPointerDown({
          button: 0,
          clientX: 10,
          clientY: 10,
          shiftKey: false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn()
        } as unknown as PointerEvent);
        env.fixture.detectChanges();
        expect(env.comp.inlineDimensionEditor()).toBeNull();
        expect(env.harness.controls.enabled).toBe(true);
        expect(projectStorage.canUndo()).toBe(false);

        // Reabrir y cancelar con Escape sin mutar las piezas
        shouldHitBadge = true;
        env.harness.onPointerDown({
          button: 0,
          clientX,
          clientY,
          shiftKey: false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn()
        } as unknown as PointerEvent);
        env.fixture.detectChanges();
        const reopenInputEl = env.fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
        reopenInputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        env.fixture.detectChanges();
        expect(env.comp.inlineDimensionEditor()).toBeNull();
        expect(env.harness.controls.enabled).toBe(true);
        expect(projectStorage.canUndo()).toBe(false);

        focusProtoSpy.mockRestore();
        selectProtoSpy.mockRestore();
        intersectSpy.mockRestore();
      } finally {
        env.cleanup();
      }
    });

    it('debe soportar edición directa en X, Y y Z (incluyendo 0 mm y 3 mm sin salto a 5 mm), refrescar 3D y mantener cámara intacta', () => {
      const center = createPart({
        id: 'center-p',
        name: 'Centro',
        length: 200,
        width: 100,
        thickness: 20,
        posX: 0,
        posY: 300,
        posZ: 0
      });
      const leftNeighbor = createPart({
        id: 'left-p',
        name: 'Izquierda',
        length: 100,
        width: 100,
        thickness: 20,
        posX: -250,
        posY: 300,
        posZ: 0
      });
      const frontNeighbor = createPart({
        id: 'front-p',
        name: 'Frontal',
        length: 200,
        width: 100,
        thickness: 20,
        posX: 0,
        posY: 300,
        posZ: 200
      });
      const backNeighbor = createPart({
        id: 'back-p',
        name: 'Trasera',
        length: 200,
        width: 100,
        thickness: 20,
        posX: 0,
        posY: 300,
        posZ: -200
      });
      const topNeighbor = createPart({
        id: 'top-p',
        name: 'Superior',
        length: 200,
        width: 100,
        thickness: 20,
        posX: 0,
        posY: 500,
        posZ: 0
      });
      const all = [center, leftNeighbor, frontNeighbor, backNeighbor, topNeighbor];
      const env = setupLiveFixture(all);

      try {
        const centerMesh = env.registerPieceMesh(center);
        const camBefore = env.camera.position.clone();
        const targetBefore = env.harness.controls.target.clone();

        const clrEvents: unknown[] = [];
        const clrSub = env.comp.clearanceCalculated.subscribe(v => clrEvents.push(v));

        env.harness.renderClearanceDimensions(center, all);

        // Todas las cotas verdes editables (left, top, front, back)
        const leftBadge = env.harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'left_clearance');
        const topBadge = env.harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'top_clearance');
        const frontBadge = env.harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'front_clearance');
        const backBadge = env.harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'back_clearance');
        expect(leftBadge).toBeDefined();
        expect(topBadge).toBeDefined();
        expect(frontBadge).toBeDefined();
        expect(backBadge).toBeDefined();

        // Editar left_clearance a 3 mm (< 5 mm): se mueve center porque es la seleccionada
        env.harness.openInlineDimensionEditor(leftBadge!, leftBadge!.userData as DimensionBadgeUserData);
        env.harness.confirmInlineDimension('3');

        const centerAfterX = projectStorage.currentProject().parts.find(p => p.id === 'center-p')!;
        // leftNeighbor.maxX (-200) + 3 + center.halfLen (100) = -97
        expect(centerAfterX.posX).toBeCloseTo(-97, 4);
        expect(centerMesh.position.x).toBeCloseTo(-97, 4);
        expect(projectStorage.canUndo()).toBe(true);

        // Deshacer con 1 único Undo restaura posX = 0
        projectStorage.undo();
        expect(projectStorage.currentProject().parts.find(p => p.id === 'center-p')?.posX).toBe(0);
        expect(projectStorage.canUndo()).toBe(false);

        // Editar top_clearance sobre eje Y a 2 mm y proteger suelo minY >= 0 si pidiera bajar bajo el piso
        env.harness.renderClearanceDimensions(center, all);
        const freshTopBadge = env.harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'top_clearance')!;
        env.harness.openInlineDimensionEditor(freshTopBadge, freshTopBadge.userData as DimensionBadgeUserData);
        env.harness.confirmInlineDimension('2');
        const centerAfterY = projectStorage.currentProject().parts.find(p => p.id === 'center-p')!;
        // topNeighbor.minY (490) - 2 - center.halfY (10) = 478
        expect(centerAfterY.posY).toBeCloseTo(478, 4);

        projectStorage.undo();
        expect(projectStorage.currentProject().parts.find(p => p.id === 'center-p')?.posY).toBe(300);

        // Editar back_clearance sobre eje Z manteniendo trasera (-Z) anclada y moviendo center (posZ)
        env.harness.renderClearanceDimensions(center, all);
        const freshBackBadge = env.harness.editableDimensionSprites.find(s => s.userData['badgeType'] === 'back_clearance')!;
        env.harness.openInlineDimensionEditor(freshBackBadge, freshBackBadge.userData as DimensionBadgeUserData);
        env.harness.confirmInlineDimension('25');
        const centerAfterBackZ = projectStorage.currentProject().parts.find(p => p.id === 'center-p')!;
        // backNeighbor.maxZ (-150) + 25 + center.halfWidth (50) = -75
        expect(centerAfterBackZ.posZ).toBeCloseTo(-75, 4);

        // Editar front_clearance sobre eje Z con tecla Enter a 0 mm cuando center está bloqueada (entonces se mueve frontNeighbor!)
        const lockedCenter: Part = { ...center, isLocked: true };
        const partsWithLockedCenter = [lockedCenter, leftNeighbor, frontNeighbor, backNeighbor, topNeighbor];
        projectStorage.updateProject(p => ({ ...p, parts: partsWithLockedCenter }), false);
        projectStorage.clearHistory();
        env.fixture.componentRef.setInput('parts', partsWithLockedCenter);
        env.fixture.detectChanges();
        const activeFrontMesh =
          env.harness.pieceObjectMap.get('front-p')?.mesh ?? env.registerPieceMesh(frontNeighbor);

        env.harness.renderClearanceDimensions(lockedCenter, partsWithLockedCenter);
        const frontBadgeLocked = env.harness.editableDimensionSprites.find(
          s => s.userData['badgeType'] === 'front_clearance'
        )!;
        env.harness.openInlineDimensionEditor(
          frontBadgeLocked,
          frontBadgeLocked.userData as DimensionBadgeUserData
        );
        env.fixture.detectChanges();

        const inputEl = env.fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
        inputEl.value = '0';
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        env.fixture.detectChanges();

        const frontAfterZ = projectStorage.currentProject().parts.find(p => p.id === 'front-p')!;
        // lockedCenter.maxZ (50) + 0 + frontNeighbor.halfWidth (50) = 100
        expect(frontAfterZ.posZ).toBeCloseTo(100, 4);
        expect(activeFrontMesh.position.z).toBeCloseTo(100, 4);
        expect(clrEvents.length).toBeGreaterThan(0);

        // Cámara y target permanecen completamente inmóviles
        expect(env.camera.position.distanceTo(camBefore)).toBeLessThan(1e-6);
        expect(env.harness.controls.target.distanceTo(targetBefore)).toBeLessThan(1e-6);
        clrSub.unsubscribe();
      } finally {
        env.cleanup();
      }
    });

    it('si ambas piezas están bloqueadas no mueve ninguna, no graba Undo y muestra alerta con designer.clearanceLockedWarning', () => {
      const lowerLocked = createPart({
        id: 'lock-low',
        posX: 0,
        posY: 10,
        thickness: 20,
        isLocked: true
      });
      const upperLocked = createPart({
        id: 'lock-up',
        posX: 0,
        posY: 210,
        thickness: 20,
        isLocked: true
      });
      const env = setupLiveFixture([lowerLocked, upperLocked]);

      try {
        const storageSpy = vi.spyOn(projectStorage, 'updatePart');
        env.harness.renderClearanceDimensions(upperLocked, [lowerLocked, upperLocked]);

        const bottomBadge = env.harness.editableDimensionSprites.find(
          s => s.userData['badgeType'] === 'bottom_clearance'
        );
        expect(bottomBadge).toBeDefined();

        env.harness.openInlineDimensionEditor(bottomBadge!, bottomBadge!.userData as DimensionBadgeUserData);
        env.harness.confirmInlineDimension('120');
        env.fixture.detectChanges();

        expect(storageSpy).not.toHaveBeenCalled();
        expect(projectStorage.canUndo()).toBe(false);
        expect(env.comp.clearanceWarningToast()).toBe(
          'La pieza está bloqueada; desbloquéala para modificar esta luz'
        );
        const alertEl = env.fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
        expect(alertEl?.textContent).toContain(
          'La pieza está bloqueada; desbloquéala para modificar esta luz'
        );
      } finally {
        env.cleanup();
      }
    });

    it('un pointerdown fuera del editor inline en document.body debe cerrarlo sin modificar piezas', () => {
      const lower = createPart({
        id: 'ext-low',
        posX: 0,
        posY: 10,
        thickness: 20
      });
      const upper = createPart({
        id: 'ext-up',
        posX: 0,
        posY: 210,
        thickness: 20
      });
      const env = setupLiveFixture([lower, upper]);

      try {
        const storageSpy = vi.spyOn(projectStorage, 'updatePart');
        env.harness.renderClearanceDimensions(upper, [lower, upper]);
        const bottomBadge = env.harness.editableDimensionSprites.find(
          s => s.userData['badgeType'] === 'bottom_clearance'
        );
        expect(bottomBadge).toBeDefined();

        env.harness.controls.enabled = false;
        env.harness.openInlineDimensionEditor(
          bottomBadge!,
          bottomBadge!.userData as DimensionBadgeUserData
        );
        env.fixture.detectChanges();
        expect(env.comp.inlineDimensionEditor()).not.toBeNull();

        const inputEl = env.fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
        expect(inputEl).not.toBeNull();
        inputEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        env.fixture.detectChanges();
        expect(env.comp.inlineDimensionEditor()).not.toBeNull();

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        env.fixture.detectChanges();

        expect(env.comp.inlineDimensionEditor()).toBeNull();
        expect(env.harness.controls.enabled).toBe(true);
        expect(storageSpy).not.toHaveBeenCalled();
        expect(projectStorage.canUndo()).toBe(false);
        expect(projectStorage.currentProject().parts.find(p => p.id === 'ext-up')?.posY).toBe(210);
      } finally {
        env.cleanup();
      }
    });
  });
});
