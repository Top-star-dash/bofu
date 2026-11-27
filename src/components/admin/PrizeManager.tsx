"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImageField from "./ImageField";

export type PrizeRow = {
  key: string;
  id?: string;
  level: string;
  name: string;
  imageUrl: string;
  stock: number;
  remainStock: number;
  probability: number;
  description: string;
  sortOrder: number;
  enabled: boolean;
  isFallback: boolean;
};

function newRow(index: number): PrizeRow {
  return {
    key: `new-${Date.now()}-${index}`,
    level: "",
    name: "",
    imageUrl: "",
    stock: 0,
    remainStock: 0,
    probability: 0,
    description: "",
    sortOrder: index + 1,
    enabled: true,
    isFallback: false,
  };
}

type Props = {
  initial: PrizeRow[];
  /** 运行时活动状态：RUNNING 时锁定库存字段 */
  activityStatus: string;
};

export default function PrizeManager({ initial, activityStatus }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PrizeRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const stockLocked = activityStatus === "RUNNING";
  const initialStockByKey = useMemo(() => {
    const map = new Map<string, { stock: number; remainStock: number }>();
    for (const row of initial) {
      map.set(row.key, { stock: row.stock, remainStock: row.remainStock });
    }
    return map;
  }, [initial]);

  const total = rows
    .filter((row) => row.enabled)
    .reduce((sum, row) => sum + Number(row.probability || 0), 0);

  function update(key: string, patch: Partial<PrizeRow>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function add() {
    if (stockLocked) {
      setError(
        "活动进行中不可新增奖品，请先到「活动配置」将状态改为「草稿」或「已结束」",
      );
      return;
    }
    setRows((prev) => [...prev, newRow(prev.length)]);
  }

  async function remove(row: PrizeRow) {
    setError("");
    setMessage("");
    if (!row.id) {
      setRows((prev) => prev.filter((item) => item.key !== row.key));
      return;
    }
    const response = await fetch("/api/admin/prizes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message || "删除失败");
      return;
    }
    setRows((prev) => prev.filter((item) => item.key !== row.key));
    router.refresh();
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");

    if (stockLocked) {
      const touchedStock = rows.some((row) => {
        const baseline = initialStockByKey.get(row.key);
        if (!baseline) return true; // 新增行
        return (
          Number(row.stock) !== baseline.stock ||
          Number(row.remainStock) !== baseline.remainStock
        );
      });
      if (touchedStock) {
        setError(
          "活动进行中不可修改库存/剩余库存，请先到「活动配置」将状态改为「草稿」或「已结束」后再改",
        );
        setBusy(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/admin/prizes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prizes: rows.map((row) => ({
            id: row.id,
            level: row.level,
            name: row.name,
            imageUrl: row.imageUrl,
            stock: Number(row.stock) || 0,
            remainStock: Number(row.remainStock) || 0,
            probability: Number(row.probability) || 0,
            description: row.description,
            sortOrder: Number(row.sortOrder) || 0,
            enabled: row.enabled,
            isFallback: row.isFallback,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "保存失败");
        return;
      }
      setMessage(
        stockLocked
          ? "奖品已保存（活动进行中，库存未改动）"
          : "奖品已保存",
      );
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      {stockLocked ? (
        <p className="error-text" style={{ marginTop: 0 }}>
          活动进行中：库存与剩余库存已锁定，避免与抽奖并发导致数据不一致。改库存前请先到{" "}
          <Link href="/admin/settings" className="font-bold underline">
            活动配置
          </Link>{" "}
          将状态改为「草稿」或「已结束」，改完再改回「进行中」。名称、图片、概率等仍可保存。
        </p>
      ) : null}

      <div className="admin-toolbar" style={{ marginBottom: 8 }}>
        <strong>
          概率合计：{total.toFixed(2)}%
          {Math.abs(total - 100) > 0.01 ? "（需等于 100% 才能保存）" : ""}
        </strong>
        <button
          type="button"
          className="admin-btn secondary"
          onClick={add}
          disabled={stockLocked}
        >
          新增奖品
        </button>
        <button type="button" className="admin-btn" onClick={save} disabled={busy}>
          {busy ? "保存中…" : "保存全部"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>奖项</th>
              <th>名称</th>
              <th>图片</th>
              <th>库存</th>
              <th>剩余</th>
              <th>概率%</th>
              <th>排序</th>
              <th>启用</th>
              <th>兜底</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <input
                    className="admin-inline-input"
                    value={row.level}
                    onChange={(event) => update(row.key, { level: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="admin-inline-input"
                    value={row.name}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                  />
                </td>
                <td>
                  <ImageField
                    compact
                    label={row.name || "奖品图"}
                    value={row.imageUrl}
                    hint="/activity/prize-1.webp 或点上传"
                    onChange={(value) => update(row.key, { imageUrl: value })}
                  />
                </td>
                <td>
                  <input
                    className="admin-inline-input narrow"
                    type="number"
                    min={0}
                    value={row.stock}
                    disabled={stockLocked}
                    title={stockLocked ? "活动进行中不可改库存" : undefined}
                    onChange={(event) =>
                      update(row.key, { stock: Number(event.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="admin-inline-input narrow"
                    type="number"
                    min={0}
                    value={row.remainStock}
                    disabled={stockLocked}
                    title={stockLocked ? "活动进行中不可改剩余库存" : undefined}
                    onChange={(event) =>
                      update(row.key, { remainStock: Number(event.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="admin-inline-input narrow"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={row.probability}
                    onChange={(event) =>
                      update(row.key, { probability: Number(event.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="admin-inline-input narrow"
                    type="number"
                    min={0}
                    value={row.sortOrder}
                    onChange={(event) =>
                      update(row.key, { sortOrder: Number(event.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      update(row.key, { enabled: event.target.checked })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.isFallback}
                    onChange={(event) =>
                      update(row.key, { isFallback: event.target.checked })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-btn secondary"
                    onClick={() => remove(row)}
                    disabled={stockLocked && Boolean(row.id)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={10}>还没有奖品，点击「新增奖品」添加</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}
      <p className="redeem-hint">
        「兜底」奖品用于未中奖兜底，不扣减库存；奖品一旦产生中奖记录不能删除，请改为停用。
        修改库存前请先暂停活动（草稿/已结束），避免抽奖并发覆盖剩余库存。
      </p>
    </div>
  );
}
