import test from 'node:test'
import assert from 'node:assert/strict'
import { cardMentions } from '../src/editor/card-mentions.ts'
test('Turkish card names, aliases and word boundaries are matched without changing the manuscript', () => {
  const cards = ['Derya','Çağla','İlker'].map((name, i) => ({ id:String(i),name,aliases: i === 0 ? ['The keeper'] : [] }))
  const text="Derya’nın yanında Çağla ve İLKER vardı. Deryalar yoktu. The keeper."
  const matches=cardMentions(text,cards)
  assert.deepEqual(matches.map(m=>m.id),['0','1','2','0'])
  assert.deepEqual(matches.map(m=>text.slice(m.from,m.to)),['Derya','Çağla','İLKER','The keeper'])
  assert.deepEqual(cardMentions('Derya',[{...cards[0],trashedAt:'today'}]),[])
})
