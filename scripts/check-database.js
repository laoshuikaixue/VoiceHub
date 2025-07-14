/**
 * 数据库检查脚本
 * 用于验证数据库结构和完整性
 */

const { PrismaClient } = require('@prisma/client');
const chalk = require('chalk');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// 验证数据库表和字段是否符合预期
async function validateDatabase() {
  console.log(chalk.blue('📊 开始验证数据库结构...'));

  try {
    // 检查必要的表是否存在，使用原始查询
    const tableQuery = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    const tables = tableQuery;
    const tableNames = tables.map(t => t.table_name.toLowerCase());
    
    console.log(chalk.blue(`✓ 发现 ${tableNames.length} 个数据库表`));
    
    // 检查是否存在所有必要的表
    const requiredTables = [
      { name: 'user', description: '用户表' },
      { name: 'song', description: '歌曲表' },
      { name: 'vote', description: '投票表' },
      { name: 'schedule', description: '排期表' },
      { name: 'notification', description: '通知表' },
      { name: 'notificationsettings', description: '通知设置表' }
    ];
    
    let hasMissingTables = false;
    
    console.log(chalk.blue('📋 检查必要的数据库表:'));
    for (const table of requiredTables) {
      if (tableNames.includes(table.name)) {
        console.log(chalk.green(`  ✓ ${table.name} (${table.description}) - 存在`));
      } else {
        hasMissingTables = true;
        console.log(chalk.red(`  ✗ ${table.name} (${table.description}) - 缺失`));
      }
    }
    
    if (hasMissingTables) {
      console.log(chalk.yellow('⚠️ 数据库缺少必要的表，需要运行数据库迁移'));
      console.log(chalk.yellow('  可以使用以下命令运行迁移: npx prisma migrate deploy'));
      return false;
    }
    
    // 检查Notification表的结构
    const notificationColumnsQuery = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'notification'
    `;
    
    const notificationColumns = notificationColumnsQuery;
    const columnNames = notificationColumns.map(c => c.column_name.toLowerCase());
    
    // 确保所有必要的字段都存在
    const requiredNotificationColumns = [
      { name: 'id', type: 'integer' },
      { name: 'createdat', type: 'timestamp' },
      { name: 'updatedat', type: 'timestamp' },
      { name: 'type', type: 'text' },
      { name: 'message', type: 'text' },
      { name: 'read', type: 'boolean' },
      { name: 'userid', type: 'integer' },
      { name: 'songid', type: 'integer' }
    ];
    
    let hasMissingColumns = false;
    
    console.log(chalk.blue('📋 检查通知表(Notification)的字段:'));
    for (const column of requiredNotificationColumns) {
      if (columnNames.includes(column.name)) {
        console.log(chalk.green(`  ✓ ${column.name} (${column.type}) - 存在`));
      } else {
        hasMissingColumns = true;
        console.log(chalk.red(`  ✗ ${column.name} (${column.type}) - 缺失`));
      }
    }
    
    if (hasMissingColumns) {
      console.log(chalk.yellow('⚠️ Notification表缺少必要的字段，可能需要更新数据库结构'));
      return false;
    }
    
    // 检查数据完整性
    console.log(chalk.blue('📊 检查数据完整性...'));
    
    // 验证用户表是否存在管理员用户
    const adminCount = await prisma.user.count({
      where: {
        role: 'ADMIN'
      }
    });
    
    if (adminCount === 0) {
      console.log(chalk.yellow('⚠️ 数据库中没有管理员用户，需要创建默认管理员'));
      return false;
    } else {
      console.log(chalk.green(`✓ 数据库中存在 ${adminCount} 个管理员用户`));
    }
    
    // 检查用户是否都有通知设置
    const userCount = await prisma.user.count();
    const settingsCount = await prisma.notificationSettings.count();
    
    if (userCount !== settingsCount) {
      console.log(chalk.yellow(`⚠️ 用户数量(${userCount})与通知设置数量(${settingsCount})不匹配，需要修复`));
      
      // 查找没有通知设置的用户
      const usersWithoutSettings = await prisma.user.findMany({
        where: {
          notificationSettings: null
        },
        select: {
          id: true,
          username: true
        }
      });
      
      console.log(chalk.yellow(`  有 ${usersWithoutSettings.length} 个用户缺少通知设置`));
      
      return false;
    } else {
      console.log(chalk.green(`✓ 所有用户(${userCount})都有对应的通知设置`));
    }
    
    console.log(chalk.green('✅ 数据库结构验证成功'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ 验证数据库结构时出错:'), error);
    return false;
  }
}

// 主函数
async function main() {
  console.log(chalk.blue('🔍 开始数据库检查...'));
  
  try {
    console.log(chalk.blue('🔌 测试数据库连接...'));
    await prisma.$queryRaw`SELECT 1 as result`;
    console.log(chalk.green('✅ 数据库连接成功'));
    
    // 验证数据库结构
    const isValid = await validateDatabase();
    
    if (isValid) {
      console.log(chalk.green('✅ 数据库检查完成，一切正常'));
    } else {
      console.log(chalk.yellow('⚠️ 数据库检查完成，发现问题'));
      console.log(chalk.yellow('  请运行 npm run repair-db 尝试修复问题'));
    }
  } catch (error) {
    console.error(chalk.red('❌ 数据库检查失败:'), error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主函数
main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  }); 