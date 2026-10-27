import { RisingSheet } from "@perch/ui/rising-sheet.tsx";
import { useState } from "react";
import { Code, Pressed, Section, Specimen, Usage } from "../usage.tsx";

/** A stand-in band and pane under a sheet, the pane dimmed and inert while it is up, as the bird's page does. */
function Covered({
  shown,
  onDismiss,
  long = false,
}: {
  shown: boolean;
  onDismiss: () => void;
  /** The frame is fixed at 20rem and the card is taller than its row, as on a short window's stage. */
  long?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-y-4 overflow-y-clip rounded-xl border border-edge bg-ground px-5 pt-4 ${long ? "h-80" : "min-h-72 pb-4"}`}
    >
      <div className="col-start-1 row-start-1 text-[13px] text-ink-muted">
        <p className="m-0 font-semibold text-ink">The band</p>
        <p className="m-0">
          Stays lit while the sheet is up; a press here folds it.
        </p>
      </div>
      <div
        inert={shown}
        className={`col-start-1 row-start-2 text-[13px] text-ink-muted motion-safe:transition-opacity motion-safe:duration-420 ${shown ? "opacity-25" : ""}`}
      >
        <p className="m-0 mb-2 font-semibold text-ink">The panes</p>
        <p className="m-0">
          Ledger rows, branches and the commit river sit here. A page decides
          how its own content dims; the sheet only covers it.
        </p>
      </div>
      <RisingSheet shown={shown} onDismiss={onDismiss}>
        <div className="rounded-[10px] bg-paper px-7.5 py-6 text-paper-text shadow-paper">
          <p className="m-0 font-display font-extrabold text-[22px] text-paper-strong">
            Anything on paper
          </p>
          <p className="m-0 mt-2 text-[13px] text-paper-quiet">
            The sheet is transparent; this card is the surface and sets its own
            width.
          </p>
          {long &&
            ["What perch has seen", "What you say", "More particulars"].map(
              (heading) => (
                <p key={heading} className="m-0 mt-6 text-[13px]">
                  <span className="font-semibold text-paper-head">
                    {heading}
                  </span>{" "}
                  stands for a block of the papers, long enough together to
                  overrun its row, so the card stops at the row's foot and
                  scrolls.
                </p>
              ),
            )}
        </div>
      </RisingSheet>
    </div>
  );
}

export function RisingSheetPage() {
  const [shown, setShown] = useState(false);
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <>
      <Section
        title="The rising sheet"
        rule="A transparent layer over every row of its grid, its rows a subgrid of them. The card rises in the last row, centred at its own width, and a press anywhere else on the layer folds it, so what sits above rests too. It owns the slide, the leave and the ways out; the page owns what dims beneath."
        min={620}
      >
        <Specimen
          label="Risen"
          rule="Shown from the start. The pane beneath is dimmed to a quarter and inert, which the page does; the band stays lit. The sheet itself draws nothing but the card and its rising shadow."
        >
          <Covered
            shown={true}
            onDismiss={() => setPressed("onDismiss() from the risen sheet")}
          />
        </Specimen>
        <Specimen
          label="Rising and leaving"
          rule="Press Raise, then fold it any of the three ways. The card rises decelerating over 420ms and falls faster, accelerating over 260ms, inert and hidden from assistive technology, then unmounts at 300ms; the pane comes back at once. Reduced motion skips the slide and keeps the timing."
        >
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShown(true)}
              className="rounded-full border border-edge bg-band px-3 py-1 text-[13px]"
            >
              Raise
            </button>
          </div>
          <Covered
            shown={shown}
            onDismiss={() => {
              setShown(false);
              setPressed("onDismiss()");
            }}
          />
        </Specimen>
        <Specimen
          label="What dismisses it"
          rule="A press anywhere off the card, the band included, or Escape pressed anywhere inside the sheet. A press inside the card does nothing. Escape is contained: the page beneath never hears it, so a second Escape, with the sheet gone, is the page's own. Rising moves focus into the sheet, and dismissing hands it back to the element that held it, which is what lets that second Escape reach the page from where the user was."
        >
          <p className="m-0 text-[13px] text-ink-muted">
            Try it in the risen specimen above: the callback is printed below.
          </p>
        </Specimen>
        <Specimen
          label="A card taller than its row"
          rule="On the bird's page the last row is the stage's fixed ground, often shorter than the papers. The card stops at the row's foot and scrolls its own contents with the panes' thin scrollbar; nothing beneath it moves."
        >
          <Covered
            shown={true}
            long={true}
            onDismiss={() => setPressed("onDismiss() from the tall sheet")}
          />
        </Specimen>
      </Section>
      <Pressed text={pressed} />
      <Usage
        component="<RisingSheet>"
        props={[
          {
            name: "shown",
            type: "boolean",
            what: "The sheet is risen. False slides it away, inert, and unmounts it after 300ms.",
          },
          {
            name: "onDismiss",
            type: "() => void",
            what: "A press anywhere off the card, or Escape inside the sheet, asked to fold it. Nothing is written. Focus returns to the element that held it as the sheet rose.",
          },
          {
            name: "children",
            type: "ReactNode",
            what: "The surface that rises. It sets its own width and is centred.",
          },
        ]}
      >
        <p>
          Place it as a child of a one-column grid whose other children fill its
          rows. It spans every explicit row with <Code>row-span-full</Code> and{" "}
          <Code>grid-rows-subgrid</Code>, and the card rises in the last. In a
          row of open height the row grows to the taller of the card and what it
          covers; in a row of fixed height, as on the bird&apos;s stage, the
          card stops at the row&apos;s foot and scrolls itself. Clip the grid
          vertically, <Code>overflow-y-clip</Code>, so the card rises from its
          foot without making anything beneath scrollable. Neither focus call
          scrolls. A child that handles Escape itself should stop the key first;
          the sheet then defers.
        </p>
      </Usage>
    </>
  );
}
