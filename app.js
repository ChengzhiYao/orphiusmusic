(() => {
  const MEDIA = "https://media.orphiusmusic.com/orphius/songs";
  // newest first; a song without a date counts as the newest
  const key = s => (/^\d{4}\.\d{2}\.\d{2}$/.test(s.date) ? s.date : s.date ? s.date.slice(0, 4) + ".09.30" : "9999") + s.id;
  const SONGS = [...window.SONGS].sort((a, b) => key(b).localeCompare(key(a)));
  const byId = Object.fromEntries(SONGS.map(s => [s.id, s]));
  const $ = s => document.querySelector(s);
  const file = (s, f) => `${MEDIA}/${s.id}/${f}${s.rev ? "?r=" + s.rev : ""}`;
  const page = s => `/songs/${s.id}`;
  const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" d="M7 4v16l13-8z"/><path class="i-pause" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  const setAccent = c => document.documentElement.style.setProperty("--accent", c);

  // ── Audio ──────────────────────────────────────
  const audio = new Audio();
  audio.preload = "metadata";
  let current = null;

  function load(song) {
    if (current === song) return;
    current = song;
    audio.src = file(song, "audio.m4a");
    setAccent(song.accent);
    $("#player").hidden = false;
    document.body.classList.add("has-player");
    $("#pImg").src = `${MEDIA}/${song.id}/card.jpg`;
    $("#pArt").href = $("#pTitle").href = page(song);
    $("#pTitle").textContent = song.title;
    $("#pSub").textContent = song.sub;
    $("#pDur").textContent = fmt(song.dur);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title, artist: "Orphius", album: song.sub,
        artwork: [{ src: file(song, "cover.jpg"), sizes: "1024x1024", type: "image/jpeg" }]
      });
    }
    refresh();
  }
  const play = song => { load(song); audio.play().catch(() => {}); };
  function toggle(song) {
    if (song && song !== current) return play(song);
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }
  const step = d => { const i = SONGS.indexOf(current); play(SONGS[(i + d + SONGS.length) % SONGS.length]); };
  $("#pNext").onclick = () => step(1);
  $("#pPrev").onclick = () => (audio.currentTime > 4 ? (audio.currentTime = 0) : step(-1));
  $("#pToggle").onclick = () => toggle();
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
  ["play", "pause"].forEach(ev => audio.addEventListener(ev, refresh));

  // ── Featured song ──────────────────────────────
  const feat = byId[window.FEATURED] || SONGS[0];
  $("#fImg").src = `${MEDIA}/${feat.id}/card.jpg`;
  $("#fImg").alt = `Cover of ${feat.title}`;
  $("#fLink").href = $("#fOpen").href = page(feat);
  $("#fTitle").textContent = feat.title;
  $("#fSub").textContent = feat.sub;
  $("#fMeta").innerHTML = `${feat.date ? `<span>${esc(feat.date)}</span>` : ""}<span>${fmt(feat.dur)}</span>`;
  $("#fPlay").onclick = () => toggle(feat);
  if (feat.yt) { $("#fYt").href = `https://www.youtube.com/watch?v=${feat.yt}`; $("#fYt").hidden = false; }
  setAccent(feat.accent);

  // ── All songs ──────────────────────────────────
  const grid = $("#grid");
  grid.innerHTML = SONGS.map(s => `
    <li class="card" data-id="${s.id}" style="--c:${s.accent}">
      <div class="card-cover">
        <a class="card-art" href="${page(s)}" tabindex="-1" aria-hidden="true"><img src="${MEDIA}/${s.id}/card.jpg" alt="" loading="lazy" width="320" height="320"></a>
        <button class="card-play" type="button" aria-label="Play ${esc(s.title)}">${ICON}</button>
      </div>
      <a class="card-title" href="${page(s)}">${esc(s.title)}</a>
      <span class="card-sub">${esc(s.sub || "")}</span>
      <span class="card-meta">${s.date ? `<span>${esc(s.date)}</span>` : ""}<span>${fmt(s.dur)}</span></span>
    </li>`).join("");
  grid.addEventListener("click", e => {
    const b = e.target.closest(".card-play");
    if (b) toggle(byId[b.closest(".card").dataset.id]);
  });
  $("#songCount").textContent = `${SONGS.length} songs`;

  function refresh() {
    const on = !audio.paused;
    $("#player").classList.toggle("is-playing", on);
    $("#pToggle").setAttribute("aria-label", on ? "Pause" : "Play");
    grid.querySelectorAll(".card").forEach(c => {
      const me = current && c.dataset.id === current.id;
      c.classList.toggle("is-current", !!me);
      c.classList.toggle("is-playing", !!me && on);
      c.querySelector(".card-play").setAttribute("aria-label", `${me && on ? "Pause" : "Play"} ${byId[c.dataset.id].title}`);
    });
    const fOn = current === feat && on;
    $("#fPlay").classList.toggle("is-playing", fOn);
    $("#fPlay").textContent = fOn ? "Pause" : "Play";
  }

  $("#yr").textContent = new Date().getFullYear();
})();
