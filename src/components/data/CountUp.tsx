"use client";

import { memo, useEffect, useRef } from "react";
import { animate, useMotionValue } from "framer-motion";

/**
 * 數字 count-up。
 *
 * 效能關鍵：完全不使用 useState，動畫值透過 useMotionValue 在 React
 * render cycle 之外更新，直接寫入 DOM textContent。
 * memo 包裝確保父層 re-render 不會重啟動畫。
 */

type Props = {
  value: number;
  digits?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
};

function CountUpImpl({
  value,
  digits = 2,
  prefix = "",
  suffix = "",
  duration = 1.1,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const nf = new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

    // 尊重使用者的減少動態偏好
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      node.textContent = `${prefix}${nf.format(value)}${suffix}`;
      return;
    }

    const unsubscribe = mv.on("change", (v) => {
      node.textContent = `${prefix}${nf.format(v)}${suffix}`;
    });

    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, digits, prefix, suffix, duration, mv]);

  return (
    <span ref={ref} className={className}>
      {/* SSR 與無 JS 時的靜態內容 */}
      {`${prefix}${value.toFixed(digits)}${suffix}`}
    </span>
  );
}

export const CountUp = memo(CountUpImpl);
