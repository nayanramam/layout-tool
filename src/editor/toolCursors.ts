import type { EditorTool } from '../types';

export const TOOL_CURSORS: Record<EditorTool, string> = {
  select: 'default',
  rect: 'crosshair',
  wire: 'crosshair',
  via: 'crosshair',
  instance: 'copy',
  delete: 'not-allowed',
  nmos: 'copy',
  pmos: 'copy',
  contact: 'crosshair',
  label: 'text',
};

export function toolCursorClass(tool: EditorTool): string {
  return `tool-cursor-${tool}`;
}

export const CADENCE_SHORTCUTS = [
  { key: 'Space', action: 'Zoom to fit' },
  { key: 'P', action: 'Path (wire) tool' },
  { key: 'O', action: 'Via tool' },
  { key: 'A', action: 'Create instance' },
  { key: 'Del', action: 'Delete tool' },
  { key: 'Esc', action: 'Return to select' },
  { key: 'U', action: 'Undo' },
  { key: 'Shift+U', action: 'Redo' },
];
