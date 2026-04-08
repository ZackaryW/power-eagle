declare global {
  const eagle: {
    tag: {
      //returns all tags
      get(): Promise<Tag[]>;
      // returns recently used tags
      getRecents(): Promise<Tag[]>;
    };
    tagGroup: {
      get(): Promise<TagGroup[]>;
      create(options: {
        name: string;
        color:
          | 'red'
          | 'orange'
          | 'yellow'
          | 'green'
          | 'aqua'
          | 'blue'
          | 'purple'
          | 'pink';
        tags: string[];
      }): Promise<TagGroup>;
    };
    library: {
      info(): Promise<LibraryInfo>;
      readonly name: string;
      readonly path: string;
      readonly modificationTime: number;
    };
    window: {
      show(): Promise<void>;
      showInactive(): Promise<void>;
      hide(): Promise<void>;
      focus(): Promise<void>;
      minimize(): Promise<void>;
      isMinimized(): Promise<boolean>;
      restore(): Promise<void>;
      maximize(): Promise<void>;
      unmaximize(): Promise<void>;
      isMaximized(): Promise<boolean>;
      setFullScreen(flag: boolean): Promise<void>;
      isFullScreen(): Promise<boolean>;
      setAspectRatio(aspectRatio: number): Promise<void>;
      setBackgroundColor(backgroundColor: string): Promise<void>;
      setSize(width: number, height: number): Promise<void>;
      getSize(): Promise<[number, number]>;
      setBounds(bounds: Rectangle): Promise<void>;
      getBounds(): Promise<Rectangle>;
      setResizable(resizable: boolean): Promise<void>;
      isResizable(): Promise<boolean>;
      setAlwaysOnTop(flag: boolean): Promise<void>;
      isAlwaysOnTop(): Promise<boolean>;
      setPosition(x: number, y: number): Promise<void>;
      getPosition(): Promise<[number, number]>;
      setOpacity(opacity: number): Promise<void>;
      getOpacity(): Promise<number>;
      flashFrame(flag: boolean): Promise<void>;
      setIgnoreMouseEvents(ignore: boolean): Promise<void>;
      capturePage(rect?: Rectangle): Promise<NativeImage>;
      setReferer(url: string): void;
    };
    app: {
      isDarkColors(): boolean;
      getPath(name: AppPath): Promise<string>;
      getFileIcon(
        path: string,
        options?: { size: 'small' | 'normal' | 'large' }
      ): Promise<NativeImage>;
      createThumbnailFromPath(
        path: string,
        maxSize: Size
      ): Promise<NativeImage>;
      readonly version: string;
      readonly build: number;
      readonly locale:
        | 'en'
        | 'zh_CN'
        | 'zh_TW'
        | 'ja_JP'
        | 'ko_KR'
        | 'es_ES'
        | 'de_DE'
        | 'ru_RU';
      readonly arch: 'x64' | 'arm64' | 'x86';
      readonly platform: 'darwin' | 'win32';
      readonly env: { [key: string]: string };
      readonly execPath: string;
      readonly pid: number;
      readonly isWindows: boolean;
      readonly isMac: boolean;
      readonly runningUnderARM64Translation: boolean;
      readonly theme:
        | 'LIGHT'
        | 'LIGHTGRAY'
        | 'GRAY'
        | 'DARK'
        | 'BLUE'
        | 'PURPLE';
    };
    os: {
      tmpdir(): string;
      version(): string;
      type(): 'Windows_NT' | 'Darwin';
      release(): string;
      hostname(): string;
      homedir(): string;
      arch(): 'x64' | 'arm64' | 'x86';
    };
    screen: {
      getCursorScreenPoint(): Promise<Point>;
      getPrimaryDisplay(): Promise<Display>;
      getAllDisplays(): Promise<Display[]>;
      getDisplayNearestPoint(point: Point): Promise<Display>;
    };
    notification: {
      show(options: {
        title: string;
        description: string;
        icon?: string;
        mute?: boolean;
        duration?: number;
      }): Promise<void>;
    };
    event: {
      onPluginCreate(callback: (plugin: any) => void): void;
      onPluginRun(callback: (plugin: any) => void): void;
      onPluginBeforeExit(callback: () => void): void;
      onPluginShow(callback: () => void): void;
      onPluginHide(callback: () => void): void;
      onLibraryChanged(callback: (path: string) => void): void;
      onThemeChanged(
        callback: (
          theme:
            | 'Auto'
            | 'LIGHT'
            | 'LIGHTGRAY'
            | 'GRAY'
            | 'DARK'
            | 'BLUE'
            | 'PURPLE'
        ) => void
      ): void;
    };
    item: {
      get(options: {
        id?: string;
        ids?: string[];
        isSelected?: boolean;
        isUntagged?: boolean;
        isUnfiled?: boolean;
        keywords?: string[];
        tags?: string[];
        folders?: string[];
        ext?: string;
        annotation?: string;
        rating?: number;
        url?: string;
        shape?:
          | 'square'
          | 'portrait'
          | 'panoramic-portrait'
          | 'landscape'
          | 'panoramic-landscape';
      }): Promise<Item[]>;
      getAll(): Promise<Item[]>;
      getById(itemId: string): Promise<Item>;
      getByIds(itemIds: string[]): Promise<Item[]>;
      getSelected(): Promise<Item[]>;
      addFromURL(
        url: string,
        options?: {
          name?: string;
          website?: string;
          tags?: string[];
          folders?: string[];
          annotation?: string;
        }
      ): Promise<string>;
      addFromBase64(
        base64: string,
        options?: {
          name?: string;
          website?: string;
          tags?: string[];
          folders?: string[];
          annotation?: string;
        }
      ): Promise<string>;
      addFromPath(
        path: string,
        options?: {
          name?: string;
          website?: string;
          tags?: string[];
          folders?: string[];
          annotation?: string;
        }
      ): Promise<string>;
      addBookmark(
        url: string,
        options?: {
          name?: string;
          base64?: string;
          tags?: string[];
          folders?: string[];
          annotation?: string;
        }
      ): Promise<string>;
      open(itemId: string): Promise<boolean>;
    };
    folder: {
      create(options: {
        name: string;
        description?: string;
        parent?: string;
      }): Promise<Folder>;
      createSubfolder(
        parentId: string,
        options: {
          name: string;
          description?: string;
        }
      ): Promise<Folder>;
      get(options: {
        id?: string;
        ids?: string[];
        isSelected?: boolean;
        isRecent?: boolean;
      }): Promise<Folder[]>;
      getAll(): Promise<Folder[]>;
      getById(folderId: string): Promise<Folder>;
      getByIds(folderIds: string[]): Promise<Folder[]>;
      getSelected(): Promise<Folder[]>;
      getRecents(): Promise<Folder[]>;
      open(folderId: string): Promise<void>;
    };
    contextMenu: {
      open(
        menuItems: {
          id: string;
          label: string;
          submenu?: {
            id: string;
            label: string;
            click?: () => void;
            submenu?: any[];
          }[];
          click?: () => void;
        }[]
      ): Promise<void>;
    };
    dialog: {
      showOpenDialog(options: {
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
        filters?: {
          name: string;
          extensions: string[];
        }[];
        properties?: (
          | 'openFile'
          | 'openDirectory'
          | 'multiSelections'
          | 'showHiddenFiles'
          | 'createDirectory'
          | 'promptToCreate'
        )[];
        message?: string;
      }): Promise<{
        canceled: boolean;
        filePaths: string[];
      }>;
      showSaveDialog(options: {
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
        filters?: {
          name: string;
          extensions: string[];
        }[];
        properties?: (
          | 'openDirectory'
          | 'showHiddenFiles'
          | 'createDirectory'
        )[];
      }): Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
      showMessageBox(options: {
        message: string;
        title?: string;
        detail?: string;
        buttons?: string[];
        type?: 'none' | 'info' | 'error' | 'question' | 'warning';
      }): Promise<{
        response: number;
      }>;
      showErrorBox(title: string, content: string): Promise<void>;
    };
    clipboard: {
      clear(): void;
      has(format: string): boolean;
      writeText(text: string): void;
      readText(): Promise<string>;
      writeBuffer(format: string, buffer: Buffer): void;
      readBuffer(format: string): Buffer;
      writeImage(image: NativeImage): void;
      readImage(): NativeImage;
      writeHTML(markup: string): void;
      readHTML(): string;
      copyFiles(paths: string[]): void;
    };
    drag: {
      startDrag(filePaths: string[]): Promise<void>;
    };
    shell: {
      beep(): Promise<void>;
      openExternal(url: string): Promise<void>;
      openPath(path: string): Promise<void>;
      showItemInFolder(path: string): Promise<void>;
    };
    log: {
      info(message: string): void;
      warn(message: string): void;
      error(message: string): void;
      debug(message: string): void;
    };
  };

  interface Item {
    // Instance methods
    save(): Promise<boolean>;
    moveToTrash(): Promise<boolean>;
    replaceFile(filePath: string): Promise<boolean>;
    refreshThumbnail(): Promise<boolean>;
    setCustomThumbnail(thumbnailPath: string): Promise<boolean>;
    open(): Promise<void>;

    // Instance properties
    readonly id: string;
    name: string;
    readonly ext: string;
    width: number;
    height: number;
    url: string;
    readonly isDeleted: boolean;
    annotation: string;
    tags: string[];
    folders: string[];
    readonly palettes: any[];
    readonly size: number;
    star: number;
    readonly importedAt: number;
    readonly noThumbnail: boolean;
    readonly noPreview: boolean;
    readonly filePath: string;
    readonly fileURL: string;
    readonly thumbnailPath: string;
    readonly thumbnailURL: string;
    readonly metadataFilePath: string;
  }

  interface Folder {
    // Instance methods
    save(): Promise<void>;
    open(): Promise<void>;

    // Instance properties
    readonly id: string;
    name: string;
    description: string;
    readonly icon: string;
    readonly iconColor: string;
    readonly createdAt: number;
    readonly children: Folder[];
  }

  interface TagGroup {
    // Instance methods
    save(): Promise<TagGroup>;
    remove(): Promise<boolean>;

    // Instance properties
    name: string;
    color:
      | 'red'
      | 'orange'
      | 'yellow'
      | 'green'
      | 'aqua'
      | 'blue'
      | 'purple'
      | 'pink';
    tags: string[];
  }
}

interface Tag {
  id: string;
  name: string;
  color?: string;
  count?: number;
}

interface LibraryInfo {
  // This interface represents the detailed information about the library
  // The exact structure will depend on what the API returns
  [key: string]: any;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Display {
  // This interface represents display information
  // The exact structure will depend on what the API returns
  [key: string]: any;
}

interface NativeImage {
  toDataURL(type: string): string;
  toPNG(): Buffer;
  getSize(): Size;
}

type AppPath =
  | 'home'
  | 'appData'
  | 'userData'
  | 'temp'
  | 'exe'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'
  | 'recent';

// This export is needed to make the file a module
export {};
