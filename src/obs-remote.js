(function () {
    'use strict';

    function OBSRemote() {
        Object.defineProperty(this, "apiVersion", {value: 1.1, writable: false});

        this._connected = false;
        this._socket = undefined;
        this._messageCounter = 0;
        this._responseCallbacks = [];

    }

    Object.defineProperty(OBSRemote, "DEFAULT_PORT", {value: 4444, writable: false});
    Object.defineProperty(OBSRemote, "WS_PROTOCOL", {value: "obsapi", writable: false});

    /**
     * Try to connect to OBS, with optional password
     * @param address "ipAddress" or "ipAddress:port"
     *        defaults to "localhost"
     * @param password Optional authentication password
     */
    OBSRemote.prototype.connect = function (address, password) {
        // Password is optional, set to empty string if undefined
        password = (typeof password === "undefined") ?
            "" :
            password;

        // Check for address
        address = (typeof address === "undefined" || address === "") ?
            "localhost" :
            address;

        // Check for port number, if missing use 4444
        var colonIndex = address.indexOf(':');
        if (colonIndex < 0 || colonIndex === address.length - 1) {
            address += ":" + OBSRemote.DEFAULT_PORT;
        }

        // Check if we already have a connection
        if (this._connected) {
            this._socket.close();
            this._connected = false;
        }

        // Connect and setup WebSocket callbacks
        this._socket = new WebSocket("ws://" + address, OBSRemote.WS_PROTOCOL);

        var self = this;

        this._socket.onopen = function (event) {
            self._connected = true;
            self.onConnectionOpened();
        };

        this._socket.onclose = function (code, reason, wasClean) {
            self.onConnectionClosed();
            self._connected = false;
        };

        this._socket.onerror = function (event) {
            self.onConnectionFailed();
            self._connected = false;
        };

        this._socket.onmessage = function (message) {
            self._messageReceived(message);
        };
    };

    OBSRemote.prototype.toggleStream = function (previewOnly) {
        // previewOnly is optional, default to false
        previewOnly = (typeof previewOnly === "undefined") ?
            false :
            previewOnly;

        var msg = {
            "request-type": "StartStopStreaming",
            "preview-only": previewOnly
        };

        this._sendMessage(msg);
    };

    OBSRemote.prototype.onConnectionOpened = function () {};

    OBSRemote.prototype.onConnectionClosed = function () {};

    OBSRemote.prototype.onConnectionFailed = function () {};

    OBSRemote.prototype.onStreamStarted = function (previewOnly) {};

    OBSRemote.prototype.onStreamStopped = function (previewOnly) {};

    OBSRemote.prototype._sendMessage = function (message, callback) {
        if (this._connected) {
            var msgId = this._getNextMsgId();

            // Ensure callback isn't undefined, empty function one is not given/needed
            callback = (typeof callback === "undefined") ?
                function () {} :
                callback;

            // Store the callback with the message ID
            this._responseCallbacks[msgId] = callback;

            message["message-id"] = msgId;

            var serialisedMsg = JSON.stringify(message);
            this._socket.send(serialisedMsg);
        }
    };

    OBSRemote.prototype._getNextMsgId = function () {
        this._messageCounter += 1;
        return this._messageCounter + "";
    };

    OBSRemote.prototype._messageReceived = function (msg) {
        var message = JSON.parse(msg.data);
        if (!message) {
            return;
        }

        // Check if this is an update event
        var updateType = message["update-type"];
        if (updateType) {
            switch (updateType) {
                case "StreamStarting":
                    this._onStreamStarting(message);
                    break;
                case "StreamStopping":
                    this._onStreamStopping(message);
                    break;
                default:
                    console.warn("[OBSRemote] Unknown OBS update type: " + updateType);
            }
        }
    };

    OBSRemote.prototype._onStreamStarting = function (message) {
        var previewOnly = message["preview-only"];
        this.onStreamStarted(previewOnly);
    };

    OBSRemote.prototype._onStreamStopping = function (message) {
        var previewOnly = message["preview-only"];
        this.onStreamStopped(previewOnly);
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = OBSRemote;
    } else {
        window.OBSRemote = OBSRemote;
    }
})();
