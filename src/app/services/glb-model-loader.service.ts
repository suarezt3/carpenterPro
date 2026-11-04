import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ApplianceItem } from '../models/melamine.models';

@Injectable({
  providedIn: 'root'
})
export class GlbModelLoaderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private loader: GLTFLoader | null = null;
  private readonly rawModelCache = new Map<string, THREE.Group>();
  private readonly pendingLoads = new Map<string, Promise<THREE.Group>>();
  private readonly BASE_MODELS_PATH = 'models/appliances/';

  constructor() {
    if (this.isBrowser) {
      this.loader = new GLTFLoader();
    }
  }

  /**
   * Resuelve la URL o ruta final del modelo .glb.
   * Si es una URL absoluta o ruta raíz, se mantiene; de lo contrario se asume `public/models/appliances/`.
   */
  resolveModelUrl(modelNameOrPath: string): string {
    const trimmed = modelNameOrPath.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return `${this.BASE_MODELS_PATH}${trimmed}`;
  }

  /**
   * Verifica si el archivo .glb ya está descargado y parseado en memoria.
   */
  isModelCached(modelNameOrPath: string): boolean {
    const url = this.resolveModelUrl(modelNameOrPath);
    return this.rawModelCache.has(url);
  }

  /**
   * Carga el archivo .glb de forma asíncrona, gestionando caché y llamadas duplicadas.
   */
  async loadRawModel(modelNameOrPath: string): Promise<THREE.Group> {
    if (!this.isBrowser || !this.loader) {
      return new THREE.Group();
    }

    const url = this.resolveModelUrl(modelNameOrPath);

    // Si ya está en caché, retornar inmediatamente
    const cached = this.rawModelCache.get(url);
    if (cached) {
      return cached;
    }

    // Si ya hay una carga en progreso para esta misma URL, reusar su promesa
    const pending = this.pendingLoads.get(url);
    if (pending) {
      return pending;
    }

    const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader!.load(
        url,
        (gltf) => {
          const scene = gltf.scene || gltf.scenes?.[0];
          if (!scene) {
            reject(new Error(`No scene found in GLB: ${url}`));
            return;
          }

          // Optimizar mallas del modelo (sombras, preservación de materiales y protección GPU contra dispose)
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              if (child.geometry) {
                child.geometry.userData = { ...(child.geometry.userData || {}), isShared: true };
              }

              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => {
                    m.userData = { ...(m.userData || {}), isShared: true };
                    m.needsUpdate = true;
                  });
                } else {
                  child.material.userData = { ...(child.material.userData || {}), isShared: true };
                  child.material.needsUpdate = true;
                }
              }
            }
          });

          this.rawModelCache.set(url, scene);
          this.pendingLoads.delete(url);
          resolve(scene);
        },
        undefined,
        (err) => {
          this.pendingLoads.delete(url);
          console.warn(`[GlbModelLoaderService] No se pudo cargar el modelo '${url}'. Se usará fallback procedural.`, err);
          reject(err);
        }
      );
    });

    this.pendingLoads.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Genera sincrónicamente un grupo de Three.js a partir del modelo en caché si existe.
   * Si no está en caché, retorna null para que el visor use el fallback procedural mientras carga.
   */
  getCachedApplianceGroup(appliance: ApplianceItem): THREE.Group | null {
    if (!appliance.glbModel) return null;
    const url = this.resolveModelUrl(appliance.glbModel);
    const cachedScene = this.rawModelCache.get(url);
    if (!cachedScene) return null;

    return this.buildGlbApplianceGroup(appliance, cachedScene);
  }

  /**
   * Carga el modelo y construye el grupo normalizado adaptado a las medidas y reglas de CarpenterPro.
   */
  async loadAndBuildAppliance(appliance: ApplianceItem): Promise<THREE.Group | null> {
    if (!appliance.glbModel) return null;
    try {
      const rawScene = await this.loadRawModel(appliance.glbModel);
      return this.buildGlbApplianceGroup(appliance, rawScene);
    } catch {
      return null;
    }
  }

  /**
   * Normaliza el modelo .glb:
   * 1. Centra en X y Z.
   * 2. Ajusta la base a Y = 0 (suelo o plano de soporte).
   * 3. Aplica Escalado Inteligente Proporcional (Fit) para ajustarse a las medidas milimétricas sin distorsión.
   * 4. Incorpora hitbox transparente para selección y raycasting confiable en CarpenterPro.
   */
  buildGlbApplianceGroup(appliance: ApplianceItem, rawScene: THREE.Group): THREE.Group {
    const root = new THREE.Group();
    root.name = `appliance_glb_${appliance.id}`;

    // Clonar jerarquía (Three.js clone(true) comparte geometrías y texturas en VRAM)
    const clonedModel = rawScene.clone(true);

    // Aplicar corrección angular fija si el modelo viene rotado de origen
    if (appliance.modelRotationFix) {
      clonedModel.rotation.y = THREE.MathUtils.degToRad(appliance.modelRotationFix);
      clonedModel.updateMatrixWorld(true);
    }

    // Calcular BoundingBox de la malla clonada
    const box = new THREE.Box3().setFromObject(clonedModel);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Evitar divisiones por cero
    const modelW = Math.max(size.x, 0.001);
    const modelH = Math.max(size.y, 0.001);
    const modelD = Math.max(size.z, 0.001);

    // Escalado Inteligente Proporcional (Fit): Se ajusta al volumen sin deformar la geometría
    const targetW = Math.max(appliance.width, 10);
    const targetH = Math.max(appliance.height, 10);
    const targetD = Math.max(appliance.depth, 10);

    const scaleFactor = Math.min(
      targetW / modelW,
      targetH / modelH,
      targetD / modelD
    );

    // Contenedor interior para la normalización del pivote
    const innerWrapper = new THREE.Group();
    innerWrapper.name = 'glb_inner_wrapper';

    // Desplazar el modelo para que:
    // - Centro en X = 0
    // - Base en Y = 0 (el punto más bajo toca exactamente el piso)
    // - Centro en Z = 0
    const offX = appliance.modelOffset?.x || 0;
    const offY = appliance.modelOffset?.y || 0;
    const offZ = appliance.modelOffset?.z || 0;

    clonedModel.position.set(
      -center.x + offX,
      -box.min.y + offY,
      -center.z + offZ
    );

    innerWrapper.scale.setScalar(scaleFactor);
    innerWrapper.add(clonedModel);
    root.add(innerWrapper);

    // HitBox envolvente transparente para selección y raycasting exacto
    const hitGeo = new THREE.BoxGeometry(targetW, targetH, targetD);
    hitGeo.userData = { isShared: true };
    const hitMat = new THREE.MeshBasicMaterial({
      visible: false,
      wireframe: false
    });
    hitMat.userData = { isShared: true };
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.name = 'raycast_hitbox';
    hitMesh.position.set(0, targetH / 2, 0);
    hitMesh.userData = {
      isRaycastTarget: true,
      applianceId: appliance.id
    };
    root.add(hitMesh);

    // Guardar referencia en userData
    root.userData = {
      appliance,
      isGlbModel: true,
      scaleFactor
    };

    return root;
  }

  /**
   * Limpia la memoria caché de modelos si es necesario.
   */
  clearCache(): void {
    this.rawModelCache.clear();
    this.pendingLoads.clear();
  }
}
