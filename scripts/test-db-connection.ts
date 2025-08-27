import 'dotenv/config';
import { db, testConnection, closeConnection } from '../drizzle/db';
import { users, songs, systemSettings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function testDatabaseConnection() {
  console.log('🔍 开始测试数据库连接和功能...');
  
  try {
    // 1. 测试基本连接
    console.log('\n1. 测试数据库连接...');
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('数据库连接失败');
    }

    // 2. 测试表是否存在
    console.log('\n2. 测试表结构...');
    const tableTests = [
      { name: 'users', query: () => db.select().from(users).limit(1) },
      { name: 'songs', query: () => db.select().from(songs).limit(1) },
      { name: 'systemSettings', query: () => db.select().from(systemSettings).limit(1) },
    ];

    for (const test of tableTests) {
      try {
        await test.query();
        console.log(`✅ 表 ${test.name} 存在且可访问`);
      } catch (error) {
        console.log(`❌ 表 ${test.name} 测试失败:`, error);
      }
    }

    // 3. 测试插入操作（如果没有数据）
    console.log('\n3. 测试数据操作...');
    
    // 检查是否有系统设置
    const existingSettings = await db.select().from(systemSettings).limit(1);
    if (existingSettings.length === 0) {
      console.log('创建默认系统设置...');
      await db.insert(systemSettings).values({
        siteTitle: 'VoiceHub 测试',
        siteDescription: '数据库迁移测试',
        enablePlayTimeSelection: false,
        enableSubmissionLimit: false,
        showBlacklistKeywords: false,
        hideStudentInfo: true,
      });
      console.log('✅ 默认系统设置创建成功');
    } else {
      console.log('✅ 系统设置已存在');
    }

    // 4. 测试查询操作
    console.log('\n4. 测试查询操作...');
    const settingsCount = await db.select().from(systemSettings);
    console.log(`✅ 查询到 ${settingsCount.length} 条系统设置记录`);

    const usersCount = await db.select().from(users);
    console.log(`✅ 查询到 ${usersCount.length} 个用户记录`);

    const songsCount = await db.select().from(songs);
    console.log(`✅ 查询到 ${songsCount.length} 首歌曲记录`);

    // 5. 测试更新操作
    console.log('\n5. 测试更新操作...');
    if (settingsCount.length > 0) {
      const firstSetting = settingsCount[0];
      await db
        .update(systemSettings)
        .set({ updatedAt: new Date() })
        .where(eq(systemSettings.id, firstSetting.id));
      console.log('✅ 更新操作测试成功');
    }

    console.log('\n🎉 所有数据库测试通过！');
    return true;
    
  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    return false;
  } finally {
    await closeConnection();
  }
}

// 性能测试函数
async function performanceTest() {
  console.log('\n🚀 开始性能测试...');
  
  try {
    const startTime = Date.now();
    
    // 并发查询测试
    const promises = [
      db.select().from(users).limit(10),
      db.select().from(songs).limit(10),
      db.select().from(systemSettings).limit(10),
    ];
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 并发查询测试完成，耗时: ${duration}ms`);
    
    if (duration < 1000) {
      console.log('🚀 性能表现良好');
    } else if (duration < 3000) {
      console.log('⚠️ 性能一般，可能需要优化');
    } else {
      console.log('❌ 性能较差，需要优化');
    }
    
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
  }
}

// 直接执行测试
testDatabaseConnection()
  .then(async (success) => {
    if (success) {
      await performanceTest();
      console.log('\n✅ 所有测试完成');
      process.exit(0);
    } else {
      console.log('\n❌ 测试失败');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ 测试脚本执行失败:', error);
    process.exit(1);
  });

export { testDatabaseConnection, performanceTest };