import test from 'node:test'
import assert from 'node:assert/strict'
import { issueUrl } from '../src/settings/feedback.ts'
test('feedback and bug reports open a GitHub issue with version and system only', () => {
  const info = { version: '0.1.0-beta.1', os: 'Windows 11 (15.0.0)', scaling: '125%' }
  const bug = new URL(issueUrl('bug', info))
  assert.equal(bug.origin + bug.pathname, 'https://github.com/Firextream/Divit/issues/new')
  assert.equal(bug.searchParams.get('title'), '[Bug] '); assert.equal(bug.searchParams.get('labels'), 'bug')
  assert.match(bug.searchParams.get('body'), /^\*\*App version:\*\* 0\.1\.0-beta\.1\n\*\*Windows version \/ display scaling:\*\* Windows 11 \(15\.0\.0\) · 125%\n/)
  assert.match(bug.searchParams.get('body'), /Please do not paste your writing/)
  const feedback = new URL(issueUrl('feedback', info))
  assert.equal(feedback.searchParams.get('labels'), 'feedback'); assert.equal(feedback.searchParams.get('title'), '[Feedback] ')
  assert.match(feedback.searchParams.get('body'), /^\*\*App version:\*\* 0\.1\.0-beta\.1 · Windows 11/)
})
