-- 博富·福美城抽奖系统：数据清理脚本（人工在服务器执行）
--
-- 用法（在服务器上，先备份再执行）：
--   mysqldump -u<user> -p bofu_fumei_lottery > /tmp/bofu-backup-$(date +%F-%H%M).sql
--   mysql -u<user> -p bofu_fumei_lottery < scripts/purge-data.sql
--
-- 默认只执行「A 段：业务数据清理」，保留活动配置、奖品、顾问、素材，方便反复测试。
-- 若要彻底归零（保留后台用户与权限），再单独执行「B 段：完全重置」。
-- 后台「用户管理 → 数据清理」提供同等能力，无需登录服务器。

-- =====================================================================
-- A 段：业务数据清理（客户 / 线索 / 抽奖 / 助力 / 轨迹 / 操作日志）
-- =====================================================================
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `BrowseEvent`;
TRUNCATE TABLE `AssistRecord`;
TRUNCATE TABLE `DrawRecord`;
TRUNCATE TABLE `Lead`;
TRUNCATE TABLE `Customer`;
TRUNCATE TABLE `OperationLog`;

SET FOREIGN_KEY_CHECKS = 1;

-- 库存与统计计数回到初始值，避免展示历史累计
UPDATE `Prize` SET `remainStock` = `stock`;
UPDATE `Activity` SET `exposureCount` = 0, `participateCount` = 0;

-- =====================================================================
-- B 段：完全重置（除后台用户 AdminUser / Permission / AdminRole* / AdminUserRole 外全部清空）
-- 注意：执行后活动配置、奖品、顾问、素材、公告都会被删除，H5 将无活动可展示。
-- 如需执行，请取消下面语句的注释。
-- =====================================================================
-- SET FOREIGN_KEY_CHECKS = 0;
-- TRUNCATE TABLE `ActivityNotice`;
-- TRUNCATE TABLE `ActivityAsset`;
-- TRUNCATE TABLE `Prize`;
-- TRUNCATE TABLE `Consultant`;
-- TRUNCATE TABLE `Activity`;
-- SET FOREIGN_KEY_CHECKS = 1;
