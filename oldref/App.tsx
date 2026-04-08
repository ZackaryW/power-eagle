import { useState, useEffect, useMemo } from "react";

import { ExtensionManager } from "./manager/manager";

function App() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [extensions, setExtensions] = useState<any[]>([]);
  const [extensionManager, setExtensionManager] =
    useState<ExtensionManager | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  

  useEffect(() => {
    // Initialize the extension manager and theme
    const initializeApp = async () => {
      try {
        // Get theme from Eagle
        const isDark = await eagle.app.isDarkColors();
        setMode(isDark ? "dark" : "light");

        const extManager = new ExtensionManager();
        setExtensionManager(extManager);

        // Scan for installed extensions
        await extManager.scanExtensions();
        const foundExtensions = extManager.getExtensions();
        setExtensions(foundExtensions);

        console.log("Extension manager initialized");
      } catch (error) {
        console.error("Failed to initialize app:", error);
        // Fallback to light theme if Eagle API fails
        setMode("light");
      }
    };

    initializeApp();
  }, []);

  const handleDownloadExtension = async () => {
    if (!extensionManager || !downloadUrl.trim()) return;

    try {
      await extensionManager.downloadExtension(downloadUrl);
      setDownloadUrl("");
      // Refresh extensions list
      await extensionManager.scanExtensions();
      setExtensions(extensionManager.getExtensions());
    } catch (error) {
      console.error(`Failed to download extension from ${downloadUrl}:`, error);
    }
  };

  const handleRefreshExtensions = async () => {
    if (!extensionManager) return;

    try {
      await extensionManager.scanExtensions();
      setExtensions(extensionManager.getExtensions());
    } catch (error) {
      console.error('Failed to refresh extensions:', error);
    }
  };

  const handleOpenPlugin = async (extensionId: string) => {
    if (!extensionManager) return;
    try {
      await extensionManager.openPluginPage(extensionId);
    } catch (error) {
      console.error(`Failed to open plugin ${extensionId}:`, error);
    }
  };

  const handleRemovePlugin = async (
    extensionId: string,
    extensionName: string
  ) => {
    if (!extensionManager) return;

    const extension = extensionManager.getExtension(extensionId);
    if (!extension) return;

    const action = extension.isBuiltin ? "hide" : "delete";
    const message = extension.isBuiltin
      ? `Hide built-in plugin "${extensionName}"? It can be restored later.`
      : `Delete installed plugin "${extensionName}"? This will permanently remove the plugin folder.`;

    if (confirm(message)) {
      try {
        await extensionManager.removeExtension(extensionId);
        setExtensions(extensionManager.getExtensions());
      } catch (error) {
        console.error(`Failed to remove extension ${extensionId}:`, error);
        alert(`Failed to ${action} plugin: ${error}`);
      }
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    extensionId: string,
    extensionName: string
  ) => {
    e.preventDefault();

    const extension = extensionManager?.getExtension(extensionId);
    if (!extension) return;

    const contextMenu = document.createElement("div");
    contextMenu.className = "context-menu";
    contextMenu.style.cssText = `
      position: fixed;
      top: ${e.clientY}px;
      left: ${e.clientX}px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      z-index: 1000;
      min-width: 150px;
    `;

    const menuItems = [
      {
        text: "Open Plugin",
        action: () => handleOpenPlugin(extensionId),
      },
      {
        text: extension.isBuiltin ? "Hide Plugin" : "Delete Plugin",
        action: () => handleRemovePlugin(extensionId, extensionName),
        className: "text-error",
      },
      {
        text: `ID: ${extensionId}`,
        action: () => {},
        className: "text-gray-500 text-xs border-t",
        isInfo: true,
      },
    ];

    menuItems.forEach((item: any) => {
      const menuItem = document.createElement("div");
      menuItem.className = `context-menu-item ${item.className || ""}`;
      menuItem.style.cssText = `
        padding: 8px 12px;
        cursor: ${item.isInfo ? 'default' : 'pointer'};
        border-bottom: 1px solid #f0f0f0;
        ${item.isInfo ? 'border-top: 1px solid #e0e0e0; margin-top: 2px; font-size: 11px;' : ''}
      `;
      menuItem.textContent = item.text;

      if (!item.isInfo) {
        menuItem.addEventListener("click", () => {
          item.action();
          contextMenu.remove();
        });

        menuItem.addEventListener("mouseenter", () => {
          menuItem.style.backgroundColor = "#f8f9fa";
        });

        menuItem.addEventListener("mouseleave", () => {
          menuItem.style.backgroundColor = "white";
        });
      }

      contextMenu.appendChild(menuItem);
    });

    // Remove last border
    const lastItem = contextMenu.lastElementChild as HTMLElement;
    if (lastItem) {
      lastItem.style.borderBottom = "none";
    }

    document.body.appendChild(contextMenu);

    // Remove context menu when clicking elsewhere
    const removeMenu = (e: MouseEvent) => {
      if (!contextMenu.contains(e.target as Node)) {
        contextMenu.remove();
        document.removeEventListener("click", removeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", removeMenu);
    }, 0);
  };

  const [filterText, setFilterText] = useState("");

  // Memoize filtered extensions to avoid recalculation on every render
  const filteredExtensions = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();
    return extensions.filter(ext =>
      ext.name.toLowerCase().includes(lowerFilter) ||
      ext.id.toLowerCase().includes(lowerFilter) ||
      (ext.description && ext.description.toLowerCase().includes(lowerFilter))
    );
  }, [extensions, filterText]);

  return (
    <div
      data-theme={mode}
      className="w-full h-screen flex flex-col bg-base-200"
    >
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Power Eagle</h1>
            <p className="text-sm text-gray-600">Extension Manager</p>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setMode((mode) => (mode === "light" ? "dark" : "light"))
            }
          >
            {mode === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {/* Download Section */}
        <div className="bg-base-100 rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Download Extension</h2>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Enter extension URL..."
              className="input input-bordered input-sm flex-1"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadExtension}
              disabled={!downloadUrl.trim()}
            >
              Download
            </button>
          </div>
        </div>

        {/* Extensions List */}
        <div className="bg-base-100 rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-base-300">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Extensions</h2>
              <button
                className="btn btn-sm btn-outline"
                onClick={handleRefreshExtensions}
                title="Refresh extensions list"
              >
                🔄
              </button>
            </div>
            <input
              type="text"
              placeholder="Filter extensions..."
              className="input input-bordered input-sm w-full"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-base-300">
              {filteredExtensions.map((ext) => (
                <div
                  key={ext.id}
                  className="flex items-center justify-between p-3 hover:bg-base-200 transition-colors cursor-pointer"
                  onContextMenu={(e) => handleContextMenu(e, ext.id, ext.name)}
                  onClick={() => handleOpenPlugin(ext.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{ext.name}</span>
                      {ext.isBuiltin && (
                        <span className="badge badge-xs badge-primary">
                          Built-in
                        </span>
                      )}
                    </div>
                    <div 
                      className="text-xs text-gray-500 truncate" 
                      title={ext.description || 'No description available'}
                    >
                      {ext.description || 'No description available'}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary btn-outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPlugin(ext.id);
                    }}
                  >
                    Open
                  </button>
                </div>
              ))}
              {filteredExtensions.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  {filterText ? 'No extensions match your filter' : 'No extensions installed'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
