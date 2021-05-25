import * as core from '@actions/core'
import * as github from '@actions/github'

run()

function run() {
	const token = core.getInput('token', {
		required: true,
	})
	const namePattern = core.getInput('name_pattern', {
		required: true,
	})

	const repo = github.context.repo
	const ref = github.context.ref

	const octokit = github.getOctokit(token)

	const { issue, project_card } = github.context.payload

	if (issue) return parseIssue()
	if (project_card) return parseProjectCard()

	return core.setFailed(
		'Use a workflow trigger that passes an issue or project-card to the context'
	)

	async function parseIssue() {
		const { title, number } = issue!
		const branchName = parseNamePattern(namePattern, { title, number })
		const { status } = await octokit.rest.git.createRef({
			...repo,
			sha: ref,
			ref: `refs/heads/${branchName}`,
		})
		if (status !== 201) return core.setFailed('Error creating ref, aborting...')

		console.log(`successfully created branch with name "${branchName}"`)
	}

	async function parseProjectCard() {
		if (!project_card.content_url)
			return console.log('Card has no content, aborting peacefully...')
		if (!project_card.content_url.contains('issue'))
			return console.log('Card has no issue as content, aborting peacefully...')

		const splitUrl = project_card.content_url.split('/')
		const issueNumber: number = splitUrl[splitUrl.length - 1]
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
		const { status } = await octokit.rest.git.createRef({
			...repo,
			sha: ref,
			ref: `refs/heads/${branchName}`,
		})
		if (status !== 201) return core.setFailed('Error creating ref, aborting...')

		console.log(`successfully created branch with name "${branchName}"`)
	}
}

function parseNamePattern(
	pattern: string,
	{ title, number }: { title: string; number: number }
) {
	return pattern
		.replace('{title}', title)
		.replace('{number}', number.toString())
}
