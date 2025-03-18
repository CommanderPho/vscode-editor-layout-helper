import * as vscode from 'vscode';
import { EditorGroupLayout, GroupOrientation } from './editorGroupsService';

export class EditorLayoutViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'editorLayoutHelperView';
    private _view?: vscode.WebviewView;
    private _refreshInterval?: NodeJS.Timer;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Initial update
        this._updateContent();

        // Set up automatic refresh based on configuration
        this._setupRefreshInterval();

        // Listen for configuration changes
        this._context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('editor-layout-helper.layoutViewRefreshInterval')) {
                    this._setupRefreshInterval();
                }
            })
        );

        // Listen for editor layout changes
        this._context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => this._updateContent()),
            vscode.window.onDidChangeTextEditorViewColumn(() => this._updateContent()),
            vscode.window.onDidChangeVisibleTextEditors(() => this._updateContent())
        );

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'refresh':
                    this._updateContent();
                    break;
                case 'increaseLeftSize':
                    vscode.commands.executeCommand('editor-layout-helper.increaseLeftEditorSize');
                    setTimeout(() => this._updateContent(), 100);
                    break;
                case 'increaseRightSize':
                    vscode.commands.executeCommand('editor-layout-helper.increaseRightEditorSize');
                    setTimeout(() => this._updateContent(), 100);
                    break;
                case 'contractSize':
                    this._resizeGroup(message.path, -0.1);
                    setTimeout(() => this._updateContent(), 100);
                    break;
                case 'expandSize':
                    this._resizeGroup(message.path, 0.1);
                    setTimeout(() => this._updateContent(), 100);
                    break;
            }
        });    }
    private _setupRefreshInterval() {
        // Clear any existing interval
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
        }

        // Get refresh interval from configuration
        const config = vscode.workspace.getConfiguration('editor-layout-helper');
        const refreshInterval = config.get<number>('layoutViewRefreshInterval', 1000);

        // Set up new interval if enabled
        if (refreshInterval > 0) {
            this._refreshInterval = setInterval(() => {
                this._updateContent();
            }, refreshInterval);
        }
    }
    private async _resizeGroup(pathStr: string, sizeDelta: number) {
        // Parse the path string into an array of indices
        const path = pathStr.split(',').map(Number);
        
        // Get the current layout
        const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
        
        // Navigate to the target group
        let currentLevel = layout.groups;
        let targetGroup = null;
        let parentGroups = null;
        let targetIndex = -1;
        
        for (let i = 0; i < path.length; i++) {
            const index = path[i];
            if (i === path.length - 1) {
                // Last level - store the parent groups and target index
                parentGroups = currentLevel;
                targetIndex = index;
                targetGroup = currentLevel[index];
            } else if (currentLevel[index].groups) {
                // Navigate down the hierarchy
                currentLevel = currentLevel[index].groups;
            } else {
                // Path is invalid
                return;
            }
        }
        
        if (!targetGroup || !parentGroups || targetGroup.size === undefined) {
            return;
        }
        
        // Calculate the total size of all sibling groups
        let totalSize = 0;
        for (let group of parentGroups) {
            if (group.size !== undefined) {
                totalSize += group.size;
            }
        }
        
        // Calculate the min/max allowed size
        const minSize = 0.1; // Minimum 10% of available space
        const maxSize = totalSize - (parentGroups.length - 1) * minSize;
        
        // Calculate new size with bounds checking
        let newSize = targetGroup.size + sizeDelta;
        newSize = Math.max(minSize, Math.min(newSize, maxSize));
        
        // Calculate the size difference to distribute among other groups
        const sizeDiff = newSize - targetGroup.size;
        if (Math.abs(sizeDiff) < 0.001) {
            return; // No significant change
        }
        
        // Update the target group size
        targetGroup.size = newSize;
        
        // Distribute the size difference to other groups proportionally
        const otherGroups = parentGroups.filter((_, i) => i !== targetIndex);
        let totalOtherSize = 0;
        
        for (let group of otherGroups) {
            if (group.size !== undefined) {
                totalOtherSize += group.size;
            }
        }
        
        for (let group of otherGroups) {
            if (group.size !== undefined) {
                // Adjust proportionally to current size
                const proportion = group.size / totalOtherSize;
                group.size -= sizeDiff * proportion;
                
                // Ensure minimum size
                group.size = Math.max(minSize, group.size);
            }
        }
        
        // Apply the new layout
        await vscode.commands.executeCommand("vscode.setEditorLayout", layout);
    }
    
    public refreshView() {
        this._updateContent();
    }

    private async _updateContent() {
        if (!this._view) {
            return;
        }

        const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
        
        // Create HTML content for the view
        this._view.webview.html = this._getHtmlForWebview(layout);
    }

    private _getHtmlForWebview(layout: EditorGroupLayout): string {
        const htmlContent = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Editor Layout</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 10px;
                }
                .layout-container {
                    display: flex;
                    flex-direction: ${layout.orientation === GroupOrientation.HORIZONTAL ? 'row' : 'column'};
                    border: 1px solid var(--vscode-panel-border);
                    height: 300px;
                    margin-bottom: 10px;
                }
                .group {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--vscode-panel-border);
                    padding: 5px;
                    overflow: hidden;
                    position: relative;
                }
                .group-header {
                    display: flex;
                    align-items: center;
                    position: relative;
                    z-index: 2;
                }
                .group-label {
                    text-align: center;
                    font-size: 0.8em;
                    padding: 2px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    color: var(--vscode-editor-selectionForeground);
                    flex-grow: 1;
                }
                .group-size {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    font-size: 0.7em;
                    opacity: 0.8;
                }
                .nested-groups {
                    display: flex;
                    flex: 1;
                    flex-direction: ${layout.orientation === GroupOrientation.HORIZONTAL ? 'column' : 'row'};
                }
                button {
                    margin-top: 10px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 5px 10px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .button-group {
                    display: flex;
                    align-items: center;
                }
                .resize-button {
                    margin: 0 2px;
                    padding: 0 4px;
                    font-size: 0.8em;
                    height: 18px;
                    min-width: 18px;
                    z-index: 3;
                    border-radius: 3px;
                }
                .resize-contract {
                    background-color: var(--vscode-editorWarning-foreground);
                }
                .resize-expand {
                    background-color: var(--vscode-editorInfo-foreground);
                }                .resize-left {
                    margin-left: 3px;
                }
                .resize-right {
                    margin-right: 3px;
                }
                .info {
                    margin-top: 10px;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <h3>Current Editor Layout</h3>
            <div class="layout-container">
                ${this._generateLayoutHtml(layout.groups, layout.orientation)}
            </div>
            <div class="info">
                <p>Orientation: ${layout.orientation === GroupOrientation.HORIZONTAL ? 'Horizontal' : 'Vertical'}</p>
                <p>Groups: ${layout.groups.length}</p>
            </div>
            <button id="refreshBtn">Refresh View</button>
            <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'refresh' });
                });
                
                // Add event listeners for resize buttons
                document.querySelectorAll('.resize-button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const isLeft = button.classList.contains('resize-left');
                        const path = button.getAttribute('data-path');
                        vscode.postMessage({ 
                            command: isLeft ? 'increaseLeftSize' : 'increaseRightSize',
                            path: path
                        });
                    });
                });

                // Add to the script section of the HTML
                document.querySelectorAll('.resize-contract').forEach(button => {
                    button.addEventListener('click', () => {
                        const path = button.getAttribute('data-path');
                        vscode.postMessage({ 
                            command: 'contractSize',
                            path: path
                        });
                    });
                });

                document.querySelectorAll('.resize-expand').forEach(button => {
                    button.addEventListener('click', () => {
                        const path = button.getAttribute('data-path');
                        vscode.postMessage({ 
                            command: 'expandSize',
                            path: path
                        });
                    });
                });

            </script>
        </body>
        </html>`;

        return htmlContent;
    }
    private _generateLayoutHtml(groups: any[], orientation: GroupOrientation, path: number[] = []): string {
        return groups.map((group, index) => {
            let content = '';
            let style = '';
            const currentPath = [...path, index];
            
            // Add size style if available
            if (group.size !== undefined) {
                style = orientation === GroupOrientation.HORIZONTAL 
                    ? `flex-basis: ${group.size * 100}%;` 
                    : `flex-basis: ${group.size * 100}%;`;
            }

            // Only show resize buttons for horizontal groups
            const showResizeButtons = orientation === GroupOrientation.HORIZONTAL && groups.length > 1;
            
            // Generate the group's HTML content
            if (group.groups && group.groups.length > 0) {
                // This is a group with nested groups
                const nestedOrientation = orientation === GroupOrientation.HORIZONTAL 
                    ? GroupOrientation.VERTICAL 
                    : GroupOrientation.HORIZONTAL;
                
                content = `
                <div class="group-header">
                    <div class="group-label">Group</div>
                    <div class="button-group">
                        ${showResizeButtons ? `<button class="resize-button resize-contract" title="Contract" data-path="${currentPath.join(',')}">-</button>` : ''}
                        ${showResizeButtons ? `<button class="resize-button resize-expand" title="Expand" data-path="${currentPath.join(',')}">+</button>` : ''}
                        ${showResizeButtons && index > 0 ? `<button class="resize-button resize-left" title="Increase Left" data-path="${currentPath.join(',')}"><</button>` : ''}
                        ${showResizeButtons && index < groups.length - 1 ? `<button class="resize-button resize-right" title="Increase Right" data-path="${currentPath.join(',')}">></button>` : ''}
                    </div>
                </div>
                <div class="nested-groups">
                    ${this._generateLayoutHtml(group.groups, nestedOrientation, currentPath)}
                </div>
                ${group.size !== undefined ? `<div class="group-size">Size: ${group.size.toFixed(2)}</div>` : ''}
            `;
            } else {
                // This is a leaf group
                content = `
                <div class="group-header">
                    <div class="group-label">Editor Group</div>
                    <div class="button-group">
                        ${showResizeButtons ? `<button class="resize-button resize-contract" title="Contract" data-path="${currentPath.join(',')}">-</button>` : ''}
                        ${showResizeButtons ? `<button class="resize-button resize-expand" title="Expand" data-path="${currentPath.join(',')}">+</button>` : ''}
                        ${showResizeButtons && index > 0 ? `<button class="resize-button resize-left" title="Increase Left" data-path="${currentPath.join(',')}"><</button>` : ''}
                        ${showResizeButtons && index < groups.length - 1 ? `<button class="resize-button resize-right" title="Increase Right" data-path="${currentPath.join(',')}">></button>` : ''}
                    </div>
                </div>
                ${group.size !== undefined ? `<div class="group-size">Size: ${group.size.toFixed(2)}</div>` : ''}
            `;
            }

            return `<div class="group" style="${style}" data-path="${currentPath.join(',')}">${content}</div>`;
        }).join('');
    }
}