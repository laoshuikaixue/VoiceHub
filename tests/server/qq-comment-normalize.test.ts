import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQqCommentRequestParam,
  normalizeQqCommentPage,
  normalizeQqCommentList
} from '../../server/utils/qqComment.ts'

test('QQ评论分页参数透传上一页游标', () => {
  assert.deepEqual(
    buildQqCommentRequestParam({
      topid: '12345',
      cursor: 'cursor-20',
      page: 1,
      pageSize: 20,
      type: 'latest'
    }),
    {
      BizType: 1,
      BizId: '12345',
      LastCommentSeqNo: 'cursor-20',
      PageSize: 20,
      PageNum: 1,
      PicEnable: 1,
      HashTagID: '',
      SelfSeeEnable: 1,
      AudioEnable: 1
    }
  )
})

test('QQ评论只保留根评论并将回复挂到根评论下', () => {
  const reply = {
    CmId: 'reply-1',
    Content: '回复内容',
    Nick: '回复者',
    Location: '广东'
  }
  const result = normalizeQqCommentList([
    {
      CmId: 'root-1',
      Content: '评论正文',
      Nick: '评论者',
      SubComments: [reply]
    },
    reply
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0]?.commentId, 'root-1')
  assert.equal(result[0]?.content, '评论正文')
  assert.equal(result[0]?.replies.length, 1)
  assert.equal(result[0]?.replies[0]?.commentId, 'reply-1')
  assert.equal(result[0]?.replies[0]?.user.location, '广东')
})

test('QQ评论去重并归一化图片与表情图片地址', () => {
  const result = normalizeQqCommentList([
    {
      CmId: 'root-1',
      Content: '带图评论',
      Nick: '评论者',
      Pic: 'http://music-file.y.qq.com/comment/example.jpg?a=1&amp;b=2',
      EmoPic: '//y.gtimg.cn/music/emoji/example.png'
    },
    {
      CmId: 'root-1',
      Content: '重复评论',
      Nick: '评论者'
    }
  ])

  assert.equal(result.length, 1)
  assert.deepEqual(result[0]?.images, ['https://music-file.y.qq.com/comment/example.jpg?a=1&b=2'])
  assert.deepEqual(result[0]?.emojis, ['https://y.gtimg.cn/music/emoji/example.png'])
})

test('QQ评论过滤只有头像和昵称但没有正文的无效项', () => {
  const result = normalizeQqCommentList([
    { CmId: 'empty-1', Content: '', Nick: '空评论', Avatar: 'https://example.com/a.jpg' },
    { CmId: 'valid-1', Content: '有效正文', Nick: '正常评论' }
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0]?.commentId, 'valid-1')
})

test('QQ评论按根评论字段收拢顶层回复', () => {
  const result = normalizeQqCommentList([
    { CmId: 'root-1', Content: '根评论', Nick: '评论者' },
    { CmId: 'reply-1', RootCmId: 'root-1', Content: '一级回复', Nick: '回复者' },
    { CmId: 'reply-2', ParentCmId: 'root-1', Content: '另一条回复', Nick: '回复者二' }
  ])

  assert.equal(result.length, 1)
  assert.deepEqual(
    result[0]?.replies.map((reply) => reply.commentId),
    ['reply-1', 'reply-2']
  )
})

test('QQ评论支持 SubCmListV1 回复列表', () => {
  const result = normalizeQqCommentList([
    {
      CmId: 'root-1',
      Content: '根评论',
      SubCmListV1: [{ CmId: 'reply-1', Content: '新版回复', Nick: '回复者' }]
    }
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0]?.replies[0]?.content, '新版回复')
})

test('QQ评论保留多层回复供前端完整展示', () => {
  const result = normalizeQqCommentList([
    {
      CmId: 'root-1',
      Content: '根评论',
      SubComments: [
        {
          CmId: 'reply-1',
          Content: '一级回复',
          SubComments: [{ CmId: 'reply-2', Content: '二级回复' }]
        }
      ]
    }
  ])

  assert.equal(result[0]?.replies[0]?.commentId, 'reply-1')
  assert.equal(result[0]?.replies[0]?.replies[0]?.commentId, 'reply-2')
})

test('QQ评论分页中根评论缺失时保留孤儿回复供后续归并', () => {
  const result = normalizeQqCommentPage([
    {
      CmId: 'reply-1',
      RootCmId: 'root-1',
      Content: '跨页回复',
      Nick: '回复者'
    }
  ])

  assert.equal(result.comments.length, 0)
  assert.equal(result.orphanReplies.length, 1)
  assert.equal(result.orphanReplies[0]?.commentId, 'reply-1')
  assert.equal(result.orphanReplies[0]?.rootCommentId, 'root-1')
})

test('QQ评论正文字面量换行还原为真实换行', () => {
  const result = normalizeQqCommentList([
    {
      CmId: 'root-1',
      Content: '第一行\\r\\n第二行\\n第三行\\r结尾',
      Nick: '评论者',
      SubComments: [{ CmId: 'reply-1', Content: '回复\\n换行', Nick: '回复者' }]
    }
  ])

  assert.equal(result[0]?.content, '第一行\n第二行\n第三行\n结尾')
  assert.equal(result[0]?.replies[0]?.content, '回复\n换行')
})
