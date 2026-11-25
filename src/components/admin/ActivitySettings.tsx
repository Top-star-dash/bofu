"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import ImageField from "./ImageField";
import NoticeManager from "./NoticeManager";

export type MapLinkFormItem = { name: string; url: string };

export type ActivityFormData = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  startAt: string;
  endAt: string;
  redeemDeadline: string;
  phone: string;
  address: string;
  mapLinks: MapLinkFormItem[];
  externalUrl: string;
  shareTitle: string;
  shareDesc: string;
  shareCoverUrl: string;
  posterUrl: string;
  backgroundUrl: string;
  wheelImageUrl: string;
  logoUrl: string;
  logoSubUrl: string;
  rulesHtml: string;
  rulesColor: string;
  redeemPassword: string;
  firstDrawChance: number;
  assistChance: number;
  assistMaxExtra: number;
  dailyDrawLimit: number;
  totalDrawLimit: number;
  tierAStaySec: number;
  tierBStaySec: number;
};

export type ActivityNotice = {
  id: string;
  content: string;
  sortOrder: number;
  enabled: boolean;
};

type TabKey = "basic" | "share" | "draw" | "rules" | "notice";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "basic", label: "基础信息" },
  { key: "share", label: "分享与素材" },
  { key: "draw", label: "抽奖与分层" },
  { key: "rules", label: "规则文案" },
  { key: "notice", label: "活动公告" },
];

const STATUS_OPTIONS = [
  { value: "RUNNING", label: "进行中（按起止时间）" },
  { value: "DRAFT", label: "草稿（H5 不开放）" },
  { value: "NOT_STARTED", label: "未开始" },
  { value: "ENDED", label: "已结束" },
];

const inputCls =
  "w-full rounded-lg border border-[#e4c69f] bg-[#fffaf3] px-3 py-2 text-[13px] font-normal";
const row2 = "grid grid-cols-1 gap-3 md:grid-cols-2";
const row4 = "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-bold text-[#5a241a]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ActivitySettings({
  initial,
  notices,
}: {
  initial: ActivityFormData;
  notices: ActivityNotice[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("basic");
  const [form, setForm] = useState<ActivityFormData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function set<K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setNumber(key: keyof ActivityFormData, value: string) {
    const parsed = Number.parseInt(value || "0", 10);
    set(key, Number.isFinite(parsed) ? parsed : 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const mapLinks = form.mapLinks
        .map((item) => ({
          name: item.name.trim(),
          url: item.url.trim(),
        }))
        .filter((item) => item.name && item.url)
        .slice(0, 5);
      const response = await fetch("/api/admin/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mapLinks,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          redeemDeadline: new Date(form.redeemDeadline).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "保存失败");
        return;
      }
      setMessage("已保存，H5 刷新后生效");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 border-b border-[#ead7c2] pb-3">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
              tab === item.key
                ? "bg-[#b83224] text-white"
                : "bg-[#fff2df] text-[#8f281f] hover:bg-[#ffe6b8]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "notice" ? (
        <NoticeManager notices={notices} />
      ) : (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#f0e2d2] bg-white p-4 md:grid-cols-2">
          {tab === "basic" && (
            <>
              <Field label="活动标题（可含 HTML）">
                <textarea
                  className={`${inputCls} resize-y`}
                  value={form.title}
                  onChange={(event) => set("title", event.target.value)}
                  rows={2}
                  required
                />
              </Field>
              <Field label="副标题">
                <input
                  className={inputCls}
                  value={form.subtitle}
                  onChange={(event) => set("subtitle", event.target.value)}
                />
              </Field>
              <div className={`${row4} md:col-span-2`}>
                <Field label="活动状态">
                  <select
                    className={inputCls}
                    value={form.status}
                    onChange={(event) => set("status", event.target.value)}
                  >
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="开始时间">
                  <input
                    className={inputCls}
                    type="datetime-local"
                    value={toLocalInput(form.startAt)}
                    onChange={(event) => set("startAt", event.target.value)}
                    required
                  />
                </Field>
                <Field label="结束时间">
                  <input
                    className={inputCls}
                    type="datetime-local"
                    value={toLocalInput(form.endAt)}
                    onChange={(event) => set("endAt", event.target.value)}
                    required
                  />
                </Field>
                <Field label="兑奖截止">
                  <input
                    className={inputCls}
                    type="datetime-local"
                    value={toLocalInput(form.redeemDeadline)}
                    onChange={(event) => set("redeemDeadline", event.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className={`${row2} md:col-span-2`}>
                <Field label="咨询热线">
                  <input
                    className={inputCls}
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                  />
                </Field>
                <Field label="领奖地址">
                  <input
                    className={inputCls}
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-3 md:col-span-2">
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-bold text-[#5a241a]">
                    地图导航（可多条；留空则 H5 显示「导航请咨询顾问」）
                  </span>
                  {form.mapLinks.map((link, index) => (
                    <div
                      key={`map-${index}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-[#f0e2d2] bg-[#fffaf3] p-3 md:grid-cols-[140px_1fr_auto]"
                    >
                      <input
                        className={inputCls}
                        value={link.name}
                        maxLength={20}
                        placeholder={
                          index === 0
                            ? "高德地图"
                            : index === 1
                              ? "百度地图"
                              : "腾讯地图"
                        }
                        onChange={(event) => {
                          const next = [...form.mapLinks];
                          next[index] = { ...next[index], name: event.target.value };
                          set("mapLinks", next);
                        }}
                      />
                      <input
                        className={inputCls}
                        value={link.url}
                        placeholder="https://uri.amap.com/..."
                        onChange={(event) => {
                          const next = [...form.mapLinks];
                          next[index] = { ...next[index], url: event.target.value };
                          set("mapLinks", next);
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-[#e4c69f] px-3 py-2 text-[12px] font-bold text-[#8f281f] hover:bg-[#ffe6b8]"
                        onClick={() =>
                          set(
                            "mapLinks",
                            form.mapLinks.filter((_, i) => i !== index),
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={form.mapLinks.length >= 5}
                    className="w-fit rounded-lg bg-[#fff2df] px-3 py-2 text-[13px] font-bold text-[#8f281f] hover:bg-[#ffe6b8] disabled:opacity-50"
                    onClick={() =>
                      set("mapLinks", [...form.mapLinks, { name: "", url: "" }])
                    }
                  >
                    添加地图
                  </button>
                </div>
                <Field label="线上售楼部外链（留空则 H5 不显示入口）">
                  <input
                    className={inputCls}
                    value={form.externalUrl}
                    onChange={(event) => set("externalUrl", event.target.value)}
                    placeholder="https://..."
                  />
                </Field>
              </div>
            </>
          )}

          {tab === "share" && (
            <>
              <div className={`${row2} md:col-span-2`}>
                <Field label="分享标题">
                  <input
                    className={inputCls}
                    value={form.shareTitle}
                    onChange={(event) => set("shareTitle", event.target.value)}
                  />
                </Field>
                <Field label="分享摘要">
                  <input
                    className={inputCls}
                    value={form.shareDesc}
                    onChange={(event) => set("shareDesc", event.target.value)}
                  />
                </Field>
              </div>
              <ImageField
                label="分享封面"
                value={form.shareCoverUrl}
                onChange={(value) => set("shareCoverUrl", value)}
              />
              <ImageField
                label="活动海报"
                value={form.posterUrl}
                onChange={(value) => set("posterUrl", value)}
              />
              <ImageField
                label="背景 KV"
                value={form.backgroundUrl}
                onChange={(value) => set("backgroundUrl", value)}
              />
              <ImageField
                label="转盘图"
                value={form.wheelImageUrl}
                onChange={(value) => set("wheelImageUrl", value)}
              />
              <ImageField
                label="顶栏主 Logo"
                value={form.logoUrl}
                onChange={(value) => set("logoUrl", value)}
              />
              <ImageField
                label="顶栏副 Logo"
                value={form.logoSubUrl}
                onChange={(value) => set("logoSubUrl", value)}
              />
            </>
          )}

          {tab === "draw" && (
            <>
              <div className={`${row4} md:col-span-2`}>
                <Field label="首次留资送次数">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.firstDrawChance}
                    onChange={(event) => setNumber("firstDrawChance", event.target.value)}
                  />
                </Field>
                <Field label="每次助力加次数">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.assistChance}
                    onChange={(event) => setNumber("assistChance", event.target.value)}
                  />
                </Field>
                <Field label="助力加分上限（人数）">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.assistMaxExtra}
                    onChange={(event) => setNumber("assistMaxExtra", event.target.value)}
                  />
                </Field>
                <Field label="每日上限（0 不限）">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.dailyDrawLimit}
                    onChange={(event) => setNumber("dailyDrawLimit", event.target.value)}
                  />
                </Field>
                <Field label="活动期总上限（0 不限）">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.totalDrawLimit}
                    onChange={(event) => setNumber("totalDrawLimit", event.target.value)}
                  />
                </Field>
                <Field label="核销密码">
                  <input
                    className={inputCls}
                    value={form.redeemPassword}
                    onChange={(event) => set("redeemPassword", event.target.value)}
                    minLength={4}
                    required
                  />
                </Field>
              </div>
              <div className={`${row2} md:col-span-2`}>
                <Field label="A 类停留秒数">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.tierAStaySec}
                    onChange={(event) => setNumber("tierAStaySec", event.target.value)}
                  />
                </Field>
                <Field label="B 类停留秒数">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={form.tierBStaySec}
                    onChange={(event) => setNumber("tierBStaySec", event.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {tab === "rules" && (
            <div className="flex flex-col gap-3 md:col-span-2">
              <Field label="规则 HTML">
                <textarea
                  className={`${inputCls} resize-y`}
                  value={form.rulesHtml}
                  onChange={(event) => set("rulesHtml", event.target.value)}
                  rows={8}
                />
              </Field>
              <Field label="规则文字颜色">
                <input
                  className={inputCls}
                  value={form.rulesColor}
                  onChange={(event) => set("rulesColor", event.target.value)}
                  placeholder="#fff1d5"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          {error && <p className="error-text">{error}</p>}
          {message && <p className="ok-text text-[13px] font-bold text-[#2f6b3a]">{message}</p>}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[#b83224] px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "保存中…" : "保存活动配置"}
        </button>
      </div>
    </form>
  );
}
