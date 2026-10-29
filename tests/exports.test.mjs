import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { compileMarkdown, exportDocument } from '../scripts/export-bridge.mjs'
const project = () => ({ type: 'book', title: 'İstanbul günlüğü', body: 'Opening.', sections: [{id:'a',kind:'chapter',title:'One',body:'First chapter.'},{id:'b',kind:'scene',parentId:'a',title:'Ferry',body:'On the water.'},{id:'x',kind:'chapter',title:'Old',body:'Secret abandoned ending.',trashedAt:'2026-10-29'},{id:'y',kind:'scene',parentId:'x',title:'Hidden',body:'Hidden scene.'}], cards:[{name:'Private card'}] })
await mkdir('.tmp', { recursive: true })
test('export assembles the manuscript in chapter order and leaves notes, cards and set-aside text out', () => {
  const text = compileMarkdown(project())
  assert.ok(text.includes('İstanbul günlüğü')); assert.ok(text.indexOf('# One') < text.indexOf('## Ferry'))
  for (const excluded of ['Secret abandoned', 'Hidden scene', 'Private card']) assert.ok(!text.includes(excluded))
  assert.throws(() => compileMarkdown({ body:'![lost](yazi-image:missing)' }), /missing/)
})
test('Markdown works without Pandoc and repeated exports never overwrite a copy', async () => {
  const outputRoot = await mkdtemp(join(process.cwd(), '.tmp/export-'))
  const request={project:project(),images:[],format:'markdown',outputRoot}, runtime={tools:{pandoc:false,version:'',pdfEngine:null}}
  const a=await exportDocument(request,runtime), b=await exportDocument(request,runtime)
  assert.notEqual(a.path,b.path);assert.equal(await readFile(a.path,'utf8'),compileMarkdown(project()))
  assert.equal((await readdir(outputRoot)).length,2)
})
test('missing converters fail before creating output', async () => {
  const root = await mkdtemp(join(process.cwd(), '.tmp/export-missing-'))
  await assert.rejects(exportDocument({project:project(),format:'docx',outputRoot:root},{tools:{pandoc:false}}),/Pandoc is not installed/)
  await assert.rejects(exportDocument({project:project(),format:'pdf',outputRoot:root},{tools:{pandoc:true,pdfEngine:null}}),/PDF engine/)
  assert.deepEqual(await readdir(root),[])
})
test('converter invocation uses explicit arguments and UTF-8 stdin, retains original writing and validates output', async () => {
  const root = await mkdtemp(join(process.cwd(), '.tmp/export-converter-')), script=join(root,'fake-pandoc.mjs')
  // A process-contract test, not a claim that a real DOCX or PDF was rendered.
  await writeFile(script, `import fs from 'node:fs';let text='';for await(const c of process.stdin)text+=c;const args=process.argv.slice(2);const out=args[args.indexOf('--output')+1];fs.writeFileSync(out,JSON.stringify({args,text}));`)
  const original=project(), before=JSON.stringify(original)
  const runtime={executable:process.execPath,prefix:[script],tools:{pandoc:true,version:'test converter',pdfEngine:'typst'}}
  for(const format of ['docx','epub','pdf','markdown']){
    const result=await exportDocument({project:original,format,images:[],outputRoot:root},runtime)
    const saved=JSON.parse(await readFile(result.path,'utf8'))
    assert.ok(saved.text.includes('İstanbul günlüğü'))
    assert.ok(saved.args.includes(`--to=${format==='pdf'?'typst':format==='epub'?'epub3':format}`))
    if(format==='pdf')assert.ok(saved.args.includes('--pdf-engine=typst'))
  }
  assert.equal(JSON.stringify(original),before)
})
test('an optional Sources list lists quoted research sources in order of first use, with their citations', async () => {
  const { mkdtemp, mkdir: makeDir, writeFile: write } = await import('node:fs/promises')
  const dataRoot = await mkdtemp(join(process.cwd(), '.tmp/export-sources-')), outputRoot = join(dataRoot, 'exports')
  const story = { id: 'story-7', title: 'Son Vapur', type: 'story', body: 'İlk vapur kalktı.', sections: [] }
  await makeDir(join(dataRoot, 'projects/story-7/research'), { recursive: true })
  const at = when => [{ sectionId: null, at: when }]
  await write(join(dataRoot, 'projects/story-7/research/research.json'), JSON.stringify({ sources: [
    { id: 'b', title: 'Second used', site: 'Site B', saved: '2026-10-02', status: 'used', usedIn: at('2026-10-29T12:00:00Z') },
    { id: 'n', title: 'Never quoted', status: 'read', usedIn: [] },
    { id: 'a', title: 'First used', site: 'Şehir Hatları', published: '2026-10-20', url: 'https://example.com/a', status: 'used', usedIn: at('2026-10-29T09:00:00Z') },
  ] }))
  const runtime = { tools: { pandoc: false } }
  const withList = await exportDocument({ project: story, format: 'markdown', images: [], outputRoot, dataRoot, includeSources: true }, runtime)
  assert.equal(await readFile(withList.path, 'utf8'), '---\ntitle: "Son Vapur"\n---\n\nİlk vapur kalktı.\n\n# Sources\n\n- First used, Şehir Hatları (2026-10-20), https://example.com/a\n- Second used, Site B (2026-10-02)\n')
  const without = await exportDocument({ project: story, format: 'markdown', images: [], outputRoot, dataRoot }, runtime)
  assert.doesNotMatch(await readFile(without.path, 'utf8'), /Sources/)
  const none = await exportDocument({ project: { ...story, id: 'no-research' }, format: 'markdown', images: [], outputRoot, dataRoot, includeSources: true }, runtime)
  assert.doesNotMatch(await readFile(none.path, 'utf8'), /# Sources/)
  await assert.rejects(exportDocument({ project: { ...story, id: '../x' }, format: 'markdown', images: [], outputRoot, dataRoot, includeSources: true }, runtime), /project folder/)
})
