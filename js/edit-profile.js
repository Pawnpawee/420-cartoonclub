// js/edit-profile.js
// Edit Profile page interactions (UI only - data handling in profile.js)

document.addEventListener('DOMContentLoaded', () => {
    // Sidebar navigation
    const backButton = document.querySelector('.menu-item.back');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    const sidebarItems = document.querySelectorAll('.edit-profile-sidebar .menu-item:not(.back)');
    sidebarItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            const pages = ['profile.html', 'packages.html', 'edit-profile.html'];
            if (pages[index]) {
                window.location.href = pages[index];
            }
        });
    });

    // Profile image upload and preview
    const profileImageInput = document.getElementById('profileImageInput');
    const profileImagePreview = document.getElementById('profileImagePreview');

    if (profileImageInput && profileImagePreview) {
        profileImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (ev) {
                    profileImagePreview.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Field edit buttons (enable focus and select)
    const editButtons = document.querySelectorAll('.field-edit-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.getAttribute('data-field');
            const input = document.getElementById(`${field}Input`);
            if (input) {
                input.focus();
                input.select();
            }
        });
    });

    // Cancel button
    const cancelBtn = document.querySelector('.btn-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('คุณต้องการยกเลิกการแก้ไขโปรไฟล์ใช่หรือไม่?')) {
                window.location.reload();
            }
        });
    }

    // Delete account button - handled by profile.js with Firebase
});
