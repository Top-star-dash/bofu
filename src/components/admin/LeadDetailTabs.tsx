"use client";

import { useMemo, useState } from "react";
import LeadDetail from "./LeadDetail";
import PreviewableImage from "./PreviewableImage";
import CustomerPrizes, { type CustomerPrizeRow } from "./CustomerPrizes";

export type SummaryItem = { label: string; value: string };
export type InfoItem = { label: string; value: string };
export type TimelineRow = { at: string; title: string; detail: string };
export type LogRow = { at: string; action: string; detail: string };

const TABS = [
  { key: "overview", label: "概览" },
  { key: "customer", label: "客户与留资" },
  { key: "prizes", label: "客户奖品" },
  { key: "remark", label: "备注与分层" },
  { key: "timeline", label: "行为轨迹" },
  { key: "logs", label: "操作日志" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 10;

function pagerNumbers(page: number, totalPages: number) {
  const list: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i <= Math.min(totalPages, start + 4); i += 1) list.push(i);
  return list;
}

function Empty({ text }: { text: string }) {
  return <p className="m-0 py-6 text-center text-[13px] text-[#9b7d64]">{text}</p>;
}

export default function LeadDetailTabs({
  summary,
  avatarUrl,
  wechat,
  profile,
  leadId,
  remark,
  tier,
  consultantId,
  consultants,
  timeline,
  logs,
  prizes,
  drawCount,
  canRedeem,
}: {
  summary: SummaryItem[];
  avatarUrl: string;
  wechat: InfoItem[];
  profile: InfoItem[];
  leadId: string;
  remark: string;
  tier: string;
  consultantId: string;
  consultants: Array<{ id: string; name: string }>;
  timeline: TimelineRow[];
  logs: LogRow[];
  prizes: CustomerPrizeRow[];
  drawCount: number;
  canRedeem: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(timeline.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return timeline.slice(start, start + PAGE_SIZE);
  }, [timeline, page]);

  function switchTab(next: TabKey) {
    setTab(next);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 border-b border-[#ead7c2] pb-3">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => switchTab(item.key)}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
              tab === item.key
                ? "bg-[#b83224] text-white"
                : "bg-[#fff2df] text-[#8f281f] hover:bg-[#ffe6b8]"
            }`}
          >
            {item.label}
            {item.key === "timeline" && timeline.length ? (
              <span className="ml-1 opacity-70">({timeline.length})</span>
            ) : null}
            {item.key === "prizes" && prizes.length ? (
              <span className="ml-1 opacity-70">({prizes.length})</span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.map((item) => (
              <article
                key={item.label}
                className="rounded-xl bg-white px-4 py-3 shadow-[0_8px_24px_#7a4a2e12]"
              >
                <span className="text-[12px] text-[#8a6c5b]">{item.label}</span>
                <strong className="mt-1 block text-[18px] font-bold text-[#b83224]">
                  {item.value}
                </strong>
              </article>
            ))}
          </div>
          <div className="admin-card">
            <h3 className="m-0 text-[14px] font-bold">关键信息</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[...wechat.slice(0, 2), ...profile.slice(0, 4)].map((item) => (
                <div key={item.label} className="text-[13px] text-[#3a2418]">
                  <span className="text-[#8a6c5b]">{item.label}：</span>
                  <span className="break-all">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "customer" && (
        <div className="flex flex-col gap-4">
          <div className="admin-card">
            <h3 className="m-0 text-[14px] font-bold">微信用户</h3>
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {avatarUrl ? (
                <PreviewableImage
                  src={avatarUrl}
                  alt="微信头像"
                  title="微信头像"
                  className="h-16 w-16 rounded-full object-cover"
                  buttonClassName="rounded-full border border-[#f0e2d2] bg-white p-0.5"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[#fff2df] text-[12px] text-[#9b7d64]">
                  无头像
                </div>
              )}
              <div className="flex flex-col gap-1 text-[13px] text-[#3a2418]">
                {wechat.map((item) => (
                  <div key={item.label}>
                    <span className="text-[#8a6c5b]">{item.label}：</span>
                    <span className="break-all">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="admin-card">
            <h3 className="m-0 text-[14px] font-bold">留资信息</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {profile.map((item) => (
                <div key={item.label} className="text-[13px] text-[#3a2418]">
                  <span className="text-[#8a6c5b]">{item.label}：</span>
                  {item.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "prizes" && (
        <CustomerPrizes rows={prizes} drawCount={drawCount} canRedeem={canRedeem} />
      )}

      {tab === "remark" && (
        <div className="admin-card !overflow-visible">
          <h3 className="m-0 text-[14px] font-bold">备注 / 分层 / 改绑</h3>
          <div className="mt-4">
            <LeadDetail
              leadId={leadId}
              remark={remark}
              tier={tier}
              consultantId={consultantId}
              consultants={consultants}
            />
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-[14px] font-bold">行为轨迹</h3>
            <span className="text-[12px] text-[#8a6c5b]">
              共 {timeline.length} 条 · 每页 {PAGE_SIZE} 条
            </span>
          </div>
          {timeline.length ? (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">时间</th>
                      <th>事件</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((item, index) => (
                      <tr key={`${item.at}-${(page - 1) * PAGE_SIZE + index}`}>
                        <td className="whitespace-nowrap">{item.at}</td>
                        <td>{item.title}</td>
                        <td>{item.detail || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <nav className="mt-3 flex flex-wrap items-center justify-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-[12px] text-[#8f281f] hover:bg-[#fff2df] disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    上一页
                  </button>
                  {pagerNumbers(page, totalPages).map((num) => (
                    <button
                      key={num}
                      type="button"
                      aria-current={num === page ? "page" : undefined}
                      className={`min-w-8 rounded-lg px-2.5 py-1.5 text-[12px] ${
                        num === page
                          ? "bg-[#b83224] font-bold text-white"
                          : "text-[#8f281f] hover:bg-[#fff2df]"
                      }`}
                      onClick={() => setPage(num)}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-[12px] text-[#8f281f] hover:bg-[#fff2df] disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    下一页
                  </button>
                </nav>
              )}
            </>
          ) : (
            <Empty text="暂无轨迹" />
          )}
        </div>
      )}

      {tab === "logs" && (
        <div className="admin-card">
          <h3 className="m-0 text-[14px] font-bold">改绑 / 备注操作日志</h3>
          {logs.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">时间</th>
                    <th>操作</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={`${log.at}-${index}`}>
                      <td className="whitespace-nowrap">{log.at}</td>
                      <td>{log.action}</td>
                      <td>{log.detail || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="暂无操作记录" />
          )}
        </div>
      )}
    </div>
  );
}
