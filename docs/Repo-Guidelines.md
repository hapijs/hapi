# Running a hapijs Repository

The purpose of this document is to outline procedures and guidelines for the operation of a repository under the [hapijs](https://github.com/hapijs) umbrella. The number of modules and repositories under the [hapijs](https://github.com/hapijs) organization will continue to grow so it is important that every repository has a certain amount of parity. This allows for the community to instantly have a level of familiarity regardless of the repository they are working in.

## Labels

Every [hapijs](https://github.com/hapijs) repository should make generous use of labels. Labels help to make triaging issues easier. Below is the list of labels that every repository should be using and a brief explanation of the intent of the label.

- `breaking change` - tag issues and pull requests with this change if, when the code is merged, it will cause a breaking change in the current version. `breaking change` issues should be attached to the appropriate milestone.
- `bug` - issues that have been *confirmed* (with reproducible steps) to be bugs in the code should be tagged with `bug`.
- `community ask` - issues where the hapijs team is actively requesting community feedback should be tagged with `community ask`. Issues like, [who is using hapi](https://github.com/hapijs/hapi/issues/1613) or [the joi bug hunt](https://github.com/hapijs/joi/issues/281) are recent examples of `community ask` issues.
- `dependency` - if the issue or pull request addresses a dependency issue, it should have the `dependency` tag. Any module that is running in production should have a version >= 1.0.0 and all of it's dependencies should follow suite.
- `discussion` - this tag gets applied to issues that are ideas or requests from the community that need active input from other community members and possibly the Lead Maintainer.
- `enhancement` - non-breaking changes that would generally require a bump in the minor version number.
- `non-issue` - this label is used when a user reports something that they perceive as a bug in a hapijs module but ultimately ends up being a user error. Often, issues tagged with `non-issue` will lead to updated documentation or additional validation.
- `question` - generic label for user questions.
- `release notes` - if the changes to a module are really broad, a new issue should be created and labeled with `release notes`. The issue should document what the changes are, how it impacts existing code and how to migrate to the next version.
- `request` - issues that are asking for specific changes and have been approved by the community or hapijs team, should have the `request` label applied to them. This label can be useful for people looking for ways to contribute to the hapijs ecosystem.
- `security` - issues that improve or fix existing security deficiencies should be labeled with `security`.

## Milestones

Milestones are used to keep track of future releases. Both issues and pull requests related to the future release should have a milestone attached to them. Milestone names should be the same as the semantic version of the module. Once all of the attached issues and pull requests are completed, a new version of the module should be published to the npm registry. The milestone is then considered "complete" and should be closed.

## Releases

In the [hapijs](https://github.com/hapijs) universe, we take releases very seriously because we are maintaining enterprise-grade software. We strictly adhere to [semantic versioning](http://semver.org/) for all versions. When a milestone is completed, the Lead Maintainer will go through the following steps:

1. Make sure the local master branch is 100% up to date with `upstream:master`.
2. Run `npm publish` in the command line to update the npm registry.
3. Tag the version just published to npm. Run `git tag -a vx.y.z -m "version x.y.z"` where `x.y.z` matches the `version` key in "package.json". The format of the tag and the message should match exactly as in the example.
4. Update the tags in the `upstream` remote via `git push upstream --tags`.

## Issues

Issues can be created by anyone with a GitHub account. They should be tagged by any [hapijs organization](https://github.com/orgs/hapijs/people) members with access. Issues can be closed by the original requester, any member of the Core team, and the Lead Maintainer. Conversely, a Core team member or the Lead Maintainer can reopen issues at their discretion. It is important to keep issues maintained as it provides a task list for the community of contributors.

Issues that are closed with a pull request should be linked together to keep the "paper trail" intact.

Be mindful when closing issues as it is one of the primary ways we, as an organization, communicate with the community. Try to make sure the issue has been sufficiently resolved before closing it. In other words, don't be a jerk about closing issues.

## Retiring

Sometimes one of the [hapijs](https://github.com/hapijs) modules becomes outdated or obsolete. At that time, the team will decide the next steps to take with the module. If the team has decided that the module is no longer useful, it will be immediately retired. If the module is still useful by the general community, a request for a new maintainer will be sent through the normal communication channels. If no one volunteers to take over the project after one week, it is retired.

If a new maintainer does volunteer, the repository ownership is transfered out of the hapijs organization to the new maintainer. The license must be updated to remove any mention of Walmart or hapijs.

### Steps to Retire
1. "README.md" is updated with the "Retired" image and the message "No longer being maintained". A link should also be added that points to the last version's "README.md".
2. Tag all open issues with the "deprecated" tag and then close them. Disable issues globally in the repository settings.
3. Bump the minor version of the module in "package.json".
4. The Lead Maintainer should then follow the steps for [releases](#releases).
5. The Lead Maintainer should issue an `npm deprecate` command and deprecate all versions of the module.
