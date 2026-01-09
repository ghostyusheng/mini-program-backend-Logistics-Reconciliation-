import { View, Text } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import "./detail.scss";

export default function ReconcileDetail() {
  const router = useRouter();
  const { id } = router.params || {};

  return (
    <View className="page">
      <View className="header">
        <Text className="title">对账单详情</Text>
        <Text className="sub">Reconcile ID: {id || "-"}</Text>
      </View>

      <View className="body">
        <Text>这里后面放：订单列表、上传区、审核记录、导出按钮等。</Text>
      </View>
    </View>
  );
}

