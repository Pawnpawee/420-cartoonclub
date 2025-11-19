//
// 🛑 นี่คือไฟล์ firebase-controller.js ฉบับสมบูรณ์ (ใช้ Key ใหม่ล่าสุด) 🛑
//

// --- 1. Import ทุกอย่างที่ต้องใช้ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// --- 2. นี่คือ Config "ตัวใหม่ล่าสุด" ที่ถูกต้อง (จากรูป image_be1138.png) ---
const firebaseConfig = {
  apiKey: "AIzaSyBF9-h8iLcvwJZ4_d_YC7mnIyTAY5fY_6I",
  authDomain: "logincartoonclub.firebaseapp.com",
  projectId: "logincartoonclub",
  storageBucket: "logincartoonclub.firebasestorage.app",
  messagingSenderId: "916222025571",
  appId: "1:916222025571:web:d5e2dc68f36489ed93bd56",
  measurementId: "G-NL2226PG1V"
};


// --- 3. Initialize Firebase และบริการต่างๆ ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);


// --- 4. Export ฟังก์ชันต่างๆไปใช้งาน ---

// --- Login ---
export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// --- Register ---
export async function register(email, password, firstName, lastName) {
  // 1. สร้าง User ใน Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Prepare default user document based on schema
  const createdAt = new Date().toISOString();
  const defaultUserDoc = {
    uid: user.uid,
    email: user.email,
    firstName: firstName,
    lastName: lastName,
    phone: null,
    profileImageURL: null,
    createdAt: createdAt,
    role: 'user', // default role is 'user'
    subscription: {
      status: 'inactive',
      packageId: 'free',
      startDate: createdAt,
      endDate: null,
      autoRenew: false,
      paymentMethodId: null
    }
  };

  // 2. บันทึกข้อมูลลงใน Firestore
  await setDoc(doc(db, "users", user.uid), defaultUserDoc);

  // 3. ส่งอีเมลยืนยันตัวตน
  await sendEmailVerification(user);

  // 4. ป้องกันการล็อกอินอัตโนมัติหลังสมัคร: เซ็นเอ๊าท์ผู้ใช้ทันที (ผู้ใช้จะต้องล็อกอินด้วยตนเองหลังยืนยันอีเมล)
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Failed to sign out after registration:', err);
  }

  return userCredential;
}

// Resend verification email to the provided user or current user
export async function resendVerification(user = null) {
  const targetUser = user || auth.currentUser;
  if (!targetUser) throw new Error('No authenticated user to send verification to');
  return sendEmailVerification(targetUser);
}

// --- Get user document ---
export async function getUserDoc(uid) {
  if (!uid) throw new Error('uid required');
  const ref = doc(db, 'users', uid);
  return getDoc(ref);
}

// Update user document (shallow or using dot-paths)
export async function updateUserDoc(uid, updates) {
  if (!uid) throw new Error('uid required');
  return updateDoc(doc(db, 'users', uid), updates);
}

// Add a payment record under users/{uid}/payments
export async function addUserPayment(uid, paymentObj) {
  if (!uid) throw new Error('uid required');
  return addDoc(collection(db, 'users', uid, 'payments'), paymentObj);
}

// --- Logout ---
export async function logout() {
  return signOut(auth);
}

// --- Send password reset email ---
export async function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

// --- Confirm password reset ---
export async function confirmReset(code, newPassword) {
  return confirmPasswordReset(auth, code, newPassword);
}

// Export initialized instances for other modules
export { app, auth, db, analytics };