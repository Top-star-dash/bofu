"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildRedeemAdminUrl } from "@/lib/redeem-code";

/** 客户待核销奖品：默认收起，点击后展开指向后台核销台的二维码 */
export default function RedeemQrCard({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || dataUrl || failed) return;
    let cancelled = false;
    const link = buildRedeemAdminUrl(window.location.origin, code);
    void QRCode.toDataURL(link, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, code, dataUrl, failed]);

  return (
    <div className={`redeem-qr${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="redeem-qr-toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "收起核销二维码" : "出示核销二维码"}
      </button>
      {open ? (
        failed ? (
          <p className="redeem-tip">二维码生成失败，请出示核销码</p>
        ) : !dataUrl ? (
          <p className="redeem-tip">核销二维码生成中…</p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="核销二维码" />
            <small>到店出示此码，由工作人员扫码核销</small>
          </>
        )
      ) : null}
    </div>
  );
}
