// --- 1. Import สิ่งที่จำเป็นจาก FIREBASE ---
import { db, auth, getUserDoc } from "../firebase-controller.js";
import Modal from "../components/Modal.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

let previewTimer = null;
// Map to hold any active carousel animation cancel functions by element id
const _carouselAnims = new Map();

// --- 2. โค้ดสำหรับ Carousel (อันเดิมของคุณ) ---
function scrollCarousel(carouselId, direction) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;

  const cardWidth = 220;
  const gap = 45;
  const scrollAmount = (cardWidth + gap) * 2;

  const currentScroll = carousel.scrollLeft;
  const targetScroll = currentScroll + scrollAmount * direction;

  // If lenis is available, prefer using a smooth animated scroll for the carousel
  if (window.lenis || window.Lenis) {
    // use our animated scroll helper (cancellable)
    animateHorizontalScroll(carousel, targetScroll, 600);
    return;
  }

  // Fallback to native smooth scroll
  carousel.scrollTo({ left: targetScroll, behavior: "smooth" });
}
// ทำให้ scrollCarousel เป็น Global เพื่อให้ HTML <button> เรียกใช้ได้
window.scrollCarousel = scrollCarousel;

// --- 3. เพิ่มโค้ดดึงข้อมูล FIREBASE เมื่อหน้าเว็บโหลด ---
document.addEventListener("DOMContentLoaded", function () {
  // ตรวจสอบสถานะผู้ใช้ก่อนโหลดหน้าแรก
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getUserDoc(user.uid);
        const role =
          userDoc && userDoc.exists() ? userDoc.data().role || "user" : "user";
        if (role === "admin") {
          // แสดง popup แจ้งว่าแอดมินไม่สามารถดู index ได้ และนำไปแดชบอร์ด
          showAdminBlockedPopup();
          return;
        }
      } catch (err) {
        console.warn(
          "Could not determine user role, continuing as guest:",
          err
        );
      }
    }

    // โหลดเนื้อหาสำหรับผู้ใช้ทั่วไป/แขก
    loadHomepageContent();
  });
});

// Popup สำหรับแจ้ง admin ว่าไม่สามารถดู index/คอนเทนต์ได้
function showAdminBlockedPopup() {
  const modalContent = `
    <div style='font-size:1.1rem;margin-bottom:1rem;padding:32px 20px;'>เพื่อดูคอนเทนต์บนเว็บไซต์ กรุณาใช้บัญชีที่มี role: "user" หรือเปลี่ยนเป็นบัญชีผู้ใช้ปกติ</div>
    <div style='display:flex;gap:8px;justify-content:flex-end;margin-top:1rem;'>
      <button id='adminGoDashboard' class='btn-figma-secondary' style='padding:0.5rem 1rem;'>ไปที่แดชบอร์ด</button>
      <button id='adminLogout' class='btn-figma-primary' style='padding:0.5rem 1rem;'>ออกจากระบบ</button>
    </div>
  `;

  const modal = new Modal({
    id: 'adminBlockedModal',
    title: 'บัญชีนี้เป็นแอดมิน',
    content: modalContent,
    showFooter: false,
    variant: 'default'
  });

  const el = modal.render();
  modal.open();

  const goBtn = el.querySelector('#adminGoDashboard');
  const logoutBtn = el.querySelector('#adminLogout');

  if (goBtn) {
    goBtn.addEventListener('click', () => {
      modal.close();
      modal.destroy();
      window.location.href = 'dashboard.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const mod = await import('../firebase-controller.js');
        if (mod && typeof mod.logout === 'function') await mod.logout();
      } catch (err) {
        console.warn('Logout failed:', err);
      }
      modal.close();
      modal.destroy();
      window.location.href = 'login.html';
    });
  }
}

/**
 * 🚀 [ใหม่] ฟังก์ชันหลักสำหรับโหลดข้อมูลหน้าแรก
 */
async function loadHomepageContent() {
  try {
    console.log("กำลังโหลดข้อมูลจาก Firebase...");

    // 1. โหลด Hero Section
    const heroQuery = query(
      collection(db, "content"),
      where("isFeaturedHero", "==", true)
    );
    const heroSnapshot = await getDocs(heroQuery);

    if (!heroSnapshot.empty) {
      const heroDocs = heroSnapshot.docs;
      const randomIndex = Math.floor(Math.random() * heroDocs.length);
      const randomHeroDoc = heroDocs[randomIndex];
      const heroData = randomHeroDoc.data();
      renderHero(heroData);
      console.log(
        `สุ่ม Hero: เลือก ${heroData.title} (จาก ${heroDocs.length} ตัวเลือก)`
      );
    }

    // 2. โหลด Top 10
    const top10Query = query(
      collection(db, "content"),
      orderBy("followerCount", "desc"),
      limit(10)
    );
    const top10Snapshot = await getDocs(top10Query);
    // ⭐️ (แก้แล้ว) เรียกหา id="top10" ตามที่ HTML ใหม่กำหนด
    renderTop10("top10", top10Snapshot.docs);

    // 3. โหลดการ์ตูนแนะนำ
    const recommendedQuery = query(
      collection(db, "content"),
      where("isRecommended", "==", true),
      limit(10)
    );
    const recommendedSnapshot = await getDocs(recommendedQuery);
    renderCarousel("recommended", recommendedSnapshot.docs);

    // 4. โหลดซีรีส์
    const seriesQuery = query(
      collection(db, "content"),
      where("type", "==", "series"),
      limit(10)
    );
    const seriesSnapshot = await getDocs(seriesQuery);
    renderCarousel("series", seriesSnapshot.docs);

    // 5. โหลดภาพยนตร์
    const moviesQuery = query(
      collection(db, "content"),
      where("type", "==", "movie"),
      limit(10)
    );
    const moviesSnapshot = await getDocs(moviesQuery);
    renderCarousel("movies", moviesSnapshot.docs);

    console.log("โหลดข้อมูลสำเร็จ!");
  } catch (error) {
    console.error("🔥 เกิดข้อผิดพลาดในการโหลดข้อมูลหน้าแรก:", error);
  }
}

// ⭐️ โค้ดใหม่สำหรับ renderHero (แทนที่บรรทัด 95-110)
function renderHero(data) {
  const iframe = document.querySelector(".hero-iframe");
  const heroText = document.querySelector(".hero-text");

  if (iframe && data.heroImageURL) {
    const videoId = data.heroImageURL;
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`;
  }

  if (heroText) {
    const textToDisplay =
      data.description_long || data.description_short || data.description;

    if (textToDisplay) {
      heroText.innerHTML = textToDisplay
        .split("\n")
        .map((line) => `<p>${line}</p>`)
        .join("");
    } else {
      heroText.innerHTML = `<p>${data.title}</p>`;
    }
  }
}

/**
 * 🚀 [ใหม่] ฟังก์ชันสร้าง HTML Card สำหรับ Carousel
 */
function renderCarousel(carouselId, docs) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) {
    console.warn(`ไม่พบ Carousel ID: ${carouselId}`);
    return;
  }

  const defaultThumbnail = "https://occ-0-8407-2219.1.nflxso.net/dnm/api/v6/E8vDc_W8CLv7-yMQu8KMEC7Rrr8/AAAABcEXJRHDMvWDoCn3shb0-LC7kPE6reaeSw7JtWOMu01hOhZ2mWC-QbWFfGKznZAQCKCrRw2akMYxixh1y4-ZdZ59Xkn8m04Gz2Rl.jpg?r=b6a";

  let html = "";
  docs.forEach((doc) => {
    const data = doc.data();
    const docId = doc.id;

    const vipBadge = data.requiresSubscription
      ? `<span class="vip-badge">
                 <span class="vip-icon"><i class="fa-solid fa-crown"></i></span>
                 <span>VIP</span>
               </span>`
      : "";

    html += `
          <div class="card-image" 
               data-id="${docId}" 
               title="${data.title}"
               data-video-id="${data.heroImageURL || ""}" > 
              <img src="${data.thumbnailURL}" alt="${data.title}" onerror="this.src='${defaultThumbnail}'">
              <div class="card-overlay"></div>
              <div class="card-title">${data.title}</div>
              ${vipBadge}
          </div>
      `;
  });

  carousel.innerHTML = html;
  setupCardListeners(carouselId);
}
// ⭐️ โค้ดใหม่สำหรับ renderTop10 (แทนที่บรรทัด 150-175)
function renderTop10(containerId, docs) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const defaultThumbnail = "https://occ-0-8407-2219.1.nflxso.net/dnm/api/v6/E8vDc_W8CLv7-yMQu8KMEC7Rrr8/AAAABcEXJRHDMvWDoCn3shb0-LC7kPE6reaeSw7JtWOMu01hOhZ2mWC-QbWFfGKznZAQCKCrRw2akMYxixh1y4-ZdZ59Xkn8m04Gz2Rl.jpg?r=b6a";

  let html = "";
  let rank = 1;
  docs.forEach((doc) => {
    const data = doc.data();
    const docId = doc.id;
    const vipBadge = data.requiresSubscription
      ? `<span class="vip-badge">
                 <span class="vip-icon"><i class="fa-solid fa-crown"></i></span>
                 <span>VIP</span>
               </span>`
      : "";

    html += `
          <div class="rank-card" 
               >
               <span class="rank-number">${rank}</span>
              <div class="card-image"
              data-id="${docId}" 
               title="${data.title}"
               data-video-id="${data.heroImageURL || ""}" > <img src="${
      data.thumbnailURL
    }" alt="${data.title}" onerror="this.src='${defaultThumbnail}'">
                  <div class="card-overlay"></div>
                  <div class="card-title">${data.title}</div>
                  ${vipBadge}
              </div>
          </div>
      `;
    rank++;
  });
  container.innerHTML = html;
  setupCardListeners(containerId);
}

/**
 * 🚀 [อัปเกรด] ฟังก์ชันเพิ่ม Event Listeners ทั้งหมดให้การ์ด
 * (รวม Click, MouseEnter, MouseLeave)
 */
function setupCardListeners(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cards = container.querySelectorAll(".card-image, .rank-card");

  cards.forEach((card) => {
    // 1. CLICK (เหมือนเดิม)
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const contentId = card.dataset.id;
      if (contentId) {
        requireLoginAndNavigate(contentId);
      }
    });

    // 2. MOUSE ENTER (เพิ่มใหม่)
    card.addEventListener("mouseenter", () => {
      clearTimeout(previewTimer);
      hideAllPreviews();
      previewTimer = setTimeout(() => {
        showPreview(card);
      }, 500); // หน่วงเวลา 500ms (0.5 วินาที)
    });

    // 3. MOUSE LEAVE (เพิ่มใหม่)
    card.addEventListener("mouseleave", () => {
      clearTimeout(previewTimer);
      hidePreview(card);
    });
  });
}

// Require login, then navigate. If not logged in, redirect to login with next param.
function requireLoginAndNavigate(contentId) {
  const target = `view.html?content=${encodeURIComponent(contentId)}`;

  // Fast path
  if (auth && auth.currentUser) {
    window.location.href = target;
    return;
  }

  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = target;
    } else {
      window.location.href = `login.html?next=${encodeURIComponent(target)}`;
    }
    unsub();
  });
}

/**
 * 🚀 [ใหม่] ฟังก์ชันแสดง Popup
 */
function showPreview(card) {
  const videoId = card.dataset.videoId;
  if (!videoId || videoId === "null") {
    // console.log("ไม่มีวิดีโอพรีวิวสำหรับ:", card.title);
    return;
  }

  const cardImage = card.classList.contains("rank-card")
    ? card.querySelector(".card-image")
    : card;

  let popup = cardImage.querySelector(".video-preview-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "video-preview-popup";
    popup.innerHTML = `
            <iframe 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3"
                frameborder="0" 
                allow="autoplay; encrypted-media"
            ></iframe>
        `;
    cardImage.appendChild(popup);
  }
  card.classList.add("preview-active");
}

/**
 * 🚀 [ใหม่] ฟังก์ชันซ่อน Popup
 */
function hidePreview(card) {
  card.classList.remove("preview-active");
  const cardImage = card.classList.contains("rank-card")
    ? card.querySelector(".card-image")
    : card;
  let popup = cardImage.querySelector(".video-preview-popup");
  if (popup) {
    // (เราแค่ซ่อน ไม่ได้ลบ)
  }
}

/**
 * 🚀 [ใหม่] ฟังก์ชันซ่อน Popup ทั้งหมด
 */
function hideAllPreviews() {
  document.querySelectorAll(".preview-active").forEach((card) => {
    card.classList.remove("preview-active");
  });
}

/**
 * Animate horizontal scroll for an element (cancellable).
 * Uses requestAnimationFrame and an ease function. Stores a cancel token in _carouselAnims map.
 */
function animateHorizontalScroll(el, to, duration = 600) {
  if (!el) return;
  const id =
    el.id || el.dataset.carouselId || Math.random().toString(36).slice(2);

  // Cancel any existing animation for this element
  const existing = _carouselAnims.get(id);
  if (existing && typeof existing.cancel === "function") existing.cancel();

  const start = el.scrollLeft;
  const change = to - start;
  const startTime = performance.now();
  let rafId = null;
  let cancelled = false;

  // easing function (easeInOutQuad)
  function ease(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function step(now) {
    if (cancelled) return;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = ease(t);
    el.scrollLeft = Math.round(start + change * eased);
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      // cleanup
      _carouselAnims.delete(id);
    }
  }

  // store cancel function
  _carouselAnims.set(id, {
    cancel: () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      _carouselAnims.delete(id);
    },
  });

  // Start the animation. If Lenis exists, we still use requestAnimationFrame timing to animate
  rafId = requestAnimationFrame(step);
  return {
    cancel: () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      _carouselAnims.delete(id);
    },
  };
}
