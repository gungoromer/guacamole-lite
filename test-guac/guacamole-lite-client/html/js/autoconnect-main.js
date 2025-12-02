// Autoconnect-specific main.js
// This is a simplified version for autoconnect.html without form dependencies

// DOM elements
const displayScreen = document.getElementById('display-screen');
const closeButton = document.getElementById('close-button');
const displayUuid = document.getElementById('display-uuid');
const displayGuacd = document.getElementById('display-guacd');

let currentClient = null; // Store the current Guacamole client
let currentKeyboard = null; // Store the keyboard handler
let pasteEventListener = null; // Store the paste event listener reference

// Function to initialize Guacamole client
function initializeGuacamoleClient(token, protocol, selectedGuacd, connectionInfo = null) {
    console.log("Initializing Guacamole client for autoconnect...");

    // Show display screen
    if (displayScreen) {
        displayScreen.style.display = 'flex';
    }

    // Update display title with connection info
    const displayTitle = document.getElementById('display-title');
    if (displayTitle && connectionInfo) {
        displayTitle.textContent = `Connected to: ${connectionInfo.hostname || 'Remote Server'} (${protocol.toUpperCase()})`;
    }

    if (displayGuacd) {
        displayGuacd.textContent = `guacd: ${selectedGuacd}`;
    }

    try {
        // Create WebSocket tunnel
        const tunnel = new Guacamole.WebSocketTunnel(`ws://${location.hostname}:9091/`);

        // Set up onuuid event handler to log connection ID
        tunnel.onuuid = function (uuid) {
            console.log("Connection UUID received:", uuid);
            console.log("This UUID can be used to join this session from another client");
            console.log(`Session registered in registry with guacd routing: ${selectedGuacd || 'auto-detected'}`);

            // Show UUID in the header and store for copying
            if (displayUuid) {
                displayUuid.dataset.uuid = uuid;
                displayUuid.textContent = `ID: ${uuid}`;
            }
        };

        // Create client
        const client = new Guacamole.Client(tunnel);
        currentClient = client;

        // Add client display to the page
        const displayDiv = document.getElementById("display");
        displayDiv.appendChild(client.getDisplay().getElement());

        // Set up error handler
        client.onerror = function (error) {
            console.error("Guacamole error:", error);
            let errorMessage = error.message || "Unknown error";

            // Enhanced error messages for common issues
            if (protocol === 'vnc' && errorMessage.includes("connect")) {
                errorMessage = "VNC Connection Error: Could not connect to VNC server. Please verify the host is running a VNC server on port 5900.";
            } else if (protocol === 'rdp' && errorMessage.includes("connect")) {
                errorMessage = "RDP Connection Error: Could not connect to RDP server. Please verify the host is running and accepting RDP connections.";
            }

            alert("Guacamole error: " + errorMessage);
        };

        // Set up clipboard handler
        client.onclipboard = (stream, mimetype) => {
            let data = '';
            const reader = new Guacamole.StringReader(stream);
            reader.ontext = text => data += text;
            reader.onend = () => {
                console.log("Clipboard data received:", data);
                // Update the hidden textarea and trigger copy
                const textarea = document.getElementById('clipboard-textarea');
                if (textarea) {
                    textarea.value = data;
                    textarea.select();
                    try {
                        const successful = document.execCommand('copy');
                        const msg = successful ? 'successful' : 'unsuccessful';
                        console.log('Copying text command was ' + msg);
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                    }
                    // Deselect the text to avoid visual artifacts
                    window.getSelection().removeAllRanges();
                }
            };
        };

        // Set up file download handler
        client.onfile = (stream, mimetype, filename) => {
            stream.sendAck("Ready", Guacamole.Status.Code.SUCCESS);

            const reader = new Guacamole.BlobReader(stream, mimetype);

            reader.onprogress = (length) => {
                console.log(`Downloaded ${length} bytes of ${filename}`);
            };

            reader.onend = () => {
                // Automatically create a link and download the file
                const file = reader.getBlob();
                const url = URL.createObjectURL(file);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    console.log(`File download complete: ${filename}`);
                }, 100);
            };
        };

        // Set up mouse
        const mouse = new Guacamole.Mouse(client.getDisplay().getElement());
        mouse.onEach(['mousedown', 'mouseup', 'mousemove', 'mousewheel'],
            e => client.sendMouseState(e.state));

        // Set up keyboard
        const keyboard = new Guacamole.Keyboard(window);
        keyboard.onkeydown = keysym => client.sendKeyEvent(1, keysym);
        keyboard.onkeyup = keysym => client.sendKeyEvent(0, keysym);
        currentKeyboard = keyboard;

        // Set up paste event listener
        pasteEventListener = (event) => {
            const text = event.clipboardData.getData('text/plain');
            if (text && currentClient) {
                event.preventDefault(); // Prevent default paste behavior in browser
                // Send clipboard data to the remote session
                const stream = currentClient.createClipboardStream('text/plain');
                const writer = new Guacamole.StringWriter(stream);
                writer.sendText(text);
                writer.sendEnd();
                console.log("Sent clipboard data to remote:", text);
            }
        };
        window.addEventListener('paste', pasteEventListener);

        // Connect to the remote desktop
        // Construct connection string, adding audio only if RDP
        let connectString = `token=${encodeURIComponent(token)}`;
        if (protocol === 'rdp') {
            connectString += `&GUAC_AUDIO=audio/L16`;
        }
        client.connect(connectString);

        console.log("Guacamole client initialized and connected");
        console.log(`Dynamic routing: Connection routed to ${selectedGuacd}`);
    } catch (error) {
        // Clean up any partially created resources
        cleanupGuacamole();

        // Show error
        console.error("Error initializing Guacamole:", error);
        alert("Error initializing Guacamole: " + error.message);
    }
}

// Close button click handler
if (closeButton) {
    closeButton.addEventListener('click', () => {
        console.log("Closing connection...");
        cleanupGuacamole();

        // In autoconnect mode, reload the page or close window
        if (confirm('Connection closed. Do you want to close this window?')) {
            window.close();
        } else {
            window.location.reload();
        }
    });
}

// File upload functionality
const uploadButton = document.getElementById('upload-file-button');
const fileInput = document.getElementById('file-upload-input');
const fileTransferStatus = document.getElementById('file-transfer-status');

// Show file picker when upload button is clicked
if (uploadButton) {
    uploadButton.addEventListener('click', () => {
        if (!currentClient) {
            showFileTransferNotification('⚠️ No active connection', 'error');
            return;
        }
        fileInput.click();
    });
}

// Handle file selection
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0 && currentClient) {
            uploadFiles(files);
        }
        // Reset input so same file can be uploaded again
        fileInput.value = '';
    });
}

// Upload files to remote server
function uploadFiles(files) {
    console.log(`Uploading ${files.length} file(s)...`);

    files.forEach((file, index) => {
        setTimeout(() => {
            uploadFile(file);
        }, index * 100); // Stagger uploads slightly
    });
}

function uploadFile(file) {
    console.log(`Starting upload: ${file.name} (${formatBytes(file.size)})`);
    showFileTransferNotification(`📤 Uploading: ${file.name}...`, 'info');

    try {
        // Create a file stream
        const stream = currentClient.createFileStream(file.type || 'application/octet-stream', file.name);

        // Use BlobWriter to send the file
        const writer = new Guacamole.BlobWriter(stream);

        writer.oncomplete = () => {
            console.log(`Upload complete: ${file.name}`);
            showFileTransferNotification(`✅ Uploaded: ${file.name}`, 'success');
        };

        writer.onerror = (error) => {
            console.error(`Upload failed: ${file.name}`, error);
            showFileTransferNotification(`❌ Upload failed: ${file.name}`, 'error');
        };

        // Send the file
        writer.sendBlob(file);
        writer.sendEnd();

    } catch (error) {
        console.error(`Error uploading file: ${file.name}`, error);
        showFileTransferNotification(`❌ Error: ${error.message}`, 'error');
    }
}

// Show file transfer notification
function showFileTransferNotification(message, type = 'info') {
    if (!fileTransferStatus) return;

    fileTransferStatus.textContent = message;
    fileTransferStatus.className = `file-transfer-${type}`;
    fileTransferStatus.style.display = 'block';

    // Auto-hide after 3 seconds for success/error messages
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            fileTransferStatus.style.display = 'none';
        }, 3000);
    }
}

// Format bytes to human-readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Function to properly clean up all Guacamole resources
function cleanupGuacamole() {
    if (currentClient) {
        // Disconnect the client
        try {
            currentClient.disconnect();
        } catch (e) {
            console.error("Error disconnecting client:", e);
        }
        currentClient = null;
    }

    // Clear displayed UUID and guacd info
    if (displayUuid) {
        displayUuid.textContent = '';
        delete displayUuid.dataset.uuid;
    }
    if (displayGuacd) {
        displayGuacd.textContent = '';
    }

    // Properly detach keyboard handler
    if (currentKeyboard) {
        try {
            // Remove existing handlers
            currentKeyboard.onkeydown = null;
            currentKeyboard.onkeyup = null;

            // Reset the keyboard state completely
            currentKeyboard.reset();
        } catch (e) {
            console.error("Error cleaning up keyboard:", e);
        }
        currentKeyboard = null;
    }

    // Remove paste event listener if it exists
    if (pasteEventListener) {
        window.removeEventListener('paste', pasteEventListener);
        pasteEventListener = null;
    }
}

// Add click-to-copy behavior for UUID
if (displayUuid) {
    displayUuid.addEventListener('click', () => {
        const uuid = displayUuid.dataset.uuid;
        if (!uuid) return;

        // Use Clipboard API if available, fallback to old execCommand
        const copyPromise = navigator.clipboard
            ? navigator.clipboard.writeText(uuid)
            : new Promise((resolve, reject) => {
                const textarea = document.createElement('textarea');
                textarea.value = uuid;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    resolve();
                } catch (err) {
                    reject(err);
                } finally {
                    document.body.removeChild(textarea);
                }
            });

        copyPromise
            .then(() => {
                const original = displayUuid.textContent;
                displayUuid.textContent = 'Copied!';
                setTimeout(() => {
                    displayUuid.textContent = original;
                }, 1500);
            })
            .catch(err => console.error('Failed to copy UUID:', err));
    });
}

// Handle page unloads to clean up any active sessions
window.addEventListener('beforeunload', () => {
    cleanupGuacamole();
});
