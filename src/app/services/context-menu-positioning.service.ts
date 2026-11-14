import { Injectable } from '@angular/core';

export const SAFE_VIEWPORT_TOP_PX = 76;
export const SAFE_VIEWPORT_BOTTOM_MARGIN_PX = 92;
export const SAFE_VIEWPORT_LEFT_PX = 68;
export const SAFE_VIEWPORT_RIGHT_MARGIN_PX = 16;

export const DEFAULT_CONTEXT_MENU_WIDTH_PX = 310;
export const DEFAULT_CONTEXT_MENU_HEIGHT_PX = 460;

export const SUBMENU_RIGHT_THRESHOLD_PX = 240;
export const SUBMENU_BOTTOM_THRESHOLD_PX = 200;

export const CONTEXT_MENU_Z_INDEX = 60;

const CONTAINER_TOP_PADDING_PX = 8;
const CONTAINER_BOTTOM_STATUS_BAR_GUARD_PX = 36;
const CONTAINER_LEFT_TOOLBAR_GUARD_PX = 58;
const RIGHT_PANEL_GAP_PX = 8;
const MIN_SAFE_WIDTH_PX = 120;
const MIN_SAFE_HEIGHT_PX = 120;
const MIN_VISIBLE_RIGHT_PANEL_WIDTH_PX = 40;

export interface ContainerBoundsRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SafeViewportBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface SmartContextMenuInput {
  clientX: number;
  clientY: number;
  menuWidth?: number;
  menuHeight?: number;
  viewportWidth: number;
  viewportHeight: number;
  rightPanelLeft?: number | null;
  containerRect?: ContainerBoundsRect | null;
}

export interface SmartContextMenuPosition {
  x: number;
  y: number;
  flippedVertical: boolean;
  flippedHorizontal: boolean;
  clampedToSafeArea: boolean;
  maxHeightPx: number;
  safeBounds: SafeViewportBounds;
}

export interface SubmenuPlacementInput {
  menuRect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  viewportWidth: number;
  viewportHeight: number;
  requiredSubmenuWidth?: number;
  requiredSubmenuHeight?: number;
  safeBottom?: number;
}

export interface SubmenuPlacement {
  openLeft: boolean;
  openUp: boolean;
}

/**
 * Calcula los límites seguros del viewport donde el menú contextual 3D puede renderizarse
 * sin solapar barras superiores, barra lateral izquierda, panel inspector derecho,
 * barra de estado inferior del canvas ni la franja de chips inferiores.
 */
export function computeSafeViewportBounds(
  viewportWidth: number,
  viewportHeight: number,
  rightPanelLeft?: number | null,
  containerRect?: ContainerBoundsRect | null
): SafeViewportBounds {
  const safeViewportWidth = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;

  const hasValidContainerHeight =
    containerRect != null &&
    Number.isFinite(containerRect.height) &&
    containerRect.height > 0 &&
    Number.isFinite(containerRect.top) &&
    Number.isFinite(containerRect.bottom);

  const hasValidContainerWidth =
    containerRect != null &&
    Number.isFinite(containerRect.width) &&
    containerRect.width > 0 &&
    Number.isFinite(containerRect.left) &&
    Number.isFinite(containerRect.right);

  const top = Math.max(
    SAFE_VIEWPORT_TOP_PX,
    hasValidContainerHeight
      ? Math.round(containerRect.top + CONTAINER_TOP_PADDING_PX)
      : SAFE_VIEWPORT_TOP_PX
  );

  const windowSafeBottom = Math.round(safeViewportHeight - SAFE_VIEWPORT_BOTTOM_MARGIN_PX);
  const rawBottom = hasValidContainerHeight
    ? Math.min(windowSafeBottom, Math.round(containerRect.bottom - CONTAINER_BOTTOM_STATUS_BAR_GUARD_PX))
    : windowSafeBottom;
  // Evita invertir top/bottom cuando viewportHeight < 200 o el contenedor es muy pequeño
  const bottom = Math.max(top, rawBottom);

  const left = Math.max(
    SAFE_VIEWPORT_LEFT_PX,
    hasValidContainerWidth
      ? Math.round(containerRect.left + CONTAINER_LEFT_TOOLBAR_GUARD_PX)
      : SAFE_VIEWPORT_LEFT_PX
  );

  const rawRight = Math.round(safeViewportWidth - SAFE_VIEWPORT_RIGHT_MARGIN_PX);
  let computedRight = rawRight;

  if (rightPanelLeft != null && Number.isFinite(rightPanelLeft) && rightPanelLeft > 0) {
    computedRight = Math.min(rawRight, Math.round(rightPanelLeft - RIGHT_PANEL_GAP_PX));
  } else if (
    hasValidContainerWidth &&
    containerRect.right > 0 &&
    containerRect.right < safeViewportWidth - SAFE_VIEWPORT_RIGHT_MARGIN_PX
  ) {
    computedRight = Math.min(rawRight, Math.round(containerRect.right - RIGHT_PANEL_GAP_PX));
  }

  const right = Math.max(left + MIN_SAFE_WIDTH_PX, computedRight);

  return {
    top,
    bottom,
    left,
    right,
    viewportWidth: safeViewportWidth,
    viewportHeight: safeViewportHeight
  };
}

/**
 * Calcula la posición inteligente `(x, y)` del menú contextual con auto-flip horizontal/vertical,
 * sujeción al área segura y cálculo de altura máxima disponible para scroll interno.
 */
export function computeSmartContextMenuPosition(
  input: SmartContextMenuInput
): SmartContextMenuPosition {
  const menuWidth =
    input.menuWidth != null && Number.isFinite(input.menuWidth) && input.menuWidth > 0
      ? input.menuWidth
      : DEFAULT_CONTEXT_MENU_WIDTH_PX;
  const menuHeight =
    input.menuHeight != null && Number.isFinite(input.menuHeight) && input.menuHeight > 0
      ? input.menuHeight
      : DEFAULT_CONTEXT_MENU_HEIGHT_PX;

  const safeBounds = computeSafeViewportBounds(
    input.viewportWidth,
    input.viewportHeight,
    input.rightPanelLeft,
    input.containerRect
  );

  const maxHeightPx = Math.max(MIN_SAFE_HEIGHT_PX, safeBounds.bottom - safeBounds.top);
  const effectiveHeight = Math.min(menuHeight, maxHeightPx);

  const clientX = Number.isFinite(input.clientX) ? input.clientX : safeBounds.left;
  const clientY = Number.isFinite(input.clientY) ? input.clientY : safeBounds.top;

  let flippedVertical = false;
  let flippedHorizontal = false;
  let clampedToSafeArea = false;

  let y: number;
  if (clientY + menuHeight > safeBounds.bottom) {
    flippedVertical = true;
    if (clientY - menuHeight >= safeBounds.top) {
      const desiredUpwardY = clientY - menuHeight;
      const maxTopForSafeBottom = Math.max(safeBounds.top, safeBounds.bottom - effectiveHeight);
      if (desiredUpwardY > maxTopForSafeBottom) {
        y = maxTopForSafeBottom;
        clampedToSafeArea = true;
      } else {
        y = desiredUpwardY;
      }
    } else {
      y = Math.max(safeBounds.top, safeBounds.bottom - effectiveHeight);
      clampedToSafeArea = true;
    }
  } else if (clientY < safeBounds.top) {
    y = safeBounds.top;
    clampedToSafeArea = true;
  } else {
    y = clientY;
  }

  if (y < safeBounds.top) {
    y = safeBounds.top;
    clampedToSafeArea = true;
  }

  let x: number;
  if (clientX + menuWidth > safeBounds.right) {
    flippedHorizontal = true;
    const desiredFlippedX = clientX - menuWidth;
    const maxSafeX = safeBounds.right - menuWidth;
    const boundedX = Math.max(safeBounds.left, Math.min(desiredFlippedX, maxSafeX));
    if (boundedX !== desiredFlippedX) {
      clampedToSafeArea = true;
    }
    x = boundedX;
  } else if (clientX < safeBounds.left) {
    x = safeBounds.left;
    clampedToSafeArea = true;
  } else {
    x = clientX;
  }

  return {
    x: Math.max(safeBounds.left, Math.round(x)),
    y: Math.max(safeBounds.top, Math.round(y)),
    flippedVertical,
    flippedHorizontal,
    clampedToSafeArea,
    maxHeightPx,
    safeBounds
  };
}

/**
 * Determina en qué dirección abrir los submenús según el espacio restante respecto al rectángulo del menú.
 */
export function computeSubmenuPlacement(input: SubmenuPlacementInput): SubmenuPlacement {
  const requiredWidth =
    input.requiredSubmenuWidth != null &&
    Number.isFinite(input.requiredSubmenuWidth) &&
    input.requiredSubmenuWidth >= 0
      ? input.requiredSubmenuWidth
      : SUBMENU_RIGHT_THRESHOLD_PX;

  const requiredHeight =
    input.requiredSubmenuHeight != null &&
    Number.isFinite(input.requiredSubmenuHeight) &&
    input.requiredSubmenuHeight >= 0
      ? input.requiredSubmenuHeight
      : SUBMENU_BOTTOM_THRESHOLD_PX;

  const effectiveBottom =
    input.safeBottom != null && Number.isFinite(input.safeBottom)
      ? input.safeBottom
      : input.viewportHeight - SAFE_VIEWPORT_BOTTOM_MARGIN_PX;

  const openLeft = input.viewportWidth - input.menuRect.right < requiredWidth;
  const openUp = effectiveBottom - input.menuRect.bottom < requiredHeight;

  return {
    openLeft,
    openUp
  };
}

/**
 * Busca el panel inspector derecho `[data-right-inspector]` si está abierto y visible,
 * devolviendo su borde izquierdo en píxeles o `null` de forma segura en SSR/jsdom.
 */
export function findOpenRightPanelLeftPx(documentRef?: Document): number | null {
  const doc = documentRef ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    return null;
  }

  const candidates: Element[] = [];
  if (typeof doc.querySelectorAll === 'function') {
    candidates.push(...Array.from(doc.querySelectorAll('[data-right-inspector]')));
  } else if (typeof doc.querySelector === 'function') {
    const single = doc.querySelector('[data-right-inspector]');
    if (single) {
      candidates.push(single);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const getStyle =
    doc.defaultView?.getComputedStyle?.bind(doc.defaultView) ??
    (typeof getComputedStyle === 'function' ? getComputedStyle : null);

  for (const panel of candidates) {
    if (getStyle) {
      try {
        const style = getStyle(panel);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) {
          continue;
        }
      } catch {
        // Ignorar objetos mock que no heredan de Element en tests unitarios
      }
    }

    if (typeof panel.getBoundingClientRect !== 'function') {
      continue;
    }

    const rect = panel.getBoundingClientRect();
    if (
      rect &&
      Number.isFinite(rect.width) &&
      rect.width > MIN_VISIBLE_RIGHT_PANEL_WIDTH_PX &&
      Number.isFinite(rect.left)
    ) {
      return rect.left;
    }
  }

  return null;
}

/**
 * Servicio inyectable para el posicionamiento inteligente del menú contextual 3D y sus submenús.
 */
@Injectable({
  providedIn: 'root'
})
export class ContextMenuPositioningService {
  computeSafeViewportBounds(
    viewportWidth: number,
    viewportHeight: number,
    rightPanelLeft?: number | null,
    containerRect?: ContainerBoundsRect | null
  ): SafeViewportBounds {
    return computeSafeViewportBounds(viewportWidth, viewportHeight, rightPanelLeft, containerRect);
  }

  computeSmartContextMenuPosition(input: SmartContextMenuInput): SmartContextMenuPosition {
    return computeSmartContextMenuPosition(input);
  }

  computeSubmenuPlacement(input: SubmenuPlacementInput): SubmenuPlacement {
    return computeSubmenuPlacement(input);
  }

  findOpenRightPanelLeftPx(documentRef?: Document): number | null {
    return findOpenRightPanelLeftPx(documentRef);
  }
}
