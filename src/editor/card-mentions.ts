import type { ProjectCard } from '../shared/types'
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fold = (value: string) => value.toLocaleLowerCase('tr').replaceAll('ı', 'i')
export function cardMentions(text: string, cards: ProjectCard[]) {
  const names = cards.filter(c => !c.trashedAt).flatMap(c => [c.name, ...c.aliases].filter(Boolean).map(name => ({ name, id: c.id }))).sort((a, b) => b.name.length - a.name.length)
  if (!names.length) return []
  const patterns = names.map(n => Array.from(n.name).map(char => /[iIİı]/u.test(char) ? '[iIİı]' : escape(char)).join(''))
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${patterns.join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  return [...text.matchAll(regex)].flatMap(match => {
    const name = names.find(n => fold(n.name) === fold(match[0]))
    return name ? [{ from: match.index!, to: match.index! + match[0].length, id: name.id, name: match[0] }] : []
  })
}
