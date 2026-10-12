"""Bulk-merge a vetted CSV brand list into brands.csv.

Usage:
    python import_brand_csv.py path/to/verified_brands.csv

Both CSVs must use the columns: brand,aliases,official_domains
Verify input official domains independently BEFORE importing.
"""
import csv
import sys
from pathlib import Path

DEST = Path(__file__).resolve().with_name('brands.csv')
HEADERS = ('brand','aliases','official_domains')


def rows_from(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        rd = csv.DictReader(f)
        if not rd.fieldnames or not set(HEADERS).issubset(rd.fieldnames):
            raise ValueError(f'{path} must have columns: {", ".join(HEADERS)}')
        return [{h: (row.get(h) or '').strip() for h in HEADERS}
                for row in rd if row.get('brand') and row.get('official_domains')]


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python import_brand_csv.py path/to/verified_brands.csv')
    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file() or source == DEST.resolve():
        raise SystemExit('Provide a different existing CSV file with verified reference domains.')
    existing = rows_from(DEST) if DEST.exists() else []
    imported = rows_from(source)
    by_brand = {row['brand'].lower(): row for row in existing}
    for row in imported:
        by_brand[row['brand'].lower()] = row
    with DEST.open('w', encoding='utf-8', newline='') as f:
        wr = csv.DictWriter(f, fieldnames=HEADERS)
        wr.writeheader()
        wr.writerows(by_brand.values())
    print(f'Imported {len(imported)} entries. Catalog now has {len(by_brand)} brand records.')
    print('Re-run test_brands.py and review false positives after changing the catalog.')


if __name__ == '__main__':
    main()
