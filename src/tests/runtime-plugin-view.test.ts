import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostEagle } from '../app/runtime-plugin-view';

/**
 * Restore global stubs after each runtime plugin view test.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('runtime plugin view host eagle adapter', () => {
  it('uses the Eagle native save dialog when available', async () => {
    const showSaveDialog = vi.fn().mockResolvedValue({ canceled: false, filePath: 'C:/Temp/example.md' });
    vi.stubGlobal('eagle', {
      dialog: {
        showSaveDialog,
      },
    });

    const hostEagle = createHostEagle(vi.fn(), vi.fn());
    const result = await (hostEagle.dialog as { showSaveDialog(options: { defaultPath?: string }): Promise<{ canceled: boolean; filePath?: string }> }).showSaveDialog({
      defaultPath: 'example.md',
    });

    expect(showSaveDialog).toHaveBeenCalledWith({ defaultPath: 'example.md' });
    expect(result).toEqual({ canceled: false, filePath: 'C:/Temp/example.md' });
  });
});