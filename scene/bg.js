// 背景模式（/songs/<id>/?bg=1）：首页把这首歌的页面放在背景里，只显示动态场景。
// 不自己放音乐，时间 / 响度 / 低音都从首页的播放器读（同源页面可以直接读 parent）。
(function () {
  const id = document.body.dataset.song;
  const song = (window.SONGS || []).find(s => s.id === id);
  if (!song) return;
  const $ = s => document.querySelector(s);
  const media = `${MEDIA_BASE}/${song.id}`, rv = song.rev ? `?r=${song.rev}` : "";
  const rs = document.documentElement.style;

  // 和 player.js 一样准备好颜色、封面（场景会用到）
  rs.setProperty("--bg", `url(${media}/cover.jpg${rv})`);
  const th = song.theme || {};
  if (th.night) rs.setProperty("--night", th.night);
  if (th.nightRgb) rs.setProperty("--night-rgb", th.nightRgb);
  if (th.glow) rs.setProperty("--glow", th.glow);
  if (th.accent) rs.setProperty("--accent", th.accent);
  const cover = $("#cover");
  if (cover) {
    cover.addEventListener("load", () => {
      if (song.coverFill) { cover.style.objectPosition = song.coverFill; return; }
      if (cover.naturalWidth / cover.naturalHeight > 1.15) $(".cover-wrap").classList.add("wide");
    });
    cover.src = `${media}/cover.jpg${rv}`;
  }
  document.body.classList.add("ready");

  let host = null;
  try { host = window.parent !== window ? window.parent : null; } catch (e) { host = null; }
  // 首页的音频上下文和低通滤波，给场景里的音效 / “沉入水中”用
  try { if (host && host.__ac) { window.__ac = host.__ac; window.__lowpass = host.__lowpass; } } catch (e) {}

  (function tick() {
    let s = null;
    try { s = host && host.__bgState; } catch (e) { s = null; }
    if (s && s.id === song.id) {
      window.__playing = s.playing; window.__time = s.t; window.__level = s.level; window.__bass = s.bass;
    } else {
      window.__playing = false; window.__level = 0; window.__bass = 0;
    }
    document.body.classList.toggle("playing", !!window.__playing);
    requestAnimationFrame(tick);
  })();
})();
