const { execSync } = require('child_process')
const path = require('path')

console.log('🚀 开始设置数据库...')

try {
  // 1. 推送数据库schema
  console.log('📊 推送数据库schema...')
  execSync('npx prisma db push', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  })
  
  // 2. 生成Prisma客户端
  console.log('🔧 生成Prisma客户端...')
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  })
  
  console.log('✅ 数据库设置完成！')
  console.log('💡 现在您可以：')
  console.log('   1. 重启开发服务器: npm run dev')
  console.log('   2. 在管理面板中点击"初始化角色系统"')
  
} catch (error) {
  console.error('❌ 数据库设置失败:', error.message)
  console.log('💡 请手动运行以下命令：')
  console.log('   npx prisma db push')
  console.log('   npx prisma generate')
  process.exit(1)
}
