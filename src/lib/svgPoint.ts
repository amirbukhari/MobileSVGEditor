// Converts a pointer event's client coordinates into the user-space
// coordinate system of a given <svg> element, accounting for viewBox and
// any ancestor CSS transforms (pan/zoom).
export function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}
