"use client";

import { useEffect, useState } from "react";

const notices = ["幸运抽奖 100%中奖，礼品数量有限先到先得", "加 2 万送全屋装修，再享 3 年物业管理费赠送", "参与线上抽奖，丰厚惊喜好礼等你来解锁"];
const prizes = [
  ["5000元购房抵扣券", "一等奖", "/activity/prize-1.jpg"],
  ["未来社区定制咖啡杯", "二等奖", "/activity/prize-2.jpg"],
  ["晴雨两用伞", "三等奖", "/activity/prize-3.jpg"],
  ["咖啡文化周抵扣券10元", "幸运参与奖", "/activity/prize-4.jpg"],
];
const propertyCards = [
  ["福美生活馆", "城芯品质生活，住进理想社区", "/property/overall.jpg"],
  ["全龄社区配套", "运动、休闲、社交，一站满足日常所需", "/property/amenities.png"],
  ["生态泳池", "夏日清凉时光，家门口的休闲场", "/property/pool.jpg"],
  ["最美上学路", "家门口优质教育配套，陪伴孩子成长", "/property/school-road.jpg"],
  ["未来社区福美校区", "文化、艺术、科创多元成长空间", "/property/school.jpg"],
  ["品质入户大堂", "从归家开始，感受每天的仪式感", "/property/lobby.jpg"],
  ["瑜伽室与阅读馆", "在社区里保持热爱，也保持松弛", "/property/yoga.jpg"],
];
type Modal = "lead" | "rules" | "prizes" | "help" | null;

export default function Demo() {
  const [notice, setNotice] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [poster, setPoster] = useState(true);
  const [draws, setDraws] = useState(1);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setNotice((value) => (value + 1) % notices.length), 3500); const close = window.setTimeout(() => setPoster(false), 5000); return () => { window.clearInterval(timer); window.clearTimeout(close); }; }, []);
  function draw() { if (!draws) { setModal("lead"); return; } setDraws(0); setResult("恭喜获得「未来社区定制咖啡杯」"); setModal("prizes"); }
  return <main className="activity-page">
    <section className="main-content" aria-labelledby="activity-title">
      <div className="content-background" aria-hidden="true" />
      <header className="brand-area"><div className="logo-line"><img src="/activity/logo-future.png" alt="未来社区 福美核心区" /><img src="/activity/logo-fumei.png" alt="博富·福美城" /></div><div className="action-line"><button type="button" onClick={() => setModal("prizes")}>我的奖品</button><button type="button" onClick={() => setModal("rules")}>规则详情</button></div></header>
      <div className="notice" aria-live="polite"><span>活动公告</span><b>{notices[notice]}</b><div>{notices.map((item, index) => <button key={item} type="button" aria-label={`公告 ${index + 1}`} aria-current={index === notice ? "true" : undefined} onClick={() => setNotice(index)} />)}</div></div>
      <div className="activity-title"><h1 id="activity-title">博富·福美城<br />超级好礼全城派</h1><p>幸运抽奖 100%中奖</p><small>2026 年 11 月 23 日 09:00 至 12 月 31 日 24:00</small></div>
      <div className="draw-area"><button className="image-draw" type="button" onClick={draw} aria-label="点击转盘抽奖"><img src="/activity/大圆盘2.png" alt="点击转盘抽奖" /></button><div className="draw-info"><strong>当前剩余抽奖次数：{draws} 次</strong><button type="button" onClick={() => setModal("help")}>邀请好友助力，再得抽奖机会</button></div></div>
      <section className="rich-rule"><h2>活动规则</h2><p>完成留资即可获得首次抽奖机会，邀请好友完成有效留资可增加抽奖次数。奖品数量有限，先到先得，领完即止。</p><button type="button" onClick={() => setModal("rules")}>查看详细规则 →</button></section>
    </section>

    <section className="consultant-card" aria-label="销售顾问"><div className="consultant-avatar">顾</div><div className="consultant-text"><strong>福美城置业顾问</strong><a href="tel:07505236666">0750-5236666</a><p>Hi，我是您的专属置业顾问<br />欢迎添加好友，咨询项目详情</p></div><div className="qr-box">顾问<br />二维码</div></section>

    <section className="prize-section" aria-labelledby="prizes-title"><div className="section-heading"><span>奖品展示</span><h2 id="prizes-title">幸运好礼，100%中奖</h2></div><article className="first-prize"><img src={prizes[0][2]} alt={prizes[0][0]} /><div><small>{prizes[0][1]}</small><h3>{prizes[0][0]}</h3><p>到访现场核销，数量有限先到先得</p></div></article><div className="other-prizes">{prizes.slice(1).map(([name, level, image]) => <article key={name}><img src={image} alt={name} /><small>{level}</small><h3>{name}</h3><p>数量有限，先到先得</p></article>)}</div></section>

    <section className="contact-row"><a href="tel:07505236666"><span>☎</span><div><small>咨询热线</small><strong>0750-5236666</strong><em>点击拨打</em></div></a><a href="#map"><span>⌖</span><div><small>领奖地址</small><strong>博富·福美城冠军薈</strong><em>打开地图导航</em></div></a></section>

    <section className="property-section" aria-labelledby="property-title"><div className="section-heading"><span>楼盘社区</span><h2 id="property-title">城芯生活，住进福美</h2></div>{propertyCards.map(([title, text, image], index) => <article className={`property-card ${index % 2 ? "text-right" : ""}`} key={title}><img src={image} alt={title} loading="lazy" /><div><strong>{title}</strong><p>{text}</p></div></article>)}</section>
    <section className="stats-row"><strong>曝光量 <b>38,913</b></strong><strong>参与量 <b>26,983</b></strong></section>
    <footer className="page-footer"><img src="/activity/logo-fumei.png" alt="博富·福美城" /><p>博富·福美城冠军薈<br />咨询热线：0750-5236666</p></footer>
    <div className="fixed-actions"><a href="tel:07505236666">立即咨询</a><button type="button" onClick={() => setModal("lead")}>进入活动</button></div>

    {poster && <div className="poster-layer"><div className="poster-card"><button type="button" onClick={() => setPoster(false)} aria-label="关闭活动海报">×</button><img src="/activity/kv-popup.jpg" alt="博富·福美城活动海报" /><small>海报将在 5 秒后自动关闭</small></div></div>}
    {modal && <div className="modal-layer"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="关闭弹窗">×</button>{modal === "lead" && <><span>客户留资</span><h2 id="modal-title">留下信息，开启好运</h2><form onSubmit={(event) => { event.preventDefault(); setModal(null); setDraws(1); }}><label>客户姓名<input required placeholder="请输入姓名" /></label><label>手机号码<input required type="tel" placeholder="请输入手机号码" /></label><label>意向户型<select defaultValue=""><option value="" disabled>请选择户型</option><option>三房</option><option>四房</option><option>五房</option><option>商铺</option></select></label><label>预计到访看房日期<input type="date" /></label><button className="submit-button" type="submit">提交并获得抽奖机会</button></form></>}{modal === "help" && <><span>好友助力</span><h2 id="modal-title">邀请好友，再得抽奖机会</h2><p>分享活动给好友，好友完成有效留资后，你可增加 1 次抽奖机会，单人最多增加 3 次。</p><button className="submit-button" type="button" onClick={() => setModal(null)}>我知道了</button></>}{modal === "rules" && <><span>详细规则</span><h2 id="modal-title">福美城超级好礼全城派</h2><ol><li>每位客户首次进入免费抽奖 1 次。</li><li>每邀请 1 位好友完成有效留资，增加 1 次机会，最多 3 次。</li><li>礼品数量有限，先到先得，领完即止。</li><li>领取截止至 2027 年 1 月 7 日，逾期视为自动放弃。</li><li>领奖地址：博富·福美城冠军薈，核销密码：6666。</li></ol></>}{modal === "prizes" && <><span>我的奖品</span><h2 id="modal-title">{result ?? "暂时还没有中奖记录"}</h2><p>{result ? "请于 2027 年 1 月 7 日前到冠军薈现场领取。" : "完成抽奖后，中奖记录会显示在这里。"}</p></>}</section></div>}
  </main>;
}
