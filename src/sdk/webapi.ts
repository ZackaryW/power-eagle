// HTTP client for Eagle's web API.
// This is separate from the host-provided global eagle runtime object.
// %ZMEM:a9fd% decision #sdk #webapi #identity "webapi is the HTTP client identity for Eagle's web API and should remain conceptually separate from the host-provided eagle runtime." %ZMEM%
interface EagleApiResponse<T = any> {
  data: T;
}

interface ApplicationInfo {
  preferences: {
    developer: {
      apiToken: string;
    };
  };
}

export interface FolderCreateParams {
  folderName: string;
  parent?: string | null;
}

export interface FolderRenameParams {
  folderId: string;
  newName: string;
}

interface FolderUpdateParams {
  folderId: string;
  newName?: string | null;
  newDescription?: string | null;
  newColor?: string | null;
}

export interface LibrarySwitchParams {
  libraryPath: string;
}

export interface LibraryIconParams {
  libraryPath: string;
}

interface ItemUpdateParams {
  itemId: string;
  tags?: string[] | null;
  annotation?: string | null;
  url?: string | null;
  star?: number | null;
}

export interface ItemRefreshParams {
  id: string;
}

export interface ItemMoveToTrashParams {
  itemIds: string[];
}

interface ItemListParams {
  limit?: number;
  offset?: number;
  orderBy?: string | null;
  keyword?: string | null;
  ext?: string | null;
  tags?: string[] | null;
  folders?: string[] | null;
}

export interface ItemThumbnailParams {
  id: string;
}

export interface ItemInfoParams {
  id: string;
}

interface ItemAddBookmarkParams {
  url: string;
  name: string;
  base64?: string | null;
  tags?: string[] | null;
  modificationTime?: number | null;
  folderId?: string | null;
}

interface ItemAddFromUrlParams {
  url: string;
  name: string;
  website?: string | null;
  tags?: string[] | null;
  star?: number | null;
  annotation?: string | null;
  modificationTime?: number | null;
  folderId?: string | null;
  headers?: any | null;
}

interface ItemAddFromPathParams {
  path: string;
  name: string;
  website?: string | null;
  annotation?: string | null;
  tags?: string[] | null;
  folderId?: string | null;
}

interface ItemAddFromURLsParams {
  items: any[];
  folderId?: string | null;
}

class EagleApi {
  private static token: string | null = null;


  /**
   * Gets the API token from Eagle application
   * @returns Promise<string | null> - API token or null if not available
   */
  public static async _internalGetToken(): Promise<string | null> {
    if (EagleApi.token) {
      return EagleApi.token;
    }

    try {
      const res = await fetch("http://localhost:41595/api/application/info");

      if (!res) {
        throw new Error("No response from Eagle");
      }

      const raw: EagleApiResponse<ApplicationInfo> = await res.json();
      const token = raw.data.preferences.developer.apiToken;

      if (token) {
        EagleApi.token = token;
        return token;
      }
    } catch (error) {
      console.error(error);
    }

    return null;
  }

  /**
   * Makes internal HTTP request to Eagle API
   * @param path - API endpoint path
   * @param methodname - HTTP method (GET/POST)
   * @param data - Request body data for POST requests
   * @param params - Query parameters
   * @returns Promise<any> - API response data
   */
  private static async _internalRequest(
    path: string,
    methodname: 'GET' | 'POST',
    data: any = null,
    params: Record<string, any> | null = null
  ): Promise<any> {
    const token = await EagleApi._internalGetToken();

    if (!token) throw new Error("No token found");

    let url = `http://localhost:41595/api/${path}?token=${token}`;

    if (params) {
      params = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== null)
      );

      url +=
        "&" +
        Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join("&");
    }

    if (methodname === "POST" && data) {
      data = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== null)
      );
    }

    try {
      const response = await fetch(
        url,
        methodname === "POST"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          : undefined
      );

      const json: EagleApiResponse = await response.json();
      return json.data;
    } catch (error) {
      console.error("Request failed:", error);
      throw error;
    }
  }

  /**
   * Application-related API methods
   */
  static application = class {
    /**
     * Gets application information
     * @returns Promise<any> - Application info
     */
    static info(): Promise<any> {
      return EagleApi._internalRequest("application/info", "GET");
    }
  };

  /**
   * Folder-related API methods
   */
  static folder = class {
    /**
     * Creates a new folder
     * @param name - Folder name
     * @param parentId - Parent folder ID (optional)
     * @returns Promise<any> - Created folder data
     */
    static create(name: string, parentId: string | null = null): Promise<any> {
      return EagleApi._internalRequest("folder/create", "POST", {
        folderName: name,
        parent: parentId,
      });
    }

    /**
     * Renames a folder
     * @param folderId - Folder ID to rename
     * @param newName - New folder name
     * @returns Promise<any> - Rename result
     */
    static rename(folderId: string, newName: string): Promise<any> {
      return EagleApi._internalRequest("folder/rename", "POST", {
        folderId,
        newName,
      });
    }

    /**
     * Updates folder properties
     * @param params - Update parameters
     * @returns Promise<any> - Update result
     */
    static update(params: FolderUpdateParams): Promise<any> {
      return EagleApi._internalRequest("folder/update", "POST", params);
    }

    /**
     * Lists all folders
     * @returns Promise<any> - Folder list
     */
    static list(): Promise<any> {
      return EagleApi._internalRequest("folder/list", "GET");
    }

    /**
     * Lists recent folders
     * @returns Promise<any> - Recent folder list
     */
    static listRecent(): Promise<any> {
      return EagleApi._internalRequest("folder/listRecent", "GET");
    }
  };

  /**
   * Library-related API methods
   */
  static library = class {
    /**
     * Gets library information
     * @returns Promise<any> - Library info
     */
    static info(): Promise<any> {
      return EagleApi._internalRequest("library/info", "GET");
    }

    /**
     * Gets library history
     * @returns Promise<any> - Library history
     */
    static history(): Promise<any> {
      return EagleApi._internalRequest("library/history", "GET");
    }

    /**
     * Switches to a different library
     * @param libraryPath - Path to the library
     * @returns Promise<any> - Switch result
     */
    static switch(libraryPath: string): Promise<any> {
      return EagleApi._internalRequest("library/switch", "POST", {
        libraryPath,
      });
    }

    /**
     * Gets library icon
     * @param libraryPath - Path to the library
     * @returns Promise<any> - Library icon data
     */
    static icon(libraryPath: string): Promise<any> {
      return EagleApi._internalRequest("library/icon", "GET", null, {
        libraryPath,
      });
    }
  };

  /**
   * Item-related API methods
   */
  static item = class {
    /**
     * Updates item properties
     * @param params - Update parameters
     * @returns Promise<any> - Update result
     */
    static update(params: ItemUpdateParams): Promise<any> {
      return EagleApi._internalRequest("item/update", "POST", {
        id: params.itemId,
        tags: params.tags,
        annotation: params.annotation,
        url: params.url,
        star: params.star,
      });
    }

    /**
     * Refreshes item thumbnail
     * @param itemId - Item ID
     * @returns Promise<any> - Refresh result
     */
    static refreshThumbnail(itemId: string): Promise<any> {
      return EagleApi._internalRequest("item/refreshThumbnail", "POST", {
        id: itemId,
      });
    }

    /**
     * Refreshes item color palette
     * @param itemId - Item ID
     * @returns Promise<any> - Refresh result
     */
    static refreshPalette(itemId: string): Promise<any> {
      return EagleApi._internalRequest("item/refreshPalette", "POST", {
        id: itemId,
      });
    }

    /**
     * Moves items to trash
     * @param itemIds - Array of item IDs
     * @returns Promise<any> - Move result
     */
    static moveToTrash(itemIds: string[]): Promise<any> {
      return EagleApi._internalRequest("item/moveToTrash", "POST", { itemIds });
    }

    /**
     * Lists items with filters
     * @param params - List parameters
     * @returns Promise<any> - Item list
     */
    static list(params: ItemListParams = {}): Promise<any> {
      return EagleApi._internalRequest("item/list", "GET", null, params);
    }

    /**
     * Gets item thumbnail
     * @param itemId - Item ID
     * @returns Promise<any> - Thumbnail data
     */
    static getThumbnail(itemId: string): Promise<any> {
      return EagleApi._internalRequest("item/thumbnail", "GET", null, {
        id: itemId,
      });
    }

    /**
     * Gets item information
     * @param itemId - Item ID
     * @returns Promise<any> - Item info
     */
    static getInfo(itemId: string): Promise<any> {
      return EagleApi._internalRequest("item/info", "GET", null, {
        id: itemId,
      });
    }

    /**
     * Adds bookmark item
     * @param params - Bookmark parameters
     * @returns Promise<any> - Add result
     */
    static addBookmark(params: ItemAddBookmarkParams): Promise<any> {
      return EagleApi._internalRequest("item/addBookmark", "POST", params);
    }

    /**
     * Adds item from URL
     * @param params - URL parameters
     * @returns Promise<any> - Add result
     */
    static addFromUrl(params: ItemAddFromUrlParams): Promise<any> {
      return EagleApi._internalRequest("item/addFromUrl", "POST", params);
    }

    /**
     * Adds item from file path
     * @param params - Path parameters
     * @returns Promise<any> - Add result
     */
    static addFromPath(params: ItemAddFromPathParams): Promise<any> {
      return EagleApi._internalRequest("item/addFromPath", "POST", params);
    }

    /**
     * Adds multiple items from URLs
     * @param params - URLs parameters
     * @returns Promise<any> - Add result
     */
    static addFromURLs(params: ItemAddFromURLsParams): Promise<any> {
      return EagleApi._internalRequest("item/addFromURLs", "POST", params);
    }
  };
}

export type WebEagleApi = typeof EagleApi;
export default EagleApi;
