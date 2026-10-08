# Migration Reconciliation And School Approval

## Workflow

1. Confirm the inventory, including unique guardian counts, fee-item counts and opening bill-line counts.
2. Upload, validate and import the agreed records. Cancel unused pending uploads.
3. Refresh reconciliation. Compare agreed counts with the imported identities still present in the same school.
4. Compare gross charges, discounts, opening paid credits and outstanding with declared control totals. Opening paid credits do not create new payments or receipts.
5. Review the sample class placements and guardian links against source files. Review held/skipped rows in batch error reports; missing agreed records must be corrected or the inventory explicitly revised.
6. Download the review for the school's records. The authorized school admin records the representative, review note and two confirmations. The server recomputes the review inside a serializable transaction before recording approval.
7. Continue to readiness review. Approval is checked again for completion; a changed inventory, batch, imported record or pending upload requires a fresh review.

## Evidence And Limits

New imports save committed record IDs and exact minor-unit financial controls in their existing import audit transaction. Guardian IDs are deduplicated across student/parent files. Fee-structure evidence counts fee items; opening bill evidence counts line items. No whole-school totals are substituted for migration totals.

Legacy batches without record-level evidence are blocked from automatic approval. Their records are not deleted or reimported automatically. They need a separately verified reconciliation; this implementation does not fabricate retrospective evidence.

Problematic batches block approval. A dedicated correction/resolution workflow is still needed for those historical batches; do not remove their flags to bypass review. At most 1,000 batches and 50,000 identities per dataset are reviewed by this interactive workflow. Larger migrations need a dedicated review process.

Approval is an append-only school admin attestation, not an independent financial audit. Small deterministic samples are not a substitute for checking all disputed records against the source. This step does not send bulk invites, create backups, roll back imported data or certify deployment readiness.

Production still requires live database concurrency tests, a browser walkthrough at desktop/mobile sizes, and the backup/restore and cutover controls in later points. Existing unrelated data is not changed by reconciliation.
