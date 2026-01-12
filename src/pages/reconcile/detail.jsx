import Taro, { useDidShow, usePullDownRefresh, useRouter } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useCallback, useMemo, useState } from "react";
import { Button, Tag, Toast } from "@nutui/nutui-react-taro";
import "./detail.scss";

/**
 * Reconcile Detail Page
 * API:
 *   GET /v1/reconciles/:id
 *
 * Example:
 *   http://127.0.0.1:8000/v1/reconciles/855de6ec-ec8c-4f6f-8f2a-2a15ef38a0b7
 */

const API_BASE = "http://127.0.0.1:8000";

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return (Math.round((x + Number.EPSILON) * 100) / 100).toFixed(2);
}

function vOrDash(v) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function friendlyTime(s) {
  if (!s) return "-";
  // "2026-01-11 22:29:11.860346+00" -> "2026-01-11 22:29"
  return String(s).slice(0, 16);
}

export default function ReconcileDetail() {
  const router = useRouter();
  const id = router?.params?.id;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const currency = useMemo(() => data?.currency || "CNY", [data?.currency]);

  const fetchDetail = useCallback(async (opts = { silent: false }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);

    try {
      if (!id) throw new Error("缺少 id 参数");

      const res = await Taro.request({
        url: `${API_BASE}/v1/reconciles/${encodeURIComponent(id)}`,
        method: "GET",
        header: { "Content-Type": "application/json" },
      });

      const status = res?.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        throw new Error(
          `HTTP ${status}: ${
            typeof res?.data === "string" ? res.data : JSON.stringify(res?.data)
          }`
        );
      }

      setData(res?.data || null);
    } catch (e) {
      console.error(e);
      Toast.show({ content: `获取详情失败：${e?.message || e}` });
    } finally {
      if (!silent) setLoading(false);
      try {
        Taro.stopPullDownRefresh();
      } catch (_) {}
    }
  }, [id]);

  useDidShow(() => {
    fetchDetail({ silent: false });
  });

  usePullDownRefresh(() => {
    fetchDetail({ silent: true });
  });

  const goBack = () => {
    Taro.navigateBack();
  };

  const goEdit = () => {
    // 你后面如果有 edit 页面，把这里改掉就行
    Toast.show({ content: "V1 暂未实现编辑页" });
  };

  if (!data) {
    return (
      <View className="page">
        <View className="header">
          <Button size="small" type="default" onClick={goBack}>
            返回
          </Button>
          <Text className="h1">对账单详情</Text>
          <View style={{ width: 52 }} />
        </View>

        <View className="tips">
          <Text className="muted">{loading ? "加载中..." : "暂无数据"}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="page">
      <View className="header">
        <Button size="small" type="default" onClick={goBack}>
          返回
        </Button>

        <View className="headerMid">
          <Text className="h1">{data.invoice_no || "对账单详情"}</Text>
          <Text className="h2">ID: {data.id}</Text>
        </View>

        <Button
          size="small"
          type={data.editable ? "primary" : "default"}
          onClick={goEdit}
          disabled={!data.editable}
        >
          编辑
        </Button>
      </View>

      {/* Meta */}
      <View className="card">
        <View className="cardTop">
          <Text className="cardTitle">META</Text>
          <View className="tags">
            {data.editable ? (
              <Tag type="success" round>
                Editable
              </Tag>
            ) : (
              <Tag type="default" round>
                Locked
              </Tag>
            )}
            {data.is_deleted ? (
              <Tag type="danger" round>
                Deleted
              </Tag>
            ) : null}
            <Tag type="primary" round>
              {currency}
            </Tag>
          </View>
        </View>

        <View className="row">
          <Text className="k">Invoice Date</Text>
          <Text className="v">{vOrDash(data.invoice_date)}</Text>
        </View>

        <View className="row">
          <Text className="k">Trade Terms</Text>
          <Text className="v">{vOrDash(data.trade_terms)}</Text>
        </View>

        <View className="row">
          <Text className="k">Items</Text>
          <Text className="v">{Number(data.item_count ?? 0)}</Text>

          <Text className="dot">·</Text>

          <Text className="k">Total</Text>
          <Text className="v strong">
            {money(data.total_amount)} {currency}
          </Text>
        </View>

        <View className="row">
          <Text className="k">Updated</Text>
          <Text className="v">{friendlyTime(data.updated_at)}</Text>
        </View>
      </View>

      {/* Seller / Exporter */}
      <View className="card">
        <Text className="cardTitle">SELLER / EXPORTER</Text>

        <View className="row">
          <Text className="k">Company</Text>
          <Text className="v">{vOrDash(data.exporter_jsonb?.name)}</Text>
        </View>

        <View className="row">
          <Text className="k">Address</Text>
          <Text className="v">{vOrDash(data.exporter_jsonb?.address)}</Text>
        </View>
      </View>

      {/* TO (Consignee) */}
      <View className="card">
        <Text className="cardTitle">TO（收货人）</Text>

        <View className="row">
          <Text className="k">Company</Text>
          <Text className="v">{vOrDash(data.to_company)}</Text>
        </View>

        <View className="row">
          <Text className="k">Address</Text>
          <Text className="v">{vOrDash(data.to_address)}</Text>
        </View>

        <View className="row">
          <Text className="k">Tel</Text>
          <Text className="v">{vOrDash(data.to_tel)}</Text>
        </View>

        <View className="row">
          <Text className="k">VAT No.</Text>
          <Text className="v">{vOrDash(data.to_vat_no)}</Text>
        </View>

        <View className="row">
          <Text className="k">EORI No.</Text>
          <Text className="v">{vOrDash(data.eori_no)}</Text>
        </View>
      </View>

      {/* Logistics */}
      <View className="card">
        <Text className="cardTitle">LOGISTICS</Text>

        <View className="row">
          <Text className="k">From</Text>
          <Text className="v">{vOrDash(data.logistics_from)}</Text>
        </View>

        <View className="row">
          <Text className="k">To</Text>
          <Text className="v">{vOrDash(data.logistics_to)}</Text>
        </View>

        <View className="row">
          <Text className="k">Transport</Text>
          <Text className="v">{vOrDash(data.logistics_transport)}</Text>
        </View>
      </View>

      {/* Items */}
      <View className="card">
        <View className="cardTop">
          <Text className="cardTitle">ITEMS</Text>
          <Button
            size="small"
            type="default"
            onClick={() => fetchDetail({ silent: false })}
          >
            刷新
          </Button>
        </View>

        {(data.items || []).length === 0 ? (
          <View className="empty">
            <Text className="muted">暂无 Items</Text>
          </View>
        ) : (
          <View className="itemList">
            {(data.items || []).map((it, idx) => {
              const amount = Number(it.units_pcs ?? 0) * Number(it.unit_price ?? 0);
              return (
                <View key={idx} className="itemCard">
                  <View className="itemTop">
                    <Text className="itemName">
                      {idx + 1}. {vOrDash(it.product_name)}
                    </Text>
                    <Tag type="primary" round>
                      {currency}
                    </Tag>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">HS:</Text> <Text>{vOrDash(it.hs_code)}</Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">Material:</Text>{" "}
                    <Text>{vOrDash(it.material)}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Marks:</Text>{" "}
                    <Text>{vOrDash(it.marks_nos)}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Tracking:</Text>{" "}
                    <Text>{vOrDash(it.tracking_no)}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Units:</Text>{" "}
                    <Text>{vOrDash(it.units_pcs)}</Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">Packages:</Text>{" "}
                    <Text>{vOrDash(it.packages)}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Unit Price:</Text>{" "}
                    <Text>{money(it.unit_price)}</Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">Total:</Text>{" "}
                    <Text className="strong">{money(amount)}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Net/Gross:</Text>{" "}
                    <Text>
                      {vOrDash(it.net_weight)} / {vOrDash(it.gross_weight)}
                    </Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">CBM:</Text>{" "}
                    <Text>{vOrDash(it.cbm)}</Text>
                  </View>

                  {it.barcode ? (
                    <View className="itemMeta">
                      <Text className="muted">Barcode:</Text>{" "}
                      <Text>{vOrDash(it.barcode)}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View className="footerHint">
        <Text className="muted">下拉可刷新</Text>
      </View>
    </View>
  );
}
