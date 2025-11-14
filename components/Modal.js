/**
 * Modal Component
 * Reusable modal component for forms and dialogs
 * Based on Figma Design (Node ID: 38-743)
 */

class Modal {
  constructor(options = {}) {
    this.id = options.id || 'modal';
    this.title = options.title || 'Modal';
    this.content = options.content || '';
    this.onClose = options.onClose || null;
    this.onSubmit = options.onSubmit || null;
    this.showFooter = options.showFooter !== false;
    // variant can be 'default' or 'figma' (matches the provided Figma design)
    this.variant = options.variant || 'default';
    this.element = null;
  }

  /**
   * Create modal HTML structure
   */
  createHTML() {
    const isFigma = this.variant === 'figma';
    return `
      <div class="modal" id="${this.id}">
        <div class="modal-content ${isFigma ? 'modal-figma' : ''}">
          ${isFigma ? '' : `
            <div class="modal-header">
              <h2 class="modal-title">${this.title}</h2>
              <button class="modal-close" data-action="close">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `}
          <div class="modal-body">
            ${isFigma ? `
              <div class="modal-figma-inner">
                <div class="modal-figma-text">
                  <h1 class="modal-figma-title">${this.title}</h1>
                  <p class="modal-figma-desc">${typeof this.content === 'string' ? this.content : ''}</p>
                </div>
                ${typeof this.content !== 'string' ? this.content : ''}
              </div>
            ` : this.content}
          </div>
          ${this.showFooter ? `
            <div class="modal-footer ${isFigma ? 'modal-footer-figma' : ''}">
              <button type="button" class="btn-figma-secondary" data-action="cancel">
                ยกเลิก
              </button>
              <button type="button" class="btn-figma-primary" data-action="submit">
                ตกลง
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render modal to DOM
   */
  render(container = document.body) {
    const modalHTML = this.createHTML();
    container.insertAdjacentHTML('beforeend', modalHTML);
    this.element = document.getElementById(this.id);
    this.attachEventListeners();
    return this.element;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.element) return;

    // Close button
    const closeBtn = this.element.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Cancel button
    const cancelBtn = this.element.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    // Submit button
    const submitBtn = this.element.querySelector('[data-action="submit"]');
    if (submitBtn && this.onSubmit) {
      submitBtn.addEventListener('click', () => {
        this.onSubmit(this);
      });
    }

    // Close on background click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  /**
   * Open modal
   */
  open() {
    if (this.element) {
      this.element.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Close modal
   */
  close() {
    if (this.element) {
      this.element.classList.remove('show');
      document.body.style.overflow = '';
      if (this.onClose) {
        this.onClose(this);
      }
    }
  }

  /**
   * Check if modal is open
   */
  isOpen() {
    return this.element?.classList.contains('show') || false;
  }

  /**
   * Update modal title
   */
  setTitle(title) {
    this.title = title;
    if (this.element) {
      const titleElement = this.element.querySelector('.modal-title');
      if (titleElement) {
        titleElement.textContent = title;
      }
    }
  }

  /**
   * Update modal content
   */
  setContent(content) {
    this.content = content;
    if (this.element) {
      const bodyElement = this.element.querySelector('.modal-body');
      if (bodyElement) {
        bodyElement.innerHTML = content;
      }
    }
  }

  /**
   * Destroy modal
   */
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /**
   * Static method to create a form modal
   */
  static createFormModal(options = {}) {
    const formHTML = options.fields ? `
      <form class="member-form" id="${options.formId || 'modalForm'}">
        <div class="form-grid">
        ${options.fields.map(field => {
          if (field.type === 'select') {
            return `
              <div class="form-group">
                <label for="${field.id}">${field.label}</label>
                <select id="${field.id}" name="${field.name}" ${field.required ? 'required' : ''}>
                  ${field.options.map(opt => `
                    <option value="${opt.value}">${opt.label}</option>
                  `).join('')}
                </select>
              </div>
            `;
          } else if (field.type === 'checkbox') {
            // Render checkbox inline with label and fixed size 20x20px
            return `
              <div class="form-group form-group-checkbox">
                <label for="${field.id}" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="${field.id}" name="${field.name}" ${field.required ? 'required' : ''} ${field.checked ? 'checked' : ''} style="width:20px;height:20px;appearance:auto;">
                  <span>${field.label}</span>
                </label>
              </div>
            `;
          } else {
            return `
              <div class="form-group">
                <label for="${field.id}">${field.label}</label>
                <input 
                  type="${field.type || 'text'}" 
                  id="${field.id}" 
                  name="${field.name}"
                  ${field.required ? 'required' : ''}
                  ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                  ${typeof field.value !== 'undefined' && field.value !== null ? `value="${field.value}"` : ''}
                >
              </div>
            `;
          }
        }).join('')}
        </div>
      </form>
    ` : options.content;

    return new Modal({
      ...options,
      content: formHTML
    });
  }
}

// Export for use in other modules
export default Modal;
