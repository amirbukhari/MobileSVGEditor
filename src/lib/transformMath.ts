import type { BBox, ShapeTransform } from '../types';
import { clamp } from './geometry';

export type HandleKind = 'corner' | 'edge-x' | 'edge-y' | 'rotate';

export interface HandleSpec {
  id: string;
  kind: HandleKind;
  // Unscaled offset from the shape's local center (in local units).
  ox: number;
  oy: number;
}

const MIN_SCALE_MAG = 0.05;

export function buildHandles(bbox: BBox, rotateOffset: number): HandleSpec[] {
  const halfW = bbox.width / 2;
  const halfH = bbox.height / 2;
  return [
    { id: 'nw', kind: 'corner', ox: -halfW, oy: -halfH },
    { id: 'ne', kind: 'corner', ox: halfW, oy: -halfH },
    { id: 'se', kind: 'corner', ox: halfW, oy: halfH },
    { id: 'sw', kind: 'corner', ox: -halfW, oy: halfH },
    { id: 'n', kind: 'edge-y', ox: 0, oy: -halfH },
    { id: 's', kind: 'edge-y', ox: 0, oy: halfH },
    { id: 'w', kind: 'edge-x', ox: -halfW, oy: 0 },
    { id: 'e', kind: 'edge-x', ox: halfW, oy: 0 },
    { id: 'rotate', kind: 'rotate', ox: 0, oy: -halfH - rotateOffset },
  ];
}

export interface DragStart {
  center: { x: number; y: number };
  pointerRoot: { x: number; y: number };
  transform: ShapeTransform;
}

function rotateVec(v: { x: number; y: number }, degrees: number): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function applyMove(start: DragStart, pointerRoot: { x: number; y: number }): Partial<ShapeTransform> {
  const dx = pointerRoot.x - start.pointerRoot.x;
  const dy = pointerRoot.y - start.pointerRoot.y;
  return { x: start.transform.x + dx, y: start.transform.y + dy };
}

export function applyRotate(start: DragStart, pointerRoot: { x: number; y: number }): Partial<ShapeTransform> {
  const a0 = Math.atan2(start.pointerRoot.y - start.center.y, start.pointerRoot.x - start.center.x);
  const a1 = Math.atan2(pointerRoot.y - start.center.y, pointerRoot.x - start.center.x);
  const deltaDeg = ((a1 - a0) * 180) / Math.PI;
  return { rotate: start.transform.rotate + deltaDeg };
}

export function applyScale(
  start: DragStart,
  pointerRoot: { x: number; y: number },
  handle: HandleSpec
): Partial<ShapeTransform> {
  const world = { x: pointerRoot.x - start.center.x, y: pointerRoot.y - start.center.y };
  const local = rotateVec(world, -start.transform.rotate);

  if (handle.kind === 'corner') {
    const originalMag = Math.hypot(handle.ox, handle.oy) || 1;
    const currentMag = Math.hypot(local.x, local.y);
    const factor = clamp(currentMag / originalMag, MIN_SCALE_MAG, 100);
    const signX = start.transform.scaleX < 0 ? -1 : 1;
    const signY = start.transform.scaleY < 0 ? -1 : 1;
    return { scaleX: factor * signX, scaleY: factor * signY };
  }
  if (handle.kind === 'edge-x') {
    if (handle.ox === 0) return {};
    const scaleX = local.x / handle.ox;
    return { scaleX: clampMag(scaleX) };
  }
  if (handle.kind === 'edge-y') {
    if (handle.oy === 0) return {};
    const scaleY = local.y / handle.oy;
    return { scaleY: clampMag(scaleY) };
  }
  return {};
}

function clampMag(v: number): number {
  const sign = v < 0 ? -1 : 1;
  return sign * clamp(Math.abs(v), MIN_SCALE_MAG, 100);
}
