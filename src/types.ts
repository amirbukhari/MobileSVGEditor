export type ShapeType =
  | 'path'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'polyline';

export interface ShapeStyle {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  opacity: number;
}

export interface ShapeTransform {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BaseShape {
  id: string;
  type: ShapeType;
  name: string;
  visible: boolean;
  locked: boolean;
  style: ShapeStyle;
  transform: ShapeTransform;
}

export interface PathShape extends BaseShape {
  type: 'path';
  d: string;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LineShape extends BaseShape {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PolyShape extends BaseShape {
  type: 'polygon' | 'polyline';
  points: [number, number][];
}

export type Shape =
  | PathShape
  | RectShape
  | CircleShape
  | EllipseShape
  | LineShape
  | PolyShape;

export interface SvgDoc {
  width: number;
  height: number;
  viewBox: [number, number, number, number];
}

export type EditorStep = 'shape' | 'color' | 'export';

export function defaultStyle(): ShapeStyle {
  return {
    fill: '#333333',
    fillOpacity: 1,
    stroke: 'none',
    strokeWidth: 1,
    strokeOpacity: 1,
    opacity: 1,
  };
}

export function defaultTransform(): ShapeTransform {
  return { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
}
