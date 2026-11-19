-- A saved estimate may be accepted into one fixed Studio invoice. The
-- conversation reference and frozen quote facts are never public invoice fields.
ALTER TABLE pricing_quotes ADD COLUMN configuration TEXT NOT NULL DEFAULT '';
ALTER TABLE pricing_quotes ADD COLUMN artwork_id TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN source_quote_id INTEGER REFERENCES pricing_quotes(id) ON DELETE RESTRICT;
ALTER TABLE invoices ADD COLUMN source_quote_json TEXT;
CREATE UNIQUE INDEX invoices_one_per_accepted_quote ON invoices(source_quote_id);
