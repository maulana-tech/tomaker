// SPDX-License-Identifier: Apache-2.0

// A chapter's scrim: what holds its copy off the world.
//
// The instrument is behind every section, and a ring sweeping under a
// paragraph makes the paragraph unreadable. The fix is local — hold the side
// the copy is on and leave the rest of the frame open, which is also why the
// camera ledger targets a point left of the instrument's centre: the machine
// reads on the right, the words on the left, and neither is fighting the other.
//
// On paper these have to be far more opaque than they were on a black stage.
// There, copy was near-white and the rings were dark, so a half-strength scrim
// still left a wide contrast gap. Here copy is dark and the rings are mid-grey,
// so anything short of solid paper under the text puts a grey ring at roughly
// the text's own value straight through the words. The copy zone is therefore
// opaque, and the falloff is pushed out to where the copy has ended.
//
// Sits at -z-10, so it is above the world and below the section's own content.

type Side = "left" | "bottom" | "full";

const GRADIENTS: Record<Side, string> = {
  // Desktop copy sits in the left half; the gradient is angled so the falloff
  // follows the diagonal the rings tend to travel on.
  left: "linear-gradient(100deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 44%, rgba(255,255,255,0.88) 60%, rgba(255,255,255,0.45) 78%, rgba(255,255,255,0) 94%)",
  // For bands whose copy runs the full width, so the frame has to be held from
  // the floor instead of from one side.
  bottom:
    "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.85) 70%, rgba(255,255,255,0.35) 87%, rgba(255,255,255,0) 100%)",
  full: "linear-gradient(180deg, rgba(255,255,255,0.93) 0%, rgba(255,255,255,0.97) 50%, rgba(255,255,255,0.93) 100%)",
};

export function Scrim({ side = "left", className = "" }: { side?: Side; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 ${className}`}
      style={{ backgroundImage: GRADIENTS[side] }}
    />
  );
}
