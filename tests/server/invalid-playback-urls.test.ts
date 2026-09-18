import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { isPlaybackUrlInvalid, markPlaybackUrlInvalid } from '../../app/utils/invalidPlaybackUrls.ts'

describe('invalidPlaybackUrls', () => {
  it('登记后按原样匹配', () => {
    const url = 'https://music.163.com/song/media/outer/url?id=559701010.mp3'
    assert.equal(isPlaybackUrlInvalid(url), false)
    markPlaybackUrlInvalid(url)
    assert.equal(isPlaybackUrlInvalid(url), true)
  })

  it('协议与空白差异视为同一地址', () => {
    markPlaybackUrlInvalid('http://cdn.example.com/a.mp3')
    assert.equal(isPlaybackUrlInvalid(' https://cdn.example.com/a.mp3 '), true)
  })

  it('空值不登记也不命中', () => {
    markPlaybackUrlInvalid('')
    markPlaybackUrlInvalid(undefined)
    markPlaybackUrlInvalid(null)
    assert.equal(isPlaybackUrlInvalid(''), false)
    assert.equal(isPlaybackUrlInvalid(undefined), false)
  })

  it('超出上限后淘汰最早的记录', () => {
    for (let i = 0; i < 260; i++) markPlaybackUrlInvalid(`https://cdn.example.com/${i}.mp3`)
    assert.equal(isPlaybackUrlInvalid('https://cdn.example.com/259.mp3'), true)
    assert.equal(isPlaybackUrlInvalid('https://cdn.example.com/0.mp3'), false)
  })
})
