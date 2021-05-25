# Issued branch

Combine the power of issues, branches and prs together.

## Inputs

### `name_pattern`

**Required** The name pattern for the branch. Requires "{number}" to add issue number to branch names.

**Default**: "issue-{number}"

### `token`

**Required** The token provided by GitHub under secrets.GITHUB_TOKEN.

## Example usage

```yaml
name: Update issues

on:
  issues:
    types: [opened]
  push:
    branches-ignore: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: theonejonahgold/issued-branch@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          name_pattern: issue-{number}
```
