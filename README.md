> for gitops workflows, refer to [template](https://github.com/eagle-cooler/template)

# Power Eagle - Userscript Plugin System for Eagle

**Power Eagle** is a userscript-style plugin system for Eagle.cool that enables quick, lightweight scripting extensions. While Eagle.cool already has a robust extension system, Power Eagle provides a **userscript experience** for simple, single-file plugins that can be installed instantly from URLs.

Think of it like **Tampermonkey for Eagle** - paste a URL, get a working plugin in seconds. Perfect for quick automation, custom workflows, and community-shared utilities.

## Why Power Eagle?

**Eagle's Native Extensions**: Full-featured extensions with complex development workflows  
**Power Eagle**: Simple userscript-style plugins for quick tasks and community sharing

- 🚀 **Instant Installation**: Paste URL → Working plugin in seconds
- 📝 **Simple Development**: Just `plugin.json` + `main.js/py` files  
- 🔗 **Easy Sharing**: Share via GitHub releases or direct links
- 🐍 **Multi-Language**: JavaScript for UI, Python for automation
- 🔒 **Safe Execution**: Isolated contexts with Eagle API access

## Use Cases

- **Quick Utilities**: Simple tools like file creators, batch operations
- **Automation Scripts**: Python scripts for Eagle library management  
- **Community Sharing**: Easy distribution of helpful Eagle workflows
- **Rapid Prototyping**: Test ideas without full extension development
- **Personal Workflows**: Custom scripts tailored to your specific needs

## Features

- 🔌 **Instant Plugin Installation**: Download and install from URLs
- 🎨 **Rich UI Support**: SDK for complex interfaces with organized namespaces
- 🔒 **Isolated Execution**: Safe plugin contexts with prefixed storage
- 📦 **System Integration**: Native zip extraction using OS APIs
- 🎯 **Simple Development**: Just `plugin.json` + script files
- 🏗️ **Organized SDK**: Structured namespaces (`powersdk.visual`, `powersdk.utils`, `powersdk.storage`)
- 🐍 **Multi-Language Support**: JavaScript for UI, Python for automation
- � **Python Callbacks**: Bidirectional Python ↔ Eagle communication via [py-eagle-cooler](https://github.com/eagle-cooler/py-eagle-cooler)
- �🔄 **Auto-Overwrite**: Smart plugin updates (same ID = automatic replacement)

## Plugin Types

### 1. JavaScript Plugins (`"type": "plugin"`)
Traditional userscript plugins with full SDK access and isolated execution contexts.

### 2. Python Scripts (`"type": "python-script"`)
Python scripts that receive Eagle context via environment variables and can **call back to Eagle API** using the [py-eagle-cooler](https://github.com/eagle-cooler/py-eagle-cooler) library for full bidirectional communication.

## Quick Start

### JavaScript Plugin Structure

```
my-plugin/
├── plugin.json          # Plugin manifest
└── main.js             # Plugin implementation
```

### Python Script Structure

```
my-python-plugin/
├── plugin.json          # Plugin manifest
└── main.py             # Python script
```

### JavaScript Plugin Example

```javascript
// main.js
const plugin = async (context) => {
  const { eagle, powersdk } = context;
  
  // Use organized namespaces
  const cardManager = new powersdk.visual.CardManager(powersdk.container);
  
  cardManager.addCardToContainer({
    title: 'My Plugin',
    content: '<p>Hello from my plugin!</p>',
    actions: [
      {
        text: 'Count Files',
        onClick: async () => {
          const files = await eagle.item.getSelected();
          powersdk.storage.set('count', files.length);
          await eagle.notification.show({
            title: 'File Count',
            description: `Found ${files.length} files`
          });
        }
      }
    ]
  });
};
```

### Python Script Example

```python
# main.py
import os
import json
from eagle_cooler.callback import EagleCallback

# Get Eagle context from environment variable
context_json = os.environ.get('POWEREAGLE_CONTEXT', '{}')
context = json.loads(context_json)

# Access Eagle data
selected_folders = context.get('folders', [])
selected_items = context.get('items', [])
library_info = context.get('info', {})

print(f"Library: {library_info.get('name', 'Unknown')}")
print(f"Selected folders: {len(selected_folders)}")
print(f"Selected items: {len(selected_items)}")

# 🚀 REVOLUTIONARY: Call back to Eagle API directly from Python!
if selected_folders:
    folder_name = selected_folders[0]['name']
    
    # Create a new folder
    EagleCallback.folder.create(name=f"Processed_{folder_name}", parent=None)
    
    # Show notification
    EagleCallback.notification.show(
        title="Python Callback Success!",
        description=f"Created folder for {folder_name}"
    )
    
    # Add tags to selected items
    for item in selected_items:
        EagleCallback.item.update_tags(
            item_id=item['id'], 
            tags=["python-processed", "automated"]
        )

print("✅ Python script completed with Eagle API callbacks!")
```

### Plugin Manifests

#### JavaScript Plugin
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "A helpful description of what this plugin does",
  "type": "plugin"
}
```

#### Python Script Plugin
```json
{
  "id": "my-python-script",
  "name": "My Python Script",
  "description": "A Python script that processes Eagle data",
  "type": "python-script",
  "on": ["onStart"]
}
```

> **Note**: Python scripts with `"on": ["onStart"]` auto-execute when the plugin loads. Scripts without this will show manual Execute/Clear controls.

## 🚀 Python Callbacks - Revolutionary Feature

Power Eagle includes a **groundbreaking callback system** that allows Python scripts to directly call Eagle API methods, creating true bidirectional communication between Python and Eagle.

### Installation

```bash
pip install eagle-cooler
```

### How It Works

Python scripts send callback signals via stderr that Power Eagle intercepts and executes as Eagle API calls:

```python
from eagle_cooler.callback import EagleCallback

# Direct Eagle API calls from Python!
EagleCallback.folder.create(name="My New Folder", parent=None)
EagleCallback.notification.show(title="Hello", description="From Python!")
EagleCallback.item.update_tags(item_id="some-id", tags=["new-tag"])
```

### Key Features

- **🔒 Secure**: Token-based authentication prevents unauthorized access
- **🧹 Clean Output**: Callback signals are filtered from Python output automatically
- **⚡ Real-time**: Callbacks execute immediately during Python script execution
- **🔄 Bidirectional**: Full Python ↔ Eagle communication
- **📚 Easy to Use**: Simple library installation and intuitive API

### Example Use Cases

```python
# Batch organize files
for item in selected_items:
    if item['ext'] == 'jpg':
        EagleCallback.folder.create(name="Photos", parent=None)
        EagleCallback.item.move_to_folder(item_id=item['id'], folder_name="Photos")

# Smart tagging based on analysis
if analysis_result['confidence'] > 0.8:
    EagleCallback.item.update_tags(
        item_id=item['id'], 
        tags=[analysis_result['category'], "ai-processed"]
    )

# Progress notifications
EagleCallback.notification.show(
    title="Processing Complete", 
    description=f"Processed {len(items)} items successfully"
)
```

For complete documentation, see the **[py-eagle-cooler repository](https://github.com/eagle-cooler/py-eagle-cooler)**.

## SDK Reference

The Power Eagle SDK provides organized namespaces for better developer experience:

### Core Functionality
- `powersdk.storage` - Isolated localStorage with plugin-specific prefixes
- `powersdk.container` - Plugin's DOM container
- `powersdk.pluginId` - Unique plugin identifier

### Visual Components
- `powersdk.visual.Button` - Enhanced button component
- `powersdk.visual.CardManager` - Rich card UI system
- `powersdk.visual.Dialog` - Modal dialog component

### Utility Functions
- `powersdk.utils.files` - File operations (`createFile`, `extractZip`, `formatBytes`)
- `powersdk.utils.paths` - Path utilities (`getDownloadPath`, `getExtensionsPath`)
- `powersdk.utils.dom` - DOM utilities (`createElement`, `copyToClipboard`)
- `powersdk.utils.common` - Common utilities (`debounce`, `throttle`, `generateId`)

### Eagle API
- `powersdk.webapi` - Eagle HTTP API wrapper

## Example Plugins

This repository includes three example plugins demonstrating different SDK features:

- **[Basic Plugin](./src/examples/basic-plugin.tsx)** - SDK demonstrations (Eagle API, CardManager, Storage)
- **[Recent Libraries](./src/examples/recent-libraries.tsx)** - Complex UI with search, filtering, library management
- **[File Creator](./src/examples/file-creator.tsx)** - Dynamic file creation with extension management

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + DaisyUI
- **Backend**: Eagle.cool Extension Framework
- **File System**: Node.js fs/path modules

## Development

1. Clone and install dependencies:
   ```bash
   git clone <repository>
   cd power-eagle2
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Plugin Installation

1. **Create Plugin**: Create folder with `plugin.json` and `main.js`
2. **Zip Plugin**: Package your plugin folder as a `.zip` file
3. **Upload**: Host the zip file on any public URL
4. **Install**: Use Power Eagle to download from the URL

Plugins are installed to `~user/.powereagle/extensions/{pluginId}/`

## Contributing

See example plugins in `src/examples/` for implementation patterns. All plugins use the universal `plugin(context)` signature and organized SDK namespaces.
