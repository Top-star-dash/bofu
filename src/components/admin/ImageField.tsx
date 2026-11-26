"use client";

import { ChangeEvent, useState } from "react";
import PreviewableImage from "./PreviewableImage";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
};

/** 图片字段：可粘贴地址，也可直接上传到 public/uploads；缩略图可点击放大 */
export default function ImageField({ label, value, onChange, hint }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "上传失败");
        return;
      }
      onChange(data.url);
    } catch {
      setError("上传失败，请检查网络");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-bold text-[#5a241a]">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-[#e4c69f] bg-[#fffaf3] px-3 py-2 text-[13px]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={hint || "图片地址，或点击右侧上传"}
        />
        <label className="shrink-0 cursor-pointer rounded-lg bg-[#ffe6b8] px-3 py-2 text-[12px] font-bold text-[#8f281f]">
          {busy ? "上传中…" : "上传"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={upload}
            className="hidden"
          />
        </label>
      </div>
      {value ? (
        <PreviewableImage
          src={value}
          alt={label}
          title={label}
          className="h-16 w-16 rounded-lg object-cover"
        />
      ) : null}
      {error ? <em className="error-text">{error}</em> : null}
    </div>
  );
}
