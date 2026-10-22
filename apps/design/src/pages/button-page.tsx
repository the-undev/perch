import { Button } from "@perch/ui/primitives/button.tsx";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

const variants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;
const sizes = ["xs", "sm", "default", "lg"] as const;

export function ButtonPage() {
  return (
    <>
      <Section
        title="Variants"
        rule="shadcn is used for basics and form controls (settings, dialogs). Its tokens are mapped onto the ink palette, so it sits in perch's world without carrying the dashboard's identity."
        min={220}
      >
        {variants.map((variant) => (
          <Specimen key={variant} label={variant} rule={`variant="${variant}"`}>
            <div className="flex gap-3">
              <Button variant={variant}>Rescan</Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          </Specimen>
        ))}
      </Section>
      <Section
        title="Sizes"
        rule="The outline variant at each text size."
        min={220}
      >
        {sizes.map((size) => (
          <Specimen key={size} label={size} rule={`size="${size}"`}>
            <Button variant="outline" size={size}>
              Show perch
            </Button>
          </Specimen>
        ))}
      </Section>
      <Usage
        component="<Button>"
        props={[
          {
            name: "variant",
            type: "default | outline | secondary | ghost | destructive | link",
            what: "The look.",
          },
          {
            name: "size",
            type: "xs | sm | default | lg | icon | icon-xs | icon-sm | icon-lg",
            what: "The height and padding.",
          },
          {
            name: "asChild",
            type: "boolean",
            what: "Render the child element with the button's look instead of a button.",
          },
        ]}
      >
        <p>
          Import from <Code>@perch/ui/primitives/button.tsx</Code>. Add a shadcn
          primitive with <Code>pnpm dlx shadcn add &lt;name&gt;</Code> from{" "}
          <Code>packages/ui</Code>, then give it a page here and an entry in{" "}
          <Code>apps/design/src/registry.ts</Code>.
        </p>
      </Usage>
    </>
  );
}
