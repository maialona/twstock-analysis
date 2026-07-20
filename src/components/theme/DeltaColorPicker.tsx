"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDeltaColors } from "@/lib/theme/useDeltaColors";
import { PRESETS, checkColors, type DeltaColors } from "@/lib/theme/delta-colors";
import { cn, formatPct, formatPrice } from "@/lib/format";

/**
 * 漲跌配色設定。
 *
 * 刻意不擋下低對比或難以區分的配色 —— 那是使用者的選擇。
 * 但一定要即時說明後果，因為「顏色看不清楚」在這個介面裡
 * 等同於「漲跌資訊消失」，而使用者不一定會馬上察覺。
 */

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block h-3 w-3 shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

/** 用真實的數字排版預覽，而不是色塊 —— 要判斷的是「這樣的數字看得清楚嗎」 */
function Preview({ colors }: { colors: DeltaColors }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2.5">
      {[
        { name: "台積電", id: "2330", price: 1085, pct: 1.36 },
        { name: "台塑", id: "1301", price: 42.8, pct: -2.06 },
      ].map((r) => (
        <div key={r.id} className="flex items-baseline gap-2 text-xs">
          <span className="num text-faint">{r.id}</span>
          <span className="text-muted">{r.name}</span>
          <span
            className="num ml-auto"
            style={{ color: r.pct > 0 ? colors.up : colors.down }}
          >
            {formatPrice(r.price, r.price >= 100 ? 1 : 2)}
          </span>
          <span
            className="num w-16 text-right"
            style={{ color: r.pct > 0 ? colors.up : colors.down }}
          >
            {formatPct(r.pct)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DeltaColorPicker() {
  const { colors, setColors, reset } = useDeltaColors();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Escape 關閉 + 點擊外部關閉
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const warnings = checkColors(colors);
  const activePreset = PRESETS.find(
    (p) => p.colors.up === colors.up && p.colors.down === colors.down,
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="漲跌配色設定"
        title="漲跌配色"
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1.5",
          "transition-colors duration-150 hover:border-border-strong active:scale-[0.97]",
        )}
      >
        <Swatch color={colors.up} />
        <Swatch color={colors.down} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="漲跌配色設定"
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] z-30 w-72 rounded border border-border",
            "bg-surface p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]",
          )}
        >
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xs font-medium text-text">漲跌配色</h2>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-faint">
                台股慣例為紅漲綠跌，與歐美市場相反。
              </p>
            </div>

            <div className="flex flex-col gap-1">
              {PRESETS.map((p) => {
                const active = activePreset?.name === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setColors(p.colors)}
                    aria-pressed={active}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs",
                      "transition-colors duration-150",
                      active ? "bg-raised text-text" : "text-muted hover:bg-raised/60",
                    )}
                  >
                    <Swatch color={p.colors.up} />
                    <Swatch color={p.colors.down} />
                    <span className="ml-1">{p.name}</span>
                    <span className="ml-auto text-faint">{p.note}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-2.5">
              {(
                [
                  ["up", "上漲"],
                  ["down", "下跌"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-8">{label}</span>
                  <input
                    type="color"
                    value={colors[key]}
                    onChange={(e) =>
                      setColors({ ...colors, [key]: e.target.value.toLowerCase() })
                    }
                    className="h-6 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    aria-label={`${label}顏色`}
                  />
                  <span className="num text-faint">{colors[key]}</span>
                </label>
              ))}
            </div>

            {warnings.length > 0 && (
              <ul className="flex flex-col gap-1.5 border-l-2 border-border-strong pl-2.5">
                {warnings.map((w) => (
                  <li
                    key={w.kind + w.message}
                    className="text-[0.6875rem] leading-relaxed text-muted"
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            )}

            <Preview colors={colors} />

            <button
              type="button"
              onClick={reset}
              className={cn(
                "w-fit cursor-pointer text-[0.6875rem] text-faint",
                "transition-colors duration-150 hover:text-muted",
              )}
            >
              回復台股預設
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
