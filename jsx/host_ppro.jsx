/**
 * BiblioPard - Premiere Pro ExtendScript Host Bridge
 * Supports Premiere Pro 2024, 2025, 2026+
 */

var BiblioPardPPro = (function() {
    'use strict';

    function jsonResponse(success, data, error) {
        var res = {
            success: !!success,
            data: data || null,
            error: error || null
        };
        if (typeof JSON !== 'undefined' && JSON.stringify) {
            return JSON.stringify(res);
        }
        return '{"success":' + (success ? 'true' : 'false') + ',"error":"' + (error ? String(error).replace(/"/g, '\\"') : '') + '"}';
    }

    function parseJson(str) {
        if (typeof JSON !== 'undefined' && JSON.parse) {
            return JSON.parse(str);
        }
        return eval('(' + str + ')');
    }

    return {
        ping: function() {
            return jsonResponse(true, {
                app: "Premiere Pro",
                version: app.version,
                hasProject: !!app.project
            });
        },

        importFiles: function(paramsJson) {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "No project open in Premiere Pro");
                }
                var params = parseJson(paramsJson);
                var filePath = params.filePath;
                var file = new File(filePath);
                if (!file.exists) {
                    return jsonResponse(false, null, "File does not exist: " + filePath);
                }

                var success = app.project.importFiles([filePath], true, app.project.getInsertionBin(), false);
                return jsonResponse(success, { imported: filePath });
            } catch (e) {
                return jsonResponse(false, null, e.toString());
            }
        }
    };
})();
