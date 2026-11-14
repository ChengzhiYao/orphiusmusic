# orphiusmusic.com

Orphius 的音乐网站。纯静态页面，部署在 Vercel。

- 歌单：`songs.js`（加歌只改这个文件）
- 音频、封面、歌词：Cloudflare R2，`https://media.orphiusmusic.com/orphius/songs/<id>/`
  （audio.m4a / cover.jpg / thumb.jpg / lyrics.json）
- 网站里不放大文件，这样每次部署只有几十 KB。

## 歌曲页 /songs/<id>
- `song.html` + `scene/`：每首歌的背景特效、逐字歌词、播放器（scene.js / player.js / style.css / three.min.js）
- `scene/songs.js`：特效用的歌曲数据（不含私人的信和照片）
- 首页用的是根目录的 `songs.js`
