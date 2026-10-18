/** Loading state that mirrors the real layout: bar, large title, verdict panel, list. */
export function PageSkeleton() {
  return (
    <div className="vd-page" aria-busy="true" aria-label="Loading">
      <div style={{ height: 64 }} />
      <div className="vd-header">
        <div className="ui-skeleton vd-skel-title" />
        <div className="ui-skeleton vd-skel-line mt-3" style={{ width: "40%" }} />
      </div>
      <div className="vd-panel vd-panel--pad grid gap-3">
        <div className="ui-skeleton" style={{ height: 40, width: "60%", borderRadius: 10 }} />
        <div className="ui-skeleton vd-skel-line" style={{ width: "85%" }} />
        <div className="ui-skeleton vd-skel-line" style={{ width: "50%" }} />
        <div className="ui-skeleton" style={{ height: 22, marginTop: 10, borderRadius: 6 }} />
      </div>
      <div className="vd-panel mt-7" style={{ height: 220 }}>
        <div className="ui-skeleton" style={{ height: "100%", borderRadius: "inherit", background: "transparent" }} />
      </div>
    </div>
  );
}
