"use client";

import { ChangeEvent, useState } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
};

/** 图片字段：可粘贴地址，也可直接上传到 public/uploads */
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
    <div className="image-field">
      <span className="image-field-label">{label}</span>
      <div className="image-field-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={hint || "图片地址，或点击右侧上传"}
        />
        <label className="upload-btn">
          {busy ? "上传中…" : "上传"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={upload}
            hidden
          />
        </label>
      </div>
      {value ? <img className="image-thumb" src={value} alt="" /> : null}
      {error ? <em className="error-text">{error}</em> : null}
    </div>
  );
}
