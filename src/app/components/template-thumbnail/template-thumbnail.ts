import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FurnitureTemplate } from '../../services/templates-catalog.service';

@Component({
  selector: 'app-template-thumbnail',
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex items-center justify-center p-2 select-none relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/80 border border-slate-200/70 shadow-inner group-hover:border-amber-300 transition-colors">
      <svg 
        [attr.viewBox]="svgViewBox()" 
        class="w-full h-36 max-h-40 drop-shadow-md transition-transform duration-300 group-hover:scale-105"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg">
        
        <!-- Definitions: gradients for wood, marble, shadows -->
        <defs>
          <!-- Oak Wood Grain Gradient -->
          <linearGradient id="oakTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#d49a6a" />
            <stop offset="50%" stop-color="#b47b48" />
            <stop offset="100%" stop-color="#996030" />
          </linearGradient>
          <linearGradient id="oakSide" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#996030" />
            <stop offset="100%" stop-color="#73431d" />
          </linearGradient>
          <linearGradient id="oakFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#c58a58" />
            <stop offset="100%" stop-color="#ab7140" />
          </linearGradient>

          <!-- Walnut Wood Gradient -->
          <linearGradient id="walnutTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8a532d" />
            <stop offset="100%" stop-color="#693b1b" />
          </linearGradient>
          <linearGradient id="walnutFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#754220" />
            <stop offset="100%" stop-color="#542c11" />
          </linearGradient>

          <!-- White Frost Carcass -->
          <linearGradient id="whiteTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#f1f5f9" />
          </linearGradient>
          <linearGradient id="whiteSide" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0" />
            <stop offset="100%" stop-color="#cbd5e1" />
          </linearGradient>
          <linearGradient id="whiteFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc" />
            <stop offset="100%" stop-color="#f1f5f9" />
          </linearGradient>

          <!-- Calacatta Marble Gradient -->
          <linearGradient id="marbleTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="35%" stop-color="#f8fafc" />
            <stop offset="60%" stop-color="#f1f5f9" />
            <stop offset="100%" stop-color="#e2e8f0" />
          </linearGradient>

          <!-- Matte Graphite Gradient -->
          <linearGradient id="graphiteTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <linearGradient id="graphiteFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>

          <!-- Drop Floor Shadow Filter -->
          <filter id="floorShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="5" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.18" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Floor Ambient Shadow ellipse -->
        <ellipse cx="140" cy="148" rx="88" ry="18" fill="#0f172a" opacity="0.12" />

        <!-- Dynamic Isometric 3D Model Rendering according to category & style -->
        @switch (renderType()) {
          @case ('drawers') {
            <!-- CAJONERA / GAVETERO 3D -->
            <!-- Base Zócalo -->
            <polygon points="68,140 140,154 212,140 140,128" fill="#334155" />
            <polygon points="68,140 140,154 140,157 68,143" fill="#1e293b" />
            <polygon points="140,154 212,140 212,137 140,151" fill="#0f172a" />

            <!-- Carcass sides & back -->
            <polygon points="60,60 140,80 140,146 60,126" fill="url(#whiteFront)" stroke="#94a3b8" stroke-width="1" />
            <polygon points="140,80 220,60 220,126 140,146" fill="url(#whiteSide)" stroke="#64748b" stroke-width="1" />
            
            <!-- Countertop / Top Surface -->
            <polygon points="56,58 140,78 224,58 140,38" fill="url(#oakTop)" stroke="#996030" stroke-width="1.5" />
            <polygon points="56,58 140,78 140,84 56,64" fill="url(#oakFront)" />
            <polygon points="140,78 224,58 224,64 140,84" fill="url(#oakSide)" />

            <!-- Drawers Fronts (3 stacked) -->
            <!-- Drawer 1 -->
            <polygon points="63,83 137,101 137,106 63,88" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
            <rect x="94" y="87" width="16" height="2" rx="1" fill="#475569" transform="skewY(14)" />

            <!-- Drawer 2 -->
            <polygon points="63,103 137,121 137,126 63,108" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
            <rect x="94" y="107" width="16" height="2" rx="1" fill="#475569" transform="skewY(14)" />

            <!-- Drawer 3 -->
            <polygon points="63,123 137,141 137,146 63,128" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
            <rect x="94" y="127" width="16" height="2" rx="1" fill="#475569" transform="skewY(14)" />
          }

          @case ('single_drawer') {
            <!-- CAJÓN INDIVIDUAL ARMADO (VISTA AXONOMÉTRICA DESPIECE) -->
            <!-- Frente exterior de cajón -->
            <polygon points="50,75 125,95 125,135 50,115" fill="url(#oakFront)" stroke="#996030" stroke-width="1.5" />
            <polygon points="50,75 58,73 133,93 125,95" fill="url(#oakTop)" stroke="#996030" stroke-width="1" />
            <rect x="80" y="97" width="22" height="4" rx="2" fill="#1e293b" transform="skewY(14)" />

            <!-- Interior Box Sides (Costados) -->
            <polygon points="125,95 195,78 195,118 125,135" fill="url(#whiteSide)" stroke="#94a3b8" stroke-width="1" />
            <polygon points="58,78 128,61 195,78 125,95" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />
            <!-- Back Panel (Contrafrente) -->
            <polygon points="128,61 195,78 195,84 128,67" fill="#cbd5e1" />
            <!-- Fondo de cajón ranurado -->
            <polygon points="70,88 135,73 185,86 120,101" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1" />
            <!-- Telescopic slide rail cue -->
            <line x1="125" y1="126" x2="192" y2="109" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="3 2" />
          }

          @case ('kitchen_base') {
            <!-- BAJO MESADA COCINA CON PUERTAS Y CAJONERA -->
            <!-- Encimera superior de granito o madera -->
            <polygon points="45,55 145,78 235,55 135,32" fill="url(#oakTop)" stroke="#996030" stroke-width="1.5" />
            <polygon points="45,55 145,78 145,84 45,61" fill="url(#oakFront)" />
            <polygon points="145,78 235,55 235,61 145,84" fill="url(#oakSide)" />

            <!-- Zócalo -->
            <polygon points="55,142 138,158 220,140 140,126" fill="#334155" />

            <!-- Lateral derecho -->
            <polygon points="145,84 235,61 235,128 145,150" fill="url(#whiteSide)" stroke="#94a3b8" stroke-width="1" />

            <!-- Frente Izquierdo: 2 Puertas -->
            <polygon points="47,63 93,73 93,138 47,128" fill="url(#whiteFront)" stroke="#cbd5e1" stroke-width="1" />
            <polygon points="94,73 138,82 138,147 94,138" fill="url(#whiteFront)" stroke="#cbd5e1" stroke-width="1" />
            <!-- Tiradores verticales en puertas -->
            <rect x="86" y="85" width="2" height="14" rx="1" fill="#0284c7" transform="skewY(13)" />
            <rect x="99" y="88" width="2" height="14" rx="1" fill="#0284c7" transform="skewY(13)" />

            <!-- Frente Derecho: 3 Cajones en cocina -->
            <polygon points="140,83 185,73 185,92 140,102" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
            <polygon points="140,104 185,94 185,113 140,123" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
            <polygon points="140,125 185,115 185,134 140,144" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
            <!-- Tiradores horizontales en cajones -->
            <rect x="156" y="85" width="12" height="2" rx="1" fill="#0284c7" transform="skewY(-13)" />
            <rect x="156" y="106" width="12" height="2" rx="1" fill="#0284c7" transform="skewY(-13)" />
            <rect x="156" y="127" width="12" height="2" rx="1" fill="#0284c7" transform="skewY(-13)" />
          }

          @case ('pot_drawers') {
            <!-- GAVETERO OLLERO COCINA 2 GAVETAS ALTAS -->
            <polygon points="48,56 140,78 232,56 140,34" fill="url(#marbleTop)" stroke="#94a3b8" stroke-width="1.5" />
            <polygon points="48,56 140,78 140,83 48,61" fill="#f8fafc" />
            <polygon points="140,78 232,56 232,61 140,83" fill="#cbd5e1" />

            <!-- Zócalo -->
            <polygon points="60,143 140,158 220,141 140,126" fill="#334155" />

            <!-- Costado lateral -->
            <polygon points="140,83 232,61 232,130 140,152" fill="url(#whiteSide)" stroke="#94a3b8" />

            <!-- Gaveta Superior Cacerolera -->
            <polygon points="52,65 137,84 137,109 52,90" fill="url(#oakFront)" stroke="#996030" stroke-width="1.2" />
            <rect x="85" y="77" width="22" height="3" rx="1.5" fill="#1e293b" transform="skewY(13)" />

            <!-- Gaveta Inferior Ollera Profunda -->
            <polygon points="52,94 137,113 137,144 52,125" fill="url(#oakFront)" stroke="#996030" stroke-width="1.2" />
            <rect x="85" y="116" width="22" height="3" rx="1.5" fill="#1e293b" transform="skewY(13)" />
          }

          @case ('wall_cabinet') {
            <!-- ALACENA AÉREA DE COCINA CON PUERTAS -->
            <polygon points="60,40 140,58 220,40 140,22" fill="url(#whiteTop)" stroke="#94a3b8" stroke-width="1.2" />
            <polygon points="140,58 220,40 220,108 140,126" fill="url(#whiteSide)" stroke="#94a3b8" stroke-width="1" />

            <!-- Puerta Izquierda -->
            <polygon points="60,43 138,60 138,125 60,108" fill="url(#whiteFront)" stroke="#cbd5e1" stroke-width="1" />
            <line x1="99" y1="52" x2="99" y2="120" stroke="#cbd5e1" stroke-width="1" />
            <!-- Tiradores ocultos o gola perfil -->
            <rect x="94" y="105" width="2" height="12" rx="1" fill="#0284c7" transform="skewY(12)" />
            <rect x="103" y="107" width="2" height="12" rx="1" fill="#0284c7" transform="skewY(12)" />
            <!-- Base interior vista -->
            <polygon points="60,108 140,126 220,108 140,90" fill="#f1f5f9" stroke="#cbd5e1" />
          }

          @case ('oven_tower') {
            <!-- TORRE DE HORNOS Y DESPENSA -->
            <polygon points="70,22 135,36 200,22 135,08" fill="url(#whiteTop)" stroke="#94a3b8" />
            <polygon points="135,36 200,22 200,136 135,150" fill="url(#whiteSide)" stroke="#64748b" />
            
            <!-- Puerta superior despensa -->
            <polygon points="72,25 133,38 133,62 72,49" fill="url(#whiteFront)" stroke="#cbd5e1" />
            <!-- Hueco Microondas -->
            <polygon points="73,52 132,65 132,82 73,69" fill="#334155" />
            <!-- Hueco Horno empotrable -->
            <polygon points="73,72 132,85 132,112 73,99" fill="#0f172a" stroke="#475569" />
            <line x1="77" y1="84" x2="128" y2="95" stroke="#94a3b8" stroke-width="2" />
            <!-- Puerta inferior cacerolera -->
            <polygon points="72,103 133,116 133,146 72,133" fill="url(#oakFront)" stroke="#996030" />
          }

          @case ('vanity') {
            <!-- VANITORY FLOTANTE BAÑO -->
            <!-- Encimera / Lavabo -->
            <polygon points="60,65 140,84 220,65 140,46" fill="url(#whiteTop)" stroke="#94a3b8" stroke-width="1.5" />
            <!-- Seno lavabo sutil -->
            <ellipse cx="140" cy="65" rx="28" ry="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" />
            <circle cx="140" cy="65" r="2.5" fill="#475569" />
            <polygon points="60,65 140,84 140,90 60,71" fill="#f8fafc" />
            <polygon points="140,84 220,65 220,71 140,90" fill="#cbd5e1" />

            <!-- Cajón flotante principal en Roble -->
            <polygon points="64,74 137,91 137,118 64,101" fill="url(#oakFront)" stroke="#996030" stroke-width="1" />
            <rect x="94" y="88" width="16" height="3" rx="1.5" fill="#1e293b" transform="skewY(13)" />

            <!-- Costado y repisa toallera inferior -->
            <polygon points="137,91 216,72 216,118 137,137" fill="url(#oakSide)" stroke="#73431d" />
            <polygon points="64,124 137,141 216,122 143,105" fill="url(#oakTop)" stroke="#996030" />
          }

          @case ('closet') {
            <!-- CLOSET / ROPERO 2 CUERPOS CON MALETERO -->
            <polygon points="65,16 140,32 215,16 140,0" fill="url(#whiteTop)" stroke="#94a3b8" />
            <polygon points="140,32 215,16 215,142 140,158" fill="url(#whiteSide)" stroke="#64748b" />
            
            <!-- Puerta Izquierda Alta -->
            <polygon points="67,20 137,35 137,152 67,137" fill="url(#oakFront)" stroke="#996030" stroke-width="1" />
            <!-- Puerta Derecha Alta -->
            <polygon points="143,36 212,21 212,138 143,153" fill="url(#whiteFront)" stroke="#cbd5e1" stroke-width="1" />
            <!-- Tiradores longitudinales estilizados -->
            <line x1="130" y1="65" x2="130" y2="105" stroke="#1e293b" stroke-width="2" />
            <line x1="150" y1="65" x2="150" y2="105" stroke="#1e293b" stroke-width="2" />
            <!-- Zócalo -->
            <polygon points="70,140 140,155 210,140 140,125" fill="#334155" />
          }

          @case ('desk') {
            <!-- ESCRITORIO CON CAJONERA -->
            <!-- Tapa de escritorio en roble cálido -->
            <polygon points="40,65 140,88 238,65 138,42" fill="url(#oakTop)" stroke="#996030" stroke-width="1.8" />
            <polygon points="40,65 140,88 140,94 40,71" fill="url(#oakFront)" />
            <polygon points="140,88 238,65 238,71 140,94" fill="url(#oakSide)" />

            <!-- Pata / Costado Izquierdo metálico o antracita -->
            <polygon points="45,74 52,75 52,143 45,141" fill="url(#graphiteFront)" stroke="#1e293b" />
            
            <!-- Cajonera pedestal derecho (3 cajones) -->
            <polygon points="170,72 230,58 230,132 170,146" fill="url(#graphiteTop)" stroke="#1e293b" />
            <polygon points="135,80 170,72 170,146 135,154" fill="url(#whiteFront)" stroke="#cbd5e1" />
            <!-- Cajones en pedestal -->
            <line x1="135" y1="105" x2="170" y2="97" stroke="#cbd5e1" stroke-width="1" />
            <line x1="135" y1="130" x2="170" y2="122" stroke="#cbd5e1" stroke-width="1" />
            <!-- Tiradores minimalistas -->
            <rect x="148" y="90" width="8" height="2" rx="1" fill="#475569" transform="skewY(-13)" />
            <rect x="148" y="115" width="8" height="2" rx="1" fill="#475569" transform="skewY(-13)" />
            <rect x="148" y="140" width="8" height="2" rx="1" fill="#475569" transform="skewY(-13)" />
          }

          @case ('tv_rack') {
            <!-- RACK PANEL TV FLOTANTE -->
            <!-- Gran Panel Trasero TV 65" -->
            <polygon points="50,15 220,15 220,95 50,95" fill="url(#oakFront)" stroke="#996030" stroke-width="1" />
            <!-- Silueta decorativa televisor -->
            <rect x="80" y="24" width="110" height="60" rx="3" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
            <rect x="85" y="29" width="100" height="50" rx="1" fill="#1e293b" />

            <!-- Módulo Bajo con Puertas Basculantes -->
            <polygon points="35,100 140,118 245,100 140,82" fill="url(#graphiteTop)" stroke="#0f172a" stroke-width="1.5" />
            <polygon points="35,100 140,118 140,142 35,124" fill="url(#graphiteFront)" stroke="#0f172a" />
            <polygon points="140,118 245,100 245,124 140,142" fill="#0f172a" />
            <!-- Puertas basculantes divisiones -->
            <line x1="88" y1="109" x2="88" y2="133" stroke="#334155" stroke-width="1" />
            <line x1="192" y1="109" x2="192" y2="133" stroke="#334155" stroke-width="1" />
          }

          @case ('bookshelf') {
            <!-- BIBLIOTECA MODULAR 5 NIVELES -->
            <polygon points="70,18 140,32 210,18 140,04" fill="url(#oakTop)" stroke="#996030" />
            <polygon points="140,32 210,18 210,142 140,156" fill="url(#oakSide)" stroke="#73431d" />
            <polygon points="70,22 76,23 76,144 70,143" fill="url(#oakFront)" />

            <!-- 4 Repisas visibles con libros -->
            <polygon points="74,52 140,65 206,52 140,39" fill="url(#oakTop)" stroke="#996030" />
            <polygon points="74,82 140,95 206,82 140,69" fill="url(#oakTop)" stroke="#996030" />
            <polygon points="74,112 140,125 206,112 140,99" fill="url(#oakTop)" stroke="#996030" />
            <polygon points="74,142 140,155 206,142 140,129" fill="url(#oakTop)" stroke="#996030" />
            <!-- Libros esquemáticos de colores -->
            <rect x="85" y="38" width="5" height="18" fill="#0284c7" />
            <rect x="91" y="40" width="6" height="16" fill="#f59e0b" />
            <rect x="98" y="36" width="4" height="20" fill="#10b981" />
            <rect x="155" y="68" width="6" height="18" fill="#ef4444" />
            <rect x="162" y="70" width="7" height="16" fill="#6366f1" />
          }

          @default {
            <!-- MUEBLE GENERAL ISOMÉTRICO (ARMARIO / APARADOR / ESTANTERÍA) -->
            <polygon points="55,50 140,70 225,50 140,30" fill="url(#oakTop)" stroke="#996030" stroke-width="1.5" />
            <polygon points="55,50 140,70 140,75 55,55" fill="url(#oakFront)" />
            <polygon points="140,70 225,50 225,55 140,75" fill="url(#oakSide)" />

            <!-- Frente con 2 Puertas -->
            <polygon points="58,57 138,76 138,142 58,123" fill="url(#whiteFront)" stroke="#cbd5e1" stroke-width="1" />
            <polygon points="140,76 222,57 222,123 140,142" fill="url(#whiteSide)" stroke="#94a3b8" stroke-width="1" />
            <line x1="98" y1="67" x2="98" y2="133" stroke="#cbd5e1" stroke-width="1" />
            <line x1="181" y1="67" x2="181" y2="133" stroke="#cbd5e1" stroke-width="1" />
            
            <!-- Tiradores elegantes -->
            <rect x="90" y="90" width="2" height="14" rx="1" fill="#0284c7" transform="skewY(13)" />
            <rect x="104" y="93" width="2" height="14" rx="1" fill="#0284c7" transform="skewY(13)" />
            <!-- Zócalo -->
            <polygon points="65,130 140,145 215,130 140,115" fill="#334155" />
          }
        }

        <!-- Dimension Tag Label inside thumbnail -->
        <g transform="translate(14, 18)">
          <rect x="0" y="0" width="76" height="16" rx="4" fill="#0f172a" fill-opacity="0.8" />
          <text x="38" y="11" fill="#ffffff" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">
            {{ template().dimensions.width }}×{{ template().dimensions.height }}
          </text>
        </g>
      </svg>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateThumbnailComponent {
  template = input.required<FurnitureTemplate>();

  readonly svgViewBox = computed(() => '0 0 280 175');

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
