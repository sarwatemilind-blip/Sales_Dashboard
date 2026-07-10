from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(__file__).resolve().parent
OUTDIR = BASE / "outputs" / "corrected_targets"
OUTDIR.mkdir(parents=True, exist_ok=True)

EMP_PATH = BASE / "employees.csv"
TARGET_XLSX = BASE / "HQ wise Targets - 2025-26.xlsx"
CSV_OUT = OUTDIR / "corrected_targets.csv"
SUMMARY_OUT = OUTDIR / "summary.json"
UNMAPPED_OUT = OUTDIR / "unmapped_hqs.json"

MONTH_SPECS = [
    (1, "APRIL", 2026),
    (2, "MAY", 2026),
    (3, "JUNE", 2026),
    (4, "JULY", 2026),
    (5, "AUG", 2026),
    (6, "SEP", 2026),
    (7, "OCT", 2026),
    (8, "NOV", 2026),
    (9, "DEC", 2026),
    (10, "JAN", 2027),
    (11, "FEB", 2027),
    (12, "MARCH", 2027),
]


def find_month_col(columns: list[str], token: str, kind: str) -> str:
    token = token.upper()
    kind = kind.upper()
    for col in columns:
        text = str(col).upper()
        if token in text and kind in text and "TGT" in text:
            return col
    raise KeyError(f"Could not find {kind} target column for {token}")


def main() -> None:
    employees = pd.read_csv(EMP_PATH, dtype=str).fillna("")
    be = employees[employees["designation"].str.upper().eq("BE")].copy()
    for col in ["emp_id", "hq_code", "hq_name", "state", "region"]:
        be[col] = be[col].str.strip()

    be_by_hq: dict[str, pd.DataFrame] = {
        hq: group.sort_values("emp_id").reset_index(drop=True)
        for hq, group in be.groupby("hq_code", dropna=False)
    }

    wb = pd.read_excel(TARGET_XLSX, sheet_name="HQ wise Month wise", header=1)
    wb = wb[wb["HQ Code"].notna()].copy()
    wb["HQ Code"] = wb["HQ Code"].astype(str).str.strip()
    wb["HQ"] = wb["HQ"].astype(str).str.strip()
    wb["Brand"] = wb["Brand"].astype(str).str.strip()
    wb["Product Code"] = wb["Product Code"].astype(str).str.strip()

    columns = list(wb.columns)
    month_cols = {
        mnum: (
            find_month_col(columns, token, "VAL"),
            find_month_col(columns, token, "UNIT"),
        )
        for mnum, token, _ in MONTH_SPECS
    }

    rows: list[dict[str, object]] = []
    generated_source_rows = 0
    vacancy_source_rows = 0
    manager_allocations = 0
    hq_count_mismatches: dict[str, dict[str, int]] = {}

    for _, src in wb.iterrows():
        generated_source_rows += 1
        hq_code = src["HQ Code"]
        source_be_count = int(src["No. of BEs"]) if pd.notna(src["No. of BEs"]) else 0

        slot_cols = ["EMP Id - 1", "EMP Id - 2", "EMP Id - 3"]
        filled_slots: list[str] = []
        vacant_slots = 0
        for col in slot_cols:
            value = src[col]
            if pd.isna(value) or str(value).strip() == "":
                continue
            value = str(value).strip()
            if value.upper() == "VACANT":
                vacant_slots += 1
            else:
                filled_slots.append(value)

        total_slots = max(source_be_count, len(filled_slots) + vacant_slots)
        if total_slots <= 0:
            continue

        if vacant_slots > 0:
            vacancy_source_rows += 1
        if source_be_count != total_slots:
            hq_count_mismatches[hq_code] = {
                "source_no_of_be": source_be_count,
                "effective_slots": total_slots,
            }

        manager_emp_id = str(src["Manager EMP Id"]).strip()
        manager_name = str(src["Name of Manager"]).strip()
        source_hq_name = str(src["HQ"]).strip()
        state = str(src.get("State", "")).strip()
        region = str(src.get("Region", "")).strip()

        for mnum, token, year in MONTH_SPECS:
            val_col, unit_col = month_cols[mnum]
            val_total = float(src[val_col]) if pd.notna(src[val_col]) else 0.0
            unit_total = float(src[unit_col]) if pd.notna(src[unit_col]) else 0.0
            month_name = token

            val_per_slot = val_total / total_slots if total_slots else 0.0
            unit_per_slot = unit_total / total_slots if total_slots else 0.0

            for emp_id in filled_slots:
                emp_row = be.loc[be["emp_id"].eq(emp_id)].head(1)
                emp_hq_name = emp_row.iloc[0]["hq_name"] if not emp_row.empty else source_hq_name
                emp_state = emp_row.iloc[0]["state"] if not emp_row.empty and emp_row.iloc[0]["state"] else state
                emp_region = emp_row.iloc[0]["region"] if not emp_row.empty and emp_row.iloc[0]["region"] else region
                rows.append(
                    {
                        "emp_id": emp_id,
                        "hq_code": hq_code,
                        "hq_name": emp_hq_name or source_hq_name,
                        "brand": src["Brand"],
                        "product_code": src["Product Code"],
                        "state": emp_state,
                        "region": emp_region,
                        "no_of_be": total_slots,
                        "month_num": mnum,
                        "month_name": month_name,
                        "year": year,
                        "val_target_total": val_total,
                        "unit_target_total": unit_total,
                        "val_target_per_be": val_per_slot,
                        "unit_target_per_be": unit_per_slot,
                    }
                )

            for vacancy_idx in range(vacant_slots):
                manager_allocations += 1
                vacancy_label = "Vacant BE" if vacant_slots == 1 else f"Vacant BE {vacancy_idx + 1}"
                rows.append(
                    {
                        "emp_id": manager_emp_id,
                        "hq_code": hq_code,
                        "hq_name": f"{source_hq_name} ({vacancy_label})",
                        "brand": src["Brand"],
                        "product_code": src["Product Code"],
                        "state": state,
                        "region": region,
                        "no_of_be": total_slots,
                        "month_num": mnum,
                        "month_name": month_name,
                        "year": year,
                        "val_target_total": val_total,
                        "unit_target_total": unit_total,
                        "val_target_per_be": val_per_slot,
                        "unit_target_per_be": unit_per_slot,
                    }
                )

    output = pd.DataFrame(rows)
    if not output.empty:
        output = output[
            [
                "emp_id",
                "hq_code",
                "hq_name",
                "brand",
                "product_code",
                "state",
                "region",
                "no_of_be",
                "month_num",
                "month_name",
                "year",
                "val_target_total",
                "unit_target_total",
                "val_target_per_be",
                "unit_target_per_be",
            ]
        ]
        output = output.sort_values(
            ["emp_id", "product_code", "brand", "year", "month_num"],
            kind="mergesort",
        ).reset_index(drop=True)

    # HQs with BE employees but no source target rows at all.
    source_hqs = set(wb["HQ Code"].astype(str).str.strip())
    current_be_hqs = set(be["hq_code"].astype(str).str.strip())
    unmapped_hqs = []
    for hq_code in sorted(current_be_hqs - source_hqs):
        group = be_by_hq.get(hq_code)
        if group is None or group.empty:
            continue
        first = group.iloc[0]
        unmapped_hqs.append(
            {
                "hq_code": hq_code,
                "hq_name": first["hq_name"],
                "state": first["state"],
                "region": first["region"],
                "emp_ids": ", ".join(group["emp_id"].tolist()),
                "emp_names": ", ".join(group["name"].tolist()),
                "note": "No source target rows exist in the HQ wise target workbook for this HQ.",
            }
        )

    output.to_csv(CSV_OUT, index=False)
    SUMMARY_OUT.write_text(
        json.dumps(
            {
                "source_rows": int(len(wb)),
                "generated_source_rows": int(generated_source_rows),
                "output_rows": int(len(output)),
                "unique_output_emp_ids": int(output["emp_id"].nunique()) if not output.empty else 0,
                "vacancy_source_rows": int(vacancy_source_rows),
                "manager_allocations": int(manager_allocations),
                "unmapped_hq_count": int(len(unmapped_hqs)),
                "hq_count_mismatches": hq_count_mismatches,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    UNMAPPED_OUT.write_text(json.dumps(unmapped_hqs, indent=2), encoding="utf-8")

    print(f"Wrote {CSV_OUT}")
    print(f"Wrote {SUMMARY_OUT}")
    print(f"Wrote {UNMAPPED_OUT}")


if __name__ == "__main__":
    main()
