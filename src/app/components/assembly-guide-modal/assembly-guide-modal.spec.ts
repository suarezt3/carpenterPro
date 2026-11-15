import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef, signal } from '@angular/core';
import {
  AssemblyDrawerSubassemblyContract,
  AssemblyGuideModalComponent,
  AssemblyPieceGroupSummaryContract,
  AssemblyStepContract,
  MarginalCalloutInput,
  MarginalCalloutPlacement,
  ModuleAssemblyGuideContract,
  computeMarginalCallouts
} from './assembly-guide-modal';
import {
  AssemblyGuidePiece,
  AssemblyGuideService,
  AssemblyStep,
  ModuleAssemblyGuide
} from '../../services/assembly-guide.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { PaymentService } from '../../services/payment.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { I18nService } from '../../services/i18n.service';
import {
  ComponentRole,
  DEFAULT_ROOM_CONFIG,
  MelamineProject,
  Part,
  PartEdges
} from '../../models/melamine.models';

const DEFAULT_EDGES: PartEdges = {
  l1: 'thin',
  l2: 'none',
  a1: 'none',
  a2: 'none'
};

function makePart(overrides: Partial<Part> & { id: string; name: string }): Part {
  return {
    length: 600,
    width: 300,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-white',
    materialName: 'Melamina Blanca 18mm',
    grain: 'none',
    edges: { ...DEFAULT_EDGES },
    posX: 0,
    posY: 0,
    posZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    ...overrides
  };
}

interface MockPieceWorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  spanX: number;
  spanY: number;
  spanZ: number;
  cx: number;
  cy: number;
  cz: number;
}

type MockGuidePiece = AssemblyGuidePiece & {
  worldBounds: MockPieceWorldBounds;
  resolvedRole: ComponentRole;
};

type MockAssemblyStep = AssemblyStep & {
  cumulativePriorPartCodes: string[];
};

function computeMockBounds(part: Part): MockPieceWorldBounds {
  const orient = part.orientation ?? 'horizontal';
  let spanX = part.length;
  let spanY = part.thickness;
  let spanZ = part.width;
  if (orient === 'vertical_yz') {
    spanX = part.thickness;
    spanY = part.length;
    spanZ = part.width;
  } else if (orient === 'vertical_xy') {
    spanX = part.length;
    spanY = part.width;
    spanZ = part.thickness;
  }
  const cx = part.posX ?? 0;
  const cy = part.posY ?? 0;
  const cz = part.posZ ?? 0;
  return {
    minX: cx - spanX / 2,
    maxX: cx + spanX / 2,
    minY: cy - spanY / 2,
    maxY: cy + spanY / 2,
    minZ: cz - spanZ / 2,
    maxZ: cz + spanZ / 2,
    spanX,
    spanY,
    spanZ,
    cx,
    cy,
    cz
  };
}

function makePiece(
  code: string,
  part: Part
): AssemblyGuidePiece {
  const piece: MockGuidePiece = {
    partId: part.id,
    code,
    name: part.name,
    translatedName: part.name,
    length: part.length,
    width: part.width,
    thickness: part.thickness,
    quantity: part.quantity,
    materialName: part.materialName,
    edges: part.edges,
    componentRole: part.componentRole,
    part,
    worldBounds: computeMockBounds(part),
    resolvedRole: part.componentRole ?? 'free'
  };
  return piece;
}

/**
 * Fixture representativo: Alacena Sobre-Nevera 90cm (900 × 400 × 600 mm)
 * Incluye P1..P4 (Casco), P5 (Fondo Trasero Ranurado 868×398×3 horizontal),
 * P6 (Repisa Interna) y P7 (Puerta Abatible Superior).
 */
function createAlacenaSobreNeveraGuide(): ModuleAssemblyGuide {
  const p1 = makePiece('P1', makePart({
    id: 'p1-left',
    name: 'Lateral Izquierdo',
    length: 400,
    width: 600,
    thickness: 18,
    orientation: 'vertical_yz',
    componentRole: 'side_left',
    posX: -441,
    posY: 200,
    posZ: 0
  }));
  const p2 = makePiece('P2', makePart({
    id: 'p2-right',
    name: 'Lateral Derecho',
    length: 400,
    width: 600,
    thickness: 18,
    orientation: 'vertical_yz',
    componentRole: 'side_right',
    posX: 441,
    posY: 200,
    posZ: 0
  }));
  const p3 = makePiece('P3', makePart({
    id: 'p3-top',
    name: 'Techo Superior',
    length: 864,
    width: 600,
    thickness: 18,
    orientation: 'horizontal',
    componentRole: 'top',
    posX: 0,
    posY: 391,
    posZ: 0
  }));
  const p4 = makePiece('P4', makePart({
    id: 'p4-bottom',
    name: 'Base Inferior',
    length: 864,
    width: 600,
    thickness: 18,
    orientation: 'horizontal',
    componentRole: 'bottom',
    posX: 0,
    posY: 9,
    posZ: 0
  }));
  const p5 = makePiece('P5', makePart({
    id: 'p5-back',
    name: 'Fondo Trasero Ranurado',
    length: 868,
    width: 398,
    thickness: 3,
    materialId: 'mat-mdf3',
    materialName: 'MDF 3mm',
    orientation: 'vertical_xy',
    componentRole: 'back',
    posX: 0,
    posY: 200,
    posZ: -288.5
  }));
  const p6 = makePiece('P6', makePart({
    id: 'p6-shelf',
    name: 'Repisa Interna',
    length: 862,
    width: 560,
    thickness: 18,
    orientation: 'horizontal',
    componentRole: 'shelf',
    posX: 0,
    posY: 200,
    posZ: 10
  }));
  const p7 = makePiece('P7', makePart({
    id: 'p7-door',
    name: 'Puerta Abatible Superior',
    length: 896,
    width: 396,
    thickness: 18,
    orientation: 'vertical_xy',
    componentRole: 'door',
    posX: 0,
    posY: 200,
    posZ: 309,
    hardwareConfig: {
      isMovable: true,
      movableType: 'door',
      hingeType: 'gas_piston',
      openingDirection: 'top',
      handleType: 'bar_modern'
    }
  }));

  const pieces = [p1, p2, p3, p4, p5, p6, p7];

  const rawSteps: MockAssemblyStep[] = [
    {
      stepNumber: 1,
      titleKey: 'assemblyGuide.step1Title',
      defaultTitle: 'Paso 1 — Estructura Base y Costados (Casco)',
      descriptionKey: 'assemblyGuide.step1Desc',
      defaultDescription: 'Ensamble los costados con techo y base.',
      tips: ['Coloque 3 tornillos por unión.'],
      actionType: 'carcass',
      partCodes: ['P1', 'P2', 'P3', 'P4'],
      cumulativePriorPartCodes: [],
      parts: [p1, p2, p3, p4],
      hardware: [
        {
          id: 'screw_structural_50',
          name: 'assemblyGuide.hardwareStructuralScrews',
          codeName: 'Tornillo 4.0 × 50 mm',
          spec: '4.0 × 50 mm',
          quantity: 12,
          type: 'screw_structural',
          iconName: 'wrench'
        }
      ]
    },
    {
      stepNumber: 2,
      titleKey: 'assemblyGuide.step2Title',
      defaultTitle: 'Paso 2 — Escuadrado y Fijación del Fondo Trasero',
      descriptionKey: 'assemblyGuide.step2Desc',
      defaultDescription: 'Verifique diagonales D1 = D2 e inserte el fondo P5.',
      tips: ['Confirme escuadra a 90 grados.'],
      actionType: 'back',
      partCodes: ['P5'],
      cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4'],
      parts: [p5],
      hardware: [
        {
          id: 'nail_back_panel',
          name: 'assemblyGuide.hardwareBackFasteners',
          codeName: 'Puntillas / Tornillos Fondo',
          spec: '3.0 × 15 mm',
          quantity: 18,
          type: 'nail_back',
          iconName: 'pin'
        }
      ]
    },
    {
      stepNumber: 3,
      titleKey: 'assemblyGuide.step3Title',
      defaultTitle: 'Paso 3 — Instalación de Repisas Internas',
      descriptionKey: 'assemblyGuide.step3Desc',
      defaultDescription: 'Inserte los pines de soporte y asiente la repisa P6.',
      tips: ['Verifique horizontalidad.'],
      actionType: 'shelves',
      partCodes: ['P6'],
      cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4', 'P5'],
      parts: [p6],
      hardware: [
        {
          id: 'shelf_pins',
          name: 'assemblyGuide.hardwareShelfPins',
          codeName: 'Pines Ø 5 mm',
          spec: 'Ø 5 mm',
          quantity: 4,
          type: 'shelf_pin',
          iconName: 'layers'
        }
      ],
      measurements: [
        {
          label: 'P6 (Repisa Interna) — Altura Repisa',
          valueMm: 182
        }
      ]
    },
    {
      stepNumber: 4,
      titleKey: 'assemblyGuide.step5Title',
      defaultTitle: 'Paso 4 — Montaje de Bisagras, Puerta Abatible y Manija',
      descriptionKey: 'assemblyGuide.step5Desc',
      defaultDescription: 'Instale bisagras superiores, pistones a gas y la puerta P7.',
      tips: ['Calibre holgura perimetral de 3 mm.'],
      actionType: 'doors',
      partCodes: ['P7'],
      cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      parts: [p7],
      hardware: [
        {
          id: 'cup_hinges',
          name: 'assemblyGuide.hardwareHinges',
          codeName: 'Bisagras Cazoleta 35 mm',
          spec: 'Ø 35 mm',
          quantity: 2,
          type: 'hinge',
          iconName: 'unfold'
        }
      ]
    }
  ];
  const steps: AssemblyStep[] = rawSteps;

  return {
    moduleId: 'mod-alacena-90',
    moduleName: 'Alacena Sobre-Nevera 90cm',
    moduleType: 'wall_cabinet',
    dimensions: { width: 900, height: 400, depth: 600 },
    totalPartsCount: 7,
    estimatedAssemblyTimeMinutes: 35,
    requiredTools: [
      'assemblyGuide.toolDrill',
      'assemblyGuide.toolTapeMeasure',
      'assemblyGuide.toolSquare',
      'assemblyGuide.toolRubberMallet'
    ],
    hardwareKit: [
      {
        id: 'screw_structural_50',
        name: 'assemblyGuide.hardwareStructuralScrews',
        codeName: 'Tornillo Soberbio 4.0 × 50 mm',
        spec: '4.0 × 50 mm',
        quantity: 12,
        type: 'screw_structural',
        iconName: 'wrench'
      },
      {
        id: 'cup_hinges',
        name: 'assemblyGuide.hardwareHinges',
        codeName: 'Bisagras Cazoleta 35 mm',
        spec: 'Cazoleta Ø 35 mm',
        quantity: 2,
        type: 'hinge',
        iconName: 'unfold'
      }
    ],
    pieces,
    steps,
    rawParts: pieces.map(p => p.part)
  };
}

function hasPlacementOverlap(a: MarginalCalloutPlacement, b: MarginalCalloutPlacement): boolean {
  const ra = a.pillRect;
  const rb = b.pillRect;
  return !(
    ra.right <= rb.left ||
    rb.right <= ra.left ||
    ra.bottom <= rb.top ||
    rb.bottom <= ra.top
  );
}

/**
 * Fixture complejo realista: Torre de 6 cajones con 2 plantillas de altura (3x 177mm + 3x 160mm).
 * Modela 6 piezas de casco + 30 piezas de caja de cajón + 6 frentes de cajón (42 piezas totales).
 */
function createSixDrawerTowerGuide(): ModuleAssemblyGuideContract {
  const pieces: AssemblyGuidePiece[] = [];
  let nextCode = 1;
  const pushPiece = (part: Part): AssemblyGuidePiece => {
    const code = `P${nextCode++}`;
    const piece = makePiece(code, part);
    pieces.push(piece);
    return piece;
  };

  // Casco P1..P6
  const p1 = pushPiece(makePart({
    id: 'td-lat-l',
    name: 'Lateral Izquierdo',
    componentRole: 'side_left',
    length: 1350,
    width: 530,
    thickness: 18,
    orientation: 'vertical_yz',
    posX: -291,
    posY: 675,
    posZ: 0
  }));
  const p2 = pushPiece(makePart({
    id: 'td-lat-r',
    name: 'Lateral Derecho',
    componentRole: 'side_right',
    length: 1350,
    width: 530,
    thickness: 18,
    orientation: 'vertical_yz',
    posX: 291,
    posY: 675,
    posZ: 0
  }));
  const p3 = pushPiece(makePart({
    id: 'td-bottom',
    name: 'Piso Inferior',
    componentRole: 'bottom',
    length: 564,
    width: 530,
    thickness: 18,
    orientation: 'horizontal',
    posX: 0,
    posY: 109,
    posZ: 0
  }));
  const p4 = pushPiece(makePart({
    id: 'td-top',
    name: 'Tapa Superior',
    componentRole: 'top',
    length: 564,
    width: 530,
    thickness: 18,
    orientation: 'horizontal',
    posX: 0,
    posY: 1341,
    posZ: 0
  }));
  const p5 = pushPiece(makePart({
    id: 'td-back',
    name: 'Fondo Ranurado',
    componentRole: 'back',
    length: 572,
    width: 1230,
    thickness: 3,
    orientation: 'vertical_xy',
    posX: 0,
    posY: 725,
    posZ: -252
  }));
  const p6 = pushPiece(makePart({
    id: 'td-plinth',
    name: 'Zócalo Frontal',
    componentRole: 'plinth',
    length: 564,
    width: 100,
    thickness: 18,
    orientation: 'vertical_xy',
    posX: 0,
    posY: 50,
    posZ: 230
  }));

  const drawerBoxes: AssemblyGuidePiece[][] = [];
  const drawerFronts: AssemblyGuidePiece[] = [];
  const template1Parts: AssemblyGuidePiece[] = [];
  const template2Parts: AssemblyGuidePiece[] = [];
  const elevationByDrawer = [210, 410, 610, 810, 1000, 1190];

  elevationByDrawer.forEach((yCenter, idx) => {
    const isTall = idx < 3;
    const sideHeight = isTall ? 177 : 160;
    const tag = idx + 1;

    const dl = pushPiece(makePart({
      id: `td-drw-${tag}-l`,
      name: 'Lateral Izquierdo Caja Cajón',
      componentRole: 'drawer_box',
      length: 500,
      width: sideHeight,
      thickness: 15,
      orientation: 'vertical_yz',
      posX: -255,
      posY: yCenter,
      posZ: 0
    }));
    const dr = pushPiece(makePart({
      id: `td-drw-${tag}-r`,
      name: 'Lateral Derecho Caja Cajón',
      componentRole: 'drawer_box',
      length: 500,
      width: sideHeight,
      thickness: 15,
      orientation: 'vertical_yz',
      posX: 255,
      posY: yCenter,
      posZ: 0
    }));
    const dc = pushPiece(makePart({
      id: `td-drw-${tag}-c`,
      name: 'Contrafrente Interior Cajón',
      componentRole: 'drawer_box',
      length: 514,
      width: sideHeight,
      thickness: 15,
      orientation: 'vertical_xy',
      posX: 0,
      posY: yCenter,
      posZ: 225
    }));
    const dt = pushPiece(makePart({
      id: `td-drw-${tag}-t`,
      name: 'Trasera Interior Cajón',
      componentRole: 'drawer_box',
      length: 514,
      width: sideHeight,
      thickness: 15,
      orientation: 'vertical_xy',
      posX: 0,
      posY: yCenter,
      posZ: -225
    }));
    const df = pushPiece(makePart({
      id: `td-drw-${tag}-f`,
      name: 'Fondo MDF Cajón',
      componentRole: 'drawer_box',
      length: 524,
      width: 492,
      thickness: 3,
      orientation: 'horizontal',
      posX: 0,
      posY: yCenter - sideHeight / 2 + 12,
      posZ: 0
    }));

    const unitBox = [dl, dr, dc, dt, df];
    drawerBoxes.push(unitBox);
    if (idx === 0) template1Parts.push(...unitBox);
    if (idx === 3) template2Parts.push(...unitBox);
  });

  elevationByDrawer.forEach((yCenter, idx) => {
    const front = pushPiece(makePart({
      id: `td-front-${idx + 1}`,
      name: 'Frente de Cajón Exterior',
      componentRole: 'drawer_front',
      length: 596,
      width: idx < 3 ? 196 : 178,
      thickness: 18,
      orientation: 'vertical_xy',
      posX: 0,
      posY: yCenter,
      posZ: 274
    }));
    drawerFronts.push(front);
  });

  const allBoxParts = drawerBoxes.flat();
  const buildTemplateSummary = (boxesSlice: AssemblyGuidePiece[][], heightMm: number): AssemblyPieceGroupSummaryContract[] => [
    {
      key: `lat-l-${heightMm}`,
      label: `Lateral Izq. Caja (${heightMm}mm)`,
      role: 'drawer_box',
      dimensionsText: `500×${heightMm}×15`,
      quantity: boxesSlice.length,
      codes: boxesSlice.map(b => b[0].code),
      representativeCode: boxesSlice[0][0].code
    },
    {
      key: `lat-r-${heightMm}`,
      label: `Lateral Der. Caja (${heightMm}mm)`,
      role: 'drawer_box',
      dimensionsText: `500×${heightMm}×15`,
      quantity: boxesSlice.length,
      codes: boxesSlice.map(b => b[1].code),
      representativeCode: boxesSlice[0][1].code
    },
    {
      key: `cf-${heightMm}`,
      label: 'Contrafrente Interior',
      role: 'drawer_box',
      dimensionsText: `514×${heightMm}×15`,
      quantity: boxesSlice.length,
      codes: boxesSlice.map(b => b[2].code),
      representativeCode: boxesSlice[0][2].code
    },
    {
      key: `tr-${heightMm}`,
      label: 'Trasera Interior',
      role: 'drawer_box',
      dimensionsText: `514×${heightMm}×15`,
      quantity: boxesSlice.length,
      codes: boxesSlice.map(b => b[3].code),
      representativeCode: boxesSlice[0][3].code
    },
    {
      key: `bg-${heightMm}`,
      label: 'Fondo MDF',
      role: 'drawer_box',
      dimensionsText: '524×492×3',
      quantity: boxesSlice.length,
      codes: boxesSlice.map(b => b[4].code),
      representativeCode: boxesSlice[0][4].code
    }
  ];

  const sub1Summary = buildTemplateSummary(drawerBoxes.slice(0, 3), 177);
  const sub2Summary = buildTemplateSummary(drawerBoxes.slice(3, 6), 160);

  const subassemblies: AssemblyDrawerSubassemblyContract[] = [
    {
      id: 'sub-177',
      label: 'Cajón 177mm',
      repeatCount: 3,
      dimensions: { width: 544, height: 177, depth: 500 },
      boxHeight: 177,
      drawerUnitLabels: ['Cajón 1', 'Cajón 2', 'Cajón 3'],
      representativeParts: template1Parts,
      representativeFront: drawerFronts[0],
      allBoxPartCodes: drawerBoxes.slice(0, 3).flat().map(p => p.code),
      allFrontPartCodes: drawerFronts.slice(0, 3).map(p => p.code),
      allPartCodes: [...drawerBoxes.slice(0, 3).flat(), ...drawerFronts.slice(0, 3)].map(p => p.code),
      railElevationsMm: [145, 345, 545],
      pieceGroupsSummary: sub1Summary
    },
    {
      id: 'sub-160',
      label: 'Cajón 160mm',
      repeatCount: 3,
      dimensions: { width: 544, height: 160, depth: 500 },
      boxHeight: 160,
      drawerUnitLabels: ['Cajón 4', 'Cajón 5', 'Cajón 6'],
      representativeParts: template2Parts,
      representativeFront: drawerFronts[3],
      allBoxPartCodes: drawerBoxes.slice(3, 6).flat().map(p => p.code),
      allFrontPartCodes: drawerFronts.slice(3, 6).map(p => p.code),
      allPartCodes: [...drawerBoxes.slice(3, 6).flat(), ...drawerFronts.slice(3, 6)].map(p => p.code),
      railElevationsMm: [750, 940, 1130],
      pieceGroupsSummary: sub2Summary
    }
  ];

  const steps: AssemblyStepContract[] = [
    {
      stepNumber: 1,
      titleKey: 'assemblyGuide.step1CarcassTitle',
      defaultTitle: 'Paso 1: Armar Casco Base',
      descriptionKey: 'assemblyGuide.step1CarcassDesc',
      defaultDescription: 'Ensambla laterales P1, P2 con piso P3 y tapa P4.',
      actionType: 'carcass',
      renderMode: 'full_progress',
      partCodes: [p1.code, p2.code, p3.code, p4.code],
      parts: [p1, p2, p3, p4],
      cumulativePriorPartCodes: [],
      hardware: [],
      tips: []
    },
    {
      stepNumber: 2,
      titleKey: 'assemblyGuide.step2BackTitle',
      defaultTitle: 'Paso 2: Escuadrar y Fijar Fondo',
      descriptionKey: 'assemblyGuide.step2BackDesc',
      defaultDescription: 'Fija el fondo P5.',
      actionType: 'back',
      renderMode: 'full_progress',
      partCodes: [p5.code],
      parts: [p5],
      cumulativePriorPartCodes: [p1.code, p2.code, p3.code, p4.code],
      hardware: [],
      tips: []
    },
    {
      stepNumber: 3,
      titleKey: 'assemblyGuide.step3ShelvesTitle',
      defaultTitle: 'Paso 3: Instalar Zócalo',
      descriptionKey: 'assemblyGuide.step3ShelvesDesc',
      defaultDescription: 'Fija zócalo P6.',
      actionType: 'shelves',
      renderMode: 'full_progress',
      partCodes: [p6.code],
      parts: [p6],
      cumulativePriorPartCodes: [p1.code, p2.code, p3.code, p4.code, p5.code],
      hardware: [],
      tips: []
    },
    {
      stepNumber: 4,
      titleKey: 'assemblyGuide.stepDrawerSubassemblyUnmappedKey',
      defaultTitle: 'Armar cajas de cajón en mesa de trabajo',
      descriptionKey: 'assemblyGuide.stepDrawerSubassemblyUnmappedDesc',
      defaultDescription: 'Ensambla cada juego repetitivo antes de montar en el casco.',
      actionType: 'drawer_subassembly',
      renderMode: 'subassembly_zoom',
      partCodes: allBoxParts.map(p => p.code),
      parts: allBoxParts,
      cumulativePriorPartCodes: [p1.code, p2.code, p3.code, p4.code, p5.code, p6.code],
      subassemblyData: subassemblies,
      pieceGroupsSummary: sub1Summary,
      hardware: [],
      tips: ['Usa prensa esquinera antes de clavar fondos MDF.']
    },
    {
      stepNumber: 5,
      titleKey: 'assemblyGuide.stepCarcassMountUnmappedKey',
      defaultTitle: 'Instalar correderas y montar frentes de cajón',
      descriptionKey: 'assemblyGuide.stepCarcassMountUnmappedDesc',
      defaultDescription: 'Atornilla rieles telescópicos nivelados y desliza cada cajón.',
      actionType: 'drawers',
      renderMode: 'carcass_mount',
      partCodes: [...allBoxParts, ...drawerFronts].map(p => p.code),
      parts: [...allBoxParts, ...drawerFronts],
      cumulativePriorPartCodes: [p1.code, p2.code, p3.code, p4.code, p5.code, p6.code],
      measurements: [
        { label: 'Corredera Cajón 1', valueMm: 145 },
        { label: 'Corredera Cajón 2', valueMm: 345 },
        { label: 'Corredera Cajón 3', valueMm: 545 }
      ],
      hardware: [],
      tips: ['Verifica paralelismo entre pares izquierdo y derecho.']
    }
  ];

  return {
    moduleId: 'mod-cajonera-6',
    moduleName: 'Torre Cajonera 6 Cajones',
    moduleType: 'drawer_unit',
    dimensions: { width: 600, height: 1350, depth: 550 },
    totalPartsCount: pieces.length,
    estimatedAssemblyTimeMinutes: 75,
    requiredTools: ['Atornillador', 'Flexómetro', 'Escuadra', 'Prensa esquinera'],
    hardwareKit: [
      {
        id: 'telescopic_rails',
        name: 'Correderas Telescópicas 500 mm',
        codeName: 'Corredera Telescópica',
        spec: '500 mm cierre estándar',
        quantity: 6,
        type: 'drawer_slide',
        iconName: 'sliders'
      }
    ],
    pieces,
    steps: steps as unknown as AssemblyStep[],
    rawParts: pieces.map(p => p.part),
    drawerSubassemblies: subassemblies
  };
}

function createMockProject(): MelamineProject {
  return {
    id: 'proj-rta-1',
    name: 'Cocina Integral Studio',
    clientName: 'Taller Norte',
    date: '2026-11-15',
    notes: '',
    settings: {
      sawKerf: 4,
      trimMargin: 10,
      defaultBoardThickness: 18,
      thinEdgeThickness: 0.45,
      thickEdgeThickness: 2.0,
      thinEdgeCostPerMeter: 1800,
      thickEdgeCostPerMeter: 4200,
      currency: 'COP',
      optimizationPreference: 'best_fit',
      subtractEdgeBandingFromCut: false
    },
    materials: [],
    modules: [],
    parts: [],
    hardware: [],
    laborCost: 0,
    laborType: 'percent',
    profitMarginPercent: 25,
    taxPercent: 19,
    updatedAt: '2026-11-15',
    roomConfig: { ...DEFAULT_ROOM_CONFIG }
  };
}

describe('AssemblyGuideModalComponent (RTA 3D OBB, Progressive Steps, Minimalist Studio & Multi-Page Print)', () => {
  let component: AssemblyGuideModalComponent;
  let componentRef: ComponentRef<AssemblyGuideModalComponent>;
  let fixture: ComponentFixture<AssemblyGuideModalComponent>;
  let guidesSignal: ReturnType<typeof signal<ModuleAssemblyGuide[]>>;
  let projectSignal: ReturnType<typeof signal<MelamineProject>>;
  let restrictedSignal: ReturnType<typeof signal<boolean>>;
  let openUpgradeModalSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const primaryGuide = createAlacenaSobreNeveraGuide();
    guidesSignal = signal<ModuleAssemblyGuide[]>([primaryGuide]);
    projectSignal = signal<MelamineProject>(createMockProject());
    restrictedSignal = signal<boolean>(false);
    openUpgradeModalSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [AssemblyGuideModalComponent],
      providers: [
        JoineryEngineService,
        PartGeometryService,
        I18nService,
        {
          provide: AssemblyGuideService,
          useValue: {
            guides: guidesSignal
          }
        },
        {
          provide: ProjectStorageService,
          useValue: {
            currentProject: projectSignal
          }
        },
        {
          provide: PaymentService,
          useValue: {
            isWorkshopExportRestricted: restrictedSignal,
            openUpgradeModal: openUpgradeModalSpy
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssemblyGuideModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.querySelectorAll('.rta-print-iframe').forEach(el => el.remove());
  });

  describe('FASE 1: Orientación Espacial 3D Real (AABB + OBB) y Colisiones de Badges', () => {
    it('P5 Fondo Trasero Ranurado (868 x 398 x 3, vertical_xy) debe medir spanX === 868 y spanY === 398 (horizontal, nunca volteado)', () => {
      const guide = guidesSignal()[0];
      const p5 = guide.pieces.find(p => p.code === 'P5')!;
      const aabb = component.getPartAABB(p5.part);

      expect(aabb.spanX).toBe(868);
      expect(aabb.spanY).toBe(398);
      expect(aabb.spanZ).toBe(3);
      expect(aabb.spanX).toBeGreaterThan(aabb.spanY);

      const obb = component.getPieceOBB(p5.part);
      expect(obb.corners.length).toBe(8);
      const minX = Math.min(...obb.corners.map(c => c.x));
      const maxX = Math.max(...obb.corners.map(c => c.x));
      const minY = Math.min(...obb.corners.map(c => c.y));
      const maxY = Math.max(...obb.corners.map(c => c.y));
      expect(Math.round(maxX - minX)).toBe(868);
      expect(Math.round(maxY - minY)).toBe(398);
    });

    it('debe preservar la rotación 3D real en los 8 vértices OBB para piezas armadas manualmente con rotationY/rotationZ', () => {
      const rotatedBoard = makePart({
        id: 'manual-rot-1',
        name: 'Tablero Inclinado Manual',
        length: 600,
        width: 300,
        thickness: 18,
        orientation: 'horizontal',
        posX: 120,
        posY: 400,
        posZ: 50,
        rotationY: 45,
        rotationZ: 20
      });

      const obb = component.getPieceOBB(rotatedBoard);
      expect(obb.corners.length).toBe(8);
      // Los ejes del OBB deben ser unitarios y ortogonales pero ya NO canónicos
      expect(Math.abs(obb.axes[0].x)).toBeLessThan(0.95);
      expect(Math.abs(obb.axes[0].z)).toBeGreaterThan(0.3);

      // La distancia entre esquinas adyacentes a lo largo de length debe seguir siendo exactamente 600 mm
      const c0 = obb.corners[0];
      const c1 = obb.corners[1];
      const edgeLength = Math.hypot(c1.x - c0.x, c1.y - c0.y, c1.z - c0.z);
      expect(edgeLength).toBeCloseTo(600, 3);
    });

    it('computeMarginalCallouts debe ubicar llamadas CAD estrictamente fuera de la silueta en columnas izquierda/derecha sin solapamientos', () => {
      const inputs: MarginalCalloutInput[] = [
        { id: 'c1', code: 'P1', label: 'Lat. Izquierdo', anchorX: 190, anchorY: 140 },
        { id: 'c2', code: 'P2', label: 'Lat. Derecho', anchorX: 330, anchorY: 142 },
        { id: 'c3', code: 'P3', label: 'Piso Inferior', anchorX: 255, anchorY: 162 },
        { id: 'c4', code: 'P4', label: 'Tapa Superior', anchorX: 270, anchorY: 165 }
      ];

      const layout = computeMarginalCallouts(inputs, {
        canvasWidth: 560,
        canvasHeight: 360,
        silhouetteBounds: { minX: 170, maxX: 390, minY: 60, maxY: 300 },
        gutter: 16,
        pillHeight: 18,
        minGapY: 4,
        outerMargin: 10
      });

      expect(layout.all.length).toBe(4);
      for (const item of layout.leftColumn) {
        expect(item.pillRect.right).toBeLessThanOrEqual(170 - 16);
        expect(item.pillRect.left).toBeGreaterThanOrEqual(10);
      }
      for (const item of layout.rightColumn) {
        expect(item.pillRect.left).toBeGreaterThanOrEqual(390 + 16);
        expect(item.pillRect.right).toBeLessThanOrEqual(560 - 10);
      }

      for (let i = 0; i < layout.all.length; i++) {
        for (let j = i + 1; j < layout.all.length; j++) {
          expect(hasPlacementOverlap(layout.all[i], layout.all[j])).toBe(false);
        }
      }
    });

    it('computeMarginalCallouts con 26 puntos densos debe garantizar 0% solapamiento, fuera de silueta y orden vertical sin cruces', () => {
      const inputs: MarginalCalloutInput[] = Array.from({ length: 26 }, (_, idx) => {
        const isLeft = idx % 2 === 0;
        const row = Math.floor(idx / 2);
        return {
          id: `dense-${idx + 1}`,
          code: `P${idx + 1}`,
          label: `Pieza Módulo ${idx + 1}`,
          anchorX: isLeft ? 245 + (idx % 3) * 18 : 495 - (idx % 3) * 18,
          anchorY: 56 + row * 28,
          faceCenterX: idx < 4 ? 300 + idx * 45 : undefined,
          faceCenterY: idx < 4 ? 120 + idx * 55 : undefined,
          faceSpanW: idx < 4 ? 64 : undefined,
          faceSpanH: idx < 4 ? 42 : undefined
        };
      });

      const sil = { minX: 220, maxX: 540, minY: 44, maxY: 436 };
      const layout = computeMarginalCallouts(inputs, {
        canvasWidth: 760,
        canvasHeight: 480,
        silhouetteBounds: sil,
        gutter: 16,
        pillHeight: 18,
        minGapY: 4,
        outerMargin: 10
      });

      const placedTotal = layout.leftColumn.length + layout.rightColumn.length + layout.faceStamps.length;
      expect(placedTotal).toBe(26);

      // Todas las columnas marginales quedan estrictamente FUERA de la caja de la silueta
      for (const item of layout.leftColumn) {
        expect(item.pillRect.right).toBeLessThanOrEqual(sil.minX - 16);
      }
      for (const item of layout.rightColumn) {
        expect(item.pillRect.left).toBeGreaterThanOrEqual(sil.maxX + 16);
      }

      // Cero solapamiento entre ningún par de etiquetas colocadas
      const allPlaced = [...layout.leftColumn, ...layout.rightColumn, ...layout.faceStamps];
      for (let i = 0; i < allPlaced.length; i++) {
        for (let j = i + 1; j < allPlaced.length; j++) {
          expect(hasPlacementOverlap(allPlaced[i], allPlaced[j])).toBe(false);
        }
      }

      // Orden ascendente por anchorY y por pillRect.top dentro de cada nivel marginal (sin cruces)
      const checkColumnOrder = (col: MarginalCalloutPlacement[]): void => {
        const byTier = new Map<number, MarginalCalloutPlacement[]>();
        for (const item of col) {
          const list = byTier.get(item.columnTier) ?? [];
          list.push(item);
          byTier.set(item.columnTier, list);
        }
        for (const tierList of byTier.values()) {
          const sortedByAnchor = [...tierList].sort((a, b) => a.anchorY - b.anchorY);
          const sortedByPillTop = [...tierList].sort((a, b) => a.pillRect.top - b.pillRect.top);
          expect(sortedByPillTop.map(p => p.id)).toEqual(sortedByAnchor.map(p => p.id));
        }
      };

      checkColumnOrder(layout.leftColumn);
      checkColumnOrder(layout.rightColumn);
    });

    it('el selector debe incluir claramente el conjunto completo cuando existen múltiples muebles en escena', () => {
      const secondGuide: ModuleAssemblyGuide = {
        ...createAlacenaSobreNeveraGuide(),
        moduleId: 'mod-manual-2',
        moduleName: 'Mueble Armado Manual'
      };
      guidesSignal.set([guidesSignal()[0], secondGuide]);
      fixture.detectChanges();

      const selectEl = fixture.nativeElement.querySelector('#moduleGuideSelect') as HTMLSelectElement;
      const firstOption = selectEl.options[0];
      expect(firstOption.value).toBe('all');
      expect(firstOption.textContent).toContain('Todos los Muebles / Conjunto Completo en Escena');
      expect(component.filteredGuides().length).toBe(2);

      component.selectedModuleId.set('mod-manual-2');
      fixture.detectChanges();
      expect(component.filteredGuides().length).toBe(1);
      expect(component.filteredGuides()[0].moduleName).toBe('Mueble Armado Manual');
    });
  });

  describe('FASE 2: Renderizado Progresivo Estricto por Paso (Cero Piezas Futuras)', () => {
    it('Paso 1 (Casco) debe incluir SOLO P1..P4 y jamás P5 (Fondo), P6 (Repisa) o P7 (Puerta)', () => {
      const guide = guidesSignal()[0];
      const step1 = guide.steps[0];
      const items = component.getStepRenderPieces(guide, step1);
      const codes = items.map(i => i.piece.code);

      expect(codes).toEqual(['P1', 'P2', 'P3', 'P4']);
      expect(items.every(i => i.state === 'current')).toBe(true);
      expect(codes).not.toContain('P5');
      expect(codes).not.toContain('P6');
      expect(codes).not.toContain('P7');
    });

    it('Paso 2 (Fondo) debe incluir P1..P4 como prior y P5 como current, jamás P6 o P7', () => {
      const guide = guidesSignal()[0];
      const step2 = guide.steps[1];
      const items = component.getStepRenderPieces(guide, step2);

      const priorCodes = items.filter(i => i.state === 'prior').map(i => i.piece.code);
      const currentCodes = items.filter(i => i.state === 'current').map(i => i.piece.code);

      expect(priorCodes).toEqual(['P1', 'P2', 'P3', 'P4']);
      expect(currentCodes).toEqual(['P5']);
      expect(items.map(i => i.piece.code)).not.toContain('P6');
      expect(items.map(i => i.piece.code)).not.toContain('P7');
    });

    it('debe respetar cumulativePriorPartCodes si viene provisto por el servicio', () => {
      const guide = guidesSignal()[0];
      const stepWithContract = {
        ...guide.steps[2],
        cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4', 'P5']
      };
      const items = component.getStepRenderPieces(guide, stepWithContract);

      expect(items.filter(i => i.state === 'prior').map(i => i.piece.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
      expect(items.filter(i => i.state === 'current').map(i => i.piece.code)).toEqual(['P6']);
      expect(items.map(i => i.piece.code)).not.toContain('P7');
    });
  });

  describe('FASE 3: Tema Editorial Minimalist Studio Claro (Cero Dark Mode Forzado)', () => {
    it('el HTML renderizado no debe contener clases dark: ni fondos oscuros forzados ni SVG inline propios', () => {
      const rootEl = fixture.nativeElement as HTMLElement;
      const htmlString = rootEl.innerHTML;

      expect(htmlString).not.toContain('dark:');
      expect(htmlString).not.toContain('bg-zinc-950');
      expect(htmlString).not.toContain('purple-');
      expect(htmlString).not.toContain('violet-');

      const card = rootEl.querySelector('.assembly-guide-card') as HTMLElement;
      expect(card.className).toContain('bg-zinc-50');
      expect(card.className).toContain('text-zinc-900');

      const hwPill = rootEl.querySelector('.bg-sky-50.border-sky-200.text-sky-700');
      expect(hwPill).toBeTruthy();

      const inlineSvgsOutsideHugeicons = Array.from(rootEl.querySelectorAll('svg')).filter(
        svg => !svg.closest('hugeicons-icon')
      );
      expect(inlineSvgsOutsideHugeicons.length).toBe(0);
    });
  });

  describe('FASE 4: Documento Imprimible Multi-Página Completo (Cero Recorte 1/1)', () => {
    it('buildPrintableDocumentHtml debe generar CSS multi-página completo con todas las piezas P1..P7 y todos los pasos', () => {
      const guide = guidesSignal()[0];
      const explodedDataUrls = ['data:image/png;base64,EXPLODED_MOCK'];
      const stepDataUrls: Record<string, string> = {
        [`${guide.moduleId}::1`]: 'data:image/png;base64,STEP1_MOCK',
        [`${guide.moduleId}::2`]: 'data:image/png;base64,STEP2_MOCK',
        [`${guide.moduleId}::3`]: 'data:image/png;base64,STEP3_MOCK',
        [`${guide.moduleId}::4`]: 'data:image/png;base64,STEP4_MOCK'
      };

      const html = component.buildPrintableDocumentHtml(
        [guide],
        projectSignal(),
        explodedDataUrls,
        stepDataUrls
      );

      expect(html).toContain('@page { size: A4 portrait; margin: 12mm 14mm; }');
      expect(html).toContain('overflow: visible !important;');
      expect(html).toContain('max-height: none !important;');
      expect(html).toContain('table.parts-table thead {');
      expect(html).toContain('display: table-header-group;');
      expect(html).toContain('page-break-inside: avoid;');
      expect(html).toContain('.assembly-step-card');
      expect(html).toContain('background: #ffffff !important;');
      expect(html).not.toContain('dark:');

      // Todas las piezas P1..P7 deben aparecer en la tabla
      for (const code of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']) {
        expect(html).toContain(`>${code}<`);
      }
      expect(html).toContain('868 × 398 × 3');

      // Imagen explosiva + las 4 imágenes de paso + todos los pasos
      expect(html).toContain('data:image/png;base64,EXPLODED_MOCK');
      expect(html).toContain('data:image/png;base64,STEP1_MOCK');
      expect(html).toContain('data:image/png;base64,STEP4_MOCK');
      expect(html).toContain('Alacena Sobre-Nevera 90cm');
    });

    it('printGuide debe bloquear exportación si el plan está restringido y usar iframe aislado cuando está habilitado', () => {
      restrictedSignal.set(true);
      component.printGuide();
      expect(openUpgradeModalSpy).toHaveBeenCalledWith('workshop_export', 'pro');
      expect(document.querySelector('.rta-print-iframe')).toBeNull();

      restrictedSignal.set(false);
      component.printGuide();
      const iframe = document.querySelector('.rta-print-iframe') as HTMLIFrameElement | null;
      expect(iframe).not.toBeNull();
      expect(iframe?.contentDocument?.body.innerHTML).toContain('Alacena Sobre-Nevera 90cm');
      expect(iframe?.contentDocument?.body.innerHTML).toContain('P7');
    });
  });

  describe('FASE 5: Modo Por Grupos, Sub-ensambles Zoom, Resaltado Interactivo y Protección PDF', () => {
    it('un módulo complejo multi-cajón inicia en modo grouped y cambia limpiamente a detailed mientras módulos simples permanecen en detailed', () => {
      const simpleGuide = guidesSignal()[0];
      expect(component.hasExplodedGroups(simpleGuide)).toBe(false);
      expect(component.getEffectiveExplodedViewMode(simpleGuide)).toBe('detailed');

      const complexGuide = createSixDrawerTowerGuide();
      guidesSignal.set([complexGuide]);
      fixture.detectChanges();

      expect(component.hasExplodedGroups(complexGuide)).toBe(true);
      expect(component.getEffectiveExplodedViewMode(complexGuide)).toBe('grouped');

      const rootEl = fixture.nativeElement as HTMLElement;
      const detailedBtn = Array.from(rootEl.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Todas las Piezas')
      );
      expect(detailedBtn).toBeTruthy();

      detailedBtn?.click();
      fixture.detectChanges();
      expect(component.getEffectiveExplodedViewMode(complexGuide)).toBe('detailed');

      const groupedBtn = Array.from(rootEl.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Por Grupos')
      );
      groupedBtn?.click();
      fixture.detectChanges();
      expect(component.getEffectiveExplodedViewMode(complexGuide)).toBe('grouped');
    });

    it('subassembly_zoom muestra fallback i18n, insignia 04A/04B, plantillas múltiples, fichas agrupadas ×3 y expandir códigos', () => {
      const complexGuide = createSixDrawerTowerGuide();
      guidesSignal.set([complexGuide]);
      fixture.detectChanges();

      const step4 = complexGuide.steps[3];
      const step5 = complexGuide.steps[4];
      expect(component.formatStepDisplayNumber(complexGuide, step4)).toBe('04A');
      expect(component.formatStepDisplayNumber(complexGuide, step5)).toBe('04B');
      expect(component.getStepTitle(step4)).toBe('Armar cajas de cajón en mesa de trabajo');
      expect(component.getStepDescription(step4)).toContain('Ensambla cada juego repetitivo');

      const rootEl = fixture.nativeElement as HTMLElement;
      expect(rootEl.textContent).toContain('Cajón 177mm (×3)');
      expect(rootEl.textContent).toContain('Cajón 160mm (×3)');
      expect(rootEl.textContent).toContain('×3');
      expect(rootEl.textContent).toContain('524×492×3 mm');

      const secondTemplateBtn = Array.from(rootEl.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Cajón 160mm')
      );
      secondTemplateBtn?.click();
      fixture.detectChanges();
      expect(component.getSelectedSubassemblyIndex(complexGuide.moduleId, step4.stepNumber, 2)).toBe(1);

      expect(component.isStepPiecesExpanded(complexGuide.moduleId, step4.stepNumber)).toBe(false);
      const expandBtn = Array.from(rootEl.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Ver códigos individuales')
      );
      expect(expandBtn).toBeTruthy();
      expandBtn?.click();
      fixture.detectChanges();
      expect(component.isStepPiecesExpanded(complexGuide.moduleId, step4.stepNumber)).toBe(true);
    });

    it('hover y clic actualizan activeHighlightedCodes(), muestran la píldora flotante y alternan pin/unpin', () => {
      const complexGuide = createSixDrawerTowerGuide();
      guidesSignal.set([complexGuide]);
      fixture.detectChanges();

      const targetCodes = ['P11', 'P16', 'P21'];
      component.onPartHoverStart(targetCodes, 'P11, P16, P21 · Fondo MDF · Grupo ×3', 'dom');
      fixture.detectChanges();

      expect(component.activeHighlightedCodes()).toEqual(targetCodes);
      const rootEl = fixture.nativeElement as HTMLElement;
      const highlightPill = rootEl.querySelector('.assembly-highlight-pill');
      expect(highlightPill?.textContent).toContain('Grupo ×3');

      component.onPartHoverEnd('dom');
      fixture.detectChanges();
      expect(component.activeHighlightedCodes()).toEqual([]);

      // Clic fija la selección; segundo clic la suelta
      const groupedChipBtn = Array.from(rootEl.querySelectorAll('button')).find(
        btn => btn.textContent?.includes('Fondo MDF') && btn.textContent?.includes('×3')
      );
      groupedChipBtn?.click();
      fixture.detectChanges();

      expect(component.pinnedPartCodes()).toEqual(targetCodes);
      expect(component.activeHighlightedCodes()).toEqual(targetCodes);
      expect(rootEl.querySelector('.assembly-highlight-pill')).toBeTruthy();

      groupedChipBtn?.click();
      fixture.detectChanges();
      expect(component.pinnedPartCodes()).toEqual([]);
      expect(component.activeHighlightedCodes()).toEqual([]);
    });

    it('exportación PDF ignora hover/pin activo en captura offscreen e incluye plantillas subassembly_zoom sin atenuación', () => {
      const complexGuide = createSixDrawerTowerGuide();
      guidesSignal.set([complexGuide]);
      fixture.detectChanges();

      component.onPartTogglePin(['P11', 'P16', 'P21'], 'Fondo MDF · Grupo ×3');
      fixture.detectChanges();
      expect(component.activeHighlightedCodes()).toEqual(['P11', 'P16', 'P21']);

      const recordedAlphas: number[] = [];
      let currentAlpha = 1;
      const noop = (): void => {};
      const mockCtx = {
        get globalAlpha(): number {
          return currentAlpha;
        },
        set globalAlpha(v: number) {
          currentAlpha = v;
          recordedAlphas.push(v);
        },
        fillStyle: '#FFFFFF',
        strokeStyle: '#18181B',
        lineWidth: 1,
        lineJoin: 'round',
        lineCap: 'round',
        font: '12px Inter',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        scale: noop,
        setTransform: noop,
        clearRect: noop,
        fillRect: noop,
        strokeRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        closePath: noop,
        fill: noop,
        stroke: noop,
        arc: noop,
        setLineDash: noop,
        save: noop,
        restore: noop,
        fillText: noop,
        roundRect: noop,
        measureText: (text: string) => ({ width: text.length * 6 })
      };

      const ctxSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(() => mockCtx as unknown as RenderingContext);

      try {
        restrictedSignal.set(false);
        component.printGuide();

        // Nunca debe aplicar opacidades atenuadas de hover/pin durante captura PDF offscreen
        const hasHighlightDimmingAlpha = recordedAlphas.some(
          a =>
            Math.abs(a - 0.16) < 0.005 ||
            Math.abs(a - 0.24) < 0.005 ||
            Math.abs(a - 0.25) < 0.005 ||
            Math.abs(a - 0.28) < 0.005
        );
        expect(hasHighlightDimmingAlpha).toBe(false);

        // El estado interactivo del usuario en UI no se pierde al exportar
        expect(component.pinnedPartCodes()).toEqual(['P11', 'P16', 'P21']);

        const html = component.buildPrintableDocumentHtml(
          [complexGuide],
          projectSignal(),
          ['data:image/png;base64,COMPLEX_EXPLODED'],
          {
            [`${complexGuide.moduleId}::1`]: 'data:image/png;base64,COMPLEX_STEP1',
            [`${complexGuide.moduleId}::5`]: 'data:image/png;base64,COMPLEX_STEP5'
          },
          {
            [`${complexGuide.moduleId}::4`]: [
              { label: 'Cajón 177mm (×3)', url: 'data:image/png;base64,SUB_177' },
              { label: 'Cajón 160mm (×3)', url: 'data:image/png;base64,SUB_160' }
            ]
          }
        );

        expect(html).toContain('04A');
        expect(html).toContain('04B');
        expect(html).toContain('data:image/png;base64,SUB_177');
        expect(html).toContain('data:image/png;base64,SUB_160');
        expect(html).toContain('×3');
        expect(html).toContain('P42');
        expect(html).not.toContain('assembly-highlight-pill');
      } finally {
        ctxSpy.mockRestore();
      }
    });
  });
});
