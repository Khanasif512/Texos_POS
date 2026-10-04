-- Data backfill (idempotent): link existing order advances and billing invoice metadata to the new columns.

UPDATE `money_receipts` mr
JOIN `sales_orders` so
  ON so.companyId = mr.companyId
 AND mr.note LIKE CONCAT('Advance for order ', so.number, '%')
SET mr.salesOrderId = so.id
WHERE mr.isAdvance = 1 AND mr.salesOrderId IS NULL;

UPDATE `billing_invoices` bi
JOIN `audit_logs` a
  ON a.entityId = bi.id AND a.entityType = 'billing_invoice' AND a.action = 'create'
SET bi.kind = JSON_UNQUOTE(JSON_EXTRACT(a.`after`, '$.kind')),
    bi.billingCycle = CASE JSON_UNQUOTE(JSON_EXTRACT(a.`after`, '$.cycle')) WHEN 'yearly' THEN 'yearly' WHEN 'monthly' THEN 'monthly' ELSE NULL END,
    bi.planId = (SELECT p.id FROM `plans` p WHERE p.id = JSON_UNQUOTE(JSON_EXTRACT(a.`after`, '$.planId')))
WHERE bi.kind IS NULL AND JSON_EXTRACT(a.`after`, '$.kind') IS NOT NULL;
