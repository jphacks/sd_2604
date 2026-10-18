export type MemberDisplayNameInput = {
  id?: string | null
  name?: string | null
}

export function getDuplicateNameSet(members: MemberDisplayNameInput[]): Set<string> {
  const counts = new Map<string, number>()

  for (const member of members) {
    const normalized = (member.name ?? '').trim().toLowerCase()
    if (!normalized) continue
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  const duplicates = new Set<string>()
  for (const [name, count] of counts.entries()) {
    if (count > 1) duplicates.add(name)
  }
  return duplicates
}

export function getDisplayNameWithId(member: MemberDisplayNameInput, members: MemberDisplayNameInput[] = []): { primary: string; suffix?: string } {
  const baseName = (member.name ?? '').trim() || '参加者'
  const idSuffix = member.id ? member.id.slice(0, 6) : ''
  const duplicateNames = getDuplicateNameSet(members)

  if (!idSuffix || !duplicateNames.has(baseName.trim().toLowerCase())) {
    return { primary: baseName }
  }

  return { primary: baseName, suffix: `#${idSuffix}` }
}
