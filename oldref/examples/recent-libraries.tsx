// Recent Libraries Plugin for Power Eagle
export const plugin = async (context: any) => {
  const { eagle, powersdk } = context;
  console.log('Recent Libraries plugin loaded');

  // Plugin state
  let libraries: any[] = [];
  let searchTimeout: any = null;
  let cardManager: any = null;

  // Initialize the plugin UI
  initializeUI();

  // Main functions
  async function initializeUI() {
    // Create the plugin interface with card layout
    powersdk.container.innerHTML = `
      <div class="recent-libraries-container max-w-5xl mx-auto p-5">
        <div class="header mb-5">
          <h1 class="text-2xl font-bold mb-2">Recent Libraries</h1>
          <p class="text-gray-600">View and manage your recent Eagle libraries</p>
        </div>
        
        <div class="controls mb-5">
          <div class="flex gap-4 items-center">
            <div class="flex-1">
              <input 
                type="text" 
                id="library-search" 
                placeholder="Filter libraries..." 
                class="input input-bordered w-full"
              >
            </div>
            <button id="refresh-libraries" class="btn btn-secondary">Refresh</button>
            <button id="clear-invalid" class="btn btn-warning">Clear Invalid</button>
          </div>
        </div>
        
        <div class="content-section">
          <div id="library-results" class="card-container space-y-2">
            <p class="loading text-center py-4">Loading libraries...</p>
          </div>
        </div>
      </div>
    `;

    // Initialize card manager
    const resultsContainer = powersdk.container.querySelector('#library-results');
    cardManager = new powersdk.visual.CardManager(resultsContainer);

    // Add event listeners
    setupEventListeners();
    
    // Load initial data
    await loadLibraries();
  }

  function setupEventListeners() {
    const searchInput = powersdk.container.querySelector('#library-search');
    const refreshBtn = powersdk.container.querySelector('#refresh-libraries');
    const clearBtn = powersdk.container.querySelector('#clear-invalid');

    if (searchInput) {
      searchInput.addEventListener('input', (e: any) => {
        const query = e.target.value.toLowerCase();
        if (searchTimeout) clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(() => {
          filterLibraries(query);
        }, 300);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadLibraries();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearInvalidLibraries();
      });
    }
  }

  async function loadLibraries() {
    try {
      // Get recent libraries from Eagle settings
      const recentLibraries = await getRecentLibraries();
      
      // Convert to our format and check validity
      libraries = await Promise.all(recentLibraries.map(async (libPath: string, index: number) => {
        const isValid = await checkLibraryValidity(libPath);
        const pathParts = libPath.split('/');
        const name = pathParts[pathParts.length - 1].replace('.library', '');
        
        return {
          id: `lib_${index}`,
          name: name,
          path: libPath,
          lastAccessed: new Date(),
          status: isValid ? 'valid' : 'invalid'
        };
      }));

      displayLibraries(libraries);
    } catch (error) {
      console.error('Failed to load libraries:', error);
      showError('Failed to load libraries');
    }
  }

  async function getRecentLibraries(): Promise<string[]> {
    try {
      const process = require('process');
      // Get Eagle settings path
      const roamingPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? 
                         process.env.HOME + '/Library/Application Support' : 
                         process.env.HOME + "/.local/share");
      const settingsPath = `${roamingPath}/eagle/Settings`;
      
      // Read Eagle settings file (async)
      const fs = require('fs');
      const settingsData = await fs.promises.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      return settings.libraryHistory || [];
    } catch (error) {
      console.error('Failed to read recent libraries:', error);
      return [];
    }
  }

  async function checkLibraryValidity(libraryPath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      await fs.promises.access(libraryPath);
      return true;
    } catch {
      return false;
    }
  }

  function displayLibraries(libs: any[]) {
    if (!cardManager) return;

    cardManager.clearCards();

    if (libs.length === 0) {
      cardManager.addCardToContainer({
        id: 'no-libraries',
        title: 'No Libraries Found',
        content: '<p class="text-gray-500">No libraries match your search criteria.</p>',
        status: 'info'
      });
      return;
    }

    libs.forEach(lib => {
      const statusColor = lib.status === 'valid' ? 'success' : 'error';
      const lastAccessed = new Date(lib.lastAccessed).toLocaleDateString();
      
      cardManager.addCardToContainer({
        id: `library-${lib.id}`,
        title: lib.name,
        subtitle: `Last accessed: ${lastAccessed}`,
        content: `
          <div class="flex items-center justify-between">
            <p class="text-sm text-gray-600 break-all flex-1 mr-2">${lib.path}</p>
            <span class="badge badge-sm ${statusColor === 'success' ? 'badge-success' : 'badge-error'}">${lib.status}</span>
          </div>
        `,
        status: statusColor,
        actions: [
          {
            id: `open-${lib.id}`,
            text: 'Open Library',
            onClick: () => openLibrary(lib),
            variant: 'primary'
          },
          {
            id: `remove-${lib.id}`,
            text: 'Remove',
            onClick: () => removeLibrary(lib),
            variant: 'error'
          }
        ]
      });
    });
  }

  function filterLibraries(query: string) {
    if (!query.trim()) {
      displayLibraries(libraries);
      return;
    }

    const filtered = libraries.filter(lib => 
      lib.name.toLowerCase().includes(query) ||
      lib.path.toLowerCase().includes(query)
    );

    displayLibraries(filtered);
  }

  async function openLibrary(library: any) {
    try {
      eagle.notification.show({
        title: 'Opening Library',
        description: `Opening ${library.name}...`
      });
      
      // Use Eagle API to switch to the library
      await switchLibrary(library.path);
      
      eagle.notification.show({
        title: 'Library Opened',
        description: `Successfully opened ${library.name}`
      });
    } catch (error) {
      console.error('Failed to open library:', error);
      eagle.notification.show({
        title: 'Error',
        description: `Failed to open ${library.name}`
      });
    }
  }

  async function switchLibrary(libraryPath: string) {
    try {
      // Use webapi from SDK to switch library
      await powersdk.webapi.library.switch(libraryPath);
      
      eagle.notification.show({
        title: 'Library Switched',
        description: `Successfully switched to library at ${libraryPath}`
      });
    } catch (error) {
      console.error('Failed to switch library:', error);
      eagle.notification.show({
        title: 'Switch Failed',
        description: `Failed to switch to library at ${libraryPath}`
      });
      throw error;
    }
  }

  function removeLibrary(library: any) {
    if (confirm(`Remove library "${library.name}" from recent list?`)) {
      libraries = libraries.filter(lib => lib.id !== library.id);
      displayLibraries(libraries);
      
      eagle.notification.show({
        title: 'Library Removed',
        description: `${library.name} removed from recent libraries`
      });
    }
  }

  async function clearInvalidLibraries() {
    const invalidCount = libraries.filter(lib => lib.status === 'invalid').length;
    
    if (invalidCount === 0) {
      eagle.notification.show({
        title: 'No Invalid Libraries',
        description: 'All libraries are valid'
      });
      return;
    }

    if (confirm(`Remove ${invalidCount} invalid libraries from recent list?`)) {
      try {
        // Clear invalid libraries from Eagle settings
        await clearInvalidPaths();
        
        // Reload libraries to reflect changes
        await loadLibraries();
        
        eagle.notification.show({
          title: 'Invalid Libraries Cleared',
          description: `Removed ${invalidCount} invalid libraries`
        });
      } catch (error) {
        console.error('Failed to clear invalid libraries:', error);
        eagle.notification.show({
          title: 'Error',
          description: 'Failed to clear invalid libraries'
        });
      }
    }
  }

  async function clearInvalidPaths() {
    try {
      // Get Eagle settings path
      const roamingPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? 
                         process.env.HOME + '/Library/Application Support' : 
                         process.env.HOME + "/.local/share");
      const settingsPath = `${roamingPath}/eagle/Settings`;
      
      // Read current settings (async)
      const fs = require('fs');
      const settingsData = await fs.promises.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      // Filter out invalid paths
      const validPaths = [];
      for (const path of settings.libraryHistory) {
        if (await checkLibraryValidity(path)) {
          validPaths.push(path);
        }
      }
      
      // Update settings (async)
      settings.libraryHistory = validPaths;
      await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      
      return validPaths;
    } catch (error) {
      console.error('Failed to clear invalid paths:', error);
      throw error;
    }
  }

  function showError(message: string) {
    if (cardManager) {
      cardManager.clearCards();
      cardManager.addCardToContainer({
        id: 'error',
        title: 'Error',
        content: `<p class="text-red-600">${message}</p>`,
        status: 'error'
      });
    }
  }
};
