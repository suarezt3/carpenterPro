# Actualización de Marca e Identidad: Piezo3D Studio

Actualizar la identidad de marca, encabezado, metadatos, títulos de la aplicación e interfaz general de "Modulr" a **Piezo3D Studio**, un nombre único, legible y escalable en español e inglés para el software de diseño de muebles 3D y optimización de despiece de melamina.

## User Review & Critical Decisions

> [!IMPORTANT]
> El usuario ha confirmado explícitamente el nuevo nombre de la aplicación: **Piezo3D Studio** (o **Piezo3D**).

- **Nombre Elegido**: **Piezo3D Studio** (Reemplaza a *Modulr* en toda la interfaz, encabezado, metadatos HTML, exportaciones PDF/DXF y documentación).
- **Consistencia e Historial**: Las claves de almacenamiento e identificadores únicos de base de datos se mantendrán compatibles internamente sin romper proyectos creados previamente.

---

## 1. Overview & Core Concept

- **Qué hace**: Plataforma profesional de diseño parametrizado de muebles de melamina 3D, despiece automático, mecanizados CNC, etiquetas y optimización de corte 2D.
- **Cambio de Marca**: Transición completa del nombre de marca a **Piezo3D Studio**, evitando conflictos de marca con la empresa de pagos *Modulr Finance*.

---

## 2. User Experience & Visual Design

- **Logotipo y Marca en Encabezado**:
  * Marca principal en `header.html`: **Piezo`3D`** con el sufijo destacado `3D` en color índigo.
  * Insignia del sistema: **Piezo3D Studio**.
- **Metadatos HTML e Identidad Global**:
  * Título del documento `<title>` en `index.html`: `Piezo3D Studio - Diseñador 3D de Muebles y Despiece de Melamina`.
  * Descripción meta en `index.html` y `metadata.json`: `Plataforma profesional para diseño de muebles 3D, despiece parametrizado y optimizador de corte 2D.`
- **Modales de Documentación y Ayuda**:
  * Actualización de todos los artículos de ayuda, atajos de teclado y referencias a la plataforma bajo el nombre **Piezo3D**.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Nombre de Marca Piezo3D**:
  - *Enfoque*: Piezo3D combina la raíz "Pieza" (elementos de madera/melamina) y "Piezo" (precisión e integración) con la espacialidad 3D.
  - *Ventaja*: Es corto, sonoro, distintivo tanto en español como en inglés y único en el sector de software para carpintería.
- **Decision 2: Compatibilidad de Datos**:
  - *Enfoque*: Actualizar el nombre comercial en UI y exportaciones sin alterar el esquema de almacenamiento de proyectos.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    Piezo3D Studio                       │
├─────────────────────────────────────────────────────────┤
│  [Header Component]       -> Wordmark "Piezo3D Studio"  │
│  [index.html]             -> <title> Piezo3D Studio     │
│  [metadata.json]          -> Applet name: Piezo3D Studio│
│  [Documentation Modal]    -> Articles referring Piezo3D │
│  [Technical Sheet Modal]  -> PDF Reports: Piezo3D       │
└─────────────────────────────────────────────────────────┘
```

- **Archivos a Actualizar**:
  1. `/src/index.html` -> `<title>` y `<meta name="description">`
  2. `/metadata.json` -> `name` y `description`
  3. `/src/app/components/header/header.html` -> Marca en barra superior y diálogos
  4. `/src/app/components/header/header.ts` -> Textos de bienvenida y toques de notificación
  5. `/src/app/components/documentation-modal/documentation-modal.ts` -> Textos del manual de usuario
  6. `/src/app/components/technical-sheet-modal/technical-sheet-modal.ts` -> Encabezados de fichas técnicas en PDF
