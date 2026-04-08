export const plugin = async (context: any) => {
  const { powersdk } = context;
  console.log('File Creator plugin loaded');

  // Plugin state
  let extensions: string[] = [];
  let cardManager: any = null;

  // Initialize the plugin UI
  initializeUI();

  // Main functions
  async function initializeUI() {
    // Load extensions from storage
    extensions = loadExtensions();

    // Create the plugin interface
    if (!powersdk.container) {
      console.error('Plugin container is undefined. Cannot initialize UI.');
      return;
    }

    console.log('Container state before accessing innerHTML:', powersdk.container);

    try {
      powersdk.container.innerHTML = `
        <div class="file-creator-container max-w-5xl mx-auto p-5">
          <div class="header mb-5">
            <h1 class="text-2xl font-bold mb-2">File Creator</h1>
            <p class="text-gray-600">Create files with custom extensions</p>
          </div>
          
          <div class="controls mb-5">
            <button id="create-file" class="btn btn-primary">Create New File</button>
            <div id="extension-buttons" class="flex gap-2 mt-4"></div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error setting innerHTML:', error);
      return;
    }

    console.log('Container state after setting innerHTML:', powersdk.container);

    if (!powersdk.container.innerHTML) {
      console.error('Container innerHTML is undefined.');
      return;
    }

    // Initialize card manager
    const resultsContainer = powersdk.container.querySelector('#extension-buttons');
    cardManager = new powersdk.visual.CardManager(resultsContainer);

    // Add event listeners
    setupEventListeners();

    // Render dynamic buttons
    renderExtensionButtons();
  }

  function setupEventListeners() {
    const createFileBtn = powersdk.container.querySelector('#create-file');

    if (createFileBtn) {
      createFileBtn.addEventListener('click', () => {
        console.log('Create button clicked. Opening file dialog.');
        openFileDialog();
      });
    } else {
      console.error('Create button not found in the container.');
    }
  }

  function openFileDialog() {
    const dialog = new powersdk.visual.Dialog();

    const elements = [
      {
        type: 'heading',
        text: 'Enter File Details',
      },
      {
        type: 'input',
        id: 'file-name',
        inputType: 'text',
        placeholder: 'File Name',
        class: 'input input-bordered mb-2',
        style: 'width: 100%; margin-bottom: 10px;',
      },
      {
        type: 'input',
        id: 'file-extension',
        inputType: 'text',
        placeholder: 'File Extension',
        class: 'input input-bordered',
        style: 'width: 100%; margin-bottom: 10px;',
      },
    ];

    dialog.open(
      elements,
      async (data: { [x: string]: any; }) => {
        const fileName = data['file-name'];
        const fileExtension = data['file-extension'];

        if (fileName && fileExtension) {
          console.log(`Creating file: ${fileName}.${fileExtension}`);

          // Save extension to storage
          if (!extensions.includes(fileExtension)) {
            extensions.push(fileExtension);
            powersdk.storage.set('extension-list', extensions);
          }

          // Create the file using the utility function
          var baseContent = '';

          if (fileExtension == "json") {
            baseContent = '{}';
          } else {
            baseContent = 'I NEED TO HAVE SOMETHING OTHERWISE EAGLE FAILS';
          }

          const success = await powersdk.utils.files.createFile(fileName, fileExtension, baseContent);
          if (success) {
            console.log(`File ${fileName}.${fileExtension} created successfully.`);
          } else {
            console.error(`Failed to create file ${fileName}.${fileExtension}.`);
          }
        }
      },
      () => {
        console.log('Dialog closed without submission.');
      }
    );
  }

  function renderExtensionButtons() {
    if (!cardManager) return;

    cardManager.clearCards();

    extensions.forEach(ext => {
      cardManager.addCardToContainer({
        id: `extension-${ext}`,
        title: `Create .${ext} File`,
        content: '',
        actions: [
          {
            id: `create-${ext}`,
            text: `Create .${ext} File`,
            onClick: () => {
              const dialog = new powersdk.visual.Dialog();

              const elements = [
                {
                  type: 'heading',
                  text: 'Enter File Details',
                },
                {
                  type: 'input',
                  id: 'file-name',
                  inputType: 'text',
                  placeholder: 'File Name',
                  class: 'input input-bordered mb-2',
                  style: 'width: 100%; margin-bottom: 10px;',
                },
                {
                  type: 'input',
                  id: 'file-extension',
                  inputType: 'text',
                  placeholder: ext,
                  class: 'input input-bordered',
                  style: 'width: 100%; margin-bottom: 10px;',
                  disabled: true,
                },
              ];

              dialog.open(
                elements,
                async (data: { [x: string]: any; }) => {
                  const fileName = data['file-name'];
                  const fileExtension = ext; // Use the fixed extension

                  if (fileName) {
                    console.log(`Creating file: ${fileName}.${fileExtension}`);

                    // Save extension to storage
                    if (!extensions.includes(fileExtension)) {
                      extensions.push(fileExtension);
                      powersdk.storage.set('extension-list', extensions);
                    }

                    // Create the file using the utility function
                    var baseContent = '';

                    if (fileExtension == "json") {
                      baseContent = '{}';
                    } else {
                      baseContent = 'I NEED TO HAVE SOMETHING OTHERWISE EAGLE FAILS';
                    }

                    const success = await powersdk.utils.files.createFile(fileName, fileExtension, baseContent);
                    if (success) {
                      console.log(`File ${fileName}.${fileExtension} created successfully.`);
                    } else {
                      console.error(`Failed to create file ${fileName}.${fileExtension}.`);
                    }
                  }
                },
                () => {
                  console.log('Dialog closed without submission.');
                }
              );
            },
            variant: 'primary'
          }
        ]
      });
    });
  }

  function loadExtensions(): string[] {
    const extensions = powersdk.storage.get('extension-list');
    return extensions || [];
  }
};