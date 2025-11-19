// (ใช้ 'firebase.' เพราะเรา import มาแบบ compat)
const auth = firebase.auth();
const functions = firebase.functions();
// const db = firebase.firestore(); // ถ้าต้องการใช้ onSnapshot ในหน้านี้ด้วย

// --- ส่วนที่ 1: ตรวจสอบการล็อกอิน (สำคัญมาก!) ---
// Function ที่เราสร้างไว้ (activateTestSubscription) ต้องใช้ user ID
// เราต้องล็อกอินก่อนถึงจะกดปุ่มได้
// หน้านี้จะสมมติว่าคุณล็อกอินค้างไว้จากหน้าหลักแล้ว

// --- ส่วนที่ 2: ผูกการทำงานกับปุ่ม ---
document.addEventListener("DOMContentLoaded", () => {
    
    const triggerButton = document.getElementById("trigger-button");
    const statusMessage = document.getElementById("status-message");

    // ตรวจสอบสถานะล็อกอินตอนเปิดหน้า
    auth.onAuthStateChanged(user => {
        if (user) {
            statusMessage.textContent = `สถานะ: ล็อกอินแล้ว (${user.email})`;
            triggerButton.disabled = false;
        } else {
            statusMessage.textContent = "สถานะ: กรุณาล็อกอินในหน้าหลักก่อน";
            triggerButton.disabled = true;
            triggerButton.style.backgroundColor = "#ccc";
        }
    });

    // --- นี่คือหัวใจหลัก: การเรียก "Trigger จำลอง" ---
    triggerButton.addEventListener("click", async () => {
        
        // ตรวจสอบอีกครั้ง เผื่อหลุด
        if (!auth.currentUser) {
            statusMessage.textContent = "สถานะ: ไม่พบผู้ใช้ กรุณาล็อกอินใหม่";
            return;
        }

        // ปิดปุ่มกันกดย้ำ
        triggerButton.disabled = true;
        triggerButton.textContent = "กำลังดำเนินการ...";
        statusMessage.textContent = "กำลังเรียก Function 'activateTestSubscription'...";

        // 1. ดึง "Callable Function" ที่เราสร้างไว้ใน Backend
        const activateTestSub = functions.httpsCallable('activateTestSubscription');

        try {
            // 2. สั่งยิง Trigger! (นี่คือการเรียก Function)
            const result = await activateTestSub();

            // 3. เมื่อ Function ทำงานเสร็จ (อัปเดต DB แล้ว)
            console.log("Function Result:", result.data);
            statusMessage.textContent = `สำเร็จ: ${result.data.message}`;
            triggerButton.textContent = "อนุมัติสำเร็จ!";
            triggerButton.style.backgroundColor = "#28a745"; // สีเขียว

        } catch (error) {
            // กรณี Function ล้มเหลว (เช่น ไม่ได้ล็อกอิน, เขียนโค้ดผิด)
            console.error("Function Error:", error);
            statusMessage.textContent = `เกิดข้อผิดพลาด: ${error.message}`;
            triggerButton.disabled = false; // เปิดให้ลองใหม่
            triggerButton.textContent = "🚀 อนุมัติสถานะ Active (ทดสอบ)";
        }
    });

});