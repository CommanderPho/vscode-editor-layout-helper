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

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        // Set the initial HTML content
        // webviewView.webview.html = this._getWebviewContent(webviewView.webview);
        // Await the Promise to get the actual string content
        webviewView.webview.html = await this._getWebviewContent(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'ready':
                    // Webview is ready, send initial content
                    this._updateContent();
                    break;
                // Other cases...
            }
        });

        // Set up automatic refresh based on configuration
        this._setupRefreshInterval();
    }


    private async _getWebviewContent(webview: vscode.Webview): Promise<string> {
        // Get URIs for resources
        const cssPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'layoutView.css');
        const jsPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'layoutView.js');
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'layoutView.html');
        
        // Convert to webview URIs
        const cssUri = webview.asWebviewUri(cssPath);
        const jsUri = webview.asWebviewUri(jsPath);
        
        // Read HTML file using VS Code's workspace fs API (browser-compatible)
        const htmlContentBuffer = await vscode.workspace.fs.readFile(htmlPath);
        // Fix the TextDecoder issue by using a Buffer/string conversion that TypeScript recognizes
        const htmlContent = Buffer.from(htmlContentBuffer).toString('utf8');
        
        // Replace placeholders
        return htmlContent
            .replace('${cssUri}', cssUri.toString())
            .replace('${jsUri}', jsUri.toString());
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

    public async refreshView() {
        await this._updateContent();
    }

    private async _updateContent() {
        if (!this._view) {
            return;
        }

        const layout: EditorGroupLayout = await vscode.commands.executeCommand("vscode.getEditorLayout");
        
        // Generate HTML for the layout
        const layoutHtml = this._generateLayoutHtml(layout.groups, layout.orientation);
        
        // Send the updated layout to the webview
        this._view.webview.postMessage({
            type: 'updateLayout',
            layoutHtml: layoutHtml,
            isHorizontal: layout.orientation === GroupOrientation.HORIZONTAL,
            groupsCount: layout.groups.length
        });
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
                    ${showResizeButtons && index > 0 ? 
                        `<button class="resize-button resize-left" data-path="${currentPath.join(',')}"><</button>` : ''}
                    ${showResizeButtons && index < groups.length - 1 ? 
                        `<button class="resize-button resize-right" data-path="${currentPath.join(',')}">></button>` : ''}
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
                    ${showResizeButtons && index > 0 ? 
                        `<button class="resize-button resize-left" data-path="${currentPath.join(',')}"><</button>` : ''}
                    ${showResizeButtons && index < groups.length - 1 ? 
                        `<button class="resize-button resize-right" data-path="${currentPath.join(',')}">></button>` : ''}
                </div>
                ${group.size !== undefined ? `<div class="group-size">Size: ${group.size.toFixed(2)}</div>` : ''}
            `;
            }

            return `<div class="group" style="${style}" data-path="${currentPath.join(',')}">${content}</div>`;
        }).join('');
    }

