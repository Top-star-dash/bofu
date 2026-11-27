"use client";

import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { buildRedeemAdminUrl } from "@/lib/redeem-code";

/** 待核销二维码面板；展开由外层「去核销」按钮控制 */
export default function RedeemQrCard({
  code,
  open,
  children,
}: {
  code: string;
  open: boolean;
  children?: ReactNode;
}) {
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

  if (!open) return null;

  return (
    <div className="redeem-qr is-open">
      {failed ? (
        <p className="redeem-tip">二维码生成失败，请出示核销码</p>
      ) : !dataUrl ? (
        <p className="redeem-tip">核销二维码生成中…</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="核销二维码" />
      )}
      {children}
    </div>
  );
}
