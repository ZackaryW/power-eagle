/**
 * Describe the generic HTTP response envelope returned by Eagle's web API.
 */
interface EagleApiResponse<T = unknown> {
  data: T;
}

/**
 * Describe the application info payload used to resolve the developer token.
 */
interface ApplicationInfo {
  preferences: {
    developer: {
      apiToken: string;
    };
  };
}

/**
 * Describe the folder update payload for the Eagle web API.
 */
interface FolderUpdateParams {
  folderId: string;
  newName?: string | null;
  newDescription?: string | null;
  newColor?: string | null;
}

/**
 * Describe the item update payload for the Eagle web API.
 */
interface ItemUpdateParams {
  itemId: string;
  tags?: string[] | null;
  annotation?: string | null;
  url?: string | null;
  star?: number | null;
}

/**
 * Describe the item list payload for the Eagle web API.
 */
interface ItemListParams {
  limit?: number;
  offset?: number;
  orderBy?: string | null;
  keyword?: string | null;
  ext?: string | null;
  tags?: string[] | null;
  folders?: string[] | null;
}

/**
 * Describe the add-bookmark payload for the Eagle web API.
 */
interface ItemAddBookmarkParams {
  url: string;
  name: string;
  base64?: string | null;
  tags?: string[] | null;
  modificationTime?: number | null;
  folderId?: string | null;
}

/**
 * Describe the add-from-url payload for the Eagle web API.
 */
interface ItemAddFromUrlParams {
  url: string;
  name: string;
  website?: string | null;
  tags?: string[] | null;
  star?: number | null;
  annotation?: string | null;
  modificationTime?: number | null;
  folderId?: string | null;
  headers?: Record<string, unknown> | null;
}

/**
 * Describe the add-from-path payload for the Eagle web API.
 */
interface ItemAddFromPathParams {
  path: string;
  name: string;
  website?: string | null;
  annotation?: string | null;
  tags?: string[] | null;
  folderId?: string | null;
}

/**
 * Describe the add-from-urls payload for the Eagle web API.
 */
interface ItemAddFromUrlsParams {
  items: unknown[];
  folderId?: string | null;
}

/**
 * Implement the previously supported Eagle web API surface used by oldref.
 */
class EagleWebApi {
  private static token: string | null = null;

  /**
   * Resolve and cache the Eagle developer token.
   */
  public static async getToken(): Promise<string | null> {
    if (EagleWebApi.token) {
      return EagleWebApi.token;
    }

    try {
      const response = await fetch('http://localhost:41595/api/application/info');
      const payload: EagleApiResponse<ApplicationInfo> = await response.json();
      const token = payload.data.preferences.developer.apiToken;
      if (token) {
        EagleWebApi.token = token;
        return token;
      }
    } catch (error) {
      console.error('Failed to resolve Eagle API token:', error);
    }

    return null;
  }

  /**
   * Send one authenticated request to the Eagle local web API.
   */
  private static async request(
    apiPath: string,
    method: 'GET' | 'POST',
    data: Record<string, unknown> | null = null,
    params: Record<string, unknown> | null = null,
  ): Promise<unknown> {
    const token = await EagleWebApi.getToken();
    if (!token) {
      throw new Error('No Eagle API token found.');
    }

    let requestUrl = `http://localhost:41595/api/${apiPath}?token=${token}`;
    if (params) {
      const filteredParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null && value !== undefined));
      const paramString = Object.entries(filteredParams).map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&');
      if (paramString) {
        requestUrl += `&${paramString}`;
      }
    }

    const body = method === 'POST' && data
      ? JSON.stringify(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined)))
      : undefined;

    const response = await fetch(requestUrl, body
      ? {
          method,
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      : undefined,
    );
    const payload: EagleApiResponse = await response.json();
    return payload.data;
  }

  /**
   * Expose application web API methods.
   */
  static application = class {
    /**
     * Read Eagle application info through the local web API.
     */
    static info(): Promise<unknown> {
      return EagleWebApi.request('application/info', 'GET');
    }
  };

  /**
   * Expose folder web API methods.
   */
  static folder = class {
    /**
     * Create one folder through the Eagle web API.
     */
    static create(name: string, parentId: string | null = null): Promise<unknown> {
      return EagleWebApi.request('folder/create', 'POST', { folderName: name, parent: parentId });
    }

    /**
     * Rename one folder through the Eagle web API.
     */
    static rename(folderId: string, newName: string): Promise<unknown> {
      return EagleWebApi.request('folder/rename', 'POST', { folderId, newName });
    }

    /**
     * Update one folder through the Eagle web API.
     */
    static update(params: FolderUpdateParams): Promise<unknown> {
      return EagleWebApi.request('folder/update', 'POST', params as unknown as Record<string, unknown>);
    }

    /**
     * List folders through the Eagle web API.
     */
    static list(): Promise<unknown> {
      return EagleWebApi.request('folder/list', 'GET');
    }

    /**
     * List recent folders through the Eagle web API.
     */
    static listRecent(): Promise<unknown> {
      return EagleWebApi.request('folder/listRecent', 'GET');
    }
  };

  /**
   * Expose library web API methods.
   */
  static library = class {
    /**
     * Read library info through the Eagle web API.
     */
    static info(): Promise<unknown> {
      return EagleWebApi.request('library/info', 'GET');
    }

    /**
     * Read library history through the Eagle web API.
     */
    static history(): Promise<unknown> {
      return EagleWebApi.request('library/history', 'GET');
    }

    /**
     * Switch the active library through the Eagle web API.
     */
    static switch(libraryPath: string): Promise<unknown> {
      return EagleWebApi.request('library/switch', 'POST', { libraryPath });
    }

    /**
     * Read library icon data through the Eagle web API.
     */
    static icon(libraryPath: string): Promise<unknown> {
      return EagleWebApi.request('library/icon', 'GET', null, { libraryPath });
    }
  };

  /**
   * Expose item web API methods.
   */
  static item = class {
    /**
     * Update one item through the Eagle web API.
     */
    static update(params: ItemUpdateParams): Promise<unknown> {
      return EagleWebApi.request('item/update', 'POST', {
        id: params.itemId,
        tags: params.tags,
        annotation: params.annotation,
        url: params.url,
        star: params.star,
      });
    }

    /**
     * Refresh one item thumbnail through the Eagle web API.
     */
    static refreshThumbnail(itemId: string): Promise<unknown> {
      return EagleWebApi.request('item/refreshThumbnail', 'POST', { id: itemId });
    }

    /**
     * Refresh one item palette through the Eagle web API.
     */
    static refreshPalette(itemId: string): Promise<unknown> {
      return EagleWebApi.request('item/refreshPalette', 'POST', { id: itemId });
    }

    /**
     * Move items to trash through the Eagle web API.
     */
    static moveToTrash(itemIds: string[]): Promise<unknown> {
      return EagleWebApi.request('item/moveToTrash', 'POST', { itemIds });
    }

    /**
     * List items through the Eagle web API.
     */
    static list(params: ItemListParams = {}): Promise<unknown> {
      return EagleWebApi.request('item/list', 'GET', null, params as unknown as Record<string, unknown>);
    }

    /**
     * Read item thumbnail data through the Eagle web API.
     */
    static getThumbnail(itemId: string): Promise<unknown> {
      return EagleWebApi.request('item/thumbnail', 'GET', null, { id: itemId });
    }

    /**
     * Read item info through the Eagle web API.
     */
    static getInfo(itemId: string): Promise<unknown> {
      return EagleWebApi.request('item/info', 'GET', null, { id: itemId });
    }

    /**
     * Add one bookmark through the Eagle web API.
     */
    static addBookmark(params: ItemAddBookmarkParams): Promise<unknown> {
      return EagleWebApi.request('item/addBookmark', 'POST', params as unknown as Record<string, unknown>);
    }

    /**
     * Add one URL item through the Eagle web API.
     */
    static addFromUrl(params: ItemAddFromUrlParams): Promise<unknown> {
      return EagleWebApi.request('item/addFromUrl', 'POST', params as unknown as Record<string, unknown>);
    }

    /**
     * Add one file-path item through the Eagle web API.
     */
    static addFromPath(params: ItemAddFromPathParams): Promise<unknown> {
      return EagleWebApi.request('item/addFromPath', 'POST', params as unknown as Record<string, unknown>);
    }

    /**
     * Add multiple URL items through the Eagle web API.
     */
    static addFromUrls(params: ItemAddFromUrlsParams): Promise<unknown> {
      return EagleWebApi.request('item/addFromURLs', 'POST', params as unknown as Record<string, unknown>);
    }
  };
}

/**
 * Export the Eagle web API type for SDK consumers.
 */
export type WebEagleApi = typeof EagleWebApi;

export default EagleWebApi;