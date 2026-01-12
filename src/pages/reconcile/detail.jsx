import Taro, {
  useDidShow,
  usePullDownRefresh,
  useRouter,
} from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  Tag,
  Toast,
  Popup,
  Input,
  TextArea,
} from "@nutui/nutui-react-taro";
import "./detail.scss";

Taro.setStorageSync("x_role", "admin");     // 管理员
// Taro.setStorageSync("x_role", "customer");  // 客户

/**
 * Reconcile Detail Page (方案A：同页查看 + 同页编辑)
 * API:
 *   GET    /v1/reconciles/:id
 *   PATCH  /v1/reconciles/:id
 *
 * Header (V1 临时)：
 *   X-ROLE: admin | customer
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
  return String(s).slice(0, 16);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isAdmin(role) {
  return String(role || "").toLowerCase() === "admin";
}

export default function ReconcileDetail() {
  const router = useRouter();
  const id = router?.params?.id;

  // V1：临时用 storage 或常量模拟角色
  const role = useMemo(() => {
    return Taro.getStorageSync("x_role") || "customer";
  }, []);
  const admin = useMemo(() => isAdmin(role), [role]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // ====== 同页编辑相关 ======
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(null);

  // Item Popup（复用你之前的三列布局）
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);

  const emptyItem = {
    marks_nos: "",
    tracking_no: "",
    product_name: "",
    material: "",
    hs_code: "",

    units_pcs: "1",
    packages: "1",
    unit_price: "0",

    net_weight: "",
    gross_weight: "",
    cbm: "",
    barcode: "",
  };

  const [itemForm, setItemForm] = useState(emptyItem);

  const currency = useMemo(() => data?.currency || "CNY", [data?.currency]);

  const fetchDetail = useCallback(
    async (opts = { silent: false }) => {
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
              typeof res?.data === "string"
                ? res.data
                : JSON.stringify(res?.data)
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
    },
    [id]
  );

  useDidShow(() => {
    fetchDetail({ silent: false });
  });

  usePullDownRefresh(() => {
    fetchDetail({ silent: true });
  });

  const goBack = () => {
    Taro.navigateBack();
  };

  const enterEdit = () => {
    if (!data) return;
    if (!data.editable && !admin) {
      Toast.show({ content: "该对账单已锁定，无法编辑" });
      return;
    }

    // 初始化表单（snake_case 原样保持，直接 PATCH）
    setForm({
      exporter_jsonb: data.exporter_jsonb || {},
      to_company: data.to_company || "",
      to_address: data.to_address || "",
      to_tel: data.to_tel || "",
      to_vat_no: data.to_vat_no || "",
      eori_no: data.eori_no || "",
      invoice_no: data.invoice_no || "",
      invoice_date: data.invoice_date || "",
      trade_terms: data.trade_terms || "",
      currency: data.currency || "CNY",
      logistics_from: data.logistics_from || "",
      logistics_to: data.logistics_to || "",
      logistics_transport: data.logistics_transport || "",
      items: (data.items || []).map((it) => ({
        ...it,
        units_pcs: String(it.units_pcs ?? "1"),
        packages: String(it.packages ?? "1"),
        unit_price: String(it.unit_price ?? "0"),
        net_weight: it.net_weight === null ? "" : String(it.net_weight),
        gross_weight: it.gross_weight === null ? "" : String(it.gross_weight),
        cbm: it.cbm === null ? "" : String(it.cbm),
      })),
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setForm(null);
  };

  const patchSave = async () => {
    if (!form) return;

    if (!form.to_company?.trim()) {
      Toast.show({ content: "请填写 TO（收货人公司）" });
      return;
    }
    if (!form.invoice_no?.trim()) {
      Toast.show({ content: "请填写 INVOICE NO." });
      return;
    }
    if (!form.items || form.items.length === 0) {
      Toast.show({ content: "请至少保留 1 个 Item" });
      return;
    }

    const payload = {
      exporter_jsonb: form.exporter_jsonb,
      to_company: form.to_company,
      to_address: form.to_address,
      to_tel: form.to_tel,
      to_vat_no: form.to_vat_no,
      eori_no: form.eori_no,
      invoice_no: form.invoice_no,
      invoice_date: form.invoice_date,
      trade_terms: form.trade_terms,
      currency: form.currency,
      logistics_from: form.logistics_from,
      logistics_to: form.logistics_to,
      logistics_transport: form.logistics_transport,
      items: (form.items || []).map((it) => ({
        marks_nos: it.marks_nos || "",
        tracking_no: it.tracking_no || "",
        product_name: it.product_name || "",
        material: it.material || "",
        hs_code: it.hs_code || "",
        units_pcs: toNum(it.units_pcs),
        packages: toNum(it.packages) || 1,
        unit_price: toNum(it.unit_price),
        net_weight: it.net_weight === "" ? null : toNum(it.net_weight),
        gross_weight: it.gross_weight === "" ? null : toNum(it.gross_weight),
        cbm: it.cbm === "" ? null : toNum(it.cbm),
        barcode: it.barcode || "",
      })),
    };

    try {
      Toast.show({ content: "保存中..." });

      const res = await Taro.request({
        url: `${API_BASE}/v1/reconciles/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: payload,
        header: {
          "Content-Type": "application/json",
          "X-ROLE": role,
        },
      });

      const status = res?.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        throw new Error(
          `HTTP ${status}: ${
            typeof res?.data === "string"
              ? res.data
              : JSON.stringify(res?.data)
          }`
        );
      }

      Toast.show({ content: "已保存 ✅" });
      setData(res?.data || null);
      setEditMode(false);
      setForm(null);
    } catch (e) {
      console.error(e);
      Toast.show({ content: `保存失败：${e?.message || e}` });
    }
  };

  const toggleLock = async () => {
    if (!admin) return;
    if (!data) return;

    const nextEditable = !data.editable;
    try {
      Toast.show({ content: nextEditable ? "解锁中..." : "锁定中..." });

      const res = await Taro.request({
        url: `${API_BASE}/v1/reconciles/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: { editable: nextEditable },
        header: {
          "Content-Type": "application/json",
          "X-ROLE": role,
        },
      });

      const status = res?.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        throw new Error(
          `HTTP ${status}: ${
            typeof res?.data === "string"
              ? res.data
              : JSON.stringify(res?.data)
          }`
        );
      }

      setData(res?.data || null);

      if (!nextEditable) {
        setEditMode(false);
        setForm(null);
      }
      Toast.show({ content: nextEditable ? "已解锁 ✅" : "已锁定 ✅" });
    } catch (e) {
      console.error(e);
      Toast.show({ content: `操作失败：${e?.message || e}` });
    }
  };

  // ====== Items actions (editMode) ======
  const openAddItem = () => {
    setEditingIndex(-1);
    setItemForm({ ...emptyItem, packages: "1" });
    setShowItemModal(true);
  };

  const openEditItem = (idx) => {
    setEditingIndex(idx);
    const it = (form?.items || [])[idx] || emptyItem;
    setItemForm({
      ...emptyItem,
      ...it,
      units_pcs: String(it.units_pcs ?? "1"),
      packages: String(it.packages ?? "1"),
      unit_price: String(it.unit_price ?? "0"),
      net_weight: it.net_weight === null ? "" : String(it.net_weight ?? ""),
      gross_weight: it.gross_weight === null ? "" : String(it.gross_weight ?? ""),
      cbm: it.cbm === null ? "" : String(it.cbm ?? ""),
    });
    setShowItemModal(true);
  };

  const deleteItem = (idx) => {
    if (!form) return;
    const next = (form.items || []).filter((_, i) => i !== idx);
    setForm((p) => ({ ...p, items: next }));
  };

  const saveItem = () => {
    if (!itemForm.product_name?.trim()) {
      Toast.show({ content: "请填写 Product Name" });
      return;
    }
    if (toNum(itemForm.units_pcs) <= 0) {
      Toast.show({ content: "UNITS-PCS 需要 > 0" });
      return;
    }
    if (toNum(itemForm.unit_price) <= 0) {
      Toast.show({ content: "Unit Price 需要 > 0" });
      return;
    }

    const nextItem = { ...itemForm, packages: itemForm.packages || "1" };

    setForm((p) => {
      const items = [...(p.items || [])];
      if (editingIndex >= 0) items[editingIndex] = nextItem;
      else items.push(nextItem);
      return { ...p, items };
    });

    setShowItemModal(false);
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

        <View className="headerRight">
          {admin ? (
            <Button
              size="small"
              type={data.editable ? "default" : "primary"}
              onClick={toggleLock}
            >
              {data.editable ? "锁定" : "解锁"}
            </Button>
          ) : null}

          {!editMode ? (
            <Button
              size="small"
              type={data.editable ? "primary" : "default"}
              onClick={enterEdit}
              disabled={!data.editable && !admin}
            >
              编辑
            </Button>
          ) : (
            <Button size="small" type="default" onClick={cancelEdit}>
              取消
            </Button>
          )}
        </View>
      </View>

      {!editMode ? (
        <>
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
                <Tag type="default" round>
                  {admin ? "Admin" : "Customer"}
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
                  const amount =
                    Number(it.units_pcs ?? 0) * Number(it.unit_price ?? 0);
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
                        <Text className="muted">HS:</Text>{" "}
                        <Text>{vOrDash(it.hs_code)}</Text>
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
        </>
      ) : (
        <>
          <View className="card">
            <View className="cardTop">
              <Text className="cardTitle">EDIT MODE</Text>
              <Tag type="primary" round>
                PATCH 保存
              </Tag>
            </View>

            <View className="formGrid2">
              <View className="field">
                <Text className="label">TO Company*</Text>
                <Input
                  value={form.to_company}
                  onChange={(v) => setForm((p) => ({ ...p, to_company: v }))}
                  placeholder='例如: "Bite of China Ltd"'
                />
              </View>

              <View className="field">
                <Text className="label">TO Tel</Text>
                <Input
                  value={form.to_tel}
                  onChange={(v) => setForm((p) => ({ ...p, to_tel: v }))}
                  placeholder="+353 1 2311726"
                />
              </View>

              <View className="field full">
                <Text className="label">TO Address</Text>
                <TextArea
                  value={form.to_address}
                  onChange={(v) => setForm((p) => ({ ...p, to_address: v }))}
                  placeholder='例如: "59 Georges Street Lower, Dublin A96 EW71"'
                  rows={3}
                />
              </View>

              <View className="field">
                <Text className="label">VAT No.</Text>
                <Input
                  value={form.to_vat_no}
                  onChange={(v) => setForm((p) => ({ ...p, to_vat_no: v }))}
                  placeholder='例如: "IE4145006KH"'
                />
              </View>

              <View className="field">
                <Text className="label">EORI No.</Text>
                <Input
                  value={form.eori_no}
                  onChange={(v) => setForm((p) => ({ ...p, eori_no: v }))}
                  placeholder='例如: "IE4145006KH"'
                />
              </View>
            </View>
          </View>

          <View className="card">
            <Text className="cardTitle">INVOICE</Text>

            <View className="formGrid2">
              <View className="field">
                <Text className="label">Invoice No.*</Text>
                <Input
                  value={form.invoice_no}
                  onChange={(v) => setForm((p) => ({ ...p, invoice_no: v }))}
                  placeholder='例如: "GSAM240109001"'
                />
              </View>

              <View className="field">
                <Text className="label">Invoice Date</Text>
                <Input
                  value={form.invoice_date}
                  onChange={(v) => setForm((p) => ({ ...p, invoice_date: v }))}
                  placeholder='例如: "2026-01-11"'
                />
              </View>

              <View className="field">
                <Text className="label">Trade Terms</Text>
                <Input
                  value={form.trade_terms}
                  onChange={(v) => setForm((p) => ({ ...p, trade_terms: v }))}
                  placeholder="FOB / CIF / EXW / DAP"
                />
              </View>

              <View className="field">
                <Text className="label">Currency</Text>
                <Input
                  value={form.currency}
                  onChange={(v) => setForm((p) => ({ ...p, currency: v }))}
                  placeholder="CNY / EUR / USD"
                />
              </View>
            </View>
          </View>

          <View className="card">
            <Text className="cardTitle">LOGISTICS</Text>

            <View className="formGrid2">
              <View className="field">
                <Text className="label">From</Text>
                <Input
                  value={form.logistics_from}
                  onChange={(v) => setForm((p) => ({ ...p, logistics_from: v }))}
                  placeholder='例如: "Yantian, China"'
                />
              </View>

              <View className="field">
                <Text className="label">To</Text>
                <Input
                  value={form.logistics_to}
                  onChange={(v) => setForm((p) => ({ ...p, logistics_to: v }))}
                  placeholder='例如: "Dublin, Ireland"'
                />
              </View>

              <View className="field full">
                <Text className="label">Transport</Text>
                <Input
                  value={form.logistics_transport}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, logistics_transport: v }))
                  }
                  placeholder="By Sea / By Air / Express"
                />
              </View>
            </View>
          </View>

          <View className="card">
            <View className="cardTop">
              <Text className="cardTitle">ITEMS</Text>
              <Button size="small" type="primary" onClick={openAddItem}>
                + 添加 Item
              </Button>
            </View>

            {(form.items || []).length === 0 ? (
              <View className="empty">
                <Text className="muted">暂无 Items</Text>
              </View>
            ) : (
              <View className="itemList">
                {(form.items || []).map((it, idx) => {
                  const amount = toNum(it.units_pcs) * toNum(it.unit_price);
                  return (
                    <View key={idx} className="itemCard">
                      <View className="itemTop">
                        <Text className="itemName">
                          {idx + 1}. {vOrDash(it.product_name)}
                        </Text>
                        <Tag type="primary" round>
                          {form.currency || "CNY"}
                        </Tag>
                      </View>

                      <View className="itemMeta">
                        <Text className="muted">HS:</Text>{" "}
                        <Text>{vOrDash(it.hs_code)}</Text>
                        <Text className="dot">·</Text>
                        <Text className="muted">Material:</Text>{" "}
                        <Text>{vOrDash(it.material)}</Text>
                      </View>

                      <View className="itemMeta">
                        <Text className="muted">Units:</Text>{" "}
                        <Text>{vOrDash(it.units_pcs)}</Text>
                        <Text className="dot">·</Text>
                        <Text className="muted">Packages:</Text>{" "}
                        <Text>{vOrDash(it.packages)}</Text>
                        <Text className="dot">·</Text>
                        <Text className="muted">Total:</Text>{" "}
                        <Text className="strong">{money(amount)}</Text>
                      </View>

                      <View className="itemActions">
                        <Button size="small" type="default" onClick={() => openEditItem(idx)}>
                          编辑
                        </Button>
                        <Button size="small" type="danger" onClick={() => deleteItem(idx)}>
                          删除
                        </Button>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View className="saveBar">
              <Button block type="primary" onClick={patchSave}>
                保存（PATCH）
              </Button>
            </View>
          </View>

          <View className="footerHint">
            <Text className="muted">
              角色：{admin ? "Admin" : "Customer"}（Header: X-ROLE）
            </Text>
          </View>
        </>
      )}

      <Popup
        visible={showItemModal}
        position="bottom"
        onClose={() => setShowItemModal(false)}
        className="itemPopup"
      >
        <View className="popupHeader stickyTop">
          <Text className="popupTitle">
            {editingIndex >= 0 ? "编辑 Item" : "添加 Item"}
          </Text>
          <Button size="small" type="default" onClick={() => setShowItemModal(false)}>
            关闭
          </Button>
        </View>

        <View className="popupBody scrollY">
          <View className="field full">
            <Text className="label">Product Name（货品名称）*</Text>
            <Input
              value={itemForm.product_name}
              onChange={(v) => setItemForm((p) => ({ ...p, product_name: v }))}
              placeholder='例如: "Electric Scooter"'
            />
          </View>

          <View className="field full">
            <Text className="label">MARKS & Nos（唛头）</Text>
            <Input
              value={itemForm.marks_nos}
              onChange={(v) => setItemForm((p) => ({ ...p, marks_nos: v }))}
              placeholder='例如: "CTN-001~010"'
            />
          </View>

          <View className="grid3">
            <View className="field">
              <Text className="label">Tracking No</Text>
              <Input
                value={itemForm.tracking_no}
                onChange={(v) => setItemForm((p) => ({ ...p, tracking_no: v }))}
                placeholder='例如: "GLS123456789"'
              />
            </View>

            <View className="field">
              <Text className="label">HS Code</Text>
              <Input
                value={itemForm.hs_code}
                onChange={(v) => setItemForm((p) => ({ ...p, hs_code: v }))}
                placeholder='例如: "87116090"'
              />
            </View>

            <View className="field">
              <Text className="label">Material</Text>
              <Input
                value={itemForm.material}
                onChange={(v) => setItemForm((p) => ({ ...p, material: v }))}
                placeholder='例如: "Aluminium Alloy"'
              />
            </View>

            <View className="field">
              <Text className="label">Units (pcs)*</Text>
              <Input
                type="digit"
                value={itemForm.units_pcs}
                onChange={(v) => setItemForm((p) => ({ ...p, units_pcs: v }))}
                placeholder="例如: 10"
              />
            </View>

            <View className="field">
              <Text className="label">Packages</Text>
              <Input
                type="digit"
                value={itemForm.packages}
                onChange={(v) => setItemForm((p) => ({ ...p, packages: v }))}
                placeholder="默认 1"
              />
            </View>

            <View className="field">
              <Text className="label">Unit Price*</Text>
              <Input
                type="digit"
                value={itemForm.unit_price}
                onChange={(v) => setItemForm((p) => ({ ...p, unit_price: v }))}
                placeholder="例如: 299.99"
              />
            </View>

            <View className="field">
              <Text className="label">Net Wt (kg)</Text>
              <Input
                type="digit"
                value={itemForm.net_weight}
                onChange={(v) => setItemForm((p) => ({ ...p, net_weight: v }))}
                placeholder="可留空"
              />
            </View>

            <View className="field">
              <Text className="label">Gross Wt (kg)</Text>
              <Input
                type="digit"
                value={itemForm.gross_weight}
                onChange={(v) => setItemForm((p) => ({ ...p, gross_weight: v }))}
                placeholder="可留空"
              />
            </View>

            <View className="field">
              <Text className="label">CBM (m³)</Text>
              <Input
                type="digit"
                value={itemForm.cbm}
                onChange={(v) => setItemForm((p) => ({ ...p, cbm: v }))}
                placeholder="可留空"
              />
            </View>
          </View>

          <View className="field full">
            <Text className="label">Barcode</Text>
            <Input
              value={itemForm.barcode}
              onChange={(v) => setItemForm((p) => ({ ...p, barcode: v }))}
              placeholder='例如: "EAN1234567890123"'
            />
          </View>

          <View className="calcRow">
            <Text className="muted">Total Amount（自动）</Text>
            <Text className="strong">
              {money(toNum(itemForm.units_pcs) * toNum(itemForm.unit_price))}
            </Text>
          </View>
        </View>

        <View className="popupFooter stickyBottom">
          <Button block type="primary" onClick={saveItem}>
            保存 Item
          </Button>
        </View>
      </Popup>
    </View>
  );
}
