import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, Bar, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell, LabelList, Treemap,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// MODEL — Scotland gas distribution network (SGN), baseline ≈ 45 TWh/yr
// Lever potentials anchored to "Estimated potential to meet today's energy
// requirements" ranges. Sliders set % of max potential deployed at each horizon.
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE = 45; // TWh, today's throughput on the Scotland distribution network
const START = 2025, END = 2050;

const LEVERS = [
  { id: "hp",  name: "Heat pumps",        group: "demand", max: 27, range: "30–60% · 13–27 TWh" },
  { id: "hn",  name: "Heat networks",     group: "demand", max: 13, range: "20–30% · 9–13 TWh" },
  { id: "ee",  name: "Energy efficiency", group: "demand", max: 9,  range: "10–20% · 5–9 TWh" },
  { id: "bio", name: "Biomethane",        group: "supply", max: 18, range: "20–40% · 9–18 TWh" },
  { id: "bl",  name: "Hydrogen blending", group: "supply", max: 9,  range: "10–20% · 5–9 TWh" },
  { id: "h2",  name: "Hydrogen for I&C",  group: "supply", max: 9,  range: "10–20% · 5–9 TWh" },
];

const YEARS = [2025, 2030, 2040, 2050];

const SCENARIOS = {
  "Holistic Transition": {
    desc: "Net zero 2050. Electrified heat leads; biomethane maximised; hydrogen targeted at industrial clusters. NESO's central planning pathway.",
    hp:  { 2025: 0.02, 2030: 0.15, 2040: 0.55, 2050: 0.85 },
    hn:  { 2025: 0.02, 2030: 0.10, 2040: 0.40, 2050: 0.70 },
    ee:  { 2025: 0.05, 2030: 0.22, 2040: 0.50, 2050: 0.70 },
    bio: { 2025: 0.08, 2030: 0.35, 2040: 0.75, 2050: 1.00 },
    bl:  { 2025: 0.00, 2030: 0.20, 2040: 0.45, 2050: 0.25 },
    h2:  { 2025: 0.00, 2030: 0.05, 2040: 0.45, 2050: 0.80 },
  },
  "Electric Engagement": {
    desc: "Net zero 2050 via maximum consumer electrification. Heat pumps dominate; minimal role for hydrogen in heat; network throughput falls furthest.",
    hp:  { 2025: 0.02, 2030: 0.20, 2040: 0.65, 2050: 1.00 },
    hn:  { 2025: 0.02, 2030: 0.12, 2040: 0.50, 2050: 0.80 },
    ee:  { 2025: 0.05, 2030: 0.25, 2040: 0.60, 2050: 0.80 },
    bio: { 2025: 0.08, 2030: 0.30, 2040: 0.55, 2050: 0.65 },
    bl:  { 2025: 0.00, 2030: 0.10, 2040: 0.15, 2050: 0.05 },
    h2:  { 2025: 0.00, 2030: 0.02, 2040: 0.20, 2050: 0.35 },
  },
  "Hydrogen Evolution": {
    desc: "Net zero 2050 with hydrogen at scale. Blending ramps through the 2030s; dedicated hydrogen for industry; slower heat-pump uptake preserves network role.",
    hp:  { 2025: 0.02, 2030: 0.10, 2040: 0.30, 2050: 0.50 },
    hn:  { 2025: 0.02, 2030: 0.08, 2040: 0.25, 2050: 0.40 },
    ee:  { 2025: 0.05, 2030: 0.20, 2040: 0.40, 2050: 0.60 },
    bio: { 2025: 0.08, 2030: 0.35, 2040: 0.70, 2050: 0.85 },
    bl:  { 2025: 0.00, 2030: 0.45, 2040: 1.00, 2050: 0.70 },
    h2:  { 2025: 0.00, 2030: 0.10, 2040: 0.70, 2050: 1.00 },
  },
  "Falling Behind": {
    desc: "Net zero missed. Some progress on pipeline projects and efficiency, but deployment stalls — natural gas remains the dominant molecule in 2050.",
    hp:  { 2025: 0.02, 2030: 0.06, 2040: 0.15, 2050: 0.30 },
    hn:  { 2025: 0.02, 2030: 0.04, 2040: 0.08, 2050: 0.15 },
    ee:  { 2025: 0.05, 2030: 0.12, 2040: 0.20, 2050: 0.30 },
    bio: { 2025: 0.08, 2030: 0.18, 2040: 0.30, 2050: 0.40 },
    bl:  { 2025: 0.00, 2030: 0.05, 2040: 0.15, 2050: 0.20 },
    h2:  { 2025: 0.00, 2030: 0.02, 2040: 0.05, 2050: 0.10 },
  },
};

const C = {
  navy: "#0d2b52", ink: "#1a2433", slate: "#5b6b7f", hair: "#dde3ea",
  bg: "#f5f7f9", card: "#ffffff",
  natgas: "#94a7bd", bio: "#1e9e54", blend: "#79c9a7", h2: "#0a7d52",
  hp: "#2f80c4", hn: "#7db8e3", ee: "#c4def2",
  accent: "#0a66b3", warn: "#c0392b",
};

const fmt = (v, d = 1) => Number(v).toFixed(d).replace(/\.0$/, "");

// Heat pump conversion: average Scottish gas-heated home ≈ 13,500 kWh/yr of gas.
// 1 TWh displaced ≈ 74,000 home conversions. Max potential 27 TWh ≈ 2.0m homes,
// consistent with ~1.9–2.0m Scottish properties on the gas grid.
const KWH_PER_GAS_HOME = 13500;
const hpHomes = (twh) => (twh * 1e9) / KWH_PER_GAS_HOME;
const fmtCount = (n) => n >= 1e6 ? `${fmt(n / 1e6, 2)}m` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`;

function computeYear(dep) {
  let hp = dep.hp * 27, hn = dep.hn * 13, ee = dep.ee * 9;
  const totalRed = hp + hn + ee;
  if (totalRed > BASELINE) { const k = BASELINE / totalRed; hp *= k; hn *= k; ee *= k; }
  const residual = Math.max(BASELINE - hp - hn - ee, 0);
  // Priority allocation within residual throughput — not pro-rata.
  // 1) H₂ for I&C: enduring industrial conversions, served first and never diluted.
  // 2) Biomethane: contracted physical injection, next in line.
  // 3) H₂ blending: transitional and fungible — takes whatever headroom is left.
  const h2 = Math.min(dep.h2 * 9, residual);
  const bio = Math.min(dep.bio * 18, Math.max(residual - h2, 0));
  const bl = Math.min(dep.bl * 9, Math.max(residual - h2 - bio, 0));
  const natgas = Math.max(residual - bio - bl - h2, 0);
  return { hp, hn, ee, residual, bio, bl, h2, natgas, greenShare: residual > 0 ? (bio + bl + h2) / residual : 0 };
}

function interp(vals, year) {
  if (year <= YEARS[0]) return vals[YEARS[0]];
  if (year >= YEARS[YEARS.length - 1]) return vals[YEARS[YEARS.length - 1]];
  for (let i = 0; i < YEARS.length - 1; i++) {
    const [a, b] = [YEARS[i], YEARS[i + 1]];
    if (year >= a && year <= b) {
      const t = (year - a) / (b - a);
      return vals[a] + t * (vals[b] - vals[a]);
    }
  }
  return vals[YEARS[0]];
}

// Interpolated deployment vector at any (fractional) year
function depAt(dep, year) {
  const d = {};
  LEVERS.forEach(l => {
    const anchors = {};
    YEARS.forEach(y => { anchors[y] = dep[y][l.id]; });
    d[l.id] = interp(anchors, year);
  });
  return d;
}

// ── UI atoms ─────────────────────────────────────────────────────────────────

const Slider = ({ lever, value, onChange, color }) => {
  const twh = value * lever.max;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{lever.name}</span>
        <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: C.slate }}>
          <b style={{ color: C.ink }}>{Math.round(value * 100)}%</b> · {fmt(twh)} TWh
        </span>
      </div>
      <input
        type="range" min={0} max={100} value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: "100%", accentColor: color, height: 4, cursor: "pointer", color }}
      />
      <div style={{ fontSize: 10.5, color: "#93a1b1", marginTop: 1 }}>
        Potential: {lever.range}
        {lever.id === "hp" && <span> · ≈ <b style={{ color: "#5b6b7f" }}>{fmtCount(hpHomes(twh))}</b> homes off gas</span>}
      </div>
    </div>
  );
};

const Kpi = ({ label, value, unit, sub, color }) => (
  <div style={{ flex: 1, minWidth: 130, background: C.card, border: `1px solid ${C.hair}`, borderTop: `3px solid ${color || C.navy}`, padding: "10px 14px" }}>
    <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: C.slate, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>
      {value}<span style={{ fontSize: 13, fontWeight: 500, color: C.slate, marginLeft: 3 }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: 11, color: C.slate, marginTop: 1 }}>{sub}</div>}
  </div>
);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.hair}`, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(13,43,82,0.12)" }}>
      <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>{label}</div>
      {payload.filter(p => p.value > 0.05).map((p) => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: C.ink }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, background: p.fill || p.color, marginRight: 6 }} />{p.name}</span>
          <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(p.value)} TWh</b>
        </div>
      ))}
    </div>
  );
};

// ── App ──────────────────────────────────────────────────────────────────────

export default function ScotlandGasDemandExplorer() {
  const [scenario, setScenario] = useState("Holistic Transition");
  const [anchorYear, setAnchorYear] = useState(2030);   // year being edited by sliders
  const [playYear, setPlayYear] = useState(2025);       // animated playhead (fractional)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);                 // 1x ≈ 10s for 25 years
  const [view, setView] = useState("trajectory");
  const rafRef = useRef(null);
  const lastTs = useRef(null);

  const [dep, setDep] = useState(() => {
    const s = SCENARIOS["Holistic Transition"];
    const out = {};
    YEARS.forEach(y => { out[y] = {}; LEVERS.forEach(l => { out[y][l.id] = s[l.id][y]; }); });
    return out;
  });

  // ── Playback engine ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) { lastTs.current = null; return; }
    const YEARS_PER_SEC = 2.5 * speed; // 1x: 25 years in 10s
    const tick = (ts) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setPlayYear(prev => {
        const next = prev + dt * YEARS_PER_SEC;
        if (next >= END) { setPlaying(false); return END; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTs.current = null; };
  }, [playing, speed]);

  const togglePlay = () => {
    if (!playing && playYear >= END) setPlayYear(START); // replay from start
    setPlaying(p => !p);
  };

  const applyScenario = (name) => {
    const s = SCENARIOS[name];
    const out = {};
    YEARS.forEach(y => { out[y] = {}; LEVERS.forEach(l => { out[y][l.id] = s[l.id][y]; }); });
    setDep(out);
    setScenario(name);
    setPlaying(false);
    setPlayYear(START);
  };

  const setLever = (id, v) => {
    setDep(prev => ({ ...prev, [anchorYear]: { ...prev[anchorYear], [id]: v } }));
    setScenario("Custom");
  };

  const selectAnchor = (y) => { setAnchorYear(y); setPlaying(false); setPlayYear(y); };

  // ── Derived data ───────────────────────────────────────────────────────────
  const series = useMemo(() => {
    const rows = [];
    for (let y = START; y <= END; y++) {
      const r = computeYear(depAt(dep, y));
      rows.push({ year: y, "Natural gas": r.natgas, "Biomethane": r.bio, "H₂ blend": r.bl, "H₂ for I&C": r.h2, "Heat pumps": r.hp, "Heat networks": r.hn, "Energy efficiency": r.ee });
    }
    return rows;
  }, [dep]);

  const displayYear = Math.round(playYear);
  const now = useMemo(() => computeYear(depAt(dep, playYear)), [dep, playYear]);
  const yr2050 = useMemo(() => computeYear(dep[2050]), [dep]);

  // Heat pump installations: cumulative stock + implied annual run-rate (central difference)
  const hpStats = useMemo(() => {
    const stock = hpHomes(now.hp);
    const a = Math.max(playYear - 0.5, START), b = Math.min(playYear + 0.5, END);
    const hpA = computeYear(depAt(dep, a)).hp, hpB = computeYear(depAt(dep, b)).hp;
    const runRate = b > a ? hpHomes(hpB - hpA) / (b - a) : 0;
    const peak = (() => {
      let max = 0;
      for (let y = START; y < END; y++) {
        const r = hpHomes(computeYear(depAt(dep, y + 1)).hp - computeYear(depAt(dep, y)).hp);
        if (r > max) max = r;
      }
      return max;
    })();
    return { stock, runRate: Math.max(runRate, 0), peak };
  }, [dep, playYear, now]);

  // Treemap: the constant 45 TWh canvas, split between demand that has left the
  // network (translucent) and molecules still flowing through it (solid)
  const TREE_META = {
    "Heat pumps":        { color: C.hp,     solid: false },
    "Heat networks":     { color: C.hn,     solid: false },
    "Energy efficiency": { color: C.ee,     solid: false },
    "Natural gas":       { color: C.natgas, solid: true },
    "Biomethane":        { color: C.bio,    solid: true },
    "H₂ blend":          { color: C.blend,  solid: true },
    "H₂ for I&C":        { color: C.h2,     solid: true },
  };
  const treemapData = useMemo(() => {
    const r = now;
    const leaves = (arr) => arr.filter(d => d.size > 0.08);
    return [
      { name: "Demand left the network", children: leaves([
        { name: "Heat pumps", size: r.hp },
        { name: "Heat networks", size: r.hn },
        { name: "Energy efficiency", size: r.ee },
      ])},
      { name: "Network throughput", children: leaves([
        { name: "Natural gas", size: r.natgas },
        { name: "Biomethane", size: r.bio },
        { name: "H₂ blend", size: r.bl },
        { name: "H₂ for I&C", size: r.h2 },
      ])},
    ].filter(g => g.children.length > 0);
  }, [now]);

  const TreeCell = (props) => {
    const { x, y, width, height, depth, name } = props;
    if (depth !== 2) return null; // leaves only; grouping is carried by the solid/translucent grammar
    const meta = TREE_META[name];
    if (!meta || width <= 0 || height <= 0) return null;
    return (
      <rect
        x={x} y={y} width={width} height={height}
        fill={meta.color}
        fillOpacity={meta.solid ? 0.95 : 0.38}
        stroke={meta.solid ? "#ffffff" : meta.color}
        strokeWidth={meta.solid ? 2 : 1.5}
        strokeDasharray={meta.solid ? "0" : "4 3"}
      />
    );
  };

  const TreeTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    return (
      <div style={{ background: "#fff", border: `1px solid ${C.hair}`, padding: "6px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(13,43,82,0.12)" }}>
        <b style={{ color: C.navy }}>{p.payload?.name}</b> · {fmt(p.value)} TWh ({fmt((p.value / BASELINE) * 100, 0)}% of today's 45)
      </div>
    );
  };

  // Build-up view: each technology rises from the axis as it's installed,
  // against a ghost band showing its remaining potential (echoes the static exhibit)
  const buildup = useMemo(() => {
    const r = now;
    return [
      { name: "Heat pumps", deployed: r.hp, headroom: Math.max(27 - r.hp, 0), fill: C.hp, pct: r.hp / 27 },
      { name: "Heat networks", deployed: r.hn, headroom: Math.max(13 - r.hn, 0), fill: C.hn, pct: r.hn / 13 },
      { name: "Energy efficiency", deployed: r.ee, headroom: Math.max(9 - r.ee, 0), fill: C.ee, pct: r.ee / 9 },
      { name: "Biomethane", deployed: r.bio, headroom: Math.max(18 - r.bio, 0), fill: C.bio, pct: r.bio / 18 },
      { name: "H₂ blending", deployed: r.bl, headroom: Math.max(9 - r.bl, 0), fill: C.blend, pct: r.bl / 9 },
      { name: "H₂ for I&C", deployed: r.h2, headroom: Math.max(9 - r.h2, 0), fill: C.h2, pct: r.h2 / 9 },
      { name: "Natural gas left", deployed: r.natgas, headroom: 0, fill: C.natgas, pct: null },
    ];
  }, [now]);

  const fesNote = scenario === "Custom"
    ? "Custom lever positions — diverged from FES presets"
    : SCENARIOS[scenario].desc;

  const groupColor = { demand: C.accent, supply: C.bio };
  const timelinePct = ((playYear - START) / (END - START)) * 100;

  return (
    <div style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", background: C.bg, minHeight: "100vh", padding: "20px 22px", color: C.ink }}>
      <style>{`
        input[type=range].lever{ -webkit-appearance:none; appearance:none; background:${C.hair}; border-radius:2px; }
        input[type=range].lever::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:50%; background:currentColor; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,.3); cursor:pointer; }
        button{ cursor:pointer; font-family:inherit; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `3px solid ${C.navy}`, paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.slate, fontWeight: 700 }}>
          Scotland gas distribution network · Scenario explorer
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 700, color: C.navy, letterSpacing: "-0.01em" }}>
          How Scotland's gas demand evolves as technologies deploy, 2025–2050
        </h1>
        <div style={{ fontSize: 12.5, color: C.slate }}>
          Baseline 45 TWh/yr network throughput · Lever potentials per estimated technical maxima · Presets aligned to NESO FES 2025 pathways
        </div>
      </div>

      {/* Scenario pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
        {Object.keys(SCENARIOS).map(name => (
          <button key={name} onClick={() => applyScenario(name)} style={{
            padding: "6px 14px", fontSize: 12.5, fontWeight: 600, border: `1px solid ${scenario === name ? C.navy : C.hair}`,
            background: scenario === name ? C.navy : "#fff", color: scenario === name ? "#fff" : C.ink, borderRadius: 2,
          }}>{name}</button>
        ))}
        {scenario === "Custom" && (
          <span style={{ padding: "6px 14px", fontSize: 12.5, fontWeight: 600, background: "#fdf3e7", border: "1px solid #e8c9a0", color: "#9a6a1e", borderRadius: 2 }}>Custom</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.slate, fontStyle: "italic", marginBottom: 14, maxWidth: 860 }}>{fesNote}</div>

      {/* ── TIMELINE / PLAYBACK BAR ─────────────────────────────────────────── */}
      <div style={{ background: C.navy, padding: "12px 18px", display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} style={{
          width: 44, height: 44, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.85)",
          background: playing ? "rgba(255,255,255,0.14)" : "#fff", color: playing ? "#fff" : C.navy,
          fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {playing ? "❚❚" : "▶"}
        </button>

        <div style={{ flexShrink: 0, width: 86 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1, animation: playing ? "pulse 1.6s ease-in-out infinite" : "none" }}>
            {displayYear}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            {playing ? "Playing" : playYear >= END ? "End state" : "Paused"}
          </div>
        </div>

        {/* Scrubber */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ position: "relative", height: 28 }}>
            <input
              type="range" min={START} max={END} step={0.1} value={playYear}
              onChange={(e) => { setPlaying(false); setPlayYear(Number(e.target.value)); }}
              style={{ width: "100%", position: "absolute", top: 8, accentColor: "#fff", cursor: "pointer", height: 5 }}
            />
            {/* progress fill */}
            <div style={{ position: "absolute", top: 13, left: 0, height: 5, width: `${timelinePct}%`, background: "rgba(255,255,255,0.55)", pointerEvents: "none", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
            {[2025, 2030, 2035, 2040, 2045, 2050].map(y => (
              <span key={y} style={{ color: Math.abs(playYear - y) < 1.5 ? "#fff" : undefined }}>{y === 2025 ? "Today" : y}</span>
            ))}
          </div>
        </div>

        {/* Speed */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {[0.5, 1, 2].map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.4)",
              background: speed === s ? "#fff" : "transparent", color: speed === s ? C.navy : "rgba(255,255,255,0.85)",
            }}>{s}×</button>
          ))}
          <button onClick={() => { setPlaying(false); setPlayYear(START); }} style={{
            padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "rgba(255,255,255,0.85)",
          }}>↺ Reset</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* LEFT: lever panel */}
        <div style={{ width: 290, flexShrink: 0, background: C.card, border: `1px solid ${C.hair}`, padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {YEARS.map(y => (
              <button key={y} onClick={() => selectAnchor(y)} style={{
                flex: 1, padding: "6px 0", fontSize: 12.5, fontWeight: 700, borderRadius: 2,
                border: `1px solid ${anchorYear === y ? C.accent : C.hair}`,
                background: anchorYear === y ? C.accent : "#fff", color: anchorYear === y ? "#fff" : C.slate,
              }}>{y === 2025 ? "Today" : y}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.slate, marginBottom: 12, lineHeight: 1.45 }}>
            Set each lever's deployment (% of its maximum potential) for <b style={{ color: C.ink }}>{anchorYear === 2025 ? "today" : anchorYear}</b>, then press play to watch the pathway unfold.
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", background: C.accent, display: "inline-block", padding: "3px 10px", marginBottom: 10 }}>Shift in gas demand</div>
          {LEVERS.filter(l => l.group === "demand").map(l => (
            <Slider key={l.id} lever={l} value={dep[anchorYear][l.id]} onChange={v => setLever(l.id, v)} color={groupColor.demand} />
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff", background: C.bio, display: "inline-block", padding: "3px 10px", margin: "8px 0 10px" }}>Transition to green gas</div>
          {LEVERS.filter(l => l.group === "supply").map(l => (
            <Slider key={l.id} lever={l} value={dep[anchorYear][l.id]} onChange={v => setLever(l.id, v)} color={groupColor.supply} />
          ))}

          <div style={{ fontSize: 10.5, color: "#93a1b1", borderTop: `1px solid ${C.hair}`, paddingTop: 8, lineHeight: 1.5 }}>
            Demand reductions are capped at the 45 TWh baseline. Within residual throughput, supply is allocated by priority: H₂ for I&C first (enduring industrial conversions), then biomethane, then blending (transitional). H₂ blending shown on an energy basis.
          </div>
        </div>

        {/* RIGHT: KPIs + charts — all driven by the playhead year */}
        <div style={{ flex: 1, minWidth: 520 }}>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Kpi label={`Network throughput ${displayYear === 2025 ? "today" : displayYear}`} value={fmt(now.residual)} unit="TWh" sub={`${fmt((1 - now.residual / BASELINE) * 100, 0)}% below today`} color={C.navy} />
            <Kpi label="Unabated natural gas" value={fmt(now.natgas)} unit="TWh" sub={`${fmt(now.residual > 0 ? (now.natgas / now.residual) * 100 : 0, 0)}% of throughput`} color={C.natgas} />
            <Kpi label="Green gas share" value={fmt(now.greenShare * 100, 0)} unit="%" sub={`${fmt(now.bio + now.bl + now.h2)} TWh bio + H₂`} color={C.bio} />
            <Kpi
              label="Heat pumps installed"
              value={fmtCount(hpStats.stock)}
              unit="homes"
              sub={`≈ ${fmtCount(hpStats.runRate)}/yr now · peak ${fmtCount(hpStats.peak)}/yr`}
              color={C.hp}
            />
            <Kpi label="2050 network role" value={fmt(yr2050.residual)} unit="TWh" sub={yr2050.natgas > 5 ? `⚠ ${fmt(yr2050.natgas)} TWh still unabated` : `${fmt(yr2050.greenShare * 100, 0)}% green by 2050`} color={yr2050.natgas > 5 ? C.warn : C.h2} />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.hair}`, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy }}>
                {view === "trajectory"
                  ? "Throughput erodes from the top; the residual molecule turns green from the bottom"
                  : view === "buildup"
                  ? `Technologies rise toward their potential as they deploy — ${displayYear === 2025 ? "today" : displayYear}`
                  : `Where today's 45 TWh sits in ${displayYear === 2025 ? "2025" : displayYear} — departed demand vs molecules still in the network`}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[["trajectory", "Trajectory 2025–50"], ["buildup", `Build-up ${displayYear === 2025 ? "today" : displayYear}`], ["treemap", "Mix map"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setView(k)} style={{
                    padding: "5px 12px", fontSize: 11.5, fontWeight: 600, borderRadius: 2,
                    border: `1px solid ${view === k ? C.navy : C.hair}`,
                    background: view === k ? C.navy : "#fff", color: view === k ? "#fff" : C.slate,
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            {view === "trajectory" ? (
              <ResponsiveContainer width="100%" height={380}>
                <AreaChart data={series} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.hair} vertical={false} />
                  <XAxis dataKey="year" type="number" domain={[START, END]} tick={{ fontSize: 11, fill: C.slate }} tickLine={false} axisLine={{ stroke: C.hair }} ticks={[2025, 2030, 2035, 2040, 2045, 2050]} />
                  <YAxis tick={{ fontSize: 11, fill: C.slate }} tickLine={false} axisLine={false} domain={[0, 48]} label={{ value: "TWh / yr", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: C.slate } }} />
                  <Tooltip content={<ChartTip />} />
                  <ReferenceLine y={BASELINE} stroke={C.navy} strokeDasharray="5 4" label={{ value: "45 TWh today", position: "insideTopRight", fontSize: 11, fill: C.navy, fontWeight: 700 }} />
                  {/* Animated playhead */}
                  <ReferenceLine x={playYear} stroke={C.accent} strokeWidth={2}
                    label={{ value: displayYear, position: "top", fontSize: 12, fill: C.accent, fontWeight: 700 }} />
                  <Area type="monotone" dataKey="Natural gas" stackId="s" fill={C.natgas} stroke="none" fillOpacity={0.95} isAnimationActive={false} />
                  <Area type="monotone" dataKey="Biomethane" stackId="s" fill={C.bio} stroke="none" fillOpacity={0.95} isAnimationActive={false} />
                  <Area type="monotone" dataKey="H₂ blend" stackId="s" fill={C.blend} stroke="none" fillOpacity={0.95} isAnimationActive={false} />
                  <Area type="monotone" dataKey="H₂ for I&C" stackId="s" fill={C.h2} stroke="none" fillOpacity={0.95} isAnimationActive={false} />
                  <Area type="monotone" dataKey="Energy efficiency" stackId="s" fill={C.ee} stroke="none" fillOpacity={0.55} isAnimationActive={false} />
                  <Area type="monotone" dataKey="Heat networks" stackId="s" fill={C.hn} stroke="none" fillOpacity={0.55} isAnimationActive={false} />
                  <Area type="monotone" dataKey="Heat pumps" stackId="s" fill={C.hp} stroke="none" fillOpacity={0.55} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : view === "buildup" ? (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={buildup} margin={{ top: 34, right: 14, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="2 4" stroke={C.hair} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: C.slate }} tickLine={false} axisLine={{ stroke: C.hair }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: C.slate }} tickLine={false} axisLine={false} domain={[0, 32]} label={{ value: "TWh / yr", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: C.slate } }} />
                  {/* Deployed: rises from the axis as installed */}
                  <Bar dataKey="deployed" stackId="b" isAnimationActive={false} name="Deployed">
                    {buildup.map((r, i) => <Cell key={i} fill={r.fill} />)}
                    <LabelList dataKey="deployed" position="insideTop" formatter={(v) => v > 1.2 ? fmt(v) : ""} style={{ fontSize: 11, fontWeight: 700, fill: "#fff" }} />
                  </Bar>
                  {/* Headroom: remaining potential as a ghost band above */}
                  <Bar dataKey="headroom" stackId="b" isAnimationActive={false} name="Remaining potential">
                    {buildup.map((r, i) => <Cell key={i} fill={r.fill} fillOpacity={0.16} stroke={r.fill} strokeOpacity={0.35} strokeDasharray="3 3" />)}
                    <LabelList dataKey="pct" position="top" offset={8} formatter={(v) => v == null ? "" : `${Math.round(v * 100)}%`} style={{ fontSize: 11, fontWeight: 700, fill: C.ink }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 320, height: 380 }}>
                  <ResponsiveContainer width="100%" height={380}>
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      nameKey="name"
                      aspectRatio={4 / 3}
                      isAnimationActive={false}
                      content={<TreeCell />}
                      stroke="#fff"
                    >
                      <Tooltip content={<TreeTip />} />
                    </Treemap>
                  </ResponsiveContainer>
                </div>
                {/* Live legend — plain HTML so it's always readable */}
                <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.slate, padding: "4px 0 6px", borderBottom: `2px solid ${C.accent}` }}>
                    Demand left the network · {fmt(now.hp + now.hn + now.ee)} TWh
                  </div>
                  {[["Heat pumps", now.hp, C.hp], ["Heat networks", now.hn, C.hn], ["Energy efficiency", now.ee, C.ee]].map(([n, v, c]) => (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.hair}` }}>
                      <span style={{ width: 13, height: 13, background: c, opacity: 0.45, border: `1.5px dashed ${c}`, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: C.ink }}>{n}</span>
                      <b style={{ fontVariantNumeric: "tabular-nums", color: C.navy }}>{fmt(v)}</b>
                      <span style={{ width: 34, textAlign: "right", color: C.slate, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{fmt((v / BASELINE) * 100, 0)}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.slate, padding: "12px 0 6px", borderBottom: `2px solid ${C.bio}` }}>
                    Network throughput · {fmt(now.residual)} TWh
                  </div>
                  {[["Natural gas", now.natgas, C.natgas], ["Biomethane", now.bio, C.bio], ["H₂ blend", now.bl, C.blend], ["H₂ for I&C", now.h2, C.h2]].map(([n, v, c]) => (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.hair}` }}>
                      <span style={{ width: 13, height: 13, background: c, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: C.ink }}>{n}</span>
                      <b style={{ fontVariantNumeric: "tabular-nums", color: C.navy }}>{fmt(v)}</b>
                      <span style={{ width: 34, textAlign: "right", color: C.slate, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{fmt((v / BASELINE) * 100, 0)}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10.5, color: "#93a1b1", marginTop: 8, lineHeight: 1.5 }}>
                    TWh · % of today's 45 TWh. Hover any tile for detail.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10, fontSize: 11.5, color: C.slate, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
              {[["Heat pumps", C.hp], ["Heat networks", C.hn], ["Energy efficiency", C.ee], ["Natural gas", C.natgas], ["Biomethane", C.bio], ["H₂ blend", C.blend], ["H₂ for I&C", C.h2]].map(([n, c]) => (
                <span key={n}><span style={{ display: "inline-block", width: 9, height: 9, background: c, marginRight: 5, opacity: ["Heat pumps", "Heat networks", "Energy efficiency"].includes(n) ? 0.55 : 1 }} />{n}</span>
              ))}
              <span style={{ marginLeft: "auto", fontStyle: "italic" }}>
                {view === "buildup"
                  ? "Solid = TWh deployed at the playhead year · dashed ghost = remaining potential · % above each column = share of potential deployed"
                  : view === "treemap"
                  ? "The full square is always today's 45 TWh · translucent dashed tiles = demand that has left the network · solid tiles = molecules still flowing"
                  : "Lighter wedges = demand leaving the network · solid = molecules flowing through it"}
              </span>
            </div>
          </div>

          {/* ── ASSUMPTIONS & NARRATIVE ───────────────────────────────────── */}
          <AssumptionsPanel />
        </div>
      </div>
    </div>
  );
}

// ── Assumptions & model narrative ────────────────────────────────────────────

function AssumptionsPanel() {
  const [open, setOpen] = useState("baseline");
  const S = ({ id, n, title, children }) => (
    <div style={{ borderBottom: `1px solid ${C.hair}` }}>
      <button
        onClick={() => setOpen(open === id ? null : id)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none",
          padding: "12px 4px", display: "flex", alignItems: "baseline", gap: 10,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{n}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.navy, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 13, color: C.slate, flexShrink: 0 }}>{open === id ? "−" : "+"}</span>
      </button>
      {open === id && (
        <div style={{ padding: "0 4px 14px 28px", fontSize: 12.5, color: C.ink, lineHeight: 1.65, maxWidth: 820 }}>
          {children}
        </div>
      )}
    </div>
  );

  const Row = ({ k, v }) => (
    <div style={{ display: "flex", gap: 12, padding: "3px 0", borderBottom: `1px dotted ${C.hair}` }}>
      <span style={{ width: 190, flexShrink: 0, color: C.slate }}>{k}</span>
      <span style={{ color: C.ink }}>{v}</span>
    </div>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.hair}`, padding: "14px 18px", marginTop: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.slate, marginBottom: 2 }}>
        Model basis
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
        Assumptions and narrative — what's behind the numbers
      </div>

      <S id="baseline" n="01" title="Baseline: 45 TWh of annual throughput, and what it covers">
        <p style={{ margin: "0 0 8px" }}>
          The model starts from approximately 45 TWh/yr of gas delivered through the Scotland distribution
          network — domestic, commercial and smaller industrial demand connected at distribution pressure
          tiers. It excludes transmission-connected loads (large power generation and the biggest industrial
          sites), so this is a view of the network SGN operates, not Scottish gas consumption in total.
          Throughput is treated as weather-normal: a single representative year, not a peak or a cold-year figure.
        </p>
        <p style={{ margin: 0 }}>
          Everything in the model is conservation-of-energy against that 45: demand-side levers remove
          throughput from it, supply-side levers recolour what remains. The treemap is the literal expression
          of this — the square is always 45 TWh; only the carve-up changes.
        </p>
      </S>

      <S id="demand" n="02" title="Demand-side potentials: who can actually leave the network">
        <div style={{ marginBottom: 8 }}>
          <Row k="Heat pumps" v="max 27 TWh (60% of baseline) ≈ 2.0m home conversions at 13,500 kWh/yr per average Scottish gas-heated home — effectively the whole on-gas housing stock" />
          <Row k="Heat networks" v="max 13 TWh (30%) — dense urban heat demand technically addressable by district schemes" />
          <Row k="Energy efficiency" v="max 9 TWh (20%) — fabric and controls savings across the remaining stock" />
        </div>
        <p style={{ margin: 0 }}>
          These are technical ceilings, not forecasts — and they overlap. A tenement flat that joins a heat
          network is no longer available to a heat pump, and an insulated home burns less gas for either to
          displace. The model handles this crudely: combined reductions are capped at the 45 TWh baseline,
          but below the cap the levers are treated as additive. At high simultaneous deployment this
          overstates combined impact, which means the modelled demand erosion is, if anything, aggressive.
          Useful to know when arguing the network declines slower than FES central cases assume.
        </p>
      </S>

      <S id="supply" n="03" title="Supply-side potentials and the allocation hierarchy">
        <div style={{ marginBottom: 8 }}>
          <Row k="Biomethane" v="max 18 TWh — Scottish feedstock and injection potential; for context NESO's GB-wide Holistic Transition figure is 64 TWh by 2050, so this assumes Scotland punches well above its demand share, justified by feedstock endowment" />
          <Row k="H₂ blending" v="max 9 TWh on an energy basis — broadly a 20% by volume blend across remaining throughput (hydrogen's lower volumetric energy density means 20% vol ≈ 7% energy; the 9 TWh ceiling assumes blend plus early repurposing)" />
          <Row k="H₂ for I&C" v="max 9 TWh — dedicated hydrogen to industrial and commercial users, anchored by cluster projects of the Aberdeen Hydrogen Hub type" />
        </div>
        <p style={{ margin: 0 }}>
          Supply is allocated within residual throughput by priority, not pro-rata. Hydrogen for I&C is served
          first: an industrial site that converts has made a sunk, irreversible investment and does not get
          diluted because households electrified. Biomethane comes second as contracted physical injection.
          Blending takes whatever headroom is left — deliberately, because blending only exists while there
          is natural gas to blend into; it is the transitional supply and the model treats it that way. This is
          why, on play, the blend wedge gets squeezed in the 2040s while I&C hydrogen holds: that asymmetry
          is a modelling choice reflecting the economics, not an artefact.
        </p>
      </S>

      <S id="scenarios" n="04" title="Scenario calibration: FES 2025 narratives, not FES regional data">
        <p style={{ margin: "0 0 8px" }}>
          The four presets are calibrated to the published NESO FES 2025 pathway narratives, translated into
          lever deployment percentages at 2030/2040/2050. They are not extracts from NESO's regional
          building-block workbooks. Holistic Transition leads with electrified heat and maximised biomethane,
          with hydrogen confined to industrial clusters. Electric Engagement pushes heat pumps to the full
          2.0m-home ceiling and strips hydrogen out of heat almost entirely. Hydrogen Evolution holds heat-pump
          uptake back, runs blending hard through the 2030s, and converts industry fully. Falling Behind is
          not a do-nothing case — it reflects committed pipeline projects and current policy momentum — but
          deployment stalls and roughly 24 TWh of unabated natural gas remains in 2050.
        </p>
        <p style={{ margin: 0 }}>
          The structural takeaway survives all three net-zero presets: they disagree about the journey but
          converge on the destination — a smaller network whose enduring core is industrial hydrogen plus
          biomethane. The scenarios are an argument about pace and the domestic segment, not about whether
          that core exists.
        </p>
      </S>

      <S id="mechanics" n="05" title="Mechanics: interpolation, units, and the heat pump arithmetic">
        <div style={{ marginBottom: 8 }}>
          <Row k="Time path" v="lever deployment is set at four anchors (today, 2030, 2040, 2050) and linearly interpolated between them — no S-curves, so early-period deployment is likely overstated and late-period understated" />
          <Row k="Units" v="all flows on an annual energy basis (TWh higher heating value); hydrogen volumes converted to energy" />
          <Row k="Heat pump count" v="installations = displaced TWh ÷ 13,500 kWh per home; the run-rate KPI is the local gradient of the deployment curve, the peak figure is the maximum single-year requirement across the pathway" />
        </div>
        <p style={{ margin: 0 }}>
          The run-rate is the model's most decision-relevant output. Holistic Transition implies a peak of
          roughly 90–100k Scottish installations per year through the 2030s against a current run-rate of
          7–10k — a ~10× supply-chain scale-up. Any board member sceptical of demand erosion can drag the
          heat-pump slider and watch the implied installer workforce requirement move with it.
        </p>
      </S>

      <S id="limits" n="06" title="What this model deliberately does not do">
        <p style={{ margin: "0 0 8px" }}>
          Annual energy only — no peak. Networks are sized for the coldest hour, not the average year, and
          peak heat demand declines far more slowly than annual throughput as the easiest conversions happen
          first. A 50% fall in TWh is emphatically not a 50% fall in required network capability, which is
          the central fact for any RAV and asset-stranding conversation built on top of this.
        </p>
        <p style={{ margin: 0 }}>
          No prices, no policy triggers, no consumer behaviour: deployment is exogenous — the sliders are the
          policy. No new demand sources (gas for distributed power or data-centre backup would offset erosion).
          No feasibility constraint on run-rates: the model will cheerfully show a pathway requiring 150k
          installs a year; whether Scotland's supply chain can deliver it is the question the number is meant
          to provoke, not answer. Treat the tool as a structured way to argue about assumptions — the value is
          in the levers, not the point estimates.
        </p>
      </S>

      <div style={{ fontSize: 10.5, color: "#93a1b1", marginTop: 10, lineHeight: 1.5 }}>
        Illustrative strategic planning tool. Baseline per SGN Scotland network throughput estimate; lever
        ranges per "Estimated potential to meet today's energy requirements" analysis; pathway shapes per NESO
        Future Energy Scenarios 2025 narratives.
      </div>
    </div>
  );
}
