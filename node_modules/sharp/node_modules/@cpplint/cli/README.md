# cpplint

Fast, cross-platform C++ style checker for Node.js compatible runtimes.

Under the hood you'll find
[cpplint-cpp](https://github.com/matyalatte/cpplint-cpp),
a C++ re-implementation of the original Python-based
[cpplint](https://pypi.org/project/cpplint/).

Prebuilt binaries are made available for Linux, macOS and Windows
running on x64 and ARM64 CPUs.
These are currently re-packaged copies of the upstream wheels
for version 0.3.0.

There is no runtime dependency on Python or clang.

## Install

To run from the command line:
```sh
npx @cpplint/cli --help
```

To add to a project's `devDependencies`:
```sh
npm install --save-dev @cpplint/cli
```

To use as a lifecycle script in `package.json`:
```json
{
  "scripts": {
    "lint:cpp": "cpplint src/*"
  }
}
```

## Configure

Rules are specified in one or more `CPPLINT.cfg` files, which
typically contain a list of filters to apply or ignore.

```
set noparent

linelength=120

filter=-build/include
filter=+build/include_subdir
...
```
