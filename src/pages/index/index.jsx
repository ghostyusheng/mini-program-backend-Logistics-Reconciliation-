import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState, useMemo } from "react";
import { Tabs, Button, Tag, Cell, Input, TextArea, Toast } from "@nutui/nutui-react-taro";
import "./index.scss";

const STATUS = {
  DRAFT: { text: "草稿", type: "primary" },
  REVIEW: { text: "待审核", type: "warning" },
  APPROVED: { text: "已通过", type: "success" },
  NEED_FIX: { text: "需补充", type: "danger" },
};

function ReconcileCard({ item, onClick }) {
  const s = STATUS[item.status] || { text: item.status, type: "default" };

  return (
    <View className="card" onClick={() => onClick(item)}>
      <View className="cardTop">
        <View>
          <Text className="cardTitle">{item.title}</Text>
          <Text className="cardSub">编号：{item.id}</Text>
        </View>
        <Tag type={s.type} round>
          {s.text}
        </Tag>
      </View>

      <View className="cardMid">
        <Text className="muted">客户：</Text>
        <Text>{item.customerName}</Text>
      </View>

      <View className="cardMid">
        <Text className="muted">更新时间：</Text>
        <Text>{item.updatedAt}</Text>
      </View>

      <View className="cardBottom">
        <Text className="muted">订单数：</Text>
        <Text>{item.orderCount}</Text>
        <Text className="dot">·</Text>
        <Text className="muted">附件：</Text>
        <Text>{item.attachmentCount}</Text>
      </View>
    </View>
  );
}

export default function Index() {
  const [tab, setTab] = useState("my");

  // 先用假数据跑通 UI。后面你接接口把这块替换成 API 即可。
  const myReconciles = useMemo(
    () => [
      {
        id: "R-20260109-001",
        title: "对账单 001",
        status: "DRAFT",
        customerName: "客户 A",
        updatedAt: "2026-01-09 13:02",
        orderCount: 3,
        attachmentCount: 1,
      },
      {
        id: "R-20260108-002",
        title: "对账单 002",
        status: "REVIEW",
        customerName: "客户 B",
        updatedAt: "2026-01-08 20:41",
        orderCount: 8,
        attachmentCount: 4,
      },
      {
        id: "R-20260107-003",
        title: "对账单 003",
        status: "APPROVED",
        customerName: "客户 C",
        updatedAt: "2026-01-07 11:20",
        orderCount: 12,
        attachmentCount: 6,
      },
    ],
    []
  );

  const [form, setForm] = useState({
    title: "",
    customerName: "",
    note: "",
  });

  const goDetail = (item) => {
    Taro.navigateTo({ url: `/pages/reconcile/detail?id=${encodeURIComponent(item.id)}` });
  };

  const submitCreate = () => {
    if (!form.title.trim()) {
      Toast.show({ content: "请填写对账单名称" });
      return;
    }
    if (!form.customerName.trim()) {
      Toast.show({ content: "请填写客户名称" });
      return;
    }

    // 这里后面换成 API：POST /reconciles
    Toast.show({ content: "已创建（模拟）✅" });

    // 模拟创建后跳详情页
    const fakeId = `R-${Date.now()}`;
    Taro.navigateTo({ url: `/pages/reconcile/detail?id=${encodeURIComponent(fakeId)}` });
  };

  return (
    <View className="page">
      <View className="pageHeader">
        <Text className="h1">对账协作</Text>
        <Text className="h2">H5 + 微信小程序通用</Text>
      </View>

      <Tabs value={tab} onChange={(val) => setTab(val)} className="tabs">
        <Tabs.TabPane title="我的对账单" value="my">
          <View className="section">
            {myReconciles.map((it) => (
              <ReconcileCard key={it.id} item={it} onClick={goDetail} />
            ))}
          </View>

          <View className="stickyBottom">
            <Button block type="primary" onClick={() => setTab("create")}>
              + 创建对账单
            </Button>
          </View>
        </Tabs.TabPane>

        <Tabs.TabPane title="创建对账单" value="create">
          <View className="section">
            <View className="formCard">
              <Cell title="对账单名称">
                <Input
                  placeholder="例如：2026-01 周期对账"
                  value={form.title}
                  onChange={(v) => setForm((p) => ({ ...p, title: v }))}
                />
              </Cell>

              <Cell title="客户名称">
                <Input
                  placeholder="例如：Easy2Go 客户 A"
                  value={form.customerName}
                  onChange={(v) => setForm((p) => ({ ...p, customerName: v }))}
                />
              </Cell>

              <Cell title="备注（可选）">
                <TextArea
                  placeholder="可写：发票缺失、装箱照片待补、异常说明..."
                  value={form.note}
                  onChange={(v) => setForm((p) => ({ ...p, note: v }))}
                  maxLength={200}
                  rows={3}
                />
              </Cell>

              <View className="btnRow">
                <Button type="default" onClick={() => setForm({ title: "", customerName: "", note: "" })}>
                  清空
                </Button>
                <Button type="primary" onClick={submitCreate}>
                  创建并进入
                </Button>
              </View>
            </View>
          </View>
        </Tabs.TabPane>
      </Tabs>
    </View>
  );
}

