export default function Loading() {
  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">&nbsp;</div>
        <h1 style={{ opacity: 0.35 }}>Loading…</h1>
        <div className="sub">&nbsp;</div>
      </header>
      <div className="body">
        <div className="skel" style={{ height: 56 }} />
        <div className="skel" style={{ height: 64 }} />
        <div className="skel" style={{ height: 64 }} />
        <div className="skel" style={{ height: 64 }} />
      </div>
    </>
  );
}
