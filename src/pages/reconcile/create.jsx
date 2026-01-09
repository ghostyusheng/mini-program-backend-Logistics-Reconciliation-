import Taro from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useMemo, useState } from "react";
import {
  Button,
  Cell,
  Input,
  TextArea,
  Tag,
  Popup,
  Toast,
} from "@nutui/nutui-react-taro";
import "./create.scss";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function genInvoiceNo() {
  // 你可以换成你们自己的规则（比如 GSAM + 日期 + 自增）
  const ts = Date.now().toString().slice(-6);
  return `GSAM${ts}`;
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
      name: "LONG LINK TRADING LTD",
      address:
        "ADD: 3 ZHONG SHAN 3RD STREET LUING, PLAZA ZHONG SHAN ZHONG SHAN CHINA, 528400",
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
      toName: "Bite of China",
      toAddress: "59 George's Street Lower, Dún Laoghaire, Dublin A96 EW71",
      toTel: "01 2311726",
      vatNo: "4145006KH",
      eoriNo: "4145006KH",
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

    unitsPcs: "",
    quantityPackages: "",
    unitPriceCny: "",

    netWeight: "",
    grossWeight: "",
    cbm: "",
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
      Toast.show({ content: "请填写 Product Name" });
      return;
    }
    if (toNum(itemForm.unitsPcs) <= 0) {
      Toast.show({ content: "UNITS-PCS 需要 > 0" });
      return;
    }
    if (toNum(itemForm.unitPriceCny) <= 0) {
      Toast.show({ content: "Unit Price 需要 > 0" });
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

  const saveDraftLocal = () => {
    if (!doc.buyer.toName.trim()) {
      Toast.show({ content: "请填写 TO（收货人）" });
      return;
    }
    if (!doc.invoice.invoiceNo.trim()) {
      Toast.show({ content: "请填写 INVOICE NO." });
      return;
    }
    if (doc.items.length === 0) {
      Toast.show({ content: "请至少添加 1 个 Item" });
      return;
    }

    const id = `R-${Date.now()}`;
    const payload = { id, ...doc, createdAt: new Date().toISOString() };

    // V1：本地保存，后面你接 API 替换这里
    const list = Taro.getStorageSync("reconciles") || [];
    list.unshift(payload);
    Taro.setStorageSync("reconciles", list);

    Toast.show({ content: "已保存 ✅" });

    // 保存后跳详情页
    Taro.navigateTo({
      url: `/pages/reconcile/detail?id=${encodeURIComponent(id)}`,
    });
  };

  // ========== UI ==========
  return (
    <View className="page">
      <View className="header">
        <Text className="h1">创建对账单</Text>
        <Text className="h2">按 Commercial Invoice & Packing List 填写</Text>
      </View>

      {/* A) Seller Header */}
      <View className="card">
        <View className="cardRow">
          <Text className="cardTitle">SELLER / EXPORTER</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditSeller(true)}
          >
            编辑
          </Button>
        </View>

        <View className="kv">
          <Text className="k">公司</Text>
          <Text className="v">{doc.seller.name}</Text>
        </View>
        <View className="kv">
          <Text className="k">地址</Text>
          <Text className="v">{doc.seller.address}</Text>
        </View>
      </View>

      {/* B) Buyer + Invoice meta */}
      <View className="card">
        <View className="cardRow">
          <Text className="cardTitle">TO + INVOICE META</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditBuyerInvoice(true)}
          >
            编辑
          </Button>
        </View>

        <View className="grid2">
          <View className="block">
            <Text className="blockTitle">TO（收货人）</Text>
            <View className="kv">
              <Text className="k">公司</Text>
              <Text className="v">{doc.buyer.toName || "-"}</Text>
            </View>
            <View className="kv">
              <Text className="k">地址</Text>
              <Text className="v">{doc.buyer.toAddress || "-"}</Text>
            </View>
            <View className="kv">
              <Text className="k">电话</Text>
              <Text className="v">{doc.buyer.toTel || "-"}</Text>
            </View>
            <View className="kv">
              <Text className="k">VAT NO.</Text>
              <Text className="v">{doc.buyer.vatNo || "-"}</Text>
            </View>
          </View>

          <View className="block">
            <Text className="blockTitle">INVOICE</Text>
            <View className="kv">
              <Text className="k">INVOICE NO.</Text>
              <Text className="v">{doc.invoice.invoiceNo}</Text>
            </View>
            <View className="kv">
              <Text className="k">INVOICE DATE</Text>
              <Text className="v">{doc.invoice.invoiceDate}</Text>
            </View>
            <View className="kv">
              <Text className="k">TRADE TERMS</Text>
              <Text className="v">{doc.invoice.tradeTerms}</Text>
            </View>
            <View className="kv">
              <Text className="k">EORI NO.</Text>
              <Text className="v">{doc.buyer.eoriNo || "-"}</Text>
            </View>
            <View className="kv">
              <Text className="k">CURRENCY</Text>
              <Text className="v">{doc.invoice.currency}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logistics line */}
      <View className="card">
        <View className="cardRow">
          <Text className="cardTitle">LOGISTICS</Text>
          <Button
            size="small"
            type="default"
            onClick={() => setShowEditLogistics(true)}
          >
            编辑
          </Button>
        </View>

        <View className="kv">
          <Text className="k">From</Text>
          <Text className="v">{doc.logistics.from}</Text>
        </View>
        <View className="kv">
          <Text className="k">To</Text>
          <Text className="v">{doc.logistics.to}</Text>
        </View>
        <View className="kv">
          <Text className="k">Transport</Text>
          <Text className="v">{doc.logistics.transport}</Text>
        </View>
      </View>

      {/* Items */}
      <View className="card">
        <View className="cardRow">
          <Text className="cardTitle">ITEMS</Text>
          <Button size="small" type="primary" onClick={openAddItem}>
            + 添加 Item
          </Button>
        </View>

        {doc.items.length === 0 ? (
          <View className="empty">
            <Text className="muted">暂无 Item，请点击 “+ 添加 Item”</Text>
          </View>
        ) : (
          <View className="itemList">
            {doc.items.map((it, idx) => {
              const amount = toNum(it.unitsPcs) * toNum(it.unitPriceCny);
              return (
                <View key={idx} className="itemCard">
                  <View className="itemTop">
                    <Text className="itemName">
                      {idx + 1}. {it.productName}
                    </Text>
                    <Tag type="primary" round>
                      {doc.invoice.currency}
                    </Tag>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">HS:</Text>{" "}
                    <Text>{it.hsCode || "-"}</Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">Material:</Text>{" "}
                    <Text>{it.material || "-"}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">UNITS-PCS:</Text>{" "}
                    <Text>{it.unitsPcs}</Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">Packages:</Text>{" "}
                    <Text>{it.quantityPackages || "-"}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Unit Price:</Text>{" "}
                    <Text>{money(it.unitPriceCny)}</Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">Total:</Text>{" "}
                    <Text className="strong">{money(amount)}</Text>
                  </View>

                  <View className="itemMeta">
                    <Text className="muted">Net/Gross:</Text>{" "}
                    <Text>
                      {it.netWeight || "-"} / {it.grossWeight || "-"}
                    </Text>
                    <Text className="dot">·</Text>
                    <Text className="muted">CBM:</Text>{" "}
                    <Text>{it.cbm || "-"}</Text>
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

        <View className="sumRow">
          <Text className="muted">Total Amount（合计）:</Text>
          <Text className="sum">{money(totals.totalAmount)} {doc.invoice.currency}</Text>
        </View>
      </View>

      {/* Bottom bar */}
      <View className="bottomBar">
        <Button block type="primary" onClick={saveDraftLocal}>
          保存并进入详情
        </Button>
      </View>

      {/* ====== Seller Popup ====== */}
      <Popup
        visible={showEditSeller}
        position="bottom"
        onClose={() => setShowEditSeller(false)}
        className="popup"
      >
        <View className="popupHeader">
          <Text className="popupTitle">编辑 SELLER</Text>
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
            placeholder="公司名"
          />
        </Cell>

        <Cell title="地址">
          <TextArea
            value={doc.seller.address}
            onChange={(v) =>
              setDoc((p) => ({ ...p, seller: { ...p.seller, address: v } }))
            }
            placeholder="地址"
            rows={3}
          />
        </Cell>

        <View className="popupFooter">
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
        className="popup"
      >
        <View className="popupHeader">
          <Text className="popupTitle">编辑 TO + INVOICE</Text>
          <Button size="small" type="default" onClick={() => setShowEditBuyerInvoice(false)}>
            关闭
          </Button>
        </View>

        <View className="popupSectionTitle">TO（收货人）</View>
        <Cell title="TO">
          <Input
            value={doc.buyer.toName}
            onChange={(v) => setDoc((p) => ({ ...p, buyer: { ...p.buyer, toName: v } }))}
            placeholder="收货人公司名"
          />
        </Cell>
        <Cell title="ADD">
          <TextArea
            value={doc.buyer.toAddress}
            onChange={(v) =>
              setDoc((p) => ({ ...p, buyer: { ...p.buyer, toAddress: v } }))
            }
            placeholder="收货地址"
            rows={3}
          />
        </Cell>
        <Cell title="TEL">
          <Input
            value={doc.buyer.toTel}
            onChange={(v) => setDoc((p) => ({ ...p, buyer: { ...p.buyer, toTel: v } }))}
            placeholder="电话"
          />
        </Cell>
        <Cell title="VAT NO.">
          <Input
            value={doc.buyer.vatNo}
            onChange={(v) => setDoc((p) => ({ ...p, buyer: { ...p.buyer, vatNo: v } }))}
            placeholder="VAT（可选）"
          />
        </Cell>

        <View className="popupSectionTitle">INVOICE</View>
        <Cell title="INVOICE NO.">
          <Input
            value={doc.invoice.invoiceNo}
            onChange={(v) =>
              setDoc((p) => ({ ...p, invoice: { ...p.invoice, invoiceNo: v } }))
            }
            placeholder="发票号"
          />
        </Cell>
        <Cell title="INVOICE DATE">
          <Input
            value={doc.invoice.invoiceDate}
            onChange={(v) =>
              setDoc((p) => ({ ...p, invoice: { ...p.invoice, invoiceDate: v } }))
            }
            placeholder="YYYY-MM-DD"
          />
        </Cell>
        <Cell title="TRADE TERMS">
          <Input
            value={doc.invoice.tradeTerms}
            onChange={(v) =>
              setDoc((p) => ({ ...p, invoice: { ...p.invoice, tradeTerms: v } }))
            }
            placeholder="FOB / CIF / EXW"
          />
        </Cell>
        <Cell title="EORI NO.">
          <Input
            value={doc.buyer.eoriNo}
            onChange={(v) => setDoc((p) => ({ ...p, buyer: { ...p.buyer, eoriNo: v } }))}
            placeholder="公司客户填写（可选）"
          />
        </Cell>
        <Cell title="CURRENCY">
          <Input
            value={doc.invoice.currency}
            onChange={(v) =>
              setDoc((p) => ({ ...p, invoice: { ...p.invoice, currency: v } }))
            }
            placeholder="CNY / EUR"
          />
        </Cell>

        <View className="popupFooter">
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
        className="popup"
      >
        <View className="popupHeader">
          <Text className="popupTitle">编辑 LOGISTICS</Text>
          <Button size="small" type="default" onClick={() => setShowEditLogistics(false)}>
            关闭
          </Button>
        </View>

        <Cell title="From">
          <Input
            value={doc.logistics.from}
            onChange={(v) => setDoc((p) => ({ ...p, logistics: { ...p.logistics, from: v } }))}
            placeholder="发货地"
          />
        </Cell>
        <Cell title="To">
          <Input
            value={doc.logistics.to}
            onChange={(v) => setDoc((p) => ({ ...p, logistics: { ...p.logistics, to: v } }))}
            placeholder="目的地"
          />
        </Cell>
        <Cell title="Transport">
          <Input
            value={doc.logistics.transport}
            onChange={(v) =>
              setDoc((p) => ({ ...p, logistics: { ...p.logistics, transport: v } }))
            }
            placeholder="By sea / By air"
          />
        </Cell>

        <View className="popupFooter">
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
        className="popup"
      >
        <View className="popupHeader">
          <Text className="popupTitle">
            {editingIndex >= 0 ? "编辑 Item" : "添加 Item"}
          </Text>
          <Button size="small" type="default" onClick={() => setShowItemModal(false)}>
            关闭
          </Button>
        </View>

        {/* 按你的表字段顺序 */}
        <Cell title="MARKS & Nos（唛头）">
          <Input
            value={itemForm.marks}
            onChange={(v) => setItemForm((p) => ({ ...p, marks: v }))}
            placeholder="可选"
          />
        </Cell>
        <Cell title="快递单号">
          <Input
            value={itemForm.trackingNo}
            onChange={(v) => setItemForm((p) => ({ ...p, trackingNo: v }))}
            placeholder="可选"
          />
        </Cell>
        <Cell title="Product Name（货品名称）">
          <Input
            value={itemForm.productName}
            onChange={(v) => setItemForm((p) => ({ ...p, productName: v }))}
            placeholder="必填"
          />
        </Cell>
        <Cell title="Material（材质）">
          <Input
            value={itemForm.material}
            onChange={(v) => setItemForm((p) => ({ ...p, material: v }))}
            placeholder="可选"
          />
        </Cell>
        <Cell title="HS Code（建议单独填）">
          <Input
            value={itemForm.hsCode}
            onChange={(v) => setItemForm((p) => ({ ...p, hsCode: v }))}
            placeholder="可选但推荐"
          />
        </Cell>

        <Cell title="UNITS-PCS（单位 pcs）">
          <Input
            type="number"
            value={itemForm.unitsPcs}
            onChange={(v) => setItemForm((p) => ({ ...p, unitsPcs: v }))}
            placeholder="必填"
          />
        </Cell>
        <Cell title="QUANTITY-Packages（包裹数）">
          <Input
            type="number"
            value={itemForm.quantityPackages}
            onChange={(v) => setItemForm((p) => ({ ...p, quantityPackages: v }))}
            placeholder="可选"
          />
        </Cell>
        <Cell title="Unit Price-CNY（单价）">
          <Input
            type="number"
            value={itemForm.unitPriceCny}
            onChange={(v) => setItemForm((p) => ({ ...p, unitPriceCny: v }))}
            placeholder="必填"
          />
        </Cell>

        <View className="calcRow">
          <Text className="muted">Total Amount-CNY（自动）:</Text>
          <Text className="strong">
            {money(toNum(itemForm.unitsPcs) * toNum(itemForm.unitPriceCny))}
          </Text>
        </View>

        <Cell title="Net Weight（净重）">
          <Input
            type="number"
            value={itemForm.netWeight}
            onChange={(v) => setItemForm((p) => ({ ...p, netWeight: v }))}
            placeholder="可选"
          />
        </Cell>
        <Cell title="Gross Weight（毛重）">
          <Input
            type="number"
            value={itemForm.grossWeight}
            onChange={(v) => setItemForm((p) => ({ ...p, grossWeight: v }))}
            placeholder="可选"
          />
        </Cell>
        <Cell title="Measurements-CBM（立方数）">
          <Input
            type="number"
            value={itemForm.cbm}
            onChange={(v) => setItemForm((p) => ({ ...p, cbm: v }))}
            placeholder="可选"
          />
        </Cell>

        <Cell title="Barcode / QR（预留）">
          <Input
            value={itemForm.barcode}
            onChange={(v) => setItemForm((p) => ({ ...p, barcode: v }))}
            placeholder="V1 可留空"
          />
        </Cell>

        <View className="popupFooter">
          <Button block type="primary" onClick={saveItem}>
            保存 Item
          </Button>
        </View>
      </Popup>
    </View>
  );
}

