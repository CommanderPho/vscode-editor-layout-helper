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
            if (message.command === 'refresh') {
                this._updateContent();
            }
        });
    }

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
                .group-label {
                    text-align: center;
                    font-size: 0.8em;
                    padding: 2px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    color: var(--vscode-editor-selectionForeground);
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
            </script>
        </body>
        </html>`;

        return htmlContent;
    }

    private _generateLayoutHtml(groups: any[], orientation: GroupOrientation): string {
        return groups.map(group => {
            let content = '';
            let style = '';
            
            // Add size style if available
            if (group.size !== undefined) {
                style = orientation === GroupOrientation.HORIZONTAL 
                    ? `flex-basis: ${group.size * 100}%;` 
                    : `flex-basis: ${group.size * 100}%;`;
            }

            // Generate the group's HTML content
            if (group.groups && group.groups.length > 0) {
                // This is a group with nested groups
                const nestedOrientation = orientation === GroupOrientation.HORIZONTAL 
                    ? GroupOrientation.VERTICAL 
                    : GroupOrientation.HORIZONTAL;
                
                content = `
                    <div class="group-label">Group</div>
                    <div class="nested-groups">
                        ${this._generateLayoutHtml(group.groups, nestedOrientation)}
                    </div>
                    ${group.size !== undefined ? `<div class="group-size">Size: ${group.size.toFixed(2)}</div>` : ''}
                `;
            } else {
                // This is a leaf group
                content = `
                    <div class="group-label">Editor Group</div>
                    ${group.size !== undefined ? `<div class="group-size">Size: ${group.size.toFixed(2)}</div>` : ''}
                `;
            }

            return `<div class="group" style="${style}">${content}</div>`;
        }).join('');
    }
}
