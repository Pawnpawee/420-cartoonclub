// Members Management - Firestore-backed
import { db } from '../firebase-controller.js';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  addDoc
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import { where } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import Modal from '../components/Modal.js';

// State management
let members = [];
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = Math.ceil(members.length / itemsPerPage);
let editingMemberId = null;

// Badge class mappings
// Map both capitalized and lowercase variants to be resilient to stored values
const packageBadgeClasses = {
  'Platinum': 'badge-yearly',
  'Gold': 'badge-yearly',
  'Premium': 'badge-monthly',
  'Standard': 'badge-free',
  'platinum': 'badge-yearly',
  'gold': 'badge-yearly',
  'premium': 'badge-monthly',
  'standard': 'badge-free',
  'Free': 'badge-free',
  'free': 'badge-free',
  'Monthly': 'badge-monthly',
  'monthly': 'badge-monthly',
  'Yearly': 'badge-yearly',
  'yearly': 'badge-yearly'
};

const statusBadgeClasses = {
  'Active': 'badge-active',
  'Inactive': 'badge-inactive',
  'active': 'badge-active',
  'inactive': 'badge-inactive'
};

const paymentBadgeClasses = {
  'Paid': 'badge-paid',
  'paid': 'badge-paid',
  'Unpaid': 'badge-unpaid',
  'unpaid': 'badge-unpaid'
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  loadMembers();
});

// Load members from Firestore
async function loadMembers() {
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    // Filter out users with role === 'admin' and map to members array
    members = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, data: docSnap.data() }))
      .filter(item => {
        const role = item.data?.role;
        return !(role && String(role).toLowerCase() === 'admin');
      })
      .map(item => {
        const data = item.data || {};
        return {
          id: item.id,
          uid: data.uid || item.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || (data.email || ''),
          email: data.email || '',
          phone: data.phone || '',
          package: data.subscription?.packageId || 'free',
          status: data.subscription?.status || 'inactive',
          // Payment status may be stored in different places depending on schema
          payment: data.subscription?.paymentStatus || data.paymentStatus || 'None'
        };
      });

    // Determine payment status for each user by checking payments subcollection
    // Payment precedence: payments.succeeded -> Paid, subscription.status === 'past_due' -> Overdue,
    // subscription.status === 'inactive' or packageId === 'free' -> None, subscription.status === 'active' -> Paid
    await Promise.all(members.map(async (m) => {
      try {
        // Check payments subcollection for any succeeded payment
        const paymentsQ = query(collection(db, 'users', m.id, 'payments'), where('status', '==', 'succeeded'));
        const paymentsSnap = await getDocs(paymentsQ);
        if (!paymentsSnap.empty) {
          m.payment = 'Paid';
          return;
        }

        const subStatus = (m.status || '').toString().toLowerCase();
        const pkg = (m.package || '').toString().toLowerCase();

        if (subStatus === 'past_due') {
          m.payment = 'Unpaid';
        } else if (subStatus === 'inactive' || pkg === 'free') {
          m.payment = 'Unpaid';
        } else if (subStatus === 'active') {
          m.payment = 'Paid';
        } else {
          m.payment = m.payment || 'Unpaid';
        }
      } catch (e) {
        console.error('Failed to determine payment for', m.id, e);
        m.payment = m.payment || 'Unpaid';
      }
    }));

    // Reset pagination and render
    currentPage = 1;
    totalPages = Math.ceil(members.length / itemsPerPage);
    renderTable();
    renderPagination();
    } catch (err) {
    console.error('Error loading members:', err);
    showAlertModal('ไม่สามารถโหลดข้อมูลสมาชิกได้ โปรดตรวจสอบการเชื่อมต่อ Firebase');
  }
}

// Create status badge with dropdown
function createStatusBadge(value, type, memberId) {
  const badgeClasses = type === 'package' ? packageBadgeClasses : 
                       type === 'status' ? statusBadgeClasses : 
                       paymentBadgeClasses;
  
  // New option lists: packages reduced to Free/Monthly/Yearly; status reduced to Active/Inactive; payments to Paid/Unpaid
  const options = type === 'package' ? ['Free', 'Monthly', 'Yearly'] :
                  type === 'status' ? ['Active', 'Inactive'] :
                  ['Paid', 'Unpaid'];

  const badgeClass = badgeClasses[value] || badgeClasses[String(value)] || '';
  
  return `
    <div class="status-badge ${badgeClass}" data-member-id="${memberId}" data-type="${type}">
      <span>${value}</span>
      <i class="fas fa-chevron-down"></i>
      <div class="status-dropdown">
        ${options.map(option => `
          <div class="status-option" data-value="${option}">
            ${option}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render table
function renderTable() {
  const tbody = document.getElementById('membersTableBody');
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageMembers = members.slice(start, end);
  
    tbody.innerHTML = pageMembers.map((member, idx) => {
      const seq = start + idx + 1; // sequential number across pages
  // payment badge + action buttons in last column
  const paymentHtml = createStatusBadge(member.payment || 'Unpaid', 'payment', member.id);
      const actionsHtml = `
        <div class="member-actions">
          <button class="btn small btn-danger delete" data-id="${member.id}" title="ลบ"><i class="fas fa-trash"></i></button>
        </div>
      `;

      return `
        <tr data-member-id="${member.id}">
          <td>${seq}</td>
          <td>${member.name}</td>
          <td class="member-email">${member.email}</td>
          <td>${member.phone}</td>
          <td>${createStatusBadge(member.package, 'package', member.id)}</td>
          <td>${createStatusBadge(member.status, 'status', member.id)}</td>
          <td style="display:flex;align-items:center;justify-content:center;gap:8px">${paymentHtml}${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  
  // Attach badge click listeners
  attachBadgeListeners();
}

// Attach listeners to status badges
function attachBadgeListeners() {
  const badges = document.querySelectorAll('.status-badge');
  
  badges.forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Close other dropdowns
      document.querySelectorAll('.status-dropdown.show').forEach(dropdown => {
        if (dropdown !== badge.querySelector('.status-dropdown')) {
          dropdown.classList.remove('show');
          dropdown.parentElement.classList.remove('open');
        }
      });
      
      // Toggle current dropdown
      const dropdown = badge.querySelector('.status-dropdown');
      dropdown.classList.toggle('show');
      badge.classList.toggle('open');
    });
    
    // Handle option selection
    const options = badge.querySelectorAll('.status-option');
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const newValue = option.dataset.value;
        const memberId = badge.dataset.memberId;
        const type = badge.dataset.type;
        
        updateMemberStatus(memberId, type, newValue);
        
        // Close dropdown
        const dropdown = badge.querySelector('.status-dropdown');
        dropdown.classList.remove('show');
        badge.classList.remove('open');
      });
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.status-dropdown.show').forEach(dropdown => {
      dropdown.classList.remove('show');
      dropdown.parentElement.classList.remove('open');
    });
  });
}

// Update member status
async function updateMemberStatus(memberId, type, newValue) {
  const member = members.find(m => m.id === memberId);
  if (!member) return;
  
    try {
      const userRef = doc(db, 'users', memberId);

      if (type === 'package') {
        member.package = newValue;
        await updateDoc(userRef, {
          'subscription.packageId': newValue
        });
      } else if (type === 'status') {
        member.status = newValue;
        await updateDoc(userRef, {
          'subscription.status': newValue
        });
      } else if (type === 'payment') {
        member.payment = newValue;
        // Payment status changes could be represented in payments or subscription; for now update subscription.status
        await updateDoc(userRef, {
          'subscription.paymentStatus': newValue
        });
      }

      renderTable();
      console.log(`Updated ${memberId} ${type} to ${newValue}`);
    } catch (err) {
      console.error('Failed to update member status:', err);
      showAlertModal('ไม่สามารถอัปเดตสถานะสมาชิกได้');
    }
}

// Render pagination
function renderPagination() {
  const container = document.getElementById('paginationNumbers');
  totalPages = Math.ceil(members.length / itemsPerPage);
  
  let html = '';
  
  if (totalPages <= 5) {
    // Show all pages
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
  } else {
    // Show first page
    html += `<button class="page-number ${currentPage === 1 ? 'active' : ''}" data-page="1">1</button>`;
    
    if (currentPage > 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
    
    // Show current page and neighbors
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (currentPage < totalPages - 2) {
      html += `<span class="page-ellipsis">...</span>`;
    }
    
    // Show last page
    html += `<button class="page-number ${currentPage === totalPages ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
  }
  
  container.innerHTML = html;
  
  // Attach page number listeners
  document.querySelectorAll('.page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      goToPage(parseInt(btn.dataset.page));
    });
  });
  
  // Update prev/next button states
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// Navigate to page
function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  renderPagination();
}

// Initialize event listeners
function initializeEventListeners() {
  // Add member button — open Modal.createFormModal for consistent styling
  document.getElementById('addMemberBtn').addEventListener('click', () => {
    openMemberModal();
  });
  
  // Pagination buttons
  document.getElementById('prevPage').addEventListener('click', () => {
    goToPage(currentPage - 1);
  });
  
  document.getElementById('nextPage').addEventListener('click', () => {
    goToPage(currentPage + 1);
  });
  
  // Table row click for editing
  document.getElementById('membersTableBody').addEventListener('click', (e) => {
    // Button actions (delete) take precedence
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      if (action === 'delete') {
        e.stopPropagation();
        showDeleteConfirm(id);
        return;
      }
    }

    const row = e.target.closest('tr');
    if (row && !e.target.closest('.status-badge')) {
      const memberId = row.dataset.memberId;
      editMember(memberId);
    }
  });
  
  // Handle logout button
  // logout is handled by the shared sidebar component (Firebase signOut)
}

// Close modal helper for modal-created flows
function closeModalInstance(modalInstance) {
  try { modalInstance.close(); } catch (e) { /* ignore */ }
  editingMemberId = null;
}

// Open modal for add or edit member using Modal.createFormModal
function openMemberModal(memberId = null) {
  editingMemberId = memberId;

  const fields = [
    { id: 'memberName', name: 'memberName', label: 'ชื่อ-นามสกุล', required: true },
    { id: 'memberEmail', name: 'memberEmail', label: 'อีเมล', type: 'email', required: true },
    { id: 'memberPhone', name: 'memberPhone', label: 'เบอร์โทรศัพท์', required: true },
    { id: 'memberPackage', name: 'memberPackage', label: 'แพ็กเกจ', type: 'select', options: [
      { value: 'Free', label: 'Free' },
      { value: 'Monthly', label: 'Monthly' },
      { value: 'Yearly', label: 'Yearly' }
    ]},
    { id: 'memberStatus', name: 'memberStatus', label: 'สถานะสมาชิก', type: 'select', options: [
      { value: 'Active', label: 'Active' },
      { value: 'Inactive', label: 'Inactive' }
    ]},
    { id: 'paymentStatus', name: 'paymentStatus', label: 'สถานะการชำระเงิน', type: 'select', options: [
      { value: 'Paid', label: 'Paid' },
      { value: 'Unpaid', label: 'Unpaid' }
    ]}
  ];

  const title = memberId ? 'แก้ไขข้อมูลสมาชิก' : 'เพิ่มสมาชิกใหม่';

  const modal = Modal.createFormModal({
    id: 'member-modal-' + Math.random().toString(36).slice(2,6),
    title,
    variant: 'figma',
    fields,
    showFooter: true,
    onSubmit: async (modalInstance) => {
      try {
        const form = modalInstance.element.querySelector('form');
        const formData = new FormData(form);
        const fullName = formData.get('memberName') || '';
        const [firstName, ...rest] = fullName.trim().split(' ');
        const lastName = rest.join(' ');
        const email = formData.get('memberEmail');
        const phone = formData.get('memberPhone');
        const packageId = formData.get('memberPackage');
        const status = formData.get('memberStatus');

        if (editingMemberId) {
          const userRef = doc(db, 'users', editingMemberId);
          await updateDoc(userRef, {
            firstName: firstName || '',
            lastName: lastName || '',
            email: email || '',
            phone: phone || '',
            'subscription.packageId': packageId,
            'subscription.status': status
          });
        } else {
          const newRef = doc(collection(db, 'users'));
          const createdAt = new Date().toISOString();
          await setDoc(newRef, {
            uid: newRef.id,
            email: email || '',
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || '',
            profileImageURL: null,
            createdAt: createdAt,
            role: 'user',
            subscription: {
              status: status || 'inactive',
              packageId: packageId || 'free',
              startDate: createdAt,
              endDate: null,
              autoRenew: false,
              paymentMethodId: null
            }
          });
        }

        await loadMembers();
        closeModalInstance(modalInstance);
      } catch (err) {
        console.error('Failed to save member:', err);
        showAlertModal('เกิดข้อผิดพลาดขณะบันทึกข้อมูล โปรดลองอีกครั้ง');
      }
    }
  });

  // After render, if editing fill values
  modal.render();
  if (memberId) {
    const member = members.find(m => m.id === memberId);
    if (member) {
      const el = modal.element;
      el.querySelector('#memberName').value = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name;
      el.querySelector('#memberEmail').value = member.email || '';
      el.querySelector('#memberPhone').value = member.phone || '';
      const pkg = el.querySelector('#memberPackage'); if (pkg) pkg.value = member.package || 'Free';
      const st = el.querySelector('#memberStatus'); if (st) st.value = member.status || 'Inactive';
      const pay = el.querySelector('#paymentStatus'); if (pay) pay.value = member.payment || 'Unpaid';
    }
  }

  modal.open();
}

// Edit member
function editMember(memberId) {
  // Use the Modal.createFormModal flow to open the edit form
  const member = members.find(m => m.id === memberId);
  if (!member) return;
  openMemberModal(memberId);
}

// Delete member from Firestore
async function deleteMember(memberId) {
  try {
    await deleteDoc(doc(db, 'users', memberId));
    // refresh list
    await loadMembers();
  } catch (err) {
    console.error('Failed to delete member:', err);
    showAlertModal('ไม่สามารถลบสมาชิกได้');
  }
}

// Show a confirmation modal before deleting
function showDeleteConfirm(memberId) {
  const modal = new Modal({
    id: 'delete-confirm-' + memberId,
    title: 'ยืนยันการลบ',
    content: `<p>คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิกคนนี้? การกระทำนี้ไม่สามารถย้อนกลับได้</p>`,
    variant: 'figma',
    showFooter: true,
    onSubmit: async (modalInstance) => {
      try {
        await deleteMember(memberId);
      } catch (e) {
        console.error(e);
      } finally {
        try { modalInstance.close(); } catch (e) {}
      }
    },
    onClose: (m) => { try { m.destroy(); } catch(e) {} }
  });

  const el = modal.render();
  modal.open();
}

// Show payments history modal for a user
async function showPayments(memberId) {
  // remove existing payments modal if present
  const existing = document.getElementById('paymentsModal');
  if (existing) existing.remove();

  // create modal
  const wrapper = document.createElement('div');
  wrapper.id = 'paymentsModal';
  wrapper.className = 'modal show';
  wrapper.innerHTML = `
    <div class="modal-content modal-figma" role="dialog" aria-modal="true">
      <div class="modal-figma-inner">
        <div class="modal-figma-text">
          <h1 class="modal-figma-title">ประวัติการชำระเงิน</h1>
          <p class="modal-figma-desc">แสดงประวัติการชำระเงินสำหรับสมาชิก</p>
        </div>
        <div id="paymentsList" style="margin-top:16px;">
          กำลังโหลด...
        </div>
        <div style="margin-top:18px;text-align:right;">
          <button class="btn-figma-secondary" id="closePayments">ปิด</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);
  document.body.style.overflow = 'hidden';

  // close handler
  document.getElementById('closePayments').addEventListener('click', () => {
    wrapper.remove();
    document.body.style.overflow = '';
  });

  // fetch payments subcollection
  try {
    const paymentsCol = collection(db, 'users', memberId, 'payments');
    const snaps = await getDocs(paymentsCol);
    const listEl = document.getElementById('paymentsList');
    if (snaps.empty) {
      listEl.innerHTML = '<div>ไม่มีประวัติการชำระเงิน</div>';
      return;
    }

    const rows = snaps.docs.map(s => {
      const d = s.data();
      return `<div class="payment-row" style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div><strong>จำนวน:</strong> ${d.amount || '-'} บาท</div>
          <div><strong>วันที่:</strong> ${d.date || '-'}</div>
          <div><strong>สถานะ:</strong> ${d.status || '-'}</div>
        </div>
        <div>
          ${d.invoiceURL ? `<a href="${d.invoiceURL}" target="_blank">ใบเสร็จ</a>` : ''}
        </div>
      </div>`;
    }).join('');

    listEl.innerHTML = rows;
  } catch (err) {
    console.error('Failed to load payments:', err);
    const listEl = document.getElementById('paymentsList');
    if (listEl) listEl.innerHTML = '<div>ไม่สามารถโหลดประวัติการชำระเงินได้</div>';
  }
}

// Export for use in other modules if needed
export { members, renderTable, updateMemberStatus };
