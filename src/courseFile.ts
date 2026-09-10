const courseFilePattern = /\b(chapter\d{2})\.md\b/g

export function courseLessonAtCursor(line: string, column: number) {
  for (const match of line.matchAll(courseFilePattern)) {
    const start = match.index
    const end = start + match[0].length
    if (column >= start && column < end) return match[1]
  }
}
