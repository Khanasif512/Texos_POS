-- AlterTable
ALTER TABLE `billing_invoices` ADD COLUMN `billingCycle` ENUM('monthly', 'yearly') NULL,
    ADD COLUMN `kind` VARCHAR(20) NULL,
    ADD COLUMN `planId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `money_receipts` ADD COLUMN `salesOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sales_returns` ADD COLUMN `lastPrintedAt` DATETIME(3) NULL,
    ADD COLUMN `printCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `money_receipts_salesOrderId_idx` ON `money_receipts`(`salesOrderId`);

-- AddForeignKey
ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
