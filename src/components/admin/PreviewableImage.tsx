"use client";

import { useEffect, useState } from "react";
import { safeMediaUrl } from "@/lib/urls";

type LightboxProps = {
  src: string;
  title?: string;
  linkUrl?: string;
  onClose: () => void;
};

/** 后台通用大图预览：点遮罩或 Esc 关闭 */
export function AdminImageLightbox({
  src,
  title,
  linkUrl,
  onClose,
}: LightboxProps) {
  const url = safeMediaUrl(src) || src;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "图片预览"}
    >
      <div
        className="flex max-h-[92vh] max-w-[92vw] flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="max-h-[78vh] max-w-full rounded-lg bg-white object-contain"
          src={url}
          alt={title || "图片预览"}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-white">{title || "图片预览"}</span>
          <div className="flex gap-2">
            {linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-[#8f281f]"
              >
                打开链接
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#b83224] px-3 py-1.5 text-[13px] font-bold text-white"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type PreviewableImageProps = {
  src: string;
  alt?: string;
  title?: string;
  linkUrl?: string;
  className?: string;
  buttonClassName?: string;
};

/** 可点击放大的缩略图 */
export default function PreviewableImage({
  src,
  alt,
  title,
  linkUrl,
  className,
  buttonClassName,
}: PreviewableImageProps) {
  const [open, setOpen] = useState(false);
  const url = safeMediaUrl(src) || src;
  if (!src || !url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          "rounded border border-[#ead7c2] bg-white p-0.5"
        }
        title="点击放大预览"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={className || "h-14 w-14 rounded object-cover"}
          src={url}
          alt={alt || title || "缩略图"}
        />
      </button>
      {open ? (
        <AdminImageLightbox
          src={src}
          title={title || alt}
          linkUrl={linkUrl}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
