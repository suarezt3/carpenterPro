import { Injectable } from '@angular/core';
import { Part, Material } from '../models/melamine.models';

export interface FurnitureTemplate {
  id: string;
  name: string;
  category: 'cocina' | 'cajones' | 'bano' | 'closets' | 'sala_tv' | 'oficina';
  categoryLabel: string;
  dimensions: { width: number; height: number; depth: number };
  description: string;
  icon: string;
  badge: string;
  partsCount: number;
  previewColor?: { top: string; body: string; front: string; accent?: string };
  generateParts: (materials: Material[], offsetX?: number) => Part[];
}

@Injectable({
  providedIn: 'root'
})
export class TemplatesCatalogService {

  private getMaterial(materials: Material[], prefName: string): { id: string; name: string; thickness: number } {
    const found = materials.find(m => m.name.toLowerCase().includes(prefName.toLowerCase()));
    if (found) {
      return { id: found.id, name: found.name, thickness: found.thickness };
    }
    const def = materials[0] || { id: 'mat_default', name: 'Melamina Blanca 18mm', thickness: 18 };
    return { id: def.id, name: def.name, thickness: def.thickness };
  }

  readonly templates: FurnitureTemplate[] = [
    // --- 1. COCINA ---
    {
      id: 'cocina_bajo_mesada_120',
      name: 'Bajo Mesada 2 Puertas + Cajonera 3 Cajones',
      category: 'cocina',
      categoryLabel: 'Cocina',
      dimensions: { width: 1200, height: 850, depth: 600 },
      description: 'Módulo principal de cocina con sector de puertas con balda intermedia y cajonera triple.',
      icon: 'countertops',
      badge: 'Estándar',
      partsCount: 14,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const t = mat.thickness || 18;
        return [
          {
            id: 'bm_cubierta_' + crypto.randomUUID().slice(0, 6),
            name: 'ENCIMERA / CUBIERTA',
            length: 1200, width: 600, thickness: t, quantity: 1,
            materialId: matTop.id, materialName: matTop.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 841, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'bm_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 814, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - 591, posY: 416, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'bm_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 814, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + 591, posY: 416, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'bm_division_' + crypto.randomUUID().slice(0, 6),
            name: 'DIVISIÓN CENTRAL',
            length: 716, width: 560, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 182, posY: 456, posZ: 0, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'bm_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 1164, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'bm_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO FRONTAL',
            length: 1164, width: 80, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 40, posZ: 250, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'bm_estante_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE REGULABLE (Sector Puertas)',
            length: 755, width: 540, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX - 204, posY: 450, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'bm_faja_del_' + crypto.randomUUID().slice(0, 6),
            name: 'FAJA AMARRE SUPERIOR DELANTERA',
            length: 1164, width: 100, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 823, posZ: 240, orientation: 'horizontal', componentRole: 'tie'
          },
          {
            id: 'bm_faja_tra_' + crypto.randomUUID().slice(0, 6),
            name: 'FAJA AMARRE SUPERIOR TRASERA',
            length: 1164, width: 100, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 823, posZ: -240, orientation: 'horizontal', componentRole: 'tie'
          },
          {
            id: 'bm_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA IZQUIERDA',
            length: 728, width: 378, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 395, posY: 463, posZ: 299, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'bm_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA DERECHA',
            length: 728, width: 378, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 13, posY: 463, posZ: 299, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'bm_cajon_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN SUPERIOR (Cubiertos)',
            length: 140, width: 396, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 390, posY: 757, posZ: 299, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'bm_cajon_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN MEDIO',
            length: 290, width: 396, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 390, posY: 538, posZ: 299, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'bm_cajon_3_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN OLLERO INFERIOR',
            length: 290, width: 396, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 390, posY: 244, posZ: 299, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'cocina_alacena_80',
      name: 'Alacena Aérea 2 Puertas con Repisa',
      category: 'cocina',
      categoryLabel: 'Cocina',
      dimensions: { width: 800, height: 700, depth: 320 },
      description: 'Mueble aéreo de cocina con doble puerta batiente y estante interior regulable.',
      icon: 'kitchen',
      badge: 'Aéreo',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'al_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 764, width: 298, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 691, posZ: 10, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'al_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'BASE INFERIOR',
            length: 764, width: 298, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 10, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'al_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 700, width: 320, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 391, posY: 350, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'al_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 700, width: 320, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 391, posY: 350, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'al_estante_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE INTERMEDIO',
            length: 764, width: 290, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 350, posZ: 10, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'al_fondo_' + crypto.randomUUID().slice(0, 6),
            name: 'FONDO TRASERO',
            length: 680, width: 780, thickness: 3, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 350, posZ: -150, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'al_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA IZQUIERDA',
            length: 696, width: 396, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 199, posY: 350, posZ: 169, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'al_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA DERECHA',
            length: 696, width: 396, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 199, posY: 350, posZ: 169, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'cocina_torre_horno',
      name: 'Torre Despensero para Microondas y Horno',
      category: 'cocina',
      categoryLabel: 'Cocina',
      dimensions: { width: 600, height: 2100, depth: 600 },
      description: 'Módulo columna vertical con nichos reforzados para horno empotrado, microondas y despensas superior e inferior.',
      icon: 'microwave',
      badge: 'Torre',
      partsCount: 11,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'th_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 2100, width: 600, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 291, posY: 1050, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'th_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 2100, width: 600, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 291, posY: 1050, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'th_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 564, width: 600, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 2091, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'th_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 564, width: 600, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'th_base_horno_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE SOPORTE HORNO',
            length: 564, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 750, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'th_base_micro_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE SOPORTE MICROONDAS',
            length: 564, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1350, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'th_repisa_sup_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE DESPENSERO SUPERIOR',
            length: 564, width: 560, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1750, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'th_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 564, width: 80, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 40, posZ: 250, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'th_puerta_inf_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA INFERIOR DESPENSERA',
            length: 650, width: 596, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 419, posZ: 309, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'th_puerta_sup_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA SUPERIOR ALACENA',
            length: 730, width: 596, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 1724, posZ: 309, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'cocina_esquinero_l',
      name: 'Mueble Esquinero en L para Cocina',
      category: 'cocina',
      categoryLabel: 'Cocina',
      dimensions: { width: 900, height: 850, depth: 900 },
      description: 'Módulo rinconero en ángulo recto para optimizar la esquina de cocina con máxima capacidad de almacenaje.',
      icon: 'turn_slight_right',
      badge: 'Rinconero',
      partsCount: 9,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const t = mat.thickness || 18;
        return [
          {
            id: 'esq_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'ENCIMERA ESQUINA L',
            length: 900, width: 900, thickness: t, quantity: 1,
            materialId: matTop.id, materialName: matTop.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 841, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'esq_fondo_tras_' + crypto.randomUUID().slice(0, 6),
            name: 'RESPALDO TRASERO 1',
            length: 882, width: 814, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 416, posZ: -441, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'esq_fondo_lat_' + crypto.randomUUID().slice(0, 6),
            name: 'RESPALDO TRASERO 2',
            length: 814, width: 864, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX - 441, posY: 416, posZ: 9, orientation: 'vertical_yz', componentRole: 'back'
          },
          {
            id: 'esq_costado_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL TERMINAL DERECHO',
            length: 814, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + 441, posY: 416, posZ: 150, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'esq_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO EN L',
            length: 864, width: 864, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'esq_estante_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE INTERMEDIO EN L',
            length: 840, width: 840, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 450, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'esq_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA ARTICULADA 1',
            length: 728, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 270, posY: 463, posZ: 449, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'cocina_isla_desayunador',
      name: 'Isla Central de Cocina con Barra y Nichos',
      category: 'cocina',
      categoryLabel: 'Cocina',
      dimensions: { width: 1500, height: 900, depth: 800 },
      description: 'Isla moderna con voladizo para 2 taburetes, repisas decorativas abiertas y puertas inferiores.',
      icon: 'table_restaurant',
      badge: 'Isla',
      partsCount: 10,
      generateParts: (mats, offsetX = 0) => {
        const matWood = this.getMaterial(mats, 'roble');
        const matDark = this.getMaterial(mats, 'antracita') || this.getMaterial(mats, 'blanco');
        const t = matWood.thickness || 18;
        return [
          {
            id: 'isl_mesada_' + crypto.randomUUID().slice(0, 6),
            name: 'ENCIMERA VOLADIZO BARRA',
            length: 1500, width: 800, thickness: 36, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 882, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'isl_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL CASCADA IZQUIERDO',
            length: 864, width: 550, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 741, posY: 432, posZ: -100, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'isl_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 864, width: 550, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 741, posY: 432, posZ: -100, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'isl_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 1464, width: 550, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: -100, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'isl_division_' + crypto.randomUUID().slice(0, 6),
            name: 'DIVISOR INTERNO',
            length: 766, width: 530, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 481, posZ: -100, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'isl_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA IZQUIERDA',
            length: 760, width: 726, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 365, posY: 476, posZ: 184, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'isl_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA DERECHA',
            length: 760, width: 726, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 365, posY: 476, posZ: 184, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },

    // --- 2. CAJONES Y CAJONERAS ---
    {
      id: 'cajonera_modulo_3cajones',
      name: 'Cajonera Estándar 3 Cajones',
      category: 'cajones',
      categoryLabel: 'Cajoneras y Cajones',
      dimensions: { width: 500, height: 720, depth: 500 },
      description: 'Módulo cajonero de piso con zócalo, cubierta y 3 frentes de cajón con correderas telescópicas para dormitorio u oficina.',
      icon: 'table_rows',
      badge: '3 Cajones',
      partsCount: 9,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const t = mat.thickness || 18;
        return [
          {
            id: 'caj3_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR',
            length: 500, width: 500, thickness: t, quantity: 1,
            materialId: matTop.id, materialName: matTop.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 711, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'caj3_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 684, width: 480, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - 241, posY: 351, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'caj3_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 684, width: 480, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + 241, posY: 351, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'caj3_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 464, width: 480, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 79, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'caj3_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO FRONTAL',
            length: 464, width: 70, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 35, posZ: 200, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'caj3_amarre_' + crypto.randomUUID().slice(0, 6),
            name: 'FAJA AMARRE SUPERIOR',
            length: 464, width: 80, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 693, posZ: -180, orientation: 'horizontal', componentRole: 'tie'
          },
          {
            id: 'caj3_caj_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 1 (SUPERIOR)',
            length: 460, width: 198, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 590, posZ: 241, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'caj3_caj_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 2 (MEDIO)',
            length: 460, width: 198, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 390, posZ: 241, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'caj3_caj_3_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 3 (INFERIOR)',
            length: 460, width: 198, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 190, posZ: 241, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'cajonera_chifonier_4cajones',
      name: 'Chifonier / Cajonera 4 Cajones Alta',
      category: 'cajones',
      categoryLabel: 'Cajoneras y Cajones',
      dimensions: { width: 800, height: 950, depth: 450 },
      description: 'Mueble vertical de 4 amplios cajones con gran capacidad para ropa, toallas y lencería con tapa engrosada.',
      icon: 'layers',
      badge: '4 Cajones',
      partsCount: 10,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const t = mat.thickness || 18;
        return [
          {
            id: 'chif_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR ENGROSADA',
            length: 800, width: 450, thickness: t, quantity: 1,
            materialId: matTop.id, materialName: matTop.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 941, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'chif_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 914, width: 430, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - 391, posY: 466, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'chif_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 914, width: 430, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + 391, posY: 466, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'chif_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 764, width: 410, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 79, posZ: -10, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'chif_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 764, width: 70, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 35, posZ: 175, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'chif_amarre_' + crypto.randomUUID().slice(0, 6),
            name: 'FAJA AMARRE SUPERIOR',
            length: 764, width: 90, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 923, posZ: -150, orientation: 'horizontal', componentRole: 'tie'
          },
          {
            id: 'chif_caj_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 1 (SUPERIOR)',
            length: 760, width: 200, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 805, posZ: 216, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'chif_caj_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 2',
            length: 760, width: 200, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 595, posZ: 216, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'chif_caj_3_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 3',
            length: 760, width: 200, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 385, posZ: 216, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'chif_caj_4_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 4 (INFERIOR)',
            length: 760, width: 200, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 175, posZ: 216, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'cajon_individual_armado',
      name: 'Cajón Individual Completo Armado',
      category: 'cajones',
      categoryLabel: 'Cajoneras y Cajones',
      dimensions: { width: 500, height: 180, depth: 450 },
      description: 'Estructura técnica completa de cajón: Frente exterior de melamina 18mm, 2 costados, contrafrente y fondo ranurado con holguras reales para correderas telescópicas.',
      icon: 'inbox',
      badge: 'Despiece Cajón',
      partsCount: 5,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matFront = this.getMaterial(mats, 'roble') || mat;
        const t = mat.thickness || 18;
        return [
          {
            id: 'caj_ind_frente_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE EXTERIOR DE CAJÓN',
            length: 500, width: 180, thickness: t, quantity: 1,
            materialId: matFront.id, materialName: matFront.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 90, posZ: 216, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'caj_ind_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL / COSTADO IZQUIERDO CAJÓN',
            length: 140, width: 412, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - 206, posY: 75, posZ: 1, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'caj_ind_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL / COSTADO DERECHO CAJÓN',
            length: 140, width: 412, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + 206, posY: 75, posZ: 1, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'caj_ind_contra_' + crypto.randomUUID().slice(0, 6),
            name: 'CONTRAFRENTE TRASERO CAJÓN',
            length: 394, width: 140, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 75, posZ: -196, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'caj_ind_fondo_' + crypto.randomUUID().slice(0, 6),
            name: 'FONDO DE CAJÓN (MDF 6mm)',
            length: 394, width: 394, thickness: 6, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 8, posZ: 10, orientation: 'horizontal', componentRole: 'bottom'
          }
        ];
      }
    },
    {
      id: 'cocina_gavetero_ollero',
      name: 'Gavetero Ollero 2 Gavetas para Cocina',
      category: 'cajones',
      categoryLabel: 'Cajoneras y Cajones',
      dimensions: { width: 900, height: 850, depth: 600 },
      description: 'Módulo bajo de cocina reforzado con 2 grandes gavetas caceroleras de alta profundidad para ollas y electrodomésticos.',
      icon: 'kitchen',
      badge: 'Cacerolero Cocina',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const t = mat.thickness || 18;
        return [
          {
            id: 'oll_cubierta_' + crypto.randomUUID().slice(0, 6),
            name: 'ENCIMERA / CUBIERTA',
            length: 900, width: 600, thickness: t, quantity: 1,
            materialId: matTop.id, materialName: matTop.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 841, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'oll_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 814, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - 441, posY: 416, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'oll_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 814, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + 441, posY: 416, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'oll_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 864, width: 580, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'oll_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 864, width: 80, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 40, posZ: 250, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'oll_amarre_del_' + crypto.randomUUID().slice(0, 6),
            name: 'FAJA AMARRE DELANTERA',
            length: 864, width: 100, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 823, posZ: 220, orientation: 'horizontal', componentRole: 'tie'
          },
          {
            id: 'oll_gaveta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE GAVETA 1 CACEROLERA (SUPERIOR)',
            length: 860, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 632, posZ: 291, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'oll_gaveta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE GAVETA 2 OLLERA (INFERIOR)',
            length: 860, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 277, posZ: 291, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },

    // --- 3. BAÑO ---
    {
      id: 'bano_vanitory_flotante',
      name: 'Vanitory Flotante con Cajón y Repisa Inferior',
      category: 'bano',
      categoryLabel: 'Baño',
      dimensions: { width: 700, height: 550, depth: 450 },
      description: 'Mueble suspendido para lavabo de apoyo con cajón superior con corte para sifón y repisa inferior para toallas.',
      icon: 'wash',
      badge: 'Flotante',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'van_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR (LAVABO)',
            length: 700, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 541, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'van_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 532, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 341, posY: 266, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'van_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 532, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 341, posY: 266, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'van_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO / BASE TOALLERA',
            length: 664, width: 430, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'van_estante_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE DIVISOR CAJÓN',
            length: 664, width: 430, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 250, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'van_cajon_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN SUPERIOR',
            length: 270, width: 694, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 395, posZ: 234, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'bano_gabinete_espejo',
      name: 'Gabinete Aéreo de Baño con Espejo',
      category: 'bano',
      categoryLabel: 'Baño',
      dimensions: { width: 600, height: 650, depth: 160 },
      description: 'Botiquín / mueble aéreo de profundidad reducida con puerta para espejo y 2 repisas interiores.',
      icon: 'crop_portrait',
      badge: 'Botiquín',
      partsCount: 7,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'gb_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 564, width: 160, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 641, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'gb_base_' + crypto.randomUUID().slice(0, 6),
            name: 'BASE INFERIOR',
            length: 564, width: 160, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'gb_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 650, width: 160, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 291, posY: 325, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'gb_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 650, width: 160, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 291, posY: 325, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'gb_repisa_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA INTERNA',
            length: 564, width: 140, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 325, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'gb_puerta_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA PARA ESPEJO',
            length: 646, width: 596, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 325, posZ: 89, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'bano_columna_auxiliar',
      name: 'Mueble Columna Auxiliar de Baño',
      category: 'bano',
      categoryLabel: 'Baño',
      dimensions: { width: 350, height: 1600, depth: 300 },
      description: 'Torre estrecha multiuso con puerta superior, nicho abierto central y puerta inferior para toallas y cosmética.',
      icon: 'view_column',
      badge: 'Columna',
      partsCount: 9,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'col_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 1600, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 166, posY: 800, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'col_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 1600, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 166, posY: 800, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'col_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 314, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1591, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'col_base_' + crypto.randomUUID().slice(0, 6),
            name: 'BASE INFERIOR',
            length: 314, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'col_estante_1_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE CENTRAL 1',
            length: 314, width: 280, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 600, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'col_estante_2_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE CENTRAL 2',
            length: 314, width: 280, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1000, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'col_puerta_inf_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA INFERIOR',
            length: 580, width: 346, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 300, posZ: 159, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'col_puerta_sup_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA SUPERIOR',
            length: 580, width: 346, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 1300, posZ: 159, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'bano_sobre_inodoro',
      name: 'Mueble Organizador sobre Inodoro y Toallero',
      category: 'bano',
      categoryLabel: 'Baño',
      dimensions: { width: 650, height: 1700, depth: 250 },
      description: 'Mueble alto con espacio inferior libre para inodoro/lavadora, 2 puertas intermedias y repisas superiores.',
      icon: 'inventory_2',
      badge: 'Organizador',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'so_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 1700, width: 250, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 316, posY: 850, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'so_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 1700, width: 250, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 316, posY: 850, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'so_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 614, width: 250, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1691, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'so_rep_sup_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA SUPERIOR ABIERTA',
            length: 614, width: 240, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1400, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'so_base_gabinete_' + crypto.randomUUID().slice(0, 6),
            name: 'BASE GABINETE CERRADO',
            length: 614, width: 240, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 900, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'so_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA IZQUIERDA',
            length: 490, width: 304, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 153, posY: 1150, posZ: 134, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'so_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA DERECHA',
            length: 490, width: 304, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 153, posY: 1150, posZ: 134, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'so_travesano_' + crypto.randomUUID().slice(0, 6),
            name: 'TRAVESAÑO INFERIOR ESTRUCTURAL',
            length: 614, width: 100, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 150, posZ: -100, orientation: 'vertical_xy', componentRole: 'tie'
          }
        ];
      }
    },

    // --- 3. CLOSETS Y DORMITORIO ---
    {
      id: 'closet_ropero_2cuerpos',
      name: 'Closet / Ropero 2 Cuerpos con Maletero y Perchero',
      category: 'closets',
      categoryLabel: 'Closet / Dormitorio',
      dimensions: { width: 1600, height: 2200, depth: 550 },
      description: 'Placard completo de dormitorio con maletero superior, barral perchero largo y 4 estantes en cuerpo derecho.',
      icon: 'door_sliding',
      badge: 'Ropero Completo',
      partsCount: 13,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'roble') || mat;
        const t = mat.thickness || 18;
        return [
          {
            id: 'cl_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 1564, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 2191, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'cl_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 1564, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'cl_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 2200, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 791, posY: 1100, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'cl_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 2200, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 791, posY: 1100, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'cl_division_' + crypto.randomUUID().slice(0, 6),
            name: 'DIVISIÓN CENTRAL',
            length: 2084, width: 530, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1140, posZ: 0, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'cl_maletero_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE MALETERO IZQUIERDO',
            length: 773, width: 530, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX - 395, posY: 1800, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'cl_maletero_der_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE MALETERO DERECHO',
            length: 773, width: 530, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 395, posY: 1800, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'cl_repisa_1_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA DERECHA 1',
            length: 773, width: 510, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 395, posY: 1350, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'cl_repisa_2_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA DERECHA 2',
            length: 773, width: 510, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 395, posY: 900, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'cl_repisa_3_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA DERECHA 3 (ZAPATERO)',
            length: 773, width: 510, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 395, posY: 450, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'cl_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 1564, width: 80, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 40, posZ: 220, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'cl_puerta_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA IZQUIERDA',
            length: 2095, width: 792, thickness: t, quantity: 1,
            materialId: matDoor.id, materialName: matDoor.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 398, posY: 1145, posZ: 284, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'cl_puerta_der_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA DERECHA',
            length: 2095, width: 792, thickness: t, quantity: 1,
            materialId: matDoor.id, materialName: matDoor.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 398, posY: 1145, posZ: 284, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'dormitorio_comoda_4cajones',
      name: 'Cómoda / Chifonier 4 Cajones',
      category: 'closets',
      categoryLabel: 'Closet / Dormitorio',
      dimensions: { width: 800, height: 950, depth: 450 },
      description: 'Mueble cajonero alto para ropa con 4 cajones profundos con correderas telescópicas.',
      icon: 'inventory_2',
      badge: '4 Cajones',
      partsCount: 9,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'com_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR',
            length: 800, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 941, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'com_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 932, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 391, posY: 466, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'com_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 932, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 391, posY: 466, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'com_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 764, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 69, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'com_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 764, width: 60, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 30, posZ: 180, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'com_caj_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 1 (SUPERIOR)',
            length: 200, width: 792, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 820, posZ: 234, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'com_caj_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 2',
            length: 200, width: 792, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 610, posZ: 234, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'com_caj_3_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 3',
            length: 200, width: 792, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 400, posZ: 234, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'com_caj_4_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 4 (INFERIOR)',
            length: 200, width: 792, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 190, posZ: 234, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'dormitorio_mesa_noche',
      name: 'Mesa de Noche / Buró 2 Cajones',
      category: 'closets',
      categoryLabel: 'Closet / Dormitorio',
      dimensions: { width: 450, height: 550, depth: 400 },
      description: 'Mueble compacto para cabecera de cama con 2 cajones y tapa engrosada.',
      icon: 'bedside_table',
      badge: 'Compacto',
      partsCount: 6,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'mn_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR',
            length: 450, width: 400, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 541, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'mn_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 532, width: 400, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 216, posY: 266, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'mn_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 532, width: 400, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 216, posY: 266, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'mn_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO BASE',
            length: 414, width: 400, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'mn_caj_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 1',
            length: 240, width: 442, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 400, posZ: 209, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'mn_caj_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 2',
            length: 240, width: 442, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 145, posZ: 209, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'dormitorio_zapatero_inclinado',
      name: 'Zapatero Vertical con Repisas',
      category: 'closets',
      categoryLabel: 'Closet / Dormitorio',
      dimensions: { width: 700, height: 1200, depth: 350 },
      description: 'Mueble zapatero organizador con 4 estantes de almacenaje y puerta abatible.',
      icon: 'roller_skating',
      badge: 'Zapatero',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'zap_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR',
            length: 700, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX, posY: 1191, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'zap_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 1182, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 341, posY: 591, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'zap_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 1182, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 341, posY: 591, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'zap_base_' + crypto.randomUUID().slice(0, 6),
            name: 'BASE INFERIOR',
            length: 664, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'zap_est_1_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA ZAPATOS 1',
            length: 664, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 300, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'zap_est_2_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA ZAPATOS 2',
            length: 664, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 600, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'zap_est_3_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA ZAPATOS 3',
            length: 664, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 900, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          }
        ];
      }
    },
    {
      id: 'dormitorio_cabecero_repisas',
      name: 'Cabecero de Cama con Nichos Decorativos',
      category: 'closets',
      categoryLabel: 'Closet / Dormitorio',
      dimensions: { width: 1600, height: 1000, depth: 200 },
      description: 'Panel cabecero flotante de pared con estante repisa superior y nichos laterales.',
      icon: 'bed',
      badge: 'Cabecero',
      partsCount: 6,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'cab_panel_' + crypto.randomUUID().slice(0, 6),
            name: 'PANEL PRINCIPAL DE FONDO',
            length: 1600, width: 982, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'width',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 491, posZ: -91, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'cab_repisa_sup_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA SUPERIOR DE APOYO',
            length: 1600, width: 200, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 991, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'cab_nicho_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA NICHO IZQUIERDA',
            length: 300, width: 160, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 600, posY: 600, posZ: -2, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'cab_nicho_der_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA NICHO DERECHA',
            length: 300, width: 160, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 600, posY: 600, posZ: -2, orientation: 'horizontal', componentRole: 'shelf'
          }
        ];
      }
    },

    // --- 4. SALA Y TV / CENTRO DE ENTRETENIMIENTO ---
    {
      id: 'sala_rack_tv_panel',
      name: 'Rack Flotante para TV 65" con Panel y Puertas',
      category: 'sala_tv',
      categoryLabel: 'Sala / TV',
      dimensions: { width: 1800, height: 1400, depth: 350 },
      description: 'Centro de entretenimiento moderno con panel de TV trasero y módulo bajo con 2 puertas basculantes y nicho para consola.',
      icon: 'tv',
      badge: 'TV 65"',
      partsCount: 9,
      generateParts: (mats, offsetX = 0) => {
        const matWood = this.getMaterial(mats, 'roble');
        const matDark = this.getMaterial(mats, 'antracita') || this.getMaterial(mats, 'blanco');
        const t = matWood.thickness || 18;
        return [
          {
            id: 'rk_panel_' + crypto.randomUUID().slice(0, 6),
            name: 'PANEL TRASERO TV 65"',
            length: 1800, width: 950, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 925, posZ: -166, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'rk_tapa_bajo_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR MÓDULO BAJO',
            length: 1800, width: 350, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 441, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'rk_piso_bajo_' + crypto.randomUUID().slice(0, 6),
            name: 'BASE INFERIOR MÓDULO BAJO',
            length: 1800, width: 350, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 9, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'rk_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 414, width: 350, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 891, posY: 225, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'rk_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 414, width: 350, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 891, posY: 225, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'rk_div_1_' + crypto.randomUUID().slice(0, 6),
            name: 'DIVISIÓN INTERNA 1',
            length: 414, width: 330, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX - 300, posY: 225, posZ: 0, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'rk_div_2_' + crypto.randomUUID().slice(0, 6),
            name: 'DIVISIÓN INTERNA 2',
            length: 414, width: 330, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 300, posY: 225, posZ: 0, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'rk_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA BASCULANTE IZQUIERDA',
            length: 410, width: 580, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 595, posY: 225, posZ: 184, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'rk_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA BASCULANTE DERECHA',
            length: 410, width: 580, thickness: t, quantity: 1,
            materialId: matDark.id, materialName: matDark.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 595, posY: 225, posZ: 184, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },
    {
      id: 'sala_mesa_centro',
      name: 'Mesa de Centro para Sala con Revistero',
      category: 'sala_tv',
      categoryLabel: 'Sala / TV',
      dimensions: { width: 900, height: 420, depth: 550 },
      description: 'Mesa ratona contemporánea con cubierta superior de madera y doble lateral cerrado con repisa inferior para libros.',
      icon: 'table_bar',
      badge: 'Mesa Ratona',
      partsCount: 5,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'mc_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'CUBIERTA PRINCIPAL MESA',
            length: 900, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 411, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'mc_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'PATA / LATERAL IZQUIERDO',
            length: 402, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 441, posY: 201, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'mc_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'PATA / LATERAL DERECHO',
            length: 402, width: 550, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 441, posY: 201, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'mc_repisa_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE REVISTERO INFERIOR',
            length: 864, width: 450, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 100, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          }
        ];
      }
    },
    {
      id: 'sala_biblioteca_5niveles',
      name: 'Biblioteca / Estantería Modular de 5 Niveles',
      category: 'sala_tv',
      categoryLabel: 'Sala / TV',
      dimensions: { width: 800, height: 1800, depth: 300 },
      description: 'Librero vertical de 5 repisas con excelente capacidad para libros, carpetas y objetos de decoración.',
      icon: 'local_library',
      badge: '5 Niveles',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'bib_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 1800, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 391, posY: 900, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'bib_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 1800, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 391, posY: 900, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'bib_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 764, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1791, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'bib_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 764, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 69, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'bib_rep_1_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA 1',
            length: 764, width: 290, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 490, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'bib_rep_2_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA 2 (CENTRAL)',
            length: 764, width: 290, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 920, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'bib_rep_3_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA 3',
            length: 764, width: 290, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1350, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'bib_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 764, width: 60, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 30, posZ: 120, orientation: 'vertical_xy', componentRole: 'plinth'
          }
        ];
      }
    },
    {
      id: 'sala_aparador_buffet',
      name: 'Aparador / Buffet 3 Puertas para Comedor',
      category: 'sala_tv',
      categoryLabel: 'Sala / TV',
      dimensions: { width: 1400, height: 800, depth: 400 },
      description: 'Mueble bajo de vajilla y mantelería con 3 puertas batientes y repisa interna continua.',
      icon: 'shelves',
      badge: 'Buffet',
      partsCount: 9,
      generateParts: (mats, offsetX = 0) => {
        const matWood = this.getMaterial(mats, 'roble');
        const t = matWood.thickness || 18;
        return [
          {
            id: 'ap_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR',
            length: 1400, width: 400, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 791, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'ap_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 782, width: 400, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 691, posY: 391, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'ap_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 782, width: 400, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 691, posY: 391, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'ap_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 1364, width: 400, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 79, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'ap_div_' + crypto.randomUUID().slice(0, 6),
            name: 'DIVISIÓN INTERNA',
            length: 694, width: 380, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX - 227, posY: 435, posZ: 0, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'ap_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA 1 (IZQUIERDA)',
            length: 695, width: 450, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 455, posY: 440, posZ: 209, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'ap_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA 2 (CENTRAL)',
            length: 695, width: 450, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 440, posZ: 209, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'ap_puerta_3_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA 3 (DERECHA)',
            length: 695, width: 450, thickness: t, quantity: 1,
            materialId: matWood.id, materialName: matWood.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 455, posY: 440, posZ: 209, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    },

    // --- 5. OFICINA Y ESTUDIO ---
    {
      id: 'oficina_escritorio_l',
      name: 'Escritorio de Oficina en L con Cajonera',
      category: 'oficina',
      categoryLabel: 'Oficina / Estudio',
      dimensions: { width: 1400, height: 750, depth: 1200 },
      description: 'Puesto de trabajo ejecutivo en L con ala lateral de soporte y cajonera integrada de 3 cajones.',
      icon: 'desk',
      badge: 'Escritorio L',
      partsCount: 10,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble');
        const matBase = this.getMaterial(mats, 'antracita') || mat;
        const t = mat.thickness || 18;
        return [
          {
            id: 'of_tapa_princ_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA ESCRITORIO PRINCIPAL',
            length: 1400, width: 600, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 741, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'of_tapa_ala_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA RETORNO EN L',
            length: 600, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 450, posY: 741, posZ: -550, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'of_pat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'PATA / COSTADO IZQUIERDO',
            length: 732, width: 600, thickness: t, quantity: 1,
            materialId: matBase.id, materialName: matBase.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 691, posY: 366, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'of_faldero_' + crypto.randomUUID().slice(0, 6),
            name: 'FALDERO / REFUERZO TRASERO',
            length: 1364, width: 350, thickness: t, quantity: 1,
            materialId: matBase.id, materialName: matBase.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 540, posZ: -280, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'of_caj_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'COSTADO INTERIOR CAJONERA RETORNO',
            length: 732, width: 500, thickness: t, quantity: 1,
            materialId: matBase.id, materialName: matBase.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 250, posY: 366, posZ: -550, orientation: 'vertical_yz', componentRole: 'divider'
          },
          {
            id: 'of_caj_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'COSTADO EXTERIOR CAJONERA RETORNO',
            length: 732, width: 500, thickness: t, quantity: 1,
            materialId: matBase.id, materialName: matBase.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 691, posY: 366, posZ: -550, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'of_caj_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO CAJONERA RETORNO',
            length: 405, width: 500, thickness: t, quantity: 1,
            materialId: matBase.id, materialName: matBase.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX + 470, posY: 80, posZ: -550, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'of_caj_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 1 RETORNO',
            length: 401, width: 195, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 470, posY: 610, posZ: -301, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'of_caj_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 2 RETORNO',
            length: 401, width: 195, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 470, posY: 405, posZ: -301, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'of_caj_3_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 3 ARCHIVADOR RETORNO',
            length: 401, width: 195, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 470, posY: 200, posZ: -301, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'oficina_home_office',
      name: 'Escritorio Home Office con Repisa Aérea',
      category: 'oficina',
      categoryLabel: 'Oficina / Estudio',
      dimensions: { width: 1000, height: 750, depth: 500 },
      description: 'Escritorio individual minimalista con pasacables, bandeja inferior y estante flotante para monitor.',
      icon: 'laptop_chromebook',
      badge: 'Home Office',
      partsCount: 6,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'ho_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'SUPERFICIE DE TRABAJO',
            length: 1000, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 741, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'ho_pat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 732, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 491, posY: 366, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'ho_pat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 732, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 491, posY: 366, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'ho_faldero_' + crypto.randomUUID().slice(0, 6),
            name: 'FALDERO ESTRUCTURAL TRASERO',
            length: 964, width: 300, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 570, posZ: -230, orientation: 'vertical_xy', componentRole: 'back'
          },
          {
            id: 'ho_repisa_mon_' + crypto.randomUUID().slice(0, 6),
            name: 'ALZADOR DE MONITOR ERGONÓMICO',
            length: 500, width: 220, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 850, posZ: -120, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'ho_repisa_inf_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE ORGANIZADOR PASACABLES',
            length: 964, width: 200, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 300, posZ: -140, orientation: 'horizontal', componentRole: 'shelf'
          }
        ];
      }
    },
    {
      id: 'oficina_cajonera_movil',
      name: 'Archivador / Cajonera Rodante 3 Cajones',
      category: 'oficina',
      categoryLabel: 'Oficina / Estudio',
      dimensions: { width: 450, height: 650, depth: 500 },
      description: 'Pedestal móvil para debajo de escritorio con 2 cajones simples + 1 cajón archivador para carpetas colgantes.',
      icon: 'move_to_inbox',
      badge: '3 Cajones',
      partsCount: 8,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'antracita') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'arch_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'TAPA SUPERIOR',
            length: 450, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 641, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'arch_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 582, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 216, posY: 341, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'arch_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 582, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 216, posY: 341, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'arch_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO BASE (RUEDAS)',
            length: 414, width: 500, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 59, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'arch_caj_1_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 1',
            length: 150, width: 442, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 535, posZ: 259, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'arch_caj_2_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 2',
            length: 150, width: 442, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 375, posZ: 259, orientation: 'vertical_xy', componentRole: 'drawer_front'
          },
          {
            id: 'arch_caj_3_' + crypto.randomUUID().slice(0, 6),
            name: 'FRENTE CAJÓN 3 (ARCHIVADOR)',
            length: 270, width: 442, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX, posY: 155, posZ: 259, orientation: 'vertical_xy', componentRole: 'drawer_front'
          }
        ];
      }
    },
    {
      id: 'oficina_librero_puertas',
      name: 'Estantería Librero de Oficina con Puertas Bajas',
      category: 'oficina',
      categoryLabel: 'Oficina / Estudio',
      dimensions: { width: 900, height: 1800, depth: 350 },
      description: 'Librero ejecutivo con 3 niveles superiores abiertos y gabinete inferior con 2 puertas para archivo protegido.',
      icon: 'local_library',
      badge: 'Ejecutivo',
      partsCount: 11,
      generateParts: (mats, offsetX = 0) => {
        const mat = this.getMaterial(mats, 'roble') || this.getMaterial(mats, 'blanco');
        const t = mat.thickness || 18;
        return [
          {
            id: 'lib_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL IZQUIERDO',
            length: 1800, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX - 441, posY: 900, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_left'
          },
          {
            id: 'lib_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'LATERAL DERECHO',
            length: 1800, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
            posX: offsetX + 441, posY: 900, posZ: 0, orientation: 'vertical_yz', componentRole: 'side_right'
          },
          {
            id: 'lib_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'TECHO SUPERIOR',
            length: 864, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1791, posZ: 0, orientation: 'horizontal', componentRole: 'top'
          },
          {
            id: 'lib_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'PISO INFERIOR',
            length: 864, width: 350, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 89, posZ: 0, orientation: 'horizontal', componentRole: 'bottom'
          },
          {
            id: 'lib_est_medio_' + crypto.randomUUID().slice(0, 6),
            name: 'ESTANTE DIVISOR DE PUERTAS',
            length: 864, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 750, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'lib_rep_1_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA SUPERIOR 1',
            length: 864, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1100, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'lib_rep_2_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA SUPERIOR 2',
            length: 864, width: 330, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 1450, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'lib_rep_inf_' + crypto.randomUUID().slice(0, 6),
            name: 'REPISA INTERNA GABINETE',
            length: 864, width: 320, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 420, posZ: 0, orientation: 'horizontal', componentRole: 'shelf'
          },
          {
            id: 'lib_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'ZÓCALO',
            length: 864, width: 80, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX, posY: 40, posZ: 130, orientation: 'vertical_xy', componentRole: 'plinth'
          },
          {
            id: 'lib_puerta_1_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA INFERIOR IZQUIERDA',
            length: 646, width: 426, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX - 217, posY: 420, posZ: 184, orientation: 'vertical_xy', componentRole: 'door'
          },
          {
            id: 'lib_puerta_2_' + crypto.randomUUID().slice(0, 6),
            name: 'PUERTA INFERIOR DERECHA',
            length: 646, width: 426, thickness: t, quantity: 1,
            materialId: mat.id, materialName: mat.name, grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX + 217, posY: 420, posZ: 184, orientation: 'vertical_xy', componentRole: 'door'
          }
        ];
      }
    }
  ];

  getCategories() {
    return [
      { id: 'all', label: 'Todas las Plantillas', icon: 'auto_stories', count: this.templates.length },
      { id: 'cocina', label: 'Cocina', icon: 'countertops', count: this.templates.filter(t => t.category === 'cocina').length },
      { id: 'cajones', label: 'Cajoneras y Cajones', icon: 'table_rows', count: this.templates.filter(t => t.category === 'cajones').length },
      { id: 'bano', label: 'Baño', icon: 'wash', count: this.templates.filter(t => t.category === 'bano').length },
      { id: 'closets', label: 'Closets y Dormitorio', icon: 'door_sliding', count: this.templates.filter(t => t.category === 'closets').length },
      { id: 'sala_tv', label: 'Sala TV y Estar', icon: 'tv', count: this.templates.filter(t => t.category === 'sala_tv').length },
      { id: 'oficina', label: 'Oficina y Estudio', icon: 'desk', count: this.templates.filter(t => t.category === 'oficina').length }
    ];
  }

  getTemplateById(id: string): FurnitureTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  calculateTemplateOffset(existingParts: Part[], templateWidth: number): number {
    if (!existingParts || existingParts.length === 0) return 0;
    
    let maxX = -Infinity;
    for (const part of existingParts) {
      let halfW = 0;
      if (part.orientation === 'horizontal' || part.orientation === 'vertical_xy') {
        halfW = (part.length || 0) / 2;
      } else {
        halfW = (part.thickness || 18) / 2;
      }
      const rightEdge = (part.posX || 0) + halfW;
      if (rightEdge > maxX) maxX = rightEdge;
    }

    if (maxX === -Infinity) return 0;
    return Math.round(maxX + (templateWidth / 2) + 200); // 200 mm clearance between furniture
  }
}
