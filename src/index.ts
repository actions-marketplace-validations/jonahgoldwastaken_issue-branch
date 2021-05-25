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

	const { repo, sha, ref } = github.context
	const octokit = github.getOctokit(token)
	const { action } = github.context
	const { issue, project_card, commits } = github.context.payload

	switch (action) {
		case 'issue':
			parseIssue(issue)
		case 'project_card':
			parseProjectCard(project_card)
		case 'push':
			parsePush()
		default:
			core.setFailed(
				'This action was not run using an "issue", "project_card" or "push" event, please supply at least one of these events for this action to work.'
			)
	}

	function parseIssue(issue: WebhookPayload['issue']) {
		const { title, number } = issue!
		try {
			const branchName = parseNamePattern(namePattern, { title, number })
			return createBranch({ branchName, repo, sha })
		} catch (err) {
			core.setFailed(err)
		}
	}

	async function parseProjectCard(project_card: any) {
		if (!project_card.content_url)
			return console.log('Card has no content, aborting peacefully...')
		if (!project_card.content_url.contains('issue'))
			return console.log('Card has no issue as content, aborting peacefully...')

		const splitUrl = project_card.content_url.split('/')
		const issueNumber: number = splitUrl[splitUrl.length - 1]
		try {
			const {
				data: { title, number },
			} = await octokit.request(
				'GET /repos/{owner}/{repo}/issues/{issue_number}',
				{
					...repo,
					issue_number: issueNumber,
				}
			)

			const branchName = parseNamePattern(namePattern, { title, number })
			return createBranch({ branchName, repo, sha })
		} catch (err) {
			core.setFailed(err)
		}
	}

	async function parsePush() {
		try {
			const branch = ref.split('/')[ref.split('/').length - 1]
			const { data } = await octokit.rest.pulls.list({
				...repo,
				base: branch,
			})
			if (data.length)
				return console.log('Pull request already created, returning...')

			const { data: repository } = await octokit.rest.repos.get({
				...repo,
			})

			const issueNumber = namePattern
				.split('{number}')
				.reduce((acc, curr) => acc.replace(curr, ''), branch)

			await octokit.rest.pulls.create({
				...repo,
				title: `PR for issue: ${issueNumber}`,
				head: `${repo.owner}:${repository.default_branch}`,
				base: branch,
				draft: true,
				issue: +issueNumber,
			})

			console.log(`Successfully create PR for issue #${issueNumber}`)
		} catch (err) {
			core.setFailed(`Error while creating PR: ${err}`)
		}
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

function parseNamePattern(
	pattern: string,
	{ title, number }: { title: string; number: number }
) {
	return pattern.replace('{number}', number.toString())
}
