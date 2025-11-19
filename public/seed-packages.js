// --- 1. Import สิ่งที่จำเป็นจาก Firebase SDK ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore, writeBatch, doc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- 2. ดึง Config จาก firebase-controller.js ---
// (หมายเหตุ: เราต้องคัดลอก Config มาวางที่นี่
// เพราะสคริปต์ Seed ไม่สามารถ import ตัวแปรจากไฟล์ Module อื่นได้ง่ายๆ)
const firebaseConfig = {
  apiKey: "AIzaSyBF9-h8iLcvwJZ4_d_YC7mnIyTAY5fY_6I",
  authDomain: "logincartoonclub.firebaseapp.com",
  projectId: "logincartoonclub",
  storageBucket: "logincartoonclub.firebasestorage.app",
  messagingSenderId: "916222025571",
  appId: "1:916222025571:web:d5e2dc68f36489ed93bd56",
  measurementId: "G-NL2226PG1V"
};

// --- 3. Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 4. ข้อมูล Packages (ตาม schema และ packages.html) ---
const packageData = {
  "free": {
    name: "ฟรี",
    price: 0,
    billingCycle: "month",
    features: [
      "จำกัดการรับชม (เฉพาะบางเรื่อง)",
      "คุณภาพวิดีโอจำกัด (480p)",
      "ดูตอนใหม่ล่าสุดไม่ได้",
      "ต้องรับชมโฆษณา",
      "ดาวน์โหลดไว้ดูออฟไลน์ไม่ได้"
    ],
    stripePriceId: "price_free_tier"
  },
  "monthly": {
    name: "รายเดือน",
    price: 159,
    billingCycle: "month",
    features: [
      "ดูได้ทุกเรื่องในคลังการ์ตูน",
      "คุณภาพวิดีโอสูงสุด (Full HD 1080p)",
      "ดูตอนใหม่ล่าสุดพร้อมญี่ปุ่น (Simulcast)",
      "ไม่มีโฆษณาคั่น",
      "ดาวน์โหลดไว้ดูออฟไลน์"
    ],
    stripePriceId: "price_monthly_159" //
  },
  "yearly": {
    name: "รายปี",
    price: 1500,
    billingCycle: "year",
    features: [
      "ดูได้ทุกเรื่องในคลังการ์ตูน",
      "คุณภาพวิดีโอสูงสุด (Full HD 1080p)",
      "ดูตอนใหม่ล่าสุดพร้อมญี่ปุ่น (Simulcast)",
      "ไม่มีโฆษณาคั่น",
      "ดาวน์โหลดไว้ดูออฟไลน์",
      "ราคาพิเศษ (ประหยัดกว่า)"
    ],
    stripePriceId: "price_yearly_1500"
  }
};

/**
 * 🚀 ฟังก์ชันหลักสำหรับ Seed ข้อมูล Packages
 */
export async function seedPackagesCollection() {
  console.log('กำลังเริ่มต้น Seed ข้อมูล [Packages]...');
  
  const batch = writeBatch(db);

  // วนลูปสร้างเอกสาร "free", "monthly", "yearly"
  for (const packageId in packageData) {
    const docRef = doc(db, "packages", packageId); //
    batch.set(docRef, packageData[packageId]);
  }

  try {
    await batch.commit();
    const message = `✅ Seed สำเร็จ! เพิ่ม ${Object.keys(packageData).length} แพ็คเกจ ลงใน Collection 'packages' แล้ว`;
    console.log(message);
    return message;
  } catch (e) {
    console.error("🔥 เกิดข้อผิดพลาด أثناءการ Seed [Packages]: ", e);
    return `เกิดข้อผิดพลาด: ${e.message}`;
  }
}

// If this module is loaded directly in a browser, run the seed automatically
if (typeof window !== 'undefined') {
  // Run with a short delay so it can be imported from a simple HTML page
  window.addEventListener('load', () => {
    seedPackagesCollection().then(msg => console.log(msg)).catch(err => console.error(err));
  });
}