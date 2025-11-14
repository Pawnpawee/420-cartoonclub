// profile.js


// 2. สั่งให้ Firebase เริ่มทำงาน (Initialize)
firebase.initializeApp(firebaseConfig);

// 3. สร้าง "ทางลัด" เพื่อเรียกใช้งานบริการต่างๆ
const db = firebase.firestore();      // ใช้คุยกับ Database (Firestore)
const auth = firebase.auth();         // ใช้เช็คว่าใครล็อกอิน (Authentication)
const storage = firebase.storage();   // ใช้เก็บไฟล์ (Storage)

console.log("Firebase Connected!");

let currentUserId = null; // ตัวแปรไว้เก็บว่า User คนไหนล็อกอินอยู่

// --- A. ฟังก์ชันดึงข้อมูลมาโชว์ (Load Data) ---
auth.onAuthStateChanged(user => {
    if (user) {
        // ถ้ามีคนล็อกอิน
        currentUserId = user.uid; // เก็บ UID ของ User
        console.log("User ID:", currentUserId);

        // ไปดึงข้อมูลจาก Firestore
        const docRef = db.collection("users").doc(currentUserId);

        docRef.get().then(doc => {
            if (doc.exists) {
                const data = doc.data();

                // เอาข้อมูลไปใส่ในช่อง Input
                if (data.firstName) {
                    document.getElementById("nameInput").value = data.firstName;
                }
                if (data.email) {
                    document.getElementById("emailInput").value = data.email;
                }
                if (data.phone) {
                    document.getElementById("phoneInput").value = data.phone;
                }
                if (data.password) {
                    document.getElementById("passwordInput").value = data.password;
                }
                if (data.profileImage) {
                    document.getElementById("profileImagePreview").src = data.profileImage;
                }

            } else {
                console.log("No such document!");
            }
        }).catch(error => {
            console.error("Error getting document:", error);
        });

    } else {
        // ถ้าไม่มีใครล็อกอิน
        console.log("User is not signed in");
        // อาจจะต้องเด้งกลับไปหน้า Login
        // window.location.href = "login.html";
    }
});


// --- B. ฟังก์ชันบันทึกข้อมูล (Save Data) ---
document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.querySelector('.btn-save');

    if (saveButton) {
        saveButton.addEventListener("click", () => {

            if (!currentUserId) {
                return showAlertModal("ยังไม่ได้ล็อกอิน!");
            }

            // 1. ดึงข้อมูลใหม่จากช่อง Input
            const newName = document.getElementById("nameInput").value;
            const newEmail = document.getElementById("emailInput").value;
            const newPhone = document.getElementById("phoneInput").value;
            const newPassword = document.getElementById("passwordInput").value;
            const newProfileImage = document.getElementById("profileImagePreview").src;

            // Validate
            if (!newName || !newEmail || !newPhone) {
                return showAlertModal('กรุณากรอกข้อมูลให้ครบถ้วน');
            }

            // 2. สร้าง object ข้อมูลที่จะอัปเดต
            const dataToUpdate = {
                firstName: newName,
                email: newEmail,
                phone: newPhone,
                password: newPassword,
                profileImage: newProfileImage,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // 3. สั่งอัปเดตข้อมูลใน Firestore
            db.collection("users").doc(currentUserId).update(dataToUpdate)
                .then(() => {
                    showAlertModal("บันทึกข้อมูลโปรไฟล์สำเร็จ!");
                    // Reload to show updated data
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                })
                .catch(error => {
                    console.error("Error updating document: ", error);
                    showAlertModal("เกิดข้อผิดพลาด: " + error.message);
                });
        });
    }

    // --- C. ฟังก์ชันลบบัญชี (Delete Account) ---
    const deleteButton = document.querySelector('.btn-delete');

    if (deleteButton) {
        deleteButton.addEventListener("click", () => {
            if (!currentUserId) {
                return showAlertModal("ยังไม่ได้ล็อกอิน!");
            }

            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีนี้?\n\nการลบจะไม่สามารถย้อนกลับได้และข้อมูลทั้งหมดจะถูกลบอย่างถาวร')) {

                // ลบข้อมูลจาก Firestore
                db.collection("users").doc(currentUserId).delete()
                    .then(() => {
                        // ลบ Authentication account
                        return auth.currentUser.delete();
                    })
                    .then(() => {
                        showAlertModal('บัญชีถูกลบเรียบร้อยแล้ว');
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 800);
                    })
                    .catch(error => {
                        console.error("Error deleting account: ", error);
                        showAlertModal("เกิดข้อผิดพลาดในการลบบัญชี: " + error.message);
                    });
            }
        });
    }
});
