import Taro from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useMemo, useState } from "react";
import { toast, toastLoading, toastHideLoading } from "../../utils/toast";
import {
  Button,
  Cell,
  Input,
  TextArea,
  Tag,
  Popup, } from "@nutui/nutui-react-taro";
import "./create.scss";

function authHeaders() {
  const token = Taro.getStorageSync("token");
  if (!token) return { "Content-Type": "application/json" };
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function genInvoiceNo() {
  // 公司自己的规则（比如 INVO E2G + 日期 + 自增）
  const ts = Date.now().toString().slice(-8);
  return `INVOE2G${ts}`;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  // V1 简单格式化
  return (Math.round((toNum(n) + Number.EPSILON) * 100) / 100).toFixed(2);
}

export default function ReconcileCreate() {
  // ========== 默认值（你以后可从 profile / 客户档案带入） ==========
  const defaultSeller = useMemo(
    () => ({
      name: "",
      address:
        "",
    }),
    []
  );

  const defaultLogistics = useMemo(
    () => ({
      from: "Yantian, China",
      to: "Dublin, Ireland",
      transport: "By sea",
    }),
    []
  );

  // ========== 主单据 state ==========
  const [doc, setDoc] = useState({
    title: "周期对账单",
    seller: defaultSeller,
    buyer: {
      toName: "",
      toAddress: "",
      toTel: "",
      vatNo: "",
      eoriNo: "",
    },
    invoice: {
      invoiceNo: genInvoiceNo(),
      invoiceDate: todayISO(),
      tradeTerms: "FOB",
      currency: "CNY",
    },
    logistics: defaultLogistics,
    items: [],
  });

  // ========== 弹窗状态 ==========
  const [showEditSeller, setShowEditSeller] = useState(false);
  const [showEditBuyerInvoice, setShowEditBuyerInvoice] = useState(false);
  const [showEditLogistics, setShowEditLogistics] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);

  const emptyItem = {
    marks: "",
    trackingNo: "",
    productName: "",
    material: "",
    hsCode: "",

    unitsPcs: "1",
    quantityPackages: "1",
    unitPriceCny: "0",

    netWeight: "0",
    grossWeight: "0",
    cbm: "0",
    barcode: "",
  };

  const [itemForm, setItemForm] = useState(emptyItem);

  const totals = useMemo(() => {
    const totalAmount = doc.items.reduce((s, it) => {
      const amt = toNum(it.unitsPcs) * toNum(it.unitPriceCny);
      return s + amt;
    }, 0);
    return { totalAmount };
  }, [doc.items]);

  // ========== actions ==========
  const openAddItem = () => {
    setEditingIndex(-1);
    setItemForm(emptyItem);
    setShowItemModal(true);
  };

  const openEditItem = (idx) => {
    setEditingIndex(idx);
    setItemForm({ ...doc.items[idx] });
    setShowItemModal(true);
  };

  const deleteItem = (idx) => {
    const next = doc.items.filter((_, i) => i !== idx);
    setDoc((p) => ({ ...p, items: next }));
  };

  const saveItem = () => {
    if (!itemForm.productName.trim()) {
      toast("请填写 Product Name");
      return;
    }
    if (toNum(itemForm.unitsPcs) <= 0) {
      toast("UNITS-PCS 需要 > 0");
      return;
    }
    if (toNum(itemForm.unitPriceCny) <= 0) {
      toast("Unit Price 需要 > 0");
      return;
    }

    const nextItem = { ...itemForm };

    setDoc((p) => {
      const items = [...p.items];
      if (editingIndex >= 0) items[editingIndex] = nextItem;
      else items.push(nextItem);
      return { ...p, items };
    });

    setShowItemModal(false);
  };

    const saveDraftLocal = async () => {
    // ========== basic validation ==========
    if (!doc.buyer.toName.trim()) {
      toast("请填写 TO（收货人）");
      return;
    }
    if (!doc.invoice.invoiceNo.trim()) {
      toast("请填写 INVOICE NO.");
      return;
    }
    if (doc.items.length === 0) {
      toast("请至少添加 1 个 Item");
      return;
    }

    // ========== payload mapping (UI -> API) ==========
    const payload = {
      customer_id: "f8b43cb1-fbd9-4918-9506-c4b1bf33de78", // TODO: later load from login/profile
      exporter_jsonb: {
        name: doc.seller?.name || "",
        address: doc.seller?.address || "",
      },
      to_company: doc.buyer?.toName || "",
      to_tel: doc.buyer?.toTel || "",
      to_vat_no: doc.buyer?.vatNo || "",
      eori_no: doc.buyer?.eoriNo || "",
      invoice_no: doc.invoice?.invoiceNo || "",
      currency: doc.invoice?.currency || "",
      trade_terms: doc.invoice?.tradeTerms || "",
      logistics_to: doc.logistics?.to || "",
      logistics_transport: doc.logistics?.transport || "",
      logistics_from: doc.logistics?.from || "",
      items: (doc.items || []).map((it) => ({
        marks_nos: it.marks || "",
        tracking_no: it.trackingNo || "",
        product_name: it.productName || "",
        material: it.material || "",
        hs_code: it.hsCode || "",
        units_pcs: toNum(it.unitsPcs),
        packages: toNum(it.quantityPackages) || 1,
        unit_price: Number(money(it.unitPriceCny)),
        net_weight: toNum(it.netWeight) || null,
        gross_weight: toNum(it.grossWeight) || null,
        cbm: toNum(it.cbm) || null,
        barcode: it.barcode || "",
      })),
    };

    // ========== POST ==========
    try {
      toastLoading("保存中...");

      const res = await Taro.request({
        url: "http://127.0.0.1:8000/v1/reconciles",
        method: "POST",
        header: authHeaders(),
        data: payload,
      });

      // FastAPI 常见：成功时 200/201，失败时也可能是 200 但带 detail
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const data = res.data || {};
        const id = data.id || data.reconcile_id || data.uuid;

        toast("已保存 ✅");

        // 保存后跳详情页（优先用后端返回 id）
        Taro.navigateTo({
          url: `/pages/reconcile/detail?id=${encodeURIComponent(id || "")}`,
        });
        return;
      }

      // 非 2xx
      const errMsg =
        (res.data && (res.data.detail || res.data.message)) ||
        `保存失败（HTTP ${res.statusCode}）`;
      toast(String(errMsg));
    } catch (e) {
      toast(`网络错误：${String(e?.message || e)}`);
    }
  };

  // ========== UI ==========
  return (
    <View className="cr-page">
            <View className="fab-home" onClick={()=>Taro.reLaunch({ url: '/pages/index/index' })}>
              <Text className="fab-icon">🏠</Text>
            </View>
      <View className="cr-header">
        <Text className="cr-h1">创建运输货物清单</Text>
        <Text className="cr-h2">按 Commercial Invoice & Packing List 填写</Text>
      </View>

      {/* A) Seller Header */}
      <View className="cr-card">
        <View className="cr-cardRow">
          <Text className="cr-cardTitle">SELLER / EXPORTER</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditSeller(true)}
          >
            编辑
          </Button>
        </View>

        <View className="cr-kv">
          <Text className="cr-k">公司</Text>
          <Text className="cr-v">{doc.seller.name}</Text>
        </View>
        <View className="cr-kv">
          <Text className="cr-k">地址</Text>
          <Text className="cr-v">{doc.seller.address}</Text>
        </View>
      </View>

      {/* B) Buyer + Invoice meta */}
      <View className="cr-card">
        <View className="cr-cardRow">
          <Text className="cr-cardTitle">TO + INVOICE META</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditBuyerInvoice(true)}
          >
            编辑
          </Button>
        </View>

        <View className="cr-grid2">
          <View className="cr-block">
            <Text className="cr-blockTitle">TO（收货人）</Text>
            <View className="cr-kv">
              <Text className="cr-k">公司</Text>
              <Text className="cr-v">{doc.buyer.toName || "-"}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">地址</Text>
              <Text className="cr-v">{doc.buyer.toAddress || "-"}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">电话</Text>
              <Text className="cr-v">{doc.buyer.toTel || "-"}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">VAT NO.</Text>
              <Text className="cr-v">{doc.buyer.vatNo || "-"}</Text>
            </View>
          </View>

          <View className="cr-block">
            <Text className="cr-blockTitle">INVOICE</Text>
            <View className="cr-kv">
              <Text className="cr-k">INVOICE NO.</Text>
              <Text className="cr-v">{doc.invoice.invoiceNo}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">INVOICE DATE</Text>
              <Text className="cr-v">{doc.invoice.invoiceDate}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">TRADE TERMS</Text>
              <Text className="cr-v">{doc.invoice.tradeTerms}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">EORI NO.</Text>
              <Text className="cr-v">{doc.buyer.eoriNo || "-"}</Text>
            </View>
            <View className="cr-kv">
              <Text className="cr-k">CURRENCY</Text>
              <Text className="cr-v">{doc.invoice.currency}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logistics line */}
      <View className="cr-card">
        <View className="cr-cardRow">
          <Text className="cr-cardTitle">LOGISTICS</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditLogistics(true)}
          >
            编辑
          </Button>
        </View>

        <View className="cr-kv">
          <Text className="cr-k">From</Text>
          <Text className="cr-v">{doc.logistics.from}</Text>
        </View>
        <View className="cr-kv">
          <Text className="cr-k">To</Text>
          <Text className="cr-v">{doc.logistics.to}</Text>
        </View>
        <View className="cr-kv">
          <Text className="cr-k">Transport</Text>
          <Text className="cr-v">{doc.logistics.transport}</Text>
        </View>
      </View>

      {/* Items */}
      <View className="cr-card">
        <View className="cr-cardRow">
          <Text className="cr-cardTitle">ITEMS</Text>
          <Button size="small" type="primary" onClick={openAddItem}>
            + 添加 Item
          </Button>
        </View>

        {doc.items.length === 0 ? (
          <View className="cr-empty">
            <Text className="cr-muted">暂无 Item，请点击 “+ 添加 Item”</Text>
          </View>
        ) : (
          <View className="cr-itemList">
            {doc.items.map((it, idx) => {
              const amount = toNum(it.unitsPcs) * toNum(it.unitPriceCny);
              return (
                <View key={idx} className="cr-itemCard">
                  <View className="cr-itemTop">
                    <Text className="cr-itemName">
                      {idx + 1}. {it.productName}
                    </Text>
                    <Tag type="primary" round>
                      {doc.invoice.currency}
                    </Tag>
                  </View>

                  <View className="cr-itemMeta">
                    <Text className="cr-muted">HS:</Text>{" "}
                    <Text>{it.hsCode || "-"}</Text>
                    <Text className="cr-dot">·</Text>
                    <Text className="cr-muted">Material:</Text>{" "}
                    <Text>{it.material || "-"}</Text>
                  </View>

                  <View className="cr-itemMeta">
                    <Text className="cr-muted">UNITS-PCS:</Text>{" "}
                    <Text>{it.unitsPcs}</Text>
                    <Text className="cr-dot">·</Text>
                    <Text className="cr-muted">Packages:</Text>{" "}
                    <Text>{it.quantityPackages || "-"}</Text>
                  </View>

                  <View className="cr-itemMeta">
                    <Text className="cr-muted">Unit Price:</Text>{" "}
                    <Text>{money(it.unitPriceCny)}</Text>
                    <Text className="cr-dot">·</Text>
                    <Text className="cr-muted">Total:</Text>{" "}
                    <Text className="cr-strong">{money(amount)}</Text>
                  </View>

                  <View className="cr-itemMeta">
                    <Text className="cr-muted">Net/Gross:</Text>{" "}
                    <Text>
                      {it.netWeight || "-"} / {it.grossWeight || "-"}
                    </Text>
                    <Text className="cr-dot">·</Text>
                    <Text className="cr-muted">CBM:</Text>{" "}
                    <Text>{it.cbm || "-"}</Text>
                  </View>

                  <View className="cr-itemActions">
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

        <View className="cr-sumRow">
          <Text className="cr-muted">Total Amount（合计）:</Text>
          <Text className="cr-sum">{money(totals.totalAmount)} {doc.invoice.currency}</Text>
        </View>
      </View>

      {/* Bottom bar */}
      <View className="cr-bottomBar">
        <Button block type="primary" onClick={saveDraftLocal}>
          保存并进入详情
        </Button>
      </View>

      {/* ====== Seller Popup ====== */}
      <Popup
        visible={showEditSeller}
        position="bottom"
        onClose={() => setShowEditSeller(false)}
        className="cr-popup"
      >
        <View className="cr-popupHeader">
          <Text className="cr-popupTitle">编辑 SELLER</Text>
          <Button size="small" type="default" onClick={() => setShowEditSeller(false)}>
            关闭
          </Button>
        </View>

        <Cell title="公司">
          <Input
            value={doc.seller.name}
            onChange={(v) =>
              setDoc((p) => ({ ...p, seller: { ...p.seller, name: v } }))
            }
            placeholder='例如: "LONG LINK TRADING LTD"（出口商公司全称）'
          />
        </Cell>

        <Cell title="地址">
          <TextArea
            value={doc.seller.address}
            onChange={(v) =>
              setDoc((p) => ({ ...p, seller: { ...p.seller, address: v } }))
            }
            placeholder='例如: "ADD: 3 ZHONG SHAN 3RD STREET, ZHONG SHAN, CHINA, 528400"\n英文地址，按商业发票格式'
            rows={3}
          />
        </Cell>

        <View className="cr-popupFooter">
          <Button block type="primary" onClick={() => setShowEditSeller(false)}>
            保存
          </Button>
        </View>
      </Popup>

      {/* ====== Buyer + Invoice Popup ====== */}
      <Popup
        visible={showEditBuyerInvoice}
        position="bottom"
        onClose={() => setShowEditBuyerInvoice(false)}
        className="cr-buyerPopup"
      >
        {/* Header 固定 */}
        <View className="cr-popupHeader cr-stickyTop">
          <Text className="cr-popupTitle">编辑 TO + INVOICE</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditBuyerInvoice(false)}
          >
            关闭
          </Button>
        </View>

        {/* 内容可滚动：避免小屏拥挤 */}
        <View className="cr-popupBody cr-scrollY">
          <View className="cr-popupSectionTitle">TO（收货人）</View>
          <Cell title="TO">
            <Input
              value={doc.buyer.toName}
              onChange={(v) =>
                setDoc((p) => ({ ...p, buyer: { ...p.buyer, toName: v } }))
              }
              placeholder='例如: "Bite of China Ltd"（收货人公司全称）'
            />
          </Cell>
          <Cell title="ADD">
            <TextArea
              value={doc.buyer.toAddress}
              onChange={(v) =>
                setDoc((p) => ({ ...p, buyer: { ...p.buyer, toAddress: v } }))
              }
              placeholder='例如: "59 Georges Street Lower, Dún Laoghaire, Dublin A96 EW71"\n完整英文收货地址'
              rows={2}
              autosize
            />
          </Cell>
          <Cell title="TEL">
            <Input
              value={doc.buyer.toTel}
              onChange={(v) =>
                setDoc((p) => ({ ...p, buyer: { ...p.buyer, toTel: v } }))
              }
              placeholder="+353 1 2311726（固定电话或手机）"
            />
          </Cell>
          <Cell title="VAT NO.">
            <Input
              value={doc.buyer.vatNo}
              onChange={(v) =>
                setDoc((p) => ({ ...p, buyer: { ...p.buyer, vatNo: v } }))
              }
              placeholder='例如: "IE4145006KH"（欧盟VAT，如适用）'
            />
          </Cell>

          <View className="cr-popupSectionTitle">INVOICE</View>

          {/* 小字段两列排版：更不挤 */}
          <View className="cr-formGrid2">
            <View className="cr-formItem">
              <Text className="cr-formLabel">INVOICE NO.</Text>
              <Input
                value={doc.invoice.invoiceNo}
                onChange={(v) =>
                  setDoc((p) => ({
                    ...p,
                    invoice: { ...p.invoice, invoiceNo: v },
                  }))
                }
                placeholder='例如: "GSAM240109001"'
              />
            </View>

            <View className="cr-formItem">
              <Text className="cr-formLabel">INVOICE DATE</Text>
              <Input
                value={doc.invoice.invoiceDate}
                onChange={(v) =>
                  setDoc((p) => ({
                    ...p,
                    invoice: { ...p.invoice, invoiceDate: v },
                  }))
                }
                placeholder='例如: "2026-01-11"'
              />
            </View>

            <View className="cr-formItem">
              <Text className="cr-formLabel">TRADE TERMS</Text>
              <Input
                value={doc.invoice.tradeTerms}
                onChange={(v) =>
                  setDoc((p) => ({
                    ...p,
                    invoice: { ...p.invoice, tradeTerms: v },
                  }))
                }
                placeholder='例如: "FOB / CIF / EXW / DAP"'
              />
            </View>

            <View className="cr-formItem">
              <Text className="cr-formLabel">CURRENCY</Text>
              <Input
                value={doc.invoice.currency}
                onChange={(v) =>
                  setDoc((p) => ({
                    ...p,
                    invoice: { ...p.invoice, currency: v },
                  }))
                }
                placeholder='例如: "CNY / EUR / USD"'
              />
            </View>

            <View className="cr-formItem cr-full">
              <Text className="cr-formLabel">EORI NO.</Text>
              <Input
                value={doc.buyer.eoriNo}
                onChange={(v) =>
                  setDoc((p) => ({ ...p, buyer: { ...p.buyer, eoriNo: v } }))
                }
                placeholder='例如: "IE4145006KH"（EORI清关号，如适用）'
              />
            </View>
          </View>
        </View>

        {/* Footer 固定 */}
        <View className="cr-popupFooter cr-stickyBottom">
          <Button block type="primary" onClick={() => setShowEditBuyerInvoice(false)}>
            保存
          </Button>
        </View>
      </Popup>

{/* ====== Logistics Popup ====== */}
      <Popup
        visible={showEditLogistics}
        position="bottom"
        onClose={() => setShowEditLogistics(false)}
        className="cr-popup"
      >
        <View className="cr-popupHeader">
          <Text className="cr-popupTitle">编辑 LOGISTICS</Text>
          <Button size="small" type="default" onClick={() => setShowEditLogistics(false)}>
            关闭
          </Button>
        </View>

        <Cell title="From">
          <Input
            value={doc.logistics.from}
            onChange={(v) => setDoc((p) => ({ ...p, logistics: { ...p.logistics, from: v } }))}
            placeholder='例如: "Yantian, China"（起运港/城市+国家）'
          />
        </Cell>
        <Cell title="To">
          <Input
            value={doc.logistics.to}
            onChange={(v) => setDoc((p) => ({ ...p, logistics: { ...p.logistics, to: v } }))}
            placeholder='例如: "Dublin, Ireland"（目的港/城市+国家）'
          />
        </Cell>
        <Cell title="Transport">
          <Input
            value={doc.logistics.transport}
            onChange={(v) =>
              setDoc((p) => ({ ...p, logistics: { ...p.logistics, transport: v } }))
            }
            placeholder='例如: "By Sea / By Air / Express"'
          />
        </Cell>

        <View className="cr-popupFooter">
          <Button block type="primary" onClick={() => setShowEditLogistics(false)}>
            保存
          </Button>
        </View>
      </Popup>

    {/* ====== Item Modal ====== */}
    <Popup
    visible={showItemModal}
    position="bottom"
    onClose={() => setShowItemModal(false)}
    className="cr-itemPopup"
    >
    {/* Header 固定 */}
    <View className="cr-popupHeader cr-stickyTop">
    <Text className="cr-popupTitle">
    {editingIndex >= 0 ? "编辑 Item" : "添加 Item"}
    </Text>
    <Button size="small" type="default" onClick={() => setShowItemModal(false)}>
    关闭
    </Button>
    </View>

    {/* 内容可滚动 */}
    <View className="cr-popupBody cr-scrollY">

    {/* 长字段：单独一行 */}
    <View className="cr-field cr-full">
    <Text className="cr-label">Product Name（货品名称）*</Text>
    <Input
    value={itemForm.productName}
    onChange={(v) => setItemForm((p) => ({ ...p, productName: v }))}
    placeholder='例如: "Electric Scooter"'
    />
    </View>

    <View className="cr-field cr-full">
    <Text className="cr-label">MARKS & Nos（唛头）</Text>
    <Input
    value={itemForm.marks}
    onChange={(v) => setItemForm((p) => ({ ...p, marks: v }))}
    placeholder='例如: "CTN-001~010"（纸箱编号范围）'
    />
    </View>

    {/* 3列网格：短字段集中排 */}
    <View className="cr-grid3">
    <View className="cr-field">
    <Text className="cr-label">Tracking No</Text>
    <Input
    value={itemForm.trackingNo}
    onChange={(v) => setItemForm((p) => ({ ...p, trackingNo: v }))}
    placeholder='例如: "GLS123456789"'
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">HS Code</Text>
    <Input
    value={itemForm.hsCode}
    onChange={(v) => setItemForm((p) => ({ ...p, hsCode: v }))}
    placeholder='例如: "87116090"'
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">Material</Text>
    <Input
    value={itemForm.material}
    onChange={(v) => setItemForm((p) => ({ ...p, material: v }))}
    placeholder='例如: "Aluminium Alloy"'
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">Units (pcs)*</Text>
    <Input
    type="digit"
    value={itemForm.unitsPcs}
    onChange={(v) => setItemForm((p) => ({ ...p, unitsPcs: v }))}
    placeholder="例如: 10"
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">Packages</Text>
    <Input
    type="digit"
    value={itemForm.quantityPackages}
    onChange={(v) => setItemForm((p) => ({ ...p, quantityPackages: v }))}
    placeholder="例如: 2（纸箱/包裹数）"
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">Unit Price*</Text>
    <Input
    type="digit"
    value={itemForm.unitPriceCny}
    onChange={(v) => setItemForm((p) => ({ ...p, unitPriceCny: v }))}
    placeholder="例如: 299.99"
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">Net Wt (kg)</Text>
    <Input
    type="digit"
    value={itemForm.netWeight}
    onChange={(v) => setItemForm((p) => ({ ...p, netWeight: v }))}
    placeholder="例如: 120.5"
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">Gross Wt (kg)</Text>
    <Input
    type="digit"
    value={itemForm.grossWeight}
    onChange={(v) => setItemForm((p) => ({ ...p, grossWeight: v }))}
    placeholder="例如: 135"
    />
    </View>

    <View className="cr-field">
    <Text className="cr-label">CBM (m³)</Text>
    <Input
    type="digit"
    value={itemForm.cbm}
    onChange={(v) => setItemForm((p) => ({ ...p, cbm: v }))}
    placeholder="例如: 1.25"
    />
    </View>
    </View>

    {/* 条码预留：单独一行更舒服 */}
    <View className="cr-field cr-full">
    <Text className="cr-label">Barcode / QR（预留）</Text>
    <Input
    value={itemForm.barcode}
    onChange={(v) => setItemForm((p) => ({ ...p, barcode: v }))}
    placeholder='例如: "EAN1234567890123"（可留空）'
    />
    </View>

    {/* 自动计算：放在内容末尾但仍在滚动区 */}
    <View className="cr-calcRow">
    <Text className="cr-muted">Total Amount（自动）</Text>
    <Text className="cr-strong">
    {money(toNum(itemForm.unitsPcs) * toNum(itemForm.unitPriceCny))}
    </Text>
    </View>
    </View>

    {/* Footer 固定 */}
    <View className="cr-popupFooter cr-stickyBottom">
    <Button block type="primary" onClick={saveItem}>
    保存 Item
    </Button>
    </View>
    </Popup>

    </View>
  );
}

