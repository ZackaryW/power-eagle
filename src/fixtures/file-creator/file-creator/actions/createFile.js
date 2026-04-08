/**
 * Create one file and persist a new extension when it comes from the main input flow.
 */
export default async function createFile(peagle, [entry]) {
  const state = peagle.state.values;
  const fileName = String(state.fileName ?? '').trim();
  const extension = String(entry?.extension ?? state.fileExtension ?? '').trim().replace(/^\.+/u, '').toLowerCase();

  if (!entry?.extension && extension && !state.savedExtensions.includes(extension)) {
    state.savedExtensions = [...state.savedExtensions, extension];
    await peagle.local.invokeFunc('actions/renderExtensions', [], {});
  }

  return peagle.ext.invokeFunc('file.createWithContent', [], {
    fileName,
    extension,
    title: 'Create File',
    buttonLabel: 'Create',
    missingTitle: 'Missing File Details',
    missingBody: 'Enter a file name and extension first.',
    successTitle: 'File Created',
    successBody: `Created ${fileName}.${extension}`,
    content: defaultContentForExtension(fileName, extension),
  });
}

/**
 * Build the default file content for one extension.
 */
function defaultContentForExtension(fileName, extension) {
  if (extension === 'json') {
    return '{}\n';
  }

  if (extension === 'md') {
    return `# ${fileName}\n\n`;
  }

  return 'I NEED TO HAVE SOMETHING OTHERWISE EAGLE FAILS';
}