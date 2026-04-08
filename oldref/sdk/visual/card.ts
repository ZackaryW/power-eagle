// Card layout utilities for Power Eagle SDK

export interface CardConfig {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  actions?: CardAction[];
  status?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

export interface CardAction {
  id: string;
  text: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'warning' | 'error';
  onClick: () => void;
  disabled?: boolean;
}

export class CardManager {
  private cards: Map<string, CardConfig> = new Map();
  private container: HTMLElement | null = null;

  constructor(container?: HTMLElement) {
    this.container = container || this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'card-container flex flex-wrap gap-4 p-4';
    return container;
  }

  createCard(config: CardConfig): HTMLElement {
    this.cards.set(config.id, config);
    return this.renderCard(config);
  }

  private renderCard(config: CardConfig): HTMLElement {
    const card = document.createElement('div');
    card.className = `card bg-base-100 shadow-xl ${config.className || ''}`;
    card.setAttribute('data-card-id', config.id);

    // Card body
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    // Title
    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = config.title;

    // Subtitle
    if (config.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'text-sm text-gray-500 mb-2';
      subtitle.textContent = config.subtitle;
      cardBody.appendChild(subtitle);
    }

    cardBody.appendChild(title);

    // Content
    const content = document.createElement('div');
    content.className = 'card-content';
    content.innerHTML = config.content;
    cardBody.appendChild(content);

    // Actions
    if (config.actions && config.actions.length > 0) {
      const actions = document.createElement('div');
      actions.className = 'card-actions justify-end mt-4';

      config.actions.forEach(action => {
        const button = document.createElement('button');
        button.className = `btn btn-sm btn-${action.variant || 'primary'}`;
        button.textContent = action.text;
        button.setAttribute('data-action-id', action.id);
        button.disabled = action.disabled || false;

        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!action.disabled) {
            action.onClick();
          }
        });

        actions.appendChild(button);
      });

      cardBody.appendChild(actions);
    }

    // Status indicator
    if (config.status && config.status !== 'default') {
      const statusIndicator = document.createElement('div');
      statusIndicator.className = `status-indicator status-${config.status}`;
      
      const statusIcon = this.getStatusIcon(config.status);
      statusIndicator.innerHTML = statusIcon;
      
      card.appendChild(statusIndicator);
    }

    card.appendChild(cardBody);
    return card;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'success':
        return '<span class="status-icon success">✓</span>';
      case 'warning':
        return '<span class="status-icon warning">⚠</span>';
      case 'error':
        return '<span class="status-icon error">✗</span>';
      default:
        return '';
    }
  }

  addCardToContainer(config: CardConfig): void {
    if (!this.container) return;
    
    const card = this.createCard(config);
    this.container.appendChild(card);
  }

  removeCard(cardId: string): void {
    const card = this.container?.querySelector(`[data-card-id="${cardId}"]`);
    if (card) {
      card.remove();
      this.cards.delete(cardId);
    }
  }

  updateCard(cardId: string, updates: Partial<CardConfig>): void {
    const existingConfig = this.cards.get(cardId);
    if (!existingConfig) return;

    const updatedConfig = { ...existingConfig, ...updates };
    this.cards.set(cardId, updatedConfig);

    // Re-render the card
    const existingCard = this.container?.querySelector(`[data-card-id="${cardId}"]`);
    if (existingCard) {
      const newCard = this.createCard(updatedConfig);
      existingCard.replaceWith(newCard);
    }
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  getCards(): CardConfig[] {
    return Array.from(this.cards.values());
  }

  clearCards(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.cards.clear();
  }
}

// Utility functions for common card patterns
export const CardUtils = {
  createLibraryCard: (library: any): CardConfig => ({
    id: `library-${library.path}`,
    title: library.name,
    subtitle: library.dirname,
    content: `
      <div class="library-info">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm text-gray-600">Path:</span>
          <code class="text-xs bg-gray-100 px-2 py-1 rounded">${library.path}</code>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Status:</span>
          <span class="badge badge-sm ${library.isValid ? 'badge-success' : 'badge-error'}">
            ${library.isValid ? 'Valid' : 'Invalid'}
          </span>
        </div>
      </div>
    `,
    status: library.isValid ? 'success' : 'error',
    actions: [
      {
        id: 'switch',
        text: 'Switch',
        variant: 'primary',
        onClick: () => console.log('Switch library:', library.path)
      },
      {
        id: 'info',
        text: 'Info',
        variant: 'secondary',
        onClick: () => console.log('Show library info:', library.path)
      }
    ]
  }),

  createStatusCard: (title: string, message: string, status: 'success' | 'warning' | 'error'): CardConfig => ({
    id: `status-${Date.now()}`,
    title,
    content: `<p class="text-sm">${message}</p>`,
    status,
    className: 'border-l-4 border-l-current'
  }),

  createActionCard: (title: string, description: string, actions: CardAction[]): CardConfig => ({
    id: `action-${Date.now()}`,
    title,
    subtitle: description,
    content: '',
    actions
  })
};
