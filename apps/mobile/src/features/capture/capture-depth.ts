/** Screens to pop to leave the capture flow: the trailing `capture/*` routes. */
export function captureDepth(routeNames: string[]): number {
  let depth = 0;
  while (routeNames[routeNames.length - 1 - depth]?.startsWith("capture/"))
    depth++;
  return depth;
}
