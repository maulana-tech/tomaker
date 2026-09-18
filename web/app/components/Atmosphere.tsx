// SPDX-License-Identifier: Apache-2.0

import { DitherBackground } from "@/components/DitherBackground";

/**
 * What the marketing pages sit on.
 *
 * This used to hold a WebGL instrument and a 2D orrery fallback. Both are gone:
 * the field is the dither now, two colours and nothing between them, so there
 * is no scene to fall back from and nothing to occlude the copy.
 */
export function Atmosphere() {
  return <DitherBackground />;
}
