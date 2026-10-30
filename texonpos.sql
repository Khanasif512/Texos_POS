-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: texonpos
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.4

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('31b83af3-f4e9-4e1e-b768-6fb173392d4f','1c24326bbc431de9a4e4f79eebc0ba624c3e163a097847041f06ef906d473f28','2026-10-08 11:56:41.662','20261004082838_receipt_order_link_return_print_billing_plan',NULL,NULL,'2026-10-08 11:56:40.615',1),('3d98858c-c2bd-4b5c-9e5c-a068d71f1eb0','cb10bc743092ef4a4f9bb097b2944bf363816875f0a881a2125b627bae9ac9d0','2026-10-08 11:56:41.705','20261004083001_backfill_receipt_order_and_billing_meta',NULL,NULL,'2026-10-08 11:56:41.672',1),('7faa55c8-2685-4f3a-9040-36ec03267dae','5c05648c181838f9e48ef612b968b9a3d7c560fd224d5651da181b15aba7211c','2026-10-08 11:56:40.605','20261003083440_init',NULL,NULL,'2026-10-08 11:56:25.485',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mimeType` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` int DEFAULT NULL,
  `uploadedById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `attachments_companyId_entityType_entityId_idx` (`companyId`,`entityType`,`entityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actorType` enum('user','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `actorId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actorName` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `before` json DEFAULT NULL,
  `after` json DEFAULT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_companyId_createdAt_idx` (`companyId`,`createdAt`),
  KEY `audit_logs_entityType_entityId_idx` (`entityType`,`entityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES ('cmvp3pluc0000qpjcu14gyimu','cmuzhegpi001lqujcip78ku7p','admin',NULL,'System','trial_expired','subscription','cmuzhegrv0023qujc98kh8hdb','Trial of Growth expired',NULL,NULL,NULL,'2026-10-26 10:15:50.484'),('cmvp3plxx0002qpjcvof223tj','cmv1ylcy60001qbjck67f7a5f','admin',NULL,'System','trial_expired','subscription','cmv1yld2k000jqbjc0xnyaoa5','Trial of Growth expired',NULL,NULL,NULL,'2026-10-26 10:15:50.614'),('cmvp3plzm0004qpjcahgb9de2','cmv1z4jte000lqbjcyqafhjai','admin',NULL,'System','trial_expired','subscription','cmv1z4jv80013qbjcxl7ahmj8','Trial of Growth expired',NULL,NULL,NULL,'2026-10-26 10:15:50.674'),('cmvp3pm1u0006qpjc2ozst21a','cmv1z69rt000006jce4nncwja','admin',NULL,'System','trial_expired','subscription','cmv1z69ur000i06jc65umi12o','Trial of Growth expired',NULL,NULL,NULL,'2026-10-26 10:15:50.755'),('cmvp409n9001cqpjcdb8byf70','cmvp409ky000tqpjc1z8rolle','admin','cmuzhegh2001kqujc8kns9pdr','Platform Owner','create','company','cmvp409ky000tqpjc1z8rolle','Created tenant Pate and Best LLC',NULL,NULL,NULL,'2026-10-26 10:24:07.893');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_sessions`
--

DROP TABLE IF EXISTS `auth_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subjectType` enum('user','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subjectId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userAgent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `impersonatorId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_sessions_tokenHash_key` (`tokenHash`),
  KEY `auth_sessions_subjectType_subjectId_idx` (`subjectType`,`subjectId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_sessions`
--

LOCK TABLES `auth_sessions` WRITE;
/*!40000 ALTER TABLE `auth_sessions` DISABLE KEYS */;
INSERT INTO `auth_sessions` VALUES ('cmuzhlu470000tejc5otc07ij','user','cmuzhegrg001tqujck6oadxgs','0bf9b6cb5663d83514d0608c5d9b7c2837d51abcff2aaa069826e574f5951a3b','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','::1','2026-11-07 12:02:48.623',NULL,'2026-10-08 12:02:48.631',NULL),('cmuzhq1b30001tejc7hdg5o4b','admin','cmuzhegh2001kqujc8kns9pdr','3160512bed893f0ba4618967dc98c9f258c745b157a3c27dcb1203dcc49a25c4','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','::1','2026-11-07 12:06:04.573',NULL,'2026-10-08 12:06:04.575',NULL),('cmv1yld3j000kqbjc5oh1esu9','user','cmv1yld1v0009qbjc7qguvwmt','7c10c827381665debe5e6cffccaed68993b81a14da7c8d8b3fe464974e4609fe','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','::1','2026-11-09 05:33:52.394','2026-10-10 05:48:09.485','2026-10-10 05:33:52.399',NULL),('cmv1z4jw70014qbjcs9rv9pmz','user','cmv1z4jux000tqbjcp3f7c9nf','f02cd0c87ae5730d5eb212c614008f5d8d0f523d8c8b948f84faf4688466958d','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','::1','2026-11-09 05:48:47.669',NULL,'2026-10-10 05:48:47.671',NULL),('cmv1z69vn000j06jcwivci3rp','user','cmv1z69u9000806jcveg5wzbx','c97790b1e37c846dcdf33d8bddcef62d5e2b8f68330bcb5f68d2208002e033b2','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36','::1','2026-11-09 05:50:08.001',NULL,'2026-10-10 05:50:08.003',NULL),('cmvp3uhzv0008qpjcrjvr4cvv','admin','cmuzhegh2001kqujc8kns9pdr','7ef5b0e3e19c43e2724beb7cc7c397188395b22aefb15bdd6c985ce5624b18bd','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','::1','2026-11-25 10:19:38.776',NULL,'2026-10-26 10:19:38.779',NULL),('cmvp3yb2u000sqpjcj1jeq7di','user','cmvp3yb0o000hqpjcm8deqvs2','efa0366f0ce62e4b5219692e44e425e481f002cbcb1c361811dc197c7fdf26bd','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','::1','2026-11-25 10:22:36.435',NULL,'2026-10-26 10:22:36.438',NULL);
/*!40000 ALTER TABLE `auth_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `billing_invoices`
--

DROP TABLE IF EXISTS `billing_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `billing_invoices` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscriptionId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency` enum('BDT','USD','RMB') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BDT',
  `status` enum('unpaid','paid','failed','void') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `periodStart` datetime(3) DEFAULT NULL,
  `periodEnd` datetime(3) DEFAULT NULL,
  `issuedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dueAt` datetime(3) DEFAULT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `paymentReference` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `billingCycle` enum('monthly','yearly') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kind` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `planId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `billing_invoices_number_key` (`number`),
  KEY `billing_invoices_companyId_status_idx` (`companyId`,`status`),
  KEY `billing_invoices_subscriptionId_fkey` (`subscriptionId`),
  KEY `billing_invoices_planId_fkey` (`planId`),
  CONSTRAINT `billing_invoices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `billing_invoices_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `billing_invoices_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `billing_invoices`
--

LOCK TABLES `billing_invoices` WRITE;
/*!40000 ALTER TABLE `billing_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `billing_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isHeadOffice` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_companyId_code_key` (`companyId`,`code`),
  CONSTRAINT `branches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES ('cmuzhegpm001mqujce653mwjs','cmuzhegpi001lqujcip78ku7p','HO','Head Office',NULL,'+8801700000000',1,'active','2026-10-08 11:57:04.666','2026-10-08 11:57:04.666'),('cmuzhegs50024qujcudr46s8i','cmuzhegpi001lqujcip78ku7p','CTG','Chattogram Showroom','Agrabad C/A, Chattogram',NULL,0,'active','2026-10-08 11:57:04.757','2026-10-08 11:57:04.757'),('cmuzhegs50025qujcaz180870','cmuzhegpi001lqujcip78ku7p','WH1','Tejgaon Warehouse','Tejgaon I/A, Dhaka',NULL,0,'active','2026-10-08 11:57:04.757','2026-10-08 11:57:04.757'),('cmv1ylcyh0002qbjct9ql9q08','cmv1ylcy60001qbjck67f7a5f','HO','Head Office',NULL,'0987654323456',1,'active','2026-10-10 05:33:52.217','2026-10-10 05:33:52.217'),('cmv1z4jti000mqbjc46jdnqcv','cmv1z4jte000lqbjcyqafhjai','HO','Head Office',NULL,NULL,1,'active','2026-10-10 05:48:47.574','2026-10-10 05:48:47.574'),('cmv1z69rz000106jc5n6pab50','cmv1z69rt000006jce4nncwja','HO','Head Office',NULL,NULL,1,'active','2026-10-10 05:50:07.871','2026-10-10 05:50:07.871'),('cmvp3yay1000aqpjc02x4rq8u','cmvp3yaxx0009qpjc22r7m3wl','HO','Head Office',NULL,'12345678',1,'active','2026-10-26 10:22:36.265','2026-10-26 10:22:36.265'),('cmvp409l6000uqpjcacodd9ga','cmvp409ky000tqpjc1z8rolle','HO','Head Office',NULL,'+1 184326-1741',1,'active','2026-10-26 10:24:07.818','2026-10-26 10:24:07.818');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_closings`
--

DROP TABLE IF EXISTS `cash_closings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_closings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `openingCash` decimal(15,2) NOT NULL,
  `cashSales` decimal(15,2) NOT NULL,
  `cashReceipts` decimal(15,2) NOT NULL,
  `cashExpenses` decimal(15,2) NOT NULL,
  `cashPayouts` decimal(15,2) NOT NULL,
  `expectedClosing` decimal(15,2) NOT NULL,
  `countedCash` decimal(15,2) NOT NULL,
  `difference` decimal(15,2) NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `closedById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `cash_closings_branchId_date_key` (`branchId`,`date`),
  KEY `cash_closings_companyId_date_idx` (`companyId`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_closings`
--

LOCK TABLES `cash_closings` WRITE;
/*!40000 ALTER TABLE `cash_closings` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_closings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_companyId_name_key` (`companyId`,`name`),
  KEY `categories_parentId_fkey` (`parentId`),
  CONSTRAINT `categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `challans`
--

DROP TABLE IF EXISTS `challans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `challans` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deliveryAddress` text COLLATE utf8mb4_unicode_ci,
  `deliveryPerson` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deliveryPhone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicleNo` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deliveryDate` datetime(3) DEFAULT NULL,
  `status` enum('pending','delivered') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `deliveredAt` datetime(3) DEFAULT NULL,
  `showPrices` tinyint(1) NOT NULL DEFAULT '0',
  `printCount` int NOT NULL DEFAULT '0',
  `lastPrintedAt` datetime(3) DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `challans_companyId_number_key` (`companyId`,`number`),
  KEY `challans_invoiceId_fkey` (`invoiceId`),
  CONSTRAINT `challans_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `challans`
--

LOCK TABLES `challans` WRITE;
/*!40000 ALTER TABLE `challans` DISABLE KEYS */;
/*!40000 ALTER TABLE `challans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `businessType` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `logoUrl` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currency` enum('BDT','USD','RMB') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BDT',
  `timezone` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Dhaka',
  `tradeLicense` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `binNumber` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoiceFooter` text COLLATE utf8mb4_unicode_ci,
  `status` enum('trial','active','suspended','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'trial',
  `settings` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `companies_slug_key` (`slug`),
  KEY `companies_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES ('cmuzhegpi001lqujcip78ku7p','GK Interior','gk-interior','Aluminium, glass & home decor importer','owner@gkinterior.test','+8801700000000','Nawabpur Road, Dhaka 1100',NULL,'BDT','Asia/Dhaka',NULL,NULL,NULL,'active',NULL,'2026-10-08 11:57:04.662','2026-10-08 11:57:04.753'),('cmv1ylcy60001qbjck67f7a5f','Humaun International','humaun-international',NULL,'humaunkabi85@gmail.com','0987654323456',NULL,NULL,'BDT','Asia/Dhaka',NULL,NULL,NULL,'trial',NULL,'2026-10-10 05:33:52.206','2026-10-10 05:33:52.206'),('cmv1z4jte000lqbjcyqafhjai','XYZ Corp','xyz-corp',NULL,'xyz@gmaill.com',NULL,NULL,NULL,'BDT','Asia/Dhaka',NULL,NULL,NULL,'trial',NULL,'2026-10-10 05:48:47.571','2026-10-10 05:48:47.571'),('cmv1z69rt000006jce4nncwja','XYZ Corp','xyz-corp-2',NULL,'xyz@gmail.com',NULL,NULL,NULL,'BDT','Asia/Dhaka',NULL,NULL,NULL,'trial',NULL,'2026-10-10 05:50:07.865','2026-10-10 05:50:07.865'),('cmvp3yaxx0009qpjc22r7m3wl','test@gmail.com','test-gmail-com',NULL,'test@gmail.com','12345678',NULL,NULL,'BDT','Asia/Dhaka',NULL,NULL,NULL,'trial',NULL,'2026-10-26 10:22:36.261','2026-10-26 10:22:36.261'),('cmvp409ky000tqpjc1z8rolle','Pate and Best LLC','pate-and-best-llc',NULL,'xiwol@mailinator.com','+1 184326-1741',NULL,NULL,'BDT','Asia/Dhaka',NULL,NULL,NULL,'trial',NULL,'2026-10-26 10:24:07.810','2026-10-26 10:24:07.810');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_messages`
--

DROP TABLE IF EXISTS `contact_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_messages` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `handled` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_messages`
--

LOCK TABLES `contact_messages` WRITE;
/*!40000 ALTER TABLE `contact_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `credit_notes`
--

DROP TABLE IF EXISTS `credit_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_notes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `returnId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime(3) NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `credit_notes_companyId_number_key` (`companyId`,`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `credit_notes`
--

LOCK TABLES `credit_notes` WRITE;
/*!40000 ALTER TABLE `credit_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `credit_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_ledger_entries`
--

DROP TABLE IF EXISTS `customer_ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_ledger_entries` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('opening','invoice','payment','return','credit_note','refund','adjustment','purchase') COLLATE utf8mb4_unicode_ci NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balanceAfter` decimal(15,2) NOT NULL,
  `refType` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refId` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime(3) NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `customer_ledger_entries_companyId_customerId_date_idx` (`companyId`,`customerId`,`date`),
  KEY `customer_ledger_entries_customerId_fkey` (`customerId`),
  CONSTRAINT `customer_ledger_entries_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_ledger_entries`
--

LOCK TABLES `customer_ledger_entries` WRITE;
/*!40000 ALTER TABLE `customer_ledger_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `type` enum('retail','wholesale','dealer') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'retail',
  `creditLimit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `openingBalance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_companyId_code_key` (`companyId`,`code`),
  KEY `customers_companyId_name_idx` (`companyId`,`name`),
  KEY `customers_companyId_phone_idx` (`companyId`,`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_verifications`
--

DROP TABLE IF EXISTS `email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyName` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ownerName` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otpHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `expiresAt` datetime(3) NOT NULL,
  `verifiedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `email_verifications_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_verifications`
--

LOCK TABLES `email_verifications` WRITE;
/*!40000 ALTER TABLE `email_verifications` DISABLE KEYS */;
INSERT INTO `email_verifications` VALUES ('cmv1yevqc0000qbjcgfm9ze49','humaunkabi85@gmail.com','Humaun International','Humaun Kabir','0987654323456','$2b$12$yyLuxt0snobYbvnzcCbmOu.DNyq074PSAXGKSRFuPlTzyYwi4xLBq','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',1,'2026-10-10 05:38:49.942','2026-10-10 05:33:52.173','2026-10-10 05:28:49.956');
/*!40000 ALTER TABLE `email_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expense_categories`
--

DROP TABLE IF EXISTS `expense_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_categories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  `lcCostType` enum('lc_opening','freight','port','cnf','transport','unloading','delivery','staff_salary','entertainment','customs_duty','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `expense_categories_companyId_name_key` (`companyId`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expense_categories`
--

LOCK TABLES `expense_categories` WRITE;
/*!40000 ALTER TABLE `expense_categories` DISABLE KEYS */;
INSERT INTO `expense_categories` VALUES ('cmuzhegrk001uqujc7d6aln5d','cmuzhegpi001lqujcip78ku7p','Office Rent',1,NULL,'active','2026-10-08 11:57:04.737'),('cmuzhegrl001vqujc3yaew0d6','cmuzhegpi001lqujcip78ku7p','Warehouse Rent',1,NULL,'active','2026-10-08 11:57:04.737'),('cmuzhegrl001wqujckvqjj8ox','cmuzhegpi001lqujcip78ku7p','Staff Salary',1,'staff_salary','active','2026-10-08 11:57:04.737'),('cmuzhegrl001xqujcd1mso4fo','cmuzhegpi001lqujcip78ku7p','Entertainment',1,'entertainment','active','2026-10-08 11:57:04.737'),('cmuzhegrl001yqujc6iio1vkj','cmuzhegpi001lqujcip78ku7p','Utility Bills',1,NULL,'active','2026-10-08 11:57:04.737'),('cmuzhegrl001zqujct3ima1rk','cmuzhegpi001lqujcip78ku7p','Delivery Charge',1,'delivery','active','2026-10-08 11:57:04.737'),('cmuzhegrl0020qujcpiu97c2n','cmuzhegpi001lqujcip78ku7p','Transport',1,'transport','active','2026-10-08 11:57:04.737'),('cmuzhegrl0021qujcy4x0bix0','cmuzhegpi001lqujcip78ku7p','Customs Duty',1,'customs_duty','active','2026-10-08 11:57:04.737'),('cmuzhegrl0022qujc6czvfevk','cmuzhegpi001lqujcip78ku7p','Other',1,'other','active','2026-10-08 11:57:04.737'),('cmv1yld27000aqbjcsqrfnxv1','cmv1ylcy60001qbjck67f7a5f','Office Rent',1,NULL,'active','2026-10-10 05:33:52.351'),('cmv1yld27000bqbjcqlhkmqqu','cmv1ylcy60001qbjck67f7a5f','Warehouse Rent',1,NULL,'active','2026-10-10 05:33:52.351'),('cmv1yld27000cqbjcp5etq01m','cmv1ylcy60001qbjck67f7a5f','Staff Salary',1,'staff_salary','active','2026-10-10 05:33:52.351'),('cmv1yld27000dqbjcaby3by4o','cmv1ylcy60001qbjck67f7a5f','Entertainment',1,'entertainment','active','2026-10-10 05:33:52.351'),('cmv1yld27000eqbjc73bonjfy','cmv1ylcy60001qbjck67f7a5f','Utility Bills',1,NULL,'active','2026-10-10 05:33:52.351'),('cmv1yld27000fqbjcmxtnof8v','cmv1ylcy60001qbjck67f7a5f','Delivery Charge',1,'delivery','active','2026-10-10 05:33:52.351'),('cmv1yld27000gqbjcieutuhqj','cmv1ylcy60001qbjck67f7a5f','Transport',1,'transport','active','2026-10-10 05:33:52.351'),('cmv1yld27000hqbjc778j4cfx','cmv1ylcy60001qbjck67f7a5f','Customs Duty',1,'customs_duty','active','2026-10-10 05:33:52.351'),('cmv1yld27000iqbjcdkw5t9kt','cmv1ylcy60001qbjck67f7a5f','Other',1,'other','active','2026-10-10 05:33:52.351'),('cmv1z4jv2000uqbjcacpk6cyp','cmv1z4jte000lqbjcyqafhjai','Office Rent',1,NULL,'active','2026-10-10 05:48:47.630'),('cmv1z4jv2000vqbjc0z6jmumx','cmv1z4jte000lqbjcyqafhjai','Warehouse Rent',1,NULL,'active','2026-10-10 05:48:47.630'),('cmv1z4jv2000wqbjcznvuxhgs','cmv1z4jte000lqbjcyqafhjai','Staff Salary',1,'staff_salary','active','2026-10-10 05:48:47.630'),('cmv1z4jv2000xqbjc2ozfi7fv','cmv1z4jte000lqbjcyqafhjai','Entertainment',1,'entertainment','active','2026-10-10 05:48:47.630'),('cmv1z4jv2000yqbjc15lqq9iv','cmv1z4jte000lqbjcyqafhjai','Utility Bills',1,NULL,'active','2026-10-10 05:48:47.630'),('cmv1z4jv2000zqbjcwq8seczj','cmv1z4jte000lqbjcyqafhjai','Delivery Charge',1,'delivery','active','2026-10-10 05:48:47.630'),('cmv1z4jv20010qbjcxwwpric2','cmv1z4jte000lqbjcyqafhjai','Transport',1,'transport','active','2026-10-10 05:48:47.630'),('cmv1z4jv20011qbjcpeetlzkp','cmv1z4jte000lqbjcyqafhjai','Customs Duty',1,'customs_duty','active','2026-10-10 05:48:47.630'),('cmv1z4jv20012qbjcs5exb5th','cmv1z4jte000lqbjcyqafhjai','Other',1,'other','active','2026-10-10 05:48:47.630'),('cmv1z69ug000906jcez3bbqtu','cmv1z69rt000006jce4nncwja','Office Rent',1,NULL,'active','2026-10-10 05:50:07.960'),('cmv1z69ug000a06jcoeqk5fkg','cmv1z69rt000006jce4nncwja','Warehouse Rent',1,NULL,'active','2026-10-10 05:50:07.960'),('cmv1z69ug000b06jcui4oq321','cmv1z69rt000006jce4nncwja','Staff Salary',1,'staff_salary','active','2026-10-10 05:50:07.960'),('cmv1z69ug000c06jc1l918kw1','cmv1z69rt000006jce4nncwja','Entertainment',1,'entertainment','active','2026-10-10 05:50:07.960'),('cmv1z69ug000d06jchknf3h1h','cmv1z69rt000006jce4nncwja','Utility Bills',1,NULL,'active','2026-10-10 05:50:07.960'),('cmv1z69ug000e06jc32o7vskp','cmv1z69rt000006jce4nncwja','Delivery Charge',1,'delivery','active','2026-10-10 05:50:07.960'),('cmv1z69ug000f06jc6v3qxv5y','cmv1z69rt000006jce4nncwja','Transport',1,'transport','active','2026-10-10 05:50:07.960'),('cmv1z69ug000g06jc0nrtg850','cmv1z69rt000006jce4nncwja','Customs Duty',1,'customs_duty','active','2026-10-10 05:50:07.960'),('cmv1z69ug000h06jc0ly8ulth','cmv1z69rt000006jce4nncwja','Other',1,'other','active','2026-10-10 05:50:07.960'),('cmvp3yb0y000iqpjctc0wg6l1','cmvp3yaxx0009qpjc22r7m3wl','Office Rent',1,NULL,'active','2026-10-26 10:22:36.370'),('cmvp3yb0y000jqpjcjrix25cy','cmvp3yaxx0009qpjc22r7m3wl','Warehouse Rent',1,NULL,'active','2026-10-26 10:22:36.370'),('cmvp3yb0y000kqpjc8ep5ydyn','cmvp3yaxx0009qpjc22r7m3wl','Staff Salary',1,'staff_salary','active','2026-10-26 10:22:36.370'),('cmvp3yb0y000lqpjc0rxd3v7y','cmvp3yaxx0009qpjc22r7m3wl','Entertainment',1,'entertainment','active','2026-10-26 10:22:36.370'),('cmvp3yb0y000mqpjcxwglb7jq','cmvp3yaxx0009qpjc22r7m3wl','Utility Bills',1,NULL,'active','2026-10-26 10:22:36.370'),('cmvp3yb0y000nqpjcj5cubq0v','cmvp3yaxx0009qpjc22r7m3wl','Delivery Charge',1,'delivery','active','2026-10-26 10:22:36.370'),('cmvp3yb0y000oqpjcnbo8j4vc','cmvp3yaxx0009qpjc22r7m3wl','Transport',1,'transport','active','2026-10-26 10:22:36.370'),('cmvp3yb0y000pqpjcelkicgeg','cmvp3yaxx0009qpjc22r7m3wl','Customs Duty',1,'customs_duty','active','2026-10-26 10:22:36.370'),('cmvp3yb0y000qqpjc1fa0g95u','cmvp3yaxx0009qpjc22r7m3wl','Other',1,'other','active','2026-10-26 10:22:36.370'),('cmvp409mr0012qpjc7r78ga1y','cmvp409ky000tqpjc1z8rolle','Office Rent',1,NULL,'active','2026-10-26 10:24:07.875'),('cmvp409mr0013qpjcpz9j1a1f','cmvp409ky000tqpjc1z8rolle','Warehouse Rent',1,NULL,'active','2026-10-26 10:24:07.875'),('cmvp409mr0014qpjcvkadhez9','cmvp409ky000tqpjc1z8rolle','Staff Salary',1,'staff_salary','active','2026-10-26 10:24:07.875'),('cmvp409mr0015qpjc5hzcd7wc','cmvp409ky000tqpjc1z8rolle','Entertainment',1,'entertainment','active','2026-10-26 10:24:07.875'),('cmvp409mr0016qpjcxaog81jz','cmvp409ky000tqpjc1z8rolle','Utility Bills',1,NULL,'active','2026-10-26 10:24:07.875'),('cmvp409mr0017qpjc8fpmgtxa','cmvp409ky000tqpjc1z8rolle','Delivery Charge',1,'delivery','active','2026-10-26 10:24:07.875'),('cmvp409mr0018qpjcod54vcao','cmvp409ky000tqpjc1z8rolle','Transport',1,'transport','active','2026-10-26 10:24:07.875'),('cmvp409mr0019qpjcw1tui4qb','cmvp409ky000tqpjc1z8rolle','Customs Duty',1,'customs_duty','active','2026-10-26 10:24:07.875'),('cmvp409mr001aqpjcszabz8jz','cmvp409ky000tqpjc1z8rolle','Other',1,'other','active','2026-10-26 10:24:07.875');
/*!40000 ALTER TABLE `expense_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` enum('cash','bank','mobile_banking','card','cheque') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allocateToLc` tinyint(1) NOT NULL DEFAULT '0',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` date NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expenses_companyId_number_key` (`companyId`,`number`),
  KEY `expenses_companyId_branchId_date_idx` (`companyId`,`branchId`,`date`),
  KEY `expenses_lcId_idx` (`lcId`),
  KEY `expenses_categoryId_fkey` (`categoryId`),
  CONSTRAINT `expenses_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `expense_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipt_lines`
--

DROP TABLE IF EXISTS `goods_receipt_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipt_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiptId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `poLineId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lcLineId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `goods_receipt_lines_receiptId_fkey` (`receiptId`),
  CONSTRAINT `goods_receipt_lines_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipt_lines`
--

LOCK TABLES `goods_receipt_lines` WRITE;
/*!40000 ALTER TABLE `goods_receipt_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `goods_receipt_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipts`
--

DROP TABLE IF EXISTS `goods_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `poId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `goods_receipts_companyId_number_key` (`companyId`,`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipts`
--

LOCK TABLES `goods_receipts` WRITE;
/*!40000 ALTER TABLE `goods_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `goods_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `idempotency_keys`
--

DROP TABLE IF EXISTS `idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `idempotency_keys` (
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `response` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idempotency_keys`
--

LOCK TABLES `idempotency_keys` WRITE;
/*!40000 ALTER TABLE `idempotency_keys` DISABLE KEYS */;
/*!40000 ALTER TABLE `idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_batches`
--

DROP TABLE IF EXISTS `inventory_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_batches` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('lc','purchase','opening','transfer','return','adjustment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `poId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receiptLineId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batchNo` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qtyReceived` decimal(15,3) NOT NULL,
  `qtyAvailable` decimal(15,3) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL,
  `receivedAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `inventory_batches_companyId_branchId_variationId_receivedAt_idx` (`companyId`,`branchId`,`variationId`,`receivedAt`),
  KEY `inventory_batches_lcId_idx` (`lcId`),
  KEY `inventory_batches_variationId_fkey` (`variationId`),
  CONSTRAINT `inventory_batches_variationId_fkey` FOREIGN KEY (`variationId`) REFERENCES `product_variations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_batches`
--

LOCK TABLES `inventory_batches` WRITE;
/*!40000 ALTER TABLE `inventory_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_line_batches`
--

DROP TABLE IF EXISTS `invoice_line_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_line_batches` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceLineId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `invoice_line_batches_invoiceLineId_fkey` (`invoiceLineId`),
  CONSTRAINT `invoice_line_batches_invoiceLineId_fkey` FOREIGN KEY (`invoiceLineId`) REFERENCES `invoice_lines` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_line_batches`
--

LOCK TABLES `invoice_line_batches` WRITE;
/*!40000 ALTER TABLE `invoice_line_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_line_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_lines`
--

DROP TABLE IF EXISTS `invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `discount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `lineTotal` decimal(15,2) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `returnedQty` decimal(15,3) NOT NULL DEFAULT '0.000',
  PRIMARY KEY (`id`),
  KEY `invoice_lines_invoiceId_idx` (`invoiceId`),
  KEY `invoice_lines_variationId_idx` (`variationId`),
  CONSTRAINT `invoice_lines_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_lines`
--

LOCK TABLES `invoice_lines` WRITE;
/*!40000 ALTER TABLE `invoice_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('cash','credit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','confirmed','partially_returned','returned','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'confirmed',
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerName` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerPhone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salesmanId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salesOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoiceDate` datetime(3) NOT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `discount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(15,2) NOT NULL DEFAULT '0.00',
  `deliveryCharge` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total` decimal(15,2) NOT NULL,
  `paidAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `dueAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `returnedAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `costTotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `paymentMethod` enum('cash','bank','mobile_banking','card','cheque') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `printCount` int NOT NULL DEFAULT '0',
  `lastPrintedAt` datetime(3) DEFAULT NULL,
  `creditOverrideById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelledAt` datetime(3) DEFAULT NULL,
  `cancelledById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelReason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_companyId_number_key` (`companyId`,`number`),
  KEY `invoices_companyId_branchId_invoiceDate_idx` (`companyId`,`branchId`,`invoiceDate`),
  KEY `invoices_companyId_customerId_idx` (`companyId`,`customerId`),
  KEY `invoices_companyId_salesmanId_invoiceDate_idx` (`companyId`,`salesmanId`,`invoiceDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `landed_cost_lines`
--

DROP TABLE IF EXISTS `landed_cost_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `landed_cost_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshotId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcLineId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitWeight` decimal(12,4) NOT NULL,
  `ratio` decimal(18,10) NOT NULL,
  `baseUnitCost` decimal(15,4) NOT NULL,
  `extraCostTotal` decimal(15,2) NOT NULL,
  `extraUnitCost` decimal(15,4) NOT NULL,
  `landedUnitCost` decimal(15,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `landed_cost_lines_snapshotId_idx` (`snapshotId`),
  CONSTRAINT `landed_cost_lines_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `landed_cost_snapshots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `landed_cost_lines`
--

LOCK TABLES `landed_cost_lines` WRITE;
/*!40000 ALTER TABLE `landed_cost_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `landed_cost_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `landed_cost_snapshots`
--

DROP TABLE IF EXISTS `landed_cost_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `landed_cost_snapshots` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int NOT NULL,
  `basis` enum('weight','quantity') COLLATE utf8mb4_unicode_ci NOT NULL,
  `exchangeRate` decimal(15,6) NOT NULL,
  `totalBaseCost` decimal(15,2) NOT NULL,
  `totalExtraCost` decimal(15,2) NOT NULL,
  `costItems` json NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isCurrent` tinyint(1) NOT NULL DEFAULT '1',
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `landed_cost_snapshots_lcId_version_key` (`lcId`,`version`),
  CONSTRAINT `landed_cost_snapshots_lcId_fkey` FOREIGN KEY (`lcId`) REFERENCES `lcs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `landed_cost_snapshots`
--

LOCK TABLES `landed_cost_snapshots` WRITE;
/*!40000 ALTER TABLE `landed_cost_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `landed_cost_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lc_cost_items`
--

DROP TABLE IF EXISTS `lc_cost_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lc_cost_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costType` enum('lc_opening','freight','port','cnf','transport','unloading','delivery','staff_salary','entertainment','customs_duty','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entryDate` date NOT NULL,
  `sourceType` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `sourceId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `lc_cost_items_lcId_idx` (`lcId`),
  CONSTRAINT `lc_cost_items_lcId_fkey` FOREIGN KEY (`lcId`) REFERENCES `lcs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lc_cost_items`
--

LOCK TABLES `lc_cost_items` WRITE;
/*!40000 ALTER TABLE `lc_cost_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `lc_cost_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lc_product_lines`
--

DROP TABLE IF EXISTS `lc_product_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lc_product_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitWeight` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `unitPriceForeign` decimal(15,4) NOT NULL,
  `lineValueForeign` decimal(15,4) NOT NULL,
  `receivedQty` decimal(15,3) NOT NULL DEFAULT '0.000',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `lc_product_lines_lcId_idx` (`lcId`),
  CONSTRAINT `lc_product_lines_lcId_fkey` FOREIGN KEY (`lcId`) REFERENCES `lcs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lc_product_lines`
--

LOCK TABLES `lc_product_lines` WRITE;
/*!40000 ALTER TABLE `lc_product_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `lc_product_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lcs`
--

DROP TABLE IF EXISTS `lcs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lcs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplierId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcNumber` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issuingBank` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currency` enum('BDT','USD','RMB') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RMB',
  `lcValue` decimal(15,4) NOT NULL,
  `exchangeRate` decimal(15,6) NOT NULL DEFAULT '0.000000',
  `distributionBasis` enum('weight','quantity') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'weight',
  `status` enum('draft','opened','goods_in_transit','received','cost_finalized','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `openedDate` date DEFAULT NULL,
  `expectedArrivalDate` date DEFAULT NULL,
  `actualArrivalDate` date DEFAULT NULL,
  `finalizedAt` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lcs_companyId_lcNumber_key` (`companyId`,`lcNumber`),
  KEY `lcs_companyId_status_idx` (`companyId`,`status`),
  KEY `lcs_supplierId_fkey` (`supplierId`),
  CONSTRAINT `lcs_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lcs`
--

LOCK TABLES `lcs` WRITE;
/*!40000 ALTER TABLE `lcs` DISABLE KEYS */;
/*!40000 ALTER TABLE `lcs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `money_receipts`
--

DROP TABLE IF EXISTS `money_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `money_receipts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoiceId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` enum('cash','bank','mobile_banking','card','cheque') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime(3) NOT NULL,
  `isAdvance` tinyint(1) NOT NULL DEFAULT '0',
  `cancelledAt` datetime(3) DEFAULT NULL,
  `printCount` int NOT NULL DEFAULT '0',
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `salesOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `money_receipts_companyId_number_key` (`companyId`,`number`),
  KEY `money_receipts_companyId_branchId_date_idx` (`companyId`,`branchId`,`date`),
  KEY `money_receipts_companyId_customerId_idx` (`companyId`,`customerId`),
  KEY `money_receipts_salesOrderId_idx` (`salesOrderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `money_receipts`
--

LOCK TABLES `money_receipts` WRITE;
/*!40000 ALTER TABLE `money_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `money_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `readAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_companyId_userId_readAt_idx` (`companyId`,`userId`,`readAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('cmvp3plvy0001qpjcq91n0khx','cmuzhegpi001lqujcip78ku7p','cmuzhegrg001tqujck6oadxgs','billing.trial_expired','Your free trial has ended','Your workspace is now read-only. All your data is kept.\nChoose a plan to restore full access.','/app/settings/billing',NULL,'2026-10-26 10:15:50.542'),('cmvp3plyl0003qpjckmiufy5g','cmv1ylcy60001qbjck67f7a5f','cmv1yld1v0009qbjc7qguvwmt','billing.trial_expired','Your free trial has ended','Your workspace is now read-only. All your data is kept.\nChoose a plan to restore full access.','/app/settings/billing',NULL,'2026-10-26 10:15:50.637'),('cmvp3pm080005qpjcx5hlyqsi','cmv1z4jte000lqbjcyqafhjai','cmv1z4jux000tqbjcp3f7c9nf','billing.trial_expired','Your free trial has ended','Your workspace is now read-only. All your data is kept.\nChoose a plan to restore full access.','/app/settings/billing',NULL,'2026-10-26 10:15:50.696'),('cmvp3pm2t0007qpjckoep8iq3','cmv1z69rt000006jce4nncwja','cmv1z69u9000806jcveg5wzbx','billing.trial_expired','Your free trial has ended','Your workspace is now read-only. All your data is kept.\nChoose a plan to restore full access.','/app/settings/billing',NULL,'2026-10-26 10:15:50.789');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subjectType` enum('user','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subjectId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_tokens_tokenHash_key` (`tokenHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES ('cmuzheg830003qujcxoge4020','dashboard.view','dashboard','view','View dashboard'),('cmuzheg830004qujca5oey7jx','lc.view','lc','view','View LCs'),('cmuzheg830005qujcv71o4fsv','lc.create','lc','create','Create LCs'),('cmuzheg830006qujcwv79s0zb','lc.update','lc','update','Edit LCs & cost items'),('cmuzheg830007qujclffsmc64','lc.delete','lc','delete','Delete LCs'),('cmuzheg830008qujcvcc6xen2','lc.finalize','lc','finalize','Finalize landed cost'),('cmuzheg830009qujcqaumbrag','purchase.view','purchase','view','View purchase orders'),('cmuzheg83000aqujct0whn4nc','purchase.create','purchase','create','Create purchase orders'),('cmuzheg83000bqujcyz95fhp8','purchase.update','purchase','update','Edit / cancel purchase orders'),('cmuzheg83000cqujcl4iq9z0e','purchase.receive','purchase','receive','Receive goods'),('cmuzheg83000dqujcf2fliqkl','inventory.view','inventory','view','View products & stock'),('cmuzheg83000equjczcxi3z5h','inventory.create','inventory','create','Create products'),('cmuzheg83000fqujcc0nea3ak','inventory.update','inventory','update','Edit products'),('cmuzheg83000gqujc5k4ygg9i','inventory.delete','inventory','delete','Delete products'),('cmuzheg83000hqujcvontc8ky','inventory.adjust','inventory','adjust','Stock adjustments'),('cmuzheg83000iqujcptlin5a9','inventory.transfer','inventory','transfer','Branch transfers'),('cmuzheg83000jqujcfosxayxi','inventory.view_cost','inventory','view_cost','See cost prices'),('cmuzheg83000kqujcfidtzez6','sales.view','sales','view','View invoices'),('cmuzheg83000lqujcpoy70yc2','sales.create','sales','create','Create invoices & quotations'),('cmuzheg83000mqujc5ijt1cfd','sales.cancel','sales','cancel','Cancel invoices / orders'),('cmuzheg83000nqujcma1gu47a','sales.receipt','sales','receipt','Record money receipts'),('cmuzheg83000oqujc831kdldk','sales.return','sales','return','Request returns'),('cmuzheg83000pqujcw666i70f','sales.return_approve','sales','return_approve','Approve returns'),('cmuzheg83000qqujcsx7qvlbf','sales.override_credit','sales','override_credit','Override credit limit'),('cmuzheg83000rqujcvkkl2iey','sales.discount','sales','discount','Give discounts'),('cmuzheg83000squjc418sd8r3','sales.view_all','sales','view_all','See all salesmen\'s sales'),('cmuzheg83000tqujcd4gbrdzc','delivery.view','delivery','view','View challans'),('cmuzheg83000uqujcr2i3x57d','delivery.manage','delivery','manage','Update challans & delivery charges'),('cmuzheg83000vqujcr7w7bhyn','customers.view','customers','view','View customers & ledger'),('cmuzheg83000wqujcik1v4sad','customers.create','customers','create','Create customers'),('cmuzheg83000xqujcx0b30gs4','customers.update','customers','update','Edit customers & credit limits'),('cmuzheg83000yqujclvtpgxfb','customers.delete','customers','delete','Delete customers'),('cmuzheg83000zqujcvt7uivmy','suppliers.view','suppliers','view','View suppliers & ledger'),('cmuzheg830010qujcsq65u4b6','suppliers.create','suppliers','create','Create suppliers'),('cmuzheg830011qujcf2c1va8b','suppliers.update','suppliers','update','Edit suppliers'),('cmuzheg830012qujce04sj3yf','suppliers.delete','suppliers','delete','Delete suppliers'),('cmuzheg830013qujchlfp8hr9','expenses.view','expenses','view','View expenses'),('cmuzheg830014qujcb4xpexlh','expenses.create','expenses','create','Record expenses'),('cmuzheg830015qujcuaduwtde','expenses.update','expenses','update','Edit expenses'),('cmuzheg830016qujcl6t6j4cl','expenses.delete','expenses','delete','Delete expenses'),('cmuzheg830017qujcnrmozdta','finance.view','finance','view','View P&L and payables'),('cmuzheg830018qujcskxycz03','finance.cash_closing','finance','cash_closing','Daily cash closing'),('cmuzheg830019qujcv91lwvdx','finance.supplier_payment','finance','supplier_payment','Record supplier payments'),('cmuzheg83001aqujcjptyv2v2','reports.sales','reports','sales','Sales reports'),('cmuzheg83001bqujc1okv9i0x','reports.stock','reports','stock','Stock reports'),('cmuzheg83001cqujclm8234yy','reports.financial','reports','financial','Financial reports'),('cmuzheg83001dqujc630xoigx','reports.export','reports','export','Export reports'),('cmuzheg83001equjcc5y04rq2','org.branches','org','branches','Manage branches'),('cmuzheg83001fqujca6xkepax','org.employees','org','employees','Manage employees'),('cmuzheg83001gqujcirtj14mo','org.roles','org','roles','Manage roles & permissions'),('cmuzheg83001hqujclcdw72hi','org.audit','org','audit','View audit log'),('cmuzheg83001iqujcuotmp3vi','settings.company','settings','company','Company profile'),('cmuzheg83001jqujcrdyghysq','settings.billing','settings','billing','Subscription & billing');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tagline` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priceMonthly` decimal(15,2) NOT NULL,
  `priceYearly` decimal(15,2) NOT NULL,
  `maxBranches` int NOT NULL,
  `maxEmployees` int NOT NULL,
  `maxProducts` int DEFAULT NULL,
  `features` json NOT NULL,
  `isPublic` tinyint(1) NOT NULL DEFAULT '1',
  `isDefaultTrial` tinyint(1) NOT NULL DEFAULT '0',
  `sortOrder` int NOT NULL DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plans_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plans`
--

LOCK TABLES `plans` WRITE;
/*!40000 ALTER TABLE `plans` DISABLE KEYS */;
INSERT INTO `plans` VALUES ('cmuzheg5x0000qujc4k4h949k','starter','Starter','For a single shop getting off spreadsheets.',1500.00,15000.00,1,5,2000,'{\"lc\": false, \"crm\": true, \"export\": true, \"purchase\": true, \"advancedReports\": false, \"prioritySupport\": false, \"multiBranchTransfer\": false}',1,0,1,'active','2026-10-08 11:57:03.957','2026-10-08 11:57:03.957'),('cmuzheg6k0001qujcsza37zya','growth','Growth','Importers running LCs across a few branches.',3500.00,35000.00,3,20,20000,'{\"lc\": true, \"crm\": true, \"export\": true, \"purchase\": true, \"advancedReports\": true, \"prioritySupport\": false, \"multiBranchTransfer\": true}',1,1,2,'active','2026-10-08 11:57:03.980','2026-10-08 11:57:03.980'),('cmuzheg770002qujc4ay586qv','enterprise','Enterprise','Multi-branch distributors with large teams.',8000.00,80000.00,25,200,NULL,'{\"lc\": true, \"crm\": true, \"export\": true, \"purchase\": true, \"advancedReports\": true, \"prioritySupport\": true, \"multiBranchTransfer\": true}',1,0,3,'active','2026-10-08 11:57:04.003','2026-10-08 11:57:04.003');
/*!40000 ALTER TABLE `plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_admins`
--

DROP TABLE IF EXISTS `platform_admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_admins` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isOwner` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `failedLogins` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime(3) DEFAULT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_admins_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_admins`
--

LOCK TABLES `platform_admins` WRITE;
/*!40000 ALTER TABLE `platform_admins` DISABLE KEYS */;
INSERT INTO `platform_admins` VALUES ('cmuzhegh2001kqujc8kns9pdr','Platform Owner','admin@example.com','$2b$12$ZcBj/TKvrX9kk7ECq0yT7OfknniMPcY1BxeBhpLi2N4EehIVkjueS',1,'active',0,NULL,'2026-10-26 10:19:38.754','2026-10-08 11:57:04.358','2026-10-26 10:19:38.761');
/*!40000 ALTER TABLE `platform_admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_settings`
--

DROP TABLE IF EXISTS `platform_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_settings` (
  `key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` json NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_settings`
--

LOCK TABLES `platform_settings` WRITE;
/*!40000 ALTER TABLE `platform_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `platform_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `print_logs`
--

DROP TABLE IF EXISTS `print_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `print_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `docType` enum('invoice','challan','receipt','return') COLLATE utf8mb4_unicode_ci NOT NULL,
  `docId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `print_logs_companyId_docType_docId_idx` (`companyId`,`docType`,`docId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `print_logs`
--

LOCK TABLES `print_logs` WRITE;
/*!40000 ALTER TABLE `print_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `print_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variations`
--

DROP TABLE IF EXISTS `product_variations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `barcode` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unitWeight` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `salePrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `wholesalePrice` decimal(15,2) DEFAULT NULL,
  `reorderLevel` decimal(15,3) NOT NULL DEFAULT '0.000',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_variations_companyId_sku_key` (`companyId`,`sku`),
  KEY `product_variations_companyId_barcode_idx` (`companyId`,`barcode`),
  KEY `product_variations_productId_fkey` (`productId`),
  CONSTRAINT `product_variations_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variations`
--

LOCK TABLES `product_variations` WRITE;
/*!40000 ALTER TABLE `product_variations` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_variations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pcs',
  `imageUrl` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `products_companyId_name_idx` (`companyId`,`name`),
  KEY `products_categoryId_fkey` (`categoryId`),
  CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order_lines`
--

DROP TABLE IF EXISTS `purchase_order_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `poId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcLineId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `receivedQty` decimal(15,3) NOT NULL DEFAULT '0.000',
  `cancelledQty` decimal(15,3) NOT NULL DEFAULT '0.000',
  `unitPriceForeign` decimal(15,4) DEFAULT NULL,
  `unitPriceBdt` decimal(15,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `purchase_order_lines_poId_idx` (`poId`),
  CONSTRAINT `purchase_order_lines_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_lines`
--

LOCK TABLES `purchase_order_lines` WRITE;
/*!40000 ALTER TABLE `purchase_order_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_order_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplierId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderDate` date NOT NULL,
  `expectedDate` date DEFAULT NULL,
  `currency` enum('BDT','USD','RMB') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BDT',
  `exchangeRate` decimal(15,6) NOT NULL DEFAULT '1.000000',
  `totalForeign` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `totalBdt` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','partially_received','received','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_orders_companyId_number_key` (`companyId`,`number`),
  KEY `purchase_orders_companyId_status_idx` (`companyId`,`status`),
  KEY `purchase_orders_supplierId_fkey` (`supplierId`),
  CONSTRAINT `purchase_orders_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receipt_allocations`
--

DROP TABLE IF EXISTS `receipt_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receipt_allocations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiptId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `receipt_allocations_invoiceId_idx` (`invoiceId`),
  KEY `receipt_allocations_receiptId_fkey` (`receiptId`),
  CONSTRAINT `receipt_allocations_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `money_receipts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receipt_allocations`
--

LOCK TABLES `receipt_allocations` WRITE;
/*!40000 ALTER TABLE `receipt_allocations` DISABLE KEYS */;
/*!40000 ALTER TABLE `receipt_allocations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissionId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`roleId`,`permissionId`),
  KEY `role_permissions_permissionId_fkey` (`permissionId`),
  CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES ('cmuzhegq0001nqujcoqgpa12z','cmuzheg830003qujcxoge4020'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830003qujcxoge4020'),('cmuzhegqr001pqujckps9ijb2','cmuzheg830003qujcxoge4020'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg830003qujcxoge4020'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830003qujcxoge4020'),('cmuzhegrb001squjcjioxjp9f','cmuzheg830003qujcxoge4020'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830003qujcxoge4020'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830003qujcxoge4020'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg830003qujcxoge4020'),('cmv1yld0u0006qbjctcott3he','cmuzheg830003qujcxoge4020'),('cmv1yld140007qbjcusex3dxc','cmuzheg830003qujcxoge4020'),('cmv1yld1j0008qbjckcqkn7wx','cmuzheg830003qujcxoge4020'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830003qujcxoge4020'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830003qujcxoge4020'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg830003qujcxoge4020'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg830003qujcxoge4020'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830003qujcxoge4020'),('cmv1z4jus000sqbjcd6bszc8q','cmuzheg830003qujcxoge4020'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830003qujcxoge4020'),('cmv1z69sn000306jc52hkhneq','cmuzheg830003qujcxoge4020'),('cmv1z69t3000406jc18uhakrn','cmuzheg830003qujcxoge4020'),('cmv1z69ti000506jcgmljoviz','cmuzheg830003qujcxoge4020'),('cmv1z69tq000606jckl1n49uz','cmuzheg830003qujcxoge4020'),('cmv1z69u3000706jct3nzy44x','cmuzheg830003qujcxoge4020'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830003qujcxoge4020'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830003qujcxoge4020'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg830003qujcxoge4020'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg830003qujcxoge4020'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830003qujcxoge4020'),('cmvp3yb0j000gqpjcz8yr14s4','cmuzheg830003qujcxoge4020'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830003qujcxoge4020'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830003qujcxoge4020'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg830003qujcxoge4020'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg830003qujcxoge4020'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830003qujcxoge4020'),('cmvp409mh0010qpjc6jb308ca','cmuzheg830003qujcxoge4020'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830004qujca5oey7jx'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830004qujca5oey7jx'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg830004qujca5oey7jx'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830004qujca5oey7jx'),('cmuzhegrb001squjcjioxjp9f','cmuzheg830004qujca5oey7jx'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830004qujca5oey7jx'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830004qujca5oey7jx'),('cmv1yld0u0006qbjctcott3he','cmuzheg830004qujca5oey7jx'),('cmv1yld140007qbjcusex3dxc','cmuzheg830004qujca5oey7jx'),('cmv1yld1j0008qbjckcqkn7wx','cmuzheg830004qujca5oey7jx'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830004qujca5oey7jx'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830004qujca5oey7jx'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg830004qujca5oey7jx'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830004qujca5oey7jx'),('cmv1z4jus000sqbjcd6bszc8q','cmuzheg830004qujca5oey7jx'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830004qujca5oey7jx'),('cmv1z69sn000306jc52hkhneq','cmuzheg830004qujca5oey7jx'),('cmv1z69ti000506jcgmljoviz','cmuzheg830004qujca5oey7jx'),('cmv1z69tq000606jckl1n49uz','cmuzheg830004qujca5oey7jx'),('cmv1z69u3000706jct3nzy44x','cmuzheg830004qujca5oey7jx'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830004qujca5oey7jx'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830004qujca5oey7jx'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg830004qujca5oey7jx'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830004qujca5oey7jx'),('cmvp3yb0j000gqpjcz8yr14s4','cmuzheg830004qujca5oey7jx'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830004qujca5oey7jx'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830004qujca5oey7jx'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg830004qujca5oey7jx'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830004qujca5oey7jx'),('cmvp409mh0010qpjc6jb308ca','cmuzheg830004qujca5oey7jx'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830005qujcv71o4fsv'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830005qujcv71o4fsv'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830005qujcv71o4fsv'),('cmv1yld140007qbjcusex3dxc','cmuzheg830005qujcv71o4fsv'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830005qujcv71o4fsv'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830005qujcv71o4fsv'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830005qujcv71o4fsv'),('cmv1z69tq000606jckl1n49uz','cmuzheg830005qujcv71o4fsv'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830005qujcv71o4fsv'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830005qujcv71o4fsv'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830005qujcv71o4fsv'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830005qujcv71o4fsv'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830006qujcwv79s0zb'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830006qujcwv79s0zb'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830006qujcwv79s0zb'),('cmv1yld140007qbjcusex3dxc','cmuzheg830006qujcwv79s0zb'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830006qujcwv79s0zb'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830006qujcwv79s0zb'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830006qujcwv79s0zb'),('cmv1z69tq000606jckl1n49uz','cmuzheg830006qujcwv79s0zb'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830006qujcwv79s0zb'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830006qujcwv79s0zb'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830006qujcwv79s0zb'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830006qujcwv79s0zb'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830007qujclffsmc64'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830007qujclffsmc64'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830007qujclffsmc64'),('cmv1yld140007qbjcusex3dxc','cmuzheg830007qujclffsmc64'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830007qujclffsmc64'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830007qujclffsmc64'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830007qujclffsmc64'),('cmv1z69tq000606jckl1n49uz','cmuzheg830007qujclffsmc64'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830007qujclffsmc64'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830007qujclffsmc64'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830007qujclffsmc64'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830007qujclffsmc64'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830008qujcvcc6xen2'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830008qujcvcc6xen2'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830008qujcvcc6xen2'),('cmv1yld140007qbjcusex3dxc','cmuzheg830008qujcvcc6xen2'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830008qujcvcc6xen2'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830008qujcvcc6xen2'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830008qujcvcc6xen2'),('cmv1z69tq000606jckl1n49uz','cmuzheg830008qujcvcc6xen2'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830008qujcvcc6xen2'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830008qujcvcc6xen2'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830008qujcvcc6xen2'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830008qujcvcc6xen2'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830009qujcqaumbrag'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830009qujcqaumbrag'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg830009qujcqaumbrag'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830009qujcqaumbrag'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830009qujcqaumbrag'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830009qujcqaumbrag'),('cmv1yld0u0006qbjctcott3he','cmuzheg830009qujcqaumbrag'),('cmv1yld140007qbjcusex3dxc','cmuzheg830009qujcqaumbrag'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830009qujcqaumbrag'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830009qujcqaumbrag'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg830009qujcqaumbrag'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830009qujcqaumbrag'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830009qujcqaumbrag'),('cmv1z69sn000306jc52hkhneq','cmuzheg830009qujcqaumbrag'),('cmv1z69ti000506jcgmljoviz','cmuzheg830009qujcqaumbrag'),('cmv1z69tq000606jckl1n49uz','cmuzheg830009qujcqaumbrag'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830009qujcqaumbrag'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830009qujcqaumbrag'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg830009qujcqaumbrag'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830009qujcqaumbrag'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830009qujcqaumbrag'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830009qujcqaumbrag'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg830009qujcqaumbrag'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830009qujcqaumbrag'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000aqujct0whn4nc'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000aqujct0whn4nc'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000aqujct0whn4nc'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000aqujct0whn4nc'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000aqujct0whn4nc'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000aqujct0whn4nc'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000aqujct0whn4nc'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000aqujct0whn4nc'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000aqujct0whn4nc'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000aqujct0whn4nc'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000aqujct0whn4nc'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000aqujct0whn4nc'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000aqujct0whn4nc'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000aqujct0whn4nc'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000aqujct0whn4nc'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000aqujct0whn4nc'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000aqujct0whn4nc'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000aqujct0whn4nc'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000bqujcyz95fhp8'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000bqujcyz95fhp8'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000bqujcyz95fhp8'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000bqujcyz95fhp8'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000bqujcyz95fhp8'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000bqujcyz95fhp8'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000bqujcyz95fhp8'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000bqujcyz95fhp8'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000bqujcyz95fhp8'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000bqujcyz95fhp8'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000bqujcyz95fhp8'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000bqujcyz95fhp8'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000bqujcyz95fhp8'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000bqujcyz95fhp8'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000bqujcyz95fhp8'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000bqujcyz95fhp8'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000bqujcyz95fhp8'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000bqujcyz95fhp8'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000cqujcl4iq9z0e'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000cqujcl4iq9z0e'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000cqujcl4iq9z0e'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000cqujcl4iq9z0e'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000cqujcl4iq9z0e'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000cqujcl4iq9z0e'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000cqujcl4iq9z0e'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000cqujcl4iq9z0e'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000cqujcl4iq9z0e'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000cqujcl4iq9z0e'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000cqujcl4iq9z0e'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000cqujcl4iq9z0e'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000cqujcl4iq9z0e'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000cqujcl4iq9z0e'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000cqujcl4iq9z0e'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000cqujcl4iq9z0e'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000cqujcl4iq9z0e'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000cqujcl4iq9z0e'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000dqujcf2fliqkl'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000dqujcf2fliqkl'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000dqujcf2fliqkl'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000dqujcf2fliqkl'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000dqujcf2fliqkl'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000dqujcf2fliqkl'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000dqujcf2fliqkl'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000dqujcf2fliqkl'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000dqujcf2fliqkl'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000dqujcf2fliqkl'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000dqujcf2fliqkl'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000dqujcf2fliqkl'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000dqujcf2fliqkl'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000dqujcf2fliqkl'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000dqujcf2fliqkl'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000dqujcf2fliqkl'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000dqujcf2fliqkl'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000dqujcf2fliqkl'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000dqujcf2fliqkl'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000dqujcf2fliqkl'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000dqujcf2fliqkl'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000dqujcf2fliqkl'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000dqujcf2fliqkl'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000dqujcf2fliqkl'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000dqujcf2fliqkl'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000dqujcf2fliqkl'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000dqujcf2fliqkl'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000dqujcf2fliqkl'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000dqujcf2fliqkl'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000dqujcf2fliqkl'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000equjczcxi3z5h'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000equjczcxi3z5h'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000equjczcxi3z5h'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000equjczcxi3z5h'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000equjczcxi3z5h'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000equjczcxi3z5h'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000equjczcxi3z5h'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000equjczcxi3z5h'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000equjczcxi3z5h'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000equjczcxi3z5h'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000equjczcxi3z5h'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000equjczcxi3z5h'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000equjczcxi3z5h'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000equjczcxi3z5h'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000equjczcxi3z5h'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000equjczcxi3z5h'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000equjczcxi3z5h'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000equjczcxi3z5h'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000fqujcc0nea3ak'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000fqujcc0nea3ak'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000fqujcc0nea3ak'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000fqujcc0nea3ak'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000fqujcc0nea3ak'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000fqujcc0nea3ak'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000fqujcc0nea3ak'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000fqujcc0nea3ak'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000fqujcc0nea3ak'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000fqujcc0nea3ak'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000fqujcc0nea3ak'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000fqujcc0nea3ak'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000fqujcc0nea3ak'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000fqujcc0nea3ak'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000fqujcc0nea3ak'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000fqujcc0nea3ak'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000fqujcc0nea3ak'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000fqujcc0nea3ak'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000gqujc5k4ygg9i'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000gqujc5k4ygg9i'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000gqujc5k4ygg9i'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000gqujc5k4ygg9i'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000gqujc5k4ygg9i'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000gqujc5k4ygg9i'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000gqujc5k4ygg9i'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000gqujc5k4ygg9i'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000gqujc5k4ygg9i'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000gqujc5k4ygg9i'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000gqujc5k4ygg9i'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000gqujc5k4ygg9i'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000gqujc5k4ygg9i'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000gqujc5k4ygg9i'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000gqujc5k4ygg9i'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000gqujc5k4ygg9i'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000gqujc5k4ygg9i'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000gqujc5k4ygg9i'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000hqujcvontc8ky'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000hqujcvontc8ky'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000hqujcvontc8ky'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000hqujcvontc8ky'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000hqujcvontc8ky'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000hqujcvontc8ky'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000hqujcvontc8ky'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000hqujcvontc8ky'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000hqujcvontc8ky'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000hqujcvontc8ky'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000hqujcvontc8ky'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000hqujcvontc8ky'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000hqujcvontc8ky'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000hqujcvontc8ky'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000hqujcvontc8ky'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000hqujcvontc8ky'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000hqujcvontc8ky'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000hqujcvontc8ky'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000iqujcptlin5a9'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000iqujcptlin5a9'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000iqujcptlin5a9'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000iqujcptlin5a9'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000iqujcptlin5a9'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000iqujcptlin5a9'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000iqujcptlin5a9'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000iqujcptlin5a9'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000iqujcptlin5a9'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000iqujcptlin5a9'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000iqujcptlin5a9'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000iqujcptlin5a9'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000iqujcptlin5a9'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000iqujcptlin5a9'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000iqujcptlin5a9'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000iqujcptlin5a9'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000iqujcptlin5a9'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000iqujcptlin5a9'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000jqujcfosxayxi'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000jqujcfosxayxi'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000jqujcfosxayxi'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000jqujcfosxayxi'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000jqujcfosxayxi'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000jqujcfosxayxi'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000jqujcfosxayxi'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000jqujcfosxayxi'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000jqujcfosxayxi'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000jqujcfosxayxi'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000jqujcfosxayxi'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000jqujcfosxayxi'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000jqujcfosxayxi'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000jqujcfosxayxi'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000jqujcfosxayxi'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000jqujcfosxayxi'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000jqujcfosxayxi'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000jqujcfosxayxi'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000jqujcfosxayxi'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000jqujcfosxayxi'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000jqujcfosxayxi'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000jqujcfosxayxi'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000jqujcfosxayxi'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000jqujcfosxayxi'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000kqujcfidtzez6'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000kqujcfidtzez6'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000kqujcfidtzez6'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000kqujcfidtzez6'),('cmuzhegrb001squjcjioxjp9f','cmuzheg83000kqujcfidtzez6'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000kqujcfidtzez6'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000kqujcfidtzez6'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000kqujcfidtzez6'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000kqujcfidtzez6'),('cmv1yld1j0008qbjckcqkn7wx','cmuzheg83000kqujcfidtzez6'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000kqujcfidtzez6'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000kqujcfidtzez6'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000kqujcfidtzez6'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000kqujcfidtzez6'),('cmv1z4jus000sqbjcd6bszc8q','cmuzheg83000kqujcfidtzez6'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000kqujcfidtzez6'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000kqujcfidtzez6'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000kqujcfidtzez6'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000kqujcfidtzez6'),('cmv1z69u3000706jct3nzy44x','cmuzheg83000kqujcfidtzez6'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000kqujcfidtzez6'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000kqujcfidtzez6'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000kqujcfidtzez6'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000kqujcfidtzez6'),('cmvp3yb0j000gqpjcz8yr14s4','cmuzheg83000kqujcfidtzez6'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000kqujcfidtzez6'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000kqujcfidtzez6'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000kqujcfidtzez6'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000kqujcfidtzez6'),('cmvp409mh0010qpjc6jb308ca','cmuzheg83000kqujcfidtzez6'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000lqujcpoy70yc2'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000lqujcpoy70yc2'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000lqujcpoy70yc2'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000lqujcpoy70yc2'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000lqujcpoy70yc2'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000lqujcpoy70yc2'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000lqujcpoy70yc2'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000lqujcpoy70yc2'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000lqujcpoy70yc2'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000lqujcpoy70yc2'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000lqujcpoy70yc2'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000lqujcpoy70yc2'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000lqujcpoy70yc2'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000lqujcpoy70yc2'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000lqujcpoy70yc2'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000lqujcpoy70yc2'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000lqujcpoy70yc2'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000lqujcpoy70yc2'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000mqujc5ijt1cfd'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000mqujc5ijt1cfd'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000mqujc5ijt1cfd'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000mqujc5ijt1cfd'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000mqujc5ijt1cfd'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000mqujc5ijt1cfd'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000mqujc5ijt1cfd'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000mqujc5ijt1cfd'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000mqujc5ijt1cfd'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000mqujc5ijt1cfd'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000mqujc5ijt1cfd'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000mqujc5ijt1cfd'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000nqujcma1gu47a'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000nqujcma1gu47a'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000nqujcma1gu47a'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000nqujcma1gu47a'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000nqujcma1gu47a'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000nqujcma1gu47a'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000nqujcma1gu47a'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000nqujcma1gu47a'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000nqujcma1gu47a'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000nqujcma1gu47a'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000nqujcma1gu47a'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000nqujcma1gu47a'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000nqujcma1gu47a'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000nqujcma1gu47a'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000nqujcma1gu47a'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000nqujcma1gu47a'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000nqujcma1gu47a'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000nqujcma1gu47a'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000nqujcma1gu47a'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000nqujcma1gu47a'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000nqujcma1gu47a'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000nqujcma1gu47a'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000nqujcma1gu47a'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000nqujcma1gu47a'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000oqujc831kdldk'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000oqujc831kdldk'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000oqujc831kdldk'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000oqujc831kdldk'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000oqujc831kdldk'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000oqujc831kdldk'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000oqujc831kdldk'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000oqujc831kdldk'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000oqujc831kdldk'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000oqujc831kdldk'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000oqujc831kdldk'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000oqujc831kdldk'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000oqujc831kdldk'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000oqujc831kdldk'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000oqujc831kdldk'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000oqujc831kdldk'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000oqujc831kdldk'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000oqujc831kdldk'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000pqujcw666i70f'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000pqujcw666i70f'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000pqujcw666i70f'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000pqujcw666i70f'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000pqujcw666i70f'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000pqujcw666i70f'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000pqujcw666i70f'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000pqujcw666i70f'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000pqujcw666i70f'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000pqujcw666i70f'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000pqujcw666i70f'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000pqujcw666i70f'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000qqujcsx7qvlbf'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000qqujcsx7qvlbf'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000qqujcsx7qvlbf'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000qqujcsx7qvlbf'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000qqujcsx7qvlbf'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000qqujcsx7qvlbf'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000qqujcsx7qvlbf'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000qqujcsx7qvlbf'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000qqujcsx7qvlbf'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000qqujcsx7qvlbf'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000qqujcsx7qvlbf'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000qqujcsx7qvlbf'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000rqujcvkkl2iey'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000rqujcvkkl2iey'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000rqujcvkkl2iey'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000rqujcvkkl2iey'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000rqujcvkkl2iey'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000rqujcvkkl2iey'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000rqujcvkkl2iey'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000rqujcvkkl2iey'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000rqujcvkkl2iey'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000rqujcvkkl2iey'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000rqujcvkkl2iey'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000rqujcvkkl2iey'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000squjc418sd8r3'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000squjc418sd8r3'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000squjc418sd8r3'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000squjc418sd8r3'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000squjc418sd8r3'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000squjc418sd8r3'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000squjc418sd8r3'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000squjc418sd8r3'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000squjc418sd8r3'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000squjc418sd8r3'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000squjc418sd8r3'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000squjc418sd8r3'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000squjc418sd8r3'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000squjc418sd8r3'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000squjc418sd8r3'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000squjc418sd8r3'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000squjc418sd8r3'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000squjc418sd8r3'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000tqujcd4gbrdzc'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000tqujcd4gbrdzc'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000tqujcd4gbrdzc'),('cmuzhegrb001squjcjioxjp9f','cmuzheg83000tqujcd4gbrdzc'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000tqujcd4gbrdzc'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000tqujcd4gbrdzc'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000tqujcd4gbrdzc'),('cmv1yld1j0008qbjckcqkn7wx','cmuzheg83000tqujcd4gbrdzc'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000tqujcd4gbrdzc'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000tqujcd4gbrdzc'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000tqujcd4gbrdzc'),('cmv1z4jus000sqbjcd6bszc8q','cmuzheg83000tqujcd4gbrdzc'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000tqujcd4gbrdzc'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000tqujcd4gbrdzc'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000tqujcd4gbrdzc'),('cmv1z69u3000706jct3nzy44x','cmuzheg83000tqujcd4gbrdzc'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000tqujcd4gbrdzc'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000tqujcd4gbrdzc'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000tqujcd4gbrdzc'),('cmvp3yb0j000gqpjcz8yr14s4','cmuzheg83000tqujcd4gbrdzc'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000tqujcd4gbrdzc'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000tqujcd4gbrdzc'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000tqujcd4gbrdzc'),('cmvp409mh0010qpjc6jb308ca','cmuzheg83000tqujcd4gbrdzc'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000uqujcr2i3x57d'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000uqujcr2i3x57d'),('cmuzhegrb001squjcjioxjp9f','cmuzheg83000uqujcr2i3x57d'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000uqujcr2i3x57d'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000uqujcr2i3x57d'),('cmv1yld1j0008qbjckcqkn7wx','cmuzheg83000uqujcr2i3x57d'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000uqujcr2i3x57d'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000uqujcr2i3x57d'),('cmv1z4jus000sqbjcd6bszc8q','cmuzheg83000uqujcr2i3x57d'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000uqujcr2i3x57d'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000uqujcr2i3x57d'),('cmv1z69u3000706jct3nzy44x','cmuzheg83000uqujcr2i3x57d'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000uqujcr2i3x57d'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000uqujcr2i3x57d'),('cmvp3yb0j000gqpjcz8yr14s4','cmuzheg83000uqujcr2i3x57d'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000uqujcr2i3x57d'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000uqujcr2i3x57d'),('cmvp409mh0010qpjc6jb308ca','cmuzheg83000uqujcr2i3x57d'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000vqujcr7w7bhyn'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000vqujcr7w7bhyn'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000vqujcr7w7bhyn'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000vqujcr7w7bhyn'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000vqujcr7w7bhyn'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000vqujcr7w7bhyn'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000vqujcr7w7bhyn'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000vqujcr7w7bhyn'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000vqujcr7w7bhyn'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000vqujcr7w7bhyn'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000vqujcr7w7bhyn'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000vqujcr7w7bhyn'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000vqujcr7w7bhyn'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000vqujcr7w7bhyn'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000vqujcr7w7bhyn'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000vqujcr7w7bhyn'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000vqujcr7w7bhyn'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000vqujcr7w7bhyn'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000vqujcr7w7bhyn'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000vqujcr7w7bhyn'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000vqujcr7w7bhyn'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000vqujcr7w7bhyn'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000vqujcr7w7bhyn'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000vqujcr7w7bhyn'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000wqujcik1v4sad'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000wqujcik1v4sad'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83000wqujcik1v4sad'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000wqujcik1v4sad'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000wqujcik1v4sad'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83000wqujcik1v4sad'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000wqujcik1v4sad'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000wqujcik1v4sad'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83000wqujcik1v4sad'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000wqujcik1v4sad'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000wqujcik1v4sad'),('cmv1z69t3000406jc18uhakrn','cmuzheg83000wqujcik1v4sad'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000wqujcik1v4sad'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000wqujcik1v4sad'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83000wqujcik1v4sad'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000wqujcik1v4sad'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000wqujcik1v4sad'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83000wqujcik1v4sad'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000xqujcx0b30gs4'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000xqujcx0b30gs4'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000xqujcx0b30gs4'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000xqujcx0b30gs4'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000xqujcx0b30gs4'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000xqujcx0b30gs4'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000xqujcx0b30gs4'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000xqujcx0b30gs4'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000xqujcx0b30gs4'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000xqujcx0b30gs4'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000xqujcx0b30gs4'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000xqujcx0b30gs4'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000yqujclvtpgxfb'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000yqujclvtpgxfb'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000yqujclvtpgxfb'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000yqujclvtpgxfb'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000yqujclvtpgxfb'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000yqujclvtpgxfb'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000yqujclvtpgxfb'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000yqujclvtpgxfb'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000yqujclvtpgxfb'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000yqujclvtpgxfb'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000yqujclvtpgxfb'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000yqujclvtpgxfb'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83000zqujcvt7uivmy'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83000zqujcvt7uivmy'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83000zqujcvt7uivmy'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83000zqujcvt7uivmy'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83000zqujcvt7uivmy'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83000zqujcvt7uivmy'),('cmv1yld0u0006qbjctcott3he','cmuzheg83000zqujcvt7uivmy'),('cmv1yld140007qbjcusex3dxc','cmuzheg83000zqujcvt7uivmy'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83000zqujcvt7uivmy'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83000zqujcvt7uivmy'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83000zqujcvt7uivmy'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83000zqujcvt7uivmy'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83000zqujcvt7uivmy'),('cmv1z69sn000306jc52hkhneq','cmuzheg83000zqujcvt7uivmy'),('cmv1z69ti000506jcgmljoviz','cmuzheg83000zqujcvt7uivmy'),('cmv1z69tq000606jckl1n49uz','cmuzheg83000zqujcvt7uivmy'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83000zqujcvt7uivmy'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83000zqujcvt7uivmy'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83000zqujcvt7uivmy'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83000zqujcvt7uivmy'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83000zqujcvt7uivmy'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83000zqujcvt7uivmy'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83000zqujcvt7uivmy'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83000zqujcvt7uivmy'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830010qujcsq65u4b6'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830010qujcsq65u4b6'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830010qujcsq65u4b6'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830010qujcsq65u4b6'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830010qujcsq65u4b6'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830010qujcsq65u4b6'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830010qujcsq65u4b6'),('cmv1z69sn000306jc52hkhneq','cmuzheg830010qujcsq65u4b6'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830010qujcsq65u4b6'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830010qujcsq65u4b6'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830010qujcsq65u4b6'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830010qujcsq65u4b6'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830011qujcf2c1va8b'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830011qujcf2c1va8b'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830011qujcf2c1va8b'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830011qujcf2c1va8b'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830011qujcf2c1va8b'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830011qujcf2c1va8b'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830011qujcf2c1va8b'),('cmv1z69sn000306jc52hkhneq','cmuzheg830011qujcf2c1va8b'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830011qujcf2c1va8b'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830011qujcf2c1va8b'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830011qujcf2c1va8b'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830011qujcf2c1va8b'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830012qujce04sj3yf'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830012qujce04sj3yf'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830012qujce04sj3yf'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830012qujce04sj3yf'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830012qujce04sj3yf'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830012qujce04sj3yf'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830013qujchlfp8hr9'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830013qujchlfp8hr9'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830013qujchlfp8hr9'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830013qujchlfp8hr9'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830013qujchlfp8hr9'),('cmv1yld140007qbjcusex3dxc','cmuzheg830013qujchlfp8hr9'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830013qujchlfp8hr9'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830013qujchlfp8hr9'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830013qujchlfp8hr9'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830013qujchlfp8hr9'),('cmv1z69sn000306jc52hkhneq','cmuzheg830013qujchlfp8hr9'),('cmv1z69tq000606jckl1n49uz','cmuzheg830013qujchlfp8hr9'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830013qujchlfp8hr9'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830013qujchlfp8hr9'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830013qujchlfp8hr9'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830013qujchlfp8hr9'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830013qujchlfp8hr9'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830013qujchlfp8hr9'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830014qujcb4xpexlh'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830014qujcb4xpexlh'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830014qujcb4xpexlh'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830014qujcb4xpexlh'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830014qujcb4xpexlh'),('cmv1yld140007qbjcusex3dxc','cmuzheg830014qujcb4xpexlh'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830014qujcb4xpexlh'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830014qujcb4xpexlh'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830014qujcb4xpexlh'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830014qujcb4xpexlh'),('cmv1z69sn000306jc52hkhneq','cmuzheg830014qujcb4xpexlh'),('cmv1z69tq000606jckl1n49uz','cmuzheg830014qujcb4xpexlh'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830014qujcb4xpexlh'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830014qujcb4xpexlh'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830014qujcb4xpexlh'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830014qujcb4xpexlh'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830014qujcb4xpexlh'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830014qujcb4xpexlh'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830015qujcuaduwtde'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830015qujcuaduwtde'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830015qujcuaduwtde'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830015qujcuaduwtde'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830015qujcuaduwtde'),('cmv1yld140007qbjcusex3dxc','cmuzheg830015qujcuaduwtde'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830015qujcuaduwtde'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830015qujcuaduwtde'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830015qujcuaduwtde'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830015qujcuaduwtde'),('cmv1z69sn000306jc52hkhneq','cmuzheg830015qujcuaduwtde'),('cmv1z69tq000606jckl1n49uz','cmuzheg830015qujcuaduwtde'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830015qujcuaduwtde'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830015qujcuaduwtde'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830015qujcuaduwtde'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830015qujcuaduwtde'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830015qujcuaduwtde'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830015qujcuaduwtde'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830016qujcl6t6j4cl'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830016qujcl6t6j4cl'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830016qujcl6t6j4cl'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830016qujcl6t6j4cl'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830016qujcl6t6j4cl'),('cmv1yld140007qbjcusex3dxc','cmuzheg830016qujcl6t6j4cl'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830016qujcl6t6j4cl'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830016qujcl6t6j4cl'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830016qujcl6t6j4cl'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830016qujcl6t6j4cl'),('cmv1z69sn000306jc52hkhneq','cmuzheg830016qujcl6t6j4cl'),('cmv1z69tq000606jckl1n49uz','cmuzheg830016qujcl6t6j4cl'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830016qujcl6t6j4cl'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830016qujcl6t6j4cl'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830016qujcl6t6j4cl'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830016qujcl6t6j4cl'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830016qujcl6t6j4cl'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830016qujcl6t6j4cl'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830017qujcnrmozdta'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830017qujcnrmozdta'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830017qujcnrmozdta'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830017qujcnrmozdta'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830017qujcnrmozdta'),('cmv1yld140007qbjcusex3dxc','cmuzheg830017qujcnrmozdta'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830017qujcnrmozdta'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830017qujcnrmozdta'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830017qujcnrmozdta'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830017qujcnrmozdta'),('cmv1z69sn000306jc52hkhneq','cmuzheg830017qujcnrmozdta'),('cmv1z69tq000606jckl1n49uz','cmuzheg830017qujcnrmozdta'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830017qujcnrmozdta'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830017qujcnrmozdta'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830017qujcnrmozdta'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830017qujcnrmozdta'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830017qujcnrmozdta'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830017qujcnrmozdta'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830018qujcskxycz03'),('cmuzhegqi001oqujcyhmbprch','cmuzheg830018qujcskxycz03'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830018qujcskxycz03'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830018qujcskxycz03'),('cmv1yld090004qbjcux5a7gqb','cmuzheg830018qujcskxycz03'),('cmv1yld140007qbjcusex3dxc','cmuzheg830018qujcskxycz03'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830018qujcskxycz03'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg830018qujcskxycz03'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830018qujcskxycz03'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830018qujcskxycz03'),('cmv1z69sn000306jc52hkhneq','cmuzheg830018qujcskxycz03'),('cmv1z69tq000606jckl1n49uz','cmuzheg830018qujcskxycz03'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830018qujcskxycz03'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg830018qujcskxycz03'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830018qujcskxycz03'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830018qujcskxycz03'),('cmvp409lv000wqpjcnwnudu92','cmuzheg830018qujcskxycz03'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830018qujcskxycz03'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg830019qujcv91lwvdx'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg830019qujcv91lwvdx'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg830019qujcv91lwvdx'),('cmv1yld140007qbjcusex3dxc','cmuzheg830019qujcv91lwvdx'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg830019qujcv91lwvdx'),('cmv1z4jum000rqbjc687nvuid','cmuzheg830019qujcv91lwvdx'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg830019qujcv91lwvdx'),('cmv1z69tq000606jckl1n49uz','cmuzheg830019qujcv91lwvdx'),('cmvp3yaym000bqpjce1lqc938','cmuzheg830019qujcv91lwvdx'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg830019qujcv91lwvdx'),('cmvp409la000vqpjc5z1fm1so','cmuzheg830019qujcv91lwvdx'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg830019qujcv91lwvdx'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001aqujcjptyv2v2'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83001aqujcjptyv2v2'),('cmuzhegqr001pqujckps9ijb2','cmuzheg83001aqujcjptyv2v2'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83001aqujcjptyv2v2'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001aqujcjptyv2v2'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83001aqujcjptyv2v2'),('cmv1yld0m0005qbjcbjns7pxq','cmuzheg83001aqujcjptyv2v2'),('cmv1yld140007qbjcusex3dxc','cmuzheg83001aqujcjptyv2v2'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001aqujcjptyv2v2'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83001aqujcjptyv2v2'),('cmv1z4jua000pqbjcetpxcrbz','cmuzheg83001aqujcjptyv2v2'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83001aqujcjptyv2v2'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001aqujcjptyv2v2'),('cmv1z69sn000306jc52hkhneq','cmuzheg83001aqujcjptyv2v2'),('cmv1z69t3000406jc18uhakrn','cmuzheg83001aqujcjptyv2v2'),('cmv1z69tq000606jckl1n49uz','cmuzheg83001aqujcjptyv2v2'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001aqujcjptyv2v2'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83001aqujcjptyv2v2'),('cmvp3yazl000dqpjcr93me0rh','cmuzheg83001aqujcjptyv2v2'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83001aqujcjptyv2v2'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001aqujcjptyv2v2'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83001aqujcjptyv2v2'),('cmvp409m1000xqpjcz7fb85tz','cmuzheg83001aqujcjptyv2v2'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83001aqujcjptyv2v2'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001bqujc1okv9i0x'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83001bqujc1okv9i0x'),('cmuzhegqx001qqujcjmw9ypmh','cmuzheg83001bqujc1okv9i0x'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83001bqujc1okv9i0x'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001bqujc1okv9i0x'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83001bqujc1okv9i0x'),('cmv1yld0u0006qbjctcott3he','cmuzheg83001bqujc1okv9i0x'),('cmv1yld140007qbjcusex3dxc','cmuzheg83001bqujc1okv9i0x'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001bqujc1okv9i0x'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83001bqujc1okv9i0x'),('cmv1z4juf000qqbjcoikhob1c','cmuzheg83001bqujc1okv9i0x'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83001bqujc1okv9i0x'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001bqujc1okv9i0x'),('cmv1z69sn000306jc52hkhneq','cmuzheg83001bqujc1okv9i0x'),('cmv1z69ti000506jcgmljoviz','cmuzheg83001bqujc1okv9i0x'),('cmv1z69tq000606jckl1n49uz','cmuzheg83001bqujc1okv9i0x'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001bqujc1okv9i0x'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83001bqujc1okv9i0x'),('cmvp3yazs000eqpjcwen6zhia','cmuzheg83001bqujc1okv9i0x'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83001bqujc1okv9i0x'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001bqujc1okv9i0x'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83001bqujc1okv9i0x'),('cmvp409m7000yqpjc90v4d5vx','cmuzheg83001bqujc1okv9i0x'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83001bqujc1okv9i0x'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001cqujclm8234yy'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83001cqujclm8234yy'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001cqujclm8234yy'),('cmv1yld140007qbjcusex3dxc','cmuzheg83001cqujclm8234yy'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001cqujclm8234yy'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83001cqujclm8234yy'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001cqujclm8234yy'),('cmv1z69tq000606jckl1n49uz','cmuzheg83001cqujclm8234yy'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001cqujclm8234yy'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83001cqujclm8234yy'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001cqujclm8234yy'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83001cqujclm8234yy'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001dqujc630xoigx'),('cmuzhegqi001oqujcyhmbprch','cmuzheg83001dqujc630xoigx'),('cmuzhegr3001rqujcj66nv3pn','cmuzheg83001dqujc630xoigx'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001dqujc630xoigx'),('cmv1yld090004qbjcux5a7gqb','cmuzheg83001dqujc630xoigx'),('cmv1yld140007qbjcusex3dxc','cmuzheg83001dqujc630xoigx'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001dqujc630xoigx'),('cmv1z4ju1000oqbjcpnvd8kqv','cmuzheg83001dqujc630xoigx'),('cmv1z4jum000rqbjc687nvuid','cmuzheg83001dqujc630xoigx'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001dqujc630xoigx'),('cmv1z69sn000306jc52hkhneq','cmuzheg83001dqujc630xoigx'),('cmv1z69tq000606jckl1n49uz','cmuzheg83001dqujc630xoigx'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001dqujc630xoigx'),('cmvp3yaz6000cqpjcd6lnel7r','cmuzheg83001dqujc630xoigx'),('cmvp3yazz000fqpjcmtcc5h65','cmuzheg83001dqujc630xoigx'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001dqujc630xoigx'),('cmvp409lv000wqpjcnwnudu92','cmuzheg83001dqujc630xoigx'),('cmvp409mb000zqpjcxpnjiwxw','cmuzheg83001dqujc630xoigx'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001equjcc5y04rq2'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001equjcc5y04rq2'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001equjcc5y04rq2'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001equjcc5y04rq2'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001equjcc5y04rq2'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001equjcc5y04rq2'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001fqujca6xkepax'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001fqujca6xkepax'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001fqujca6xkepax'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001fqujca6xkepax'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001fqujca6xkepax'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001fqujca6xkepax'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001gqujcirtj14mo'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001gqujcirtj14mo'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001gqujcirtj14mo'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001gqujcirtj14mo'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001gqujcirtj14mo'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001gqujcirtj14mo'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001hqujclcdw72hi'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001hqujclcdw72hi'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001hqujclcdw72hi'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001hqujclcdw72hi'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001hqujclcdw72hi'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001hqujclcdw72hi'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001iqujcuotmp3vi'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001iqujcuotmp3vi'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001iqujcuotmp3vi'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001iqujcuotmp3vi'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001iqujcuotmp3vi'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001iqujcuotmp3vi'),('cmuzhegq0001nqujcoqgpa12z','cmuzheg83001jqujcrdyghysq'),('cmv1ylczs0003qbjc1hx4yrb5','cmuzheg83001jqujcrdyghysq'),('cmv1z4jtm000nqbjcmgfhsfs4','cmuzheg83001jqujcrdyghysq'),('cmv1z69sd000206jc9hvsxj2i','cmuzheg83001jqujcrdyghysq'),('cmvp3yaym000bqpjce1lqc938','cmuzheg83001jqujcrdyghysq'),('cmvp409la000vqpjc5z1fm1so','cmuzheg83001jqujcrdyghysq');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_companyId_name_key` (`companyId`,`name`),
  CONSTRAINT `roles_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES ('cmuzhegq0001nqujcoqgpa12z','cmuzhegpi001lqujcip78ku7p','owner','Company Owner','Full access to everything in the company.',1,'2026-10-08 11:57:04.680','2026-10-08 11:57:04.680'),('cmuzhegqi001oqujcyhmbprch','cmuzhegpi001lqujcip78ku7p','branch_manager','Branch Manager','Runs day-to-day operations of assigned branches.',1,'2026-10-08 11:57:04.698','2026-10-08 11:57:04.698'),('cmuzhegqr001pqujckps9ijb2','cmuzhegpi001lqujcip78ku7p','sales_staff','Sales Staff','Counter staff creating invoices and receiving payments.',1,'2026-10-08 11:57:04.707','2026-10-08 11:57:04.707'),('cmuzhegqx001qqujcjmw9ypmh','cmuzhegpi001lqujcip78ku7p','inventory_manager','Inventory Manager','Receives goods and manages stock.',1,'2026-10-08 11:57:04.713','2026-10-08 11:57:04.713'),('cmuzhegr3001rqujcj66nv3pn','cmuzhegpi001lqujcip78ku7p','accountant','Accountant','Expenses, cash closing, LC costing and financial reports.',1,'2026-10-08 11:57:04.719','2026-10-08 11:57:04.719'),('cmuzhegrb001squjcjioxjp9f','cmuzhegpi001lqujcip78ku7p','delivery_coordinator','Delivery Coordinator','Challans, delivery status and LC delivery charges.',1,'2026-10-08 11:57:04.727','2026-10-08 11:57:04.727'),('cmv1ylczs0003qbjc1hx4yrb5','cmv1ylcy60001qbjck67f7a5f','owner','Company Owner','Full access to everything in the company.',1,'2026-10-10 05:33:52.264','2026-10-10 05:33:52.264'),('cmv1yld090004qbjcux5a7gqb','cmv1ylcy60001qbjck67f7a5f','branch_manager','Branch Manager','Runs day-to-day operations of assigned branches.',1,'2026-10-10 05:33:52.281','2026-10-10 05:33:52.281'),('cmv1yld0m0005qbjcbjns7pxq','cmv1ylcy60001qbjck67f7a5f','sales_staff','Sales Staff','Counter staff creating invoices and receiving payments.',1,'2026-10-10 05:33:52.294','2026-10-10 05:33:52.294'),('cmv1yld0u0006qbjctcott3he','cmv1ylcy60001qbjck67f7a5f','inventory_manager','Inventory Manager','Receives goods and manages stock.',1,'2026-10-10 05:33:52.302','2026-10-10 05:33:52.302'),('cmv1yld140007qbjcusex3dxc','cmv1ylcy60001qbjck67f7a5f','accountant','Accountant','Expenses, cash closing, LC costing and financial reports.',1,'2026-10-10 05:33:52.312','2026-10-10 05:33:52.312'),('cmv1yld1j0008qbjckcqkn7wx','cmv1ylcy60001qbjck67f7a5f','delivery_coordinator','Delivery Coordinator','Challans, delivery status and LC delivery charges.',1,'2026-10-10 05:33:52.327','2026-10-10 05:33:52.327'),('cmv1z4jtm000nqbjcmgfhsfs4','cmv1z4jte000lqbjcyqafhjai','owner','Company Owner','Full access to everything in the company.',1,'2026-10-10 05:48:47.578','2026-10-10 05:48:47.578'),('cmv1z4ju1000oqbjcpnvd8kqv','cmv1z4jte000lqbjcyqafhjai','branch_manager','Branch Manager','Runs day-to-day operations of assigned branches.',1,'2026-10-10 05:48:47.593','2026-10-10 05:48:47.593'),('cmv1z4jua000pqbjcetpxcrbz','cmv1z4jte000lqbjcyqafhjai','sales_staff','Sales Staff','Counter staff creating invoices and receiving payments.',1,'2026-10-10 05:48:47.602','2026-10-10 05:48:47.602'),('cmv1z4juf000qqbjcoikhob1c','cmv1z4jte000lqbjcyqafhjai','inventory_manager','Inventory Manager','Receives goods and manages stock.',1,'2026-10-10 05:48:47.607','2026-10-10 05:48:47.607'),('cmv1z4jum000rqbjc687nvuid','cmv1z4jte000lqbjcyqafhjai','accountant','Accountant','Expenses, cash closing, LC costing and financial reports.',1,'2026-10-10 05:48:47.614','2026-10-10 05:48:47.614'),('cmv1z4jus000sqbjcd6bszc8q','cmv1z4jte000lqbjcyqafhjai','delivery_coordinator','Delivery Coordinator','Challans, delivery status and LC delivery charges.',1,'2026-10-10 05:48:47.620','2026-10-10 05:48:47.620'),('cmv1z69sd000206jc9hvsxj2i','cmv1z69rt000006jce4nncwja','owner','Company Owner','Full access to everything in the company.',1,'2026-10-10 05:50:07.885','2026-10-10 05:50:07.885'),('cmv1z69sn000306jc52hkhneq','cmv1z69rt000006jce4nncwja','branch_manager','Branch Manager','Runs day-to-day operations of assigned branches.',1,'2026-10-10 05:50:07.895','2026-10-10 05:50:07.895'),('cmv1z69t3000406jc18uhakrn','cmv1z69rt000006jce4nncwja','sales_staff','Sales Staff','Counter staff creating invoices and receiving payments.',1,'2026-10-10 05:50:07.911','2026-10-10 05:50:07.911'),('cmv1z69ti000506jcgmljoviz','cmv1z69rt000006jce4nncwja','inventory_manager','Inventory Manager','Receives goods and manages stock.',1,'2026-10-10 05:50:07.926','2026-10-10 05:50:07.926'),('cmv1z69tq000606jckl1n49uz','cmv1z69rt000006jce4nncwja','accountant','Accountant','Expenses, cash closing, LC costing and financial reports.',1,'2026-10-10 05:50:07.934','2026-10-10 05:50:07.934'),('cmv1z69u3000706jct3nzy44x','cmv1z69rt000006jce4nncwja','delivery_coordinator','Delivery Coordinator','Challans, delivery status and LC delivery charges.',1,'2026-10-10 05:50:07.947','2026-10-10 05:50:07.947'),('cmvp3yaym000bqpjce1lqc938','cmvp3yaxx0009qpjc22r7m3wl','owner','Company Owner','Full access to everything in the company.',1,'2026-10-26 10:22:36.286','2026-10-26 10:22:36.286'),('cmvp3yaz6000cqpjcd6lnel7r','cmvp3yaxx0009qpjc22r7m3wl','branch_manager','Branch Manager','Runs day-to-day operations of assigned branches.',1,'2026-10-26 10:22:36.306','2026-10-26 10:22:36.306'),('cmvp3yazl000dqpjcr93me0rh','cmvp3yaxx0009qpjc22r7m3wl','sales_staff','Sales Staff','Counter staff creating invoices and receiving payments.',1,'2026-10-26 10:22:36.321','2026-10-26 10:22:36.321'),('cmvp3yazs000eqpjcwen6zhia','cmvp3yaxx0009qpjc22r7m3wl','inventory_manager','Inventory Manager','Receives goods and manages stock.',1,'2026-10-26 10:22:36.328','2026-10-26 10:22:36.328'),('cmvp3yazz000fqpjcmtcc5h65','cmvp3yaxx0009qpjc22r7m3wl','accountant','Accountant','Expenses, cash closing, LC costing and financial reports.',1,'2026-10-26 10:22:36.335','2026-10-26 10:22:36.335'),('cmvp3yb0j000gqpjcz8yr14s4','cmvp3yaxx0009qpjc22r7m3wl','delivery_coordinator','Delivery Coordinator','Challans, delivery status and LC delivery charges.',1,'2026-10-26 10:22:36.355','2026-10-26 10:22:36.355'),('cmvp409la000vqpjc5z1fm1so','cmvp409ky000tqpjc1z8rolle','owner','Company Owner','Full access to everything in the company.',1,'2026-10-26 10:24:07.822','2026-10-26 10:24:07.822'),('cmvp409lv000wqpjcnwnudu92','cmvp409ky000tqpjc1z8rolle','branch_manager','Branch Manager','Runs day-to-day operations of assigned branches.',1,'2026-10-26 10:24:07.843','2026-10-26 10:24:07.843'),('cmvp409m1000xqpjcz7fb85tz','cmvp409ky000tqpjc1z8rolle','sales_staff','Sales Staff','Counter staff creating invoices and receiving payments.',1,'2026-10-26 10:24:07.849','2026-10-26 10:24:07.849'),('cmvp409m7000yqpjc90v4d5vx','cmvp409ky000tqpjc1z8rolle','inventory_manager','Inventory Manager','Receives goods and manages stock.',1,'2026-10-26 10:24:07.855','2026-10-26 10:24:07.855'),('cmvp409mb000zqpjcxpnjiwxw','cmvp409ky000tqpjc1z8rolle','accountant','Accountant','Expenses, cash closing, LC costing and financial reports.',1,'2026-10-26 10:24:07.859','2026-10-26 10:24:07.859'),('cmvp409mh0010qpjc6jb308ca','cmvp409ky000tqpjc1z8rolle','delivery_coordinator','Delivery Coordinator','Challans, delivery status and LC delivery charges.',1,'2026-10-26 10:24:07.865','2026-10-26 10:24:07.865');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_order_lines`
--

DROP TABLE IF EXISTS `sales_order_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `discount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `lineTotal` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_order_lines_orderId_fkey` (`orderId`),
  CONSTRAINT `sales_order_lines_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_order_lines`
--

LOCK TABLES `sales_order_lines` WRITE;
/*!40000 ALTER TABLE `sales_order_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_order_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_orders`
--

DROP TABLE IF EXISTS `sales_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salesmanId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('quotation','order') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'quotation',
  `status` enum('open','converted','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `date` date NOT NULL,
  `validUntil` date DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `advanceAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `note` text COLLATE utf8mb4_unicode_ci,
  `convertedInvoiceId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelledAt` datetime(3) DEFAULT NULL,
  `cancelReason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_orders_companyId_number_key` (`companyId`,`number`),
  KEY `sales_orders_companyId_branchId_status_idx` (`companyId`,`branchId`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_orders`
--

LOCK TABLES `sales_orders` WRITE;
/*!40000 ALTER TABLE `sales_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_return_lines`
--

DROP TABLE IF EXISTS `sales_return_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_return_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `returnId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceLineId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitPrice` decimal(15,2) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_return_lines_returnId_fkey` (`returnId`),
  CONSTRAINT `sales_return_lines_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_return_lines`
--

LOCK TABLES `sales_return_lines` WRITE;
/*!40000 ALTER TABLE `sales_return_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_return_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_returns`
--

DROP TABLE IF EXISTS `sales_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_returns` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoiceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `refundMode` enum('cash','credit_note') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'credit_note',
  `restock` tinyint(1) NOT NULL DEFAULT '1',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `costAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `date` datetime(3) NOT NULL,
  `requestedById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approvedById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approvedAt` datetime(3) DEFAULT NULL,
  `rejectNote` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastPrintedAt` datetime(3) DEFAULT NULL,
  `printCount` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_returns_companyId_number_key` (`companyId`,`number`),
  KEY `sales_returns_companyId_branchId_date_idx` (`companyId`,`branchId`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_returns`
--

LOCK TABLES `sales_returns` WRITE;
/*!40000 ALTER TABLE `sales_returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sequences`
--

DROP TABLE IF EXISTS `sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sequences` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `year` int NOT NULL,
  `next` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sequences_companyId_scope_key_year_key` (`companyId`,`scope`,`key`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sequences`
--

LOCK TABLES `sequences` WRITE;
/*!40000 ALTER TABLE `sequences` DISABLE KEYS */;
/*!40000 ALTER TABLE `sequences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustment_lines`
--

DROP TABLE IF EXISTS `stock_adjustment_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustment_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adjustmentId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`id`),
  KEY `stock_adjustment_lines_adjustmentId_fkey` (`adjustmentId`),
  CONSTRAINT `stock_adjustment_lines_adjustmentId_fkey` FOREIGN KEY (`adjustmentId`) REFERENCES `stock_adjustments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustment_lines`
--

LOCK TABLES `stock_adjustment_lines` WRITE;
/*!40000 ALTER TABLE `stock_adjustment_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_adjustment_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustments`
--

DROP TABLE IF EXISTS `stock_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` enum('damage','count_correction','expired','lost','found','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` date NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_adjustments_companyId_number_key` (`companyId`,`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustments`
--

LOCK TABLES `stock_adjustments` WRITE;
/*!40000 ALTER TABLE `stock_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_balances`
--

DROP TABLE IF EXISTS `stock_balances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_balances` (
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL DEFAULT '0.000',
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`branchId`,`variationId`),
  KEY `stock_balances_companyId_variationId_idx` (`companyId`,`variationId`),
  KEY `stock_balances_variationId_fkey` (`variationId`),
  CONSTRAINT `stock_balances_variationId_fkey` FOREIGN KEY (`variationId`) REFERENCES `product_variations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_balances`
--

LOCK TABLES `stock_balances` WRITE;
/*!40000 ALTER TABLE `stock_balances` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_balances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_ledger_entries`
--

DROP TABLE IF EXISTS `stock_ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_ledger_entries` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batchId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('opening','purchase_in','sale_out','return_in','cancel_in','adjustment_in','adjustment_out','transfer_in','transfer_out') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `balanceAfter` decimal(15,3) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `refType` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refId` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `stock_ledger_entries_companyId_branchId_variationId_createdA_idx` (`companyId`,`branchId`,`variationId`,`createdAt`),
  KEY `stock_ledger_entries_refType_refId_idx` (`refType`,`refId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_ledger_entries`
--

LOCK TABLES `stock_ledger_entries` WRITE;
/*!40000 ALTER TABLE `stock_ledger_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfer_lines`
--

DROP TABLE IF EXISTS `stock_transfer_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_lines` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transferId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unitCost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`id`),
  KEY `stock_transfer_lines_transferId_fkey` (`transferId`),
  CONSTRAINT `stock_transfer_lines_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `stock_transfers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfer_lines`
--

LOCK TABLES `stock_transfer_lines` WRITE;
/*!40000 ALTER TABLE `stock_transfer_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfer_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfers`
--

DROP TABLE IF EXISTS `stock_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromBranchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toBranchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `date` date NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receivedById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receivedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_transfers_companyId_number_key` (`companyId`,`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfers`
--

LOCK TABLES `stock_transfers` WRITE;
/*!40000 ALTER TABLE `stock_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `planId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('trialing','active','past_due','cancelled','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'trialing',
  `billingCycle` enum('monthly','yearly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `trialEndsAt` datetime(3) DEFAULT NULL,
  `currentPeriodStart` datetime(3) DEFAULT NULL,
  `currentPeriodEnd` datetime(3) DEFAULT NULL,
  `graceEndsAt` datetime(3) DEFAULT NULL,
  `autoRenew` tinyint(1) NOT NULL DEFAULT '1',
  `cancelledAt` datetime(3) DEFAULT NULL,
  `isCurrent` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subscriptions_companyId_isCurrent_idx` (`companyId`,`isCurrent`),
  KEY `subscriptions_status_idx` (`status`),
  KEY `subscriptions_planId_fkey` (`planId`),
  CONSTRAINT `subscriptions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
INSERT INTO `subscriptions` VALUES ('cmuzhegrv0023qujc98kh8hdb','cmuzhegpi001lqujcip78ku7p','cmuzheg6k0001qujcsza37zya','expired','monthly','2026-10-22 11:57:04.743','2026-10-08 11:57:04.743',NULL,NULL,1,NULL,1,'2026-10-08 11:57:04.747','2026-10-26 10:15:50.438'),('cmv1yld2k000jqbjc0xnyaoa5','cmv1ylcy60001qbjck67f7a5f','cmuzheg6k0001qujcsza37zya','expired','monthly','2026-10-24 05:33:52.361','2026-10-10 05:33:52.361',NULL,NULL,1,NULL,1,'2026-10-10 05:33:52.364','2026-10-26 10:15:50.582'),('cmv1z4jv80013qbjcxl7ahmj8','cmv1z4jte000lqbjcyqafhjai','cmuzheg6k0001qujcsza37zya','expired','monthly','2026-10-24 05:48:47.634','2026-10-10 05:48:47.634',NULL,NULL,1,NULL,1,'2026-10-10 05:48:47.636','2026-10-26 10:15:50.658'),('cmv1z69ur000i06jc65umi12o','cmv1z69rt000006jce4nncwja','cmuzheg6k0001qujcsza37zya','expired','monthly','2026-10-24 05:50:07.965','2026-10-10 05:50:07.965',NULL,NULL,1,NULL,1,'2026-10-10 05:50:07.971','2026-10-26 10:15:50.713'),('cmvp3yb1l000rqpjcszcykiai','cmvp3yaxx0009qpjc22r7m3wl','cmuzheg6k0001qujcsza37zya','trialing','monthly','2026-11-09 10:22:36.388','2026-10-26 10:22:36.388',NULL,NULL,1,NULL,1,'2026-10-26 10:22:36.393','2026-10-26 10:22:36.393'),('cmvp409my001bqpjcbmdqulel','cmvp409ky000tqpjc1z8rolle','cmuzheg5x0000qujc4k4h949k','trialing','monthly','2026-11-09 10:24:07.880','2026-10-26 10:24:07.880',NULL,NULL,1,NULL,1,'2026-10-26 10:24:07.882','2026-10-26 10:24:07.882');
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_ledger_entries`
--

DROP TABLE IF EXISTS `supplier_ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_ledger_entries` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplierId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('opening','invoice','payment','return','credit_note','refund','adjustment','purchase') COLLATE utf8mb4_unicode_ci NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balanceAfter` decimal(15,2) NOT NULL,
  `refType` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refId` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime(3) NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `supplier_ledger_entries_companyId_supplierId_date_idx` (`companyId`,`supplierId`,`date`),
  KEY `supplier_ledger_entries_supplierId_fkey` (`supplierId`),
  CONSTRAINT `supplier_ledger_entries_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_ledger_entries`
--

LOCK TABLES `supplier_ledger_entries` WRITE;
/*!40000 ALTER TABLE `supplier_ledger_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_payments`
--

DROP TABLE IF EXISTS `supplier_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_payments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplierId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lcId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` enum('cash','bank','mobile_banking','card','cheque') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bank',
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime(3) NOT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_payments_companyId_number_key` (`companyId`,`number`),
  KEY `supplier_payments_companyId_branchId_date_idx` (`companyId`,`branchId`,`date`),
  KEY `supplier_payments_supplierId_fkey` (`supplierId`),
  CONSTRAINT `supplier_payments_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_payments`
--

LOCK TABLES `supplier_payments` WRITE;
/*!40000 ALTER TABLE `supplier_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contactPerson` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `bankDetails` text COLLATE utf8mb4_unicode_ci,
  `currency` enum('BDT','USD','RMB') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RMB',
  `openingBalance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `suppliers_companyId_code_key` (`companyId`,`code`),
  KEY `suppliers_companyId_name_idx` (`companyId`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_branches`
--

DROP TABLE IF EXISTS `user_branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_branches` (
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`userId`,`branchId`),
  KEY `user_branches_branchId_fkey` (`branchId`),
  CONSTRAINT `user_branches_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_branches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_branches`
--

LOCK TABLES `user_branches` WRITE;
/*!40000 ALTER TABLE `user_branches` DISABLE KEYS */;
INSERT INTO `user_branches` VALUES ('cmuzhegrg001tqujck6oadxgs','cmuzhegpm001mqujce653mwjs'),('cmv1yld1v0009qbjc7qguvwmt','cmv1ylcyh0002qbjct9ql9q08'),('cmv1z4jux000tqbjcp3f7c9nf','cmv1z4jti000mqbjc46jdnqcv'),('cmv1z69u9000806jcveg5wzbx','cmv1z69rz000106jc5n6pab50'),('cmvp3yb0o000hqpjcm8deqvs2','cmvp3yay1000aqpjc02x4rq8u'),('cmvp409mm0011qpjcq832wy1x','cmvp409l6000uqpjcacodd9ga');
/*!40000 ALTER TABLE `user_branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isOwner` tinyint(1) NOT NULL DEFAULT '0',
  `allBranches` tinyint(1) NOT NULL DEFAULT '0',
  `employeeCode` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `joiningDate` date DEFAULT NULL,
  `salary` decimal(15,2) DEFAULT NULL,
  `avatarUrl` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `failedLogins` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime(3) DEFAULT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_companyId_status_idx` (`companyId`,`status`),
  KEY `users_roleId_fkey` (`roleId`),
  CONSTRAINT `users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('cmuzhegrg001tqujck6oadxgs','cmuzhegpi001lqujcip78ku7p','cmuzhegq0001nqujcoqgpa12z','GK Owner','owner@gkinterior.test','+8801700000000','$2b$12$CT3zak/enyIXKKUusje57.Hih6GpVnk2KmlghlCddahwcQ6hxkJDO',1,1,'EMP-0001','Owner',NULL,NULL,NULL,'active',0,NULL,'2026-10-08 12:02:48.584','2026-10-08 11:57:04.732','2026-10-08 12:02:48.602'),('cmv1yld1v0009qbjc7qguvwmt','cmv1ylcy60001qbjck67f7a5f','cmv1ylczs0003qbjc1hx4yrb5','Humaun Kabir','humaunkabi85@gmail.com','0987654323456','$2b$12$yyLuxt0snobYbvnzcCbmOu.DNyq074PSAXGKSRFuPlTzyYwi4xLBq',1,1,'EMP-0001','Owner',NULL,NULL,NULL,'active',0,NULL,'2026-10-10 05:33:52.376','2026-10-10 05:33:52.339','2026-10-10 05:33:52.382'),('cmv1z4jux000tqbjcp3f7c9nf','cmv1z4jte000lqbjcyqafhjai','cmv1z4jtm000nqbjcmgfhsfs4','XYZ','xyz@gmaill.com',NULL,'$2b$12$fJwdwITFJsv4KHdMY5pEruWAudPo5/nPA6AtU7Dzs6/vTrXdiK0g.',1,1,'EMP-0001','Owner',NULL,NULL,NULL,'active',0,NULL,'2026-10-10 05:48:47.653','2026-10-10 05:48:47.625','2026-10-10 05:48:47.656'),('cmv1z69u9000806jcveg5wzbx','cmv1z69rt000006jce4nncwja','cmv1z69sd000206jc9hvsxj2i','XYZ','xyz@gmail.com',NULL,'$2b$12$YGPkn9QbXbcA9uMyy.YXaeiB3Sfv4bZC.gm3c.zbeH95GNK2Avt1S',1,1,'EMP-0001','Owner',NULL,NULL,NULL,'active',0,NULL,'2026-10-10 05:50:07.983','2026-10-10 05:50:07.953','2026-10-10 05:50:07.989'),('cmvp3yb0o000hqpjcm8deqvs2','cmvp3yaxx0009qpjc22r7m3wl','cmvp3yaym000bqpjce1lqc938','Test User','test@gmail.com','12345678','$2b$12$KmA9sLBP3wOSOsutB25Qg.CuFACWFFNv7Bzsc3N2OKIoKcvnuGyka',1,1,'EMP-0001','Owner',NULL,NULL,NULL,'active',0,NULL,'2026-10-26 10:22:36.408','2026-10-26 10:22:36.360','2026-10-26 10:22:36.415'),('cmvp409mm0011qpjcq832wy1x','cmvp409ky000tqpjc1z8rolle','cmvp409la000vqpjc5z1fm1so','Meredith Goodwin','xiwol@mailinator.com','+1 184326-1741','$2b$12$HohcGB9gJYNdb6DkAR9HUOyYHgLUaBuDotuwNnqkAxNyhCVIUR7kC',1,1,'EMP-0001','Owner',NULL,NULL,NULL,'active',0,NULL,NULL,'2026-10-26 10:24:07.870','2026-10-26 10:24:07.870');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 12:08:52
