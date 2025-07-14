/**
 * 数据库验证修复脚本
 * 用于解决数据库验证逻辑中出现的问题，特别是大小写敏感性和无限循环问题
 */

const { PrismaClient } = require('@prisma/client');
const chalk = require('chalk');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// 主函数：修复数据库验证问题
async function fixDatabaseValidation() {
  console.log(chalk.blue('🔧 开始修复数据库验证问题...'));
  
  try {
    // 1. 检查数据库连接
    console.log(chalk.blue('🔌 测试数据库连接...'));
    
    const startTime = Date.now();
    try {
      const result = await prisma.$queryRaw`SELECT 1 as result`;
      const duration = Date.now() - startTime;
      console.log(chalk.green(`✅ 数据库连接成功 (${duration}ms)`));
    } catch (error) {
      console.error(chalk.red('❌ 数据库连接失败:'), error);
      console.log(chalk.yellow('请检查环境变量DATABASE_URL是否正确设置'));
      return false;
    }
    
    // 2. 打印数据库详细信息，便于诊断
    try {
      if (process.env.DATABASE_URL) {
        const dbUrl = new URL(process.env.DATABASE_URL);
        console.log(chalk.blue('📊 数据库信息:'));
        console.log(chalk.blue(`  协议: ${dbUrl.protocol}`));
        console.log(chalk.blue(`  主机: ${dbUrl.hostname}`));
        console.log(chalk.blue(`  端口: ${dbUrl.port || '默认'}`));
        console.log(chalk.blue(`  数据库名: ${dbUrl.pathname.replace('/', '')}`));
      }
    } catch (e) {
      console.log(chalk.yellow('⚠️ 无法解析数据库URL'));
    }
    
    // 3. 获取数据库表信息
    console.log(chalk.blue('📋 获取数据库表信息...'));
    
    const tablesQuery = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    const tables = tablesQuery;
    console.log(chalk.green(`✅ 发现 ${tables.length} 个表:`));
    
    for (const table of tables) {
      console.log(`  - ${table.table_name}`);
    }
    
    // 4. 检查Notification表结构
    console.log(chalk.blue('🔍 检查Notification表结构...'));
    
    const notificationColumnsQuery = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notification' OR table_name = 'Notification'
    `;
    
    if (notificationColumnsQuery.length === 0) {
      console.log(chalk.red('❌ 未找到Notification表或其列信息'));
      console.log(chalk.yellow('请确保数据库已正确迁移'));
      return false;
    }
    
    console.log(chalk.green(`✅ Notification表存在，发现 ${notificationColumnsQuery.length} 列:`));
    
    // 打印字段详情并检查大小写问题
    const columnNames = notificationColumnsQuery.map(col => col.column_name.toLowerCase());
    const actualColumnNames = notificationColumnsQuery.map(col => col.column_name);
    
    console.log(chalk.blue('📋 Notification表字段详情:'));
    for (const col of notificationColumnsQuery) {
      console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? '可空' : '非空'})`);
    }
    
    // 检查必要字段
    const requiredColumns = ['id', 'createdat', 'updatedat', 'type', 'message', 'read', 'userid', 'songid'];
    
    console.log(chalk.blue('🔍 验证必要字段是否存在(不区分大小写):'));
    
    let hasCaseIssues = false;
    const caseIssues = [];
    
    for (const required of requiredColumns) {
      const lowerExists = columnNames.includes(required.toLowerCase());
      const exactCol = actualColumnNames.find(col => col.toLowerCase() === required.toLowerCase());
      
      if (lowerExists) {
        console.log(chalk.green(`  ✅ ${required} - 存在 (实际名称: ${exactCol})`));
        
        if (exactCol !== required) {
          hasCaseIssues = true;
          caseIssues.push({ expected: required, actual: exactCol });
        }
      } else {
        console.log(chalk.red(`  ❌ ${required} - 缺失`));
      }
    }
    
    // 5. 报告大小写问题并提供解决方案
    if (hasCaseIssues) {
      console.log(chalk.yellow('⚠️ 检测到字段名大小写不匹配问题:'));
      
      for (const issue of caseIssues) {
        console.log(chalk.yellow(`  预期: ${issue.expected}, 实际: ${issue.actual}`));
      }
      
      console.log(chalk.blue('💡 解决方案:'));
      console.log(chalk.blue('  1. 确保所有数据库验证代码都不区分大小写'));
      console.log(chalk.blue('  2. 修改以下文件中的验证逻辑:'));
      console.log(chalk.blue('     - server/plugins/prisma.ts'));
      console.log(chalk.blue('     - server/models/schema.ts'));
      console.log(chalk.blue('  3. 确保对列名的比较使用toLowerCase()进行不区分大小写的比较'));
    }
    
    // 6. 尝试直接验证通知表的可用性
    console.log(chalk.blue('🧪 测试Notification表的可用性...'));
    
    try {
      // 仅查询一条记录，不使用可能有大小写问题的字段名
      const count = await prisma.$queryRaw`SELECT COUNT(*) FROM "Notification" LIMIT 1`;
      console.log(chalk.green('✅ Notification表查询测试成功'));
    } catch (error) {
      console.log(chalk.red('❌ Notification表查询测试失败:'), error);
      console.log(chalk.yellow('这可能表明表名存在问题或表结构有误'));
    }
    
    // 7. 检查新增的表是否存在并可用
    console.log(chalk.blue('🧪 检查新增表是否存在并可用...'));
    
    try {
      const systemSettingsExists = tables.some(
        t => t.table_name.toLowerCase() === 'systemsettings'
      );
      const playTimeExists = tables.some(
        t => t.table_name.toLowerCase() === 'playtime'
      );
      
      if (systemSettingsExists) {
        console.log(chalk.green('✅ SystemSettings表存在'));
        
        // 测试表可用性
        try {
          const settingsCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "SystemSettings" LIMIT 1`;
          console.log(chalk.green('✅ SystemSettings表查询测试成功'));
          
          // 检查是否有默认设置
          const hasSettings = await prisma.systemSettings.count();
          if (hasSettings === 0) {
            console.log(chalk.yellow('⚠️ SystemSettings表中没有数据，建议运行repair-database.js创建默认设置'));
          } else {
            console.log(chalk.green(`✅ SystemSettings表中有 ${hasSettings} 条记录`));
          }
        } catch (error) {
          console.log(chalk.red('❌ SystemSettings表查询测试失败:'), error);
        }
      } else {
        console.log(chalk.red('❌ SystemSettings表不存在，需要运行数据库迁移'));
      }
      
      if (playTimeExists) {
        console.log(chalk.green('✅ PlayTime表存在'));
        
        // 测试表可用性
        try {
          const playTimeCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "PlayTime" LIMIT 1`;
          console.log(chalk.green('✅ PlayTime表查询测试成功'));
          
          // 检查表结构
          const playTimeColumns = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'playtime' OR table_name = 'PlayTime'
          `;
          
          console.log(chalk.blue('📋 PlayTime表字段详情:'));
          for (const col of playTimeColumns) {
            console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? '可空' : '非空'})`);
          }
          
          // 检查startTime和endTime字段是否允许为null
          const startTimeColumn = playTimeColumns.find(col => col.column_name.toLowerCase() === 'starttime');
          const endTimeColumn = playTimeColumns.find(col => col.column_name.toLowerCase() === 'endtime');
          
          if (startTimeColumn && startTimeColumn.is_nullable !== 'YES') {
            console.log(chalk.yellow('⚠️ startTime字段不允许为null，可能需要运行迁移使其可为null'));
          }
          
          if (endTimeColumn && endTimeColumn.is_nullable !== 'YES') {
            console.log(chalk.yellow('⚠️ endTime字段不允许为null，可能需要运行迁移使其可为null'));
          }
        } catch (error) {
          console.log(chalk.red('❌ PlayTime表查询测试失败:'), error);
        }
      } else {
        console.log(chalk.red('❌ PlayTime表不存在，需要运行数据库迁移'));
      }
    } catch (error) {
      console.log(chalk.red('❌ 检查新增表时出错:'), error);
    }
    
    // 8. 检查验证逻辑是否会导致无限循环
    console.log(chalk.blue('🔄 检查是否存在可能导致无限循环的问题...'));
    console.log(chalk.yellow('⚠️ 在performDatabaseMaintenance函数中，如果直接使用prisma.notification.findFirst()'));
    console.log(chalk.yellow('   并且表结构有问题，可能会导致无限循环'));
    console.log(chalk.blue('💡 建议修复:'));
    console.log(chalk.blue('  1. 在server/models/schema.ts中使用原始查询而不是Prisma模型'));
    console.log(chalk.blue('  2. 添加重试次数限制和错误处理'));
    console.log(chalk.blue('  3. 使用情报Schema查询而不是模型访问来验证表结构'));
    
    console.log(chalk.green('✅ 数据库验证问题诊断完成'));
    console.log(chalk.green('如果您在Vercel上部署，请确保:'));
    console.log(chalk.green('1. 已经在本地运行了数据库迁移'));
    console.log(chalk.green('2. 在server/plugins/prisma.ts中为Vercel环境添加了简化的验证逻辑'));
    
    return true;
  } catch (error) {
    console.error(chalk.red('❌ 数据库验证修复脚本执行失败:'), error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行主函数
fixDatabaseValidation()
  .then(success => {
    if (success) {
      console.log(chalk.green('✨ 脚本执行完成'));
    } else {
      console.log(chalk.red('❌ 脚本执行失败'));
      process.exit(1);
    }
  })
  .catch(error => {
    console.error(chalk.red('💥 脚本执行出错:'), error);
    process.exit(1);
  }); 