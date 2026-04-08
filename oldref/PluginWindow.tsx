import { useEffect } from "react";

interface PluginWindowProps {
  extensionId: string;
  extensionName: string;
}

function PluginWindow({ extensionId, extensionName }: PluginWindowProps) {
  useEffect(() => {
    // Load and execute the plugin function
    const loadPlugin = async () => {
      try {
        // In a real implementation, this would load the main.js file
        // and execute the plugin function with the global eagle object
        console.log(`Loading plugin: ${extensionName}`);
        
        // Mock plugin execution
        const pluginFunction = function examplePlugin(api: any, eagle: any) {
          api.registerButton({
            id: 'plugin-button',
            text: `${extensionName} Action`,
            onClick: () => {
              eagle.notification.show({
                title: 'Plugin Action',
                description: `Action from ${extensionName}!`
              });
            }
          });
        };

        // Create plugin API
        const pluginAPI = {
          registerButton: (config: any) => {
            console.log(`Registering button: ${config.text}`);
            // In a real implementation, this would add buttons to the UI
          }
        };

        // Execute plugin with global eagle object
        pluginFunction(pluginAPI, (window as any).eagle);
        
        console.log(`Plugin ${extensionName} loaded successfully`);
      } catch (error) {
        console.error(`Failed to load plugin ${extensionName}:`, error);
      }
    };

    loadPlugin();
  }, [extensionId, extensionName]);

  return (
    <div className="w-full h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{extensionName}</h1>
        <p className="text-gray-600 mb-6">Plugin ID: {extensionId}</p>
        
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Plugin Interface</h2>
            <div id="plugin-buttons" className="flex flex-wrap gap-2">
              {/* Plugin buttons will be dynamically added here */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PluginWindow;
