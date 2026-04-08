/**
 * Creates serialized selected folders with full properties
 * @param folders - Raw folders from eagle.folder.getSelected()
 * @returns Serialized folder objects with all properties
 */
export async function createSerializedSelectedFolders() {
    const folders = await (window as any).eagle.folder.getSelected();
    // simply return a list of ids
    var ret = [];
    for (const folder of folders) {
        ret.push(folder.id);
    }
    return ret;
}

/**
 * Creates serialized selected items with full properties
 * @param items - Raw items from eagle.item.getSelected()
 * @returns Serialized item objects with all properties
 */
export async function createSerializedSelectedItems() {
  const items = await (window as any).eagle.item.getSelected();
  // simply return a list of ids
  var ret = [];
  for (const item of items) {
      ret.push(item.id);
  }
  return ret;
}

