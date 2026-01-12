import Taro from "@tarojs/taro";

/**
 * Use Taro native toast for maximum compatibility (H5 + WeChat Mini Program + App).
 * NutUI Toast.show can fail to render in some runtimes if not mounted as a component.
 */
export function toast(content, opts = {}) {
  const title = String(content ?? "");
  if (!title) return;

  Taro.showToast({
    title,
    icon: opts.icon || "none",
    duration: typeof opts.duration === "number" ? opts.duration : 2000,
  });
}

export function toastLoading(title = "Loading...") {
  Taro.showLoading({ title: String(title), mask: true });
}

export function toastHideLoading() {
  try { Taro.hideLoading(); } catch (_) {}
}
