import { TestBed } from '@angular/core/testing';
import {
  CONTEXT_MENU_Z_INDEX,
  ContainerBoundsRect,
  ContextMenuPositioningService,
  DEFAULT_CONTEXT_MENU_HEIGHT_PX,
  DEFAULT_CONTEXT_MENU_WIDTH_PX,
  SAFE_VIEWPORT_BOTTOM_MARGIN_PX,
  SAFE_VIEWPORT_LEFT_PX,
  SAFE_VIEWPORT_RIGHT_MARGIN_PX,
  SAFE_VIEWPORT_TOP_PX,
  SUBMENU_BOTTOM_THRESHOLD_PX,
  SUBMENU_RIGHT_THRESHOLD_PX,
  computeSafeViewportBounds,
  computeSmartContextMenuPosition,
  computeSubmenuPlacement,
  findOpenRightPanelLeftPx
} from './context-menu-positioning.service';

describe('ContextMenuPositioningService (Smart Context Menu Positioning Engine)', () => {
  let service: ContextMenuPositioningService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContextMenuPositioningService]
    });
    service = TestBed.inject(ContextMenuPositioningService);
  });

  describe('1. Constantes exportadas y API del servicio', () => {
    it('debe exportar las constantes de área segura y umbrales con valores exactos', () => {
      expect(SAFE_VIEWPORT_TOP_PX).toBe(76);
      expect(SAFE_VIEWPORT_BOTTOM_MARGIN_PX).toBe(92);
      expect(SAFE_VIEWPORT_LEFT_PX).toBe(68);
      expect(SAFE_VIEWPORT_RIGHT_MARGIN_PX).toBe(16);
      expect(DEFAULT_CONTEXT_MENU_WIDTH_PX).toBe(310);
      expect(DEFAULT_CONTEXT_MENU_HEIGHT_PX).toBe(460);
      expect(SUBMENU_RIGHT_THRESHOLD_PX).toBe(240);
      expect(SUBMENU_BOTTOM_THRESHOLD_PX).toBe(200);
      expect(CONTEXT_MENU_Z_INDEX).toBe(60);
    });

    it('debe exponer métodos equivalentes en el servicio inyectable', () => {
      const bounds = service.computeSafeViewportBounds(1440, 900);
      expect(bounds).toEqual(computeSafeViewportBounds(1440, 900));

      const input = {
        clientX: 400,
        clientY: 250,
        viewportWidth: 1440,
        viewportHeight: 900
      };
      expect(service.computeSmartContextMenuPosition(input)).toEqual(
        computeSmartContextMenuPosition(input)
      );

      const submenuInput = {
        menuRect: { left: 400, right: 710, top: 250, bottom: 710 },
        viewportWidth: 1440,
        viewportHeight: 900
      };
      expect(service.computeSubmenuPlacement(submenuInput)).toEqual(
        computeSubmenuPlacement(submenuInput)
      );
    });
  });

  describe('2. computeSafeViewportBounds', () => {
    it('calcula límites seguros estándar sin contenedor ni panel derecho', () => {
      const bounds = computeSafeViewportBounds(1440, 900);
      expect(bounds).toEqual({
        top: 76,
        bottom: 808,
        left: 68,
        right: 1424,
        viewportWidth: 1440,
        viewportHeight: 900
      });
    });

    it('respeta containerRect para evitar barra lateral, barra superior y barra de estado negra del visor 3D', () => {
      const containerRect: ContainerBoundsRect = {
        top: 74,
        left: 20,
        right: 1380,
        bottom: 830,
        width: 1360,
        height: 756
      };

      const bounds = computeSafeViewportBounds(1440, 900, null, containerRect);
      expect(bounds.top).toBe(82); // 74 + 8 > 76
      expect(bounds.bottom).toBe(794); // min(900 - 92 = 808, 830 - 36 = 794)
      expect(bounds.left).toBe(78); // 20 + 58 > 68
      expect(bounds.right).toBe(1372); // 1380 < 1424 => 1380 - 8
    });

    it('da prioridad a rightPanelLeft sobre containerRect cuando el inspector derecho está abierto', () => {
      const containerRect: ContainerBoundsRect = {
        top: 64,
        left: 0,
        right: 1120,
        bottom: 860,
        width: 1120,
        height: 796
      };

      const bounds = computeSafeViewportBounds(1440, 900, 1080, containerRect);
      expect(bounds.right).toBe(1072); // 1080 - 8
      expect(bounds.bottom).toBe(808); // min(808, 860 - 36 = 824)
    });

    it('protege viewportHeight < 200 y anchos estrechos sin invertir los límites', () => {
      const tinyBounds = computeSafeViewportBounds(150, 140, 90);
      expect(tinyBounds.top).toBe(76);
      expect(tinyBounds.bottom).toBe(76);
      expect(tinyBounds.left).toBe(68);
      expect(tinyBounds.right).toBe(188); // 68 + 120
    });
  });

  describe('3. computeSmartContextMenuPosition', () => {
    it('abre en el centro del viewport sin voltear ni recortar cuando hay espacio suficiente', () => {
      const pos = computeSmartContextMenuPosition({
        clientX: 520,
        clientY: 220,
        menuWidth: 310,
        menuHeight: 420,
        viewportWidth: 1440,
        viewportHeight: 900
      });

      expect(pos.x).toBe(520);
      expect(pos.y).toBe(220);
      expect(pos.flippedVertical).toBe(false);
      expect(pos.flippedHorizontal).toBe(false);
      expect(pos.clampedToSafeArea).toBe(false);
      expect(pos.maxHeightPx).toBe(732); // 808 - 76
      expect(pos.y + 420).toBeLessThanOrEqual(pos.safeBounds.bottom);
    });

    it('auto-voltea hacia arriba al hacer clic cerca del borde inferior para mantener Eliminar Pieza visible sobre barras inferiores', () => {
      const menuHeight = 460;
      const pos = computeSmartContextMenuPosition({
        clientX: 480,
        clientY: 760,
        menuWidth: 310,
        menuHeight,
        viewportWidth: 1440,
        viewportHeight: 900
      });

      // safeBottom = 900 - 92 = 808; clientY (760) + 460 = 1220 > 808
      // clientY - 460 = 300 >= safeTop (76)
      expect(pos.flippedVertical).toBe(true);
      expect(pos.flippedHorizontal).toBe(false);
      expect(pos.clampedToSafeArea).toBe(false);
      expect(pos.x).toBe(480);
      expect(pos.y).toBe(300);
      expect(pos.y + menuHeight).toBeLessThanOrEqual(pos.safeBounds.bottom);
    });

    it('sujeta al área segura cuando el menú es alto o la pantalla es baja (clientY - menuHeight < safeTop)', () => {
      // Caso A: pantalla normal 800px de alto (safeTop=76, safeBottom=708), clic en y=500 con menú de 460px
      const normalScreenPos = computeSmartContextMenuPosition({
        clientX: 450,
        clientY: 500,
        menuWidth: 310,
        menuHeight: 460,
        viewportWidth: 1280,
        viewportHeight: 800
      });

      expect(normalScreenPos.flippedVertical).toBe(true);
      expect(normalScreenPos.clampedToSafeArea).toBe(true);
      expect(normalScreenPos.y).toBe(248); // max(76, 708 - 460)
      expect(normalScreenPos.y + 460).toBeLessThanOrEqual(normalScreenPos.safeBounds.bottom);

      // Caso B: pantalla corta 540px de alto (safeTop=76, safeBottom=448, maxHeightPx=372)
      const shortScreenPos = computeSmartContextMenuPosition({
        clientX: 450,
        clientY: 420,
        menuWidth: 310,
        menuHeight: 460,
        viewportWidth: 1280,
        viewportHeight: 540
      });

      expect(shortScreenPos.flippedVertical).toBe(true);
      expect(shortScreenPos.clampedToSafeArea).toBe(true);
      expect(shortScreenPos.maxHeightPx).toBe(372);
      expect(shortScreenPos.y).toBe(76); // max(76, 448 - min(460, 372))
    });

    it('mantiene el menú encima de safeBottom incluso si el clic ocurre por debajo de safeBottom', () => {
      const pos = computeSmartContextMenuPosition({
        clientX: 400,
        clientY: 760,
        menuWidth: 280,
        menuHeight: 220,
        viewportWidth: 1280,
        viewportHeight: 800
      });

      expect(pos.flippedVertical).toBe(true);
      expect(pos.clampedToSafeArea).toBe(true);
      expect(pos.y).toBe(488); // safeBottom (708) - 220
      expect(pos.y + 220).toBeLessThanOrEqual(pos.safeBounds.bottom);
    });

    it('sujeta a (68, 76) al hacer clic en la esquina superior izquierda fuera del área segura', () => {
      const pos = computeSmartContextMenuPosition({
        clientX: 20,
        clientY: 30,
        menuWidth: 310,
        menuHeight: 460,
        viewportWidth: 1440,
        viewportHeight: 900
      });

      expect(pos.x).toBe(68);
      expect(pos.y).toBe(76);
      expect(pos.flippedHorizontal).toBe(false);
      expect(pos.flippedVertical).toBe(false);
      expect(pos.clampedToSafeArea).toBe(true);
    });

    it('voltea tanto a la izquierda como hacia arriba en la esquina inferior derecha', () => {
      const menuWidth = 310;
      const menuHeight = 460;
      const pos = computeSmartContextMenuPosition({
        clientX: 1380,
        clientY: 780,
        menuWidth,
        menuHeight,
        viewportWidth: 1440,
        viewportHeight: 900
      });

      expect(pos.flippedHorizontal).toBe(true);
      expect(pos.flippedVertical).toBe(true);
      expect(pos.clampedToSafeArea).toBe(false);
      expect(pos.x).toBe(1380 - menuWidth); // 1070
      expect(pos.y).toBe(780 - menuHeight); // 320
      expect(pos.x + menuWidth).toBeLessThanOrEqual(pos.safeBounds.right);
      expect(pos.y + menuHeight).toBeLessThanOrEqual(pos.safeBounds.bottom);
    });

    it('voltea hacia la izquierda antes de solapar la barra lateral derecha abierta', () => {
      const containerRect: ContainerBoundsRect = {
        top: 64,
        left: 0,
        right: 1080,
        bottom: 860,
        width: 1080,
        height: 796
      };

      const posWithPanelLeft = computeSmartContextMenuPosition({
        clientX: 980,
        clientY: 180,
        menuWidth: 310,
        menuHeight: 460,
        viewportWidth: 1440,
        viewportHeight: 900,
        rightPanelLeft: 1080,
        containerRect
      });

      expect(posWithPanelLeft.safeBounds.right).toBe(1072);
      expect(posWithPanelLeft.flippedHorizontal).toBe(true);
      expect(posWithPanelLeft.x).toBe(670); // 980 - 310
      expect(posWithPanelLeft.x + 310).toBeLessThanOrEqual(1072);

      // También funciona detectando containerRect.right cuando rightPanelLeft es null
      const posFromContainer = computeSmartContextMenuPosition({
        clientX: 980,
        clientY: 180,
        menuWidth: 310,
        menuHeight: 460,
        viewportWidth: 1440,
        viewportHeight: 900,
        rightPanelLeft: null,
        containerRect
      });
      expect(posFromContainer).toEqual(posWithPanelLeft);
    });

    it('recalcula desde la estimación inicial (310x460) al rectángulo DOM medido (280x520 y 240x200)', () => {
      const baseCursor = {
        clientX: 1040,
        clientY: 660,
        viewportWidth: 1280,
        viewportHeight: 800
      };

      // Paso 1: estimación inicial por defecto (310x460)
      const initial = computeSmartContextMenuPosition(baseCursor);
      expect(initial.x).toBe(730); // 1040 - 310
      expect(initial.y).toBe(200); // 660 - 460
      expect(initial.flippedHorizontal).toBe(true);
      expect(initial.flippedVertical).toBe(true);

      // Paso 2a: menú DOM medido más alto (280x520) -> se reajusta hacia arriba para no invadir safeBottom
      const measuredTall = computeSmartContextMenuPosition({
        ...baseCursor,
        menuWidth: 280,
        menuHeight: 520
      });
      expect(measuredTall.x).toBe(760); // 1040 - 280
      expect(measuredTall.y).toBe(140); // 660 - 520
      expect(measuredTall.y + 520).toBeLessThanOrEqual(measuredTall.safeBounds.bottom);

      // Paso 2b: menú compacto de espacio vacío (240x200) cerca del centro-derecha -> cabe sin flip
      const emptySpaceCursor = {
        clientX: 1000,
        clientY: 480,
        viewportWidth: 1280,
        viewportHeight: 800
      };
      const estimateForEmpty = computeSmartContextMenuPosition(emptySpaceCursor);
      expect(estimateForEmpty.flippedHorizontal).toBe(true);
      expect(estimateForEmpty.flippedVertical).toBe(true);

      const measuredCompact = computeSmartContextMenuPosition({
        ...emptySpaceCursor,
        menuWidth: 240,
        menuHeight: 200
      });
      expect(measuredCompact.flippedHorizontal).toBe(false);
      expect(measuredCompact.flippedVertical).toBe(false);
      expect(measuredCompact.x).toBe(1000);
      expect(measuredCompact.y).toBe(480);
    });

    it('redondea coordenadas fraccionarias, usa defaults ante dimensiones inválidas y sujeta flip horizontal estrecho', () => {
      const fractional = computeSmartContextMenuPosition({
        clientX: 412.6,
        clientY: 205.4,
        menuWidth: -10,
        menuHeight: 0,
        viewportWidth: 1440,
        viewportHeight: 900
      });
      expect(fractional.x).toBe(413);
      expect(fractional.y).toBe(205);

      // En ventana de 420px (safeLeft=68, safeRight=404), clic en x=200 con menú 310px
      // flip daría 200-310=-110 < 68, así que sujeta a safeLeft=68
      const narrowFlip = computeSmartContextMenuPosition({
        clientX: 200,
        clientY: 160,
        menuWidth: 310,
        menuHeight: 280,
        viewportWidth: 420,
        viewportHeight: 900
      });
      expect(narrowFlip.flippedHorizontal).toBe(true);
      expect(narrowFlip.clampedToSafeArea).toBe(true);
      expect(narrowFlip.x).toBe(68);
      expect(narrowFlip.x + 310).toBeLessThanOrEqual(narrowFlip.safeBounds.right);
    });
  });

  describe('4. computeSubmenuPlacement', () => {
    it('abre a la izquierda cuando queda menos de 240px a la derecha y hacia arriba cerca del borde inferior', () => {
      const nearBottomRight = computeSubmenuPlacement({
        menuRect: { left: 820, right: 1100, top: 200, bottom: 560 },
        viewportWidth: 1280,
        viewportHeight: 800
      });

      // 1280 - 1100 = 180 < 240 => openLeft: true
      // (800 - 92 = 708) - 560 = 148 < 200 => openUp: true
      expect(nearBottomRight).toEqual({
        openLeft: true,
        openUp: true
      });
    });

    it('abre a la derecha y hacia abajo cuando hay margen suficiente, respetando safeBottom y umbrales personalizados', () => {
      const spacious = computeSubmenuPlacement({
        menuRect: { left: 200, right: 500, top: 100, bottom: 400 },
        viewportWidth: 1280,
        viewportHeight: 800
      });
      expect(spacious).toEqual({
        openLeft: false,
        openUp: false
      });

      const exactBoundary = computeSubmenuPlacement({
        menuRect: { left: 730, right: 1040, top: 100, bottom: 508 },
        viewportWidth: 1280,
        viewportHeight: 800
      });
      // 1280 - 1040 = 240 (no < 240), 708 - 508 = 200 (no < 200)
      expect(exactBoundary).toEqual({
        openLeft: false,
        openUp: false
      });

      const customThresholds = computeSubmenuPlacement({
        menuRect: { left: 600, right: 900, top: 100, bottom: 450 },
        viewportWidth: 1200,
        viewportHeight: 800,
        requiredSubmenuWidth: 320,
        requiredSubmenuHeight: 220,
        safeBottom: 650
      });
      // 1200 - 900 = 300 < 320 => openLeft: true; 650 - 450 = 200 < 220 => openUp: true
      expect(customThresholds).toEqual({
        openLeft: true,
        openUp: true
      });
    });
  });

  describe('5. findOpenRightPanelLeftPx', () => {
    it('retorna null cuando no existe [data-right-inspector] o tiene ancho <= 40', () => {
      const doc = document.implementation.createHTMLDocument('empty');
      expect(findOpenRightPanelLeftPx(doc)).toBeNull();

      const collapsed = doc.createElement('aside');
      collapsed.setAttribute('data-right-inspector', '');
      vi.spyOn(collapsed, 'getBoundingClientRect').mockReturnValue({
        left: 1240,
        top: 0,
        right: 1280,
        bottom: 800,
        width: 40,
        height: 800,
        x: 1240,
        y: 0,
        toJSON: () => ({})
      });
      doc.body.appendChild(collapsed);

      expect(service.findOpenRightPanelLeftPx(doc)).toBeNull();
    });

    it('ignora paneles ocultos con display: none o visibility: hidden', () => {
      const doc = document.implementation.createHTMLDocument('hidden-inspector');
      const hiddenPanel = doc.createElement('aside');
      hiddenPanel.setAttribute('data-right-inspector', '');
      hiddenPanel.style.display = 'none';
      vi.spyOn(hiddenPanel, 'getBoundingClientRect').mockReturnValue({
        left: 980,
        top: 0,
        right: 1280,
        bottom: 800,
        width: 300,
        height: 800,
        x: 980,
        y: 0,
        toJSON: () => ({})
      });
      doc.body.appendChild(hiddenPanel);

      expect(findOpenRightPanelLeftPx(doc)).toBeNull();

      hiddenPanel.style.display = 'block';
      hiddenPanel.style.visibility = 'hidden';
      expect(findOpenRightPanelLeftPx(doc)).toBeNull();
    });

    it('retorna el borde izquierdo cuando [data-right-inspector] está visible con width > 40', () => {
      const doc = document.implementation.createHTMLDocument('open-inspector');
      const inspector = doc.createElement('aside');
      inspector.setAttribute('data-right-inspector', '');
      vi.spyOn(inspector, 'getBoundingClientRect').mockReturnValue({
        left: 1060,
        top: 64,
        right: 1440,
        bottom: 900,
        width: 380,
        height: 836,
        x: 1060,
        y: 64,
        toJSON: () => ({})
      });
      doc.body.appendChild(inspector);

      expect(findOpenRightPanelLeftPx(doc)).toBe(1060);
      expect(service.findOpenRightPanelLeftPx(doc)).toBe(1060);
    });

    it('maneja documentos mock mínimos o nulos sin lanzar excepciones', () => {
      const minimalDoc = {
        querySelector: () => ({
          getBoundingClientRect: () => ({ left: 990, width: 290 })
        })
      } as unknown as Document;

      expect(findOpenRightPanelLeftPx(minimalDoc)).toBe(990);
      expect(findOpenRightPanelLeftPx(undefined)).toBeNull();
    });
  });
});
