// A bubble with its speaker beneath, the tail's tip on the beak's tip, as the phrasebook draws them.

import type { Bird } from "@perch/core/viewmodel.ts";
import { BirdPortrait, birdLook, portraitFrame } from "@perch/ui/bird.tsx";
import { Bubble, tailDrop } from "@perch/ui/bubble.tsx";
import { SnoozeKey } from "@perch/ui/snooze-key.tsx";
import { reportedSnooze } from "./specimens.ts";

export interface SpeakingBirdProps {
  bird: Bird;
  /** The render's clock: the bird's look follows the hour. */
  now: Date;
  /** Called with what was pressed, so the page can show the bubble's callbacks working. */
  onPress: (what: string) => void;
}

/** One bird saying its piece: the bubble, and the bird whose beak the tail ends at. */
export function SpeakingBird({ bird, now, onPress }: SpeakingBirdProps) {
  const frame = portraitFrame(bird, "right");
  const look = birdLook(bird, now);
  return (
    <div>
      <Bubble
        bubble={bird.bubble}
        look={look}
        actions={bird.detail.actions}
        onLaunch={(action) => onPress(`${bird.name}: ${action.verb}`)}
        snoozeKey={
          <SnoozeKey
            bird={bird}
            look={look}
            now={now}
            place="bubble"
            calls={reportedSnooze(onPress)}
          />
        }
        onFullStory={() => onPress(`${bird.name}: Tell me the full story`)}
        onAdopt={bird.adopted ? null : () => onPress(`${bird.name}: Adopt`)}
        onChip={(chip) => onPress(`${bird.name}: ${chip}`)}
        tail={{ side: "left", inset: frame.beakX }}
      />
      <div style={{ marginTop: tailDrop - frame.beakY }}>
        <BirdPortrait bird={bird} facing="right" now={now} />
      </div>
    </div>
  );
}
