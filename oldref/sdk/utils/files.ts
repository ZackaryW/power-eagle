// File system utilities for Power Eagle SDK

/**
 * Extracts a zip file using system APIs (Windows/Mac)
 * @param zipPath - Path to the zip file
 * @param extractPath - Path to extract to
 * @returns Promise<boolean> - Success status
 */
export async function extractZip(zipPath: string, extractPath: string): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const fs = require('fs');

    // Ensure extract directory exists
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Detect platform and use appropriate command
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      // Windows: Use PowerShell Expand-Archive
      const zipPathEscaped = zipPath.replace(/\\/g, '\\\\');
      const extractPathEscaped = extractPath.replace(/\\/g, '\\\\');
      command = `powershell -Command "Expand-Archive -Path '${zipPathEscaped}' -DestinationPath '${extractPathEscaped}' -Force"`;
    } else if (platform === 'darwin') {
      // macOS: Use unzip command
      command = `unzip -o "${zipPath}" -d "${extractPath}"`;
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Extracting zip: ${command}`);
    
    // Use a manual promise wrapper instead of promisify to avoid compatibility issues
    return new Promise((resolve, reject) => {
      exec(command, (error: any, _stdout: any, _stderr: any) => {
        if (error) {
          console.error('Zip extraction failed:', error);
          reject(error);
        } else {
          console.log('Zip extraction completed successfully');
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('Zip extraction failed:', error);
    return false;
  }
}



/**
 * Creates a new file and adds it to Eagle
 * @param fileName - Name of the file (without extension)
 * @param extension - File extension
 * @param content - File content (optional)
 * @param options - Additional options for Eagle
 * @returns Promise<boolean> - Success status
 */
export async function createFile(fileName: string, extension: string, content: string | null = null, options: any = {}): Promise<boolean> {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const tempDir = await (window as any).eagle.os.tmpdir();
    const filePath = path.join(tempDir, `${fileName}.${extension}`);
    
    // Get current folder selection
    const currentDirs = await (window as any).eagle.folder.getSelected();
    if (currentDirs && currentDirs.length > 0) {
      const currentDir = currentDirs[0];
      options["folders"] = [currentDir.id];
    }
    
    // Write file content
    await fs.promises.writeFile(filePath, content || '');
    
    // Set file name in options
    options['name'] = `${fileName}.${extension}`;
    
    // Add file to Eagle
    await (window as any).eagle.item.addFromPath(filePath, options);
    
    return true;
  } catch (error) {
    console.error('Failed to create file in Eagle:', error);
    return false;
  }
}

/**
 * Formats bytes to human readable format
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns string - Formatted byte string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}