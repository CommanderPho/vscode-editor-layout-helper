(function() {
    // Acquire VS Code API
    const vscode = acquireVsCodeApi();

    // Setup message passing to extension
    document.getElementById('refreshBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'refresh' });
    });

    // Setup resize button handlers
    function setupResizeButtons() {
        document.querySelectorAll('.resize-button').forEach(button => {
            button.addEventListener('click', () => {
                let command = '';
                if (button.classList.contains('resize-left')) {
                    command = 'increaseLeftSize';
                } else if (button.classList.contains('resize-right')) {
                    command = 'increaseRightSize';
                } else if (button.classList.contains('resize-contract')) {
                    command = 'contractSize';
                } else if (button.classList.contains('resize-expand')) {
                    command = 'expandSize';
                }
                
                if (command) {
                    const path = button.getAttribute('data-path');
                    vscode.postMessage({ 
                        command: command,
                        path: path
                    });
                }
            });
        });
    }

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'updateLayout':
                // Update the layout container with HTML from extension
                document.getElementById('layoutContainer').innerHTML = message.layoutHtml;
                document.getElementById('layoutContainer').style.flexDirection = 
                    message.isHorizontal ? 'row' : 'column';
                
                // Update the orientation and groups count
                document.getElementById('orientationLabel').textContent = 
                    message.isHorizontal ? 'Horizontal' : 'Vertical';
                document.getElementById('groupsCountLabel').textContent = message.groupsCount;
                
                // Setup event handlers for the new buttons
                setupResizeButtons();
                break;
        }
    });
    
    // Initial setup - notify extension we're ready
    vscode.postMessage({ command: 'ready' });
})();