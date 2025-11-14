// --- 1. Import สิ่งที่จำเป็นจาก Firebase ---
// (เราต้อง import auth และ db เพื่อใช้ตรวจสอบข้อมูล)
import { auth, db, app } from '../firebase-controller.js'; 
// (เรา import function ที่จำเป็นจาก Firebase SDK โดยตรง)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";

// --- 2. สร้าง Navbar ---
function createNavbar() {
    const navbarHTML = `
        <nav class="navbar">
            <div class="navbar-top">
                <div class="navbar-left">
                    <div class="navbar-logo">
                        <a href="index.html"><img src="img/Logo Cartoon Club.png" alt="Cartoon Club Logo"></a>
                    </div>
                    <ul class="navbar-nav" id="navbarNav">
                        <li><a href="index.html" class="active">หน้าหลัก</a></li>
                        <li><a href="index.html#recommended">การ์ตูนแนะนำ</a></li>
                        <li><a href="index.html#series">ซีรีส์</a></li>
                        <li><a href="index.html#movies">ภาพยนตร์</a></li>
                    </ul>
                </div>
                <div class="navbar-right" style="display:none">
                    <div class="navbar-search">
                        <input type="text" placeholder="ค้นหาการ์ตูนที่คุณอยากดู..." id="searchInput">
                        <button type="button" id="searchButton" class="search-icon" aria-label="ค้นหา">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </button>
                    </div>
                    <div class="navbar-actions">
                        <a class="user-btn" href="#" title="บัญชีของฉัน" id="userBtn">
                            <img src="icon/user-btn.svg" alt="บัญชีของฉัน" class="user-icon" id="userBtnIcon" />
                        </a>
                        <button class="vip-btn" id="vipButton" aria-label="VIP">
                            <img src="icon/star.svg" alt="VIP" class="star-icon" />
                            <span>VIP</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
        <div class="navbar-spacer"></div>
    `;
    // นำ HTML ที่สร้างไปใส่ใน <div id="navbar">
    const navbarElement = document.getElementById("navbar");
    if (navbarElement) {
        navbarElement.innerHTML = navbarHTML;
    } else {
        console.error("ไม่พบ Element #navbar");
        return; // หยุดทำงานถ้าไม่เจอ navbar
    }

    // Note: right-side actions are hidden by default in the HTML above.
    // Display of `navbar-right` is controlled by `updateNavbarUI` based on auth and page.

    // --- 3. [ใหม่] ย้าย Event Listeners มาไว้ที่นี่ ---
    // (เนื่องจาก 'onclick' ใน HTML จะไม่ทำงานเมื่อ script เป็น module)
    
    // 3.1 ปุ่มค้นหา
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });
    }
    
    // 3.2 ปุ่ม VIP
    const vipButton = document.getElementById('vipButton');
    if (vipButton) {
        vipButton.addEventListener('click', handleVIPClick);
    }
    
}

// --- 4. ฟังก์ชันสำหรับ Search และ VIP (ย้ายมาไว้ข้างใน) ---
function handleSearch() {
    const q = (document.getElementById('searchInput') || {}).value || '';
    const target = q ? `search.html?q=${encodeURIComponent(q)}` : 'search.html';
    window.location.href = target;
}

function handleVIPClick() {
    const userBtn = document.getElementById('userBtn');
    // ถ้า userBtn ยังลิงก์ไป login.html แสดงว่ายังไม่ล็อกอิน
    if (userBtn && userBtn.href.includes('login.html')) {
        window.location.href = 'login.html';
    } else {
        // ถ้าล็อกอินแล้ว ให้ไปหน้า packages
        window.location.href = 'packages.html';
    }
}

// --- 5. ฟังก์ชันอัปเดต UI ของ Navbar ตามสถานะล็อกอิน ---
async function updateNavbarUI(user) {
    const userBtn = document.getElementById('userBtn');
    const userBtnIcon = document.getElementById('userBtnIcon');
    const navUl = document.getElementById('navbarNav');
    const navbarRight = document.querySelector('.navbar-right');

    if (!userBtn || !userBtnIcon || !navUl || !navbarRight) {
        return; // Navbar not ready yet
    }

    const page = (window.location.pathname || '').split('/').pop().toLowerCase();

    if (user) {
        // Logged in user
        userBtn.href = 'profile.html';

        // Fetch Firestore user data
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        let userData = null;

        if (userDoc.exists()) {
            userData = userDoc.data();

            // Profile image handling (keep existing logic)
            let imageUrl = userData.profileImageURL || userData.profileImage;
            if (imageUrl && imageUrl.startsWith('gs://')) {
                try {
                    const storage = getStorage(app);
                    let path = imageUrl;
                    const m = imageUrl.match(/^gs:\/\/[^\/]+\/(.+)$/);
                    if (m && m[1]) path = m[1];
                    const sref = storageRef(storage, path);
                    imageUrl = await getDownloadURL(sref);
                } catch (err) {
                    console.warn('Could not resolve gs:// URL to download URL', err);
                }
            }

            if (imageUrl) {
                userBtnIcon.src = imageUrl;
                userBtnIcon.style.objectFit = 'cover';
                userBtnIcon.style.borderRadius = '50%';
                userBtnIcon.style.width = '42px';
                userBtnIcon.style.height = '42px';
            } else {
                userBtnIcon.src = 'icon/user-btn.svg';
                userBtnIcon.style.objectFit = '';
                userBtnIcon.style.borderRadius = '';
            }

            // VIP button adjustment
            try {
                const vipButton = document.getElementById('vipButton');
                if (vipButton) {
                    const subStatus = userData.subscription && userData.subscription.status;
                    if (subStatus === 'active') {
                        vipButton.innerHTML = `<img src="icon/star.svg" alt="VIP" class="star-icon" />`;
                        vipButton.title = 'VIP';
                    } else {
                        vipButton.innerHTML = `<img src="icon/star.svg" alt="VIP" class="star-icon" /><span>VIP</span>`;
                        vipButton.title = 'VIP';
                    }
                }
            } catch (e) {
                console.warn('Failed to update VIP button', e);
            }
        } else {
            // No user doc
            userBtnIcon.src = 'icon/user-btn.svg';
            userBtnIcon.style.objectFit = '';
            userBtnIcon.style.borderRadius = '';
        }

        // Role-based display
        if (userData && userData.role === 'admin') {
            // Admin: only logo (hide nav items and right actions)
            navUl.innerHTML = '';
            navbarRight.style.display = 'none';
        } else {
            // Normal logged-in user: show everything
            if (navUl.style) navUl.style.display = '';
            navbarRight.style.display = '';
        }

    } else {
        // Logged out
        userBtn.href = 'login.html';
        userBtnIcon.src = 'icon/user-btn.svg';
        userBtnIcon.style.objectFit = '';
        userBtnIcon.style.borderRadius = '';

        // If we're on login/register pages, show only logo + navbar-nav (hide right actions)
        if (page === 'login.html' || page === 'register.html' || page === 'login' || page === 'register') {
            if (navUl.style) navUl.style.display = '';
            navbarRight.style.display = 'none';
        } else {
            // Public pages: show nav & right actions (guest view)
            if (navUl.style) navUl.style.display = '';
            navbarRight.style.display = '';
        }
    }

    // Remove any old dashboard link if present
    const old = document.querySelector('[data-nav="dashboard-link"]');
    if (old) old.remove();
}

// --- 6. ตัวจัดการสถานะ Firebase (Auth State Listener) ---
// ส่วนนี้จะทำงานทันทีที่ js/navbar.js โหลด
onAuthStateChanged(auth, (user) => {
    // เมื่อสถานะเปลี่ยน (ล็อกอิน/ล็อกเอาต์) 
    // เราจะรอให้ Navbar สร้างเสร็จก่อน (ถ้ายังไม่มี)
    
    function checkNavbarReady() {
        const userBtn = document.getElementById('userBtn');
        if (userBtn) {
            // ถ้า Navbar พร้อมแล้ว ก็อัปเดต UI
            updateNavbarUI(user);
        } else {
            // ถ้ายังไม่พร้อม ให้รออีก 100ms
            setTimeout(checkNavbarReady, 100);
        }
    }
    
    checkNavbarReady();
});


// --- 7. Initialize Navbar (เรียกฟังก์ชันเดิมของคุณ) ---
// (ต้องเรียกหลังจากเราประกาศฟังก์ชันทั้งหมดแล้ว)
document.addEventListener("DOMContentLoaded", createNavbar);