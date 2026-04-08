// Eagle item and folder swap utilities for Power Eagle SDK

/**
 * Finds a folder by name in the Eagle library
 * @param folderName - Name of the folder to find
 * @param eagle - Eagle API instance
 * @returns Promise<Folder | null> - Found folder or null if not found
 */
export async function getFolderByName(folderName: string, eagle: any): Promise<any | null> {
  try {
    const allFolders = await eagle.folder.getAll();
    const folder = allFolders.find((f: any) => f.name === folderName);
    return folder || null;
  } catch (error) {
    console.error('Error searching for folder:', error);
    return null;
  }
}

/**
 * Swaps items from a folder to tags (removes from folder, adds folder name as tag)
 * @param folder - Folder object to swap from
 * @param selectedItems - Array of selected items to process
 * @param eagle - Eagle API instance
 * @returns Promise<{success: boolean, processedCount: number, errors: string[]}>
 */
export async function swapFolderToTag(
  folder: any, 
  selectedItems: any[], 
  eagle: any
): Promise<{success: boolean, processedCount: number, errors: string[]}> {
  const folderName = folder.name || folder.title || folder.id || 'Unknown Folder';
  const errors: string[] = [];
  let processedCount = 0;

  console.log(`Swapping folder "${folderName}" to tag for ${selectedItems.length} items`);

  for (const item of selectedItems) {
    try {
      // Get the fresh item data
      const freshItem = await eagle.item.getById(item.id);
      
      // Add folder name as tag if not already present
      const currentTags = freshItem.tags || [];
      if (!currentTags.includes(folderName)) {
        freshItem.tags = [...currentTags, folderName];
        console.log(`Adding tag "${folderName}" to item ${item.id}`);
      }

      // Remove item from the folder
      const currentFolders = freshItem.folders || [];
      if (currentFolders.includes(folder.id)) {
        freshItem.folders = currentFolders.filter((folderId: string) => folderId !== folder.id);
        console.log(`Removing item ${item.id} from folder "${folderName}"`);
      }

      // Save changes
      await freshItem.save();
      processedCount++;
      
    } catch (itemError) {
      const errorMsg = `Error processing item ${item.id}: ${itemError}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    processedCount,
    errors
  };
}

/**
 * Swaps items from tags to folder (removes tag, adds to folder with tag name)
 * @param tagName - Name of the tag to swap from
 * @param selectedItems - Array of selected items to process
 * @param eagle - Eagle API instance
 * @returns Promise<{success: boolean, processedCount: number, errors: string[], folder: any}>
 */
export async function swapTagToFolder(
  tagName: string, 
  selectedItems: any[], 
  eagle: any
): Promise<{success: boolean, processedCount: number, errors: string[], folder: any}> {
  const errors: string[] = [];
  let processedCount = 0;

  console.log(`Swapping tag "${tagName}" to folder for ${selectedItems.length} items`);

  // First, try to find if folder already exists
  let targetFolder = await getFolderByName(tagName, eagle);

  // If folder doesn't exist, create it
  if (!targetFolder) {
    try {
      console.log(`Creating new folder: "${tagName}"`);
      targetFolder = await eagle.folder.create({ name: tagName });
      console.log('Created new folder:', targetFolder);
    } catch (error) {
      const errorMsg = `Failed to create folder "${tagName}": ${error}`;
      console.error(errorMsg);
      return {
        success: false,
        processedCount: 0,
        errors: [errorMsg],
        folder: null
      };
    }
  }

  // Process each selected item
  for (const item of selectedItems) {
    try {
      // Get the fresh item data
      const freshItem = await eagle.item.getById(item.id);
      
      // Remove the tag from item
      const currentTags = freshItem.tags || [];
      if (currentTags.includes(tagName)) {
        freshItem.tags = currentTags.filter((tag: string) => tag !== tagName);
        console.log(`Removing tag "${tagName}" from item ${item.id}`);
      }

      // Add item to the folder
      const currentFolders = freshItem.folders || [];
      if (!currentFolders.includes(targetFolder.id)) {
        freshItem.folders = [...currentFolders, targetFolder.id];
        console.log(`Adding item ${item.id} to folder "${tagName}"`);
      }

      // Save changes
      await freshItem.save();
      processedCount++;
      
    } catch (itemError) {
      const errorMsg = `Error processing item ${item.id}: ${itemError}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    processedCount,
    errors,
    folder: targetFolder
  };
}
