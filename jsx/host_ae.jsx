/**
 * BiblioPard - After Effects ExtendScript Host Bridge
 * Supports After Effects 2024, 2025, 2026.2+
 */

var BiblioPardAE = (function() {
    'use strict';

    function jsonResponse(success, data, error) {
        var res = {
            success: !!success,
            data: data || null,
            error: error || null
        };
        // ExtendScript JSON serialization fallback
        if (typeof JSON !== 'undefined' && JSON.stringify) {
            return JSON.stringify(res);
        }
        return '{"success":' + (success ? 'true' : 'false') + ',"error":"' + (error ? String(error).replace(/"/g, '\\"') : '') + '"}';
    }

    function parseJson(str) {
        if (typeof str === 'object' && str !== null) return str;
        var res = str;
        try {
            res = (typeof JSON !== 'undefined' && JSON.parse) ? JSON.parse(str) : eval('(' + str + ')');
        } catch (e1) {
            try { res = eval('(' + str + ')'); } catch (e2) {}
        }
        if (typeof res === 'string') {
            try {
                res = (typeof JSON !== 'undefined' && JSON.parse) ? JSON.parse(res) : eval('(' + res + ')');
            } catch (e3) {}
        }
        return res;
    }

    return {
        /**
         * Test communication with host
         */
        ping: function() {
            return jsonResponse(true, {
                app: app.appName,
                version: app.version,
                hasProject: !!app.project
            });
        },

        /**
         * Get current active composition info
         */
        getActiveCompInfo: function() {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "No project open");
                }
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    return jsonResponse(true, { hasActiveComp: false });
                }
                return jsonResponse(true, {
                    hasActiveComp: true,
                    id: comp.id,
                    name: comp.name,
                    width: comp.width,
                    height: comp.height,
                    frameRate: comp.frameRate,
                    duration: comp.duration,
                    renderer: comp.renderer || "Default"
                });
            } catch (e) {
                return jsonResponse(false, null, e.toString());
            }
        },

        /**
         * Import 3D model (GLB, GLTF, OBJ) and add to active comp
         * @param {string} paramsJson - { filePath: string, targetCompId?: number, autoCenter?: boolean }
         */
        import3DModel: function(paramsJson) {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "Please open or create a project first");
                }

                var params = parseJson(paramsJson);
                var filePath = params.filePath;
                var file = new File(filePath);

                if (!file.exists) {
                    return jsonResponse(false, null, "File does not exist: " + filePath);
                }

                app.beginUndoGroup("BiblioPard: Import 3D Model");

                // Import into project
                var importOptions = new ImportOptions(file);
                var importedItem = app.project.importFile(importOptions);

                if (!importedItem) {
                    app.endUndoGroup();
                    return jsonResponse(false, null, "Failed to import file into project");
                }

                var comp = app.project.activeItem;
                var layer = null;

                // If an active composition exists, add the 3D model to it
                if (comp && comp instanceof CompItem) {
                    // In AE 2024-2026, check/set Advanced 3D renderer if available
                    try {
                        var renderers = comp.renderers;
                        if (renderers) {
                            for (var r = 0; r < renderers.length; r++) {
                                if (renderers[r].indexOf("Advanced 3D") !== -1 || renderers[r].indexOf("ADBE Advanced 3D") !== -1) {
                                    comp.renderer = renderers[r];
                                    break;
                                }
                            }
                        }
                    } catch (err) {
                        // Renderer setting might be read-only in some versions, ignore
                    }

                    // Add layer to comp
                    layer = comp.layers.add(importedItem);

                    if (layer) {
                        // Center 3D model layer in viewport
                        try {
                            if (layer.threeDLayer !== undefined) {
                                layer.threeDLayer = true;
                            }
                            if (layer.property("Position")) {
                                layer.property("Position").setValue([comp.width / 2, comp.height / 2, 0]);
                            }
                        } catch (posErr) {
                            // Non-critical
                        }
                    }
                }

                app.endUndoGroup();

                return jsonResponse(true, {
                    importedName: importedItem.name,
                    addedToComp: !!layer,
                    compName: (comp && comp instanceof CompItem) ? comp.name : null,
                    layerIndex: layer ? layer.index : null
                });
            } catch (e) {
                try { app.endUndoGroup(); } catch (ignored) {}
                return jsonResponse(false, null, "Import error: " + e.toString());
            }
        },

        /**
         * Import Environment Map (HDR / EXR) and create/configure Environment Light
         * @param {string} paramsJson - { filePath: string, intensity?: number }
         */
        importEnvironmentLight: function(paramsJson) {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "Please open or create a project first");
                }

                var params = parseJson(paramsJson);
                var filePath = params.filePath;
                var file = new File(filePath);

                if (!file.exists) {
                    return jsonResponse(false, null, "File does not exist: " + filePath);
                }

                app.beginUndoGroup("BiblioPard: Add Environment Light");

                // Import HDR/EXR image
                var importOptions = new ImportOptions(file);
                var importedItem = app.project.importFile(importOptions);

                if (!importedItem) {
                    app.endUndoGroup();
                    return jsonResponse(false, null, "Failed to import HDR/EXR into project");
                }

                var comp = app.project.activeItem;
                var lightLayer = null;

                if (comp && comp instanceof CompItem) {
                    // Try to enable Advanced 3D renderer for Environment Lights
                    try {
                        var renderers = comp.renderers;
                        if (renderers) {
                            for (var r = 0; r < renderers.length; r++) {
                                if (renderers[r].indexOf("Advanced 3D") !== -1 || renderers[r].indexOf("ADBE Advanced 3D") !== -1) {
                                    comp.renderer = renderers[r];
                                    break;
                                }
                            }
                        }
                    } catch (err) {}

                    // In AE 2024-2026: LightType.ENVIRONMENT is 4415 or LightType.ENVIRONMENT
                    // If LightType.ENVIRONMENT is not directly exposed as constant:
                    var envLightType = (typeof LightType !== 'undefined' && LightType.ENVIRONMENT) ? LightType.ENVIRONMENT : 4415;
                    
                    try {
                        lightLayer = comp.layers.addLight("Env: " + importedItem.name, [comp.width / 2, comp.height / 2]);
                        lightLayer.lightType = envLightType;
                    } catch (lightErr) {
                        // Fallback: regular ambient/point light if environment not supported
                        if (!lightLayer) {
                            lightLayer = comp.layers.addLight("Env Light: " + importedItem.name, [comp.width / 2, comp.height / 2]);
                        }
                    }

                    // Also add the HDR map layer to comp as guide layer or background if desired
                    // Or assign to Environment Light map property if accessible
                    try {
                        var lightOptions = lightLayer.property("ADBE Light Options Group");
                        if (lightOptions) {
                            for (var p = 1; p <= lightOptions.numProperties; p++) {
                                var prop = lightOptions.property(p);
                                if (prop.name.indexOf("Map") !== -1 || prop.name.indexOf("Environment") !== -1) {
                                    // Assign if possible
                                    prop.setValue(importedItem.id);
                                    break;
                                }
                            }
                        }
                    } catch (mapErr) {}
                }

                app.endUndoGroup();

                return jsonResponse(true, {
                    importedName: importedItem.name,
                    addedLight: !!lightLayer,
                    compName: (comp && comp instanceof CompItem) ? comp.name : null
                });
            } catch (e) {
                try { app.endUndoGroup(); } catch (ignored) {}
                return jsonResponse(false, null, "Environment Light error: " + e.toString());
            }
        },

        /**
         * Generic file import (for future media, textures, MOV alpha)
         */
        importMedia: function(paramsJson) {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "Please open or create a project first");
                }
                var params = parseJson(paramsJson);
                var file = new File(params.filePath);
                if (!file.exists) {
                    return jsonResponse(false, null, "File does not exist: " + params.filePath);
                }

                app.beginUndoGroup("BiblioPard: Import Media");
                var importedItem = app.project.importFile(new ImportOptions(file));
                var comp = app.project.activeItem;
                var layer = null;
                if (comp && comp instanceof CompItem) {
                    layer = comp.layers.add(importedItem);
                }
                app.endUndoGroup();

                return jsonResponse(true, {
                    importedName: importedItem.name,
                    addedToComp: !!layer
                });
            } catch (e) {
                try { app.endUndoGroup(); } catch (ignored) {}
                return jsonResponse(false, null, e.toString());
            }
        },

        /**
         * Get selected items from the Project Panel
         */
        getSelectedProjectItems: function() {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "No project open");
                }
                var sel = app.project.selection;
                var items = [];
                for (var i = 0; i < sel.length; i++) {
                    var item = sel[i];
                    var itemInfo = {
                        id: item.id,
                        name: item.name,
                        typeName: item.typeName,
                        filePath: (item.file && item.file.exists) ? item.file.fsName : null,
                        width: item.width || 0,
                        height: item.height || 0,
                        duration: item.duration || 0
                    };
                    items.push(itemInfo);
                }
                return jsonResponse(true, items);
            } catch (e) {
                return jsonResponse(false, null, "Error getting selected items: " + e.toString());
            }
        },

        /**
         * Import a PBR material texture set into a dedicated project folder
         * @param {string} paramsJson - { materialName: string, mapPaths: object }
         */
        importMaterialSet: function(paramsJson) {
            try {
                if (!app.project) {
                    return jsonResponse(false, null, "No project open");
                }
                var params = parseJson(paramsJson);
                var materialName = params.materialName || "New_Material";
                var mapPaths = params.mapPaths || {};

                app.beginUndoGroup("BiblioPard: Import Material Set");

                // Check or create "Materials" root folder
                var materialsRootFolder = null;
                for (var i = 1; i <= app.project.numItems; i++) {
                    if (app.project.item(i) instanceof FolderItem && app.project.item(i).name === "Materials") {
                        materialsRootFolder = app.project.item(i);
                        break;
                    }
                }
                if (!materialsRootFolder) {
                    materialsRootFolder = app.project.items.addFolder("Materials");
                }

                // Create folder for this specific material
                var matFolder = app.project.items.addFolder(materialName);
                matFolder.parentFolder = materialsRootFolder;

                var importedCount = 0;
                var importedMaps = {};

                for (var mapKey in mapPaths) {
                    if (mapPaths.hasOwnProperty(mapKey) && mapPaths[mapKey]) {
                        var mapFile = new File(mapPaths[mapKey]);
                        if (mapFile.exists) {
                            var imported = app.project.importFile(new ImportOptions(mapFile));
                            if (imported) {
                                imported.parentFolder = matFolder;
                                importedMaps[mapKey] = imported.name;
                                importedCount++;
                            }
                        }
                    }
                }

                app.endUndoGroup();

                return jsonResponse(true, {
                    materialName: materialName,
                    folderName: matFolder.name,
                    importedCount: importedCount,
                    maps: importedMaps
                });
            } catch (e) {
                try { app.endUndoGroup(); } catch (ignored) {}
                return jsonResponse(false, null, "Material import error: " + e.toString());
            }
        },

        /**
         * Reveal a file or directory in the OS file explorer (Windows Explorer / macOS Finder)
         * @param {string} filePath - Path to file or folder
         */
        revealFile: function(filePath) {
            try {
                if (!filePath) return jsonResponse(false, null, "No path provided");
                var cleanPath = String(filePath).replace(/^file:\/\/\/?/i, "");
                var f = new File(cleanPath);
                if (!f.exists) {
                    f = new Folder(cleanPath);
                }
                if (f.exists) {
                    f.execute();
                    return jsonResponse(true, { path: f.fsName }, "Revealed in Explorer");
                }
                // If specific file not found, try revealing parent directory
                var lastSlash = Math.max(cleanPath.lastIndexOf("/"), cleanPath.lastIndexOf("\\"));
                if (lastSlash !== -1) {
                    var parentFolder = new Folder(cleanPath.substring(0, lastSlash));
                    if (parentFolder.exists) {
                        parentFolder.execute();
                        return jsonResponse(true, { path: parentFolder.fsName }, "Parent folder opened");
                    }
                }
                return jsonResponse(false, null, "File or folder not found: " + cleanPath);
            } catch (e) {
                return jsonResponse(false, null, e.toString());
            }
        },

        /**
         * Copy a file from source to destination path
         * @param {string} paramsJson - { srcPath: string, dstPath: string }
         */
        copyFile: function(paramsJson) {
            try {
                var params = parseJson(paramsJson);
                var src = new File(String(params.srcPath).replace(/^file:\/\/\/?/i, ""));
                if (!src.exists) {
                    return jsonResponse(false, null, "Source file does not exist: " + params.srcPath);
                }
                var dst = new File(String(params.dstPath).replace(/^file:\/\/\/?/i, ""));
                var dstFolder = dst.parent;
                if (!dstFolder.exists) {
                    dstFolder.create();
                }
                var ok = src.copy(dst);
                return jsonResponse(ok, { dstPath: dst.fsName }, ok ? "File copied successfully" : "Failed to copy file");
            } catch (e) {
                return jsonResponse(false, null, e.toString());
            }
        },

        /**
         * Write UTF-8 text file (e.g. meta.json)
         * @param {string} paramsJson - { filePath: string, content: string }
         */
        writeTextFile: function(paramsJson) {
            try {
                var params = parseJson(paramsJson);
                var f = new File(String(params.filePath).replace(/^file:\/\/\/?/i, ""));
                var folder = f.parent;
                if (!folder.exists) {
                    folder.create();
                }
                f.encoding = "UTF-8";
                if (f.open("w")) {
                    f.write(params.content);
                    f.close();
                    return jsonResponse(true, { filePath: f.fsName });
                }
                return jsonResponse(false, null, "Could not open file for writing: " + params.filePath);
            } catch (e) {
                return jsonResponse(false, null, e.toString());
            }
        },

        /**
         * Ensure directory exists
         * @param {string} folderPath
         */
        ensureFolder: function(folderPath) {
            try {
                var f = new Folder(String(folderPath).replace(/^file:\/\/\/?/i, ""));
                if (!f.exists) {
                    f.create();
                }
                return jsonResponse(true, { exists: f.exists, path: f.fsName });
            } catch (e) {
                return jsonResponse(false, null, e.toString());
            }
        }
    };
})();
