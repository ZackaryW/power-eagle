// DOM and UI utilities for Power Eagle SDK

/**
 * Creates an HTML element with optional class and text content
 * @param tag - HTML tag name
 * @param className - CSS class name (optional)
 * @param textContent - Text content (optional)
 * @returns HTMLElement - Created element
 */
export function createElement(tag: string, className?: string, textContent?: string): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

/**
 * Adds a stylesheet to the document head
 * @param css - CSS content
 * @param id - Optional ID for the style element
 */
export function addStylesheet(css: string, id?: string): void {
  const style = document.createElement('style');
  if (id) style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Removes a stylesheet from the document head
 * @param id - ID of the style element to remove
 */
export function removeStylesheet(id: string): void {
  const style = document.getElementById(id);
  if (style) style.remove();
}

/**
 * Waits for an element to appear in the DOM
 * @param selector - CSS selector for the element
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Promise<HTMLElement> - The found element
 */
export function waitForElement(selector: string, timeout = 5000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Injects script code into the document
 * @param code - JavaScript code to inject
 */
export function injectScript(code: string): void {
  const script = document.createElement('script');
  script.textContent = code;
  document.head.appendChild(script);
  script.remove();
}

/**
 * Copies text to the clipboard
 * @param text - Text to copy
 * @returns Promise<void>
 */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}

/**
 * Sanitizes HTML content by escaping it
 * @param html - HTML string to sanitize
 * @returns string - Sanitized HTML
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}