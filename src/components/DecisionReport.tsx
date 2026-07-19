// DECISION & AUDIT REPORT — a plain-language, printable document generated purely from live
// state (scenario / options / objections / audit / charter). RENDER-ONLY and deterministic:
// no Date.now, no Math.random, and it NEVER mutates the audit chain (like labels.ts, it maps
// engine strings at render time only). Story-first, proof-backed:
//   masthead verdict → what's the problem → what was considered → WHY blocked/demoted (the heart)
//   → recommended plan → how the decision was made → Appendix A tamper-evident trail → Appendix B rulebook.
// Design spec: a 3-lens panel (CEO / auditor / skeptic) synthesised into one document. The
// load-bearing honesty move: a green seal proves the record was not edited or reordered, NOT that
// the figures are real or the decision correct. R/E/S chips (not the seal) carry real-vs-demo.

import type {
  AuditEntry, CharterArticle, GraphNode, Objection, OptionCard, ScenarioState, Severity,
} from '../contracts/types';
import { optionLabel, STATUS_LABEL, STATUS_PILL, articleName, plainMessage, prettify } from '../lib/labels';
import { fmtKbd, fmtUsdBbl, fmtDelta, fmtDays, fmtUsdBig, fmtTs } from '../lib/fmt';
import { PROVENANCE_STATEMENT } from '../engine/ai/brief';

const NATIONAL_RUNS_KBD = 4900; // India's ~4.9 mb/d refinery runs (PPAC-derived; prov E). % share only.

// shock id → plain phrase; fall back to the chokepoint node's name.
const SHOCK_PHRASE: Record<string, string> = {
  'shock:hormuz-severe': 'a severe closure of the Strait of Hormuz',
  'shock:hormuz-partial': 'a partial disruption of the Strait of Hormuz',
  'shock:bab-el-mandeb-severe': 'a severe closure of the Bab-el-Mandeb strait',
  'shock:bab-el-mandeb-partial': 'a partial disruption of Bab-el-Mandeb',
  'shock:suez-severe': 'a severe closure of the Suez Canal',
};
function shockPhrase(active: string[], nodes: GraphNode[]): string {
  const parts = active.map((id) => {
    if (SHOCK_PHRASE[id]) return SHOCK_PHRASE[id];
    const key = id.replace(/^shock:/, '').replace(/-(severe|partial)$/, '');
    const sev = /severe/.test(id) ? 'severe' : 'partial';
    const node = nodes.find((n) => n.type === 'chokepoint' && n.id.includes(key));
    return `a ${sev} disruption at ${node?.name ?? prettify(key)}`;
  });
  return parts.length <= 1 ? (parts[0] ?? 'a supply disruption') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

const STATUS_WORD: Record<string, string> = { ok: 'Normal', stressed: 'Under stress', critical: 'Critical' };
const SEV_WEIGHT: Record<Severity, string> = { block: 'Hard stop — disqualifying', flag: 'Condition — must fix', note: 'Note — disclosure' };
const SEV_RANK: Record<Severity, number> = { block: 0, flag: 1, note: 2 };
const ACTOR_PLAIN: Record<string, string> = {
  proposer: 'AI proposer', critic: 'rules critic', arbiter: 'arbiter', user: 'human',
  system: 'system', ai_extractor: 'AI extractor', ai_auditor: 'AI auditor',
};
const ACTION_PLAIN: Record<string, string> = {
  propose: 'AI proposed the options', criticize: 'critic checked the rules', arbitrate: 'arbiter ruled',
  set_charter_param: 'a human edited a rule', approve_decision: 'a human approved', ai_extract: 'AI read the note',
  ai_rule_audit: 'AI audited the rules (advisory)',
};

const nodeName = (id: string, nodes: GraphNode[]): string => nodes.find((n) => n.id === id)?.name ?? prettify(id);

/** Map an audit ref to a plain label. Prefer the current options; else parse the deterministic
    option-id shape 'opt:<lever>:<gr:grade|->:<ref:refinery|->:<n>' so cumulative-chain refs from an
    earlier cursor never leak a raw id into the (layperson-facing) About column. */
function refLabel(ref: string, byId: Map<string, string>): string {
  if (byId.has(ref)) return byId.get(ref)!;
  // refs may wrap an option id (an objection id is `<rule_id>:<option_id>`); extract the embedded
  // opt id — shape `opt:<lever>:<gr:grade|->:<ref:refinery|->:<n>` — and map it (missing segs are '-').
  const emb = ref.match(/opt:[a-z_]+:(?:gr:[a-z0-9-]+|-):(?:ref:[a-z0-9-]+|-):\d+/);
  if (emb) {
    if (byId.has(emb[0])) return byId.get(emb[0])!;
    const m = emb[0].match(/^opt:([a-z_]+):(gr:[a-z0-9-]+|-):(ref:[a-z0-9-]+|-):\d+$/);
    if (m) {
      const verb = LEVER_TYPE[m[1]] ?? prettify(m[1]);
      const grade = m[2] !== '-' ? ` ${prettify(m[2])}` : '';
      const dest = m[3] !== '-' ? ` → ${prettify(m[3])}` : '';
      return `${verb.charAt(0).toUpperCase()}${verb.slice(1)}${grade}${dest}`;
    }
  }
  return prettify(ref);
}

/** Provenance chip. R = real-sourced, E = estimated, S = synthetic/demo. */
function Chip({ p }: { p: 'R' | 'E' | 'S' }) {
  const t = { R: 'Real-sourced', E: 'Estimated', S: 'Synthetic / demo data' }[p];
  return <span className={`rep-chip rep-chip-${p}`} title={t}>{p}</span>;
}

function Seal({ verified }: { verified: boolean }) {
  return (
    <span className={`report-seal ${verified ? 'ok' : 'broken'}`}>
      <span className="report-seal-dot" /> {verified ? 'VERIFIED ✓' : 'CHAIN BROKEN'}
    </span>
  );
}

export interface DecisionReportProps {
  scenario: ScenarioState | null;
  options: OptionCard[];
  objections: Objection[];
  audit: AuditEntry[];
  charter: CharterArticle[];
  verified: boolean;
  sandbox: boolean;
  nodes: GraphNode[];
  cover: number | null;
  safeLine: number;
  contributions: { lever: string; kbd: number; pending: number }[];
  costOfDelayUsd: number;
  costTitle: string;
  onClose: () => void;
}

function printReport(): void {
  document.body.classList.add('print-report');
  const done = () => document.body.classList.remove('print-report');
  window.addEventListener('afterprint', done, { once: true });
  window.print();
}

export default function DecisionReport(props: DecisionReportProps) {
  const { scenario, options, objections, audit, charter, verified, sandbox, nodes, cover, safeLine, contributions, costOfDelayUsd, costTitle, onClose } = props;

  const floor = safeLine;
  const crisis = !!scenario && scenario.shocks_active.length > 0;
  const optLabelById = new Map(options.map((o) => [o.id, optionLabel(o)]));

  // refineries sorted tightest-first; below-floor is computed from cover_days < floor (NOT node_status)
  const refineries = scenario
    ? Object.entries(scenario.cover_days).map(([id, d]) => ({ id, d, status: scenario.node_status[id] ?? 'ok' }))
      .sort((a, b) => a.d - b.d)
    : [];
  const belowFloor = refineries.filter((r) => r.d < floor);
  const gap = scenario ? scenario.gap_kbd : 0;
  const pctRuns = Math.round((gap / NATIONAL_RUNS_KBD) * 100);

  const approved = options.filter((o) => o.status === 'validated');
  const conditional = options.filter((o) => o.status === 'conditional');
  const rejected = options.filter((o) => o.status === 'rejected');

  const objByOption = new Map<string, Objection[]>();
  objections.forEach((o) => { const a = objByOption.get(o.option_id) ?? []; a.push(o); objByOption.set(o.option_id, a); });
  const blockCount = (id: string) => (objByOption.get(id) ?? []).filter((o) => o.severity === 'block').length;

  // most-actionable move — the SAME ordering the recommended plan (§4) leads with, so the masthead
  // headline and plan[0] never name different options.
  const byBenefit = (a: OptionCard, b: OptionCard) => b.cover_days_gained - a.cover_days_gained || b.volume_kb - a.volume_kb;
  const bestApproved = [...approved].sort(byBenefit)[0];
  const topAction = bestApproved ?? [...conditional].sort((a, b) => blockCount(a.id) - blockCount(b.id))[0];

  // gap math (mirrors the App waterfall: firm = validated, pending = demoted-with-conditions, never firm)
  const firmCovered = contributions.reduce((s, c) => s + c.kbd, 0);
  const pendingCover = contributions.reduce((s, c) => s + c.pending, 0);
  const remaining = Math.max(0, gap - firmCovered);
  const pctClosed = gap > 0 ? Math.min(100, Math.round((firmCovered / gap) * 100)) : 0; // clamp like Waterfall

  return (
    <div className="modal-backdrop report-backdrop" onClick={onClose}>
      <div className="report-doc" onClick={(e) => e.stopPropagation()}>
        <div className="report-actions no-print">
          <button className="report-print-btn" onClick={printReport}>⎙ Save as PDF</button>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>

        {/* ── Masthead / verdict band ─────────────────────────────── */}
        <header className="report-masthead">
          <div className="report-title">TRINETRA · Decision &amp; Audit Report</div>
          <div className="report-subtitle">
            {sandbox ? 'What-if scenario for India’s crude supply chain.' : 'Replay of the 2026 Strait of Hormuz crude-supply crisis (India).'} <b>SIMULATED — decision-support only.</b>
          </div>
          <div className="report-asof">
            As of {scenario ? fmtTs(scenario.t_sim) : '—'} <span className="report-dim">(simulated clock; no wall-clock time is used anywhere in this report)</span>
          </div>
          {sandbox && <div className="report-sandbox">SANDBOX · WHAT-IF — hypothetical inputs, not the canonical replay.</div>}

          {crisis ? (
            <p className="report-problem">
              {shockPhrase(scenario!.shocks_active, nodes)} has opened a {fmtKbd(gap)} gap in India&apos;s crude
              supply, about {pctRuns}% <Chip p="E" /> of national refinery runs. {belowFloor.length} of {refineries.length} refineries
              sit below the {floor}-day safety floor{belowFloor.length > 0 && <>, the tightest being <b>{nodeName(belowFloor[0].id, nodes)}</b> at {fmtDays(belowFloor[0].d)} <Chip p="S" /></>},
              with Brent at {fmtUsdBbl(scenario!.brent_usd)}.
            </p>
          ) : (
            <p className="report-problem">
              As of the simulated clock, no supply disruption is active. Every refinery is at or above the {floor}-day
              safety floor and no options were scored. This report records a clean baseline.
            </p>
          )}

          <div className="report-verdictbar">
            <div className="report-kpis">
              {crisis ? (
                <>
                  <div className="report-kpi"><span className="rk-num">{fmtKbd(gap)}</span><span className="rk-cap">National shortfall <Chip p="E" /></span></div>
                  <div className="report-kpi"><span className="rk-num">{cover !== null ? fmtDays(cover) : '—'}</span><span className="rk-cap">National cover · floor {floor} d <Chip p="S" /></span></div>
                  <div className="report-kpi"><span className="rk-num">{belowFloor.length} of {refineries.length}</span><span className="rk-cap">Refineries below floor</span></div>
                  <div className="report-kpi"><span className="rk-num">{fmtUsdBbl(scenario!.brent_usd)}</span><span className="rk-cap">Brent <Chip p="E" /></span></div>
                </>
              ) : (
                <div className="report-kpi"><span className="rk-num rk-ok">All clear</span><span className="rk-cap">No action required</span></div>
              )}
            </div>
            <div className="report-seal-wrap">
              <Seal verified={verified} />
              {crisis && <div className="report-rec"><b>Recommended action:</b> {topAction ? <>{optionLabel(topAction)}{topAction.status !== 'validated' && <span className="report-dim"> (demoted — conditions apply)</span>}</> : 'No option cleared every rule; a human decision is required.'}</div>}
            </div>
          </div>
          <div className="report-caveat">
            <b>What “verified” means:</b> the record was not edited or reordered after the fact. It does <b>not</b> mean the
            figures are real or the decision correct. Figures marked <Chip p="S" /> are demo data; the R/E/S chips, not the seal, carry that.
          </div>
        </header>

        {crisis && (
          <>
            {/* ── 1. What is the problem ──────────────────────────── */}
            <section className="report-section">
              <h2 className="report-h">1 · What is the problem</h2>
              <p>
                {shockPhrase(scenario!.shocks_active, nodes)} has cut into India&apos;s crude corridor. The national
                shortfall is {fmtKbd(gap)} <Chip p="E" /> and Brent is {fmtUsdBbl(scenario!.brent_usd)} <Chip p="E" />.
                The security floor (Article A2) requires at least <b>{floor} days</b> of cover; refineries below it are at risk.
              </p>
              <div className="report-scroll">
                <table className="report-table">
                  <thead><tr><th>Refinery</th><th className="rt-num">Days of cover</th><th>Status</th><th>vs {floor}-day floor</th><th>Data</th></tr></thead>
                  <tbody>
                    {refineries.map((r) => (
                      <tr key={r.id} className={r.d < floor ? 'rt-below' : ''}>
                        <td>{nodeName(r.id, nodes)}</td>
                        <td className="rt-num">{fmtDays(r.d)}</td>
                        <td>{STATUS_WORD[r.status] ?? r.status}</td>
                        <td>{r.d < floor ? <b className="rt-word-bad">below floor</b> : 'at or above'}</td>
                        <td><Chip p="S" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="report-fine">Per-refinery inventories are modeled demo data (S), never upgraded to real. Below-floor status is computed from days-of-cover against the Article A2 floor.</p>
            </section>

            {/* ── 2. What was considered ──────────────────────────── */}
            <section className="report-section">
              <h2 className="report-h">2 · What was considered</h2>
              <p>
                We evaluated <b>{options.length}</b> moves across five levers (reserve draw, divert on-water, floating
                storage, reroute, demand cut): <b>{approved.length} approved</b>, <b>{conditional.length} demoted</b>, <b>{rejected.length} blocked</b>.
                Failed options are shown, not hidden.
              </p>
              <div className="report-scroll">
                <table className="report-table">
                  <thead><tr><th>Move</th><th>Type</th><th className="rt-num">Volume</th><th className="rt-num">Arrives</th><th className="rt-num">Adds cover</th><th className="rt-num">Extra cost</th><th className="rt-num">Rules cited</th><th>Verdict</th></tr></thead>
                  <tbody>
                    {dedupeOptions(options).map(({ o, count }) => (
                      <tr key={o.id}>
                        <td>{optionLabel(o)}{count > 1 && <span className="rt-mult"> ×{count}</span>}</td>
                        <td>{leverType(o.lever)}</td>
                        <td className="rt-num">{Math.round(o.volume_kb)} kb</td>
                        <td className="rt-num">{fmtDays(o.eta_days)}</td>
                        <td className="rt-num">{fmtDays(o.cover_days_gained)}</td>
                        <td className="rt-num">{o.cost_delta_usd_bbl !== undefined ? fmtDelta(o.cost_delta_usd_bbl) : '—'}</td>
                        <td className="rt-num">{(objByOption.get(o.id) ?? []).length}</td>
                        <td><span className={`report-pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="report-fine">Volumes, arrival times, cover-gained and cost are modeled or estimated (S / E), never presented as confirmed; see the provenance legend in Appendix B.</p>
            </section>

            {/* ── 3. WHY the machine blocked or demoted (the heart) ── */}
            <section className="report-section">
              <h2 className="report-h">3 · Why the machine blocked or demoted options</h2>
              <p className="report-standing">
                Every finding below is a computed fact — {`{ article, evidence, severity }`} — emitted by a named pure
                function. The critic contains <b>no language model</b> and cannot invent a reason.
              </p>
              {[...rejected, ...conditional].length === 0 ? (
                <p>Every option that survived screening passed all rules cleanly.</p>
              ) : (
                orderWhy(rejected, conditional, blockCount).map((o) => {
                  const objs = [...(objByOption.get(o.id) ?? [])].sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || a.rule_id.localeCompare(b.rule_id));
                  return (
                    <div key={o.id} className="report-why">
                      <div className="report-why-head">
                        <span className="rwh-name">{optionLabel(o)}</span>
                        <span className={`report-pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                        <span className="rwh-count">{objs.length} {objs.length === 1 ? 'reason' : 'reasons'}</span>
                      </div>
                      <div className="report-scroll">
                        <table className="report-table report-obj-table">
                          <thead><tr><th>Rule</th><th>Finding</th><th>Weight</th><th>Evidence</th><th>Checked by</th></tr></thead>
                          <tbody>
                            {objs.map((ob) => (
                              <tr key={ob.id}>
                                <td>{articleName(ob.rule_id)}</td>
                                <td>{plainMessage(ob.message)}</td>
                                <td><span className={`rep-sev rep-sev-${ob.severity}`}>{SEV_WEIGHT[ob.severity]}</span></td>
                                <td>{ob.evidence.length ? ob.evidence.map((e, i) => <span key={i} className="rep-evi">{plainMessage(e)}<Chip p="S" /></span>) : <span className="report-dim">—</span>}</td>
                                <td><span className="rep-fn">{validatorPlain(ob.validator)}</span><span className="report-dim"> · rules only, zero AI</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {o.status === 'conditional' && o.conditions && o.conditions.length > 0 && (
                        <div className="report-conditions">
                          <b>What would have to be true to run this:</b>
                          <ul>{o.conditions.map((c, i) => <li key={i}>{plainMessage(c)}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>

            {/* ── 4. The recommended plan ─────────────────────────── */}
            <section className="report-section">
              <h2 className="report-h">4 · The recommended plan</h2>
              {approved.length === 0 ? (
                <p>{topAction
                  ? <>No option cleared every rule outright. Safest available move: <b>{optionLabel(topAction)}</b>{topAction.conditions?.length ? <>, subject to: {topAction.conditions.map(plainMessage).join('; ')}</> : null}. This needs your decision.</>
                  : 'No viable move surfaced under the current rules; a human decision is required.'}</p>
              ) : (() => {
                const plan = [...approved].sort((a, b) => b.cover_days_gained - a.cover_days_gained || b.volume_kb - a.volume_kb);
                const shown = plan.slice(0, 8);
                const rest = plan.slice(8);
                const restKb = rest.reduce((s, o) => s + o.volume_kb, 0);
                return (
                  <ul className="report-plan">
                    {shown.map((o) => (
                      <li key={o.id}>
                        Move <b>{Math.round(o.volume_kb)} kb</b>{o.target_refinery ? <> to <b>{nodeName(o.target_refinery, nodes)}</b></> : null}, arriving in {fmtDays(o.eta_days)}, adding {fmtDays(o.cover_days_gained)} of cover{o.cost_delta_usd_bbl !== undefined ? <> at {fmtDelta(o.cost_delta_usd_bbl)}</> : null}.
                        <span className="report-readiness"> {PAYMENT_PLAIN[o.payment_rail] ?? o.payment_rail}{o.payment_note ? ` (${o.payment_note})` : ''}; {o.port_ok ? 'berth fits' : 'berth check needed'}.</span>
                      </li>
                    ))}
                    {rest.length > 0 && <li className="report-dim">Plus {rest.length} further approved moves ({Math.round(restKb)} kb combined), each smaller.</li>}
                  </ul>
                );
              })()}
              <div className="report-gapmath">
                <b>Gap math</b> (indicative, not a guaranteed close): started {fmtKbd(gap)}; firmly covered {fmtKbd(firmCovered)} ({pctClosed}% of the gap); remaining {fmtKbd(remaining)}.
                {pendingCover > 0 && <> A further {fmtKbd(pendingCover)} is available only if the demoted options&apos; conditions are met, and is not counted as firm cover.</>}
              </div>
              <div className="report-cost" title={costTitle}>
                <b>Cost of a decision lag:</b> {fmtUsdBig(costOfDelayUsd)} — what every day of hesitation costs at the current price excess (order-of-magnitude; spot share directional <Chip p="E" />).
              </div>
              <div className="report-approval">REQUIRES HUMAN APPROVAL — nothing here has been actioned. Approve for execution: __________________  Name / Date (simulated)</div>
            </section>

            {/* ── 5. How this decision was made ───────────────────── */}
            <section className="report-section">
              <h2 className="report-h">5 · How this decision was made</h2>
              <div className="report-prov-box">{PROVENANCE_STATEMENT}</div>
              <div className="report-lanes">
                <div className="report-lane"><div className="rl-who">AI</div><div className="rl-what">Read the situation and flagged rule gaps. <b>Advisory — set no score.</b></div></div>
                <div className="report-lane"><div className="rl-who">Deterministic engine</div><div className="rl-what">The zero-LLM critic raised every objection; the severity-lattice arbiter ruled.</div></div>
                <div className="report-lane"><div className="rl-who">Human</div><div className="rl-what">Must approve before anything happens. <b>PENDING — not yet approved.</b></div></div>
              </div>
              <p className="report-fine">Lattice (reproducible by hand): any Hard-stop → BLOCKED; else any Condition → DEMOTED; else APPROVED. In one line: AI reads and flags; deterministic rules decide; a human approves.</p>
            </section>
          </>
        )}

        {/* ── Appendix A · tamper-evident audit trail ─────────────── */}
        <section className="report-section report-appendix">
          <h2 className="report-h">Appendix A · Tamper-evident audit trail <Seal verified={verified} /></h2>
          <p className="report-standing">
            Every step of this decision was written to a sealed logbook. Each entry carries a unique fingerprint, stamped
            over the previous entry&apos;s fingerprint, like a wax seal pressed across a stack of pages, so the pages lock
            together in order. Change any earlier entry, even by one character, and every later seal stops matching. A
            green <b>VERIFIED</b> badge means all the seals still line up. Anyone can re-run the same inputs offline and get the exact same fingerprints.
          </p>
          <div className="report-scroll">
            <table className="report-table report-audit-table">
              <thead><tr><th>#</th><th>When</th><th>Who</th><th>What</th><th>About</th><th>Fingerprint</th><th>Links to</th></tr></thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.seq} title={`output ${e.output_hash}\ninput ${e.input_hash}`}>
                    <td className="rt-num">{e.seq}</td>
                    <td>{fmtTs(e.ts_sim)} <span className="report-dim">(sim)</span></td>
                    <td>{ACTOR_PLAIN[e.actor] ?? e.actor}</td>
                    <td>{ACTION_PLAIN[e.action] ?? e.action}</td>
                    <td>{(() => {
                      const labels = [...new Set(e.refs.map((r) => refLabel(r, optLabelById)))];
                      if (labels.length === 0) return <span className="report-dim">—</span>;
                      return labels.length <= 3 ? labels.join(', ') : `${labels.length} options`;
                    })()}</td>
                    <td className="rep-hash">{e.output_hash.slice(0, 8)}</td>
                    <td className="rep-hash">{e.prev_hash === 'GENESIS' ? 'START' : e.prev_hash.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="report-fine">
            Each row&apos;s <b>Links to</b> equals the row above&apos;s <b>Fingerprint</b>; seq 0 anchors to START (GENESIS).
            Alter any earlier row and its fingerprint changes, breaking every row after it and flipping the seal to CHAIN BROKEN.
            (Full 64-character hashes are on hover.) Verify it yourself: each fingerprint is SHA-256 over the canonical JSON of
            that step; re-run the same replay offline and every fingerprint reproduces byte-for-byte — <span className="rep-fn">npm run check</span> replays twice and compares.
          </p>
          <p className="report-caveat">
            A verified chain proves no step was altered or reordered after the fact. It does <b>not</b> certify the input
            figures are real; the R/E/S chips carry that. Chain status: __________ · Verified by: __________ · Date (simulated): __________
          </p>
        </section>

        {/* ── Appendix B · rulebook & data lineage ────────────────── */}
        <section className="report-section report-appendix">
          <h2 className="report-h">Appendix B · The rulebook in force</h2>
          <div className="report-scroll">
            <table className="report-table">
              <thead><tr><th>Article</th><th>Title</th><th>Threshold</th><th>What it means</th></tr></thead>
              <tbody>
                {charter.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.id}</b></td>
                    <td>{a.title}</td>
                    <td className="rep-fn">{a.param_key ? `${a.param_key} = ${a.param_value}` : '—'}</td>
                    <td>{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="report-fine">
            <b>Provenance:</b> <Chip p="R" /> Real-sourced · <Chip p="E" /> Estimated · <Chip p="S" /> Synthetic / demo.
            Synthetic data is never relabeled real. Structural knowledge cites pre-2019 sources; live-feed data is kept
            separate and never mixed. The two tunable floors above (A2 min days of cover, A3 concentration cap) show their
            current values, and a human can change them, which re-decides the plan.
          </p>
        </section>

        <footer className="report-foot no-print">
          <button className="report-print-btn" onClick={printReport}>⎙ Save as PDF</button>
          <button className="report-close-btn" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────
const LEVER_TYPE: Record<string, string> = {
  reroute: 'reroute', divert_on_water: 'divert on-water', stock_draw: 'reserve draw',
  floating_storage: 'floating storage', demand_side: 'demand cut',
};
const leverType = (l: string): string => LEVER_TYPE[l] ?? prettify(l);

const PAYMENT_PLAIN: Record<string, string> = { GREEN: 'Payment cleared', AMBER: 'Payment needs clearance', RED: 'Payment blocked' };

/** Humanise a pure-function name for display, e.g. 'voyageVsBufferValidator' → 'voyage vs buffer check'.
    Render-only; the engine string (ob.validator) is unchanged. */
const validatorPlain = (v: string): string =>
  `${v.replace(/Validator$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()} check`;

/** Collapse exact-duplicate (label, status) option rows to a ×N count (as OptionCards does). */
function dedupeOptions(options: OptionCard[]): { o: OptionCard; count: number }[] {
  const rank: Record<string, number> = { validated: 0, conditional: 1, proposed: 2, rejected: 3 };
  const sorted = [...options].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.id.localeCompare(b.id));
  const out: { o: OptionCard; count: number }[] = [];
  const seen = new Map<string, number>();
  for (const o of sorted) {
    const key = `${optionLabel(o)}|${o.status}`;
    const idx = seen.get(key);
    if (idx === undefined) { seen.set(key, out.length); out.push({ o, count: 1 }); } else { out[idx].count += 1; }
  }
  return out;
}

/** WHY ordering: blocked first, then demoted; within a group, most hard-stops first. */
function orderWhy(rejected: OptionCard[], conditional: OptionCard[], blockCount: (id: string) => number): OptionCard[] {
  const byBlocks = (a: OptionCard, b: OptionCard) => blockCount(b.id) - blockCount(a.id) || a.id.localeCompare(b.id);
  return [...[...rejected].sort(byBlocks), ...[...conditional].sort(byBlocks)];
}
