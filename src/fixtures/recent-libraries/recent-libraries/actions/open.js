/**
 * Open one recent library through the host Eagle runtime.
 */
export default async function open(peagle, [library]) {
  await peagle.eagle.plugin.invokeFunc('notification.show', [{
    title: 'Opening Library',
    description: `Opening ${library.name}...`,
  }], {});
  await peagle.eagle.web.invokeFunc('library.switch', [library.path], {});
  await peagle.eagle.plugin.invokeFunc('notification.show', [{
    title: 'Library Opened',
    description: `Switched to ${library.name}`,
  }], {});
}