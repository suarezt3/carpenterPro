import { Injectable, inject } from '@angular/core';
import * as THREE from 'three';
import {
  MelamineProject,
  Part,
  PartGroup
} from '../models/melamine.models';
import { PartGeometryService, CountertopCutoutHole } from './part-geometry.service';
import { MELAMINE_MATERIALS_CATALOG } from '../data/melamine-catalog.data';

export interface SketchupExportMaterial {
  id: string;
  name: string;
  colorHex: string;
  r: number;
  g: number;
  b: number;
}

export interface PartMeshExportData {
  part: Part;
  geomId: string;
  nodeId: string;
  cleanName: string;
  materialId: string;
  vertexCount: number;
  triangleCount: number;
  positionsStr: string;
  normalsStr: string;
  indicesStr: string;
}

/**
 * Servicio especializado en exportar el modelo 3D completo del proyecto
 * en formato COLLADA 1.4.1 (.DAE) nativo de SketchUp.
 * 
 * - Escala 1:1 milimétrica (<unit name="millimeter" meter="0.001" />).
 * - Eje nativo SketchUp (<up_axis>Z_UP</up_axis>) con conversión de Three.js (Y-Up):
 *   X_skp = X, Y_skp = -Z, Z_skp = Y.
 * - Geometría exacta con cortes especiales (chaflán, destaje en L, curvo, resaque en U).
 * - Jerarquía de grupos de módulos y tableros libres en <visual_scene>.
 * - Materiales y colores reales difusos en <library_effects> y <library_materials>
 *   con secuencia conforme a COLLADA 1.4.1 (ambient antes de diffuse).
 */
@Injectable({
  providedIn: 'root'
})
export class SketchupExporterService {
  private readonly partGeometry = inject(PartGeometryService);

  // Matriz de conversión de coordenadas Three.js (Y-Up) a SketchUp (Z-Up)
  // [ X_skp = X, Y_skp = -Z, Z_skp = Y, W = 1 ]
  private readonly toSketchupMatrix = new THREE.Matrix4().set(
    1,  0,  0, 0,
    0,  0, -1, 0,
    0,  1,  0, 0,
    0,  0,  0, 1
  );

  /**
   * Genera el archivo COLLADA (.dae) optimizado para SketchUp y dispara la descarga en el navegador.
   */
  exportProjectToSketchUp(project: MelamineProject): void {
    if (!project) {
      return;
    }

    const daeContent = this.generateColladaDaeString(project);
    if (typeof document === 'undefined') {
      return;
    }

    const blob = new Blob([daeContent], { type: 'model/vnd.collada+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const rawName = project.name || 'proyecto';
    const cleanName = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    a.download = `${cleanName || 'proyecto'}-sketchup-3d.dae`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Construye el documento XML COLLADA 1.4.1 completo como cadena de texto.
   */
  generateColladaDaeString(project: MelamineProject): string {
    const safeProject: MelamineProject = project || {
      id: 'empty_project',
      name: 'proyecto',
      clientName: '',
      date: new Date().toISOString().substring(0, 10),
      notes: '',
      modules: [],
      materials: [],
      parts: [],
      hardware: [],
      laborCost: 0,
      laborType: 'fixed',
      profitMarginPercent: 0,
      taxPercent: 0,
      updatedAt: new Date().toISOString(),
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        defaultBoardThickness: 18,
        thinEdgeThickness: 0.45,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 1800,
        thickEdgeCostPerMeter: 4200,
        currency: 'COP',
        optimizationPreference: 'best_fit'
      }
    };

    const parts = safeProject.parts || [];
    const createdIso = new Date().toISOString();

    // 1. Resolver materiales únicos utilizados en el proyecto
    const materialsMap = this.resolveProjectMaterials(parts, safeProject);

    // Sistema de asignación de IDs XML únicos garantizados (xs:ID sin colisiones)
    const usedXmlIds = new Set<string>();
    const allocUniqueXmlId = (prefix: string, raw: string): string => {
      const sanitized = this.sanitizeXmlId(raw);
      let candidate = `${prefix}_${sanitized}`;
      if (!usedXmlIds.has(candidate)) {
        usedXmlIds.add(candidate);
        return candidate;
      }
      let counter = 2;
      while (usedXmlIds.has(`${candidate}_${counter}`)) {
        counter++;
      }
      const unique = `${candidate}_${counter}`;
      usedXmlIds.add(unique);
      return unique;
    };

    // 2. Construir geometrías 3D de todas las piezas con sus coordenadas y normales transformadas
    const meshes: PartMeshExportData[] = [];
    const meshByPart = new Map<Part, PartMeshExportData>();

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partFallbackId = part.id || `part_${i + 1}`;
      const geomId = allocUniqueXmlId('geom', partFallbackId);
      const nodeId = allocUniqueXmlId('node', partFallbackId);

      const meshData = this.buildPartMeshData(part, safeProject, materialsMap, geomId, nodeId);
      if (meshData && meshData.triangleCount > 0) {
        meshes.push(meshData);
        meshByPart.set(part, meshData);
      }
    }

    const lines: string[] = [];

    // Encabezado XML y COLLADA 1.4.1
    lines.push('<?xml version="1.0" encoding="utf-8"?>');
    lines.push('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">');

    // <asset> con escala 1:1 milimétrica y orientación Z_UP para SketchUp
    lines.push('  <asset>');
    lines.push('    <contributor>');
    lines.push('      <authoring_tool>Piezo3D Studio - SketchUp COLLADA Exporter</authoring_tool>');
    lines.push('    </contributor>');
    lines.push(`    <created>${createdIso}</created>`);
    lines.push(`    <modified>${createdIso}</modified>`);
    lines.push('    <unit name="millimeter" meter="0.001" />');
    lines.push('    <up_axis>Z_UP</up_axis>');
    lines.push('  </asset>');

    // <library_effects> (Conforme estricto con COLLADA 1.4.1 XSD: ambient antes de diffuse)
    lines.push('  <library_effects>');
    for (const mat of materialsMap.values()) {
      lines.push(`    <effect id="effect_${mat.id}" name="${this.escapeXml(mat.name)}">`);
      lines.push('      <profile_COMMON>');
      lines.push('        <technique sid="common">');
      lines.push('          <phong>');
      lines.push('            <ambient>');
      lines.push('              <color>0.2 0.2 0.2 1.0</color>');
      lines.push('            </ambient>');
      lines.push('            <diffuse>');
      lines.push(`              <color>${mat.r.toFixed(4)} ${mat.g.toFixed(4)} ${mat.b.toFixed(4)} 1.0</color>`);
      lines.push('            </diffuse>');
      lines.push('            <specular>');
      lines.push('              <color>0.1 0.1 0.1 1.0</color>');
      lines.push('            </specular>');
      lines.push('            <shininess>');
      lines.push('              <float>20.0</float>');
      lines.push('            </shininess>');
      lines.push('          </phong>');
      lines.push('        </technique>');
      lines.push('      </profile_COMMON>');
      lines.push('    </effect>');
    }
    lines.push('  </library_effects>');

    // <library_materials>
    lines.push('  <library_materials>');
    for (const mat of materialsMap.values()) {
      lines.push(`    <material id="${mat.id}" name="${this.escapeXml(mat.name)}">`);
      lines.push(`      <instance_effect url="#effect_${mat.id}" />`);
      lines.push('    </material>');
    }
    lines.push('  </library_materials>');

    // <library_geometries>
    lines.push('  <library_geometries>');
    for (const m of meshes) {
      lines.push(`    <geometry id="${m.geomId}" name="${this.escapeXml(m.cleanName)}">`);
      lines.push('      <mesh>');
      // Positions source
      lines.push(`        <source id="${m.geomId}-positions">`);
      lines.push(`          <float_array id="${m.geomId}-positions-array" count="${m.vertexCount * 3}">${m.positionsStr}</float_array>`);
      lines.push('          <technique_common>');
      lines.push(`            <accessor source="#${m.geomId}-positions-array" count="${m.vertexCount}" stride="3">`);
      lines.push('              <param name="X" type="float" />');
      lines.push('              <param name="Y" type="float" />');
      lines.push('              <param name="Z" type="float" />');
      lines.push('            </accessor>');
      lines.push('          </technique_common>');
      lines.push('        </source>');
      // Normals source
      lines.push(`        <source id="${m.geomId}-normals">`);
      lines.push(`          <float_array id="${m.geomId}-normals-array" count="${m.vertexCount * 3}">${m.normalsStr}</float_array>`);
      lines.push('          <technique_common>');
      lines.push(`            <accessor source="#${m.geomId}-normals-array" count="${m.vertexCount}" stride="3">`);
      lines.push('              <param name="X" type="float" />');
      lines.push('              <param name="Y" type="float" />');
      lines.push('              <param name="Z" type="float" />');
      lines.push('            </accessor>');
      lines.push('          </technique_common>');
      lines.push('        </source>');
      // Vertices declaration
      lines.push(`        <vertices id="${m.geomId}-vertices">`);
      lines.push(`          <input semantic="POSITION" source="#${m.geomId}-positions" />`);
      lines.push('        </vertices>');
      // Triangles with materials
      lines.push(`        <triangles count="${m.triangleCount}" material="mat_symbol_${m.materialId}">`);
      lines.push(`          <input semantic="VERTEX" source="#${m.geomId}-vertices" offset="0" />`);
      lines.push(`          <input semantic="NORMAL" source="#${m.geomId}-normals" offset="1" />`);
      lines.push(`          <p>${m.indicesStr}</p>`);
      lines.push('        </triangles>');
      lines.push('      </mesh>');
      lines.push('    </geometry>');
    }
    lines.push('  </library_geometries>');

    // <library_visual_scenes> con jerarquía de grupos y componentes para SketchUp
    lines.push('  <library_visual_scenes>');
    lines.push('    <visual_scene id="Scene" name="Scene">');

    const processedParts = new Set<Part>();

    // Consolidar módulos conocidos desde project.groups y project.modules
    const allKnownGroups: { id: string; name: string }[] = [];
    const seenGroupKeys = new Set<string>();

    for (const g of (safeProject.groups || [])) {
      if (g && g.id && !seenGroupKeys.has(g.id)) {
        seenGroupKeys.add(g.id);
        allKnownGroups.push({ id: g.id, name: g.name || `Grupo_${g.id}` });
      }
    }
    for (const m of (safeProject.modules || [])) {
      if (m && m.id && !seenGroupKeys.has(m.id)) {
        seenGroupKeys.add(m.id);
        allKnownGroups.push({ id: m.id, name: m.name || m.type || `Modulo_${m.id}` });
      }
    }

    // 3a. Exportar grupos conocidos del proyecto (project.groups / project.modules)
    for (const group of allKnownGroups) {
      const groupParts = parts.filter(p => (p.groupId === group.id || p.moduleId === group.id));
      const childLines: string[] = [];

      for (const part of groupParts) {
        const mesh = meshByPart.get(part);
        if (mesh) {
          processedParts.add(part);
          this.appendPartNodeXml(childLines, mesh, '        ');
        }
      }

      // Solo emitir el nodo contenedor si contiene al menos una pieza con geometría válida
      if (childLines.length > 0) {
        const cleanGroupName = this.sanitizeName(group.name);
        const groupIdAttr = allocUniqueXmlId('group', group.id);
        lines.push(`      <node id="${groupIdAttr}" name="${this.escapeXml(cleanGroupName)}" type="NODE">`);
        lines.push(...childLines);
        lines.push('      </node>');
      }
    }

    // 3b. Exportar grupos adicionales referenciados por piezas que no estaban en project.groups ni modules
    const adHocGroupMap = new Map<string, Part[]>();
    for (const part of parts) {
      const gid = part.groupId || part.moduleId;
      if (gid && !seenGroupKeys.has(gid) && !processedParts.has(part)) {
        const list = adHocGroupMap.get(gid) || [];
        list.push(part);
        adHocGroupMap.set(gid, list);
      }
    }

    for (const [gid, groupParts] of adHocGroupMap.entries()) {
      const childLines: string[] = [];
      for (const part of groupParts) {
        const mesh = meshByPart.get(part);
        if (mesh) {
          processedParts.add(part);
          this.appendPartNodeXml(childLines, mesh, '        ');
        }
      }

      if (childLines.length > 0) {
        const firstPart = groupParts[0];
        const cleanGroupName = this.sanitizeName(firstPart.groupName || firstPart.moduleName || `Modulo_${gid}`);
        const groupIdAttr = allocUniqueXmlId('group', gid);
        lines.push(`      <node id="${groupIdAttr}" name="${this.escapeXml(cleanGroupName)}" type="NODE">`);
        lines.push(...childLines);
        lines.push('      </node>');
      }
    }

    // 3c. Exportar piezas libres (!part.groupId && !part.moduleId) en grupo Tableros_Libres
    const freeParts = parts.filter(p => !processedParts.has(p));
    const freeChildLines: string[] = [];

    for (const part of freeParts) {
      const mesh = meshByPart.get(part);
      if (mesh) {
        processedParts.add(part);
        this.appendPartNodeXml(freeChildLines, mesh, '        ');
      }
    }

    // Solo emitir el nodo Tableros_Libres si existen piezas libres con mallas válidas
    if (freeChildLines.length > 0) {
      const freeGroupId = allocUniqueXmlId('group', 'tableros_libres');
      lines.push(`      <node id="${freeGroupId}" name="Tableros_Libres" type="NODE">`);
      lines.push(...freeChildLines);
      lines.push('      </node>');
    }

    lines.push('    </visual_scene>');
    lines.push('  </library_visual_scenes>');

    // <scene>
    lines.push('  <scene>');
    lines.push('    <instance_visual_scene url="#Scene" />');
    lines.push('  </scene>');
    lines.push('</COLLADA>');

    return lines.join('\n');
  }

  /**
   * Genera las líneas XML para instanciar una geometría con su enlace de material en la escena visual.
   */
  private appendPartNodeXml(lines: string[], mesh: PartMeshExportData, indent: string): void {
    lines.push(`${indent}<node id="${mesh.nodeId}" name="${this.escapeXml(mesh.cleanName)}" type="NODE">`);
    lines.push(`${indent}  <instance_geometry url="#${mesh.geomId}">`);
    lines.push(`${indent}    <bind_material>`);
    lines.push(`${indent}      <technique_common>`);
    lines.push(`${indent}        <instance_material symbol="mat_symbol_${mesh.materialId}" target="#${mesh.materialId}" />`);
    lines.push(`${indent}      </technique_common>`);
    lines.push(`${indent}    </bind_material>`);
    lines.push(`${indent}  </instance_geometry>`);
    lines.push(`${indent}</node>`);
  }

  /**
   * Construye los datos de malla triangular para una pieza, aplicando cortes especiales,
   * rotaciones, traslación al mundo y conversión al sistema Z-Up de SketchUp.
   */
  private buildPartMeshData(
    part: Part,
    project: MelamineProject,
    materialsMap: Map<string, SketchupExportMaterial>,
    geomId: string,
    nodeId: string
  ): PartMeshExportData | null {
    const cutouts = this.getCountertopCutouts(part, project);
    let rawGeom: THREE.BufferGeometry;

    // 1. Crear geometría base según forma (circular, extruida con cortes/desahogos, o caja 3D estándar)
    if (part.shapeType === 'circle') {
      const isRod =
        (part.name || '').toLowerCase().includes('tubo') ||
        (part.name || '').toLowerCase().includes('barra') ||
        (part.name || '').toLowerCase().includes('colgador');

      if (isRod) {
        const rodRadius = (part.thickness && part.thickness > 0) ? part.thickness / 2 : 12.5;
        const rodLength = Math.max(50, part.length || 600);
        const cylGeo = new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 32);
        // Tubo colgador extendido a lo largo del eje X
        cylGeo.rotateZ(Math.PI / 2);
        rawGeom = cylGeo;
      } else {
        // Tablero / mesa / tapa circular con espesor real (part.thickness) y caras horizontales
        const radius = part.radius || (part.diameter ? part.diameter / 2 : Math.max(10, (part.width || 600) / 2));
        const boardThickness = Math.max(1, part.thickness || 18);
        const cylGeo = new THREE.CylinderGeometry(radius, radius, boardThickness, 48);
        const orient = part.orientation || 'horizontal';
        if (orient === 'vertical_xy') {
          cylGeo.rotateX(Math.PI / 2);
        } else if (orient === 'vertical_yz') {
          cylGeo.rotateZ(Math.PI / 2);
        }
        // Para 'horizontal', la altura del cilindro ya está alineada con el eje Y (Three.js), caras en XZ
        rawGeom = cylGeo;
      }
    } else if (
      (part.cornerCutConfig && part.cornerCutConfig.type !== 'none') ||
      (part.shapeType === 'freehand' && part.contourPoints && part.contourPoints.length >= 3) ||
      cutouts.length > 0
    ) {
      rawGeom = this.partGeometry.buildExtrudedBoardGeometry(part, cutouts);
    } else {
      const localDims = this.partGeometry.getLocalDimensions(part);
      rawGeom = new THREE.BoxGeometry(localDims.sx, localDims.sy, localDims.sz);
    }

    const geom = rawGeom.clone();
    rawGeom.dispose();

    // 2. Aplicar rotaciones Euler si la pieza está rotada
    if (part.rotationX || part.rotationY || part.rotationZ) {
      const rx = THREE.MathUtils.degToRad(part.rotationX || 0);
      const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
      const rz = THREE.MathUtils.degToRad(part.rotationZ || 0);
      const euler = new THREE.Euler(rx, ry, rz, 'XYZ');
      const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(euler);
      geom.applyMatrix4(rotMatrix);
    }

    // 3. Aplicar traslación a posición en el mundo de Three.js (px, py, pz)
    const baseBounds = this.partGeometry.getWorldAABB(part);
    geom.translate(baseBounds.px, baseBounds.py, baseBounds.pz);

    // 4. Conversión de coordenadas de Three.js (Y-Up) a SketchUp (Z-Up):
    // X_skp = X, Y_skp = -Z, Z_skp = Y
    geom.applyMatrix4(this.toSketchupMatrix);

    // 5. Convertir a malla no-indexada para exportación limpia de caras triangulares
    const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
    if (!nonIndexed.getAttribute('normal')) {
      nonIndexed.computeVertexNormals();
    }

    const posAttr = nonIndexed.getAttribute('position');
    const normAttr = nonIndexed.getAttribute('normal');
    if (!posAttr || posAttr.count === 0) {
      geom.dispose();
      if (nonIndexed !== geom) nonIndexed.dispose();
      return null;
    }

    const vertexCount = posAttr.count;
    const triangleCount = Math.floor(vertexCount / 3);

    const posValues: string[] = [];
    const normValues: string[] = [];
    for (let i = 0; i < vertexCount; i++) {
      posValues.push(
        posAttr.getX(i).toFixed(3),
        posAttr.getY(i).toFixed(3),
        posAttr.getZ(i).toFixed(3)
      );
      normValues.push(
        normAttr.getX(i).toFixed(4),
        normAttr.getY(i).toFixed(4),
        normAttr.getZ(i).toFixed(4)
      );
    }

    const indexPairs: string[] = [];
    for (let t = 0; t < triangleCount; t++) {
      const i0 = t * 3;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      indexPairs.push(`${i0} ${i0} ${i1} ${i1} ${i2} ${i2}`);
    }

    geom.dispose();
    if (nonIndexed !== geom) {
      nonIndexed.dispose();
    }

    const cleanPartName = this.sanitizeName(part.name || 'Pieza');

    // Resolver ID del material
    const resolvedMat = this.resolvePartMaterial(part, project);
    const registeredMat = materialsMap.get(resolvedMat.id) || resolvedMat;

    return {
      part,
      geomId,
      nodeId,
      cleanName: cleanPartName,
      materialId: registeredMat.id,
      vertexCount,
      triangleCount,
      positionsStr: posValues.join(' '),
      normalsStr: normValues.join(' '),
      indicesStr: indexPairs.join(' ')
    };
  }

  /**
   * Detecta y calcula perforaciones automáticas en mesones para alojar lavaplatos o cubiertas.
   */
  private getCountertopCutouts(part: Part, project: MelamineProject): CountertopCutoutHole[] {
    const isHorizontalSurface = (part.orientation || 'horizontal') === 'horizontal';
    const role = part.componentRole || 'free';
    const nameLow = (part.name || '').toLowerCase();
    const isCountertopOrCover =
      isHorizontalSurface &&
      (role === 'countertop' ||
        role === 'top' ||
        nameLow.includes('mesón') ||
        nameLow.includes('meson') ||
        nameLow.includes('encimera') ||
        nameLow.includes('cubierta'));

    if (!isCountertopOrCover || !project?.appliances || project.appliances.length === 0) {
      return [];
    }

    const cutoutAppliances = project.appliances.filter(
      a => a.type === 'sink' || a.type === 'cooktop'
    );
    if (cutoutAppliances.length === 0) {
      return [];
    }

    const baseBounds = this.partGeometry.getWorldAABB(part);
    const localDims = this.partGeometry.getLocalDimensions(part);
    const px = baseBounds.px;
    const py = baseBounds.py;
    const pz = baseBounds.pz;
    const partTopY = py + baseBounds.sy / 2;

    const rotYRad = THREE.MathUtils.degToRad(part.rotationY || 0);
    const cosY = Math.cos(-rotYRad);
    const sinY = Math.sin(-rotYRad);

    const cutouts: CountertopCutoutHole[] = [];

    for (const app of cutoutAppliances) {
      if (Math.abs(app.position.y - partTopY) > 180) continue;

      const dxWorld = app.position.x - px;
      const dzWorld = app.position.z - pz;
      const localX = dxWorld * cosY - dzWorld * sinY;
      const localZ = dxWorld * sinY + dzWorld * cosY;

      const appRot = (((app.rotation || 0) % 360) + 360) % 360;
      const appSpanX = appRot === 90 || appRot === 270 ? app.depth : app.width;
      const appSpanZ = appRot === 90 || appRot === 270 ? app.width : app.depth;

      const holeW = Math.max(80, appSpanX - 48);
      const holeD = Math.max(80, appSpanZ - 48);

      if (Math.abs(localX) < localDims.sx / 2 && Math.abs(localZ) < localDims.sz / 2) {
        cutouts.push({ localX, localZ, holeW, holeD });
      }
    }

    return cutouts;
  }

  /**
   * Resuelve todos los materiales requeridos por las piezas del proyecto y los indexa por su ID único.
   */
  private resolveProjectMaterials(parts: Part[], project: MelamineProject): Map<string, SketchupExportMaterial> {
    const materialsMap = new Map<string, SketchupExportMaterial>();

    for (const part of parts) {
      const mat = this.resolvePartMaterial(part, project);
      if (!materialsMap.has(mat.id)) {
        materialsMap.set(mat.id, mat);
      }
    }

    // Incluir también materiales definidos en project.materials para tenerlos en la paleta de SketchUp
    for (const projMat of (project?.materials || [])) {
      if (projMat && projMat.id) {
        const matId = `mat_${this.sanitizeXmlId(projMat.id)}`;
        if (!materialsMap.has(matId)) {
          const rgb = this.hexToRgb(projMat.colorHex || '#d4d4d8');
          materialsMap.set(matId, {
            id: matId,
            name: this.sanitizeName(projMat.name || 'Material'),
            colorHex: projMat.colorHex || '#d4d4d8',
            r: rgb.r,
            g: rgb.g,
            b: rgb.b
          });
        }
      }
    }

    // Si no hay piezas ni materiales en el proyecto, proveer al menos el material predeterminado
    if (materialsMap.size === 0) {
      const defMat: SketchupExportMaterial = {
        id: 'mat_melamina_estandar',
        name: 'Melamina_Estandar',
        colorHex: '#d4d4d8',
        r: 0.831,
        g: 0.831,
        b: 0.847
      };
      materialsMap.set(defMat.id, defMat);
    }

    return materialsMap;
  }

  /**
   * Resuelve el material y color RGB de una pieza desde el proyecto o el catálogo de melaminas.
   */
  private resolvePartMaterial(part: Part, project: MelamineProject): SketchupExportMaterial {
    let matName = (part.materialName || '').trim();
    let colorHex = part.colorHex;

    // 1. Buscar en project.materials
    const projMat = (project?.materials || []).find(m => m.id === part.materialId);
    if (projMat) {
      if (!matName) matName = projMat.name;
      if (!colorHex || colorHex === '#d4d4d8') colorHex = projMat.colorHex;
    }

    // 2. Buscar en MELAMINE_MATERIALS_CATALOG
    const catMat = MELAMINE_MATERIALS_CATALOG.find(
      m => m.id === part.materialId || (matName && m.name.toLowerCase() === matName.toLowerCase())
    );
    if (catMat) {
      if (!matName) matName = catMat.name;
      if (!colorHex || colorHex === '#d4d4d8') colorHex = catMat.colorHex;
    }

    if (!matName) {
      matName = 'Melamina_Estandar';
    }
    if (!colorHex) {
      colorHex = '#d4d4d8';
    }

    const cleanMatName = this.sanitizeName(matName);
    const colorKey = (colorHex || '#d4d4d8').replace('#', '').toLowerCase();
    const rawId = part.materialId || `${cleanMatName}_${colorKey}`;
    const matId = `mat_${this.sanitizeXmlId(rawId)}`;
    const rgb = this.hexToRgb(colorHex);

    return {
      id: matId,
      name: cleanMatName,
      colorHex,
      r: rgb.r,
      g: rgb.g,
      b: rgb.b
    };
  }

  /**
   * Convierte un código hexadecimal (#RRGGBB o #RGB) a componentes normalizados [0.0 .. 1.0].
   */
  hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = (hex || '').replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) / 255;
      const g = parseInt(clean[1] + clean[1], 16) / 255;
      const b = parseInt(clean[2] + clean[2], 16) / 255;
      return {
        r: Math.round((r || 0) * 1000) / 1000,
        g: Math.round((g || 0) * 1000) / 1000,
        b: Math.round((b || 0) * 1000) / 1000
      };
    }

    const num = parseInt(clean, 16);
    if (isNaN(num)) {
      return { r: 0.831, g: 0.831, b: 0.847 };
    }

    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;
    return {
      r: Math.round(r * 1000) / 1000,
      g: Math.round(g * 1000) / 1000,
      b: Math.round(b * 1000) / 1000
    };
  }

  /**
   * Sanitiza identificadores XML para cumplir con la especificación xs:ID.
   */
  sanitizeXmlId(id: string): string {
    const cleaned = (id || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!cleaned) {
      return 'id_item';
    }
    return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `id_${cleaned}`;
  }

  /**
   * Sanitiza nombres legibles para los atributos name de SketchUp (Outliner / Bandeja de Materiales).
   */
  sanitizeName(name: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Objeto';

    const clean = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\/-]+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/^_+|_+$/g, '');

    return clean || 'Objeto';
  }

  /**
   * Escapa caracteres reservados en XML.
   */
  private escapeXml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
