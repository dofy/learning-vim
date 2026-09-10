const courseFilePattern = /\b((?:chapter\d{2}\.md)|(?:vimrc\.vim)|(?:chapter04-demo\.js))\b/g

export function courseFileAtCursor(line: string, column: number) {
  for (const match of line.matchAll(courseFilePattern)) {
    const fileName = match[1]
    const start = (match.index ?? 0) + match[0].lastIndexOf(fileName)
    const end = start + fileName.length
    if (column >= start && column < end) return fileName
  }
}

export function courseLessonAtCursor(line: string, column: number) {
  return courseFileAtCursor(line, column)?.match(/^(chapter\d{2})\.md$/)?.[1]
}
