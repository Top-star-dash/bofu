"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ImageField from "./ImageField";

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
  mapUrl: string;
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

const STATUS_OPTIONS = [
  { value: "RUNNING", label: "进行中（按起止时间）" },
  { value: "DRAFT", label: "草稿（H5 不开放）" },
  { value: "NOT_STARTED", label: "未开始" },
  { value: "ENDED", label: "已结束" },
];

function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ActivitySettings({ initial }: { initial: ActivityFormData }) {
  const router = useRouter();
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
      const response = await fetch("/api/admin/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
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
    <form className="admin-form admin-form-wide" onSubmit={submit}>
      <h3>基础信息</h3>
      <label>
        活动标题（可含 HTML）
        <textarea
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
          rows={2}
          required
        />
      </label>
      <label>
        副标题
        <input
          value={form.subtitle}
          onChange={(event) => set("subtitle", event.target.value)}
        />
      </label>
      <div className="admin-field-row">
        <label>
          活动状态
          <select
            value={form.status}
            onChange={(event) => set("status", event.target.value)}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          开始时间
          <input
            type="datetime-local"
            value={toLocalInput(form.startAt)}
            onChange={(event) => set("startAt", event.target.value)}
            required
          />
        </label>
        <label>
          结束时间
          <input
            type="datetime-local"
            value={toLocalInput(form.endAt)}
            onChange={(event) => set("endAt", event.target.value)}
            required
          />
        </label>
        <label>
          兑奖截止
          <input
            type="datetime-local"
            value={toLocalInput(form.redeemDeadline)}
            onChange={(event) => set("redeemDeadline", event.target.value)}
            required
          />
        </label>
      </div>

      <h3>联系与地址</h3>
      <div className="admin-field-row">
        <label>
          咨询热线
          <input
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
          />
        </label>
        <label>
          领奖地址
          <input
            value={form.address}
            onChange={(event) => set("address", event.target.value)}
          />
        </label>
      </div>
      <label>
        地图导航链接（留空则 H5 显示「导航请咨询顾问」）
        <input
          value={form.mapUrl}
          onChange={(event) => set("mapUrl", event.target.value)}
          placeholder="https://uri.amap.com/..."
        />
      </label>
      <label>
        线上售楼部外链（留空则 H5 不显示入口）
        <input
          value={form.externalUrl}
          onChange={(event) => set("externalUrl", event.target.value)}
          placeholder="https://..."
        />
      </label>

      <h3>分享与素材</h3>
      <div className="admin-field-row">
        <label>
          分享标题
          <input
            value={form.shareTitle}
            onChange={(event) => set("shareTitle", event.target.value)}
          />
        </label>
        <label>
          分享摘要
          <input
            value={form.shareDesc}
            onChange={(event) => set("shareDesc", event.target.value)}
          />
        </label>
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
      <div className="admin-field-row">
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
      </div>

      <h3>规则文案</h3>
      <label>
        规则 HTML
        <textarea
          value={form.rulesHtml}
          onChange={(event) => set("rulesHtml", event.target.value)}
          rows={4}
        />
      </label>
      <label>
        规则文字颜色
        <input
          value={form.rulesColor}
          onChange={(event) => set("rulesColor", event.target.value)}
          placeholder="#fff1d5"
        />
      </label>

      <h3>抽奖与核销规则</h3>
      <div className="admin-field-row">
        <label>
          首次留资送次数
          <input
            type="number"
            min={0}
            value={form.firstDrawChance}
            onChange={(event) => setNumber("firstDrawChance", event.target.value)}
          />
        </label>
        <label>
          每次助力加次数
          <input
            type="number"
            min={0}
            value={form.assistChance}
            onChange={(event) => setNumber("assistChance", event.target.value)}
          />
        </label>
        <label>
          助力加分上限（人数）
          <input
            type="number"
            min={0}
            value={form.assistMaxExtra}
            onChange={(event) => setNumber("assistMaxExtra", event.target.value)}
          />
        </label>
        <label>
          每日上限（0 不限）
          <input
            type="number"
            min={0}
            value={form.dailyDrawLimit}
            onChange={(event) => setNumber("dailyDrawLimit", event.target.value)}
          />
        </label>
        <label>
          活动期总上限（0 不限）
          <input
            type="number"
            min={0}
            value={form.totalDrawLimit}
            onChange={(event) => setNumber("totalDrawLimit", event.target.value)}
          />
        </label>
        <label>
          核销密码
          <input
            value={form.redeemPassword}
            onChange={(event) => set("redeemPassword", event.target.value)}
            minLength={4}
            required
          />
        </label>
      </div>

      <h3>线索分层阈值</h3>
      <div className="admin-field-row">
        <label>
          A 类停留秒数
          <input
            type="number"
            min={0}
            value={form.tierAStaySec}
            onChange={(event) => setNumber("tierAStaySec", event.target.value)}
          />
        </label>
        <label>
          B 类停留秒数
          <input
            type="number"
            min={0}
            value={form.tierBStaySec}
            onChange={(event) => setNumber("tierBStaySec", event.target.value)}
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}
      <div className="admin-actions">
        <button type="submit" disabled={busy}>
          {busy ? "保存中…" : "保存活动配置"}
        </button>
      </div>
    </form>
  );
}
