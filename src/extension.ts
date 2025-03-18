import * as vscode from "vscode";
import { EditorGroupLayout, GroupOrientation } from "./editorGroupsService";


// At the top of your file, add:
let distributeButton: vscode.StatusBarItem;
let increaseLeftButton: vscode.StatusBarItem;
let increaseRightButton: vscode.StatusBarItem;


/**
 * Print debug information about editor layouts to the console
 */
async function debugPrintEditorLayouts() {
  const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
  console.log("=== EDITOR LAYOUT DEBUG INFO ===");
  console.log("Layout orientation:", layout.orientation);
  console.log("Groups found:", layout.groups.length);
  
  // Helper function to recursively print group details
  function printGroupDetails(group: any, level: number = 0) {
    const indent = "  ".repeat(level);
    console.log(`${indent}Group:`);
    
    // Print all properties of the group
    for (const [key, value] of Object.entries(group)) {
      if (key === 'groups') {
        console.log(`${indent}  ${key}: [Array with ${(value as any[]).length} items]`);
      } else {
        console.log(`${indent}  ${key}: ${JSON.stringify(value)}`);
      }
    }
    
    // Recursively print nested groups
    if (group.groups && Array.isArray(group.groups)) {
      console.log(`${indent}  Child groups:`);
      group.groups.forEach((childGroup: any, index: number) => {
        console.log(`${indent}  Group ${index + 1}:`);
        printGroupDetails(childGroup, level + 2);
      });
    }
    
    // Print active editor information if available
    if (group.editorGroup) {
      console.log(`${indent}  Active editor: ${group.editorGroup.activeEditor?.name || 'None'}`);
      console.log(`${indent}  Viewcolumn: ${group.editorGroup.viewColumn}`);
      console.log(`${indent}  Editors count: ${group.editorGroup.editors.length}`);
    }
  }
  
  // Print details for each top-level group
  layout.groups.forEach((group, index) => {
    console.log(`\nTOP LEVEL GROUP ${index + 1}:`);
    printGroupDetails(group);
  });
  
  // Print current active editor
  const activeEditor = vscode.window.activeTextEditor;
  console.log("\nCURRENT ACTIVE EDITOR:");
  if (activeEditor) {
    console.log(`  File: ${activeEditor.document.fileName}`);
    console.log(`  ViewColumn: ${activeEditor.viewColumn}`);
    console.log(`  Selection: ${activeEditor.selection}`);
  } else {
    console.log("  No active editor");
  }
  
  console.log("=== END DEBUG INFO ===");
}


/**
 * Set equal horizontal widths
 */
async function setEqualHorizontalWidths(): Promise<void>
{
	const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
	console.log(`setEqualHorizontalWidths() - layout: ${layout}...`);
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

/**
 * Increase left editor pane size
 */
async function increaseLeftEditorSize(): Promise<void> {
	const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
	console.log(`increaseLeftEditorSize() - layout: ${layout}...`);

	if (layout.orientation === GroupOrientation.HORIZONTAL) {
		console.log(`    running with top-level groups (layout.groups): ${layout.groups}...`);
		for (let group of layout.groups) {
			const groups = group.groups;
			console.log(`  Running for group: ${group} with groups: ${groups}...`);
			
			if (groups !== undefined && groups.length > 1) {
				// Only apply to horizontal split with at least 2 panes
				let isApplicable = true;
				let totalSize = 0;
				
				// Calculate total size and verify all groups have sizes
				for (let horizontalGroup of groups) {
					if (horizontalGroup.size === undefined) {
						isApplicable = false;
						console.log(`      found horizontalGroup with undefined size: ${horizontalGroup}! Breaking.`);
						break;
					}
					totalSize += horizontalGroup.size;
				}
				console.log(`    totalSize: ${totalSize}.`);
				if (isApplicable) {
					// Calculate adjustment amount (10% of total width)
					const adjustAmount = Math.max(1, Math.floor(totalSize * 0.1));
					
					// Don't let any pane get smaller than 10% of total space
					const minSize = Math.max(1, Math.floor(totalSize * 0.1));
					
					// Apply adjustment - increase leftmost pane size
					if ((groups[0].size !== undefined) && (groups[1].size !== undefined) && (groups[1].size > minSize)) {
						const adjustedAmount = Math.min(adjustAmount, groups[1].size - minSize);
						groups[0].size += adjustedAmount;
						groups[1].size -= adjustedAmount;

						console.log(`      applying adjustment: ${adjustedAmount}.`);
						// Apply the new layout
						await vscode.commands.executeCommand("vscode.setEditorLayout", layout);
						console.log(`    done.`);
					}
				}
				break; // Only adjust the first horizontal split found
			}
			else {
				console.error(`      groups is undefined or has fewer than 2 items. Skipping.`);
			}
		}
	}
	else {
		console.error(`    layout.orientation is not HORIZONTAL: layout.orientation: ${layout.orientation}!`);
	}
}

/**
 * Increase right editor pane size
 */
async function increaseRightEditorSize(): Promise<void> {
	const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
	console.log(`increaseRightEditorSize() - layout: ${layout}...`);
	if (layout.orientation === GroupOrientation.VERTICAL) {
		for (let group of layout.groups) {
			const groups = group.groups;
			if (groups !== undefined && groups.length > 1) {
				// Only apply to horizontal split with at least 2 panes
				let isApplicable = true;
				let totalSize = 0;
				
				// Calculate total size and verify all groups have sizes
				for (let horizontalGroup of groups) {
					if (horizontalGroup.size === undefined) {
						isApplicable = false;
						break;
					}
					totalSize += horizontalGroup.size;
				}

				if (isApplicable) {
					// Calculate adjustment amount (10% of total width)
					const adjustAmount = Math.max(1, Math.floor(totalSize * 0.1));
					
					// Don't let any pane get smaller than 10% of total space
					const minSize = Math.max(1, Math.floor(totalSize * 0.1));
					
					// Apply adjustment - increase rightmost pane size
					if (groups[0].size !== undefined && 
						groups[1].size !== undefined && 
						groups[0].size > minSize) {
						
						const adjustedAmount = Math.min(adjustAmount, groups[0].size - minSize);
						groups[0].size -= adjustedAmount;
						groups[1].size += adjustedAmount;
						
						// Apply the new layout
						await vscode.commands.executeCommand("vscode.setEditorLayout", layout);
					}
				}
				break; // Only adjust the first horizontal split found
			}
		}
	}
}


export function activate(context: vscode.ExtensionContext) {
	// Register commands
	context.subscriptions.push(vscode.commands.registerCommand('editor-layout-helper.debugPrintEditorLayouts', debugPrintEditorLayouts));
	context.subscriptions.push(vscode.commands.registerCommand('editor-layout-helper.distributeEditorsHorizontal', setEqualHorizontalWidths));
	context.subscriptions.push(vscode.commands.registerCommand('editor-layout-helper.increaseLeftEditorSize', increaseLeftEditorSize));
	context.subscriptions.push(vscode.commands.registerCommand('editor-layout-helper.increaseRightEditorSize', increaseRightEditorSize));
	
	// Create status bar items
	distributeButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	distributeButton.text = "$(split-horizontal) ↔️";
	distributeButton.tooltip = "Distribute Editors Horizontally";
	distributeButton.command = 'editor-layout-helper.distributeEditorsHorizontal';
	
	increaseLeftButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	increaseLeftButton.text = "$(arrow-left) ◀️➕";
	increaseLeftButton.tooltip = "Increase Left Editor Pane Size";
	increaseLeftButton.command = 'editor-layout-helper.increaseLeftEditorSize';
	
	increaseRightButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
	increaseRightButton.text = "$(arrow-right) ▶️➕";
	increaseRightButton.tooltip = "Increase Right Editor Pane Size";
	increaseRightButton.command = 'editor-layout-helper.increaseRightEditorSize';
	
	// Show all buttons initially
	distributeButton.show();
	increaseLeftButton.show();
	increaseRightButton.show();
	
	// Register the status bar items so they get properly disposed
	context.subscriptions.push(distributeButton);
	context.subscriptions.push(increaseLeftButton);
	context.subscriptions.push(increaseRightButton);
	
	// Ensure visibility whenever the active editor changes
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
		distributeButton.show();
		increaseLeftButton.show();
		increaseRightButton.show();
		
		// Your existing code for enforcing widths
		const shouldEnforceWidths = vscode.workspace.getConfiguration("editor-layout-helper").get("enforceEqualHorizontalWidthsOnActiveEditorChange");
		if (shouldEnforceWidths)
			setEqualHorizontalWidths();
	}));	
}


export function deactivate() {
}