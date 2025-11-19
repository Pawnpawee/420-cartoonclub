/**
 * StatusBadge Component
 * Reusable component for displaying status badges with dropdown functionality
 * Based on Figma Design (Node ID: 38-743)
 */

class StatusBadge {
  constructor(value, type, options = {}) {
    this.value = value;
    this.type = type; // 'package', 'status', or 'payment'
    this.options = options;
    this.onChange = options.onChange || null;
    this.id = options.id || null;
  }

  /**
   * Get badge class based on type and value
   */
  getBadgeClass() {
    const badgeClasses = {
      package: {
        'Platinum': 'badge-platinum',
        'Premium': 'badge-premium',
        'Gold': 'badge-gold',
        'Standard': 'badge-standard'
      },
      status: {
        'Active': 'badge-active',
        'Inactive': 'badge-inactive',
        'Expired': 'badge-expired',
        'Canceled': 'badge-canceled'
      },
      payment: {
        'Paid': 'badge-paid',
        'Pending': 'badge-pending',
        'Overdue': 'badge-overdue',
        'None': 'badge-none'
      }
    };

    return badgeClasses[this.type]?.[this.value] || '';
  }

  /**
   * Get available options for dropdown
   */
  getOptions() {
    const optionsList = {
      package: ['Platinum', 'Premium', 'Gold', 'Standard'],
      status: ['Active', 'Inactive', 'Expired', 'Canceled'],
      payment: ['Paid', 'Pending', 'Overdue', 'None']
    };

    return optionsList[this.type] || [];
  }

  /**
   * Render badge HTML
   */
  render() {
    const badgeClass = this.getBadgeClass();
    const options = this.getOptions();
    const idAttr = this.id ? `data-id="${this.id}"` : '';

    return `
      <div class="status-badge ${badgeClass}" ${idAttr} data-type="${this.type}">
        <span>${this.value}</span>
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

  /**
   * Static method to create badge from element
   */
  static createFromElement(element) {
    const value = element.querySelector('span').textContent;
    const type = element.dataset.type;
    const id = element.dataset.id;

    return new StatusBadge(value, type, { id });
  }

  /**
   * Static method to attach event listeners
   */
  static attachListeners(container, onChangeCallback) {
    const badges = container.querySelectorAll('.status-badge');

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

        // Handle option selection
        const options = dropdown.querySelectorAll('.status-option');
        options.forEach(option => {
          option.addEventListener('click', (e) => {
            e.stopPropagation();
            const newValue = option.dataset.value;
            const type = badge.dataset.type;
            const id = badge.dataset.id;

            if (onChangeCallback) {
              onChangeCallback(id, type, newValue);
            }

            dropdown.classList.remove('show');
            badge.classList.remove('open');
          });
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
}

// Export for use in other modules
export default StatusBadge;
