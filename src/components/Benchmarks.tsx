import { useState } from 'react';
import type { AppData } from '../lib/useData';
import { BENCH_NOTE, benchList, bottleneck, type Kind, type Res } from '../lib/bench';

const remember = (k: string, fallback: string) => {
  try {
    return sessionStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (k: string, v: string) => {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

function BottleneckChecker() {
  const cpus = [...benchList('cpu')].sort((a, b) => b.score - a.score);
  const gpus = [...benchList('gpu')].sort((a, b) => b.score - a.score);
  const [cpu, setCpu] = useState(() => remember('hwt-bn-cpu', 'Ryzen 7 7800X3D'));
  const [gpu, setGpu] = useState(() => remember('hwt-bn-gpu', 'GeForce RTX 5070'));
  const [res, setRes] = useState<Res>(() => remember('hwt-bn-res', '1440p') as Res);
  const c = cpus.find((x) => x.name === cpu) ?? cpus[0];
  const g = gpus.find((x) => x.name === gpu) ?? gpus[0];
  const r = bottleneck(c, g, res);
  const max = Math.max(r.cpuFps, r.gpuFps);
  const cls = r.limit === 'cpu' ? (r.loss >= 25 ? 'v-bad' : 'v-fair') : 'v-good';
  const title = r.limit === 'cpu' ? `CPU bottleneck (about ${r.loss}% lost)` : r.limit === 'gpu' ? 'No bottleneck: the graphics card sets the pace' : 'Balanced pair';

  return (
    <div className="card bn">
      <h3>Bottleneck checker</h3>
      <p className="muted small">Pick your processor, graphics card and screen resolution to see which part limits your frame rate in games.</p>
      <div className="bn-form">
        <label>
          <span className="muted small">Processor</span>
          <select className="select" value={c.name} onChange={(e) => (setCpu(e.target.value), store('hwt-bn-cpu', e.target.value))}>
            {cpus.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted small">Graphics card</span>
          <select className="select" value={g.name} onChange={(e) => (setGpu(e.target.value), store('hwt-bn-gpu', e.target.value))}>
            {gpus.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="muted small">Resolution</span>
          <div className="seg">
            {(['1080p', '1440p', '4K'] as Res[]).map((x) => (
              <button key={x} className={res === x ? 'seg-btn on' : 'seg-btn'} onClick={() => (setRes(x), store('hwt-bn-res', x))}>
                {x}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`deal-result bn-result ${cls}`}>
        <div className="deal-verdict">{title}</div>
        <div className="bn-bars">
          <div className="bn-line">
            <span>Processor can feed</span>
            <div className="bench-bar">
              <div className={r.limit === 'cpu' ? 'lim' : ''} style={{ width: `${(r.cpuFps / max) * 100}%` }} />
            </div>
            <b>{r.cpuFps} fps</b>
          </div>
          <div className="bn-line">
            <span>Graphics card can draw</span>
            <div className="bench-bar">
              <div className={r.limit !== 'cpu' ? 'lim' : ''} style={{ width: `${(r.gpuFps / max) * 100}%` }} />
            </div>
            <b>{r.gpuFps} fps</b>
          </div>
        </div>
        <p>{r.text}</p>
        <p className="muted small">You get about {r.fps} fps on average in modern games at high settings. Esports titles run much faster, and the heaviest new games slower.</p>
      </div>
    </div>
  );
}

export function Benchmarks({ data: _data }: { data: AppData }) {
  const [kind, setKind] = useState<Kind>(() => remember('hwt-bench-kind', 'gpu') as Kind);
  const [q, setQ] = useState('');
  const [maker, setMaker] = useState('all');
  const list = [...benchList(kind)].sort((a, b) => b.score - a.score);
  const makers = [...new Set(list.map((b) => b.maker))];
  const rows = list.filter((b) => (maker === 'all' || b.maker === maker) && q.toLowerCase().split(/\s+/).every((w) => b.name.toLowerCase().includes(w)));
  const top = list[0]?.score ?? 100;

  return (
    <div className="page">
      <div className="section-head">
        <h1>Benchmarks</h1>
        <span className="muted small">How fast graphics cards and processors are in games, and which part holds your PC back.</span>
      </div>
      <div className="bench">
      <BottleneckChecker />
      <div className="card">
        <h3>{kind === 'gpu' ? 'Graphics card' : 'Processor'} performance ranking</h3>
        <p className="muted small">
          {kind === 'gpu'
            ? 'Average gaming performance at 1440p, relative to the GeForce RTX 4090 (100).'
            : 'Average gaming performance, relative to the Ryzen 7 9800X3D (100).'}
        </p>
        <div className="deal-row">
          <div className="seg">
            {(
              [
                ['gpu', 'Graphics cards'],
                ['cpu', 'Processors'],
              ] as [Kind, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                className={kind === k ? 'seg-btn on' : 'seg-btn'}
                onClick={() => {
                  setKind(k);
                  setMaker('all');
                  store('hwt-bench-kind', k);
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <select className="select" value={maker} onChange={(e) => setMaker(e.target.value)}>
            <option value="all">All makers</option>
            {makers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input className="search used-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="bench-list">
          {rows.map((b) => (
            <div key={b.name} className="bench-row">
              <div className="bench-name">
                <strong>{b.name}</strong>
                <span className="muted small">
                  {b.year}
                  {b.vram ? ` · ${b.vram} GB` : ''}
                  {b.cores ? ` · ${b.cores} cores${b.threads ? ` / ${b.threads} threads` : ''}` : ''}
                </span>
              </div>
              <div className="bench-bar">
                <div className={`mk-${b.maker.toLowerCase()}`} style={{ width: `${(b.score / top) * 100}%` }} />
              </div>
              <b className="bench-score">{b.score}</b>
            </div>
          ))}
          {!rows.length && <p className="muted">Nothing matches.</p>}
        </div>
      </div>
      <p className="muted small">{BENCH_NOTE}</p>
      </div>
    </div>
  );
}
