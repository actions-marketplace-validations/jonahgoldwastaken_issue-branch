import * as core from '@actions/core'
import * as github from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'

run()

function run() {
	const token = core.getInput('token', {
		required: true,
	})
	const namePattern = core.getInput('name_pattern', {
		required: true,
	})

	if (!namePattern.includes('{number}'))
		return core.setFailed(
			'Please use a name pattern with "{number}" included, e.g. "issue-{number}"'
		)

	const { repo, sha, ref } = github.context
	const octokit = github.getOctokit(token)
	const { eventName } = github.context
	const { issue } = github.context.payload

	switch (eventName) {
		case 'issues':
			runIssues(issue)
			break
		case 'push':
			runPush()
			break
		default:
			core.setFailed(
				'This action was not run using an "issue" or "push" event, please supply at least one of these events for this action to work.'
			)
			break
	}

	function runIssues(issue: WebhookPayload['issue']) {
		const { number } = issue!
		try {
			const branchName = parseNamePattern(namePattern, { number })
			return createBranch({ branchName, repo, sha })
		} catch (err) {
			core.setFailed(err)
		}
	}

	async function runPush() {
		try {
			const branch = ref.split('/')[ref.split('/').length - 1]
			const pulls = await listPullsForHead(branch)
			if (pulls.length)
				return console.log('Pull request already created, returning...')

			const { fork, default_branch: mainBranch } = await getRepo(repo)

			const issueNumber = namePattern
				.split('{number}')
				.reduce((acc, curr) => acc.replace(curr, ''), branch)

			const base = fork ? `${repo.owner}:${mainBranch}` : mainBranch

			try {
				await octokit.rest.pulls.create({
					...repo,
					base,
					head: branch,
					draft: true,
					issue: +issueNumber,
				})
			} catch {
				await octokit.rest.pulls.create({
					...repo,
					base,
					head: branch,
					draft: false,
					issue: +issueNumber,
				})
			}

			console.log(`Successfully create PR for issue #${issueNumber}`)
		} catch (err) {
			core.setFailed(`Error while creating PR: ${err}`)
		}
	}

	async function listPullsForHead(head: string) {
		const { data } = await octokit.rest.pulls.list({
			...repo,
			head,
		})
		return data
	}

	async function getRepo(repo: { owner: string; repo: string }) {
		const { data } = await octokit.rest.repos.get({
			...repo,
		})
		return data
	}

	async function createBranch({
		branchName,
		repo,
		sha,
	}: {
		branchName: string
		repo: { owner: string; repo: string }
		sha: string
	}) {
		try {
			await octokit.rest.git.createRef({
				...repo,
				sha,
				ref: `refs/heads/${branchName}`,
			})

			console.log(`successfully created branch with name "${branchName}"`)
		} catch (err) {
			core.setFailed(
				`Error creating branch with repo "${repo}", branchName "${branchName}" and sha "${sha}": ${err}`
			)
		}
	}
}

function parseNamePattern(pattern: string, { number }: { number: number }) {
	return pattern.replace('{number}', number.toString())
}
