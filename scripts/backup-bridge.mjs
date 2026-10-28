import { open, readFile, writeFile, readdir, mkdir, rename, realpath, stat } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync, crc32 } from 'node:zlib'
import { randomUUID } from 'node:crypto'

function localDay(now) { return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10) }
async function stateAt(root) {
  try { return JSON.parse(await readFile(join(root,'.backup-state.json'),'utf8')) }
  catch(error) { if(error.code==='ENOENT')return {}; throw new Error('The backup state could not be read. Your files were not changed.') }
}
async function entries(root, prefix='Yazi/') {
  const out=[{name:prefix,directory:true}]
  for(const item of await readdir(root,{withFileTypes:true})) {
    if(item.isSymbolicLink())throw new Error('A symbolic link was found in Yazi. Back it up separately before continuing.')
    const path=join(root,item.name),name=prefix+item.name
    if(item.isDirectory())out.push(...await entries(path,name+'/'))
    else if(item.isFile())out.push({name,path,directory:false})
  }
  return out
}
// Standard UTF-8 ZIP with DEFLATE and CRC-32; files are compressed one at a time.
export async function writeZip(destination, files, now) {
  if(files.length>65535)throw new Error('This library needs ZIP64 support (more than 65535 entries).')
  const handle=await open(destination,'wx'),central=[];let offset=0
  const year=Math.max(1980,Math.min(2107,now.getFullYear())),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1),date=((year-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate()
  async function put(bytes){await handle.writeFile(bytes);offset+=bytes.length;if(offset>0xffffffff)throw new Error('This library exceeds the supported 4 GB ZIP size.')}
  try {
    for(const item of files){
      const name=Buffer.from(item.name,'utf8'),raw=item.directory?Buffer.alloc(0):await readFile(item.path),compressed=item.directory?raw:deflateRawSync(raw),method=item.directory?0:8,crc=crc32(raw),start=offset
      if(raw.length>0xffffffff||name.length>65535)throw new Error('A backup entry exceeds the ZIP format limit.')
      const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(method,8);header.writeUInt16LE(time,10);header.writeUInt16LE(date,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26)
      await put(header);await put(name);await put(compressed)
      const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(method,10);c.writeUInt16LE(time,12);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(item.directory?0x10:0,38);c.writeUInt32LE(start,42);central.push(c,name)
    }
    const start=offset;for(const part of central)await put(part)
    const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);await put(end);await handle.sync()
  }finally{await handle.close()}
}
export async function backup(request, runtime={}) {
  const root=await realpath(resolve(request.dataRoot)),state=await stateAt(root)
  if(!request.folder)return {enabled:false,lastBackupAt:null}
  if(request.reason==='status')return {enabled:true,lastBackupAt:state.folder===resolve(request.folder)?state.lastBackupAt??null:null,path:state.path??null}
  if(!['daily','close','manual'].includes(request.reason))throw new Error('Unknown backup reason.')
  const folder=resolve(request.folder)
  await mkdir(folder,{recursive:true});const canonical=await realpath(folder),child=relative(root,canonical)
  if(!child||!child.startsWith('..')&&!isAbsolute(child))throw new Error('Choose a backup folder outside Documents/Yazi.')
  const now=runtime.now??new Date(),day=localDay(now)
  if(request.reason==='daily'&&state.day===day&&state.folder===folder)return {enabled:true,skipped:true,lastBackupAt:state.lastBackupAt,path:state.path}
  const backupId=state.backupId??randomUUID()
  if(!/^[a-f0-9-]{36}$/.test(backupId))throw new Error('Invalid backup identity.')
  const filename=`yazi-${backupId}-${now.toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}.zip`,destination=join(folder,filename),temporary=destination+'.partial'
  const files=await entries(root)
  await writeZip(temporary,files,now)
  // Verify the completed directory record before publishing the archive.
  const file=await open(temporary,'r');try{const size=(await file.stat()).size,tail=Buffer.alloc(22);await file.read(tail,0,22,size-22);if(tail.readUInt32LE()!==0x06054b50||tail.readUInt16LE(10)!==files.length)throw new Error('Backup verification failed. The previous backup is unchanged.')}finally{await file.close()}
  await rename(temporary,destination)
  const next={backupId,day,folder,lastBackupAt:now.toISOString(),path:destination}
  const stateTemp=join(root,`.backup-state-${randomUUID()}.pending`);await writeFile(stateTemp,JSON.stringify(next,null,2),'utf8');await rename(stateTemp,join(root,'.backup-state.json'))
  const owned=(await readdir(folder)).filter(name=>name.startsWith(`yazi-${backupId}-`)&&name.endsWith('.zip')).sort().reverse()
  for(const name of owned.slice(14)){const trash=join(folder,'_trash');await mkdir(trash,{recursive:true});await rename(join(folder,name),join(trash,`${randomUUID()}-${name}`))}
  return {enabled:true,lastBackupAt:next.lastBackupAt,path:destination,files:files.length,bytes:(await stat(destination)).size}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  let raw='';for await(const chunk of process.stdin)raw+=chunk
  try{process.stdout.write(JSON.stringify({ok:true,result:await backup(JSON.parse(raw))}))}
  catch(error){process.stdout.write(JSON.stringify({ok:false,error:error.message}));process.exitCode=1}
}
