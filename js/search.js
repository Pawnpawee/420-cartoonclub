// --- 1. Import สิ่งที่จำเป็นจาก Firebase ---
import { db, auth } from '../firebase-controller.js'; 
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

// --- 2. ตัวแปรสำหรับเก็บข้อมูลและสถานะ ---
let allContentData = [];        
let currentFilteredData = [];   
let isShowingAll = false;       
let currentSearchQuery = '';

const grid = document.getElementById('card-grid');
const pageTitle = document.querySelector('.page-title');
const showAllBtn = document.getElementById('showAllBtn');

// --- 3. ฟังก์ชันหลัก: เริ่มต้นการทำงาน ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!grid) return;

    if (showAllBtn) {
        showAllBtn.addEventListener('click', handleShowAll);
    }

    try {
        allContentData = await fetchAllContent();
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
        grid.innerHTML = "<p>ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentSearchQuery = (urlParams.get('q') || '').trim();

    if (pageTitle) {
        if (currentSearchQuery) {
            pageTitle.textContent = `ผลการค้นหาสำหรับ "${currentSearchQuery}"`;
        } else {
            pageTitle.textContent = "ทั้งหมด";
        }
    }

    setupTabs();
    
    // กรองและแสดงผลครั้งแรก (แท็บ "ทั้งหมด")
    filterAndRenderContent('all'); 
});

// --- 4. ฟังก์ชันดึงข้อมูลจาก Firestore ---
async function fetchAllContent() {
    const contentCollection = collection(db, "content");
    const snapshot = await getDocs(contentCollection);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// --- 5. ฟังก์ชันกรองข้อมูล (เหมือนเดิม) ---
// (ฟังก์ชันนี้ยังทำหน้าที่ "กรอง" ว่าอะไรควรแสดงบ้าง)
function filterData(type = 'all') {
    const term = currentSearchQuery.toLowerCase();

    return allContentData.filter(item => {
        const typeMatch = (type === 'all') || (item.type === type);
        if (!typeMatch) return false;

        if (!term) return true; 

        const titleMatch = item.title.toLowerCase().includes(term);
        const descriptionMatch = item.description.toLowerCase().includes(term);
        const tagsMatch = item.tags && Array.isArray(item.tags) && 
                          item.tags.some(tag => tag.toLowerCase().includes(term));

        // แค่เจอ 1 ใน 3 นี้ ก็ถือว่าผ่าน
        return titleMatch || descriptionMatch || tagsMatch;
    });
}

// --- 6. ฟังก์ชันแสดงผลการ์ด (เหมือนเดิม) ---
// (สร้างการ์ดพร้อมชื่อเรื่อง และแสดง 6 รายการ)
function renderCards() {
    grid.innerHTML = ''; 

    const dataToShow = isShowingAll ? currentFilteredData : currentFilteredData.slice(0, 6);

    if (dataToShow.length === 0) {
        grid.innerHTML = '<p style="color: var(--primary-purple); font-size: 18px;">ไม่พบผลลัพธ์ที่ตรงกัน</p>';
        return;
    }

    dataToShow.forEach(item => {
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'search-result-item'; 
    // Navigate to view page for this content when clicked (require login)
    itemWrapper.onclick = () => { requireLoginAndNavigate(item.id); };

        const card = document.createElement('div');
        card.className = 'search-card'; 

        const img = document.createElement('img');
        img.src = item.thumbnailURL; 
        img.alt = item.title;
        card.appendChild(img);

        // VIP badge (if content requires subscription)
        if (item.requiresSubscription) {
            const vipBadge = document.createElement('span');
            vipBadge.className = 'vip-badge';
            vipBadge.innerHTML = `<span class="vip-icon"><i class="fa-solid fa-crown"></i></span><span>VIP</span>`;
            card.appendChild(vipBadge);
        }

        const title = document.createElement('h3');
        title.className = 'search-card-title'; 
        title.textContent = item.title;

        itemWrapper.appendChild(card);
        itemWrapper.appendChild(title);
        grid.appendChild(itemWrapper);
    });
}

// --- 7. ฟังก์ชันตั้งค่าการทำงานของแท็บ (เหมือนเดิม) ---
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabText = tab.textContent;
            let filterType = 'all';
            if (tabText === 'ซีรีส์') filterType = 'series';
            if (tabText === 'ภาพยนตร์') filterType = 'movie';

            filterAndRenderContent(filterType);
        });
    });
}

// --- 8. ⭐️ ฟังก์ชันที่รวมการกรองและแสดงผล (อัปเดตใหม่) ---
function filterAndRenderContent(type) {
    const term = currentSearchQuery.toLowerCase();

    // 1. กรองข้อมูล (เหมือนเดิม)
    currentFilteredData = filterData(type); 

    // 2. ⭐️ (เพิ่มใหม่) จัดเรียงข้อมูลตามความเกี่ยวข้อง
    if (term) { // เราจะจัดเรียงก็ต่อเมื่อมีคำค้นหา
        currentFilteredData.sort((a, b) => {
            // คำนวณคะแนนของ A และ B
            const scoreA = getSortScore(a, term);
            const scoreB = getSortScore(b, term);
            
            // เรียงจากมากไปน้อย (คะแนนสูง = อยู่ก่อน)
            return scoreB - scoreA; 
        });
    }

    // 3. รีเซ็ตสถานะ ให้กลับไปแสดง 6 รายการ
    isShowingAll = false; 
    
    // 4. แสดงผล (ด้วยข้อมูลที่จัดเรียงแล้ว)
    renderCards(); 

    // 5. ตรวจสอบว่าควรแสดงปุ่ม "แสดงทั้งหมด" หรือไม่
    if (showAllBtn) {
        if (!isShowingAll && currentFilteredData.length > 6) {
            showAllBtn.style.display = 'inline-flex'; 
        } else {
            showAllBtn.style.display = 'none'; 
        }
    }
}

// --- 9. ⭐️ (เพิ่มใหม่) ฟังก์ชันสำหรับกดปุ่ม "แสดงทั้งหมด" ---
function handleShowAll() {
    isShowingAll = true;  
    renderCards();        
    if (showAllBtn) {
        showAllBtn.style.display = 'none'; 
    }
}

// --- 10. ⭐️ (เพิ่มใหม่) ฟังก์ชันคำนวณคะแนนความเกี่ยวข้อง ---
/**
 * คำนวณคะแนนความเกี่ยวข้องของ Item เทียบกับคำค้นหา
 * @param {object} item - ข้อมูลการ์ตูน (จาก allContentData)
 * @param {string} term - คำค้นหา (แปลงเป็น lowercase แล้ว)
 * @returns {number} - คะแนน (ยิ่งสูงยิ่งเกี่ยวข้อง)
 */
function getSortScore(item, term) {
    const title = item.title.toLowerCase();
    const description = item.description.toLowerCase();

    // Priority 1: ชื่อเรื่องขึ้นต้นด้วยคำค้นหา (สำคัญที่สุด)
    // (เช่น ค้นหา "one" จะเจอ "One Piece" หรือ "One-Punch Man")
    if (title.startsWith(term)) {
        return 50;
    }

    // Priority 2: ชื่อเรื่องมีคำค้นหาอยู่ (สำคัญรองลงมา)
    // (เช่น ค้นหา "piece" จะเจอ "One Piece")
    if (title.includes(term)) {
        return 25;
    }

    // Priority 3: Tags มีคำค้นหา
    const tagsMatch = item.tags && Array.isArray(item.tags) && 
                      item.tags.some(tag => tag.toLowerCase().includes(term));
    if (tagsMatch) {
        return 10;
    }

    // Priority 4: Description มีคำค้นหา (สำคัญน้อยสุด)
    if (description.includes(term)) {
        return 5;
    }

    // ถ้าไม่ตรงเลย (ซึ่งไม่ควรเกิดถ้าผ่าน filterData มา)
    return 0;
}

// Require login, then navigate. If not logged in, redirect to login with next param.
function requireLoginAndNavigate(contentId) {
    const target = `view.html?content=${encodeURIComponent(contentId)}`;

    // Fast path: if auth already has currentUser
    if (auth && auth.currentUser) {
        window.location.href = target;
        return;
    }

    // Otherwise wait for auth state to resolve once
    const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = target;
        } else {
            // Send user to login page and pass next url
            window.location.href = `login.html?next=${encodeURIComponent(target)}`;
        }
        unsub();
    });
}