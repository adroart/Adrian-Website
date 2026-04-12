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

// Wrap everything in a function so `return` stops execution cleanly
function run() {

  // ── Config ──────────────────────────────────────────────────────────────────
  // Partial name of your background layer. Change if yours is named differently.
  var BACKGROUND_LAYER_NAME = "Background";

  // ── Setup ───────────────────────────────────────────────────────────────────

  // Suppress all Photoshop dialogs during the export loop
  var originalDialogMode = app.displayDialogs;
  app.displayDialogs = DialogModes.NO;

  var doc = app.activeDocument;
  if (!doc) {
    app.displayDialogs = originalDialogMode;
    alert("No document is open. Open your layered file first, then run this script.");
    return;
  }

  var outputFolder = Folder.selectDialog("Select an output folder for the exported TIFFs");
  if (!outputFolder) {
    app.displayDialogs = originalDialogMode;
    return;
  }

  // ── Collect layers ──────────────────────────────────────────────────────────

  var allLayers = doc.layers;
  var qrLayers  = [];
  var bgLayer   = null;

  for (var i = 0; i < allLayers.length; i++) {
    var layer = allLayers[i];
    if (layer.name.toLowerCase().indexOf(BACKGROUND_LAYER_NAME.toLowerCase()) !== -1) {
      bgLayer = layer;
    } else {
      qrLayers.push(layer);
    }
  }

  if (qrLayers.length === 0) {
    app.displayDialogs = originalDialogMode;
    alert("No QR layers found. Make sure your QR layers are at the top level of the document.");
    return;
  }

  // Confirm before starting
  app.displayDialogs = originalDialogMode;  // re-enable for the confirm dialog
  var proceed = confirm(
    "Ready to export " + qrLayers.length + " layers.\n\n" +
    "Background layer: " + (bgLayer ? '"' + bgLayer.name + '"' : "not found — all layers treated as QR") + "\n" +
    "Output folder: " + outputFolder.fsName + "\n\n" +
    "This will save one TIFF per layer. Continue?"
  );
  app.displayDialogs = DialogModes.NO;      // suppress again for the export loop

  if (!proceed) {
    app.displayDialogs = originalDialogMode;
    return;
  }

  // ── Save original visibility state ──────────────────────────────────────────

  var originalVisibility = [];
  for (var i = 0; i < allLayers.length; i++) {
    originalVisibility.push(allLayers[i].visible);
  }

  // ── Export loop ─────────────────────────────────────────────────────────────

  var errors = [];

  for (var i = 0; i < qrLayers.length; i++) {
    var qrLayer = qrLayers[i];

    try {
      // Hide every QR layer, then show only this one
      for (var j = 0; j < qrLayers.length; j++) {
        qrLayers[j].visible = false;
      }
      qrLayer.visible = true;
      if (bgLayer) bgLayer.visible = true;

      // Sanitise layer name → filename
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

      // Duplicate the document, flatten the copy, save, close it
      var flatDoc = doc.duplicate(safeName, true);
      app.activeDocument = flatDoc;
      flatDoc.flatten();

      var tiffOpts              = new TiffSaveOptions();
      tiffOpts.imageCompression = TIFFEncoding.TIFFLZW;
      tiffOpts.layers           = false;
      tiffOpts.alphaChannels    = false;

      flatDoc.saveAs(outputFile, tiffOpts, true);
      flatDoc.close(SaveOptions.DONOTSAVECHANGES);
      app.activeDocument = doc;

    } catch (e) {
      errors.push(qrLayer.name + ": " + e.message);
      // Clean up any stray duplicate document
      try {
        if (app.documents.length > 1) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
          app.activeDocument = doc;
        }
      } catch (ignore) {}
    }
  }

  // ── Restore original visibility ─────────────────────────────────────────────

  for (var i = 0; i < allLayers.length; i++) {
    allLayers[i].visible = originalVisibility[i];
  }

  // ── Restore dialog mode ─────────────────────────────────────────────────────

  app.displayDialogs = originalDialogMode;

  // ── Summary ─────────────────────────────────────────────────────────────────

  var successCount = qrLayers.length - errors.length;
  var msg = "Done.\n\n" +
    successCount + " of " + qrLayers.length + " TIFFs exported to:\n" +
    outputFolder.fsName;

  if (errors.length > 0) {
    msg += "\n\nErrors (" + errors.length + "):\n" + errors.join("\n");
  }

  alert(msg);
}

run();
