"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ActivityClient, CustomerClient, ModalKind } from "./types";

type Props = {
  shareCode?: string;
  inviterId?: string;
};

function formatRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const fmt = (date: Date) =>
    `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${fmt(start)} 至 ${fmt(end)}`;
}

export default function ActivityPage({ shareCode, inviterId }: Props) {
  const [activity, setActivity] = useState<ActivityClient | null>(null);
  const [customer, setCustomer] = useState<CustomerClient | null>(null);
  const [notice, setNotice] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);
  const [poster, setPoster] = useState(true);
  const [posterSeconds, setPosterSeconds] = useState(5);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [drawing, setDrawing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const posterRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      const response = await fetch("/api/session/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode, inviterId }),
      });
      const data = await response.json();
      if (!cancelled && response.ok) {
        setActivity(data.activity);
        setCustomer(data.customer);
      } else if (!cancelled) {
        setMessage(data.message || "活动加载失败");
      }
      if (!cancelled) setLoading(false);
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [modal]);

  useEffect(() => {
    if (!poster || !activity) return;
    setPosterSeconds(5);
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

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setMessage(data.message || "留资失败");
      return;
    }
    setCustomer((prev) =>
      prev
        ? { ...prev, hasLead: true, drawChance: data.drawChance }
        : prev,
    );
    setModal(null);
    setMessage("留资成功，已获得抽奖机会");
  }

  async function draw() {
    if (!activity || drawing) return;
    if (activity.status !== "RUNNING") {
      setMessage("活动未开始或已结束");
      return;
    }
    if (!customer?.hasLead) {
      setModal("lead");
      return;
    }
    if (!customer.drawChance) {
      setModal("help");
      return;
    }

    setDrawing(true);
    const response = await fetch("/api/draw", { method: "POST" });
    const data = await response.json();
    setDrawing(false);

    if (!response.ok) {
      if (data.code === "NEED_LEAD") setModal("lead");
      else if (data.code === "NO_CHANCE") setModal("help");
      else setMessage(data.message || "抽奖失败");
      return;
    }

    setCustomer((prev) =>
      prev
        ? {
            ...prev,
            drawChance: data.drawChance,
            prizes: [
              {
                id: data.result.id,
                prizeName: data.result.prizeName,
                prizeLevel: data.result.prizeLevel,
                isWin: data.result.isWin,
                redeemStatus: data.result.redeemStatus,
                createdAt: new Date().toISOString(),
                redeemCode: data.result.redeemCode,
              },
              ...prev.prizes,
            ],
          }
        : prev,
    );
    setModal("prizes");
  }

  function scrollToDraw() {
    document.getElementById("draw-area")?.scrollIntoView({ behavior: "smooth" });
  }

  if (loading) {
    return <main className="activity-page loading-page">活动加载中…</main>;
  }

  if (!activity) {
    return <main className="activity-page loading-page">{message || "活动未配置"}</main>;
  }

  const consultant = activity.consultant;
  const firstPrize = activity.prizes[0];
  const otherPrizes = activity.prizes.slice(1);
  const tel = `tel:${activity.phone.replace(/-/g, "")}`;

  return (
    <main className="activity-page">
      <section className="main-content" aria-labelledby="activity-title">
        <div
          className="content-background"
          style={
            activity.backgroundUrl
              ? { backgroundImage: `url('${activity.backgroundUrl}')` }
              : undefined
          }
          aria-hidden="true"
        />
        <header className="brand-area">
          <div className="logo-line">
            <img src="/activity/logo-future.png" alt="未来社区" />
            <img src="/activity/logo-fumei.png" alt="博富·福美城" />
          </div>
          <div className="action-line">
            <button type="button" onClick={() => setModal("prizes")}>
              我的奖品
            </button>
            <button type="button" onClick={() => setModal("rules")}>
              规则详情
            </button>
          </div>
        </header>

        {activity.notices.length > 0 && (
          <div className="notice" aria-live="polite">
            <span>活动公告</span>
            <b>{activity.notices[notice]}</b>
            <div>
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

        <div className="activity-title">
          <h1 id="activity-title">
            {activity.title.split("超级").map((part, index) =>
              index === 0 ? (
                <span key={part}>
                  {part}
                  <br />
                </span>
              ) : (
                <span key={part}>超级{part}</span>
              ),
            )}
          </h1>
          <p>{activity.subtitle}</p>
          {activity.status !== "ENDED" && (
            <small>{formatRange(activity.startAt, activity.endAt)}</small>
          )}
          {activity.status !== "RUNNING" && (
            <em className="status-tip">
              {activity.status === "NOT_STARTED" ? "活动未开始" : "活动已结束"}
            </em>
          )}
        </div>

        <div className="draw-area" id="draw-area">
          <button
            className="image-draw"
            type="button"
            onClick={draw}
            aria-label="点击转盘抽奖"
            disabled={drawing}
          >
            <span className="wheel-plate">
              <img
                src={activity.wheelImageUrl || "/activity/大圆盘2.png"}
                alt="点击转盘抽奖"
              />
            </span>
          </button>
          <div className="draw-info">
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

        <section className="rich-rule">
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
      </section>

      {consultant && (
        <section className="consultant-card" aria-label="销售顾问">
          <div className="consultant-avatar">
            {consultant.avatarUrl ? (
              <img src={consultant.avatarUrl} alt={consultant.name} />
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
              <img src={consultant.qrcodeUrl} alt="顾问二维码" />
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

      <section className="prize-section" aria-labelledby="prizes-title">
        <div className="section-heading">
          <span>奖品展示</span>
          <h2 id="prizes-title">幸运好礼，100%中奖</h2>
        </div>
        {firstPrize && (
          <article className="first-prize">
            <img
              src={firstPrize.imageUrl || "/activity/prize-1.jpg"}
              alt={firstPrize.name}
            />
            <div>
              <small>{firstPrize.level}</small>
              <h3>{firstPrize.name}</h3>
              <p>到访现场核销，数量有限先到先得</p>
            </div>
          </article>
        )}
        <div className="other-prizes">
          {otherPrizes.map((prize) => (
            <article key={prize.id}>
              <img
                src={prize.imageUrl || "/activity/prize-2.jpg"}
                alt={prize.name}
              />
              <small>{prize.level}</small>
              <h3>{prize.name}</h3>
              <p>数量有限，先到先得</p>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-row">
        <a href={tel}>
          <span>☎</span>
          <div>
            <small>咨询热线</small>
            <strong>{activity.phone}</strong>
            <em>点击拨打</em>
          </div>
        </a>
        <a href={activity.mapUrl || "#map"}>
          <span>⌖</span>
          <div>
            <small>领奖地址</small>
            <strong>{activity.address}</strong>
            <em>打开地图导航</em>
          </div>
        </a>
      </section>

      <section className="property-section" aria-labelledby="property-title">
        <div className="section-heading">
          <span>楼盘社区</span>
          <h2 id="property-title">城芯生活，住进福美</h2>
        </div>
        {activity.propertyAssets.map((asset, index) => (
          <article
            className={`property-card ${index % 2 ? "text-right" : ""}`}
            key={asset.id}
          >
            <img src={asset.imageUrl} alt={asset.title || "楼盘图片"} loading="lazy" />
            <div>
              <strong>{asset.title}</strong>
              <p>{asset.subtitle}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="stats-row">
        <strong>
          曝光量 <b>{activity.exposureCount.toLocaleString()}</b>
        </strong>
        <strong>
          参与量 <b>{activity.participateCount.toLocaleString()}</b>
        </strong>
      </section>

      <footer className="page-footer">
        <img src="/activity/logo-fumei.png" alt="博富·福美城" />
        <p>
          {activity.address}
          <br />
          咨询热线：{activity.phone}
        </p>
      </footer>

      <div className="bottom-dock">
        {consultant && (
          <button
            className="consultant-dock"
            type="button"
            onClick={() => setModal("consultant")}
          >
            <div className="consultant-avatar small">
              {consultant.avatarUrl ? (
                <img src={consultant.avatarUrl} alt="" />
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
              <button
                type="button"
                className="modal-close"
                aria-label="关闭活动海报"
                onClick={() => setPoster(false)}
              >
                ×
              </button>
              <img
                src={activity.posterUrl || "/activity/kv-popup.jpg"}
                alt="博富·福美城活动海报"
              />
            </div>
            <small>海报将在 {posterSeconds} 秒后自动关闭</small>
          </div>
        </dialog>
      )}

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
                分享活动给好友，好友完成有效留资后，你可增加 1
                次抽奖机会，单人最多增加 3 次。
              </p>
              <button
                className="submit-button"
                type="button"
                onClick={() => setModal(null)}
              >
                我知道了
              </button>
            </>
          )}

          {modal === "rules" && (
            <>
              <span>详细规则</span>
              <h2 id="modal-title">{activity.title}</h2>
              <ol>
                <li>每位客户首次进入并完成留资后免费抽奖 1 次。</li>
                <li>每邀请 1 位好友完成有效留资，增加 1 次机会，最多 3 次。</li>
                <li>礼品数量有限，先到先得，领完即止。</li>
                <li>
                  领取截止至 {new Date(activity.redeemDeadline).toLocaleDateString("zh-CN")}
                  ，逾期视为自动放弃。
                </li>
                <li>
                  领奖地址：{activity.address}，核销密码：6666。
                </li>
              </ol>
            </>
          )}

          {modal === "prizes" && (
            <>
              <span>我的奖品</span>
              <h2 id="modal-title">
                {customer?.prizes[0]?.prizeName || "暂时还没有中奖记录"}
              </h2>
              {customer?.prizes.length ? (
                <ul className="prize-list">
                  {customer.prizes.map((item) => (
                    <li key={item.id}>
                      <strong>
                        {item.prizeLevel} · {item.prizeName}
                      </strong>
                      <span>
                        {item.isWin ? item.redeemStatus : "未中奖"} ·{" "}
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>完成抽奖后，中奖记录会显示在这里。</p>
              )}
              <p>
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
                    <img src={consultant.avatarUrl} alt="" />
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
                    <img src={consultant.qrcodeUrl} alt="顾问微信二维码" />
                  ) : (
                    "顾问微信二维码"
                  )}
                </div>
                <small>长按识别二维码，添加专属顾问微信</small>
              </div>
            </>
          )}
        </div>
      </dialog>

      {/* {message && (
        <div className="toast" role="status">
          {message}
          <button type="button" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )} */}
    </main>
  );
}
