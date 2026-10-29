import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {backup} from '../scripts/backup-bridge.mjs'
await mkdir('.tmp',{recursive:true})
async function fixture(){const base=await mkdtemp(join(process.cwd(),'.tmp/backup-')),dataRoot=join(base,'Yazi'),folder=join(base,'copies');await mkdir(join(dataRoot,'projects','story-1'),{recursive:true});await writeFile(join(dataRoot,'projects/story-1/draft.md'),'Çağla ve İlker.\nİstanbul.','utf8');return {base,dataRoot,folder}}
test('daily ZIPs are independently readable, preserve Unicode and include all writing',async()=>{
  const f=await fixture(),result=await backup({...f,reason:'daily'})
  const bytes=await readFile(result.path);assert.equal(bytes.readUInt32LE(),0x04034b50)
  if(process.platform==='win32'){
    const extracted=join(f.base,'check');const r=spawnSync('powershell.exe',['-NoProfile','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:YAZI_TEST_ZIP,$env:YAZI_TEST_OUT)'],{encoding:'utf8',windowsHide:true,env:{...process.env,YAZI_TEST_ZIP:result.path,YAZI_TEST_OUT:extracted}})
    assert.equal(r.status,0,r.stderr);assert.equal(await readFile(join(extracted,'Divit/projects/story-1/draft.md'),'utf8'),'Çağla ve İlker.\nİstanbul.')
  }
  const skipped=await backup({...f,reason:'daily'});assert.equal(skipped.skipped,true)
  const close=await backup({...f,reason:'close'});assert.notEqual(close.path,result.path)
})
test('only fourteen owned ZIPs stay active, older copies go to trash and unrelated ZIPs stay',async()=>{
  const f=await fixture();for(let day=1;day<=16;day++)await backup({...f,reason:'daily'},{now:new Date(2026,9,day,12)})
  await writeFile(join(f.folder,'personal.zip'),'unchanged')
  const files=await readdir(f.folder);assert.equal(files.filter(n=>n.startsWith('divit-')&&n.endsWith('.zip')).length,14)
  assert.equal((await readdir(join(f.folder,'_trash'))).length,2);assert.equal(await readFile(join(f.folder,'personal.zip'),'utf8'),'unchanged')
  assert.equal(await readFile(join(f.dataRoot,'projects/story-1/draft.md'),'utf8'),'Çağla ve İlker.\nİstanbul.')
})
test('backup folders inside the data root are rejected and disabled backup is harmless',async()=>{
  const f=await fixture();await assert.rejects(backup({...f,folder:join(f.dataRoot,'backups'),reason:'manual'}),/outside/)
  assert.equal((await backup({...f,folder:'',reason:'close'})).enabled,false)
})
