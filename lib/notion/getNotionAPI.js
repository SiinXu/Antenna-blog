import { NotionAPI as NotionLibrary } from 'notion-client'
import BLOG from '@/blog.config'

// 2026-11: Notion's edge now returns 403 for got's default User-Agent,
// and wraps records as { value: { value, role } }. Send an explicit UA and
// unwrap records back to { value, role } so notion-client 6.x keeps working.
const USER_AGENT =
  'Mozilla/5.0 (compatible; NotionNext; +https://antenna-blog.incidental.site)'

function normalizeRecordMap(recordMap) {
  if (!recordMap || typeof recordMap !== 'object') return
  for (const table of Object.keys(recordMap)) {
    const records = recordMap[table]
    if (!records || typeof records !== 'object') continue
    for (const id of Object.keys(records)) {
      const rec = records[id]
      const inner = rec?.value
      if (
        inner &&
        typeof inner === 'object' &&
        inner.value &&
        typeof inner.value === 'object' &&
        !inner.id
      ) {
        records[id] = { ...rec, value: inner.value, role: rec.role ?? inner.role }
      }
    }
  }
}

class PatchedNotionAPI extends NotionLibrary {
  async fetch(args) {
    const gotOptions = args?.gotOptions || {}
    const res = await super.fetch({
      ...args,
      gotOptions: {
        ...gotOptions,
        headers: { 'user-agent': USER_AGENT, ...gotOptions.headers }
      }
    })
    normalizeRecordMap(res?.recordMap)
    return res
  }
}

const notionAPI = getNotionAPI()

function getNotionAPI() {
  return new PatchedNotionAPI({
    activeUser: BLOG.NOTION_ACTIVE_USER || null,
    authToken: BLOG.NOTION_TOKEN_V2 || null,
    userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
}

export default notionAPI
