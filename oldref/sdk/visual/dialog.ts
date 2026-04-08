export class Dialog {
  private backdrop: HTMLElement;
  private contentBox: HTMLElement;
  private onCloseCallback: (() => void) | null = null;
  private onSubmitCallback: ((data: any) => void) | null = null;

  constructor() {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.style.position = 'fixed';
    this.backdrop.style.top = '0';
    this.backdrop.style.left = '0';
    this.backdrop.style.width = '100%';
    this.backdrop.style.height = '100%';
    this.backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Darker backdrop
    this.backdrop.style.display = 'none';
    this.backdrop.style.zIndex = '1000';
    this.backdrop.addEventListener('click', () => this.close());

    // Create content box
    this.contentBox = document.createElement('div');
    this.contentBox.style.position = 'absolute';
    this.contentBox.style.top = '50%';
    this.contentBox.style.left = '50%';
    this.contentBox.style.transform = 'translate(-50%, -50%)';
    this.contentBox.style.backgroundColor = '#1e1e1e'; // Dark theme background
    this.contentBox.style.color = '#ffffff'; // Light text for dark theme
    this.contentBox.style.padding = '20px';
    this.contentBox.style.borderRadius = '8px';
    this.contentBox.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)'; // Adjusted shadow for dark theme
    this.contentBox.addEventListener('click', (e) => e.stopPropagation());

    // Append content box to backdrop
    this.backdrop.appendChild(this.contentBox);

    // Append backdrop to body
    document.body.appendChild(this.backdrop);
  }

  open(elements: Array<{ type: string; [key: string]: any }>, onSubmit: (data: any) => void, onClose?: () => void) {
    this.contentBox.innerHTML = '';

    elements.forEach((element) => {
      let el: HTMLElement;

      switch (element.type) {
        case 'heading':
          el = document.createElement('h2');
          el.textContent = element.text || '';
          break;
        case 'input':
          const inputEl = document.createElement('input');
          inputEl.id = element.id || '';
          inputEl.type = element.inputType || 'text';
          inputEl.placeholder = element.placeholder || '';
          inputEl.className = element.class || '';
          inputEl.style.cssText = element.style || '';
          if (element.disabled) {
            inputEl.disabled = true;
          }
          el = inputEl;
          break;
        default:
          console.warn(`Unsupported element type: ${element.type}`);
          return;
      }

      this.contentBox.appendChild(el);
    });

    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'right';

    const submitButton = document.createElement('button');
    submitButton.id = 'dialog-submit';
    submitButton.textContent = 'Submit';
    submitButton.className = 'btn btn-primary';
    submitButton.style.marginRight = '10px';
    submitButton.addEventListener('click', () => {
      const data = this.collectData();
      if (this.onSubmitCallback) {
        this.onSubmitCallback(data);
      }
      this.close();
    });

    const cancelButton = document.createElement('button');
    cancelButton.id = 'dialog-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn-secondary';
    cancelButton.addEventListener('click', () => this.close());

    buttonContainer.appendChild(submitButton);
    buttonContainer.appendChild(cancelButton);
    this.contentBox.appendChild(buttonContainer);

    this.onSubmitCallback = onSubmit;
    this.onCloseCallback = onClose || null;
    this.backdrop.style.display = 'block';
  }

  close() {
    this.backdrop.style.display = 'none';
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  private collectData(): any {
    const inputs = this.contentBox.querySelectorAll('input');
    const data: Record<string, string> = {};
    inputs.forEach((input) => {
      if (input.id) {
        data[input.id] = (input as HTMLInputElement).value;
      }
    });
    return data;
  }
}