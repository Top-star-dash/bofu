"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildRedeemAdminUrl } from "@/lib/redeem-code";

/** 客户待核销奖品：展示指向后台核销台的二维码 */
export default function RedeemQrCard({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
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
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!dataUrl) {
    return (
      <p className="redeem-tip">核销二维码生成中…</p>
    );
  }

  return (
    <div className="redeem-qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="核销二维码" />
      <small>到店出示此码，由工作人员扫码核销</small>
    </div>
  );
}
