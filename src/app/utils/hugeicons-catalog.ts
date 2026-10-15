/**
 * Catálogo vectorial ligero compatible con <hugeicons-icon> (@hugeicons/angular).
 * Evita que esbuild y TypeScript carguen el barrel file de 80 MB (+6,000 iconos)
 * de @hugeicons/core-free-icons durante el deploy de producción en Vercel.
 */
export type HugeIconTuple = [string, Record<string, string | number>];
export type HugeIconDefinition = HugeIconTuple[];

const defIcon = (paths: string[]): HugeIconDefinition =>
  paths.map((d, idx) => ['path', { d, key: `hi_${idx}` }]);

export const Add01Icon = defIcon(['M12 4V20', 'M4 12H20']);

export const Alert02Icon = defIcon([
  'M12 9V13',
  'M12 16.5V17',
  'M10.29 3.86L1.82 18A2 2 0 0 0 3.54 21H20.46A2 2 0 0 0 22.18 18L13.71 3.86A2 2 0 0 0 10.29 3.86Z'
]);

export const Archive01Icon = defIcon([
  'M3 4H21V8H3V4Z',
  'M5 8V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V8',
  'M10 12H14'
]);

export const ArrowDown01Icon = defIcon(['M6 9L12 15L18 9']);

export const ArrowLeft01Icon = defIcon(['M15 6L9 12L15 18']);

export const ArrowRight01Icon = defIcon(['M9 6L15 12L9 18']);

export const ArrowUp01Icon = defIcon(['M6 15L12 9L18 15']);

export const BookOpen01Icon = defIcon([
  'M2 6C2 6 5.5 4 12 6C18.5 4 22 6 22 6V19C22 19 18.5 17.5 12 19C5.5 17.5 2 19 2 19V6Z',
  'M12 6V19'
]);

export const Cancel01Icon = defIcon(['M18 6L6 18', 'M6 6L18 18']);

export const CheckListIcon = defIcon([
  'M11 6H20',
  'M11 12H20',
  'M11 18H20',
  'M3.5 6L5 7.5L8 4.5',
  'M3.5 12L5 13.5L8 10.5',
  'M3.5 18L5 19.5L8 16.5'
]);

export const CheckmarkCircle02Icon = defIcon([
  'M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z',
  'M8.5 12.5L10.8 14.8L15.5 9.5'
]);

export const Clock01Icon = defIcon([
  'M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z',
  'M12 7V12L15 14'
]);

export const CloudIcon = defIcon([
  'M6.5 19H17.5A4.5 4.5 0 0 0 18.2 10.1A6 6 0 0 0 6.3 9.2A4.5 4.5 0 0 0 6.5 19Z'
]);

export const Compass01Icon = defIcon([
  'M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z',
  'M16.2 7.8L14.1 14.1L7.8 16.2L9.9 9.9L16.2 7.8Z'
]);

export const Delete02Icon = defIcon([
  'M4 7H20',
  'M9 7V4H15V7',
  'M6 7L7 20A2 2 0 0 0 9 21H15A2 2 0 0 0 17 20L18 7',
  'M10 11V17',
  'M14 11V17'
]);

export const Download01Icon = defIcon([
  'M12 4V15',
  'M8 11L12 15L16 11',
  'M4 17V19A1 1 0 0 0 5 20H19A1 1 0 0 0 20 19V17'
]);

export const Edit02Icon = defIcon([
  'M15.5 4.5L19.5 8.5L8 20H4V16L15.5 4.5Z',
  'M13.5 6.5L17.5 10.5'
]);

export const FileSearchIcon = defIcon([
  'M14 3H6A2 2 0 0 0 4 5V19A2 2 0 0 0 6 21H12',
  'M14 3L19 8V11',
  'M18 18A3 3 0 1 1 12 18A3 3 0 0 1 18 18Z',
  'M20.5 20.5L17.5 17.5'
]);

export const HelpCircleIcon = defIcon([
  'M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z',
  'M9.5 9.5A2.5 2.5 0 0 1 14.5 9.5C14.5 11.2 12 11.8 12 13.5',
  'M12 17V17.5'
]);

export const InformationCircleIcon = defIcon([
  'M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z',
  'M12 11V16',
  'M12 8V8.5'
]);

export const Keyboard01Icon = defIcon([
  'M3 6H21V18H3V6Z',
  'M7 10H8',
  'M11 10H13',
  'M16 10H17',
  'M7 14H17'
]);

export const Layers01Icon = defIcon([
  'M12 3L2 8L12 13L22 8L12 3Z',
  'M2 12.5L12 17.5L22 12.5',
  'M2 17L12 22L22 17'
]);

export const LightBulb01Icon = defIcon([
  'M9 18H15',
  'M10 21H14',
  'M8.5 14.5C6.8 13.3 6 11.4 6 9.5A6 6 0 0 1 18 9.5C18 11.4 17.2 13.3 15.5 14.5L15 16H9L8.5 14.5Z'
]);

export const LockIcon = defIcon([
  'M5 11H19V20H5V11Z',
  'M8 11V7A4 4 0 0 1 16 7V11',
  'M12 15V16.5'
]);

export const Moon02Icon = defIcon([
  'M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5A8.5 8.5 0 1 0 20.5 14.5Z'
]);

export const Note01Icon = defIcon([
  'M6 3H15L20 8V20A1 1 0 0 1 19 21H6A1 1 0 0 1 5 20V4A1 1 0 0 1 6 3Z',
  'M14 3V8H20',
  'M8 12H16',
  'M8 16H13'
]);

export const PaintBoardIcon = defIcon([
  'M12 3A9 9 0 0 0 3 12C3 16.97 7.03 21 12 21A2.5 2.5 0 0 0 14.5 18.5C14.5 17.9 14.25 17.35 13.9 16.95C13.55 16.55 13.3 16 13.3 15.4A2.5 2.5 0 0 1 15.8 12.9H17A4 4 0 0 0 21 8.9C21 5.64 16.97 3 12 3Z',
  'M7.5 10.5A1 1 0 1 1 5.5 10.5A1 1 0 0 1 7.5 10.5Z',
  'M10.5 7.5A1 1 0 1 1 8.5 7.5A1 1 0 0 1 10.5 7.5Z',
  'M15.5 7.5A1 1 0 1 1 13.5 7.5A1 1 0 0 1 15.5 7.5Z'
]);

export const PrinterIcon = defIcon([
  'M6 8V4H18V8',
  'M6 17H4A2 2 0 0 1 2 15V10A2 2 0 0 1 4 8H20A2 2 0 0 1 22 10V15A2 2 0 0 1 20 17H18',
  'M6 13H18V20H6V13Z'
]);

export const QrCodeIcon = defIcon([
  'M4 4H10V10H4V4Z',
  'M14 4H20V10H14V4Z',
  'M4 14H10V20H4V14Z',
  'M14 14H17V17H14V14Z',
  'M17 17H20V20H17V17Z',
  'M17 14H20',
  'M14 17V20'
]);

export const RulerIcon = defIcon([
  'M3 8H21V16H3V8Z',
  'M7 8V12',
  'M11 8V11',
  'M15 8V12',
  'M19 8V11'
]);

export const Search01Icon = defIcon([
  'M19 11A8 8 0 1 1 3 11A8 8 0 0 1 19 11Z',
  'M21 21L16.65 16.65'
]);

export const Settings01Icon = defIcon([
  'M15 12A3 3 0 1 1 9 12A3 3 0 0 1 15 12Z',
  'M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 0 1 16.96 19.71L16.9 19.65A1.65 1.65 0 0 0 15.08 19.32A1.65 1.65 0 0 0 14 20.85V21A2 2 0 0 1 10 21V20.91A1.65 1.65 0 0 0 8.92 19.38A1.65 1.65 0 0 0 7.1 19.71L7.04 19.77A2 2 0 0 1 4.21 16.94L4.27 16.88A1.65 1.65 0 0 0 4.6 15.06A1.65 1.65 0 0 0 3.07 14H3A2 2 0 0 1 3 10H3.09A1.65 1.65 0 0 0 4.62 8.92A1.65 1.65 0 0 0 4.29 7.1L4.23 7.04A2 2 0 0 1 7.06 4.21L7.12 4.27A1.65 1.65 0 0 0 8.94 4.6H9A1.65 1.65 0 0 0 10 3.09V3A2 2 0 0 1 14 3V3.09A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21A2 2 0 0 1 19.71 7.04L19.65 7.1A1.65 1.65 0 0 0 19.32 8.92V9A1.65 1.65 0 0 0 20.85 10H21A2 2 0 0 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z'
]);

export const ShieldCheckIcon = defIcon([
  'M12 3L20 6V11.5C20 16.5 16.5 20 12 21.5C7.5 20 4 16.5 4 11.5V6L12 3Z',
  'M9 12L11 14L15.5 9.5'
]);

export const Sun01Icon = defIcon([
  'M16 12A4 4 0 1 1 8 12A4 4 0 0 1 16 12Z',
  'M12 3V5',
  'M12 19V21',
  'M4.22 4.22L5.64 5.64',
  'M18.36 18.36L19.78 19.78',
  'M3 12H5',
  'M19 12H21',
  'M4.22 19.78L5.64 18.36',
  'M18.36 5.64L19.78 4.22'
]);

export const Tag01Icon = defIcon([
  'M3 12V4A1 1 0 0 1 4 3H12L21 12L12 21L3 12Z',
  'M8.5 8.5A1 1 0 1 1 6.5 8.5A1 1 0 0 1 8.5 8.5Z'
]);

export const Tick02Icon = defIcon(['M5 13L9 17L19 7']);

export const ViewIcon = defIcon([
  'M2 12C3.8 7.5 7.5 5 12 5C16.5 5 20.2 7.5 22 12C20.2 16.5 16.5 19 12 19C7.5 19 3.8 16.5 2 12Z',
  'M15 12A3 3 0 1 1 9 12A3 3 0 0 1 15 12Z'
]);

export const ViewInArIcon = defIcon([
  'M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z',
  'M12 12L20 7.5',
  'M12 12L4 7.5',
  'M12 12V21'
]);