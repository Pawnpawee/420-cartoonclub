// --- 1. Import สิ่งที่จำเป็นจาก Firebase SDK ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore, writeBatch, doc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- 2. [ใหม่] Import ข้อมูลการ์ตูนจากไฟล์ seed-databse.js ---
import { seedData } from './seed-databse.js';

// --- 3. ดึง Config (คัดลอกมา) ---
const firebaseConfig = {
  apiKey: "AIzaSyBF9-h8iLcvwJZ4_d_YC7mnIyTAY5fY_6I",
  authDomain: "logincartoonclub.firebaseapp.com",
  projectId: "logincartoonclub",
  storageBucket: "logincartoonclub.firebasestorage.app",
  messagingSenderId: "916222025571",
  appId: "1:916222025571:web:d5e2dc68f36489ed93bd56",
  measurementId: "G-NL2226PG1V"
};

// --- 4. Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * 🚀 ฟังก์ชันหลักสำหรับ Seed ข้อมูล Episodes
 */
export async function seedEpisodesCollection(options = {}) {
  console.log('กำลังเริ่มต้น Seed ข้อมูล [Episodes]... (ขั้นตอนนี้อาจใช้เวลาสักครู่)');

  // ตัวเลือก (ปรับได้)
  const minEpisodes = Number(options.minEpisodes ?? 8); // อย่างน้อย 8 ตอน
  const maxEpisodes = Number(options.maxEpisodes ?? 30); // สูงสุด 30 ตอน
  const maxBatchSize = Number(options.maxBatchSize ?? 450); // ปลอดภัยกว่าขีดจำกัด 500

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // สร้าง Batch ใหม่
  let batch = writeBatch(db);
  let operationCount = 0;
  let totalAdded = 0;

  try {
    // วนลูปข้อมูลการ์ตูนทั้งหมด
    for (const item of seedData) {
      // เฉพาะซีรีส์เท่านั้น
      if (item.type !== 'series') continue;

      const contentId = item.id;

      // ถ้ามี episodeCount ใน seedData ให้ใช้ค่านั้น ไม่เช่นนั้นสุ่ม
      const episodeCount = Number(item.episodeCount) || randInt(minEpisodes, maxEpisodes);

      for (let i = 1; i <= episodeCount; i++) {
        const episodeDocId = String(i);
        const episodeDocRef = doc(db, 'content', contentId, 'episodes', episodeDocId);

        const episodeData = {
          episodeNumber: i,
          title: `ตอนที่ ${i}: การผจญภัยเริ่มต้น`,
          video_id: item.heroImageURL || '5ASJJI_RkiA',
          duration: 24,
          thumbnailURL: item.thumbnailURL || null
        };

        batch.set(episodeDocRef, episodeData);
        operationCount++;
        totalAdded++;

        // ถ้าใกล้ถึงขีดจำกัด batch ให้ commit แล้วสร้าง batch ใหม่
        if (operationCount >= maxBatchSize) {
          console.log(`Committing batch of ${operationCount} operations...`);
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    // ส่ง batch สุดท้าย (ถ้ามี)
    if (operationCount > 0) {
      console.log(`Committing final batch of ${operationCount} operations...`);
      await batch.commit();
    }

    const message = `✅ Seed สำเร็จ! เพิ่ม ${totalAdded} episodes ลงใน Sub-collections 'content/{id}/episodes' แล้ว`;
    console.log(message);
    return message;
  } catch (e) {
    console.error(`🔥 เกิดข้อผิดพลาด أثناءการ Seed [Episodes] (ดำเนินการไป ${totalAdded} รายการ): `, e);
    return `เกิดข้อผิดพลาด: ${e.message}`;
  }
}