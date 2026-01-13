import Taro, { useDidShow, usePullDownRefresh } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useCallback, useMemo, useState } from "react";
import { Button, Tag } from "@nutui/nutui-react-taro";
import "./index.scss";

import { toast as Toast, toastLoading, toastHideLoading } from "../../utils/toast";
/**
 * Reconcile List Page
 * API:
 *   GET /v1/reconciles?customer_id=...
 *
 * Expected response:
 * {
 *   "items": [{
 *      "id": "...",
 *      "invoice_no": "...",
 *      "invoice_date": "YYYY-MM-DD",
 *      "editable": true,
 *      "total_amount": 13.3,
 *      "item_count": 2,
 *      "updated_at": "2026-01-11 22:29:11.860346+00"
 *   }]
 * }
 */

const API_BASE = "http://127.0.0.1:8000";

function authHeaders() {
  const token = Taro.getStorageSync("token");
  if (!token) return { "Content-Type": "application/json" };
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const CUSTOMER_ID = Taro.getStorageSync("customer_id") || ""; // TODO: later load from login/profile

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return (Math.round((x + Number.EPSILON) * 100) / 100).toFixed(2);
}

function friendlyTime(s) {
  // backend returns "2026-01-11 22:29:11.860346+00"
  if (!s) return "-";
  // show "2026-01-11 22:29"
  return String(s).slice(0, 16);
}

export default function ReconcileIndex() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);

  const currency = useMemo(() => {
    // list endpoint does not return currency; keep a constant for now
    // If you add currency to backend response later, just read it per-item
    return "CNY";
  }, []);

  const fetchList = useCallback(async (opts = { silent: false }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);

    try {
      const res = await Taro.request({
        url: `${API_BASE}/v1/reconciles`,
        method: "GET",
        data: { customer_id: CUSTOMER_ID },
        header: authHeaders(),
      });

      const status = res?.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        throw new Error(
          `HTTP ${status}: ${
            typeof res?.data === "string" ? res.data : JSON.stringify(res?.data)
          }`
        );
      }

      const items = res?.data?.items || [];
      setList(items);
    } catch (e) {
      console.error(e);
      Toast.show({ content: `获取列表失败：${e?.message || e}` });
    } finally {
      if (!silent) setLoading(false);
      try {
        Taro.stopPullDownRefresh();
      } catch (_) {}
    }
  }, []);

  useDidShow(() => {
    fetchList({ silent: false });
  });

  usePullDownRefresh(() => {
    fetchList({ silent: true });
  });

  const goCreate = () => {
    Taro.navigateTo({ url: "/pages/reconcile/create" });
  };

  const goDetail = (id) => {
    Taro.navigateTo({
      url: `/pages/reconcile/detail?id=${encodeURIComponent(id)}`,
    });
  };

  return (
    <View className="page">
      <View className="header">
        <View className="headerLeft">
          <Text className="h1">核对品名清单</Text>
          <Text className="h2">客户:{CUSTOMER_ID} Role:{Taro.getStorageSync("x_role")}</Text>
        </View>
        <Button size="small" type="primary" onClick={goCreate}>
          + 创建
        </Button>
      </View>

      {loading ? (
        <View className="tips">
          <Text className="muted">加载中...</Text>
        </View>
      ) : null}

      {list.length === 0 && !loading ? (
        <View className="empty">
          <Text className="muted">暂无对账单，点击右上角 “+ 创建”</Text>
        </View>
      ) : (
        <View className="list">
          {list.map((it) => (
            <View key={it.id} className="card" onClick={() => goDetail(it.id)}>
              <View className="cardTop">
                <Text className="title">{it.invoice_no || "-"}</Text>
                <View className="tags">
                  {it.editable ? (
                    <Tag type="success" round>
                      Editable
                    </Tag>
                  ) : (
                    <Tag type="default" round>
                      Locked
                    </Tag>
                  )}
                  <Tag type="primary" round>
                    {currency}
                  </Tag>
                </View>
              </View>

              <View className="row">
                <Text className="k">Invoice Date</Text>
                <Text className="v">{it.invoice_date || "-"}</Text>
              </View>

              <View className="row">
                <Text className="k">Items</Text>
                <Text className="v">{Number(it.item_count ?? 0)}</Text>

                <Text className="dot">·</Text>

                <Text className="k">Total</Text>
                <Text className="v strong">
                  {money(it.total_amount)} {currency}
                </Text>
              </View>

              <View className="row">
                <Text className="k">Updated</Text>
                <Text className="v">{friendlyTime(it.updated_at)}</Text>
              </View>

              <View className="cardBottom">
                <Button
                  size="small"
                  type="default"
                  onClick={(e) => {
                    e?.stopPropagation?.();
                    fetchList({ silent: false });
                  }}
                >
                  刷新
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={(e) => {
                    e?.stopPropagation?.();
                    goDetail(it.id);
                  }}
                >
                  查看详情
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}

      <View className="footerHint">
        <Text className="muted">下拉可刷新</Text>
      </View>
    </View>
  );
}
