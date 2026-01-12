import Taro from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useState } from "react";
import { Button, Input, Toast } from "@nutui/nutui-react-taro";
import "./index.scss";

/**
 * Login Page (V1: no public registration)
 *
 * - 客户账号由管理员派发（username + password）
 * - 登录成功后保存 token / x_role / customer_id
 *
 * API（建议）:
 *   POST http://127.0.0.1:8000/v1/auth/login
 *   body: { "username": "test01", "password": "xxxx" }
 *   response(建议):
 *   { "token": "...", "user_id": "...", "role": "admin|customer", "customer_id": "uuid|null" }
 */

const API_BASE = "http://127.0.0.1:8000";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const u = String(username || "").trim();
    const p = String(password || "").trim();

    if (!u) {
      Toast.show({ content: "请输入用户名" });
      return;
    }
    if (!p) {
      Toast.show({ content: "请输入密码" });
      return;
    }

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

      Toast.show({ content: "登录成功 ✅" });

      // 进入列表页（按你项目路由修改）
      Taro.reLaunch({ url: "/pages/reconcile/index" });
    } catch (e) {
      console.error(e);
      Toast.show({ content: `登录失败：${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page">
      <View className="card">
        <Text className="title">登录</Text>
        <Text className="sub">无需注册，由管理员派发账号</Text>

        <View className="field">
          <Text className="label">Username</Text>
          <Input
            value={username}
            onChange={(v) => setUsername(v)}
            placeholder='例如: "test01"'
            disabled={loading}
          />
        </View>

        <View className="field">
          <Text className="label">Password</Text>
          <Input
            value={password}
            onChange={(v) => setPassword(v)}
            placeholder="请输入密码"
            type="password"
            disabled={loading}
          />
        </View>

        <View className="btns">
          <Button block type="primary" loading={loading} onClick={submit}>
            登录
          </Button>
        </View>

        <View className="footer">
          <Text className="tiny">忘记密码请联系管理员重置</Text>
        </View>
      </View>
    </View>
  );
}
