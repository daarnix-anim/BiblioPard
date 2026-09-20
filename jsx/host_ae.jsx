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
         * Import 3D model (GLB, GLTF, OBJ) and optionally add to active comp with scaling
         * @param {string} paramsJson - { filePath: string, target?: 'comp'|'project', scaleMode?: string, autoCenter?: boolean }
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

                var target = params.target || 'comp'; // 'comp' or 'project'
                var scaleMode = params.scaleMode || 'fit-comp'; // 'fit-comp', 'fit-fullhd', 'original', 'fit-width', 'fit-height'
                var autoCenter = (params.autoCenter !== false);

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

                // Add to active composition if requested and available
                if (target === 'comp' && comp && comp instanceof CompItem) {
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
                        try {
                            if (layer.threeDLayer !== undefined) {
                                layer.threeDLayer = true;
                            }
                            if (autoCenter && layer.property("Position")) {
                                layer.property("Position").setValue([comp.width / 2, comp.height / 2, 0]);
                            }
                        } catch (posErr) {
                            // Non-critical
                        }

                        // Apply 3D scaling
                        try {
                            var uniformScale = 100;

                            if (params.scaleValue !== undefined && params.scaleValue !== null && params.scaleValue > 0) {
                                // Explicit exact scale percentage passed from UI
                                uniformScale = Number(params.scaleValue);
                            } else if (params.modelDimensions && params.modelDimensions.width > 0.0001 && params.modelDimensions.height > 0.0001) {
                                // Real 3D model geometry dimensions (in 3D units)
                                var mWidth = Number(params.modelDimensions.width);
                                var mHeight = Number(params.modelDimensions.height);
                                var targetW = comp.width;
                                var targetH = comp.height;

                                if (scaleMode === 'fit-fullhd') {
                                    targetW = 1920;
                                    targetH = 1080;
                                }

                                var scaleX = (targetW / mWidth) * 100;
                                var scaleY = (targetH / mHeight) * 100;

                                if (scaleMode === 'fit-width') {
                                    uniformScale = scaleX;
                                } else if (scaleMode === 'fit-height') {
                                    uniformScale = scaleY;
                                } else if (scaleMode === 'fit-fullhd' || scaleMode === 'fit-comp') {
                                    uniformScale = Math.min(scaleX, scaleY) * 0.85;
                                } else if (scaleMode === 'custom') {
                                    uniformScale = (params.scaleMultiplier || 1) * 100;
                                } else {
                                    // original (100%)
                                    uniformScale = 100 * (params.scaleMultiplier || 1);
                                }

                                if (params.scaleMultiplier && params.scaleMultiplier !== 1 && scaleMode !== 'custom' && scaleMode !== 'original') {
                                    uniformScale = uniformScale * Number(params.scaleMultiplier);
                                }
                            } else if (scaleMode === 'original') {
                                uniformScale = 100 * (params.scaleMultiplier || 1);
                            } else if (scaleMode === 'custom') {
                                uniformScale = (params.scaleMultiplier || 1) * 100;
                            } else {
                                // Fallback if 3D dimensions are unavailable
                                var targetW = comp.width;
                                var targetH = comp.height;
                                if (scaleMode === 'fit-fullhd') {
                                    targetW = 1920;
                                    targetH = 1080;
                                }

                                var rect = null;
                                try {
                                    rect = layer.sourceRectAtTime(0, false);
                                } catch (rectErr) {}

                                var objW = 0;
                                var objH = 0;
                                if (rect && rect.width > 0.5 && rect.height > 0.5) {
                                    objW = rect.width;
                                    objH = rect.height;
                                } else if (importedItem.width > 0.5 && importedItem.height > 0.5) {
                                    objW = importedItem.width;
                                    objH = importedItem.height;
                                }

                                if (objW > 0.5 && objH > 0.5) {
                                    var scaleX = (targetW / objW) * 100;
                                    var scaleY = (targetH / objH) * 100;

                                    if (scaleMode === 'fit-width') {
                                        uniformScale = scaleX;
                                    } else if (scaleMode === 'fit-height') {
                                        uniformScale = scaleY;
                                    } else {
                                        uniformScale = Math.min(scaleX, scaleY) * 0.85;
                                    }
                                } else {
                                    try {
                                        var cmdId = app.findMenuCommandId("Fit to Comp") || 2153;
                                        if (cmdId) {
                                            app.executeCommand(cmdId);
                                            if (layer.property("Scale")) {
                                                var curScale = layer.property("Scale").value;
                                                uniformScale = curScale[0];
                                            }
                                        }
                                    } catch (cmdErr) {}
                                }

                                if (params.scaleMultiplier && params.scaleMultiplier !== 1) {
                                    uniformScale = uniformScale * Number(params.scaleMultiplier);
                                }
                            }

                            // Uniform 3D scale so model volume is preserved without distortion along Z
                            if (layer.property("Scale")) {
                                layer.property("Scale").setValue([uniformScale, uniformScale, uniformScale]);
                            }
                        } catch (scaleErr) {
                            // Non-critical scale error
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

                var target = params.target || 'comp';

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
                var hdrLayer = null;
                var sourceLinked = false;

                if (target === 'comp' && comp && comp instanceof CompItem) {
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

                    // 1. Add HDR map layer to composition in disabled state (выключенный вид)
                    try {
                        hdrLayer = comp.layers.add(importedItem);
                        if (hdrLayer) {
                            hdrLayer.enabled = false; // Turn off visibility so it doesn't block the view
                            try {
                                hdrLayer.moveToEnd(); // Place at bottom of timeline
                            } catch (moveErr) {}
                        }
                    } catch (hdrErr) {}

                    // 2. Create Environment Light layer
                    // In AE 2024-2026: LightType.ENVIRONMENT is 4416 (4415 is Ambient)
                    var envLightType = (typeof LightType !== 'undefined' && LightType.ENVIRONMENT) ? LightType.ENVIRONMENT : 4416;
                    var lightName = "Env Light: " + importedItem.name;

                    try {
                        lightLayer = comp.layers.addLight(lightName, [comp.width / 2, comp.height / 2]);
                        try {
                            lightLayer.lightType = envLightType;
                        } catch (ltErr1) {
                            try {
                                lightLayer.lightType = 4416;
                            } catch (ltErr2) {
                                try {
                                    lightLayer.lightType = 4415;
                                } catch (ltErr3) {}
                            }
                        }
                    } catch (lightErr) {
                        try {
                            lightLayer = comp.layers.addLight(lightName, [comp.width / 2, comp.height / 2]);
                        } catch (fallbackErr) {}
                    }

                    // 3. Automatically link Environment Light Source to the HDR layer
                    if (lightLayer && hdrLayer) {
                        var hdrIndex = hdrLayer.index;

                        // Check properties inside ADBE Light Options Group
                        var lightOptions = lightLayer.property("ADBE Light Options Group") || lightLayer.property("Light Options");
                        if (lightOptions) {
                            for (var p = 1; p <= lightOptions.numProperties; p++) {
                                var prop = lightOptions.property(p);
                                if (!prop) continue;

                                var pName = (prop.name || "").toLowerCase();
                                var pMatch = (prop.matchName || "").toLowerCase();

                                // Skip non-source properties
                                if (pName.indexOf("intensity") !== -1 || pName.indexOf("color") !== -1 || 
                                    pName.indexOf("shadow") !== -1 || pName.indexOf("cone") !== -1 || 
                                    pName.indexOf("radius") !== -1 || pName.indexOf("falloff") !== -1) {
                                    continue;
                                }

                                var isSource = (
                                    (typeof PropertyValueType !== 'undefined' && prop.propertyValueType === PropertyValueType.LAYER_INDEX) ||
                                    pName.indexOf("source") !== -1 ||
                                    pName.indexOf("источник") !== -1 ||
                                    pName.indexOf("map") !== -1 ||
                                    pName.indexOf("карта") !== -1 ||
                                    pName.indexOf("env") !== -1 ||
                                    pMatch.indexOf("source") !== -1 ||
                                    pMatch.indexOf("env") !== -1 ||
                                    pMatch.indexOf("map") !== -1
                                );

                                if (isSource) {
                                    try {
                                        prop.setValue(hdrIndex);
                                        sourceLinked = true;
                                        break;
                                    } catch (setErr1) {
                                        try {
                                            prop.setValue(hdrLayer);
                                            sourceLinked = true;
                                            break;
                                        } catch (setErr2) {}
                                    }
                                }
                            }
                        }

                        // Check top-level properties if not linked yet
                        if (!sourceLinked) {
                            for (var tp = 1; tp <= lightLayer.numProperties; tp++) {
                                var tProp = lightLayer.property(tp);
                                if (!tProp) continue;
                                var tpName = (tProp.name || "").toLowerCase();
                                var tpMatch = (tProp.matchName || "").toLowerCase();
                                if (tpName.indexOf("source") !== -1 || tpName.indexOf("источник") !== -1 ||
                                    tpMatch.indexOf("source") !== -1) {
                                    try {
                                        tProp.setValue(hdrIndex);
                                        sourceLinked = true;
                                        break;
                                    } catch (setErr3) {
                                        try {
                                            tProp.setValue(hdrLayer);
                                            sourceLinked = true;
                                            break;
                                        } catch (setErr4) {}
                                    }
                                }
                            }
                        }
                    }
                }

                app.endUndoGroup();

                return jsonResponse(true, {
                    importedName: importedItem.name,
                    addedLight: !!lightLayer,
                    addedHdrLayer: !!hdrLayer,
                    sourceLinked: sourceLinked,
                    compName: (comp && comp instanceof CompItem) ? comp.name : null
                });
            } catch (e) {
                try { app.endUndoGroup(); } catch (ignored) {}
                return jsonResponse(false, null, "Environment Light error: " + e.toString());
            }
        },

        /**
         * Generic file import (media, textures, MOV alpha, audio, images)
         * @param {string} paramsJson - { filePath: string, target?: 'comp'|'project', scaleMode?: string, autoCenter?: boolean }
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

                var target = params.target || 'comp';
                var scaleMode = params.scaleMode || 'original';
                var autoCenter = (params.autoCenter !== false);

                app.beginUndoGroup("BiblioPard: Import Media");
                var importedItem = app.project.importFile(new ImportOptions(file));
                var comp = app.project.activeItem;
                var layer = null;

                if (target === 'comp' && comp && comp instanceof CompItem) {
                    layer = comp.layers.add(importedItem);

                    if (layer) {
                        try {
                            if (autoCenter && layer.property("Position")) {
                                layer.property("Position").setValue([comp.width / 2, comp.height / 2]);
                            }
                        } catch (posErr) {}

                        try {
                            var uniformScale = 100;

                            if (params.scaleValue !== undefined && params.scaleValue !== null && params.scaleValue > 0) {
                                uniformScale = Number(params.scaleValue);
                            } else if (scaleMode === 'original') {
                                uniformScale = 100 * (params.scaleMultiplier || 1);
                            } else if (scaleMode === 'custom') {
                                uniformScale = (params.scaleMultiplier || 1) * 100;
                            } else {
                                var targetW = comp.width;
                                var targetH = comp.height;
                                if (scaleMode === 'fit-fullhd') {
                                    targetW = 1920;
                                    targetH = 1080;
                                }

                                var objW = importedItem.width || 0;
                                var objH = importedItem.height || 0;

                                if (objW > 0 && objH > 0) {
                                    var scaleX = (targetW / objW) * 100;
                                    var scaleY = (targetH / objH) * 100;

                                    if (scaleMode === 'fit-width') {
                                        uniformScale = scaleX;
                                    } else if (scaleMode === 'fit-height') {
                                        uniformScale = scaleY;
                                    } else {
                                        // fit-comp or fit-fullhd
                                        uniformScale = Math.min(scaleX, scaleY);
                                    }
                                }

                                if (params.scaleMultiplier && params.scaleMultiplier !== 1) {
                                    uniformScale = uniformScale * Number(params.scaleMultiplier);
                                }
                            }

                            if (layer.property("Scale")) {
                                layer.property("Scale").setValue([uniformScale, uniformScale, 100]);
                            }
                        } catch (scaleErr) {}
                    }
                }

                app.endUndoGroup();

                return jsonResponse(true, {
                    importedName: importedItem.name,
                    addedToComp: !!layer,
                    compName: (comp && comp instanceof CompItem) ? comp.name : null
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

                if (f.exists) {
                    // It is a file: NEVER call f.execute() because that opens the file in 3D viewer or player!
                    if ($.os.indexOf("Windows") !== -1) {
                        try {
                            var winPath = f.fsName.replace(/\//g, "\\");
                            system.callSystem('explorer.exe /select,"' + winPath + '"');
                            return jsonResponse(true, { path: winPath }, "Revealed in Windows Explorer");
                        } catch (sysErr) {
                            if (f.parent && f.parent.exists) {
                                f.parent.execute();
                                return jsonResponse(true, { path: f.parent.fsName }, "Parent folder opened");
                            }
                        }
                    } else {
                        try {
                            system.callSystem('open -R "' + f.fsName + '"');
                            return jsonResponse(true, { path: f.fsName }, "Revealed in macOS Finder");
                        } catch (macErr) {
                            if (f.parent && f.parent.exists) {
                                f.parent.execute();
                                return jsonResponse(true, { path: f.parent.fsName }, "Parent folder opened");
                            }
                        }
                    }
                    // Fallback to parent folder
                    if (f.parent && f.parent.exists) {
                        f.parent.execute();
                        return jsonResponse(true, { path: f.parent.fsName }, "Parent folder opened");
                    }
                }

                // If it's a folder, execute opens the folder
                var folder = new Folder(cleanPath);
                if (folder.exists) {
                    folder.execute();
                    return jsonResponse(true, { path: folder.fsName }, "Folder opened");
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
