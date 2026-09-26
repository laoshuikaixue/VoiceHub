/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'AstrbotBindingCode'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- 绑定码主键由 (userId) 改为 (userId, platform)：同一账号四个平台各自持码，互不覆盖。
-- 先清理 platform 为 NULL 的历史行（无法归属平台，改约束后必然报错，且新代码也无法消费）。
DELETE FROM "AstrbotBindingCode" WHERE "platform" IS NULL;--> statement-breakpoint
-- 旧单列主键由建表时的内联 PRIMARY KEY 生成，名称随建库路径而异，按实际约束名动态删除。
DO $$
DECLARE pk_name text;
BEGIN
  SELECT conname INTO pk_name FROM pg_constraint
    WHERE conrelid = '"AstrbotBindingCode"'::regclass AND contype = 'p';
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "AstrbotBindingCode" DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "AstrbotBindingCode" ALTER COLUMN "platform" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "AstrbotBindingCode" ADD CONSTRAINT "AstrbotBindingCode_userId_platform_pk" PRIMARY KEY("userId","platform");
