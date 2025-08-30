// 检查并创建公告表的脚本
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// 加载环境变量
config();

async function checkAndCreateAnnouncementsTable() {
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    console.log('检查数据库连接...');
    
    // 检查表是否存在
    const tableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'announcements'
      );
    `;
    
    if (tableExists[0].exists) {
      console.log('✅ announcements 表已存在');
    } else {
      console.log('❌ announcements 表不存在，正在创建...');
      
      // 创建表
      await client`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'site',
          priority INTEGER NOT NULL DEFAULT 1,
          is_active BOOLEAN NOT NULL DEFAULT true,
          target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          background_color VARCHAR(7) DEFAULT '#ffffff',
          text_color VARCHAR(7) DEFAULT '#000000',
          border_color VARCHAR(7) DEFAULT '#e5e5e5',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          view_count INTEGER NOT NULL DEFAULT 0
        );
      `;
      
      console.log('✅ announcements 表创建成功');
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error);
  } finally {
    await client.end();
  }
}

checkAndCreateAnnouncementsTable();
