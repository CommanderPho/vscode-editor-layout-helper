import * as vscode from "vscode";
import { EditorGroupLayout, GroupOrientation } from "./editorGroupsService";

/**
 * Set equal horizontal widths
 */
async function setEqualHorizontalWidths(): Promise<void>
{
	const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
	if (layout.orientation === GroupOrientation.VERTICAL)
	{
		for (let group of layout.groups)
		{
			const groups = group.groups;
			if (groups !== undefined)
			{
				if (groups.length > 1)
				{
					// Build total width
					let isApplicable = true;
					let width = 0;
					for (let horizontalGroup of groups)
					{
						if (horizontalGroup.size === undefined)
						{
							isApplicable = false;
							break;
						}
						width += horizontalGroup.size;
					}

					if (isApplicable)
					{
						// Build new layout
						const equalWidth = Math.round(width / groups.length);
						let remainder = width - equalWidth * groups.length;
						let hasChanges = false;
						for (let horizontalGroup of groups)
						{
							let size = equalWidth;
							if (remainder > 0)
							{
								size++;
								remainder--;
							}
							if (horizontalGroup.size !== size)
							{
								hasChanges = true;
								horizontalGroup.size = size;
							}
						}

						// Set layout
						if (hasChanges)
							await vscode.commands.executeCommand("vscode.setEditorLayout", layout);
					}
				}
			}
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('editor-layout-helper.distributeEditorsHorizontal', setEqualHorizontalWidths));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async () => {
		const shouldEnforceWidths = vscode.workspace.getConfiguration("editor-layout-helper").get("enforceEqualHorizontalWidthsOnActiveEditorChange");
		if (shouldEnforceWidths)
			await setEqualHorizontalWidths();
	}));
}

export function deactivate() {
}
