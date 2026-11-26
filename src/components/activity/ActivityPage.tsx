"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivityClient,
  CustomerClient,
  ModalKind,
  PrizeRecordClient,
} from "./types";
import WechatShare from "./WechatShare";
import { useStayTracking } from "./useStayTracking";
import { safeHttpUrl, safeMediaUrl } from "@/lib/urls";

type Props = {
  shareCode?: string;
  inviterId?: string;
  /** 生产环境且无微信会话：可浏览，抽奖/留资前需授权 */
  authRequired?: boolean;
  /** 授权失败原因（unconfigured / browser / denied / state / exchange / activity） */
  authErrorReason?: string | null;
  inWechat?: boolean;
};

const REDEEM_LABELS: Record<string, string> = {
  PENDING: "待核销",
  REDEEMED: "已核销",
  EXPIRED: "已失效",
};

const AUTH_ERROR_TEXT: Record<string, string> = {
  unconfigured: "公众号授权未配置，请联系运营人员",
  browser: "请使用微信打开本活动页面",
  denied: "已取消微信授权",
  state: "授权状态已过期，请重新授权",
  exchange: "微信授权失败，请重新授权",
  activity: "活动未配置，暂时无法授权",
  unknown: "授权失败，请重新授权",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function ActivityPage({
  shareCode,
  inviterId,
  authRequired = false,
  authErrorReason = null,
  inWechat = false,
}: Props) {
  const [activity, setActivity] = useState<ActivityClient | null>(null);
  const [customer, setCustomer] = useState<CustomerClient | null>(null);
  const [notice, setNotice] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);
  const [poster, setPoster] = useState(true);
  const [posterSeconds, setPosterSeconds] = useState(5);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; type: "error" | "info" } | null>(
    () =>
      authErrorReason
        ? { text: AUTH_ERROR_TEXT[authErrorReason] || AUTH_ERROR_TEXT.unknown, type: "info" }
        : null,
  );
  const [drawing, setDrawing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<string | null>(null);
  const [redeemPassword, setRedeemPassword] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [prizeTab, setPrizeTab] = useState<"PENDING" | "REDEEMED" | "EXPIRED" | "NO_WIN">("PENDING");
  const [lastDraw, setLastDraw] = useState<PrizeRecordClient | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const posterRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDialogElement>(null);

  const prizeRecords = customer?.prizes ?? [];
  const prizeTabs = [
    { key: "PENDING", label: "待核销" },
    { key: "REDEEMED", label: "已核销" },
    { key: "EXPIRED", label: "已失效" },
    { key: "NO_WIN", label: "未中奖" },
  ] as const;
  function countPrizeTab(key: (typeof prizeTabs)[number]["key"]) {
    return prizeRecords.filter((item) =>
      key === "NO_WIN" ? !item.isWin : item.isWin && item.redeemStatus === key,
    ).length;
  }
  const visiblePrizes = prizeRecords.filter((item) =>
    prizeTab === "NO_WIN"
      ? !item.isWin
      : item.isWin && item.redeemStatus === prizeTab,
  );

  function showToast(text: string, type: "error" | "info" = "error") {
    setToast({ text, type });
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      try {
        const response = await fetch("/api/session/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareCode, inviterId }),
        });
        // 服务重启 / 反代 502 等场景会返回空 body，json() 会抛 "Unexpected end of JSON input"
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok) {
          setActivity(data.activity);
          setCustomer(data.customer);
        } else {
          showToast(data.message || "活动加载失败");
        }
      } catch {
        if (!cancelled) showToast("网络异常，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [shareCode, inviterId]);

  useEffect(() => {
    if (!activity?.notices.length) return;
    const timer = window.setInterval(() => {
      setNotice((value) => (value + 1) % activity.notices.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [activity]);

  useEffect(() => {
    if (!modal) return;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) dialog.showModal();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [modal]);

  useEffect(() => {
    if (!imagePreview) return;
    const frame = window.requestAnimationFrame(() => {
      const dialog = previewRef.current;
      if (dialog && !dialog.open) dialog.showModal();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [imagePreview]);

  useEffect(() => {
    if (!poster || !activity) return;
    const frame = window.requestAnimationFrame(() => {
      const dialog = posterRef.current;
      if (dialog && !dialog.open) dialog.showModal();
    });
    const tick = window.setInterval(() => {
      setPosterSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    const timer = window.setTimeout(() => {
      setPoster(false);
    }, 5000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, [poster, activity]);

  function wechatAuthHref() {
    const query = new URLSearchParams({ r: "/" });
    if (shareCode) query.set("c", shareCode);
    if (inviterId) query.set("i", inviterId);
    return `/api/auth/wechat/start?${query.toString()}`;
  }

  /** 未授权可浏览；抽奖/留资/看奖品需身份 */
  function openPrizes() {
    // 每次打开都回到「待核销」，避免停留在上次的状态 Tab
    setPrizeTab("PENDING");
    setModal("prizes");
  }

  function requireAuth(next?: Exclude<ModalKind, "auth" | null>) {
    if (customer) {
      if (next === "prizes") openPrizes();
      else if (next) setModal(next);
      return true;
    }
    setModal("auth");
    return false;
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer) {
      setModal("auth");
      return;
    }
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        intentLayout: form.get("intentLayout") || undefined,
        visitDate: form.get("visitDate") || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.code === "NEED_AUTH") {
        setModal("auth");
        return;
      }
      showToast(data.message || "留资失败");
      return;
    }
    setCustomer((prev) =>
      prev
        ? { ...prev, hasLead: true, drawChance: data.drawChance }
        : prev,
    );
    setModal(null);
    showToast("留资成功，已获得抽奖机会", "info");
  }

  async function draw() {
    if (!activity || drawing) return;
    if (activity.status !== "RUNNING") {
      showToast("活动未开始或已结束");
      return;
    }
    if (!customer) {
      setModal("auth");
      return;
    }
    if (!customer.hasLead) {
      setModal("lead");
      return;
    }
    if (!customer.drawChance) {
      setModal("help");
      return;
    }

    setDrawing(true);

    let data: {
      message?: string;
      code?: string;
      drawChance?: number;
      result?: {
        id: string;
        prizeName: string;
        prizeLevel: string;
        isWin: boolean;
        redeemStatus: string;
        redeemCode: string;
      };
    } | null = null;
    let ok = false;

    try {
      const response = await fetch("/api/draw", { method: "POST" });
      data = await response.json();
      ok = response.ok;
    } catch {
      data = { message: "网络异常，请稍后重试" };
    }

    setDrawing(false);

    if (!ok || !data?.result) {
      if (data?.code === "NEED_AUTH") setModal("auth");
      else if (data?.code === "NEED_LEAD") setModal("lead");
      else if (data?.code === "NO_CHANCE") setModal("help");
      else showToast(data?.message || "抽奖失败");
      return;
    }

    const result = data.result;
    const record: PrizeRecordClient = {
      id: result.id,
      prizeName: result.prizeName,
      prizeLevel: result.prizeLevel,
      isWin: result.isWin,
      redeemStatus: result.redeemStatus,
      createdAt: new Date().toISOString(),
      redeemCode: result.redeemCode,
    };
    setLastDraw(record);
    setCustomer((prev) =>
      prev
        ? {
            ...prev,
            drawChance: data.drawChance ?? prev.drawChance,
            prizes: [record, ...prev.prizes],
          }
        : prev,
    );
    setModal("drawResult");
  }

  async function copyRedeemCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      showToast("核销码已复制", "info");
    } catch {
      showToast(`核销码：${code}`, "info");
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!shareCopied) return;
    const timer = window.setTimeout(() => setShareCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [shareCopied]);

  // G.4：客户身份就绪后开始统计板块停留
  useStayTracking(Boolean(customer));

  // C.2.1：助力链接带邀请人 id 与顾问分享码
  const shareUrl = useMemo(() => {
    if (!customer || typeof window === "undefined") return "";
    const query = new URLSearchParams({ i: customer.id });
    const code = activity?.consultant?.shareCode;
    if (code) query.set("c", code);
    return `${window.location.origin}/?${query.toString()}`;
  }, [customer, activity?.consultant?.shareCode]);

  async function copyShareLink() {
    if (!customer) {
      setModal("auth");
      return;
    }
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      showToast("助力链接已复制，发给好友即可", "info");
    } catch {
      showToast(`复制失败，请长按选择：${shareUrl}`);
    }
  }

  /** C.6.1 客户手机现场核销：由工作人员输入核销密码 */
  async function submitRedeem(code: string) {
    if (!redeemPassword.trim()) {
      setRedeemError("请输入核销密码");
      return;
    }
    setRedeemBusy(true);
    setRedeemError("");
    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeemCode: code, password: redeemPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRedeemError(data.message || "核销失败");
        return;
      }
      const nextStatus = data.redeemStatus || "REDEEMED";
      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              prizes: prev.prizes.map((item) =>
                item.redeemCode === code
                  ? { ...item, redeemStatus: nextStatus }
                  : item,
              ),
            }
          : prev,
      );
      setLastDraw((prev) =>
        prev && prev.redeemCode === code
          ? { ...prev, redeemStatus: nextStatus }
          : prev,
      );
      setRedeemTarget(null);
      setRedeemPassword("");
      showToast("核销成功，请向工作人员领取礼品", "info");
    } catch {
      setRedeemError("网络异常，请稍后重试");
    } finally {
      setRedeemBusy(false);
    }
  }

  if (loading) {
    return <main className="activity-page loading-page">活动加载中…</main>;
  }

  if (!activity) {
    return (
      <main className="activity-page loading-page">
        {toast?.text || "活动未配置"}
      </main>
    );
  }

  const consultant = activity.consultant;
  const firstPrize = activity.prizes[0];
  const otherPrizes = activity.prizes.slice(1);
  const tel = `tel:${activity.phone.replace(/-/g, "")}`;
  const mapLinks = (activity.mapLinks || []).filter(
    (item) => item.name.trim() && safeHttpUrl(item.url),
  );
  const externalUrl = safeHttpUrl(activity.externalUrl);
  const logoUrl = safeMediaUrl(activity.logoUrl) || "/activity/logo-future.webp";
  const logoSubUrl =
    safeMediaUrl(activity.logoSubUrl) || "/activity/logo-fumei-big.webp";
  const wheelUrl =
    safeMediaUrl(activity.wheelImageUrl) || "/activity/大圆盘2.webp";
  const posterUrl = safeMediaUrl(activity.posterUrl) || "/activity/kv-popup.webp";
  const backgroundUrl = safeMediaUrl(activity.backgroundUrl);
  const shareTitle =
    activity.shareTitle ||
    activity.title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  // 封面统一用 WebP（public 下已不保留 jpg/png 原图）
  const shareCover =
    safeMediaUrl(activity.shareCoverUrl) ||
    safeMediaUrl(activity.posterUrl) ||
    "/activity/kv-popup.webp";
  // 公告放大成主标题后，副标题若与公告文案重复就隐藏，避免同一句话出现两次
  const subtitleText = activity.subtitle
    ? activity.subtitle.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : "";
  const showSubtitle =
    Boolean(subtitleText) &&
    !activity.notices.some(
      (item) => item.replace(/\s+/g, " ").trim() === subtitleText,
    );

  return (
    // 内容区域
    <main className="activity-page">
      {inWechat && activity ? (
        <WechatShare
          enabled
          link={shareUrl}
          title={shareTitle}
          desc={activity.shareDesc || "参与线上抽奖，丰厚惊喜好礼等你来解锁"}
          cover={shareCover}
        />
      ) : null}
      {/* 背景图片 */}
      <div
        className="page-background"
        style={
          backgroundUrl
            ? { backgroundImage: `url('${backgroundUrl}')` }
            : undefined
        }
        aria-hidden="true"
      />
      {/* 顶部区域：存放 logo，功能按钮 */}
      <header className="page-top">
        <div className="brand-area">
          <div className="logo-line">
            <img src={logoUrl} alt="未来社区" />
            <img src={logoSubUrl} alt="博富·福美城" />
          </div>
          <div className="action-line">
            <button type="button" onClick={() => requireAuth("prizes")}>
              我的奖品
            </button>
            <button type="button" onClick={() => setModal("rules")}>
              规则详情
            </button>
          </div>
        </div>
      </header>
      {/* 内容滚动区域 */}
      <div className="page-scroll">
      <section className="main-content" aria-labelledby="activity-title">
        {/* 活动公告：主视觉大字轮播，文案用回车分成两行 */}
        {activity.notices.length > 0 && (
          <div className="notice" aria-live="polite">
            <p className="notice-text" key={notice}>
              {activity.notices[notice]}
            </p>
            <div className="notice-dots">
              {activity.notices.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`公告 ${index + 1}`}
                  aria-current={index === notice ? "true" : undefined}
                  onClick={() => setNotice(index)}
                />
              ))}
            </div>
          </div>
        )}
        {/* 活动标题 */}
        <div className="activity-title">
          {/* 活动开始时间 */}
          {activity.status !== "ENDED" && (
            <small className="activity-time">
              <span>{formatDateTime(activity.startAt)}</span>
              <span>至</span>
              <span>{formatDateTime(activity.endAt)}</span>
            </small>
          )}
          {/* 活动状态 */}
          {activity.status !== "RUNNING" && (
            <em className="status-tip">
              {activity.status === "NOT_STARTED" ? "活动未开始" : "活动已结束"}
            </em>
          )}
        </div>
        {/* 抽奖区域 */}
        <div className="draw-area" id="draw-area" data-stay="draw">
          <button
            className="image-draw"
            type="button"
            onClick={draw}
            aria-label="点击转盘抽奖"
            aria-busy={drawing}
            disabled={drawing}
          >
            <span className="wheel-stage">
              <span className="wheel-pointer" aria-hidden="true" />
              <span className="wheel-plate">
                {/* 转盘图片 */}
                <img src={wheelUrl} alt="点击转盘抽奖" />
              </span>
              {/* 固定文案，叠在转盘约 25° 方位 */}
              <span className="draw-hint" aria-hidden="true">
                点击抽奖
              </span>
            </span>
          </button>
          {/* 抽奖信息 */}
          <div className="draw-info">
            {/* 活动进行中：显示剩余抽奖次数 */}
            {activity.status === "RUNNING" ? (
              <strong>当前剩余抽奖次数：{customer?.drawChance ?? 0} 次</strong>
            ) : (
              <strong>
                {activity.status === "NOT_STARTED" ? "活动未开始" : "活动已结束"}
              </strong>
            )}
            <button type="button" onClick={() => setModal("help")}>
              邀请好友助力，再得抽奖机会
            </button>
          </div>
        </div>

      </section>

      <div className="card-stack">
        <section className="content-card rich-rule" data-stay="rules">
          <h2>活动规则</h2>
          <div
            style={activity.rulesColor ? { color: activity.rulesColor } : undefined}
            dangerouslySetInnerHTML={{
              __html:
                activity.rulesHtml ||
                "<p>完成留资即可获得首次抽奖机会，邀请好友完成有效留资可增加抽奖次数。</p>",
            }}
          />
          <button type="button" onClick={() => setModal("rules")}>
            查看详细规则 →
          </button>
        </section>

        {consultant && (
          <section className="content-card consultant-card" aria-label="销售顾问">
            <div className="consultant-avatar">
              {consultant.avatarUrl ? (
                <img
                  src={safeMediaUrl(consultant.avatarUrl) || ""}
                  alt={consultant.name}
                />
              ) : (
                consultant.name.slice(0, 1)
              )}
            </div>
            <div className="consultant-text">
              <strong>
                {consultant.title} · {consultant.name}
              </strong>
              <a href={`tel:${consultant.phone.replace(/-/g, "")}`}>
                {consultant.phone}
              </a>
              <p>{consultant.intro}</p>
            </div>
            <div className="qr-box">
              {consultant.qrcodeUrl ? (
                <img
                  src={safeMediaUrl(consultant.qrcodeUrl) || ""}
                  alt="顾问二维码"
                />
              ) : (
                <>
                  顾问
                  <br />
                  二维码
                </>
              )}
            </div>
          </section>
        )}

        <section className="content-card prize-section" aria-labelledby="prizes-title" data-stay="prizes">
          <div className="section-heading">
            <h2>奖品展示</h2>
            <h3 id="prizes-title">幸运好礼，100%中奖</h3>
          </div>
          {firstPrize && (
            <article className="first-prize">
              <img
                src={safeMediaUrl(firstPrize.imageUrl) || "/activity/prize-1.webp"}
                alt={firstPrize.name}
              />
              <div>
                <h2 className="prize-level">{firstPrize.level}</h2>
                <h3>{firstPrize.name}</h3>
                <p>
                  总量 {firstPrize.stock} / 余量 {firstPrize.remainStock}
                </p>
              </div>
            </article>
          )}
          <div className="other-prizes">
            {otherPrizes.map((prize) => (
              <article key={prize.id}>
                <img
                  src={safeMediaUrl(prize.imageUrl) || "/activity/prize-2.webp"}
                  alt={prize.name}
                />
                <h2 className="prize-level">{prize.level}</h2>
                <h3>{prize.name}</h3>
                <p>
                  总量 {prize.stock} / 余量 {prize.remainStock}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-card contact-row">
          <a href={tel}>
            <span>☎</span>
            <div>
              <small>咨询热线</small>
              <strong>{activity.phone}</strong>
              <em>点击拨打</em>
            </div>
          </a>
          {/* 0 条静态；1 条直跳；≥2 条弹窗选择 */}
          {mapLinks.length === 0 ? (
            <div className="contact-static">
              <span>⌖</span>
              <div>
                <small>领奖地址</small>
                <strong>{activity.address}</strong>
                <em>导航请咨询专属顾问</em>
              </div>
            </div>
          ) : mapLinks.length === 1 ? (
            <a href={mapLinks[0].url} target="_blank" rel="noreferrer">
              <span>⌖</span>
              <div>
                <small>领奖地址</small>
                <strong>{activity.address}</strong>
                <em>{mapLinks[0].name}</em>
              </div>
            </a>
          ) : (
            <button
              type="button"
              className="contact-map-trigger"
              onClick={() => setModal("maps")}
            >
              <span>⌖</span>
              <div>
                <small>领奖地址</small>
                <strong>{activity.address}</strong>
                <em>选择地图导航</em>
              </div>
            </button>
          )}
        </section>

        {/* C.6.2 线上售楼部：后台配置了合法外链才出现 */}
        {externalUrl && (
          <section className="content-card online-entry">
            <a href={externalUrl} target="_blank" rel="noreferrer">
              进入线上售楼部 →
            </a>
          </section>
        )}

        {/* C.6.4 亮点区：优惠 / 区位 / 户型 */}
        {activity.highlightAssets.length > 0 && (
          <section
            className="content-card highlight-section"
            aria-labelledby="highlight-title"
          >
            <div className="section-heading">
              <h2>项目亮点</h2>
              <h3 id="highlight-title">为什么选择福美城</h3>
            </div>
            <div className="highlight-list">
              {activity.highlightAssets.map((asset) => (
                <article key={asset.id}>
                  {asset.imageUrl ? (
                    <button
                      type="button"
                      className="media-thumb"
                      title="点击放大预览"
                      onClick={() =>
                        setImagePreview({
                          src: safeMediaUrl(asset.imageUrl) || "",
                          title: asset.title || "项目亮点",
                        })
                      }
                    >
                      <img
                        src={safeMediaUrl(asset.imageUrl) || ""}
                        alt={asset.title || "项目亮点"}
                        loading="lazy"
                      />
                    </button>
                  ) : null}
                  <div>
                    <strong>{asset.title}</strong>
                    <p>{asset.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="content-card property-section" aria-labelledby="property-title" data-stay="property">
          <div className="section-heading">
            <h2>楼盘社区</h2>
            <h3 id="property-title">城芯生活，住进福美</h3>
          </div>
          {activity.propertyAssets.map((asset, index) => (
            <article
              className={`property-card ${index % 2 ? "text-right" : ""}`}
              key={asset.id}
            >
              <button
                type="button"
                className="media-thumb property-thumb"
                title="点击放大预览"
                onClick={() =>
                  setImagePreview({
                    src: safeMediaUrl(asset.imageUrl) || "",
                    title: asset.title || "楼盘图片",
                  })
                }
              >
                <img
                  src={safeMediaUrl(asset.imageUrl) || ""}
                  alt={asset.title || "楼盘图片"}
                  loading="lazy"
                />
              </button>
              <div>
                <strong>{asset.title}</strong>
                <p>{asset.subtitle}</p>
              </div>
            </article>
          ))}
        </section>

        <section
          className="content-card stats-row"
          style={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
            marginBottom: 48,
          }}
        >
          <strong>
            曝光量 <b>{activity.exposureCount.toLocaleString()}</b>
          </strong>
          <strong>
            参与量 <b>{activity.participateCount.toLocaleString()}</b>
          </strong>
        </section>
      </div>
      </div>

      <div className="page-bottom">
        <div className="dock-waves" aria-hidden="true" />
        <div className="bottom-dock">
          {consultant && (
            <button
              className="consultant-dock"
              type="button"
              onClick={() => setModal("consultant")}
            >
              <div className="consultant-avatar small">
                {consultant.avatarUrl ? (
                  <img src={safeMediaUrl(consultant.avatarUrl) || ""} alt="" />
                ) : (
                  consultant.name.slice(0, 1)
                )}
              </div>
              <div>
                <strong>{consultant.name}</strong>
                <span>{consultant.phone}</span>
              </div>
              <p>{consultant.intro}</p>
            </button>
          )}
          <button
            className="consult-float"
            type="button"
            onClick={() => setModal("consultant")}
          >
            <span>立即咨询</span>
            <b>☎</b>
          </button>
        </div>
      </div>

      {poster && (
        <dialog
          ref={posterRef}
          className="poster-dialog"
          aria-label="活动海报"
          onClose={() => setPoster(false)}
          onClick={(event) => {
            if (event.target === posterRef.current) {
              setPoster(false);
            }
          }}
        >
          <div className="poster-panel">
            <div className="poster-media">
              {/* <button
                type="button"
                className="modal-close"
                aria-label="关闭活动海报"
                onClick={() => setPoster(false)}
              >
                ×
              </button> */}
              <img src={posterUrl} alt="博富·福美城活动海报" />
            </div>
            <small>海报将在 {posterSeconds} 秒后自动关闭</small>
          </div>
        </dialog>
      )}

      {modal && (
        <dialog
          ref={dialogRef}
          className="modal-dialog"
          aria-labelledby="modal-title"
          onClose={() => setModal(null)}
          onClick={(event) => {
            if (event.target === dialogRef.current) setModal(null);
          }}
        >
          <div className="modal-panel">
            <button
              className="modal-close"
              type="button"
              onClick={() => setModal(null)}
              aria-label="关闭弹窗"
            >
              ×
            </button>
            <div className="modal-scroll">

            {modal === "auth" && (
              <>
                <span>微信授权</span>
                <h2 id="modal-title">授权后即可抽奖</h2>
                <p>
                  {authErrorReason
                    ? AUTH_ERROR_TEXT[authErrorReason] || AUTH_ERROR_TEXT.unknown
                    : authRequired
                      ? "抽奖与留资需要微信身份，用于记录次数与中奖信息。关闭后仍可浏览活动与楼盘内容。"
                      : "请先完成微信授权后再参与抽奖。"}
                </p>
                {inWechat || !authRequired ? (
                  <a className="submit-button" href={wechatAuthHref()}>
                    {authErrorReason ? "重新授权" : "微信授权"}
                  </a>
                ) : (
                  <p className="auth-hint">
                    当前不在微信内，请从公众号菜单或微信扫码打开本页面后再授权。
                  </p>
                )}
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setModal(null)}
                >
                  先逛逛
                </button>
              </>
            )}

            {modal === "lead" && (
              <>
                <span>客户留资</span>
                <h2 id="modal-title">留下信息，开启好运</h2>
                <form onSubmit={submitLead}>
                  <label>
                    客户姓名
                    <input name="name" required placeholder="请输入姓名" />
                  </label>
                  <label>
                    手机号码
                    <input
                      name="phone"
                      required
                      type="tel"
                      inputMode="numeric"
                      pattern="1[0-9]{10}"
                      placeholder="请输入手机号码"
                    />
                  </label>
                  <label>
                    意向户型
                    <select name="intentLayout" defaultValue="">
                      <option value="" disabled>
                        请选择户型
                      </option>
                      <option>三房</option>
                      <option>四房</option>
                      <option>五房</option>
                      <option>商铺</option>
                    </select>
                  </label>
                  <label>
                    预计到访看房日期
                    <input name="visitDate" type="date" />
                  </label>
                  <button className="submit-button" type="submit">
                    提交并获得抽奖机会
                  </button>
                </form>
              </>
            )}

            {modal === "help" && (
              <>
                <span>好友助力</span>
                <h2 id="modal-title">邀请好友，再得抽奖机会</h2>
                <p>
                  分享活动给好友，好友完成有效留资后，你可增加{" "}
                  {activity.assistChance} 次抽奖机会，单人最多增加{" "}
                  {activity.assistMaxExtra} 次。
                </p>
                {customer ? (
                  <>
                    <p className="assist-progress">
                      已获得 <b>{customer.assistGained}</b> /{" "}
                      {activity.assistMaxExtra} 次助力
                    </p>
                    <div className="share-link">
                      <input readOnly value={shareUrl} aria-label="助力链接" />
                      <button type="button" onClick={copyShareLink}>
                        {shareCopied ? "已复制" : "复制链接"}
                      </button>
                    </div>
                    <p className="assist-hint">
                      好友通过此链接进入并完成留资，次数自动到账；重新进入本页即可看到最新次数。
                    </p>
                  </>
                ) : (
                  <p className="assist-hint">完成微信授权后可生成专属助力链接。</p>
                )}
                <button
                  className="submit-button"
                  type="button"
                  onClick={() => (customer ? setModal(null) : setModal("auth"))}
                >
                  {customer ? "我知道了" : "去授权"}
                </button>
              </>
            )}

            {modal === "maps" && (
              <>
                <span>领奖地址</span>
                <h2 id="modal-title">选择地图导航</h2>
                <p>{activity.address}</p>
                <div className="map-link-list">
                  {mapLinks.map((item) => (
                    <a
                      key={`${item.name}-${item.url}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
                <button
                  className="submit-button"
                  type="button"
                  onClick={() => setModal(null)}
                >
                  关闭
                </button>
              </>
            )}

            {modal === "rules" && (
              <>
                <span>详细规则</span>
                <h2
                  id="modal-title"
                  dangerouslySetInnerHTML={{ __html: activity.title }}
                />
                <ol>
                  <li>
                    每位客户首次进入并完成留资后免费抽奖{" "}
                    {activity.firstDrawChance} 次。
                  </li>
                  <li>
                    每邀请 1 位好友完成有效留资，增加{" "}
                    {activity.assistChance} 次机会，最多 {activity.assistMaxExtra}{" "}
                    次。
                  </li>
                  {activity.dailyDrawLimit > 0 && (
                    <li>每位客户每日最多抽奖 {activity.dailyDrawLimit} 次。</li>
                  )}
                  {activity.totalDrawLimit > 0 && (
                    <li>活动期间每位客户最多抽奖 {activity.totalDrawLimit} 次。</li>
                  )}
                  <li>礼品数量有限，先到先得，领完即止。</li>
                  <li>
                    领取截止至{" "}
                    {new Date(activity.redeemDeadline).toLocaleDateString("zh-CN")}
                    ，逾期视为自动放弃。
                  </li>
                  <li>
                    领奖地址：{activity.address}，到店后由工作人员现场核销。
                  </li>
                </ol>
                {activity.rulesHtml ? (
                  <div
                    className="rules-rich"
                    style={activity.rulesColor ? { color: activity.rulesColor } : undefined}
                    dangerouslySetInnerHTML={{ __html: activity.rulesHtml }}
                  />
                ) : null}
              </>
            )}

            {modal === "drawResult" && lastDraw && (
              <>
                <span>抽奖结果</span>
                <h2 id="modal-title">{lastDraw.prizeName}</h2>
                <ul className="prize-list">
                  <li className={lastDraw.isWin ? "is-latest" : undefined}>
                    <div className="prize-line">
                      <strong>
                        {lastDraw.prizeLevel} · {lastDraw.prizeName}
                      </strong>
                      <em
                        className={`redeem-badge redeem-${lastDraw.redeemStatus.toLowerCase()}`}
                      >
                        {lastDraw.isWin
                          ? REDEEM_LABELS[lastDraw.redeemStatus] ||
                            lastDraw.redeemStatus
                          : "未中奖"}
                      </em>
                    </div>
                    {lastDraw.isWin && (
                      <div className="redeem-code">
                        <small>核销码</small>
                        <b>{lastDraw.redeemCode}</b>
                        <button
                          type="button"
                          onClick={() => copyRedeemCode(lastDraw.redeemCode)}
                        >
                          复制
                        </button>
                      </div>
                    )}
                    <span>
                      {new Date(lastDraw.createdAt).toLocaleString("zh-CN")}
                    </span>
                    {lastDraw.isWin && lastDraw.redeemStatus === "PENDING" && (
                      <p className="redeem-tip">
                        到访请出示核销码，现场核销后失效
                      </p>
                    )}
                    {lastDraw.isWin && lastDraw.redeemStatus === "PENDING" && (
                      redeemTarget === lastDraw.redeemCode ? (
                        <form
                          className="redeem-inline"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void submitRedeem(lastDraw.redeemCode);
                          }}
                        >
                          <input
                            value={redeemPassword}
                            onChange={(event) =>
                              setRedeemPassword(event.target.value)
                            }
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={12}
                            placeholder="工作人员输入核销密码"
                            aria-label="核销密码"
                          />
                          <button type="submit" disabled={redeemBusy}>
                            {redeemBusy ? "核销中…" : "确认核销"}
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              setRedeemTarget(null);
                              setRedeemError("");
                            }}
                          >
                            取消
                          </button>
                          {redeemError ? (
                            <em className="error-text">{redeemError}</em>
                          ) : null}
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="redeem-start"
                          onClick={() => {
                            setRedeemTarget(lastDraw.redeemCode);
                            setRedeemPassword("");
                            setRedeemError("");
                          }}
                        >
                          现场核销
                        </button>
                      )
                    )}
                    {!lastDraw.isWin && (
                      <p className="redeem-tip">
                        未中奖也可邀请好友助力，再得抽奖机会。
                      </p>
                    )}
                  </li>
                </ul>
                <p>
                  请于 {new Date(activity.redeemDeadline).toLocaleDateString("zh-CN")}{" "}
                  前到 {activity.address} 现场领取。
                </p>
                <button
                  type="button"
                  className="submit-button"
                  onClick={openPrizes}
                >
                  查看我的奖品
                </button>
              </>
            )}

            {modal === "prizes" && (
              <>
                <span>我的奖品</span>
                <h2 id="modal-title">
                  {prizeRecords[0]?.prizeName || "暂时还没有中奖记录"}
                </h2>
                <div className="prize-tabs" role="tablist" aria-label="奖品状态">
                  {prizeTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={prizeTab === tab.key}
                      className={prizeTab === tab.key ? "is-active" : undefined}
                      onClick={() => {
                        setPrizeTab(tab.key);
                        setRedeemTarget(null);
                        setRedeemError("");
                      }}
                    >
                      {tab.label}
                      <small>{countPrizeTab(tab.key)}</small>
                    </button>
                  ))}
                </div>
                {visiblePrizes.length ? (
                  <ul className="prize-list">
                    {visiblePrizes.map((item) => {
                      const status = item.isWin
                        ? REDEEM_LABELS[item.redeemStatus] || item.redeemStatus
                        : "未中奖";
                      return (
                        <li key={item.id}>
                          <div className="prize-line">
                            <strong>
                              {item.prizeLevel} · {item.prizeName}
                            </strong>
                            <em
                              className={`redeem-badge redeem-${item.redeemStatus.toLowerCase()}`}
                            >
                              {status}
                            </em>
                          </div>
                          {item.isWin && (
                            <div className="redeem-code">
                              <small>核销码</small>
                              <b>{item.redeemCode}</b>
                              <button
                                type="button"
                                onClick={() => copyRedeemCode(item.redeemCode)}
                              >
                                复制
                              </button>
                            </div>
                          )}
                          <span>
                            {new Date(item.createdAt).toLocaleString("zh-CN")}
                          </span>
                          {item.isWin && item.redeemStatus === "PENDING" && (
                            <p className="redeem-tip">
                              到访请出示核销码，现场核销后失效
                            </p>
                          )}
                          {item.isWin && item.redeemStatus === "PENDING" && (
                            redeemTarget === item.redeemCode ? (
                              <form
                                className="redeem-inline"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void submitRedeem(item.redeemCode);
                                }}
                              >
                                <input
                                  value={redeemPassword}
                                  onChange={(event) =>
                                    setRedeemPassword(event.target.value)
                                  }
                                  inputMode="numeric"
                                  autoComplete="off"
                                  maxLength={12}
                                  placeholder="工作人员输入核销密码"
                                  aria-label="核销密码"
                                />
                                <button type="submit" disabled={redeemBusy}>
                                  {redeemBusy ? "核销中…" : "确认核销"}
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => {
                                    setRedeemTarget(null);
                                    setRedeemError("");
                                  }}
                                >
                                  取消
                                </button>
                                {redeemError ? (
                                  <em className="error-text">{redeemError}</em>
                                ) : null}
                              </form>
                            ) : (
                              <button
                                type="button"
                                className="redeem-start"
                                onClick={() => {
                                  setRedeemTarget(item.redeemCode);
                                  setRedeemPassword("");
                                  setRedeemError("");
                                }}
                              >
                                现场核销
                              </button>
                            )
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="prize-empty">该状态下暂无奖品记录。</p>
                )}
                <p className="prize-collect-tip">
                  请于 {new Date(activity.redeemDeadline).toLocaleDateString("zh-CN")}{" "}
                  前到 {activity.address} 现场领取。
                </p>
              </>
            )}

            {modal === "consultant" && consultant && (
              <>
                <span>专属顾问</span>
                <h2 id="modal-title">{consultant.name}</h2>
                <div className="consultant-modal">
                  <div className="consultant-avatar large">
                    {consultant.avatarUrl ? (
                      <img
                        src={safeMediaUrl(consultant.avatarUrl) || ""}
                        alt=""
                      />
                    ) : (
                      consultant.name.slice(0, 1)
                    )}
                  </div>
                  <p>{consultant.message || consultant.intro}</p>
                  <strong>{consultant.phone}</strong>
                  <a
                    className="submit-button"
                    href={`tel:${consultant.phone.replace(/-/g, "")}`}
                  >
                    拨打电话
                  </a>
                  <div className="qr-box large">
                    {consultant.qrcodeUrl ? (
                      <img
                        src={safeMediaUrl(consultant.qrcodeUrl) || ""}
                        alt="顾问微信二维码"
                      />
                    ) : (
                      "顾问微信二维码"
                    )}
                  </div>
                  <small>长按识别二维码，添加专属顾问微信</small>
                </div>
              </>
            )}
            </div>
          </div>
        </dialog>
      )}

      {imagePreview && (
        <dialog
          ref={previewRef}
          className="modal-dialog"
          aria-label={imagePreview.title}
          onClose={() => setImagePreview(null)}
          onClick={(event) => {
            if (event.target === previewRef.current) setImagePreview(null);
          }}
        >
          <div className="modal-panel media-preview-panel">
            <button
              className="modal-close"
              type="button"
              onClick={() => setImagePreview(null)}
              aria-label="关闭预览"
            >
              ×
            </button>
            <span>图片预览</span>
            <h2 id="preview-title">{imagePreview.title}</h2>
            <img src={imagePreview.src} alt={imagePreview.title} />
          </div>
        </dialog>
      )}

      {toast && (
        <div
          className={`toast-drawer toast-${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <span>{toast.text}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}
