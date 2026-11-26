"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./GiftDrawAnimation.css";

type Props = {
  /** true 时播放一次；false 时不挂载任何 DOM */
  open: boolean;
  /** 动画完整结束后调用，父组件在此打开结果弹窗 */
  onComplete: () => void;
};

type Phase = "enter" | "shake" | "open";

/** 时序与独立原型一致，便于后续统一调整 */
const DURATION = { enter: 460, shake: 1350, open: 850 };
const REDUCED_DURATION = 20;

const CONFETTI_COLORS = ["#ffd16b", "#ff8a5d", "#fff2db", "#d93222", "#ffe6a6"];

/** 固定粒子序列：避免 SSR / 首屏 hydration 时随机数不一致 */
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  x: `${((i * 37) % 420) - 210}px`,
  y: `${((i * 53) % 300) - 80}px`,
  rot: `${((i * 97) % 720) - 360}deg`,
  dur: `${(0.9 + (i % 6) * 0.1).toFixed(2)}s`,
  delay: `${((i % 5) * 0.03).toFixed(2)}s`,
}));

const BEAMS = Array.from({ length: 10 }, (_, i) => i);

/**
 * 抽奖礼盒动画：入场 → 摇晃 → 开盒（金光 / 彩纸 / 通用小礼盒浮出）。
 * 不接收也不展示抽奖结果，结果由父组件在 onComplete 后弹窗展示。
 */
export default function GiftDrawAnimation({ open, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("enter");
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!open) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const enter = reduce ? REDUCED_DURATION : DURATION.enter;
    const shake = reduce ? REDUCED_DURATION : DURATION.shake;
    const openMs = reduce ? REDUCED_DURATION : DURATION.open;

    // 父组件按需挂载，phase 天然从 enter 开始
    const t1 = window.setTimeout(() => setPhase("shake"), enter);
    const t2 = window.setTimeout(() => setPhase("open"), enter + shake);
    const t3 = window.setTimeout(
      () => onCompleteRef.current(),
      enter + shake + openMs,
    );

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [open]);

  if (!open) return null;

  const tip =
    phase === "open"
      ? "惊喜揭晓！"
      : phase === "shake"
        ? "正在为你开启惊喜…"
        : "惊喜即将开启…";

  return (
    <div
      className="gift-anim-overlay"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label="抽奖动画"
    >
      <div className="gift-anim-stage">
        <p className="gift-anim-tip" role="status">
          {tip}
        </p>

        <div className="gift-anim-box" aria-hidden="true">
          <span className="gift-anim-glow" />

          <span className="gift-anim-beam">
            {BEAMS.map((i) => (
              <i
                key={i}
                style={
                  { "--a": `${i * 36}deg`, "--d": i } as CSSProperties
                }
              />
            ))}
          </span>

          <span className="gift-anim-body">
            <span className="gift-anim-ribbon" />
            <span className="gift-anim-inner-light" />
          </span>

          <span className="gift-anim-lid-group">
            <span className="gift-anim-lid" />
            <span className="gift-anim-bow">
              <i />
              <i />
              <b />
            </span>
          </span>

          <span className="gift-anim-mini">
            <span className="gift-anim-mini-body" />
            <span className="gift-anim-mini-lid" />
            <span className="gift-anim-mini-bow">
              <i />
              <i />
              <b />
            </span>
          </span>

          <span className="gift-anim-confetti">
            {CONFETTI.map((piece, i) => (
              <i
                key={i}
                style={
                  {
                    "--c": piece.color,
                    "--x": piece.x,
                    "--y": piece.y,
                    "--rot": piece.rot,
                    "--dur": piece.dur,
                    "--delay": piece.delay,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
