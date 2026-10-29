import { useEffect, useState } from 'react'
import type { Issue } from './checker'
import { localChecker } from './local-checker'

function IssueRow({ issue, focus, accept, add, ignore }: { issue: Issue; focus: () => void; accept: (replacement: string) => void; add: () => void; ignore: () => void }) {
  const [options, setOptions] = useState<string[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void localChecker.suggest(issue).then(value => { if (active) setOptions(value) }).catch(() => { if (active) setError('Suggestions unavailable. Try again in a moment.') })
    return () => { active = false }
  }, [issue.language, issue.original])
  return <li className="review-issue"><button className="issue-location" onClick={focus}>{issue.original}</button><p>{issue.message}</p><small>Local spelling · {issue.language === 'tr' ? 'Turkish' : 'English (UK)'}</small><div>{options.map(option => <button key={option} onClick={() => accept(option)} aria-label={`Replace ${issue.original} with ${option}`}>{option}</button>)}</div>{error && <p>{error}</p>}<div><button onClick={ignore}>Ignore in this project</button><button onClick={add}>Add to dictionary</button></div></li>
}

export function ReviewPanel({ issues, checking, focus, accept, add, ignore }: { issues: Issue[]; checking: boolean; focus: (issue: Issue) => void; accept: (issue: Issue, replacement: string) => void; add: (issue: Issue) => void; ignore: (issue: Issue) => void }) {
  return <aside className="review-panel" aria-label="Review issues"><div className="section-label">REVIEW</div><p role="status">{checking ? 'Checking…' : `${issues.length} spelling ${issues.length === 1 ? 'issue' : 'issues'}`}</p><p className="quiet">Local spelling · English (UK) and Turkish</p><ul>{issues.map(issue => <IssueRow key={issue.id} issue={issue} focus={() => focus(issue)} accept={text => accept(issue, text)} add={() => add(issue)} ignore={() => ignore(issue)}/>)}</ul>{!checking && !issues.length && <p className="quiet">No spelling issues found.</p>}</aside>
}
