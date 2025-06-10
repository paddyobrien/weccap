# WECCAP
An optical motion capture system designed for you use in wave tank experiments. Allows for recording 3d motion capture in 6DoF at 120hz. Data can be captured and exported to a simple CSV file for further analysis. This system is designed for use with an active IR tracker target and uses Sony PSEye cameras.

# Setup

## Prerequisites

You will need a python and nodejs runtimes and package managers, the project is designed to use the package managers UV and yarn:

- [UV python package manager](https://github.com/astral-sh/uv)
- [Yarn](https://yarnpkg.com/)

## Installation

Download this fork of the PSEye driver: https://github.com/paddyobrien/pseyepy into a sibling folder to where you downloaded this project. This fork fixes the build on modern MacOS and adds a package definition file.

You can now start the backend with:

```
uv run --directory . -v server/index.py
``` 

This should install all dependencies and start the server. Check the output and the number of cameras found should be displayed.

In another terminal, start the UI. Change direction in `/ui` and run:

```
yarn run dev
```

## How to use

TODO

## Credits
WECCAP make heavy use of code originally by https://github.com/jyjblrd/Low-Cost-Mocap