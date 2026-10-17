import { Card, SampleBadge } from "@/components/ui";
import { CaptureShell } from "./capture-shell";

export default function CapturePage() {
  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s photo</h1>
        <SampleBadge />
      </header>
      <Card>
        <ul className="space-y-2 text-sm leading-6">
          <li>Same spot, same time, facing the same light as day 1.</li>
          <li>Glasses off, hair off the forehead, no makeup.</li>
          <li>Look straight at the camera; your face fills the oval.</li>
        </ul>
      </Card>
      <CaptureShell />
    </>
  );
}
