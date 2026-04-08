// Path and directory utilities for Power Eagle SDK

const path = require('path');

/**
 * Gets the user's home directory using Eagle API or Node.js fallback
 * @returns Promise<string> - Home directory path
 */
export async function getUserHomeDirectory(): Promise<string> {
  try {
    // Try Eagle API first
    if (typeof window !== 'undefined' && (window as any).eagle?.os?.homedir) {
      return await (window as any).eagle.os.homedir();
    }
    
    // Fallback to Node.js environment variables
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    return homeDir;
  } catch (error) {
    console.error('Failed to get home directory:', error);
    throw new Error(`Could not determine user home directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the Power Eagle extensions directory path
 * @returns Promise<string> - Extensions directory path
 */
export async function getExtensionsPath(): Promise<string> {
  const homeDir = await getUserHomeDirectory();
  return path.join(homeDir, '.powereagle', 'extensions');
}

/**
 * Gets the Power Eagle download directory path
 * @returns Promise<string> - Download directory path
 */
export async function getDownloadPath(): Promise<string> {
  const homeDir = await getUserHomeDirectory();
  return path.join(homeDir, '.powereagle', 'download');
}

/**
 * Gets the Power Eagle base directory path
 * @returns Promise<string> - Base directory path
 */
export async function getPowerEagleBasePath(): Promise<string> {
  const homeDir = await getUserHomeDirectory();
  return path.join(homeDir, '.powereagle');
}

/**
 * Ensures that required Power Eagle directories exist
 * @param userHome - User home directory (optional, will be determined if not provided)
 * @returns Promise<void>
 */
export async function ensurePowerEagleDirectories(userHome?: string): Promise<void> {
  const fs = require('fs');
  
  if (!userHome) {
    userHome = await getUserHomeDirectory();
  }

  const directories = [
    path.join(userHome, '.powereagle'),
    path.join(userHome, '.powereagle', 'download'),
    path.join(userHome, '.powereagle', 'extensions')
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}