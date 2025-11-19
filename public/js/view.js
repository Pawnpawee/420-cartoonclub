// View Page - Video Player & Episode Selector
// Using YouTube IFrame API

// Import Firestore db to fetch content and episodes
import { db, auth, updateUserDoc } from "../firebase-controller.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

// --- 1. Global State Configuration ---
const AD_VIDEO_ID = "5k2MLVk6vGk"; // ID โฆษณา
const adTarget = 2; // ต้องดู 5 รอบ

let player; // Player หลักตัวเดียว
let playerMode = "content"; // 'content' หรือ 'ad'
let adCount = 0;

const videoConfig = {
  currentEpisode: 1,
  totalEpisodes: 1,
  episodes: {}, // {1: 'youtubeId', 2: 'youtubeId2', ...}
};

// store per-episode titles: {1: 'Episode 1 title', 2: '...'}
videoConfig.titles = {};
// store content title for display
videoConfig.contentTitle = "";

let userIsActive = false;
let adRequired = false;
let ytApiReady = false;
let isPlayerReady = false;
// follow state & watch tracking
let isFollowing = false;
let followerCount = 0;
let currentContentId = null;

// watch tracking
let watchSeconds = 0;
let watchStartTs = null;

// --- 2. YouTube API Setup ---

// โหลด YouTube IFrame API
function loadYouTubeAPI() {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// ฟังก์ชันนี้จะถูกเรียกโดย API ของ YouTube เมื่อพร้อม
function onYouTubeIframeAPIReady() {
  ytApiReady = true;
  console.log("YouTube API is ready.");
  // สร้าง Player ทันทีที่ API พร้อม (ถ้าโหมดถูกตั้งค่าแล้ว)
  createPlayerBasedOnMode();
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady; // ทำให้เป็น Global

// ฟังก์ชันสร้าง Player (ใช้สำหรับทั้งโฆษณาและเนื้อหา)
function createMainPlayer(videoId) {
  if (player && player.destroy) {
    try {
      player.destroy();
    } catch (e) {
      console.warn("Failed to destroy old player", e);
    }
  }

  console.log(
    `Creating player in mode '${playerMode}' with Video ID: ${videoId}`
  );

  player = new YT.Player("videoPlayer", {
    height: "100%",
    width: "100%",
    videoId: videoId,
    playerVars: {
      playsinline: 1,
      controls: 0, // ปิด Controls ของ Youtube เสมอ
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      fs: 1,
      autoplay: 1, // เล่นอัตโนมัติ
    },
    events: {
      onReady: onPlayerReady, // ใช้ Handler เดียว
      onStateChange: onPlayerStateChange, // ใช้ Handler เดียว
    },
  });
}

// --- 3. Single Event Handlers (จัดการตามโหมด) ---

// Handler นี้จะทำงานเมื่อ Player (ทั้งโฆษณาและเนื้อหา) พร้อม
function onPlayerReady(event) {
  console.log("Player Ready. Mode:", playerMode);
  isPlayerReady = true;

  if (playerMode === "ad") {
    // ถ้าเป็นโหมดโฆษณา: เริ่มนับและเล่น
    event.target.playVideo();
    updateAdCountDisplay();
  } else {
    // ถ้าเป็นโหมดเนื้อหา: เปิด Custom Controls
    setupCustomControls();
    startProgressUpdate();
  }
}

// commit watch time on page unload
window.addEventListener('beforeunload', (e) => {
  try {
    // Flush running timer into watchSeconds so we don't lose seconds
    if (watchStartTs) {
      const delta = Math.floor((Date.now() - watchStartTs) / 1000);
      watchSeconds += delta;
      watchStartTs = null;
    }

    // Persist leftover seconds to localStorage so next session can recover them (best-effort)
    try {
      const key = 'watch_leftover';
      localStorage.setItem(key, JSON.stringify({ contentId: currentContentId, watchSeconds }));
    } catch (err) {}

    // Try to commit minutes (async - may not finish before unload), best-effort
    commitWatchTime().catch(() => {});
  } catch (err) {}
});

// Follow/unfollow helpers
function updateFollowUi(){
  const followBtn = document.getElementById('followBtn');
  const followerCountEl = document.getElementById('followerCount');
  if (followBtn) {
    // show a FontAwesome heart icon; solid when following, outline when not
    followBtn.innerHTML = isFollowing
      ? '<i class="fas fa-heart" aria-hidden="true"></i> เลิกติดตาม'
      : '<i class="far fa-heart" aria-hidden="true"></i> ติดตาม';
    followBtn.setAttribute('aria-pressed', String(!!isFollowing));
  }
  if (followerCountEl) followerCountEl.textContent = `${followerCount} followers`;
}

async function toggleFollow(contentId){
  try {
    const user = auth.currentUser;
    if (!user) {
      window.location.href = `login.html?next=${encodeURIComponent(window.location.href)}`;
      return;
    }

    const followerRef = doc(db, 'content', contentId, 'followers', user.uid);

    if (!isFollowing) {
      // follow: create follower doc and increment count
      await setDoc(followerRef, { uid: user.uid, createdAt: serverTimestamp() });
      try { await updateDoc(doc(db,'content',contentId), { followerCount: increment(1) }); } catch(e){ console.warn('increment followerCount failed', e); }
      // mark in user doc for quick reference
      try { await updateUserDoc(user.uid, { [`following.${contentId}`]: true }); } catch(e){ console.warn('update user following failed', e); }
      isFollowing = true;
      followerCount = (followerCount || 0) + 1;
    } else {
      // unfollow: remove follower doc and decrement count
      try { await deleteDoc(followerRef); } catch(e){ console.warn('delete follower doc failed', e); }
      try { await updateDoc(doc(db,'content',contentId), { followerCount: increment(-1) }); } catch(e){ console.warn('decrement followerCount failed', e); }
      try { await updateUserDoc(user.uid, { [`following.${contentId}`]: false }); } catch(e){ console.warn('update user following failed', e); }
      isFollowing = false;
      followerCount = Math.max(0, (followerCount || 0) - 1);
    }

    updateFollowUi();
  } catch (err) {
    console.error('toggleFollow failed', err);
    showAlertModal?.('ไม่สามารถเปลี่ยนสถานะการติดตามได้');
  }
}

// Handler นี้จัดการทุกสถานะ (เล่น, หยุด, จบ)
function onPlayerStateChange(event) {
  if (playerMode === "ad") {
    // --- Logic โฆษณา ---
    if (event.data === YT.PlayerState.ENDED) {
      // เมื่อโฆษณาจบ
      adCount++;
      updateAdCountDisplay();

      if (adCount < adTarget) {
        // ยังไม่ครบ 5 รอบ -> เล่นซ้ำ
        setTimeout(() => {
          try {
            player.playVideo();
          } catch (err) {}
        }, 600);
      } else {
        // --- ดูโฆษณาครบ 5 รอบแล้ว ---
        console.log("Ads finished. Switching to content.");
        playerMode = "content"; // ⭐️ เปลี่ยนโหมด

        // 1. โหลดวิดีโอเนื้อหาจริง (ตอนที่ 1)
        const videoId =
          videoConfig.episodes[videoConfig.currentEpisode] ||
          Object.values(videoConfig.episodes)[0] ||
          "";
        player.loadVideoById(videoId);

        // 2. คืนค่า UI ด้านข้าง (เอาปุ่มตอนกลับมา)
        restoreDefaultUI();

        // 3. เปิดการใช้งาน Custom Controls
        setupCustomControls();
        startProgressUpdate();
      }
    }
  } else {
    // --- Logic เนื้อหาปกติ ---
    // Update UI if available but do NOT bail out of tracking if controls not ready
    const playPauseBtn = document.getElementById("playPauseBtn");
    const icon = playPauseBtn ? playPauseBtn.querySelector("i") : null;

    if (event.data === YT.PlayerState.PLAYING) {
      if (icon) icon.className = "fas fa-pause";
      // start tracking watch time (independent of UI presence)
      if (!watchStartTs) watchStartTs = Date.now();
    } else {
      if (icon) icon.className = "fas fa-play";
      // pause or ended -> accumulate watch seconds
      if (watchStartTs) {
        const delta = Math.floor((Date.now() - watchStartTs) / 1000);
        watchSeconds += delta;
        watchStartTs = null;
      }
    }
  }
}

// --- 4. UI Helper Functions (สำหรับสลับ UI ด้านข้าง) ---

// สร้าง UI โฆษณาด้านข้าง (ตามรูป image_79915f.jpg)
function setupAdUI() {
  const detailsSection = document.querySelector(".details-section");
  const title =
    document.querySelector(".cartoon-title").textContent || "เนื้อหาพิเศษ";
  const episodeGrid = document.getElementById("episodeGrid");
  const episodeSelector = document.getElementById("episodeSelector");

  if (episodeGrid) {
    // ล้างปุ่มตอน (เช่น 01, 02) ทิ้ง
    episodeGrid.innerHTML = "";

    // สร้าง UI ใหม่
    episodeSelector.innerHTML = `
        <div class="ad-ui-container">
            <p>เนื้อหานี้สำหรับสมาชิก VIP เท่านั้น</p>
            <button class="ad-skip-btn" id="adSkipBtn">
                <i class="fas fa-star"></i>
                สมัคร VIP เพื่อข้ามโฆษณา
            </button>
            <div class="ad-counter" id="adCounterUI">
                กำลังเล่นโฆษณา (1/5)
            </div>
        </div>
    `;

    // ทำให้ปุ่ม "สมัคร VIP" กดได้
    document.getElementById("adSkipBtn").addEventListener("click", () => {
      window.location.href = "packages.html"; // ไปหน้าสมัครแพ็กเกจ
    });
  }
}

// อัปเดตตัวนับโฆษณา (เช่น 1/5, 2/5)
function updateAdCountDisplay() {
  const el = document.getElementById("adCounterUI");
  if (el) {
    if (adCount < adTarget) {
      el.textContent = `กำลังเล่นโฆษณา (${adCount + 1}/${adTarget})`;
    } else {
      el.textContent = "โฆษณาจบแล้ว กำลังโหลดเนื้อหา...";
    }
  }
}

// คืนค่า UI ด้านข้างกลับเป็นปกติ (หลังดูโฆษณาครบ)
function restoreDefaultUI() {
  // Restore the episode selector markup in case setupAdUI replaced it
  const episodeSelector = document.getElementById("episodeSelector");
  if (episodeSelector) {
    episodeSelector.innerHTML = `<div class="episode-grid" id="episodeGrid"></div>`;
  }

  // Remove any ad-specific UI remnants
  const adUiEls = document.querySelectorAll('.ad-ui-container, #adCounterUI');
  adUiEls.forEach(el => el.remove());

  // Reset ad counter and flags
  adCount = 0;
  adRequired = false;

  // Recreate episode buttons and controls
  generateEpisodeButtons(); // สร้างปุ่มตอน (01, 02) กลับคืนมา

  // Ensure play/pause icon is in a sane default state
  const playPauseBtn = document.getElementById('playPauseBtn');
  if (playPauseBtn) {
    const icon = playPauseBtn.querySelector('i');
    if (icon) icon.className = 'fas fa-play';
  }

  // Show any UI elements that were hidden for ads (if you hide them elsewhere)
  const details = document.querySelector('.details-section');
  if (details) details.style.opacity = '';
}

// --- 5. โค้ดเดิมของคุณ (Controls, Episode buttons, Shortcuts) ---
// (คัดลอกมาทั้งหมด ไม่ต้องแก้ไข)

function setupCustomControls() {
  document
    .getElementById("playPauseBtn")
    .addEventListener("click", togglePlayPause);
  document.getElementById("replayBtn").addEventListener("click", () => {
    if (isPlayerReady) {
      const currentTime = player.getCurrentTime();
      player.seekTo(Math.max(0, currentTime - 10), true);
    }
  });
  document.getElementById("forwardBtn").addEventListener("click", () => {
    if (isPlayerReady) {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      player.seekTo(Math.min(duration, currentTime + 10), true);
    }
  });
  const volumeBtn = document.getElementById("volumeBtn");
  const volumeRange = document.getElementById("volumeRange");
  volumeBtn.addEventListener("click", toggleMute);
  volumeRange.addEventListener("input", (e) => {
    if (isPlayerReady) {
      player.setVolume(e.target.value);
      updateVolumeIcon(e.target.value);
    }
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    playNextEpisode();
  });
  document.getElementById("playlistBtn").addEventListener("click", () => {
    const episodeSelector = document.querySelector(".episode-selector");
    episodeSelector.scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("subtitleBtn").addEventListener("click", () => {
    showAlertModal("คุณสมบัติคำบรรยายจะพร้อมใช้งานเร็วๆ นี้");
  });
  document
    .getElementById("fullscreenBtn")
    .addEventListener("click", toggleFullscreen);
  const progressBar = document.querySelector(".progress-bar");
  progressBar.addEventListener("click", (e) => {
    if (isPlayerReady) {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const duration = player.getDuration();
      player.seekTo(duration * percentage, true);
    }
  });
}

function togglePlayPause() {
  if (!isPlayerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function toggleMute() {
  if (!isPlayerReady) return;
  const isMuted = player.isMuted();
  player[isMuted ? "unMute" : "mute"]();
  const volumeRange = document.getElementById("volumeRange");
  const icon = document.getElementById("volumeBtn").querySelector("i");
  if (isMuted) {
    icon.className = "fas fa-volume-high";
    volumeRange.value = player.getVolume();
  } else {
    icon.className = "fas fa-volume-mute";
    volumeRange.value = 0;
  }
}

function updateVolumeIcon(volume) {
  const icon = document.getElementById("volumeBtn").querySelector("i");
  if (volume == 0) {
    icon.className = "fas fa-volume-mute";
  } else if (volume < 50) {
    icon.className = "fas fa-volume-low";
  } else {
    icon.className = "fas fa-volume-high";
  }
}

function toggleFullscreen() {
  const playerWrapper = document.querySelector(".video-player-wrapper");
  if (!document.fullscreenElement) {
    if (playerWrapper.requestFullscreen) {
      playerWrapper.requestFullscreen();
    } else if (playerWrapper.webkitRequestFullscreen) {
      playerWrapper.webkitRequestFullscreen();
    } else if (playerWrapper.msRequestFullscreen) {
      playerWrapper.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function startProgressUpdate() {
  setInterval(() => {
    if (!isPlayerReady || playerMode === "ad") return; // ไม่ต้องอัปเดต progress ตอนดูโฆษณา
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();
    if (duration > 0) {
      const percentage = (currentTime / duration) * 100;
      const progressFill = document.getElementById("progressFill");
      const progressThumb = document.getElementById("progressThumb");
      progressFill.style.width = percentage + "%";
      progressThumb.style.left = percentage + "%";
    }
  }, 100);
}

// Generate episode buttons dynamically based on videoConfig.totalEpisodes
function generateEpisodeButtons() {
  const episodeGrid = document.getElementById("episodeGrid");
  if (!episodeGrid) return;
  // clear existing
  episodeGrid.innerHTML = "";
  // Use the explicit episodeNumbers list so non-sequential numbers work
  const nums = Array.isArray(videoConfig.episodeNumbers)
    ? videoConfig.episodeNumbers
    : (function() {
        const arr = [];
        for (let i = 1; i <= videoConfig.totalEpisodes; i++) arr.push(i);
        return arr;
      })();

  nums.forEach((i) => {
    const button = document.createElement("button");
    button.className = "episode-btn";
    // show only the zero-padded number per request
    button.textContent = i.toString().padStart(2, "0");
    button.dataset.episode = i;
    // attach video id for later use
    button.dataset.videoId = videoConfig.episodes[i] || "";
    if (i === videoConfig.currentEpisode) button.classList.add("active");
    button.addEventListener("click", () => selectEpisode(i));
    episodeGrid.appendChild(button);
  });
}

function selectEpisode(episodeNumber) {
  if (episodeNumber === videoConfig.currentEpisode) return;
  // commit accumulated watch time before switching
  commitWatchTime().catch(err => console.warn('commitWatchTime before episode switch failed', err));
  videoConfig.currentEpisode = episodeNumber;
  const buttons = document.querySelectorAll(".episode-btn");
  buttons.forEach((btn) => {
    if (parseInt(btn.dataset.episode) === episodeNumber)
      btn.classList.add("active");
    else btn.classList.remove("active");
  });

  // Update displayed title to reflect the chosen episode
  updateDisplayedTitle(episodeNumber);

  // Load the mapped video_id into the player
  const mappedVideoId = videoConfig.episodes[episodeNumber];
  if (mappedVideoId) {
    if (isPlayerReady && player && typeof player.loadVideoById === 'function') {
      player.loadVideoById(mappedVideoId);
    } else {
      // if player isn't ready yet, create or update it when API is available
      try {
        createMainPlayer(mappedVideoId);
      } catch (e) { console.warn('Could not create/load player for episode', e); }
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Update the `.cartoon-title` to show content title + episode info
function updateDisplayedTitle(episodeNumber) {
  const titleEl = document.querySelector('.cartoon-title');
  if (!titleEl) return;
  const epTitle = (videoConfig.titles && videoConfig.titles[episodeNumber]) ? videoConfig.titles[episodeNumber] : "";
  if (epTitle) {
    titleEl.textContent = `${videoConfig.contentTitle} ${epTitle}`;
  } else {
    titleEl.textContent = `${videoConfig.contentTitle}`;
  }
}

/**
 * Commit accumulated watchSeconds to Firestore (convert to minutes)
 */
async function commitWatchTime() {
  try {
    if (!currentContentId) return;
    // also flush any running timer
    if (watchStartTs) {
      const delta = Math.floor((Date.now() - watchStartTs) / 1000);
      watchSeconds += delta;
      watchStartTs = null;
    }

    const minutes = Math.floor(watchSeconds / 60);
    if (minutes <= 0) {
      // keep seconds if <1 minute for next commit
      return;
    }

    // atomic increment
    await updateDoc(doc(db, 'content', currentContentId), {
      totalWatchMinutes: increment(minutes)
    });

    // also update a weekly bucket for reports: content/{id}/weekly/{weekKey}
    try {
      const now = new Date();
      const weekKey = getWeekKey(now);
      const weeklyRef = doc(db, 'content', currentContentId, 'weekly', weekKey);
      await setDoc(weeklyRef, { minutes: increment(minutes), updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn('Failed to update weekly bucket:', err);
    }

    // reset local counter
    watchSeconds = watchSeconds - minutes * 60;
  } catch (err) {
    console.warn('Failed to commit watch time:', err);
  }
}

// Periodically commit whole minutes every 60s to reduce lost minutes
setInterval(() => {
  try {
    commitWatchTime().catch((err) => console.warn('Periodic commitWatchTime failed', err));
  } catch (err) {}
}, 60 * 1000);

// simple week key helper (year + ISO-ish week number)
function getWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return `${date.getUTCFullYear()}_W${String(weekNo).padStart(2,'0')}`;
}

function playNextEpisode() {
  // Use episodeNumbers list to determine the next available episode
  const nums = Array.isArray(videoConfig.episodeNumbers)
    ? videoConfig.episodeNumbers
    : (function() {
        const arr = [];
        for (let i = 1; i <= videoConfig.totalEpisodes; i++) arr.push(i);
        return arr;
      })();
  const idx = nums.indexOf(videoConfig.currentEpisode);
  const next = idx >= 0 ? nums[idx + 1] : nums[0];
  if (next) selectEpisode(next);
  else showAlertModal("คุณได้ดูตอนสุดท้ายแล้ว");
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (!isPlayerReady || playerMode === "ad") return; // ปิด shortcut ตอนดูโฆษณา
  switch (e.key) {
    case " ":
      e.preventDefault();
      togglePlayPause();
      break;
    case "ArrowLeft":
      e.preventDefault();
      document.getElementById("replayBtn").click();
      break;
    case "ArrowRight":
      e.preventDefault();
      document.getElementById("forwardBtn").click();
      break;
    case "f":
    case "F":
      e.preventDefault();
      toggleFullscreen();
      break;
    case "m":
    case "M":
      e.preventDefault();
      toggleMute();
      break;
  }
});

// --- 6. Initialization Logic (ปรับปรุงใหม่) ---

// ฟังก์ชันนี้จะตัดสินใจว่าจะเล่นโฆษณาหรือเนื้อหา
function createPlayerBasedOnMode() {
  if (playerMode === "ad") {
    createMainPlayer(AD_VIDEO_ID);
  } else {
    const videoId =
      videoConfig.episodes[videoConfig.currentEpisode] ||
      Object.values(videoConfig.episodes)[0] ||
      "";
    createMainPlayer(videoId);
  }
}

// อ่าน `content` param, fetch content doc และ episodes
async function initializeFromContentParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get("content");
  if (!contentId) {
    console.warn("No content id provided");
    return;
  }

  try {
    const contentRef = doc(db, "content", contentId);
    const contentSnap = await getDoc(contentRef);
    if (!contentSnap.exists()) {
      console.error("Content not found:", contentId);
      return;
    }

    const content = contentSnap.data();

    // Populate UI: title and description
    const titleEl = document.querySelector(".cartoon-title");
    const descEl = document.querySelector(".cartoon-description");
    if (titleEl) titleEl.textContent = content.title || "ไม่ระบุชื่อเรื่อง";
    // save current content id for follow/watch operations
    currentContentId = contentId;
    // keep a copy for episode-specific display
    videoConfig.contentTitle = content.title || "ไม่ระบุชื่อเรื่อง";
    // Recover leftover watch seconds from previous session (best-effort)
    try {
      const raw = localStorage.getItem('watch_leftover');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.contentId === contentId && obj.watchSeconds) {
          watchSeconds = (watchSeconds || 0) + Number(obj.watchSeconds || 0);
        }
        localStorage.removeItem('watch_leftover');
      }
    } catch (err) {}
    if (descEl) {
      descEl.innerHTML = "";
      if (content.description) {
        content.description.split("\n").forEach((par) => {
          const p = document.createElement("p");
          p.textContent = par;
          descEl.appendChild(p);
        });
      }
    }
    if (content.title) document.title = `${content.title} - Cartoon Club`;

    // Determine episodes count
    videoConfig.totalEpisodes = content.episodeCount || 1;

    // Follower UI
    try {
      followerCount = content.followerCount || 0;
      const followerCountEl = document.getElementById('followerCount');
      if (followerCountEl) followerCountEl.textContent = `${followerCount} followers`;

      const followBtn = document.getElementById('followBtn');
      if (followBtn) {
        followBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          await toggleFollow(contentId);
        });
      }

      // check if user already follows
      onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
          const followerRef = doc(db, 'content', contentId, 'followers', user.uid);
          const snap = await getDoc(followerRef);
          isFollowing = !!(snap && snap.exists());
          updateFollowUi();
        } catch (err) {
          console.warn('Could not check follow state:', err);
        }
      });
    } catch (err) {
      console.warn('follow UI init failed', err);
    }

    // ... (โค้ดเดิมส่วนดึง episodes และ videoId) ...
    if (content.heroImageURL) {
      const maybeId = content.heroImageURL.split("v=")[1]
        ? new URL(content.heroImageURL).searchParams.get("v")
        : content.heroImageURL;
      videoConfig.episodes[1] = maybeId;
    }
    const epsCol = collection(db, "content", contentId, "episodes");
    const epsSnap = await getDocs(epsCol);
    if (!epsSnap.empty) {
      epsSnap.docs.forEach((d) => {
        const ep = d.data();
        const num = Number(ep.episodeNumber) || Number(d.id) || null;
        if (num) {
          // map the video id field and title field coming from your DB
          videoConfig.episodes[num] = ep.video_id || ep.videoId || ep.video || "";
          videoConfig.titles[num] = ep.title || ep.epTitle || "";
        }
      });
    }
    const firstVideoId = Object.values(videoConfig.episodes)[0] || "";
    // Build a sorted list of episode numbers present in the DB
    const epNums = Object.keys(videoConfig.episodes)
      .map((k) => Number(k))
      .filter((n) => !isNaN(n));
    epNums.sort((a, b) => a - b);

    // If there are no episodes discovered, fall back to 1..totalEpisodes
    if (epNums.length === 0) {
      // fallback: populate sequentially based on content.episodeCount
      for (let i = 1; i <= (videoConfig.totalEpisodes || 1); i++) {
        videoConfig.episodes[i] = videoConfig.episodes[i] || firstVideoId;
        videoConfig.titles[i] = videoConfig.titles[i] || "";
      }
      videoConfig.episodeNumbers = Object.keys(videoConfig.episodes)
        .map((k) => Number(k))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
    } else {
      // ensure titles and video ids exist for the discovered keys; fill missing video ids with firstVideoId
      epNums.forEach((num) => {
        if (!videoConfig.episodes[num]) videoConfig.episodes[num] = firstVideoId;
        if (!videoConfig.titles[num]) videoConfig.titles[num] = "";
      });
      videoConfig.episodeNumbers = epNums;
      // Update totalEpisodes to reflect actual count discovered
      videoConfig.totalEpisodes = videoConfig.episodeNumbers.length;
    }
    // ... (จบส่วนโค้ดเดิม) ...

    // ตรวจสอบว่าเป็น VIP หรือไม่
    const isVip = !!(
      content.requiresSubscription === true || // เช็ค field นี้จาก '420 db.docx'
      content.vip === true ||
      content.isVip === true
    );

    // --- ⭐️ Logic การตัดสินใจใหม่ ⭐️ ---
    if (isVip && !userIsActive) {
      // เนื้อหา VIP + User ไม่ Active
      adRequired = true;
      playerMode = "ad"; // 1. ตั้งโหมดเป็น 'ad'
      setupAdUI(); // 2. เปลี่ยน UI ด้านข้างเป็นโฆษณา
    } else {
      // ดูได้เลย (ไม่ใช่ VIP หรือเป็น VIP และ Active)
      adRequired = false;
      playerMode = "content"; // 1. ตั้งโหมดเป็น 'content'
      generateEpisodeButtons(); // 2. สร้างปุ่มตอนปกติ
    }

    // --- 3. เรียก API (ถ้ายังไม่โหลด) หรือ สร้าง Player (ถ้า API โหลดแล้ว) ---
    if (ytApiReady) {
      createPlayerBasedOnMode(); // API พร้อมแล้ว, สร้าง player เลย
    } else {
      loadYouTubeAPI(); // API ยังไม่มา, โหลด API (แล้ว onYouTubeIframeAPIReady จะสร้าง player เอง)
    }
    // Update displayed title to reflect current episode (if any)
    try { updateDisplayedTitle(videoConfig.currentEpisode); } catch (e) {}
  } catch (err) {
    console.error("Error initializing content page:", err);
  }
}

// --- 7. Start (เมื่อหน้าเว็บโหลด) ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. ตรวจสอบการล็อกอินก่อน
  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      // ไม่ได้ล็อกอิน -> ส่งไปหน้า login
      window.location.href = `login.html?next=${encodeURIComponent(
        window.location.href
      )}`;
      unsub();
      return;
    }

    // 2. ถ้าล็อกอินแล้ว -> เช็กสถานะ "Active"
    (async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap && userSnap.exists()) {
          const u = userSnap.data();
          // เช็กว่า status เป็น 'active' หรือไม่
          // Support a couple of possible shapes: subscription.status or subscription?.status
          userIsActive = Boolean(
            u &&
              (u.subscription?.status === "active" ||
                // fallback: some records might store active flag differently
                u.subscription === "active" ||
                u.isActive === true)
          );
          console.log("userIsActive:", userIsActive, "(user doc)", u);
        }
      } catch (err) {
        console.warn("Could not fetch user doc:", err);
        userIsActive = false;
      }

      // 3. เริ่มโหลดเนื้อหา (ฟังก์ชันนี้จะตัดสินใจเองว่าจะเล่นโฆษณาหรือเนื้อหา)
      await initializeFromContentParam();
    })();

    unsub();
  });
});
