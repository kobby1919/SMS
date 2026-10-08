# Finance Migration

Use the three finance templates in the migration workspace in this order:

1. **Fee structures:** import existing school grades' standard charges, categories, billing frequencies, optional-item settings and due dates. Review and publish each structure before continuing. All items within a grade, term and academic year share a due date. Published or already billed structures cannot be changed by import.
2. **Student opening bills:** import one row per student and fee item. Charges and frequencies must match the published structure. Enter original gross charges and historical paid amounts, not net balances after scholarships. Opening payments do not generate receipts or appear as today's cash collection. Existing lines are skipped; bills with live payments, waivers or discounts cannot be extended through opening import.
3. **Discounts and scholarships:** import approved bill-level reductions with a reason and a unique school approval reference. Enter a fixed amount OR a percentage. Percentages apply to the original gross bill total. Multiple reductions must fit within the remaining unpaid balance. A previously imported approval reference cannot be reused, even after removal.

Example: tuition 1,200, opening paid 500, approved scholarship 200. The resulting balance is 500; collected remains 500, not 700.

Daily gate collections, including feeding and transport, use daily collection setup and sessions. They do not belong in these opening-bill templates. Billing frequency describes the charge; importing a monthly or weekly item does not create an automatic recurring billing schedule.

Discounts are currently bill-level, not restricted to an individual fee item. Each new discount stores its resolved monetary value so removal restores the exact reduction. Historical percentage-only discounts require a verified original audit amount before removal; the system does not guess from a changed bill total.

Imports are transactional and school-scoped. Conflicts roll back the batch. Revalidate after a conflict. Import batches and finance changes have audit records. Existing records are not automatically recategorized or rewritten by this update.

Before live migration, test all three templates on a staging database, including concurrent payment/discount activity, repeated approval references, mismatched charge/frequency, invalid dates, wrong-school admissions, and a scholarship that settles the remaining balance exactly.
