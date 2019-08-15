# **hapi** core modules support policy

The hapi code module and its dependencies are published under the following support rules:

TL;DR

Every **major** version of the [core module](https://github.com/hapijs/hapi) receives at least one
year of support from the time of publication of the first `x.0.0` release. When a new **major**
version is published, the previous **major** version gets at least 3 months of support from that
moment. There are typically one to three major releases each year and most are simple to upgrade.
Core dependecies are maintained as long as they are used by a supported core version.

## Current versions

- `v18.x.x` - under active support. Maintenance support until at least January 18th, 2020.

Extended paid support options is available for v16, v17, and v18 by contacting
[sales@sideway.com](mailto:sales.sideway.com). For more information visit [hapi.business](http://hapi.business).

## Latest version

The latest version of the `hapi` module published to [npm](https://www.npmjs.com/package/hapi) is
the currently supported version. It receives bug fixes, security patches, and new features on an
ongoing basis.

Only the latest published module of the current **major** version is supported. For example, if the
current published version is `v10.2.3`, it is the only supported version of the `v10.x.x` branch.
If you are using an older version of `v10.x.x` such as `v10.0.4`, you must upgrade to `v10.2.3`
before opening issues and seeking support.

## Previous **major** version

Once a new major version is published, the previous major version goes into maintenance mode.
Versions in maintenance mode receive critical bug fixes and security patches but do not receive new
features.

Each major version branch stays in maintenance mode for whichever is the **longer** period:
- 1 year from the day of the first publication of **this** major version, or
- 3 months from the day of the first publication of the **following** major version.

For example, if:
- version `v9.0.0` was published on January 1st, 2010, and
- version `v10.0.0` was published on May 1st, 2010

Support for `v9.x.x` will end on January 1st, 2011 (one year from time of initial publication of
the `v9.0.0` release).

However, if:
- version `v9.0.0` was published on January 1st, 2010, and
- version `v10.0.0` was published on December 1st, 2010

Support for `v9.x.x` will end on March 1st, 2011 (three months from time of initial publication of
the `v10.0.0` release).

## Deprecated versions

When a version is no longer supported, it will be marked as `deprecated` in the npm registry. You
may continue using it at your own risk, ignoring the warning messages.

Starting with v16, you may obtain extended paid support by contacting [sales@sideway.com](mailto:sales.sideway.com).
