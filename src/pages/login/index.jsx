import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useMemo, useState } from "react";
import { Button, Input } from "@nutui/nutui-react-taro";
import "./index.scss";

import { toast as Toast, toastHideLoading } from "../../utils/toast";

const API_BASE = "http://127.0.0.1:8000";

export default function LoginPage() {
  const router = useRouter();
  const uFromQuery = router?.params?.u || router?.params?.username || "";

  const [username, setUsername] = useState(uFromQuery);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const lockedUsername = useMemo(() => !!uFromQuery, [uFromQuery]);

  useDidShow(() => {
    if (uFromQuery) setUsername(uFromQuery);
  });

  const submit = async () => {
    const u = String(username || "").trim();
    const p = String(password || "").trim();

    if (!u) return Toast("缺少用户名/客户代码");
    if (!p) return Toast("请输入密码");

    try {
      setLoading(true);

      const res = await Taro.request({
        url: `${API_BASE}/v1/auth/login`,
        method: "POST",
        data: { username: u, password: p },
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

      const data = res?.data || {};
      const token = data.token || "";
      const role = data.role || "customer";
      const customerId = data.customer_id || null;

      if (token) Taro.setStorageSync("token", token);
      Taro.setStorageSync("x_role", role);
      if (customerId) Taro.setStorageSync("customer_id", customerId);

      // ✅ 只保留一种跳转方式，避免 switchTab + reLaunch 互殴
      Taro.showModal({
        title: "登录成功",
        content: "已完成处理",
        showCancel: false,
        confirmText: "确定",
        success: (r) => {
          if (r.confirm) {
            // 你项目里 index 是 tab 页的话，用 switchTab；否则用 reLaunch
            Taro.switchTab({ url: "/pages/index/index" });
            // 如果你想登录后直接去 reconcile 列表，把上面那行改成：
            // Taro.reLaunch({ url: "/pages/reconcile/index" });
          }
        },
      });
    } catch (e) {
      Taro.showModal({
        title: "登录失败",
        content: "账号/密码错误或网络异常\n" + (e?.message || String(e)),
        showCancel: false,
        confirmText: "确定",
      });
    } finally {
      toastHideLoading();
      setLoading(false);
    }
  };

  return (
    <View className="rx-login">
      <View className="rx-login__card">
        <Text className="rx-login__title">登录</Text>
        <Text className="rx-login__sub">无需注册，由管理员派发账号</Text>

        {!lockedUsername ? (
          <View className="rx-login__field">
            <Text className="rx-login__label">Username / Customer Code</Text>
            <Input
              value={username}
              onChange={(v) => setUsername(v)}
              placeholder='例如: "test01"'
              disabled={loading}
            />
          </View>
        ) : (
          <View className="rx-login__locked">
            <Text className="rx-login__label">Account</Text>
            <Text className="rx-login__lockedValue">{username}</Text>
            <Text className="rx-login__hint">（链接已绑定账号，只需输入密码）</Text>
          </View>
        )}

        <View className="rx-login__field">
          <Text className="rx-login__label">Password</Text>
          <Input
            value={password}
            onChange={(v) => setPassword(v)}
            placeholder="请输入密码"
            type="password"
            disabled={loading}
          />
        </View>

        <View className="rx-login__btns">
          <Button block type="primary" loading={loading} onClick={submit}>
            登录
          </Button>
        </View>

        <View className="rx-login__footer">
          <Text className="rx-login__tiny">小提示：你可以给客户发一个带账号的链接：</Text>
          <Text className="rx-login__mono">/pages/login/index?u=test01</Text>
        </View>
      </View>
    </View>
  );
}
