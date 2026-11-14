// 歌词字幕语言：English（默认）/ 中文 / 日本語。选了之后整站记住。
// 带 data-subt 的元素会按当前语言显示 data-sen / data-szh / data-sja 里的文字；
// 静态歌词里用 data-l="en|zh|ja" 的元素，靠 <html data-sub> 的 CSS 来显示/隐藏。
(function () {
  const KEY = "orphius-sub", LANGS = ["en", "zh", "ja"];
  let cur = "en";
  try { const v = localStorage.getItem(KEY); if (LANGS.includes(v)) cur = v; } catch (e) {}

  const attrs = ln => {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    return `data-subt data-sen="${esc(ln.en || "")}" data-szh="${esc(ln.tr || "")}" data-sja="${esc(ln.ja || "")}"`;
  };
  const textFor = (el, lang) => el.dataset["s" + lang] || "";

  function apply(root) {
    document.documentElement.dataset.sub = cur;
    (root || document).querySelectorAll("[data-subt]").forEach(el => {
      const t = textFor(el, cur);
      el.textContent = t;
      el.hidden = !t;
    });
    document.querySelectorAll(".sub-switch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === cur)));
  }

  window.SUB = {
    get: () => cur,
    attrs,
    apply,
    set(lang) {
      if (!LANGS.includes(lang)) return;
      cur = lang;
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      apply();
    }
  };
  document.documentElement.dataset.sub = cur;
  document.addEventListener("click", e => {
    const b = e.target.closest(".sub-switch button");
    if (b) SUB.set(b.dataset.lang);
  });
  document.addEventListener("DOMContentLoaded", () => apply());
})();
