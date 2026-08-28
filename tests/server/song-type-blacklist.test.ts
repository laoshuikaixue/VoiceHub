import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeLanguageLabels,
  parseNeteaseWikiTypes,
  parseTencentSongTypes,
  mapQqLanguage,
  matchBlacklistGenre,
  matchBlacklistLanguage
} from '../../server/utils/song-type-resolver.ts'
import {
  BLACKLIST_LANGUAGE_VALUES,
  BLACKLIST_GENRE_VALUES,
  QQ_LANGUAGE_CODE_MAP,
  QQ_GENRE_NAME_MAP
} from '../../server/config/constants.ts'

test('网易云语种文本拆分与同义词归一', () => {
  assert.deepEqual(normalizeLanguageLabels('粤语'), ['粤语'])
  assert.deepEqual(normalizeLanguageLabels('英语、韩语'), ['英语', '韩语'])
  assert.deepEqual(normalizeLanguageLabels('国语'), ['华语'])
  assert.deepEqual(normalizeLanguageLabels('普通话,英语'), ['华语', '英语'])
  assert.deepEqual(normalizeLanguageLabels(''), [])
  assert.deepEqual(normalizeLanguageLabels(null), [])
})

test('解析网易云歌曲百科的语种与曲风', () => {
  const payload = {
    code: 200,
    data: {
      blocks: [
        {
          rnData: {
            songName: '海阔天空',
            blocks: [
              {
                blockInfo: {
                  blockCode: 2,
                  wikiSubElementVos: [
                    { pattern: 1, title: '曲风', wikiSubMetaVos: [{ id: 1098, text: '摇滚-流行摇滚' }, { id: 1000, text: '流行' }] },
                    { pattern: 0, title: '语种', content: '粤语' },
                    { pattern: 0, title: '发行时间', content: '1993-09-09' }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  }
  const types = parseNeteaseWikiTypes(payload)
  assert.deepEqual(types.languages, ['粤语'])
  assert.deepEqual(types.genres, ['摇滚-流行摇滚', '流行'])

  // 空结构容错
  assert.deepEqual(parseNeteaseWikiTypes(null), { languages: [], genres: [] })
  assert.deepEqual(parseNeteaseWikiTypes({ code: 200, data: {} }), { languages: [], genres: [] })
})

test('QQ 语种数字码映射', () => {
  assert.equal(mapQqLanguage(0), '华语')
  assert.equal(mapQqLanguage(1), '粤语')
  assert.equal(mapQqLanguage(2), '闽南语')
  assert.equal(mapQqLanguage(3), '日语')
  assert.equal(mapQqLanguage(4), '韩语')
  assert.equal(mapQqLanguage(5), '英语')
  assert.equal(mapQqLanguage(19), null)
  assert.equal(mapQqLanguage('abc'), null)
  assert.equal(mapQqLanguage(undefined), null)
})

test('解析 QQ 详情的官网分类名（语种/曲风）', () => {
  const payload = {
    req: {
      data: {
        info: {
          lan: { content: [{ value: '国语' }, { value: ' 英语' }] },
          genre: { content: [{ value: 'Pop' }, { value: 'Rock' }] }
        },
        track_info: { language: 0, genre: 1 }
      }
    }
  }
  const types = parseTencentSongTypes(payload)
  assert.deepEqual(types.languages, ['华语', '英语'])
  assert.deepEqual(types.genres, ['流行', '摇滚'])

  // 未收录流派名归「其他」，重复值去重
  const other = parseTencentSongTypes({
    req: { data: { info: { genre: { content: [{ value: 'Animation' }, { value: 'Rock ' }] } } } }
  })
  assert.deepEqual(other.languages, [])
  assert.deepEqual(other.genres, ['其他', '摇滚'])

  // 空结构容错
  assert.deepEqual(parseTencentSongTypes(null), { languages: [], genres: [] })
  assert.deepEqual(parseTencentSongTypes({ req: { data: {} } }), { languages: [], genres: [] })
  assert.deepEqual(parseTencentSongTypes({ req: { data: { info: {} } } }), { languages: [], genres: [] })
})

test('QQ 语种：info.lan 缺失时回退数值码，未收录整数码归「其他」', () => {
  const fallback = parseTencentSongTypes({ req: { data: { track_info: { language: 5 } } } })
  assert.deepEqual(fallback.languages, ['英语'])

  const unknownCode = parseTencentSongTypes({ req: { data: { track_info: { language: 99 } } } })
  assert.deepEqual(unknownCode.languages, ['其他'])

  const missing = parseTencentSongTypes({ req: { data: { track_info: {} } } })
  assert.deepEqual(missing.languages, [])
})

test('曲风与黑名单值按一级分类匹配', () => {
  assert.equal(matchBlacklistGenre('摇滚', ['摇滚-流行摇滚', '流行']), true)
  assert.equal(matchBlacklistGenre('流行', ['流行-华语流行']), true)
  assert.equal(matchBlacklistGenre('原声带', ['原声带-动画片原声']), true)
  assert.equal(matchBlacklistGenre('电子', ['流行-华语流行']), false)
  assert.equal(matchBlacklistGenre('R&B', ['R&B']), true)
  assert.equal(matchBlacklistGenre('', ['流行']), false)
  assert.equal(matchBlacklistGenre('流行', []), false)
})

test('曲风匹配：「其他」命中候选列表之外的一级分类', () => {
  assert.equal(matchBlacklistGenre('其他', ['金属-重金属']), true)
  assert.equal(matchBlacklistGenre('其他', ['嘻哈说唱-硬核说唱', '原声带-电影原声']), true)
  assert.equal(matchBlacklistGenre('其他', ['中国传统特色-京剧']), true)
  assert.equal(matchBlacklistGenre('其他', ['流行-华语流行']), false)
  assert.equal(matchBlacklistGenre('其他', ['古典-巴洛克时期']), false)
  assert.equal(matchBlacklistGenre('其他', []), false) // 无法判定不命中
})

test('语种匹配：「其他」命中主要候选值之外的小语种', () => {
  assert.equal(matchBlacklistLanguage('英语', ['英语']), true)
  assert.equal(matchBlacklistLanguage('英语', ['法语']), false)
  assert.equal(matchBlacklistLanguage('其他', ['法语']), true)
  assert.equal(matchBlacklistLanguage('其他', ['俄语', '西班牙语']), true)
  assert.equal(matchBlacklistLanguage('其他', ['华语']), false)
  assert.equal(matchBlacklistLanguage('其他', ['英语', '韩语']), false)
  assert.equal(matchBlacklistLanguage('其他', []), false) // 无法判定不命中
  assert.equal(matchBlacklistLanguage('', ['法语']), false)
})

test('QQ 语种映射值必须落在语种候选值集合内', () => {
  for (const label of Object.values(QQ_LANGUAGE_CODE_MAP)) {
    assert.ok(
      (BLACKLIST_LANGUAGE_VALUES as readonly string[]).includes(label),
      `QQ 语种映射值 ${label} 不在候选值集合中`
    )
  }
})

test('QQ 流派映射值必须落在曲风候选值集合内', () => {
  for (const label of Object.values(QQ_GENRE_NAME_MAP)) {
    assert.ok(
      (BLACKLIST_GENRE_VALUES as readonly string[]).includes(label),
      `QQ 流派映射值 ${label} 不在候选值集合中`
    )
  }
})

test('候选值集合无重复', () => {
  assert.equal(new Set(BLACKLIST_LANGUAGE_VALUES).size, BLACKLIST_LANGUAGE_VALUES.length)
  assert.equal(new Set(BLACKLIST_GENRE_VALUES).size, BLACKLIST_GENRE_VALUES.length)
})
