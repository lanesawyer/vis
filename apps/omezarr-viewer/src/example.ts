import { Vec2 } from "@aibs-vis/geometry";
import { beginLongRunningFrame } from "@aibs-vis/scatterbrain";
export function yay(x: number) {
  return Vec2.add([x, x], [x, x]);
}
