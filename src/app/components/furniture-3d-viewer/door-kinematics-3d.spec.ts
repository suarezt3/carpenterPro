import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { Furniture3dViewerComponent } from './furniture-3d-viewer';
import { DrillHole, Part, PartHardwareConfig } from '../../models/melamine.models';

describe('Furniture3dViewerComponent - Door 3D Hardware, Hinges & Gas Piston Kinematics', () => {
  let component: Furniture3dViewerComponent;
  let fixture: ComponentFixture<Furniture3dViewerComponent>;

  const createDoorPart = (
    id: string,
    width: number,
    height: number,
    thickness: number,
    hwOverrides: Partial<PartHardwareConfig> = {},
    posOverrides: Partial<Part> = {}
  ): Part => ({
    id,
    name: 'Puerta Frontal',
    length: height,
    width,
    thickness,
    quantity: 1,
    materialId: 'm1',
    materialName: 'Blanco Premium',
    grain: 'length',
    colorHex: '#FFFFFF',
    orientation: 'vertical_xy',
    componentRole: 'door',
    posX: 0,
    posY: 400,
    posZ: 280,
    edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
    hardwareConfig: {
      isMovable: true,
      movableType: 'door',
      openingDirection: 'left',
      hingeType: 'straight',
      handleType: 'bar_modern',
      handleFinish: 'brushed_steel',
      handlePosition: 'center',
      ...hwOverrides
    },
    ...posOverrides
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(Furniture3dViewerComponent);
    component = fixture.componentInstance;
    component.pauseRendering();
  });

  afterEach(() => {
    component.pauseRendering();
  });

  it('FASE 1.1: skips rendering hinge_35 drill holes so zero purple (0xa855f7) cylinders appear on doors', () => {
    const door = createDoorPart('door_clean_1', 500, 720, 18);
    fixture.componentRef.setInput('parts', [door]);
    fixture.detectChanges();

    const internalComp = component as unknown as {
      pieceObjectMap: Map<string, { part: Part; mesh: THREE.Mesh; originalPos: THREE.Vector3 }>;
      renderDrillHolesVisuals: (holes: DrillHole[]) => void;
    };

    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(500, 720, 18),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    internalComp.pieceObjectMap.set(door.id, {
      part: door,
      mesh: doorMesh,
      originalPos: new THREE.Vector3(0, 400, 280)
    });

    const holes: DrillHole[] = [
      {
        id: 'h_hinge_1',
        partId: door.id,
        partName: door.name,
        type: 'hinge_35',
        diameter: 35,
        depth: 12.5,
        posX: -228,
        posY: 660,
        posZ: 271,
        normalAxis: 'z',
        direction: 1,
        surfaceType: 'face',
        description: 'Cazoleta Ø35mm'
      },
      {
        id: 'h_screw_1',
        partId: door.id,
        partName: door.name,
        type: 'screw_4x50',
        diameter: 4,
        depth: 20,
        posX: -228,
        posY: 660,
        posZ: 271,
        normalAxis: 'z',
        direction: 1,
        surfaceType: 'face',
        description: 'Tornillo 4x50'
      }
    ];

    internalComp.renderDrillHolesVisuals(holes);

    let hingePurpleCount = 0;
    let drillHoleCount = 0;
    doorMesh.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.userData?.['isDrillHole']) {
        drillHoleCount++;
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (mat?.color && mat.color.getHex() === 0xa855f7) {
          hingePurpleCount++;
        }
      }
    });

    expect(hingePurpleCount).toBe(0);
    // Only the screw_4x50 hole (cylinder + ring = 2 meshes) is rendered; hinge_35 is completely skipped
    expect(drillHoleCount).toBe(2);
  });

  it('FASE 1.2: generates 2, 3, or 4 internal metallic 35mm cup hinges based on door edge length and keeps them strictly on the interior rear face', () => {
    expect(component.computeHingeOffsetsForLength(720)).toEqual([-260, 260]);
    expect(component.computeHingeOffsetsForLength(900)).toEqual([-350, 350]);
    expect(component.computeHingeOffsetsForLength(1200)).toEqual([-500, 0, 500]);
    expect(component.computeHingeOffsetsForLength(1600)).toEqual([-700, 0, 700]);

    const offsets4 = component.computeHingeOffsetsForLength(2100);
    expect(offsets4.length).toBe(4);
    expect(offsets4[0]).toBe(-950);
    expect(offsets4[3]).toBe(950);

    const internalComp = component as unknown as {
      createHingesMesh: (
        part: Part,
        hw: PartHardwareConfig,
        sx: number,
        sy: number,
        sz: number,
        hingeSide: 'left' | 'right' | 'top' | 'bottom'
      ) => THREE.Group;
    };

    const sz = 18;
    const doorShort = createDoorPart('d_short', 450, 720, sz);
    const group2 = internalComp.createHingesMesh(
      doorShort,
      doorShort.hardwareConfig!,
      450,
      720,
      sz,
      'left'
    );
    const hinges2 = group2.children.filter(c => c.name === 'internal_cup_hinge_35');
    expect(hinges2.length).toBe(2);

    const doorMed = createDoorPart('d_med', 500, 1300, sz);
    const group3 = internalComp.createHingesMesh(
      doorMed,
      doorMed.hardwareConfig!,
      500,
      1300,
      sz,
      'right'
    );
    const hinges3 = group3.children.filter(c => c.name === 'internal_cup_hinge_35');
    expect(hinges3.length).toBe(3);

    const doorTall = createDoorPart('d_tall', 550, 2000, sz);
    const group4 = internalComp.createHingesMesh(
      doorTall,
      doorTall.hardwareConfig!,
      550,
      2000,
      sz,
      'left'
    );
    const hinges4 = group4.children.filter(c => c.name === 'internal_cup_hinge_35');
    expect(hinges4.length).toBe(4);

    // Verify all hinge meshes stay strictly on the interior side (z <= -sz/2 + 2.5 < +sz/2 exterior face)
    group4.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(group4);
    expect(bbox.max.z).toBeLessThanOrEqual(-sz / 2 + 2.5);
    expect(bbox.min.z).toBeLessThan(-sz / 2 - 15);
  });

  it('FASE 2.1 & 2.2: computes exact 3D gas piston kinematics (Punto A -> Punto B) keeping A_local.z <= 0 and B_local.z <= 0 at 0°, 45°, and 80° without ever piercing the door', () => {
    const sx = 800;
    const sy = 400;
    const sz = 18;

    const kin0 = component.computeDoorPistonKinematics(sx, sy, sz, 'top', 0);
    const kin45 = component.computeDoorPistonKinematics(sx, sy, sz, 'top', 45);
    const kin80 = component.computeDoorPistonKinematics(sx, sy, sz, 'top', 80);

    for (const kin of [kin0, kin45, kin80]) {
      expect(kin.left.aLocal.z).toBeLessThanOrEqual(0);
      expect(kin.left.bLocal.z).toBeLessThanOrEqual(0);
      expect(kin.right.aLocal.z).toBeLessThanOrEqual(0);
      expect(kin.right.bLocal.z).toBeLessThanOrEqual(0);
      // Symmetrical left and right X coordinates
      expect(kin.left.aLocal.x).toBeCloseTo(-kin.right.aLocal.x, 4);
    }

    // Telescopic extension increases monotonically from 0° (compressed) -> 45° -> 80° (extended)
    expect(kin0.left.length).toBeGreaterThan(35);
    expect(kin45.left.length).toBeGreaterThan(kin0.left.length);
    expect(kin80.left.length).toBeGreaterThan(kin45.left.length);

    // Also verify bottom drop-down door kinematics stay strictly on the interior side (z <= 0)
    const kinBottom80 = component.computeDoorPistonKinematics(sx, sy, sz, 'bottom', 80);
    expect(kinBottom80.left.aLocal.z).toBeLessThanOrEqual(0);
    expect(kinBottom80.left.bLocal.z).toBeLessThanOrEqual(0);
  });

  it('FASE 2.2 & 3.1: updates articulated gas pistons and door pivot rotation dynamically when setDoorOpeningAngleDeg is called', () => {
    const topDoor = createDoorPart(
      'door_top_1',
      800,
      400,
      18,
      {
        openingDirection: 'top',
        hingeType: 'gas_piston',
        handlePosition: 'bottom'
      }
    );

    const internalComp = component as unknown as {
      createHingesMesh: (
        part: Part,
        hw: PartHardwareConfig,
        sx: number,
        sy: number,
        sz: number,
        hingeSide: 'left' | 'right' | 'top' | 'bottom'
      ) => THREE.Group;
      pieceObjectMap: Map<string, unknown>;
      pieceObjects: unknown[];
    };

    const doorPivot = new THREE.Group();
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(800, 400, 18));
    doorMesh.position.set(0, -200, 9);
    const hingeGroup = internalComp.createHingesMesh(
      topDoor,
      topDoor.hardwareConfig!,
      800,
      400,
      18,
      'top'
    );
    doorMesh.add(hingeGroup);
    doorPivot.add(doorMesh);

    // Top door must have both 2 internal 35mm cup hinges AND the articulated pistons group
    const cupHinges = hingeGroup.children.filter(c => c.name === 'internal_cup_hinge_35');
    expect(cupHinges.length).toBe(2);

    const pistonSpaceGroup = hingeGroup.getObjectByName('door_pistons_pivot_space') as THREE.Group;
    expect(pistonSpaceGroup).toBeTruthy();

    const pieceEntry = {
      part: topDoor,
      mesh: doorMesh,
      originalPos: new THREE.Vector3(0, 400, 280),
      explodedOffset: new THREE.Vector3(),
      isDoor: true,
      doorPivot,
      doorBaseRotation: new THREE.Euler(0, 0, 0),
      hingeSide: 'top' as const,
      doorFacing: 'front' as const,
      hingeGroup
    };
    internalComp.pieceObjects = [pieceEntry];
    internalComp.pieceObjectMap.set(topDoor.id, pieceEntry);
    fixture.componentRef.setInput('parts', [topDoor]);

    component.setDoorOpeningAngleDeg(topDoor.id, 80);
    expect(component.getDoorOpeningAngleDeg(topDoor.id)).toBe(80);
    expect(component.isDoorOrGroupOpen3D(topDoor.id)).toBe(true);
    expect(doorPivot.rotation.x).toBeCloseTo(-THREE.MathUtils.degToRad(80), 4);

    const leftPiston = pistonSpaceGroup.getObjectByName('piston_left') as THREE.Group;
    const aLocal80 = leftPiston.userData['aLocal'] as THREE.Vector3;
    const bLocal80 = leftPiston.userData['bLocal'] as THREE.Vector3;
    expect(aLocal80.z).toBeLessThanOrEqual(0);
    expect(bLocal80.z).toBeLessThanOrEqual(0);
  });

  it('FASE 2.3: places handles on the exterior face according to opening direction and handlePosition', () => {
    const internalComp = component as unknown as {
      createHandleMesh: (
        part: Part,
        hw: PartHardwareConfig,
        sx: number,
        sy: number,
        sz: number,
        isDoor: boolean,
        hingeSide: 'left' | 'right' | 'top' | 'bottom'
      ) => THREE.Group;
    };

    const doorTop = createDoorPart('d_top', 600, 400, 18, {
      openingDirection: 'top',
      handlePosition: 'bottom'
    });
    const handleTop = internalComp.createHandleMesh(
      doorTop,
      doorTop.hardwareConfig!,
      600,
      400,
      18,
      true,
      'top'
    );
    expect(handleTop.position.x).toBe(0);
    expect(handleTop.position.y).toBe(-400 / 2 + 40);
    expect(handleTop.position.z).toBe(18 / 2 + 15);
    expect(handleTop.rotation.z).toBeCloseTo(Math.PI / 2, 4);

    const doorBottom = createDoorPart('d_bot', 600, 400, 18, {
      openingDirection: 'bottom',
      handlePosition: 'top'
    });
    const handleBottom = internalComp.createHandleMesh(
      doorBottom,
      doorBottom.hardwareConfig!,
      600,
      400,
      18,
      true,
      'bottom'
    );
    expect(handleBottom.position.x).toBe(0);
    expect(handleBottom.position.y).toBe(400 / 2 - 40);

    const doorPush = createDoorPart('d_push', 600, 720, 18, {
      openingDirection: 'left',
      handlePosition: 'none'
    });
    const handlePush = internalComp.createHandleMesh(
      doorPush,
      doorPush.hardwareConfig!,
      600,
      720,
      18,
      true,
      'left'
    );
    expect(handlePush.children.length).toBe(0);
  });
});
