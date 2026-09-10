import { describe, expect, it } from 'vitest'
import { courseFileAtCursor, courseLessonAtCursor } from './courseFile'

describe('courseLessonAtCursor', () => {
  it('finds a Markdown course file under the cursor', () => {
    const line = '> Continue with [Chapter 4](chapter04.md).'
    expect(courseLessonAtCursor(line, line.indexOf('04'))).toBe('chapter04')
  })

  it('supports the first and last character of the file name', () => {
    const line = '(chapter11.md)'
    expect(courseLessonAtCursor(line, 1)).toBe('chapter11')
    expect(courseLessonAtCursor(line, 12)).toBe('chapter11')
  })

  it('ignores files that are not course chapters', () => {
    expect(courseLessonAtCursor('open README.md', 8)).toBeUndefined()
  })

  it('does not match a course file away from the cursor', () => {
    expect(courseLessonAtCursor('chapter02.md and chapter03.md', 14)).toBeUndefined()
  })

  it('finds the chapter 4 workspace files under the cursor', () => {
    const config = '[vimrc](vimrc.vim)'
    const demo = 'open chapter04-demo.js with gf'
    expect(courseFileAtCursor(config, config.indexOf('vimrc.vim') + 2)).toBe('vimrc.vim')
    expect(courseFileAtCursor(demo, demo.indexOf('demo'))).toBe('chapter04-demo.js')
  })

  it('does not treat arbitrary paths as course files', () => {
    expect(courseFileAtCursor('open ../../secret.js', 10)).toBeUndefined()
  })
})
