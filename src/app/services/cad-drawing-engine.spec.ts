import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CadDrawingEngineService } from './cad-drawing-engine.service';
import { CadGuide, CadHoveredFace } from '../models/cad-tools.models';
import { Part } from '../models/melamine.models';

describe('CadDrawingEngineService', () => {
  const service = new CadDrawingEngineService();

  it('builds guides group with point marks and dashed lines', () => {
    const guides: CadGuide[] = [
      {
        id: 'guide-1',
        type: 'point',
        origin: { x: 100, y: 200, z: 300 },
        createdAt: Date.now()
      },
      {
        id: 'guide-2',
        type: 'line',
        origin: { x: 0, y: 100, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        createdAt: Date.now()
      },
      {
        id: 'guide-3',
        type: 'angle',
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0.7071, y: 0, z: 0.7071 },
        angleDeg: 45,
        createdAt: Date.now()
      }
    ];

    const group = service.buildGuidesGroup(guides);
    expect(group).toBeDefined();
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('snaps accurately to a reference guide point (+)', () => {
    const guides: CadGuide[] = [
      {
        id: 'guide-pt-1',
        type: 'point',
        origin: { x: 150, y: 200, z: 250 },
        createdAt: Date.now()
      }
    ];

    const ray = new THREE.Ray(
      new THREE.Vector3(150, 500, 250),
      new THREE.Vector3(0, -1, 0)
    );

    const snap = service.findGuideSnap(guides, ray, 30);
    expect(snap).toBeDefined();
    expect(snap?.guideId).toBe('guide-pt-1');
    expect(snap?.type).toBe('point');
    expect(snap?.snapPoint.x).toBe(150);
    expect(snap?.snapPoint.y).toBe(200);
    expect(snap?.snapPoint.z).toBe(250);
  });

  it('calculates a 45-degree chamfer face partition from edge to edge', () => {
    const part: Part = {
      id: 'part-1',
      name: 'Lateral',
      length: 600,
      width: 400,
      thickness: 15,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Blanco',
      grain: 'none',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      orientation: 'horizontal'
    };

    const face: CadHoveredFace = {
      partId: 'part-1',
      faceIndex: 0,
      worldNormal: { x: 0, y: 1, z: 0 },
      worldPoint: { x: 0, y: 0, z: 0 },
      localU: 300,
      localV: 200,
      faceWidth: 600,
      faceHeight: 400,
      isEdgeFace: false
    };

    // Mesh at origin
    const geom = new THREE.BoxGeometry(600, 15, 400);
    const mesh = new THREE.Mesh(geom);
    mesh.updateMatrixWorld(true);

    // Cut line across the front-right corner:
    // Front edge: Z = 200, X = 150 (U = 450, V = 400)
    // Right edge: X = 300, Z = 50 (U = 600, V = 250)
    const p1World = new THREE.Vector3(150, 0, 200);
    const p2World = new THREE.Vector3(300, 0, 50);

    const partition = service.calculateLinePartition(part, face, p1World, p2World, mesh);
    expect(partition).toBeDefined();
    expect(partition?.cutType).toBe('line_cut');
    expect(partition?.cutDimensions.width).toBe(150);
    expect(partition?.cutDimensions.height).toBe(150);

    const highlightGroup = service.buildPartitionHighlightGroup(partition!, true);
    expect(highlightGroup).toBeDefined();
    expect(highlightGroup.children.length).toBeGreaterThan(0);
  });

  it('calculates rectangular notch partition on face', () => {
    const part: Part = {
      id: 'part-rect',
      name: 'Tapa',
      length: 800,
      width: 500,
      thickness: 18,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Roble',
      grain: 'none',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      orientation: 'horizontal'
    };

    const face: CadHoveredFace = {
      partId: 'part-rect',
      faceIndex: 0,
      worldNormal: { x: 0, y: 1, z: 0 },
      worldPoint: { x: 0, y: 0, z: 0 },
      localU: 400,
      localV: 250,
      faceWidth: 800,
      faceHeight: 500,
      isEdgeFace: false
    };

    const geom = new THREE.BoxGeometry(800, 18, 500);
    const mesh = new THREE.Mesh(geom);
    mesh.updateMatrixWorld(true);

    const p1 = new THREE.Vector3(200, 0, 100);
    const p2 = new THREE.Vector3(350, 0, 200);

    const partition = service.calculateRectPartition(part, face, p1, p2, mesh);
    expect(partition).toBeDefined();
    expect(partition?.cutType).toBe('rect_notch');
    expect(partition?.cutDimensions.width).toBe(150);
    expect(partition?.cutDimensions.height).toBe(100);
    expect(partition?.cutoutWorldVertices.length).toBe(4);
  });

  it('calculates arc partition and performs 2D point-in-polygon test', () => {
    const part: Part = {
      id: 'part-arc',
      name: 'Estante Curvo',
      length: 600,
      width: 400,
      thickness: 15,
      quantity: 1,
      materialId: 'mat-1',
      materialName: 'Blanco',
      grain: 'none',
      edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      orientation: 'horizontal'
    };

    const face: CadHoveredFace = {
      partId: 'part-arc',
      faceIndex: 0,
      worldNormal: { x: 0, y: 1, z: 0 },
      worldPoint: { x: 0, y: 0, z: 0 },
      localU: 300,
      localV: 200,
      faceWidth: 600,
      faceHeight: 400,
      isEdgeFace: false
    };

    const geom = new THREE.BoxGeometry(600, 15, 400);
    const mesh = new THREE.Mesh(geom);
    mesh.updateMatrixWorld(true);

    const p1 = new THREE.Vector3(200, 0, 200);
    const p2 = new THREE.Vector3(300, 0, 100);
    const pMid = new THREE.Vector3(230, 0, 130);

    const partition = service.calculateArcPartition(part, face, p1, p2, pMid, mesh);
    expect(partition).toBeDefined();
    expect(partition?.cutType).toBe('arc_cut');
    expect(partition?.cutDimensions.radius).toBeGreaterThan(0);

    // Test Point In Polygon
    const poly = partition!.cutoutPolygon;
    const insidePt = { u: 580, v: 380 }; // Near outer corner (600, 400)
    const outsidePt = { u: 50, v: 50 };

    expect(service.isPointInPolygon2D(insidePt, poly)).toBe(true);
    expect(service.isPointInPolygon2D(outsidePt, poly)).toBe(false);
  });

  it('builds cut depth 3D preview group with clamped thickness limit', () => {
    const partition = service.calculateRectPartition(
      {
        id: 'p-cut',
        name: 'Lateral',
        length: 600,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'm1',
        materialName: 'Blanco',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        orientation: 'horizontal'
      },
      {
        partId: 'p-cut',
        faceIndex: 0,
        worldNormal: { x: 0, y: 1, z: 0 },
        worldPoint: { x: 0, y: 0, z: 0 },
        localU: 300,
        localV: 200,
        faceWidth: 600,
        faceHeight: 400,
        isEdgeFace: false
      },
      new THREE.Vector3(100, 0, 100),
      new THREE.Vector3(250, 0, 200),
      new THREE.Mesh(new THREE.BoxGeometry(600, 18, 400))
    );

    expect(partition).toBeDefined();
    const group = service.buildCutDepthPreviewGroup(partition!, -18, 18);
    expect(group).toBeDefined();
    expect(group.children.length).toBeGreaterThan(0);
  });
});
