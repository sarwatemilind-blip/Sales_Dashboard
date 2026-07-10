import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "file:///C:/Users/Milind/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const baseDir = process.cwd();
const outDir = path.join(baseDir, "outputs", "corrected_targets");
const csvPath = path.join(outDir, "corrected_targets.csv");
const summaryPath = path.join(outDir, "summary.json");
const unmappedPath = path.join(outDir, "unmapped_hqs.json");
const xlsxPath = path.join(outDir, "corrected_targets_rebuilt.xlsx");
const previewDir = path.join(outDir, "previews");

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const csvText = await fs.readFile(csvPath, "utf8");
const workbook = await Workbook.fromCSV(csvText, { sheetName: "Targets" });
const targetsSheet = workbook.worksheets.getItemAt(0);

// Basic readability for the main sheet.
targetsSheet.freezePanes.freezeRows(1);
targetsSheet.getRange("A1:O1").format = {
  fill: "#0F172A",
  font: { bold: true, color: "#FFFFFF" },
};
const targetWidths = {
  A: 110,
  B: 90,
  C: 220,
  D: 170,
  E: 120,
  F: 90,
  G: 95,
  H: 85,
  I: 75,
  J: 110,
  K: 75,
  L: 135,
  M: 135,
  N: 135,
  O: 135,
};
for (const [col, widthPx] of Object.entries(targetWidths)) {
  targetsSheet.getRange(`${col}:${col}`).format.columnWidthPx = widthPx;
}

const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
const summarySheet = workbook.worksheets.add("Summary");
summarySheet.getRange("A1:B7").values = [
  ["Metric", "Value"],
  ["Source workbook rows", summary.source_rows],
  ["Rows generated from source", summary.generated_source_rows],
  ["Final target rows", summary.output_rows],
  ["Source rows with vacant BE slots", summary.vacancy_source_rows],
  ["Vacant-slot manager allocations", summary.manager_allocations],
  ["Current BE HQs missing source target rows", summary.unmapped_hq_count],
];
summarySheet.getRange("A1:B1").format = {
  fill: "#1D4ED8",
  font: { bold: true, color: "#FFFFFF" },
};
summarySheet.freezePanes.freezeRows(1);
summarySheet.getRange("A:A").format.columnWidthPx = 320;
summarySheet.getRange("B:B").format.columnWidthPx = 160;

const unmapped = JSON.parse(await fs.readFile(unmappedPath, "utf8"));
const unmappedSheet = workbook.worksheets.add("Unmapped HQs");
if (unmapped.length > 0) {
  const headers = Object.keys(unmapped[0]);
  const values = [headers, ...unmapped.map(row => headers.map(h => row[h]))];
  unmappedSheet.getRangeByIndexes(0, 0, values.length, headers.length).values = values;
  unmappedSheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: "#991B1B",
    font: { bold: true, color: "#FFFFFF" },
  };
  unmappedSheet.freezePanes.freezeRows(1);
  unmappedSheet.getUsedRange().format.autofitColumns();
} else {
  unmappedSheet.getRange("A1").values = [["No unmapped HQs"]];
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(xlsxPath);

// Render a lightweight QA preview for the main sheet.
const targetsPreview = await workbook.render({
  sheetName: "Targets",
  range: "A1:O12",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(previewDir, "targets_preview.png"), new Uint8Array(await targetsPreview.arrayBuffer()));

const summaryPreview = await workbook.render({
  sheetName: "Summary",
  range: "A1:B7",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(previewDir, "summary_preview.png"), new Uint8Array(await summaryPreview.arrayBuffer()));

const notePreview = await workbook.render({
  sheetName: "Unmapped HQs",
  range: "A1:G6",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(previewDir, "unmapped_preview.png"), new Uint8Array(await notePreview.arrayBuffer()));

console.log(`Saved ${xlsxPath}`);
