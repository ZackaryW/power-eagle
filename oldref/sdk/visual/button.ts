// Button utilities for Power Eagle SDK

export interface ButtonConfig {
  text: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  style?: string;
  onClick?: () => void;
}

export class Button {
  private element: HTMLButtonElement;
  private config: ButtonConfig;

  constructor(config: ButtonConfig) {
    this.config = config;
    this.element = this.createElement();
  }

  private createElement(): HTMLButtonElement {
    const button = document.createElement('button');
    
    // Set base class and variant
    const variant = this.config.variant || 'primary';
    let className = `btn btn-${variant}`;
    
    // Add size class if specified
    if (this.config.size) {
      className += ` btn-${this.config.size}`;
    }
    
    // Add custom className if specified
    if (this.config.className) {
      className += ` ${this.config.className}`;
    }
    
    button.className = className;
    
    // Set text content
    button.textContent = this.config.text;
    
    // Set disabled state
    if (this.config.disabled) {
      button.disabled = true;
    }
    
    // Apply custom styles
    if (this.config.style) {
      button.style.cssText = this.config.style;
    }
    
    // Add click handler
    if (this.config.onClick) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.config.onClick!();
      });
    }
    
    return button;
  }

  /**
   * Get the button element to append to DOM
   */
  getElement(): HTMLButtonElement {
    return this.element;
  }

  /**
   * Update button text
   */
  setText(text: string): void {
    this.config.text = text;
    this.element.textContent = text;
  }

  /**
   * Update button disabled state
   */
  setDisabled(disabled: boolean): void {
    this.config.disabled = disabled;
    this.element.disabled = disabled;
  }

  /**
   * Update button variant
   */
  setVariant(variant: ButtonConfig['variant']): void {
    // Remove old variant class
    const oldVariant = this.config.variant || 'primary';
    this.element.classList.remove(`btn-${oldVariant}`);
    
    // Add new variant class
    this.config.variant = variant || 'primary';
    this.element.classList.add(`btn-${this.config.variant}`);
  }

  /**
   * Update click handler
   */
  setOnClick(onClick: () => void): void {
    // Remove old listener by cloning the element
    const newElement = this.element.cloneNode(true) as HTMLButtonElement;
    this.element.parentNode?.replaceChild(newElement, this.element);
    this.element = newElement;
    
    // Add new listener
    this.config.onClick = onClick;
    this.element.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
  }

  /**
   * Remove the button from DOM
   */
  remove(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// Backward compatibility - ButtonManager that uses the new Button class
export class ButtonManager {
  private buttons: Map<string, Button> = new Map();
  private container: HTMLElement | null = null;

  constructor(container?: HTMLElement) {
    this.container = container || document.getElementById('plugin-buttons') || this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'plugin-buttons';
    container.className = 'plugin-buttons-container';
    document.body.appendChild(container);
    return container;
  }

  registerButton(config: ButtonConfig & { id: string }): void {
    const button = new Button(config);
    this.buttons.set(config.id, button);
    
    if (this.container) {
      this.container.appendChild(button.getElement());
    }
  }

  removeButton(id: string): void {
    const button = this.buttons.get(id);
    if (button) {
      button.remove();
      this.buttons.delete(id);
    }
  }

  clearButtons(): void {
    this.buttons.forEach(button => button.remove());
    this.buttons.clear();
  }
}
