// Basic Example Plugin for Power Eagle - SDK Demonstrations
export const plugin = async (context: any) => {
  const { eagle, powersdk } = context;
  
  console.log('Basic plugin loaded - SDK Demonstrations');

  // Create the plugin interface
  powersdk.container.innerHTML = `
    <div class="basic-demo-container max-w-6xl mx-auto p-6">
      <div class="header mb-6">
        <h1 class="text-3xl font-bold mb-2">Power Eagle SDK Demo</h1>
        <p class="text-gray-600">Demonstrating Eagle API, CardManager, and Storage</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Basic Eagle API Demo -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title mb-4">Eagle API Demo</h2>
            <p class="mb-4">Test Eagle notifications and basic functionality</p>
            <button class="btn btn-primary" id="eagle-demo-button">
              Show Eagle Notification
            </button>
          </div>
        </div>

        <!-- CardManager Demo -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title mb-4">CardManager Demo</h2>
            <p class="mb-4">Demonstrate card layout functionality</p>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" id="add-sample-card">Add Card</button>
              <button class="btn btn-warning btn-sm" id="clear-cards">Clear</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Storage Demo -->
      <div class="card bg-base-100 shadow-xl mt-6">
        <div class="card-body">
          <h2 class="card-title mb-4">Storage Demo</h2>
          <div class="flex gap-2 mb-4">
            <input type="text" id="storage-key" placeholder="Key" class="input input-bordered input-sm">
            <input type="text" id="storage-value" placeholder="Value" class="input input-bordered input-sm">
            <button class="btn btn-primary btn-sm" id="save-storage">Save</button>
            <button class="btn btn-secondary btn-sm" id="load-storage">Load</button>
          </div>
          <div id="storage-display" class="text-sm text-gray-600"></div>
        </div>
      </div>

      <!-- Button Component Demo -->
      <div class="card bg-base-100 shadow-xl mt-6">
        <div class="card-body">
          <h2 class="card-title mb-4">Button Component Demo</h2>
          <p class="mb-4">Demonstrate the new Button class functionality</p>
          <div id="button-demo-container" class="flex gap-2 flex-wrap">
            <!-- Buttons will be added here programmatically -->
          </div>
        </div>
      </div>
      
      <!-- Card Results -->
      <div class="mt-6">
        <h3 class="text-lg font-semibold mb-3">Card Results</h3>
        <div id="demo-results" class="card-container">
          <p class="text-center py-8 text-gray-500">Click "Add Card" to see CardManager in action</p>
        </div>
      </div>
    </div>
  `;

  // Initialize card manager
  const resultsContainer = powersdk.container.querySelector('#demo-results');
  const cardManager = new powersdk.visual.CardManager(resultsContainer);

  // Eagle API Demo
  const eagleDemoBtn = powersdk.container.querySelector('#eagle-demo-button');
  eagleDemoBtn?.addEventListener('click', async () => {
    await eagle.notification.show({
      title: 'Eagle API Working!',
      description: 'This notification comes from the Eagle API'
    });
  });

  // CardManager Demo
  const addSampleBtn = powersdk.container.querySelector('#add-sample-card');
  const clearBtn = powersdk.container.querySelector('#clear-cards');

  addSampleBtn?.addEventListener('click', () => {
    const cardId = `sample-${Date.now()}`;
    cardManager.addCardToContainer({
      id: cardId,
      title: `Sample Card ${Math.floor(Math.random() * 100)}`,
      subtitle: 'This is a sample card with random content',
      content: `
        <div class="space-y-2">
          <p>This card demonstrates the CardManager functionality.</p>
          <p class="text-sm text-gray-600">Created at: ${new Date().toLocaleTimeString()}</p>
        </div>
      `,
      status: 'primary',
      actions: [
        {
          id: `action-${cardId}`,
          text: 'Sample Action',
          onClick: () => {
            eagle.notification.show({
              title: 'Card Action',
              description: 'This action comes from a CardManager card!'
            });
          },
          variant: 'primary'
        }
      ]
    });
  });

  clearBtn?.addEventListener('click', () => {
    cardManager.clearCards();
    eagle.notification.show({
      title: 'Cards Cleared',
      description: 'All demo cards have been removed'
    });
  });

  // Storage Demo
  const saveBtn = powersdk.container.querySelector('#save-storage');
  const loadBtn = powersdk.container.querySelector('#load-storage');
  const keyInput = powersdk.container.querySelector('#storage-key') as HTMLInputElement;
  const valueInput = powersdk.container.querySelector('#storage-value') as HTMLInputElement;
  const storageDisplay = powersdk.container.querySelector('#storage-display');

  saveBtn?.addEventListener('click', () => {
    const key = keyInput?.value;
    const value = valueInput?.value;
    if (key && value) {
      powersdk.storage.set(key, value);
      eagle.notification.show({
        title: 'Storage Saved',
        description: `Saved "${key}" = "${value}"`
      });
      keyInput.value = '';
      valueInput.value = '';
    }
  });

  loadBtn?.addEventListener('click', () => {
    const key = keyInput?.value;
    if (key) {
      const value = powersdk.storage.get(key);
      if (value !== null) {
        storageDisplay!.textContent = `"${key}" = "${value}"`;
        valueInput!.value = value;
      } else {
        storageDisplay!.textContent = `"${key}" not found`;
      }
    }
  });

  // Button Component Demo
  const buttonContainer = powersdk.container.querySelector('#button-demo-container');
  
  // Create various button examples
  const primaryButton = new powersdk.visual.Button({
    text: 'Primary Button',
    variant: 'primary',
    onClick: async () => {
      await eagle.shell.beep();
      await eagle.notification.show({
        title: 'Primary Button',
        description: 'You clicked the primary button!'
      });
    }
  });

  const secondaryButton = new powersdk.visual.Button({
    text: 'Secondary',
    variant: 'secondary',
    size: 'sm',
    onClick: () => {
      eagle.notification.show({
        title: 'Secondary Button',
        description: 'Small secondary button clicked!'
      });
    }
  });

  const successButton = new powersdk.visual.Button({
    text: 'Success',
    variant: 'success',
    onClick: () => {
      eagle.notification.show({
        title: 'Success!',
        description: 'This is a success notification'
      });
    }
  });

  const toggleButton = new powersdk.visual.Button({
    text: 'Enable Feature',
    variant: 'warning',
    onClick: () => {
      const currentText = toggleButton.getElement().textContent;
      const isEnabled = currentText === 'Disable Feature';
      toggleButton.setText(isEnabled ? 'Enable Feature' : 'Disable Feature');
      toggleButton.setVariant(isEnabled ? 'warning' : 'error');
      
      eagle.notification.show({
        title: isEnabled ? 'Feature Disabled' : 'Feature Enabled',
        description: `Feature is now ${isEnabled ? 'disabled' : 'enabled'}`
      });
    }
  });

  // Add buttons to container
  if (buttonContainer) {
    buttonContainer.appendChild(primaryButton.getElement());
    buttonContainer.appendChild(secondaryButton.getElement());
    buttonContainer.appendChild(successButton.getElement());
    buttonContainer.appendChild(toggleButton.getElement());
  }
};
