/**
 * 数据库修复脚本
 * 用于修复数据库结构和数据一致性问题
 */

const { PrismaClient } = require('@prisma/client');
const chalk = require('chalk');
const dotenv = require('dotenv');
const prompts = require('prompts');
const bcrypt = require('bcrypt');

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// 安全地执行数据库修复操作
async function repairDatabase() {
  console.log(chalk.blue('🔧 开始修复数据库...'));
  
  try {
    // 检查数据库连接
    console.log(chalk.blue('🔌 测试数据库连接...'));
    await prisma.$queryRaw`SELECT 1 as result`;
    console.log(chalk.green('✅ 数据库连接成功'));
    
    // 修复1：确保存在管理员用户
    console.log(chalk.blue('👤 检查管理员用户...'));
    const adminCount = await prisma.user.count({
      where: {
        role: 'ADMIN'
      }
    });
    
    if (adminCount === 0) {
      console.log(chalk.yellow('⚠️ 数据库中没有管理员用户，将创建默认管理员'));
      
      // 询问是否创建默认管理员
      const response = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: '是否创建默认管理员账户? (admin/admin123)',
        initial: true
      });
      
      if (response.confirm) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await prisma.user.create({
          data: {
            username: 'admin',
            name: '管理员',
            password: hashedPassword,
            role: 'ADMIN'
          }
        });
        
        console.log(chalk.green('✅ 已创建默认管理员账户 (用户名: admin, 密码: admin123)'));
      } else {
        console.log(chalk.yellow('⚠️ 跳过创建管理员账户'));
      }
    } else {
      console.log(chalk.green(`✓ 数据库中已存在 ${adminCount} 个管理员用户`));
    }
    
    // 修复2：为所有用户创建通知设置
    console.log(chalk.blue('🔔 检查用户通知设置...'));
    const usersWithoutSettings = await prisma.user.findMany({
      where: {
        notificationSettings: null
      },
      select: {
        id: true,
        username: true
      }
    });
    
    if (usersWithoutSettings.length > 0) {
      console.log(chalk.yellow(`⚠️ 发现 ${usersWithoutSettings.length} 个用户缺少通知设置，将修复`));
      
      // 询问是否修复
      const response = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `是否为 ${usersWithoutSettings.length} 个用户创建默认通知设置?`,
        initial: true
      });
      
      if (response.confirm) {
        for (const user of usersWithoutSettings) {
          await prisma.notificationSettings.create({
            data: {
              userId: user.id,
              enabled: true,
              songRequestEnabled: true,
              songVotedEnabled: true,
              songPlayedEnabled: true,
              refreshInterval: 60,
              songVotedThreshold: 1
            }
          });
          console.log(chalk.green(`  ✓ 已为用户 ${user.username} (ID: ${user.id}) 创建通知设置`));
        }
        
        console.log(chalk.green(`✅ 已为所有用户创建通知设置`));
      } else {
        console.log(chalk.yellow('⚠️ 跳过创建通知设置'));
      }
    } else {
      console.log(chalk.green('✓ 所有用户都有通知设置'));
    }
    
    // 修复3：检查数据库表结构
    console.log(chalk.blue('🏗️ 检查数据库表结构...'));
    
    try {
      // 检查必要的表是否存在
      const tableQuery = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      
      const tables = tableQuery;
      const tableNames = tables.map(t => t.table_name.toLowerCase());
      
      // 检查是否存在所有必要的表
      const requiredTables = ['user', 'song', 'vote', 'schedule', 'notification', 'notificationsettings', 'systemsettings', 'playtime'];
      const missingTables = requiredTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.log(chalk.red(`❌ 数据库缺少以下表: ${missingTables.join(', ')}`));
        console.log(chalk.yellow('⚠️ 无法自动创建缺失的表，请使用以下命令运行数据库迁移:'));
        console.log(chalk.yellow('  npx prisma migrate deploy'));
      } else {
        console.log(chalk.green('✓ 所有必要的数据库表都存在'));
      }
      
      // 修复5：检查系统设置
      console.log(chalk.blue('⚙️ 检查系统设置...'));
      const systemSettings = await prisma.systemSettings.findFirst();
      
      if (!systemSettings) {
        console.log(chalk.yellow('⚠️ 没有找到系统设置记录，将创建默认设置'));
        
        const createSettingsResponse = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: '是否创建默认系统设置?',
          initial: true
        });
        
        if (createSettingsResponse.confirm) {
          await prisma.systemSettings.create({
            data: {
              enablePlayTimeSelection: false
            }
          });
          console.log(chalk.green('✅ 已创建默认系统设置'));
        } else {
          console.log(chalk.yellow('⚠️ 跳过创建系统设置'));
        }
      } else {
        console.log(chalk.green('✓ 系统设置已存在'));
        console.log(chalk.blue('📋 系统设置详情:'));
        console.log(`  播放时段选择功能: ${systemSettings.enablePlayTimeSelection ? '已启用' : '已禁用'}`);
      }
      
      // 检查Notification表的结构
      if (tableNames.includes('notification')) {
        const notificationColumnsQuery = await prisma.$queryRaw`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'notification' OR table_name = 'Notification'
        `;
        
        const notificationColumns = notificationColumnsQuery;
        console.log(chalk.blue('📋 Notification表字段详情:'));
        for (const col of notificationColumns) {
          console.log(`  ${col.column_name} (${col.data_type})`);
        }
        
        const columnNames = notificationColumns.map(c => c.column_name.toLowerCase());
        
        // 确保所有必要的字段都存在
        const requiredNotificationColumns = ['id', 'createdat', 'updatedat', 'type', 'message', 'read', 'userid', 'songid'];
        const missingColumns = requiredNotificationColumns.filter(col => !columnNames.includes(col.toLowerCase()));
        
        if (missingColumns.length > 0) {
          console.log(chalk.red(`❌ Notification表缺少以下字段: ${missingColumns.join(', ')}`));
          
          // 检查是否是大小写问题
          const columnNamesExact = notificationColumns.map(c => c.column_name);
          console.log(chalk.blue('🔍 检查是否存在字段大小写问题...'));
          
          const caseProblems = [];
          for (const required of requiredNotificationColumns) {
            const exactMatch = columnNamesExact.find(name => name.toLowerCase() === required.toLowerCase());
            if (exactMatch && exactMatch !== required) {
              caseProblems.push({ required, actual: exactMatch });
            }
          }
          
          if (caseProblems.length > 0) {
            console.log(chalk.yellow('⚠️ 检测到字段大小写问题:'));
            for (const { required, actual } of caseProblems) {
              console.log(chalk.yellow(`  需要 '${required}', 实际为 '${actual}'`));
            }
            
            console.log(chalk.yellow('这可能导致系统错误地认为这些字段缺失'));
            
            const fixCaseResponse = await prompts({
              type: 'confirm',
              name: 'confirm',
              message: '是否修复代码以适应数据库的字段命名?',
              initial: true
            });
            
            if (fixCaseResponse.confirm) {
              console.log(chalk.blue('🔧 将修改server/plugins/prisma.ts中的验证逻辑...'));
              // 这里只是告知用户如何修复，而不是实际修改代码
              console.log(chalk.green('✓ 请手动编辑server/plugins/prisma.ts文件'));
              console.log(chalk.green('  并确保validateDatabase函数中不区分字段名大小写'));
              console.log(chalk.green('  或者在server/models/schema.ts中的performDatabaseMaintenance函数中添加同样的逻辑'));
            }
          } else {
            console.log(chalk.yellow('⚠️ 无法自动添加缺失的字段，请使用以下命令运行数据库迁移:'));
            console.log(chalk.yellow('  npx prisma migrate dev --name add_missing_notification_fields'));
          }
        } else {
          console.log(chalk.green('✓ Notification表结构完整'));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ 检查数据库表结构失败:'), error);
    }
    
    // 修复4：验证数据库连接器设置
    try {
      console.log(chalk.blue('🔌 检查数据库连接设置...'));
      
      // 检查.env文件中的DATABASE_URL是否正确
      if (!process.env.DATABASE_URL) {
        console.log(chalk.red('❌ 未找到DATABASE_URL环境变量'));
        console.log(chalk.yellow('⚠️ 请确保.env文件中包含正确的数据库连接URL'));
      } else {
        try {
          const dbUrl = new URL(process.env.DATABASE_URL);
          console.log(chalk.green(`✓ 数据库URL格式正确 (${dbUrl.protocol}://${dbUrl.host})`));
        } catch (e) {
          console.log(chalk.red('❌ DATABASE_URL格式不正确'));
          console.log(chalk.yellow('⚠️ 请检查.env文件中的数据库连接URL格式'));
        }
      }
      
      // 检查server/plugins/prisma.ts中的数据库验证逻辑
      console.log(chalk.yellow('ℹ️ 提示: 如果您仍然遇到数据库验证问题，可能需要检查以下文件:'));
      console.log(chalk.yellow('  - server/plugins/prisma.ts'));
      console.log(chalk.yellow('  - server/models/schema.ts'));
      console.log(chalk.yellow('确保这些文件中的表名和字段名验证逻辑不区分大小写'));
    } catch (error) {
      console.error(chalk.red('❌ 检查数据库连接设置失败:'), error);
    }
    
    console.log(chalk.green('✅ 数据库修复操作完成'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ 数据库修复失败:'), error);
    return false;
  }
}

// 主函数
async function main() {
  console.log(chalk.blue('🛠️ 数据库修复工具'));
  console.log(chalk.yellow('⚠️ 警告: 此工具将修改数据库。在继续之前，请确保已备份数据库!'));
  
  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: '您确定要继续修复数据库吗?',
    initial: false
  });
  
  if (response.confirm) {
    await repairDatabase();
  } else {
    console.log(chalk.yellow('取消操作，数据库未修改'));
  }
  
  // 断开数据库连接
  await prisma.$disconnect();
}

// 运行主函数
main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  }); 