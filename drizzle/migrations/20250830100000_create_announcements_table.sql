-- 创建公告表的 SQL 脚本
-- 如果表已存在，先删除
DROP TABLE IF EXISTS announcements CASCADE;

-- 创建公告表
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP,
  "endDate" TIMESTAMP,
  "createdByUserId" INTEGER NOT NULL,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "backgroundColor" TEXT DEFAULT '#1a1a1a',
  "textColor" TEXT DEFAULT '#ffffff',
  "buttonColor" TEXT DEFAULT '#4F46E5'
);

-- 创建索引
CREATE INDEX idx_announcements_active ON announcements("isActive");
CREATE INDEX idx_announcements_type ON announcements(type);
CREATE INDEX idx_announcements_dates ON announcements("startDate", "endDate");
CREATE INDEX idx_announcements_priority ON announcements(priority DESC);

-- 插入测试数据
INSERT INTO announcements (
  title, 
  content, 
  type, 
  "isActive", 
  priority, 
  "createdByUserId",
  "backgroundColor",
  "textColor",
  "buttonColor"
) VALUES (
  '欢迎使用公告系统', 
  '这是一个测试公告，用于验证公告功能是否正常工作。您可以在管理界面中创建、编辑和删除公告。',
  'EXTERNAL',
  true,
  1,
  1,
  '#ffffff',
  '#000000',
  '#4F46E5'
);

SELECT 'announcements table created successfully' as result;
