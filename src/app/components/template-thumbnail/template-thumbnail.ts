import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FurnitureTemplate } from '../../services/templates-catalog.service';

/**
 * Componente de previsualización isométrica SVG para las plantillas de mobiliario.
 * Cumple con la arquitectura de 3 archivos separados (.ts, .html, .css) y ChangeDetectionStrategy.OnPush.
 */
@Component({
  selector: 'app-template-thumbnail',
  imports: [CommonModule],
  templateUrl: './template-thumbnail.html',
  styleUrl: './template-thumbnail.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateThumbnailComponent {
  // Plantilla de mueble recibida como input obligatorio
  readonly template = input.required<FurnitureTemplate>();

  // ViewBox estándar del lienzo SVG isométrico
  readonly svgViewBox = computed(() => '0 0 280 175');

  /**
   * Determina qué ilustración isométrica 3D renderizar según el ID o categoría de la plantilla.
   */
  readonly renderType = computed<string>(() => {
    const t = this.template();
    const id = t.id.toLowerCase();
    const cat = t.category;

    if (id === 'cajon_individual_armado') return 'single_drawer';
    if (id === 'cocina_gavetero_ollero') return 'pot_drawers';
    if (cat === 'cajones' || id.includes('cajon') || id.includes('comoda') || id.includes('cajonera') || id.includes('archivador')) return 'drawers';
    if (id === 'cocina_bajo_mesada_120' || id.includes('isla')) return 'kitchen_base';
    if (id === 'cocina_alacena_80' || id.includes('alacena') || id.includes('aereo')) return 'wall_cabinet';
    if (id === 'cocina_torre_horno') return 'oven_tower';
    if (cat === 'bano' || id.includes('vanitory')) return 'vanity';
    if (cat === 'closets' && (id.includes('ropero') || id.includes('closet'))) return 'closet';
    if (cat === 'oficina' && id.includes('escritorio')) return 'desk';
    if (id.includes('rack') || id.includes('tv')) return 'tv_rack';
    if (id.includes('biblioteca') || id.includes('librero')) return 'bookshelf';

    return 'default';
  });
}