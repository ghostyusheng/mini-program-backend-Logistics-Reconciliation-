import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import React, { useMemo, useState } from "react";
import { Button, Input } from "@nutui/nutui-react-taro";
import "./index.scss";

import { toast, toastLoading, toastHideLoading } from "../../utils/toast";
/**
 * Login Page (V1: no public registration)
 *
 * 兼容“只要一个密码框”的派发方式：
 * - 你发给客户一个登录链接/二维码：/pages/login/index?u=test01
 * - 页面读取 query.u 作为 username（不让客户手动输），只显示密码输入框
 * - 如果没有 u 参数（比如管理员自己开页面），则显示 username + password 两个输入框
 *
 * API（建议）:
 *   POST http://127.0.0.1:8000/v1/auth/login
 *   body: { "username": "test01", "password": "xxxx" }
 *   response(建议):
 *   { "token": "...", "user_id": "...", "role": "admin|customer", "customer_id": "uuid|null" }
 *
 * 前端保存：
 *   token / x_role / customer_id
 */

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

    if (!u) {
      toast("缺少用户名/客户代码");
      return;
    }
    if (!p) {
      toast("请输入密码");
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

      toast("登录成功 ✅");

      // 进入列表页（按你项目路由修改）
      Taro.reLaunch({ url: "/pages/reconcile/index" });
    } catch (e) {
      console.error(e);
      Toast.show({ content: `登录失败：${e?.message || e}` });
    } finally {
      toastHideLoading();
      setLoading(false);
    }
  };

  return (
    <View className="page">
      <View className="card">
        <Text className="title">登录</Text>
        <Text className="sub">无需注册，由管理员派发账号</Text>

        {!lockedUsername ? (
          <View className="field">
            <Text className="label">Username / Customer Code</Text>
            <Input
              value={username}
              onChange={(v) => setUsername(v)}
              placeholder='例如: "test01"'
              disabled={loading}
            />
          </View>
        ) : (
          <View className="locked">
            <Text className="label">Account</Text>
            <Text className="lockedValue">{username}</Text>
            <Text className="hint">（链接已绑定账号，只需输入密码）</Text>
          </View>
        )}

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
          <Text className="tiny">小提示：你可以给客户发一个带账号的链接：</Text>
          <Text className="mono">/pages/login/index?u=test01</Text>
        </View>
      </View>
    </View>
  );
}
