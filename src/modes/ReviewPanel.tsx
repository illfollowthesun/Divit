import { useEffect, useState } from 'react'
import type { Issue } from './checker'
import { localChecker } from './local-checker'
import { t, tn } from '../i18n'

function IssueRow({ issue, focus, accept, add, ignore, ignoreAlways }: { issue: Issue; focus: () => void; accept: (replacement: string) => void; add: () => void; ignore: () => void; ignoreAlways: () => void }) {
  const [options, setOptions] = useState<string[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void localChecker.suggest(issue).then(value => { if (active) setOptions(value) }).catch(() => { if (active) setError(t('Suggestions unavailable. Try again in a moment.')) })
    return () => { active = false }
  }, [issue.language, issue.original])
  return <li className="review-issue"><button className="issue-location" onClick={focus}>{issue.original}</button>{issue.type !== 'spelling' && <p>{issue.message}</p>}<div className="issue-suggestions">{options.map(option => <button key={option} onClick={() => accept(option)} aria-label={t('Replace {word} with {option}', { word: issue.original, option })}>{option}</button>)}</div>{error && <p role="alert">{error}</p>}<div className="issue-actions"><button onClick={ignore}>{t('Ignore once')}</button><button onClick={ignoreAlways} title={t('Ignore this word in this language for this project, including after restart')}>{t('Ignore always')}</button><button onClick={add}>{t('Add to dictionary')}</button></div></li>
}

export function ReviewPanel({ issues, checking, focus, accept, add, ignore, ignoreAlways }: { issues: Issue[]; checking: boolean; focus: (issue: Issue) => void; accept: (issue: Issue, replacement: string) => void; add: (issue: Issue) => void; ignore: (issue: Issue) => void; ignoreAlways: (issue: Issue) => void }) {
  return <aside className="review-panel" aria-label={t('Review issues')}><div className="section-label">{t('REVIEW')}</div><p role="status">{checking ? t('Checking…') : tn(issues.length, '{n} spelling issue', '{n} spelling issues')}</p><p className="quiet">{t('Local spelling · English (UK) and Turkish')}</p><ul>{issues.map(issue => <IssueRow key={issue.id} issue={issue} focus={() => focus(issue)} accept={text => accept(issue, text)} add={() => add(issue)} ignore={() => ignore(issue)} ignoreAlways={() => ignoreAlways(issue)}/>)}</ul>{!checking && !issues.length && <p className="quiet">{t('No spelling issues found.')}</p>}</aside>
}
