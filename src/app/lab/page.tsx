import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { ArchitectureLab } from "@/components/demos/ArchitectureLab";
import { TelemetryDemo } from "@/components/demos/TelemetryDemo";
import { DataIntegrityDemo } from "@/components/demos/DataIntegrityDemo";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Solution Laboratory",
  description: "Interactive solution architectures, an industrial monitoring simulation and a data-integrity pipeline — all using synthetic, reproducible data.",
  path: "/lab",
});

export default function LabPage() {
  return (
    <>
      <PageHero
        title={<>The solution<br /><span className="text-mute">laboratory.</span></>}
        intro="Evidence of how we think, not just what we list. Every demonstration on this page is a deterministic simulation using synthetic data. None of it is connected to a client system or a live plant."
      >
        <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-2 text-sm">
          {[["#architecture", "Architecture laboratory"], ["#telemetry", "Industrial monitoring"], ["#data-integrity", "Data integrity"]].map(([h, l]) => (
            <a key={h} href={h} className="rounded-full border border-line-strong px-4 py-2 text-mute hover:text-ink">{l}</a>
          ))}
        </nav>
      </PageHero>

      <Section id="architecture" labelledBy="arch-title" className="scroll-mt-16">
        <Container>
          <SectionHeading id="arch-title" title="Explore how our solutions work." intro="Three reference architectures. Inspect each stage, follow the data, switch between business and technical explanations, and simulate a failure to see how the system recovers." />
          <div className="mt-12"><ArchitectureLab /></div>
        </Container>
      </Section>

      <Section id="telemetry" labelledBy="tel-title" className="scroll-mt-16 border-t border-line bg-base">
        <Container>
          <SectionHeading id="tel-title" tone="eng" title="From the physical world to digital intelligence." intro="A virtual pump-pressure monitoring system: sensor, edge gateway, MQTT, backend and operator dashboard. Trigger each scenario and watch what an operator would see — including how the system behaves when things go wrong." />
          <div className="mt-12"><TelemetryDemo /></div>
        </Container>
      </Section>

      <Section id="data-integrity" labelledBy="di-title" className="scroll-mt-16 border-t border-line">
        <Container>
          <SectionHeading id="di-title" tone="data" title="From inconsistent data to trusted intelligence." intro="A synthetic FMCG product file with the problems real retailers face. Step it through seven stages and see the logic behind every change. A dashboard is only as good as what is underneath it." />
          <div className="mt-12"><DataIntegrityDemo /></div>
        </Container>
      </Section>
      <CtaBand />
    </>
  );
}
