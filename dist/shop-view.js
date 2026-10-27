// Keep the barista view, action close-ups and pointer picking in one projection.
// The scene owns its camera; this helper contains no renderer or recipe state.
const HOME_ZOOM = 1.14;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const dimension = (value, fallback) => clamp(Number.isFinite(value) && value > 0 ? value : fallback, 1, 16384);

export function getShopView(pose = {}, width = 1280, height = 720) {
  const w = dimension(width, 1280), h = dimension(height, 720), aspect = w / h;
  const x = finite(pose?.x), y = finite(pose?.y), z = finite(pose?.z);
  const zoom = clamp(finite(pose?.zoom, HOME_ZOOM), .75, 3.35);
  // Manual overview zoom leaves the room framing intact. The existing action
  // spring raises its target; smoothly remove the room offset as it does so.
  const approach = clamp(y / .28, 0, 1), focus = approach * approach * (3 - 2 * approach);
  const lowScreen = w > 700 ? clamp((720 - h) / 180, 0, 1) : 0;
  const target = { x, y: y - .56 * lowScreen * (1 - focus), z: z - (1 - focus) };
  const halfWidth = w <= 700 ? 3.1 + focus * 1.4 : 6.6, halfHeight = halfWidth / aspect;
  return {
    position: { x: target.x, y: target.y + 7.8, z: target.z + 11.5 },
    target,
    frustum: { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight, near: .1, far: 90 },
    zoom,
  };
}
