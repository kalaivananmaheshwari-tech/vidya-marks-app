"use client";

import { classNames } from "@/lib/client";

export function ProgressBar({
  value,
  max = 100,
  color = "#4f46e5",
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={classNames("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export type BarItem = { label: string; value: number; sub?: string; color?: string };

export function BarList({ items, unit = "%", max }: { items: BarItem[]; unit?: string; max?: number }) {
  const top = max ?? Math.max(100, ...items.map((i) => i.value));
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-slate-400">No data to display yet.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="shrink-0 tabular-nums font-semibold text-slate-900">
              {item.value}
              {unit}
              {item.sub ? <span className="ml-2 text-xs font-normal text-slate-400">{item.sub}</span> : null}
            </span>
          </div>
          <ProgressBar value={item.value} max={top} color={item.color ?? "#4f46e5"} />
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({
  items,
  height = 200,
  unit = "%",
}: {
  items: BarItem[];
  height?: number;
  unit?: string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-slate-400">No data to display yet.</p>;
  }
  const max = Math.max(100, ...items.map((i) => i.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {items.map((item) => {
          const h = Math.max(4, (item.value / max) * (height - 28));
          return (
            <div key={item.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold tabular-nums text-slate-600 opacity-0 transition group-hover:opacity-100">
                {item.value}
                {unit}
              </span>
              <div
                className="w-full rounded-t-lg transition-all duration-700 ease-out"
                style={{
                  height: h,
                  background: item.color
                    ? item.color
                    : "linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)",
                }}
                title={`${item.label}: ${item.value}${unit}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 flex-1 text-center">
            <p className="truncate text-[11px] font-medium text-slate-500" title={item.label}>
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  size = 180,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={18}
          />
          {total > 0 &&
            segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={18}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${segment.label}: ${segment.value}`}</title>
                </circle>
              );
              offset += dash;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-bold text-slate-900">{centerValue ?? total}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{centerLabel ?? "total"}</p>
          </div>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="flex-1 truncate text-slate-600">{segment.label}</span>
            <span className="font-semibold tabular-nums text-slate-800">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  series,
  height = 220,
  unit = "%",
}: {
  series: Array<{ name: string; color: string; points: Array<{ label: string; value: number }> }>;
  height?: number;
  unit?: string;
}) {
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  if (!series.length || labels.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No trend data available yet.</p>;
  }
  const width = 600;
  const padX = 38;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const scaleY = (value: number) => padY + innerH - (Math.max(0, Math.min(100, value)) / 100) * innerH;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-auto w-full">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={padX}
              x2={width - padX / 2}
              y1={scaleY(tick)}
              y2={scaleY(tick)}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text x={4} y={scaleY(tick) + 4} fontSize="10" fill="#94a3b8">
              {tick}
              {unit}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${padX + i * stepX} ${scaleY(p.value)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" className="animate-draw" />
              {s.points.map((p, i) => (
                <g key={`${s.name}-${p.label}`}>
                  <circle cx={padX + i * stepX} cy={scaleY(p.value)} r={4} fill="#fff" stroke={s.color} strokeWidth={2.5}>
                    <title>{`${s.name} · ${p.label}: ${p.value}${unit}`}</title>
                  </circle>
                </g>
              ))}
            </g>
          );
        })}
        {labels.map((label, i) => (
          <text
            key={label}
            x={padX + i * stepX}
            y={height + 12}
            fontSize="11"
            fill="#64748b"
            textAnchor="middle"
          >
            {label.length > 16 ? `${label.slice(0, 15)}…` : label}
          </text>
        ))}
      </svg>
      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
