import { api, desktop } from '../shared/api'
import type { BackupInfo, Settings } from '../shared/types'
import { language, t } from '../i18n'
export function BackupSettings({settings,change,info,busy,run}:{settings:Settings;change:(settings:Settings)=>void;info:BackupInfo|null;busy:boolean;run:()=>void}){
  const date=info?.lastBackupAt?new Date(info.lastBackupAt):null
  const day=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)
  const locale=language()==='tr'?'tr-TR':'en-GB'
  const last=date?`${day(date)===day(new Date())?t('today'):date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}`:t('not yet')
  return <section className="backup-settings"><div className="section-label">{t('AUTOMATIC BACKUP')}</div><label className="field">{t('Backup folder')}<input readOnly value={settings.backupFolder??''} placeholder={desktop?t('Choose OneDrive, a USB drive, or another folder'):t('Choose in the desktop app')}/></label><div className="backup-actions"><button type="button" className="outline-button" disabled={!desktop||busy} onClick={()=>{void api.chooseBackupFolder().then(folder=>{if(folder)change({...settings,backupFolder:folder})})}}>{t('Choose backup folder')}</button><button type="button" className="outline-button" disabled={!desktop||busy||!settings.backupFolder} onClick={run}>{t('Back up now')}</button>{settings.backupFolder&&<button type="button" disabled={busy} onClick={()=>change({...settings,backupFolder:''})}>{t('Disable backups')}</button>}</div><p className="backup-status" role="status">{t('Last backup: {when}',{when:settings.backupFolder?last:t('not configured')})}</p><p className="quiet">{t('Once a day while Yazı is open, and again on close. The 14 latest ZIPs stay here; older copies move to _trash. Restore manually into a separate folder.')}</p>{!desktop&&<p className="quiet">{t('The browser preview does not back up your Documents files.')}</p>}</section>
}
