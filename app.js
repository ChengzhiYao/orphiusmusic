(() => {
  const MEDIA = "https://media.orphiusmusic.com/orphius/songs";
  // newest first; a song without a date counts as the newest
  const key = s => (s.date && /^\d{4}\.\d{2}\.\d{2}$/.test(s.date) ? s.date : s.date ? s.date.slice(0, 4) + ".09.30" : "9999") + s.id;
  const SONGS = [...window.SONGS].sort((a, b) => key(b).localeCompare(key(a)));
  const byId = Object.fromEntries(SONGS.map(s => [s.id, s]));
  const $ = s => document.querySelector(s);
  const file = (s, f) => `${MEDIA}/${s.id}/${f}${s.rev ? "?r=" + s.rev : ""}`;
  const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  const fmtDate = d => d.replace(/\./g, ".");
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" d="M7 4v16l13-8z"/><path class="i-pause" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

  const setAccent = c => document.documentElement.style.setProperty("--accent", c);

  // ── Audio ──────────────────────────────────────
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "metadata";
  let current = null;

  function load(song) {
    if (current === song) return;
    current = song;
    audio.src = file(song, "audio.m4a");
    setAccent(song.accent);
    $("#player").hidden = false;
    document.body.style.setProperty("--player-h", $("#player").offsetHeight + "px");
    $("#pImg").src = file(song, "thumb.jpg");
    $("#pTitle").textContent = song.title;
    $("#pTitle").href = `/songs/${song.id}`;
    $("#pSub").textContent = song.sub;
    $("#pDur").textContent = fmt(song.dur);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title, artist: "Orphius", album: song.sub,
        artwork: [{ src: file(song, "cover.jpg"), sizes: "1024x1024", type: "image/jpeg" }]
      });
    }
    markRows();
  }
  function play(song) { load(song); audio.play().catch(() => {}); }
  function toggle(song) {
    if (song && song !== current) return play(song);
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }
  const step = d => { const i = SONGS.indexOf(current); play(SONGS[(i + d + SONGS.length) % SONGS.length]); };
  // "next" in the list means older; the player goes forward through the list
  $("#pNext").onclick = () => step(1);
  $("#pPrev").onclick = () => (audio.currentTime > 4 ? (audio.currentTime = 0) : step(-1));
  $("#pToggle").onclick = () => toggle();
  $("#pArt").onclick = () => current && (location.href = `/songs/${current.id}`);
  audio.addEventListener("ended", () => step(1));
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
  }

  const seek = $("#pSeek");
  let seeking = false;
  seek.addEventListener("input", () => { seeking = true; $("#pCur").textContent = fmt(seek.value / 1000 * (audio.duration || current.dur)); });
  seek.addEventListener("change", () => { audio.currentTime = seek.value / 1000 * (audio.duration || current.dur); seeking = false; });
  audio.addEventListener("timeupdate", () => {
    if (seeking) return;
    const d = audio.duration || current.dur;
    seek.value = d ? audio.currentTime / d * 1000 : 0;
    $("#pCur").textContent = fmt(audio.currentTime);
  });
  ["play", "pause"].forEach(ev => audio.addEventListener(ev, () => {
    const on = !audio.paused;
    $("#player").classList.toggle("is-playing", on);
    $("#pToggle").setAttribute("aria-label", on ? "Pause" : "Play");
    markRows();
    syncPlayButtons();
  }));

  // ── Song list ──────────────────────────────────
  const list = $("#list");
  list.innerHTML = SONGS.map(s => `
    <li class="row" data-id="${s.id}" style="--c:${s.accent}">
      <img src="${file(s, "thumb.jpg")}" alt="" loading="lazy" width="56" height="56">
      <div class="row-main">
        <a class="row-title" href="/songs/${s.id}">${s.title}</a>
        <span class="row-sub">${s.sub || "&nbsp;"}</span>
      </div>
      <span class="row-date">${fmtDate(s.date)}</span>
      <div class="row-play-wrap">
        <span class="row-dur">${fmt(s.dur)}</span>
        <button class="row-play" type="button" aria-label="Play ${s.title}">${ICON_PLAY}</button>
      </div>
    </li>`).join("");
  list.addEventListener("click", e => {
    const b = e.target.closest(".row-play");
    if (b) { e.preventDefault(); toggle(byId[b.closest(".row").dataset.id]); }
  });
  $("#songCount").textContent = `${SONGS.length} songs`;
  function markRows() {
    list.querySelectorAll(".row").forEach(r => {
      const me = current && r.dataset.id === current.id;
      r.classList.toggle("is-current", !!me);
      r.classList.toggle("is-playing", !!me && !audio.paused);
      r.querySelector(".row-play").setAttribute("aria-label", `${me && !audio.paused ? "Pause" : "Play"} ${byId[r.dataset.id].title}`);
    });
  }

  // ── Hero: the newest song ──────────────────────
  const latest = byId[window.FEATURED] || SONGS[0];
  const heroImg = $("#heroImg");
  heroImg.onload = () => heroImg.classList.add("ready");
  heroImg.src = file(latest, "cover.jpg");
  $("#heroTitle").textContent = latest.title;
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(latest.title)) {
    const n = [...latest.title].length;   // short titles stay in one column
    $("#heroTitle").classList.add("vert");
    $("#heroTitle").style.fontSize = `max(36px, min(96px, 6.4vw, ${(68 / (n * 1.1)).toFixed(2)}svh))`;
  } else $("#heroTitle").classList.add("horiz");
  $("#heroSub").textContent = latest.sub;
  $("#heroLyrics").href = `/songs/${latest.id}`;
  $("#heroPlay").onclick = () => toggle(latest);

  // ── Song page with synced lyrics ───────────────
  let lines = [], lineEls = [], shown = null;
  async function showTrack(song) {
    shown = song;
    setAccent(song.accent);
    document.title = `${song.title} | Orphius`;
    $("#trackBg").src = file(song, "cover.jpg");
    $("#trackCover").src = file(song, "cover.jpg");
    $("#trackTitle").textContent = song.title;
    $("#trackSub").textContent = song.sub;
    $("#trackDate").textContent = song.date ? fmtDate(song.date) : "";
    const i = SONGS.indexOf(song);
    const prev = SONGS[(i + 1) % SONGS.length], next = SONGS[(i - 1 + SONGS.length) % SONGS.length];
    $("#prevLink").href = `/songs/${prev.id}`; $("#prevLink").textContent = `‹ ${prev.title}`;
    $("#nextLink").href = `/songs/${next.id}`; $("#nextLink").textContent = `${next.title} ›`;
    $("#trackPlay").onclick = () => toggle(song);
    syncPlayButtons();

    const box = $("#lyrics");
    box.innerHTML = ""; lines = []; lineEls = [];
    if (!song.lyrics) { box.innerHTML = '<p class="none">No lyrics for this song yet.</p>'; return; }
    try {
      const r = await fetch(file(song, "lyrics.json"));
      lines = r.ok ? await r.json() : [];
    } catch { lines = []; }
    if (shown !== song) return;
    if (!lines.length) { box.innerHTML = '<p class="none">No lyrics for this song yet.</p>'; return; }
    box.innerHTML = lines.map((l, k) => `
      <p class="line" data-k="${k}"><span class="orig">${l.w.map(([c, t]) => `<span class="ch" data-t="${t}">${c === " " ? " " : esc(c)}</span>`).join("")}</span>${l.tr ? `<span class="tr">${esc(l.tr)}</span>` : ""}</p>`).join("");
    lineEls = [...box.querySelectorAll(".line")];
    box.onclick = e => {
      const p = e.target.closest(".line"); if (!p) return;
      if (current !== song) load(song);
      audio.currentTime = lines[p.dataset.k].t; audio.play().catch(() => {});
    };
  }
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function syncPlayButtons() {
    const set = (btn, song) => {
      const on = current === song && !audio.paused;
      btn.classList.toggle("is-playing", on);
      btn.textContent = on ? "Pause" : "Play";
    };
    set($("#heroPlay"), latest);
    if (shown) set($("#trackPlay"), shown);
  }

  let lastLine = -1;
  (function tick() {
    requestAnimationFrame(tick);
    if (!lineEls.length || current !== shown) return;
    const t = audio.currentTime;
    let k = -1;
    for (let i = 0; i < lines.length; i++) if (t >= lines[i].t) k = i; else break;
    if (k !== lastLine) {
      if (lastLine >= 0 && lineEls[lastLine]) {
        lineEls[lastLine].classList.remove("on");
        lineEls[lastLine].querySelectorAll(".lit").forEach(c => c.classList.remove("lit"));
      }
      lastLine = k;
      if (k >= 0) {
        lineEls[k].classList.add("on");
        if (!audio.paused) lineEls[k].scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
    if (k >= 0) lineEls[k].querySelectorAll(".ch:not(.lit)").forEach(c => { if (t >= +c.dataset.t) c.classList.add("lit"); });
  })();

  // ── Routing ────────────────────────────────────
  function route() {
    const m = location.pathname.match(/^\/songs\/(\d{2})\/?$/);
    const song = m && byId[m[1]];
    $("#home").hidden = !!song;
    $("#track").hidden = !song;
    lastLine = -1;
    if (song) { showTrack(song); window.scrollTo(0, 0); }
    else {
      shown = null; lineEls = [];
      document.title = "Orphius";
      setAccent((current || latest).accent);
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }
  function go(url) { history.pushState(null, "", url); route(); }
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-link]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const u = new URL(a.href);
    if (u.origin !== location.origin) return;
    e.preventDefault();
    if (u.pathname === location.pathname && u.hash && !$("#home").hidden) {
      history.pushState(null, "", u.pathname + u.hash);
      document.getElementById(u.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    go(u.pathname + u.hash);
  });
  addEventListener("popstate", route);
  $("#yr").textContent = new Date().getFullYear();
  route();
})();
