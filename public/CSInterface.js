/**
 * CSInterface - v11.0.0
 * Adobe Common Extensibility Platform Interface
 */
function CSInterface() {
    //
}

CSInterface.prototype.getHostEnvironment = function() {
    var csi = window.__adobe_cep__;
    if (csi) {
        var str = csi.getHostEnvironment();
        return JSON.parse(str);
    }
    return {
        appName: "AEFT",
        appVersion: "26.2",
        appLocale: "en_US",
        appUILocale: "en_US",
        appId: "AEFT",
        isAppOnline: true,
        appSkinInfo: {
            baseFontFamily: "Segoe UI",
            baseFontSize: 12,
            appBarBackgroundColor: { color: { red: 24, green: 24, blue: 24, alpha: 255 } },
            panelBackgroundColor: { color: { red: 24, green: 24, blue: 24, alpha: 255 } }
        }
    };
};

CSInterface.prototype.closeExtension = function() {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

CSInterface.prototype.getSystemPath = function(pathType) {
    if (window.__adobe_cep__) {
        var path = window.__adobe_cep__.getSystemPath(pathType);
        return decodeURI(path);
    }
    return "";
};

CSInterface.prototype.evalScript = function(script, callback) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback || function() {});
    } else {
        console.warn("[CSInterface DEV Fallback] evalScript called with:", script);
        if (callback) {
            callback(JSON.stringify({ success: true, message: "DEV Fallback (outside AE)" }));
        }
    }
};

CSInterface.prototype.addEventListener = function(type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    }
};

CSInterface.prototype.removeEventListener = function(type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    }
};

CSInterface.prototype.requestOpenExtension = function(extensionId, params) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.requestOpenExtension(extensionId, params);
    }
};

// SystemPath constants
SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

window.CSInterface = CSInterface;
window.SystemPath = SystemPath;
