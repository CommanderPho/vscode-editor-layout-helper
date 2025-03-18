# Editor Layout Helper

This extension helps with resizing editor groups

## Settings

- `editor-layout-helper.enforceEqualHorizontalWidthsOnActiveEditorChange`: When enabled, editor groups will be resized to equal horizontal widths whenever the active editor changes. Default: Enabled.

## Commands

- `editor-layout-helper.distributeEditorsHorizontal` (**Distribute Editors Horizontally**) - This command resizes editor groups to be equal size widths.


## Pho Notes:
> layout = await vscode.commands.executeCommand("vscode.getEditorLayout");
{
  orientation: 0,
  groups: [ { size: 979.5 }, { size: 1351.5 }, { size: 809 } ]
}
979.5 + 1351.5 + 809 = 3140



var updated_layout = {
  orientation: 0,
  groups: [ { size: 979.5 }, { size: 1251.5 }, { size: 909 } ]
}

await vscode.commands.executeCommand("vscode.setEditorLayout", updated_layout);

