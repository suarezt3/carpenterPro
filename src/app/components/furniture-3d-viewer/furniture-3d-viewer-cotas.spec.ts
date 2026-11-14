import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Furniture3dViewerComponent, DimensionBadgeUserData } from './furniture-3d-viewer';
import { ProjectStorageService } from '../../services/project-storage.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { Part, PartGroup } from '../../models/melamine.models';
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
});
