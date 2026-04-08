// Plugin download functionality

import { extractZip } from '../sdk/utils/files';
import { BaseManager } from '../sdk/utils/logging';
import { getUserHomeDirectory, ensurePowerEagleDirectories } from '../sdk/utils/paths';

export class PluginDownload extends BaseManager {
  constructor() {
    super('PluginDownload');
  }

  /**
   * Downloads a plugin from URL and validates it
   * @param url - Download URL
   * @param eagle - Eagle API object
   * @param onRescan - Callback to trigger rescan after successful download
   * @returns Promise<boolean> - Success status
   */
  async downloadPlugin(url: string, eagle: any, onRescan: () => void): Promise<boolean> {
    try {
      this.debugLog(`Starting plugin download from: ${url}`);

      // Validate URL ends with .zip
      if (!url.toLowerCase().endsWith('.zip')) {
        await eagle.notification.show({
          title: 'Invalid URL',
          description: 'Plugin URL must end with .zip'
        });
        return false;
      }

      // Download the plugin
      const success = await this.downloadAndExtractPlugin(url, eagle, onRescan);
      
      if (success) {
        await eagle.notification.show({
          title: 'Plugin Downloaded',
          description: 'Plugin has been successfully downloaded and installed'
        });
      }

      return success;
    } catch (error) {
      this.debugLog(`Download failed:`, error);
      await eagle.notification.show({
        title: 'Download Failed',
        description: `Failed to download plugin: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return false;
    }
  }

  /**
   * Downloads and extracts plugin from URL
   * @param url - Download URL
   * @param eagle - Eagle API object
   * @param onRescan - Callback to trigger rescan
   * @returns Promise<boolean> - Success status
   */
  private async downloadAndExtractPlugin(url: string, eagle: any, onRescan: () => void): Promise<boolean> {
    try {
      // Get user home directory
      const userHome = await getUserHomeDirectory();
      const downloadPath = `${userHome}/.powereagle/download/new.zip`;
      const extensionsPath = `${userHome}/.powereagle/extensions`;

      this.debugLog(`Downloading to: ${downloadPath}`);

      // Ensure directories exist
      await ensurePowerEagleDirectories(userHome);

      // Download the file
      await this.downloadFile(url, downloadPath);

      // Extract and validate
      const isValid = await this.validateAndExtractPlugin(downloadPath, extensionsPath);

      if (isValid) {
        // Clean up zip file
        await this.deleteFile(downloadPath);
        
        // Trigger rescan
        onRescan();
        
        this.debugLog('Plugin successfully downloaded and extracted');
        return true;
      } else {
        // Remove invalid zip file
        await this.deleteFile(downloadPath);
        
        await eagle.notification.show({
          title: 'Invalid Plugin',
          description: 'Plugin must contain plugin.json and main.js files'
        });
        
        return false;
      }
    } catch (error) {
      this.debugLog(`Download and extract failed:`, error);
      throw error;
    }
  }

  /**
   * Downloads file from URL to local path
   * @param url - Download URL
   * @param filePath - Local file path
   */
  private async downloadFile(url: string, filePath: string): Promise<void> {
    const fs = require('fs');
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      fs.writeFileSync(filePath, buffer);
      this.debugLog(`File downloaded successfully to: ${filePath}`);
    } catch (error) {
      this.debugLog(`Download failed:`, error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates and extracts plugin from zip file
   * @param zipPath - Path to zip file
   * @param extensionsPath - Extensions directory path
   * @returns Promise<boolean> - Whether plugin is valid
   */
  private async validateAndExtractPlugin(zipPath: string, extensionsPath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');

      // Extract to temporary directory first
      const tempDir = path.join(extensionsPath, 'temp');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Extract zip
      const extractSuccess = await extractZip(zipPath, tempDir);
      if (!extractSuccess) {
        this.debugLog('Failed to extract zip file');
        return false;
      }

      // Check for required files after extraction
      const pluginJsonPath = path.join(tempDir, 'plugin.json');
      const mainJsPath = path.join(tempDir, 'main.js');
      
      const hasPluginJson = fs.existsSync(pluginJsonPath);
      const hasMainJs = fs.existsSync(mainJsPath);

      if (!hasPluginJson || !hasMainJs) {
        this.debugLog(`Missing required files. Has plugin.json: ${hasPluginJson}, Has main.js: ${hasMainJs}`);
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        return false;
      }

      // Read plugin.json to get plugin ID
      const pluginJsonContent = fs.readFileSync(pluginJsonPath, 'utf8');
      const pluginManifest = JSON.parse(pluginJsonContent);
      
      if (!pluginManifest.id) {
        this.debugLog('Plugin manifest missing ID');
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        return false;
      }

      // Create final plugin directory
      const pluginDir = path.join(extensionsPath, pluginManifest.id);
      if (fs.existsSync(pluginDir)) {
        // Remove existing plugin
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }

      // Move files from temp to final directory
      fs.renameSync(tempDir, pluginDir);
      
      this.debugLog(`Plugin extracted to: ${pluginDir}`);
      return true;
    } catch (error) {
      this.debugLog(`Validation and extraction failed:`, error);
      return false;
    }
  }

  /**
   * Deletes a file
   * @param filePath - Path to file to delete
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.debugLog(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.debugLog(`Failed to delete file ${filePath}:`, error);
    }
  }
}
