### This document is a draft and serves as the basis for an open discussion

## TL;DR

The **hapi.js** organization (which includes all the repositories under [hapijs](https://github.com/hapijs) is run by the lead
maintainers of its repositories. Decisions are made by consensus whenever possible. If consensus is not possible, the lead
maintainer of the relevant repository has the final say. Lead maintainers cannot be removed unless they leave or hand over the
repository to someone else. However, repositories can be forked and removed from the organization. The entire project is run by
consensus by its lead maintainers.

# **hapi.js** Organization Governance

This document defined the rules and processes through which the **hapi.js** community makes decisions and shares control and leadership.
The governance model was designed to follow the spirit and tradition of open source by embracing consensus, forking, and individual
ownership as its building blocks.

## Principals

- **hapi.js** is an open, inclusive, and tolerant community of people working together to build a best-in-class set of node.js modules.
- We value diversity of individuals and opinions, and seek to operate on consensus whenever possible.
- We strive to maintain a welcoming, including, and harassment-free environment throughout the organization, regardless of the form of
  communication.
- When consensus is not achievable, we defer to the individual owners of each module to reach a conclusion; the powers of the individual
  owner are kept in check by the ability of the community to fork and replace its dependencies on the individual module and maintainer.

## Structure

Every organization activity is structured in the form of a repository. This includes (but not limited to) modules, discussions, web sites,
and events. **hapi.js** repositories must reside within the **hapi.js** organization and under its control.

### Core and Community repositories

Each organization repository belong in one of two groups:
- Core - the **hapi** module as well as any **hapi.js** module **hapi** depends on.
- Community - any repository **hapi** does not depend on.

### Lead maintainers

Each repository is assigned a lead maintainer. Lead maintainers act as the repository's BDFL (benevolent dictator for life) and are
responsible for the daily operations of the repository, for seeking consensus, and for making the final decisions when consensus cannot
be achieved. For modules, they have the npm publishing rights and the final say on releasing new versions.

Lead maintainers cannot be removed unless they leave, assign their position to someone else, or have become inactive for 30 days and
fails to respond to attempts to communicate, at which point a new contributor will assume responsibility for the repository. There are
no other ways to remove a lead maintainer as long as the repository remains part of the **hapi.js** organization.

The **hapi.js** organization is managed by its lead maintainers in two groups based on the designation of each repository (core and
community):
- Core contributors - are those who maintain **hapi** or one of its dependencies. Core contributors work together to guide the core
  framework, make decisions about releases and breaking changes, and are responsible for the daily maintenance of the core repositories.
  They also decide to accept or create new repositories, as well as remove repositories from the organization. The core contributors 
  operate on consensus only on all matters not specific to an individual repository. When no consensus is possible, the status-quo remains.
  Each core contributor has the final say over the repositories they lead, including the modules the repository depends on. Core
  contributors have full read/write/admin access to all the core repositories.
- Community contributors - are all the lead maintainers of repositories within the organization. Each community contributor has the final
  say over the repositories they lead, including the modules the repository depends on. Community contributors have full read/write/admin
  access to all the community repositories.

### **hapi** Lead maintainer

By the virtue of the lead maintainer's powers, the lead maintainer of the **hapi** repository can affect the designation (core and community)
of each repository (and its lead maintainer) by making changes to the module's dependencies. They have no other powers, cannot remove or
add modules to the organization without core contributors consensus, or make any other decisions outside the scope of the **hapi** repository.

