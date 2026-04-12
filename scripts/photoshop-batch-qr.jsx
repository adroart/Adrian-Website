/**
 * Universal Language — QR Layer Exporter
 *
 * Works on the currently open Photoshop document.
 * Assumes the document has:
 *   - A background layer (always visible)
 *   - 64 QR layers on top, one per card
 *
 * For each QR layer the script:
 *   1. Hides all other QR layers
 *   2. Makes that layer visible
 *   3. Exports a print-ready TIFF named after the layer
 *
 * How to run:
 *   Photoshop → File → Scripts → Browse → select this file
 *   (The document you want to export must already be open and active)
 */

// ── Config ────────────────────────────────────────────────────────────────────

// Name (or partial name) of your background layer — used to exclude it from
// the QR loop. Change this if your background layer has a different name.
var BACKGROUND_LAYER_NAME = "Background";

// ── Setup ─────────────────────────────────────────────────────────────────────

var doc = app.activeDocument;
if (!doc) {
  alert("No document is open. Open your layered file first, then run this script.");
}

var outputFolder = Folder.selectDialog("Select an output folder for the exported TIFFs");
if (!outputFolder) { alert("Cancelled."); }

// ── Collect layers ────────────────────────────────────────────────────────────
// Grab all top-level layers that are not the background.

var allLayers  = doc.layers;
var qrLayers   = [];
var bgLayer    = null;

for (var i = 0; i < allLayers.length; i++) {
  var layer = allLayers[i];
  if (layer.name.toLowerCase().indexOf(BACKGROUND_LAYER_NAME.toLowerCase()) !== -1) {
    bgLayer = layer;
  } else {
    qrLayers.push(layer);
  }
}

if (qrLayers.length === 0) {
  alert("No QR layers found. Make sure your QR layers are at the top level of the document.");
}

// Confirm before starting
var proceed = confirm(
  "Ready to export " + qrLayers.length + " layers.\n\n" +
  "Background layer: " + (bgLayer ? '"' + bgLayer.name + '"' : "not found — all layers treated as QR") + "\n" +
  "Output folder: " + outputFolder.fsName + "\n\n" +
  "This will save one TIFF per layer. Continue?"
);
if (!proceed) { alert("Cancelled."); }

// ── Save original visibility state ────────────────────────────────────────────

var originalVisibility = [];
for (var i = 0; i < allLayers.length; i++) {
  originalVisibility.push(allLayers[i].visible);
}

// ── Export loop ───────────────────────────────────────────────────────────────

var errors = [];

// Make sure background stays visible throughout
if (bgLayer) bgLayer.visible = true;

for (var i = 0; i < qrLayers.length; i++) {
  var qrLayer = qrLayers[i];

  try {
    // Hide every QR layer, then show only this one
    for (var j = 0; j < qrLayers.length; j++) {
      qrLayers[j].visible = false;
    }
    qrLayer.visible = true;
    if (bgLayer) bgLayer.visible = true;

    // Sanitise layer name for use as a filename
    // "01 · Earth's Breath" → "01-earths-breath"
    var safeName = qrLayer.name
      .replace(/·/g, "-")
      .replace(/['']/g, "")
      .replace(/[^a-zA-Z0-9\-_\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    var outputFile = new File(outputFolder.fsName + "/" + safeName + ".tif");

    // Flatten a duplicate so we don't destroy the layered original
    var flatDoc = doc.duplicate();
    flatDoc.flatten();

    // Export as TIFF — print-quality, LZW lossless compression
    var tiffOpts           = new TiffSaveOptions();
    tiffOpts.compression   = TIFFEncoding.TIFFLZW;
    tiffOpts.layers        = false;
    tiffOpts.imageCompression = MacOSType.NONE;

    flatDoc.saveAs(outputFile, tiffOpts, true);
    flatDoc.close(SaveOptions.DONOTSAVECHANGES);

  } catch (e) {
    errors.push(qrLayer.name + ": " + e.message);
    try {
      if (app.documents.length > 1) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = doc;
      }
    } catch (ignore) {}
  }
}

// ── Restore original visibility ───────────────────────────────────────────────

for (var i = 0; i < allLayers.length; i++) {
  allLayers[i].visible = originalVisibility[i];
}

// ── Summary ───────────────────────────────────────────────────────────────────

var successCount = qrLayers.length - errors.length;
var msg = "Done.\n\n" +
  successCount + " of " + qrLayers.length + " TIFFs exported to:\n" +
  outputFolder.fsName;

if (errors.length > 0) {
  msg += "\n\nErrors (" + errors.length + "):\n" + errors.join("\n");
}

alert(msg);
